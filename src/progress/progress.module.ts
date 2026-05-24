import { Module } from '@nestjs/common';
import { UserTopicProgressController } from '../users/user-topic-progress.controller';
import { UsersModule } from '../users/users.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
    imports: [UsersModule, NodesModule],
    controllers: [UserTopicProgressController],
})
export class ProgressModule {}
