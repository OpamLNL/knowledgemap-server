// src/users/user-topic-progress.controller.ts


import { In } from 'typeorm';

import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { UserTopicProgressService } from './user-topic-progress.service';
import { CreateUserTopicProgressDto } from './dtos/create-user-topic-progress.dto';
import { UpdateUserTopicProgressDto } from './dtos/update-user-topic-progress.dto';

@Controller('progress')
export class UserTopicProgressController {
    constructor(private readonly service: UserTopicProgressService) {}

    @Get()
    getAll() {
        return this.service.findAll();
    }




    @Get('by-user/:userUid')
    findByUser(@Param('userUid') userUid: string) {
        return this.service.findByUser(userUid);
    }


    @Post()
    create(@Body() dto: CreateUserTopicProgressDto) {
        return this.service.create(dto);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() dto: UpdateUserTopicProgressDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(id);
    }
}
