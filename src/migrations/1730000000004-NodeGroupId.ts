import { MigrationInterface, QueryRunner } from 'typeorm';

export class NodeGroupId1730000000004 implements MigrationInterface {
    name = 'NodeGroupId1730000000004';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nodes'
        `);
        const names = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (!names.includes('group_id')) {
            await queryRunner.query(`
                ALTER TABLE nodes
                ADD COLUMN group_id VARCHAR(64) NULL
            `);
        }

        await queryRunner.query(`
            UPDATE nodes n
            INNER JOIN topics t ON n.topic_id = t.id
            SET n.group_id = t.group_id
            WHERE n.group_id IS NULL AND t.group_id IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const columns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nodes'
        `);
        const names = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (names.includes('group_id')) {
            await queryRunner.query(`
                ALTER TABLE nodes DROP COLUMN group_id
            `);
        }
    }
}
