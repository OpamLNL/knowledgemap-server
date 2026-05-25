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

    @Column({ name: 'from_group_id', type: 'varchar', length: 64, nullable: true })
    fromGroupId: string | null;

    @Column({ name: 'to_group_id', type: 'varchar', length: 64, nullable: true })
    toGroupId: string | null;

    @Column({ name: 'is_cross_group', type: 'tinyint', width: 1, default: 0 })
    isCrossGroup: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
