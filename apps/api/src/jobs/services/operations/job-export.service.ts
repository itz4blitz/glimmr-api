import { Injectable } from "@nestjs/common";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../../database/database.service";
import { StorageService } from "../../../storage/storage.service";
import { jobs, jobLogs } from "../../../database/schema";
import { eq, and, or, gte, lte, inArray, sql, desc } from "drizzle-orm";
import {
  JobAdvancedFilterDto,
  JobExportDto,
} from "../../dto/job-operations.dto";
import * as ExcelJS from "exceljs";
import { createObjectCsvStringifier } from "csv-writer";
import { Readable } from "stream";
import {
  JsonObject,
  JsonValue,
  ExportFormat,
} from "../../../types/common.types";

interface ExportableJob {
  id: string;
  jobType: string;
  jobName: string;
  description: string | null;
  queue: string;
  status: string;
  priority: number;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  progressPercentage: number | null;
  recordsProcessed: number | null;
  recordsCreated: number | null;
  recordsUpdated: number | null;
  recordsSkipped: number | null;
  recordsFailed: number | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  inputData: JsonObject | null;
  outputData: JsonObject | null;
  tags: string[] | null;
  logs?: Array<{
    level: string;
    message: string;
    data: JsonObject | null;
    createdAt: Date;
  }>;
}

@Injectable()
export class JobExportService {
  constructor(
    @InjectPinoLogger(JobExportService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async exportJobs(exportDto: JobExportDto): Promise<{
    url?: string;
    data?: ExportableJob[] | string;
    filename: string;
    format: string;
    totalRecords: number;
  }> {
    try {
      // Get filtered jobs from database
      const filteredJobs = await this.getFilteredJobs(exportDto.filters);

      // Apply field selection
      const selectedJobs = this.selectFields(filteredJobs, exportDto.fields);

      // Include additional data if requested
      if (exportDto.includeLogs) {
        await this.attachJobLogs(selectedJobs);
      }

      // Generate export based on format
      const filename = this.generateFilename(exportDto.format);
      let result;

      switch (exportDto.format) {
        case "csv":
          result = await this.exportToCSV(selectedJobs, filename);
          break;
        case "excel":
          result = await this.exportToExcel(
            selectedJobs,
            filename,
            exportDto.includeLogs,
          );
          break;
        case "json":
        default:
          result = await this.exportToJSON(selectedJobs, filename);
          break;
      }

      return {
        ...result,
        filename,
        format: exportDto.format || "json",
        totalRecords: selectedJobs.length,
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to export jobs",
        error: (_error as Error).message,
        exportDto,
      });
      throw _error;
    }
  }

  private async getFilteredJobs(
    filters?: JobAdvancedFilterDto,
  ): Promise<ExportableJob[]> {
    const db = this.databaseService.db;
    const conditions = [];

    if (filters) {
      // Search filter
      if (filters.search) {
        conditions.push(
          or(
            sql`${jobs.jobName} ILIKE ${`%${filters.search}%`}`,
            sql`${jobs.id}::text ILIKE ${`%${filters.search}%`}`,
          ),
        );
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        conditions.push(inArray(jobs.status, filters.status));
      }

      // Queue filter
      if (filters.queues && filters.queues.length > 0) {
        conditions.push(inArray(jobs.queue, filters.queues));
      }

      // Date range filter
      if (filters.startDate) {
        conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
      }
      if (filters.endDate) {
        conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
      }

      // Duration filter
      if (filters.minDuration !== undefined) {
        conditions.push(gte(jobs.duration, filters.minDuration));
      }
      if (filters.maxDuration !== undefined) {
        conditions.push(lte(jobs.duration, filters.maxDuration));
      }

      // Priority filter
      if (filters.priorities && filters.priorities.length > 0) {
        conditions.push(inArray(jobs.priority, filters.priorities));
      }
    }

    const query = db
      .select()
      .from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.createdAt))
      .limit(10000); // Safety limit

    const results = await query;

    return results.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      jobName: job.jobName,
      description: job.description,
      queue: job.queue,
      status: job.status,
      priority: job.priority,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      duration: job.duration,
      progressPercentage: job.progressPercentage,
      recordsProcessed: job.recordsProcessed,
      recordsCreated: job.recordsCreated,
      recordsUpdated: job.recordsUpdated,
      recordsSkipped: job.recordsSkipped,
      recordsFailed: job.recordsFailed,
      errorMessage: job.errorMessage,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      inputData: job.inputData ? JSON.parse(job.inputData) : null,
      outputData: job.outputData ? JSON.parse(job.outputData) : null,
      tags: job.tags ? JSON.parse(job.tags) : null,
    }));
  }

  private selectFields(
    jobs: ExportableJob[],
    fields?: string[],
  ): Partial<ExportableJob>[] {
    if (!fields || fields.length === 0) {
      // Default fields
      fields = [
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
    }

    return jobs.map((job) => {
      const selected: Partial<ExportableJob> = {};
      const jobRecord = job as any;
      const selectedRecord = selected as any;
      fields.forEach((field) => {
        if (field in jobRecord) {
          selectedRecord[field] = jobRecord[field];
        }
      });
      return selected;
    });
  }

  private async attachJobLogs(jobs: Partial<ExportableJob>[]) {
    const db = this.databaseService.db;
    const jobIds = jobs.map((j) => j.id).filter(Boolean);

    if (jobIds.length === 0) return;

    const logs = await db
      .select()
      .from(jobLogs)
      .where(inArray(jobLogs.jobId, jobIds))
      .orderBy(jobLogs.createdAt);

    const logsByJobId = logs.reduce<Record<string, ExportableJob["logs"]>>(
      (acc, log) => {
        if (!acc[log.jobId]) {
          acc[log.jobId] = [];
        }
        acc[log.jobId].push({
          level: log.level,
          message: log.message,
          data: log.data ? JSON.parse(log.data) : null,
          createdAt: log.createdAt,
        });
        return acc;
      },
      {},
    );

    jobs.forEach((job) => {
      job.logs = logsByJobId[job.id] || [];
    });
  }

  private generateFilename(format?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = format || "json";
    return `job-export-${timestamp}.${extension}`;
  }

  private async exportToJSON(jobs: Partial<ExportableJob>[], filename: string) {
    const jsonContent = JSON.stringify(jobs, null, 2);
    const buffer = Buffer.from(jsonContent, "utf-8");

    // Upload to storage
    const file = await this.storageService.uploadFromStream(
      `exports/${filename}`,
      Readable.from(buffer),
      { contentType: "application/json" },
    );

    return { url: file.url, data: jobs };
  }

  private async exportToCSV(jobs: Partial<ExportableJob>[], filename: string) {
    if (jobs.length === 0) {
      return { data: "" };
    }

    // Get all unique headers from all jobs
    const headers = new Set<string>();
    jobs.forEach((job) => {
      Object.keys(job).forEach((key) => {
        // Skip complex objects for CSV
        if (
          typeof job[key] !== "object" ||
          job[key] === null ||
          job[key] instanceof Date
        ) {
          headers.add(key);
        }
      });
    });

    const headerArray = Array.from(headers);

    // Create CSV stringifier
    const csvStringifier = createObjectCsvStringifier({
      header: headerArray.map((h) => ({ id: h, title: h })),
    });

    // Format data for CSV
    const records = jobs.map((job) => {
      const record: Record<string, string | number> = {};
      headerArray.forEach((header) => {
        const value = (job as Record<string, JsonValue>)[header];
        if (value instanceof Date) {
          record[header] = value.toISOString();
        } else if (value === null || value === undefined) {
          record[header] = "";
        } else if (typeof value === "object") {
          record[header] = JSON.stringify(value);
        } else {
          record[header] = value as string | number;
        }
      });
      return record;
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);
    const buffer = Buffer.from(csvContent, "utf-8");

    // Upload to storage
    const file = await this.storageService.uploadFromStream(
      `exports/${filename}`,
      Readable.from(buffer),
      { contentType: "text/csv" },
    );

    return { url: file.url, data: csvContent };
  }

  private async exportToExcel(
    jobs: Partial<ExportableJob>[],
    filename: string,
    includeLogs?: boolean,
  ) {
    const workbook = new ExcelJS.Workbook();

    // Main jobs sheet
    const jobsSheet = workbook.addWorksheet("Jobs");

    if (jobs.length > 0) {
      // Add headers
      const headers = Object.keys(jobs[0]).filter(
        (key) => !includeLogs || key !== "logs",
      );
      jobsSheet.columns = headers.map((header) => ({
        header: this.formatHeaderName(header),
        key: header,
        width: this.getColumnWidth(header),
      }));

      // Style headers
      jobsSheet.getRow(1).font = { bold: true };
      jobsSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data
      jobs.forEach((job) => {
        const row: Record<string, JsonValue> = {};
        headers.forEach((header) => {
          const value = (job as Record<string, JsonValue>)[header];
          if (value instanceof Date) {
            row[header] = value.toISOString();
          } else if (typeof value === "object" && value !== null) {
            row[header] = JSON.stringify(value);
          } else {
            row[header] = value;
          }
        });
        jobsSheet.addRow(row);
      });

      // Apply conditional formatting for status
      const statusCol = headers.indexOf("status") + 1;
      if (statusCol > 0) {
        for (let i = 2; i <= jobs.length + 1; i++) {
          const cell = jobsSheet.getCell(i, statusCol);
          switch (cell.value) {
            case "completed":
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF90EE90" },
              };
              break;
            case "failed":
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFB6C1" },
              };
              break;
            case "active":
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFFE0" },
              };
              break;
          }
        }
      }
    }

    // Add logs sheet if requested
    if (includeLogs) {
      const logsSheet = workbook.addWorksheet("Logs");
      const allLogs: Array<{
        jobId: string;
        jobName: string;
        level: string;
        message: string;
        data: JsonObject | null;
        createdAt: Date | string;
      }> = [];

      jobs.forEach((job) => {
        if (job.logs && Array.isArray(job.logs)) {
          job.logs.forEach((log) => {
            allLogs.push({
              jobId: job.id,
              jobName: job.jobName,
              ...log,
            });
          });
        }
      });

      if (allLogs.length > 0) {
        logsSheet.columns = [
          { header: "Job ID", key: "jobId", width: 40 },
          { header: "Job Name", key: "jobName", width: 30 },
          { header: "Level", key: "level", width: 10 },
          { header: "Message", key: "message", width: 50 },
          { header: "Data", key: "data", width: 30 },
          { header: "Created At", key: "createdAt", width: 20 },
        ];

        logsSheet.getRow(1).font = { bold: true };
        logsSheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        allLogs.forEach((log) => {
          logsSheet.addRow({
            jobId: log.jobId,
            jobName: log.jobName,
            level: log.level,
            message: log.message,
            data: log.data ? JSON.stringify(log.data) : "",
            createdAt:
              log.createdAt instanceof Date
                ? log.createdAt.toISOString()
                : log.createdAt,
          });
        });

        // Color code log levels
        for (let i = 2; i <= allLogs.length + 1; i++) {
          const levelCell = logsSheet.getCell(i, 3);
          switch (levelCell.value) {
            case "error":
              levelCell.font = { color: { argb: "FFFF0000" } };
              break;
            case "warn":
              levelCell.font = { color: { argb: "FFFFA500" } };
              break;
            case "info":
              levelCell.font = { color: { argb: "FF0000FF" } };
              break;
          }
        }
      }
    }

    // Add summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 20 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    const summary = this.calculateSummary(jobs);
    Object.entries(summary).forEach(([metric, value]) => {
      summarySheet.addRow({
        metric: this.formatHeaderName(metric),
        value: value,
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Upload to storage
    const file = await this.storageService.uploadFromStream(
      `exports/${filename}`,
      Readable.from(Buffer.from(buffer)),
      {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );

    return { url: file.url };
  }

  private formatHeaderName(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private getColumnWidth(key: string): number {
    const widthMap: Record<string, number> = {
      id: 40,
      jobName: 30,
      description: 40,
      errorMessage: 50,
      createdAt: 20,
      completedAt: 20,
      startedAt: 20,
      updatedAt: 20,
    };

    return widthMap[key] || 15;
  }

  private calculateSummary(jobs: Partial<ExportableJob>[]) {
    const totalJobs = jobs.length;
    const statusCounts = jobs.reduce<Record<string, number>>((acc, job) => {
      if (job.status) {
        acc[job.status] = (acc[job.status] || 0) + 1;
      }
      return acc;
    }, {});

    const queueCounts = jobs.reduce<Record<string, number>>((acc, job) => {
      if (job.queue) {
        acc[job.queue] = (acc[job.queue] || 0) + 1;
      }
      return acc;
    }, {});

    const avgDuration =
      jobs
        .filter((j) => j.duration)
        .reduce((sum, j) => sum + (j.duration || 0), 0) /
      (jobs.filter((j) => j.duration).length || 1);

    const totalRecordsProcessed = jobs.reduce(
      (sum, j) => sum + (j.recordsProcessed || 0),
      0,
    );

    return {
      totalJobs,
      completedJobs: statusCounts.completed || 0,
      failedJobs: statusCounts.failed || 0,
      pendingJobs: statusCounts.pending || 0,
      activeJobs: statusCounts.active || 0,
      avgDurationMs: Math.round(avgDuration),
      totalRecordsProcessed,
      ...Object.entries(queueCounts).reduce<Record<string, number>>(
        (acc, [queue, count]) => {
          acc[`queue_${queue}`] = count;
          return acc;
        },
        {},
      ),
    };
  }
}
