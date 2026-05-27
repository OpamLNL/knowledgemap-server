import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminStatisticsController } from './admin-statistics.controller';
import { AdminStatisticsService } from './admin-statistics.service';
import { User } from '../users/entities/user.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { GraphEditMap } from '../graph-edit-maps/entities/graph-edit-map.entity';
import { UsersModule } from '../users/users.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            UserTopicProgress,
            Node,
            NodeConnection,
            Topic,
            GraphEditMap,
        ]),
        UsersModule,
        NodesModule,
    ],
    controllers: [AdminStatisticsController],
    providers: [AdminStatisticsService],
})
export class AdminModule {}
