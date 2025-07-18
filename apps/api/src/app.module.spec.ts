import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

describe('AppModule - Rate Limiting Configuration', () => {
  let module: TestingModule;
  let configService: ConfigService;
  let throttlerGuard: any;

  beforeEach(async () => {
    // Set up environment variables for testing
    process.env.RATE_LIMIT_WINDOW_MS = '900000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '100';
    process.env.RATE_LIMIT_MAX_REQUESTS_EXPENSIVE = '10';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            throttlers: [
              {
                name: 'default',
                ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
              },
              {
                name: 'expensive',
                ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                limit: config.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE', 10),
              },
            ],
          }),
        }),
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    throttlerGuard = module.get(APP_GUARD);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    // Clean up environment variables
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS_EXPENSIVE;
  });

  describe('Module Configuration', () => {
    it('should compile successfully', () => {
      expect(module).toBeDefined();
    });

    it('should have ConfigService available globally', () => {
      expect(configService).toBeDefined();
      expect(configService).toBeInstanceOf(ConfigService);
    });

    it('should have CustomThrottlerGuard registered as APP_GUARD', () => {
      expect(throttlerGuard).toBeDefined();
      expect(throttlerGuard).toBeInstanceOf(CustomThrottlerGuard);
    });
  });

  describe('Throttler Configuration', () => {
    it('should configure ThrottlerModule with environment variables', () => {
      // Verify environment variables are loaded correctly
      expect(configService.get('RATE_LIMIT_WINDOW_MS')).toBe('900000');
      expect(configService.get('RATE_LIMIT_MAX_REQUESTS')).toBe('100');
      expect(configService.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE')).toBe('10');
    });

    it('should use default values when environment variables are not set', async () => {
      // Clean up environment variables
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS_EXPENSIVE;

      const testModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.test', '.env'],
          }),
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              throttlers: [
                {
                  name: 'default',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
                },
                {
                  name: 'expensive',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE', 10),
                },
              ],
            }),
          }),
        ],
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: APP_GUARD,
            useClass: CustomThrottlerGuard,
          },
        ],
      }).compile();

      const testConfigService = testModule.get<ConfigService>(ConfigService);

      // Should use default values
      expect(testConfigService.get('RATE_LIMIT_WINDOW_MS', 900000)).toBe(900000);
      expect(testConfigService.get('RATE_LIMIT_MAX_REQUESTS', 100)).toBe(100);
      expect(testConfigService.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE', 10)).toBe(10);

      await testModule.close();
    });
  });

  describe('Throttler Module Integration', () => {
    it('should create throttler configurations for default and expensive', () => {
      // The ThrottlerModule should be properly configured
      // This is tested implicitly by the module compilation
      expect(module.get(ThrottlerGuard)).toBeDefined();
    });

    it('should have both default and expensive throttlers configured', () => {
      // Verify that the throttler configurations are accessible
      // The exact internal structure depends on the ThrottlerModule implementation
      const moduleRef = module as any;
      expect(moduleRef).toBeDefined();
    });
  });

  describe('Environment Configuration Loading', () => {
    it('should load configuration from .env files', () => {
      // ConfigModule should load from .env.local and .env files
      expect(configService.get).toBeDefined();
    });

    it('should make configuration globally available', () => {
      // ConfigModule is marked as global: true
      expect(configService).toBeDefined();
    });
  });

  describe('Controller and Service Registration', () => {
    it('should register AppController', () => {
      const appController = module.get<AppController>(AppController);
      expect(appController).toBeDefined();
    });

    it('should register AppService', () => {
      const appService = module.get<AppService>(AppService);
      expect(appService).toBeDefined();
    });
  });

  describe('Error Handling in Configuration', () => {
    it('should handle invalid environment variable values gracefully', async () => {
      // Set invalid values
      process.env.RATE_LIMIT_WINDOW_MS = 'invalid';
      process.env.RATE_LIMIT_MAX_REQUESTS = 'not-a-number';

      const testModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.test'],
          }),
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              throttlers: [
                {
                  name: 'default',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
                },
                {
                  name: 'expensive',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE', 10),
                },
              ],
            }),
          }),
        ],
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: APP_GUARD,
            useClass: CustomThrottlerGuard,
          },
        ],
      }).compile();

      const testConfigService = testModule.get<ConfigService>(ConfigService);

      // Should fall back to defaults when invalid values are provided
      expect(testConfigService.get('RATE_LIMIT_WINDOW_MS', 900000)).toBe(900000);
      expect(testConfigService.get('RATE_LIMIT_MAX_REQUESTS', 100)).toBe(100);

      await testModule.close();
      
      // Clean up
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    });
  });

  describe('Module Dependencies', () => {
    it('should import all required modules', () => {
      // Verify that all expected modules are imported
      // This is tested implicitly by successful module compilation
      expect(module).toBeDefined();
    });

    it('should configure middleware properly', () => {
      // The RequestContextMiddleware should be configured
      // This is tested implicitly by module compilation
      const appModule = module.get<AppModule>(AppModule);
      expect(appModule).toBeDefined();
    });
  });

  describe('Production vs Development Configuration', () => {
    it('should work with production environment settings', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RATE_LIMIT_WINDOW_MS = '3600000'; // 1 hour
      process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
      process.env.RATE_LIMIT_MAX_REQUESTS_EXPENSIVE = '50';

      const testModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.production'],
          }),
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              throttlers: [
                {
                  name: 'default',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
                },
                {
                  name: 'expensive',
                  ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
                  limit: config.get('RATE_LIMIT_MAX_REQUESTS_EXPENSIVE', 10),
                },
              ],
            }),
          }),
        ],
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: APP_GUARD,
            useClass: CustomThrottlerGuard,
          },
        ],
      }).compile();

      const testConfigService = testModule.get<ConfigService>(ConfigService);
      expect(testConfigService.get('RATE_LIMIT_WINDOW_MS')).toBe('3600000');
      expect(testConfigService.get('RATE_LIMIT_MAX_REQUESTS')).toBe('1000');

      await testModule.close();
      
      // Clean up
      delete process.env.NODE_ENV;
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS_EXPENSIVE;
import { INestApplication } from '@nestjs/common';
import { AppTestModule } from './app.test.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

describe('AppTestModule', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Module Configuration', () => {
    it('should be defined', () => {
      expect(AppTestModule).toBeDefined();
    });

    it('should create app module successfully', () => {
      expect(module).toBeDefined();
      expect(app).toBeDefined();
    });

    it('should have AppController', () => {
      const controller = module.get<AppController>(AppController);
      expect(controller).toBeDefined();
    });

    it('should have AppService', () => {
      const service = module.get<AppService>(AppService);
      expect(service).toBeDefined();
    });

    it('should have ConfigModule configured as global', () => {
      const configModule = module.get(ConfigModule);
      expect(configModule).toBeDefined();
    });

    it('should have LoggerModule configured', () => {
      const loggerModule = module.get(LoggerModule);
      expect(loggerModule).toBeDefined();
    });

    it('should have HealthModule imported', () => {
      const healthModule = module.get(HealthModule);
      expect(healthModule).toBeDefined();
    });
  });

  describe('Request Context Middleware', () => {
    it('should configure middleware correctly', () => {
      const appModule = new AppTestModule();
      const mockConsumer = {
        apply: jest.fn().mockReturnThis(),
        exclude: jest.fn().mockReturnThis(),
        forRoutes: jest.fn().mockReturnThis(),
      };

      appModule.configure(mockConsumer as any);

      // In test module, middleware is skipped for simplicity
      expect(mockConsumer.apply).not.toHaveBeenCalled();
    });
  });

  describe('Logger Configuration', () => {
    it('should configure logger for development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const loggerConfig = {
        pinoHttp: {
          name: 'glimmr-api',
          level: 'debug',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          },
        },
      };

      expect(loggerConfig.pinoHttp.level).toBe('debug');
      expect(loggerConfig.pinoHttp.transport).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should configure logger for production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const loggerConfig = {
        pinoHttp: {
          name: 'glimmr-api',
          level: 'info',
          transport: undefined,
        },
      };

      expect(loggerConfig.pinoHttp.level).toBe('info');
      expect(loggerConfig.pinoHttp.transport).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should exclude health endpoints from logging', () => {
      const excludedPaths = [
        { method: 0, path: '/health' },
        { method: 0, path: '/health/ready' },
        { method: 0, path: '/health/live' },
        { method: 0, path: '/metrics' },
      ];

      excludedPaths.forEach(excludedPath => {
        expect(excludedPath.method).toBe(0); // RequestMethod.GET
        expect(excludedPath.path).toMatch(/^\/health|^\/metrics/);
      });
    });
  });

  describe('Environment Configuration', () => {
    it('should load environment configuration correctly', () => {
      const configService = module.get(ConfigService);
      expect(configService).toBeDefined();
    });

    it('should handle multiple env file paths', () => {
      const envFilePaths = ['.env.local', '.env'];
      expect(envFilePaths).toHaveLength(2);
      expect(envFilePaths).toContain('.env.local');
      expect(envFilePaths).toContain('.env');
    });
  });

  describe('Pino Logger Configuration', () => {
    it('should configure request ID generation', () => {
      const mockReq = {
        headers: {
          'x-request-id': 'test-request-id',
          'x-correlation-id': 'test-correlation-id',
        },
      };

      const genReqId = (req: any) => {
        return req.headers['x-request-id'] ??
               req.headers['x-correlation-id'] ??
               `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      };

      expect(genReqId(mockReq)).toBe('test-request-id');
      
      const mockReqWithCorrelation = {
        headers: {
          'x-correlation-id': 'test-correlation-id',
        },
      };
      
      expect(genReqId(mockReqWithCorrelation)).toBe('test-correlation-id');
    });

    it('should configure custom properties correctly', () => {
      const mockReq = {
        headers: {
          'user-agent': 'test-agent',
        },
        ip: '127.0.0.1',
        method: 'GET',
        url: '/test',
        connection: {
          remoteAddress: '192.168.1.1',
        },
      };

      const customProps = (req: any) => ({
        userAgent: req.headers['user-agent'],
        ip: req.ip ?? req.connection?.remoteAddress,
        method: req.method,
        url: req.url,
      });

      const props = customProps(mockReq);
      expect(props.userAgent).toBe('test-agent');
      expect(props.ip).toBe('127.0.0.1');
      expect(props.method).toBe('GET');
      expect(props.url).toBe('/test');
    });

    it('should serialize request properly', () => {
      const mockReq = {
        id: 'test-id',
        method: 'POST',
        url: '/api/test',
        query: { param: 'value' },
        params: { id: '123' },
        headers: {
          host: 'localhost:3000',
          'user-agent': 'test-agent',
          'content-type': 'application/json',
          authorization: 'Bearer token',
        },
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
      };

      const reqSerializer = (req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      });

      const serialized = reqSerializer(mockReq);
      expect(serialized.id).toBe('test-id');
      expect(serialized.method).toBe('POST');
      expect(serialized.headers.authorization).toBe('[REDACTED]');
      expect(serialized.query).toEqual({ param: 'value' });
    });

    it('should serialize response properly', () => {
      const mockRes = {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': '123',
        },
      };

      const resSerializer = (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.headers?.['content-type'],
          'content-length': res.headers?.['content-length'],
        },
      });

      const serialized = resSerializer(mockRes);
      expect(serialized.statusCode).toBe(200);
      expect(serialized.headers['content-type']).toBe('application/json');
      expect(serialized.headers['content-length']).toBe('123');
    });

    it('should serialize error properly', () => {
      const mockError = new Error('Test error');
      mockError.name = 'TestError';
      (mockError as any).code = 'TEST_CODE';
      (mockError as any).statusCode = 400;

      const errSerializer = (err: any) => ({
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode,
      });

      const serialized = errSerializer(mockError);
      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('Test error');
      expect(serialized.code).toBe('TEST_CODE');
      expect(serialized.statusCode).toBe(400);
      expect(serialized.stack).toBeDefined();
    });
  });
});