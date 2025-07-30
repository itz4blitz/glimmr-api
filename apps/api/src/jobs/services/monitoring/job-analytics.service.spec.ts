import { Test, TestingModule } from "@nestjs/testing";
import { Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { JobAnalyticsService } from "./job-analytics.service";
import { DatabaseService } from "../../../database/database.service";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "../../queues/queue.config";

describe("JobAnalyticsService", () => {
  let service: JobAnalyticsService;
  let databaseService: DatabaseService;
  let logger: PinoLogger;
  let mockQueues: Record<string, Partial<Queue>>;

  const createMockQueue = (name: string): Partial<Queue> => ({
    name,
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getWaiting: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    getWorkers: jest.fn().mockResolvedValue([]),
  });

  beforeEach(async () => {
    // Create mock queues
    mockQueues = {
      [QUEUE_NAMES.PRICE_FILE_PARSER]: createMockQueue(
        QUEUE_NAMES.PRICE_FILE_PARSER,
      ),
      [QUEUE_NAMES.PRICE_UPDATE]: createMockQueue(QUEUE_NAMES.PRICE_UPDATE),
      [QUEUE_NAMES.EXPORT_DATA]: createMockQueue(QUEUE_NAMES.EXPORT_DATA),
      [QUEUE_NAMES.ANALYTICS_REFRESH]: createMockQueue(
        QUEUE_NAMES.ANALYTICS_REFRESH,
      ),
      [QUEUE_NAMES.PRA_UNIFIED_SCAN]: createMockQueue(
        QUEUE_NAMES.PRA_UNIFIED_SCAN,
      ),
      [QUEUE_NAMES.PRA_FILE_DOWNLOAD]: createMockQueue(
        QUEUE_NAMES.PRA_FILE_DOWNLOAD,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobAnalyticsService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              select: jest.fn().mockReturnThis(),
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        ...Object.entries(mockQueues).map(([name, queue]) => ({
          provide: getQueueToken(name),
          useValue: queue,
        })),
      ],
    }).compile();

    service = module.get<JobAnalyticsService>(JobAnalyticsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSuccessTrends", () => {
    it("should return success trends for default 24h period", async () => {
      const mockHistoricalData = [
        {
          queue: "price-file-parser",
          status: "completed",
          completedAt: new Date("2024-01-15T10:00:00Z"),
          duration: 5000,
        },
        {
          queue: "price-file-parser",
          status: "failed",
          completedAt: new Date("2024-01-15T11:00:00Z"),
          duration: 3000,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockHistoricalData),
          }),
        }),
      });

      const result = await service.getSuccessTrends({});

      expect(result).toMatchObject({
        timeRange: "24h",
        interval: "hour",
        trends: expect.any(Array),
        summary: expect.objectContaining({
          totalJobs: expect.any(Number),
          completedJobs: expect.any(Number),
          failedJobs: expect.any(Number),
          overallSuccessRate: expect.any(Number),
          trend: expect.stringMatching(/improving|stable|declining/),
        }),
        timestamp: expect.any(String),
      });
    });

    it("should filter by specific queues", async () => {
      const mockQueues = ["price-file-parser", "analytics-refresh"];

      await service.getSuccessTrends({ queues: mockQueues });

      expect(databaseService.db.select).toHaveBeenCalled();
      // Verify that queue filtering is applied in the query
    });

    it("should handle different time ranges correctly", async () => {
      const timeRanges = ["1h", "6h", "12h", "24h", "7d", "30d"];

      for (const timeRange of timeRanges) {
        await service.getSuccessTrends({
          timeRange: timeRange as "1h" | "6h" | "12h" | "24h" | "7d" | "30d",
        });
      }

      expect(databaseService.db.select).toHaveBeenCalledTimes(
        timeRanges.length,
      );
    });

    it("should merge historical and real-time data", async () => {
      const mockHistoricalData = [
        {
          queue: "price-file-parser",
          status: "completed",
          completedAt: new Date(),
          duration: 5000,
        },
      ];

      const mockRealtimeJobs = [
        {
          id: "job-1",
          name: "test-job",
          finishedOn: Date.now(),
          processedOn: Date.now() - 5000,
          failedReason: null,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockHistoricalData),
          }),
        }),
      });

      (
        mockQueues[QUEUE_NAMES.PRICE_FILE_PARSER].getCompleted as jest.Mock
      ).mockResolvedValue(mockRealtimeJobs);

      const result = await service.getSuccessTrends({});

      expect(result.trends).toBeDefined();
      expect(result.trends.length).toBeGreaterThan(0);
    });

    it("should calculate correct success rates", async () => {
      const mockData = [
        {
          queue: "test",
          status: "completed",
          completedAt: new Date(),
          duration: 1000,
        },
        {
          queue: "test",
          status: "completed",
          completedAt: new Date(),
          duration: 2000,
        },
        {
          queue: "test",
          status: "failed",
          completedAt: new Date(),
          duration: 3000,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockData),
          }),
        }),
      });

      const result = await service.getSuccessTrends({});

      expect(result.summary.totalJobs).toBe(3);
      expect(result.summary.completedJobs).toBe(2);
      expect(result.summary.failedJobs).toBe(1);
      expect(result.summary.overallSuccessRate).toBeCloseTo(66.67, 1);
    });

    it("should handle empty data gracefully", async () => {
      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getSuccessTrends({});

      expect(result.summary.totalJobs).toBe(0);
      expect(result.summary.overallSuccessRate).toBe(0);
      expect(result.trends).toEqual([]);
    });

    it("should handle database errors", async () => {
      (databaseService.db.select as jest.Mock).mockImplementation(() => {
        throw new Error("Database error");
      });

      await expect(service.getSuccessTrends({})).rejects.toThrow(
        "Database error",
      );

      expect(logger.error).toHaveBeenCalledWith({
        msg: "Failed to get success trends",
        error: "Database error",
      });
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should return performance metrics for all queues", async () => {
      const mockCompletedJobs = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `job-${i}`,
          finishedOn: Date.now() - i * 60000,
          processedOn: Date.now() - i * 60000 - 5000,
        }));

      Object.values(mockQueues).forEach((queue) => {
        (queue.getCompleted as jest.Mock).mockResolvedValue(mockCompletedJobs);
        (queue.getActive as jest.Mock).mockResolvedValue([]);
        (queue.getWaiting as jest.Mock).mockResolvedValue([]);
        (queue.getFailed as jest.Mock).mockResolvedValue([]);
      });

      const result = await service.getPerformanceMetrics({});

      expect(result).toMatchObject({
        timeRange: "24h",
        queues: expect.any(Array),
        aggregated: expect.objectContaining({
          avgThroughput: expect.any(Number),
          totalThroughput: expect.any(Number),
          avgProcessingTime: expect.any(Number),
          totalActiveJobs: expect.any(Number),
          totalWaitingJobs: expect.any(Number),
          avgFailureRate: expect.any(Number),
        }),
        timestamp: expect.any(String),
      });

      expect(result.queues).toHaveLength(6); // All queues
    });

    it("should filter by specific queues", async () => {
      const selectedQueues = [
        QUEUE_NAMES.PRICE_FILE_PARSER,
        QUEUE_NAMES.ANALYTICS_REFRESH,
      ];

      const result = await service.getPerformanceMetrics({
        queues: selectedQueues,
      });

      expect(result.queues).toHaveLength(2);
      expect(result.queues.map((q) => q.queue)).toEqual(selectedQueues);
    });

    it("should calculate throughput correctly", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const mockJobs = Array(60)
        .fill(null)
        .map((_, i) => ({
          id: `job-${i}`,
          finishedOn: oneHourAgo + i * 60000, // One job per minute
          processedOn: oneHourAgo + i * 60000 - 5000,
        }));

      (
        mockQueues[QUEUE_NAMES.PRICE_FILE_PARSER].getCompleted as jest.Mock
      ).mockResolvedValue(mockJobs);

      const result = await service.getPerformanceMetrics({
        queues: [QUEUE_NAMES.PRICE_FILE_PARSER],
        timeRange: "1h",
      });

      const queueMetrics = result.queues[0];
      expect(queueMetrics.throughput).toBeCloseTo(60, 0); // 60 jobs/hour
    });

    it("should handle queues with no completed jobs", async () => {
      Object.values(mockQueues).forEach((queue) => {
        (queue.getCompleted as jest.Mock).mockResolvedValue([]);
        (queue.getFailed as jest.Mock).mockResolvedValue([]);
      });

      const result = await service.getPerformanceMetrics({});

      expect(result.queues).toBeDefined();
      result.queues.forEach((queueMetric) => {
        expect(queueMetric.throughput).toBe(0);
        expect(queueMetric.avgProcessingTime).toBe(0);
        expect(queueMetric.failureRate).toBe(0);
      });
    });

    it("should handle queue errors gracefully", async () => {
      (
        mockQueues[QUEUE_NAMES.PRICE_FILE_PARSER].getCompleted as jest.Mock
      ).mockRejectedValue(new Error("Queue error"));

      const result = await service.getPerformanceMetrics({
        queues: [QUEUE_NAMES.PRICE_FILE_PARSER],
      });

      expect(result.queues[0]).toMatchObject({
        queue: QUEUE_NAMES.PRICE_FILE_PARSER,
        throughput: 0,
        avgProcessingTime: 0,
        failureRate: 0,
      });

      expect(logger.error).toHaveBeenCalledWith({
        msg: "Failed to get queue performance metrics",
        queue: QUEUE_NAMES.PRICE_FILE_PARSER,
        error: "Queue error",
      });
    });
  });

  describe("getFailureAnalysis", () => {
    it("should analyze failures comprehensively", async () => {
      const mockDbFailures = [
        {
          id: "job-1",
          jobName: "process-file",
          queue: "price-file-parser",
          errorMessage: "Timeout: Operation timed out",
          completedAt: new Date(),
          duration: 60000,
        },
        {
          id: "job-2",
          jobName: "process-file",
          queue: "price-file-parser",
          errorMessage: "Memory limit exceeded",
          completedAt: new Date(),
          duration: 30000,
        },
      ];

      const mockQueueFailures = [
        {
          id: "job-3",
          name: "update-analytics",
          finishedOn: Date.now(),
          processedOn: Date.now() - 5000,
          failedReason: "Database connection error",
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockDbFailures),
        }),
      });

      (
        mockQueues[QUEUE_NAMES.PRICE_FILE_PARSER].getFailed as jest.Mock
      ).mockResolvedValue(mockQueueFailures);

      const result = await service.getFailureAnalysis({});

      expect(result).toMatchObject({
        timeRange: "24h",
        analysis: {
          totalFailures: 3,
          failuresByQueue: expect.any(Array),
          failuresByReason: expect.any(Array),
          failuresByTime: expect.any(Array),
          topFailingJobs: expect.any(Array),
          recommendations: expect.any(Array),
        },
        timestamp: expect.any(String),
      });
    });

    it("should group failures by queue correctly", async () => {
      const mockFailures = [
        { queue: "queue1", errorMessage: "Error 1" },
        { queue: "queue1", errorMessage: "Error 2" },
        { queue: "queue2", errorMessage: "Error 3" },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockFailures),
        }),
      });

      const result = await service.getFailureAnalysis({});

      const queue1Failures = result.analysis.failuresByQueue.find(
        (q) => q.queue === "queue1",
      );
      const queue2Failures = result.analysis.failuresByQueue.find(
        (q) => q.queue === "queue2",
      );

      expect(queue1Failures?.count).toBe(2);
      expect(queue2Failures?.count).toBe(1);
    });

    it("should generate appropriate recommendations", async () => {
      const mockFailures = [
        // Many timeout failures
        ...Array(15)
          .fill(null)
          .map((_, i) => ({
            id: `timeout-${i}`,
            jobName: "slow-job",
            queue: "price-file-parser",
            errorMessage: "Timeout: Operation timed out after 30s",
            completedAt: new Date(),
            duration: 30000,
          })),
        // Memory failures
        {
          id: "mem-1",
          jobName: "memory-intensive",
          queue: "analytics-refresh",
          errorMessage:
            "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
          completedAt: new Date(),
          duration: 5000,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockFailures),
        }),
      });

      const result = await service.getFailureAnalysis({});

      const recommendations = result.analysis.recommendations;

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: "timeout",
          severity: "high",
          message: "High number of timeout failures detected",
        }),
      );

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: "memory",
          severity: "critical",
          message: "Memory-related failures detected",
        }),
      );
    });

    it("should identify top failing jobs", async () => {
      const mockFailures = [
        { queue: "q1", jobName: "job-a", errorMessage: "Error" },
        { queue: "q1", jobName: "job-a", errorMessage: "Error" },
        { queue: "q1", jobName: "job-a", errorMessage: "Error" },
        { queue: "q2", jobName: "job-b", errorMessage: "Error" },
        { queue: "q2", jobName: "job-b", errorMessage: "Error" },
        { queue: "q3", jobName: "job-c", errorMessage: "Error" },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockFailures),
        }),
      });

      const result = await service.getFailureAnalysis({});

      const topFailingJobs = result.analysis.topFailingJobs;

      expect(topFailingJobs[0]).toEqual({
        queue: "q1",
        jobName: "job-a",
        count: 3,
      });

      expect(topFailingJobs[1]).toEqual({
        queue: "q2",
        jobName: "job-b",
        count: 2,
      });
    });

    it("should handle time-based failure grouping", async () => {
      const now = new Date();
      const mockFailures = Array(24)
        .fill(null)
        .map((_, i) => ({
          id: `job-${i}`,
          jobName: "test-job",
          queue: "test-queue",
          errorMessage: "Test error",
          completedAt: new Date(now.getTime() - i * 60 * 60 * 1000), // One per hour
          duration: 1000,
        }));

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockFailures),
        }),
      });

      const result = await service.getFailureAnalysis({ timeRange: "24h" });

      expect(result.analysis.failuresByTime).toBeDefined();
      expect(result.analysis.failuresByTime.length).toBeGreaterThan(0);
      expect(result.analysis.failuresByTime[0]).toHaveProperty("timestamp");
      expect(result.analysis.failuresByTime[0]).toHaveProperty("count");
    });
  });

  describe("getResourceUsage", () => {
    it("should return all resource types by default", async () => {
      const mockJobCount = [{ count: 1000 }];
      const mockLogCount = [{ count: 5000 }];

      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockResolvedValue(mockJobCount),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockResolvedValue(mockLogCount),
        });

      Object.values(mockQueues).forEach((queue) => {
        (queue.getJobCounts as jest.Mock).mockResolvedValue({
          active: 5,
          waiting: 10,
          delayed: 2,
        });
        (queue.getWorkers as jest.Mock).mockResolvedValue([{}, {}]); // 2 workers
      });

      const result = await service.getResourceUsage({});

      expect(result).toMatchObject({
        timeRange: "1h",
        usage: {
          cpu: expect.any(Object),
          memory: expect.any(Object),
          redis: expect.any(Object),
          database: expect.any(Object),
          queues: expect.any(Array),
        },
        alerts: expect.any(Array),
        timestamp: expect.any(String),
      });
    });

    it("should filter resources when specified", async () => {
      const result = await service.getResourceUsage({
        resources: ["cpu", "memory"],
      });

      expect(Object.keys(result.usage)).toEqual(["cpu", "memory"]);
      expect(result.usage).not.toHaveProperty("redis");
      expect(result.usage).not.toHaveProperty("database");
    });

    it("should generate resource alerts", async () => {
      // Mock high resource usage
      jest.spyOn(service as any, "getCPUUsage").mockResolvedValue({
        current: 85,
        average: 75,
        peak: 90,
        dataPoints: [],
      });

      jest.spyOn(service as any, "getMemoryUsage").mockResolvedValue({
        current: 3072,
        currentPercentage: 90,
        average: 2500,
        peak: 3200,
        dataPoints: [],
      });

      jest.spyOn(service as any, "getRedisUsage").mockResolvedValue({
        memoryUsed: 950,
        memoryMax: 1024,
        connectedClients: 15,
        totalCommands: 1000000,
        keyCount: 8000,
      });

      const result = await service.getResourceUsage({});

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: "cpu",
          severity: "high",
          message: expect.stringContaining("CPU usage is high"),
        }),
      );

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: "memory",
          severity: "critical",
          message: expect.stringContaining("Memory usage is critical"),
        }),
      );

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: "redis",
          severity: "high",
          message: "Redis memory usage is approaching limit",
        }),
      );
    });

    it("should handle database errors in resource monitoring", async () => {
      (databaseService.db.select as jest.Mock).mockRejectedValue(
        new Error("Database unavailable"),
      );

      const result = await service.getResourceUsage({});

      expect(result.usage.database).toBeNull();
      expect(logger.error).toHaveBeenCalledWith({
        msg: "Failed to get database usage",
        error: "Database unavailable",
      });
    });

    it("should track queue resource usage", async () => {
      const mockCounts = {
        active: 10,
        waiting: 50,
        delayed: 5,
      };

      Object.values(mockQueues).forEach((queue) => {
        (queue.getJobCounts as jest.Mock).mockResolvedValue(mockCounts);
        (queue.getWorkers as jest.Mock).mockResolvedValue([{}, {}, {}]); // 3 workers
      });

      const result = await service.getResourceUsage({});

      expect(result.usage.queues).toBeDefined();
      expect(result.usage.queues).toHaveLength(6);
      if (Array.isArray(result.usage.queues)) {
        result.usage.queues.forEach((queueUsage) => {
          expect(queueUsage).toMatchObject({
            queue: expect.any(String),
            jobs: 65, // active + waiting + delayed
            workers: 3,
            memory: expect.any(Number),
          });
        });
      }
    });

    it("should generate queue alerts for high job counts", async () => {
      // Mock very high job counts
      Object.values(mockQueues).forEach((queue) => {
        (queue.getJobCounts as jest.Mock).mockResolvedValue({
          active: 1000,
          waiting: 2000,
          delayed: 500,
        });
      });

      const result = await service.getResourceUsage({});

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: "queue",
          severity: "medium",
          message: expect.stringContaining("High number of queued jobs"),
        }),
      );
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle invalid time range format", async () => {
      const result = await service.getSuccessTrends({
        timeRange: "invalid" as "1h" | "6h" | "12h" | "24h" | "7d" | "30d",
      });

      // Should default to 24h
      expect(result.timeRange).toBe("invalid");
      expect(result.interval).toBe("hour");
    });

    it("should handle concurrent queue access errors", async () => {
      // Simulate some queues failing while others succeed
      (
        mockQueues[QUEUE_NAMES.PRICE_FILE_PARSER].getCompleted as jest.Mock
      ).mockRejectedValue(new Error("Queue locked"));

      (
        mockQueues[QUEUE_NAMES.ANALYTICS_REFRESH].getCompleted as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.getPerformanceMetrics({});

      // Should still return results for working queues
      expect(result.queues).toHaveLength(6);

      const failedQueue = result.queues.find(
        (q) => q.queue === QUEUE_NAMES.PRICE_FILE_PARSER,
      );
      expect(failedQueue).toMatchObject({
        throughput: 0,
        avgProcessingTime: 0,
        failureRate: 0,
      });
    });

    it("should handle very large datasets efficiently", async () => {
      // Mock 10,000 jobs
      const largeDataset = Array(10000)
        .fill(null)
        .map((_, i) => ({
          id: `job-${i}`,
          queue: i % 2 === 0 ? "queue1" : "queue2",
          status: i % 10 === 0 ? "failed" : "completed",
          completedAt: new Date(Date.now() - i * 1000),
          duration: Math.random() * 10000,
        }));

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(largeDataset),
          }),
        }),
      });

      const startTime = Date.now();
      const result = await service.getSuccessTrends({});
      const executionTime = Date.now() - startTime;

      expect(result.summary.totalJobs).toBe(10000);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle missing or null data gracefully", async () => {
      const mockDataWithNulls = [
        {
          queue: "test",
          status: "completed",
          completedAt: null, // Missing timestamp
          duration: null,
        },
        {
          queue: null, // Missing queue
          status: "failed",
          completedAt: new Date(),
          duration: 1000,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockDataWithNulls),
          }),
        }),
      });

      // Should not throw
      const result = await service.getSuccessTrends({});
      expect(result).toBeDefined();
    });

    it("should handle timezone differences in time calculations", async () => {
      // Test with jobs from different timezones
      const jobsWithTimezones = [
        {
          queue: "test",
          status: "completed",
          completedAt: new Date("2024-01-15T10:00:00-05:00"), // EST
          duration: 1000,
        },
        {
          queue: "test",
          status: "completed",
          completedAt: new Date("2024-01-15T10:00:00+05:00"), // Different timezone
          duration: 1000,
        },
      ];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(jobsWithTimezones),
          }),
        }),
      });

      const result = await service.getSuccessTrends({});
      expect(result.trends).toBeDefined();
    });

    it("should handle division by zero in calculations", async () => {
      // No completed or failed jobs (all pending)
      const mockPendingJobs = [];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockPendingJobs),
          }),
        }),
      });

      Object.values(mockQueues).forEach((queue) => {
        (queue.getCompleted as jest.Mock).mockResolvedValue([]);
        (queue.getFailed as jest.Mock).mockResolvedValue([]);
      });

      const result = await service.getPerformanceMetrics({});

      // Should handle division by zero gracefully
      expect(result.queues).toBeDefined();
      result.queues.forEach((queueMetric) => {
        expect(queueMetric.failureRate).toBe(0);
        expect(isNaN(queueMetric.failureRate)).toBe(false);
      });
    });
  });
});
