import { AppDataSource } from '../data-source';
import { QueryRunner } from 'typeorm';

export async function CreateNodeConnectionsTable() {
    const queryRunner: QueryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS node_connections (
            id INT PRIMARY KEY AUTO_INCREMENT,
            from_node_id INT NOT NULL,
            to_node_id INT NOT NULL,
            type VARCHAR(50),
            FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
            FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
    `);

    await queryRunner.release();
}
