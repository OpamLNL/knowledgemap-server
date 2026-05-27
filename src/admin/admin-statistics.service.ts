import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { UserTopicProgressService } from '../users/user-topic-progress.service';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { GraphEditMap, MapStatus } from '../graph-edit-maps/entities/graph-edit-map.entity';
import { MapRevision } from '../graph-edit-maps/entities/map-revision.entity';
import { NodesService } from '../nodes/nodes.service';

@Injectable()
export class AdminStatisticsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(UserTopicProgress)
        private readonly progressRepo: Repository<UserTopicProgress>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(NodeConnection)
        private readonly connectionRepo: Repository<NodeConnection>,
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(GraphEditMap)
        private readonly mapRepo: Repository<GraphEditMap>,
        @InjectRepository(MapRevision)
        private readonly revisionRepo: Repository<MapRevision>,
        private readonly progressService: UserTopicProgressService,
        private readonly nodesService: NodesService,
    ) {}

    /** Публічна агрегована статистика для landing (без персональних даних). */
    async getPlatformStats() {
        const [
            totalTopics,
            totalNodes,
            totalEdges,
            revisionCount,
            publishedMaps,
            activeStudents,
            completedRecords,
            students,
        ] = await Promise.all([
            this.topicRepo.count(),
            this.nodeRepo.count(),
            this.connectionRepo.count(),
            this.revisionRepo.count(),
            this.mapRepo.count({ where: { status: MapStatus.PUBLISHED } }),
            this.progressService.countDistinctUsers(),
            this.progressService.countByStatus('completed'),
            this.userRepo.count({ where: { role: UserRole.STUDENT } }),
        ]);

        const defaultMap = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });

        let averageCompletionPercent = 0;
        if (defaultMap && students > 0) {
            const nodesOnMap = await this.nodeRepo.count({ where: { mapId: defaultMap.id } });
            if (nodesOnMap > 0) {
                const completedByUser = await this.progressService.getCompletedCountByUsers();
                const studentUsers = await this.userRepo.find({
                    where: { role: UserRole.STUDENT },
                    select: ['firebase_uid'],
                });
                const studentUids = new Set(
                    studentUsers.map((u) => u.firebase_uid).filter(Boolean),
                );

                let sumPercent = 0;
                let counted = 0;
                for (const uid of studentUids) {
                    if (!uid) continue;
                    const entry = completedByUser.find((c) => c.userUid === uid);
                    const completed = entry?.completed ?? 0;
                    sumPercent += Math.round((completed / nodesOnMap) * 100);
                    counted++;
                }
                averageCompletionPercent = counted > 0 ? Math.round(sumPercent / counted) : 0;
            }
        }

        return {
            topics: totalTopics,
            nodes: totalNodes,
            edges: totalEdges,
            revisions: revisionCount,
            publishedMaps,
            studentsWithProgress: activeStudents,
            completedTopicRecords: completedRecords,
            averageCompletionPercent,
        };
    }

    async getDashboard() {
        const [
            totalUsers,
            students,
            teachers,
            admins,
            totalMaps,
            publishedMaps,
            draftMaps,
            totalTopics,
            totalNodes,
            totalEdges,
            completedRecords,
            activeStudents,
        ] = await Promise.all([
            this.userRepo.count(),
            this.userRepo.count({ where: { role: UserRole.STUDENT } }),
            this.userRepo.count({ where: { role: UserRole.TEACHER } }),
            this.userRepo.count({ where: { role: UserRole.ADMIN } }),
            this.mapRepo.count(),
            this.mapRepo.count({ where: { status: MapStatus.PUBLISHED } }),
            this.mapRepo.count({ where: { status: MapStatus.DRAFT } }),
            this.topicRepo.count(),
            this.nodeRepo.count(),
            this.connectionRepo.count(),
            this.progressService.countByStatus('completed'),
            this.progressService.countDistinctUsers(),
        ]);

        const defaultMap = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });

        let averageCompletionPercent = 0;
        if (defaultMap && students > 0) {
            const nodesOnMap = await this.nodeRepo.count({ where: { mapId: defaultMap.id } });
            if (nodesOnMap > 0) {
                const completedByUser = await this.progressService.getCompletedCountByUsers();
                const studentUsers = await this.userRepo.find({
                    where: { role: UserRole.STUDENT },
                    select: ['firebase_uid'],
                });
                const studentUids = new Set(
                    studentUsers.map((u) => u.firebase_uid).filter(Boolean),
                );

                let sumPercent = 0;
                let counted = 0;
                for (const uid of studentUids) {
                    if (!uid) continue;
                    const entry = completedByUser.find((c) => c.userUid === uid);
                    const completed = entry?.completed ?? 0;
                    sumPercent += Math.round((completed / nodesOnMap) * 100);
                    counted++;
                }
                averageCompletionPercent = counted > 0 ? Math.round(sumPercent / counted) : 0;
            }
        }

        const recentProgress = await this.progressRepo.find({
            where: { status: 'completed' },
            order: { completed_at: 'DESC' },
            take: 10,
        });

        return {
            users: {
                total: totalUsers,
                students,
                teachers,
                admins,
                activeWithProgress: activeStudents,
            },
            maps: {
                total: totalMaps,
                published: publishedMaps,
                draft: draftMaps,
            },
            content: {
                topics: totalTopics,
                nodes: totalNodes,
                edges: totalEdges,
            },
            progress: {
                completedRecords,
                averageCompletionPercent,
                defaultMapId: defaultMap?.id ?? null,
            },
            recentCompletions: recentProgress.map((p) => ({
                id: p.id,
                userUid: p.userUid,
                topicId: p.topicId,
                completedAt: p.completed_at,
            })),
        };
    }

    async getMapsOverview() {
        const maps = await this.mapRepo.find({ order: { updatedAt: 'DESC' } });
        const result: {
            id: number;
            title: string;
            status: MapStatus;
            ownerUid: string | null;
            nodeCount: number;
            edgeCount: number;
            publishedAt: Date | null;
            updatedAt: Date;
        }[] = [];

        for (const map of maps) {
            const nodeCount = await this.nodeRepo.count({ where: { mapId: map.id } });
            const edgeCount = await this.connectionRepo.count({ where: { mapId: map.id } });
            result.push({
                id: map.id,
                title: map.title,
                status: map.status,
                ownerUid: map.ownerUid,
                nodeCount,
                edgeCount,
                publishedAt: map.publishedAt,
                updatedAt: map.updatedAt,
            });
        }

        return result;
    }

    async getMapStatistics(mapId: number) {
        const map = await this.mapRepo.findOne({ where: { id: mapId } });
        if (!map) return null;

        const nodeCount = await this.nodeRepo.count({ where: { mapId } });
        const nodes = await this.nodeRepo.find({ where: { mapId }, select: ['topicId'] });
        const topicIds = new Set(nodes.map((n) => n.topicId).filter(Boolean));

        const students = await this.userRepo.find({
            where: { role: UserRole.STUDENT },
            select: ['id', 'firebase_uid', 'email', 'name'],
        });

        const completedByUser = await this.progressService.getCompletedCountByUsers();
        const userStats: {
            userId: number;
            firebaseUid: string;
            email: string;
            name: string | undefined;
            completed: number;
            available: number;
            locked: number;
            total: number;
            percent: number;
        }[] = [];

        for (const student of students) {
            const uid = student.firebase_uid;
            if (!uid) continue;

            const summary = await this.nodesService.getProgressSummary(uid, mapId);
            userStats.push({
                userId: student.id,
                firebaseUid: uid,
                email: student.email,
                name: student.name,
                completed: summary.completed,
                available: summary.available,
                locked: summary.locked,
                total: summary.total,
                percent: summary.percent,
            });
        }

        userStats.sort((a, b) => b.percent - a.percent);

        const avgPercent =
            userStats.length > 0
                ? Math.round(userStats.reduce((s, u) => s + u.percent, 0) / userStats.length)
                : 0;

        const completionDistribution = {
            notStarted: userStats.filter((u) => u.completed === 0).length,
            inProgress: userStats.filter((u) => u.completed > 0 && u.percent < 100).length,
            completed: userStats.filter((u) => u.percent === 100).length,
        };

        return {
            map: {
                id: map.id,
                title: map.title,
                status: map.status,
            },
            nodeCount,
            topicCount: topicIds.size,
            studentsTotal: userStats.length,
            averagePercent: avgPercent,
            completionDistribution,
            topStudents: userStats.slice(0, 10),
            strugglingStudents: [...userStats]
                .filter((u) => u.percent < 30 && u.completed > 0)
                .slice(0, 10),
        };
    }

    async getUsersOverview(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [users, total] = await this.userRepo.findAndCount({
            order: { createdAt: 'DESC' },
            take: limit,
            skip,
        });

        const completedByUser = await this.progressService.getCompletedCountByUsers();
        const defaultMap = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });
        const nodesOnMap = defaultMap
            ? await this.nodeRepo.count({ where: { mapId: defaultMap.id } })
            : 0;

        const data = users.map((user) => {
            const uid = user.firebase_uid ?? '';
            const entry = completedByUser.find((c) => c.userUid === uid);
            const completed = entry?.completed ?? 0;
            const percent =
                nodesOnMap > 0 ? Math.round((completed / nodesOnMap) * 100) : 0;

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                firebaseUid: user.firebase_uid,
                createdAt: user.createdAt,
                completedTopics: completed,
                completionPercent: percent,
            };
        });

        return { data, total, page, limit };
    }

    async getUserStatistics(firebaseUid: string) {
        const user = await this.userRepo.findOne({ where: { firebase_uid: firebaseUid } });
        if (!user) return null;

        const records = await this.progressService.findByUser(firebaseUid);
        const completed = records.filter((r) => r.status === 'completed').length;

        const maps = await this.mapRepo.find({ where: { status: MapStatus.PUBLISHED } });
        const mapSummaries: Array<
            Awaited<ReturnType<NodesService['getProgressSummary']>> & { mapTitle: string }
        > = [];
        for (const map of maps) {
            const summary = await this.nodesService.getProgressSummary(firebaseUid, map.id);
            mapSummaries.push({ ...summary, mapTitle: map.title });
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                firebaseUid: user.firebase_uid,
                createdAt: user.createdAt,
            },
            totalCompletedTopics: completed,
            progressRecords: records,
            maps: mapSummaries,
        };
    }
}
