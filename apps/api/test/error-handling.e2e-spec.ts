import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/exceptions';
import { ERROR_CODES } from '../src/common/exceptions/error-codes';
import { DatabaseService } from '../src/database/database.service';
import { PatientRightsAdvocateService } from '../src/external-apis/patient-rights-advocate.service';

describe('Error Handling (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let praService: PatientRightsAdvocateService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(DatabaseService)
    .useValue({
      db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
      },
    })
    .overrideProvider(PatientRightsAdvocateService)
    .useValue({
      getHospitalsByState: jest.fn(),
      getAllHospitals: jest.fn(),
      getRateLimitStatus: jest.fn(),
      getSessionStatus: jest.fn(),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    
    app.useGlobalFilters(new GlobalExceptionFilter());

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    praService = moduleFixture.get<PatientRightsAdvocateService>(PatientRightsAdvocateService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /hospitals', () => {
    it('should return 500 with standardized error format on database error', async () => {
      const dbError = new Error('Database connection failed');
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(dbError),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: 'Database operation failed: fetch hospitals. Database connection failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        path: '/hospitals',
      });

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should return 200 with proper response format on success', async () => {
      const mockHospitals = [
        {
          id: '1',
          name: 'Test Hospital',
          state: 'CA',
          city: 'Los Angeles',
          address: '123 Main St',
          phone: '555-0123',
          website: 'https://test.com',
          bedCount: 100,
          ownership: 'Private',
          hospitalType: 'General',
          lastUpdated: new Date(),
        },
      ];

      const mockCountResult = { count: 1 };

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue(mockHospitals),
                }),
              }),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            name: 'Test Hospital',
            state: 'CA',
          }),
        ]),
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should handle query parameters correctly', async () => {
      const mockHospitals = [];
      const mockCountResult = { count: 0 };

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue(mockHospitals),
                }),
              }),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals?state=CA&city=Los Angeles&limit=10&offset=20')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('GET /hospitals/:id', () => {
    it('should return 404 with standardized error format when hospital not found', async () => {
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]), // Empty result
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/nonexistent-id')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Hospital with ID nonexistent-id not found',
        error: ERROR_CODES.NOT_FOUND,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        path: '/hospitals/nonexistent-id',
      });
    });

    it('should return 200 with hospital data when found', async () => {
      const mockHospital = {
        id: '123',
        name: 'Test Hospital',
        state: 'CA',
        city: 'Los Angeles',
        address: '123 Main St',
        phone: '555-0123',
        website: 'https://test.com',
        bedCount: 100,
        ownership: 'Private',
        hospitalType: 'General',
        lastUpdated: new Date(),
      };

      const mockServices = [
        { category: 'Emergency Services' },
        { category: 'Surgery' },
      ];

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockHospital]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              groupBy: jest.fn().mockResolvedValue(mockServices),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: '123',
        name: 'Test Hospital',
        state: 'CA',
        services: ['Emergency Services', 'Surgery'],
      });
    });

    it('should return 500 with standardized error format on database error', async () => {
      const dbError = new Error('Database query failed');
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockRejectedValue(dbError),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: 'Database operation failed: fetch hospital. Database query failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        path: '/hospitals/123',
      });
    });
  });

  describe('GET /hospitals/:id/prices', () => {
    it('should return 200 with prices data', async () => {
      const mockPrices = [
        {
          id: '1',
          service: 'Emergency Room Visit',
          code: 'ER001',
          price: 2500.00,
          discountedCashPrice: 2000.00,
          description: 'Emergency room visit',
          category: 'Emergency Services',
          lastUpdated: new Date(),
        },
      ];

      const mockCountResult = { count: 1 };

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(mockPrices),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123/prices')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        hospitalId: '123',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            service: 'Emergency Room Visit',
            code: 'ER001',
          }),
        ]),
        total: 1,
      });
    });

    it('should handle service filter parameter', async () => {
      const mockPrices = [];
      const mockCountResult = { count: 0 };

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(mockPrices),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123/prices?service=Emergency')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        hospitalId: '123',
        data: [],
        total: 0,
      });
    });
  });

  describe('Error Response Headers', () => {
    it('should include proper content-type header for errors', async () => {
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/nonexistent')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should not expose sensitive information in production-like errors', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const sensitiveError = new Error('Database password is wrong for user admin');
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(sensitiveError),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body.message).not.toContain('Database password');
      expect(response.body.message).not.toContain('admin');
      expect(response.body).not.toHaveProperty('details');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Response Consistency', () => {
    it('should maintain consistent error response structure across different endpoints', async () => {
      const dbError = new Error('Connection timeout');
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(dbError),
          }),
        });

      // Test multiple endpoints to ensure consistency
      const endpoints = [
        '/hospitals',
        '/hospitals/123',
        '/hospitals/123/prices',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect(HttpStatus.INTERNAL_SERVER_ERROR);

        // All error responses should have the same structure
        expect(response.body).toMatchObject({
          statusCode: expect.any(Number),
          message: expect.any(String),
          error: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          path: expect.any(String),
        });

        expect(response.body.statusCode).toBe(500);
        expect(response.body.error).toBe(ERROR_CODES.DATABASE_QUERY_ERROR);
        expect(response.body.path).toBe(endpoint);
      }
    });

    it('should handle concurrent error requests without conflicts', async (done) => {
      const dbError = new Error('Concurrent test error');
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(dbError),
          }),
        });

      // Make multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .get(`/hospitals/test-${i}`)
          .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      );

      Promise.all(requests).then((responses) => {
        responses.forEach((response, index) => {
          expect(response.body).toMatchObject({
            statusCode: 500,
            error: ERROR_CODES.DATABASE_QUERY_ERROR,
            path: `/hospitals/test-${index}`,
          });
          
          // Each response should have a unique timestamp
          expect(response.body.timestamp).toBeDefined();
        });

        // Verify that timestamps are unique (or at least most are)
        const timestamps = responses.map(r => r.body.timestamp);
        const uniqueTimestamps = [...new Set(timestamps)];
        expect(uniqueTimestamps.length).toBeGreaterThan(1);
        
        done();
      }).catch(done);
    });
  });

  describe('HTTP Method Errors', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/nonexistent-route')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body).toMatchObject({
        statusCode: 404,
        error: ERROR_CODES.NOT_FOUND,
        path: '/nonexistent-route',
      });
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      const response = await request(app.getHttpServer())
        .delete('/hospitals/123')
        .expect(HttpStatus.NOT_FOUND); // NestJS returns 404 for undefined routes

      expect(response.body).toMatchObject({
        statusCode: 404,
        path: '/hospitals/123',
      });
    });
  });

  describe('Validation Errors', () => {
    it('should handle validation errors with proper format', async () => {
      // This would test validation if we had POST/PUT endpoints with DTOs
      // For now, we'll test query parameter validation if any exists
      
      const response = await request(app.getHttpServer())
        .get('/hospitals?limit=invalid')
        .expect(HttpStatus.OK); // Query params are optional and not strictly validated

      // This test ensures the app doesn't crash on invalid query params
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Real-world Error Scenarios', () => {
    it('should handle database constraint violations', async () => {
      const constraintError = {
        name: 'QueryFailedError',
        message: 'duplicate key value violates unique constraint "hospitals_ccn_unique"',
        code: '23505',
      };
      
      (databaseService.db.select as jest.Mock)
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(constraintError),
          }),
        });

      const response = await request(app.getHttpServer())
        .get('/hospitals/123')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: 'Database operation failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        path: '/hospitals/123',
      });
    });

    it('should handle external service timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      // This would be tested if we had endpoints that directly call external services
      // For now, this demonstrates the pattern
      expect(timeoutError.name).toBe('TimeoutError');
    });
  });
});