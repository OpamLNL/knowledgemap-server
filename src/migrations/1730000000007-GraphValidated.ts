import { MigrationInterface, QueryRunner } from 'typeorm';

export class GraphValidated1730000000007 implements MigrationInterface {
    name = 'GraphValidated1730000000007';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_maps'
        `);
        const colNames = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (!colNames.includes('graph_validated')) {
            await queryRunner.query(`
                ALTER TABLE knowledge_maps
                ADD COLUMN graph_validated TINYINT(1) NULL DEFAULT NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_maps'
        `);
        const colNames = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (colNames.includes('graph_validated')) {
            await queryRunner.query(`
                ALTER TABLE knowledge_maps DROP COLUMN graph_validated
            `);
        }
    }
}
