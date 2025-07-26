import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DatabaseService } from "../../../database/database.service";
import { QUEUE_NAMES } from "../../queues/queue.config";
import { jobs as jobsTable, priceTransparencyFiles } from "../../../database/schema";
import { eq, and, lt, inArray, isNull } from "drizzle-orm";
import { Cron, CronExpression } from "@nestjs/schedule";

/**
 * Service that monitors job health and handles stuck/failed jobs
 */
@Injectable()
export class JobMonitorService implements OnModuleInit {
  private readonly STALE_JOB_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  private readonly ORPHANED_FILE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

  constructor(
    @InjectPinoLogger(JobMonitorService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly downloadQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly parserQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.info("Job monitor service initialized");
  }

  /**
   * Monitor and clean up stale jobs every 15 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async monitorStaleJobs(): Promise<void> {
    try {
      this.logger.info("Starting stale job monitoring");

      const db = this.databaseService.db;
      const staleThreshold = new Date(Date.now() - this.STALE_JOB_THRESHOLD);

      // Find jobs that have been running for too long
      const staleJobs = await db
        .select()
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.status, "running"),
            lt(jobsTable.startedAt, staleThreshold),
          ),
        );

      if (staleJobs.length > 0) {
        this.logger.warn({
          msg: "Found stale jobs",
          count: staleJobs.length,
          jobs: staleJobs.map((j) => ({
            id: j.id,
            name: j.jobName,
            startedAt: j.startedAt,
          })),
        });

        // Mark stale jobs as failed
        for (const job of staleJobs) {
          await this.markJobAsStale(job);
        }
      }

      await this.checkOrphanedFiles();
      await this.retryFailedDownloads();

    } catch (error) {
      this.logger.error({
        msg: "Error in stale job monitor",
        error: error.message,
      });
    }
  }

  /**
   * Check for orphaned files that haven't been processed
   */
  private async checkOrphanedFiles(): Promise<void> {
    const db = this.databaseService.db;
    const orphanedThreshold = new Date(Date.now() - this.ORPHANED_FILE_THRESHOLD);

    // Find files stuck in pending/processing state
    const orphanedFiles = await db
      .select()
      .from(priceTransparencyFiles)
      .where(
        and(
          inArray(priceTransparencyFiles.processingStatus, ["pending", "processing"]),
          lt(priceTransparencyFiles.updatedAt, orphanedThreshold),
          isNull(priceTransparencyFiles.storageKey), // No file downloaded yet
        ),
      );

    if (orphanedFiles.length > 0) {
      this.logger.warn({
        msg: "Found orphaned files",
        count: orphanedFiles.length,
      });

      // Re-queue orphaned files for download
      for (const file of orphanedFiles) {
        try {
          await this.downloadQueue.add(
            `requeue-${file.id}`,
            {
              hospitalId: file.hospitalId,
              fileId: file.id,
              fileUrl: file.fileUrl,
              filename: file.filename,
              forceRefresh: true, // Force re-download
            },
            {
              priority: 10, // Higher priority for re-queued jobs
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 30000,
              },
              removeOnComplete: 10,
              removeOnFail: 20,
            },
          );

          await db
            .update(priceTransparencyFiles)
            .set({
              processingStatus: "pending",
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(priceTransparencyFiles.id, file.id));

          this.logger.info({
            msg: "Re-queued orphaned file",
            fileId: file.id,
            filename: file.filename,
          });
        } catch (error) {
          this.logger.error({
            msg: "Failed to re-queue orphaned file",
            fileId: file.id,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Retry failed file downloads
   */
  private async retryFailedDownloads(): Promise<void> {
    const db = this.databaseService.db;
    
    // Find recently failed files that haven't exceeded retry limit
    const failedFiles = await db
      .select()
      .from(priceTransparencyFiles)
      .where(
        and(
          eq(priceTransparencyFiles.processingStatus, "failed"),
          // Only retry files that failed in the last 24 hours
          lt(
            priceTransparencyFiles.updatedAt,
            new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          ),
        ),
      )
      .limit(10); // Process in batches

    if (failedFiles.length > 0) {
      this.logger.info({
        msg: "Retrying failed file downloads",
        count: failedFiles.length,
      });

      for (const file of failedFiles) {
        // Check if error is retryable
        if (this.isRetryableError(file.errorMessage)) {
          try {
            await this.downloadQueue.add(
              `retry-${file.id}`,
              {
                hospitalId: file.hospitalId,
                fileId: file.id,
                fileUrl: file.fileUrl,
                filename: file.filename,
                forceRefresh: true,
              },
              {
                priority: 8,
                attempts: 2,
                backoff: {
                  type: "exponential",
                  delay: 60000,
                },
                removeOnComplete: 10,
                removeOnFail: 20,
              },
            );

            await db
              .update(priceTransparencyFiles)
              .set({
                processingStatus: "pending",
                errorMessage: null,
                updatedAt: new Date(),
              })
              .where(eq(priceTransparencyFiles.id, file.id));

            this.logger.info({
              msg: "Retrying failed file",
              fileId: file.id,
              previousError: file.errorMessage,
            });
          } catch (error) {
            this.logger.error({
              msg: "Failed to retry file",
              fileId: file.id,
              error: error.message,
            });
          }
        }
      }
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(errorMessage: string | null): boolean {
    if (!errorMessage) return false;

    const retryableErrors = [
      "timeout",
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "socket hang up",
      "Network Error",
      "ENOTFOUND",
      "EAI_AGAIN",
      "503",
      "502",
      "429", // Rate limited
    ];

    const lowerError = errorMessage.toLowerCase();
    return retryableErrors.some((err) => lowerError.includes(err.toLowerCase()));
  }

  /**
   * Mark a job as stale/failed
   */
  private async markJobAsStale(job: any): Promise<void> {
    const db = this.databaseService.db;

    await db
      .update(jobsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: "Job timed out - marked as stale",
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, job.id));

    this.logger.warn({
      msg: "Marked job as stale",
      jobId: job.id,
      jobName: job.jobName,
      runningTime: Date.now() - new Date(job.startedAt).getTime(),
    });
  }

  /**
   * Get job health metrics
   */
  async getJobHealthMetrics(): Promise<{
    healthy: boolean;
    metrics: Record<string, any>;
  }> {
    const db = this.databaseService.db;

    // Get job counts by status
    const jobStats = await db
      .select({
        status: jobsTable.status,
        count: db.$count(jobsTable.id),
      })
      .from(jobsTable)
      .groupBy(jobsTable.status);

    // Get file processing stats
    const fileStats = await db
      .select({
        status: priceTransparencyFiles.processingStatus,
        count: db.$count(priceTransparencyFiles.id),
      })
      .from(priceTransparencyFiles)
      .groupBy(priceTransparencyFiles.processingStatus);

    // Check queue health
    const downloadQueueHealth = await this.downloadQueue.getJobCounts();
    const parserQueueHealth = await this.parserQueue.getJobCounts();

    const metrics = {
      jobs: Object.fromEntries(
        jobStats.map((s) => [s.status, s.count]),
      ),
      files: Object.fromEntries(
        fileStats.map((s) => [s.status, s.count]),
      ),
      queues: {
        download: downloadQueueHealth,
        parser: parserQueueHealth,
      },
    };

    // Determine if system is healthy
    const staleJobCount = jobStats.find((s) => s.status === "running")?.count || 0;
    const failedJobCount = jobStats.find((s) => s.status === "failed")?.count || 0;
    const healthy = staleJobCount < 10 && failedJobCount < 50;

    return { healthy, metrics };
  }
}