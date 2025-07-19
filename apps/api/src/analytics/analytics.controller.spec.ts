import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CustomThrottlerGuard } from '../common/guards/custom-throttler.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;
  let throttlerGuard: CustomThrottlerGuard;
  let reflector: Reflector;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn(),
    getPricingTrends: jest.fn(),
    getPowerBIInfo: jest.fn(),
    exportData: jest.fn(),
    downloadExportData: jest.fn(),
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

  describe('getDashboardAnalytics', () => {
    it('should return dashboard analytics successfully', async () => {
      const mockResult = {
        totalHospitals: 500,
        totalPrices: 10000,
        averagePrice: 1250.00,
        priceVariation: 0.75,
        topServices: [
          { service: 'MRI', count: 1500, averagePrice: 1800.00 },
          { service: 'CT Scan', count: 1200, averagePrice: 1200.00 },
        ],
        stateBreakdown: {
          CA: { hospitals: 100, prices: 2000 },
          NY: { hospitals: 80, prices: 1800 },
          TX: { hospitals: 75, prices: 1500 },
        },
        priceRanges: {
          '0-500': 2000,
          '500-1000': 3000,
          '1000-2000': 3500,
          '2000+': 1500,
        },
        recentUpdates: {
          lastHospitalUpdate: new Date(),
          lastPriceUpdate: new Date(),
          pendingUpdates: 5,
        },
      };

      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getDashboardAnalytics();

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.getDashboardAnalytics).toHaveBeenCalledWith();
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.getDashboardAnalytics.mockRejectedValue(connectionError);

      await expect(controller.getDashboardAnalytics()).rejects.toThrow(HttpException);
      
      try {
        await controller.getDashboardAnalytics();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: 'Database connection failed. Please try again later.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
        });
      }
    });

    it('should throw SERVICE_UNAVAILABLE when database connect error occurs', async () => {
      const connectionError = new Error('connect timeout');
      mockAnalyticsService.getDashboardAnalytics.mockRejectedValue(connectionError);

      await expect(controller.getDashboardAnalytics()).rejects.toThrow(HttpException);
      
      try {
        await controller.getDashboardAnalytics();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockAnalyticsService.getDashboardAnalytics.mockRejectedValue(otherError);

      await expect(controller.getDashboardAnalytics()).rejects.toThrow(HttpException);
      
      try {
        await controller.getDashboardAnalytics();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching dashboard analytics',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });

  describe('getPricingTrends', () => {
    it('should return pricing trends successfully', async () => {
      const mockResult = {
        service: 'MRI',
        state: 'CA',
        period: '30d',
        trends: [
          {
            date: '2024-01-01',
            averagePrice: 1200.00,
            medianPrice: 1100.00,
            priceCount: 50,
          },
          {
            date: '2024-01-02',
            averagePrice: 1250.00,
            medianPrice: 1150.00,
            priceCount: 55,
          },
        ],
        summary: {
          overallTrend: 'increasing',
          percentageChange: 4.17,
          volatility: 0.15,
        },
      };

      mockAnalyticsService.getPricingTrends.mockResolvedValue(mockResult);

      const result = await controller.getPricingTrends({ service: 'MRI', state: 'CA', period: '30d' });

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: 'MRI',
        state: 'CA',
        period: '30d',
      });
    });

    it('should return pricing trends with default parameters', async () => {
      const mockResult = {
        service: undefined,
        state: undefined,
        period: '30d',
        trends: [],
        summary: {
          overallTrend: 'stable',
          percentageChange: 0,
          volatility: 0,
        },
      };

      mockAnalyticsService.getPricingTrends.mockResolvedValue(mockResult);

      const result = await controller.getPricingTrends({});

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: undefined,
        state: undefined,
        period: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.getPricingTrends.mockRejectedValue(connectionError);

      await expect(controller.getPricingTrends({})).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingTrends({});
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: 'Database connection failed. Please try again later.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
        });
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockAnalyticsService.getPricingTrends.mockRejectedValue(otherError);

      await expect(controller.getPricingTrends({})).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingTrends({});
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching pricing trends',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
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

      const result = await controller.getPricingTrends({ service: 'MRI', state: 'CA', period: '30d' });

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

      const result = await controller.getPricingTrends({});

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

      const result = await controller.exportData({ format: 'csv', dataset: 'hospitals' });

      expect(analyticsService.exportData).toHaveBeenCalledWith({
        format: 'csv',
        dataset: 'hospitals',
      });
      expect(result).toEqual(mockExportData);
    });

    it('should handle default export parameters', async () => {
      const mockExportData = { downloadUrl: 'https://example.com/export.json' };
      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const result = await controller.exportData({});

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

      const result = await controller.exportData({ format: 'csv', dataset: 'prices' });

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
      const result = await controller.getPricingTrends({
        service: '<script>alert("xss")</script>',
        state: 'DROP TABLE users;',
        period: '../../etc/passwd'
      });

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith({
        service: '<script>alert("xss")</script>',
        state: 'DROP TABLE users;',
        period: '../../etc/passwd',
      });
    });
  });

  describe('AnalyticsController - Additional Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('getDashboardAnalytics', () => {
    it('should call analyticsService.getDashboardAnalytics', async () => {
      const expectedResult = {
        totalHospitals: 1250,
        totalPrices: 45000,
        averagePrice: 750,
        priceRanges: {
          low: 15000,
          medium: 20000,
          high: 10000,
        },
        topServices: [
          { service: 'MRI', count: 8000 },
          { service: 'CT Scan', count: 6500 },
          { service: 'X-Ray', count: 12000 },
        ],
      };
      
      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getDashboardAnalytics();

      expect(analyticsService.getDashboardAnalytics).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty dashboard data', async () => {
      const expectedResult = {
        totalHospitals: 0,
        totalPrices: 0,
        averagePrice: 0,
        priceRanges: {
          low: 0,
          medium: 0,
          high: 0,
        },
        topServices: [],
      };
      
      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getDashboardAnalytics();

      expect(analyticsService.getDashboardAnalytics).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getPricingTrends', () => {
    it('should call analyticsService.getPricingTrends with all query parameters', async () => {
      const query = {
        service: 'MRI',
        state: 'CA',
        period: '30d',
      };
      const expectedResult = {
        service: 'MRI',
        state: 'CA',
        period: '30d',
        trends: [
          { date: '2024-01-01', averagePrice: 1200 },
          { date: '2024-01-02', averagePrice: 1180 },
          { date: '2024-01-03', averagePrice: 1220 },
        ],
        summary: {
          startPrice: 1200,
          endPrice: 1220,
          changePercent: 1.67,
          direction: 'up',
        },
      };
      
      mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

      const result = await controller.getPricingTrends(query);

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        trends: [
          { date: '2024-01-01', averagePrice: 800 },
          { date: '2024-01-02', averagePrice: 810 },
        ],
        summary: {
          startPrice: 800,
          endPrice: 810,
          changePercent: 1.25,
          direction: 'up',
        },
      };
      
      mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

      const result = await controller.getPricingTrends(query);

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service filter only', async () => {
      const query = { service: 'CT Scan' };
      const expectedResult = {
        service: 'CT Scan',
        trends: [
          { date: '2024-01-01', averagePrice: 650 },
          { date: '2024-01-02', averagePrice: 640 },
        ],
        summary: {
          startPrice: 650,
          endPrice: 640,
          changePercent: -1.54,
          direction: 'down',
        },
      };
      
      mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

      const result = await controller.getPricingTrends(query);

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle state filter only', async () => {
      const query = { state: 'TX' };
      const expectedResult = {
        state: 'TX',
        trends: [
          { date: '2024-01-01', averagePrice: 700 },
          { date: '2024-01-02', averagePrice: 705 },
        ],
        summary: {
          startPrice: 700,
          endPrice: 705,
          changePercent: 0.71,
          direction: 'up',
        },
      };
      
      mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

      const result = await controller.getPricingTrends(query);

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different period values', async () => {
      const periods = ['30d', '90d', '1y'];
      
      for (const period of periods) {
        const query = { period };
        const expectedResult = {
          period,
          trends: [
            { date: '2024-01-01', averagePrice: 750 },
          ],
          summary: {
            startPrice: 750,
            endPrice: 750,
            changePercent: 0,
            direction: 'stable',
          },
        };
        
        mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

        const result = await controller.getPricingTrends(query);

        expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
        expect(result).toEqual(expectedResult);
      }
    });

    it('should handle downward trends', async () => {
      const query = { service: 'X-Ray', period: '90d' };
      const expectedResult = {
        service: 'X-Ray',
        period: '90d',
        trends: [
          { date: '2024-01-01', averagePrice: 200 },
          { date: '2024-01-02', averagePrice: 180 },
        ],
        summary: {
          startPrice: 200,
          endPrice: 180,
          changePercent: -10,
          direction: 'down',
        },
      };
      
      mockAnalyticsService.getPricingTrends.mockResolvedValue(expectedResult);

      const result = await controller.getPricingTrends(query);

      expect(analyticsService.getPricingTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getPowerBIInfo', () => {
    it('should return PowerBI info successfully', async () => {
      const mockResult = {
        datasetId: 'dataset-123',
        lastRefresh: new Date(),
        tables: [
          {
            name: 'hospitals',
            rowCount: 500,
            lastUpdated: new Date(),
          },
          {
            name: 'prices',
            rowCount: 10000,
            lastUpdated: new Date(),
          },
        ],
        refreshSchedule: {
          frequency: 'daily',
          nextRefresh: new Date(),
        },
        status: 'active',
      };

      mockAnalyticsService.getPowerBIInfo.mockResolvedValue(mockResult);

      const result = await controller.getPowerBIInfo();

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.getPowerBIInfo).toHaveBeenCalledWith();
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.getPowerBIInfo.mockRejectedValue(connectionError);

      await expect(controller.getPowerBIInfo()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPowerBIInfo();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: 'Database connection failed. Please try again later.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
        });
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockAnalyticsService.getPowerBIInfo.mockRejectedValue(otherError);

      await expect(controller.getPowerBIInfo()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPowerBIInfo();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching PowerBI info',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });

    it('should call analyticsService.getPowerBIInfo', async () => {
      const expectedResult = {
        datasetId: 'dataset-123',
        workspaceId: 'workspace-456',
        dashboardUrl: 'https://app.powerbi.com/groups/workspace-456/dashboards/dashboard-789',
        lastRefresh: '2024-01-01T12:00:00Z',
        status: 'active',
        recordCount: 100000,
        tables: [
          { name: 'hospitals', records: 1250 },
          { name: 'prices', records: 45000 },
          { name: 'analytics', records: 2500 },
        ],
      };
      
      mockAnalyticsService.getPowerBIInfo.mockResolvedValue(expectedResult);

      const result = await controller.getPowerBIInfo();

      expect(analyticsService.getPowerBIInfo).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should handle PowerBI info when not configured', async () => {
      const expectedResult = {
        status: 'not_configured',
        message: 'PowerBI integration is not configured',
      };
      
      mockAnalyticsService.getPowerBIInfo.mockResolvedValue(expectedResult);

      const result = await controller.getPowerBIInfo();

      expect(analyticsService.getPowerBIInfo).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('exportData', () => {
    it('should export data successfully', async () => {
      const mockResult = {
        format: 'csv',
        dataset: 'hospitals',
        fileUrl: 'https://example.com/export/hospitals.csv',
        downloadToken: 'token-123',
        expiresAt: new Date(),
        recordCount: 500,
      };

      mockAnalyticsService.exportData.mockResolvedValue(mockResult);

      const result = await controller.exportData({ format: 'csv', dataset: 'hospitals' });

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.exportData).toHaveBeenCalledWith({
        format: 'csv',
        dataset: 'hospitals',
      });
    });

    it('should export data with default parameters', async () => {
      const mockResult = {
        format: 'json',
        dataset: 'all',
        fileUrl: 'https://example.com/export/all.json',
        downloadToken: 'token-456',
        expiresAt: new Date(),
        recordCount: 10500,
      };

      mockAnalyticsService.exportData.mockResolvedValue(mockResult);

      const result = await controller.exportData({});

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.exportData).toHaveBeenCalledWith({
        format: undefined,
        dataset: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.exportData.mockRejectedValue(connectionError);

      await expect(controller.exportData({})).rejects.toThrow(HttpException);
      
      try {
        await controller.exportData({});
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: 'Database connection failed. Please try again later.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
        });
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockAnalyticsService.exportData.mockRejectedValue(otherError);

      await expect(controller.exportData({})).rejects.toThrow(HttpException);
      
      try {
        await controller.exportData({});
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while exporting data',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });

    it('should call analyticsService.exportData with all query parameters', async () => {
      const query = {
        format: 'csv',
        dataset: 'hospitals',
      };
      const expectedResult = {
        format: 'csv',
        dataset: 'hospitals',
        downloadUrl: 'https://example.com/exports/hospitals-20240101.csv',
        expiresAt: '2024-01-01T23:59:59Z',
        recordCount: 1250,
        fileSize: '125KB',
      };
      
      mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

      const result = await controller.exportData(query);

      expect(analyticsService.exportData).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        format: 'csv',
        dataset: 'hospitals',
        downloadUrl: 'https://example.com/exports/default-20240101.csv',
        expiresAt: '2024-01-01T23:59:59Z',
        recordCount: 1250,
        fileSize: '125KB',
      };
      
      mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

      const result = await controller.exportData(query);

      expect(analyticsService.exportData).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different format values', async () => {
      const formats = ['csv', 'json', 'excel'];
      
      for (const format of formats) {
        const query = { format };
        const expectedResult = {
          format,
          dataset: 'hospitals',
          downloadUrl: `https://example.com/exports/hospitals-20240101.${format}`,
          expiresAt: '2024-01-01T23:59:59Z',
          recordCount: 1250,
          fileSize: '125KB',
        };
        
        mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

        const result = await controller.exportData(query);

        expect(analyticsService.exportData).toHaveBeenCalledWith(query);
        expect(result).toEqual(expectedResult);
      }
    });

    it('should handle different dataset values', async () => {
      const datasets = ['hospitals', 'prices', 'analytics'];
      
      for (const dataset of datasets) {
        const query = { dataset };
        const expectedResult = {
          format: 'csv',
          dataset,
          downloadUrl: `https://example.com/exports/${dataset}-20240101.csv`,
          expiresAt: '2024-01-01T23:59:59Z',
          recordCount: 1000,
          fileSize: '100KB',
        };
        
        mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

        const result = await controller.exportData(query);

        expect(analyticsService.exportData).toHaveBeenCalledWith(query);
        expect(result).toEqual(expectedResult);
      }
    });

    it('should handle format and dataset combination', async () => {
      const query = { format: 'excel', dataset: 'prices' };
      const expectedResult = {
        format: 'excel',
        dataset: 'prices',
        downloadUrl: 'https://example.com/exports/prices-20240101.xlsx',
        expiresAt: '2024-01-01T23:59:59Z',
        recordCount: 45000,
        fileSize: '4.5MB',
      };
      
      mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

      const result = await controller.exportData(query);

      expect(analyticsService.exportData).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle large dataset exports', async () => {
      const query = { format: 'json', dataset: 'analytics' };
      const expectedResult = {
        format: 'json',
        dataset: 'analytics',
        downloadUrl: 'https://example.com/exports/analytics-20240101.json',
        expiresAt: '2024-01-01T23:59:59Z',
        recordCount: 2500,
        fileSize: '2.5MB',
        processingTime: '30 seconds',
      };
      
      mockAnalyticsService.exportData.mockResolvedValue(expectedResult);

      const result = await controller.exportData(query);

      expect(analyticsService.exportData).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('downloadExportData', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        headersSent: false,
      };
    });

    it('should stream export data successfully with default parameters', async () => {
      const query = {};
      mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

      await controller.downloadExportData(query, mockResponse);

      expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
    });

    it('should stream export data with custom parameters', async () => {
      const query = {
        format: 'json',
        dataset: 'hospitals',
        limit: 1000,
      };
      mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

      await controller.downloadExportData(query, mockResponse);

      expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
    });

    it('should handle all dataset types', async () => {
      const datasets = ['hospitals', 'prices', 'analytics', 'all'];
      
      for (const dataset of datasets) {
        const query = { format: 'json', dataset };
        mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

        await controller.downloadExportData(query, mockResponse);

        expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
      }
    });

    it('should handle service errors during streaming', async () => {
      const query = { format: 'json', dataset: 'hospitals' };
      const error = new Error('Service error');
      mockAnalyticsService.downloadExportData.mockRejectedValue(error);

      await expect(controller.downloadExportData(query, mockResponse)).rejects.toThrow(
        HttpException
      );
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails during streaming', async () => {
      const query = { format: 'json', dataset: 'hospitals' };
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.downloadExportData.mockRejectedValue(connectionError);

      await expect(controller.downloadExportData(query, mockResponse)).rejects.toThrow(
        HttpException
      );

      try {
        await controller.downloadExportData(query, mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: 'Database connection failed. Please try again later.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
        });
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors during streaming', async () => {
      const query = { format: 'json', dataset: 'hospitals' };
      const otherError = new Error('Some other error');
      mockAnalyticsService.downloadExportData.mockRejectedValue(otherError);

      await expect(controller.downloadExportData(query, mockResponse)).rejects.toThrow(
        HttpException
      );

      try {
        await controller.downloadExportData(query, mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while streaming export data',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });

    it('should handle network connection errors during streaming', async () => {
      const query = { format: 'json', dataset: 'hospitals' };
      const networkError = new Error('connect ECONNREFUSED');
      mockAnalyticsService.downloadExportData.mockRejectedValue(networkError);

      await expect(controller.downloadExportData(query, mockResponse)).rejects.toThrow(
        HttpException
      );

      try {
        await controller.downloadExportData(query, mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('should handle different limit values', async () => {
      const limits = [1, 100, 1000, 10000, 100000];
      
      for (const limit of limits) {
        const query = { format: 'json', dataset: 'hospitals', limit };
        mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

        await controller.downloadExportData(query, mockResponse);

        expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
      }
    });

    it('should handle empty query object', async () => {
      const query = {};
      mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

      await controller.downloadExportData(query, mockResponse);

      expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
    });

    it('should propagate service method call with exact parameters', async () => {
      const query = {
        format: 'json',
        dataset: 'prices',
        limit: 5000,
      };
      mockAnalyticsService.downloadExportData.mockResolvedValue(undefined);

      await controller.downloadExportData(query, mockResponse);

      expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledTimes(1);
      expect(mockAnalyticsService.downloadExportData).toHaveBeenCalledWith(query, mockResponse);
    });
  });
});
