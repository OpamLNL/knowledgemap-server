import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import express from 'express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ensureNodeMediaUploadDir, NODE_MEDIA_UPLOAD_DIR } from './nodes/node-media.storage';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bodyParser: false });

    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    ensureNodeMediaUploadDir();
    app.use('/api/uploads/node-media', express.static(NODE_MEDIA_UPLOAD_DIR));

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    app.enableCors({
        origin: [
            'https://knowledgemap-frontend2-0.vercel.app',
            'http://localhost:5173',
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: 'Content-Type,Authorization',
    });

    const config = new DocumentBuilder()
        .setTitle('Knowledge Map API')
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
    SwaggerModule.setup('docs', app, document);

    const port = Number(process.env.PORT) || 3001;
    await app.listen(port);
    console.log(`✅ Server running on port ${port}`);
    console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
