CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('job_success', 'job_failure', 'job_warning', 'system_alert', 'user_action', 'info');--> statement-breakpoint
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
	"external_id" varchar(100),
	"npi_number" varchar(10),
	"cms_provider_number" varchar(6),
	"ccn" varchar(10),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"price_transparency_files" text,
	"last_file_check" timestamp,
	"data_source" varchar(100) NOT NULL,
	"source_url" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hospitals_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "hospitals_npi_number_unique" UNIQUE("npi_number"),
	CONSTRAINT "hospitals_cms_provider_number_unique" UNIQUE("cms_provider_number")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"file_id" varchar(100),
	"description" text,
	"code" varchar(50),
	"code_type" varchar(20),
	"service_name" varchar(255),
	"service_code" varchar(50),
	"category" varchar(100),
	"gross_charge" numeric(12, 2),
	"discounted_cash_price" numeric(12, 2),
	"minimum_negotiated_charge" numeric(12, 2),
	"maximum_negotiated_charge" numeric(12, 2),
	"minimum_negotiated_rate" numeric(12, 2),
	"maximum_negotiated_rate" numeric(12, 2),
	"payer_specific_negotiated_charges" text,
	"payer_rates" text,
	"raw_data" text,
	"data_source" varchar(100) DEFAULT 'price_transparency_file',
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
CREATE TABLE "price_transparency_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"external_file_id" varchar(100) NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(10) NOT NULL,
	"file_size" integer,
	"file_url" text,
	"storage_key" varchar(500),
	"file_hash" varchar(64),
	"last_retrieved" timestamp,
	"processed_at" timestamp,
	"record_count" integer,
	"processing_status" varchar(20) DEFAULT 'pending',
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"api_key" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_email" boolean DEFAULT true NOT NULL,
	"notification_push" boolean DEFAULT true NOT NULL,
	"notification_sms" boolean DEFAULT false NOT NULL,
	"theme_preference" varchar(20) DEFAULT 'system',
	"language_preference" varchar(10) DEFAULT 'en',
	"timezone_preference" varchar(50) DEFAULT 'UTC',
	"date_format" varchar(20) DEFAULT 'MM/DD/YYYY',
	"time_format" varchar(10) DEFAULT '12h',
	"privacy_settings" jsonb,
	"dashboard_layout" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" text,
	"avatar_url" varchar(500),
	"phone_number" varchar(20),
	"timezone" varchar(50) DEFAULT 'UTC',
	"language_preference" varchar(10) DEFAULT 'en',
	"date_of_birth" timestamp,
	"company" varchar(100),
	"job_title" varchar(100),
	"city" varchar(100),
	"country" varchar(100),
	"website" varchar(200),
	"linkedin_url" varchar(200),
	"twitter_url" varchar(200),
	"github_url" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"job_success_enabled" boolean DEFAULT true NOT NULL,
	"job_failure_enabled" boolean DEFAULT true NOT NULL,
	"job_warning_enabled" boolean DEFAULT true NOT NULL,
	"system_alert_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" "notification_type" NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
	"queue" varchar(50),
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
ALTER TABLE "price_transparency_files" ADD CONSTRAINT "price_transparency_files_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_files" ADD CONSTRAINT "user_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_template_id_job_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."job_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_last_job_id_jobs_id_fk" FOREIGN KEY ("last_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "hospitals_active_state_idx" ON "hospitals" USING btree ("is_active","state");--> statement-breakpoint
CREATE INDEX "hospitals_active_state_city_idx" ON "hospitals" USING btree ("is_active","state","city");--> statement-breakpoint
CREATE INDEX "hospitals_active_last_updated_idx" ON "hospitals" USING btree ("is_active","last_updated");--> statement-breakpoint
CREATE INDEX "hospitals_ccn_idx" ON "hospitals" USING btree ("ccn");--> statement-breakpoint
CREATE INDEX "prices_hospital_idx" ON "prices" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "prices_service_name_idx" ON "prices" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "prices_code_idx" ON "prices" USING btree ("code");--> statement-breakpoint
CREATE INDEX "prices_category_idx" ON "prices" USING btree ("category");--> statement-breakpoint
CREATE INDEX "prices_hospital_service_idx" ON "prices" USING btree ("hospital_id","service_name");--> statement-breakpoint
CREATE INDEX "prices_hospital_code_idx" ON "prices" USING btree ("hospital_id","code");--> statement-breakpoint
CREATE INDEX "prices_gross_charge_idx" ON "prices" USING btree ("gross_charge");--> statement-breakpoint
CREATE INDEX "prices_active_idx" ON "prices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "prices_last_updated_idx" ON "prices" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "prices_reporting_period_idx" ON "prices" USING btree ("reporting_period");--> statement-breakpoint
CREATE INDEX "prices_file_id_idx" ON "prices" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "prices_hospital_active_idx" ON "prices" USING btree ("hospital_id","is_active");--> statement-breakpoint
CREATE INDEX "prices_active_updated_idx" ON "prices" USING btree ("is_active","last_updated");--> statement-breakpoint
CREATE INDEX "prices_hospital_active_updated_idx" ON "prices" USING btree ("hospital_id","is_active","last_updated");--> statement-breakpoint
CREATE INDEX "prices_active_service_idx" ON "prices" USING btree ("is_active","service_name");--> statement-breakpoint
CREATE INDEX "prices_active_category_idx" ON "prices" USING btree ("is_active","category");--> statement-breakpoint
CREATE INDEX "prices_active_gross_charge_idx" ON "prices" USING btree ("is_active","gross_charge");--> statement-breakpoint
CREATE INDEX "prices_active_hospital_service_idx" ON "prices" USING btree ("is_active","hospital_id","service_name");--> statement-breakpoint
CREATE INDEX "prices_hospital_reporting_period_idx" ON "prices" USING btree ("hospital_id","reporting_period");--> statement-breakpoint
CREATE INDEX "price_files_hospital_idx" ON "price_transparency_files" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "price_files_external_id_idx" ON "price_transparency_files" USING btree ("external_file_id");--> statement-breakpoint
CREATE INDEX "price_files_status_idx" ON "price_transparency_files" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "price_files_retrieved_idx" ON "price_transparency_files" USING btree ("last_retrieved");--> statement-breakpoint
CREATE INDEX "price_files_processed_idx" ON "price_transparency_files" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "price_files_active_idx" ON "price_transparency_files" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "price_files_hospital_external_id_idx" ON "price_transparency_files" USING btree ("hospital_id","external_file_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_api_key_idx" ON "users" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "permissions_name_idx" ON "permissions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "permissions_resource_idx" ON "permissions" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "permissions_action_idx" ON "permissions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "permissions_active_idx" ON "permissions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "permissions_resource_action_idx" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "role_permissions_role_permission_idx" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_permissions_active_idx" ON "role_permissions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_active_idx" ON "roles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_roles_user_role_idx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_active_idx" ON "user_roles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_roles_expires_idx" ON "user_roles" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_used_idx" ON "password_reset_tokens" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "user_activity_logs_user_id_idx" ON "user_activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_action_idx" ON "user_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_activity_logs_resource_idx" ON "user_activity_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_timestamp_idx" ON "user_activity_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "user_activity_logs_success_idx" ON "user_activity_logs" USING btree ("success");--> statement-breakpoint
CREATE INDEX "user_files_user_id_idx" ON "user_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_files_type_idx" ON "user_files" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "user_files_active_idx" ON "user_files" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_files_uploaded_idx" ON "user_files" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_theme_idx" ON "user_preferences" USING btree ("theme_preference");--> statement-breakpoint
CREATE INDEX "user_preferences_language_idx" ON "user_preferences" USING btree ("language_preference");--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_timezone_idx" ON "user_profiles" USING btree ("timezone");--> statement-breakpoint
CREATE INDEX "user_profiles_country_idx" ON "user_profiles" USING btree ("country");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_token_idx" ON "user_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "user_sessions_active_idx" ON "user_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "job_queue_configs_queue_name_idx" ON "job_queue_configs" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "job_queue_configs_enabled_idx" ON "job_queue_configs" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "job_schedules_template_idx" ON "job_schedules" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "job_schedules_enabled_idx" ON "job_schedules" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "job_schedules_next_run_idx" ON "job_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "job_schedules_last_run_idx" ON "job_schedules" USING btree ("last_run_at");--> statement-breakpoint
CREATE INDEX "job_schedules_name_idx" ON "job_schedules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "job_templates_name_idx" ON "job_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "job_templates_category_idx" ON "job_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "job_templates_queue_idx" ON "job_templates" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "job_templates_active_idx" ON "job_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "job_templates_schedulable_idx" ON "job_templates" USING btree ("is_schedulable");--> statement-breakpoint
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