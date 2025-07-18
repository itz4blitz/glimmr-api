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
import { PinoLogger } from 'nestjs-pino';
import { HospitalsService } from './hospitals.service';
import { DatabaseService } from '../database/database.service';
import { PatientRightsAdvocateService } from '../external-apis/patient-rights-advocate.service';
import { HospitalNotFoundException, DatabaseOperationException } from '../common/exceptions';

describe('HospitalsService', () => {
  let service: HospitalsService;
  let mockDatabaseService: Partial<DatabaseService>;
  let mockPatientRightsAdvocateService: Partial<PatientRightsAdvocateService>;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    // Mock database service
    mockDatabaseService = {
      db: {
        select: jest.fn(),
        update: jest.fn(),
        insert: jest.fn(),
      } as any,
    };

    // Mock Patient Rights Advocate service
    mockPatientRightsAdvocateService = {
      getHospitalsByState: jest.fn(),
      getAllHospitals: jest.fn(),
      getRateLimitStatus: jest.fn(),
      getSessionStatus: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HospitalsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: PatientRightsAdvocateService, useValue: mockPatientRightsAdvocateService },
        { provide: PinoLogger, useValue: mockLogger },
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
  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be an instance of HospitalsService', () => {
      expect(service).toBeInstanceOf(HospitalsService);
    });
  });

  describe('getHospitals', () => {
    it('should successfully return hospitals with pagination', async () => {
      const mockHospitals = [
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
      const mockCountResult = { count: 2 };

      // Mock database queries
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue(mockHospitals),
                }),
              }),
            }),
          }),
        });

      const result = await service.getHospitals({
        state: 'CA',
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        data: mockHospitals,
        total: 2,
        limit: 10,
        offset: 0,
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospitals with filters',
        filters: { state: 'CA', limit: 10, offset: 0 },
        operation: 'getHospitals',
      });
    });

    it('should handle database errors and throw DatabaseOperationException', async () => {
      const dbError = new Error('Database connection failed');
      
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(dbError),
          }),
        });

      await expect(service.getHospitals({})).rejects.toThrow(DatabaseOperationException);
      await expect(service.getHospitals({})).rejects.toThrow('Database operation failed: fetch hospitals');
      
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospitals',
        error: 'Database connection failed',
        duration: expect.any(Number),
        operation: 'getHospitals',
        filters: {},
      });
    });

    it('should apply filters correctly', async () => {
      const mockCountResult = { count: 1 };
      const mockHospitals = [
        {
          id: '1',
          name: 'Test Hospital',
          state: 'TX',
          city: 'Houston',
          address: '123 Main St',
          phone: '555-0123',
          website: 'https://test.com',
          bedCount: 200,
          ownership: 'Private',
          hospitalType: 'General',
          lastUpdated: new Date(),
        },
      ];

      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue(mockHospitals),
                }),
              }),
            }),
          }),
        });

      const result = await service.getHospitals({
        state: 'TX',
        city: 'Houston',
        name: 'Test',
        limit: 5,
        offset: 10,
      });

      expect(result).toEqual({
        data: mockHospitals,
        total: 1,
        limit: 5,
        offset: 10,
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
        ownership: 'Private',
        hospitalType: 'General',
        lastUpdated: new Date(),
      };

      const mockServices = [
        { category: 'Emergency Services' },
        { category: 'Surgery' },
        { category: 'Radiology' },
      ];

      // Mock hospital query
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockHospital]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              groupBy: jest.fn().mockResolvedValue(mockServices),
            }),
          }),
        });

      const result = await service.getHospitalById('123');

      expect(result).toEqual({
        ...mockHospital,
        services: ['Emergency Services', 'Surgery', 'Radiology'],
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospital by ID',
        hospitalId: '123',
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
    it('should throw HospitalNotFoundException when hospital not found', async () => {
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]), // Empty result
            }),
          }),
        });

      await expect(service.getHospitalById('nonexistent')).rejects.toThrow(HospitalNotFoundException);
      await expect(service.getHospitalById('nonexistent')).rejects.toThrow('Hospital with ID nonexistent not found');
      
      expect(mockLogger.warn).toHaveBeenCalledWith({
        msg: 'Hospital not found',
        hospitalId: 'nonexistent',
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
    it('should handle database errors and throw DatabaseOperationException', async () => {
      const dbError = new Error('Database query failed');
      
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockRejectedValue(dbError),
            }),
          }),
        });

      await expect(service.getHospitalById('123')).rejects.toThrow(DatabaseOperationException);
      await expect(service.getHospitalById('123')).rejects.toThrow('Database operation failed: fetch hospital');
      
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospital',
        hospitalId: '123',
        error: 'Database query failed',
        operation: 'getHospitalById',
      });
    });

    it('should preserve HospitalNotFoundException and not wrap it in DatabaseOperationException', async () => {
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]), // Empty result (triggers HospitalNotFoundException)
            }),
          }),
        });

      await expect(service.getHospitalById('123')).rejects.toThrow(HospitalNotFoundException);
      await expect(service.getHospitalById('123')).rejects.not.toThrow(DatabaseOperationException);
    });
  });

  describe('getHospitalPrices', () => {
    it('should successfully return hospital prices', async () => {
      const mockPrices = [
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
      const mockCountResult = { count: 2 };

      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockCountResult]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(mockPrices),
            }),
          }),
        });

      const result = await service.getHospitalPrices('123', { service: 'Emergency' });

      expect(result).toEqual({
        hospitalId: '123',
        data: mockPrices,
        total: 2,
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Fetching hospital prices',
        hospitalId: '123',
        filters: { service: 'Emergency' },
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
    it('should handle database errors in getHospitalPrices', async () => {
      const dbError = new Error('Database connection failed');
      
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockRejectedValue(dbError),
          }),
        });

      await expect(service.getHospitalPrices('123', {})).rejects.toThrow(dbError);
      
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to fetch hospital prices',
        hospitalId: '123',
        error: 'Database connection failed',
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
    it('should successfully sync hospitals from PRA API', async () => {
      const mockPRAHospitals = [
        {
          id: 'pra-123',
          name: 'Test Hospital',
          address: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210',
          phone: '555-0123',
          beds: '100',
          lat: '34.0522',
          long: '-118.2437',
          ccn: '050001',
          url: 'https://test.com',
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
      mockPatientRightsAdvocateService.getHospitalsByState = jest.fn()
        .mockResolvedValue(mockPRAHospitals);

      // Mock database operations
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]), // No existing hospital
            }),
          }),
        });

      mockDatabaseService.db.insert = jest.fn()
        .mockReturnValue({
          values: jest.fn().mockResolvedValue(undefined),
        });

      const result = await service.syncHospitalsFromPRA('CA');

      expect(result).toEqual({
        imported: 1,
        updated: 0,
        errors: 0,
      });

      expect(mockPatientRightsAdvocateService.getHospitalsByState).toHaveBeenCalledWith('CA');
      expect(mockDatabaseService.db.insert).toHaveBeenCalled();

      expect(mockPatientRightsAdvocateService.getHospitalsByState).toHaveBeenCalledWith('CA');
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
    });

    it('should update existing hospitals', async () => {
      const mockPRAHospitals = [
        {
          id: 'pra-123',
          name: 'Updated Hospital Name',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210',
          phone: '555-0456',
          beds: '150',
          lat: '34.0522',
          long: '-118.2437',
          ccn: '050001',
          url: 'https://updated.com',
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
        id: 'existing-id',
        name: 'Old Hospital Name',
        ccn: '050001',
      };

      mockPatientRightsAdvocateService.getHospitalsByState = jest.fn()
        .mockResolvedValue(mockPRAHospitals);

      mockDatabaseService.db.select = jest.fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingHospital]),
            }),
          }),
        });

      mockDatabaseService.db.update = jest.fn()
        .mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        });

      const result = await service.syncHospitalsFromPRA('CA');

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
    });

    it('should handle external service errors', async () => {
      const praError = new Error('PRA API unavailable');
      
      mockPatientRightsAdvocateService.getHospitalsByState = jest.fn()
        .mockRejectedValue(praError);

      await expect(service.syncHospitalsFromPRA('CA')).rejects.toThrow(praError);
      
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Hospital sync failed',
        error: 'PRA API unavailable',
        duration: expect.any(Number),
        state: 'CA',
        operation: 'syncHospitalsFromPRA',
      });
    });

    it('should handle database errors during sync', async () => {
      const mockPRAHospitals = [
        {
          id: 'pra-123',
          name: 'Test Hospital',
          address: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210',
          phone: '555-0123',
          beds: '100',
          lat: '34.0522',
          long: '-118.2437',
          ccn: '050001',
          url: 'https://test.com',
          files: [],
        },
      ];

      mockPatientRightsAdvocateService.getHospitalsByState = jest.fn()
        .mockResolvedValue(mockPRAHospitals);

      const dbError = new Error('Database insert failed');
      
      mockDatabaseService.db.select = jest.fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        });

      mockDatabaseService.db.insert = jest.fn()
        .mockReturnValue({
          values: jest.fn().mockRejectedValue(dbError),
        });

      const result = await service.syncHospitalsFromPRA('CA');

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
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to process hospital',
        hospitalName: 'Test Hospital',
        ccn: '050001',
        error: 'Database insert failed',
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
  describe('Helper Methods', () => {
    it('should return PRA rate limit status', () => {
      const mockRateLimit = {
        maxRequests: 100,
        currentRequests: 25,
        remainingRequests: 75,
        windowMs: 180000,
        resetTime: new Date(),
      };

      mockPatientRightsAdvocateService.getRateLimitStatus = jest.fn()
        .mockReturnValue(mockRateLimit);

      const result = service.getPRARateLimitStatus();

      expect(result).toEqual(mockRateLimit);
      expect(mockPatientRightsAdvocateService.getRateLimitStatus).toHaveBeenCalled();
    });

    it('should return PRA session status', () => {
      const mockSession = {
        sessionId: 'session-123',
        hasSession: true,
        sessionExpiry: Date.now() + 30 * 60 * 1000,
        isExpired: false,
        timeUntilExpiry: 30 * 60 * 1000,
      };

      mockPatientRightsAdvocateService.getSessionStatus = jest.fn()
        .mockReturnValue(mockSession);

      const result = service.getPRASessionStatus();

      expect(result).toEqual(mockSession);
      expect(mockPatientRightsAdvocateService.getSessionStatus).toHaveBeenCalled();
    });
  });
});