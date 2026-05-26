import {
    Controller,
    Get,
    Query,
    Param,
    Delete,
    Patch,
    Req,
    Body,
    Post,
    UnauthorizedException,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { userAvatarMulterOptions } from './user-avatar.storage';
import type { UploadedImageFile } from '../nodes/types/uploaded-image-file';
// import { UpdateUserDto } from './dtos/update-user.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
// import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {admin} from "../config/firebase-admin";
import {Public} from "../auth/public.decorator";

@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}



    @Roles(UserRole.ADMIN)
    @Patch(':id/role')
    updateUserRole(
        @Param('id') id: number,
        @Body('role') role: string,
    ) {
        return this.usersService.updateRole(id, role);
    }


    // @UseGuards(FirebaseAuthGuard)
    // @Get(':id')
    // findOne(@Param('id') id: string) {
    //     return this.usersService.findOne(+id);
    // }

    // @UseGuards(FirebaseAuthGuard)
    // @Patch(':id')
    // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    //     return this.usersService.update(+id, updateUserDto);
    // }

    // @UseGuards(FirebaseAuthGuard, RolesGuard)
    // @Roles(UserRole.ADMIN)
    // @Delete(':id')
    // remove(@Param('id') id: string) {
    //     return this.usersService.remove(+id);
    // }



    @Public()
    @Post('save')
    async saveAfterGoogleLogin(
        @Req() req: Request,
        @Body() body: { email: string; name: string; avatarUrl?: string }
    ) {


        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw new UnauthorizedException('No token provided');



        const decoded = await admin.auth().verifyIdToken(token);
        const firebaseUid = decoded.uid;

        return this.usersService.resolveUserFromAuth({
            firebaseUid,
            email: body.email,
            name: body.name,
            avatarUrl: body.avatarUrl,
        });
    }

    // @UseGuards(FirebaseAuthGuard)

    @Get('me')
    async getMe(@Req() req: Request) {
        const firebaseUid = (req.user as any).uid;
        const user = await this.usersService.findByFirebaseUid(firebaseUid);

        if (!user) {
            throw new UnauthorizedException('Користувача не знайдено');
        }

        return user;
    }

    @Post('me/avatar')
    @ApiOperation({ summary: 'Завантажити аватар профілю' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    })
    @UseInterceptors(FileInterceptor('file', userAvatarMulterOptions))
    uploadAvatar(@Req() req: Request, @UploadedFile() file: UploadedImageFile) {
        if (!file) {
            throw new BadRequestException('Файл не передано');
        }
        const firebaseUid = (req.user as { uid: string }).uid;
        return this.usersService.updateAvatar(firebaseUid, file.filename);
    }

    @Delete('me/avatar')
    @ApiOperation({ summary: 'Скинути завантажений аватар' })
    removeAvatar(@Req() req: Request) {
        const firebaseUid = (req.user as { uid: string }).uid;
        return this.usersService.clearAvatar(firebaseUid);
    }


    // @UseGuards(FirebaseAuthGuard)
    @Roles(UserRole.ADMIN)
    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @Roles(UserRole.ADMIN)
    @Get()
    getUsers() {
        return this.usersService.findAll();
    }




    // @UseGuards(FirebaseAuthGuard)
    @Get('search')
    search(
        @Query('name') name?: string,
        @Query('email') email?: string,
        @Query('role') role?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: string,
    ) {
        return this.usersService.search({
            name,
            email,
            role,
            page,
            limit,
            sortBy,
            sortOrder,
        });
    }
}
