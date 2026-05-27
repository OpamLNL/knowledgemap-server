import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { GraphEditMap } from './graph-edit-map.entity';

@Entity('map_revisions')
export class MapRevision {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'map_id', type: 'int' })
    mapId: number;

    @ManyToOne(() => GraphEditMap, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'map_id' })
    map: GraphEditMap;

    @Column({ name: 'snapshot_json', type: 'json' })
    snapshotJson: {
        nodes: Record<string, unknown>[];
        edges: Record<string, unknown>[];
    };

    @Column({ type: 'varchar', length: 500, nullable: true })
    comment: string | null;

    @Column({ name: 'created_by_uid', type: 'varchar', length: 128, nullable: true })
    createdByUid: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;
}
