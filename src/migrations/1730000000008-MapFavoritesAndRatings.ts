import { MigrationInterface, QueryRunner } from 'typeorm';

export class MapFavoritesAndRatings1730000000008 implements MigrationInterface {
    name = 'MapFavoritesAndRatings1730000000008';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = await queryRunner.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        const tableNames = tables.map((t: { TABLE_NAME: string }) => t.TABLE_NAME);

        if (!tableNames.includes('user_map_favorites')) {
            await queryRunner.query(`
                CREATE TABLE user_map_favorites (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_uid VARCHAR(128) NOT NULL,
                    map_id INT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_map_favorite (user_uid, map_id),
                    KEY idx_user_map_favorites_map (map_id),
                    CONSTRAINT fk_user_map_favorites_map
                        FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }

        if (!tableNames.includes('user_map_ratings')) {
            await queryRunner.query(`
                CREATE TABLE user_map_ratings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_uid VARCHAR(128) NOT NULL,
                    map_id INT NOT NULL,
                    rating TINYINT NOT NULL,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_map_rating (user_uid, map_id),
                    KEY idx_user_map_ratings_map (map_id),
                    CONSTRAINT fk_user_map_ratings_map
                        FOREIGN KEY (map_id) REFERENCES knowledge_maps(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = await queryRunner.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        const tableNames = tables.map((t: { TABLE_NAME: string }) => t.TABLE_NAME);

        if (tableNames.includes('user_map_ratings')) {
            await queryRunner.query(`DROP TABLE user_map_ratings`);
        }
        if (tableNames.includes('user_map_favorites')) {
            await queryRunner.query(`DROP TABLE user_map_favorites`);
        }
    }
}
