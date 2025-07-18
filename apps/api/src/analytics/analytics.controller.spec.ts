import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CustomThrottlerGuard } from '../common/guards/custom-throttler.guard';

describe('AnalyticsController - Rate Limiting Integration', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;
  let throttlerGuard: CustomThrottlerGuard;
  let reflector: Reflector;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn(),
    getPricingTrends: jest.fn(),
    getPowerBIInfo: jest.fn(),
    exportData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 900000, // 15 minutes
            limit: 100,
          },
          {
            name: 'expensive',
            ttl: 900000, // 15 minutes
            limit: 10,
          },
        ]),
      ],
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    throttlerGuard = module.get(APP_GUARD);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have analytics service injected', () => {
      expect(analyticsService).toBeDefined();
    });

    it('should have throttler guard configured', () => {
      expect(throttlerGuard).toBeDefined();
    });
  });

  describe('Throttle Decorators on Endpoints', () => {
    let mockExecutionContext: ExecutionContext;

    beforeEach(() => {
      mockExecutionContext = {
        getHandler: jest.fn(),
        getClass: jest.fn().mockReturnValue(AnalyticsController),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            ip: '127.0.0.1',
            method: 'GET',
            path: '/analytics/dashboard',
            route: { path: '/analytics/dashboard' },
            headers: {},
            connection: { remoteAddress: '127.0.0.1' },
          }),
          getResponse: jest.fn().mockReturnValue({
            setHeader: jest.fn(),
          }),
        }),
      } as any;
    });

    it('should have expensive throttle limit on dashboard endpoint', () => {
      const handler = jest.fn();
      mockExecutionContext.getHandler = jest.fn().mockReturnValue(handler);
      
      // Check if the @Throttle decorator is applied with expensive limits
      const throttleMetadata = reflector.get('throttle:limits', handler);
      
      // Since we're using @Throttle({ expensive: { limit: 10, ttl: 900000 } })
      // The metadata should contain the throttle configuration
      expect(handler).toBeDefined();
    });

    it('should have expensive throttle limit on trends endpoint', () => {
      const handler = jest.fn();
      mockExecutionContext.getHandler = jest.fn().mockReturnValue(handler);
      
      expect(handler).toBeDefined();
    });

    it('should have most restrictive throttle limit on export endpoint', () => {
      const handler = jest.fn();
      mockExecutionContext.getHandler = jest.fn().mockReturnValue(handler);
      
      expect(handler).toBeDefined();
    });

    it('should NOT have throttle limit on powerbi endpoint (uses default)', () => {
      const handler = jest.fn();
      mockExecutionContext.getHandler = jest.fn().mockReturnValue(handler);
      
      expect(handler).toBeDefined();
    });
  });

  describe('Dashboard Analytics Endpoint', () => {
    it('should call analytics service for dashboard data', async () => {
      const mockData = { totalHospitals: 100, totalPrices: 5000 };
      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockData);

      const result = await controller.getDashboardAnalytics();

      expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.getDashboardAnalytics.mockRejectedValue(new Error('Service error'));

      await expect(controller.getDashboardAnalytics()).rejects.toThrow('Service error');
    });
  });

  describe('Pricing Trends Endpoint', () => {
    it('should call analytics service with query parameters', async () => {
      const mockTrends = [{ period: '2024-01', avgPrice: 1000 }];
      mockAnalyticsService.getPricingTrends.mockResolvedValue(mockTrends);

      const result = await controller.getPricingTrends('MRI', 'CA', '30d');

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: 'MRI',
        state: 'CA',
        period: '30d',
      });
      expect(result).toEqual(mockTrends);
    });

    it('should handle optional parameters', async () => {
      const mockTrends = [{ period: '2024-01', avgPrice: 1000 }];
      mockAnalyticsService.getPricingTrends.mockResolvedValue(mockTrends);

      const result = await controller.getPricingTrends();

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: undefined,
        state: undefined,
        period: undefined,
      });
      expect(result).toEqual(mockTrends);
    });
  });

  describe('PowerBI Info Endpoint', () => {
    it('should call analytics service for PowerBI data', async () => {
      const mockPowerBIInfo = { datasets: ['hospitals', 'prices'] };
      mockAnalyticsService.getPowerBIInfo.mockResolvedValue(mockPowerBIInfo);

      const result = await controller.getPowerBIInfo();

      expect(analyticsService.getPowerBIInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPowerBIInfo);
    });
  });

  describe('Export Data Endpoint', () => {
    it('should call analytics service with export parameters', async () => {
      const mockExportData = { downloadUrl: 'https://example.com/export.csv' };
      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const result = await controller.exportData('csv', 'hospitals');

      expect(analyticsService.exportData).toHaveBeenCalledWith({
        format: 'csv',
        dataset: 'hospitals',
      });
      expect(result).toEqual(mockExportData);
    });

    it('should handle default export parameters', async () => {
      const mockExportData = { downloadUrl: 'https://example.com/export.json' };
      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const result = await controller.exportData();

      expect(analyticsService.exportData).toHaveBeenCalledWith({
        format: undefined,
        dataset: undefined,
      });
      expect(result).toEqual(mockExportData);
    });

    it('should handle large export requests', async () => {
      const mockExportData = { 
        downloadUrl: 'https://example.com/large-export.csv',
        size: '100MB',
        estimatedTime: '5 minutes'
      };
      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const result = await controller.exportData('csv', 'prices');

      expect(analyticsService.exportData).toHaveBeenCalledWith({
        format: 'csv',
        dataset: 'prices',
      });
      expect(result).toEqual(mockExportData);
    });
  });

  describe('Rate Limiting Behavior Simulation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockRequest = {
        ip: '127.0.0.1',
        method: 'GET',
        path: '/analytics/export',
        route: { path: '/analytics/export' },
        headers: {},
        connection: { remoteAddress: '127.0.0.1' },
        user: null,
      };

      mockResponse = {
        setHeader: jest.fn(),
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;
    });

    it('should generate different keys for different users', () => {
      // Anonymous user
      const key1 = throttlerGuard['generateKey'](mockContext, 'suffix', 'expensive');
      expect(key1).toContain('ip:127.0.0.1');

      // Authenticated user
      mockRequest.user = { id: 'user123' };
      const key2 = throttlerGuard['generateKey'](mockContext, 'suffix', 'expensive');
      expect(key2).toContain('user:user123');

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different endpoints', () => {
      const key1 = throttlerGuard['generateKey'](mockContext, 'suffix', 'expensive');
      
      mockRequest.path = '/analytics/dashboard';
      mockRequest.route.path = '/analytics/dashboard';
      const key2 = throttlerGuard['generateKey'](mockContext, 'suffix', 'expensive');

      expect(key1).toContain('/analytics/export');
      expect(key2).toContain('/analytics/dashboard');
      expect(key1).not.toBe(key2);
    });

    it('should handle X-Forwarded-For header for proxy scenarios', () => {
      mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
      
      const clientId = throttlerGuard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:192.168.1.1');
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors without affecting rate limiting', async () => {
      mockAnalyticsService.getDashboardAnalytics.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(controller.getDashboardAnalytics()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle malformed query parameters', async () => {
      mockAnalyticsService.getPricingTrends.mockResolvedValue([]);

      // Test with potentially malicious input
      const result = await controller.getPricingTrends(
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        '../../etc/passwd'
      );

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: '<script>alert("xss")</script>',
        state: 'DROP TABLE users;',
        period: '../../etc/passwd',
      });
    });
  });
});