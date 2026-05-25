import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from './entities/topic.entity';
import { CreateTopicDto } from './dtos/create-topic.dto';
import { UpdateTopicDto } from './dtos/update-topic.dto';
import { Node } from '../nodes/entities/node.entity';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';

export interface TopicCatalogMapRef {
    mapId: number;
    mapTitle: string;
    mapStatus: MapStatus;
    nodeId: number;
    nodeTitle: string;
}

export interface TopicCatalogItem {
    id: number;
    title: string;
    description: string;
    groupId: string | null;
    maps: TopicCatalogMapRef[];
    mapsCount: number;
}

export interface TopicCatalogResult {
    data: TopicCatalogItem[];
    total: number;
    page: number;
    limit: number;
    availableMaps: { id: number; title: string; status: MapStatus }[];
}

function rawString(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (value != null && value !== '') return String(value);
    }
    return '';
}

function rawNumber(row: Record<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
        const value = row[key];
        if (value != null && value !== '') return Number(value);
    }
    return NaN;
}

@Injectable()
export class TopicsService {
    constructor(
        @InjectRepository(Topic)
        private readonly topicRepository: Repository<Topic>,
        @InjectRepository(Node)
        private readonly nodeRepository: Repository<Node>,
    ) {}

    findAll() {
        return this.topicRepository.find();
    }

    async searchCatalog(params: {
        search?: string;
        mapId?: number;
        publishedOnly?: boolean;
        usedOnly?: boolean;
        sortBy?: 'title' | 'maps';
        page?: number;
        limit?: number;
    }): Promise<TopicCatalogResult> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 48;
        const publishedOnly = params.publishedOnly !== false;
        const usedOnly = params.usedOnly === true;
        const sortBy = params.sortBy ?? 'title';

        const linkQb = this.nodeRepository
            .createQueryBuilder('n')
            .innerJoin(KnowledgeMap, 'm', 'm.id = n.map_id')
            .where('n.topic_id IS NOT NULL');

        if (params.mapId) {
            linkQb.andWhere('n.map_id = :mapId', { mapId: params.mapId });
        }

        const linkRows = await linkQb
            .select([
                'n.id AS nodeId',
                'n.title AS nodeTitle',
                'n.topic_id AS topicId',
                'm.id AS mapId',
                'm.title AS mapTitle',
                'm.status AS mapStatus',
            ])
            .getRawMany<Record<string, unknown>>();

        const mapsByTopic = new Map<number, TopicCatalogMapRef[]>();
        const availableMapsMap = new Map<number, { id: number; title: string; status: MapStatus }>();

        for (const row of linkRows) {
            const topicId = rawNumber(row, 'topicId', 'topic_id', 'n_topic_id');
            const mapId = rawNumber(row, 'mapId', 'map_id', 'm_id');
            if (!Number.isFinite(topicId) || !Number.isFinite(mapId)) continue;

            const mapStatus = rawString(row, 'mapStatus', 'map_status', 'm_status') as MapStatus;
            const mapTitle = rawString(row, 'mapTitle', 'map_title', 'm_title');

            availableMapsMap.set(mapId, { id: mapId, title: mapTitle, status: mapStatus });

            if (publishedOnly && mapStatus !== MapStatus.PUBLISHED) {
                continue;
            }

            const ref: TopicCatalogMapRef = {
                mapId,
                mapTitle,
                mapStatus,
                nodeId: rawNumber(row, 'nodeId', 'node_id', 'n_id'),
                nodeTitle: rawString(row, 'nodeTitle', 'node_title', 'n_title'),
            };

            const list = mapsByTopic.get(topicId) ?? [];
            const duplicate = list.some((item) => item.mapId === mapId && item.nodeId === ref.nodeId);
            if (!duplicate) {
                list.push(ref);
                mapsByTopic.set(topicId, list);
            }
        }

        const availableMaps = [...availableMapsMap.values()]
            .filter((map) => !publishedOnly || map.status === MapStatus.PUBLISHED)
            .sort((a, b) => a.title.localeCompare(b.title, 'uk'));

        let matchingTopicIds: number[] | null = null;

        if (params.search) {
            const term = `%${params.search.trim()}%`;

            const topicsByText = await this.topicRepository
                .createQueryBuilder('t')
                .select('t.id', 'id')
                .where(
                    '(LOWER(t.title) LIKE LOWER(:term) OR LOWER(t.description) LIKE LOWER(:term))',
                    { term },
                )
                .getRawMany<{ id: number }>();

            const nodesByTitle = await this.nodeRepository
                .createQueryBuilder('n')
                .select('DISTINCT n.topic_id', 'topicId')
                .where('n.topic_id IS NOT NULL')
                .andWhere('LOWER(n.title) LIKE LOWER(:term)', { term })
                .getRawMany<Record<string, unknown>>();

            matchingTopicIds = [
                ...new Set([
                    ...topicsByText.map((row) => Number(row.id)),
                    ...nodesByTitle
                        .map((row) => rawNumber(row, 'topicId', 'topic_id', 'n_topic_id'))
                        .filter(Number.isFinite),
                ]),
            ];
        }

        if (matchingTopicIds && matchingTopicIds.length === 0) {
            return { data: [], total: 0, page, limit, availableMaps };
        }

        const topicQb = this.topicRepository.createQueryBuilder('t');

        if (matchingTopicIds) {
            topicQb.andWhere('t.id IN (:...matchingTopicIds)', { matchingTopicIds });
        }

        if (usedOnly) {
            const usedTopicIds = [...mapsByTopic.keys()];
            if (usedTopicIds.length === 0) {
                return { data: [], total: 0, page, limit, availableMaps };
            }
            topicQb.andWhere('t.id IN (:...usedTopicIds)', { usedTopicIds });
        }

        const allMatching = await topicQb.getMany();

        let enriched: TopicCatalogItem[] = allMatching.map((topic) => {
            const maps = mapsByTopic.get(topic.id) ?? [];
            return {
                id: topic.id,
                title: topic.title,
                description: topic.description,
                groupId: topic.groupId,
                maps,
                mapsCount: maps.length,
            };
        });

        if (usedOnly) {
            enriched = enriched.filter((item) => item.mapsCount > 0);
        }

        if (sortBy === 'maps') {
            enriched.sort((a, b) => {
                if (b.mapsCount !== a.mapsCount) return b.mapsCount - a.mapsCount;
                return a.title.localeCompare(b.title, 'uk');
            });
        } else {
            enriched.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
        }

        const total = enriched.length;
        const skip = (page - 1) * limit;
        const data = enriched.slice(skip, skip + limit);

        return { data, total, page, limit, availableMaps };
    }

    async findOne(id: number) {
        const topic = await this.topicRepository.findOneBy({ id });
        if (!topic) throw new NotFoundException('Topic not found');
        return topic;
    }

    async create(dto: CreateTopicDto) {
        if (dto.groupId) {
            return this.createForGroup(dto.title, dto.groupId, dto.description);
        }
        const topic = this.topicRepository.create({
            title: dto.title,
            description: dto.description,
        });
        return this.topicRepository.save(topic);
    }

    async createForGroup(title: string, groupId: string, description?: string) {
        const trimmedTitle = title.trim() || 'Новий вузол';
        const trimmedDescription = (description ?? trimmedTitle).trim() || trimmedTitle;

        const maxOrder = await this.topicRepository
            .createQueryBuilder('t')
            .select('MAX(t.order_in_group)', 'maxOrder')
            .where('t.group_id = :groupId', { groupId })
            .getRawOne<{ maxOrder: string | null }>();

        const maxGlobal = await this.topicRepository
            .createQueryBuilder('t')
            .select('MAX(t.global_order)', 'maxGlobal')
            .getRawOne<{ maxGlobal: string | null }>();

        const topic = this.topicRepository.create({
            title: trimmedTitle,
            description: trimmedDescription,
            groupId,
            orderInGroup: (Number(maxOrder?.maxOrder) || 0) + 1,
            globalOrder: (Number(maxGlobal?.maxGlobal) || 0) + 1,
        });
        return this.topicRepository.save(topic);
    }

    async update(id: number, dto: UpdateTopicDto) {
        await this.findOne(id);
        await this.topicRepository.update(id, dto);
        return this.findOne(id);
    }

    async remove(id: number) {
        await this.findOne(id);
        await this.topicRepository.delete(id);
        return { deleted: true };
    }
}
