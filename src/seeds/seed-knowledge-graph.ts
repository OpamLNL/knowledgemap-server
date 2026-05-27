import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../data-source';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { GraphEditMap, MapStatus } from '../graph-edit-maps/entities/graph-edit-map.entity';

const SEEDS_DIR = path.join(__dirname, '../seeds');
const BATCH_SIZE = 150;

function readJson<T>(filename: string): T {
    const filePath = path.join(SEEDS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Seed file not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

async function insertInBatches<T extends object>(
    rows: T[],
    insertFn: (batch: T[]) => Promise<unknown>,
): Promise<number> {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await insertFn(rows.slice(i, i + BATCH_SIZE));
    }
    return rows.length;
}

export async function seedKnowledgeGroups(mapId: number): Promise<number> {
    const data = readJson<
        {
            id: string;
            title: string;
            description: string;
            level: number;
            parentId: string | null;
            order: number;
        }[]
    >('knowledge_groups_seed.json');

    const repo = AppDataSource.getRepository(KnowledgeGroup);
    const existing = await repo.count({ where: { mapId } });
    if (existing > 0) {
        console.log(`📂 Knowledge groups: пропуск (${existing} вже на карті ${mapId})`);
        return existing;
    }

    await repo.insert(
        data.map((g) => ({
            id: g.id,
            mapId,
            title: g.title,
            description: g.description,
            level: g.level,
            parentId: g.parentId,
            sortOrder: g.order,
        })),
    );

    console.log(`📂 Knowledge groups: ${data.length} записів для карти ${mapId}`);
    return data.length;
}

export async function seedGroupConnections(mapId: number): Promise<number> {
    const data = readJson<
        {
            fromGroupId: string;
            toGroupId: string;
            type: string;
            source: string;
        }[]
    >('group_connections_seed.json');

    const repo = AppDataSource.getRepository(GroupConnection);
    const existing = await repo.count({ where: { mapId } });
    if (existing > 0) {
        console.log(`🔗 Group connections: пропуск (${existing} вже на карті ${mapId})`);
        return existing;
    }

    await repo.insert(
        data.map((edge) => ({
            mapId,
            fromGroupId: edge.fromGroupId,
            toGroupId: edge.toGroupId,
            type: edge.type,
            source: edge.source,
        })),
    );

    console.log(`🔗 Group connections: ${data.length} записів для карти ${mapId}`);
    return data.length;
}

export async function seedTopicsWithGroups(): Promise<Map<number, Topic>> {
    const data = readJson<
        {
            id: number;
            title: string;
            description: string;
            groupId: string;
            orderInGroup: number;
            globalOrder: number;
        }[]
    >('topics_with_groups_seed.json');

    const repo = AppDataSource.getRepository(Topic);
    const existing = await repo.count();

    if (existing === 0) {
        await insertInBatches(data, (batch) =>
            repo.insert(
                batch.map((t) => ({
                    seedTopicId: t.id,
                    title: t.title,
                    description: t.description,
                    groupId: t.groupId,
                    orderInGroup: t.orderInGroup,
                    globalOrder: t.globalOrder,
                })),
            ),
        );
        console.log(`📚 Topics: ${data.length} записів (bulk)`);
    } else {
        console.log(`📚 Topics: пропуск insert (${existing} вже в БД)`);
    }

    const allTopics = await repo.find();
    const bySeedId = new Map<number, Topic>();
    for (const topic of allTopics) {
        if (topic.seedTopicId != null) bySeedId.set(topic.seedTopicId, topic);
    }
    return bySeedId;
}

export async function ensurePublishedMap(): Promise<GraphEditMap> {
    const mapRepo = AppDataSource.getRepository(GraphEditMap);
    let map = await mapRepo.findOne({ where: { status: MapStatus.PUBLISHED }, order: { id: 'ASC' } });

    if (!map) {
        map = await mapRepo.save(
            mapRepo.create({
                title: 'Карта знань з програмування',
                description: 'Карта знань на базі груп тем і prerequisite-звʼязків',
                status: MapStatus.PUBLISHED,
                publishedAt: new Date(),
            }),
        );
        console.log(`🗺️ Створено карту знань id=${map.id}`);
    } else {
        console.log(`🗺️ Використовуємо карту id=${map.id}`);
    }

    return map;
}

export async function seedNodesForMap(
    map: GraphEditMap,
    topicsBySeedId: Map<number, Topic>,
): Promise<Map<number, Node>> {
    const nodeRepo = AppDataSource.getRepository(Node);
    const existing = await nodeRepo.count({ where: { mapId: map.id } });

    if (existing === 0) {
        const topics = [...topicsBySeedId.values()];
        await insertInBatches(topics, (batch) =>
            nodeRepo.insert(
                batch.map((topic) => ({
                    title: topic.title,
                    topicId: topic.id,
                    mapId: map.id,
                })),
            ),
        );
        console.log(`🔵 Nodes: ${topics.length} записів для карти ${map.id} (bulk)`);
    } else {
        console.log(`🔵 Nodes: пропуск insert (${existing} вже на карті ${map.id})`);
    }

    const allNodes = await nodeRepo.find({ where: { mapId: map.id } });
    const nodeByTopicId = new Map<number, Node>();
    for (const node of allNodes) {
        if (node.topicId != null) nodeByTopicId.set(node.topicId, node);
    }
    return nodeByTopicId;
}

export async function seedNodeConnectionsFromCleanSeed(
    map: GraphEditMap,
    topicsBySeedId: Map<number, Topic>,
): Promise<number> {
    const data = readJson<
        {
            fromTopicId: number;
            toTopicId: number;
            type: string;
            fromGroupId: string;
            toGroupId: string;
            isCrossGroup: boolean;
        }[]
    >('node_connections_clean_seed.json');

    const connectionRepo = AppDataSource.getRepository(NodeConnection);
    const nodeRepo = AppDataSource.getRepository(Node);

    const existing = await connectionRepo.count({ where: { mapId: map.id } });
    if (existing > 0) {
        console.log(`🔗 Node connections: пропуск (${existing} вже на карті ${map.id})`);
        return existing;
    }

    const nodeByTopicId = new Map<number, Node>();
    const allNodes = await nodeRepo.find({ where: { mapId: map.id } });
    for (const n of allNodes) {
        if (n.topicId != null) nodeByTopicId.set(n.topicId, n);
    }

    const rows: {
        fromNodeId: number;
        toNodeId: number;
        mapId: number;
        type: string;
        fromGroupId: string;
        toGroupId: string;
        isCrossGroup: boolean;
    }[] = [];

    let skipped = 0;
    for (const edge of data) {
        const fromTopic = topicsBySeedId.get(edge.fromTopicId);
        const toTopic = topicsBySeedId.get(edge.toTopicId);
        if (!fromTopic || !toTopic) {
            skipped++;
            continue;
        }

        const fromNode = nodeByTopicId.get(fromTopic.id);
        const toNode = nodeByTopicId.get(toTopic.id);
        if (!fromNode || !toNode) {
            skipped++;
            continue;
        }

        rows.push({
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            mapId: map.id,
            type: edge.type,
            fromGroupId: edge.fromGroupId,
            toGroupId: edge.toGroupId,
            isCrossGroup: edge.isCrossGroup,
        });
    }

    await insertInBatches(rows, (batch) => connectionRepo.insert(batch));

    console.log(
        `🔗 Node connections: ${rows.length} записів (JSON: ${data.length}, пропущено: ${skipped})`,
    );
    return rows.length;
}
