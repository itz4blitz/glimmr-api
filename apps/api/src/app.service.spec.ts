import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getApiInfo', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return an object', () => {
      const result = service.getApiInfo();
      expect(typeof result).toBe('object');
    });

    it('should return api info with required properties', () => {
      const result = service.getApiInfo();
      expect(result.name).toBe('Glimmr API');
      expect(result.version).toBe('1.0.0');
      expect(result.description).toBe('Hospital pricing data aggregation and analytics platform');
      expect(result.status).toBe('operational');
      expect(result.timestamp).toBeDefined();
      expect(result.endpoints).toBeDefined();
    });

    it('should return consistent result', () => {
      const result1 = service.getApiInfo();
      const result2 = service.getApiInfo();
      expect(result1.name).toBe(result2.name);
      expect(result1.version).toBe(result2.version);
      expect(result1.description).toBe(result2.description);
      expect(result1.status).toBe(result2.status);
    });

    it('should return endpoints object', () => {
      const result = service.getApiInfo();
      expect(result.endpoints).toBeDefined();
      expect(result.endpoints.health).toBe('/api/v1/health');
      expect(result.endpoints.docs).toBe('/api/v1/docs');
    });

    it('should return valid timestamp', () => {
      const result = service.getApiInfo();
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });
});