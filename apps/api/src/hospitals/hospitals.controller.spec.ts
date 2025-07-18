import { Test, TestingModule } from '@nestjs/testing';
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
      ],
    }).compile();

    controller = module.get<HospitalsController>(HospitalsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

    it('should handle requests with no filters', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

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
    });
  });
});