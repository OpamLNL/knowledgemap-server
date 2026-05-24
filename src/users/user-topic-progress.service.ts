import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserTopicProgress } from './entities/user-topic-progress.entity';
import { CreateUserTopicProgressDto } from './dtos/create-user-topic-progress.dto';
import { UpdateUserTopicProgressDto } from './dtos/update-user-topic-progress.dto';
import { Node } from '../nodes/entities/node.entity';

@Injectable()
export class UserTopicProgressService {
    constructor(
        @InjectRepository(UserTopicProgress)
        private repo: Repository<UserTopicProgress>,
        @InjectRepository(Node)
        private nodeRepo: Repository<Node>,
    ) {}

    findAll() {
        return this.repo.find({ order: { id: 'DESC' } });
    }

    findByUser(userUid: string) {
        return this.repo.find({
            where: { userUid },
            order: { completed_at: 'DESC' },
        });
    }

    async findOne(id: number): Promise<UserTopicProgress> {
        const record = await this.repo.findOne({ where: { id } });
        if (!record) throw new NotFoundException(`Progress id=${id} не знайдено`);
        return record;
    }

    async findProgressForUserByNodeIds(userUid: string, topicIds: number[]) {
        return this.repo.find({
            where: {
                userUid,
                topicId: In(topicIds),
            },
        });
    }

    async markTopicComplete(userUid: string, topicId: number) {
        const node = await this.nodeRepo.findOne({ where: { topicId } });
        if (!node) {
            throw new BadRequestException(`Тема topicId=${topicId} не прив'язана до карти`);
        }

        let record = await this.repo.findOne({ where: { userUid, topicId } });

        if (record) {
            record.status = 'completed';
            record.progress = 1;
            record.completed_at = new Date();
            return this.repo.save(record);
        }

        record = this.repo.create({
            userUid,
            topicId,
            status: 'completed',
            progress: 1,
            completed_at: new Date(),
        });
        return this.repo.save(record);
    }

    async create(data: CreateUserTopicProgressDto) {
        const existing = await this.repo.findOne({
            where: { userUid: data.userUid, topicId: data.topicId },
        });
        if (existing) {
            throw new BadRequestException('Запис прогресу для цієї теми вже існує');
        }

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
        await this.findOne(id);
        await this.repo.update(id, { ...data });
        return this.findOne(id);
    }

    async remove(id: number) {
        await this.findOne(id);
        await this.repo.delete(id);
        return { deleted: true };
    }

    assertOwner(record: UserTopicProgress, userUid: string): void {
        if (record.userUid !== userUid) {
            throw new ForbiddenException('Немає доступу до цього запису прогресу');
        }
    }

    async getCompletedCountByUsers(): Promise<{ userUid: string; completed: number }[]> {
        const rows = await this.repo
            .createQueryBuilder('p')
            .select('p.user_uid', 'userUid')
            .addSelect('COUNT(*)', 'completed')
            .where("p.status = 'completed'")
            .groupBy('p.user_uid')
            .getRawMany();

        return rows.map((r) => ({
            userUid: r.userUid,
            completed: Number(r.completed),
        }));
    }

    async countByStatus(status: string): Promise<number> {
        return this.repo.count({ where: { status } });
    }

    async countDistinctUsers(): Promise<number> {
        const result = await this.repo
            .createQueryBuilder('p')
            .select('COUNT(DISTINCT p.user_uid)', 'cnt')
            .getRawOne();
        return Number(result?.cnt ?? 0);
    }
}
