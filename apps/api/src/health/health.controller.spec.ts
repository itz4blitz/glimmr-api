import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockHealthService = {
    getHealth: jest.fn(),
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return 200 status when service is healthy', async () => {
      const mockHealthResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: '300s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'test',
        checks: {
          api: 'healthy',
          memory: {
            rss: '100MB',
            heapTotal: '50MB',
            heapUsed: '30MB',
          },
          database: {
            status: 'healthy',
            details: {
              duration: 10,
              timestamp: new Date(),
            },
          },
          redis: {
            status: 'healthy',
            details: {
              duration: 5,
              url: 'redis://localhost:6379',
            },
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
      expect(mockHealthService.getHealth).toHaveBeenCalledWith();
    });

    it('should return 503 status when service is unhealthy', async () => {
      const mockHealthResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: '300s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'test',
        checks: {
          api: 'healthy',
          memory: {
            rss: '100MB',
            heapTotal: '50MB',
            heapUsed: '30MB',
          },
          database: {
            status: 'unhealthy',
            error: 'Connection failed',
          },
          redis: {
            status: 'healthy',
            details: {
              duration: 5,
              url: 'redis://localhost:6379',
            },
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
      expect(mockHealthService.getHealth).toHaveBeenCalledWith();
    });

    it('should return 503 status when database is unhealthy', async () => {
      const mockHealthResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: '300s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'test',
        checks: {
          api: 'healthy',
          memory: {
            rss: '100MB',
            heapTotal: '50MB',
            heapUsed: '30MB',
          },
          database: {
            status: 'unhealthy',
            error: 'ECONNREFUSED',
          },
          redis: {
            status: 'healthy',
            details: {
              duration: 5,
              url: 'redis://localhost:6379',
            },
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
    });

    it('should return 503 status when Redis is unhealthy', async () => {
      const mockHealthResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: '300s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'test',
        checks: {
          api: 'healthy',
          memory: {
            rss: '100MB',
            heapTotal: '50MB',
            heapUsed: '30MB',
          },
          database: {
            status: 'healthy',
            details: {
              duration: 10,
              timestamp: new Date(),
            },
          },
          redis: {
            status: 'unhealthy',
            error: 'Connection timeout',
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Health service failed');
      mockHealthService.getHealth.mockRejectedValue(serviceError);

      await expect(controller.getHealth(mockResponse as any)).rejects.toThrow(serviceError);

      expect(mockHealthService.getHealth).toHaveBeenCalledWith();
    });

    it('should handle mixed health status correctly', async () => {
      const mockHealthResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: '300s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'test',
        checks: {
          api: 'healthy',
          memory: {
            rss: '100MB',
            heapTotal: '50MB',
            heapUsed: '30MB',
          },
          database: {
            status: 'healthy',
            details: {
              duration: 10,
              timestamp: new Date(),
            },
          },
          redis: {
            status: 'unhealthy',
            error: 'Connection refused',
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
    });

    it('should return health status with all components healthy', async () => {
      const mockHealthResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: '1200s',
        version: '1.0.0',
        service: 'Glimmr API',
        environment: 'production',
        checks: {
          api: 'healthy',
          memory: {
            rss: '150MB',
            heapTotal: '80MB',
            heapUsed: '60MB',
          },
          database: {
            status: 'healthy',
            details: {
              duration: 8,
              timestamp: new Date(),
            },
          },
          redis: {
            status: 'healthy',
            details: {
              duration: 3,
              url: 'redis://redis:6379',
            },
          },
        },
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResult);

      await controller.getHealth(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthResult);
      expect(mockHealthService.getHealth).toHaveBeenCalledWith();
    });
  });
});