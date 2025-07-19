import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { QUEUE_NAMES } from '../queues/queue.config';
import { PRAUnifiedScanJobData } from '../processors/pra-unified-scanner.processor';

@Injectable()
export class PRAPipelineService {
  constructor(
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN)
    private readonly unifiedScanQueue: Queue,
    @InjectPinoLogger(PRAPipelineService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Twice daily PRA scan - runs at 6 AM and 6 PM every day
   * Scans all states, detects changes, and queues file downloads
   */
  @Cron('0 6,18 * * *')
  async scheduleTwiceDailyPRAScan() {
    this.logger.info('Scheduling twice daily PRA unified scan');

    try {
      const jobData: PRAUnifiedScanJobData = {
        forceRefresh: false,
        testMode: false,
      };

      await this.unifiedScanQueue.add(
        'scheduled-pra-scan',
        jobData,
        {
          priority: 5,
          removeOnComplete: 3,
          removeOnFail: 10,
        }
      );

      this.logger.info('Twice daily PRA unified scan scheduled successfully');
    } catch (error) {
      this.logger.error({
        error: error.message,
      }, 'Failed to schedule twice daily PRA unified scan');
    }
  }

  /**
   * Manual PRA scan trigger
   */
  async triggerManualPRAScan(testMode = false, forceRefresh = false) {
    this.logger.info({
      testMode,
      forceRefresh,
    }, 'Triggering manual PRA unified scan');

    try {
      const jobData: PRAUnifiedScanJobData = {
        forceRefresh,
        testMode,
      };

      const job = await this.unifiedScanQueue.add(
        'manual-pra-scan',
        jobData,
        {
          priority: 8,
          removeOnComplete: 5,
          removeOnFail: 10,
        }
      );

      this.logger.info({
        jobId: job.id,
        testMode,
        forceRefresh,
      }, 'Manual PRA unified scan queued successfully');

      return { jobId: job.id, testMode, forceRefresh };
    } catch (error) {
      this.logger.error({
        testMode,
        forceRefresh,
        error: error.message,
      }, 'Failed to trigger manual PRA unified scan');
      throw error;
    }
  }

  async getPipelineStatus() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.unifiedScanQueue.getWaiting(),
        this.unifiedScanQueue.getActive(),
        this.unifiedScanQueue.getCompleted(),
        this.unifiedScanQueue.getFailed(),
        this.unifiedScanQueue.getDelayed(),
      ]);

      return {
        queue: 'pra-unified-scan',
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: await this.unifiedScanQueue.isPaused(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        error: error.message,
      }, 'Failed to get PRA pipeline status');
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldJobs() {
    this.logger.info('Starting PRA pipeline job cleanup');

    try {
      await this.unifiedScanQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
      await this.unifiedScanQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');

      this.logger.info('PRA pipeline job cleanup completed successfully');
    } catch (error) {
      this.logger.error({
        error: error.message,
      }, 'Failed to cleanup PRA pipeline jobs');
    }
  }

  async triggerFullPipelineRefresh() {
    return this.triggerManualPRAScan(false, true);
  }

  async triggerHospitalDiscoveryForState(state: string, forceRefresh = false) {
    return this.triggerManualPRAScan(true, forceRefresh);
  }

  async triggerFileChangeDetectionForHospital(hospitalId: string) {
    return this.triggerManualPRAScan(true, false);
  }
}