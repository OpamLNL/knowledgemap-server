import { MigrationInterface, QueryRunner } from 'typeorm';

export class MapGroupLayout1730000000003 implements MigrationInterface {
    name = 'MapGroupLayout1730000000003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_maps'
        `);
        const names = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (!names.includes('group_layout_json')) {
            await queryRunner.query(`
                ALTER TABLE knowledge_maps
                ADD COLUMN group_layout_json JSON NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_maps'
        `);
        const names = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (names.includes('group_layout_json')) {
            await queryRunner.query(`
                ALTER TABLE knowledge_maps DROP COLUMN group_layout_json
            `);
        }
    }
}
