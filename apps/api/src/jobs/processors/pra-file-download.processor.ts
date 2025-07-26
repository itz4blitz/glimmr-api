import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DatabaseService } from "../../database/database.service";
import { StorageService } from "../../storage/storage.service";
import { QUEUE_NAMES } from "../queues/queue.config";
import {
  priceTransparencyFiles,
  jobs as jobsTable,
  jobLogs,
} from "../../database/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import * as path from "path";
import * as crypto from "crypto";

export interface PRAFileDownloadJobData {
  hospitalId: string;
  fileId: string;
  fileUrl: string;
  filename: string;
  filesuffix?: string;
  size?: number;
  retrieved?: string;
  forceRefresh?: boolean;
}

@Injectable()
@Processor(QUEUE_NAMES.PRA_FILE_DOWNLOAD, {
  concurrency: 2, // Reduced concurrency to prevent overwhelming storage/network
  lockDuration: 1800000, // 30 minutes for very large files
  maxStalledCount: 3, // Allow 3 stalled attempts before failing
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
})
export class PRAFileDownloadProcessor extends WorkerHost {
  constructor(
    @InjectPinoLogger(PRAFileDownloadProcessor.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly priceFileQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PRAFileDownloadJobData>): Promise<any> {
    const { hospitalId, fileId, fileUrl, filename, forceRefresh } = job.data;
    const startTime = Date.now();
    let jobRecord: any;

    this.logger.info({
      msg: "Starting file download",
      jobId: job.id,
      hospitalId,
      fileId,
      fileUrl,
      filename,
    });

    try {
      // Create job record in database
      const db = this.databaseService.db;
      const [newJob] = await db
        .insert(jobsTable)
        .values({
          jobType: "data_import",
          jobName: `Download: ${filename}`,
          description: `Downloading price transparency file from ${fileUrl}`,
          status: "running",
          queue: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning();
      jobRecord = newJob;

      // Log job start
      await this.logJobEvent(jobRecord.id, "info", "Job started", {
        fileUrl,
        filename,
      });

      // Update progress
      await job.updateProgress({
        percentage: 5,
        message: "Validating file record",
      });

      // Verify file record exists
      const [fileRecord] = await db
        .select()
        .from(priceTransparencyFiles)
        .where(eq(priceTransparencyFiles.id, fileId));

      if (!fileRecord) {
        // Log detailed error for debugging
        this.logger.warn({
          msg: "File record not found in database - likely a stale job",
          fileId,
          hospitalId,
          fileUrl,
          filename,
          jobId: job.id,
          jobData: job.data,
        });

        // Mark as completed to prevent retry since the file doesn't exist
        await this.updateJobSuccess(jobRecord.id, {
          skipped: true,
          reason: "File record not found - stale job",
          fileId,
          duration: Date.now() - startTime,
        });

        await this.logJobEvent(
          jobRecord.id,
          "warn",
          "Job skipped - file record not found (stale job)",
          { fileId, hospitalId, fileUrl },
        );

        // Don't throw error, just skip processing
        return {
          skipped: true,
          reason: "File record not found - this is a stale job for a deleted or missing file",
        };
      }

      // Check if file was recently downloaded (within last 24 hours)
      if (fileRecord.lastRetrieved) {
        const hoursSinceLastDownload =
          (Date.now() - fileRecord.lastRetrieved.getTime()) / (1000 * 60 * 60);

        if (
          hoursSinceLastDownload < 24 &&
          fileRecord.processingStatus === "completed" &&
          fileRecord.storageKey &&
          !forceRefresh // Honor force refresh flag
        ) {
          // Verify file still exists in storage before skipping
          try {
            const exists = await this.storageService.fileExists(fileRecord.storageKey);
            if (exists) {
              this.logger.info({
                msg: "File recently downloaded and exists in storage, skipping",
                fileId,
                hoursSinceLastDownload,
                storageKey: fileRecord.storageKey,
              });

              await this.updateJobSuccess(jobRecord.id, {
                skipped: true,
                reason: "Recently downloaded and verified in storage",
                hoursSinceLastDownload,
                storageKey: fileRecord.storageKey,
              });

              return {
                skipped: true,
                reason: "File was recently downloaded and exists in storage",
              };
            }
          } catch (err) {
            this.logger.warn({
              msg: "Could not verify file existence, proceeding with download",
              error: err.message,
              storageKey: fileRecord.storageKey,
            });
          }
        }
      }

      await job.updateProgress({
        percentage: 10,
        message: "Starting download",
      });

      // Update file status to processing
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: "processing",
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      // Download file with streaming
      const downloadResult = await this.downloadFile(
        fileUrl,
        hospitalId,
        filename,
        job,
        jobRecord.id,
      );

      await job.updateProgress({
        percentage: 80,
        message: "Updating database records",
      });

      // Update file record with download results
      await db
        .update(priceTransparencyFiles)
        .set({
          storageKey: downloadResult.storageKey,
          fileSize: downloadResult.fileSize,
          fileHash: downloadResult.fileHash,
          lastRetrieved: new Date(),
          processingStatus: "downloaded",
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      await job.updateProgress({
        percentage: 90,
        message: "Queueing for processing",
      });

      // Queue file for parsing
      await this.priceFileQueue.add(
        `parse-${fileId}`,
        {
          hospitalId,
          fileId,
          storageKey: downloadResult.storageKey,
          filename,
          fileType: this.detectFileType(filename),
          fileSize: downloadResult.fileSize,
        },
        {
          priority: 5,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 20,
          removeOnFail: 30,
        },
      );

      await job.updateProgress({
        percentage: 100,
        message: "Download completed",
      });

      const duration = Date.now() - startTime;

      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        ...downloadResult,
        duration,
        queuedForProcessing: true,
      });

      this.logger.info({
        msg: "File download completed",
        jobId: job.id,
        fileId,
        duration,
        fileSize: downloadResult.fileSize,
        storageKey: downloadResult.storageKey,
      });

      return {
        success: true,
        ...downloadResult,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error({
        msg: "File download failed",
        jobId: job.id,
        fileId,
        error: error.message,
        stack: error.stack,
        duration,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, error, duration);
      }

      // Update file status to failed
      await this.databaseService.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: "failed",
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      throw error;
    }
  }

  private async downloadFile(
    fileUrl: string,
    hospitalId: string,
    filename: string,
    job: Job,
    jobId: string,
  ): Promise<{
    storageKey: string;
    fileSize: number;
    fileHash: string;
    downloadDuration: number;
  }> {
    const downloadStartTime = Date.now();

    try {
      // Generate storage key
      const timestamp = new Date().toISOString().split("T")[0];
      const fileExt = path.extname(filename) || ".csv";
      const baseName = path.basename(filename, fileExt);
      const storageKey = `hospitals/${hospitalId}/transparency-files/${timestamp}/${baseName}${fileExt}`;

      await this.logJobEvent(jobId, "info", "Starting file download", {
        url: fileUrl,
        storageKey,
      });

      // Download file with axios streaming
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          response = await axios({
            method: "GET",
            url: fileUrl,
            responseType: "stream",
            timeout: 60000, // 60 second timeout for initial connection
            maxContentLength: Infinity, // Allow large files
            maxBodyLength: Infinity,
            headers: {
              "User-Agent": "Glimmr Price Transparency Crawler/1.0",
              Accept: "*/*",
              "Accept-Encoding": "gzip, deflate",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
            validateStatus: (status) => status < 500, // Accept redirects and client errors
            maxRedirects: 5,
            decompress: true, // Handle compressed responses
          });
          
          // Check for successful response
          if (response.status >= 200 && response.status < 300) {
            break; // Success, exit retry loop
          } else if (response.status === 404) {
            throw new Error(`File not found (404): ${fileUrl}`);
          } else if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          
          this.logger.warn({
            msg: "Download attempt failed, retrying",
            attempt: retryCount,
            maxRetries,
            error: error.message,
            url: fileUrl,
          });
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
      
      // Ensure response exists after retry loop
      if (!response) {
        throw new Error(`Failed to download file after ${maxRetries} attempts: ${fileUrl}`);
      }

      const contentLength = parseInt(response.headers["content-length"] || "0");
      let downloadedBytes = 0;
      let lastProgressUpdate = Date.now();

      // Create hash for file integrity
      const hash = crypto.createHash("sha256");

      // Monitor download progress
      const downloadStarted = Date.now();
      let lastSpeedCalc = downloadStarted;
      let lastDownloadedBytes = 0;

      response.data.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        hash.update(chunk);

        // Update progress every 5 seconds to avoid overwhelming Redis
        const now = Date.now();
        if (now - lastProgressUpdate > 5000) {
          const percentage =
            contentLength > 0
              ? Math.round((downloadedBytes / contentLength) * 70) + 10
              : 30;

          // Calculate download speed
          const timeDiff = (now - lastSpeedCalc) / 1000; // seconds
          const bytesDiff = downloadedBytes - lastDownloadedBytes;
          const speed = bytesDiff / timeDiff; // bytes per second

          // Calculate ETA
          let eta = "";
          if (contentLength > 0 && speed > 0) {
            const remainingBytes = contentLength - downloadedBytes;
            const remainingSeconds = Math.ceil(remainingBytes / speed);
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const remainingHours = Math.floor(remainingMinutes / 60);

            if (remainingHours > 0) {
              eta = `${remainingHours}h ${remainingMinutes % 60}m`;
            } else if (remainingMinutes > 0) {
              eta = `${remainingMinutes}m ${remainingSeconds % 60}s`;
            } else {
              eta = `${remainingSeconds}s`;
            }
          }

          const progressData = {
            percentage,
            message: `Downloaded ${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB`,
            bytesDownloaded: downloadedBytes,
            totalBytes: contentLength || undefined,
            speed: Math.round(speed),
            eta,
          };

          // Use async to avoid blocking
          (async () => {
            try {
              await job.updateProgress(progressData);
              // Also refresh the job lock to prevent timeout
              if (job.token) {
                await job.extendLock(job.token, 60000); // Extend lock by 60 seconds
              }
            } catch (err) {
              this.logger.warn({
                msg: "Failed to update progress",
                error: err.message,
              });
            }
          })();

          lastProgressUpdate = now;
          lastSpeedCalc = now;
          lastDownloadedBytes = downloadedBytes;
        }
      });

      // Upload to storage with error handling
      try {
        await this.storageService.uploadFromStream(storageKey, response.data, {
          contentType:
            response.headers["content-type"] || "application/octet-stream",
          metadata: {
            hospitalId,
            originalUrl: fileUrl,
            downloadedAt: new Date().toISOString(),
            fileSize: String(downloadedBytes),
          },
        });
      } catch (uploadError) {
        // Log detailed error for debugging
        await this.logJobEvent(jobId, "error", "Storage upload failed", {
          error: uploadError.message,
          storageKey,
          downloadedBytes,
        });
        
        throw new Error(`Failed to upload to storage: ${uploadError.message}`);
      }

      const fileHash = hash.digest("hex");
      const downloadDuration = Date.now() - downloadStartTime;

      await this.logJobEvent(jobId, "info", "File download completed", {
        fileSize: downloadedBytes,
        duration: downloadDuration,
        hash: fileHash,
      });

      return {
        storageKey,
        fileSize: downloadedBytes,
        fileHash,
        downloadDuration,
      };
    } catch (error) {
      await this.logJobEvent(jobId, "error", "File download failed", {
        error: error.message,
        stack: error.stack,
      });

      if (error.response) {
        throw new Error(
          `HTTP ${error.response.status}: ${error.response.statusText} - ${fileUrl}`,
        );
      } else if (error.code === "ECONNABORTED") {
        throw new Error(`Download timeout exceeded for ${fileUrl}`);
      } else {
        throw error;
      }
    }
  }

  private detectFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case ".csv":
        return "csv";
      case ".json":
        return "json";
      case ".xlsx":
      case ".xls":
        return "excel";
      case ".zip":
        return "zip";
      default:
        return "unknown";
    }
  }

  private async logJobEvent(
    jobId: string,
    level: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      await this.databaseService.db.insert(jobLogs).values({
        jobId,
        level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (error) {
      this.logger.error({
        msg: "Failed to log job event",
        error: error.message,
        jobId,
        level,
        message,
      });
    }
  }

  private async updateJobSuccess(
    jobId: string,
    outputData: any,
  ): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        duration: outputData.duration,
        outputData: JSON.stringify(outputData),
        progressPercentage: 100,
        recordsProcessed: outputData.skipped ? 0 : 1,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(
      jobId,
      "info",
      "Job completed successfully",
      outputData,
    );
  }

  private async updateJobFailure(jobId: string, error: Error, duration?: number): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        duration,
        errorMessage: error.message,
        errorStack: error.stack,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, "error", "Job failed", {
      error: error.message,
      stack: error.stack,
      duration,
    });
  }
}
