import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { UserTopicProgress } from './entities/user-topic-progress.entity';
import { UserTopicProgressService } from './user-topic-progress.service';
import { UserTopicProgressController } from './user-topic-progress.controller';

import { Topic } from '../topics/entities/topic.entity';
import { TopicsModule } from '../topics/topics.module';
// import {FirebaseAuthGuard} from "../auth/firebase-auth.guard";
 import {AuthModule} from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserTopicProgress, Topic]),
    //JwtModule,
    TopicsModule,
    // AuthModule,
  ],
  providers: [UsersService, UserTopicProgressService],
  controllers: [UsersController, UserTopicProgressController],
  exports: [UsersService],
})
export class UsersModule {}
