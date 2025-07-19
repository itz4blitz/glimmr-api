import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../../database/database.service';
import { hospitals, priceTransparencyFiles } from '../../database/schema/index';
import { eq, and, isNotNull, gte } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue.config';
import { HospitalImportJobData } from '../processors/hospital-import.processor';
import { PriceFileDownloadJobData } from '../processors/price-file-download.processor';

@Injectable()
export class HospitalMonitorService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectQueue(QUEUE_NAMES.HOSPITAL_IMPORT)
    private readonly hospitalImportQueue: Queue<HospitalImportJobData>,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_DOWNLOAD)
    private readonly priceFileDownloadQueue: Queue<PriceFileDownloadJobData>,
    @InjectPinoLogger(HospitalMonitorService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Daily hospital data refresh - runs at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleDailyHospitalRefresh(): Promise<void> {
    this.logger.info({
      msg: 'Starting daily hospital data refresh',
    });

    try {
      await this.hospitalImportQueue.add(
        'daily-refresh',
        {
          forceRefresh: false,
          batchSize: 50,
        },
        {
          priority: 10,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      this.logger.info({
        msg: 'Daily hospital refresh job queued successfully',
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to queue daily hospital refresh',
        error: error.message,
      });
    }
  }

  /**
   * Monitor for updated price transparency files - runs every 4 hours
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async monitorPriceFileUpdates(): Promise<void> {
    this.logger.info({
      msg: 'Starting price file update monitoring',
    });

    try {
      const db = this.databaseService.db;

      // Get hospitals with price transparency files
      const hospitalsWithFiles = await db
        .select({
          id: hospitals.id,
          externalId: hospitals.externalId,
          name: hospitals.name,
          priceTransparencyFiles: hospitals.priceTransparencyFiles,
          lastFileCheck: hospitals.lastFileCheck,
        })
        .from(hospitals)
        .where(
          and(
            eq(hospitals.isActive, true),
            isNotNull(hospitals.priceTransparencyFiles),
          ),
        );

      let queuedJobs = 0;

      for (const hospital of hospitalsWithFiles) {
        try {
          const files = JSON.parse(hospital.priceTransparencyFiles || '[]');
          
          for (const file of files) {
            // Check if file needs processing
            const shouldProcess = await this.shouldProcessFile(
              hospital.id,
              file.fileid,
              file.retrieved,
              hospital.lastFileCheck,
            );

            if (shouldProcess) {
              await this.queueFileDownload(hospital, file);
              queuedJobs++;

              // Add delay between jobs to avoid overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          this.logger.warn({
            msg: 'Failed to process hospital files',
            hospitalId: hospital.id,
            hospitalName: hospital.name,
            error: error.message,
          });
        }
      }

      this.logger.info({
        msg: 'Price file monitoring completed',
        hospitalsChecked: hospitalsWithFiles.length,
        jobsQueued: queuedJobs,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Price file monitoring failed',
        error: error.message,
      });
    }
  }

  /**
   * Weekly full refresh - runs every Sunday at 1 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduleWeeklyFullRefresh(): Promise<void> {
    this.logger.info({
      msg: 'Starting weekly full hospital refresh',
    });

    try {
      await this.hospitalImportQueue.add(
        'weekly-full-refresh',
        {
          forceRefresh: true,
          batchSize: 25, // Smaller batches for full refresh
        },
        {
          priority: 5,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 120000, // 2 minutes
          },
        },
      );

      this.logger.info({
        msg: 'Weekly full refresh job queued successfully',
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to queue weekly full refresh',
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for hospital import by state
   */
  async triggerHospitalImportByState(state: string, forceRefresh = false): Promise<void> {
    this.logger.info({
      msg: 'Triggering manual hospital import by state',
      state,
      forceRefresh,
    });

    try {
      await this.hospitalImportQueue.add(
        `manual-import-${state}`,
        {
          state,
          forceRefresh,
          batchSize: 50,
        },
        {
          priority: 20, // High priority for manual triggers
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000, // 30 seconds
          },
        },
      );

      this.logger.info({
        msg: 'Manual hospital import job queued successfully',
        state,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to queue manual hospital import',
        state,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Manual trigger for price file download
   */
  async triggerPriceFileDownload(
    hospitalId: string,
    fileId: string,
    forceReprocess = false,
  ): Promise<void> {
    this.logger.info({
      msg: 'Triggering manual price file download',
      hospitalId,
      fileId,
      forceReprocess,
    });

    try {
      const db = this.databaseService.db;
      
      // Get hospital and file info
      const hospital = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      if (hospital.length === 0) {
        throw new Error(`Hospital not found: ${hospitalId}`);
      }

      const files = JSON.parse(hospital[0].priceTransparencyFiles || '[]');
      const file = files.find((f: any) => f.fileid === fileId);

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      await this.queueFileDownload(hospital[0], file, forceReprocess);

      this.logger.info({
        msg: 'Manual price file download job queued successfully',
        hospitalId,
        fileId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to queue manual price file download',
        hospitalId,
        fileId,
        error: error.message,
      });
      throw error;
    }
  }

  private async shouldProcessFile(
    hospitalId: string,
    fileId: string,
    retrieved: string,
    lastFileCheck: Date | null,
  ): Promise<boolean> {
    const db = this.databaseService.db;

    // Check if file has been processed
    const existingFile = await db
      .select()
      .from(priceTransparencyFiles)
      .where(
        and(
          eq(priceTransparencyFiles.hospitalId, hospitalId),
          eq(priceTransparencyFiles.externalFileId, fileId),
        ),
      )
      .limit(1);

    if (existingFile.length === 0) {
      // New file, should process
      return true;
    }

    const processedFile = existingFile[0];
    const fileRetrievedDate = new Date(retrieved);
    
    // Check if file has been updated since last processing
    if (processedFile.lastRetrieved && fileRetrievedDate > processedFile.lastRetrieved) {
      return true;
    }

    // Check if it's been more than 7 days since last check
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (!lastFileCheck || lastFileCheck < sevenDaysAgo) {
      return true;
    }

    return false;
  }

  private async queueFileDownload(
    hospital: any,
    file: any,
    forceReprocess = false,
  ): Promise<void> {
    const jobData: PriceFileDownloadJobData = {
      hospitalId: hospital.id,
      fileId: file.fileid,
      fileUrl: file.url,
      filename: file.filename,
      filesuffix: file.filesuffix,
      size: file.size,
      retrieved: file.retrieved,
      forceReprocess,
    };

    await this.priceFileDownloadQueue.add(
      `download-${hospital.id}-${file.fileid}`,
      jobData,
      {
        priority: forceReprocess ? 15 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        },
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
      },
    );

    this.logger.info({
      msg: 'Price file download job queued',
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      fileId: file.fileid,
      filename: file.filename,
      forceReprocess,
    });
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<any> {
    const db = this.databaseService.db;

    const [
      totalHospitals,
      hospitalsWithFiles,
      totalFiles,
      processedFiles,
      recentlyProcessed,
    ] = await Promise.all([
      db.select({ count: hospitals.id }).from(hospitals).where(eq(hospitals.isActive, true)),
      db.select({ count: hospitals.id }).from(hospitals).where(
        and(
          eq(hospitals.isActive, true),
          isNotNull(hospitals.priceTransparencyFiles),
        ),
      ),
      db.select({ count: priceTransparencyFiles.id }).from(priceTransparencyFiles),
      db.select({ count: priceTransparencyFiles.id }).from(priceTransparencyFiles).where(
        isNotNull(priceTransparencyFiles.processedAt),
      ),
      db.select({ count: priceTransparencyFiles.id }).from(priceTransparencyFiles).where(
        and(
          isNotNull(priceTransparencyFiles.processedAt),
          gte(priceTransparencyFiles.processedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      ),
    ]);

    return {
      totalHospitals: totalHospitals.length,
      hospitalsWithFiles: hospitalsWithFiles.length,
      totalFiles: totalFiles.length,
      processedFiles: processedFiles.length,
      recentlyProcessed: recentlyProcessed.length,
      processingRate: totalFiles.length > 0 ? (processedFiles.length / totalFiles.length) * 100 : 0,
    };
  }
}
