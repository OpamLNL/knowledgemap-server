import { AppDataSource } from '../data-source';
import { seedNodeConnections } from '../seeds/seed-node-connections';
import { CreateTopicsTable } from '../migrations/create-topics-table';
import { CreateNodesTable } from '../migrations/create-nodes-table';
import { CreateNodeConnectionsTable } from '../migrations/create-node-connections-table';
import { CreateUsersTable } from '../migrations/create-users-table';
import { CreateUserTopicProgressTable } from '../migrations/create-user-topic-progress-table';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { KnowledgeMap, MapStatus } from '../knowledge-maps/entities/knowledge-map.entity';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Legacy init script — для нових інсталяцій використовуйте:
 *   yarn db:init   (міграції + seed)
 */
async function initDb() {
    try {
        await AppDataSource.initialize();

        await CreateTopicsTable();
        await CreateNodesTable();
        await CreateNodeConnectionsTable();
        await CreateUsersTable();
        await CreateUserTopicProgressTable();

        const migrationRunner = AppDataSource.createQueryRunner();
        await migrationRunner.connect();

        const { EditorFeatures1730000000001 } = await import('../migrations/1730000000001-EditorFeatures');
        const editorMigration = new EditorFeatures1730000000001();
        await editorMigration.up(migrationRunner);
        await migrationRunner.release();

        const topicRepo = AppDataSource.getRepository(Topic);
        const nodeRepo = AppDataSource.getRepository(Node);
        const mapRepo = AppDataSource.getRepository(KnowledgeMap);

        const filePath = path.join(__dirname, '../seeds/topics.json');
        const topicData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        for (const data of topicData) {
            const exists = await topicRepo.findOneBy({ title: data.title });
            if (!exists) await topicRepo.save(topicRepo.create(data));
        }

        let map = await mapRepo.findOne({ order: { id: 'ASC' } });
        if (!map) {
            map = await mapRepo.save(
                mapRepo.create({
                    title: 'Карта знань з програмування',
                    description: 'Початкова карта знань',
                    status: MapStatus.PUBLISHED,
                    publishedAt: new Date(),
                }),
            );
        }

        const allTopics = await topicRepo.find();
        for (const topic of allTopics) {
            const existing = await nodeRepo.findOne({ where: { topicId: topic.id, mapId: map.id } });
            if (!existing) {
                await nodeRepo.save(
                    nodeRepo.create({ title: topic.title, topicId: topic.id, mapId: map.id }),
                );
            }
        }

        await seedNodeConnections();

        console.log('🎉 База ініціалізована успішно');
        await AppDataSource.destroy();
        process.exit(0);
    } catch (e) {
        console.error('❌ Помилка при ініціалізації бази:', e);
        process.exit(1);
    }
}

initDb();
