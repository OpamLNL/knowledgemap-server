import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { KnowledgeMap } from '../../knowledge-maps/entities/knowledge-map.entity';

@Entity('group_connections')
export class GroupConnection {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'map_id', type: 'int' })
    mapId: number;

    @ManyToOne(() => KnowledgeMap, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'map_id' })
    map: KnowledgeMap;

    @Column({ name: 'from_group_id', type: 'varchar', length: 64 })
    fromGroupId: string;

    @Column({ name: 'to_group_id', type: 'varchar', length: 64 })
    toGroupId: string;

    @Column({ type: 'varchar', length: 50, default: 'prerequisite' })
    type: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    source: string | null;
}
