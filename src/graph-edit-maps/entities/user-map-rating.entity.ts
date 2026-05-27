import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { GraphEditMap } from './graph-edit-map.entity';

@Entity('user_map_ratings')
@Index('uq_user_map_rating', ['userUid', 'mapId'], { unique: true })
export class UserMapRating {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_uid', type: 'varchar', length: 128 })
    userUid: string;

    @Column({ name: 'map_id', type: 'int' })
    mapId: number;

    @ManyToOne(() => GraphEditMap, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'map_id' })
    map: GraphEditMap;

    @Column({ type: 'tinyint' })
    rating: number;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
