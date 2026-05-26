import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Body,
    Req,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { KnowledgeMapsService } from './knowledge-maps.service';
import { CreateKnowledgeMapDto, UpdateKnowledgeMapDto } from './dtos/create-knowledge-map.dto';
import { BulkSaveGraphDto, CreateRevisionDto } from './dtos/bulk-save-graph.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('knowledge-maps')
@ApiBearerAuth('access-token')
@Controller('knowledge-maps')
export class KnowledgeMapsController {
    constructor(private readonly service: KnowledgeMapsService) {}

    @Get()
    @ApiOperation({ summary: 'Каталог опублікованих карт знань' })
    findPublished() {
        return this.service.findPublished();
    }

    @Get('mine')
    @ApiOperation({ summary: 'Мої карти (розроблені + з прогресом проходження)' })
    findMine(@Req() req: { user: { uid: string } }) {
        return this.service.findMine(req.user.uid);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Отримати карту за id' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post()
    @ApiOperation({ summary: 'Створити нову карту (чернетку)' })
    create(
        @Body() dto: CreateKnowledgeMapDto,
        @Req() req: { user: { uid: string } },
    ) {
        return this.service.create(dto, req.user.uid);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Put(':id')
    @ApiOperation({ summary: 'Оновити метадані карти' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateKnowledgeMapDto,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.service.update(id, dto, req.user.uid, req.user.role);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Delete(':id')
    @ApiOperation({ summary: 'Видалити карту' })
    remove(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.service.remove(id, req.user.uid, req.user.role);
    }

    @Get(':id/graph')
    @ApiOperation({ summary: 'Граф для редактора (без прогресу)' })
    getEditorGraph(@Param('id', ParseIntPipe) id: number) {
        return this.service.getEditorGraph(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get(':id/import-library')
    @ApiOperation({ summary: 'Бібліотека груп і вузлів з інших карт користувача' })
    getImportLibrary(
        @Param('id', ParseIntPipe) id: number,
        @Query('search') search: string | undefined,
        @Query('sourceMapId') sourceMapId: string | undefined,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        const parsedSource =
            sourceMapId != null && sourceMapId !== '' ? Number(sourceMapId) : undefined;
        return this.service.getImportLibrary(
            id,
            req.user.uid,
            req.user.role,
            search,
            parsedSource != null && !Number.isNaN(parsedSource) ? parsedSource : undefined,
        );
    }

    @Get(':id/validate')
    @ApiOperation({ summary: 'Валідація графа (цикли, дублікати, ізоляція)' })
    validateGraph(@Param('id', ParseIntPipe) id: number) {
        return this.service.validateGraph(id);
    }

    @Get(':id/export')
    @ApiOperation({ summary: 'Експорт карти у JSON' })
    exportJson(@Param('id', ParseIntPipe) id: number) {
        return this.service.exportJson(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Patch(':id/graph')
    @ApiOperation({ summary: 'Bulk-збереження графа (nodes + edges)' })
    bulkSave(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: BulkSaveGraphDto,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.service.bulkSave(id, dto, req.user.uid, req.user.role);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Patch(':id/publish')
    @ApiOperation({ summary: 'Опублікувати карту (з валідацією + auto-snapshot)' })
    publish(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.service.publish(id, req.user.uid, req.user.role);
    }

    @Get(':id/revisions')
    @ApiOperation({ summary: 'Історія версій карти' })
    listRevisions(@Param('id', ParseIntPipe) id: number) {
        return this.service.listRevisions(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post(':id/revisions')
    @ApiOperation({ summary: 'Створити знімок поточного стану' })
    createRevision(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateRevisionDto,
        @Req() req: { user: { uid: string } },
    ) {
        return this.service.createRevision(id, req.user.uid, dto.comment);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post(':id/revisions/:revisionId/restore')
    @ApiOperation({ summary: 'Відновити карту з ревізії' })
    restoreRevision(
        @Param('id', ParseIntPipe) id: number,
        @Param('revisionId', ParseIntPipe) revisionId: number,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.service.restoreRevision(id, revisionId, req.user.uid, req.user.role);
    }
}
