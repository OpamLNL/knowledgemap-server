import {
    Controller,
    Get,
    Param,
    Query,
    ParseIntPipe,
    NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminStatisticsService } from './admin-statistics.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminStatisticsController {
    constructor(private readonly statsService: AdminStatisticsService) {}

    @Get('dashboard')
    @ApiOperation({ summary: 'Загальна панель адміністратора' })
    getDashboard() {
        return this.statsService.getDashboard();
    }

    @Get('statistics/maps')
    @ApiOperation({ summary: 'Огляд усіх карт знань' })
    getMapsOverview() {
        return this.statsService.getMapsOverview();
    }

    @Get('statistics/maps/:mapId')
    @ApiOperation({ summary: 'Статистика по конкретній карті (студенти, % завершення)' })
    async getMapStatistics(@Param('mapId', ParseIntPipe) mapId: number) {
        const stats = await this.statsService.getMapStatistics(mapId);
        if (!stats) throw new NotFoundException(`Карту id=${mapId} не знайдено`);
        return stats;
    }

    @Get('statistics/users')
    @ApiOperation({ summary: 'Список користувачів з прогресом' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    getUsersOverview(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.statsService.getUsersOverview(
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @Get('statistics/users/:firebaseUid')
    @ApiOperation({ summary: 'Детальна статистика користувача' })
    async getUserStatistics(@Param('firebaseUid') firebaseUid: string) {
        const stats = await this.statsService.getUserStatistics(firebaseUid);
        if (!stats) throw new NotFoundException(`Користувача uid=${firebaseUid} не знайдено`);
        return stats;
    }
}
