import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('nodes')
export class Node {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ name: 'topic_id', type: 'int', nullable: true })
    topicId: number | null;

    @Column({ name: 'group_id', type: 'varchar', length: 64, nullable: true })
    groupId: string | null;

    @Column({ name: 'map_id', type: 'int', nullable: true })
    mapId: number | null;

    @Column({ type: 'float', nullable: true })
    x: number | null;

    @Column({ type: 'float', nullable: true })
    y: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    color: string | null;

    @Column({ name: 'theory_md', type: 'text', nullable: true })
    theoryMd: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
