import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn(),
    getPricingTrends: jest.fn(),
    getPowerBIInfo: jest.fn(),
    exportData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
});