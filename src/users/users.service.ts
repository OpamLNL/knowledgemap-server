import {
    Injectable,
    NotFoundException,
    ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {User, UserRole} from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user.dto';
import { CreateUserDto } from './dtos/create-user.dto';

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
    async findByFirebaseUid(uid: string): Promise<Pick<User, 'email' | 'name' | 'role'> | null> {
        const user = await this.usersRepository.findOne({
            where: { firebase_uid: uid },
            select: ['email', 'name', 'role'],
        });

        if (!user) {console.log('Користувача не знайдено, створюємо'); return null;}

        return user ;
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
}
