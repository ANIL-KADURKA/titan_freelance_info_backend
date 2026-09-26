import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const httpLogger = new Logger('HTTP');

  app.use((req: Request, res: Response, next: () => void) => {
    const requestId = randomUUID();
    const method = req.method;
    const path = (req.originalUrl || req.url).split('?')[0];
    const startedAt = Date.now();

    res.setHeader('x-request-id', requestId);
    httpLogger.log(
      `Request started | requestId=${requestId} | ${method} ${path}`,
    );

    res.once('finish', () => {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      const status = res.statusCode;
      const outcome = `Request finished | requestId=${requestId} | ${method} ${path} | status=${status} | duration=${Date.now() - startedAt}ms${userId ? ` | userId=${userId}` : ''}`;

      if (status >= 500) {
        httpLogger.error(outcome);
      } else if (status >= 400) {
        httpLogger.warn(outcome);
      } else {
        httpLogger.log(outcome);
      }
    });

    next();
  });

  const normalizeOrigin = (origin: string) => origin.trim().replace(/\/$/, '');
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://titan-freelance.netlify.app',
    ...(configuredOrigins ?? []),
  ]);

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Titan Freelance API')
    .setDescription(
      'Freelancer recruitment, timesheets, billing and payment tracking API',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on http://localhost:${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
await bootstrap();
