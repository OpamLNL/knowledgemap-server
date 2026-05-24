import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('node_connections')
export class NodeConnection {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'from_node_id' })
    fromNodeId: number;

    @Column({ name: 'to_node_id' })
    toNodeId: number;

    @Column({ name: 'map_id', type: 'int', nullable: true })
    mapId: number | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    type: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
