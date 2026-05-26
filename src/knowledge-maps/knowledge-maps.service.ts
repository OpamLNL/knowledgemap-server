import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, QueryRunner, QueryFailedError } from 'typeorm';
import { KnowledgeMap, MapStatus } from './entities/knowledge-map.entity';
import { MapRevision } from './entities/map-revision.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { CreateKnowledgeMapDto, UpdateKnowledgeMapDto } from './dtos/create-knowledge-map.dto';
import { BulkSaveGraphDto, BulkNodeDto, CreateRevisionDto } from './dtos/bulk-save-graph.dto';
import { GraphValidatorService } from '../common/graph/graph-validator.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class KnowledgeMapsService {
    constructor(
        @InjectRepository(KnowledgeMap)
        private readonly mapRepo: Repository<KnowledgeMap>,
        @InjectRepository(MapRevision)
        private readonly revisionRepo: Repository<MapRevision>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(NodeConnection)
        private readonly connectionRepo: Repository<NodeConnection>,
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(KnowledgeGroup)
        private readonly groupRepo: Repository<KnowledgeGroup>,
        @InjectRepository(UserTopicProgress)
        private readonly progressRepo: Repository<UserTopicProgress>,
        private readonly graphValidator: GraphValidatorService,
        private readonly dataSource: DataSource,
    ) {}

    /** Каталог: усі опубліковані карти (меню «Карти», головна). */
    async findPublished(): Promise<KnowledgeMap[]> {
        return this.mapRepo.find({
            where: { status: MapStatus.PUBLISHED },
            order: { updatedAt: 'DESC' },
        });
    }

    /** @deprecated Використовуйте findPublished або findMine */
    async findAll(_userRole?: UserRole, _ownerUid?: string): Promise<KnowledgeMap[]> {
        return this.findPublished();
    }

    /** Мої карти: створені користувачем + ті, що проходить/проходив. */
    async findMine(userUid: string): Promise<KnowledgeMap[]> {
        const owned = await this.mapRepo.find({
            where: { ownerUid: userUid },
            order: { updatedAt: 'DESC' },
        });
        const ownedIds = new Set(owned.map((m) => m.id));

        const progressRows = await this.nodeRepo
            .createQueryBuilder('n')
            .innerJoin(
                UserTopicProgress,
                'p',
                'p.topic_id = n.topic_id AND p.user_uid = :uid',
                { uid: userUid },
            )
            .where('n.map_id IS NOT NULL')
            .andWhere("(p.status = 'completed' OR p.progress > 0)")
            .select('DISTINCT n.map_id', 'mapId')
            .getRawMany<{ mapId: number }>();

        const extraIds = progressRows
            .map((r) => Number(r.mapId))
            .filter((id) => id && !ownedIds.has(id));

        let fromProgress: KnowledgeMap[] = [];
        if (extraIds.length > 0) {
            fromProgress = await this.mapRepo.find({
                where: { id: In(extraIds) },
                order: { updatedAt: 'DESC' },
            });
        }

        const merged = [...owned, ...fromProgress];
        merged.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        return merged;
    }

    async findOne(id: number): Promise<KnowledgeMap> {
        const map = await this.mapRepo.findOne({ where: { id } });
        if (!map) throw new NotFoundException(`Карту з id=${id} не знайдено`);
        return map;
    }

    async create(dto: CreateKnowledgeMapDto, ownerUid: string): Promise<KnowledgeMap> {
        const map = this.mapRepo.create({
            title: dto.title,
            description: dto.description ?? null,
            ownerUid,
            status: MapStatus.DRAFT,
        });
        return this.mapRepo.save(map);
    }

    async update(id: number, dto: UpdateKnowledgeMapDto, userUid: string, userRole: UserRole): Promise<KnowledgeMap> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);

        if (dto.title !== undefined) map.title = dto.title;
        if (dto.description !== undefined) map.description = dto.description ?? null;
        if (dto.status !== undefined) {
            if (dto.status === MapStatus.PUBLISHED) {
                map.publishedAt = new Date();
            }
            map.status = dto.status;
        }

        return this.mapRepo.save(map);
    }

    async remove(id: number, userUid: string, userRole: UserRole): Promise<void> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);
        await this.mapRepo.remove(map);
    }

    async publish(id: number, userUid: string, userRole: UserRole): Promise<KnowledgeMap> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);

        const validation = await this.validateGraph(id);

        await this.createRevision(id, userUid, 'Авто-знімок перед публікацією');

        map.status = MapStatus.PUBLISHED;
        map.publishedAt = new Date();
        map.graphValidated = validation.valid;
        return this.mapRepo.save(map);
    }

    async getEditorGraph(mapId: number) {
        await this.findOne(mapId);

        const nodes = await this.nodeRepo.find({ where: { mapId } });
        const edges = await this.connectionRepo.find({ where: { mapId } });

        return {
            mapId,
            nodes: nodes.map((n) => ({
                id: n.id,
                title: n.title,
                topicId: n.topicId,
                groupId: n.groupId,
                x: n.x,
                y: n.y,
                color: n.color,
            })),
            edges: edges.map((e) => ({
                id: e.id,
                fromNodeId: e.fromNodeId,
                toNodeId: e.toNodeId,
                type: e.type,
            })),
        };
    }

    async validateGraph(mapId: number) {
        const graph = await this.getEditorGraph(mapId);
        return this.graphValidator.validate(
            graph.nodes.map((n) => n.id),
            graph.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId, id: e.id })),
        );
    }

    async bulkSave(
        mapId: number,
        dto: BulkSaveGraphDto,
        userUid: string,
        userRole: UserRole,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        if (map.status === MapStatus.PUBLISHED) {
            await this.createRevision(mapId, userUid, 'Auto-snapshot перед редагуванням опублікованої карти');
            map.status = MapStatus.DRAFT;
            await this.mapRepo.save(map);
        }

        if (dto.createRevision) {
            await this.createRevision(mapId, userUid, dto.revisionComment ?? 'Знімок перед збереженням');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const idRemap = new Map<number, number>();

            if (dto.deletedEdgeIds?.length) {
                await queryRunner.manager.delete(NodeConnection, {
                    id: In(dto.deletedEdgeIds),
                    mapId,
                });
            }

            if (dto.deletedNodeIds?.length) {
                await queryRunner.manager.delete(NodeConnection, {
                    mapId,
                    fromNodeId: In(dto.deletedNodeIds),
                });
                await queryRunner.manager.delete(NodeConnection, {
                    mapId,
                    toNodeId: In(dto.deletedNodeIds),
                });
                await queryRunner.manager.delete(Node, {
                    id: In(dto.deletedNodeIds),
                    mapId,
                });
            }

            if (dto.deletedGroupEdgeIds?.length) {
                await queryRunner.manager.delete(GroupConnection, {
                    id: In(dto.deletedGroupEdgeIds),
                    mapId,
                });
            }

            if (dto.deletedGroupIds?.length) {
                const validDelete = dto.deletedGroupIds.filter(Boolean);
                if (validDelete.length > 0) {
                    const nodesInGroups = await queryRunner.manager.find(Node, {
                        where: { mapId, groupId: In(validDelete) },
                    });
                    const nodeIds = nodesInGroups.map((n) => n.id);
                    if (nodeIds.length > 0) {
                        await queryRunner.manager.delete(NodeConnection, {
                            mapId,
                            fromNodeId: In(nodeIds),
                        });
                        await queryRunner.manager.delete(NodeConnection, {
                            mapId,
                            toNodeId: In(nodeIds),
                        });
                        await queryRunner.manager.delete(Node, {
                            id: In(nodeIds),
                            mapId,
                        });
                    }
                    await queryRunner.manager
                        .createQueryBuilder()
                        .delete()
                        .from(GroupConnection)
                        .where('map_id = :mapId', { mapId })
                        .andWhere(
                            '(from_group_id IN (:...ids) OR to_group_id IN (:...ids))',
                            { ids: validDelete },
                        )
                        .execute();
                    await queryRunner.manager.delete(KnowledgeGroup, {
                        id: In(validDelete),
                        mapId,
                    });
                }
            }

            if (dto.groups?.length) {
                for (const groupDto of dto.groups) {
                    const existing = await queryRunner.manager.findOne(KnowledgeGroup, {
                        where: { id: groupDto.id },
                    });
                    if (existing) {
                        if (existing.mapId !== mapId) {
                            throw new BadRequestException(
                                `Група ${groupDto.id} належить іншій карті`,
                            );
                        }
                        Object.assign(existing, {
                            title: groupDto.title,
                            description: groupDto.description ?? null,
                            level: groupDto.level ?? existing.level,
                            sortOrder: groupDto.sortOrder ?? existing.sortOrder,
                            parentId:
                                groupDto.parentId !== undefined
                                    ? groupDto.parentId
                                    : existing.parentId,
                        });
                        await queryRunner.manager.save(existing);
                    } else {
                        await queryRunner.manager.save(
                            queryRunner.manager.create(KnowledgeGroup, {
                                id: groupDto.id,
                                mapId,
                                title: groupDto.title,
                                description: groupDto.description ?? null,
                                level: groupDto.level ?? 0,
                                sortOrder: groupDto.sortOrder ?? 0,
                                parentId: groupDto.parentId ?? null,
                            }),
                        );
                    }
                }
            }

            for (const nodeDto of dto.nodes) {
                let topic: Topic | null = null;
                if (nodeDto.topicId) {
                    topic = await queryRunner.manager.findOne(Topic, {
                        where: { id: nodeDto.topicId },
                    });
                    if (!topic) {
                        throw new BadRequestException(`Topic id=${nodeDto.topicId} не існує`);
                    }
                }

                let existing: Node | null = null;
                if (nodeDto.id !== undefined && nodeDto.id > 0) {
                    existing = await queryRunner.manager.findOne(Node, {
                        where: { id: nodeDto.id, mapId },
                    });
                    if (!existing) {
                        throw new NotFoundException(
                            `Node id=${nodeDto.id} не знайдено на карті ${mapId}`,
                        );
                    }
                }

                const groupIdForSave = this.resolveNodeGroupIdForSave(nodeDto, topic);
                const effectiveGroupId =
                    groupIdForSave ?? topic?.groupId ?? existing?.groupId ?? null;

                let topicIdForSave = nodeDto.topicId ?? existing?.topicId ?? null;

                if (!topicIdForSave && effectiveGroupId) {
                    topic = await this.createTopicForNodeInTransaction(
                        queryRunner,
                        nodeDto.title,
                        effectiveGroupId,
                    );
                    topicIdForSave = topic.id;
                } else if (topic) {
                    const trimmedTitle = nodeDto.title.trim() || 'Новий вузол';
                    let topicDirty = false;
                    if (topic.title !== trimmedTitle) {
                        topic.title = trimmedTitle;
                        topic.description = trimmedTitle;
                        topicDirty = true;
                    }
                    if (effectiveGroupId && topic.groupId !== effectiveGroupId) {
                        topic.groupId = effectiveGroupId;
                        topicDirty = true;
                    }
                    if (topicDirty) {
                        await queryRunner.manager.save(topic);
                    }
                }

                if (existing) {
                    Object.assign(existing, {
                        title: nodeDto.title,
                        topicId: topicIdForSave,
                        color: nodeDto.color ?? null,
                    });
                    if (groupIdForSave !== undefined) {
                        existing.groupId = groupIdForSave;
                    }
                    if (nodeDto.x !== undefined) existing.x = nodeDto.x;
                    if (nodeDto.y !== undefined) existing.y = nodeDto.y;
                    await queryRunner.manager.save(existing);
                } else {
                    const tempKey = nodeDto.id;
                    const created = await queryRunner.manager.save(
                        queryRunner.manager.create(Node, {
                            title: nodeDto.title,
                            topicId: topicIdForSave,
                            groupId: groupIdForSave ?? effectiveGroupId ?? null,
                            mapId,
                            x: nodeDto.x ?? null,
                            y: nodeDto.y ?? null,
                            color: nodeDto.color ?? null,
                        }),
                    );
                    if (tempKey !== undefined && tempKey < 0) {
                        idRemap.set(tempKey, created.id);
                    }
                }
            }

            const resolveNodeId = (id: number): number => {
                if (id < 0) {
                    const mapped = idRemap.get(id);
                    if (!mapped) {
                        throw new BadRequestException(`Тимчасовий id вузла ${id} не знайдено після створення`);
                    }
                    return mapped;
                }
                return id;
            };

            const allNodes = await queryRunner.manager.find(Node, { where: { mapId } });
            const nodeIdSet = new Set(allNodes.map((n) => n.id));

            for (const edgeDto of dto.edges) {
                const fromNodeId = resolveNodeId(edgeDto.fromNodeId);
                const toNodeId = resolveNodeId(edgeDto.toNodeId);

                if (!nodeIdSet.has(fromNodeId) || !nodeIdSet.has(toNodeId)) {
                    throw new BadRequestException(
                        `Ребро ${fromNodeId}→${toNodeId} посилається на неіснуючі вузли`,
                    );
                }

                if (edgeDto.id && edgeDto.id > 0) {
                    const existing = await queryRunner.manager.findOne(NodeConnection, {
                        where: { id: edgeDto.id, mapId },
                    });
                    if (existing) {
                        Object.assign(existing, {
                            fromNodeId,
                            toNodeId,
                            type: edgeDto.type ?? null,
                        });
                        await queryRunner.manager.save(existing);
                        continue;
                    }
                }

                const duplicate = await queryRunner.manager.findOne(NodeConnection, {
                    where: {
                        mapId,
                        fromNodeId,
                        toNodeId,
                    },
                });
                if (!duplicate) {
                    await queryRunner.manager.save(
                        queryRunner.manager.create(NodeConnection, {
                            fromNodeId,
                            toNodeId,
                            mapId,
                            type: edgeDto.type ?? null,
                        }),
                    );
                }
            }

            if (dto.groupEdges?.length) {
                const groupIds = new Set(
                    (await queryRunner.manager.find(KnowledgeGroup, { where: { mapId } })).map(
                        (g) => g.id,
                    ),
                );

                for (const edgeDto of dto.groupEdges) {
                    if (!groupIds.has(edgeDto.fromGroupId) || !groupIds.has(edgeDto.toGroupId)) {
                        throw new BadRequestException(
                            `Group edge ${edgeDto.fromGroupId}→${edgeDto.toGroupId} посилається на неіснуючі групи`,
                        );
                    }

                    if (edgeDto.id && edgeDto.id > 0) {
                        const existing = await queryRunner.manager.findOne(GroupConnection, {
                            where: { id: edgeDto.id, mapId },
                        });
                        if (existing) {
                            Object.assign(existing, {
                                fromGroupId: edgeDto.fromGroupId,
                                toGroupId: edgeDto.toGroupId,
                                type: edgeDto.type ?? 'prerequisite',
                            });
                            await queryRunner.manager.save(existing);
                            continue;
                        }
                    }

                    const duplicate = await queryRunner.manager.findOne(GroupConnection, {
                        where: {
                            mapId,
                            fromGroupId: edgeDto.fromGroupId,
                            toGroupId: edgeDto.toGroupId,
                        },
                    });
                    if (!duplicate) {
                        await queryRunner.manager.save(
                            queryRunner.manager.create(GroupConnection, {
                                mapId,
                                fromGroupId: edgeDto.fromGroupId,
                                toGroupId: edgeDto.toGroupId,
                                type: edgeDto.type ?? 'prerequisite',
                                source: 'editor',
                            }),
                        );
                    }
                }
            }

            if (dto.groupLayouts !== undefined && dto.groupLayouts.length > 0) {
                const freshMap = await queryRunner.manager.findOne(KnowledgeMap, {
                    where: { id: mapId },
                });
                if (!freshMap) {
                    throw new NotFoundException(`Карту id=${mapId} не знайдено`);
                }
                const layout: Record<string, { x: number; y: number }> = {
                    ...(freshMap.groupLayoutJson ?? {}),
                };
                for (const item of dto.groupLayouts) {
                    layout[item.groupId] = {
                        x: Math.round(item.x),
                        y: Math.round(item.y),
                    };
                }
                freshMap.groupLayoutJson = layout;
                await queryRunner.manager.save(KnowledgeMap, freshMap);
                map.groupLayoutJson = layout;
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err instanceof QueryFailedError) {
                throw new BadRequestException(`Помилка збереження графа: ${err.message}`);
            }
            throw err;
        } finally {
            await queryRunner.release();
        }

        map.updatedAt = new Date();
        await this.mapRepo.save(map);

        return this.getEditorGraph(mapId);
    }

    async createRevision(mapId: number, userUid: string, comment?: string): Promise<MapRevision> {
        const graph = await this.getEditorGraph(mapId);
        const revision = this.revisionRepo.create({
            mapId,
            snapshotJson: {
                nodes: graph.nodes,
                edges: graph.edges,
            },
            comment: comment ?? null,
            createdByUid: userUid,
        });
        return this.revisionRepo.save(revision);
    }

    async listRevisions(mapId: number): Promise<MapRevision[]> {
        await this.findOne(mapId);
        return this.revisionRepo.find({
            where: { mapId },
            order: { createdAt: 'DESC' },
        });
    }

    async restoreRevision(
        mapId: number,
        revisionId: number,
        userUid: string,
        userRole: UserRole,
    ) {
        const revision = await this.revisionRepo.findOne({
            where: { id: revisionId, mapId },
        });
        if (!revision) {
            throw new NotFoundException(`Ревізію id=${revisionId} не знайдено`);
        }

        const { nodes, edges } = revision.snapshotJson;

        return this.bulkSave(
            mapId,
            {
                nodes: nodes.map((n: Record<string, unknown>) => ({
                    id: n.id as number,
                    title: n.title as string,
                    topicId: (n.topicId as number) ?? null,
                    x: (n.x as number) ?? null,
                    y: (n.y as number) ?? null,
                    color: (n.color as string) ?? null,
                })),
                edges: edges.map((e: Record<string, unknown>) => ({
                    id: e.id as number | undefined,
                    fromNodeId: e.fromNodeId as number,
                    toNodeId: e.toNodeId as number,
                    type: (e.type as string) ?? null,
                })),
                createRevision: true,
                revisionComment: `Відновлено з ревізії #${revisionId}`,
            },
            userUid,
            userRole,
        );
    }

    async getDefaultMapId(): Promise<number> {
        const published = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });
        if (published) return published.id;

        const any = await this.mapRepo.findOne({ order: { id: 'ASC' } });
        if (!any) throw new NotFoundException('Жодної карти знань не знайдено');
        return any.id;
    }

    async exportJson(mapId: number) {
        const map = await this.findOne(mapId);
        const graph = await this.getEditorGraph(mapId);
        return {
            map: {
                id: map.id,
                title: map.title,
                description: map.description,
                status: map.status,
            },
            ...graph,
            exportedAt: new Date().toISOString(),
        };
    }

    async getImportLibrary(
        mapId: number,
        userUid: string,
        userRole: UserRole,
        search?: string,
        sourceMapId?: number,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        const qb = this.mapRepo
            .createQueryBuilder('m')
            .where('m.id != :mapId', { mapId });

        if (userRole !== UserRole.ADMIN) {
            qb.andWhere('m.owner_uid = :uid', { uid: userUid });
        }
        if (sourceMapId != null && !Number.isNaN(sourceMapId)) {
            qb.andWhere('m.id = :sourceMapId', { sourceMapId });
        }

        const maps = await qb.orderBy('m.updated_at', 'DESC').getMany();
        if (maps.length === 0) {
            return { maps: [], groups: [], nodes: [] };
        }

        const mapIds = maps.map((m) => m.id);
        const mapTitleById = new Map(maps.map((m) => [m.id, m.title]));
        const q = search?.trim();

        let groupsQuery = this.groupRepo
            .createQueryBuilder('g')
            .where('g.map_id IN (:...mapIds)', { mapIds });
        if (q) {
            groupsQuery = groupsQuery.andWhere(
                '(g.title LIKE :search OR g.description LIKE :search)',
                { search: `%${q}%` },
            );
        }
        const groups = await groupsQuery.orderBy('g.sort_order', 'ASC').getMany();

        let nodesQuery = this.nodeRepo
            .createQueryBuilder('n')
            .where('n.map_id IN (:...mapIds)', { mapIds });
        if (q) {
            nodesQuery = nodesQuery.andWhere('n.title LIKE :search', { search: `%${q}%` });
        }
        const nodes = await nodesQuery.getMany();

        const nodeCountByGroup = new Map<string, number>();
        for (const n of nodes) {
            if (!n.groupId) continue;
            const key = `${n.mapId}:${n.groupId}`;
            nodeCountByGroup.set(key, (nodeCountByGroup.get(key) ?? 0) + 1);
        }

        const groupTitleById = new Map(groups.map((g) => [g.id, g.title]));

        return {
            maps: maps.map((m) => ({
                id: m.id,
                title: m.title,
                status: m.status,
            })),
            groups: groups.map((g) => ({
                id: g.id,
                title: g.title,
                description: g.description,
                level: g.level,
                sortOrder: g.sortOrder,
                mapId: g.mapId,
                mapTitle: mapTitleById.get(g.mapId) ?? '',
                nodeCount: nodeCountByGroup.get(`${g.mapId}:${g.id}`) ?? 0,
            })),
            nodes: nodes.map((n) => ({
                id: n.id,
                title: n.title,
                mapId: n.mapId!,
                mapTitle: n.mapId != null ? (mapTitleById.get(n.mapId) ?? '') : '',
                groupId: n.groupId,
                groupTitle: n.groupId ? (groupTitleById.get(n.groupId) ?? null) : null,
                topicId: n.topicId,
            })),
        };
    }

    private assertCanEdit(map: KnowledgeMap, userUid: string, userRole: UserRole): void {
        if (userRole === UserRole.ADMIN) return;
        if (userRole === UserRole.TEACHER) {
            if (!map.ownerUid || map.ownerUid === userUid) return;
        }
        throw new ForbiddenException('Недостатньо прав для редагування цієї карти');
    }

    /** groupId з payload або з теми; undefined = не змінювати (partial update) */
    private resolveNodeGroupIdForSave(
        nodeDto: BulkNodeDto,
        topic: Topic | null,
    ): string | null | undefined {
        if (nodeDto.groupId !== undefined) {
            return nodeDto.groupId;
        }
        if (nodeDto.topicId !== undefined && nodeDto.topicId != null && topic) {
            return topic.groupId ?? null;
        }
        return undefined;
    }

    private async createTopicForNodeInTransaction(
        queryRunner: QueryRunner,
        title: string,
        groupId: string,
    ): Promise<Topic> {
        const trimmedTitle = title.trim() || 'Новий вузол';

        const maxOrder = await queryRunner.manager
            .createQueryBuilder(Topic, 't')
            .select('MAX(t.orderInGroup)', 'maxOrder')
            .where('t.groupId = :groupId', { groupId })
            .getRawOne<{ maxOrder: string | null }>();

        const maxGlobal = await queryRunner.manager
            .createQueryBuilder(Topic, 't')
            .select('MAX(t.globalOrder)', 'maxGlobal')
            .getRawOne<{ maxGlobal: string | null }>();

        return queryRunner.manager.save(
            queryRunner.manager.create(Topic, {
                title: trimmedTitle,
                description: trimmedTitle,
                groupId,
                orderInGroup: (Number(maxOrder?.maxOrder) || 0) + 1,
                globalOrder: (Number(maxGlobal?.maxGlobal) || 0) + 1,
            }),
        );
    }
}
