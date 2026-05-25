import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('topics')
export class Topic {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column('text')
    description: string;

    /** Стабільний id з seed JSON (1…534) для зв'язків fromTopicId/toTopicId */
    @Column({ name: 'seed_topic_id', type: 'int', nullable: true, unique: true })
    seedTopicId: number | null;

    @Column({ name: 'group_id', type: 'varchar', length: 64, nullable: true })
    groupId: string | null;

    @Column({ name: 'order_in_group', type: 'int', default: 0 })
    orderInGroup: number;

    @Column({ name: 'global_order', type: 'int', nullable: true })
    globalOrder: number | null;
}
