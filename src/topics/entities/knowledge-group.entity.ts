import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('knowledge_groups')
export class KnowledgeGroup {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    id: string;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'int', default: 0 })
    level: number;

    @Column({ name: 'parent_id', type: 'varchar', length: 64, nullable: true })
    parentId: string | null;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;
}
