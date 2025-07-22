-- Job Management System Migration
-- This adds job configuration, templates, and scheduling capabilities

-- Job Templates - Define reusable job configurations
CREATE TABLE "job_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"queue_name" varchar(50) NOT NULL,
	"default_priority" integer DEFAULT 0,
	"default_timeout" integer DEFAULT 300000,
	"default_retry_attempts" integer DEFAULT 3,
	"default_retry_delay" integer DEFAULT 60000,
	"default_cron_expression" varchar(100),
	"is_schedulable" boolean DEFAULT true,
	"config_schema" jsonb,
	"default_config" jsonb,
	"max_concurrent_jobs" integer DEFAULT 1,
	"estimated_duration" integer,
	"resource_requirements" jsonb,
	"is_active" boolean DEFAULT true,
	"created_by" varchar(100),
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_templates_name_unique" UNIQUE("name")
);

-- Job Schedules - Manage scheduled/recurring jobs
CREATE TABLE "job_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"template_id" uuid NOT NULL,
	"cron_expression" varchar(100) NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC',
	"priority" integer,
	"timeout" integer,
	"retry_attempts" integer,
	"retry_delay" integer,
	"job_config" jsonb,
	"is_enabled" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"last_job_id" uuid,
	"consecutive_failures" integer DEFAULT 0,
	"max_consecutive_failures" integer DEFAULT 5,
	"disable_on_max_failures" boolean DEFAULT true,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Job Queue Configurations - Manage queue-level settings
CREATE TABLE "job_queue_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true,
	"max_concurrency" integer DEFAULT 1,
	"default_job_options" jsonb,
	"remove_on_complete" integer DEFAULT 25,
	"remove_on_fail" integer DEFAULT 15,
	"rate_limit_max" integer,
	"rate_limit_duration" integer,
	"alert_on_failure_count" integer DEFAULT 5,
	"alert_on_queue_size" integer DEFAULT 100,
	"last_config_update" timestamp DEFAULT now(),
	"updated_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_queue_configs_queue_name_unique" UNIQUE("queue_name")
);

-- Add foreign key constraints
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_template_id_job_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."job_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_last_job_id_jobs_id_fk" FOREIGN KEY ("last_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for performance
CREATE INDEX "job_templates_name_idx" ON "job_templates" USING btree ("name");
CREATE INDEX "job_templates_category_idx" ON "job_templates" USING btree ("category");
CREATE INDEX "job_templates_queue_idx" ON "job_templates" USING btree ("queue_name");
CREATE INDEX "job_templates_active_idx" ON "job_templates" USING btree ("is_active");
CREATE INDEX "job_templates_schedulable_idx" ON "job_templates" USING btree ("is_schedulable");

CREATE INDEX "job_schedules_template_idx" ON "job_schedules" USING btree ("template_id");
CREATE INDEX "job_schedules_enabled_idx" ON "job_schedules" USING btree ("is_enabled");
CREATE INDEX "job_schedules_next_run_idx" ON "job_schedules" USING btree ("next_run_at");
CREATE INDEX "job_schedules_last_run_idx" ON "job_schedules" USING btree ("last_run_at");
CREATE INDEX "job_schedules_name_idx" ON "job_schedules" USING btree ("name");

CREATE INDEX "job_queue_configs_queue_name_idx" ON "job_queue_configs" USING btree ("queue_name");
CREATE INDEX "job_queue_configs_enabled_idx" ON "job_queue_configs" USING btree ("is_enabled");

-- Insert default job templates for existing queues
INSERT INTO "job_templates" ("name", "display_name", "description", "category", "queue_name", "default_cron_expression", "created_by") VALUES
('hospital-import', 'Hospital Data Import', 'Import hospital data from Patient Rights Advocate', 'data_import', 'hospital-import', '0 2 * * *', 'system'),
('price-file-download', 'Price File Downloads', 'Download price transparency files from hospitals', 'data_import', 'price-file-download', NULL, 'system'),
('price-update', 'Price Data Processing', 'Process and validate price transparency data', 'data_import', 'price-update', NULL, 'system'),
('analytics-refresh', 'Analytics Refresh', 'Refresh analytics calculations and metrics', 'analytics', 'analytics-refresh', '0 */6 * * *', 'system'),
('data-validation', 'Data Validation', 'Validate data integrity and consistency', 'validation', 'data-validation', '0 3 * * *', 'system'),
('export-data', 'Data Export', 'Export data in various formats', 'export', 'export-data', NULL, 'system'),
('pra-unified-scan', 'PRA Unified Scan', 'Scan Patient Rights Advocate for hospital updates', 'monitoring', 'pra-unified-scan', '0 6,18 * * *', 'system'),
('pra-file-download', 'PRA File Downloads', 'Download files from Patient Rights Advocate', 'data_import', 'pra-file-download', NULL, 'system');

-- Insert default queue configurations
INSERT INTO "job_queue_configs" ("queue_name", "display_name", "description", "remove_on_complete", "remove_on_fail", "updated_by") VALUES
('hospital-import', 'Hospital Data Import', 'Queue for hospital data import jobs', 25, 15, 'system'),
('price-file-download', 'Price File Downloads', 'Queue for price file download jobs', 20, 15, 'system'),
('price-update', 'Price Data Processing', 'Queue for price data processing jobs', 25, 15, 'system'),
('analytics-refresh', 'Analytics Refresh', 'Queue for analytics refresh jobs', 15, 10, 'system'),
('data-validation', 'Data Validation', 'Queue for data validation jobs', 20, 15, 'system'),
('export-data', 'Data Export', 'Queue for data export jobs', 15, 10, 'system'),
('pra-unified-scan', 'PRA Unified Scan', 'Queue for PRA scanning jobs', 15, 10, 'system'),
('pra-file-download', 'PRA File Downloads', 'Queue for PRA file download jobs', 20, 15, 'system');
