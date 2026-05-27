import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphEditMapsController } from './graph-edit-maps.controller';
import { GraphEditMapsService } from './graph-edit-maps.service';
import { GraphEditMap } from './entities/graph-edit-map.entity';
import { MapRevision } from './entities/map-revision.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeMedia } from '../nodes/entities/node-media.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { User } from '../users/entities/user.entity';
import { UserMapFavorite } from './entities/user-map-favorite.entity';
import { UserMapRating } from './entities/user-map-rating.entity';
import { GraphModule } from '../common/graph/graph.module';
import { NodesModule } from '../nodes/nodes.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            GraphEditMap,
            MapRevision,
            Node,
            NodeMedia,
            NodeConnection,
            Topic,
            KnowledgeGroup,
            GroupConnection,
            UserTopicProgress,
            User,
            UserMapFavorite,
            UserMapRating,
        ]),
        GraphModule,
        NodesModule,
        UsersModule,
    ],
    controllers: [GraphEditMapsController],
    providers: [GraphEditMapsService],
    exports: [GraphEditMapsService],
})
export class GraphEditMapsModule {}
