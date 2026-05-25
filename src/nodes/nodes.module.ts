import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { Node } from './entities/node.entity';
import { Topic } from '../topics/entities/topic.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { KnowledgeMap } from '../knowledge-maps/entities/knowledge-map.entity';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../common/graph/graph.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Node,
            Topic,
            NodeConnection,
            UserTopicProgress,
            KnowledgeMap,
            KnowledgeGroup,
            GroupConnection,
        ]),
        UsersModule,
        AuthModule,
        GraphModule,
    ],
    controllers: [NodesController],
    providers: [NodesService],
    exports: [NodesService],
})
export class NodesModule {}
