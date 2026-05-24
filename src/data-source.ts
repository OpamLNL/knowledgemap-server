import 'reflect-metadata';
import { DataSource } from 'typeorm';
import 'dotenv/config';
import * as fs from 'fs';
import { User } from './users/entities/user.entity';
import { UserTopicProgress } from './users/entities/user-topic-progress.entity';
import { Topic } from './topics/entities/topic.entity';
import { Node } from './nodes/entities/node.entity';
import { NodeConnection } from './node-connections/entities/node-connection.entity';
import { KnowledgeMap } from './knowledge-maps/entities/knowledge-map.entity';
import { MapRevision } from './knowledge-maps/entities/map-revision.entity';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { EditorFeatures1730000000001 } from './migrations/1730000000001-EditorFeatures';

const useSsl = process.env.DB_SSL === 'true';
const caPath = process.env.DB_CA_PATH;

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [
        User,
        UserTopicProgress,
        Topic,
        Node,
        NodeConnection,
        KnowledgeMap,
        MapRevision,
    ],
    migrations: [InitialSchema1730000000000, EditorFeatures1730000000001],
    synchronize: false,
    logging: true,
    ssl: useSsl && caPath
        ? {
              ca: fs.readFileSync(caPath),
              rejectUnauthorized: true,
          }
        : undefined,
});
