CREATE TABLE "price_transparency_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"external_file_id" varchar(100) NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(10) NOT NULL,
	"file_size" integer,
	"file_url" text,
	"last_retrieved" timestamp,
	"processed_at" timestamp,
	"record_count" integer,
	"processing_status" varchar(20) DEFAULT 'pending',
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "price_transparency_files_external_file_id_unique" UNIQUE("external_file_id")
);
--> statement-breakpoint
DROP INDEX "prices_service_idx";--> statement-breakpoint
DROP INDEX "prices_code_idx";--> statement-breakpoint
DROP INDEX "prices_hospital_code_idx";--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "service_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "gross_charge" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "data_source" SET DEFAULT 'price_transparency_file';--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "data_source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "external_id" varchar(100);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "ccn" varchar(10);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "price_transparency_files" text;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "last_file_check" timestamp;--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "file_id" varchar(100);--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "code" varchar(50);--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "minimum_negotiated_charge" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "maximum_negotiated_charge" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "payer_specific_negotiated_charges" text;--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "raw_data" text;--> statement-breakpoint
ALTER TABLE "price_transparency_files" ADD CONSTRAINT "price_transparency_files_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_files_hospital_idx" ON "price_transparency_files" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "price_files_external_id_idx" ON "price_transparency_files" USING btree ("external_file_id");--> statement-breakpoint
CREATE INDEX "price_files_status_idx" ON "price_transparency_files" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "price_files_retrieved_idx" ON "price_transparency_files" USING btree ("last_retrieved");--> statement-breakpoint
CREATE INDEX "price_files_processed_idx" ON "price_transparency_files" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "price_files_active_idx" ON "price_transparency_files" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "prices_service_name_idx" ON "prices" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "prices_file_id_idx" ON "prices" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "prices_code_idx" ON "prices" USING btree ("code");--> statement-breakpoint
CREATE INDEX "prices_hospital_code_idx" ON "prices" USING btree ("hospital_id","code");--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_external_id_unique" UNIQUE("external_id");