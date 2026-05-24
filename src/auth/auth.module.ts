import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserAuthService } from '../user-auth/user.auth.service';

@Module({
    imports: [
        ConfigModule,
        UsersModule,
    ],
    providers: [
        AuthService,
        UserAuthService,
    ],
    controllers: [AuthController],
    exports: [
        AuthService,
    ],
})
export class AuthModule {}
