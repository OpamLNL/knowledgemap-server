import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum MapStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
}

@Entity('knowledge_maps')
export class KnowledgeMap {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ name: 'owner_uid', type: 'varchar', length: 128, nullable: true })
    ownerUid: string | null;

    @Column({ type: 'enum', enum: MapStatus, default: MapStatus.DRAFT })
    status: MapStatus;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

    @Column({ name: 'published_at', type: 'timestamp', nullable: true })
    publishedAt: Date | null;

    /** Результат валідації DAG на момент останньої публікації (null — ще не перевірялось). */
    @Column({ name: 'graph_validated', type: 'boolean', nullable: true })
    graphValidated: boolean | null;

    @Column({ name: 'group_layout_json', type: 'json', nullable: true })
    groupLayoutJson: Record<string, { x: number; y: number }> | null;
}
