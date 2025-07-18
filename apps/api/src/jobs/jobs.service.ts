import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { QUEUE_NAMES } from './queues/queue.config.js';
import { HospitalImportJobData } from './processors/hospital-import.processor.js';
import { PriceFileDownloadJobData } from './processors/price-file-download.processor.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUE_NAMES.HOSPITAL_IMPORT)
    private readonly hospitalImportQueue: Queue<HospitalImportJobData>,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_DOWNLOAD)
    private readonly priceFileDownloadQueue: Queue<PriceFileDownloadJobData>,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly analyticsRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DATA_VALIDATION)
    private readonly dataValidationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportDataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN)
    private readonly praUnifiedScanQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly praFileDownloadQueue: Queue,
    @InjectPinoLogger(JobsService.name)
    private readonly logger: PinoLogger,
  ) {}
  async getJobs(filters: {
    status?: string;
    type?: string;
    limit?: number;
  }) {
    const limit = filters.limit || 50;
    const allQueues = this.getAllQueues();
    const jobs: any[] = [];

    for (const { name, queue } of allQueues) {
      if (filters.type && filters.type !== name) continue;

      try {
        const queueJobs = await this.getJobsFromQueue(queue, filters.status, limit);
        const formattedJobs = await this.formatJobs(queueJobs, name);
        jobs.push(...formattedJobs);
      } catch (error) {
        this.logger.error({
          msg: 'Failed to get jobs from queue',
          queueName: name,
          error: error.message,
        });
      }
    }

    // Sort by creation time (newest first)
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      data: jobs.slice(0, limit),
      total: jobs.length,
      limit,
      filters,
    };
  }

  private getAllQueues() {
    return [
      { name: QUEUE_NAMES.HOSPITAL_IMPORT, queue: this.hospitalImportQueue },
      { name: QUEUE_NAMES.PRICE_FILE_DOWNLOAD, queue: this.priceFileDownloadQueue },
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH, queue: this.analyticsRefreshQueue },
      { name: QUEUE_NAMES.DATA_VALIDATION, queue: this.dataValidationQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportDataQueue },
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN, queue: this.praUnifiedScanQueue },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD, queue: this.praFileDownloadQueue },
    ];
  }

  private async getJobsFromQueue(queue: Queue, status?: string, limit: number = 50): Promise<Job[]> {
    const queueJobs: Job[] = [];

    if (!status || status === 'waiting') {
      const waitingJobs = await queue.getWaiting(0, limit);
      queueJobs.push(...waitingJobs);
    }

    if (!status || status === 'active') {
      const activeJobs = await queue.getActive(0, limit);
      queueJobs.push(...activeJobs);
    }

    if (!status || status === 'completed') {
      const completedJobs = await queue.getCompleted(0, limit);
      queueJobs.push(...completedJobs);
    }

    if (!status || status === 'failed') {
      const failedJobs = await queue.getFailed(0, limit);
      queueJobs.push(...failedJobs);
    }

    return queueJobs;
  }

  private async formatJobs(jobs: Job[], queueName: string): Promise<any[]> {
    const formattedJobs = [];

    for (const job of jobs) {
      formattedJobs.push({
        id: job.id,
        name: job.name,
        queueName,
        status: await job.getState(),
        progress: job.progress,
        data: job.data,
        opts: job.opts,
        createdAt: new Date(job.timestamp).toISOString(),
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        delay: job.delay,
      });
    }

    return formattedJobs;
  }

  async getJobStats() {
    const allQueues = this.getAllQueues();

    const queueStats = [];
    let totalJobs = 0;
    let activeJobs = 0;
    let completedJobs = 0;
    let failedJobs = 0;

    for (const { name, queue } of allQueues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
        ]);

        const queueStat = {
          name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused(),
        };

        queueStats.push(queueStat);

        totalJobs += queueStat.waiting + queueStat.active + queueStat.completed + queueStat.failed;
        activeJobs += queueStat.active;
        completedJobs += queueStat.completed;
        failedJobs += queueStat.failed;
      } catch (error) {
        this.logger.error({
          msg: 'Failed to get queue stats',
          queueName: name,
          error: error.message,
        });

        queueStats.push({
          name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          error: error.message,
        });
      }
    }

    const successRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0;

    return {
      queues: queueStats,
      overall: {
        totalJobs,
        activeJobs,
        completedJobs,
        failedJobs,
        successRate: parseFloat(successRate as string),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getBullBoardInfo() {
    return {
      dashboardUrl: '/admin/queues',
      description: 'Bull Board dashboard for monitoring job queues',
      features: [
        'Real-time job monitoring',
        'Queue management',
        'Job retry and cleanup',
        'Performance metrics',
        'Failed job analysis',
      ],
      authentication: 'Admin access required',
      documentation: 'https://api.glimmr.health/docs#bull-board',
    };
  }

  async startHospitalImport(importData: {
    state?: string;
    forceRefresh?: boolean;
    batchSize?: number;
    priority?: number;
  }) {
    this.logger.info({
      msg: 'Starting hospital import job',
      importData,
    });

    try {
      const jobData: HospitalImportJobData = {
        state: importData.state,
        forceRefresh: importData.forceRefresh ?? false,
        batchSize: importData.batchSize ?? 50,
      };

      const job = await this.hospitalImportQueue.add(
        'hospital-import',
        jobData,
        {
          priority: importData.priority ?? 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Hospital import job has been queued successfully',
        estimatedDuration: importData.state ? '5-15 minutes' : '30-60 minutes',
        priority: importData.priority ?? 5,
        data: jobData,
        createdAt: new Date().toISOString(),
        trackingUrl: `/jobs/${job.id}`,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to start hospital import job',
        importData,
        error: error.message,
      });
      throw error;
    }
  }

  async startPriceUpdate(updateData: {
    hospitalId?: string;
    updateType?: 'incremental' | 'full';
    priority?: number;
  }) {
    this.logger.info({
      msg: 'Starting price update job',
      updateData,
    });

    try {
      const jobData = {
        hospitalId: updateData.hospitalId,
        updateType: updateData.updateType ?? 'incremental',
      };

      const job = await this.priceUpdateQueue.add(
        'price-update',
        jobData,
        {
          priority: updateData.priority ?? 5,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Price update job has been queued successfully',
        estimatedDuration: updateData.hospitalId ? '5-15 minutes' : '30-90 minutes',
        priority: updateData.priority ?? 5,
        data: jobData,
        createdAt: new Date().toISOString(),
        trackingUrl: `/jobs/${job.id}`,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to start price update job',
        updateData,
        error: error.message,
      });
      throw error;
    }
  }

  async getJobById(id: string) {
    const allQueues = this.getAllQueues();

    for (const { name, queue } of allQueues) {
      try {
        const job = await queue.getJob(id);
        if (job) {
          const state = await job.getState();
          const logs = job.logs ?? [];

          return {
            id: job.id,
            name: job.name,
            queueName: name,
            status: state,
            progress: job.progress,
            data: job.data,
            opts: job.opts,
            logs: logs.map((log: any) => {
              if (typeof log === 'string') {
                return {
                  timestamp: new Date().toISOString(),
                  level: 'info',
                  message: log,
                };
              }
              return log;
            }),
            createdAt: new Date(job.timestamp).toISOString(),
            processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
            finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
            duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
            returnvalue: job.returnvalue,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            delay: job.delay,
            stacktrace: job.stacktrace,
          };
        }
      } catch (error) {
        this.logger.error({
          msg: 'Failed to get job from queue',
          queueName: name,
          jobId: id,
          error: error.message,
        });
      }
    }

    throw new Error(`Job with ID ${id} not found`);
  }

  /**
   * Add a new method to queue price file downloads
   */
  async startPriceFileDownload(downloadData: {
    hospitalId: string;
    fileId: string;
    fileUrl: string;
    filename: string;
    filesuffix: string;
    size: string;
    retrieved: string;
    forceReprocess?: boolean;
    priority?: number;
  }) {
    this.logger.info({
      msg: 'Starting price file download job',
      downloadData,
    });

    try {
      const jobData: PriceFileDownloadJobData = {
        hospitalId: downloadData.hospitalId,
        fileId: downloadData.fileId,
        fileUrl: downloadData.fileUrl,
        filename: downloadData.filename,
        filesuffix: downloadData.filesuffix,
        size: downloadData.size,
        retrieved: downloadData.retrieved,
        forceReprocess: downloadData.forceReprocess ?? false,
      };

      const job = await this.priceFileDownloadQueue.add(
        `download-${downloadData.hospitalId}-${downloadData.fileId}`,
        jobData,
        {
          priority: downloadData.priority ?? 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Price file download job has been queued successfully',
        estimatedDuration: '5-30 minutes',
        priority: downloadData.priority ?? 5,
        data: jobData,
        createdAt: new Date().toISOString(),
        trackingUrl: `/jobs/${job.id}`,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to start price file download job',
        downloadData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Trigger analytics refresh job
   */
  async triggerAnalyticsRefresh(options: {
    metricTypes?: string[];
    forceRefresh?: boolean;
    reportingPeriod?: string;
  } = {}) {
    this.logger.info({
      msg: 'Starting analytics refresh job',
      options,
    });

    try {
      const jobData = {
        metricTypes: options.metricTypes || ['all'],
        forceRefresh: options.forceRefresh || false,
        reportingPeriod: options.reportingPeriod || 'monthly',
      };

      const job = await this.analyticsRefreshQueue.add(
        `analytics-refresh-${Date.now()}`,
        jobData,
        {
          priority: 3,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
          removeOnComplete: 3,
          removeOnFail: 5,
        },
      );

      return {
        id: job.id,
        status: 'queued',
        message: 'Analytics refresh job has been queued successfully',
        estimatedDuration: '2-10 minutes',
        data: jobData,
        createdAt: new Date().toISOString(),
        trackingUrl: `/jobs/${job.id}`,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to start analytics refresh job',
        options,
        error: error.message,
      });
      throw error;
    }
  }
}
