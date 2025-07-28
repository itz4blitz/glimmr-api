import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../../database/database.service";
import { JsonObject, JsonValue } from "../../../types/common.types";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import {
  jobSchedules,
  jobTemplates,
  jobs,
  JobSchedule,
  JobTemplate,
} from "../../../database/schema";
import { eq, and, lte, asc } from "drizzle-orm";
import { CreateJobScheduleDto, UpdateJobScheduleDto } from "../../dto/job-operations.dto";
import { QUEUE_NAMES } from "../../queues/queue.config";
import parser from "cron-parser";

@Injectable()
export class JobSchedulingService implements OnModuleInit, OnModuleDestroy {
  private scheduleCheckInterval: NodeJS.Timeout;
  private activeSchedules: Map<string, CronJob> = new Map();

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
    @InjectPinoLogger(JobSchedulingService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // Load and start all active schedules
    await this.loadActiveSchedules();

    // Set up periodic check for schedule updates
    this.scheduleCheckInterval = setInterval(
      () => this.checkScheduleUpdates(),
      60000, // Check every minute
    );
  }

  onModuleDestroy() {
    // Clear the interval
    if (this.scheduleCheckInterval) {
      clearInterval(this.scheduleCheckInterval);
    }

    // Stop all active cron jobs
    this.activeSchedules.forEach((job, scheduleId) => {
      try {
        job.stop();
        this.schedulerRegistry.deleteCronJob(scheduleId);
      } catch (_error) {
        this.logger.error({
          msg: "Error stopping cron job",
          scheduleId,
          error: (_error as Error).message,
        });
      }
    });

    this.activeSchedules.clear();
  }

  private getQueueByName(queueName: string): Queue | null {
    const queueMap = {
      [QUEUE_NAMES.PRICE_FILE_PARSER]: this.priceFileParserQueue,
      [QUEUE_NAMES.PRICE_UPDATE]: this.priceUpdateQueue,
      [QUEUE_NAMES.EXPORT_DATA]: this.exportDataQueue,
      [QUEUE_NAMES.ANALYTICS_REFRESH]: this.analyticsRefreshQueue,
      [QUEUE_NAMES.PRA_UNIFIED_SCAN]: this.praUnifiedScanQueue,
      [QUEUE_NAMES.PRA_FILE_DOWNLOAD]: this.praFileDownloadQueue,
    };

    return queueMap[queueName] || null;
  }

  async createSchedule(dto: CreateJobScheduleDto, userId?: string) {
    const db = this.databaseService.db;

    // Validate template exists
    const [template] = await db
      .select()
      .from(jobTemplates)
      .where(eq(jobTemplates.id, dto.templateId))
      .limit(1);

    if (!template) {
      throw new Error(`Template not found: ${dto.templateId}`);
    }

    // Validate cron expression
    try {
      (parser as any).parseExpression(dto.cronExpression);
    } catch (_error) {
      throw new Error(`Invalid cron expression: ${dto.cronExpression}`);
    }

    // Calculate next run time
    const nextRunAt = this.calculateNextRunTime(dto.cronExpression, dto.timezone);

    // Create schedule in database
    const [schedule] = await db
      .insert(jobSchedules)
      .values({
        name: dto.name,
        description: dto.description,
        templateId: dto.templateId,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone || "UTC",
        priority: dto.priority,
        timeout: dto.timeout,
        retryAttempts: dto.retryAttempts,
        retryDelay: dto.retryDelay,
        jobConfig: dto.jobConfig || null,
        isEnabled: dto.isEnabled ?? true,
        maxConsecutiveFailures: dto.maxConsecutiveFailures || 5,
        disableOnMaxFailures: dto.disableOnMaxFailures ?? true,
        nextRunAt,
        createdBy: userId || "system",
      })
      .returning();

    // Start the schedule if enabled
    if (schedule.isEnabled) {
      await this.startSchedule({
        ...schedule,
        jobConfig: schedule.jobConfig as JsonValue,
      });
    }

    this.logger.info({
      msg: "Job schedule created",
      scheduleId: schedule.id,
      name: schedule.name,
      nextRunAt: schedule.nextRunAt,
      createdBy: userId || "system",
    });

    return schedule;
  }

  async updateSchedule(scheduleId: string, dto: UpdateJobScheduleDto, userId?: string) {
    const db = this.databaseService.db;

    // Get existing schedule
    const [existingSchedule] = await db
      .select()
      .from(jobSchedules)
      .where(eq(jobSchedules.id, scheduleId))
      .limit(1);

    if (!existingSchedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    // Validate cron expression if provided
    if (dto.cronExpression) {
      try {
        (parser as any).parseExpression(dto.cronExpression);
      } catch (_error) {
        throw new Error(`Invalid cron expression: ${dto.cronExpression}`);
      }
    }

    // Calculate next run time if cron expression or timezone changed
    let nextRunAt = existingSchedule.nextRunAt;
    if (dto.cronExpression || dto.timezone) {
      nextRunAt = this.calculateNextRunTime(
        dto.cronExpression || existingSchedule.cronExpression,
        dto.timezone || existingSchedule.timezone,
      );
    }

    // Update schedule in database
    const updateData: Partial<typeof jobSchedules.$inferInsert> = {};
    
    // Copy allowed fields from dto
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.cronExpression !== undefined) updateData.cronExpression = dto.cronExpression;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.timeout !== undefined) updateData.timeout = dto.timeout;
    if (dto.retryAttempts !== undefined) updateData.retryAttempts = dto.retryAttempts;
    if (dto.retryDelay !== undefined) updateData.retryDelay = dto.retryDelay;
    if (dto.jobConfig !== undefined) updateData.jobConfig = dto.jobConfig;
    if (dto.isEnabled !== undefined) updateData.isEnabled = dto.isEnabled;
    if (dto.maxConsecutiveFailures !== undefined) updateData.maxConsecutiveFailures = dto.maxConsecutiveFailures;
    if (dto.disableOnMaxFailures !== undefined) updateData.disableOnMaxFailures = dto.disableOnMaxFailures;
    
    const [updatedSchedule] = await db
      .update(jobSchedules)
      .set({
        ...updateData,
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(jobSchedules.id, scheduleId))
      .returning();

    // Handle schedule state changes
    const wasEnabled = existingSchedule.isEnabled;
    const isNowEnabled = updatedSchedule.isEnabled;

    if (wasEnabled && !isNowEnabled) {
      // Stop the schedule
      await this.stopSchedule(scheduleId);
    } else if (!wasEnabled && isNowEnabled) {
      // Start the schedule
      await this.startSchedule({
        ...updatedSchedule,
        jobConfig: updatedSchedule.jobConfig as JsonValue,
      });
    } else if (isNowEnabled && (dto.cronExpression || dto.timezone)) {
      // Restart the schedule with new timing
      await this.stopSchedule(scheduleId);
      await this.startSchedule({
        ...updatedSchedule,
        jobConfig: updatedSchedule.jobConfig as JsonValue,
      });
    }

    this.logger.info({
      msg: "Job schedule updated",
      scheduleId,
      changes: Object.keys(dto),
    });

    return updatedSchedule;
  }

  async deleteSchedule(scheduleId: string) {
    const db = this.databaseService.db;

    // Stop the schedule if running
    await this.stopSchedule(scheduleId);

    // Delete from database
    await db.delete(jobSchedules).where(eq(jobSchedules.id, scheduleId));

    this.logger.info({
      msg: "Job schedule deleted",
      scheduleId,
    });

    return { success: true };
  }

  async getSchedules(filters?: { enabled?: boolean; templateId?: string }) {
    const db = this.databaseService.db;

    const conditions = [];
    if (filters?.enabled !== undefined) {
      conditions.push(eq(jobSchedules.isEnabled, filters.enabled));
    }
    if (filters?.templateId) {
      conditions.push(eq(jobSchedules.templateId, filters.templateId));
    }

    const schedules = await db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(jobSchedules.nextRunAt));

    return schedules.map(({ schedule, template }) => ({
      ...schedule,
      template: {
        id: template.id,
        name: template.name,
        displayName: template.displayName,
        queueName: template.queueName,
        category: template.category,
      },
      isActive: this.activeSchedules.has(schedule.id),
    }));
  }

  async getSchedule(scheduleId: string) {
    const db = this.databaseService.db;

    const [result] = await db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .where(eq(jobSchedules.id, scheduleId))
      .limit(1);

    if (!result) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const lastJob = result.schedule.lastJobId
      ? await this.getLastJobInfo(result.schedule.lastJobId)
      : null;

    return {
      ...result.schedule,
      template: result.template,
      isActive: this.activeSchedules.has(scheduleId),
      lastJob,
    };
  }

  async runScheduleNow(scheduleId: string) {
    const db = this.databaseService.db;

    // Get schedule with template
    const [result] = await db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .where(eq(jobSchedules.id, scheduleId))
      .limit(1);

    if (!result) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    if (!result.schedule.isEnabled) {
      throw new Error("Cannot run disabled schedule");
    }

    // Execute the scheduled job
    const jobId = await this.executeScheduledJob(
      result.schedule as JobSchedule,
      result.template as JobTemplate
    );

    this.logger.info({
      msg: "Schedule run manually triggered",
      scheduleId,
      jobId,
    });

    return {
      success: true,
      jobId,
      message: "Schedule job has been queued",
    };
  }

  private async loadActiveSchedules() {
    const db = this.databaseService.db;

    // Get all enabled schedules
    const enabledSchedules = await db
      .select({
        schedule: jobSchedules,
        template: jobTemplates,
      })
      .from(jobSchedules)
      .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
      .where(eq(jobSchedules.isEnabled, true));

    for (const { schedule } of enabledSchedules) {
      try {
        await this.startSchedule({
          ...schedule,
          jobConfig: schedule.jobConfig as JsonValue,
        });
      } catch (_error) {
        this.logger.error({
          msg: "Failed to start schedule",
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          error: (_error as Error).message,
        });
      }
    }

    this.logger.info({
      msg: "Active schedules loaded",
      count: this.activeSchedules.size,
    });
  }

  private async startSchedule(schedule: Partial<JobSchedule> & { id: string; cronExpression: string; timezone: string; name: string }) {
    if (this.activeSchedules.has(schedule.id as string)) {
      return; // Already running
    }

    try {
      const cronJob = new CronJob(
        schedule.cronExpression as string,
        async () => {
          await this.handleScheduledExecution(schedule.id as string);
        },
        null,
        true,
        schedule.timezone as string,
      );

      this.schedulerRegistry.addCronJob(schedule.id as string, cronJob as any);
      this.activeSchedules.set(schedule.id as string, cronJob);

      this.logger.info({
        msg: "Schedule started",
        scheduleId: schedule.id,
        scheduleName: schedule.name,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to start schedule",
        scheduleId: schedule.id,
        error: (_error as Error).message,
      });
      throw _error;
    }
  }

  private async stopSchedule(scheduleId: string) {
    const cronJob = this.activeSchedules.get(scheduleId);
    if (!cronJob) {
      return; // Not running
    }

    try {
      cronJob.stop();
      this.schedulerRegistry.deleteCronJob(scheduleId);
      this.activeSchedules.delete(scheduleId);

      this.logger.info({
        msg: "Schedule stopped",
        scheduleId,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to stop schedule",
        scheduleId,
        error: (_error as Error).message,
      });
    }
  }

  private async handleScheduledExecution(scheduleId: string) {
    const db = this.databaseService.db;

    try {
      // Get schedule with template
      const [result] = await db
        .select({
          schedule: jobSchedules,
          template: jobTemplates,
        })
        .from(jobSchedules)
        .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
        .where(eq(jobSchedules.id, scheduleId))
        .limit(1);

      if (!result || !result.schedule.isEnabled) {
        return;
      }

      // Execute the job
      const jobId = await this.executeScheduledJob(
        result.schedule as JobSchedule,
        result.template as JobTemplate
      );

      // Update schedule with execution info
      const nextRunAt = this.calculateNextRunTime(
        result.schedule.cronExpression,
        result.schedule.timezone,
      );

      await db
        .update(jobSchedules)
        .set({
          lastRunAt: new Date(),
          lastJobId: jobId,
          nextRunAt,
          consecutiveFailures: 0, // Reset on successful execution
          updatedAt: new Date(),
        })
        .where(eq(jobSchedules.id, scheduleId));

      this.logger.info({
        msg: "Scheduled job executed",
        scheduleId,
        jobId,
        nextRunAt,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to execute scheduled job",
        scheduleId,
        error: (_error as Error).message,
      });

      // Handle consecutive failures
      await this.handleScheduleFailure(scheduleId, _error as Error);
    }
  }

  private async executeScheduledJob(schedule: JobSchedule, template: JobTemplate): Promise<string> {
    const queue = this.getQueueByName(template.queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${template.queueName}`);
    }

    // Merge job configuration
    const scheduleConfig = (schedule.jobConfig as Record<string, unknown>) || {};
    const templateConfig = (template.defaultConfig as Record<string, unknown>) || {};
      
    const jobConfig = {
      ...templateConfig,
      ...scheduleConfig,
      _scheduledExecution: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        executedAt: new Date().toISOString(),
      },
    };

    // Create job options
    const jobOptions = {
      priority: (schedule.priority ?? template.defaultPriority ?? 0) as number,
      attempts: (schedule.retryAttempts ?? template.defaultRetryAttempts ?? 3) as number,
      backoff: {
        type: "exponential" as const,
        delay: (schedule.retryDelay ?? template.defaultRetryDelay ?? 60000) as number,
      },
      removeOnComplete: 10,
      removeOnFail: 20,
    };

    // Add timeout if specified
    if (schedule.timeout || template.defaultTimeout) {
      (jobOptions as any).timeout = (schedule.timeout || template.defaultTimeout) as number;
    }

    // Queue the job
    const job = await queue.add(
      `scheduled-${template.name}-${Date.now()}`,
      jobConfig,
      jobOptions,
    );

    // Store job info in database
    const db = this.databaseService.db;
    await db.insert(jobs).values({
      jobType: template.category,
      jobName: `${schedule.name} (Scheduled)`,
      description: `Scheduled execution of ${template.displayName}`,
      queue: template.queueName,
      status: "pending",
      priority: jobOptions.priority as number,
      inputData: JSON.stringify(jobConfig),
      createdBy: "scheduler",
      tags: JSON.stringify(["scheduled", schedule.id]),
    });

    return job.id;
  }

  private async handleScheduleFailure(scheduleId: string, error: Error) {
    const db = this.databaseService.db;

    // Get current schedule
    const [schedule] = await db
      .select()
      .from(jobSchedules)
      .where(eq(jobSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) return;

    const newFailureCount = schedule.consecutiveFailures + 1;

    // Update failure count
    await db
      .update(jobSchedules)
      .set({
        consecutiveFailures: newFailureCount,
        updatedAt: new Date(),
      })
      .where(eq(jobSchedules.id, scheduleId));

    // Check if we should disable the schedule
    if (
      schedule.disableOnMaxFailures &&
      newFailureCount >= schedule.maxConsecutiveFailures
    ) {
      await db
        .update(jobSchedules)
        .set({
          isEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(jobSchedules.id, scheduleId));

      await this.stopSchedule(scheduleId);

      this.logger.warn({
        msg: "Schedule disabled due to consecutive failures",
        scheduleId,
        scheduleName: schedule.name,
        failureCount: newFailureCount,
      });
    }
  }

  private calculateNextRunTime(cronExpression: string, timezone?: string): Date {
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone || "UTC",
      };

      const interval = (parser as any).parseExpression(cronExpression, options);
      return interval.next().toDate();
    } catch (_error) {
      this.logger.error({
        msg: "Failed to calculate next run time",
        cronExpression,
        timezone,
        error: (_error as Error).message,
      });
      // Default to 1 hour from now
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  private async checkScheduleUpdates() {
    const db = this.databaseService.db;

    try {
      // Check for schedules that should have run
      const overdueSchedules = await db
        .select()
        .from(jobSchedules)
        .where(
          and(
            eq(jobSchedules.isEnabled, true),
            lte(jobSchedules.nextRunAt, new Date()),
          ),
        );

      for (const schedule of overdueSchedules) {
        if (!this.activeSchedules.has(schedule.id)) {
          // Schedule is not active but should be
          this.logger.warn({
            msg: "Found overdue schedule not in active list",
            scheduleId: schedule.id,
            scheduleName: schedule.name,
          });

          // Try to start it
          await this.startSchedule({
            ...schedule,
            jobConfig: schedule.jobConfig as JsonValue,
          });
        }
      }
    } catch (_error) {
      this.logger.error({
        msg: "Error checking schedule updates",
        error: (_error as Error).message,
      });
    }
  }

  private async getLastJobInfo(jobId: string) {
    const db = this.databaseService.db;

    const [job] = await db
      .select({
        id: jobs.id,
        status: jobs.status,
        startedAt: jobs.startedAt,
        completedAt: jobs.completedAt,
        duration: jobs.duration,
        errorMessage: jobs.errorMessage,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    return job;
  }
}
