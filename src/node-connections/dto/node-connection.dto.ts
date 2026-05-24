import { Expose } from 'class-transformer';

export class NodeConnectionDto {
    @Expose({ name: 'fromNodeId' })
    fromNodeId: number;

    @Expose({ name: 'toNodeId' })
    toNodeId: number;

    @Expose()
    id: number;

    @Expose()
    type: string;
}
