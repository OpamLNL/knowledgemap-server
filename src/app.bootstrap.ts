import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { type Express, json, urlencoded } from 'express';
import { AppModule } from './app.module';

export function getCorsOrigins(): string[] {
  const defaults = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'https://graphedit.vercel.app',
  ];

  const fromEnv =
    process.env.FRONTEND_URL?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

  return [...new Set([...defaults, ...fromEnv, vercelUrl].filter(Boolean))] as string[];
}

function configureApp(app: INestApplication): void {
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Тут автоматично підтягнуться всі домени з getCorsOrigins()
  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization',
  });

  const config = new DocumentBuilder()
    .setTitle('GraphEdit API')
    .setDescription('API для створення та редагування карт знань')
    .setVersion('2.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });
}

/** Локальний запуск (`npm run start:dev` / `node dist/main.js`). */
export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  return app;
}

/** Vercel serverless — один Express-інстанс на все cold start. */
export async function createNestExpressApp(server: Express): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });
  configureApp(app);
  return app;
}