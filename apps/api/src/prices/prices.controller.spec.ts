import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

describe('PricesController', () => {
  let controller: PricesController;
  let service: PricesService;

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
    service = module.get<PricesService>(PricesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      const result = await controller.getPrices('1', 'MRI', 'CA', 1000, 2000, 50, 0);

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPrices).toHaveBeenCalledWith({
        hospital: '1',
        service: 'MRI',
        state: 'CA',
        minPrice: 1000,
        maxPrice: 2000,
        limit: 50,
        offset: 0,
      });
    });

    it('should return prices with default parameters', async () => {
      const mockResult = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockPricesService.getPrices.mockResolvedValue(mockResult);

      const result = await controller.getPrices();

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPrices).toHaveBeenCalledWith({
        hospital: undefined,
        service: undefined,
        state: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockPricesService.getPrices.mockRejectedValue(connectionError);

      await expect(controller.getPrices()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPrices();
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
      mockPricesService.getPrices.mockRejectedValue(connectionError);

      await expect(controller.getPrices()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPrices();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockPricesService.getPrices.mockRejectedValue(otherError);

      await expect(controller.getPrices()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPrices();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });

  describe('comparePrices', () => {
    it('should return price comparison successfully', async () => {
      const mockResult = {
        service: 'MRI',
        state: 'CA',
        hospitals: [
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
        ],
        statistics: {
          min: 1000.00,
          max: 1500.00,
          average: 1250.00,
          median: 1225.00,
        },
      };

      mockPricesService.comparePrices.mockResolvedValue(mockResult);

      const result = await controller.comparePrices('MRI', 'CA', 10);

      expect(result).toBe(mockResult);
      expect(mockPricesService.comparePrices).toHaveBeenCalledWith({
        service: 'MRI',
        state: 'CA',
        limit: 10,
      });
    });

    it('should handle required service parameter', async () => {
      const mockResult = {
        service: 'CT Scan',
        hospitals: [],
        statistics: {},
      };

      mockPricesService.comparePrices.mockResolvedValue(mockResult);

      const result = await controller.comparePrices('CT Scan');

      expect(result).toBe(mockResult);
      expect(mockPricesService.comparePrices).toHaveBeenCalledWith({
        service: 'CT Scan',
        state: undefined,
        limit: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockPricesService.comparePrices.mockRejectedValue(connectionError);

      await expect(controller.comparePrices('MRI')).rejects.toThrow(HttpException);
      
      try {
        await controller.comparePrices('MRI');
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
      mockPricesService.comparePrices.mockRejectedValue(otherError);

      await expect(controller.comparePrices('MRI')).rejects.toThrow(HttpException);
      
      try {
        await controller.comparePrices('MRI');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while comparing prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
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
        topServices: [
          { service: 'MRI', count: 250 },
          { service: 'CT Scan', count: 200 },
        ],
        stateBreakdown: {
          CA: 300,
          NY: 250,
          TX: 200,
        },
      };

      mockPricesService.getPricingAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getPricingAnalytics('MRI', 'CA');

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPricingAnalytics).toHaveBeenCalledWith({
        service: 'MRI',
        state: 'CA',
      });
    });

    it('should return pricing analytics with default parameters', async () => {
      const mockResult = {
        totalPrices: 1000,
        averagePrice: 1250.00,
      };

      mockPricesService.getPricingAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getPricingAnalytics();

      expect(result).toBe(mockResult);
      expect(mockPricesService.getPricingAnalytics).toHaveBeenCalledWith({
        service: undefined,
        state: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockPricesService.getPricingAnalytics.mockRejectedValue(connectionError);

      await expect(controller.getPricingAnalytics()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingAnalytics();
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
      mockPricesService.getPricingAnalytics.mockRejectedValue(otherError);

      await expect(controller.getPricingAnalytics()).rejects.toThrow(HttpException);
      
      try {
        await controller.getPricingAnalytics();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching pricing analytics',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
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

    it('should throw NOT_FOUND when price does not exist', async () => {
      mockPricesService.getPriceById.mockResolvedValue(null);

      await expect(controller.getPriceById('999')).rejects.toThrow(HttpException);
      
      try {
        await controller.getPriceById('999');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toEqual({
          message: 'Price not found',
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
        });
      }
    });

    it('should re-throw NOT_FOUND error from service', async () => {
      const notFoundError = new HttpException(
        {
          message: 'Price not found',
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
        },
        HttpStatus.NOT_FOUND
      );
      notFoundError.status = HttpStatus.NOT_FOUND;

      mockPricesService.getPriceById.mockRejectedValue(notFoundError);

      await expect(controller.getPriceById('999')).rejects.toThrow(notFoundError);
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockPricesService.getPriceById.mockRejectedValue(connectionError);

      await expect(controller.getPriceById('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getPriceById('1');
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
      mockPricesService.getPriceById.mockRejectedValue(otherError);

      await expect(controller.getPriceById('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getPriceById('1');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching price',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });
});