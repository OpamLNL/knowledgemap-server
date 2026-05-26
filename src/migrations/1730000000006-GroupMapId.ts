import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupMapId1730000000006 implements MigrationInterface {
    name = 'GroupMapId1730000000006';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const groupCols = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_groups'
        `);
        const groupColNames = groupCols.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!groupColNames.includes('map_id')) {
            await queryRunner.query(`
                ALTER TABLE knowledge_groups
                ADD COLUMN map_id INT NULL,
                ADD INDEX idx_kg_map_id (map_id)
            `);
        }

        const connCols = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_connections'
        `);
        const connColNames = connCols.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);

        if (!connColNames.includes('map_id')) {
            await queryRunner.query(`
                ALTER TABLE group_connections
                ADD COLUMN map_id INT NULL,
                ADD INDEX idx_gc_map_id (map_id)
            `);
        }

        const defaultMaps = await queryRunner.query(`
            SELECT id FROM knowledge_maps
            WHERE status = 'published'
            ORDER BY id ASC
            LIMIT 1
        `);
        let defaultMapId: number | null = defaultMaps[0]?.id ?? null;
        if (defaultMapId == null) {
            const anyMap = await queryRunner.query(
                `SELECT id FROM knowledge_maps ORDER BY id ASC LIMIT 1`,
            );
            defaultMapId = anyMap[0]?.id ?? null;
        }

        const groups = await queryRunner.query(`SELECT id FROM knowledge_groups`);
        for (const row of groups as { id: string }[]) {
            const usage = await queryRunner.query(
                `SELECT map_id, COUNT(*) AS cnt FROM nodes
                 WHERE group_id = ? AND map_id IS NOT NULL
                 GROUP BY map_id ORDER BY cnt DESC LIMIT 1`,
                [row.id],
            );
            const mapId = usage[0]?.map_id ?? defaultMapId;
            if (mapId != null) {
                await queryRunner.query(
                    `UPDATE knowledge_groups SET map_id = ? WHERE id = ? AND map_id IS NULL`,
                    [mapId, row.id],
                );
            }
        }

        if (defaultMapId != null) {
            await queryRunner.query(
                `UPDATE knowledge_groups SET map_id = ? WHERE map_id IS NULL`,
                [defaultMapId],
            );
        }

        const connections = await queryRunner.query(
            `SELECT id, from_group_id FROM group_connections WHERE map_id IS NULL`,
        );
        for (const edge of connections as { id: number; from_group_id: string }[]) {
            const groupRows = await queryRunner.query(
                `SELECT map_id FROM knowledge_groups WHERE id = ? LIMIT 1`,
                [edge.from_group_id],
            );
            const mapId = groupRows[0]?.map_id ?? defaultMapId;
            if (mapId != null) {
                await queryRunner.query(
                    `UPDATE group_connections SET map_id = ? WHERE id = ?`,
                    [mapId, edge.id],
                );
            }
        }

        const fkRows = await queryRunner.query(`
            SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'knowledge_groups'
              AND CONSTRAINT_NAME = 'fk_kg_map'
        `);
        if (fkRows.length === 0) {
            await queryRunner.query(`
                ALTER TABLE knowledge_groups
                ADD CONSTRAINT fk_kg_map FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
            `);
        }

        const gcFkRows = await queryRunner.query(`
            SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'group_connections'
              AND CONSTRAINT_NAME = 'fk_gc_map'
        `);
        if (gcFkRows.length === 0) {
            await queryRunner.query(`
                ALTER TABLE group_connections
                ADD CONSTRAINT fk_gc_map FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
            `);
        }

        await queryRunner.query(`
            ALTER TABLE knowledge_groups MODIFY map_id INT NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE group_connections MODIFY map_id INT NOT NULL
        `);

        const indexRows = await queryRunner.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'group_connections'
              AND INDEX_NAME = 'uq_group_edge'
        `);
        if (indexRows.length > 0) {
            const fromIdx = await queryRunner.query(`
                SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'group_connections'
                  AND INDEX_NAME = 'idx_gc_from_group'
            `);
            if (fromIdx.length === 0) {
                await queryRunner.query(`
                    ALTER TABLE group_connections ADD INDEX idx_gc_from_group (from_group_id)
                `);
            }
            const toIdx = await queryRunner.query(`
                SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'group_connections'
                  AND INDEX_NAME = 'idx_gc_to_group'
            `);
            if (toIdx.length === 0) {
                await queryRunner.query(`
                    ALTER TABLE group_connections ADD INDEX idx_gc_to_group (to_group_id)
                `);
            }
            await queryRunner.query(`
                ALTER TABLE group_connections DROP INDEX uq_group_edge
            `);
        }

        const newIndexRows = await queryRunner.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'group_connections'
              AND INDEX_NAME = 'uq_group_edge_map'
        `);
        if (newIndexRows.length === 0) {
            await queryRunner.query(`
                ALTER TABLE group_connections
                ADD UNIQUE KEY uq_group_edge_map (map_id, from_group_id, to_group_id, type)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const newIndexRows = await queryRunner.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'group_connections'
              AND INDEX_NAME = 'uq_group_edge_map'
        `);
        if (newIndexRows.length > 0) {
            await queryRunner.query(`
                ALTER TABLE group_connections DROP INDEX uq_group_edge_map
            `);
        }

        await queryRunner.query(`
            ALTER TABLE group_connections
            ADD UNIQUE KEY uq_group_edge (from_group_id, to_group_id, type)
        `);

        await queryRunner.query(`
            ALTER TABLE group_connections DROP FOREIGN KEY fk_gc_map
        `);
        await queryRunner.query(`
            ALTER TABLE knowledge_groups DROP FOREIGN KEY fk_kg_map
        `);

        await queryRunner.query(`
            ALTER TABLE group_connections DROP COLUMN map_id
        `);
        await queryRunner.query(`
            ALTER TABLE knowledge_groups DROP COLUMN map_id
        `);
    }
}
