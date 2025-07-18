import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { DatabaseService } from '../database/database.service';
import { PinoLogger } from 'nestjs-pino';
import { createClient } from 'redis';

// Mock the Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

describe('HealthService', () => {
  let service: HealthService;
  let databaseService: DatabaseService;
  let configService: ConfigService;
  let logger: PinoLogger;

  const mockDatabaseService = {
    healthCheck: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockRedisClient = {
    connect: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<PinoLogger>(PinoLogger);

    // Reset mocks
    (createClient as jest.Mock).mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock database health check
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      // Mock Redis health check
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('Glimmr API');
      expect(result.version).toBe('1.0.0');
      expect(result.checks.api).toBe('healthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.redis.status).toBe('healthy');
      expect(result.checks.memory).toHaveProperty('rss');
      expect(result.checks.memory).toHaveProperty('heapTotal');
      expect(result.checks.memory).toHaveProperty('heapUsed');
    });

    it('should return unhealthy status when database check fails', async () => {
      // Mock database health check failure
      mockDatabaseService.healthCheck.mockRejectedValue(new Error('Database connection failed'));

      // Mock Redis health check success
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('Database connection failed');
      expect(result.checks.redis.status).toBe('healthy');
    });

    it('should return unhealthy status when Redis check fails', async () => {
      // Mock database health check success
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      // Mock Redis health check failure
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.redis.status).toBe('unhealthy');
      expect(result.checks.redis.error).toBe('Redis connection failed');
    });

    it('should return unhealthy status when both checks fail', async () => {
      // Mock database health check failure
      mockDatabaseService.healthCheck.mockRejectedValue(new Error('Database error'));

      // Mock Redis health check failure
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockRejectedValue(new Error('Redis error'));

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('Database error');
      expect(result.checks.redis.status).toBe('unhealthy');
      expect(result.checks.redis.error).toBe('Redis error');
    });

    it('should handle Redis URL not configured', async () => {
      // Mock database health check success
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      // Mock Redis URL not configured
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.redis.status).toBe('unhealthy');
      expect(result.checks.redis.error).toBe('Redis URL not configured');
    });

    it('should include uptime and timestamp in response', async () => {
      // Mock database health check
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      // Mock Redis health check
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      const result = await service.getHealth();

      expect(result.uptime).toMatch(/^\d+s$/);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should include environment information', async () => {
      // Mock database health check
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 10,
          timestamp: new Date(),
        },
      });

      // Mock Redis health check
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      // Set NODE_ENV
      process.env.NODE_ENV = 'test';

      const result = await service.getHealth();

      expect(result.environment).toBe('test');
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database is accessible', async () => {
      mockDatabaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          duration: 15,
          timestamp: new Date(),
        },
      });

      // Access private method via any
      const result = await (service as any).checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.details.duration).toBe(15);
      expect(mockDatabaseService.healthCheck).toHaveBeenCalled();
    });

    it('should return unhealthy status when database throws error', async () => {
      const dbError = new Error('Connection timeout');
      mockDatabaseService.healthCheck.mockRejectedValue(dbError);

      const result = await (service as any).checkDatabaseHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection timeout');
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Database health check failed',
        error: 'Connection timeout',
      });
    });
  });

  describe('checkRedisHealth', () => {
    it('should return healthy status when Redis is accessible', async () => {
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('healthy');
      expect(result.details.duration).toBeGreaterThanOrEqual(0);
      expect(result.details.url).toBe('redis://localhost:6379');
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should hide password in URL', async () => {
      mockConfigService.get.mockReturnValue('redis://user:password@localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue('OK');

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('healthy');
      expect(result.details.url).toBe('redis://user:***@localhost:6379');
    });

    it('should return unhealthy status when Redis connection fails', async () => {
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      const redisError = new Error('ECONNREFUSED');
      mockRedisClient.connect.mockRejectedValue(redisError);

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('ECONNREFUSED');
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Redis health check failed',
        error: 'ECONNREFUSED',
      });
    });

    it('should return unhealthy status when Redis ping fails', async () => {
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      const pingError = new Error('Ping timeout');
      mockRedisClient.ping.mockRejectedValue(pingError);

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Ping timeout');
    });

    it('should handle Redis client quit errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('redis://localhost:6379');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockRejectedValue(new Error('Quit failed'));

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('healthy');
      expect(result.details.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when Redis URL is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await (service as any).checkRedisHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Redis URL not configured');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return formatted memory usage', () => {
      const originalMemoryUsage = process.memoryUsage;
      
      // Mock process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 104857600, // 100MB
        heapTotal: 52428800, // 50MB
        heapUsed: 31457280, // 30MB
        external: 1048576, // 1MB
        arrayBuffers: 0,
      });

      const result = (service as any).getMemoryUsage();

      expect(result).toEqual({
        rss: '100MB',
        heapTotal: '50MB',
        heapUsed: '30MB',
      });

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should handle fractional MB values', () => {
      const originalMemoryUsage = process.memoryUsage;
      
      // Mock process.memoryUsage with fractional values
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 157286400, // ~150MB
        heapTotal: 78643200, // ~75MB
        heapUsed: 47185920, // ~45MB
        external: 1048576,
        arrayBuffers: 0,
      });

      const result = (service as any).getMemoryUsage();

      expect(result).toEqual({
        rss: '150MB',
        heapTotal: '75MB',
        heapUsed: '45MB',
      });

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe('getHealth', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return health status object', async () => {
      const result = await service.getHealth();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should return status property', async () => {
      const result = await service.getHealth();
      expect(result.status).toBeDefined();
      expect(result.status).toBe('ok');
    });

    it('should return timestamp property', async () => {
      const result = await service.getHealth();
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return service property', async () => {
      const result = await service.getHealth();
      expect(result.service).toBeDefined();
      expect(result.service).toBe('Glimmr API');
    });

    it('should return version property', async () => {
      const result = await service.getHealth();
      expect(result.version).toBeDefined();
      expect(result.version).toBe('1.0.0');
    });

    it('should return uptime property', async () => {
      const result = await service.getHealth();
      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('string');
      expect(result.uptime).toMatch(/^\d+s$/);
    });

    it('should return environment property', async () => {
      const result = await service.getHealth();
      expect(result.environment).toBeDefined();
      expect(typeof result.environment).toBe('string');
    });

    it('should return checks property', async () => {
      const result = await service.getHealth();
      expect(result.checks).toBeDefined();
      expect(result.checks.api).toBe('healthy');
      expect(result.checks.memory).toBeDefined();
    });

    it('should return memory usage in checks', async () => {
      const result = await service.getHealth();
      expect(result.checks.memory.rss).toBeDefined();
      expect(result.checks.memory.heapTotal).toBeDefined();
      expect(result.checks.memory.heapUsed).toBeDefined();
      expect(result.checks.memory.rss).toMatch(/^\d+MB$/);
      expect(result.checks.memory.heapTotal).toMatch(/^\d+MB$/);
      expect(result.checks.memory.heapUsed).toMatch(/^\d+MB$/);
    });

    it('should return consistent service name', async () => {
      const result1 = await service.getHealth();
      const result2 = await service.getHealth();
      expect(result1.service).toBe(result2.service);
    });

    it('should return consistent version', async () => {
      const result1 = await service.getHealth();
      const result2 = await service.getHealth();
      expect(result1.version).toBe(result2.version);
    });

    it('should return consistent environment', async () => {
      const result1 = await service.getHealth();
      const result2 = await service.getHealth();
      expect(result1.environment).toBe(result2.environment);
    });

    it('should return valid timestamp format', async () => {
      const result = await service.getHealth();
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return recent timestamp', async () => {
      const result = await service.getHealth();
      const timestamp = new Date(result.timestamp);
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });
});