import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  // Create app with buffer logs to capture early logs
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger globally - this replaces the default NestJS logger
  app.useLogger(app.get(Logger));

  // Global exception filter for better error handling and logging
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(Logger)));

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://glimmr.com', 'https://api.glimmr.com'] 
      : true,
    credentials: true,
  });

  // Request logging is now handled by Pino HTTP middleware

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));



  // API prefix - since we're on api.glimmr.health subdomain, no prefix needed
  const apiPrefix = process.env.API_PREFIX || '';
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Glimmr API')
    .setDescription('Hospital pricing data aggregation and analytics platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API key for programmatic access',
      },
      'x-api-key'
    )
    .addTag('api', 'Core API information and status')
    .addTag('auth', 'Authentication and authorization')
    .addTag('admin', 'User and role management (admin only)')
    .addTag('hospitals', 'Hospital data management')
    .addTag('prices', 'Pricing data operations')
    .addTag('analytics', 'Analytics, insights, and reporting')
    .addTag('jobs', 'Background job management and monitoring')
    .addTag('odata', 'OData protocol endpoints')
    .addTag('health', 'System health and monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(apiPrefix ? `${apiPrefix}/docs` : 'docs', app, document, {
    customSiteTitle: 'Glimmr API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // Start server
  const port = process.env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // Use structured logging for startup messages
  const logger = app.get(Logger);
  const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
  const healthPath = apiPrefix ? `${apiPrefix}/health` : 'health';

  logger.log({
    msg: '🚀 Glimmr API started successfully',
    port,
    environment: process.env.NODE_ENV ?? 'development',
    apiPrefix: apiPrefix || 'none',
    docsUrl: `http://localhost:${port}/${docsPath}`,
    healthUrl: `http://localhost:${port}/${healthPath}`,
  }, 'Bootstrap');
}

bootstrap().catch((error) => {
  // Use console.error for bootstrap failures since logger may not be available
  console.error('❌ Failed to start Glimmr API:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  process.exit(1);
});
