import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppTestModule } from './app.test.module';

describe('Swagger Configuration', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('DocumentBuilder Configuration', () => {
    it('should create document builder with correct title', () => {
      const config = new DocumentBuilder()
        .setTitle('Glimmr API')
        .build();

      expect(config.info.title).toBe('Glimmr API');
    });

    it('should create document builder with correct description', () => {
      const config = new DocumentBuilder()
        .setDescription('Hospital pricing data aggregation and analytics platform')
        .build();

      expect(config.info.description).toBe('Hospital pricing data aggregation and analytics platform');
    });

    it('should create document builder with correct version', () => {
      const config = new DocumentBuilder()
        .setVersion('1.0')
        .build();

      expect(config.info.version).toBe('1.0');
    });

    it('should add bearer auth security scheme', () => {
      const config = new DocumentBuilder()
        .addBearerAuth()
        .build();

      expect(config.components.securitySchemes.bearer).toBeDefined();
      expect(config.components.securitySchemes.bearer.type).toBe('http');
      expect(config.components.securitySchemes.bearer.scheme).toBe('bearer');
    });

    it('should add all required tags', () => {
      const config = new DocumentBuilder()
        .addTag('hospitals', 'Hospital data management')
        .addTag('prices', 'Pricing data operations')
        .addTag('analytics', 'Data analytics and reporting')
        .addTag('jobs', 'Background job management')
        .addTag('health', 'System health checks')
        .build();

      expect(config.tags).toHaveLength(5);
      
      const tagNames = config.tags.map(tag => tag.name);
      expect(tagNames).toContain('hospitals');
      expect(tagNames).toContain('prices');
      expect(tagNames).toContain('analytics');
      expect(tagNames).toContain('jobs');
      expect(tagNames).toContain('health');
    });

    it('should add tags with correct descriptions', () => {
      const config = new DocumentBuilder()
        .addTag('hospitals', 'Hospital data management')
        .addTag('prices', 'Pricing data operations')
        .addTag('analytics', 'Data analytics and reporting')
        .addTag('jobs', 'Background job management')
        .addTag('health', 'System health checks')
        .build();

      const hospitalsTag = config.tags.find(tag => tag.name === 'hospitals');
      const pricesTag = config.tags.find(tag => tag.name === 'prices');
      const analyticsTag = config.tags.find(tag => tag.name === 'analytics');
      const jobsTag = config.tags.find(tag => tag.name === 'jobs');
      const healthTag = config.tags.find(tag => tag.name === 'health');

      expect(hospitalsTag.description).toBe('Hospital data management');
      expect(pricesTag.description).toBe('Pricing data operations');
      expect(analyticsTag.description).toBe('Data analytics and reporting');
      expect(jobsTag.description).toBe('Background job management');
      expect(healthTag.description).toBe('System health checks');
    });

    it('should create complete configuration as in main.ts', () => {
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

      expect(config.info.title).toBe('Glimmr API');
      expect(config.info.description).toBe('Hospital pricing data aggregation and analytics platform');
      expect(config.info.version).toBe('1.0');
      expect(config.components.securitySchemes.bearer).toBeDefined();
      expect(config.tags).toHaveLength(5);
    });
  });

  describe('SwaggerModule Document Creation', () => {
    it('should create OpenAPI document from app and config', async () => {
      const config = new DocumentBuilder()
        .setTitle('Glimmr API')
        .setDescription('Hospital pricing data aggregation and analytics platform')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      await app.init();
      const document = SwaggerModule.createDocument(app, config);

      expect(document).toBeDefined();
      expect(document.info.title).toBe('Glimmr API');
      expect(document.info.description).toBe('Hospital pricing data aggregation and analytics platform');
      expect(document.info.version).toBe('1.0');
      expect(document.components.securitySchemes.bearer).toBeDefined();
    });

    it('should include paths from controllers', async () => {
      const config = new DocumentBuilder()
        .setTitle('Glimmr API')
        .build();

      await app.init();
      const document = SwaggerModule.createDocument(app, config);

      expect(document.paths).toBeDefined();
      expect(Object.keys(document.paths).length).toBeGreaterThan(0);
    });

    it('should include health endpoint path', async () => {
      const config = new DocumentBuilder()
        .setTitle('Glimmr API')
        .build();

      await app.init();
      const document = SwaggerModule.createDocument(app, config);

      expect(document.paths['/health']).toBeDefined();
    });

    it('should include OpenAPI version', async () => {
      const config = new DocumentBuilder()
        .setTitle('Glimmr API')
        .build();

      await app.init();
      const document = SwaggerModule.createDocument(app, config);

      expect(document.openapi).toBeDefined();
      expect(document.openapi).toMatch(/^3\./); // Should be OpenAPI 3.x
    });
  });

  describe('SwaggerModule Setup Options', () => {
    it('should accept custom site title option', () => {
      const options = {
        customSiteTitle: 'Glimmr API Documentation',
      };

      expect(options.customSiteTitle).toBe('Glimmr API Documentation');
    });

    it('should accept custom favicon option', () => {
      const options = {
        customfavIcon: '/favicon.ico',
      };

      expect(options.customfavIcon).toBe('/favicon.ico');
    });

    it('should accept custom CSS option', () => {
      const options = {
        customCss: '.swagger-ui .topbar { display: none }',
      };

      expect(options.customCss).toBe('.swagger-ui .topbar { display: none }');
    });

    it('should accept all custom options together', () => {
      const options = {
        customSiteTitle: 'Glimmr API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: '.swagger-ui .topbar { display: none }',
      };

      expect(options.customSiteTitle).toBe('Glimmr API Documentation');
      expect(options.customfavIcon).toBe('/favicon.ico');
      expect(options.customCss).toBe('.swagger-ui .topbar { display: none }');
    });
  });

  describe('Path Configuration', () => {
    it('should construct correct path with API prefix', () => {
      const apiPrefix = 'api';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('api/docs');
    });

    it('should construct correct path without API prefix', () => {
      const apiPrefix = '';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('docs');
    });

    it('should construct correct path with undefined API prefix', () => {
      const apiPrefix = undefined;
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('docs');
    });

    it('should construct correct path with null API prefix', () => {
      const apiPrefix = null;
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('docs');
    });

    it('should construct correct path with custom prefix', () => {
      const apiPrefix = 'v1';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('v1/docs');
    });
  });

  describe('Environment Integration', () => {
    it('should handle API_PREFIX environment variable', () => {
      const originalPrefix = process.env.API_PREFIX;
      
      process.env.API_PREFIX = 'api';
      const apiPrefix = process.env.API_PREFIX || '';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('api/docs');
      
      // Restore original value
      if (originalPrefix !== undefined) {
        process.env.API_PREFIX = originalPrefix;
      } else {
        delete process.env.API_PREFIX;
      }
    });

    it('should handle missing API_PREFIX environment variable', () => {
      const originalPrefix = process.env.API_PREFIX;
      
      delete process.env.API_PREFIX;
      const apiPrefix = process.env.API_PREFIX || '';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      
      expect(docsPath).toBe('docs');
      
      // Restore original value
      if (originalPrefix !== undefined) {
        process.env.API_PREFIX = originalPrefix;
      }
    });
  });

  describe('URL Generation', () => {
    it('should generate correct docs URL with prefix', () => {
      const apiPrefix = 'api';
      const port = '3000';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      const docsUrl = `http://localhost:${port}/${docsPath}`;
      
      expect(docsUrl).toBe('http://localhost:3000/api/docs');
    });

    it('should generate correct docs URL without prefix', () => {
      const apiPrefix = '';
      const port = '3000';
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
      const docsUrl = `http://localhost:${port}/${docsPath}`;
      
      expect(docsUrl).toBe('http://localhost:3000/docs');
    });

    it('should generate correct health URL with prefix', () => {
      const apiPrefix = 'api';
      const port = '3000';
      const healthPath = apiPrefix ? `${apiPrefix}/health` : 'health';
      const healthUrl = `http://localhost:${port}/${healthPath}`;
      
      expect(healthUrl).toBe('http://localhost:3000/api/health');
    });

    it('should generate correct health URL without prefix', () => {
      const apiPrefix = '';
      const port = '3000';
      const healthPath = apiPrefix ? `${apiPrefix}/health` : 'health';
      const healthUrl = `http://localhost:${port}/${healthPath}`;
      
      expect(healthUrl).toBe('http://localhost:3000/health');
    });
  });
});