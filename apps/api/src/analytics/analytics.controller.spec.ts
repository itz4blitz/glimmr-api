import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

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
    service = module.get<AnalyticsService>(AnalyticsService);
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

      const result = await controller.getPricingTrends('MRI', 'CA', '30d');

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

      const result = await controller.getPricingTrends();

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

      await expect(controller.getPricingTrends()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingTrends();
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

      await expect(controller.getPricingTrends()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingTrends();
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

      const result = await controller.exportData('csv', 'hospitals');

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

      const result = await controller.exportData();

      expect(result).toBe(mockResult);
      expect(mockAnalyticsService.exportData).toHaveBeenCalledWith({
        format: undefined,
        dataset: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockAnalyticsService.exportData.mockRejectedValue(connectionError);

      await expect(controller.exportData()).rejects.toThrow(HttpException);
      
      try {
        await controller.exportData();
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

      await expect(controller.exportData()).rejects.toThrow(HttpException);
      
      try {
        await controller.exportData();
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
  });
});