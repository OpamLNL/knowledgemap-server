import { AppDataSource } from '../data-source';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { KnowledgeMap } from '../knowledge-maps/entities/knowledge-map.entity';
import { IsNull } from 'typeorm';

async function verify() {
    await AppDataSource.initialize();

    const topics = await AppDataSource.getRepository(Topic).count();
    const nodes = await AppDataSource.getRepository(Node).count();
    const edges = await AppDataSource.getRepository(NodeConnection).count();
    const maps = await AppDataSource.getRepository(KnowledgeMap).find();

    const nodesOnMap1 = await AppDataSource.getRepository(Node).count({ where: { mapId: 1 } });
    const edgesOnMap1 = await AppDataSource.getRepository(NodeConnection).count({ where: { mapId: 1 } });
    const orphanNodes = await AppDataSource.getRepository(Node).count({ where: { mapId: IsNull() } });

    console.log('\n=== Перевірка БД ===');
    console.log(`Topics:            ${topics}`);
    console.log(`Nodes (всього):    ${nodes}`);
    console.log(`Edges (всього):    ${edges}`);
    console.log(`Nodes на map #1:   ${nodesOnMap1}`);
    console.log(`Edges на map #1:   ${edgesOnMap1}`);
    console.log(`Nodes без map_id:  ${orphanNodes}`);
    console.log('\nКарти знань:');
    for (const m of maps) {
        console.log(`  #${m.id} "${m.title}" — status: ${m.status}`);
    }

    const sampleNode = await AppDataSource.getRepository(Node).findOne({ where: { mapId: 1 }, order: { id: 'ASC' } });
    const sampleEdge = await AppDataSource.getRepository(NodeConnection).findOne({ where: { mapId: 1 }, order: { id: 'ASC' } });
    if (sampleNode) console.log(`\nПриклад node: id=${sampleNode.id}, title="${sampleNode.title}", topicId=${sampleNode.topicId}`);
    if (sampleEdge) console.log(`Приклад edge: ${sampleEdge.fromNodeId} → ${sampleEdge.toNodeId} (${sampleEdge.type})`);

    await AppDataSource.destroy();
    process.exit(0);
}

verify().catch((e) => {
    console.error('❌ Verify failed:', e);
    process.exit(1);
});
