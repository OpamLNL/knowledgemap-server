import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { Topic } from './entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { KnowledgeMap } from '../knowledge-maps/entities/knowledge-map.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Topic, Node, KnowledgeMap])],
    controllers: [TopicsController],
    providers: [TopicsService],
    exports: [TopicsService],
})
export class TopicsModule {}
