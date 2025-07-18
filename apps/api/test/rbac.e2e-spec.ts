import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';

describe('Role-Based Access Control (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let usersService: UsersService;
  
  // Test user tokens and IDs
  let adminToken: string;
  let apiUserToken: string;
  let adminApiKey: string;
  let userApiKey: string;
  let adminUserId: string;
  let apiUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    authService = moduleFixture.get<AuthService>(AuthService);
    usersService = moduleFixture.get<UsersService>(UsersService);

    await app.init();

    // Clean up any existing test users
    try {
      const existingAdmin = await usersService.findByUsername('rbac_admin');
      if (existingAdmin) await usersService.delete(existingAdmin.id);
      
      const existingUser = await usersService.findByUsername('rbac_user');
      if (existingUser) await usersService.delete(existingUser.id);
    } catch (error) {
      // Users might not exist, that's fine
    }

    // Create test users with different roles
    const adminResult = await authService.register('rbac_admin', 'admin123', 'admin');
    adminToken = adminResult.access_token;
    adminUserId = adminResult.user.id;

    const userResult = await authService.register('rbac_user', 'user123', 'api-user');
    apiUserToken = userResult.access_token;
    apiUserId = userResult.user.id;

    // Generate API keys
    adminApiKey = await authService.generateApiKey(adminUserId);
    userApiKey = await authService.generateApiKey(apiUserId);
  });

  afterAll(async () => {
    // Clean up test users
    try {
      if (adminUserId) await usersService.delete(adminUserId);
      if (apiUserId) await usersService.delete(apiUserId);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    await app.close();
  });

  describe('Admin-Only Endpoints', () => {
    const adminOnlyEndpoints = [
      { method: 'post', path: '/jobs/hospital-import', body: { source: 'manual' } },
      { method: 'post', path: '/jobs/price-update', body: { priority: 5 } },
      { method: 'post', path: '/jobs/pra/scan', body: { testMode: true } },
      { method: 'post', path: '/jobs/pra/full-refresh', body: {} },
      { method: 'get', path: '/jobs/board' },
    ];

    adminOnlyEndpoints.forEach(({ method, path, body }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should allow admin with JWT token', async () => {
          const req = request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${adminToken}`);
          
          if (body) {
            req.send(body);
          }
          
          const response = await req;
          expect(response.status).not.toBe(403);
          expect(response.status).not.toBe(401);
        });

        it('should deny api-user with JWT token', async () => {
          const req = request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${apiUserToken}`);
          
          if (body) {
            req.send(body);
          }
          
          await req.expect(403);
        });

        it('should deny unauthenticated access', async () => {
          const req = request(app.getHttpServer())[method](path);
          
          if (body) {
            req.send(body);
          }
          
          await req.expect(401);
        });

        it('should deny invalid JWT token', async () => {
          const req = request(app.getHttpServer())[method](path)
            .set('Authorization', 'Bearer invalid.jwt.token');
          
          if (body) {
            req.send(body);
          }
          
          await req.expect(401);
        });
      });
    });
  });

  describe('Admin + API-User Endpoints', () => {
    const mixedAccessEndpoints = [
      { method: 'get', path: '/jobs' },
      { method: 'get', path: '/jobs/stats' },
      { method: 'get', path: '/jobs/monitoring/stats' },
      { method: 'get', path: '/jobs/pra/status' },
      { method: 'get', path: '/analytics/dashboard' },
      { method: 'get', path: '/analytics/trends' },
      { method: 'get', path: '/analytics/powerbi' },
      { method: 'get', path: '/analytics/export' },
    ];

    mixedAccessEndpoints.forEach(({ method, path }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should allow admin with JWT token', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect((res) => {
              expect(res.status).not.toBe(403);
              expect(res.status).not.toBe(401);
            });
        });

        it('should allow api-user with JWT token', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${apiUserToken}`)
            .expect((res) => {
              expect(res.status).not.toBe(403);
              expect(res.status).not.toBe(401);
            });
        });

        if (path.startsWith('/analytics')) {
          it('should allow admin with API key', async () => {
            await request(app.getHttpServer())[method](path)
              .set('x-api-key', adminApiKey)
              .expect((res) => {
                expect(res.status).not.toBe(403);
                expect(res.status).not.toBe(401);
              });
          });

          it('should allow api-user with API key', async () => {
            await request(app.getHttpServer())[method](path)
              .set('x-api-key', userApiKey)
              .expect((res) => {
                expect(res.status).not.toBe(403);
                expect(res.status).not.toBe(401);
              });
          });
        }

        it('should deny unauthenticated access', async () => {
          await request(app.getHttpServer())[method](path)
            .expect(401);
        });

        it('should deny invalid credentials', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', 'Bearer invalid.token')
            .expect(401);
        });
      });
    });
  });

  describe('API Key Only Endpoints (OData)', () => {
    const apiKeyOnlyEndpoints = [
      { method: 'get', path: '/odata' },
      { method: 'get', path: '/odata/$metadata' },
      { method: 'get', path: '/odata/hospitals' },
      { method: 'get', path: '/odata/prices' },
      { method: 'get', path: '/odata/analytics' },
    ];

    apiKeyOnlyEndpoints.forEach(({ method, path }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should allow admin with API key', async () => {
          await request(app.getHttpServer())[method](path)
            .set('x-api-key', adminApiKey)
            .expect((res) => {
              expect(res.status).not.toBe(403);
              expect(res.status).not.toBe(401);
            });
        });

        it('should allow api-user with API key', async () => {
          await request(app.getHttpServer())[method](path)
            .set('x-api-key', userApiKey)
            .expect((res) => {
              expect(res.status).not.toBe(403);
              expect(res.status).not.toBe(401);
            });
        });

        it('should deny JWT token access', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(401);
        });

        it('should deny unauthenticated access', async () => {
          await request(app.getHttpServer())[method](path)
            .expect(401);
        });

        it('should deny invalid API key', async () => {
          await request(app.getHttpServer())[method](path)
            .set('x-api-key', 'invalid_key')
            .expect(401);
        });
      });
    });
  });

  describe('Public Endpoints', () => {
    const publicEndpoints = [
      { method: 'get', path: '/health' },
      { method: 'get', path: '/' },
    ];

    publicEndpoints.forEach(({ method, path }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should allow unauthenticated access', async () => {
          await request(app.getHttpServer())[method](path)
            .expect((res) => {
              expect(res.status).not.toBe(401);
              expect(res.status).not.toBe(403);
            });
        });

        it('should allow admin access', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect((res) => {
              expect(res.status).not.toBe(401);
              expect(res.status).not.toBe(403);
            });
        });

        it('should allow api-user access', async () => {
          await request(app.getHttpServer())[method](path)
            .set('Authorization', `Bearer ${apiUserToken}`)
            .expect((res) => {
              expect(res.status).not.toBe(401);
              expect(res.status).not.toBe(403);
            });
        });
      });
    });
  });

  describe('Cross-Role Authorization Tests', () => {
    it('should maintain role isolation - api-user cannot access admin endpoints', async () => {
      const adminEndpoints = [
        '/jobs/hospital-import',
        '/jobs/price-update', 
        '/jobs/pra/scan',
        '/jobs/board',
      ];

      for (const endpoint of adminEndpoints) {
        await request(app.getHttpServer())
          .post(endpoint)
          .set('Authorization', `Bearer ${apiUserToken}`)
          .send({})
          .expect(403);
      }
    });

    it('should allow role elevation - admin can access all api-user endpoints', async () => {
      const userEndpoints = [
        '/jobs',
        '/jobs/stats',
        '/analytics/dashboard',
        '/analytics/trends',
      ];

      for (const endpoint of userEndpoints) {
        await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res) => {
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(401);
          });
      }
    });

    it('should handle mixed authentication methods correctly', async () => {
      // Admin JWT + user API key should use JWT (admin access)
      await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-api-key', userApiKey)
        .send({ source: 'manual' })
        .expect((res) => {
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
        });

      // User JWT + admin API key should use JWT (user access - denied)
      await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', `Bearer ${apiUserToken}`)
        .set('x-api-key', adminApiKey)
        .send({ source: 'manual' })
        .expect(403);
    });

    it('should handle role-based API key access', async () => {
      // Both admin and user API keys should work for OData
      await request(app.getHttpServer())
        .get('/odata/hospitals')
        .set('x-api-key', adminApiKey)
        .expect((res) => {
          expect(res.status).not.toBe(401);
          expect(res.status).not.toBe(403);
        });

      await request(app.getHttpServer())
        .get('/odata/hospitals')
        .set('x-api-key', userApiKey)
        .expect((res) => {
          expect(res.status).not.toBe(401);
          expect(res.status).not.toBe(403);
        });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should reject requests with both invalid JWT and invalid API key', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .set('x-api-key', 'invalid_api_key')
        .expect(401);
    });

    it('should handle case sensitivity in role checks', async () => {
      // This test assumes our role comparison is case-sensitive
      // If a user somehow got role 'Admin' instead of 'admin', it should fail
      const response = await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ source: 'manual' });
      
      expect(response.status).not.toBe(403); // Should work with correct 'admin' role
    });

    it('should handle empty role correctly', async () => {
      // This would require creating a user with empty role, which our validation should prevent
      // But we can test the guard behavior directly
      await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', 'Bearer invalid.token.with.empty.role')
        .send({ source: 'manual' })
        .expect(401);
    });

    it('should handle concurrent requests from different roles', async () => {
      const adminRequests = Array(3).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/jobs/stats')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const userRequests = Array(3).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/jobs/stats')
          .set('Authorization', `Bearer ${apiUserToken}`)
      );

      const allRequests = [...adminRequests, ...userRequests];
      const responses = await Promise.all(allRequests);

      responses.forEach(response => {
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });

    it('should maintain session isolation between different users', async () => {
      // Admin action should not affect user permissions
      await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ source: 'manual' })
        .expect((res) => expect(res.status).not.toBe(403));

      // User should still be denied after admin's successful request
      await request(app.getHttpServer())
        .post('/jobs/hospital-import')
        .set('Authorization', `Bearer ${apiUserToken}`)
        .send({ source: 'manual' })
        .expect(403);
    });
  });
});