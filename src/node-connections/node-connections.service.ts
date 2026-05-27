import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeConnection } from './entities/node-connection.entity';
import { CreateNodeConnectionDto, UpdateNodeConnectionDto } from './dto/create-node-connection.dto';
import { Node } from '../nodes/entities/node.entity';
import { GraphValidatorService } from '../common/graph/graph-validator.service';
import { GraphEditMap, MapStatus } from '../graph-edit-maps/entities/graph-edit-map.entity';

@Injectable()
export class NodeConnectionsService {
    constructor(
        @InjectRepository(NodeConnection)
        private readonly repo: Repository<NodeConnection>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(GraphEditMap)
        private readonly mapRepo: Repository<GraphEditMap>,
        private readonly graphValidator: GraphValidatorService,
    ) {}

    async findAll(mapId?: number): Promise<NodeConnection[]> {
        if (mapId) {
            return this.repo.find({ where: { mapId } });
        }
        return this.repo.find();
    }

    async findOne(id: number): Promise<NodeConnection> {
        const item = await this.repo.findOneBy({ id });
        if (!item) throw new NotFoundException(`Зв'язок з id=${id} не знайдено`);
        return item;
    }

    async create(dto: CreateNodeConnectionDto): Promise<NodeConnection> {
        if (dto.fromNodeId === dto.toNodeId) {
            throw new BadRequestException('Self-loop заборонено');
        }

        const fromNode = await this.nodeRepo.findOne({ where: { id: dto.fromNodeId } });
        const toNode = await this.nodeRepo.findOne({ where: { id: dto.toNodeId } });
        if (!fromNode || !toNode) {
            throw new BadRequestException('fromNodeId або toNodeId не існує');
        }

        let mapId = dto.mapId ?? fromNode.mapId ?? toNode.mapId;
        if (!mapId) {
            mapId = await this.getDefaultMapId();
        }

        const duplicate = await this.repo.findOne({
            where: { fromNodeId: dto.fromNodeId, toNodeId: dto.toNodeId, mapId },
        });
        if (duplicate) {
            throw new BadRequestException('Таке ребро вже існує');
        }

        await this.assertNoCycleAfterAdd(dto.fromNodeId, dto.toNodeId, mapId);

        const entity = this.repo.create({ ...dto, mapId });
        return this.repo.save(entity);
    }

    async update(id: number, dto: UpdateNodeConnectionDto): Promise<NodeConnection> {
        const entity = await this.findOne(id);
        const fromNodeId = dto.fromNodeId ?? entity.fromNodeId;
        const toNodeId = dto.toNodeId ?? entity.toNodeId;

        if (fromNodeId === toNodeId) {
            throw new BadRequestException('Self-loop заборонено');
        }

        if (dto.fromNodeId || dto.toNodeId) {
            await this.assertNoCycleAfterAdd(fromNodeId, toNodeId, entity.mapId!, id);
        }

        Object.assign(entity, dto);
        return this.repo.save(entity);
    }

    async remove(id: number): Promise<void> {
        await this.repo.delete(id);
    }

    private async assertNoCycleAfterAdd(
        fromNodeId: number,
        toNodeId: number,
        mapId: number,
        excludeEdgeId?: number,
    ): Promise<void> {
        const connections = await this.repo.find({ where: { mapId } });
        const nodes = await this.nodeRepo.find({ where: { mapId } });

        const edges = connections
            .filter((c) => c.id !== excludeEdgeId)
            .map((c) => ({ from: c.fromNodeId, to: c.toNodeId }));
        edges.push({ from: fromNodeId, to: toNodeId });

        const result = this.graphValidator.validate(
            nodes.map((n) => ({
                id: n.id,
                title: n.title,
                groupId: n.groupId ?? null,
            })),
            edges,
        );
        const blocking = result.errors.filter(
            (e) => !e.includes('цикл') && !e.includes('DAG'),
        );
        if (blocking.length > 0) {
            throw new BadRequestException(blocking);
        }
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
