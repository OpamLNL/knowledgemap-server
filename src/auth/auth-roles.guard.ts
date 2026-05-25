import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { admin } from '../config/firebase-admin';
import { UsersService } from '../users/users.service';



@Injectable()
export class AuthRolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly usersService: UsersService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;


        if (!authHeader?.startsWith('Bearer ')) {


            throw new UnauthorizedException('Missing token');
        }

        const token = authHeader.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(token);

        const user = await this.usersService.resolveUserFromAuth({
            firebaseUid: decoded.uid,
            email: decoded.email,
            name: decoded.name ?? decoded.email?.split('@')[0] ?? 'No Name',
        });

        request.user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name,
            role: user.role,
        };



        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
            throw new ForbiddenException('Недостатньо прав доступу');
        }

        return true;
    }
}
