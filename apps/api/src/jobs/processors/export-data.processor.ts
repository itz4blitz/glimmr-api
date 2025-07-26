import { Injectable } from "@nestjs/common";
import { WorkerHost, OnWorkerEvent, Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { StorageService } from "../../storage/storage.service";
import { DatabaseService } from "../../database/database.service";
import { analytics, prices, hospitals } from "../../database/schema";
import { eq } from "drizzle-orm";
import { QUEUE_NAMES } from "../queues/queue.config";

export interface ExportJobData {
  exportId: string;
  format: string;
  dataset: string;
  limit: number;
  filters?: any;
}

export interface ExportJobResult {
  exportId: string;
  status: "completed" | "failed";
  downloadUrl?: string;
  errorMessage?: string;
  totalRecords: number;
  processedRecords: number;
  fileSizeMB: number;
}

@Injectable()
@Processor(QUEUE_NAMES.EXPORT_DATA)
export class ExportDataProcessor extends WorkerHost {
  constructor(
    @InjectPinoLogger(ExportDataProcessor.name)
    private readonly logger: PinoLogger,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<ExportJobResult> {
    const { exportId, format, dataset, limit, filters } = job.data;

    this.logger.info({
      msg: "Starting export job processing",
      exportId,
      format,
      dataset,
      limit,
      operation: "processExportJob",
    });

    try {
      // Update progress: Starting
      await job.updateProgress(5);
      this.updateServiceProgress(
        exportId,
        "processing",
        5,
        "Initializing export...",
      );

      // Collect data
      await job.updateProgress(10);
      this.updateServiceProgress(
        exportId,
        "processing",
        10,
        "Collecting data...",
      );

      const exportData = await this.collectExportData(dataset, limit, job);

      // Generate file
      await job.updateProgress(70);
      this.updateServiceProgress(
        exportId,
        "processing",
        70,
        "Generating export file...",
      );

      const fileBuffer = await this.generateExportFile(exportData, format, job);

      // Upload to storage
      await job.updateProgress(85);
      this.updateServiceProgress(
        exportId,
        "processing",
        85,
        "Uploading file...",
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `exports/${exportId}_${dataset}_${timestamp}.${format}`;

      const stream = require("stream");
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);

      const uploadResult = await this.storageService.uploadFromStream(
        filename,
        bufferStream,
        { contentType: this.getContentType(format) },
      );

      // Complete
      await job.updateProgress(100);
      this.updateServiceProgress(
        exportId,
        "completed",
        100,
        "Export completed successfully",
        uploadResult.url,
      );

      const result: ExportJobResult = {
        exportId,
        status: "completed",
        downloadUrl: uploadResult.url,
        totalRecords: exportData.totalRecords,
        processedRecords: exportData.totalRecords,
        fileSizeMB: fileBuffer.length / (1024 * 1024),
      };

      this.logger.info({
        msg: "Export job completed successfully",
        exportId,
        fileSizeMB: result.fileSizeMB,
        totalRecords: result.totalRecords,
        operation: "processExportJob",
      });

      return result;
    } catch (error) {
      this.logger.error({
        msg: "Export job failed",
        exportId,
        error: error.message,
        operation: "processExportJob",
      });

      this.updateServiceProgress(
        exportId,
        "failed",
        0,
        `Export failed: ${error.message}`,
      );

      return {
        exportId,
        status: "failed",
        errorMessage: error.message,
        totalRecords: 0,
        processedRecords: 0,
        fileSizeMB: 0,
      };
    }
  }

  private async collectExportData(dataset: string, limit: number, job: Job) {
    const db = this.databaseService.db;
    const data = { hospitals: [], prices: [], analytics: [], totalRecords: 0 };

    if (dataset === "hospitals" || dataset === "all") {
      await job.updateProgress(20);
      this.updateServiceProgress(
        job.data.exportId,
        "processing",
        20,
        "Collecting hospital data...",
      );

      data.hospitals = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.isActive, true))
        .limit(dataset === "all" ? Math.floor(limit / 3) : limit);

      data.totalRecords += data.hospitals.length;
    }

    if (dataset === "prices" || dataset === "all") {
      await job.updateProgress(40);
      this.updateServiceProgress(
        job.data.exportId,
        "processing",
        40,
        "Collecting price data...",
      );

      data.prices = await db
        .select()
        .from(prices)
        .where(eq(prices.isActive, true))
        .limit(dataset === "all" ? Math.floor(limit / 3) : limit);

      data.totalRecords += data.prices.length;
    }

    if (dataset === "analytics" || dataset === "all") {
      await job.updateProgress(60);
      this.updateServiceProgress(
        job.data.exportId,
        "processing",
        60,
        "Collecting analytics data...",
      );

      data.analytics = await db
        .select()
        .from(analytics)
        .limit(dataset === "all" ? Math.floor(limit / 3) : limit);

      data.totalRecords += data.analytics.length;
    }

    return data;
  }

  private async generateExportFile(
    data: any,
    format: string,
    job: Job,
  ): Promise<Buffer> {
    switch (format) {
      case "json":
        return Buffer.from(JSON.stringify(data, null, 2));

      case "csv":
        return this.generateCSVFile(data);

      case "excel":
        return this.generateExcelFile(data);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateCSVFile(data: any): Buffer {
    let csvContent = "";

    // Hospitals
    if (data.hospitals.length > 0) {
      csvContent +=
        "TYPE,ID,NAME,STATE,CITY,ADDRESS,PHONE,WEBSITE,BED_COUNT,OWNERSHIP\n";
      data.hospitals.forEach((hospital) => {
        const row = [
          "hospital",
          hospital.id,
          `"${hospital.name || ""}"`,
          hospital.state || "",
          `"${hospital.city || ""}"`,
          `"${hospital.address || ""}"`,
          hospital.phone || "",
          hospital.website || "",
          hospital.bedCount || "",
          hospital.ownership || "",
        ].join(",");
        csvContent += row + "\n";
      });
    }

    // Prices
    if (data.prices.length > 0) {
      if (csvContent) csvContent += "\n";
      csvContent +=
        "TYPE,ID,HOSPITAL_ID,DESCRIPTION,CODE,GROSS_CHARGE,DISCOUNTED_CASH_PRICE,CATEGORY\n";
      data.prices.forEach((price) => {
        const row = [
          "price",
          price.id,
          price.hospitalId,
          `"${price.description || ""}"`,
          price.code || "",
          price.grossCharge || "",
          price.discountedCashPrice || "",
          price.category || "",
        ].join(",");
        csvContent += row + "\n";
      });
    }

    // Analytics
    if (data.analytics.length > 0) {
      if (csvContent) csvContent += "\n";
      csvContent += "TYPE,ID,METRIC_NAME,METRIC_TYPE,VALUE,STATE,CITY,PERIOD\n";
      data.analytics.forEach((analytic) => {
        const row = [
          "analytics",
          analytic.id,
          analytic.metricName || "",
          analytic.metricType || "",
          analytic.value || "",
          analytic.state || "",
          analytic.city || "",
          analytic.period || "",
        ].join(",");
        csvContent += row + "\n";
      });
    }

    return Buffer.from(csvContent);
  }

  private generateExcelFile(data: any): Buffer {
    // Simplified Excel generation - in production, would use a proper Excel library
    // For now, return CSV format with Excel extension
    return this.generateCSVFile(data);
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

  private updateServiceProgress(
    exportId: string,
    status: "processing" | "completed" | "failed",
    progress: number,
    message: string,
    downloadUrl?: string,
  ) {
    // Store progress in Redis for the analytics service to read
    // The analytics service will poll this or we can use Redis pub/sub
    this.logger.info({
      msg: "Job progress update",
      exportId,
      status,
      progress,
      message,
      downloadUrl,
      operation: "updateServiceProgress",
    });

    // TODO: In future, we could emit events or use Redis to share progress
    // with the analytics service. For now, BullMQ's job progress is sufficient.
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job, result: ExportJobResult) {
    this.logger.info({
      msg: "Export job completed",
      exportId: job.data.exportId,
      jobId: job.id,
      result,
      operation: "onCompleted",
    });
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    this.logger.error({
      msg: "Export job failed",
      exportId: job.data.exportId,
      jobId: job.id,
      error: error.message,
      operation: "onFailed",
    });
  }
}
