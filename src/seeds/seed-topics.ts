/**
 * @deprecated Використовуйте yarn db:seed (seed-all.ts + topics_with_groups_seed.json)
 */
import { AppDataSource } from '../data-source';
import { seedTopicsWithGroups } from './seed-knowledge-graph';

async function seedTopics() {
    await AppDataSource.initialize();
    await seedTopicsWithGroups();
    console.log('✅ Topics seeded (topics_with_groups_seed.json)');
    await AppDataSource.destroy();
    process.exit(0);
}

seedTopics().catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
});
