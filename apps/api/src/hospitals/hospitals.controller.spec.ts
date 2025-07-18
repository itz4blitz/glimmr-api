import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';

describe('HospitalsController', () => {
  let controller: HospitalsController;
  let service: HospitalsService;

  const mockHospitalsService = {
    getHospitals: jest.fn(),
    getHospitalById: jest.fn(),
    getHospitalPrices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HospitalsController],
      providers: [
        {
          provide: HospitalsService,
          useValue: mockHospitalsService,
        },
      ],
    }).compile();

    controller = module.get<HospitalsController>(HospitalsController);
    service = module.get<HospitalsService>(HospitalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHospitals', () => {
    it('should return hospitals successfully', async () => {
      const mockResult = {
        data: [
          {
            id: '1',
            name: 'Test Hospital',
            state: 'CA',
            city: 'San Francisco',
            address: '123 Main St',
            phone: '555-0123',
            website: 'https://test.com',
            bedCount: 100,
            ownership: 'private',
            hospitalType: 'general',
            lastUpdated: new Date(),
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals.mockResolvedValue(mockResult);

      const result = await controller.getHospitals('CA', 'San Francisco', 50, 0);

      expect(result).toBe(mockResult);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: 'CA',
        city: 'San Francisco',
        limit: 50,
        offset: 0,
      });
    });

    it('should return hospitals with default parameters', async () => {
      const mockResult = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals.mockResolvedValue(mockResult);

      const result = await controller.getHospitals();

      expect(result).toBe(mockResult);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: undefined,
        city: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockHospitalsService.getHospitals.mockRejectedValue(connectionError);

      await expect(controller.getHospitals()).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitals();
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
      mockHospitalsService.getHospitals.mockRejectedValue(connectionError);

      await expect(controller.getHospitals()).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitals();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      const otherError = new Error('Some other error');
      mockHospitalsService.getHospitals.mockRejectedValue(otherError);

      await expect(controller.getHospitals()).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitals();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching hospitals',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });

  describe('getHospitalById', () => {
    it('should return hospital by id successfully', async () => {
      const mockHospital = {
        id: '1',
        name: 'Test Hospital',
        state: 'CA',
        city: 'San Francisco',
        address: '123 Main St',
        phone: '555-0123',
        website: 'https://test.com',
        bedCount: 100,
        ownership: 'private',
        hospitalType: 'general',
        lastUpdated: new Date(),
        services: ['surgery', 'cardiology'],
      };

      mockHospitalsService.getHospitalById.mockResolvedValue(mockHospital);

      const result = await controller.getHospitalById('1');

      expect(result).toBe(mockHospital);
      expect(mockHospitalsService.getHospitalById).toHaveBeenCalledWith('1');
    });

    it('should throw NOT_FOUND when hospital does not exist', async () => {
      mockHospitalsService.getHospitalById.mockResolvedValue(null);

      await expect(controller.getHospitalById('999')).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitalById('999');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toEqual({
          message: 'Hospital not found',
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
        });
      }
    });

    it('should re-throw NOT_FOUND error from service', async () => {
      const notFoundError = new HttpException(
        {
          message: 'Hospital not found',
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
        },
        HttpStatus.NOT_FOUND
      );
      notFoundError.status = HttpStatus.NOT_FOUND;

      mockHospitalsService.getHospitalById.mockRejectedValue(notFoundError);

      await expect(controller.getHospitalById('999')).rejects.toThrow(notFoundError);
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockHospitalsService.getHospitalById.mockRejectedValue(connectionError);

      await expect(controller.getHospitalById('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitalById('1');
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
      mockHospitalsService.getHospitalById.mockRejectedValue(otherError);

      await expect(controller.getHospitalById('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitalById('1');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching hospital',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });

  describe('getHospitalPrices', () => {
    it('should return hospital prices successfully', async () => {
      const mockPrices = {
        hospitalId: '1',
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
          },
        ],
        total: 1,
      };

      mockHospitalsService.getHospitalPrices.mockResolvedValue(mockPrices);

      const result = await controller.getHospitalPrices('1', 'MRI');

      expect(result).toBe(mockPrices);
      expect(mockHospitalsService.getHospitalPrices).toHaveBeenCalledWith('1', { service: 'MRI' });
    });

    it('should return hospital prices without service filter', async () => {
      const mockPrices = {
        hospitalId: '1',
        data: [],
        total: 0,
      };

      mockHospitalsService.getHospitalPrices.mockResolvedValue(mockPrices);

      const result = await controller.getHospitalPrices('1');

      expect(result).toBe(mockPrices);
      expect(mockHospitalsService.getHospitalPrices).toHaveBeenCalledWith('1', { service: undefined });
    });

    it('should throw SERVICE_UNAVAILABLE when database connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockHospitalsService.getHospitalPrices.mockRejectedValue(connectionError);

      await expect(controller.getHospitalPrices('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitalPrices('1');
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
      mockHospitalsService.getHospitalPrices.mockRejectedValue(otherError);

      await expect(controller.getHospitalPrices('1')).rejects.toThrow(HttpException);
      
      try {
        await controller.getHospitalPrices('1');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: 'Internal server error occurred while fetching hospital prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
        });
      }
    });
  });
});