import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { QUEUE_NAMES } from "../../queues/queue.config";

export interface CleanupOptions {
  maxAge?: number; // Maximum age in milliseconds
  limit?: number; // Maximum number of jobs to clean at once
  grace?: number; // Grace period before cleanup (default: 0)
}

export interface CleanupResult {
  queueName: string;
  jobType: "completed" | "failed" | "active" | "waiting" | "delayed";
  deletedCount: number;
  error?: string;
}

export interface CleanupPolicy {
  completed: CleanupOptions;
  failed: CleanupOptions;
  stalled?: CleanupOptions;
}

@Injectable()
export class JobCleanupService {
  private readonly defaultCleanupPolicies: Record<string, CleanupPolicy> = {
    // Conservative policies for data-sensitive queues
    [QUEUE_NAMES.PRICE_FILE_PARSER]: {
      completed: { maxAge: 3 * 24 * 60 * 60 * 1000, limit: 50 }, // 3 days, max 50
      failed: { maxAge: 14 * 24 * 60 * 60 * 1000, limit: 100 }, // 14 days, max 100
      stalled: { maxAge: 12 * 60 * 60 * 1000, limit: 10 }, // 12 hours, max 10
    },
    [QUEUE_NAMES.PRICE_UPDATE]: {
      completed: { maxAge: 24 * 60 * 60 * 1000, limit: 200 }, // 1 day, max 200
      failed: { maxAge: 7 * 24 * 60 * 60 * 1000, limit: 100 }, // 7 days, max 100
      stalled: { maxAge: 6 * 60 * 60 * 1000, limit: 20 }, // 6 hours, max 20
    },
    // More aggressive cleanup for frequent jobs
    [QUEUE_NAMES.ANALYTICS_REFRESH]: {
      completed: { maxAge: 12 * 60 * 60 * 1000, limit: 50 }, // 12 hours, max 50
      failed: { maxAge: 3 * 24 * 60 * 60 * 1000, limit: 25 }, // 3 days, max 25
      stalled: { maxAge: 2 * 60 * 60 * 1000, limit: 10 }, // 2 hours, max 10
    },
    [QUEUE_NAMES.EXPORT_DATA]: {
      completed: { maxAge: 2 * 60 * 60 * 1000, limit: 20 }, // 2 hours, max 20
      failed: { maxAge: 7 * 24 * 60 * 60 * 1000, limit: 30 }, // 7 days, max 30
      stalled: { maxAge: 30 * 60 * 1000, limit: 5 }, // 30 minutes, max 5
    },
    // PRA pipeline queues - align with existing cleanup
    [QUEUE_NAMES.PRA_UNIFIED_SCAN]: {
      completed: { maxAge: 24 * 60 * 60 * 1000, limit: 100 }, // 1 day, max 100
      failed: { maxAge: 7 * 24 * 60 * 60 * 1000, limit: 50 }, // 7 days, max 50
      stalled: { maxAge: 4 * 60 * 60 * 1000, limit: 10 }, // 4 hours, max 10
    },
    [QUEUE_NAMES.PRA_FILE_DOWNLOAD]: {
      completed: { maxAge: 2 * 24 * 60 * 60 * 1000, limit: 75 }, // 2 days, max 75
      failed: { maxAge: 14 * 24 * 60 * 60 * 1000, limit: 100 }, // 14 days, max 100
      stalled: { maxAge: 8 * 60 * 60 * 1000, limit: 15 }, // 8 hours, max 15
    },
  };

  constructor(
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly priceFileParserQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly analyticsRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportDataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN)
    private readonly praUnifiedScanQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly praFileDownloadQueue: Queue,
    @InjectPinoLogger(JobCleanupService.name)
    private readonly logger: PinoLogger,
  ) {}

  private getQueueMap(): Record<string, Queue> {
    return {
      [QUEUE_NAMES.PRICE_FILE_PARSER]: this.priceFileParserQueue,
      [QUEUE_NAMES.PRICE_UPDATE]: this.priceUpdateQueue,
      [QUEUE_NAMES.ANALYTICS_REFRESH]: this.analyticsRefreshQueue,
      [QUEUE_NAMES.EXPORT_DATA]: this.exportDataQueue,
      [QUEUE_NAMES.PRA_UNIFIED_SCAN]: this.praUnifiedScanQueue,
      [QUEUE_NAMES.PRA_FILE_DOWNLOAD]: this.praFileDownloadQueue,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledCleanup() {
    this.logger.info("Starting scheduled comprehensive job cleanup");
    const results = await this.cleanupAllQueues();

    const summary = this.summarizeCleanupResults(results);
    this.logger.info(
      {
        ...summary,
      },
      "Scheduled job cleanup completed",
    );
  }

  async cleanupAllQueues(
    customPolicies?: Record<string, CleanupPolicy>,
  ): Promise<CleanupResult[]> {
    const queueMap = this.getQueueMap();
    const policies = customPolicies || this.defaultCleanupPolicies;
    const results: CleanupResult[] = [];

    for (const [queueName, queue] of Object.entries(queueMap)) {
      const policy = policies[queueName];
      if (!policy) {
        this.logger.warn(
          { queueName },
          "No cleanup policy defined for queue, skipping",
        );
        continue;
      }

      try {
        const queueResults = await this.cleanupQueue(queue, queueName, policy);
        results.push(...queueResults);
      } catch (_error) {
        this.logger.error(
          {
            queueName,
            error: (_error as Error).message,
          },
          "Failed to cleanup queue",
        );

        results.push({
          queueName,
          jobType: "completed",
          deletedCount: 0,
          error: (_error as Error).message,
        });
      }
    }

    return results;
  }

  async cleanupQueue(
    queue: Queue,
    queueName: string,
    policy: CleanupPolicy,
  ): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    this.logger.debug(
      {
        queueName,
        policy,
      },
      "Starting cleanup for queue",
    );

    // Clean completed jobs
    if (policy.completed) {
      try {
        const deletedJobIds = await queue.clean(
          policy.completed.maxAge || 24 * 60 * 60 * 1000,
          policy.completed.limit || 100,
          "completed",
        );

        results.push({
          queueName,
          jobType: "completed",
          deletedCount: deletedJobIds.length,
        });

        this.logger.debug(
          {
            queueName,
            deletedCount: deletedJobIds.length,
            jobType: "completed",
          },
          "Cleaned completed jobs",
        );
      } catch (_error) {
        results.push({
          queueName,
          jobType: "completed",
          deletedCount: 0,
          error: (_error as Error).message,
        });
      }
    }

    // Clean failed jobs
    if (policy.failed) {
      try {
        const deletedJobIds = await queue.clean(
          policy.failed.maxAge || 7 * 24 * 60 * 60 * 1000,
          policy.failed.limit || 50,
          "failed",
        );

        results.push({
          queueName,
          jobType: "failed",
          deletedCount: deletedJobIds.length,
        });

        this.logger.debug(
          {
            queueName,
            deletedCount: deletedJobIds.length,
            jobType: "failed",
          },
          "Cleaned failed jobs",
        );
      } catch (_error) {
        results.push({
          queueName,
          jobType: "failed",
          deletedCount: 0,
          error: (_error as Error).message,
        });
      }
    }

    // Clean stalled jobs (move them back to waiting or fail them)
    if (policy.stalled) {
      try {
        const deletedJobIds = await queue.clean(
          policy.stalled.maxAge || 60 * 60 * 1000,
          policy.stalled.limit || 20,
          "active",
        );

        results.push({
          queueName,
          jobType: "active",
          deletedCount: deletedJobIds.length,
        });

        this.logger.debug(
          {
            queueName,
            deletedCount: deletedJobIds.length,
            jobType: "stalled",
          },
          "Cleaned stalled jobs",
        );
      } catch (_error) {
        results.push({
          queueName,
          jobType: "active",
          deletedCount: 0,
          error: (_error as Error).message,
        });
      }
    }

    return results;
  }

  async cleanupSpecificQueue(
    queueName: string,
    policy?: CleanupPolicy,
  ): Promise<CleanupResult[]> {
    const queueMap = this.getQueueMap();
    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const cleanupPolicy = policy || this.defaultCleanupPolicies[queueName];
    if (!cleanupPolicy) {
      throw new Error(`No cleanup policy available for queue '${queueName}'`);
    }

    return this.cleanupQueue(queue, queueName, cleanupPolicy);
  }

  async drainQueue(queueName: string): Promise<void> {
    const queueMap = this.getQueueMap();
    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    this.logger.warn(
      {
        queueName,
      },
      "Draining queue - removing all waiting/delayed jobs",
    );

    await queue.drain();

    this.logger.info(
      {
        queueName,
      },
      "Queue drained successfully",
    );
  }

  async obliterateQueue(queueName: string): Promise<void> {
    const queueMap = this.getQueueMap();
    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    this.logger.warn(
      {
        queueName,
      },
      "OBLITERATING queue - this will permanently delete ALL jobs and queue data",
    );

    await queue.obliterate();

    this.logger.warn(
      {
        queueName,
      },
      "Queue obliterated - all data permanently deleted",
    );
  }

  async getCleanupStats(): Promise<{
    queues: Record<string, {
      counts?: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        total: number;
      };
      policy?: CleanupPolicy | null;
      paused?: boolean;
      lastCleanup?: null;
      error?: string;
    }>;
    timestamp: string;
    defaultPolicies: Record<string, CleanupPolicy>;
  }> {
    const queueMap = this.getQueueMap();
    const stats: Record<string, {
      counts?: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        total: number;
      };
      policy?: CleanupPolicy | null;
      paused?: boolean;
      lastCleanup?: null;
      error?: string;
    }> = {};

    for (const [queueName, queue] of Object.entries(queueMap)) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all(
          [
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
          ],
        );

        const policy = this.defaultCleanupPolicies[queueName];

        stats[queueName] = {
          counts: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            total:
              waiting.length +
              active.length +
              completed.length +
              failed.length +
              delayed.length,
          },
          policy: policy || null,
          paused: await queue.isPaused(),
          lastCleanup: null, // Could be enhanced to track last cleanup time
        };
      } catch (_error) {
        stats[queueName] = {
          error: (_error as Error).message,
        };
      }
    }

    return {
      queues: stats,
      timestamp: new Date().toISOString(),
      defaultPolicies: this.defaultCleanupPolicies,
    };
  }

  private summarizeCleanupResults(
    results: CleanupResult[],
  ): {
    totalQueuesProcessed: number;
    totalJobsDeleted: number;
    errorCount: number;
    byJobType: Record<string, number>;
    byQueue: Record<string, number>;
  } {
    const summary = {
      totalQueuesProcessed: new Set(results.map((r) => r.queueName)).size,
      totalJobsDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
      errorCount: results.filter((r) => r.error).length,
      byJobType: {} as Record<string, number>,
      byQueue: {} as Record<string, number>,
    };

    for (const result of results) {
      // Count by job type
      if (!summary.byJobType[result.jobType]) {
        summary.byJobType[result.jobType] = 0;
      }
      summary.byJobType[result.jobType] += result.deletedCount;

      // Count by queue
      if (!summary.byQueue[result.queueName]) {
        summary.byQueue[result.queueName] = 0;
      }
      summary.byQueue[result.queueName] += result.deletedCount;
    }

    return summary;
  }

  getAvailableQueues(): string[] {
    return Object.keys(this.getQueueMap());
  }

  getDefaultPolicy(queueName: string): CleanupPolicy | null {
    return this.defaultCleanupPolicies[queueName] || null;
  }
}
