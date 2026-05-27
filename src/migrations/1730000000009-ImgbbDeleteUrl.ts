import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImgbbDeleteUrl1730000000009 implements MigrationInterface {
    name = 'ImgbbDeleteUrl1730000000009';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const nodeMediaColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_media'
        `);
        const nodeMediaColNames = nodeMediaColumns.map(
            (c: { COLUMN_NAME: string }) => c.COLUMN_NAME,
        );
        if (!nodeMediaColNames.includes('delete_url')) {
            await queryRunner.query(`
                ALTER TABLE node_media
                ADD COLUMN delete_url VARCHAR(512) NULL
            `);
        }

        const userColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const userColNames = userColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (!userColNames.includes('avatar_delete_url')) {
            await queryRunner.query(`
                ALTER TABLE users
                ADD COLUMN avatar_delete_url VARCHAR(512) NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const nodeMediaColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_media'
        `);
        const nodeMediaColNames = nodeMediaColumns.map(
            (c: { COLUMN_NAME: string }) => c.COLUMN_NAME,
        );
        if (nodeMediaColNames.includes('delete_url')) {
            await queryRunner.query(`ALTER TABLE node_media DROP COLUMN delete_url`);
        }

        const userColumns = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const userColNames = userColumns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME);
        if (userColNames.includes('avatar_delete_url')) {
            await queryRunner.query(`ALTER TABLE users DROP COLUMN avatar_delete_url`);
        }
    }
}
