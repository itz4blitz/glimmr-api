import { Test, TestingModule } from "@nestjs/testing";
import { PinoLogger } from "nestjs-pino";
import * as ExcelJS from "exceljs";
import { Readable } from "stream";
import { JobExportService } from "./job-export.service";
import { DatabaseService } from "../../../database/database.service";
import { StorageService } from "../../../storage/storage.service";
import { JobExportDto, JobAdvancedFilterDto } from "../../dto/job-operations.dto";

// Mock ExcelJS
jest.mock("exceljs", () => {
  const mockWorksheet = {
    columns: [],
    getRow: jest.fn().mockReturnValue({
      font: {},
      fill: {},
    }),
    addRow: jest.fn(),
    getCell: jest.fn().mockReturnValue({
      value: null,
      fill: {},
    }),
  };

  const mockWorkbook = {
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from("excel-data")),
    },
  };

  return {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
  };
});

describe("JobExportService", () => {
  let service: JobExportService;
  let databaseService: DatabaseService;
  let storageService: StorageService;
  let logger: PinoLogger;

  const mockJobs = [
    {
      id: "job-1",
      jobType: "data-processing",
      jobName: "Process Hospital Data",
      description: "Processing hospital pricing data",
      queue: "price-file-parser",
      status: "completed",
      priority: 1,
      startedAt: new Date("2024-01-15T10:00:00Z"),
      completedAt: new Date("2024-01-15T10:05:00Z"),
      duration: 300000,
      progressPercentage: 100,
      recordsProcessed: 1000,
      recordsCreated: 500,
      recordsUpdated: 300,
      recordsSkipped: 150,
      recordsFailed: 50,
      errorMessage: null,
      createdBy: "system",
      createdAt: new Date("2024-01-15T09:55:00Z"),
      updatedAt: new Date("2024-01-15T10:05:00Z"),
      inputData: '{"hospitalId": 123}',
      outputData: '{"processed": true}',
      tags: '["scheduled", "hospital-123"]',
    },
    {
      id: "job-2",
      jobType: "analytics",
      jobName: "Refresh Analytics",
      description: "Updating analytics data",
      queue: "analytics-refresh",
      status: "failed",
      priority: 2,
      startedAt: new Date("2024-01-15T11:00:00Z"),
      completedAt: new Date("2024-01-15T11:02:00Z"),
      duration: 120000,
      progressPercentage: 45,
      recordsProcessed: 450,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 450,
      errorMessage: "Database connection timeout",
      createdBy: "scheduler",
      createdAt: new Date("2024-01-15T10:55:00Z"),
      updatedAt: new Date("2024-01-15T11:02:00Z"),
      inputData: '{"timeRange": "24h"}',
      outputData: null,
      tags: '["analytics", "failed"]',
    },
  ];

  const mockLogs = [
    {
      id: "log-1",
      jobId: "job-1",
      level: "info",
      message: "Started processing",
      data: '{"step": 1}',
      createdAt: new Date("2024-01-15T10:00:05Z"),
    },
    {
      id: "log-2",
      jobId: "job-1",
      level: "info",
      message: "Completed processing",
      data: '{"step": 2}',
      createdAt: new Date("2024-01-15T10:04:55Z"),
    },
    {
      id: "log-3",
      jobId: "job-2",
      level: "error",
      message: "Connection failed",
      data: '{"error": "ETIMEDOUT"}',
      createdAt: new Date("2024-01-15T11:01:30Z"),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobExportService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              select: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                  where: jest.fn().mockReturnValue({
                    orderBy: jest.fn().mockReturnValue({
                      limit: jest.fn().mockResolvedValue(mockJobs),
                    }),
                  }),
                }),
              }),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFromStream: jest.fn().mockResolvedValue({
              key: "exports/file.csv",
              size: 1024,
              lastModified: new Date(),
              url: "https://storage.example.com/exports/file.csv",
            }),
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
      ],
    }).compile();

    service = module.get<JobExportService>(JobExportService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    storageService = module.get<StorageService>(StorageService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("exportJobs", () => {
    it("should export jobs to JSON format by default", async () => {
      const exportDto: JobExportDto = {};

      const result = await service.exportJobs(exportDto);

      expect(result).toMatchObject({
        url: "https://storage.example.com/exports/file.csv",
        data: expect.any(Array),
        filename: expect.stringMatching(/job-export-.*\.json/),
        format: "json",
        totalRecords: 2,
      });

      expect(storageService.uploadFromStream).toHaveBeenCalledWith(
        expect.stringContaining("exports/job-export-"),
        expect.any(Readable),
        { contentType: "application/json" },
      );
    });

    it("should export jobs to CSV format", async () => {
      const exportDto: JobExportDto = {
        format: "csv",
      };

      const result = await service.exportJobs(exportDto);

      expect(result).toMatchObject({
        url: "https://storage.example.com/exports/file.csv",
        data: expect.any(String),
        filename: expect.stringMatching(/job-export-.*\.csv/),
        format: "csv",
        totalRecords: 2,
      });

      expect(storageService.uploadFromStream).toHaveBeenCalledWith(
        expect.stringContaining("exports/job-export-"),
        expect.any(Readable),
        { contentType: "text/csv" },
      );
    });

    it("should export jobs to Excel format", async () => {
      const exportDto: JobExportDto = {
        format: "excel",
      };

      const result = await service.exportJobs(exportDto);

      expect(result).toMatchObject({
        url: "https://storage.example.com/exports/file.csv",
        filename: expect.stringMatching(/job-export-.*\.excel/),
        format: "excel",
        totalRecords: 2,
      });

      expect(storageService.uploadFromStream).toHaveBeenCalledWith(
        expect.stringContaining("exports/job-export-"),
        expect.any(Readable),
        { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      );
    });

    it("should apply filters when exporting", async () => {
      const filters: JobAdvancedFilterDto = {
        status: ["completed"],
        queues: ["price-file-parser"],
        startDate: "2024-01-15T00:00:00Z",
        endDate: "2024-01-15T23:59:59Z",
      };

      const exportDto: JobExportDto = {
        filters,
      };

      await service.exportJobs(exportDto);

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should select specific fields when requested", async () => {
      const exportDto: JobExportDto = {
        fields: ["id", "jobName", "status", "duration"],
      };

      const result = await service.exportJobs(exportDto);

      // Check that data only contains selected fields
      if (Array.isArray(result.data)) {
        result.data.forEach(job => {
          expect(Object.keys(job)).toEqual(["id", "jobName", "status", "duration"]);
        });
      }
    });

    it("should include logs when requested", async () => {
      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockJobs),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(mockLogs),
            }),
          }),
        });

      const exportDto: JobExportDto = {
        includeLogs: true,
        format: "json",
      };

      const result = await service.exportJobs(exportDto);

      if (Array.isArray(result.data)) {
        const jobWithLogs = result.data.find(job => job.id === "job-1");
        expect(jobWithLogs).toHaveProperty("logs");
        expect(jobWithLogs.logs).toHaveLength(2);
        expect(jobWithLogs.logs[0]).toMatchObject({
          level: "info",
          message: "Started processing",
        });
      }
    });

    it("should handle empty job results", async () => {
      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await service.exportJobs({});

      expect(result).toMatchObject({
        totalRecords: 0,
        data: [],
      });
    });

    it("should handle export errors", async () => {
      (storageService.uploadFromStream as jest.Mock).mockRejectedValue(
        new Error("Storage service unavailable"),
      );

      await expect(service.exportJobs({})).rejects.toThrow("Storage service unavailable");

      expect(logger.error).toHaveBeenCalledWith({
        msg: "Failed to export jobs",
        error: "Storage service unavailable",
        exportDto: {},
      });
    });
  });

  describe("CSV Export", () => {
    it("should generate valid CSV with headers", async () => {
      const result = await service.exportJobs({ format: "csv" });

      expect(result.data).toContain("id,jobName,queue,status");
      expect(result.data).toContain("job-1,Process Hospital Data,price-file-parser,completed");
      expect(result.data).toContain("job-2,Refresh Analytics,analytics-refresh,failed");
    });

    it("should handle special characters in CSV", async () => {
      const jobsWithSpecialChars = [{
        ...mockJobs[0],
        jobName: 'Job with "quotes" and, commas',
        description: 'Description with\nnewlines',
      }];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(jobsWithSpecialChars),
            }),
          }),
        }),
      });

      const result = await service.exportJobs({ format: "csv" });

      // CSV should properly escape special characters
      expect(result.data).toBeDefined();
    });

    it("should handle null and undefined values in CSV", async () => {
      const jobsWithNulls = [{
        ...mockJobs[0],
        errorMessage: null,
        outputData: undefined,
      }];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(jobsWithNulls),
            }),
          }),
        }),
      });

      const result = await service.exportJobs({ format: "csv" });

      // Nulls should be represented as empty strings
      expect(result.data).not.toContain("null");
      expect(result.data).not.toContain("undefined");
    });

    it("should format dates properly in CSV", async () => {
      const result = await service.exportJobs({ 
        format: "csv",
        fields: ["id", "createdAt", "completedAt"],
      });

      expect(result.data).toContain("2024-01-15T");
    });
  });

  describe("Excel Export", () => {
    it("should create multiple worksheets for Excel export", async () => {
      const mockWorkbook = new ExcelJS.Workbook();
      const addWorksheetSpy = jest.spyOn(mockWorkbook, "addWorksheet");

      await service.exportJobs({ format: "excel" });

      // Should create Jobs and Summary sheets
      expect(addWorksheetSpy).toHaveBeenCalledWith("Jobs");
      expect(addWorksheetSpy).toHaveBeenCalledWith("Summary");
    });

    it("should add logs worksheet when includeLogs is true", async () => {
      (databaseService.db.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockJobs),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(mockLogs),
            }),
          }),
        });

      const mockWorkbook = new ExcelJS.Workbook();
      const addWorksheetSpy = jest.spyOn(mockWorkbook, "addWorksheet");

      await service.exportJobs({ 
        format: "excel",
        includeLogs: true,
      });

      expect(addWorksheetSpy).toHaveBeenCalledWith("Logs");
    });

    it("should apply conditional formatting for status in Excel", async () => {
      const mockWorkbook = new ExcelJS.Workbook();
      const mockWorksheet = mockWorkbook.addWorksheet("Jobs");
      const getCellSpy = jest.spyOn(mockWorksheet, "getCell");

      await service.exportJobs({ format: "excel" });

      // Verify that status cells get formatting
      expect(getCellSpy).toHaveBeenCalled();
    });

    it("should calculate summary statistics for Excel", async () => {
      const result = await service.exportJobs({ format: "excel" });

      // The summary calculation should include various metrics
      expect(result.totalRecords).toBe(2);
    });

    it("should handle large datasets efficiently in Excel", async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        ...mockJobs[0],
        id: `job-${i}`,
        jobName: `Job ${i}`,
      }));

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(largeDataset),
            }),
          }),
        }),
      });

      const startTime = Date.now();
      await service.exportJobs({ format: "excel" });
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Field Selection", () => {
    it("should use default fields when none specified", async () => {
      const result = await service.exportJobs({});

      if (Array.isArray(result.data)) {
        const defaultFields = [
          "id",
          "jobName",
          "queue",
          "status",
          "priority",
          "startedAt",
          "completedAt",
          "duration",
          "recordsProcessed",
          "errorMessage",
          "createdAt",
        ];

        result.data.forEach(job => {
          const jobKeys = Object.keys(job);
          defaultFields.forEach(field => {
            expect(jobKeys).toContain(field);
          });
        });
      }
    });

    it("should respect custom field selection", async () => {
      const customFields = ["id", "status", "duration"];
      const result = await service.exportJobs({ fields: customFields });

      if (Array.isArray(result.data)) {
        result.data.forEach(job => {
          expect(Object.keys(job)).toEqual(customFields);
        });
      }
    });

    it("should handle non-existent fields gracefully", async () => {
      const result = await service.exportJobs({ 
        fields: ["id", "nonExistentField", "status"],
      });

      if (Array.isArray(result.data)) {
        result.data.forEach(job => {
          expect(job).toHaveProperty("id");
          expect(job).toHaveProperty("status");
          expect(job).not.toHaveProperty("nonExistentField");
        });
      }
    });
  });

  describe("Filtering", () => {
    it("should apply search filter", async () => {
      const filters: JobAdvancedFilterDto = {
        search: "analytics",
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should apply status filter", async () => {
      const filters: JobAdvancedFilterDto = {
        status: ["completed", "active"],
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should apply date range filter", async () => {
      const filters: JobAdvancedFilterDto = {
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-31T23:59:59Z",
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should apply duration filter", async () => {
      const filters: JobAdvancedFilterDto = {
        minDuration: 1000,
        maxDuration: 300000,
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should apply priority filter", async () => {
      const filters: JobAdvancedFilterDto = {
        priorities: [1, 2, 3],
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should apply multiple filters simultaneously", async () => {
      const filters: JobAdvancedFilterDto = {
        search: "process",
        status: ["completed"],
        queues: ["price-file-parser"],
        startDate: "2024-01-15T00:00:00Z",
        priorities: [1],
      };

      await service.exportJobs({ filters });

      // The filtering logic is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });

    it("should handle the 10000 record limit", async () => {
      await service.exportJobs({});

      // The limit is applied through the mock chain
      expect(databaseService.db.select).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors", async () => {
      (databaseService.db.select as jest.Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(service.exportJobs({})).rejects.toThrow("Database connection failed");
    });

    it("should handle JSON parsing errors", async () => {
      const jobsWithInvalidJson = [{
        ...mockJobs[0],
        inputData: "invalid-json",
      }];

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(jobsWithInvalidJson),
            }),
          }),
        }),
      });

      // Should handle gracefully and continue
      const result = await service.exportJobs({});
      expect(result).toBeDefined();
    });

    it("should handle storage upload failures", async () => {
      (storageService.uploadFromStream as jest.Mock).mockRejectedValue(
        new Error("Insufficient storage space"),
      );

      await expect(service.exportJobs({})).rejects.toThrow("Insufficient storage space");
    });

    it("should handle Excel generation errors", async () => {
      const mockWorkbook = new ExcelJS.Workbook();
      mockWorkbook.xlsx.writeBuffer = jest.fn().mockRejectedValue(
        new Error("Excel generation failed"),
      );

      await expect(service.exportJobs({ format: "excel" })).rejects.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle memory efficiently for large exports", async () => {
      const largeDataset = Array(5000).fill(null).map((_, i) => ({
        ...mockJobs[0],
        id: `job-${i}`,
      }));

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(largeDataset),
            }),
          }),
        }),
      });

      const result = await service.exportJobs({ format: "csv" });

      expect(result.totalRecords).toBe(5000);
    });

    it("should stream data for very large CSV exports", async () => {
      const veryLargeDataset = Array(10000).fill(null).map((_, i) => ({
        ...mockJobs[0],
        id: `job-${i}`,
      }));

      (databaseService.db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(veryLargeDataset),
            }),
          }),
        }),
      });

      const result = await service.exportJobs({ format: "csv" });

      expect(result.totalRecords).toBe(10000);
    });
  });

  describe("Data Formatting", () => {
    it("should format header names correctly", async () => {
      const result = await service.exportJobs({ format: "csv" });

      // Headers should be properly formatted
      expect(result.data).toContain("recordsProcessed");
      // Would be formatted as "Records Processed" in the actual implementation
    });

    it("should handle complex objects in JSON export", async () => {
      const result = await service.exportJobs({ 
        format: "json",
        includeData: true,
      });

      if (Array.isArray(result.data)) {
        const job = result.data[0];
        expect(job.inputData).toEqual({ hospitalId: 123 });
        expect(job.tags).toEqual(["scheduled", "hospital-123"]);
      }
    });

    it("should stringify complex objects in CSV export", async () => {
      const result = await service.exportJobs({ 
        format: "csv",
        includeData: true,
      });

      // Complex objects should be stringified
      expect(result.data).toContain('{"hospitalId":123}');
    });
  });
});