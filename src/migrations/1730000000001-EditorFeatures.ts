import { MigrationInterface, QueryRunner } from 'typeorm';

export class EditorFeatures1730000000001 implements MigrationInterface {
    name = 'EditorFeatures1730000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS knowledge_maps (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                owner_uid VARCHAR(128) NULL,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                published_at TIMESTAMP NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS map_revisions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                map_id INT NOT NULL,
                snapshot_json JSON NOT NULL,
                comment VARCHAR(500) NULL,
                created_by_uid VARCHAR(128) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_revision_map FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
            )
        `);

        const nodeColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nodes'
        `);
        const nodeColNames = nodeColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!nodeColNames.includes('map_id')) {
            await queryRunner.query(`
                ALTER TABLE nodes ADD COLUMN map_id INT NULL,
                ADD CONSTRAINT fk_node_map FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
            `);
        }

        if (!nodeColNames.includes('created_at')) {
            await queryRunner.query(`
                ALTER TABLE nodes
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            `);
        }

        const connColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_connections'
        `);
        const connColNames = connColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!connColNames.includes('map_id')) {
            await queryRunner.query(`
                ALTER TABLE node_connections ADD COLUMN map_id INT NULL,
                ADD CONSTRAINT fk_connection_map FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
            `);
        }

        if (!connColNames.includes('created_at')) {
            await queryRunner.query(`
                ALTER TABLE node_connections
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            `);
        }

        const existingMaps = await queryRunner.query(`SELECT id FROM knowledge_maps LIMIT 1`);
        if (existingMaps.length === 0) {
            await queryRunner.query(`
                INSERT INTO knowledge_maps (title, description, status, published_at)
                VALUES ('Карта знань з програмування', 'Початкова карта знань', 'published', NOW())
            `);
        }

        const defaultMap = await queryRunner.query(`SELECT id FROM knowledge_maps ORDER BY id ASC LIMIT 1`);
        const defaultMapId = defaultMap[0]?.id ?? 1;

        await queryRunner.query(`
            UPDATE nodes SET map_id = ${defaultMapId} WHERE map_id IS NULL
        `);
        await queryRunner.query(`
            UPDATE node_connections SET map_id = ${defaultMapId} WHERE map_id IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE node_connections DROP FOREIGN KEY fk_connection_map`);
        await queryRunner.query(`ALTER TABLE node_connections DROP COLUMN map_id`);
        await queryRunner.query(`ALTER TABLE node_connections DROP COLUMN created_at`);
        await queryRunner.query(`ALTER TABLE node_connections DROP COLUMN updated_at`);

        await queryRunner.query(`ALTER TABLE nodes DROP FOREIGN KEY fk_node_map`);
        await queryRunner.query(`ALTER TABLE nodes DROP COLUMN map_id`);
        await queryRunner.query(`ALTER TABLE nodes DROP COLUMN created_at`);
        await queryRunner.query(`ALTER TABLE nodes DROP COLUMN updated_at`);

        await queryRunner.query(`DROP TABLE IF EXISTS map_revisions`);
        await queryRunner.query(`DROP TABLE IF EXISTS knowledge_maps`);
    }
}
