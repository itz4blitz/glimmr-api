import { Test, TestingModule } from '@nestjs/testing';
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
    hospitalsService = module.get<HospitalsService>(HospitalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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