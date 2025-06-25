import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import axios from 'axios';
import { QUEUE_NAMES } from '../queues/queue.config.js';
import { DatabaseService } from '../../database/database.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { priceTransparencyFiles } from '../../database/schema/index.js';
import { eq } from 'drizzle-orm';

export interface PRAFileDownloadJobData {
  hospitalId: string;
  hospitalName: string;
  fileId: string;
  fileName: string;
  fileUrl: string;
  filesuffix: string;
  size: string;
  retrieved: string;
  forceReprocess?: boolean;
}

export interface PRAFileDownloadJobResult {
  success: boolean;
  hospitalId: string;
  fileId: string;
  fileName: string;
  filePath?: string;
  fileSize?: number;
  downloadDuration: number;
  error?: string;
  timestamp: string;
}

export interface PRAFileImportJobData {
  hospitalId: string;
  hospitalName: string;
  fileId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  retrievedTimestamp: string;
}

@Injectable()
@Processor(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
export class PRAFileDownloadProcessor extends WorkerHost {
  private readonly storageBasePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,

    @InjectPinoLogger(PRAFileDownloadProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();

    // Configure storage path - fallback for local file operations
    this.storageBasePath = this.configService.get<string>('FILE_STORAGE_PATH', './storage/pra-files');
  }

  async process(job: Job<PRAFileDownloadJobData>): Promise<PRAFileDownloadJobResult> {
    const { hospitalId, hospitalName, fileId, fileName, fileUrl, filesuffix, retrieved } = job.data;
    const fileType = filesuffix;
    const retrievedTimestamp = retrieved;
    const startTime = Date.now();

    this.logger.info({
      jobId: job.id,
      hospitalId,
      hospitalName,
      fileId,
      fileName,
      fileUrl,
      operation: 'pra-file-download',
    }, 'Starting PRA file download job');

    try {
      await job.updateProgress(10);

      // Generate storage key
      const sanitizedHospitalName = this.sanitizeFileName(hospitalName);
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const fileExtension = this.getFileExtension(fileName, fileType);
      const storageKey = `pra-files/${sanitizedHospitalName}/${fileId}_${sanitizedFileName}${fileExtension}`;

      await job.updateProgress(20);

      // Download the file
      this.logger.info({
        jobId: job.id,
        hospitalId,
        fileUrl,
        storageKey,
        operation: 'pra-file-download',
      }, 'Starting file download');

      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream',
        timeout: 300000, // 5 minutes timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      await job.updateProgress(40);

      // Upload to storage service
      const storageFile = await this.storageService.uploadFromStream(
        storageKey,
        response.data,
        {
          contentType: this.getContentType(fileType),
          metadata: {
            hospitalId,
            hospitalName,
            fileId,
            originalFileName: fileName,
            retrievedTimestamp,
          },
        }
      );

      await job.updateProgress(70);

      const fileSize = storageFile.size;

      // Record the file in the database
      const db = this.databaseService.db;
      await db.insert(priceTransparencyFiles).values({
        hospitalId,
        filename: sanitizedFileName,
        fileUrl,
        fileType,
        fileSize,
        lastRetrieved: new Date(retrievedTimestamp),
        processingStatus: 'pending',
        externalFileId: fileId,
      });

      await job.updateProgress(90);

      // Update database record to mark file as downloaded
      await db.update(priceTransparencyFiles)
        .set({
          processingStatus: 'completed',
          fileSize: fileSize,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.externalFileId, fileId));

      const downloadDuration = Date.now() - startTime;
      const result: PRAFileDownloadJobResult = {
        success: true,
        hospitalId,
        fileId,
        fileName: sanitizedFileName,
        filePath: storageKey,
        fileSize,
        downloadDuration,
        timestamp: new Date().toISOString(),
      };

      await job.updateProgress(100);

      this.logger.info({
        jobId: job.id,
        result,
        operation: 'pra-file-download',
      }, 'PRA file download job completed successfully');

      return result;
    } catch (error) {
      const downloadDuration = Date.now() - startTime;
      
      this.logger.error({
        jobId: job.id,
        hospitalId,
        fileId,
        fileName,
        fileUrl,
        error: error.message,
        downloadDuration,
        operation: 'pra-file-download',
      }, 'PRA file download job failed');

      // Record failed download in database
      try {
        const db = this.databaseService.db;
        await db.insert(priceTransparencyFiles).values({
          hospitalId,
          filename: fileName,
          fileUrl,
          fileType,
          lastRetrieved: new Date(retrievedTimestamp),
          processingStatus: 'failed',
          errorMessage: error.message,
          externalFileId: fileId,
        });
      } catch (dbError) {
        this.logger.error({
          jobId: job.id,
          hospitalId,
          fileId,
          dbError: dbError.message,
          operation: 'pra-file-download',
        }, 'Failed to record download failure in database');
      }

      return {
        success: false,
        hospitalId,
        fileId,
        fileName,
        downloadDuration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Sanitize file name for safe storage
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .replace(/_$/, '')
      .substring(0, 100); // Limit length
  }

  /**
   * Get file extension based on file name and type
   */
  private getFileExtension(fileName: string, fileType: string): string {
    // First try to get extension from filename
    const fileNameExt = fileName.split('.').pop()?.toLowerCase();
    if (fileNameExt && ['csv', 'xlsx', 'xls', 'json', 'xml'].includes(fileNameExt)) {
      return `.${fileNameExt}`;
    }

    // Fall back to file type
    switch (fileType.toLowerCase()) {
      case 'csv':
        return '.csv';
      case 'xlsx':
        return '.xlsx';
      case 'xls':
        return '.xls';
      case 'json':
        return '.json';
      case 'xml':
        return '.xml';
      default:
        return '.dat';
    }
  }

  /**
   * Get content type for file type
   */
  private getContentType(fileType: string): string {
    switch (fileType.toLowerCase()) {
      case 'csv':
        return 'text/csv';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'json':
        return 'application/json';
      case 'xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }



  @OnWorkerEvent('completed')
  onCompleted(job: Job<PRAFileDownloadJobData>, result: PRAFileDownloadJobResult) {
    this.logger.info({
      jobId: job.id,
      result,
      operation: 'pra-file-download',
    }, 'PRA file download job completed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PRAFileDownloadJobData>, error: Error) {
    this.logger.error({
      jobId: job.id,
      error: error.message,
      operation: 'pra-file-download',
    }, 'PRA file download job failed');
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn({
      jobId,
      operation: 'pra-file-download',
    }, 'PRA file download job stalled');
  }
}
