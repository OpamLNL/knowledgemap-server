import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeMapsController } from './knowledge-maps.controller';
import { KnowledgeMapsService } from './knowledge-maps.service';
import { KnowledgeMap } from './entities/knowledge-map.entity';
import { MapRevision } from './entities/map-revision.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { GraphModule } from '../common/graph/graph.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            KnowledgeMap,
            MapRevision,
            Node,
            NodeConnection,
            Topic,
        ]),
        GraphModule,
    ],
    controllers: [KnowledgeMapsController],
    providers: [KnowledgeMapsService],
    exports: [KnowledgeMapsService],
})
export class KnowledgeMapsModule {}
