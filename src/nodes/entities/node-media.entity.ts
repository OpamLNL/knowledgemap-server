import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Node } from './node.entity';

@Entity('node_media')
export class NodeMedia {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'node_id', type: 'int' })
    nodeId: number;

    @ManyToOne(() => Node, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'node_id' })
    node: Node;

    @Column({ type: 'varchar', length: 512 })
    url: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    caption: string | null;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;
}
