import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { QUEUE_NAMES } from '../queues/queue.config';
import { priceTransparencyFiles, jobs as jobsTable, jobLogs } from '../../database/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PRAFileDownloadJobData {
  hospitalId: string;
  fileId: string;
  fileUrl: string;
  filename: string;
  filesuffix?: string;
  size?: number;
  retrieved?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
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
    const { hospitalId, fileId, fileUrl, filename } = job.data;
    const startTime = Date.now();
    let jobRecord: any;

    this.logger.info({
      msg: 'Starting file download',
      jobId: job.id,
      hospitalId,
      fileId,
      fileUrl,
      filename,
    });

    try {
      // Create job record in database
      const db = this.databaseService.db;
      const [newJob] = await db.insert(jobsTable).values({
        jobType: 'data_import',
        jobName: `Download: ${filename}`,
        description: `Downloading price transparency file from ${fileUrl}`,
        status: 'running',
        queue: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
        priority: job.opts.priority || 0,
        startedAt: new Date(),
        inputData: JSON.stringify(job.data),
        createdBy: 'system',
      }).returning();
      jobRecord = newJob;

      // Log job start
      await this.logJobEvent(jobRecord.id, 'info', 'Job started', { fileUrl, filename });

      // Update progress
      await job.updateProgress({ percentage: 5, message: 'Validating file record' });

      // Verify file record exists
      const [fileRecord] = await db
        .select()
        .from(priceTransparencyFiles)
        .where(eq(priceTransparencyFiles.id, fileId));

      if (!fileRecord) {
        throw new Error(`File record not found: ${fileId}`);
      }

      // Check if file was recently downloaded (within last 24 hours)
      if (fileRecord.lastRetrieved) {
        const hoursSinceLastDownload = 
          (Date.now() - fileRecord.lastRetrieved.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastDownload < 24 && fileRecord.processingStatus === 'completed') {
          this.logger.info({
            msg: 'File recently downloaded, skipping',
            fileId,
            hoursSinceLastDownload,
          });
          
          await this.updateJobSuccess(jobRecord.id, {
            skipped: true,
            reason: 'Recently downloaded',
            hoursSinceLastDownload,
          });
          
          return {
            skipped: true,
            reason: 'File was recently downloaded',
          };
        }
      }

      await job.updateProgress({ percentage: 10, message: 'Starting download' });
      
      // Update file status to processing
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      // Download file with streaming
      const downloadResult = await this.downloadFile(
        fileUrl,
        hospitalId,
        filename,
        job,
        jobRecord.id
      );

      await job.updateProgress({ percentage: 80, message: 'Updating database records' });

      // Update file record with download results
      await db
        .update(priceTransparencyFiles)
        .set({
          storageKey: downloadResult.storageKey,
          fileSize: downloadResult.fileSize,
          fileHash: downloadResult.fileHash,
          lastRetrieved: new Date(),
          processingStatus: 'downloaded',
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      await job.updateProgress({ percentage: 90, message: 'Queueing for processing' });

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
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 20,
          removeOnFail: 30,
        }
      );

      await job.updateProgress({ percentage: 100, message: 'Download completed' });

      const duration = Date.now() - startTime;
      
      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        ...downloadResult,
        duration,
        queuedForProcessing: true,
      });

      this.logger.info({
        msg: 'File download completed',
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
      this.logger.error({
        msg: 'File download failed',
        jobId: job.id,
        fileId,
        error: error.message,
        stack: error.stack,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, error);
      }

      // Update file status to failed
      await this.databaseService.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'failed',
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
    jobId: string
  ): Promise<{
    storageKey: string;
    fileSize: number;
    fileHash: string;
    downloadDuration: number;
  }> {
    const downloadStartTime = Date.now();
    
    try {
      // Generate storage key
      const timestamp = new Date().toISOString().split('T')[0];
      const fileExt = path.extname(filename) || '.csv';
      const baseName = path.basename(filename, fileExt);
      const storageKey = `hospitals/${hospitalId}/transparency-files/${timestamp}/${baseName}${fileExt}`;

      await this.logJobEvent(jobId, 'info', 'Starting file download', { 
        url: fileUrl,
        storageKey 
      });

      // Download file with axios streaming
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream',
        timeout: 300000, // 5 minutes
        maxContentLength: 500 * 1024 * 1024, // 500MB max
        headers: {
          'User-Agent': 'Glimmr Price Transparency Crawler/1.0',
        },
      });

      const contentLength = parseInt(response.headers['content-length'] || '0');
      let downloadedBytes = 0;
      let lastProgressUpdate = Date.now();

      // Create hash for file integrity
      const hash = crypto.createHash('sha256');

      // Monitor download progress
      const downloadStarted = Date.now();
      let lastSpeedCalc = downloadStarted;
      let lastDownloadedBytes = 0;
      
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        hash.update(chunk);

        // Update progress every second
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const percentage = contentLength > 0 
            ? Math.round((downloadedBytes / contentLength) * 70) + 10
            : 30;
          
          // Calculate download speed
          const timeDiff = (now - lastSpeedCalc) / 1000; // seconds
          const bytesDiff = downloadedBytes - lastDownloadedBytes;
          const speed = bytesDiff / timeDiff; // bytes per second
          
          // Calculate ETA
          let eta = '';
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
          
          job.updateProgress(progressData);
          
          // Also log progress for monitoring (fire and forget)
          this.logJobEvent(jobId, 'info', 'Download progress', progressData).catch(err => 
            this.logger.error({ msg: 'Failed to log progress', error: err.message })
          );
          
          lastProgressUpdate = now;
          lastSpeedCalc = now;
          lastDownloadedBytes = downloadedBytes;
        }
      });

      // Upload to storage
      await this.storageService.uploadFromStream(storageKey, response.data, {
        contentType: response.headers['content-type'] || 'application/octet-stream',
        metadata: {
          hospitalId,
          originalUrl: fileUrl,
          downloadedAt: new Date().toISOString(),
        },
      });

      const fileHash = hash.digest('hex');
      const downloadDuration = Date.now() - downloadStartTime;

      await this.logJobEvent(jobId, 'info', 'File download completed', {
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
      await this.logJobEvent(jobId, 'error', 'File download failed', {
        error: error.message,
        stack: error.stack,
      });

      if (error.response) {
        throw new Error(
          `HTTP ${error.response.status}: ${error.response.statusText} - ${fileUrl}`
        );
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`Download timeout exceeded for ${fileUrl}`);
      } else {
        throw error;
      }
    }
  }

  private detectFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.csv':
        return 'csv';
      case '.json':
        return 'json';
      case '.xlsx':
      case '.xls':
        return 'excel';
      case '.zip':
        return 'zip';
      default:
        return 'unknown';
    }
  }

  private async logJobEvent(
    jobId: string,
    level: string,
    message: string,
    data?: any
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
        msg: 'Failed to log job event',
        error: error.message,
        jobId,
        level,
        message,
      });
    }
  }

  private async updateJobSuccess(jobId: string, outputData: any): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: 'completed',
        completedAt: new Date(),
        duration: outputData.duration,
        outputData: JSON.stringify(outputData),
        progressPercentage: 100,
        recordsProcessed: outputData.skipped ? 0 : 1,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, 'info', 'Job completed successfully', outputData);
  }

  private async updateJobFailure(jobId: string, error: Error): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorStack: error.stack,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, 'error', 'Job failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}