import { pgTable, uuid, varchar, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Job identification
  jobType: varchar('job_type', { length: 50 }).notNull(), // 'data_import', 'price_update', 'analytics_calculation'
  jobName: varchar('job_name', { length: 100 }).notNull(),
  description: text('description'),
  queue: varchar('queue', { length: 50 }), // Queue name for BullMQ job tracking
  
  // Job status
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  priority: integer('priority').default(0), // Higher numbers = higher priority
  
  // Execution details
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // Duration in milliseconds
  
  // Progress tracking
  totalSteps: integer('total_steps'),
  completedSteps: integer('completed_steps').default(0),
  progressPercentage: integer('progress_percentage').default(0),
  
  // Input/Output
  inputData: text('input_data'), // JSON string of input parameters
  outputData: text('output_data'), // JSON string of results
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  
  // Resource tracking
  recordsProcessed: integer('records_processed').default(0),
  recordsCreated: integer('records_created').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  recordsFailed: integer('records_failed').default(0),
  
  // Scheduling
  scheduledFor: timestamp('scheduled_for'),
  isRecurring: boolean('is_recurring').default(false),
  cronExpression: varchar('cron_expression', { length: 100 }),
  nextRunAt: timestamp('next_run_at'),
  
  // Metadata
  createdBy: varchar('created_by', { length: 100 }), // User or system that created the job
  tags: text('tags'), // JSON array of tags for categorization
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('jobs_type_idx').on(table.jobType),
  statusIdx: index('jobs_status_idx').on(table.status),
  priorityIdx: index('jobs_priority_idx').on(table.priority),
  startedAtIdx: index('jobs_started_at_idx').on(table.startedAt),
  completedAtIdx: index('jobs_completed_at_idx').on(table.completedAt),
  scheduledForIdx: index('jobs_scheduled_for_idx').on(table.scheduledFor),
  nextRunAtIdx: index('jobs_next_run_at_idx').on(table.nextRunAt),
  createdAtIdx: index('jobs_created_at_idx').on(table.createdAt),
  statusPriorityIdx: index('jobs_status_priority_idx').on(table.status, table.priority),
  typeStatusIdx: index('jobs_type_status_idx').on(table.jobType, table.status),
}));

// Job logs for detailed tracking
export const jobLogs = pgTable('job_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  
  level: varchar('level', { length: 10 }).notNull(), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  data: text('data'), // JSON string of additional data
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  jobIdx: index('job_logs_job_idx').on(table.jobId),
  levelIdx: index('job_logs_level_idx').on(table.level),
  createdAtIdx: index('job_logs_created_at_idx').on(table.createdAt),
  jobCreatedAtIdx: index('job_logs_job_created_at_idx').on(table.jobId, table.createdAt),
}));

// Zod schemas for validation
export const insertJobSchema = createInsertSchema(jobs, {
  jobType: z.enum(['data_import', 'price_update', 'analytics_calculation', 'data_cleanup', 'report_generation']),
  jobName: z.string().min(1).max(100),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).default('pending'),
  priority: z.number().int().min(-100).max(100).default(0),
  progressPercentage: z.number().int().min(0).max(100).default(0),
});

export const insertJobLogSchema = createInsertSchema(jobLogs, {
  level: z.enum(['info', 'warn', 'error', 'debug']),
  message: z.string().min(1),
});

export const selectJobSchema = createSelectSchema(jobs);
export const selectJobLogSchema = createSelectSchema(jobLogs);

export type Job = z.infer<typeof selectJobSchema>;
export type NewJob = z.infer<typeof insertJobSchema>;
export type JobLog = z.infer<typeof selectJobLogSchema>;
export type NewJobLog = z.infer<typeof insertJobLogSchema>;
