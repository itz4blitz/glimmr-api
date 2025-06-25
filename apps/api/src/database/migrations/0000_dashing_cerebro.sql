CREATE TABLE "analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"metric_type" varchar(50) NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"state" varchar(2),
	"city" varchar(100),
	"hospital_id" uuid,
	"service_category" varchar(100),
	"service_name" varchar(255),
	"period" varchar(20) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"sample_size" integer,
	"confidence" numeric(5, 4),
	"metadata" text,
	"source_query" text,
	"dependencies" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"state" varchar(2) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address" text,
	"zip_code" varchar(10),
	"phone" varchar(20),
	"website" text,
	"email" varchar(255),
	"bed_count" integer,
	"ownership" varchar(50),
	"hospital_type" varchar(50),
	"teaching_status" boolean DEFAULT false,
	"trauma_level" varchar(10),
	"npi_number" varchar(10),
	"cms_provider_number" varchar(6),
	"data_source" varchar(100) NOT NULL,
	"source_url" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hospitals_npi_number_unique" UNIQUE("npi_number"),
	CONSTRAINT "hospitals_cms_provider_number_unique" UNIQUE("cms_provider_number")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"service_name" varchar(255) NOT NULL,
	"service_code" varchar(50),
	"code_type" varchar(20),
	"description" text,
	"category" varchar(100),
	"gross_charge" numeric(12, 2) NOT NULL,
	"discounted_cash_price" numeric(12, 2),
	"minimum_negotiated_rate" numeric(12, 2),
	"maximum_negotiated_rate" numeric(12, 2),
	"payer_rates" text,
	"data_source" varchar(100) NOT NULL,
	"source_url" text,
	"reporting_period" varchar(20),
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"data_quality" varchar(20) DEFAULT 'unknown',
	"has_negotiated_rates" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"level" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"data" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"job_name" varchar(100) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"total_steps" integer,
	"completed_steps" integer DEFAULT 0,
	"progress_percentage" integer DEFAULT 0,
	"input_data" text,
	"output_data" text,
	"error_message" text,
	"error_stack" text,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"scheduled_for" timestamp,
	"is_recurring" boolean DEFAULT false,
	"cron_expression" varchar(100),
	"next_run_at" timestamp,
	"created_by" varchar(100),
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_metric_idx" ON "analytics" USING btree ("metric_name");--> statement-breakpoint
CREATE INDEX "analytics_type_idx" ON "analytics" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "analytics_state_idx" ON "analytics" USING btree ("state");--> statement-breakpoint
CREATE INDEX "analytics_city_idx" ON "analytics" USING btree ("city");--> statement-breakpoint
CREATE INDEX "analytics_hospital_idx" ON "analytics" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "analytics_category_idx" ON "analytics" USING btree ("service_category");--> statement-breakpoint
CREATE INDEX "analytics_period_idx" ON "analytics" USING btree ("period");--> statement-breakpoint
CREATE INDEX "analytics_period_type_idx" ON "analytics" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "analytics_calculated_at_idx" ON "analytics" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "analytics_metric_period_idx" ON "analytics" USING btree ("metric_name","period");--> statement-breakpoint
CREATE INDEX "analytics_state_period_idx" ON "analytics" USING btree ("state","period");--> statement-breakpoint
CREATE INDEX "hospitals_name_idx" ON "hospitals" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hospitals_state_idx" ON "hospitals" USING btree ("state");--> statement-breakpoint
CREATE INDEX "hospitals_city_idx" ON "hospitals" USING btree ("city");--> statement-breakpoint
CREATE INDEX "hospitals_state_city_idx" ON "hospitals" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "hospitals_npi_idx" ON "hospitals" USING btree ("npi_number");--> statement-breakpoint
CREATE INDEX "hospitals_cms_idx" ON "hospitals" USING btree ("cms_provider_number");--> statement-breakpoint
CREATE INDEX "hospitals_active_idx" ON "hospitals" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "hospitals_last_updated_idx" ON "hospitals" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "prices_hospital_idx" ON "prices" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "prices_service_idx" ON "prices" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "prices_code_idx" ON "prices" USING btree ("service_code");--> statement-breakpoint
CREATE INDEX "prices_category_idx" ON "prices" USING btree ("category");--> statement-breakpoint
CREATE INDEX "prices_hospital_service_idx" ON "prices" USING btree ("hospital_id","service_name");--> statement-breakpoint
CREATE INDEX "prices_hospital_code_idx" ON "prices" USING btree ("hospital_id","service_code");--> statement-breakpoint
CREATE INDEX "prices_gross_charge_idx" ON "prices" USING btree ("gross_charge");--> statement-breakpoint
CREATE INDEX "prices_active_idx" ON "prices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "prices_last_updated_idx" ON "prices" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "prices_reporting_period_idx" ON "prices" USING btree ("reporting_period");--> statement-breakpoint
CREATE INDEX "job_logs_job_idx" ON "job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_logs_level_idx" ON "job_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "job_logs_created_at_idx" ON "job_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_logs_job_created_at_idx" ON "job_logs" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_priority_idx" ON "jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "jobs_started_at_idx" ON "jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "jobs_completed_at_idx" ON "jobs" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "jobs_scheduled_for_idx" ON "jobs" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_next_run_at_idx" ON "jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_priority_idx" ON "jobs" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "jobs_type_status_idx" ON "jobs" USING btree ("job_type","status");