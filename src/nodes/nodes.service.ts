import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { Node } from './entities/node.entity';
import { NodeMedia } from './entities/node-media.entity';
import { CreateNodeDto, UpdateNodeDto } from './dtos/create-node.dto';
import { UpdateNodeContentDto, NodeContentDto } from './dtos/node-content.dto';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { GraphValidatorService } from '../common/graph/graph-validator.service';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import {
    filenameFromPublicUrl,
    nodeMediaAbsolutePath,
    nodeMediaPublicUrl,
} from './node-media.storage';
import type { UploadedImageFile } from './types/uploaded-image-file';

@Injectable()
export class NodesService {
    constructor(
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(NodeMedia)
        private readonly nodeMediaRepo: Repository<NodeMedia>,
        @InjectRepository(UserTopicProgress)
        private progressRepo: Repository<UserTopicProgress>,
        @InjectRepository(NodeConnection)
        private readonly connectionRepo: Repository<NodeConnection>,
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(KnowledgeMap)
        private readonly mapRepo: Repository<KnowledgeMap>,
        @InjectRepository(KnowledgeGroup)
        private readonly groupRepo: Repository<KnowledgeGroup>,
        @InjectRepository(GroupConnection)
        private readonly groupConnRepo: Repository<GroupConnection>,
        private readonly graphValidator: GraphValidatorService,
    ) {}

    async findAll(mapId?: number): Promise<Node[]> {
        if (mapId) {
            return this.nodeRepo.find({ where: { mapId } });
        }
        return this.nodeRepo.find();
    }

    async findOne(id: number): Promise<Node> {
        const node = await this.nodeRepo.findOne({ where: { id } });
        if (!node) throw new NotFoundException(`Node з id=${id} не знайдено`);
        return node;
    }

    async create(dto: CreateNodeDto): Promise<Node> {
        if (dto.topicId) {
            const topic = await this.topicRepo.findOne({ where: { id: dto.topicId } });
            if (!topic) throw new BadRequestException(`Topic id=${dto.topicId} не існує`);
        }

        let mapId = dto.mapId;
        if (!mapId) {
            mapId = await this.getDefaultMapId();
        }

        const node = this.nodeRepo.create({ ...dto, mapId });
        return this.nodeRepo.save(node);
    }

    async update(id: number, dto: UpdateNodeDto): Promise<Node> {
        const node = await this.findOne(id);
        if (dto.topicId) {
            const topic = await this.topicRepo.findOne({ where: { id: dto.topicId } });
            if (!topic) throw new BadRequestException(`Topic id=${dto.topicId} не існує`);
        }
        Object.assign(node, dto);
        return this.nodeRepo.save(node);
    }

    async remove(id: number): Promise<void> {
        const node = await this.findOne(id);
        await this.deleteAllMediaForNode(id);
        await this.connectionRepo.delete({ fromNodeId: id });
        await this.connectionRepo.delete({ toNodeId: id });
        await this.nodeRepo.remove(node);
    }

    async getNodeContent(nodeId: number): Promise<NodeContentDto> {
        const node = await this.findOne(nodeId);
        const media = await this.nodeMediaRepo.find({
            where: { nodeId },
            order: { sortOrder: 'ASC', id: 'ASC' },
        });
        return {
            nodeId: node.id,
            theoryMd: node.theoryMd,
            media: media.map((m) => ({
                id: m.id,
                url: m.url,
                caption: m.caption,
                sortOrder: m.sortOrder,
            })),
        };
    }

    async updateNodeContent(nodeId: number, dto: UpdateNodeContentDto): Promise<NodeContentDto> {
        const node = await this.findOne(nodeId);
        if (dto.theoryMd !== undefined) {
            node.theoryMd = dto.theoryMd;
            await this.nodeRepo.save(node);
        }
        return this.getNodeContent(nodeId);
    }

    async addNodeMedia(
        nodeId: number,
        file: UploadedImageFile,
        caption?: string | null,
    ): Promise<NodeContentDto> {
        await this.findOne(nodeId);
        if (!file) {
            throw new BadRequestException('Файл зображення не передано');
        }

        const maxOrder = await this.nodeMediaRepo
            .createQueryBuilder('m')
            .select('MAX(m.sort_order)', 'maxOrder')
            .where('m.node_id = :nodeId', { nodeId })
            .getRawOne<{ maxOrder: string | null }>();

        await this.nodeMediaRepo.save(
            this.nodeMediaRepo.create({
                nodeId,
                url: nodeMediaPublicUrl(file.filename),
                caption: caption?.trim() || null,
                sortOrder: (Number(maxOrder?.maxOrder) || 0) + 1,
            }),
        );

        return this.getNodeContent(nodeId);
    }

    async removeNodeMedia(nodeId: number, mediaId: number): Promise<NodeContentDto> {
        const media = await this.nodeMediaRepo.findOne({ where: { id: mediaId, nodeId } });
        if (!media) {
            throw new NotFoundException(`Зображення id=${mediaId} не знайдено для вузла ${nodeId}`);
        }
        await this.deleteMediaFile(media.url);
        await this.nodeMediaRepo.remove(media);
        return this.getNodeContent(nodeId);
    }

    private async deleteAllMediaForNode(nodeId: number): Promise<void> {
        const media = await this.nodeMediaRepo.find({ where: { nodeId } });
        for (const item of media) {
            await this.deleteMediaFile(item.url);
        }
        if (media.length > 0) {
            await this.nodeMediaRepo.remove(media);
        }
    }

    private async deleteMediaFile(publicUrl: string): Promise<void> {
        const filename = filenameFromPublicUrl(publicUrl);
        if (!filename) return;
        try {
            await unlink(nodeMediaAbsolutePath(filename));
        } catch {
            /* файл могло бути вже видалено */
        }
    }

    async getGroupGraph(userUid: string, mapId?: number) {
        const resolvedMapId = mapId ?? (await this.getDefaultMapId());
        const graph = await this.getGraph(userUid, resolvedMapId);
        return {
            mapId: resolvedMapId,
            groups: graph.groups,
            groupEdges: graph.groupEdges,
            groupLayout: graph.groupLayout ?? {},
        };
    }

    async getGraph(userUid: string, mapId?: number) {
        const resolvedMapId = mapId ?? (await this.getDefaultMapId());
        const map = await this.mapRepo.findOne({ where: { id: resolvedMapId } });

        const nodes = await this.nodeRepo.find({ where: { mapId: resolvedMapId } });
        const connections = await this.connectionRepo.find({ where: { mapId: resolvedMapId } });
        const progresses = await this.progressRepo.find({ where: { userUid } });
        const topics = await this.topicRepo.find();
        const groups = await this.groupRepo.find({
            where: { mapId: resolvedMapId },
            order: { sortOrder: 'ASC' },
        });
        const groupConnections = await this.groupConnRepo.find({
            where: { mapId: resolvedMapId },
        });

        const topicById = new Map(topics.map((t) => [t.id, t]));
        const groupLevelById = new Map(groups.map((g) => [g.id, g.level]));

        const progressMap = new Map<number, UserTopicProgress>();
        const completedTopicIds = new Set<number>();

        for (const prog of progresses) {
            const topicId = Number(prog.topicId);
            progressMap.set(topicId, prog);
            if (prog.status === 'completed') {
                completedTopicIds.add(topicId);
            }
        }

        const parentMap = new Map<number, number[]>();
        for (const conn of connections) {
            if (!parentMap.has(conn.toNodeId)) {
                parentMap.set(conn.toNodeId, []);
            }
            parentMap.get(conn.toNodeId)!.push(conn.fromNodeId);
        }

        const levels = new Map<number, number>();
        const visited = new Set<number>();
        const queue: number[] = [];

        for (const node of nodes) {
            const parents = parentMap.get(node.id) || [];
            if (parents.length === 0) {
                levels.set(node.id, 0);
                queue.push(node.id);
                visited.add(node.id);
            }
        }

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentLevel = levels.get(currentId)!;

            for (const conn of connections) {
                if (conn.fromNodeId === currentId) {
                    const childId = conn.toNodeId;
                    const prevLevel = levels.get(childId) ?? 0;
                    levels.set(childId, Math.max(prevLevel, currentLevel + 1));

                    if (!visited.has(childId)) {
                        queue.push(childId);
                        visited.add(childId);
                    }
                }
            }
        }

        const availableTopicIds = new Set<number>();
        for (const node of nodes) {
            const topicId = node.topicId;
            if (topicId == null) continue;

            const parents = parentMap.get(node.id) || [];
            const isCompleted = completedTopicIds.has(topicId);
            const hasNoParents = parents.length === 0;

            const allParentsCompleted = parents.every((parentId) => {
                const parentNode = nodes.find((n) => n.id === parentId);
                if (!parentNode?.topicId) return true;
                return completedTopicIds.has(parentNode.topicId);
            });

            if (!isCompleted && (hasNoParents || allParentsCompleted)) {
                availableTopicIds.add(topicId);
            }
        }

        const graphNodes = nodes.map((node) => {
                const topicId = node.topicId ?? null;
                const topic = topicId != null ? topicById.get(topicId) : undefined;
                const progress = topicId != null ? progressMap.get(topicId) : undefined;
                const resolvedGroupId = node.groupId ?? topic?.groupId ?? null;
                const groupLevel =
                    resolvedGroupId != null
                        ? groupLevelById.get(resolvedGroupId)
                        : undefined;
                const level = groupLevel ?? levels.get(node.id) ?? 0;

                let progressStatus: 'completed' | 'available' | 'locked' = 'locked';
                if (topicId == null) {
                    progressStatus = 'available';
                } else if (completedTopicIds.has(topicId)) {
                    progressStatus = 'completed';
                } else if (availableTopicIds.has(topicId)) {
                    progressStatus = 'available';
                }

                return {
                    id: node.id,
                    label: node.title,
                    title: node.title,
                    topicId,
                    x: node.x,
                    y: node.y,
                    color: node.color,
                    level,
                    groupId: resolvedGroupId,
                    orderInGroup: topic?.orderInGroup ?? 0,
                    globalOrder: topic?.globalOrder ?? null,
                    progress: progress?.progress ?? 0,
                    status: progressStatus,
                };
            });

        const groupStats = new Map<
            string,
            { total: number; completed: number; available: number }
        >();
        for (const g of groups) {
            groupStats.set(g.id, { total: 0, completed: 0, available: 0 });
        }
        for (const n of graphNodes) {
            if (!n.groupId) continue;
            const st = groupStats.get(n.groupId);
            if (!st) continue;
            st.total++;
            if (n.status === 'completed') st.completed++;
            if (n.status === 'available') st.available++;
        }

        return {
            mapId: resolvedMapId,
            nodes: graphNodes,
            edges: connections.map((c) => ({
                id: c.id,
                from: c.fromNodeId,
                to: c.toNodeId,
                label: c.type ?? '',
                type: c.type ?? '',
            })),
            groups: groups.map((g) => {
                const st = groupStats.get(g.id) ?? { total: 0, completed: 0, available: 0 };
                const pct = st.total > 0 ? Math.round((st.completed / st.total) * 100) : 0;
                const layoutPos = map?.groupLayoutJson?.[g.id];
                return {
                    id: g.id,
                    title: g.title,
                    description: g.description,
                    level: g.level,
                    sortOrder: g.sortOrder,
                    topicCount: st.total,
                    completedCount: st.completed,
                    availableCount: st.available,
                    progressPercent: pct,
                    x: layoutPos?.x ?? null,
                    y: layoutPos?.y ?? null,
                };
            }),
            groupEdges: groupConnections.map((e) => ({
                id: e.id,
                from: e.fromGroupId,
                to: e.toGroupId,
                type: e.type,
            })),
            groupLayout: map?.groupLayoutJson ?? {},
        };
    }

    async getProgressSummary(userUid: string, mapId?: number) {
        const graph = await this.getGraph(userUid, mapId);
        const completed = graph.nodes.filter((n) => n.status === 'completed').length;
        const available = graph.nodes.filter((n) => n.status === 'available').length;
        const locked = graph.nodes.filter((n) => n.status === 'locked').length;
        const total = graph.nodes.length;

        return {
            mapId: graph.mapId,
            total,
            completed,
            available,
            locked,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            nodes: graph.nodes.map((n) => ({
                id: n.id,
                title: n.title,
                topicId: n.topicId,
                status: n.status,
                level: n.level,
                progress: n.progress,
            })),
        };
    }

    async validateMapGraph(mapId: number) {
        const nodes = await this.nodeRepo.find({ where: { mapId } });
        const connections = await this.connectionRepo.find({ where: { mapId } });
        return this.graphValidator.validate(
            nodes.map((n) => ({
                id: n.id,
                title: n.title,
                groupId: n.groupId ?? null,
            })),
            connections.map((c) => ({ from: c.fromNodeId, to: c.toNodeId, id: c.id })),
        );
    }

    private async getDefaultMapId(): Promise<number> {
        const published = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });
        if (published) return published.id;

        const any = await this.mapRepo.findOne({ order: { id: 'ASC' } });
        if (!any) throw new NotFoundException('Жодної карти знань не знайдено');
        return any.id;
    }
}
