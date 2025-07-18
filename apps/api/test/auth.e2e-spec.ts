import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';

describe('Authentication & Authorization (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let authService: AuthService;
  let usersService: UsersService;
  
  // Test user credentials
  const testUsers = {
    admin: {
      username: 'testadmin',
      password: 'admin123',
      role: 'admin' as const,
    },
    apiUser: {
      username: 'testuser',
      password: 'user123', 
      role: 'api-user' as const,
    },
  };

  let adminToken: string;
  let apiUserToken: string;
  let apiKey: string;
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
    
    // Apply the same validation pipe as main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    authService = moduleFixture.get<AuthService>(AuthService);
    usersService = moduleFixture.get<UsersService>(UsersService);

    await app.init();

    // Clean up any existing test users
    try {
      const existingAdmin = await usersService.findByUsername(testUsers.admin.username);
      if (existingAdmin) {
        await usersService.delete(existingAdmin.id);
      }
      const existingUser = await usersService.findByUsername(testUsers.apiUser.username);
      if (existingUser) {
        await usersService.delete(existingUser.id);
      }
    } catch (error) {
      // Users might not exist, that's fine
    }

    // Create test users
    const adminResult = await authService.register(
      testUsers.admin.username,
      testUsers.admin.password,
      testUsers.admin.role
    );
    adminToken = adminResult.access_token;
    adminUserId = adminResult.user.id;

    const userResult = await authService.register(
      testUsers.apiUser.username,
      testUsers.apiUser.password,
      testUsers.apiUser.role
    );
    apiUserToken = userResult.access_token;
    apiUserId = userResult.user.id;

    // Generate API key for API user
    apiKey = await authService.generateApiKey(apiUserId);
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

  describe('Authentication Endpoints', () => {
    describe('POST /auth/register', () => {
      it('should register a new user successfully', async () => {
        const newUser = {
          username: 'newuser',
          password: 'password123',
          role: 'api-user',
        };

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(newUser)
          .expect(201);

        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          user: {
            id: expect.any(String),
            username: newUser.username,
            role: newUser.role,
          },
        });

        // Clean up
        await usersService.delete(response.body.user.id);
      });

      it('should reject registration with existing username', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: testUsers.admin.username,
            password: 'password123',
            role: 'api-user',
          })
          .expect(401);
      });

      it('should reject registration with invalid data', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: '', // Empty username
            password: 'password123',
            role: 'api-user',
          })
          .expect(400);
      });

      it('should reject registration with invalid role', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'testuser2',
            password: 'password123',
            role: 'invalid-role',
          })
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login admin user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            username: testUsers.admin.username,
            password: testUsers.admin.password,
          })
          .expect(200);

        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          user: {
            id: expect.any(String),
            username: testUsers.admin.username,
            role: 'admin',
          },
        });
      });

      it('should login api-user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            username: testUsers.apiUser.username,
            password: testUsers.apiUser.password,
          })
          .expect(200);

        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          user: {
            id: expect.any(String),
            username: testUsers.apiUser.username,
            role: 'api-user',
          },
        });
      });

      it('should reject login with invalid credentials', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            username: testUsers.admin.username,
            password: 'wrongpassword',
          })
          .expect(401);
      });

      it('should reject login with non-existent user', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            username: 'nonexistent',
            password: 'password123',
          })
          .expect(401);
      });
    });

    describe('GET /auth/profile', () => {
      it('should return user profile with valid JWT', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          username: testUsers.admin.username,
          role: 'admin',
        });
      });

      it('should reject access without token', async () => {
        await request(app.getHttpServer())
          .get('/auth/profile')
          .expect(401);
      });

      it('should reject access with invalid token', async () => {
        await request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', 'Bearer invalid.jwt.token')
          .expect(401);
      });
    });

    describe('POST /auth/api-key', () => {
      it('should generate API key for authenticated user', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/api-key')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          apiKey: expect.stringMatching(/^gapi_[a-z0-9]+$/),
        });
      });

      it('should reject API key generation without authentication', async () => {
        await request(app.getHttpServer())
          .post('/auth/api-key')
          .expect(401);
      });
    });
  });

  describe('Job Management Endpoints (Admin Only)', () => {
    describe('GET /jobs', () => {
      it('should allow admin to view jobs', async () => {
        await request(app.getHttpServer())
          .get('/jobs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should allow api-user to view jobs', async () => {
        await request(app.getHttpServer())
          .get('/jobs')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .expect(200);
      });

      it('should reject unauthenticated access', async () => {
        await request(app.getHttpServer())
          .get('/jobs')
          .expect(401);
      });
    });

    describe('POST /jobs/hospital-import (Admin Only)', () => {
      it('should allow admin to trigger job', async () => {
        await request(app.getHttpServer())
          .post('/jobs/hospital-import')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            source: 'manual',
            priority: 5,
          })
          .expect(201);
      });

      it('should reject api-user from triggering job', async () => {
        await request(app.getHttpServer())
          .post('/jobs/hospital-import')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .send({
            source: 'manual',
            priority: 5,
          })
          .expect(403);
      });

      it('should reject unauthenticated access', async () => {
        await request(app.getHttpServer())
          .post('/jobs/hospital-import')
          .send({
            source: 'manual',
            priority: 5,
          })
          .expect(401);
      });
    });

    describe('POST /jobs/pra/scan (Admin Only)', () => {
      it('should allow admin to trigger PRA scan', async () => {
        await request(app.getHttpServer())
          .post('/jobs/pra/scan')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            testMode: true,
            forceRefresh: false,
          })
          .expect(201);
      });

      it('should reject api-user from triggering PRA scan', async () => {
        await request(app.getHttpServer())
          .post('/jobs/pra/scan')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .send({
            testMode: true,
            forceRefresh: false,
          })
          .expect(403);
      });
    });

    describe('GET /jobs/board (Admin Only)', () => {
      it('should allow admin to access Bull Board info', async () => {
        await request(app.getHttpServer())
          .get('/jobs/board')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should reject api-user from accessing Bull Board info', async () => {
        await request(app.getHttpServer())
          .get('/jobs/board')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .expect(403);
      });
    });
  });

  describe('Analytics Endpoints (Flexible Auth)', () => {
    describe('GET /analytics/dashboard', () => {
      it('should allow admin with JWT', async () => {
        await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should allow api-user with JWT', async () => {
        await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .expect(200);
      });

      it('should allow access with API key', async () => {
        await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('x-api-key', apiKey)
          .expect(200);
      });

      it('should reject unauthenticated access', async () => {
        await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .expect(401);
      });

      it('should reject invalid API key', async () => {
        await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('x-api-key', 'invalid_key')
          .expect(401);
      });
    });

    describe('GET /analytics/export', () => {
      it('should allow admin to export data', async () => {
        await request(app.getHttpServer())
          .get('/analytics/export')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ format: 'json', dataset: 'hospitals' })
          .expect(200);
      });

      it('should allow api-user to export data', async () => {
        await request(app.getHttpServer())
          .get('/analytics/export')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .query({ format: 'json', dataset: 'hospitals' })
          .expect(200);
      });

      it('should allow export with API key', async () => {
        await request(app.getHttpServer())
          .get('/analytics/export')
          .set('x-api-key', apiKey)
          .query({ format: 'json', dataset: 'hospitals' })
          .expect(200);
      });
    });
  });

  describe('OData Endpoints (API Key Only)', () => {
    describe('GET /odata', () => {
      it('should allow access with valid API key', async () => {
        await request(app.getHttpServer())
          .get('/odata')
          .set('x-api-key', apiKey)
          .expect(200);
      });

      it('should reject access without API key', async () => {
        await request(app.getHttpServer())
          .get('/odata')
          .expect(401);
      });

      it('should reject access with JWT token (API key required)', async () => {
        await request(app.getHttpServer())
          .get('/odata')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(401);
      });

      it('should reject access with invalid API key', async () => {
        await request(app.getHttpServer())
          .get('/odata')
          .set('x-api-key', 'invalid_key')
          .expect(401);
      });
    });

    describe('GET /odata/hospitals', () => {
      it('should allow data access with valid API key', async () => {
        await request(app.getHttpServer())
          .get('/odata/hospitals')
          .set('x-api-key', apiKey)
          .expect(200);
      });

      it('should support OData query parameters', async () => {
        await request(app.getHttpServer())
          .get('/odata/hospitals')
          .set('x-api-key', apiKey)
          .query({ $top: 10, $select: 'name,state' })
          .expect(200);
      });
    });
  });

  describe('Bull Board Admin Interface', () => {
    describe('GET /admin/queues', () => {
      it('should reject access without authentication', async () => {
        await request(app.getHttpServer())
          .get('/admin/queues')
          .expect(401);
      });

      it('should reject api-user access', async () => {
        await request(app.getHttpServer())
          .get('/admin/queues')
          .set('Authorization', `Bearer ${apiUserToken}`)
          .expect(401);
      });

      it('should reject access with API key', async () => {
        await request(app.getHttpServer())
          .get('/admin/queues')
          .set('x-api-key', apiKey)
          .expect(401);
      });

      it('should allow admin access', async () => {
        // Note: This might return different status codes depending on Bull Board setup
        // but should not return 401 for admin
        const response = await request(app.getHttpServer())
          .get('/admin/queues')
          .set('Authorization', `Bearer ${adminToken}`);
        
        expect(response.status).not.toBe(401);
      });
    });
  });

  describe('Public Endpoints', () => {
    describe('GET /health', () => {
      it('should allow unauthenticated access', async () => {
        await request(app.getHttpServer())
          .get('/health')
          .expect(200);
      });
    });

    describe('GET /', () => {
      it('should allow unauthenticated access', async () => {
        await request(app.getHttpServer())
          .get('/')
          .expect(200);
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject malformed JWT tokens', async () => {
      await request(app.getHttpServer())
        .get('/jobs')
        .set('Authorization', 'Bearer malformed.jwt')
        .expect(401);
    });

    it('should reject expired JWT tokens', async () => {
      // This would require mocking JWT service to return expired token
      // For now, we test with invalid format
      await request(app.getHttpServer())
        .get('/jobs')
        .set('Authorization', 'Bearer expired.jwt.token')
        .expect(401);
    });

    it('should reject authorization header without Bearer prefix', async () => {
      await request(app.getHttpServer())
        .get('/jobs')
        .set('Authorization', 'NotBearer token')
        .expect(401);
    });

    it('should reject empty authorization header', async () => {
      await request(app.getHttpServer())
        .get('/jobs')
        .set('Authorization', '')
        .expect(401);
    });

    it('should handle case-sensitive headers correctly', async () => {
      await request(app.getHttpServer())
        .get('/odata')
        .set('X-API-KEY', apiKey) // Different case
        .expect(401); // Should fail because header name is case-sensitive
    });

    it('should reject API key with wrong prefix', async () => {
      await request(app.getHttpServer())
        .get('/odata')
        .set('x-api-key', 'wrong_prefix_123')
        .expect(401);
    });

    it('should handle concurrent authentication attempts', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});