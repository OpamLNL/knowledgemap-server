import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Body,
    BadRequestException,
    Req,
    Query,
    ParseIntPipe,
    Header,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { NodesService } from './nodes.service';
import { CreateNodeDto, UpdateNodeDto } from './dtos/create-node.dto';
import { UpdateNodeContentDto } from './dtos/node-content.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { nodeMediaMulterOptions } from './node-media.storage';
import type { UploadedImageFile } from './types/uploaded-image-file';

@ApiTags('nodes')
@ApiBearerAuth('access-token')
@Controller('nodes')
export class NodesController {
    constructor(private readonly nodesService: NodesService) {}

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post()
    @ApiOperation({ summary: 'Створити вузол' })
    create(@Body() dto: CreateNodeDto) {
        return this.nodesService.create(dto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Put(':id')
    @ApiOperation({ summary: 'Оновити вузол (позиція, колір, title)' })
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNodeDto) {
        return this.nodesService.update(id, dto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Delete(':id')
    @ApiOperation({ summary: 'Видалити вузол та його зв\'язки' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.nodesService.remove(id);
    }

    @Get('map/:mapId/overview')
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Огляд карти: групи, прогрес, індекс тем (без вузлів)' })
    async getMapOverview(
        @Req() req: { user?: { uid: string } },
        @Param('mapId', ParseIntPipe) mapId: number,
    ) {
        const userUid = req.user?.uid ?? '';
        try {
            return await this.nodesService.getMapOverview(userUid, mapId);
        } catch (error) {
            console.warn('⚠️ Помилка при завантаженні огляду карти:', error);
            return {
                mapId,
                groups: [],
                groupEdges: [],
                groupLayout: {},
                progress: {
                    mapId,
                    total: 0,
                    completed: 0,
                    available: 0,
                    locked: 0,
                    percent: 0,
                },
                nodesIndex: [],
            };
        }
    }

    @Get('map/:mapId/groups/:groupId/nodes')
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Вузли та ребра однієї групи знань' })
    async getGroupNodes(
        @Req() req: { user?: { uid: string } },
        @Param('mapId', ParseIntPipe) mapId: number,
        @Param('groupId') groupId: string,
    ) {
        const userUid = req.user?.uid ?? '';
        return this.nodesService.getGroupNodes(userUid, mapId, groupId);
    }

    @Get('graph')
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Граф для навчання (з прогресом користувача)' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    async getGraph(
        @Req() req: { user?: { uid: string } },
        @Query('mapId') mapId?: string,
    ) {
        const userUid = req.user?.uid ?? '';
        const parsedMapId = mapId ? parseInt(mapId, 10) : undefined;
        try {
            return await this.nodesService.getGraph(userUid, parsedMapId);
        } catch (error) {
            console.warn('⚠️ Помилка при побудові графа:', error);
            return { mapId: parsedMapId ?? null, nodes: [], edges: [], groups: [], groupEdges: [] };
        }
    }

    @Get('group-graph')
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Групи знань та звʼязки між ними' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    async getGroupGraph(
        @Req() req: { user?: { uid: string } },
        @Query('mapId') mapId?: string,
    ) {
        const userUid = req.user?.uid ?? '';
        const parsedMapId = mapId ? parseInt(mapId, 10) : undefined;
        try {
            return await this.nodesService.getGroupGraph(userUid, parsedMapId);
        } catch (error) {
            console.warn('⚠️ Помилка при завантаженні груп:', error);
            return { mapId: parsedMapId ?? null, groups: [], groupEdges: [] };
        }
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get('validate')
    @ApiOperation({ summary: 'Валідація графа за mapId' })
    @ApiQuery({ name: 'mapId', required: true, type: Number })
    validateGraph(
        @Query('mapId', ParseIntPipe) mapId: number,
        @Req() req: { user: { uid: string; role: UserRole } },
    ) {
        return this.nodesService.validateMapGraph(mapId, req.user.uid, req.user.role);
    }

    @Get()
    @ApiOperation({ summary: 'Список вузлів' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    findAll(@Query('mapId') mapId?: string) {
        const parsed = mapId ? parseInt(mapId, 10) : undefined;
        return this.nodesService.findAll(parsed);
    }

    @Get(':id/content')
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Теорія та зображення вузла' })
    getNodeContent(@Param('id', ParseIntPipe) id: number) {
        return this.nodesService.getNodeContent(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Patch(':id/content')
    @ApiOperation({ summary: 'Оновити теорію вузла' })
    updateNodeContent(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateNodeContentDto,
    ) {
        return this.nodesService.updateNodeContent(id, dto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post(':id/media')
    @ApiOperation({ summary: 'Додати зображення до вузла' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                caption: { type: 'string' },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file', nodeMediaMulterOptions))
    uploadNodeMedia(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: UploadedImageFile,
        @Body('caption') caption?: string,
    ) {
        return this.nodesService.addNodeMedia(id, file, caption);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Delete(':id/media/:mediaId')
    @ApiOperation({ summary: 'Видалити зображення вузла' })
    removeNodeMedia(
        @Param('id', ParseIntPipe) id: number,
        @Param('mediaId', ParseIntPipe) mediaId: number,
    ) {
        return this.nodesService.removeNodeMedia(id, mediaId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Отримати вузол за id' })
    findOne(@Param('id') id: string) {
        const numericId = Number(id);
        if (!Number.isInteger(numericId)) {
            throw new BadRequestException(`Некоректний ID: ${id}`);
        }
        return this.nodesService.findOne(numericId);
    }
}
