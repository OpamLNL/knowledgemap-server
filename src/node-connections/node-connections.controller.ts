import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NodeConnectionsService } from './node-connections.service';
import { CreateNodeConnectionDto, UpdateNodeConnectionDto } from './dto/create-node-connection.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('node-connections')
@ApiBearerAuth('access-token')
@Controller('node-connections')
export class NodeConnectionsController {
    constructor(private readonly service: NodeConnectionsService) {}

    @Get()
    @ApiOperation({ summary: 'Список зв\'язків між вузлами' })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    findAll(@Query('mapId') mapId?: string) {
        const parsed = mapId ? parseInt(mapId, 10) : undefined;
        return this.service.findAll(parsed);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post()
    @ApiOperation({ summary: 'Створити зв\'язок (ребро)' })
    create(@Body() dto: CreateNodeConnectionDto) {
        return this.service.create(dto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Put(':id')
    @ApiOperation({ summary: 'Оновити зв\'язок' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateNodeConnectionDto,
    ) {
        return this.service.update(id, dto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Delete(':id')
    @ApiOperation({ summary: 'Видалити зв\'язок' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
