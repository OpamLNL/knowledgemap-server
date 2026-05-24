import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { KnowledgeMap, MapStatus } from './entities/knowledge-map.entity';
import { MapRevision } from './entities/map-revision.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { CreateKnowledgeMapDto, UpdateKnowledgeMapDto } from './dtos/create-knowledge-map.dto';
import { BulkSaveGraphDto } from './dtos/bulk-save-graph.dto';
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
        private readonly graphValidator: GraphValidatorService,
        private readonly dataSource: DataSource,
    ) {}

    async findAll(userRole: UserRole, ownerUid?: string): Promise<KnowledgeMap[]> {
        if (userRole === UserRole.ADMIN) {
            return this.mapRepo.find({ order: { updatedAt: 'DESC' } });
        }
        if (userRole === UserRole.TEACHER && ownerUid) {
            return this.mapRepo.find({
                where: { ownerUid },
                order: { updatedAt: 'DESC' },
            });
        }
        return this.mapRepo.find({
            where: { status: MapStatus.PUBLISHED },
            order: { updatedAt: 'DESC' },
        });
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

        const graph = await this.getEditorGraph(id);
        this.graphValidator.assertValid(
            graph.nodes.map((n) => n.id),
            graph.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId, id: e.id })),
        );

        await this.createRevision(id, userUid, 'Авто-знімок перед публікацією');

        map.status = MapStatus.PUBLISHED;
        map.publishedAt = new Date();
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

        const nodeIdsForValidation = dto.nodes.map((n, i) => n.id ?? -(i + 1));
        const edgesForValidation = dto.edges.map((e) => ({
            from: e.fromNodeId,
            to: e.toNodeId,
        }));

        this.graphValidator.assertValid(nodeIdsForValidation, edgesForValidation);

        if (dto.createRevision) {
            await this.createRevision(mapId, userUid, dto.revisionComment ?? 'Знімок перед збереженням');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
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

            for (const nodeDto of dto.nodes) {
                if (nodeDto.topicId) {
                    const topic = await this.topicRepo.findOne({ where: { id: nodeDto.topicId } });
                    if (!topic) {
                        throw new BadRequestException(`Topic id=${nodeDto.topicId} не існує`);
                    }
                }

                if (nodeDto.id) {
                    const existing = await queryRunner.manager.findOne(Node, {
                        where: { id: nodeDto.id, mapId },
                    });
                    if (!existing) {
                        throw new NotFoundException(`Node id=${nodeDto.id} не знайдено на карті ${mapId}`);
                    }
                    Object.assign(existing, {
                        title: nodeDto.title,
                        topicId: nodeDto.topicId ?? null,
                        x: nodeDto.x ?? null,
                        y: nodeDto.y ?? null,
                        color: nodeDto.color ?? null,
                    });
                    await queryRunner.manager.save(existing);
                } else {
                    const created = queryRunner.manager.create(Node, {
                        title: nodeDto.title,
                        topicId: nodeDto.topicId ?? null,
                        mapId,
                        x: nodeDto.x ?? null,
                        y: nodeDto.y ?? null,
                        color: nodeDto.color ?? null,
                    });
                    const saved = await queryRunner.manager.save(created);
                    void saved;
                }
            }

            const allNodes = await queryRunner.manager.find(Node, { where: { mapId } });
            const nodeIdSet = new Set(allNodes.map((n) => n.id));

            for (const edgeDto of dto.edges) {
                if (!nodeIdSet.has(edgeDto.fromNodeId) || !nodeIdSet.has(edgeDto.toNodeId)) {
                    throw new BadRequestException(
                        `Ребро ${edgeDto.fromNodeId}→${edgeDto.toNodeId} посилається на неіснуючі вузли`,
                    );
                }

                if (edgeDto.id) {
                    const existing = await queryRunner.manager.findOne(NodeConnection, {
                        where: { id: edgeDto.id, mapId },
                    });
                    if (existing) {
                        Object.assign(existing, {
                            fromNodeId: edgeDto.fromNodeId,
                            toNodeId: edgeDto.toNodeId,
                            type: edgeDto.type ?? null,
                        });
                        await queryRunner.manager.save(existing);
                        continue;
                    }
                }

                const duplicate = await queryRunner.manager.findOne(NodeConnection, {
                    where: {
                        mapId,
                        fromNodeId: edgeDto.fromNodeId,
                        toNodeId: edgeDto.toNodeId,
                    },
                });
                if (!duplicate) {
                    const created = queryRunner.manager.create(NodeConnection, {
                        fromNodeId: edgeDto.fromNodeId,
                        toNodeId: edgeDto.toNodeId,
                        mapId,
                        type: edgeDto.type ?? null,
                    });
                    await queryRunner.manager.save(created);
                }
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
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

    private assertCanEdit(map: KnowledgeMap, userUid: string, userRole: UserRole): void {
        if (userRole === UserRole.ADMIN) return;
        if (userRole === UserRole.TEACHER) {
            if (!map.ownerUid || map.ownerUid === userUid) return;
        }
        throw new ForbiddenException('Недостатньо прав для редагування цієї карти');
    }
}
