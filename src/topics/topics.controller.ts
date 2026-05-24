import { Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
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
