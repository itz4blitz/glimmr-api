-- Insert job templates for each queue type
INSERT INTO job_templates (name, display_name, description, category, queue_name, default_priority, default_timeout, default_retry_attempts, default_retry_delay, default_cron_expression, is_schedulable, max_concurrent_jobs, created_by) VALUES
-- PRA Unified Scan - Weekly scan for new hospitals
('pra-unified-scan-weekly', 'PRA Weekly Hospital Scan', 'Scans Patient Rights Advocate API for new hospitals and updates', 'data_import', 'pra-unified-scan', 5, 1800000, 3, 300000, '0 2 * * 1', true, 1, 'system'),

-- Hospital Import - Daily until complete
('hospital-import-daily', 'Hospital Data Import', 'Imports detailed hospital information', 'data_import', 'hospital-import', 3, 600000, 3, 60000, '0 3 * * *', true, 5, 'system'),

-- Price File Download - Continuous processing
('price-file-download-continuous', 'Price File Download', 'Downloads hospital pricing files', 'data_import', 'price-file-download', 2, 300000, 5, 30000, '*/30 * * * *', true, 10, 'system'),

-- Price Update - After downloads
('price-update-batch', 'Price Data Processing', 'Processes downloaded price files', 'data_processing', 'price-update', 2, 900000, 3, 120000, '0 */2 * * *', true, 5, 'system'),

-- Analytics Refresh - Daily at night
('analytics-refresh-daily', 'Analytics Daily Refresh', 'Refreshes analytics and aggregated data', 'analytics', 'analytics-refresh', 1, 3600000, 2, 300000, '0 5 * * *', true, 1, 'system'),

-- Data Validation - Twice daily
('data-validation-check', 'Data Validation Check', 'Validates data integrity and completeness', 'maintenance', 'data-validation', 1, 1800000, 2, 180000, '0 6,18 * * *', true, 2, 'system');

-- Insert actual schedules based on templates
INSERT INTO job_schedules (name, description, template_id, cron_expression, timezone, priority, is_enabled, created_by) VALUES
-- PRA Scan - Every Monday at 2 AM
('pra-weekly-scan', 'Weekly scan for new hospitals from PRA', 
 (SELECT id FROM job_templates WHERE name = 'pra-unified-scan-weekly'), 
 '0 2 * * 1', 'America/Los_Angeles', 5, true, 'system'),

-- Hospital Import - Every day at 3 AM until all hospitals are imported
('hospital-daily-import', 'Daily import of hospital data until complete', 
 (SELECT id FROM job_templates WHERE name = 'hospital-import-daily'), 
 '0 3 * * *', 'America/Los_Angeles', 3, true, 'system'),

-- Price File Download - Every 30 minutes during business hours
('price-file-regular-download', 'Regular download of price files during business hours', 
 (SELECT id FROM job_templates WHERE name = 'price-file-download-continuous'), 
 '*/30 7-22 * * *', 'America/Los_Angeles', 2, true, 'system'),

-- Price Update - Every 2 hours
('price-data-processing', 'Process downloaded price files every 2 hours', 
 (SELECT id FROM job_templates WHERE name = 'price-update-batch'), 
 '0 */2 * * *', 'America/Los_Angeles', 2, true, 'system'),

-- Analytics - Daily at 5 AM
('analytics-daily-refresh', 'Daily analytics data refresh', 
 (SELECT id FROM job_templates WHERE name = 'analytics-refresh-daily'), 
 '0 5 * * *', 'America/Los_Angeles', 1, true, 'system'),

-- Data Validation - Twice daily
('data-validation-regular', 'Regular data validation checks', 
 (SELECT id FROM job_templates WHERE name = 'data-validation-check'), 
 '0 6,18 * * *', 'America/Los_Angeles', 1, true, 'system');

-- Update next run times based on cron expressions
UPDATE job_schedules 
SET next_run_at = CASE 
    WHEN cron_expression = '0 2 * * 1' THEN 
        -- Next Monday at 2 AM
        date_trunc('week', CURRENT_TIMESTAMP + interval '1 week') + interval '1 day 2 hours'
    WHEN cron_expression = '0 3 * * *' THEN 
        -- Tomorrow at 3 AM
        date_trunc('day', CURRENT_TIMESTAMP + interval '1 day') + interval '3 hours'
    WHEN cron_expression = '*/30 7-22 * * *' THEN 
        -- Next half hour during business hours
        CASE 
            WHEN EXTRACT(hour FROM CURRENT_TIMESTAMP) >= 7 AND EXTRACT(hour FROM CURRENT_TIMESTAMP) < 22 THEN
                date_trunc('hour', CURRENT_TIMESTAMP) + interval '30 minutes' * CEIL(EXTRACT(minute FROM CURRENT_TIMESTAMP) / 30.0)
            ELSE 
                date_trunc('day', CURRENT_TIMESTAMP + interval '1 day') + interval '7 hours'
        END
    WHEN cron_expression = '0 */2 * * *' THEN 
        -- Next even hour
        date_trunc('hour', CURRENT_TIMESTAMP) + interval '2 hours' * CEIL(EXTRACT(hour FROM CURRENT_TIMESTAMP) / 2.0)
    WHEN cron_expression = '0 5 * * *' THEN 
        -- Tomorrow at 5 AM
        date_trunc('day', CURRENT_TIMESTAMP + interval '1 day') + interval '5 hours'
    WHEN cron_expression = '0 6,18 * * *' THEN 
        -- Next 6 AM or 6 PM
        CASE 
            WHEN EXTRACT(hour FROM CURRENT_TIMESTAMP) < 6 THEN 
                date_trunc('day', CURRENT_TIMESTAMP) + interval '6 hours'
            WHEN EXTRACT(hour FROM CURRENT_TIMESTAMP) < 18 THEN 
                date_trunc('day', CURRENT_TIMESTAMP) + interval '18 hours'
            ELSE 
                date_trunc('day', CURRENT_TIMESTAMP + interval '1 day') + interval '6 hours'
        END
    ELSE CURRENT_TIMESTAMP + interval '1 hour'
END;