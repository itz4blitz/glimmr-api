-- Migration: Add Price Transparency Integration
-- This migration adds support for Patient Rights Advocate integration
-- and price transparency file processing

-- Add new columns to hospitals table for Patient Rights Advocate integration
ALTER TABLE hospitals 
ADD COLUMN external_id VARCHAR(100) UNIQUE,
ADD COLUMN ccn VARCHAR(10),
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN price_transparency_files TEXT,
ADD COLUMN last_file_check TIMESTAMP;

-- Update data_source enum to include patient_rights_advocate
-- Note: PostgreSQL doesn't support adding enum values in older versions
-- So we'll change the column type to VARCHAR if needed
-- ALTER TYPE data_source_enum ADD VALUE 'patient_rights_advocate';

-- Create price_transparency_files table
CREATE TABLE price_transparency_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    external_file_id VARCHAR(100) NOT NULL UNIQUE,
    
    -- File metadata
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size INTEGER,
    file_url TEXT,
    
    -- Processing metadata
    last_retrieved TIMESTAMP,
    processed_at TIMESTAMP,
    record_count INTEGER,
    
    -- Status tracking
    processing_status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add indexes for price_transparency_files
CREATE INDEX price_files_hospital_idx ON price_transparency_files(hospital_id);
CREATE INDEX price_files_external_id_idx ON price_transparency_files(external_file_id);
CREATE INDEX price_files_status_idx ON price_transparency_files(processing_status);
CREATE INDEX price_files_retrieved_idx ON price_transparency_files(last_retrieved);
CREATE INDEX price_files_processed_idx ON price_transparency_files(processed_at);
CREATE INDEX price_files_active_idx ON price_transparency_files(is_active);

-- Add new columns to prices table for better price transparency support
ALTER TABLE prices 
ADD COLUMN file_id VARCHAR(100),
ADD COLUMN code VARCHAR(50),
ADD COLUMN minimum_negotiated_charge DECIMAL(12, 2),
ADD COLUMN maximum_negotiated_charge DECIMAL(12, 2),
ADD COLUMN payer_specific_negotiated_charges TEXT,
ADD COLUMN raw_data TEXT;

-- Update existing prices table to make grossCharge nullable (some files might not have it)
ALTER TABLE prices ALTER COLUMN gross_charge DROP NOT NULL;
ALTER TABLE prices ALTER COLUMN service_name DROP NOT NULL;

-- Add indexes for new price fields
CREATE INDEX prices_file_id_idx ON prices(file_id);
CREATE INDEX prices_code_idx ON prices(code) WHERE code IS NOT NULL;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_price_transparency_files_updated_at 
    BEFORE UPDATE ON price_transparency_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some constraints
ALTER TABLE price_transparency_files 
ADD CONSTRAINT check_file_type 
CHECK (file_type IN ('csv', 'xlsx', 'xls', 'zip'));

ALTER TABLE price_transparency_files 
ADD CONSTRAINT check_processing_status 
CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create a view for hospital price transparency status
CREATE VIEW hospital_price_transparency_status AS
SELECT 
    h.id,
    h.name,
    h.state,
    h.city,
    h.external_id,
    h.last_file_check,
    COUNT(ptf.id) as total_files,
    COUNT(CASE WHEN ptf.processing_status = 'completed' THEN 1 END) as processed_files,
    COUNT(CASE WHEN ptf.processing_status = 'failed' THEN 1 END) as failed_files,
    COUNT(CASE WHEN ptf.processing_status = 'pending' THEN 1 END) as pending_files,
    SUM(ptf.record_count) as total_price_records,
    MAX(ptf.processed_at) as last_processed_at
FROM hospitals h
LEFT JOIN price_transparency_files ptf ON h.id = ptf.hospital_id AND ptf.is_active = true
WHERE h.is_active = true
GROUP BY h.id, h.name, h.state, h.city, h.external_id, h.last_file_check;

-- Insert some sample data source values
UPDATE hospitals SET data_source = 'patient_rights_advocate' WHERE data_source = 'api' AND external_id IS NOT NULL;
