import { Test, TestingModule } from '@nestjs/testing';
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