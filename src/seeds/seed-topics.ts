import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Topic } from '../topics/entities/topic.entity';
import * as fs from 'fs';
import * as path from 'path';

async function seedTopics() {
    await AppDataSource.initialize();

    const repo = AppDataSource.getRepository(Topic);

    const filePath = path.join(__dirname, 'topics.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const topics = JSON.parse(rawData);

    for (const data of topics) {
        const exists = await repo.findOneBy({ title: data.title });
        if (!exists) {
            await repo.save(repo.create(data));
        }
    }

    console.log('✅ Topics seeded');
    process.exit(0);
}

seedTopics().catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
});
