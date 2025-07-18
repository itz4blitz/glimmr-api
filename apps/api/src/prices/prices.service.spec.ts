import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { DatabaseService } from '../database/database.service';
import { PinoLogger } from 'nestjs-pino';

describe('PricesService', () => {
  let service: PricesService;
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
        PricesService,
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

    service = module.get<PricesService>(PricesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPrices', () => {
    it('should fetch prices with filters successfully', async () => {
      const mockPrices = [
        {
          id: '1',
          service: 'MRI',
          code: 'MRI001',
          price: 1500.00,
          discountedCashPrice: 1200.00,
          description: 'Brain MRI',
          category: 'imaging',
          lastUpdated: new Date(),
          hospital: 'Test Hospital',
        },
      ];

      const mockCountResult = { count: 1 };

      // Mock the database chain
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([mockCountResult]),
          }),
        }),
      });

      // Mock the second query for data
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([mockCountResult]),
          }),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit.mockReturnValue({
                  offset: mockOffset,
                }),
              }),
            }),
          }),
        }),
      });

      const filters = {
        hospital: 'Test Hospital',
        service: 'MRI',
        state: 'CA',
        minPrice: 1000,
        maxPrice: 2000,
        limit: 10,
        offset: 0,
      };

      const result = await service.getPrices(filters);

      expect(result).toEqual({
        data: mockPrices,
        total: mockCountResult.count,
        limit: 10,
        offset: 0,
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching prices with filters',
        filters,
        operation: 'getPrices',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Prices fetched successfully',
        count: mockPrices.length,
        total: mockCountResult.count,
        duration: expect.any(Number),
        operation: 'getPrices',
        filters,
      });
    });

    it('should use default limit and offset when not provided', async () => {
      const mockPrices = [];
      const mockCountResult = { count: 0 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([mockCountResult]),
          }),
        }),
      });

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([mockCountResult]),
          }),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit.mockReturnValue({
                  offset: mockOffset,
                }),
              }),
            }),
          }),
        }),
      });

      const filters = {};

      const result = await service.getPrices(filters);

      expect(result).toEqual({
        data: mockPrices,
        total: mockCountResult.count,
        limit: 50, // default limit
        offset: 0, // default offset
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      const filters = { service: 'MRI' };

      await expect(service.getPrices(filters)).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch prices',
        error: dbError.message,
        duration: expect.any(Number),
        operation: 'getPrices',
        filters,
      });
    });
  });

  describe('comparePrices', () => {
    it('should compare prices across hospitals successfully', async () => {
      const mockPrices = [
        {
          hospitalId: '1',
          hospitalName: 'Hospital A',
          price: 1200.00,
          discountedCashPrice: 1000.00,
        },
        {
          hospitalId: '2',
          hospitalName: 'Hospital B',
          price: 1500.00,
          discountedCashPrice: 1200.00,
        },
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      });

      const filters = {
        service: 'MRI',
        state: 'CA',
        limit: 10,
      };

      const result = await service.comparePrices(filters);

      expect(result).toEqual({
        service: 'MRI',
        state: 'CA',
        hospitals: mockPrices,
        statistics: {
          min: 1000.00,
          max: 1500.00,
          average: 1250.00,
          median: 1225.00,
          count: 2,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Comparing prices across hospitals',
        filters,
        operation: 'comparePrices',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Price comparison completed successfully',
        hospitalCount: mockPrices.length,
        service: 'MRI',
        state: 'CA',
        operation: 'comparePrices',
      });
    });

    it('should handle empty results', async () => {
      const mockPrices = [];

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy.mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      });

      const filters = { service: 'MRI' };

      const result = await service.comparePrices(filters);

      expect(result).toEqual({
        service: 'MRI',
        state: undefined,
        hospitals: [],
        statistics: {
          min: 0,
          max: 0,
          average: 0,
          median: 0,
          count: 0,
        },
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      const filters = { service: 'MRI' };

      await expect(service.comparePrices(filters)).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to compare prices',
        error: dbError.message,
        filters,
        operation: 'comparePrices',
      });
    });
  });

  describe('getPricingAnalytics', () => {
    it('should fetch pricing analytics successfully', async () => {
      const mockAnalytics = {
        totalPrices: 1000,
        averagePrice: 1250.00,
        priceRanges: {
          '0-500': 100,
          '500-1000': 200,
          '1000-2000': 400,
          '2000+': 300,
        },
        topServices: [
          { service: 'MRI', count: 250 },
          { service: 'CT Scan', count: 200 },
        ],
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockGroupBy = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([]);

      // Mock multiple queries for analytics
      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue([{ count: 1000, avg: 1250.00 }]),
          }),
        }),
      });

      const filters = {
        service: 'MRI',
        state: 'CA',
      };

      const result = await service.getPricingAnalytics(filters);

      expect(result).toEqual({
        totalPrices: 1000,
        averagePrice: 1250.00,
        priceRanges: expect.any(Object),
        topServices: expect.any(Array),
        stateBreakdown: expect.any(Object),
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching pricing analytics',
        filters,
        operation: 'getPricingAnalytics',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Pricing analytics fetched successfully',
        totalPrices: expect.any(Number),
        operation: 'getPricingAnalytics',
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      const filters = { service: 'MRI' };

      await expect(service.getPricingAnalytics(filters)).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch pricing analytics',
        error: dbError.message,
        filters,
        operation: 'getPricingAnalytics',
      });
    });
  });

  describe('getPriceById', () => {
    it('should fetch price by id successfully', async () => {
      const mockPrice = {
        id: '1',
        service: 'MRI',
        code: 'MRI001',
        price: 1500.00,
        discountedCashPrice: 1200.00,
        description: 'Brain MRI',
        category: 'imaging',
        lastUpdated: new Date(),
        hospital: 'Test Hospital',
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([mockPrice]);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      });

      const result = await service.getPriceById('1');

      expect(result).toEqual(mockPrice);

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching price by ID',
        priceId: '1',
        operation: 'getPriceById',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Price fetched successfully',
        priceId: '1',
        service: mockPrice.service,
        operation: 'getPriceById',
      });
    });

    it('should return null when price not found', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockInnerJoin = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([]);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      });

      const result = await service.getPriceById('999');

      expect(result).toBeNull();

      expect(mockLogger.warn).toHaveBeenCalledWith({
        msg: 'Price not found',
        priceId: '999',
        operation: 'getPriceById',
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      await expect(service.getPriceById('1')).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch price',
        priceId: '1',
        error: dbError.message,
        operation: 'getPriceById',
      });
    });
  });
});