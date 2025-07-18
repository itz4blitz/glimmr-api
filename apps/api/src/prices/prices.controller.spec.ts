import { Test, TestingModule } from '@nestjs/testing';
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
    it('should call pricesService.getPrices with all query parameters', async () => {
      const query = {
        hospital: '123e4567-e89b-12d3-a456-426614174000',
        service: 'MRI',
        state: 'CA',
        minPrice: 100,
        maxPrice: 1000,
        limit: 50,
        offset: 0,
      };
      const expectedResult = {
        prices: [
          { id: '1', service: 'MRI', price: 800, hospitalId: query.hospital },
        ],
        total: 1,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        prices: [],
        total: 0,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial query parameters', async () => {
      const query = { service: 'CT Scan', state: 'TX' };
      const expectedResult = {
        prices: [
          { id: '2', service: 'CT Scan', price: 600, state: 'TX' },
        ],
        total: 1,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle price range filters', async () => {
      const query = { minPrice: 200, maxPrice: 800 };
      const expectedResult = {
        prices: [
          { id: '3', service: 'X-Ray', price: 250 },
          { id: '4', service: 'Blood Test', price: 150 },
        ],
        total: 2,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle pagination parameters', async () => {
      const query = { limit: 25, offset: 10 };
      const expectedResult = {
        prices: [],
        total: 0,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle hospital filter', async () => {
      const query = { hospital: 'hospital-123' };
      const expectedResult = {
        prices: [
          { id: '5', service: 'MRI', price: 1200, hospitalId: 'hospital-123' },
        ],
        total: 1,
      };
      
      mockPricesService.getPrices.mockResolvedValue(expectedResult);

      const result = await controller.getPrices(query);

      expect(pricesService.getPrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('comparePrices', () => {
    it('should call pricesService.comparePrices with all query parameters', async () => {
      const query = {
        service: 'MRI',
        state: 'CA',
        limit: 10,
      };
      const expectedResult = {
        service: 'MRI',
        comparisons: [
          { hospitalId: '1', hospitalName: 'Hospital A', price: 1000 },
          { hospitalId: '2', hospitalName: 'Hospital B', price: 1200 },
        ],
      };
      
      mockPricesService.comparePrices.mockResolvedValue(expectedResult);

      const result = await controller.comparePrices(query);

      expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle required service parameter only', async () => {
      const query = { service: 'CT Scan' };
      const expectedResult = {
        service: 'CT Scan',
        comparisons: [
          { hospitalId: '3', hospitalName: 'Hospital C', price: 800 },
        ],
      };
      
      mockPricesService.comparePrices.mockResolvedValue(expectedResult);

      const result = await controller.comparePrices(query);

      expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle state filter', async () => {
      const query = { service: 'X-Ray', state: 'NY' };
      const expectedResult = {
        service: 'X-Ray',
        comparisons: [
          { hospitalId: '4', hospitalName: 'Hospital D', price: 200 },
          { hospitalId: '5', hospitalName: 'Hospital E', price: 180 },
        ],
      };
      
      mockPricesService.comparePrices.mockResolvedValue(expectedResult);

      const result = await controller.comparePrices(query);

      expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle limit parameter', async () => {
      const query = { service: 'Ultrasound', limit: 5 };
      const expectedResult = {
        service: 'Ultrasound',
        comparisons: [
          { hospitalId: '6', hospitalName: 'Hospital F', price: 300 },
        ],
      };
      
      mockPricesService.comparePrices.mockResolvedValue(expectedResult);

      const result = await controller.comparePrices(query);

      expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different service types', async () => {
      const services = ['MRI', 'CT Scan', 'X-Ray', 'Blood Test', 'Ultrasound'];
      
      for (const service of services) {
        const query = { service };
        const expectedResult = {
          service,
          comparisons: [
            { hospitalId: '1', hospitalName: 'Hospital A', price: 500 },
          ],
        };
        
        mockPricesService.comparePrices.mockResolvedValue(expectedResult);

        const result = await controller.comparePrices(query);

        expect(pricesService.comparePrices).toHaveBeenCalledWith(query);
        expect(result).toEqual(expectedResult);
      }
    });
  });

  describe('getPricingAnalytics', () => {
    it('should call pricesService.getPricingAnalytics with all query parameters', async () => {
      const query = {
        service: 'MRI',
        state: 'CA',
        period: '30d',
      };
      const expectedResult = {
        service: 'MRI',
        state: 'CA',
        analytics: {
          averagePrice: 1200,
          medianPrice: 1150,
          priceRange: { min: 800, max: 1800 },
          hospitalCount: 25,
        },
      };
      
      mockPricesService.getPricingAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getPricingAnalytics(query);

      expect(pricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        analytics: {
          averagePrice: 750,
          medianPrice: 700,
          priceRange: { min: 100, max: 2000 },
          hospitalCount: 500,
        },
      };
      
      mockPricesService.getPricingAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getPricingAnalytics(query);

      expect(pricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service filter only', async () => {
      const query = { service: 'CT Scan' };
      const expectedResult = {
        service: 'CT Scan',
        analytics: {
          averagePrice: 650,
          medianPrice: 600,
          priceRange: { min: 400, max: 1200 },
          hospitalCount: 150,
        },
      };
      
      mockPricesService.getPricingAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getPricingAnalytics(query);

      expect(pricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle state filter only', async () => {
      const query = { state: 'TX' };
      const expectedResult = {
        state: 'TX',
        analytics: {
          averagePrice: 800,
          medianPrice: 750,
          priceRange: { min: 150, max: 1500 },
          hospitalCount: 80,
        },
      };
      
      mockPricesService.getPricingAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getPricingAnalytics(query);

      expect(pricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle period filter only', async () => {
      const query = { period: '90d' };
      const expectedResult = {
        period: '90d',
        analytics: {
          averagePrice: 900,
          medianPrice: 850,
          priceRange: { min: 200, max: 1800 },
          hospitalCount: 300,
        },
      };
      
      mockPricesService.getPricingAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getPricingAnalytics(query);

      expect(pricesService.getPricingAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getPriceById', () => {
    it('should call pricesService.getPriceById with price ID', async () => {
      const priceId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResult = {
        id: priceId,
        service: 'MRI',
        price: 1200,
        hospitalId: 'hospital-123',
        hospitalName: 'General Hospital',
        description: 'MRI scan with contrast',
      };
      
      mockPricesService.getPriceById.mockResolvedValue(expectedResult);

      const result = await controller.getPriceById(priceId);

      expect(pricesService.getPriceById).toHaveBeenCalledWith(priceId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different price ID formats', async () => {
      const priceId = 'price-456';
      const expectedResult = {
        id: priceId,
        service: 'CT Scan',
        price: 800,
        hospitalId: 'hospital-456',
        hospitalName: 'Community Hospital',
      };
      
      mockPricesService.getPriceById.mockResolvedValue(expectedResult);

      const result = await controller.getPriceById(priceId);

      expect(pricesService.getPriceById).toHaveBeenCalledWith(priceId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle numeric price ID', async () => {
      const priceId = '789';
      const expectedResult = {
        id: priceId,
        service: 'X-Ray',
        price: 150,
        hospitalId: 'hospital-789',
        hospitalName: 'Regional Medical Center',
      };
      
      mockPricesService.getPriceById.mockResolvedValue(expectedResult);

      const result = await controller.getPriceById(priceId);

      expect(pricesService.getPriceById).toHaveBeenCalledWith(priceId);
      expect(result).toEqual(expectedResult);
    });
  });
});