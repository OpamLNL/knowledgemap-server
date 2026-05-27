import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { MapStatus, GraphEditMap } from '../graph-edit-maps/entities/graph-edit-map.entity';
import type { MapListItemDto } from '../graph-edit-maps/dtos/map-list-item.dto';
import { Node } from '../nodes/entities/node.entity';
import { UserTopicProgressService } from '../users/user-topic-progress.service';
import { GraphEditMapsService } from '../graph-edit-maps/graph-edit-maps.service';
import { NodesService } from '../nodes/nodes.service';

export type MapLearnerProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type MapLearnerRow = {
    uid: string;
    name: string;
    email: string;
    role: UserRole;
    completed: number;
    total: number;
    available: number;
    locked: number;
    percent: number;
    status: MapLearnerProgressStatus;
};

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

type TeachingSummary = {
    publishedMaps: number;
    studentsActive: number;
    averagePercent: number;
    completedFully: number;
};

@Injectable()
export class UsersCabinetService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(GraphEditMap)
        private readonly mapRepo: Repository<GraphEditMap>,
        private readonly progressService: UserTopicProgressService,
        private readonly mapsService: GraphEditMapsService,
        private readonly nodesService: NodesService,
    ) {}

    async getCabinet(firebaseUid: string, role: UserRole) {
        const user = await this.userRepo.findOne({ where: { firebase_uid: firebaseUid } });
        if (!user) {
            throw new NotFoundException('Користувача не знайдено');
        }

        const maps = await this.mapsService.findMine({ uid: firebaseUid });
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

        const isEditor = role === UserRole.TEACHER || role === UserRole.ADMIN;

        const teachingByMapId = new Map<number, MapTeachingStats>();

        if (isEditor) {
            for (const map of maps) {
                const isMapOwner = !map.ownerUid || map.ownerUid === firebaseUid;
                if (!isMapOwner || map.status !== MapStatus.PUBLISHED) {
                    continue;
                }
                teachingByMapId.set(
                    map.id,
                    await this.buildMapTeachingStats(map.id, firebaseUid),
                );
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
        const teachingStats = isEditor ? this.buildTeachingSummary(teachingMaps) : null;

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

    async getTeachingOverview(firebaseUid: string, role: UserRole) {
        this.assertTeacher(role);

        const ownedMaps = await this.getOwnedPublishedMaps(firebaseUid, role);
        const maps: Array<{
            id: number;
            title: string;
            description: string | null;
            status: MapStatus;
            updatedAt: Date;
            publishedAt: Date | null;
            teachingStats: MapTeachingStats;
        }> = [];

        for (const map of ownedMaps) {
            maps.push({
                id: map.id,
                title: map.title,
                description: map.description,
                status: map.status,
                updatedAt: map.updatedAt,
                publishedAt: map.publishedAt,
                teachingStats: await this.buildMapTeachingStats(map.id, firebaseUid),
            });
        }

        return {
            summary: this.buildTeachingSummary(
                maps.map((m) => ({ teachingStats: m.teachingStats })),
            ) as TeachingSummary,
            maps,
        };
    }

    async getMapLearnersDetail(mapId: number, firebaseUid: string, role: UserRole) {
        this.assertTeacher(role);

        const map = await this.mapsService.findOne(mapId, firebaseUid, role);
        if (map.status !== MapStatus.PUBLISHED) {
            throw new ForbiddenException('Статистика доступна лише для опублікованих карт');
        }

        const learners = await this.buildMapLearnersList(mapId, firebaseUid);
        const teachingStats = this.statsFromLearners(
            await this.nodeRepo.count({ where: { mapId } }),
            learners,
        );

        return {
            map: {
                id: map.id,
                title: map.title,
                description: map.description,
                status: map.status,
                publishedAt: map.publishedAt,
                updatedAt: map.updatedAt,
            },
            teachingStats,
            learners,
        };
    }

    async getTeachingLearners(firebaseUid: string, role: UserRole) {
        this.assertTeacher(role);

        const ownedMaps = await this.getOwnedPublishedMaps(firebaseUid, role);
        const byUid = new Map<
            string,
            {
                uid: string;
                name: string;
                email: string;
                role: UserRole;
                maps: Array<{
                    mapId: number;
                    mapTitle: string;
                    completed: number;
                    total: number;
                    percent: number;
                    status: MapLearnerProgressStatus;
                }>;
            }
        >();

        for (const map of ownedMaps) {
            const learners = await this.buildMapLearnersList(map.id, firebaseUid);
            for (const learner of learners) {
                let entry = byUid.get(learner.uid);
                if (!entry) {
                    entry = {
                        uid: learner.uid,
                        name: learner.name,
                        email: learner.email,
                        role: learner.role,
                        maps: [],
                    };
                    byUid.set(learner.uid, entry);
                }
                entry.maps.push({
                    mapId: map.id,
                    mapTitle: map.title,
                    completed: learner.completed,
                    total: learner.total,
                    percent: learner.percent,
                    status: learner.status,
                });
            }
        }

        const learners = [...byUid.values()]
            .map((entry) => {
                const withProgress = entry.maps.filter((m) => m.total > 0);
                const averagePercent =
                    withProgress.length > 0
                        ? Math.round(
                              withProgress.reduce((sum, m) => sum + m.percent, 0) /
                                  withProgress.length,
                          )
                        : 0;
                return {
                    ...entry,
                    mapsCount: entry.maps.length,
                    averagePercent,
                };
            })
            .sort(
                (a, b) =>
                    b.averagePercent - a.averagePercent ||
                    b.mapsCount - a.mapsCount ||
                    a.name.localeCompare(b.name, 'uk'),
            );

        const activeLearners = learners.filter((l) =>
            l.maps.some((m) => m.status !== 'not_started'),
        ).length;

        return {
            summary: {
                totalLearners: learners.length,
                activeLearners,
                publishedMaps: ownedMaps.length,
            },
            learners,
        };
    }

    private assertTeacher(role: UserRole): void {
        if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
            throw new ForbiddenException('Доступ лише для викладачів та адміністраторів');
        }
    }

    private async getOwnedPublishedMaps(
        firebaseUid: string,
        _role: UserRole,
    ): Promise<MapListItemDto[]> {
        const maps = await this.mapsService.findMine({ uid: firebaseUid });
        return maps.filter((map) => {
            const isOwner = !map.ownerUid || map.ownerUid === firebaseUid;
            return isOwner && map.status === MapStatus.PUBLISHED;
        });
    }

    private learnerStatus(completed: number, percent: number): MapLearnerProgressStatus {
        if (percent >= 100) return 'completed';
        if (percent > 0 || completed > 0) return 'in_progress';
        return 'not_started';
    }

    private statsFromLearners(nodeCount: number, learners: MapLearnerRow[]): MapTeachingStats {
        if (nodeCount === 0 || learners.length === 0) {
            return {
                nodeCount,
                studentsTotal: learners.length,
                studentsActive: 0,
                averagePercent: 0,
                completionDistribution: {
                    notStarted: learners.filter((u) => u.status === 'not_started').length,
                    inProgress: learners.filter((u) => u.status === 'in_progress').length,
                    completed: learners.filter((u) => u.status === 'completed').length,
                },
                topStudents: learners.slice(0, 10).map((u) => ({
                    name: u.name,
                    email: u.email,
                    percent: u.percent,
                    completed: u.completed,
                    total: u.total,
                })),
            };
        }

        const studentsActive = learners.filter((u) => u.status !== 'not_started').length;
        const averagePercent =
            learners.length > 0
                ? Math.round(learners.reduce((sum, u) => sum + u.percent, 0) / learners.length)
                : 0;

        const sorted = [...learners].sort(
            (a, b) => b.percent - a.percent || b.completed - a.completed,
        );

        return {
            nodeCount,
            studentsTotal: learners.length,
            studentsActive,
            averagePercent,
            completionDistribution: {
                notStarted: learners.filter((u) => u.status === 'not_started').length,
                inProgress: learners.filter((u) => u.status === 'in_progress').length,
                completed: learners.filter((u) => u.status === 'completed').length,
            },
            topStudents: sorted.slice(0, 10).map((u) => ({
                name: u.name,
                email: u.email,
                percent: u.percent,
                completed: u.completed,
                total: u.total,
            })),
        };
    }

    private async buildMapLearnersList(
        mapId: number,
        ownerUid: string,
    ): Promise<MapLearnerRow[]> {
        const nodeCount = await this.nodeRepo.count({ where: { mapId } });
        if (nodeCount === 0) return [];

        const learnerUids = await this.progressService.findLearnerUidsForMap(mapId, ownerUid);
        if (learnerUids.length === 0) return [];

        const users = await this.userRepo.find({
            where: { firebase_uid: In(learnerUids) },
            select: ['firebase_uid', 'email', 'name', 'role'],
        });
        const userByUid = new Map(users.map((u) => [u.firebase_uid, u]));

        const rows: MapLearnerRow[] = [];

        for (const uid of learnerUids) {
            const summary = await this.nodesService.getProgressSummary(uid, mapId);
            const profile = userByUid.get(uid);
            const percent = summary.percent;
            const completed = summary.completed;
            rows.push({
                uid,
                name: profile?.name ?? profile?.email ?? `Користувач ${uid.slice(0, 8)}…`,
                email: profile?.email ?? '',
                role: profile?.role ?? UserRole.STUDENT,
                completed,
                total: summary.total,
                available: summary.available,
                locked: summary.locked,
                percent,
                status: this.learnerStatus(completed, percent),
            });
        }

        rows.sort(
            (a, b) =>
                b.percent - a.percent ||
                b.completed - a.completed ||
                a.name.localeCompare(b.name, 'uk'),
        );

        return rows;
    }

    private async buildMapTeachingStats(
        mapId: number,
        ownerUid: string,
    ): Promise<MapTeachingStats> {
        const nodeCount = await this.nodeRepo.count({ where: { mapId } });
        const learners = await this.buildMapLearnersList(mapId, ownerUid);
        return this.statsFromLearners(nodeCount, learners);
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
