import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

describe('PricesController', () => {
  let controller: PricesController;
  let pricesService: PricesService;

  const mockPricesService = {
    getPrices: jest.fn(),
    comparePrices: jest.fn(),
    getPricingAnalytics: jest.fn(),
    getPriceById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [
        {
          provide: PricesService,
          useValue: mockPricesService,
        },
      ],
    }).compile();

    controller = module.get<PricesController>(PricesController);
    pricesService = module.get<PricesService>(PricesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPrices', () => {
    it('should return prices successfully', async () => {
      const mockResult = {
        data: [
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
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockPricesService.getPrices.mockResolvedValue(mockResult);

      const query = {
        hospital: '1',
        service: 'MRI',
        state: 'CA',
        minPrice: 1000,
        maxPrice: 2000,
        limit: 50,
        offset: 0,
      };

      const result = await controller.getPrices(query);

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPrices).toHaveBeenCalledWith(query);
    });
  });

  describe('comparePrices', () => {
    it('should return price comparison successfully', async () => {
      const mockResult = {
        service: 'MRI',
        hospitals: [
          {
            hospitalId: '1',
            hospitalName: 'Hospital A',
            price: 1200.00,
            discountedCashPrice: 1000.00,
          },
        ],
      };

      mockPricesService.comparePrices.mockResolvedValue(mockResult);

      const query = { service: 'MRI', state: 'CA', limit: 10 };
      const result = await controller.comparePrices(query);

      expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getPricingAnalytics', () => {
    it('should return pricing analytics successfully', async () => {
      const mockResult = {
        totalPrices: 1000,
        averagePrice: 1250.00,
        priceRanges: {
          '0-500': 100,
          '500-1000': 200,
          '1000-2000': 400,
          '2000+': 300,
        },
      };

      mockPricesService.getPricingAnalytics.mockResolvedValue(mockResult);

      const query = { service: 'MRI', state: 'CA' };
      const result = await controller.getPricingAnalytics(query);

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
    });
  });

  describe('getPriceById', () => {
    it('should return price by id successfully', async () => {
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

      mockPricesService.getPriceById.mockResolvedValue(mockPrice);

      const result = await controller.getPriceById('1');

      expect(result).toBe(mockPrice);
      expect(mockPricesService.getPriceById).toHaveBeenCalledWith('1');
    });
  });
});