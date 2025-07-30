import { Test, TestingModule } from "@nestjs/testing";
import { JobsController } from "./jobs.controller";
import { JobsService } from "../services/core/jobs.service";
import { HospitalMonitorService } from "../services/pipelines/hospital-monitor.service";
import { PRAPipelineService } from "../services/pipelines/pra-pipeline.service";
import { JobCleanupService } from "../services/operations/job-cleanup.service";
import { JobFilterQueryDto } from "../../common/dto/query.dto";
import {
  TriggerPriceFileDownloadDto,
  StartPriceUpdateDto,
  TriggerPRAScanDto,
} from "../dto/hospital-import.dto";
import { RbacService } from "../../auth/rbac.service";

describe("JobsController", () => {
  let controller: JobsController;
  let jobsService: JobsService;
  let hospitalMonitorService: HospitalMonitorService;
  let praPipelineService: PRAPipelineService;
  let jobCleanupService: JobCleanupService;

  const mockJobsService = {
    getJobs: jest.fn(),
    getJobStats: jest.fn(),
    getBullBoardInfo: jest.fn(),
    startPriceUpdate: jest.fn(),
    getJobById: jest.fn(),
  };

  const mockHospitalMonitorService = {
    triggerPriceFileDownload: jest.fn(),
    getMonitoringStats: jest.fn(),
  };

  const mockPraPipelineService = {
    triggerManualPRAScan: jest.fn(),
    getPipelineStatus: jest.fn(),
    triggerFullPipelineRefresh: jest.fn(),
  };

  const mockJobCleanupService = {
    getCleanupStats: jest.fn(),
    cleanupAllQueues: jest.fn(),
    cleanupSpecificQueue: jest.fn(),
    drainQueue: jest.fn(),
    obliterateQueue: jest.fn(),
    getAvailableQueues: jest.fn(),
    getDefaultPolicy: jest.fn(),
  };

  const mockRbacService = {
    hasPermission: jest.fn().mockResolvedValue(true),
    getUserPermissions: jest
      .fn()
      .mockResolvedValue(["read:jobs", "write:jobs"]),
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
        {
          provide: JobCleanupService,
          useValue: mockJobCleanupService,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    jobsService = module.get<JobsService>(JobsService);
    hospitalMonitorService = module.get<HospitalMonitorService>(
      HospitalMonitorService,
    );
    praPipelineService = module.get<PRAPipelineService>(PRAPipelineService);
    jobCleanupService = module.get<JobCleanupService>(JobCleanupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Controller Initialization", () => {
    it("should be defined", () => {
      expect(controller).toBeDefined();
    });

    it("should be an instance of JobsController", () => {
      expect(controller).toBeInstanceOf(JobsController);
    });

    it("should have all services injected", () => {
      expect(jobsService).toBeDefined();
      expect(hospitalMonitorService).toBeDefined();
      expect(praPipelineService).toBeDefined();
    });
  });

  describe("getJobs", () => {
    const mockJobsResponse = {
      data: [
        {
          id: "job-1",
          type: "hospital-import",
          status: "completed",
          progress: 100,
          createdAt: new Date("2024-01-01"),
          completedAt: new Date("2024-01-01"),
        },
        {
          id: "job-2",
          type: "price-update",
          status: "active",
          progress: 50,
          createdAt: new Date("2024-01-02"),
        },
      ],
      total: 2,
      limit: 50,
      filters: {
        status: undefined,
        type: undefined,
        limit: 50,
      },
    };

    it("should return jobs with all filters", async () => {
      const query: JobFilterQueryDto = {
        status: "completed",
        type: "hospital-import",
        limit: 10,
        offset: 0,
      };

      mockJobsService.getJobs.mockResolvedValue(mockJobsResponse);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockJobsResponse);
    });

    it("should return jobs with partial filters", async () => {
      const query: JobFilterQueryDto = { status: "active" };

      mockJobsService.getJobs.mockResolvedValue(mockJobsResponse);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockJobsResponse);
    });

    it("should return all jobs when no filters provided", async () => {
      const query: JobFilterQueryDto = {};

      mockJobsService.getJobs.mockResolvedValue(mockJobsResponse);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockJobsResponse);
    });

    it("should handle empty results", async () => {
      const query: JobFilterQueryDto = { status: "nonexistent" };
      const emptyResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockJobsService.getJobs.mockResolvedValue(emptyResponse);

      const result = await controller.getJobs(query);

      expect(result).toEqual(emptyResponse);
    });

    it("should handle type filter only", async () => {
      const query: JobFilterQueryDto = { type: "price-update" };

      mockJobsService.getJobs.mockResolvedValue(mockJobsResponse);

      const result = await controller.getJobs(query);

      expect(jobsService.getJobs).toHaveBeenCalledWith(query);
    });

    it("should handle pagination parameters", async () => {
      const query: JobFilterQueryDto = { limit: 25 };

      mockJobsService.getJobs.mockResolvedValue({
        ...mockJobsResponse,
        limit: 25,
      });

      const result = await controller.getJobs(query);

      expect(result.limit).toBe(25);
    });

    it("should propagate service errors", async () => {
      const query: JobFilterQueryDto = {};
      const error = new Error("Database connection failed");
      mockJobsService.getJobs.mockRejectedValue(error);

      await expect(controller.getJobs(query)).rejects.toThrow(error);
    });
  });

  describe("getJobStats", () => {
    const mockStats = {
      active: 5,
      waiting: 10,
      completed: 100,
      failed: 3,
      delayed: 2,
      totalProcessed: 120,
      avgProcessingTime: 30000,
    };

    it("should return job statistics", async () => {
      mockJobsService.getJobStats.mockResolvedValue(mockStats);

      const result = await controller.getJobStats();

      expect(jobsService.getJobStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStats);
    });

    it("should handle empty statistics", async () => {
      const emptyStats = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        totalProcessed: 0,
        avgProcessingTime: 0,
      };
      mockJobsService.getJobStats.mockResolvedValue(emptyStats);

      const result = await controller.getJobStats();

      expect(result).toEqual(emptyStats);
    });

    it("should propagate service errors", async () => {
      const error = new Error("Queue connection failed");
      mockJobsService.getJobStats.mockRejectedValue(error);

      await expect(controller.getJobStats()).rejects.toThrow(error);
    });
  });

  describe("getBullBoard", () => {
    const mockBoardInfo = {
      dashboardUrl: "/admin/queues",
      description: "Bull Board dashboard for monitoring job queues",
      features: [
        "Real-time job monitoring",
        "Queue management",
        "Job retry and cleanup",
        "Performance metrics",
        "Failed job analysis",
      ],
      authentication: "Admin access required",
      documentation: "https://api.glimmr.health/docs#bull-board",
    };

    it("should return Bull Board information", async () => {
      mockJobsService.getBullBoardInfo.mockResolvedValue(mockBoardInfo);

      const result = await controller.getBullBoard();

      expect(jobsService.getBullBoardInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockBoardInfo);
    });

    it("should handle disabled Bull Board", async () => {
      const disabledBoardInfo = {
        dashboardUrl: null,
        description: "Bull Board is disabled",
        features: [],
        authentication: "Not available",
        documentation: "https://api.glimmr.health/docs#bull-board",
      };
      mockJobsService.getBullBoardInfo.mockResolvedValue(disabledBoardInfo);

      const result = await controller.getBullBoard();

      expect(result.dashboardUrl).toBe(null);
    });

    it("should propagate service errors", async () => {
      const error = new Error("Bull Board not configured");
      mockJobsService.getBullBoardInfo.mockRejectedValue(error);

      await expect(controller.getBullBoard()).rejects.toThrow(error);
    });
  });

  describe("startPriceUpdate", () => {
    const mockJobResult = {
      jobId: "price-job-123",
      status: "queued",
      hospitalId: "456",
    };

    it("should start price update for specific hospital", async () => {
      const updateData: StartPriceUpdateDto = {
        hospitalId: "456",
        priority: 8,
      };

      mockJobsService.startPriceUpdate.mockResolvedValue(mockJobResult);

      const result = await controller.startPriceUpdate(updateData);

      expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(mockJobResult);
    });

    it("should start price update for all hospitals", async () => {
      const updateData: StartPriceUpdateDto = {
        priority: 5,
      };

      mockJobsService.startPriceUpdate.mockResolvedValue({
        ...mockJobResult,
        hospitalId: undefined,
      });

      const result = await controller.startPriceUpdate(updateData);

      expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
    });

    it("should handle empty update data", async () => {
      const updateData: StartPriceUpdateDto = {};

      mockJobsService.startPriceUpdate.mockResolvedValue(mockJobResult);

      const result = await controller.startPriceUpdate(updateData);

      expect(jobsService.startPriceUpdate).toHaveBeenCalledWith(updateData);
    });

    it("should propagate service errors", async () => {
      const updateData: StartPriceUpdateDto = { hospitalId: "456" };
      const error = new Error("Hospital not found");
      mockJobsService.startPriceUpdate.mockRejectedValue(error);

      await expect(controller.startPriceUpdate(updateData)).rejects.toThrow(
        error,
      );
    });
  });

  describe("getJobById", () => {
    const mockJob = {
      id: "job-123",
      type: "hospital-import",
      status: "processing",
      progress: 75,
      data: { source: "url", url: "https://example.com" },
      result: null,
      error: null,
      createdAt: new Date("2024-01-01"),
      startedAt: new Date("2024-01-01"),
    };

    it("should return job by ID", async () => {
      mockJobsService.getJobById.mockResolvedValue(mockJob);

      const result = await controller.getJobById("job-123");

      expect(jobsService.getJobById).toHaveBeenCalledWith("job-123");
      expect(result).toEqual(mockJob);
    });

    it("should handle different job ID formats", async () => {
      const jobIds = ["123", "job-456", "uuid-789-abc", "complex_job_id_123"];

      for (const id of jobIds) {
        mockJobsService.getJobById.mockResolvedValue({ ...mockJob, id });

        const result = await controller.getJobById(id);

        expect(jobsService.getJobById).toHaveBeenCalledWith(id);
        expect(result.id).toBe(id);
      }
    });

    it("should handle completed job", async () => {
      const completedJob = {
        ...mockJob,
        status: "completed",
        progress: 100,
        result: { processed: 150, errors: 0 },
        completedAt: new Date("2024-01-01"),
      };
      mockJobsService.getJobById.mockResolvedValue(completedJob);

      const result = await controller.getJobById("job-123");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
    });

    it("should handle failed job", async () => {
      const failedJob = {
        ...mockJob,
        status: "failed",
        progress: 50,
        failedReason: "Connection timeout",
        failedAt: new Date("2024-01-01"),
      };
      mockJobsService.getJobById.mockResolvedValue(failedJob);

      const result = await controller.getJobById("job-123");

      expect(result.status).toBe("failed");
      expect(result.failedReason).toBe("Connection timeout");
    });

    it("should propagate service errors", async () => {
      const error = new Error("Job not found");
      mockJobsService.getJobById.mockRejectedValue(error);

      await expect(controller.getJobById("nonexistent")).rejects.toThrow(error);
    });
  });

  describe("triggerPriceFileDownload", () => {
    it("should trigger download with force reprocess", async () => {
      const dto: TriggerPriceFileDownloadDto = { forceReprocess: true };
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(
        undefined,
      );

      const result = await controller.triggerPriceFileDownload(
        "hospital-123",
        "file-456",
        dto,
      );

      expect(
        hospitalMonitorService.triggerPriceFileDownload,
      ).toHaveBeenCalledWith("hospital-123", "file-456", true);
      expect(result).toEqual({
        message:
          "Price file download job queued for hospital hospital-123, file file-456",
      });
    });

    it("should trigger download without force reprocess", async () => {
      const dto: TriggerPriceFileDownloadDto = { forceReprocess: false };
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(
        undefined,
      );

      const result = await controller.triggerPriceFileDownload(
        "hospital-123",
        "file-456",
        dto,
      );

      expect(
        hospitalMonitorService.triggerPriceFileDownload,
      ).toHaveBeenCalledWith("hospital-123", "file-456", false);
    });

    it("should use default DTO when none provided", async () => {
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(
        undefined,
      );

      const result = await controller.triggerPriceFileDownload(
        "hospital-123",
        "file-456",
      );

      expect(
        hospitalMonitorService.triggerPriceFileDownload,
      ).toHaveBeenCalledWith("hospital-123", "file-456", undefined);
    });

    it("should handle different ID formats", async () => {
      const hospitalIds = ["123", "hosp-abc-456", "uuid-789"];
      const fileIds = ["file1", "f-123-xyz", "document.csv"];

      for (const hospitalId of hospitalIds) {
        for (const fileId of fileIds) {
          mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(
            undefined,
          );

          await controller.triggerPriceFileDownload(hospitalId, fileId);

          expect(
            hospitalMonitorService.triggerPriceFileDownload,
          ).toHaveBeenCalledWith(hospitalId, fileId, undefined);
        }
      }
    });

    it("should propagate service errors", async () => {
      const error = new Error("File not found");
      mockHospitalMonitorService.triggerPriceFileDownload.mockRejectedValue(
        error,
      );

      await expect(
        controller.triggerPriceFileDownload("hospital-123", "nonexistent"),
      ).rejects.toThrow(error);
    });
  });

  describe("getMonitoringStats", () => {
    const mockStats = {
      totalHospitals: 1500,
      activeFiles: 800,
      queueStatus: {
        "hospital-import": { active: 2, waiting: 5 },
        "price-update": { active: 1, waiting: 3 },
        "pra-scan": { active: 0, waiting: 1 },
      },
      lastUpdate: new Date("2024-01-01"),
    };

    it("should return monitoring statistics", async () => {
      mockHospitalMonitorService.getMonitoringStats.mockResolvedValue(
        mockStats,
      );

      const result = await controller.getMonitoringStats();

      expect(hospitalMonitorService.getMonitoringStats).toHaveBeenCalledTimes(
        1,
      );
      expect(result).toEqual(mockStats);
    });

    it("should handle empty monitoring stats", async () => {
      const emptyStats = {
        totalHospitals: 0,
        activeFiles: 0,
        queueStatus: {},
        lastUpdate: null,
      };
      mockHospitalMonitorService.getMonitoringStats.mockResolvedValue(
        emptyStats,
      );

      const result = await controller.getMonitoringStats();

      expect(result.totalHospitals).toBe(0);
    });

    it("should propagate service errors", async () => {
      const error = new Error("Monitoring service unavailable");
      mockHospitalMonitorService.getMonitoringStats.mockRejectedValue(error);

      await expect(controller.getMonitoringStats()).rejects.toThrow(error);
    });
  });

  describe("triggerPRAScan", () => {
    const mockScanResult = {
      jobId: "pra-scan-123",
      estimatedTime: "45 minutes",
      testMode: false,
    };

    it("should trigger PRA scan with test mode", async () => {
      const body: TriggerPRAScanDto = { testMode: true, forceRefresh: false };
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(
        mockScanResult,
      );

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(
        true,
        false,
      );
      expect(result).toEqual({
        message: "PRA unified scan triggered",
        ...mockScanResult,
      });
    });

    it("should trigger PRA scan with force refresh", async () => {
      const body: TriggerPRAScanDto = { testMode: false, forceRefresh: true };
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(
        mockScanResult,
      );

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(
        false,
        true,
      );
    });

    it("should use default values when body is empty", async () => {
      const body: TriggerPRAScanDto = {};
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(
        mockScanResult,
      );

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(
        false,
        false,
      );
    });

    it("should handle partial body parameters", async () => {
      const body: TriggerPRAScanDto = { testMode: true };
      mockPraPipelineService.triggerManualPRAScan.mockResolvedValue(
        mockScanResult,
      );

      const result = await controller.triggerPRAScan(body);

      expect(praPipelineService.triggerManualPRAScan).toHaveBeenCalledWith(
        true,
        false,
      );
    });

    it("should propagate service errors", async () => {
      const body: TriggerPRAScanDto = { testMode: true };
      const error = new Error("PRA API is unavailable");
      mockPraPipelineService.triggerManualPRAScan.mockRejectedValue(error);

      await expect(controller.triggerPRAScan(body)).rejects.toThrow(error);
    });
  });

  describe("getPRAPipelineStatus", () => {
    const mockPipelineStatus = {
      queue: "pra-unified-scan",
      waiting: 2,
      active: 1,
      completed: 150,
      failed: 3,
      delayed: 0,
      paused: false,
      timestamp: new Date("2024-01-01T10:00:00Z").toISOString(),
    };

    it("should return pipeline status", async () => {
      mockPraPipelineService.getPipelineStatus.mockResolvedValue(
        mockPipelineStatus,
      );

      const result = await controller.getPRAPipelineStatus();

      expect(praPipelineService.getPipelineStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPipelineStatus);
    });

    it("should handle idle pipeline status", async () => {
      const idleStatus = {
        ...mockPipelineStatus,
        active: 0,
        waiting: 0,
      };
      mockPraPipelineService.getPipelineStatus.mockResolvedValue(idleStatus);

      const result = await controller.getPRAPipelineStatus();

      expect(result.active).toBe(0);
      expect(result.waiting).toBe(0);
    });

    it("should propagate service errors", async () => {
      const error = new Error("Pipeline status service error");
      mockPraPipelineService.getPipelineStatus.mockRejectedValue(error);

      await expect(controller.getPRAPipelineStatus()).rejects.toThrow(error);
    });
  });

  describe("triggerFullPRARefresh", () => {
    const mockRefreshResult = {
      jobId: "full-refresh-123",
      testMode: false,
      forceRefresh: true,
    };

    it("should trigger full PRA refresh", async () => {
      mockPraPipelineService.triggerFullPipelineRefresh.mockResolvedValue(
        mockRefreshResult,
      );

      const result = await controller.triggerFullPRARefresh();

      expect(
        praPipelineService.triggerFullPipelineRefresh,
      ).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: "Full PRA refresh triggered",
        ...mockRefreshResult,
      });
    });

    it("should handle refresh with force refresh enabled", async () => {
      const forceRefreshResult = {
        ...mockRefreshResult,
        forceRefresh: true,
      };
      mockPraPipelineService.triggerFullPipelineRefresh.mockResolvedValue(
        forceRefreshResult,
      );

      const result = await controller.triggerFullPRARefresh();

      expect(result.forceRefresh).toBe(true);
      expect(result.message).toBe("Full PRA refresh triggered");
    });

    it("should propagate service errors", async () => {
      const error = new Error("Full refresh not allowed during maintenance");
      mockPraPipelineService.triggerFullPipelineRefresh.mockRejectedValue(
        error,
      );

      await expect(controller.triggerFullPRARefresh()).rejects.toThrow(error);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle service timeouts", async () => {
      const timeoutError = new Error("Service timeout");
      timeoutError.name = "TimeoutError";
      mockJobsService.getJobStats.mockRejectedValue(timeoutError);

      await expect(controller.getJobStats()).rejects.toThrow("Service timeout");
    });

    it("should preserve error details for debugging", async () => {
      const detailedError = new Error("Database connection pool exhausted");
      detailedError.stack =
        "Error: Database connection pool exhausted\n    at Connection.js:123:45";
      mockJobsService.getJobs.mockRejectedValue(detailedError);

      await expect(controller.getJobs({})).rejects.toThrow(detailedError);
    });
  });

  describe("Input Validation Edge Cases", () => {
    it("should handle very long job IDs", async () => {
      const longJobId = "a".repeat(1000);
      const mockJob = { id: longJobId, status: "completed" };
      mockJobsService.getJobById.mockResolvedValue(mockJob);

      const result = await controller.getJobById(longJobId);

      expect(jobsService.getJobById).toHaveBeenCalledWith(longJobId);
    });

    it("should handle Unicode characters in hospital and file IDs", async () => {
      const unicodeHospitalId = "hôpital-123";
      const unicodeFileId = "fichier-données.csv";
      mockHospitalMonitorService.triggerPriceFileDownload.mockResolvedValue(
        undefined,
      );

      await controller.triggerPriceFileDownload(
        unicodeHospitalId,
        unicodeFileId,
      );

      expect(
        hospitalMonitorService.triggerPriceFileDownload,
      ).toHaveBeenCalledWith(unicodeHospitalId, unicodeFileId, undefined);
    });
  });
});
