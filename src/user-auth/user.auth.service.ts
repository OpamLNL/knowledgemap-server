import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class UserAuthService {
    constructor(private readonly usersService: UsersService) {}

    async findUserByEmail(email: string) {

        

        return this.usersService.findByEmail(email);
    }
}

