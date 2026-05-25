import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('group_connections')
export class GroupConnection {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'from_group_id', type: 'varchar', length: 64 })
    fromGroupId: string;

    @Column({ name: 'to_group_id', type: 'varchar', length: 64 })
    toGroupId: string;

    @Column({ type: 'varchar', length: 50, default: 'prerequisite' })
    type: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    source: string | null;
}
