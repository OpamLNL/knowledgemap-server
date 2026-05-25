import { Controller, Get, Param, Post, Body, Put, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dtos/create-topic.dto';
import { UpdateTopicDto } from './dtos/update-topic.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('topics')
@ApiBearerAuth('access-token')
@Controller('topics')
export class TopicsController {
    constructor(private readonly topicsService: TopicsService) {}

    @Public()
    @Get()
    findAll() {
        return this.topicsService.findAll();
    }

    @Public()
    @Get('catalog')
    @ApiOperation({ summary: 'Каталог тем з пошуком та прив\'язкою до карт' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'mapId', required: false, type: Number })
    @ApiQuery({ name: 'publishedOnly', required: false, type: Boolean })
    @ApiQuery({ name: 'usedOnly', required: false, type: Boolean })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['title', 'maps'] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    findCatalog(
        @Query('search') search?: string,
        @Query('mapId') mapId?: string,
        @Query('publishedOnly') publishedOnly?: string,
        @Query('usedOnly') usedOnly?: string,
        @Query('sortBy') sortBy?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const parsedMapId = mapId ? parseInt(mapId, 10) : undefined;
        const parsedPage = page ? Math.max(1, parseInt(page, 10)) : 1;
        const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 48;

        return this.topicsService.searchCatalog({
            search: search?.trim() || undefined,
            mapId: Number.isFinite(parsedMapId) ? parsedMapId : undefined,
            publishedOnly: publishedOnly !== 'false',
            usedOnly: usedOnly === 'true',
            sortBy: sortBy === 'maps' ? 'maps' : 'title',
            page: parsedPage,
            limit: parsedLimit,
        });
    }

    @Public()
    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.topicsService.findOne(id);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Post()
    @ApiOperation({ summary: 'Створити тему' })
    create(@Body() createTopicDto: CreateTopicDto) {
        return this.topicsService.create(createTopicDto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Put(':id')
    @ApiOperation({ summary: 'Оновити тему' })
    update(@Param('id') id: number, @Body() updateTopicDto: UpdateTopicDto) {
        return this.topicsService.update(id, updateTopicDto);
    }

    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Delete(':id')
    @ApiOperation({ summary: 'Видалити тему' })
    remove(@Param('id') id: number) {
        return this.topicsService.remove(id);
    }
}
