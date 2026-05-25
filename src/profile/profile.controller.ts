import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../users/entities/user.entity';
import { UsersCabinetService } from './users-cabinet.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class ProfileController {
    constructor(private readonly cabinetService: UsersCabinetService) {}

    @Get('me/cabinet')
    @ApiOperation({ summary: 'Особистий кабінет — профіль, прогрес, карти' })
    getMyCabinet(@Req() req: Request) {
        const { uid, role } = req.user as { uid: string; role: UserRole };
        return this.cabinetService.getCabinet(uid, role);
    }
}
