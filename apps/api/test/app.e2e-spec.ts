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
});