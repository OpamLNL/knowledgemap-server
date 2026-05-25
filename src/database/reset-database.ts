import { AppDataSource } from '../data-source';

/** Таблиці у порядку залежностей (дочірні першими). */
const TABLES_TO_DROP = [
    'map_revisions',
    'group_connections',
    'node_connections',
    'user_topic_progress',
    'nodes',
    'topics',
    'knowledge_groups',
    'knowledge_maps',
    'users',
    'migrations',
];

async function resetDatabase() {
    try {
        console.log('⚠️  Скидання БД — усі таблиці будуть видалені\n');
        await AppDataSource.initialize();
        AppDataSource.setOptions({ logging: false });

        await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of TABLES_TO_DROP) {
            await AppDataSource.query(`DROP TABLE IF EXISTS \`${table}\``);
            console.log(`  🗑️  dropped: ${table}`);
        }

        await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('\n✅ Старі таблиці видалено\n');

        console.log('▶️ Запуск міграцій...');
        await AppDataSource.runMigrations();
        console.log('✅ Міграції виконано');

        await AppDataSource.destroy();

        console.log('\n▶️ Запуск seed...');
        const { execSync } = require('child_process');
        execSync('npx ts-node src/database/seed-all.ts', {
            stdio: 'inherit',
            cwd: process.cwd(),
        });

        console.log('\n🎉 db:reset завершено');
    } catch (e) {
        console.error('❌ db:reset failed:', e);
        process.exit(1);
    }
}

resetDatabase();
