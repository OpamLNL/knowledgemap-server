import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
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

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get('me/teaching/overview')
    @ApiOperation({ summary: 'Статистика проходження по моїх опублікованих картах' })
    getTeachingOverview(@Req() req: Request) {
        const { uid, role } = req.user as { uid: string; role: UserRole };
        return this.cabinetService.getTeachingOverview(uid, role);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get('me/teaching/learners')
    @ApiOperation({ summary: 'Усі учні, які проходять мої карти' })
    getTeachingLearners(@Req() req: Request) {
        const { uid, role } = req.user as { uid: string; role: UserRole };
        return this.cabinetService.getTeachingLearners(uid, role);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get('me/teaching/maps/:mapId/learners')
    @ApiOperation({ summary: 'Детальний прогрес учнів по одній карті' })
    getMapLearners(
        @Param('mapId', ParseIntPipe) mapId: number,
        @Req() req: Request,
    ) {
        const { uid, role } = req.user as { uid: string; role: UserRole };
        return this.cabinetService.getMapLearnersDetail(mapId, uid, role);
    }
}
