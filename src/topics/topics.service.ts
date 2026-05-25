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

    async create(dto: CreateTopicDto) {
        if (dto.groupId) {
            return this.createForGroup(dto.title, dto.groupId, dto.description);
        }
        const topic = this.topicRepository.create({
            title: dto.title,
            description: dto.description,
        });
        return this.topicRepository.save(topic);
    }

    async createForGroup(title: string, groupId: string, description?: string) {
        const trimmedTitle = title.trim() || 'Новий вузол';
        const trimmedDescription = (description ?? trimmedTitle).trim() || trimmedTitle;

        const maxOrder = await this.topicRepository
            .createQueryBuilder('t')
            .select('MAX(t.order_in_group)', 'maxOrder')
            .where('t.group_id = :groupId', { groupId })
            .getRawOne<{ maxOrder: string | null }>();

        const maxGlobal = await this.topicRepository
            .createQueryBuilder('t')
            .select('MAX(t.global_order)', 'maxGlobal')
            .getRawOne<{ maxGlobal: string | null }>();

        const topic = this.topicRepository.create({
            title: trimmedTitle,
            description: trimmedDescription,
            groupId,
            orderInGroup: (Number(maxOrder?.maxOrder) || 0) + 1,
            globalOrder: (Number(maxGlobal?.maxGlobal) || 0) + 1,
        });
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
