import {
    Controller,
    Post,
    Body,
    Get,

    Req,
    BadRequestException, UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dtos/create-user.dto';
// import { FirebaseAuthGuard } from './firebase-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import {Public} from "./public.decorator";
import {FirebaseAuthGuard} from "./firebase-auth.guard";
import { Roles } from './roles.decorator';
import { UserRole } from '../users/entities/user.entity';



console.log('✅ AuthController підключено');


@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService
    ) {}







    // Bootstrap адміна (лише для існуючого admin; перший admin — через seed / db:init)
    @Roles(UserRole.ADMIN)
    @Post('register-admin')
    async registerAdmin() {
        return this.authService.createAdmin();
    }

    // перевірка токена Firebase

    @Get('protected')
    getProtected(@Req() req: Request) {
        console.log('🔥 INSIDE getProtected()', req.user);
        console.log('protected   ' , req.user);


        return {
            message: '✅ Access granted (Firebase Token Valid)',
            user: req.user, // це декодований Firebase токен (uid, email тощо)
        };
    }

    // Ручна реєстрація користувача (лише admin; основний шлях — POST /users/save після Google)
    @Roles(UserRole.ADMIN)
    @Post('register')
    async register(@Body() createUserDto: CreateUserDto) {
        const existingUser = await this.usersService.findByEmail(createUserDto.email);
        if (existingUser) {
            throw new BadRequestException('Користувач з таким email вже існує!');
        }
        return this.usersService.create(createUserDto);
    }
}
