import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { PinoLogger } from 'nestjs-pino';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    db: {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    },
    healthCheck: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AppModule,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .overrideProvider(PinoLogger)
      .useValue(mockLogger)
      .compile();

    app = moduleFixture.createNestApplication();
    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);

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
      .addTag('api', 'Core API information and status')
      .addTag('auth', 'Authentication and authorization')
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('/health (GET)', () => {
    it('should return 200 when all services are healthy', () => {
      // Mock healthy database
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      return request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('checks');
          expect(res.body.checks).toHaveProperty('api');
          expect(res.body.checks).toHaveProperty('memory');
        });
    });

    it('should return 503 when database is unhealthy', () => {
      // Mock unhealthy database
      mockDatabaseService.healthCheck.mockRejectedValue(new Error('Database connection failed'));

      return request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((res) => {
          expect(res.body.status).toBe('unhealthy');
          expect(res.body.checks.database.status).toBe('unhealthy');
        });
    });
  });

  describe('/api/v1/hospitals (GET)', () => {
    it('should return 503 when database is unavailable', () => {
      // Mock database connection error
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockImplementation(() => {
        throw new Error('ECONNREFUSED');
      });

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/hospitals')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Database connection failed');
          expect(res.body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
          expect(res.body.error).toBe('Service Unavailable');
        });
    });

    it('should return 200 with hospitals data when database is available', () => {
      const mockHospitals = [
        {
          id: '1',
          name: 'Test Hospital',
          state: 'CA',
          city: 'San Francisco',
          address: '123 Main St',
          phone: '555-0123',
          website: 'https://test.com',
          bedCount: 100,
          ownership: 'private',
          hospitalType: 'general',
          lastUpdated: new Date(),
        },
      ];

      const mockCountResult = { count: 1 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockHospitals);

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy.mockReturnValue({
              limit: mockLimit.mockReturnValue({
                offset: mockOffset,
              }),
            }),
          }),
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/hospitals')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('offset');
          expect(res.body.data).toEqual(mockHospitals);
          expect(res.body.total).toBe(1);
        });
    });

    it('should handle query parameters correctly', () => {
      const mockHospitals = [];
      const mockCountResult = { count: 0 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockHospitals);

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy.mockReturnValue({
              limit: mockLimit.mockReturnValue({
                offset: mockOffset,
              }),
            }),
          }),
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/hospitals?state=CA&city=San Francisco&limit=10&offset=0')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body.limit).toBe(10);
          expect(res.body.offset).toBe(0);
        });
    });
  });

  describe('/api/v1/prices (GET)', () => {
    it('should return 503 when database is unavailable', () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockImplementation(() => {
        throw new Error('connect ECONNREFUSED');
      });

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere,
          }),
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/prices')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Database connection failed');
          expect(res.body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
          expect(res.body.error).toBe('Service Unavailable');
        });
    });

    it('should return 200 with prices data when database is available', () => {
      const mockPrices = [
        {
          id: '1',
          service: 'MRI',
          code: 'MRI001',
          price: 1500.00,
          discountedCashPrice: 1200.00,
          description: 'Brain MRI',
          category: 'imaging',
          lastUpdated: new Date(),
          hospital: 'Test Hospital',
        },
      ];

      const mockCountResult = { count: 1 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([mockCountResult]),
          }),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit.mockReturnValue({
                  offset: mockOffset,
                }),
              }),
            }),
          }),
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/prices')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body.data).toEqual(mockPrices);
          expect(res.body.total).toBe(1);
        });
    });
  });

  describe('/api/v1/analytics/dashboard (GET)', () => {
    it('should return 503 when database is unavailable', () => {
      const mockSelect = jest.fn().mockImplementation(() => {
        throw new Error('ECONNREFUSED');
      });

      mockDatabaseService.db.select.mockReturnValue(mockSelect);

      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Database connection failed');
          expect(res.body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
          expect(res.body.error).toBe('Service Unavailable');
        });
    });

    it('should return 200 with analytics data when database is available', () => {
      const mockHospitalCount = { count: 500 };
      const mockPriceCount = { count: 10000 };
      const mockAveragePrice = { avg: 1250.00 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockGroupBy = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();

      // Mock multiple queries for analytics
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockHospitalCount]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockPriceCount]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockAveragePrice]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            groupBy: mockGroupBy.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit.mockReturnValue([]),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              groupBy: mockGroupBy.mockReturnValue({
                orderBy: mockOrderBy.mockReturnValue([]),
              }),
            }),
          }),
        }),
      });

      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalHospitals');
          expect(res.body).toHaveProperty('totalPrices');
          expect(res.body).toHaveProperty('averagePrice');
          expect(res.body.totalHospitals).toBe(500);
          expect(res.body.totalPrices).toBe(10000);
          expect(res.body.averagePrice).toBe(1250.00);
        });
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should handle malformed requests with proper error response', () => {
      return request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .send({ invalid: 'data' })
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });

    it('should include correlation ID in error responses when provided', () => {
      const mockSelect = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      mockDatabaseService.db.select.mockReturnValue(mockSelect);

      return request(app.getHttpServer())
        .get('/api/v1/hospitals')
        .set('x-correlation-id', 'test-correlation-123')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
        });
    });
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
});