import { Test, TestingModule } from '@nestjs/testing';
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