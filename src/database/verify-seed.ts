import { AppDataSource } from '../data-source';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { KnowledgeMap } from '../knowledge-maps/entities/knowledge-map.entity';
import { IsNull, Not } from 'typeorm';

async function verify() {
    await AppDataSource.initialize();

    const groups = await AppDataSource.getRepository(KnowledgeGroup).count();
    const groupEdges = await AppDataSource.getRepository(GroupConnection).count();
    const topics = await AppDataSource.getRepository(Topic).count();
    const topicsWithSeed = await AppDataSource.getRepository(Topic).count({
        where: { seedTopicId: Not(IsNull()) },
    });
    const nodes = await AppDataSource.getRepository(Node).count();
    const edges = await AppDataSource.getRepository(NodeConnection).count();
    const maps = await AppDataSource.getRepository(KnowledgeMap).find();

    const published = maps.find((m) => m.status === 'published') ?? maps[0];
    const mapId = published?.id ?? 1;

    const nodesOnMap = await AppDataSource.getRepository(Node).count({ where: { mapId } });
    const edgesOnMap = await AppDataSource.getRepository(NodeConnection).count({ where: { mapId } });
    const orphanNodes = await AppDataSource.getRepository(Node).count({ where: { mapId: IsNull() } });

    console.log('\n=== Перевірка БД ===');
    console.log(`Knowledge groups:  ${groups}`);
    console.log(`Group edges:     ${groupEdges}`);
    console.log(`Topics:            ${topics} (з seed_topic_id: ${topicsWithSeed})`);
    console.log(`Nodes (всього):    ${nodes}`);
    console.log(`Edges (всього):    ${edges}`);
    console.log(`Nodes на map #${mapId}:   ${nodesOnMap}`);
    console.log(`Edges на map #${mapId}:   ${edgesOnMap}`);
    console.log(`Nodes без map_id:  ${orphanNodes}`);
    console.log('\nКарти знань:');
    for (const m of maps) {
        console.log(`  #${m.id} "${m.title}" — status: ${m.status}`);
    }

    const sampleTopic = await AppDataSource.getRepository(Topic).findOne({
        where: {},
        order: { globalOrder: 'ASC' },
    });
    if (sampleTopic) {
        console.log(
            `\nПриклад topic: id=${sampleTopic.id}, seed=${sampleTopic.seedTopicId}, group=${sampleTopic.groupId}, order=${sampleTopic.globalOrder}`,
        );
    }

    await AppDataSource.destroy();
    process.exit(0);
}

verify().catch((e) => {
    console.error('❌ Verify failed:', e);
    process.exit(1);
});
