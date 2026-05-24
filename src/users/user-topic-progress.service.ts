import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserTopicProgress } from './entities/user-topic-progress.entity';
import { CreateUserTopicProgressDto } from './dtos/create-user-topic-progress.dto';
import { UpdateUserTopicProgressDto } from './dtos/update-user-topic-progress.dto';

@Injectable()
export class UserTopicProgressService {
    constructor(
        @InjectRepository(UserTopicProgress)
        private repo: Repository<UserTopicProgress>,
    ) {}

    findAll() {
        return this.repo.find();
    }

    findByUser(userUid: string) {
        return this.repo.find({
            where: { userUid },
        });
    }

    async findProgressForUserByNodeIds(userUid: string, topicIds: number[]) {
        return this.repo.find({
            where: {
                userUid,
                topicId: In(topicIds),
            },
        });
    }

    async create(data: CreateUserTopicProgressDto) {
        const entity = this.repo.create({
            userUid: data.userUid,
            topicId: data.topicId,
            status: data.status ?? 'not-started',
            progress: data.progress ?? 0,
            completed_at: data.completed_at ?? null,
        });

        return this.repo.save(entity);
    }

    async update(id: number, data: UpdateUserTopicProgressDto) {
        await this.repo.update(id, {
            ...data,
        });
        return this.repo.findOne({ where: { id } });
    }





    async remove(id: number) {
        await this.repo.delete(id);
        return { deleted: true };
    }
}
