/**
 * @deprecated Використовуйте `yarn db:init` (TypeORM migrations + seed-all.ts).
 * Legacy-скрипт залишено для довідки; не підтримує нову схему груп знань.
 */
import { AppDataSource } from '../data-source';

async function initDbLegacy() {
    console.error(
        'init-db.ts застарів. Запустіть: yarn migration:run && yarn db:seed\n' +
            'Або повний цикл: yarn db:init',
    );
    await AppDataSource.destroy().catch(() => undefined);
    process.exit(1);
}

initDbLegacy();
