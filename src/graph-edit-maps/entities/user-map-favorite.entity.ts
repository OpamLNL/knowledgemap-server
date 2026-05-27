import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { GraphEditMap } from './graph-edit-map.entity';

@Entity('user_map_favorites')
@Index('uq_user_map_favorite', ['userUid', 'mapId'], { unique: true })
export class UserMapFavorite {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_uid', type: 'varchar', length: 128 })
    userUid: string;

    @Column({ name: 'map_id', type: 'int' })
    mapId: number;

    @ManyToOne(() => GraphEditMap, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'map_id' })
    map: GraphEditMap;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;
}
