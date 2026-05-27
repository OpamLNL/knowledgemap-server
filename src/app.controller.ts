import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import { AdminStatisticsService } from './admin/admin-statistics.service';

@ApiTags('platform')
@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly statsService: AdminStatisticsService,
    ) {}

    @Public()
    @Get()
    @ApiOperation({ summary: 'Вітальний текст (legacy)' })
    getHello(): string {
        return this.appService.getHello();
    }

    @Public()
    @Get('health')
    @ApiOperation({ summary: 'Перевірка, що сервер працює (без авторизації)' })
    getHealth() {
        return this.appService.getHealth();
    }

    @Public()
    @Get('platform/stats')
    @ApiOperation({ summary: 'Публічна статистика платформи для landing' })
    getPlatformStats() {
        return this.statsService.getPlatformStats();
    }
}
