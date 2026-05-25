import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Node } from '../nodes/entities/node.entity';
import { UsersModule } from '../users/users.module';
import { KnowledgeMapsModule } from '../knowledge-maps/knowledge-maps.module';
import { NodesModule } from '../nodes/nodes.module';
import { UsersCabinetService } from './users-cabinet.service';
import { ProfileController } from './profile.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Node]),
        UsersModule,
        KnowledgeMapsModule,
        NodesModule,
    ],
    providers: [UsersCabinetService],
    controllers: [ProfileController],
})
export class ProfileModule {}
