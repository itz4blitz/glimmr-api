import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { QUEUE_NAMES } from './queues/queue.config';

// Type definitions for job data (processors removed)
export interface HospitalImportJobData {
  state?: string;
  forceRefresh?: boolean;
  batchSize?: number;
}

export interface PriceFileDownloadJobData {
  hospitalId: string;
  fileId: string;
  fileUrl: string;
  filename: string;
  filesuffix: string;
  size: string;
  retrieved: string;
  forceReprocess?: boolean;
}

export interface AnalyticsRefreshJobData {
  metricTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  forceRefresh?: boolean;
  reportingPeriod?: string;
  batchSize?: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DATA_VALIDATION)
    private readonly dataValidationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportDataQueue: Queue,
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
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.DATA_VALIDATION, queue: this.dataValidationQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportDataQueue },
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
    this.logger.warn({
      msg: 'Hospital import processor not implemented',
      importData,
    });

    return {
      jobId: null,
      status: 'not_implemented',
      message: 'Hospital import functionality is not currently implemented',
      estimatedDuration: 'N/A',
      priority: importData.priority ?? 5,
      data: importData,
      createdAt: new Date().toISOString(),
      trackingUrl: null,
    };
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
    this.logger.warn({
      msg: 'Price file download processor not implemented',
      downloadData,
    });

    return {
      jobId: null,
      status: 'not_implemented',
      message: 'Price file download functionality is not currently implemented',
      estimatedDuration: 'N/A',
      priority: downloadData.priority ?? 5,
      data: downloadData,
      createdAt: new Date().toISOString(),
      trackingUrl: null,
    };
  }

  /**
   * Trigger analytics refresh job (enhanced version)
   */
  async triggerAnalyticsRefresh(options: {
    metricTypes?: string[];
    forceRefresh?: boolean;
    reportingPeriod?: string;
    batchSize?: number;
    priority?: number;
  } = {}) {
    this.logger.warn({
      msg: 'Analytics refresh processor not implemented',
      options,
    });

    return {
      id: null,
      jobId: null,
      status: 'not_implemented',
      message: 'Analytics refresh functionality is not currently implemented',
      estimatedDuration: 'N/A',
      priority: options.priority || 3,
      data: options,
      createdAt: new Date().toISOString(),
      trackingUrl: null,
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  async startAnalyticsRefresh(refreshData: {
    metricTypes?: string[];
    forceRefresh?: boolean;
    batchSize?: number;
    priority?: number;
  }) {
    return this.triggerAnalyticsRefresh(refreshData);
  }

  async getDetailedQueueStats() {
    const allQueues = this.getAllQueues();
    const detailedStats = [];

    for (const { name, queue } of allQueues) {
      try {
        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
          queue.isPaused(),
        ]);

        // Calculate processing rates (jobs per minute)
        const recentCompleted = completed.slice(0, 100); // Last 100 completed jobs
        let processingRate = 0;
        let avgProcessingTime = 0;

        if (recentCompleted.length > 0) {
          const now = Date.now();
          const oneHourAgo = now - (60 * 60 * 1000);
          const recentJobs = recentCompleted.filter(job => 
            job.finishedOn && job.finishedOn > oneHourAgo
          );

          if (recentJobs.length > 0) {
            processingRate = recentJobs.length / 60; // jobs per minute
            const totalProcessingTime = recentJobs.reduce((sum, job) => {
              return sum + (job.finishedOn - job.processedOn);
            }, 0);
            avgProcessingTime = totalProcessingTime / recentJobs.length;
          }
        }

        // Get latest job details
        const latestActive = active[0];
        const latestCompleted = completed[0];
        const latestFailed = failed[0];

        detailedStats.push({
          name,
          counts: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
          },
          status: {
            paused,
            healthy: failed.length < 10, // Consider unhealthy if too many failures
          },
          performance: {
            processingRate: Math.round(processingRate * 100) / 100,
            avgProcessingTime: Math.round(avgProcessingTime / 1000), // seconds
          },
          latestJobs: {
            active: latestActive ? {
              id: latestActive.id,
              name: latestActive.name,
              progress: latestActive.progress,
              startedAt: latestActive.processedOn ? new Date(latestActive.processedOn).toISOString() : null,
            } : null,
            completed: latestCompleted ? {
              id: latestCompleted.id,
              name: latestCompleted.name,
              finishedAt: latestCompleted.finishedOn ? new Date(latestCompleted.finishedOn).toISOString() : null,
              duration: latestCompleted.finishedOn && latestCompleted.processedOn ? 
                latestCompleted.finishedOn - latestCompleted.processedOn : null,
            } : null,
            failed: latestFailed ? {
              id: latestFailed.id,
              name: latestFailed.name,
              failedAt: latestFailed.finishedOn ? new Date(latestFailed.finishedOn).toISOString() : null,
              reason: latestFailed.failedReason,
            } : null,
          },
        });
      } catch (error) {
        this.logger.error({
          msg: 'Failed to get detailed stats for queue',
          queueName: name,
          error: error.message,
        });

        detailedStats.push({
          name,
          counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
          status: { paused: false, healthy: false },
          performance: { processingRate: 0, avgProcessingTime: 0 },
          latestJobs: { active: null, completed: null, failed: null },
          error: error.message,
        });
      }
    }

    return {
      queues: detailedStats,
      summary: {
        totalQueues: detailedStats.length,
        healthyQueues: detailedStats.filter(q => q.status.healthy).length,
        pausedQueues: detailedStats.filter(q => q.status.paused).length,
        totalJobs: detailedStats.reduce((sum, q) => 
          sum + q.counts.waiting + q.counts.active + q.counts.completed + q.counts.failed, 0
        ),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getQueuePerformanceMetrics(queueName: string) {
    const queueInfo = this.getAllQueues().find(q => q.name === queueName);
    if (!queueInfo) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const { queue } = queueInfo;

    try {
      const [completed, failed] = await Promise.all([
        queue.getCompleted(0, 200), // Last 200 completed jobs
        queue.getFailed(0, 50),     // Last 50 failed jobs
      ]);

      // Calculate performance metrics
      const now = Date.now();
      const timeRanges = {
        '1h': now - (60 * 60 * 1000),
        '6h': now - (6 * 60 * 60 * 1000),
        '24h': now - (24 * 60 * 60 * 1000),
      };

      const metrics = {};
      
      for (const [range, cutoff] of Object.entries(timeRanges)) {
        const rangeCompleted = completed.filter(job => job.finishedOn && job.finishedOn > cutoff);
        const rangeFailed = failed.filter(job => job.finishedOn && job.finishedOn > cutoff);

        const totalJobs = rangeCompleted.length + rangeFailed.length;
        const successRate = totalJobs > 0 ? (rangeCompleted.length / totalJobs) * 100 : 0;

        const processingTimes = rangeCompleted
          .filter(job => job.processedOn && job.finishedOn)
          .map(job => job.finishedOn - job.processedOn);

        const avgProcessingTime = processingTimes.length > 0 ? 
          processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0;

        const minProcessingTime = processingTimes.length > 0 ? Math.min(...processingTimes) : 0;
        const maxProcessingTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0;

        metrics[range] = {
          totalJobs,
          completed: rangeCompleted.length,
          failed: rangeFailed.length,
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTime: Math.round(avgProcessingTime / 1000), // seconds
          minProcessingTime: Math.round(minProcessingTime / 1000),
          maxProcessingTime: Math.round(maxProcessingTime / 1000),
          throughput: Math.round((totalJobs / (range === '1h' ? 1 : range === '6h' ? 6 : 24)) * 100) / 100, // jobs/hour
        };
      }

      // Error analysis
      const errorAnalysis = failed.reduce((acc, job) => {
        const reason = job.failedReason || 'Unknown error';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});

      return {
        queueName,
        metrics,
        errorAnalysis,
        recentTrends: {
          last10Completed: completed.slice(0, 10).map(job => ({
            id: job.id,
            duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
            finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          })),
          last10Failed: failed.slice(0, 10).map(job => ({
            id: job.id,
            reason: job.failedReason,
            failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          })),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to get queue performance metrics',
        queueName,
        error: error.message,
      });
      throw error;
    }
  }

  async getQueueHealth() {
    const allQueues = this.getAllQueues();
    const healthChecks = [];

    for (const { name, queue } of allQueues) {
      try {
        const [waiting, active, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getFailed(),
        ]);

        // Health criteria
        const tooManyWaiting = waiting.length > 100;
        const tooManyFailed = failed.length > 20;
        const stuckJobs = active.some(job => {
          const startTime = job.processedOn;
          return startTime && (Date.now() - startTime) > (30 * 60 * 1000); // 30 minutes
        });

        const issues = [];
        if (tooManyWaiting) issues.push('High queue backlog');
        if (tooManyFailed) issues.push('High failure rate');
        if (stuckJobs) issues.push('Potentially stuck jobs');

        const isHealthy = issues.length === 0;

        healthChecks.push({
          name,
          status: isHealthy ? 'healthy' : 'warning',
          issues,
          metrics: {
            waitingCount: waiting.length,
            activeCount: active.length,
            failedCount: failed.length,
          },
        });
      } catch (error) {
        healthChecks.push({
          name,
          status: 'error',
          issues: [`Connection error: ${error.message}`],
          metrics: null,
        });
      }
    }

    const overallStatus = healthChecks.every(check => check.status === 'healthy') ? 'healthy' :
                         healthChecks.some(check => check.status === 'error') ? 'error' : 'warning';

    return {
      overallStatus,
      queues: healthChecks,
      summary: {
        total: healthChecks.length,
        healthy: healthChecks.filter(q => q.status === 'healthy').length,
        warning: healthChecks.filter(q => q.status === 'warning').length,
        error: healthChecks.filter(q => q.status === 'error').length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getQueueTrends(hours: number = 24) {
    const allQueues = this.getAllQueues();
    const trends = [];

    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const bucketSize = Math.max(1, Math.floor(hours / 24)) * 60 * 60 * 1000; // Hour buckets, minimum 1 hour

    for (const { name, queue } of allQueues) {
      try {
        const [completed, failed] = await Promise.all([
          queue.getCompleted(0, 500), // More data for trends
          queue.getFailed(0, 100),
        ]);

        // Filter jobs within time range
        const recentCompleted = completed.filter(job => job.finishedOn && job.finishedOn > cutoffTime);
        const recentFailed = failed.filter(job => job.finishedOn && job.finishedOn > cutoffTime);

        // Create time buckets
        const buckets = new Map();
        const now = Date.now();
        
        for (let time = cutoffTime; time < now; time += bucketSize) {
          const bucketKey = new Date(time).toISOString().substring(0, 13) + ':00:00.000Z'; // Hour precision
          buckets.set(bucketKey, { completed: 0, failed: 0, avgDuration: 0, durations: [] });
        }

        // Fill buckets with data
        recentCompleted.forEach(job => {
          const bucketTime = new Date(Math.floor(job.finishedOn / bucketSize) * bucketSize).toISOString().substring(0, 13) + ':00:00.000Z';
          const bucket = buckets.get(bucketTime);
          if (bucket) {
            bucket.completed++;
            if (job.processedOn && job.finishedOn) {
              bucket.durations.push(job.finishedOn - job.processedOn);
            }
          }
        });

        recentFailed.forEach(job => {
          const bucketTime = new Date(Math.floor(job.finishedOn / bucketSize) * bucketSize).toISOString().substring(0, 13) + ':00:00.000Z';
          const bucket = buckets.get(bucketTime);
          if (bucket) {
            bucket.failed++;
          }
        });

        // Calculate average durations for each bucket
        buckets.forEach(bucket => {
          if (bucket.durations.length > 0) {
            bucket.avgDuration = Math.round(
              bucket.durations.reduce((sum, duration) => sum + duration, 0) / bucket.durations.length / 1000
            ); // seconds
          }
          delete bucket.durations; // Clean up
        });

        const trendData = Array.from(buckets.entries()).map(([time, data]) => ({
          timestamp: time,
          ...data,
          total: data.completed + data.failed,
          successRate: data.completed + data.failed > 0 ? 
            Math.round((data.completed / (data.completed + data.failed)) * 10000) / 100 : 100,
        }));

        trends.push({
          queueName: name,
          data: trendData,
          summary: {
            totalCompleted: recentCompleted.length,
            totalFailed: recentFailed.length,
            avgSuccessRate: trendData.length > 0 ? 
              Math.round(trendData.reduce((sum, bucket) => sum + bucket.successRate, 0) / trendData.length * 100) / 100 : 0,
          },
        });
      } catch (error) {
        this.logger.error({
          msg: 'Failed to get queue trends',
          queueName: name,
          error: error.message,
        });

        trends.push({
          queueName: name,
          data: [],
          summary: { totalCompleted: 0, totalFailed: 0, avgSuccessRate: 0 },
          error: error.message,
        });
      }
    }

    return {
      timeRange: `${hours} hours`,
      bucketSize: `${bucketSize / (60 * 60 * 1000)} hour(s)`,
      trends,
      timestamp: new Date().toISOString(),
    };
  }
}
