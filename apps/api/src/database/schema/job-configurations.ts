import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Job Templates - Define reusable job configurations
export const jobTemplates = pgTable('job_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Template identification
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(), // 'data_import', 'analytics', 'maintenance', etc.
  
  // Queue configuration
  queueName: varchar('queue_name', { length: 50 }).notNull(),
  
  // Default job settings
  defaultPriority: integer('default_priority').default(0),
  defaultTimeout: integer('default_timeout').default(300000), // 5 minutes in ms
  defaultRetryAttempts: integer('default_retry_attempts').default(3),
  defaultRetryDelay: integer('default_retry_delay').default(60000), // 1 minute in ms
  
  // Scheduling defaults
  defaultCronExpression: varchar('default_cron_expression', { length: 100 }),
  isSchedulable: boolean('is_schedulable').default(true),
  
  // Configuration schema (JSON Schema for validating job data)
  configSchema: jsonb('config_schema'), // JSON Schema for job input validation
  defaultConfig: jsonb('default_config'), // Default configuration values
  
  // Resource limits
  maxConcurrentJobs: integer('max_concurrent_jobs').default(1),
  estimatedDuration: integer('estimated_duration'), // Estimated duration in ms
  resourceRequirements: jsonb('resource_requirements'), // CPU, memory, etc.
  
  // Metadata
  isActive: boolean('is_active').default(true),
  createdBy: varchar('created_by', { length: 100 }),
  tags: jsonb('tags'), // Array of tags for categorization
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('job_templates_name_idx').on(table.name),
  categoryIdx: index('job_templates_category_idx').on(table.category),
  queueIdx: index('job_templates_queue_idx').on(table.queueName),
  activeIdx: index('job_templates_active_idx').on(table.isActive),
  schedulableIdx: index('job_templates_schedulable_idx').on(table.isSchedulable),
}));

// Job Schedules - Manage scheduled/recurring jobs
export const jobSchedules = pgTable('job_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Schedule identification
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Template reference
  templateId: uuid('template_id').notNull().references(() => jobTemplates.id, { onDelete: 'cascade' }),
  
  // Schedule configuration
  cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Job configuration overrides
  priority: integer('priority'),
  timeout: integer('timeout'),
  retryAttempts: integer('retry_attempts'),
  retryDelay: integer('retry_delay'),
  jobConfig: jsonb('job_config'), // Override default template config
  
  // Schedule status
  isEnabled: boolean('is_enabled').default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  lastJobId: uuid('last_job_id').references(() => jobs.id),
  
  // Error handling
  consecutiveFailures: integer('consecutive_failures').default(0),
  maxConsecutiveFailures: integer('max_consecutive_failures').default(5),
  disableOnMaxFailures: boolean('disable_on_max_failures').default(true),
  
  // Metadata
  createdBy: varchar('created_by', { length: 100 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  templateIdx: index('job_schedules_template_idx').on(table.templateId),
  enabledIdx: index('job_schedules_enabled_idx').on(table.isEnabled),
  nextRunIdx: index('job_schedules_next_run_idx').on(table.nextRunAt),
  lastRunIdx: index('job_schedules_last_run_idx').on(table.lastRunAt),
  nameIdx: index('job_schedules_name_idx').on(table.name),
}));

// Job Queue Configurations - Manage queue-level settings
export const jobQueueConfigs = pgTable('job_queue_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Queue identification
  queueName: varchar('queue_name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Queue settings
  isEnabled: boolean('is_enabled').default(true),
  maxConcurrency: integer('max_concurrency').default(1),
  defaultJobOptions: jsonb('default_job_options'), // Bull queue options
  
  // Cleanup settings
  removeOnComplete: integer('remove_on_complete').default(25),
  removeOnFail: integer('remove_on_fail').default(15),
  
  // Rate limiting
  rateLimitMax: integer('rate_limit_max'),
  rateLimitDuration: integer('rate_limit_duration'), // in ms
  
  // Monitoring settings
  alertOnFailureCount: integer('alert_on_failure_count').default(5),
  alertOnQueueSize: integer('alert_on_queue_size').default(100),
  
  // Metadata
  lastConfigUpdate: timestamp('last_config_update').defaultNow(),
  updatedBy: varchar('updated_by', { length: 100 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  queueNameIdx: index('job_queue_configs_queue_name_idx').on(table.queueName),
  enabledIdx: index('job_queue_configs_enabled_idx').on(table.isEnabled),
}));

// Import the jobs table reference
import { jobs } from './jobs';

// Zod schemas for validation
export const insertJobTemplateSchema = createInsertSchema(jobTemplates, {
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(150),
  category: z.enum(['data_import', 'analytics', 'maintenance', 'export', 'validation', 'monitoring']),
  queueName: z.string().min(1).max(50),
  defaultPriority: z.number().int().min(-100).max(100).default(0),
  defaultTimeout: z.number().int().min(1000).max(3600000).default(300000), // 1s to 1h
  defaultRetryAttempts: z.number().int().min(0).max(10).default(3),
  defaultRetryDelay: z.number().int().min(1000).max(600000).default(60000), // 1s to 10m
  maxConcurrentJobs: z.number().int().min(1).max(100).default(1),
});

export const insertJobScheduleSchema = createInsertSchema(jobSchedules, {
  name: z.string().min(1).max(100),
  cronExpression: z.string().min(1).max(100),
  timezone: z.string().default('UTC'),
  consecutiveFailures: z.number().int().min(0).default(0),
  maxConsecutiveFailures: z.number().int().min(1).max(50).default(5),
});

export const insertJobQueueConfigSchema = createInsertSchema(jobQueueConfigs, {
  queueName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  maxConcurrency: z.number().int().min(1).max(100).default(1),
  removeOnComplete: z.number().int().min(0).max(1000).default(25),
  removeOnFail: z.number().int().min(0).max(1000).default(15),
});

export const selectJobTemplateSchema = createSelectSchema(jobTemplates);
export const selectJobScheduleSchema = createSelectSchema(jobSchedules);
export const selectJobQueueConfigSchema = createSelectSchema(jobQueueConfigs);

export type JobTemplate = z.infer<typeof selectJobTemplateSchema>;
export type NewJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobSchedule = z.infer<typeof selectJobScheduleSchema>;
export type NewJobSchedule = z.infer<typeof insertJobScheduleSchema>;
export type JobQueueConfig = z.infer<typeof selectJobQueueConfigSchema>;
export type NewJobQueueConfig = z.infer<typeof insertJobQueueConfigSchema>;
