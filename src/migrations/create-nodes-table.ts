import { AppDataSource } from '../data-source';
import { QueryRunner } from 'typeorm';

export async function CreateNodesTable() {
    const queryRunner: QueryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS nodes (
                                             id INT PRIMARY KEY AUTO_INCREMENT,
                                             title VARCHAR(255) NOT NULL,
            topic_id INT,
            x FLOAT NULL,
            y FLOAT NULL,
            color VARCHAR(255),
            FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
            )
    `);

    await queryRunner.release();
}
