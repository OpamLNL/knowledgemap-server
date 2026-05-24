import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { UserTopicProgress } from './entities/user-topic-progress.entity';
import { UserTopicProgressService } from './user-topic-progress.service';

import { Topic } from '../topics/entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { TopicsModule } from '../topics/topics.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserTopicProgress, Topic, Node]),
        TopicsModule,
    ],
    providers: [UsersService, UserTopicProgressService],
    controllers: [UsersController],
    exports: [UsersService, UserTopicProgressService],
})
export class UsersModule {}
