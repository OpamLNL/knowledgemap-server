import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTitleToNode implements MigrationInterface {
    name = 'AddTitleToNode';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE \`node\`
      ADD COLUMN \`title\` varchar(255) NOT NULL DEFAULT ''
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE \`node\` DROP COLUMN \`title\`
    `);
    }
}
