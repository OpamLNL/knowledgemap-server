import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

import { admin } from '../config/firebase-admin';
import { UsersService } from '../users/users.service';
import {IS_PUBLIC_KEY} from "./public.decorator";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector,
        private readonly usersService: UsersService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<Request>();
        const authHeader = req.headers.authorization;

        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;


        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing token');
        }




        const token = authHeader.split(' ')[1];
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const user = await this.usersService.findByFirebaseUid(decodedToken.uid);

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            req.user = {
                uid: decodedToken.uid,
                role: user.role,
            };

            console.log('✅ FirebaseAuthGuard set req.user:', req.user);

            return true;
        } catch (err) {
            console.error('Firebase token verification failed:', err);
            throw new UnauthorizedException('Invalid Firebase token');
        }
    }
}
