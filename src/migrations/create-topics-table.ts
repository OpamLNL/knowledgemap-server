import { AppDataSource } from '../data-source';
import { QueryRunner } from 'typeorm';

export async function CreateTopicsTable() {
    const queryRunner: QueryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS topics (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            description TEXT
        )
    `);

    await queryRunner.release();
}
