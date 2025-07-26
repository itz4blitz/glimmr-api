-- Re-queue downloaded files for parsing
-- This will trigger the price-file-parser queue for all downloaded files

-- First, let's see how many files we have
SELECT 'Files ready for parsing:' as info, COUNT(*) as count 
FROM price_transparency_files 
WHERE processing_status = 'downloaded' AND storage_key IS NOT NULL;

-- Update the processing status to trigger re-parsing
-- We'll set them to 'pending' which should trigger the download processor to re-queue them
UPDATE price_transparency_files 
SET processing_status = 'pending', 
    updated_at = NOW()
WHERE processing_status = 'downloaded' 
  AND storage_key IS NOT NULL;

-- Verify the update
SELECT 'Files updated to pending:' as info, COUNT(*) as count 
FROM price_transparency_files 
WHERE processing_status = 'pending';