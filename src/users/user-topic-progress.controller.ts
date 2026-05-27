import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    Req,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserTopicProgressService } from './user-topic-progress.service';
import { CreateUserTopicProgressDto, MarkTopicCompleteDto } from './dtos/create-user-topic-progress.dto';
import { UpdateUserTopicProgressDto } from './dtos/update-user-topic-progress.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { NodesService } from '../nodes/nodes.service';

@ApiTags('progress')
@ApiBearerAuth('access-token')
@Controller('progress')
export class UserTopicProgressController {
    constructor(
        private readonly service: UserTopicProgressService,
        private readonly nodesService: NodesService,
    ) {}

    // ─── Student (і всі авторизовані — свій прогрес) ───

    @Get('me')
    @ApiOperation({ summary: 'Мій прогрес — список записів' })
    getMyProgress(@Req() req: { user: { uid: string } }) {
        return this.service.findByUser(req.user.uid);
    }

    @Get('me/summary')
    @ApiOperation({ summary: 'Моя статистика по карті (completed/available/locked/%)' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    getMySummary(
        @Req() req: { user: { uid: string } },
        @Query('mapId') mapId?: string,
    ) {
        const parsed = mapId ? parseInt(mapId, 10) : undefined;
        return this.nodesService.getProgressSummary(req.user.uid, parsed);
    }

    @Post('me')
    @ApiOperation({ summary: 'Позначити тему як вивчену (студент)' })
    async markMyTopicComplete(
        @Req() req: { user: { uid: string } },
        @Body() dto: MarkTopicCompleteDto,
    ) {
        const topicId = await this.nodesService.resolveAndValidateTopicForProgress(
            req.user.uid,
            dto,
        );
        return this.service.markTopicComplete(req.user.uid, topicId);
    }

    // ─── Admin ───

    @Roles(UserRole.ADMIN)
    @Get()
    @ApiOperation({ summary: '[Admin] Усі записи прогресу' })
    getAll() {
        return this.service.findAll();
    }

    @Roles(UserRole.ADMIN)
    @Get('by-user/:userUid')
    @ApiOperation({ summary: '[Admin] Прогрес конкретного користувача' })
    findByUser(@Param('userUid') userUid: string) {
        return this.service.findByUser(userUid);
    }

    @Roles(UserRole.ADMIN)
    @Get('by-user/:userUid/summary')
    @ApiOperation({ summary: '[Admin] Статистика користувача по карті' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    getUserSummary(
        @Param('userUid') userUid: string,
        @Query('mapId') mapId?: string,
    ) {
        const parsed = mapId ? parseInt(mapId, 10) : undefined;
        return this.nodesService.getProgressSummary(userUid, parsed);
    }

    @Roles(UserRole.ADMIN)
    @Post()
    @ApiOperation({ summary: '[Admin] Створити запис прогресу для користувача' })
    create(@Body() dto: CreateUserTopicProgressDto) {
        return this.service.create(dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Оновити запис (свій або admin)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateUserTopicProgressDto,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        const record = await this.service.findOne(id);
        if (req.user.role !== UserRole.ADMIN) {
            this.service.assertOwner(record, req.user.uid);
        }
        return this.service.update(id, dto);
    }

    @Roles(UserRole.ADMIN)
    @Delete(':id')
    @ApiOperation({ summary: '[Admin] Видалити запис прогресу' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
