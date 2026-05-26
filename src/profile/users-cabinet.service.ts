import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import { Node } from '../nodes/entities/node.entity';
import { UserTopicProgressService } from '../users/user-topic-progress.service';
import { KnowledgeMapsService } from '../knowledge-maps/knowledge-maps.service';
import { NodesService } from '../nodes/nodes.service';

type MapTeachingStats = {
    nodeCount: number;
    studentsTotal: number;
    studentsActive: number;
    averagePercent: number;
    completionDistribution: {
        notStarted: number;
        inProgress: number;
        completed: number;
    };
    topStudents: {
        name: string;
        email: string;
        percent: number;
        completed: number;
        total: number;
    }[];
};

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

        const maps = await this.mapsService.findMine(firebaseUid);
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
            teachingStats: MapTeachingStats | null;
        }> = [];

        let percentSum = 0;
        let mapsWithProgress = 0;

        const isTeacher = role === UserRole.TEACHER;
        const students = isTeacher
            ? await this.userRepo.find({
                  where: { role: UserRole.STUDENT },
                  select: ['firebase_uid', 'email', 'name'],
              })
            : [];

        const teachingByMapId = new Map<number, MapTeachingStats>();

        if (isTeacher) {
            for (const map of maps) {
                const isMapOwner = !map.ownerUid || map.ownerUid === firebaseUid;
                if (!isMapOwner || map.status !== MapStatus.PUBLISHED) {
                    continue;
                }
                teachingByMapId.set(map.id, await this.buildMapTeachingStats(map.id, students));
            }
        }

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
                teachingStats: teachingByMapId.get(map.id) ?? null,
            });
        }

        const teachingMaps = mapItems.filter((m) => m.teachingStats);
        const teachingStats = isTeacher ? this.buildTeachingSummary(teachingMaps) : null;

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
            teachingStats,
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

    private async buildMapTeachingStats(
        mapId: number,
        students: Pick<User, 'firebase_uid' | 'email' | 'name'>[],
    ): Promise<MapTeachingStats> {
        const nodeCount = await this.nodeRepo.count({ where: { mapId } });

        const userStats: {
            name: string;
            email: string;
            completed: number;
            total: number;
            percent: number;
        }[] = [];

        for (const student of students) {
            const uid = student.firebase_uid;
            if (!uid) continue;

            const summary = await this.nodesService.getProgressSummary(uid, mapId);
            userStats.push({
                name: student.name ?? student.email,
                email: student.email,
                completed: summary.completed,
                total: summary.total,
                percent: summary.percent,
            });
        }

        userStats.sort((a, b) => b.percent - a.percent);

        const studentsWithNodes = userStats.filter((u) => u.total > 0);
        const studentsTotal = studentsWithNodes.length;
        const studentsActive = studentsWithNodes.filter(
            (u) => u.completed > 0 || u.percent > 0,
        ).length;
        const averagePercent =
            studentsTotal > 0
                ? Math.round(
                      studentsWithNodes.reduce((sum, u) => sum + u.percent, 0) / studentsTotal,
                  )
                : 0;

        return {
            nodeCount,
            studentsTotal,
            studentsActive,
            averagePercent,
            completionDistribution: {
                notStarted: studentsWithNodes.filter((u) => u.completed === 0).length,
                inProgress: studentsWithNodes.filter((u) => u.completed > 0 && u.percent < 100)
                    .length,
                completed: studentsWithNodes.filter((u) => u.percent === 100).length,
            },
            topStudents: userStats.filter((u) => u.completed > 0).slice(0, 5),
        };
    }

    private buildTeachingSummary(
        maps: Array<{ teachingStats: MapTeachingStats | null }>,
    ) {
        const withStats = maps.filter((m) => m.teachingStats);
        if (withStats.length === 0) {
            return {
                publishedMaps: 0,
                studentsActive: 0,
                averagePercent: 0,
                completedFully: 0,
            };
        }

        const avgSum = withStats.reduce((s, m) => s + (m.teachingStats?.averagePercent ?? 0), 0);
        const completedFully = withStats.reduce(
            (s, m) => s + (m.teachingStats?.completionDistribution.completed ?? 0),
            0,
        );
        const activeSum = withStats.reduce(
            (s, m) => s + (m.teachingStats?.studentsActive ?? 0),
            0,
        );

        return {
            publishedMaps: withStats.length,
            studentsActive: activeSum,
            averagePercent: Math.round(avgSum / withStats.length),
            completedFully,
        };
    }
}
