import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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

    /** На Vercel /api/docs часто без статики — відкриває Swagger Editor з OpenAPI цього деплою. */
    @Public()
    @Get('docs/open')
    @ApiOperation({
        summary:
            'Перенаправлення на Swagger Editor (тестування API на production/preview)',
    })
    openApiDocs(@Req() req: Request, @Res() res: Response): void {
        const proto =
            (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
            'https';
        const host =
            (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
            req.headers.host;
        const specUrl = `${proto}://${host}/api/docs-json`;
        const editorUrl = `https://editor.swagger.io/?url=${encodeURIComponent(specUrl)}`;
        res.redirect(302, editorUrl);
    }

    @Public()
    @Get('platform/stats')
    @ApiOperation({ summary: 'Публічна статистика платформи для landing' })
    getPlatformStats() {
        return this.statsService.getPlatformStats();
    }
}
