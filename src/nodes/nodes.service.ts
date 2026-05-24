import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { CreateNodeDto, UpdateNodeDto } from './dtos/create-node.dto';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { GraphValidatorService } from '../common/graph/graph-validator.service';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';

@Injectable()
export class NodesService {
    constructor(
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(UserTopicProgress)
        private progressRepo: Repository<UserTopicProgress>,
        @InjectRepository(NodeConnection)
        private readonly connectionRepo: Repository<NodeConnection>,
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(KnowledgeMap)
        private readonly mapRepo: Repository<KnowledgeMap>,
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
        await this.connectionRepo.delete({ fromNodeId: id });
        await this.connectionRepo.delete({ toNodeId: id });
        await this.nodeRepo.remove(node);
    }

    async getGraph(userUid: string, mapId?: number) {
        const resolvedMapId = mapId ?? (await this.getDefaultMapId());

        const nodes = await this.nodeRepo.find({ where: { mapId: resolvedMapId } });
        const connections = await this.connectionRepo.find({ where: { mapId: resolvedMapId } });
        const progresses = await this.progressRepo.find({ where: { userUid } });

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
            const parents = parentMap.get(node.id) || [];
            const isCompleted = completedTopicIds.has(Number(node.topicId));
            const hasNoParents = parents.length === 0;

            const allParentsCompleted = parents.every((parentId) => {
                const parentNode = nodes.find((n) => n.id === parentId);
                return parentNode && completedTopicIds.has(Number(parentNode.topicId));
            });

            if (!isCompleted && (hasNoParents || allParentsCompleted)) {
                availableTopicIds.add(Number(node.topicId));
            }
        }

        return {
            mapId: resolvedMapId,
            nodes: nodes.map((node) => {
                const topicId = Number(node.topicId);
                const progress = progressMap.get(topicId);
                const level = levels.get(node.id) ?? 0;

                let progressStatus: 'completed' | 'available' | 'locked' = 'locked';
                if (completedTopicIds.has(topicId)) {
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
                    progress: progress?.progress ?? 0,
                    status: progressStatus,
                };
            }),
            edges: connections.map((c) => ({
                id: c.id,
                from: c.fromNodeId,
                to: c.toNodeId,
                label: c.type ?? '',
            })),
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
            nodes.map((n) => n.id),
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
