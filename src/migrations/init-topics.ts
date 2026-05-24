import { AppDataSource } from '../data-source';
import { CreateTopicsTable } from '../migrations/create-topics-table';
import { CreateNodesTable } from '../migrations/create-nodes-table';
import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import * as fs from 'fs';
import * as path from 'path';

async function initTopics() {
    try {
        await AppDataSource.initialize();

        await CreateTopicsTable();
        await CreateNodesTable();

        const topicRepo = AppDataSource.getRepository(Topic);
        const nodeRepo = AppDataSource.getRepository(Node);

        const filePath = path.join(__dirname, '../seeds/topics.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const topicData = JSON.parse(raw);

        let createdTopics = 0;
        let createdNodes = 0;

        for (const data of topicData) {
            const exists = await topicRepo.findOneBy({ title: data.title });
            if (!exists) {
                const topic = topicRepo.create(data);
                await topicRepo.save(topic);
                createdTopics++;
            }
        }

        const allTopics = await topicRepo.find();
        for (const topic of allTopics) {
            const existingNode = await nodeRepo.findOne({ where: { topicId: topic.id } });
            if (!existingNode) {
                const node = nodeRepo.create({
                    title: topic.title,
                    topicId: topic.id,
                });
                await nodeRepo.save(node);
                createdNodes++;
            }
        }

        console.log(`✅ Topics created: ${createdTopics}`);
        console.log(`✅ Nodes created: ${createdNodes}`);
        console.log('🎉 Topics and nodes initialized');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error initializing topics:', err);
        process.exit(1);
    }
}

initTopics();
