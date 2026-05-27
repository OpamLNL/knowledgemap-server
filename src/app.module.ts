import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TopicsModule } from './topics/topics.module';
import { NodesModule } from './nodes/nodes.module';
import { NodeConnectionsModule } from './node-connections/node-connections.module';
import { GraphEditMapsModule } from './graph-edit-maps/graph-edit-maps.module';
import { GraphModule } from './common/graph/graph.module';
import { ImgbbModule } from './common/imgbb/imgbb.module';
import { AdminModule } from './admin/admin.module';
import { ProgressModule } from './progress/progress.module';
import { ProfileModule } from './profile/profile.module';
import { AuthRolesGuard } from './auth/auth-roles.guard';
import { buildMysqlSslOptions } from './config/mysql-ssl';

@Module({
    imports: [
        AuthModule,
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return {
                type: 'mysql',
                host: configService.get<string>('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get<string>('DB_USER'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: false,
                logging: true,
                ssl: buildMysqlSslOptions(),
            };
            },
        }),
        GraphModule,
        ImgbbModule,
        UsersModule,
        TopicsModule,
        NodesModule,
        NodeConnectionsModule,
        GraphEditMapsModule,
        ProgressModule,
        ProfileModule,
        AdminModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_GUARD,
            useClass: AuthRolesGuard,
        },
    ],
})
export class AppModule {}
