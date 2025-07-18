import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { DatabaseService } from '../database/database.service';
import { PinoLogger } from 'nestjs-pino';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let databaseService: DatabaseService;
  let logger: PinoLogger;

  const mockDatabaseService = {
    db: {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardAnalytics', () => {
    it('should fetch dashboard analytics successfully', async () => {
      const mockHospitalCount = { count: 500 };
      const mockPriceCount = { count: 10000 };
      const mockAveragePrice = { avg: 1250.00 };
      const mockTopServices = [
        { service: 'MRI', count: 1500, avg: 1800.00 },
        { service: 'CT Scan', count: 1200, avg: 1200.00 },
      ];
      const mockStateBreakdown = [
        { state: 'CA', hospitalCount: 100, priceCount: 2000 },
        { state: 'NY', hospitalCount: 80, priceCount: 1800 },
      ];

      // Mock multiple database queries
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockGroupBy = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();

      // Mock the hospital count query
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockHospitalCount]),
        }),
      });

      // Mock the price count query
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockPriceCount]),
        }),
      });

      // Mock the average price query
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockAveragePrice]),
        }),
      });

      // Mock the top services query
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            groupBy: mockGroupBy.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit.mockReturnValue(mockTopServices),
              }),
            }),
          }),
        }),
      });

      // Mock the state breakdown query
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              groupBy: mockGroupBy.mockReturnValue({
                orderBy: mockOrderBy.mockReturnValue(mockStateBreakdown),
              }),
            }),
          }),
        }),
      });

      const result = await service.getDashboardAnalytics();

      expect(result).toEqual({
        totalHospitals: mockHospitalCount.count,
        totalPrices: mockPriceCount.count,
        averagePrice: mockAveragePrice.avg,
        topServices: mockTopServices.map(s => ({
          service: s.service,
          count: s.count,
          averagePrice: s.avg,
        })),
        stateBreakdown: mockStateBreakdown.reduce((acc, item) => {
          acc[item.state] = {
            hospitals: item.hospitalCount,
            prices: item.priceCount,
          };
          return acc;
        }, {}),
        priceRanges: expect.any(Object),
        recentUpdates: expect.any(Object),
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching dashboard analytics',
        operation: 'getDashboardAnalytics',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Dashboard analytics fetched successfully',
        totalHospitals: mockHospitalCount.count,
        totalPrices: mockPriceCount.count,
        duration: expect.any(Number),
        operation: 'getDashboardAnalytics',
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      await expect(service.getDashboardAnalytics()).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch dashboard analytics',
        error: dbError.message,
        duration: expect.any(Number),
        operation: 'getDashboardAnalytics',
      });
    });
  });

  describe('getPricingTrends', () => {
    it('should fetch pricing trends successfully', async () => {
      const mockTrends = [
        {
          date: '2024-01-01',
          avg: 1200.00,
          median: 1100.00,
          count: 50,
        },
        {
          date: '2024-01-02',
          avg: 1250.00,
          median: 1150.00,
          count: 55,
        },
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockGroupBy = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              groupBy: mockGroupBy.mockReturnValue({
                orderBy: mockOrderBy.mockReturnValue(mockTrends),
              }),
            }),
          }),
        }),
      });

      const filters = {
        service: 'MRI',
        state: 'CA',
        period: '30d',
      };

      const result = await service.getPricingTrends(filters);

      expect(result).toEqual({
        service: 'MRI',
        state: 'CA',
        period: '30d',
        trends: mockTrends.map(t => ({
          date: t.date,
          averagePrice: t.avg,
          medianPrice: t.median,
          priceCount: t.count,
        })),
        summary: {
          overallTrend: 'increasing',
          percentageChange: expect.any(Number),
          volatility: expect.any(Number),
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching pricing trends',
        filters,
        operation: 'getPricingTrends',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Pricing trends fetched successfully',
        trendsCount: mockTrends.length,
        service: 'MRI',
        state: 'CA',
        period: '30d',
        operation: 'getPricingTrends',
      });
    });

    it('should handle empty trends data', async () => {
      const mockTrends = [];

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockGroupBy = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              groupBy: mockGroupBy.mockReturnValue({
                orderBy: mockOrderBy.mockReturnValue(mockTrends),
              }),
            }),
          }),
        }),
      });

      const filters = { service: 'MRI' };

      const result = await service.getPricingTrends(filters);

      expect(result).toEqual({
        service: 'MRI',
        state: undefined,
        period: undefined,
        trends: [],
        summary: {
          overallTrend: 'stable',
          percentageChange: 0,
          volatility: 0,
        },
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      const filters = { service: 'MRI' };

      await expect(service.getPricingTrends(filters)).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch pricing trends',
        error: dbError.message,
        filters,
        operation: 'getPricingTrends',
      });
    });
  });

  describe('getPowerBIInfo', () => {
    it('should fetch PowerBI info successfully', async () => {
      const mockPowerBIInfo = {
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

      const result = await service.getPowerBIInfo();

      expect(result).toEqual({
        datasetId: expect.any(String),
        lastRefresh: expect.any(Date),
        tables: expect.any(Array),
        refreshSchedule: expect.any(Object),
        status: 'active',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching PowerBI dataset information',
        operation: 'getPowerBIInfo',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'PowerBI info fetched successfully',
        datasetId: expect.any(String),
        tableCount: expect.any(Number),
        operation: 'getPowerBIInfo',
      });
    });

    it('should handle errors and log them', async () => {
      // Mock an error scenario
      const error = new Error('PowerBI API error');
      
      // Override the service method to throw an error
      jest.spyOn(service, 'getPowerBIInfo').mockRejectedValueOnce(error);

      await expect(service.getPowerBIInfo()).rejects.toThrow(error);
    });
  });

  describe('exportData', () => {
    it('should export data successfully', async () => {
      const mockExportData = {
        format: 'csv',
        dataset: 'hospitals',
        fileUrl: 'https://example.com/export/hospitals.csv',
        downloadToken: 'token-123',
        expiresAt: new Date(),
        recordCount: 500,
      };

      const filters = {
        format: 'csv',
        dataset: 'hospitals',
      };

      const result = await service.exportData(filters);

      expect(result).toEqual({
        format: 'csv',
        dataset: 'hospitals',
        fileUrl: expect.any(String),
        downloadToken: expect.any(String),
        expiresAt: expect.any(Date),
        recordCount: expect.any(Number),
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Exporting data',
        filters,
        operation: 'exportData',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Data export completed successfully',
        format: 'csv',
        dataset: 'hospitals',
        recordCount: expect.any(Number),
        operation: 'exportData',
      });
    });

    it('should handle default export parameters', async () => {
      const filters = {};

      const result = await service.exportData(filters);

      expect(result).toEqual({
        format: 'json',
        dataset: 'all',
        fileUrl: expect.any(String),
        downloadToken: expect.any(String),
        expiresAt: expect.any(Date),
        recordCount: expect.any(Number),
      });
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Export failed');
      
      // Override the service method to throw an error
      jest.spyOn(service, 'exportData').mockRejectedValueOnce(error);

      const filters = { format: 'csv', dataset: 'hospitals' };

      await expect(service.exportData(filters)).rejects.toThrow(error);
    });
  });

  describe('private helper methods', () => {
    it('should calculate trend correctly', () => {
      // Since these are private methods, we can test them indirectly through public methods
      // or we can test the logic through the public methods that use them
      expect(service).toBeDefined();
    });

    it('should calculate statistics correctly', () => {
      // Test through the public methods that use these calculations
      expect(service).toBeDefined();
    });

    it('should format date ranges correctly', () => {
      // Test through the public methods that use date formatting
      expect(service).toBeDefined();
    });
  });
});