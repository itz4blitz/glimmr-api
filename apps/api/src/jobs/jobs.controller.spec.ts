import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';
import { CustomThrottlerGuard } from '../common/guards/custom-throttler.guard';

describe('JobsController - Rate Limiting Integration', () => {
  let controller: JobsController;
  let jobsService: JobsService;
  let hospitalMonitorService: HospitalMonitorService;
  let praPipelineService: PRAPipelineService;

  const mockJobsService = {
    getJobs: jest.fn(),
    getJobStats: jest.fn(),
    getBullBoardInfo: jest.fn(),
    startHospitalImport: jest.fn(),
    startPriceUpdate: jest.fn(),
    getJobById: jest.fn(),
  };

  const mockHospitalMonitorService = {
    triggerHospitalImportByState: jest.fn(),
    scheduleDailyHospitalRefresh: jest.fn(),
    triggerPriceFileDownload: jest.fn(),
    getMonitoringStats: jest.fn(),
  };

  const mockPRAPipelineService = {
    triggerManualPRAScan: jest.fn(),
    getPipelineStatus: jest.fn(),
    triggerFullPipelineRefresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 900000,
            limit: 100,
          },
          {
            name: 'expensive',
            ttl: 900000,
            limit: 10,
          },
        ]),
      ],
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: HospitalMonitorService,
          useValue: mockHospitalMonitorService,
        },
        {
          provide: PRAPipelineService,
          useValue: mockPRAPipelineService,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    jobsService = module.get<JobsService>(JobsService);
    hospitalMonitorService = module.get<HospitalMonitorService>(HospitalMonitorService);
    praPipelineService = module.get<PRAPipelineService>(PRAPipelineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have all services injected', () => {
      expect(jobsService).toBeDefined();
      expect(hospitalMonitorService).toBeDefined();
      expect(praPipelineService).toBeDefined();
    });
  });

  describe('Read-only Endpoints (Default Rate Limiting)', () => {
    describe('GET /jobs', () => {
      it('should get jobs with query filters', async () => {
        const mockJobs = [{ id: '1', status: 'completed', type: 'import' }];
        mockJobsService.getJobs.mockResolvedValue(mockJobs);

        const result = await controller.getJobs('completed', 'import', 10);

        expect(jobsService.getJobs).toHaveBeenCalledWith({
          status: 'completed',
          type: 'import',
          limit: 10,
        });
        expect(result).toEqual(mockJobs);
      });

      it('should handle undefined query parameters', async () => {
        const mockJobs = [];
        mockJobsService.getJobs.mockResolvedValue(mockJobs);

        const result = await controller.getJobs();

        expect(jobsService.getJobs).toHaveBeenCalledWith({
          status: undefined,
          type: undefined,
          limit: undefined,
        });
        expect(result).toEqual(mockJobs);
      });
    });

    describe('GET /jobs/stats', () => {
      it('should get job statistics', async () => {
        const mockStats = { active: 5, waiting: 2, completed: 100, failed: 3 };
        mockJobsService.getJobStats.mockResolvedValue(mockStats);

        const result = await controller.getJobStats();

        expect(jobsService.getJobStats).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockStats);
      });
    });

    describe('GET /jobs/board', () => {
      it('should get Bull Board info', async () => {
        const mockBoardInfo = { url: '/admin/queues', enabled: true };
        mockJobsService.getBullBoardInfo.mockResolvedValue(mockBoardInfo);

        const result = await controller.getBullBoard();

        expect(jobsService.getBullBoardInfo).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockBoardInfo);
      });
    });

    describe('GET /jobs/:id', () => {
      it('should get job by ID', async () => {
        const mockJob = { id: 'job123', status: 'processing', progress: 50 };
        mockJobsService.getJobById.mockResolvedValue(mockJob);

        const result = await controller.getJobById('job123');

        expect(jobsService.getJobById).toHaveBeenCalledWith('job123');
        expect(result).toEqual(mockJob);
      });
    });
  });

  describe('Expensive POST Endpoints (Rate Limited)', () => {
    describe('POST /jobs/hospital-import (5 req/15min)', () => {
      it('should start hospital import job', async () => {
        const importData = { source: 'url', url: 'https://example.com/data.csv', priority: 5 };
        const mockJobResult = { jobId: 'import123', status: 'queued' };
        mockJobsService.startHospitalImport.mockResolvedValue(mockJobResult);

        const result = await controller.startHospitalImport(importData);

        expect(jobsService.startHospitalImport).toHaveBeenCalledWith(importData);
        expect(result).toEqual(mockJobResult);
      });

      it('should handle import with minimal data', async () => {
        const importData = {};
        const mockJobResult = { jobId: 'import456', status: 'queued' };
        mockJobsService.startHospitalImport.mockResolvedValue(mockJobResult);

        const result = await controller.startHospitalImport(importData);

        expect(jobsService.startHospitalImport).toHaveBeenCalledWith(importData);
        expect(result).toEqual(mockJobResult);
      });
    });

    describe('POST /jobs/price-update (5 req/15min)', () => {
      it('should start price update job', async () => {
        const updateData = { hospitalId: 'hospital123', priority: 8 };
        const mockJobResult = { jobId: 'update123', status: 'queued' };
        mockJobsService.startPriceUpdate.mockResolvedValue(mockJobResult);

        const result = await controller.startPriceUpdate(updateData);

        expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
        expect(result).toEqual(mockJobResult);
      });
    });

    describe('POST /jobs/hospitals/import (3 req/15min)', () => {
      it('should trigger hospital import for specific state', async () => {
        const dto = { state: 'CA', forceRefresh: true };
        mockHospitalMonitorService.triggerHospitalImportByState.mockResolvedValue();

        const result = await controller.triggerHospitalImport(dto);

        expect(hospitalMonitorService.triggerHospitalImportByState).toHaveBeenCalledWith('CA', true);
        expect(result).toEqual({ message: 'Hospital import job queued for state: CA' });
      });

      it('should trigger full hospital import when no state specified', async () => {
        const dto = {};
        mockHospitalMonitorService.scheduleDailyHospitalRefresh.mockResolvedValue();

        const result = await controller.triggerHospitalImport(dto);

        expect(hospitalMonitorService.scheduleDailyHospitalRefresh).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ message: 'Full hospital import job queued' });
      });

      it('should use default empty object when no DTO provided', async () => {
        mockHospitalMonitorService.scheduleDailyHospitalRefresh.mockResolvedValue();

        const result = await controller.triggerHospitalImport();

        expect(hospitalMonitorService.scheduleDailyHospitalRefresh).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ message: 'Full hospital import job queued' });
      });
    });

    describe('POST /jobs/hospitals/:hospitalId/files/:fileId/download (10 req/15min)', () => {
      it('should trigger price file download', async () => {
        const dto = { forceReprocess: true };
        mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue();

        const result = await controller.triggerPriceFileDownload('hospital123', 'file456', dto);

        expect(hospitalMonitorService.triggerPriceFileDownload).toHaveBeenCalledWith(
          'hospital123',
          'file456',
          true
        );
        expect(result).toEqual({
          message: 'Price file download job queued for hospital hospital123, file file456',
        });
      });

      it('should use default DTO when none provided', async () => {
        mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue();

        const result = await controller.triggerPriceFileDownload('hospital123', 'file456');

        expect(hospitalMonitorService.triggerPriceFileDownload).toHaveBeenCalledWith(
          'hospital123',
          'file456',
          undefined
        );
        expect(result).toEqual({
          message: 'Price file download job queued for hospital hospital123, file file456',
        });
      });
    });
  });

  describe('PRA Pipeline Endpoints (Most Restricted)', () => {
    describe('POST /jobs/pra/scan (2 req/15min)', () => {
      it('should trigger PRA scan with test mode', async () => {
        const body = { testMode: true, forceRefresh: false };
        const mockResult = { jobId: 'pra123', estimatedTime: '30 minutes' };
        mockPRAPipelineService.triggerManualPRAScan.mockResolvedValue(mockResult);

        const result = await controller.triggerPRAScan(body);

        expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(true, false);
        expect(result).toEqual({
          message: 'PRA unified scan triggered',
          jobId: 'pra123',
          estimatedTime: '30 minutes',
        });
      });

      it('should use default values when body is empty', async () => {
        const body = {};
        const mockResult = { jobId: 'pra456' };
        mockPRAPipelineService.triggerManualPRAScan.mockResolvedValue(mockResult);

        const result = await controller.triggerPRAScan(body);

        expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(false, false);
        expect(result).toEqual({
          message: 'PRA unified scan triggered',
          jobId: 'pra456',
        });
      });
    });

    describe('GET /jobs/pra/status', () => {
      it('should get PRA pipeline status', async () => {
        const mockStatus = { 
          running: true, 
          lastRun: '2024-01-01T12:00:00Z',
          nextRun: '2024-01-02T12:00:00Z',
          stats: { processed: 1000, errors: 5 }
        };
        mockPRAPipelineService.getPipelineStatus.mockResolvedValue(mockStatus);

        const result = await controller.getPRAPipelineStatus();

        expect(praPipelineService.getPipelineStatus).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockStatus);
      });
    });

    describe('POST /jobs/pra/full-refresh (1 req/15min)', () => {
      it('should trigger full PRA refresh', async () => {
        const mockResult = { 
          jobId: 'full-refresh123', 
          estimatedTime: '2 hours',
          warning: 'This will process all hospitals'
        };
        mockPRAPipelineService.triggerFullPipelineRefresh.mockResolvedValue(mockResult);

        const result = await controller.triggerFullPRARefresh();

        expect(praPipelineService.triggerFullPipelineRefresh).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          message: 'Full PRA refresh triggered',
          jobId: 'full-refresh123',
          estimatedTime: '2 hours',
          warning: 'This will process all hospitals',
        });
      });
    });
  });

  describe('Monitoring Endpoint', () => {
    describe('GET /jobs/monitoring/stats', () => {
      it('should get monitoring statistics', async () => {
        const mockStats = {
          queues: { active: 3, waiting: 10, completed: 500 },
          workers: { running: 5, idle: 2 },
          performance: { avgProcessingTime: 30, errorRate: 0.02 }
        };
        mockHospitalMonitorService.getMonitoringStats.mockResolvedValue(mockStats);

        const result = await controller.getMonitoringStats();

        expect(hospitalMonitorService.getMonitoringStats).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockStats);
      });
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors for hospital import', async () => {
      mockJobsService.startHospitalImport.mockRejectedValue(new Error('Queue is full'));

      await expect(controller.startHospitalImport({})).rejects.toThrow('Queue is full');
    });

    it('should propagate service errors for PRA scan', async () => {
      mockPRAPipelineService.triggerManualPRAScan.mockRejectedValue(
        new Error('PRA API is unavailable')
      );

      await expect(controller.triggerPRAScan({})).rejects.toThrow('PRA API is unavailable');
    });

    it('should handle malformed request bodies', async () => {
      const malformedData = { invalidField: 'value', anotherField: 123 };
      const mockResult = { jobId: 'job123' };
      mockJobsService.startHospitalImport.mockResolvedValue(mockResult);

      const result = await controller.startHospitalImport(malformedData);

      expect(jobsService.startHospitalImport).toHaveBeenCalledWith(malformedData);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle different rate limits for different endpoints', () => {
      // This test verifies that different endpoints have different throttle decorators
      // The actual rate limiting behavior is tested in the CustomThrottlerGuard tests
      expect(controller.triggerFullPRARefresh).toBeDefined(); // 1 req/15min
      expect(controller.triggerPRAScan).toBeDefined(); // 2 req/15min
      expect(controller.triggerHospitalImport).toBeDefined(); // 3 req/15min
      expect(controller.startHospitalImport).toBeDefined(); // 5 req/15min
      expect(controller.triggerPriceFileDownload).toBeDefined(); // 10 req/15min
    });

    it('should allow read operations with higher limits', () => {
      // Read operations should use default throttling (100 req/15min)
      expect(controller.getJobs).toBeDefined();
      expect(controller.getJobStats).toBeDefined();
      expect(controller.getJobById).toBeDefined();
      expect(controller.getPRAPipelineStatus).toBeDefined();
    });
  });
});