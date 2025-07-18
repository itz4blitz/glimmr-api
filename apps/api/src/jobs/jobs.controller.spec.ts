import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';

describe('JobsController', () => {
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

  const mockPraPipelineService = {
    triggerManualPRAScan: jest.fn(),
    getPipelineStatus: jest.fn(),
    triggerFullPipelineRefresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
          useValue: mockPraPipelineService,
        },
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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getJobs', () => {
    it('should call jobsService.getJobs with query parameters', async () => {
      const query = { status: 'completed', type: 'import', limit: 10, offset: 0 };
      const expectedResult = { jobs: [], total: 0 };
      
      mockJobsService.getJobs.mockResolvedValue(expectedResult);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = { jobs: [], total: 0 };
      
      mockJobsService.getJobs.mockResolvedValue(expectedResult);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial query parameters', async () => {
      const query = { limit: 5 };
      const expectedResult = { jobs: [], total: 0 };
      
      mockJobsService.getJobs.mockResolvedValue(expectedResult);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getJobStats', () => {
    it('should call jobsService.getJobStats', async () => {
      const expectedResult = { completed: 10, running: 2, failed: 1 };
      
      mockJobsService.getJobStats.mockResolvedValue(expectedResult);

      const result = await controller.getJobStats();

      expect(jobsService.getJobStats).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getBullBoard', () => {
    it('should call jobsService.getBullBoardInfo', async () => {
      const expectedResult = { url: 'http://localhost:3000/api/v1/admin/queues' };
      
      mockJobsService.getBullBoardInfo.mockResolvedValue(expectedResult);

      const result = await controller.getBullBoard();

      expect(jobsService.getBullBoardInfo).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('startHospitalImport', () => {
    it('should call jobsService.startHospitalImport with valid data', async () => {
      const importData = {
        source: 'url',
        url: 'https://example.com/data.csv',
        priority: 5,
      };
      const expectedResult = { jobId: 'job-123', status: 'queued' };
      
      mockJobsService.startHospitalImport.mockResolvedValue(expectedResult);

      const result = await controller.startHospitalImport(importData);

      expect(jobsService.startHospitalImport).toHaveBeenCalledWith(importData);
      expect(result).toEqual(expectedResult);
    });

    it('should handle minimal data', async () => {
      const importData = {
        source: 'manual',
      };
      const expectedResult = { jobId: 'job-124', status: 'queued' };
      
      mockJobsService.startHospitalImport.mockResolvedValue(expectedResult);

      const result = await controller.startHospitalImport(importData);

      expect(jobsService.startHospitalImport).toHaveBeenCalledWith(importData);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('startPriceUpdate', () => {
    it('should call jobsService.startPriceUpdate with valid data', async () => {
      const updateData = {
        hospitalId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 7,
      };
      const expectedResult = { jobId: 'job-125', status: 'queued' };
      
      mockJobsService.startPriceUpdate.mockResolvedValue(expectedResult);

      const result = await controller.startPriceUpdate(updateData);

      expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty data', async () => {
      const updateData = {};
      const expectedResult = { jobId: 'job-126', status: 'queued' };
      
      mockJobsService.startPriceUpdate.mockResolvedValue(expectedResult);

      const result = await controller.startPriceUpdate(updateData);

      expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getJobById', () => {
    it('should call jobsService.getJobById with job ID', async () => {
      const jobId = 'job-123';
      const expectedResult = { id: jobId, status: 'completed', type: 'import' };
      
      mockJobsService.getJobById.mockResolvedValue(expectedResult);

      const result = await controller.getJobById(jobId);

      expect(jobsService.getJobById).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('triggerHospitalImport', () => {
    it('should call hospitalMonitorService.triggerHospitalImportByState when state is provided', async () => {
      const dto = { state: 'CA', forceRefresh: true };
      
      mockHospitalMonitorService.triggerHospitalImportByState.mockResolvedValue(undefined);

      const result = await controller.triggerHospitalImport(dto);

      expect(hospitalMonitorService.triggerHospitalImportByState).toHaveBeenCalledWith('CA', true);
      expect(result).toEqual({ message: 'Hospital import job queued for state: CA' });
    });

    it('should call hospitalMonitorService.scheduleDailyHospitalRefresh when no state is provided', async () => {
      const dto = {};
      
      mockHospitalMonitorService.scheduleDailyHospitalRefresh.mockResolvedValue(undefined);

      const result = await controller.triggerHospitalImport(dto);

      expect(hospitalMonitorService.scheduleDailyHospitalRefresh).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Full hospital import job queued' });
    });

    it('should handle default empty DTO', async () => {
      mockHospitalMonitorService.scheduleDailyHospitalRefresh.mockResolvedValue(undefined);

      const result = await controller.triggerHospitalImport();

      expect(hospitalMonitorService.scheduleDailyHospitalRefresh).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Full hospital import job queued' });
    });
  });

  describe('triggerPriceFileDownload', () => {
    it('should call hospitalMonitorService.triggerPriceFileDownload with parameters', async () => {
      const hospitalId = 'hospital-123';
      const fileId = 'file-456';
      const dto = { forceReprocess: true };
      
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(undefined);

      const result = await controller.triggerPriceFileDownload(hospitalId, fileId, dto);

      expect(hospitalMonitorService.triggerPriceFileDownload).toHaveBeenCalledWith(hospitalId, fileId, true);
      expect(result).toEqual({ message: 'Price file download job queued for hospital hospital-123, file file-456' });
    });

    it('should handle default empty DTO', async () => {
      const hospitalId = 'hospital-123';
      const fileId = 'file-456';
      
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(undefined);

      const result = await controller.triggerPriceFileDownload(hospitalId, fileId);

      expect(hospitalMonitorService.triggerPriceFileDownload).toHaveBeenCalledWith(hospitalId, fileId, undefined);
      expect(result).toEqual({ message: 'Price file download job queued for hospital hospital-123, file file-456' });
    });
  });

  describe('getMonitoringStats', () => {
    it('should call hospitalMonitorService.getMonitoringStats', async () => {
      const expectedResult = { totalHospitals: 100, activeFiles: 50 };
      
      mockHospitalMonitorService.getMonitoringStats.mockResolvedValue(expectedResult);

      const result = await controller.getMonitoringStats();

      expect(hospitalMonitorService.getMonitoringStats).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('triggerPRAScan', () => {
    it('should call praPipelineService.triggerManualPRAScan with parameters', async () => {
      const body = { testMode: true, forceRefresh: false };
      const expectedResult = { jobId: 'pra-job-123' };
      
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(expectedResult);

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(true, false);
      expect(result).toEqual({ message: 'PRA unified scan triggered', jobId: 'pra-job-123' });
    });

    it('should handle default values when not provided', async () => {
      const body = {};
      const expectedResult = { jobId: 'pra-job-124' };
      
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(expectedResult);

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(false, false);
      expect(result).toEqual({ message: 'PRA unified scan triggered', jobId: 'pra-job-124' });
    });
  });

  describe('getPRAPipelineStatus', () => {
    it('should call praPipelineService.getPipelineStatus', async () => {
      const expectedResult = { status: 'running', lastRun: new Date() };
      
      mockPraPipelineService.getPipelineStatus.mockResolvedValue(expectedResult);

      const result = await controller.getPRAPipelineStatus();

      expect(praPipelineService.getPipelineStatus).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('triggerFullPRARefresh', () => {
    it('should call praPipelineService.triggerFullPipelineRefresh', async () => {
      const expectedResult = { jobId: 'full-refresh-123' };
      
      mockPraPipelineService.triggerFullPipelineRefresh.mockResolvedValue(expectedResult);

      const result = await controller.triggerFullPRARefresh();

      expect(praPipelineService.triggerFullPipelineRefresh).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Full PRA refresh triggered', jobId: 'full-refresh-123' });
    });
  });
});