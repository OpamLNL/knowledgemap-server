import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserAuthService } from '../user-auth/user.auth.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UsersService,
        private readonly userAuthService: UserAuthService,
    ) {}

    async createAdmin(): Promise<any> {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminName = process.env.ADMIN_NAME || 'Admin';

        if (!adminEmail) {
            throw new Error('ADMIN_EMAIL не встановлено у .env');
        }

        const existingAdmin = await this.userAuthService.findUserByEmail(adminEmail);
        if (existingAdmin) {
            return { message: 'Адміністратор вже існує' };
        }

        const newAdmin = await this.userService.create({
            email: adminEmail,
            name: adminName,
            role: UserRole.ADMIN,
        });

        return newAdmin;
    }
}
