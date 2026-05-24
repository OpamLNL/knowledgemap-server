import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from './entities/topic.entity';
import { CreateTopicDto } from './dtos/create-topic.dto';
import { UpdateTopicDto } from './dtos/update-topic.dto';

@Injectable()
export class TopicsService {
    constructor(
        @InjectRepository(Topic)
        private readonly topicRepository: Repository<Topic>,
    ) {}

    findAll() {
        return this.topicRepository.find();
    }

    async findOne(id: number) {
        const topic = await this.topicRepository.findOneBy({ id });
        if (!topic) throw new NotFoundException('Topic not found');
        return topic;
    }

    create(dto: CreateTopicDto) {
        const topic = this.topicRepository.create(dto);
        return this.topicRepository.save(topic);
    }

    async update(id: number, dto: UpdateTopicDto) {
        await this.findOne(id); // перевірка на існування
        await this.topicRepository.update(id, dto);
        return this.findOne(id);
    }

    async remove(id: number) {
        await this.findOne(id); // перевірка на існування
        await this.topicRepository.delete(id);
        return { deleted: true };
    }
}
