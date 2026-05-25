import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeGroupsSchema1730000000002 implements MigrationInterface {
    name = 'KnowledgeGroupsSchema1730000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS knowledge_groups (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                level INT NOT NULL DEFAULT 0,
                parent_id VARCHAR(64) NULL,
                sort_order INT NOT NULL DEFAULT 0,
                CONSTRAINT fk_group_parent FOREIGN KEY (parent_id) REFERENCES knowledge_groups(id) ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS group_connections (
                id INT PRIMARY KEY AUTO_INCREMENT,
                from_group_id VARCHAR(64) NOT NULL,
                to_group_id VARCHAR(64) NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'prerequisite',
                source VARCHAR(64) NULL,
                CONSTRAINT fk_gc_from FOREIGN KEY (from_group_id) REFERENCES knowledge_groups(id) ON DELETE CASCADE,
                CONSTRAINT fk_gc_to FOREIGN KEY (to_group_id) REFERENCES knowledge_groups(id) ON DELETE CASCADE,
                UNIQUE KEY uq_group_edge (from_group_id, to_group_id, type)
            )
        `);

        const topicColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topics'
        `);
        const topicColNames = topicColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!topicColNames.includes('group_id')) {
            await queryRunner.query(`
                ALTER TABLE topics
                ADD COLUMN group_id VARCHAR(64) NULL,
                ADD COLUMN order_in_group INT NOT NULL DEFAULT 0,
                ADD COLUMN global_order INT NULL,
                ADD CONSTRAINT fk_topic_group FOREIGN KEY (group_id) REFERENCES knowledge_groups(id) ON DELETE SET NULL
            `);
        }

        if (!topicColNames.includes('seed_topic_id')) {
            await queryRunner.query(`
                ALTER TABLE topics ADD COLUMN seed_topic_id INT NULL UNIQUE
            `);
        }

        const connColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_connections'
        `);
        const connColNames = connColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!connColNames.includes('from_group_id')) {
            await queryRunner.query(`
                ALTER TABLE node_connections
                ADD COLUMN from_group_id VARCHAR(64) NULL,
                ADD COLUMN to_group_id VARCHAR(64) NULL,
                ADD COLUMN is_cross_group TINYINT(1) NOT NULL DEFAULT 0
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const connColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_connections'
        `);
        const connColNames = connColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (connColNames.includes('from_group_id')) {
            await queryRunner.query(`
                ALTER TABLE node_connections
                DROP COLUMN from_group_id,
                DROP COLUMN to_group_id,
                DROP COLUMN is_cross_group
            `);
        }

        const topicColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topics'
        `);
        const topicColNames = topicColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (topicColNames.includes('group_id')) {
            await queryRunner.query(`ALTER TABLE topics DROP FOREIGN KEY fk_topic_group`);
            await queryRunner.query(`
                ALTER TABLE topics
                DROP COLUMN group_id,
                DROP COLUMN order_in_group,
                DROP COLUMN global_order
            `);
        }
        if (topicColNames.includes('seed_topic_id')) {
            await queryRunner.query(`ALTER TABLE topics DROP COLUMN seed_topic_id`);
        }

        await queryRunner.query(`DROP TABLE IF EXISTS group_connections`);
        await queryRunner.query(`DROP TABLE IF EXISTS knowledge_groups`);
    }
}
