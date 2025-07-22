-- Drop the existing unique constraint on external_file_id
ALTER TABLE "price_transparency_files" DROP CONSTRAINT IF EXISTS "price_transparency_files_external_file_id_unique";

-- Drop any existing index with the same name if it exists
DROP INDEX IF EXISTS "price_files_hospital_external_id_idx";

-- Create the compound unique index for hospital_id + external_file_id
CREATE UNIQUE INDEX "price_files_hospital_external_id_idx" ON "price_transparency_files" USING btree ("hospital_id","external_file_id");