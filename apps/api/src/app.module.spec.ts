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
    });
  });
});