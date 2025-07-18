import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppTestModule } from '../src/app.test.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Configure the app like in main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    // Set up environment variables
    process.env.API_PREFIX = 'api';
    process.env.NODE_ENV = 'test';

    // Set global prefix
    const apiPrefix = process.env.API_PREFIX || '';
    if (apiPrefix) {
      app.setGlobalPrefix(apiPrefix);
    }

    // Set up Swagger
    const config = new DocumentBuilder()
      .setTitle('Glimmr API')
      .setDescription('Hospital pricing data aggregation and analytics platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('hospitals', 'Hospital data management')
      .addTag('prices', 'Pricing data operations')
      .addTag('analytics', 'Data analytics and reporting')
      .addTag('jobs', 'Background job management')
      .addTag('health', 'System health checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(apiPrefix ? `${apiPrefix}/docs` : 'docs', app, document, {
      customSiteTitle: 'Glimmr API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Root endpoint', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect(res => {
          expect(res.body.name).toBe('Glimmr API');
          expect(res.body.version).toBe('1.0.0');
          expect(res.body.status).toBe('operational');
        });
    });
  });

  describe('Swagger Documentation', () => {
    it('/api/docs (GET) - should return Swagger UI', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/)
        .expect(res => {
          expect(res.text).toContain('Glimmr API Documentation');
          expect(res.text).toContain('swagger-ui');
        });
    });

    it('/api/docs-json (GET) - should return OpenAPI JSON', () => {
      return request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect(res => {
          expect(res.body.info.title).toBe('Glimmr API');
          expect(res.body.info.description).toBe('Hospital pricing data aggregation and analytics platform');
          expect(res.body.info.version).toBe('1.0');
        });
    });

    it('/api/docs-yaml (GET) - should return OpenAPI YAML', () => {
      return request(app.getHttpServer())
        .get('/api/docs-yaml')
        .expect(200)
        .expect('Content-Type', /text\/yaml/)
        .expect(res => {
          expect(res.text).toContain('title: Glimmr API');
          expect(res.text).toContain('description: Hospital pricing data aggregation and analytics platform');
          expect(res.text).toContain("version: '1.0'");
        });
    });

    it('should contain all expected tags', () => {
      return request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200)
        .expect(res => {
          const tags = res.body.tags;
          expect(tags).toHaveLength(5);
          
          const tagNames = tags.map(tag => tag.name);
          expect(tagNames).toContain('hospitals');
          expect(tagNames).toContain('prices');
          expect(tagNames).toContain('analytics');
          expect(tagNames).toContain('jobs');
          expect(tagNames).toContain('health');
        });
    });

    it('should have security schemes configured', () => {
      return request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200)
        .expect(res => {
          expect(res.body.components.securitySchemes).toBeDefined();
          expect(res.body.components.securitySchemes.bearer).toBeDefined();
          expect(res.body.components.securitySchemes.bearer.type).toBe('http');
          expect(res.body.components.securitySchemes.bearer.scheme).toBe('bearer');
        });
    });

    it('should include custom CSS in Swagger UI', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('.swagger-ui .topbar { display: none }');
        });
    });

    it('should include custom site title', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('<title>Glimmr API Documentation</title>');
        });
    });

    it('should include custom favicon', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('favicon.ico');
        });
    });
  });

  describe('Health endpoint', () => {
    it('/api/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect(res => {
          expect(res.body).toBeDefined();
        });
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent routes', () => {
      return request(app.getHttpServer())
        .get('/api/non-existent')
        .expect(404);
    });

    it('should return 404 for docs without prefix when prefix is set', () => {
      return request(app.getHttpServer())
        .get('/docs')
        .expect(404);
    });
  });
});

describe('AppController without API prefix (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Configure the app like in main.ts but without API prefix
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    // Set up environment variables without API_PREFIX
    delete process.env.API_PREFIX;
    process.env.NODE_ENV = 'test';

    // Set up Swagger without prefix
    const config = new DocumentBuilder()
      .setTitle('Glimmr API')
      .setDescription('Hospital pricing data aggregation and analytics platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'Glimmr API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Swagger Documentation without prefix', () => {
    it('/docs (GET) - should return Swagger UI', () => {
      return request(app.getHttpServer())
        .get('/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/)
        .expect(res => {
          expect(res.text).toContain('Glimmr API Documentation');
          expect(res.text).toContain('swagger-ui');
        });
    });

    it('/docs-json (GET) - should return OpenAPI JSON', () => {
      return request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect(res => {
          expect(res.body.info.title).toBe('Glimmr API');
        });
    });
  });

  describe('Root endpoint without prefix', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.body.name).toBe('Glimmr API');
          expect(res.body.version).toBe('1.0.0');
          expect(res.body.status).toBe('operational');
        });
    });
  });

  describe('Health endpoint without prefix', () => {
    it('/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect(res => {
          expect(res.body).toBeDefined();
        });
    });
  });
});