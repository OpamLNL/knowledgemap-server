import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    BadRequestException,
    Req,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NodesService } from './nodes.service';
import { CreateNodeDto, UpdateNodeDto } from './dtos/create-node.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

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

    @Get('graph')
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

    @Get('validate')
    @ApiOperation({ summary: 'Валідація графа за mapId' })
    @ApiQuery({ name: 'mapId', required: true, type: Number })
    validateGraph(@Query('mapId', ParseIntPipe) mapId: number) {
        return this.nodesService.validateMapGraph(mapId);
    }

    @Get()
    @ApiOperation({ summary: 'Список вузлів' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    findAll(@Query('mapId') mapId?: string) {
        const parsed = mapId ? parseInt(mapId, 10) : undefined;
        return this.nodesService.findAll(parsed);
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
