import { AppDataSource } from '../data-source';

async function initDatabase() {
    try {
        console.log('▶️ Запуск міграцій...');
        await AppDataSource.initialize();
        await AppDataSource.runMigrations();
        console.log('✅ Міграції виконано');
        await AppDataSource.destroy();

        console.log('\n▶️ Запуск seed...');
        const { execSync } = require('child_process');
        execSync('npx ts-node src/database/seed-all.ts', {
            stdio: 'inherit',
            cwd: process.cwd(),
        });
    } catch (e) {
        console.error('❌ init-database failed:', e);
        process.exit(1);
    }
}

initDatabase();
