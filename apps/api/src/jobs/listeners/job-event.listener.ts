import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job, QueueEvents } from "bullmq";
import { NotificationsService } from "../../notifications/notifications.service";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { QUEUE_NAMES } from "../queues/queue.config";
import { ConfigService } from "@nestjs/config";
import { createRedisConnection } from "../queues/queue.config";
import { JobsGateway } from "../gateways/jobs.gateway";

@Injectable()
export class JobEventListener implements OnModuleInit, OnModuleDestroy {
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(
    @InjectPinoLogger(JobEventListener.name)
    private readonly logger: PinoLogger,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly jobsGateway: JobsGateway,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private priceFileParserQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE) private priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA) private exportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH) private analyticsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN) private praScanQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD) private praFileQueue: Queue,
  ) {}

  async onModuleInit() {
    // Create QueueEvents for each queue to listen to job events
    const queues = [
      { name: QUEUE_NAMES.PRICE_FILE_PARSER, queue: this.priceFileParserQueue },
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportQueue },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH, queue: this.analyticsQueue },
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN, queue: this.praScanQueue },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD, queue: this.praFileQueue },
    ];

    const connection = createRedisConnection(this.configService);

    for (const { name, queue } of queues) {
      const queueEvents = new QueueEvents(name, { connection });
      this.queueEvents.set(name, queueEvents);

      // Listen to job completed events
      queueEvents.on("completed", async ({ jobId, returnvalue }) => {
        try {
          const job = await queue.getJob(jobId);
          if (job) {
            // Emit WebSocket event
            this.jobsGateway.emitJobCompleted(name, jobId, {
              jobName: job.name,
              duration: job.finishedOn && job.processedOn
                ? job.finishedOn - job.processedOn
                : null,
              returnvalue,
            });

            // Create notification if user is specified
            if (job.data.userId) {
              await this.notificationsService.createJobNotification(
                job.id,
                job.data.userId,
                "job_success",
                `Job ${job.name} completed successfully`,
                `Job ${job.id} in queue ${name} has completed successfully.`,
                {
                  queueName: name,
                  jobName: job.name,
                  duration: job.finishedOn
                    ? job.finishedOn - job.processedOn
                    : null,
                  returnvalue,
                },
              );
            }
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to create job success notification",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to job failed events
      queueEvents.on("failed", async ({ jobId, failedReason }) => {
        try {
          const job = await queue.getJob(jobId);
          if (job) {
            // Emit WebSocket event
            this.jobsGateway.emitJobFailed(name, jobId, {
              message: failedReason,
              attemptsMade: job.attemptsMade,
            });

            // Create notification if user is specified
            if (job.data.userId) {
              await this.notificationsService.createJobNotification(
                job.id,
                job.data.userId,
                "job_failure",
                `Job ${job.name} failed`,
                `Job ${job.id} in queue ${name} has failed: ${failedReason}`,
                {
                  queueName: name,
                  jobName: job.name,
                  attemptsMade: job.attemptsMade,
                  failedReason,
                  stackTrace: job.stacktrace,
                },
              );
            }
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to create job failure notification",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to job stalled events (potential warnings)
      queueEvents.on("stalled", async ({ jobId }) => {
        try {
          const job = await queue.getJob(jobId);
          if (job && job.data.userId) {
            await this.notificationsService.createJobNotification(
              job.id,
              job.data.userId,
              "job_warning",
              `Job ${job.name} stalled`,
              `Job ${job.id} in queue ${name} has stalled and will be retried.`,
              {
                queueName: name,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
              },
            );
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to create job warning notification",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to job added events
      queueEvents.on("added", async ({ jobId }) => {
        try {
          const job = await queue.getJob(jobId);
          if (job) {
            this.jobsGateway.emitJobAdded(name, {
              id: job.id,
              name: job.name,
              data: job.data,
              opts: job.opts,
            });
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to emit job added event",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to job active events
      queueEvents.on("active", async ({ jobId }) => {
        try {
          const job = await queue.getJob(jobId);
          if (job) {
            this.jobsGateway.emitJobStarted(name, jobId);
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to emit job active event",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to job progress events
      queueEvents.on("progress", async ({ jobId, data }) => {
        try {
          if (typeof data === "number") {
            this.jobsGateway.emitJobProgress(name, jobId, data);
          }
        } catch (error) {
          this.logger.error({
            msg: "Failed to emit job progress event",
            error: error.message,
            jobId,
            queueName: name,
          });
        }
      });

      // Listen to queue paused/resumed events
      queueEvents.on("paused", () => {
        this.jobsGateway.emitQueueStateChange(name, true);
      });

      queueEvents.on("resumed", () => {
        this.jobsGateway.emitQueueStateChange(name, false);
      });

      this.logger.info({
        msg: "Job event listener initialized for queue",
        queueName: name,
      });
    }

    // Emit initial queue statistics
    await this.emitQueueStats();
  }

  private async emitQueueStats() {
    const queues = [
      { name: QUEUE_NAMES.PRICE_FILE_PARSER, queue: this.priceFileParserQueue },
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportQueue },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH, queue: this.analyticsQueue },
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN, queue: this.praScanQueue },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD, queue: this.praFileQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        const counts = await queue.getJobCounts();
        const isPaused = await queue.isPaused();
        
        this.jobsGateway.emitQueueStats(name, {
          counts,
          isPaused,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error({
          msg: "Failed to emit queue stats",
          error: error.message,
          queueName: name,
        });
      }
    }
  }

  async onModuleDestroy() {
    // Clean up queue events
    for (const [name, queueEvents] of this.queueEvents) {
      await queueEvents.close();
      this.logger.info({
        msg: "Queue events closed",
        queueName: name,
      });
    }
  }
}
