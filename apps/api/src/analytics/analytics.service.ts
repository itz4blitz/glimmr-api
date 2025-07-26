import { Injectable } from "@nestjs/common";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import {
  eq,
  and,
  like,
  desc,
  asc,
  count,
  sql,
  countDistinct,
} from "drizzle-orm";
import { Response } from "express";
import { DatabaseService } from "../database/database.service";
import { analytics, prices, hospitals } from "../database/schema";

import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../jobs/queues/queue.config";
import type { ExportJobData } from "../jobs/processors/export-data.processor";
import * as XLSX from "xlsx";

interface ExportProgress {
  exportId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  message: string;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  errorMessage?: string;
  totalRecords?: number;
  processedRecords?: number;
}

@Injectable()
export class AnalyticsService {
  private exportProgress = new Map<string, ExportProgress>();

  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(AnalyticsService.name)
    private readonly logger: PinoLogger,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportQueue: Queue<ExportJobData>,
  ) {
    // Clean up old export progress every hour
    setInterval(() => this.cleanupOldExports(), 60 * 60 * 1000);
  }
  async getDashboardAnalytics() {
    this.logger.info({
      msg: "Generating dashboard analytics",
      operation: "getDashboardAnalytics",
    });

    try {
      const db = this.databaseService.db;

      // Get summary statistics with optimized queries
      const [hospitalStats] = await db
        .select({
          totalHospitals: count(hospitals.id),
        })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      const [priceStats] = await db
        .select({
          totalPrices: count(prices.id),
          totalServices: countDistinct(prices.serviceName),
        })
        .from(prices)
        .where(eq(prices.isActive, true));

      const summaryStats = {
        totalHospitals: hospitalStats.totalHospitals,
        totalPrices: priceStats.totalPrices,
        totalServices: priceStats.totalServices,
      };

      // Get recent activity (last 24 hours) with optimized queries
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [hospitalActivity] = await db
        .select({
          newHospitals: sql<number>`COUNT(CASE WHEN ${hospitals.createdAt} > ${twentyFourHoursAgo.toISOString()} THEN 1 END)`,
        })
        .from(hospitals);

      const [priceActivity] = await db
        .select({
          updatedPrices: count(prices.id),
        })
        .from(prices)
        .where(sql`${prices.updatedAt} > ${twentyFourHoursAgo.toISOString()}`);

      const recentActivity = {
        newHospitals: hospitalActivity.newHospitals,
        updatedPrices: priceActivity.updatedPrices,
      };

      // Get most expensive service
      const [mostExpensiveService] = await db
        .select({
          name: prices.serviceName,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        })
        .from(prices)
        .where(eq(prices.isActive, true))
        .groupBy(prices.serviceName)
        .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
        .limit(1);

      // Get least expensive service
      const [leastExpensiveService] = await db
        .select({
          name: prices.serviceName,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        })
        .from(prices)
        .where(eq(prices.isActive, true))
        .groupBy(prices.serviceName)
        .orderBy(asc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
        .limit(1);

      // Get geographic insights
      const stateStats = await db
        .select({
          state: hospitals.state,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: count(hospitals.id),
        })
        .from(hospitals)
        .leftJoin(prices, eq(hospitals.id, prices.hospitalId))
        .where(and(eq(hospitals.isActive, true), eq(prices.isActive, true)))
        .groupBy(hospitals.state)
        .orderBy(
          desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`),
        );

      const mostExpensiveState = stateStats[0];
      const leastExpensiveState = stateStats[stateStats.length - 1];
      const sortedByDensity = [...stateStats].sort(
        (a, b) => b.hospitalCount - a.hospitalCount,
      );
      const highestDensityState = sortedByDensity[0];

      this.logger.info({
        msg: "Dashboard analytics generated successfully",
        totalHospitals: summaryStats.totalHospitals,
        totalPrices: summaryStats.totalPrices,
        operation: "getDashboardAnalytics",
      });

      return {
        summary: {
          totalHospitals: summaryStats.totalHospitals,
          totalPrices: summaryStats.totalPrices,
          totalServices: summaryStats.totalServices,
          lastUpdated: new Date().toISOString(),
          dataFreshness: "2 hours ago",
        },
        recentActivity: {
          newHospitals: recentActivity.newHospitals,
          updatedPrices: recentActivity.updatedPrices,
          newServices: 0, // Would need service tracking table
          period: "last 24 hours",
        },
        topMetrics: {
          mostExpensiveService: mostExpensiveService
            ? {
                name: mostExpensiveService.name,
                avgPrice: Number(mostExpensiveService.avgPrice),
                hospitalCount: mostExpensiveService.hospitalCount,
              }
            : null,
          leastExpensiveService: leastExpensiveService
            ? {
                name: leastExpensiveService.name,
                avgPrice: Number(leastExpensiveService.avgPrice),
                hospitalCount: leastExpensiveService.hospitalCount,
              }
            : null,
        },
        geographicInsights: {
          mostExpensiveState: mostExpensiveState
            ? {
                state: mostExpensiveState.state,
                avgPrice: Number(mostExpensiveState.avgPrice),
              }
            : null,
          leastExpensiveState: leastExpensiveState
            ? {
                state: leastExpensiveState.state,
                avgPrice: Number(leastExpensiveState.avgPrice),
              }
            : null,
          highestHospitalDensity: highestDensityState
            ? {
                state: highestDensityState.state,
                count: highestDensityState.hospitalCount,
              }
            : null,
        },
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate dashboard analytics",
        error: error.message,
        operation: "getDashboardAnalytics",
      });
      throw error;
    }
  }

  async getPricingTrends(filters: {
    service?: string;
    state?: string;
    period?: string;
  }) {
    this.logger.info({
      msg: "Generating pricing trends",
      filters,
      operation: "getPricingTrends",
    });

    try {
      const db = this.databaseService.db;
      const period = filters.period || "30d";

      // Build conditions
      const conditions = [eq(prices.isActive, true)];
      if (filters.service) {
        conditions.push(like(prices.serviceName, `%${filters.service}%`));
      }
      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }

      const whereClause = and(...conditions);

      // Get monthly trends for the last 6 months
      const trends = await db
        .select({
          month: sql<string>`DATE_TRUNC('month', ${prices.lastUpdated})`,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          count: count(prices.id),
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .groupBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`)
        .orderBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`)
        .limit(6);

      // Calculate insights
      const priceValues = trends.map((t) => Number(t.avgPrice));
      const firstPrice = priceValues[0] || 0;
      const lastPrice = priceValues[priceValues.length - 1] || 0;
      const percentageChange =
        firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

      this.logger.info({
        msg: "Pricing trends generated successfully",
        trendsCount: trends.length,
        operation: "getPricingTrends",
      });

      return {
        period,
        service: filters.service,
        state: filters.state,
        trends: trends.map((trend) => ({
          date: trend.month,
          avgPrice: Number(trend.avgPrice),
          count: trend.count,
        })),
        insights: {
          overallTrend: this.determineTrend(percentageChange),
          percentageChange: Math.abs(percentageChange),
          volatility: "moderate", // Could calculate actual volatility
          seasonalPattern: "unknown", // Would need more sophisticated analysis
        },
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate pricing trends",
        error: error.message,
        operation: "getPricingTrends",
        filters,
      });
      throw error;
    }
  }

  async getPowerBIInfo() {
    this.logger.info({
      msg: "Generating PowerBI information",
      operation: "getPowerBIInfo",
    });

    try {
      const db = this.databaseService.db;

      // Get actual record counts
      const [hospitalCount] = await db
        .select({ count: count() })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      const [priceCount] = await db
        .select({ count: count() })
        .from(prices)
        .where(eq(prices.isActive, true));

      const [analyticsCount] = await db
        .select({ count: count() })
        .from(analytics);

      return {
        datasets: [
          {
            name: "Hospitals",
            endpoint: "/odata/hospitals",
            description:
              "Complete hospital directory with location and contact information",
            recordCount: hospitalCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              "id",
              "name",
              "state",
              "city",
              "address",
              "phone",
              "website",
              "services",
              "bedCount",
              "ownership",
              "lastUpdated",
            ],
          },
          {
            name: "Prices",
            endpoint: "/odata/prices",
            description: "Comprehensive pricing data for medical services",
            recordCount: priceCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              "id",
              "hospitalId",
              "service",
              "code",
              "price",
              "description",
              "category",
              "state",
              "city",
              "lastUpdated",
            ],
          },
          {
            name: "Analytics",
            endpoint: "/odata/analytics",
            description: "Pre-computed analytics and aggregations",
            recordCount: analyticsCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              "id",
              "metric",
              "value",
              "dimension",
              "period",
              "state",
              "service",
              "calculatedAt",
            ],
          },
        ],
        powerBIInstructions: {
          connectionString: "https://api.glimmr.health/odata",
          authentication: "API Key required",
          refreshSchedule: "Every 4 hours",
          documentation: "https://api.glimmr.health/docs#powerbi",
        },
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate PowerBI information",
        error: error.message,
        operation: "getPowerBIInfo",
      });
      throw error;
    }
  }

  private determineTrend(percentageChange: number): string {
    if (percentageChange > 0) return "increasing";
    if (percentageChange < 0) return "decreasing";
    return "stable";
  }

  async exportData(filters: {
    format?: string;
    dataset?: string;
    limit?: number;
  }) {
    this.logger.info({
      msg: "Initiating data export",
      filters,
      operation: "exportData",
    });

    try {
      const db = this.databaseService.db;
      const format = filters.format || "json";
      const dataset = filters.dataset || "hospitals";
      const requestedLimit = filters.limit || 1000;
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Validate format
      const allowedFormats = ["csv", "json", "excel", "parquet"];
      if (!allowedFormats.includes(format)) {
        throw new Error(
          `Invalid format: ${format}. Allowed formats: ${allowedFormats.join(", ")}`,
        );
      }

      // Validate dataset
      const allowedDatasets = ["hospitals", "prices", "analytics", "all"];
      if (!allowedDatasets.includes(dataset)) {
        throw new Error(
          `Invalid dataset: ${dataset}. Allowed datasets: ${allowedDatasets.join(", ")}`,
        );
      }

      // Calculate actual data sizes based on dataset
      let estimatedRecords = 0;
      let estimatedSizeMB = 0;
      const maxRecordsPerDataset = Math.min(requestedLimit, 100000); // Hard limit of 100k records

      if (dataset === "hospitals" || dataset === "all") {
        const [hospitalCount] = await db
          .select({ count: count() })
          .from(hospitals)
          .where(eq(hospitals.isActive, true));
        const actualHospitalRecords =
          dataset === "all"
            ? Math.min(
                hospitalCount.count,
                Math.floor(maxRecordsPerDataset / 3),
              )
            : Math.min(hospitalCount.count, maxRecordsPerDataset);
        estimatedRecords += actualHospitalRecords;
        estimatedSizeMB += actualHospitalRecords * 0.002; // ~2KB per hospital record
      }

      if (dataset === "prices" || dataset === "all") {
        const [priceCount] = await db
          .select({ count: count() })
          .from(prices)
          .where(eq(prices.isActive, true));
        const actualPriceRecords =
          dataset === "all"
            ? Math.min(priceCount.count, Math.floor(maxRecordsPerDataset / 3))
            : Math.min(priceCount.count, maxRecordsPerDataset);
        estimatedRecords += actualPriceRecords;
        estimatedSizeMB += actualPriceRecords * 0.001; // ~1KB per price record
      }

      if (dataset === "analytics" || dataset === "all") {
        const [analyticsCount] = await db
          .select({ count: count() })
          .from(analytics);
        const actualAnalyticsRecords =
          dataset === "all"
            ? Math.min(
                analyticsCount.count,
                Math.floor(maxRecordsPerDataset / 3),
              )
            : Math.min(analyticsCount.count, maxRecordsPerDataset);
        estimatedRecords += actualAnalyticsRecords;
        estimatedSizeMB += actualAnalyticsRecords * 0.0005; // ~0.5KB per analytics record
      }

      // Adjust size based on format
      const formatMultipliers = {
        json: 1.0,
        csv: 0.6,
        excel: 1.2,
        parquet: 0.3,
      };

      const finalSizeMB = estimatedSizeMB * (formatMultipliers[format] ?? 1.0);

      // File size limits
      const maxFileSizeMB = 500; // 500MB limit
      const maxSyncSizeMB = 10; // 10MB for immediate processing

      if (finalSizeMB > maxFileSizeMB) {
        throw new Error(
          `Export size (${finalSizeMB.toFixed(1)} MB) exceeds maximum allowed size (${maxFileSizeMB} MB). Please reduce the limit or narrow your dataset selection.`,
        );
      }

      const estimatedTimeMinutes = Math.max(
        1,
        Math.ceil(estimatedRecords / 10000),
      ); // ~10k records per minute
      const requiresAsyncProcessing =
        finalSizeMB > maxSyncSizeMB || estimatedRecords > 10000;

      this.logger.info({
        msg: "Export initiated successfully",
        exportId,
        dataset,
        format,
        estimatedRecords,
        estimatedSizeMB: finalSizeMB,
        operation: "exportData",
      });

      const result = {
        exportId,
        format,
        dataset,
        status: requiresAsyncProcessing ? "preparing" : "ready",
        estimatedRecords,
        estimatedSize: `${finalSizeMB.toFixed(1)} MB`,
        estimatedTime: `${estimatedTimeMinutes} minute${estimatedTimeMinutes > 1 ? "s" : ""}`,
        downloadUrl: null, // Will be populated when ready
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        createdAt: new Date().toISOString(),
        requiresAsyncProcessing,
        limits: {
          maxFileSizeMB,
          maxSyncSizeMB,
          maxRecords: 100000,
          appliedRecordLimit: maxRecordsPerDataset,
        },
        availableFormats: ["json", "csv", "excel", "parquet"],
        availableDatasets: ["hospitals", "prices", "analytics", "all"],
        message: requiresAsyncProcessing
          ? "Large export request - processing will be handled asynchronously. Check back using the exportId."
          : "Small export - ready for immediate processing.",
      };

      // Initialize progress tracking
      this.updateExportProgress(exportId, {
        exportId,
        status: requiresAsyncProcessing ? "pending" : "completed",
        progress: requiresAsyncProcessing ? 0 : 100,
        message: requiresAsyncProcessing
          ? "Export queued for processing"
          : "Small export ready for download",
        createdAt: new Date(),
        totalRecords: estimatedRecords,
        processedRecords: requiresAsyncProcessing ? 0 : estimatedRecords,
        completedAt: requiresAsyncProcessing ? undefined : new Date(),
      });

      // Queue job for large exports
      if (requiresAsyncProcessing) {
        await this.exportQueue.add(
          "export-analytics",
          {
            exportId,
            format,
            dataset,
            limit: maxRecordsPerDataset,
            filters,
          },
          {
            jobId: exportId,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );

        this.logger.info({
          msg: "Export job queued successfully",
          exportId,
          operation: "exportData",
        });
      }

      return result;
    } catch (error) {
      this.logger.error({
        msg: "Failed to initiate data export",
        error: error.message,
        operation: "exportData",
        filters,
      });
      throw error;
    }
  }

  private updateExportProgress(
    exportId: string,
    progress: Partial<ExportProgress>,
  ) {
    const existing = this.exportProgress.get(exportId);
    const updated = { ...existing, ...progress } as ExportProgress;
    this.exportProgress.set(exportId, updated);

    this.logger.info({
      msg: "Export progress updated",
      exportId,
      status: updated.status,
      progress: updated.progress,
      operation: "updateExportProgress",
    });
  }

  async getExportProgress(exportId: string): Promise<ExportProgress | null> {
    const localProgress = this.exportProgress.get(exportId);

    if (!localProgress) {
      return null;
    }

    // If the export is being processed by a job, check the job status
    if (
      localProgress.status === "pending" ||
      localProgress.status === "processing"
    ) {
      try {
        const job = await this.exportQueue.getJob(exportId);
        if (job) {
          const jobProgress = job.progress;
          const jobState = await job.getState();

          // Update local progress based on job status
          let updatedProgress = { ...localProgress };

          if (jobState === "completed") {
            const jobResult = job.returnvalue;
            updatedProgress = {
              ...updatedProgress,
              status: "completed",
              progress: 100,
              message: "Export completed successfully",
              completedAt: new Date(),
              downloadUrl: jobResult?.downloadUrl,
              processedRecords:
                jobResult?.totalRecords || updatedProgress.totalRecords,
            };
          } else if (jobState === "failed") {
            updatedProgress = {
              ...updatedProgress,
              status: "failed",
              progress: 0,
              message: `Export failed: ${job.failedReason || "Unknown error"}`,
              errorMessage: job.failedReason,
            };
          } else if (jobState === "active") {
            updatedProgress = {
              ...updatedProgress,
              status: "processing",
              progress: typeof jobProgress === "number" ? jobProgress : 0,
              message: "Processing export...",
            };
          }

          // Update the stored progress
          this.exportProgress.set(exportId, updatedProgress);
          return updatedProgress;
        }
      } catch (error) {
        this.logger.error({
          msg: "Failed to get job status",
          exportId,
          error: error.message,
          operation: "getExportProgress",
        });
      }
    }

    return localProgress;
  }

  getAllExportProgress(): ExportProgress[] {
    return Array.from(this.exportProgress.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  private cleanupOldExports() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [exportId, progress] of this.exportProgress.entries()) {
      if (progress.createdAt < cutoffTime) {
        this.exportProgress.delete(exportId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info({
        msg: "Cleaned up old export progress records",
        cleanedCount,
        operation: "cleanupOldExports",
      });
    }
  }

  async streamExportData(
    filters: {
      format?: string;
      dataset?: string;
      limit?: number;
    },
    response: Response,
  ) {
    const format = filters.format || "json";
    const dataset = filters.dataset || "hospitals";
    const limit = Math.min(filters.limit || 1000, 100000);

    this.logger.info({
      msg: "Starting streaming export",
      format,
      dataset,
      limit,
      operation: "streamExportData",
    });

    try {
      // Set appropriate headers
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${dataset}_export_${timestamp}.${format}`;

      response.setHeader("Content-Type", this.getContentType(format));
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      response.setHeader("Transfer-Encoding", "chunked");

      if (format === "csv") {
        await this.streamCSV(dataset, limit, response);
      } else if (format === "json") {
        await this.streamJSON(dataset, limit, response);
      } else if (format === "excel") {
        await this.streamExcel(dataset, limit, response);
      } else {
        throw new Error(`Streaming not yet supported for format: ${format}`);
      }

      this.logger.info({
        msg: "Streaming export completed successfully",
        format,
        dataset,
        operation: "streamExportData",
      });
    } catch (error) {
      this.logger.error({
        msg: "Streaming export failed",
        error: error.message,
        operation: "streamExportData",
      });
      if (!response.headersSent) {
        response.status(500).json({ error: "Export failed" });
      }
      throw error;
    }
  }

  private getContentType(format: string): string {
    switch (format) {
      case "csv":
        return "text/csv";
      case "json":
        return "application/json";
      case "excel":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }

  private async streamJSON(dataset: string, limit: number, response: Response) {
    const db = this.databaseService.db;
    response.write("[");
    let isFirst = true;

    if (dataset === "hospitals" || dataset === "all") {
      const hospitalData = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.isActive, true))
        .limit(limit);
      hospitalData.forEach((hospital) => {
        if (!isFirst) response.write(",");
        response.write(JSON.stringify({ type: "hospital", data: hospital }));
        isFirst = false;
      });
    }

    if (dataset === "prices" || dataset === "all") {
      const priceData = await db
        .select()
        .from(prices)
        .where(eq(prices.isActive, true))
        .limit(limit);
      priceData.forEach((price) => {
        if (!isFirst) response.write(",");
        response.write(JSON.stringify({ type: "price", data: price }));
        isFirst = false;
      });
    }

    if (dataset === "analytics" || dataset === "all") {
      const analyticsData = await db.select().from(analytics).limit(limit);
      analyticsData.forEach((analytic) => {
        if (!isFirst) response.write(",");
        response.write(JSON.stringify({ type: "analytics", data: analytic }));
        isFirst = false;
      });
    }

    response.write("]");
    response.end();
  }

  private async streamCSV(dataset: string, limit: number, response: Response) {
    const db = this.databaseService.db;
    let isFirst = true;

    if (dataset === "hospitals" || dataset === "all") {
      const hospitalData = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.isActive, true))
        .limit(limit);
      if (hospitalData.length > 0) {
        if (isFirst) {
          // Write headers
          const headers = Object.keys(hospitalData[0]).join(",");
          response.write(`${headers}\n`);
          isFirst = false;
        }

        hospitalData.forEach((row) => {
          const csvRow = Object.values(row)
            .map((val) =>
              typeof val === "string" && val.includes(",") ? `"${val}"` : val,
            )
            .join(",");
          response.write(`${csvRow}\n`);
        });
      }
    }

    if (dataset === "prices" || dataset === "all") {
      const priceData = await db
        .select()
        .from(prices)
        .where(eq(prices.isActive, true))
        .limit(limit);
      if (priceData.length > 0) {
        if (isFirst) {
          const headers = Object.keys(priceData[0]).join(",");
          response.write(`${headers}\n`);
          isFirst = false;
        }

        priceData.forEach((row) => {
          const csvRow = Object.values(row)
            .map((val) =>
              typeof val === "string" && val.includes(",") ? `"${val}"` : val,
            )
            .join(",");
          response.write(`${csvRow}\n`);
        });
      }
    }

    if (dataset === "analytics" || dataset === "all") {
      const analyticsData = await db.select().from(analytics).limit(limit);
      if (analyticsData.length > 0) {
        if (isFirst) {
          const headers = Object.keys(analyticsData[0]).join(",");
          response.write(`${headers}\n`);
          isFirst = false;
        }

        analyticsData.forEach((row) => {
          const csvRow = Object.values(row)
            .map((val) =>
              typeof val === "string" && val.includes(",") ? `"${val}"` : val,
            )
            .join(",");
          response.write(`${csvRow}\n`);
        });
      }
    }

    response.end();
  }

  private async streamExcel(
    dataset: string,
    limit: number,
    response: Response,
  ) {
    // For Excel, we need to collect all data first, then stream the workbook
    const db = this.databaseService.db;
    const workbook = { SheetNames: [], Sheets: {} };

    if (dataset === "hospitals" || dataset === "all") {
      const hospitalData = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.isActive, true))
        .limit(limit);
      if (hospitalData.length > 0) {
        const worksheet = this.createWorksheet(hospitalData);
        workbook.SheetNames.push("Hospitals");
        workbook.Sheets["Hospitals"] = worksheet;
      }
    }

    if (dataset === "prices" || dataset === "all") {
      const priceData = await db
        .select()
        .from(prices)
        .where(eq(prices.isActive, true))
        .limit(limit);
      if (priceData.length > 0) {
        const worksheet = this.createWorksheet(priceData);
        workbook.SheetNames.push("Prices");
        workbook.Sheets["Prices"] = worksheet;
      }
    }

    if (dataset === "analytics" || dataset === "all") {
      const analyticsData = await db.select().from(analytics).limit(limit);
      if (analyticsData.length > 0) {
        const worksheet = this.createWorksheet(analyticsData);
        workbook.SheetNames.push("Analytics");
        workbook.Sheets["Analytics"] = worksheet;
      }
    }

    // Write Excel buffer to response
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    response.write(buffer);
    response.end();
  }

  private createWorksheet(data: Array<Record<string, unknown>>): XLSX.WorkSheet {
    // Create a simple worksheet from array data
    const headers = Object.keys(data[0]);
    const wsData = [headers, ...data.map((row) => headers.map((h) => row[h]))];

    const ws = {};
    const range = {
      s: { c: 0, r: 0 },
      e: { c: headers.length - 1, r: wsData.length - 1 },
    };

    wsData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex });
        ws[cellRef] = { v: cell, t: typeof cell === "number" ? "n" : "s" };
      });
    });

    ws["!ref"] = XLSX.utils.encode_range(range);
    return ws;
  }

  async getComprehensiveMetrics(filters: { period?: string; state?: string }) {
    this.logger.info({
      msg: "Retrieving comprehensive metrics",
      filters,
      operation: "getComprehensiveMetrics",
    });

    try {
      const db = this.databaseService.db;
      const period = filters.period || "month";
      const currentPeriod = this.getCurrentPeriod(period);

      // Build base query conditions
      const conditions = [
        eq(analytics.periodType, period),
        eq(analytics.period, currentPeriod),
      ];
      if (filters.state) {
        conditions.push(eq(analytics.state, filters.state));
      }

      // Get all metrics for the specified period
      const metrics = await db
        .select()
        .from(analytics)
        .where(and(...conditions))
        .orderBy(analytics.metricName, analytics.calculatedAt);

      // Organize metrics by type
      const organizedMetrics = {
        totals: {},
        averages: {},
        distributions: {},
        comparisons: {},
        insights: {},
      };

      metrics.forEach((metric) => {
        const category = this.categorizeMetric(metric.metricName);
        const key =
          metric.state || metric.serviceName || metric.hospitalId || "overall";

        if (!organizedMetrics[category]) {
          organizedMetrics[category] = {};
        }

        if (!organizedMetrics[category][metric.metricName]) {
          organizedMetrics[category][metric.metricName] = {};
        }

        organizedMetrics[category][metric.metricName][key] = {
          value: Number(metric.value),
          sampleSize: metric.sampleSize,
          calculatedAt: metric.calculatedAt,
          metadata: metric.metadata ? JSON.parse(metric.metadata) : null,
        };
      });

      // Calculate summary statistics
      const summary = {
        totalMetrics: metrics.length,
        uniqueMetricTypes: new Set(metrics.map((m) => m.metricName)).size,
        periodCoverage: {
          period,
          current: currentPeriod,
          lastCalculated:
            metrics.length > 0
              ? metrics[metrics.length - 1].calculatedAt
              : null,
        },
        coverage: {
          states: new Set(metrics.filter((m) => m.state).map((m) => m.state))
            .size,
          services: new Set(
            metrics.filter((m) => m.serviceName).map((m) => m.serviceName),
          ).size,
          hospitals: new Set(
            metrics.filter((m) => m.hospitalId).map((m) => m.hospitalId),
          ).size,
        },
      };

      return {
        summary,
        metrics: organizedMetrics,
        filters,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to retrieve comprehensive metrics",
        error: error.message,
        operation: "getComprehensiveMetrics",
        filters,
      });
      throw error;
    }
  }

  async getPriceVarianceInsights(filters: {
    service?: string;
    state?: string;
  }) {
    this.logger.info({
      msg: "Generating price variance insights",
      filters,
      operation: "getPriceVarianceInsights",
    });

    try {
      const db = this.databaseService.db;

      // Build conditions
      const conditions = [eq(prices.isActive, true)];
      if (filters.service) {
        conditions.push(like(prices.serviceName, `%${filters.service}%`));
      }
      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }

      const whereClause = and(...conditions);

      // Get price statistics with variance calculations
      const [varianceStats] = await db
        .select({
          count: count(prices.id),
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          minPrice: sql<number>`MIN(CAST(${prices.grossCharge} AS DECIMAL))`,
          maxPrice: sql<number>`MAX(CAST(${prices.grossCharge} AS DECIMAL))`,
          stdDev: sql<number>`STDDEV(CAST(${prices.grossCharge} AS DECIMAL))`,
          variance: sql<number>`VARIANCE(CAST(${prices.grossCharge} AS DECIMAL))`,
          p25: sql<number>`PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CAST(${prices.grossCharge} AS DECIMAL))`,
          p75: sql<number>`PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST(${prices.grossCharge} AS DECIMAL))`,
          p90: sql<number>`PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY CAST(${prices.grossCharge} AS DECIMAL))`,
          p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST(${prices.grossCharge} AS DECIMAL))`,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause);

      // Get outliers (prices more than 2 standard deviations from mean)
      const avgPrice = Number(varianceStats.avgPrice);
      const stdDev = Number(varianceStats.stdDev);
      const outlierThreshold = avgPrice + 2 * stdDev;
      const lowOutlierThreshold = avgPrice - 2 * stdDev;

      const outliers = await db
        .select({
          id: prices.id,
          serviceName: prices.serviceName,
          hospitalName: hospitals.name,
          state: hospitals.state,
          price: sql<number>`CAST(${prices.grossCharge} AS DECIMAL)`,
          deviationFromMean: sql<number>`ABS(CAST(${prices.grossCharge} AS DECIMAL) - ${avgPrice})`,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(
          and(
            whereClause,
            sql`CAST(${prices.grossCharge} AS DECIMAL) > ${outlierThreshold} OR CAST(${prices.grossCharge} AS DECIMAL) < ${lowOutlierThreshold}`,
          ),
        )
        .orderBy(
          desc(
            sql<number>`ABS(CAST(${prices.grossCharge} AS DECIMAL) - ${avgPrice})`,
          ),
        )
        .limit(20);

      // Calculate coefficient of variation
      const coefficientOfVariation =
        avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;
      const iqr = Number(varianceStats.p75) - Number(varianceStats.p25);

      return {
        summary: {
          totalRecords: varianceStats.count,
          priceRange: {
            min: Number(varianceStats.minPrice),
            max: Number(varianceStats.maxPrice),
            spread:
              Number(varianceStats.maxPrice) - Number(varianceStats.minPrice),
          },
          centralTendency: {
            mean: avgPrice,
            median: (Number(varianceStats.p25) + Number(varianceStats.p75)) / 2, // Approximation
          },
          variability: {
            standardDeviation: stdDev,
            variance: Number(varianceStats.variance),
            coefficientOfVariation:
              Math.round(coefficientOfVariation * 100) / 100,
            interquartileRange: iqr,
          },
        },
        percentiles: {
          p25: Number(varianceStats.p25),
          p75: Number(varianceStats.p75),
          p90: Number(varianceStats.p90),
          p95: Number(varianceStats.p95),
        },
        outliers: {
          count: outliers.length,
          threshold: outlierThreshold,
          lowThreshold: lowOutlierThreshold,
          topOutliers: outliers.map((o) => ({
            ...o,
            price: Number(o.price),
            deviationFromMean: Number(o.deviationFromMean),
          })),
        },
        interpretation: this.interpretVarianceResults(
          coefficientOfVariation,
          outliers.length,
        ),
        filters,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate price variance insights",
        error: error.message,
        operation: "getPriceVarianceInsights",
        filters,
      });
      throw error;
    }
  }

  getMarketPositionInsights(filters: {
    hospitalId?: string;
    state?: string;
  }) {
    this.logger.info({
      msg: "Generating market position insights",
      filters,
      operation: "getMarketPositionInsights",
    });

    try {
      if (filters.hospitalId) {
        // Hospital-specific analysis
        return this.getHospitalPositionAnalysis(filters.hospitalId);
      } else {
        // Market-wide analysis
        return this.getMarketWideAnalysis(filters.state);
      }
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate market position insights",
        error: error.message,
        operation: "getMarketPositionInsights",
        filters,
      });
      throw error;
    }
  }

  async getBenchmarks(filters: { metric?: string; state?: string }) {
    this.logger.info({
      msg: "Generating benchmarks",
      filters,
      operation: "getBenchmarks",
    });

    try {
      const db = this.databaseService.db;
      const currentMonth = this.getCurrentPeriod("month");

      // Get industry benchmarks from analytics table
      const conditions = [
        eq(analytics.period, currentMonth),
        eq(analytics.periodType, "month"),
      ];
      if (filters.state) {
        conditions.push(eq(analytics.state, filters.state));
      }
      if (filters.metric) {
        conditions.push(eq(analytics.metricName, filters.metric));
      }

      const benchmarkMetrics = await db
        .select()
        .from(analytics)
        .where(and(...conditions))
        .orderBy(analytics.metricName, analytics.state);

      // Organize benchmarks by metric type
      const benchmarks = {};
      benchmarkMetrics.forEach((metric) => {
        if (!benchmarks[metric.metricName]) {
          benchmarks[metric.metricName] = {
            national: null,
            states: {},
            percentiles: {},
          };
        }

        if (metric.state) {
          benchmarks[metric.metricName].states[metric.state] = {
            value: Number(metric.value),
            sampleSize: metric.sampleSize,
            rank: null, // Will be calculated below
          };
        } else {
          benchmarks[metric.metricName].national = {
            value: Number(metric.value),
            sampleSize: metric.sampleSize,
          };
        }
      });

      // Calculate percentiles and rankings
      Object.keys(benchmarks).forEach((metricName) => {
        const stateValues = Object.values(benchmarks[metricName].states).map(
          (s: { label: string; value: number }) => s.value,
        );
        if (stateValues.length > 0) {
          stateValues.sort((a, b) => a - b);
          benchmarks[metricName].percentiles = {
            p10: this.calculatePercentile(stateValues, 10),
            p25: this.calculatePercentile(stateValues, 25),
            p50: this.calculatePercentile(stateValues, 50),
            p75: this.calculatePercentile(stateValues, 75),
            p90: this.calculatePercentile(stateValues, 90),
          };

          // Assign rankings
          Object.keys(benchmarks[metricName].states).forEach((state) => {
            const value = benchmarks[metricName].states[state].value;
            const rank = stateValues.filter((v) => v <= value).length;
            benchmarks[metricName].states[state].rank = rank;
          });
        }
      });

      return {
        benchmarks,
        metadata: {
          period: currentMonth,
          totalMetrics: Object.keys(benchmarks).length,
          statesIncluded: filters.state
            ? 1
            : new Set(
                benchmarkMetrics.filter((m) => m.state).map((m) => m.state),
              ).size,
        },
        interpretation: this.interpretBenchmarks(benchmarks),
        filters,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate benchmarks",
        error: error.message,
        operation: "getBenchmarks",
        filters,
      });
      throw error;
    }
  }

  async getRealTimeMetrics() {
    this.logger.info({
      msg: "Generating real-time metrics",
      operation: "getRealTimeMetrics",
    });

    try {
      const db = this.databaseService.db;

      // Get current counts (real-time)
      const [currentCounts] = await db
        .select({
          hospitals: count(hospitals.id),
          activePrices: sql<number>`(SELECT COUNT(*) FROM ${prices} WHERE ${prices.isActive} = true)`,
          uniqueServices: sql<number>`(SELECT COUNT(DISTINCT ${prices.serviceName}) FROM ${prices} WHERE ${prices.isActive} = true)`,
        })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      // Get recent activity (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentActivity] = await db
        .select({
          newHospitals: sql<number>`COUNT(CASE WHEN ${hospitals.createdAt} > ${oneHourAgo.toISOString()} THEN 1 END)`,
          updatedPrices: sql<number>`(SELECT COUNT(*) FROM ${prices} WHERE ${prices.updatedAt} > ${oneHourAgo.toISOString()})`,
        })
        .from(hospitals);

      // Get processing status from latest analytics
      const [latestAnalytics] = await db
        .select({
          lastCalculated: sql<Date>`MAX(${analytics.calculatedAt})`,
          metricsCount: count(analytics.id),
        })
        .from(analytics);

      // Calculate data freshness
      const dataFreshness = latestAnalytics.lastCalculated
        ? Math.round(
            (Date.now() - latestAnalytics.lastCalculated.getTime()) /
              (60 * 1000),
          )
        : null;

      return {
        currentCounts,
        recentActivity: {
          ...recentActivity,
          timeWindow: "1 hour",
        },
        systemStatus: {
          dataFreshness: dataFreshness
            ? `${dataFreshness} minutes ago`
            : "Unknown",
          totalAnalytics: latestAnalytics.metricsCount,
          lastAnalyticsRun: latestAnalytics.lastCalculated,
        },
        trends: {
          hourlyGrowthRate: this.calculateGrowthRate(
            recentActivity.newHospitals,
            currentCounts.hospitals,
          ),
          priceUpdateRate: this.calculateUpdateRate(
            recentActivity.updatedPrices,
          ),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate real-time metrics",
        error: error.message,
        operation: "getRealTimeMetrics",
      });
      throw error;
    }
  }

  // Helper methods
  private getCurrentPeriod(periodType: string): string {
    const now = new Date();
    switch (periodType) {
      case "month":
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      case "quarter":
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case "year":
        return `${now.getFullYear()}`;
      default:
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  private categorizeMetric(metricName: string): string {
    if (metricName.startsWith("total_")) return "totals";
    if (metricName.includes("avg_") || metricName.includes("average"))
      return "averages";
    if (metricName.includes("count_") || metricName.includes("_by_"))
      return "distributions";
    if (metricName.includes("most_") || metricName.includes("least_"))
      return "comparisons";
    return "insights";
  }

  private interpretVarianceResults(
    coefficientOfVariation: number,
    outlierCount: number,
  ): string[] {
    const interpretations = [];

    if (coefficientOfVariation < 15) {
      interpretations.push(
        "Low price variation - relatively consistent pricing across the market",
      );
    } else if (coefficientOfVariation < 30) {
      interpretations.push(
        "Moderate price variation - some pricing differences exist",
      );
    } else {
      interpretations.push(
        "High price variation - significant pricing differences across providers",
      );
    }

    if (outlierCount > 10) {
      interpretations.push(
        "Multiple outliers detected - consider investigating extreme pricing",
      );
    } else if (outlierCount > 0) {
      interpretations.push(
        "Some outliers present - may warrant closer examination",
      );
    }

    return interpretations;
  }

  private async getHospitalPositionAnalysis(hospitalId: string) {
    // Implementation for hospital-specific analysis
    const db = this.databaseService.db;

    // Get hospital's pricing compared to market
    const hospitalPrices = await db
      .select({
        serviceName: prices.serviceName,
        price: sql<number>`CAST(${prices.grossCharge} AS DECIMAL)`,
      })
      .from(prices)
      .where(and(eq(prices.hospitalId, hospitalId), eq(prices.isActive, true)))
      .limit(100);

    return {
      hospitalId,
      analysis: "Hospital-specific market position analysis",
      priceCount: hospitalPrices.length,
      services: hospitalPrices.map((p) => ({
        service: p.serviceName,
        price: Number(p.price),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  private async getMarketWideAnalysis(state?: string) {
    // Implementation for market-wide analysis
    const db = this.databaseService.db;

    const conditions = [eq(hospitals.isActive, true)];
    if (state) {
      conditions.push(eq(hospitals.state, state));
    }

    const [marketStats] = await db
      .select({
        hospitalCount: count(hospitals.id),
        avgPrices: sql<number>`(SELECT AVG(CAST(gross_charge AS DECIMAL)) FROM prices WHERE hospital_id IN (SELECT id FROM hospitals WHERE is_active = true${state ? ` AND state = '${state}'` : ""}))`,
      })
      .from(hospitals)
      .where(and(...conditions));

    return {
      scope: state ? `State: ${state}` : "National",
      marketStats,
      timestamp: new Date().toISOString(),
    };
  }

  private interpretBenchmarks(benchmarks: {
    position: number;
    percentBelow: number;
    percentAbove: number;
    avgDifference: number;
  }): string[] {
    const interpretations = [];
    const metricCount = Object.keys(benchmarks).length;

    interpretations.push(
      `Analysis covers ${metricCount} key performance metrics`,
    );

    return interpretations;
  }

  private calculatePercentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateGrowthRate(newItems: number, totalItems: number): number {
    return totalItems > 0
      ? Math.round((newItems / totalItems) * 10000) / 100
      : 0;
  }

  private calculateUpdateRate(updates: number): number {
    return Math.round(updates * 100) / 100;
  }
}
