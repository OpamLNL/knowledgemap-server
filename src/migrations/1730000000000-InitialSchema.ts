import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
    name = 'InitialSchema1730000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS topics (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                firebase_uid VARCHAR(128) UNIQUE,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                avatarUrl TEXT,
                role ENUM('admin', 'teacher', 'student', 'guest') DEFAULT 'student',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS nodes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                topic_id INT NULL,
                x FLOAT NULL,
                y FLOAT NULL,
                color VARCHAR(255) NULL,
                FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS node_connections (
                id INT PRIMARY KEY AUTO_INCREMENT,
                from_node_id INT NOT NULL,
                to_node_id INT NOT NULL,
                type VARCHAR(50) NULL,
                FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS user_topic_progress (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_uid VARCHAR(64) NOT NULL,
                topic_id INT NOT NULL,
                status VARCHAR(255) DEFAULT 'not-started',
                progress FLOAT DEFAULT 0,
                completed_at TIMESTAMP NULL,
                CONSTRAINT fk_topic FOREIGN KEY (topic_id) REFERENCES topics(id)
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS user_topic_progress`);
        await queryRunner.query(`DROP TABLE IF EXISTS node_connections`);
        await queryRunner.query(`DROP TABLE IF EXISTS nodes`);
        await queryRunner.query(`DROP TABLE IF EXISTS users`);
        await queryRunner.query(`DROP TABLE IF EXISTS topics`);
    }
}
