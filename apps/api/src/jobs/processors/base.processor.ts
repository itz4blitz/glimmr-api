import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { jobs, jobLogs } from "../../database/schema";
import { eq } from "drizzle-orm";

export interface ProcessorContext {
  logger: Logger;
  databaseService: DatabaseService;
  jobId?: string;
}

export abstract class BaseProcessor {
  protected logger: Logger;
  protected databaseService: DatabaseService;
  private dbJobId?: string;

  constructor(protected context: ProcessorContext) {
    this.logger = context.logger;
    this.databaseService = context.databaseService;
  }

  /**
   * Process the job - to be implemented by subclasses
   */
  abstract process(job: Job): Promise<any>;

  /**
   * Main entry point that wraps the process method with logging
   */
  async execute(job: Job): Promise<any> {
    const startTime = Date.now();

    try {
      // Create database job record
      await this.createJobRecord(job);

      // Log job start
      await this.logToDatabase("info", `Job ${job.name} started`, {
        queueName: job.queueName,
        attemptNumber: job.attemptsMade,
        data: job.data,
      });

      // Execute the actual processing
      const result = await this.process(job);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Update job record as completed
      await this.updateJobRecord("completed", result, duration);

      // Log completion
      await this.logToDatabase(
        "success",
        `Job ${job.name} completed successfully`,
        {
          duration,
          result: result?.summary || result,
        },
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update job record as failed
      await this.updateJobRecord("failed", null, duration, error);

      // Log error
      await this.logToDatabase(
        "error",
        `Job ${job.name} failed: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
          duration,
        },
      );

      throw error;
    }
  }

  /**
   * Create initial job record in database
   */
  private async createJobRecord(job: Job) {
    try {
      const [dbJob] = await this.databaseService.db
        .insert(jobs)
        .values({
          jobType: this.getJobType(job.queueName),
          jobName: job.name,
          description: `${job.queueName} - ${job.name}`,
          queue: job.queueName,
          status: "running",
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning({ id: jobs.id });

      this.dbJobId = dbJob.id;
    } catch (error) {
      this.logger.error("Failed to create job record", error);
    }
  }

  /**
   * Update job record with completion status
   */
  private async updateJobRecord(
    status: "completed" | "failed",
    output: any,
    duration: number,
    error?: Error,
  ) {
    if (!this.dbJobId) return;

    try {
      await this.databaseService.db
        .update(jobs)
        .set({
          status,
          completedAt: new Date(),
          duration,
          outputData: output ? JSON.stringify(output) : null,
          errorMessage: error?.message,
          errorStack: error?.stack,
          progressPercentage: status === "completed" ? 100 : undefined,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, this.dbJobId));
    } catch (err) {
      this.logger.error("Failed to update job record", err);
    }
  }

  /**
   * Log message to database
   */
  protected async logToDatabase(
    level: "info" | "warn" | "error" | "debug" | "success",
    message: string,
    data?: any,
  ) {
    if (!this.dbJobId) return;

    try {
      await this.databaseService.db.insert(jobLogs).values({
        jobId: this.dbJobId,
        level: level === "success" ? "info" : level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (error) {
      this.logger.error("Failed to log to database", error);
    }
  }

  /**
   * Update job progress
   */
  protected async updateProgress(
    percentage: number,
    completedSteps?: number,
    totalSteps?: number,
  ) {
    if (!this.dbJobId) return;

    try {
      await this.databaseService.db
        .update(jobs)
        .set({
          progressPercentage: percentage,
          completedSteps,
          totalSteps,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, this.dbJobId));
    } catch (error) {
      this.logger.error("Failed to update job progress", error);
    }
  }

  /**
   * Map queue name to job type
   */
  private getJobType(queueName: string): string {
    const typeMap: Record<string, string> = {
      "price-file-download": "data_import",
      "price-update": "price_update",
      "analytics-refresh": "analytics_calculation",
      "export-data": "report_generation",
      "pra-unified-scan": "data_import",
      "pra-file-download": "data_import",
    };

    return typeMap[queueName] || "data_import";
  }
}
