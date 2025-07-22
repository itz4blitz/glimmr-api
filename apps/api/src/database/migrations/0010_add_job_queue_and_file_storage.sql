-- Add queue field to jobs table
ALTER TABLE "jobs" ADD COLUMN "queue" varchar(50);

-- Add storage fields to price_transparency_files table
ALTER TABLE "price_transparency_files" ADD COLUMN "storage_key" varchar(500);
ALTER TABLE "price_transparency_files" ADD COLUMN "file_hash" varchar(64);

-- Create indexes for new fields
CREATE INDEX "jobs_queue_idx" ON "jobs" USING btree ("queue");
CREATE INDEX "price_files_storage_key_idx" ON "price_transparency_files" USING btree ("storage_key");