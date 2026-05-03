// apps/backend/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin:      ['http://localhost:5173', 'http://localhost:3000'],
    methods:     ['GET', 'POST'],
    credentials: true,
  });

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
  console.log(`[Backend] Running on http://localhost:${port}`);
}

bootstrap().catch(console.error);