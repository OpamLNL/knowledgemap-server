import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import { Node } from '../nodes/entities/node.entity';
import { UserTopicProgressService } from '../users/user-topic-progress.service';
import { KnowledgeMapsService } from '../knowledge-maps/knowledge-maps.service';
import { NodesService } from '../nodes/nodes.service';

@Injectable()
export class UsersCabinetService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        private readonly progressService: UserTopicProgressService,
        private readonly mapsService: KnowledgeMapsService,
        private readonly nodesService: NodesService,
    ) {}

    async getCabinet(firebaseUid: string, role: UserRole) {
        const user = await this.userRepo.findOne({ where: { firebase_uid: firebaseUid } });
        if (!user) {
            throw new NotFoundException('Користувача не знайдено');
        }

        const maps = await this.mapsService.findAll(role, firebaseUid);
        const progressRecords = await this.progressService.findByUser(firebaseUid);
        const totalCompletedTopics = progressRecords.filter((r) => r.status === 'completed').length;

        const mapItems: Array<{
            id: number;
            title: string;
            description: string | null;
            status: MapStatus;
            updatedAt: Date;
            ownerUid: string | null;
            progress: {
                total: number;
                completed: number;
                available: number;
                locked: number;
                percent: number;
            } | null;
        }> = [];

        let percentSum = 0;
        let mapsWithProgress = 0;

        for (const map of maps) {
            const canTrackProgress =
                map.status === MapStatus.PUBLISHED ||
                role === UserRole.ADMIN ||
                role === UserRole.TEACHER;

            let progress: (typeof mapItems)[number]['progress'] = null;

            if (canTrackProgress && map.status === MapStatus.PUBLISHED) {
                const summary = await this.nodesService.getProgressSummary(firebaseUid, map.id);
                progress = {
                    total: summary.total,
                    completed: summary.completed,
                    available: summary.available,
                    locked: summary.locked,
                    percent: summary.percent,
                };
                if (summary.total > 0) {
                    percentSum += summary.percent;
                    mapsWithProgress += 1;
                }
            }

            mapItems.push({
                id: map.id,
                title: map.title,
                description: map.description,
                status: map.status,
                updatedAt: map.updatedAt,
                ownerUid: map.ownerUid,
                progress,
            });
        }

        const recentCompleted = progressRecords
            .filter((r) => r.status === 'completed' && r.completed_at)
            .slice(0, 10);

        const topicIds = recentCompleted.map((r) => r.topicId);
        const nodes =
            topicIds.length > 0
                ? await this.nodeRepo.find({
                      where: { topicId: In(topicIds) },
                      select: ['topicId', 'title', 'mapId'],
                  })
                : [];

        const nodeByTopic = new Map(nodes.map((n) => [n.topicId, n]));

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl ?? null,
                createdAt: user.createdAt,
            },
            stats: {
                totalCompletedTopics,
                mapsTotal: maps.length,
                mapsWithProgress,
                averagePercent:
                    mapsWithProgress > 0 ? Math.round(percentSum / mapsWithProgress) : 0,
            },
            maps: mapItems,
            recentCompleted: recentCompleted.map((r) => {
                const node = nodeByTopic.get(r.topicId);
                return {
                    topicId: r.topicId,
                    completedAt: r.completed_at,
                    title: node?.title ?? `Тема #${r.topicId}`,
                    mapId: node?.mapId ?? null,
                };
            }),
        };
    }
}
