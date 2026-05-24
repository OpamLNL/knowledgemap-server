import { AppDataSource } from '../data-source';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import { seedNodeConnections } from '../seeds/seed-node-connections';
import * as fs from 'fs';
import * as path from 'path';

async function seedAll() {
    await AppDataSource.initialize();
    console.log('✅ DataSource initialized');

    const topicRepo = AppDataSource.getRepository(Topic);
    const nodeRepo = AppDataSource.getRepository(Node);
    const mapRepo = AppDataSource.getRepository(KnowledgeMap);

    const filePath = path.join(__dirname, '../seeds/topics.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const topicData = JSON.parse(raw) as { title: string; description: string }[];

    let createdTopics = 0;
    for (const data of topicData) {
        const exists = await topicRepo.findOneBy({ title: data.title });
        if (!exists) {
            await topicRepo.save(topicRepo.create(data));
            createdTopics++;
        }
    }
    console.log(`📚 Topics: +${createdTopics} нових (всього в JSON: ${topicData.length})`);

    let map = await mapRepo.findOne({ where: { status: MapStatus.PUBLISHED }, order: { id: 'ASC' } });
    if (!map) {
        map = await mapRepo.save(
            mapRepo.create({
                title: 'Карта знань з програмування',
                description: 'Початкова карта знань для курсу програмування',
                status: MapStatus.PUBLISHED,
                publishedAt: new Date(),
            }),
        );
        console.log(`🗺️ Створено карту знань id=${map.id}`);
    } else {
        console.log(`🗺️ Використовуємо існуючу карту id=${map.id}`);
    }

    const allTopics = await topicRepo.find();
    let createdNodes = 0;
    for (const topic of allTopics) {
        const existingNode = await nodeRepo.findOne({
            where: { topicId: topic.id, mapId: map.id },
        });
        if (!existingNode) {
            const withoutMap = await nodeRepo.findOne({ where: { topicId: topic.id } });
            if (withoutMap && !withoutMap.mapId) {
                withoutMap.mapId = map.id;
                withoutMap.title = withoutMap.title || topic.title;
                await nodeRepo.save(withoutMap);
            } else if (!withoutMap) {
                await nodeRepo.save(
                    nodeRepo.create({
                        title: topic.title,
                        topicId: topic.id,
                        mapId: map.id,
                    }),
                );
                createdNodes++;
            }
        }
    }
    console.log(`🔵 Nodes: +${createdNodes} нових для карти ${map.id}`);

    await seedNodeConnections();

    const connectionRepo = AppDataSource.getRepository(NodeConnection);
    const orphanConnections = await connectionRepo
        .createQueryBuilder('c')
        .where('c.map_id IS NULL')
        .getMany();
    if (orphanConnections.length > 0) {
        for (const conn of orphanConnections) {
            conn.mapId = map.id;
        }
        await connectionRepo.save(orphanConnections);
        console.log(`🔗 Прив'язано ${orphanConnections.length} зв'язків до карти ${map.id}`);
    }

    const nodeCount = await nodeRepo.count({ where: { mapId: map.id } });
    const edgeCount = await connectionRepo.count({ where: { mapId: map.id } });
    console.log(`\n🎉 Seed завершено: карта #${map.id} — ${nodeCount} вузлів, ${edgeCount} ребер`);
    await AppDataSource.destroy();
    process.exit(0);
}

seedAll().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
