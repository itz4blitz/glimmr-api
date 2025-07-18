import { Test, TestingModule } from '@nestjs/testing';
import { HospitalsService } from './hospitals.service';
import { DatabaseService } from '../database/database.service';
import { PatientRightsAdvocateService } from '../external-apis/patient-rights-advocate.service';
import { PinoLogger } from 'nestjs-pino';
import { HospitalNotFoundException, DatabaseOperationException } from '../common/exceptions';

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

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be an instance of HospitalsService', () => {
      expect(service).toBeInstanceOf(HospitalsService);
    });
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
        },
      ];

      mockDatabaseService.db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              offset: jest.fn().mockResolvedValue(mockHospitals),
            }),
          }),
        }),
      });

      const result = await service.getHospitals({ state: 'CA', limit: 10, offset: 0 });

      expect(result).toEqual(mockHospitals);
      expect(mockDatabaseService.db.select).toHaveBeenCalled();
    });
  });
});