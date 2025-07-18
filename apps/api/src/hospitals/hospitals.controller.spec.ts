import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';

describe('HospitalsController', () => {
  let controller: HospitalsController;
  let service: HospitalsService;
import { HttpStatus } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';
import { HospitalNotFoundException, DatabaseOperationException } from '../common/exceptions';

describe('HospitalsController', () => {
  let controller: HospitalsController;
  let mockHospitalsService: Partial<HospitalsService>;

  beforeEach(async () => {
    mockHospitalsService = {
      getHospitals: jest.fn(),
      getHospitalById: jest.fn(),
      getHospitalPrices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HospitalsController],
      providers: [
        { provide: HospitalsService, useValue: mockHospitalsService },
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';

describe('HospitalsController', () => {
  let controller: HospitalsController;
  let hospitalsService: HospitalsService;

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
    hospitalsService = module.get<HospitalsService>(HospitalsService);
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
  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should be an instance of HospitalsController', () => {
      expect(controller).toBeInstanceOf(HospitalsController);
    });
  });

  describe('getHospitals', () => {
    it('should successfully return hospitals list', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            name: 'Test Hospital 1',
            state: 'CA',
            city: 'Los Angeles',
            address: '123 Main St',
            phone: '555-0123',
            website: 'https://test1.com',
            bedCount: 100,
            ownership: 'Private',
            hospitalType: 'General',
            lastUpdated: new Date(),
          },
          {
            id: '2',
            name: 'Test Hospital 2',
            state: 'CA',
            city: 'San Francisco',
            address: '456 Oak Ave',
            phone: '555-0456',
            website: 'https://test2.com',
            bedCount: 150,
            ownership: 'Public',
            hospitalType: 'Specialty',
            lastUpdated: new Date(),
          },
        ],
        total: 2,
        limit: 10,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      const result = await controller.getHospitals('CA', 'Los Angeles', 10, 0);

      expect(result).toEqual(mockResponse);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: 'CA',
        city: 'Los Angeles',
        limit: 10,
        offset: 0,
      });
    });

    it('should return hospitals with default parameters', async () => {
      const mockResult = {
    it('should handle requests with no filters', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals.mockResolvedValue(mockResult);

      const result = await controller.getHospitals();

      expect(result).toBe(mockResult);
      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      const result = await controller.getHospitals();

      expect(result).toEqual(mockResponse);
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
    it('should handle state filter only', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            name: 'Texas Hospital',
            state: 'TX',
            city: 'Houston',
            address: '789 Elm St',
            phone: '555-0789',
            website: 'https://texas.com',
            bedCount: 200,
            ownership: 'Private',
            hospitalType: 'General',
            lastUpdated: new Date(),
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      const result = await controller.getHospitals('TX');

      expect(result).toEqual(mockResponse);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: 'TX',
        city: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should propagate DatabaseOperationException from service', async () => {
      const error = new DatabaseOperationException('fetch hospitals', 'Connection failed');
      
      mockHospitalsService.getHospitals = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitals()).rejects.toThrow(DatabaseOperationException);
      await expect(controller.getHospitals()).rejects.toThrow('Database operation failed: fetch hospitals');
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Unexpected error');
      
      mockHospitalsService.getHospitals = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitals()).rejects.toThrow(error);
    });
  });

  describe('getHospitalById', () => {
    it('should return hospital by id successfully', async () => {
      const mockHospital = {
        id: '1',
        name: 'Test Hospital',
        state: 'CA',
        city: 'San Francisco',
    it('should successfully return hospital by ID', async () => {
      const mockHospital = {
        id: '123',
        name: 'Test Hospital',
        state: 'CA',
        city: 'Los Angeles',
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
        ownership: 'Private',
        hospitalType: 'General',
        lastUpdated: new Date(),
        services: ['Emergency Services', 'Surgery', 'Radiology'],
      };

      mockHospitalsService.getHospitalById = jest.fn().mockResolvedValue(mockHospital);

      const result = await controller.getHospitalById('123');

      expect(result).toEqual(mockHospital);
      expect(mockHospitalsService.getHospitalById).toHaveBeenCalledWith('123');
    });

    it('should throw HospitalNotFoundException when hospital not found', async () => {
      const error = new HospitalNotFoundException('nonexistent');
      
      mockHospitalsService.getHospitalById = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitalById('nonexistent')).rejects.toThrow(HospitalNotFoundException);
      await expect(controller.getHospitalById('nonexistent')).rejects.toThrow('Hospital with ID nonexistent not found');
    });

    it('should propagate DatabaseOperationException from service', async () => {
      const error = new DatabaseOperationException('fetch hospital', 'Query failed');
      
      mockHospitalsService.getHospitalById = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitalById('123')).rejects.toThrow(DatabaseOperationException);
      await expect(controller.getHospitalById('123')).rejects.toThrow('Database operation failed: fetch hospital');
    });

    it('should handle various hospital ID formats', async () => {
      const mockHospital = {
        id: 'uuid-123-456',
        name: 'Test Hospital',
        state: 'CA',
        city: 'Los Angeles',
        address: '123 Main St',
        phone: '555-0123',
        website: 'https://test.com',
        bedCount: 100,
        ownership: 'Private',
        hospitalType: 'General',
        lastUpdated: new Date(),
        services: [],
      };

      mockHospitalsService.getHospitalById = jest.fn().mockResolvedValue(mockHospital);

      const testIds = ['123', 'uuid-123-456', 'hospital_001', 'h-123'];

      for (const id of testIds) {
        await controller.getHospitalById(id);
        expect(mockHospitalsService.getHospitalById).toHaveBeenCalledWith(id);
      }
    });
  });

  describe('getHospitalPrices', () => {
    it('should successfully return hospital prices', async () => {
      const mockPrices = {
        hospitalId: '123',
        data: [
          {
            id: '1',
            service: 'Emergency Room Visit',
            code: 'ER001',
            price: 2500.00,
            discountedCashPrice: 2000.00,
            description: 'Emergency room visit',
            category: 'Emergency Services',
            lastUpdated: new Date(),
          },
          {
            id: '2',
            service: 'X-Ray',
            code: 'RAD001',
            price: 150.00,
            discountedCashPrice: 120.00,
            description: 'Chest X-ray',
            category: 'Radiology',
            lastUpdated: new Date(),
          },
        ],
        total: 2,
      };

      mockHospitalsService.getHospitalPrices = jest.fn().mockResolvedValue(mockPrices);

      const result = await controller.getHospitalPrices('123', 'Emergency');

      expect(result).toEqual(mockPrices);
      expect(mockHospitalsService.getHospitalPrices).toHaveBeenCalledWith('123', {
        service: 'Emergency',
      });
    });

    it('should handle requests without service filter', async () => {
      const mockPrices = {
        hospitalId: '123',
        data: [
          {
            id: '1',
            service: 'Surgery',
            code: 'SRG001',
            price: 15000.00,
            discountedCashPrice: 12000.00,
            description: 'General surgery',
            category: 'Surgery',
            lastUpdated: new Date(),
          },
        ],
        total: 1,
      };

      mockHospitalsService.getHospitalPrices = jest.fn().mockResolvedValue(mockPrices);

      const result = await controller.getHospitalPrices('123');

      expect(result).toEqual(mockPrices);
      expect(mockHospitalsService.getHospitalPrices).toHaveBeenCalledWith('123', {
        service: undefined,
      });
    });

    it('should return empty results when no prices found', async () => {
      const mockPrices = {
        hospitalId: '123',
        data: [],
        total: 0,
      };

      mockHospitalsService.getHospitalPrices = jest.fn().mockResolvedValue(mockPrices);

      const result = await controller.getHospitalPrices('123', 'Nonexistent');

      expect(result).toEqual(mockPrices);
      expect(mockHospitalsService.getHospitalPrices).toHaveBeenCalledWith('123', {
        service: 'Nonexistent',
      });
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Database connection failed');
      
      mockHospitalsService.getHospitalPrices = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitalPrices('123')).rejects.toThrow(error);
    });

    it('should handle HospitalNotFoundException when hospital does not exist', async () => {
      const error = new HospitalNotFoundException('nonexistent');
      
      mockHospitalsService.getHospitalPrices = jest.fn().mockRejectedValue(error);

      await expect(controller.getHospitalPrices('nonexistent')).rejects.toThrow(HospitalNotFoundException);
    });
  });

  describe('Error Handling Integration', () => {
    it('should preserve custom exception types', async () => {
      const hospitalNotFoundError = new HospitalNotFoundException('123');
      const dbOperationError = new DatabaseOperationException('test operation', 'test details');

      mockHospitalsService.getHospitalById = jest.fn()
        .mockRejectedValueOnce(hospitalNotFoundError)
        .mockRejectedValueOnce(dbOperationError);

      // Test HospitalNotFoundException
      await expect(controller.getHospitalById('123')).rejects.toThrow(HospitalNotFoundException);
      
      // Test DatabaseOperationException
      await expect(controller.getHospitalById('123')).rejects.toThrow(DatabaseOperationException);
    });

    it('should handle concurrent requests properly', async () => {
      const mockResponses = [
        { id: '1', name: 'Hospital 1' },
        { id: '2', name: 'Hospital 2' },
        { id: '3', name: 'Hospital 3' },
      ];

      mockHospitalsService.getHospitalById = jest.fn()
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      // Make concurrent requests
      const promises = [
        controller.getHospitalById('1'),
        controller.getHospitalById('2'),
        controller.getHospitalById('3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(mockResponses);
      expect(mockHospitalsService.getHospitalById).toHaveBeenCalledTimes(3);
    });
  });

  describe('Parameter Validation', () => {
    it('should handle various parameter types correctly', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      // Test with string numbers
      await controller.getHospitals(undefined, undefined, 10, 0);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: undefined,
        city: undefined,
        limit: 10,
        offset: 0,
      });

      // Test with actual numbers
      await controller.getHospitals(undefined, undefined, 25, 50);
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: undefined,
        city: undefined,
        limit: 25,
        offset: 50,
      });
    });

    it('should handle empty string parameters', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      await controller.getHospitals('', '');
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: '',
        city: '',
        limit: undefined,
        offset: undefined,
      });
    });

    it('should handle special characters in search parameters', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockResponse);

      await controller.getHospitals('CA', 'San Francisco & Los Angeles');
      expect(mockHospitalsService.getHospitals).toHaveBeenCalledWith({
        state: 'CA',
        city: 'San Francisco & Los Angeles',
        limit: undefined,
        offset: undefined,
      });
    });
  });

  describe('Response Format', () => {
    it('should return responses in expected format', async () => {
      const mockHospitalsResponse = {
        data: [
          {
            id: '1',
            name: 'Test Hospital',
            state: 'CA',
            city: 'Los Angeles',
            address: '123 Main St',
            phone: '555-0123',
            website: 'https://test.com',
            bedCount: 100,
            ownership: 'Private',
            hospitalType: 'General',
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
        limit: 10,
        offset: 0,
      };

      mockHospitalsService.getHospitals = jest.fn().mockResolvedValue(mockHospitalsResponse);

      const result = await controller.getHospitals();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('offset');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.offset).toBe('number');
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHospitals', () => {
    it('should call hospitalsService.getHospitals with query parameters', async () => {
      const query = {
        state: 'CA',
        city: 'Los Angeles',
        limit: 20,
        offset: 10,
      };
      const expectedResult = {
        hospitals: [
          { id: '1', name: 'Hospital A', state: 'CA', city: 'Los Angeles' },
          { id: '2', name: 'Hospital B', state: 'CA', city: 'Los Angeles' },
        ],
        total: 2,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        hospitals: [],
        total: 0,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial query parameters', async () => {
      const query = { state: 'TX' };
      const expectedResult = {
        hospitals: [
          { id: '3', name: 'Hospital C', state: 'TX', city: 'Houston' },
        ],
        total: 1,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle pagination parameters', async () => {
      const query = { limit: 5, offset: 15 };
      const expectedResult = {
        hospitals: [],
        total: 0,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle city filter', async () => {
      const query = { city: 'New York' };
      const expectedResult = {
        hospitals: [
          { id: '4', name: 'Hospital D', state: 'NY', city: 'New York' },
        ],
        total: 1,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle combined state and city filters', async () => {
      const query = { state: 'FL', city: 'Miami' };
      const expectedResult = {
        hospitals: [
          { id: '5', name: 'Hospital E', state: 'FL', city: 'Miami' },
        ],
        total: 1,
      };
      
      mockHospitalsService.getHospitals.mockResolvedValue(expectedResult);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getHospitalById', () => {
    it('should call hospitalsService.getHospitalById with hospital ID', async () => {
      const hospitalId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResult = {
        id: hospitalId,
        name: 'General Hospital',
        state: 'CA',
        city: 'Los Angeles',
        address: '123 Main St',
      };
      
      mockHospitalsService.getHospitalById.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalById(hospitalId);

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(hospitalId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different hospital ID formats', async () => {
      const hospitalId = 'hospital-123';
      const expectedResult = {
        id: hospitalId,
        name: 'Community Hospital',
        state: 'TX',
        city: 'Houston',
      };
      
      mockHospitalsService.getHospitalById.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalById(hospitalId);

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(hospitalId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle numeric hospital ID', async () => {
      const hospitalId = '12345';
      const expectedResult = {
        id: hospitalId,
        name: 'Regional Medical Center',
        state: 'NY',
        city: 'New York',
      };
      
      mockHospitalsService.getHospitalById.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalById(hospitalId);

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(hospitalId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getHospitalPrices', () => {
    it('should call hospitalsService.getHospitalPrices with hospital ID and service filter', async () => {
      const hospitalId = '123e4567-e89b-12d3-a456-426614174000';
      const service = 'MRI';
      const expectedResult = {
        hospitalId,
        prices: [
          { service: 'MRI', price: 1500, description: 'MRI scan' },
        ],
      };
      
      mockHospitalsService.getHospitalPrices.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalPrices(hospitalId, service);

      expect(hospitalsService.getHospitalPrices).toHaveBeenCalledWith(hospitalId, { service });
      expect(result).toEqual(expectedResult);
    });

    it('should handle request without service filter', async () => {
      const hospitalId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResult = {
        hospitalId,
        prices: [
          { service: 'MRI', price: 1500, description: 'MRI scan' },
          { service: 'CT Scan', price: 800, description: 'CT scan' },
          { service: 'X-Ray', price: 200, description: 'X-ray' },
        ],
      };
      
      mockHospitalsService.getHospitalPrices.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalPrices(hospitalId);

      expect(hospitalsService.getHospitalPrices).toHaveBeenCalledWith(hospitalId, { service: undefined });
      expect(result).toEqual(expectedResult);
    });

    it('should handle different service types', async () => {
      const hospitalId = 'hospital-456';
      const services = ['CT Scan', 'X-Ray', 'Ultrasound', 'Blood Test'];
      
      for (const service of services) {
        const expectedResult = {
          hospitalId,
          prices: [
            { service, price: 500, description: `${service} procedure` },
          ],
        };
        
        mockHospitalsService.getHospitalPrices.mockResolvedValue(expectedResult);

        const result = await controller.getHospitalPrices(hospitalId, service);

        expect(hospitalsService.getHospitalPrices).toHaveBeenCalledWith(hospitalId, { service });
        expect(result).toEqual(expectedResult);
      }
    });

    it('should handle empty service parameter', async () => {
      const hospitalId = 'hospital-789';
      const service = '';
      const expectedResult = {
        hospitalId,
        prices: [],
      };
      
      mockHospitalsService.getHospitalPrices.mockResolvedValue(expectedResult);

      const result = await controller.getHospitalPrices(hospitalId, service);

      expect(hospitalsService.getHospitalPrices).toHaveBeenCalledWith(hospitalId, { service });
      expect(result).toEqual(expectedResult);
    });
  });
});