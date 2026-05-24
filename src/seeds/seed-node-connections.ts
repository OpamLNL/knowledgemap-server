import { AppDataSource } from '../data-source';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import * as fs from 'fs';
import * as path from 'path';

function normalize(title: string): string {
    return title.trim().toLowerCase().replace(/['']/g, "'");
}

export async function seedNodeConnections() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }

    const connectionRepo = AppDataSource.getRepository(NodeConnection);
    const nodeRepo = AppDataSource.getRepository(Node);
    const mapRepo = AppDataSource.getRepository(KnowledgeMap);

    let map = await mapRepo.findOne({ where: { status: MapStatus.PUBLISHED }, order: { id: 'ASC' } });
    if (!map) {
        map = await mapRepo.findOne({ order: { id: 'ASC' } });
    }
    const mapId = map?.id ?? null;

    const filePath = path.join(__dirname, './node_connections_seed.json');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ node_connections_seed.json не знайдено — пропускаємо seed зв\'язків');
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const connections = JSON.parse(raw) as { from: string; to: string }[];

    const allNodes = await nodeRepo.find();
    const nodeMap = new Map(allNodes.map((node) => [normalize(node.title), node]));

    let createdNodes = 0;
    let createdConnections = 0;

    for (const { from, to } of connections) {
        let fromNode = nodeMap.get(normalize(from));
        let toNode = nodeMap.get(normalize(to));

        if (!fromNode) {
            fromNode = nodeRepo.create({ title: from, mapId });
            await nodeRepo.save(fromNode);
            nodeMap.set(normalize(from), fromNode);
            createdNodes++;
        }

        if (!toNode) {
            toNode = nodeRepo.create({ title: to, mapId });
            await nodeRepo.save(toNode);
            nodeMap.set(normalize(to), toNode);
            createdNodes++;
        }

        const exists = await connectionRepo.findOneBy({
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
        });

        if (!exists) {
            const conn = connectionRepo.create({
                fromNodeId: fromNode.id,
                toNodeId: toNode.id,
                mapId,
                type: 'prerequisite',
            });
            await connectionRepo.save(conn);
            createdConnections++;
        } else if (mapId && !exists.mapId) {
            exists.mapId = mapId;
            await connectionRepo.save(exists);
        }
    }

    console.log(`📌 Додано нових вузлів: ${createdNodes}`);
    console.log(`🔗 Створено зв'язків: ${createdConnections}`);
}
