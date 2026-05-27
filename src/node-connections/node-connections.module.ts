import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeConnectionsService } from './node-connections.service';
import { NodeConnectionsController } from './node-connections.controller';
import { NodeConnection } from './entities/node-connection.entity';
import { Node } from '../nodes/entities/node.entity';
import { GraphEditMap } from '../graph-edit-maps/entities/graph-edit-map.entity';
import { GraphModule } from '../common/graph/graph.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([NodeConnection, Node, GraphEditMap]),
        GraphModule,
    ],
    providers: [NodeConnectionsService],
    controllers: [NodeConnectionsController],
    exports: [NodeConnectionsService],
})
export class NodeConnectionsModule {}
