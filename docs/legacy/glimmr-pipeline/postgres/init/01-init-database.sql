-- =============================================================================
-- GLIMMR HEALTHCARE PRICING DATABASE INITIALIZATION
-- =============================================================================

-- Create application users
CREATE USER glimmr_app WITH PASSWORD 'REPLACE_WITH_1PASSWORD_SECRET';
CREATE USER airflow_user WITH PASSWORD 'REPLACE_WITH_1PASSWORD_SECRET';

-- Create database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- MAIN RATES TABLE (PARTITIONED BY MONTH)
-- =============================================================================
CREATE TABLE insurance_rates (
    id BIGSERIAL,
    procedure_code VARCHAR(20) NOT NULL,
    insurance_company VARCHAR(255) NOT NULL,
    negotiated_rate DECIMAL(12,2) NOT NULL,
    provider_npi VARCHAR(10),
    provider_name VARCHAR(500),
    provider_tin VARCHAR(20),
    rate_type VARCHAR(50),
    billing_class VARCHAR(50),
    network_tier VARCHAR(10),
    modifiers TEXT[],
    effective_date DATE,
    last_seen DATE DEFAULT CURRENT_DATE,
    update_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (procedure_code, insurance_company, provider_npi, effective_date)
) PARTITION BY RANGE (effective_date);

-- Create monthly partitions for current year + next year
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..23 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'insurance_rates_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE %I PARTITION OF insurance_rates 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Indexes for performance
CREATE INDEX idx_rates_procedure_code ON insurance_rates(procedure_code);
CREATE INDEX idx_rates_insurance_company ON insurance_rates(insurance_company);
CREATE INDEX idx_rates_provider_npi ON insurance_rates(provider_npi);
CREATE INDEX idx_rates_last_seen ON insurance_rates(last_seen);
CREATE INDEX idx_rates_effective_date ON insurance_rates(effective_date);
CREATE INDEX idx_rates_negotiated_rate ON insurance_rates(negotiated_rate);

-- =============================================================================
-- FILE REGISTRY (NO STORAGE)
-- =============================================================================
CREATE TABLE file_registry (
    url TEXT PRIMARY KEY,
    file_hash VARCHAR(64),
    last_processed TIMESTAMP,
    last_modified TIMESTAMP,
    etag VARCHAR(255),
    size_bytes BIGINT,
    record_count INT,
    processing_seconds INT,
    error_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_file_registry_status ON file_registry(status);
CREATE INDEX idx_file_registry_last_processed ON file_registry(last_processed);

-- =============================================================================
-- PROCESSING ERRORS
-- =============================================================================
CREATE TABLE processing_errors (
    id SERIAL PRIMARY KEY,
    url TEXT,
    error_timestamp TIMESTAMP DEFAULT NOW(),
    error_type VARCHAR(100),
    error_message TEXT,
    sample_data TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT
);

CREATE INDEX idx_processing_errors_url ON processing_errors(url);
CREATE INDEX idx_processing_errors_resolved ON processing_errors(resolved);
CREATE INDEX idx_processing_errors_timestamp ON processing_errors(error_timestamp);

-- =============================================================================
-- RATE ANALYTICS MATERIALIZED VIEW
-- =============================================================================
CREATE MATERIALIZED VIEW rate_analytics AS
SELECT 
    procedure_code,
    insurance_company,
    COUNT(DISTINCT provider_npi) as provider_count,
    COUNT(*) as total_records,
    MIN(negotiated_rate) as min_rate,
    MAX(negotiated_rate) as max_rate,
    AVG(negotiated_rate) as avg_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY negotiated_rate) as median_rate,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY negotiated_rate) as q1_rate,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY negotiated_rate) as q3_rate,
    STDDEV(negotiated_rate) as rate_stddev,
    MAX(last_seen) as last_updated,
    COUNT(DISTINCT effective_date) as date_versions
FROM insurance_rates
WHERE last_seen > CURRENT_DATE - INTERVAL '30 days'
GROUP BY procedure_code, insurance_company;

-- Index for analytics lookups
CREATE UNIQUE INDEX idx_analytics_lookup ON rate_analytics(procedure_code, insurance_company);
CREATE INDEX idx_analytics_last_updated ON rate_analytics(last_updated);

-- =============================================================================
-- PROCEDURE CODE REFERENCE
-- =============================================================================
CREATE TABLE procedure_codes (
    code VARCHAR(20) PRIMARY KEY,
    code_type VARCHAR(10) NOT NULL, -- CPT, HCPCS, DRG, ICD
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INSURANCE COMPANY MAPPINGS
-- =============================================================================
CREATE TABLE insurance_mappings (
    id SERIAL PRIMARY KEY,
    raw_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(3,2),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_insurance_mappings_raw ON insurance_mappings(raw_name);
CREATE INDEX idx_insurance_mappings_normalized ON insurance_mappings(normalized_name);

-- =============================================================================
-- QUALITY METRICS
-- =============================================================================
CREATE TABLE quality_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE DEFAULT CURRENT_DATE,
    total_records BIGINT,
    missing_codes INT,
    invalid_rates INT,
    suspicious_rates INT,
    quality_score DECIMAL(5,2),
    processing_time_seconds INT,
    files_processed INT,
    files_failed INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_metrics_date ON quality_metrics(metric_date);

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

-- Application user permissions (read-only for API)
GRANT CONNECT ON DATABASE healthcare_pricing TO glimmr_app;
GRANT USAGE ON SCHEMA public TO glimmr_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO glimmr_app;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO glimmr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO glimmr_app;

-- Airflow user permissions (read-write for pipeline)
GRANT CONNECT ON DATABASE healthcare_pricing TO airflow_user;
GRANT USAGE ON SCHEMA public TO airflow_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO airflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO airflow_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO airflow_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO airflow_user;

-- =============================================================================
-- FUNCTIONS FOR MAINTENANCE
-- =============================================================================

-- Function to refresh analytics view
CREATE OR REPLACE FUNCTION refresh_rate_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY rate_analytics;
END;
$$ LANGUAGE plpgsql;

-- Function to create new monthly partition
CREATE OR REPLACE FUNCTION create_monthly_partition(target_date DATE)
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := DATE_TRUNC('month', target_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'insurance_rates_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF insurance_rates 
                   FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate quality score
CREATE OR REPLACE FUNCTION calculate_quality_score()
RETURNS DECIMAL AS $$
DECLARE
    total_records BIGINT;
    missing_codes INT;
    invalid_rates INT;
    quality_score DECIMAL;
BEGIN
    SELECT 
        COUNT(*),
        SUM(CASE WHEN procedure_code IS NULL OR procedure_code = '' THEN 1 ELSE 0 END),
        SUM(CASE WHEN negotiated_rate <= 0 OR negotiated_rate > 100000 THEN 1 ELSE 0 END)
    INTO total_records, missing_codes, invalid_rates
    FROM insurance_rates
    WHERE last_seen = CURRENT_DATE;
    
    IF total_records = 0 THEN
        RETURN 0;
    END IF;
    
    quality_score := 100.0 * (1 - (missing_codes + invalid_rates)::DECIMAL / total_records);
    
    INSERT INTO quality_metrics (total_records, missing_codes, invalid_rates, quality_score)
    VALUES (total_records, missing_codes, invalid_rates, quality_score);
    
    RETURN quality_score;
END;
$$ LANGUAGE plpgsql;
