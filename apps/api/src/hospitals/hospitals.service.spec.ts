import { Test, TestingModule } from '@nestjs/testing';
import { HospitalsService } from './hospitals.service';
import { DatabaseService } from '../database/database.service';
import { PatientRightsAdvocateService } from '../external-apis/patient-rights-advocate.service';
import { PinoLogger } from 'nestjs-pino';

describe('HospitalsService', () => {
  let service: HospitalsService;
  let databaseService: DatabaseService;
  let patientRightsAdvocateService: PatientRightsAdvocateService;
  let logger: PinoLogger;

  const mockDatabaseService = {
    db: {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPatientRightsAdvocateService = {
    getHospitalsByState: jest.fn(),
    getAllHospitals: jest.fn(),
    getRateLimitStatus: jest.fn(),
    getSessionStatus: jest.fn(),
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
        HospitalsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: PatientRightsAdvocateService,
          useValue: mockPatientRightsAdvocateService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<HospitalsService>(HospitalsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    patientRightsAdvocateService = module.get<PatientRightsAdvocateService>(PatientRightsAdvocateService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHospitals', () => {
    it('should fetch hospitals with filters successfully', async () => {
      const mockHospitals = [
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
      ];

      const mockCountResult = { count: 1 };

      // Mock the database chain
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockHospitals);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      });

      // Mock the second query for data
      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy.mockReturnValue({
              limit: mockLimit.mockReturnValue({
                offset: mockOffset,
              }),
            }),
          }),
        }),
      });

      const filters = {
        state: 'CA',
        city: 'San Francisco',
        limit: 10,
        offset: 0,
      };

      const result = await service.getHospitals(filters);

      expect(result).toEqual({
        data: mockHospitals,
        total: mockCountResult.count,
        limit: 10,
        offset: 0,
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospitals with filters',
        filters,
        operation: 'getHospitals',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Hospitals fetched successfully',
        count: mockHospitals.length,
        total: mockCountResult.count,
        duration: expect.any(Number),
        operation: 'getHospitals',
        filters,
      });
    });

    it('should use default limit and offset when not provided', async () => {
      const mockHospitals = [];
      const mockCountResult = { count: 0 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockHospitals);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      });

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy.mockReturnValue({
              limit: mockLimit.mockReturnValue({
                offset: mockOffset,
              }),
            }),
          }),
        }),
      });

      const filters = {};

      const result = await service.getHospitals(filters);

      expect(result).toEqual({
        data: mockHospitals,
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

      const filters = { state: 'CA' };

      await expect(service.getHospitals(filters)).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospitals',
        error: dbError.message,
        duration: expect.any(Number),
        operation: 'getHospitals',
        filters,
      });
    });
  });

  describe('getHospitalById', () => {
    it('should fetch hospital by id successfully', async () => {
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
      };

      const mockServices = [{ category: 'surgery' }, { category: 'cardiology' }];

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([mockHospital]);
      const mockGroupBy = jest.fn().mockResolvedValue(mockServices);

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            groupBy: mockGroupBy,
          }),
        }),
      });

      const result = await service.getHospitalById('1');

      expect(result).toEqual({
        ...mockHospital,
        services: ['surgery', 'cardiology'],
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospital by ID',
        hospitalId: '1',
        operation: 'getHospitalById',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Hospital fetched successfully',
        hospitalId: '1',
        hospitalName: mockHospital.name,
        operation: 'getHospitalById',
      });
    });

    it('should return null when hospital not found', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([]);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      const result = await service.getHospitalById('999');

      expect(result).toBeNull();

      expect(mockLogger.warn).toHaveBeenCalledWith({
        msg: 'Hospital not found',
        hospitalId: '999',
        operation: 'getHospitalById',
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      await expect(service.getHospitalById('1')).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospital',
        hospitalId: '1',
        error: dbError.message,
        operation: 'getHospitalById',
      });
    });
  });

  describe('getHospitalPrices', () => {
    it('should fetch hospital prices successfully', async () => {
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
        },
      ];

      const mockCountResult = { count: 1 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockResolvedValue(mockPrices);

      mockDatabaseService.db.select.mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue([mockCountResult]),
        }),
      }).mockReturnValueOnce({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await service.getHospitalPrices('1', { service: 'MRI' });

      expect(result).toEqual({
        hospitalId: '1',
        data: mockPrices,
        total: mockCountResult.count,
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospital prices',
        hospitalId: '1',
        filters: { service: 'MRI' },
        operation: 'getHospitalPrices',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Hospital prices fetched successfully',
        hospitalId: '1',
        priceCount: mockPrices.length,
        operation: 'getHospitalPrices',
      });
    });

    it('should handle database errors and log them', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabaseService.db.select.mockImplementation(() => {
        throw dbError;
      });

      await expect(service.getHospitalPrices('1', {})).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospital prices',
        hospitalId: '1',
        error: dbError.message,
        operation: 'getHospitalPrices',
      });
    });
  });

  describe('syncHospitalsFromPRA', () => {
    it('should sync hospitals from PRA successfully', async () => {
      const mockPraHospitals = [
        {
          id: 'pra-1',
          name: 'Test Hospital',
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          phone: '555-0123',
          url: 'https://test.com',
          beds: '100',
          lat: 37.7749,
          long: -122.4194,
          ccn: '050123',
          files: [],
        },
      ];

      mockPatientRightsAdvocateService.getHospitalsByState.mockResolvedValue(mockPraHospitals);

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([]);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      const mockInsert = jest.fn().mockReturnThis();
      const mockValues = jest.fn().mockResolvedValue(undefined);

      mockDatabaseService.db.insert.mockReturnValue({
        values: mockValues,
      });

      const result = await service.syncHospitalsFromPRA('CA');

      expect(result).toEqual({
        imported: 1,
        updated: 0,
        errors: 0,
      });

      expect(mockPatientRightsAdvocateService.getHospitalsByState).toHaveBeenCalledWith('CA');
      expect(mockDatabaseService.db.insert).toHaveBeenCalled();

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Starting hospital sync from Patient Rights Advocate API',
        state: 'CA',
        operation: 'syncHospitalsFromPRA',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Hospital sync completed',
        result: { imported: 1, updated: 0, errors: 0 },
        duration: expect.any(Number),
        state: 'CA',
        operation: 'syncHospitalsFromPRA',
      });
    });

    it('should update existing hospitals', async () => {
      const mockPraHospitals = [
        {
          id: 'pra-1',
          name: 'Updated Hospital',
          address: '456 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          phone: '555-0123',
          url: 'https://updated.com',
          beds: '200',
          lat: 37.7749,
          long: -122.4194,
          ccn: '050123',
          files: [],
        },
      ];

      const existingHospital = {
        id: '1',
        ccn: '050123',
        name: 'Old Hospital',
      };

      mockPatientRightsAdvocateService.getAllHospitals.mockResolvedValue(mockPraHospitals);

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([existingHospital]);

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      const mockUpdate = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnThis();
      const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);

      mockDatabaseService.db.update.mockReturnValue({
        set: mockSet.mockReturnValue({
          where: mockWhereUpdate,
        }),
      });

      const result = await service.syncHospitalsFromPRA();

      expect(result).toEqual({
        imported: 0,
        updated: 1,
        errors: 0,
      });

      expect(mockPatientRightsAdvocateService.getAllHospitals).toHaveBeenCalled();
      expect(mockDatabaseService.db.update).toHaveBeenCalled();
    });

    it('should handle errors during sync', async () => {
      const mockPraHospitals = [
        {
          id: 'pra-1',
          name: 'Test Hospital',
          ccn: '050123',
        },
      ];

      mockPatientRightsAdvocateService.getAllHospitals.mockResolvedValue(mockPraHospitals);

      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockRejectedValue(new Error('Database error'));

      mockDatabaseService.db.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      const result = await service.syncHospitalsFromPRA();

      expect(result).toEqual({
        imported: 0,
        updated: 0,
        errors: 1,
      });

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to process hospital',
        hospitalName: 'Test Hospital',
        ccn: '050123',
        error: 'Database error',
        operation: 'syncHospitalsFromPRA',
      });
    });

    it('should handle PRA API errors', async () => {
      const praError = new Error('PRA API error');
      mockPatientRightsAdvocateService.getAllHospitals.mockRejectedValue(praError);

      await expect(service.syncHospitalsFromPRA()).rejects.toThrow(praError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Hospital sync failed',
        error: praError.message,
        duration: expect.any(Number),
        state: undefined,
        operation: 'syncHospitalsFromPRA',
      });
    });
  });

  describe('getPRARateLimitStatus', () => {
    it('should return rate limit status from PRA service', () => {
      const mockStatus = { remaining: 100, total: 1000 };
      mockPatientRightsAdvocateService.getRateLimitStatus.mockReturnValue(mockStatus);

      const result = service.getPRARateLimitStatus();

      expect(result).toBe(mockStatus);
      expect(mockPatientRightsAdvocateService.getRateLimitStatus).toHaveBeenCalled();
    });
  });

  describe('getPRASessionStatus', () => {
    it('should return session status from PRA service', () => {
      const mockStatus = { isActive: true, sessionId: 'session-123' };
      mockPatientRightsAdvocateService.getSessionStatus.mockReturnValue(mockStatus);

      const result = service.getPRASessionStatus();

      expect(result).toBe(mockStatus);
      expect(mockPatientRightsAdvocateService.getSessionStatus).toHaveBeenCalled();
    });
  });
});