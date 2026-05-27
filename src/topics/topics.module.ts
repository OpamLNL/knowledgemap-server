import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { Topic } from './entities/topic.entity';
import { Node } from '../nodes/entities/node.entity';
import { GraphEditMap } from '../graph-edit-maps/entities/graph-edit-map.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Topic, Node, GraphEditMap])],
    controllers: [TopicsController],
    providers: [TopicsService],
    exports: [TopicsService],
})
export class TopicsModule {}
