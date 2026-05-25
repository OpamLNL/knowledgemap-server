import { MigrationInterface, QueryRunner } from 'typeorm';

export class NodeContent1730000000005 implements MigrationInterface {
    name = 'NodeContent1730000000005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const nodeColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nodes'
        `);
        const nodeColNames = nodeColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (!nodeColNames.includes('theory_md')) {
            await queryRunner.query(`
                ALTER TABLE nodes
                ADD COLUMN theory_md TEXT NULL
            `);
        }

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS node_media (
                id INT PRIMARY KEY AUTO_INCREMENT,
                node_id INT NOT NULL,
                url VARCHAR(512) NOT NULL,
                caption VARCHAR(255) NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_node_media_node
                    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS node_media`);

        const nodeColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nodes'
        `);
        const nodeColNames = nodeColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (nodeColNames.includes('theory_md')) {
            await queryRunner.query(`ALTER TABLE nodes DROP COLUMN theory_md`);
        }
    }
}
