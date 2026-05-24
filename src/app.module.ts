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
import { KnowledgeMapsModule } from './knowledge-maps/knowledge-maps.module';
import { GraphModule } from './common/graph/graph.module';
import { AuthRolesGuard } from './auth/auth-roles.guard';

@Module({
    imports: [
        AuthModule,
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'mysql',
                host: configService.get<string>('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get<string>('DB_USER'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: false,
                logging: true,
                ssl: configService.get<boolean>('DB_SSL')
                    ? {
                          ca: configService.get<string>('DB_CA_PATH'),
                          rejectUnauthorized: false,
                      }
                    : undefined,
            }),
        }),
        GraphModule,
        UsersModule,
        TopicsModule,
        NodesModule,
        NodeConnectionsModule,
        KnowledgeMapsModule,
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
