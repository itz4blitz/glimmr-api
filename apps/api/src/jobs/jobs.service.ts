import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { QUEUE_NAMES } from './queues/queue.config';
import { DatabaseService } from '../database/database.service';
import { jobs, jobLogs, jobQueueConfigs, jobSchedules, jobTemplates } from '../database/schema';
import { eq, sql, desc, and, or, inArray, asc } from 'drizzle-orm';

// Type definitions for job data (processors removed)
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
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly priceFileParserQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportDataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly analyticsRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN)
    private readonly praUnifiedScanQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly praFileDownloadQueue: Queue,
    @InjectPinoLogger(JobsService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
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
      { name: QUEUE_NAMES.PRICE_FILE_PARSER, queue: this.priceFileParserQueue },
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportDataQueue },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH, queue: this.analyticsRefreshQueue },
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN, queue: this.praUnifiedScanQueue },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD, queue: this.praFileDownloadQueue },
    ];
  }

  getQueueByName(queueName: string) {
    const queueInfo = this.getAllQueues().find(q => q.name === queueName);
    return queueInfo?.queue || null;
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

        // Calculate real processing metrics from recent jobs
        let processingRate = 0;
        let avgProcessingTime = 0;
        let lastProcessed = null;

        if (completed.length > 0) {
          // Get jobs from last hour
          const now = Date.now();
          const oneHourAgo = now - (60 * 60 * 1000);
          const recentJobs = completed.slice(0, 100).filter(job => 
            job.finishedOn && job.finishedOn > oneHourAgo
          );

          if (recentJobs.length > 0) {
            // Jobs per minute in the last hour
            processingRate = recentJobs.length / 60;
            
            // Average processing time
            const processingTimes = recentJobs
              .filter(job => job.processedOn && job.finishedOn)
              .map(job => job.finishedOn - job.processedOn);
            
            if (processingTimes.length > 0) {
              avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
            }
          }

          // Get last processed time from most recent completed job
          if (completed[0] && completed[0].finishedOn) {
            lastProcessed = new Date(completed[0].finishedOn).toISOString();
          }
        }

        const queueStat = {
          name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused(),
          processingRate: Math.round(processingRate * 100) / 100, // Round to 2 decimals
          avgProcessingTime: Math.round(avgProcessingTime), // Round to nearest ms
          lastProcessed,
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
          processingRate: 0,
          avgProcessingTime: 0,
          lastProcessed: null,
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

  async startDataExport(data: any) {
    const job = await this.exportDataQueue.add('export-data', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { jobId: job.id, status: 'queued' };
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

  async getCurrentJobs(queueName: string) {
    const queueInfo = this.getAllQueues().find(q => q.name === queueName);
    if (!queueInfo) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    try {
      const { queue } = queueInfo;
      const [waiting, active] = await Promise.all([
        queue.getWaiting(0, 50),
        queue.getActive(0, 50),
      ]);

      const currentJobs = await Promise.all([...waiting, ...active].map(async job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress || 0,
        attempts: job.attemptsMade,
        timestamp: new Date(job.timestamp).toISOString(),
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
        state: await job.getState(),
      })));

      return {
        jobs: currentJobs,
        total: currentJobs.length,
        queueName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to get current jobs',
        queueName,
        error: error.message,
      });
      throw error;
    }
  }

  async getQueueHistory(queueName: string, options: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  } = {}) {
    const { limit = 50, offset = 0, status, search } = options;

    // Mock data for now - replace with database implementation later
    const mockJobs = [
      {
        id: '1',
        jobType: queueName,
        jobName: `${queueName}-job-1`,
        description: `Sample job for ${queueName}`,
        status: 'completed',
        priority: 5,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 3500000).toISOString(),
        completedAt: new Date(Date.now() - 3400000).toISOString(),
        duration: 100000,
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
      },
      {
        id: '2',
        jobType: queueName,
        jobName: `${queueName}-job-2`,
        description: `Another sample job for ${queueName}`,
        status: 'failed',
        priority: 3,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        startedAt: new Date(Date.now() - 7100000).toISOString(),
        completedAt: new Date(Date.now() - 7000000).toISOString(),
        duration: 50000,
        totalExecutions: 1,
        successfulExecutions: 0,
        failedExecutions: 1,
      },
    ];

    // Apply filters
    let filteredJobs = mockJobs;
    if (status) {
      filteredJobs = filteredJobs.filter(job => job.status === status);
    }
    if (search) {
      filteredJobs = filteredJobs.filter(job =>
        job.jobName.toLowerCase().includes(search.toLowerCase()) ||
        job.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    return {
      jobs: filteredJobs.slice(offset, offset + limit),
      total: filteredJobs.length,
      limit,
      offset,
      filters: { status, search },
      timestamp: new Date().toISOString(),
    };
  }

  async getJobDetails(jobId: string) {
    // Mock data for now - replace with database implementation later
    const mockJob = {
      id: jobId,
      jobType: 'price-file-download',
      jobName: `job-${jobId}`,
      description: 'Sample job details',
      status: 'completed',
      priority: 5,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3500000).toISOString(),
      completedAt: new Date(Date.now() - 3400000).toISOString(),
      duration: 100000,
      totalExecutions: 1,
      successfulExecutions: 1,
      failedExecutions: 0,
      inputData: { hospitalId: '123', fileUrl: 'https://example.com/file.csv' },
      outputData: { recordsProcessed: 1000, recordsCreated: 950 },
      tags: ['production', 'automated'],
    };

    return mockJob;
  }

  async getQueueConfigs() {
    const configs = await this.databaseService.db
      .select()
      .from(jobQueueConfigs)
      .orderBy(jobQueueConfigs.queueName);

    // Merge with real-time queue status
    const queues = this.getAllQueues();
    const enrichedConfigs = await Promise.all(
      configs.map(async (config) => {
        const queueInfo = queues.find(q => q.name === config.queueName);
        if (!queueInfo) return config;
        const queue = queueInfo.queue;

        const counts = await queue.getJobCounts();
        const isPaused = await queue.isPaused();

        return {
          ...config,
          status: {
            isPaused,
            counts,
            lastActivity: new Date(),
          },
        };
      })
    );

    return enrichedConfigs;
  }

  async getQueueConfig(queueName: string) {
    const [config] = await this.databaseService.db
      .select()
      .from(jobQueueConfigs)
      .where(eq(jobQueueConfigs.queueName, queueName))
      .limit(1);

    if (!config) {
      throw new Error(`Queue configuration not found for: ${queueName}`);
    }

    const queueInfo = this.getAllQueues().find(q => q.name === queueName);
    if (queueInfo) {
      const queue = queueInfo.queue;
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();

      return {
        ...config,
        status: {
          isPaused,
          counts,
          lastActivity: new Date(),
        },
      };
    }

    return config;
  }

  async updateQueueConfig(queueName: string, updates: any) {
    const { concurrency, maxJobsPerWorker, defaultJobOptions, ...dbUpdates } = updates;

    // Update database config
    const [updated] = await this.databaseService.db
      .update(jobQueueConfigs)
      .set({
        ...dbUpdates,
        maxConcurrency: concurrency || dbUpdates.maxConcurrency,
        defaultJobOptions: defaultJobOptions || dbUpdates.defaultJobOptions,
        lastConfigUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobQueueConfigs.queueName, queueName))
      .returning();

    if (!updated) {
      throw new Error(`Queue configuration not found for: ${queueName}`);
    }

    // Note: Runtime queue configuration updates would require worker restart
    // to take effect. This is just updating the database configuration.

    return updated;
  }

  async getJobLogs(queueName: string, options: { limit?: number; jobId?: string } = {}) {
    const { limit = 50, jobId } = options;

    const conditions = [];
    if (jobId) {
      conditions.push(eq(jobLogs.jobId, jobId));
    }

    // Get logs with job info
    const logs = await this.databaseService.db
      .select({
        id: jobLogs.id,
        jobId: jobLogs.jobId,
        level: jobLogs.level,
        message: jobLogs.message,
        data: jobLogs.data,
        createdAt: jobLogs.createdAt,
      })
      .from(jobLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobLogs.createdAt))
      .limit(limit);

    // Get queue-specific recent jobs if no jobId specified
    if (!jobId && queueName) {
      const queueInfo = this.getAllQueues().find(q => q.name === queueName);
      if (queueInfo) {
        const queue = queueInfo.queue;
        const jobs = await queue.getJobs(['completed', 'failed'], 0, limit - 1);
        const enrichedLogs = await Promise.all(
          jobs.map(async (job) => ({
            id: job.id,
            jobId: job.id,
            level: job.failedReason ? 'error' : 'info',
            message: job.failedReason || `Job ${job.name} completed`,
            data: {
              name: job.name,
              data: job.data,
              returnvalue: job.returnvalue,
              attemptsMade: job.attemptsMade,
              processedOn: job.processedOn,
              finishedOn: job.finishedOn,
            },
            createdAt: new Date(job.finishedOn || job.processedOn || Date.now()),
          }))
        );
        return enrichedLogs;
      }
    }

    return logs;
  }

  async getJobLogsById(jobId: string, options: {
    level?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { level, search, limit = 100, offset = 0 } = options;
    
    // Find the job across all queues
    let foundJob = null;
    let foundQueueName = null;
    
    for (const { name, queue } of this.getAllQueues()) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          foundJob = job;
          foundQueueName = name;
          break;
        }
      } catch (error) {
        // Job not found in this queue, continue
      }
    }
    
    if (!foundJob) {
      return {
        logs: [],
        total: 0,
        limit,
        offset,
        filters: { level, search },
        timestamp: new Date().toISOString(),
      };
    }
    
    // Create log entries based on job state
    const logs = [];
    let logId = 1;
    
    // Job created log
    logs.push({
      id: `log-${jobId}-${logId++}`,
      jobId: jobId,
      level: 'info',
      message: `[${foundJob.name}] Job created in queue ${foundQueueName}`,
      data: {
        jobData: foundJob.data,
        opts: foundJob.opts,
      },
      createdAt: new Date(foundJob.timestamp).toISOString(),
    });
    
    // Job started log
    if (foundJob.processedOn) {
      logs.push({
        id: `log-${jobId}-${logId++}`,
        jobId: jobId,
        level: 'info',
        message: `[${foundJob.name}] Job started processing`,
        data: {
          attemptNumber: foundJob.attemptsMade,
        },
        createdAt: new Date(foundJob.processedOn).toISOString(),
      });
    }
    
    // Progress logs
    if (foundJob.progress && typeof foundJob.progress === 'object') {
      logs.push({
        id: `log-${jobId}-${logId++}`,
        jobId: jobId,
        level: 'info',
        message: `[${foundJob.name}] Progress update: ${JSON.stringify(foundJob.progress)}`,
        data: foundJob.progress,
        createdAt: new Date(foundJob.processedOn || foundJob.timestamp).toISOString(),
      });
    }
    
    // Completion/failure logs
    if (foundJob.finishedOn) {
      if (foundJob.failedReason) {
        logs.push({
          id: `log-${jobId}-${logId++}`,
          jobId: jobId,
          level: 'error',
          message: `[${foundJob.name}] Job failed: ${foundJob.failedReason}`,
          data: {
            error: foundJob.failedReason,
            stacktrace: foundJob.stacktrace,
            attemptsMade: foundJob.attemptsMade,
          },
          createdAt: new Date(foundJob.finishedOn).toISOString(),
        });
      } else {
        logs.push({
          id: `log-${jobId}-${logId++}`,
          jobId: jobId,
          level: 'success',
          message: `[${foundJob.name}] Job completed successfully`,
          data: {
            returnvalue: foundJob.returnvalue,
            duration: foundJob.finishedOn - foundJob.processedOn,
          },
          createdAt: new Date(foundJob.finishedOn).toISOString(),
        });
      }
    }
    
    // Apply filters
    let filteredLogs = logs;
    
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    
    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      limit,
      offset,
      filters: { level, search },
      timestamp: new Date().toISOString(),
    };
  }

  async getAllLogs(options: {
    level?: string;
    search?: string;
    limit?: number;
    offset?: number;
    queue?: string;
    status?: string;
  } = {}) {
    const { level, search, limit = 100, offset = 0, queue: queueFilter, status: statusFilter } = options;
    
    try {
      const allLogs = [];

      // First, get historical logs from database
      const db = this.databaseService.db;
      
      // Build conditions for database query
      const conditions = [];
      if (level && level !== 'success') {
        conditions.push(eq(jobLogs.level, level));
      }
      if (search) {
        conditions.push(
          or(
            sql`${jobLogs.message} ILIKE ${`%${search}%`}`,
            sql`${jobLogs.data} ILIKE ${`%${search}%`}`
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get historical logs from database with job details
      const dbLogs = await db
        .select({
          id: jobLogs.id,
          jobId: jobLogs.jobId,
          level: jobLogs.level,
          message: jobLogs.message,
          data: jobLogs.data,
          createdAt: jobLogs.createdAt,
          jobName: jobs.jobName,
          jobType: jobs.jobType,
          queue: jobs.queue,
          status: jobs.status,
          duration: jobs.duration,
          startedAt: jobs.startedAt,
          completedAt: jobs.completedAt,
          errorMessage: jobs.errorMessage,
          errorStack: jobs.errorStack,
        })
        .from(jobLogs)
        .innerJoin(jobs, eq(jobLogs.jobId, jobs.id))
        .where(whereClause)
        .orderBy(desc(jobLogs.createdAt))
        .limit(limit * 2); // Get more for filtering

      // Transform database logs
      for (const log of dbLogs) {
        // Skip if filtering by queue
        if (queueFilter && log.queue !== queueFilter) continue;
        
        // Skip if filtering by status
        if (statusFilter && log.status !== statusFilter) continue;

        const logEntry = {
          id: log.id,
          jobId: log.jobId,
          jobName: log.jobName,
          queueName: log.queue || 'unknown',
          level: log.level === 'info' && log.status === 'completed' ? 'success' : log.level,
          message: log.message,
          status: log.status,
          duration: log.duration,
          attemptNumber: 0,
          timestamp: log.createdAt?.toISOString() || new Date().toISOString(),
          createdAt: log.createdAt?.toISOString() || new Date().toISOString(),
          context: log.data ? JSON.parse(log.data) : undefined,
          error: log.errorMessage,
          stackTrace: log.errorStack,
          isHistorical: true, // Mark as historical data
        };

        allLogs.push(logEntry);
      }

      // Get recent logs from queues (last 24 hours of active jobs)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      const allQueues = this.getAllQueues();

      for (const { name, queue } of allQueues) {
        // Skip if filtering by queue name
        if (queueFilter && name !== queueFilter) continue;

        try {
          // Only get recent jobs from queues
          const statuses = ['completed', 'failed', 'active', 'waiting', 'delayed'] as any[];
          const jobs = await queue.getJobs(statuses, 0, 100);
          
          for (const job of jobs) {
            // Skip old jobs (they should be in the database)
            if (job.timestamp < cutoffTime) continue;

            const state = await job.getState();
            
            // Skip if filtering by status
            if (statusFilter && state !== statusFilter) continue;
            
            // Determine log level based on job state
            let logLevel = 'info';
            let message = `Job ${job.name} is ${state}`;
            
            if (state === 'failed') {
              logLevel = 'error';
              message = job.failedReason || `Job ${job.name} failed`;
            } else if (state === 'completed') {
              logLevel = 'success';
              message = `Job ${job.name} completed successfully`;
            } else if (state === 'active') {
              logLevel = 'info';
              message = `Job ${job.name} is being processed`;
            } else if (state === 'waiting') {
              logLevel = 'info';
              message = `Job ${job.name} is waiting to be processed`;
            } else if (state === 'delayed') {
              logLevel = 'info';
              message = `Job ${job.name} is delayed`;
            }
            
            // Skip if filtering by level
            if (level && logLevel !== level) continue;
            
            // Skip if search doesn't match
            if (search) {
              const searchLower = search.toLowerCase();
              const matchesSearch = 
                message.toLowerCase().includes(searchLower) ||
                job.name.toLowerCase().includes(searchLower) ||
                job.id.toString().includes(searchLower) ||
                (job.data && JSON.stringify(job.data).toLowerCase().includes(searchLower));
              
              if (!matchesSearch) continue;
            }
            
            // Calculate duration if applicable
            let duration = undefined;
            if (job.processedOn && job.finishedOn) {
              duration = job.finishedOn - job.processedOn;
            }
            
            // Create log entry
            const logEntry = {
              id: `queue-${name}-${job.id}`,
              jobId: job.id.toString(),
              jobName: job.name,
              queueName: name,
              level: logLevel,
              message: message,
              status: state,
              duration: duration,
              attemptNumber: job.attemptsMade,
              timestamp: new Date(job.finishedOn || job.processedOn || job.timestamp).toISOString(),
              createdAt: new Date(job.timestamp).toISOString(),
              context: {
                data: job.data,
                opts: job.opts,
                returnvalue: job.returnvalue,
                progress: job.progress,
              },
              error: job.failedReason,
              stackTrace: job.stacktrace ? job.stacktrace.join('\n') : undefined,
              isHistorical: false, // Mark as live data
            };
            
            allLogs.push(logEntry);
          }
        } catch (error) {
          this.logger.error({
            msg: 'Failed to get logs from queue',
            queue: name,
            error: error.message,
          });
        }
      }
      
      // Remove duplicates (prefer queue data over DB for recent jobs)
      const uniqueLogs = new Map();
      for (const log of allLogs) {
        const key = `${log.jobId}-${log.timestamp}`;
        if (!uniqueLogs.has(key) || !log.isHistorical) {
          uniqueLogs.set(key, log);
        }
      }
      
      // Convert back to array and sort
      const sortedLogs = Array.from(uniqueLogs.values()).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Apply pagination
      const paginatedLogs = sortedLogs.slice(offset, offset + limit);
      
      return {
        logs: paginatedLogs,
        total: sortedLogs.length,
        limit,
        offset,
        hasMore: offset + limit < sortedLogs.length,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to get all logs',
        error: error.message,
      });
      
      // Return empty logs instead of throwing
      return {
        logs: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }
  }

  async getQueueLogs(queueName: string, options: {
    level?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { level, search, limit = 100, offset = 0 } = options;
    
    // Get the specific queue
    const queueInfo = this.getAllQueues().find(q => q.name === queueName);
    if (!queueInfo) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const queue = queueInfo.queue;
    const db = this.databaseService.db;
    
    // Get jobs from the queue based on status
    const statuses = ['completed', 'failed', 'active', 'waiting', 'delayed'] as any[];
    const allJobs = await queue.getJobs(statuses, offset, offset + limit - 1);
    
    // Create a map of job IDs to database job records
    const jobNames = allJobs.map(j => j.name).filter(Boolean);
    const dbJobs = jobNames.length > 0 ? await db
      .select()
      .from(jobs)
      .where(sql`${jobs.jobName} IN ${jobNames}`)
      .orderBy(desc(jobs.createdAt))
      .limit(100) : [];
    
    const dbJobMap = new Map(dbJobs.map(j => [j.jobName, j]));
    
    // Transform jobs into log entries
    const logs = [];
    
    for (const job of allJobs) {
      const dbJob = dbJobMap.get(job.name || '');
      
      // Add main job status log
      const logLevel = job.failedReason ? 'error' : 
                      job.finishedOn ? 'success' : 
                      job.processedOn ? 'info' : 'info';
      
      const message = job.failedReason ? `Job failed: ${job.failedReason}` :
                     job.finishedOn ? `Job completed successfully` :
                     job.processedOn ? `Job is being processed` :
                     `Job is waiting to be processed`;
      
      logs.push({
        id: `log-${job.id}`,
        jobId: job.id,
        level: logLevel,
        message: `[${job.name}] ${message}`,
        context: {
          jobName: job.name,
          jobData: job.data,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          returnvalue: job.returnvalue,
          stacktrace: job.stacktrace,
        },
        createdAt: new Date(job.timestamp).toISOString(),
      });
      
      // If we have a database job record, fetch its logs
      if (dbJob) {
        const dbLogs = await db
          .select()
          .from(jobLogs)
          .where(eq(jobLogs.jobId, dbJob.id))
          .orderBy(asc(jobLogs.createdAt));
        
        // Add database logs
        for (const dbLog of dbLogs) {
          logs.push({
            id: dbLog.id,
            jobId: job.id,
            level: dbLog.level as any,
            message: dbLog.message,
            context: dbLog.data ? JSON.parse(dbLog.data) : {},
            createdAt: dbLog.createdAt.toISOString(),
          });
        }
      }
    }
    
    // Sort logs by timestamp
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Apply filters
    let filteredLogs = logs;
    
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.jobId.toLowerCase().includes(searchLower)
      );
    }
    
    // Get total count
    const jobCounts = await queue.getJobCounts();
    const total = jobCounts.completed + jobCounts.failed + jobCounts.active + 
                 jobCounts.waiting + jobCounts.delayed;
    
    return {
      logs: filteredLogs,
      total: filteredLogs.length,
      limit,
      offset,
      filters: { level, search },
      timestamp: new Date().toISOString(),
    };
  }

  async getJobSystemStatus() {
    const queues = this.getAllQueues();
    const queueStatuses = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts();
        const isPaused = await queue.isPaused();
        const workers = await queue.getWorkers();

        return {
          name,
          isPaused,
          counts,
          workerCount: workers.length,
          health: this.calculateQueueHealth(counts),
        };
      })
    );

    const totalJobs = queueStatuses.reduce(
      (acc, q) => ({
        active: acc.active + q.counts.active,
        waiting: acc.waiting + q.counts.waiting,
        completed: acc.completed + q.counts.completed,
        failed: acc.failed + q.counts.failed,
      }),
      { active: 0, waiting: 0, completed: 0, failed: 0 }
    );

    const overallHealth = this.calculateSystemHealth(queueStatuses);

    return {
      status: overallHealth,
      timestamp: new Date(),
      queues: queueStatuses,
      totals: totalJobs,
      systemMetrics: {
        totalQueues: queueStatuses.length,
        activeQueues: queueStatuses.filter((q) => !q.isPaused).length,
        healthyQueues: queueStatuses.filter((q) => q.health === 'healthy').length,
        warningQueues: queueStatuses.filter((q) => q.health === 'warning').length,
        criticalQueues: queueStatuses.filter((q) => q.health === 'critical').length,
      },
    };
  }

  private calculateQueueHealth(counts: any): 'healthy' | 'warning' | 'critical' {
    const failureRate = counts.failed / (counts.completed + counts.failed || 1);
    const stalledRate = counts.stalled / (counts.active + counts.stalled || 1);

    if (failureRate > 0.3 || stalledRate > 0.5) return 'critical';
    if (failureRate > 0.1 || stalledRate > 0.2 || counts.waiting > 1000) return 'warning';
    return 'healthy';
  }

  private calculateSystemHealth(queueStatuses: any[]): 'healthy' | 'warning' | 'critical' {
    const criticalCount = queueStatuses.filter((q) => q.health === 'critical').length;
    const warningCount = queueStatuses.filter((q) => q.health === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (warningCount > queueStatuses.length / 2) return 'warning';
    return 'healthy';
  }

  // Schedule-related methods
  async getSchedulesForQueue(queueName: string) {
    const db = this.databaseService.db;
    
    // Get all schedules that use templates for this queue
    const schedules = await db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .where(eq(jobTemplates.queueName, queueName))
      .orderBy(desc(jobSchedules.nextRunAt));
    
    return schedules.map(({ schedule, template }) => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      isEnabled: schedule.isEnabled,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      consecutiveFailures: schedule.consecutiveFailures,
      template: {
        name: template.name,
        displayName: template.displayName,
        category: template.category,
      },
    }));
  }

  async getQueueConfigsWithSchedules() {
    const configs = await this.getQueueConfigs();
    
    // Enhance each config with schedule information
    const enhancedConfigs = await Promise.all(
      configs.map(async (config) => {
        const schedules = await this.getSchedulesForQueue(config.queueName);
        
        // Find the next scheduled run
        const nextScheduledRun = schedules
          .filter(s => s.isEnabled && s.nextRunAt)
          .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0];
        
        return {
          ...config,
          schedules: schedules.length,
          activeSchedules: schedules.filter(s => s.isEnabled).length,
          nextScheduledRun: nextScheduledRun ? {
            name: nextScheduledRun.name,
            nextRunAt: nextScheduledRun.nextRunAt,
            cronExpression: nextScheduledRun.cronExpression,
          } : null,
        };
      })
    );
    
    return enhancedConfigs;
  }

  async getJobSchedules() {
    const db = this.databaseService.db;
    
    return db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .orderBy(desc(jobSchedules.createdAt));
  }

  async createJobSchedule(scheduleData: any) {
    const db = this.databaseService.db;
    
    const [schedule] = await db
      .insert(jobSchedules)
      .values(scheduleData)
      .returning();
    
    return schedule;
  }

  async updateJobSchedule(scheduleId: string, updates: any) {
    const db = this.databaseService.db;
    
    const [updated] = await db
      .update(jobSchedules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(jobSchedules.id, scheduleId))
      .returning();
    
    return updated;
  }

  async deleteJobSchedule(scheduleId: string) {
    const db = this.databaseService.db;
    
    await db
      .delete(jobSchedules)
      .where(eq(jobSchedules.id, scheduleId));
    
    return { success: true };
  }

  // Job management methods
  async createJob(jobData: {
    queue: string;
    name: string;
    data: any;
    options?: any;
  }) {
    const queue = this.getQueueByName(jobData.queue);
    if (!queue) {
      throw new Error(`Queue not found: ${jobData.queue}`);
    }

    const defaultOptions = {
      priority: 0,
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 20,
    };

    const job = await queue.add(
      jobData.name,
      jobData.data,
      { ...defaultOptions, ...jobData.options }
    );

    this.logger.info({
      msg: 'Job created',
      jobId: job.id,
      queue: jobData.queue,
      name: jobData.name,
    });

    return {
      id: job.id,
      queue: jobData.queue,
      name: job.name,
      data: job.data,
      opts: job.opts,
      timestamp: new Date().toISOString(),
    };
  }

  async createBulkJobs(jobs: Array<{
    queue: string;
    name: string;
    data: any;
    options?: any;
  }>) {
    const results = await Promise.allSettled(
      jobs.map(job => this.createJob(job))
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    return {
      created: successful.length,
      failed: failed.length,
      jobs: successful.map((r: any) => r.value),
      errors: failed.map((r: any) => ({
        reason: r.reason?.message || 'Unknown error',
      })),
    };
  }

  async retryJob(jobId: string) {
    // Find the job across all queues
    for (const { name, queue } of this.getAllQueues()) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          
          if (state === 'failed') {
            await job.retry();
            
            this.logger.info({
              msg: 'Job retry initiated',
              jobId,
              queueName: name,
            });

            return {
              id: job.id,
              queue: name,
              status: 'retry_initiated',
              timestamp: new Date().toISOString(),
            };
          } else {
            throw new Error(`Job is not in failed state: ${state}`);
          }
        }
      } catch (error) {
        // Continue searching in other queues
      }
    }
    
    throw new Error(`Job not found: ${jobId}`);
  }

  async cancelJob(jobId: string) {
    // Find the job across all queues
    for (const { name, queue } of this.getAllQueues()) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          
          if (['waiting', 'delayed', 'active'].includes(state)) {
            await job.remove();
            
            this.logger.info({
              msg: 'Job cancelled',
              jobId,
              queueName: name,
              previousState: state,
            });

            return {
              id: job.id,
              queue: name,
              status: 'cancelled',
              previousState: state,
              timestamp: new Date().toISOString(),
            };
          } else {
            throw new Error(`Cannot cancel job in state: ${state}`);
          }
        }
      } catch (error) {
        // Continue searching in other queues
      }
    }
    
    throw new Error(`Job not found: ${jobId}`);
  }

  async resetAllLogs() {
    try {
      const db = this.databaseService.db;
      
      // Count logs before deletion
      const logsCountResult = await db.select({ count: sql`count(*)::int` }).from(jobLogs);
      const jobsCountResult = await db.select({ count: sql`count(*)::int` }).from(jobs);
      
      const logsCount = logsCountResult[0]?.count || 0;
      const jobsCount = jobsCountResult[0]?.count || 0;
      
      // Delete all job logs
      await db.delete(jobLogs);
      
      // Also delete all job records from the jobs table
      await db.delete(jobs);
      
      // Clean all Redis queues
      const allQueues = this.getAllQueues();
      let redisJobsDeleted = 0;
      
      for (const { name, queue } of allQueues) {
        try {
          const [completed, failed] = await Promise.all([
            queue.getCompleted(),
            queue.getFailed()
          ]);
          
          // Remove completed jobs
          for (const job of completed) {
            try {
              await job.remove();
              redisJobsDeleted++;
            } catch (err) {
              // Continue if job already removed
            }
          }
          
          // Remove failed jobs
          for (const job of failed) {
            try {
              await job.remove();
              redisJobsDeleted++;
            } catch (err) {
              // Continue if job already removed
            }
          }
        } catch (err) {
          this.logger.error({
            msg: 'Error cleaning Redis queue',
            queue: name,
            error: err.message,
          });
        }
      }
      
      this.logger.warn({
        msg: 'All job logs and records have been reset',
        logsDeleted: logsCount,
        jobsDeleted: jobsCount,
        redisJobsDeleted,
      });
      
      return {
        success: true,
        message: 'All job logs and records have been successfully reset',
        logsDeleted: logsCount,
        jobsDeleted: jobsCount,
        redisJobsDeleted,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reset job logs',
        error: error.message,
      });
      throw new Error(`Failed to reset job logs: ${error.message}`);
    }
  }

  async resetQueueLogs(queueName: string) {
    try {
      const db = this.databaseService.db;
      
      // Verify queue exists
      const queueInfo = this.getAllQueues().find(q => q.name === queueName);
      if (!queueInfo) {
        throw new Error(`Queue '${queueName}' not found`);
      }
      
      const queue = queueInfo.queue;
      
      // Count logs before deletion for this queue
      const logsCountResult = await db
        .select({ count: sql`count(*)::int` })
        .from(jobLogs)
        .innerJoin(jobs, eq(jobLogs.jobId, jobs.id))
        .where(eq(jobs.queue, queueName));
      
      const jobsCountResult = await db
        .select({ count: sql`count(*)::int` })
        .from(jobs)
        .where(eq(jobs.queue, queueName));
      
      const logsCount = logsCountResult[0]?.count || 0;
      const jobsCount = jobsCountResult[0]?.count || 0;
      
      // Delete logs for jobs in this queue from database
      const jobIdsResult = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.queue, queueName));
      
      const jobIds = jobIdsResult.map(j => j.id);
      
      if (jobIds.length > 0) {
        // Delete logs for these jobs using inArray
        await db.delete(jobLogs).where(inArray(jobLogs.jobId, jobIds));
        
        // Delete the job records from database
        await db.delete(jobs).where(eq(jobs.queue, queueName));
      }
      
      // Also clean the Redis queue - remove completed and failed jobs
      const [completed, failed] = await Promise.all([
        queue.getCompleted(),
        queue.getFailed()
      ]);
      
      let redisJobsDeleted = 0;
      
      // Remove completed jobs from Redis
      for (const job of completed) {
        try {
          await job.remove();
          redisJobsDeleted++;
        } catch (err) {
          // Job might already be removed, continue
        }
      }
      
      // Remove failed jobs from Redis
      for (const job of failed) {
        try {
          await job.remove();
          redisJobsDeleted++;
        } catch (err) {
          // Job might already be removed, continue
        }
      }
      
      this.logger.warn({
        msg: 'Queue logs and records have been reset',
        queueName,
        logsDeleted: logsCount,
        jobsDeleted: jobsCount,
        redisJobsDeleted,
      });
      
      return {
        success: true,
        message: `All logs and records for queue '${queueName}' have been successfully reset`,
        queueName,
        logsDeleted: logsCount,
        jobsDeleted: jobsCount,
        redisJobsDeleted,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reset queue logs',
        queueName,
        error: error.message,
      });
      throw new Error(`Failed to reset queue logs: ${error.message}`);
    }
  }

}
