import {
    Injectable,
    NotFoundException,
    ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { unlink } from 'fs/promises';
import {User, UserRole} from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import {
    filenameFromAvatarUrl,
    userAvatarAbsolutePath,
    userAvatarPublicUrl,
} from './user-avatar.storage';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    /**
     * 🔹 Створити нового користувача
     */
    async create(createUserDto: Partial<User>): Promise<User> {
        if (createUserDto.email) {
            const existingUser = await this.findByEmail(createUserDto.email);
            if (existingUser) {
                throw new ConflictException(`Користувач з email ${createUserDto.email} вже існує.`);
            }
        }

        const newUser = this.usersRepository.create(createUserDto);
        return await this.usersRepository.save(newUser);
    }

    /**
     * 🔹 Отримати всіх користувачів.
     */
    async findAll(): Promise<User[]> {

        console.log("FIND ALL");

        return await this.usersRepository.find();
    }

    /**
     * 🔹 Отримати одного користувача за ID.
     */
    // async findOne(id: number): Promise<User> {
    //     const user = await this.usersRepository.findOne({ where: { id } });
    //     if (!user) {
    //         throw new NotFoundException(`Користувача з ID ${id} не знайдено.`);
    //     }
    //     return user;
    // }

    // /**
    //  * 🔹 Публічна інформація про користувача.
    //  */
    // async findPublicUserById(id: number): Promise<Pick<User, 'id' | 'email' | 'role'> | null> {
    //     return this.usersRepository.findOne({
    //         where: { id },
    //         select: ['id', 'email', 'role'],
    //     });
    // }

    /**
     * 🔹 Знайти користувача за email.
     */
    async findByEmail(email: string): Promise<User | null> {
        return await this.usersRepository.findOne({ where: { email } });
    }


    /**
     * 🔹 Отримати коротку інформацію про користувача за Firebase UID (для /me).
     */
    async findByFirebaseUid(
        uid: string,
    ): Promise<Pick<User, 'id' | 'email' | 'name' | 'role' | 'avatarUrl' | 'createdAt'> | null> {
        const user = await this.usersRepository.findOne({
            where: { firebase_uid: uid },
            select: ['id', 'email', 'name', 'role', 'avatarUrl', 'createdAt'],
        });

        if (!user) {
            return null;
        }

        return user;
    }

    /**
     * Знайти або створити користувача після Firebase-авторизації.
     * Якщо в БД уже є запис з таким email (наприклад, admin без firebase_uid),
     * прив'язуємо uid до нього замість створення нового student.
     */
    async resolveUserFromAuth(params: {
        firebaseUid: string;
        email?: string | null;
        name?: string | null;
        avatarUrl?: string | null;
    }): Promise<Pick<User, 'email' | 'name' | 'role'>> {
        const { firebaseUid, email, name, avatarUrl } = params;

        const byUid = await this.usersRepository.findOne({
            where: { firebase_uid: firebaseUid },
        });

        const byEmail =
            email != null && email !== ''
                ? await this.usersRepository.findOne({ where: { email } })
                : null;

        if (byUid && byEmail && byUid.id !== byEmail.id) {
            byEmail.firebase_uid = firebaseUid;
            if (name && !byEmail.name) {
                byEmail.name = name;
            }
            if (avatarUrl && !byEmail.avatarUrl) {
                byEmail.avatarUrl = avatarUrl;
            }
            await this.usersRepository.save(byEmail);
            return { email: byEmail.email, name: byEmail.name, role: byEmail.role };
        }

        if (byUid) {
            return { email: byUid.email, name: byUid.name, role: byUid.role };
        }

        if (byEmail) {
            byEmail.firebase_uid = firebaseUid;
            if (name && !byEmail.name) {
                byEmail.name = name;
            }
            if (avatarUrl && !byEmail.avatarUrl) {
                byEmail.avatarUrl = avatarUrl;
            }
            await this.usersRepository.save(byEmail);
            return { email: byEmail.email, name: byEmail.name, role: byEmail.role };
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const role =
            adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase()
                ? UserRole.ADMIN
                : UserRole.STUDENT;

        const created = await this.usersRepository.save(
            this.usersRepository.create({
                firebase_uid: firebaseUid,
                email: email ?? `${firebaseUid}@unknown.local`,
                name: name ?? email?.split('@')[0] ?? 'User',
                avatarUrl: avatarUrl ?? undefined,
                role,
            }),
        );

        return { email: created.email, name: created.name, role: created.role };
    }


    /**
     * 🔹 Знайти користувача для авторизації (тільки для ручного входу).
     */
    async findUserForAuth(email: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { email },
            select: ['id', 'email', 'role', 'name'],
        });
    }

    /**
     * 🔹 Оновити дані користувача.
     */
    // async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    //     const user = await this.findOne(id);
    //     await this.usersRepository.update(id, updateUserDto);
    //     return this.findOne(id);
    // }


    async updateRole(id: number, role: string) {
        if (!Object.values(UserRole).includes(role as UserRole)) {
            throw new BadRequestException(`Invalid role: ${role}`);
        }

        const user = await this.usersRepository.findOneBy({ id });
        if (!user) {
            throw new NotFoundException(`User ${id} not found`);
        }

        user.role = role as UserRole;
        return this.usersRepository.save(user);
    }

    /** Надати роль teacher користувачу за email (доступно teacher/admin). */
    async grantTeacherRoleByEmail(email: string) {
        const normalized = email.trim().toLowerCase();
        if (!normalized) {
            throw new BadRequestException('Email обов\'язковий');
        }

        const user = await this.usersRepository
            .createQueryBuilder('u')
            .where('LOWER(u.email) = :email', { email: normalized })
            .getOne();

        if (!user) {
            throw new NotFoundException(
                'Користувача з таким email не знайдено. Спочатку він має увійти в систему.',
            );
        }

        if (user.role === UserRole.ADMIN) {
            throw new BadRequestException('Неможливо змінити роль адміністратора');
        }

        if (user.role === UserRole.TEACHER) {
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                message: 'Користувач уже має роль викладача',
            };
        }

        user.role = UserRole.TEACHER;
        const saved = await this.usersRepository.save(user);

        return {
            id: saved.id,
            email: saved.email,
            name: saved.name,
            role: saved.role,
            message: 'Роль викладача успішно надано',
        };
    }



    /**
     * 🔹 Видалити користувача.
     */
    // async remove(id: number): Promise<{ message: string }> {
    //     const user = await this.findOne(id);
    //     await this.usersRepository.delete(id);
    //     return { message: `Користувач ${user.email} успішно видалений.` };
    // }

    /**
     * 🔹 Пошук користувачів за полями (з пагінацією та сортуванням).
     */
    async search(query: any): Promise<{ data: User[]; total: number; page: number; limit: number }> {
        const where: any = {};

        if (query.name) {
            where.name = ILike(`%${query.name}%`);
        }

        if (query.email) {
            where.email = ILike(`%${query.email}%`);
        }

        if (query.role) {
            where.role = query.role;
        }

        const page = query.page ? Math.max(1, Number(query.page)) : 1;
        const limit = query.limit ? Math.max(1, Number(query.limit)) : 10;
        const skip = (page - 1) * limit;

        const sortBy = query.sortBy || 'id';
        const sortOrder = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

        const [data, total] = await this.usersRepository.findAndCount({
            where,
            order: { [sortBy]: sortOrder },
            take: limit,
            skip,
        });

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async updateAvatar(firebaseUid: string, filename: string) {
        const user = await this.usersRepository.findOne({ where: { firebase_uid: firebaseUid } });
        if (!user) {
            throw new NotFoundException('Користувача не знайдено');
        }

        await this.removeUploadedAvatarFile(user.avatarUrl);
        user.avatarUrl = userAvatarPublicUrl(filename);
        await this.usersRepository.save(user);
        return this.findByFirebaseUid(firebaseUid);
    }

    async clearAvatar(firebaseUid: string) {
        const user = await this.usersRepository.findOne({ where: { firebase_uid: firebaseUid } });
        if (!user) {
            throw new NotFoundException('Користувача не знайдено');
        }

        await this.removeUploadedAvatarFile(user.avatarUrl);
        user.avatarUrl = undefined;
        await this.usersRepository.save(user);
        return this.findByFirebaseUid(firebaseUid);
    }

    private async removeUploadedAvatarFile(avatarUrl?: string | null) {
        if (!avatarUrl) return;
        const filename = filenameFromAvatarUrl(avatarUrl);
        if (!filename) return;
        try {
            await unlink(userAvatarAbsolutePath(filename));
        } catch {
            /* файл уже видалено */
        }
    }
}
