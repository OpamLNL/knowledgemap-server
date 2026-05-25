import { AppDataSource } from '../data-source';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import {
    seedKnowledgeGroups,
    seedGroupConnections,
    seedTopicsWithGroups,
    ensurePublishedMap,
    seedNodesForMap,
    seedNodeConnectionsFromCleanSeed,
} from '../seeds/seed-knowledge-graph';

async function seedAll() {
    await AppDataSource.initialize();
    AppDataSource.setOptions({ logging: false });
    console.log('✅ DataSource initialized\n');

    await seedKnowledgeGroups();
    await seedGroupConnections();
    const topicsBySeedId = await seedTopicsWithGroups();
    const map = await ensurePublishedMap();
    await seedNodesForMap(map, topicsBySeedId);
    await seedNodeConnectionsFromCleanSeed(map, topicsBySeedId);

    const nodeRepo = AppDataSource.getRepository(Node);
    const connectionRepo = AppDataSource.getRepository(NodeConnection);
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
