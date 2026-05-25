import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersCabinetService } from './users-cabinet.service';

import { UserTopicProgress } from './entities/user-topic-progress.entity';
import { UserTopicProgressService } from './user-topic-progress.service';

import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { TopicsModule } from '../topics/topics.module';
import { KnowledgeMapsModule } from '../knowledge-maps/knowledge-maps.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserTopicProgress, Topic, Node]),
        TopicsModule,
        KnowledgeMapsModule,
        forwardRef(() => NodesModule),
    ],
    providers: [UsersService, UserTopicProgressService, UsersCabinetService],
    controllers: [UsersController],
    exports: [UsersService, UserTopicProgressService],
})
export class UsersModule {}
