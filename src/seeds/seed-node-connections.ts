import { AppDataSource } from '../data-source';
import {
    seedKnowledgeGroups,
    seedGroupConnections,
    seedTopicsWithGroups,
    ensurePublishedMap,
    seedNodesForMap,
    seedNodeConnectionsFromCleanSeed,
} from './seed-knowledge-graph';

/** @deprecated Використовуйте seed-all.ts через yarn db:seed */
export async function seedNodeConnections() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const topicsBySeedId = await seedTopicsWithGroups();
    const map = await ensurePublishedMap();
    await seedNodesForMap(map, topicsBySeedId);
    await seedNodeConnectionsFromCleanSeed(map, topicsBySeedId);
}

if (require.main === module) {
    (async () => {
        await AppDataSource.initialize();
        await seedKnowledgeGroups();
        await seedGroupConnections();
        await seedNodeConnections();
        await AppDataSource.destroy();
    })().catch(console.error);
}

