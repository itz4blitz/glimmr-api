import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { JobsService } from "../services/core/jobs.service";
import { DatabaseService } from "../../database/database.service";
import { jobSchedules, jobTemplates } from "../../database/schema";
import { eq, and, lte, or, isNull } from "drizzle-orm";
// Removed cron-parser import - using built-in date calculation

@Injectable()
export class ScheduleProcessor implements OnModuleInit, OnModuleDestroy {
  private isProcessing = false;

  constructor(
    @InjectPinoLogger(ScheduleProcessor.name)
    private readonly logger: PinoLogger,
    private readonly jobsService: JobsService,
    private readonly databaseService: DatabaseService,
  ) {}

  onModuleInit() {
    this.logger.info("Schedule processor initialized");
  }

  onModuleDestroy() {
    this.logger.info("Schedule processor shutting down");
  }

  // Run every minute to check for scheduled jobs
  @Cron("* * * * *")
  async processScheduledJobs() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;
    const db = this.databaseService.db;

    try {
      // Find all schedules that are due to run
      const now = new Date();
      const dueSchedules = await db
        .select({
          schedule: jobSchedules,
          template: jobTemplates,
        })
        .from(jobSchedules)
        .innerJoin(jobTemplates, eq(jobSchedules.templateId, jobTemplates.id))
        .where(
          and(
            eq(jobSchedules.isEnabled, true),
            or(
              isNull(jobSchedules.nextRunAt),
              lte(jobSchedules.nextRunAt, now),
            ),
          ),
        );

      for (const { schedule, template } of dueSchedules) {
        try {
          this.logger.info({
            msg: "Processing scheduled job",
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            templateName: template.name,
            queueName: template.queueName,
          });

          // Create the job based on the template
          const templateConfig =
            typeof template.defaultConfig === "object"
              ? template.defaultConfig
              : {};
          const scheduleConfig =
            typeof schedule.jobConfig === "object" ? schedule.jobConfig : {};

          const jobData = {
            ...(templateConfig as any),
            ...(scheduleConfig as any),
            scheduleId: schedule.id,
            scheduleName: schedule.name,
          };

          // Add the job to the appropriate queue
          const queue = this.jobsService.getQueueByName(template.queueName);
          if (!queue) {
            throw new Error(`Queue not found: ${template.queueName}`);
          }

          const job = await queue.add(schedule.name, jobData, {
            priority: schedule.priority || template.defaultPriority || 0,
            delay: 0,
            attempts:
              schedule.retryAttempts || template.defaultRetryAttempts || 3,
            backoff: {
              type: "exponential",
              delay: schedule.retryDelay || template.defaultRetryDelay || 60000,
            },
            removeOnComplete: template.estimatedDuration
              ? {
                  age: 24 * 3600, // 24 hours
                  count: 100,
                }
              : true,
            removeOnFail: {
              age: 7 * 24 * 3600, // 7 days
              count: 50,
            },
          });

          this.logger.info({
            msg: "Scheduled job created",
            jobId: job.id,
            scheduleName: schedule.name,
            queueName: template.queueName,
          });

          // Update the schedule with next run time and last job ID
          const nextRunAt = this.calculateNextRunTime(
            schedule.cronExpression,
            schedule.timezone || "UTC",
          );

          await db
            .update(jobSchedules)
            .set({
              lastRunAt: now,
              nextRunAt,
              lastJobId: job.id,
              consecutiveFailures: 0, // Reset on successful scheduling
              updatedAt: now,
            })
            .where(eq(jobSchedules.id, schedule.id));
        } catch (error) {
          this.logger.error({
            msg: "Failed to process scheduled job",
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            error: error.message,
          });

          // Update consecutive failures
          await db
            .update(jobSchedules)
            .set({
              consecutiveFailures: schedule.consecutiveFailures + 1,
              updatedAt: now,
            })
            .where(eq(jobSchedules.id, schedule.id));

          // Disable schedule if it exceeds max failures
          if (
            schedule.disableOnMaxFailures &&
            schedule.consecutiveFailures + 1 >= schedule.maxConsecutiveFailures
          ) {
            await db
              .update(jobSchedules)
              .set({
                isEnabled: false,
                updatedAt: now,
              })
              .where(eq(jobSchedules.id, schedule.id));

            this.logger.warn({
              msg: "Schedule disabled due to consecutive failures",
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              failures: schedule.consecutiveFailures + 1,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error({
        msg: "Error in schedule processor",
        error: error.message,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private calculateNextRunTime(cronExpression: string, timezone: string): Date {
    // Simple next run time calculation based on common patterns
    const now = new Date();
    const parts = cronExpression.split(" ");

    if (parts.length !== 5) {
      // Invalid cron, default to 1 hour from now
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Handle simple daily jobs (e.g., "0 3 * * *" = daily at 3 AM)
    if (
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*" &&
      minute !== "*" &&
      hour !== "*"
    ) {
      const nextRun = new Date(now);
      nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);

      // If already past today's run time, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      return nextRun;
    }

    // Handle hourly jobs (e.g., "0 * * * *" = every hour)
    if (
      minute !== "*" &&
      hour === "*" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      const nextRun = new Date(now);
      nextRun.setMinutes(parseInt(minute), 0, 0);

      // If already past this hour's run time, schedule for next hour
      if (nextRun <= now) {
        nextRun.setHours(nextRun.getHours() + 1);
      }
      return nextRun;
    }

    // Handle every N hours (e.g., "0 */2 * * *" = every 2 hours)
    if (minute !== "*" && hour.startsWith("*/")) {
      const interval = parseInt(hour.substring(2));
      const nextRun = new Date(now);
      const currentHour = nextRun.getHours();
      const nextHour = Math.ceil(currentHour / interval) * interval;
      nextRun.setHours(nextHour, parseInt(minute), 0, 0);

      if (nextRun <= now) {
        nextRun.setHours(nextRun.getHours() + interval);
      }
      return nextRun;
    }

    // Handle weekly jobs (e.g., "0 2 * * 1" = Monday at 2 AM)
    if (
      minute !== "*" &&
      hour !== "*" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek !== "*"
    ) {
      const targetDay = parseInt(dayOfWeek);
      const nextRun = new Date(now);
      nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);

      // Find next occurrence of target day
      const currentDay = nextRun.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd < 0 || (daysToAdd === 0 && nextRun <= now)) {
        daysToAdd += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysToAdd);
      return nextRun;
    }

    // Default to 1 hour from now for unsupported patterns
    this.logger.warn({
      msg: "Unsupported cron pattern, defaulting to 1 hour",
      cronExpression,
    });
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}
