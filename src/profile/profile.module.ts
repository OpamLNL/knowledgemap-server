import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Node } from '../nodes/entities/node.entity';
import { GraphEditMap } from '../graph-edit-maps/entities/graph-edit-map.entity';
import { UsersModule } from '../users/users.module';
import { GraphEditMapsModule } from '../graph-edit-maps/graph-edit-maps.module';
import { NodesModule } from '../nodes/nodes.module';
import { UsersCabinetService } from './users-cabinet.service';
import { ProfileController } from './profile.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Node, GraphEditMap]),
        UsersModule,
        GraphEditMapsModule,
        NodesModule,
    ],
    providers: [UsersCabinetService],
    controllers: [ProfileController],
})
export class ProfileModule {}
