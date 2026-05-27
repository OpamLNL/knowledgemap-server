import { createNestApp } from './app.bootstrap';

async function bootstrap() {
    const app = await createNestApp();
    const port = Number(process.env.PORT) || 3002;
    await app.listen(port);
    console.log(`✅ Server running on port ${port}`);
    console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
