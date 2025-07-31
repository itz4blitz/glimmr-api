-- =============================================================================
-- GLIMMR PRODUCTION DATABASE SECURITY INITIALIZATION
-- =============================================================================
-- This script creates dedicated database users with least-privilege access
-- for production environments with strong passwords and enhanced security.

-- =============================================================================
-- PRODUCTION SECURITY NOTES:
-- =============================================================================
-- 1. Change all passwords to use secrets management (1Password, AWS Secrets, etc.)
-- 2. Use SSL/TLS connections in production
-- 3. Enable audit logging
-- 4. Regular security reviews of permissions
-- 5. Rotate passwords regularly

-- =============================================================================
-- CREATE DEDICATED USERS WITH STRONG PASSWORDS
-- =============================================================================

-- 1. API User: Full read/write access to glimmr database only
-- TODO: Replace with secret from 1Password in production
CREATE USER glimmr_api_user WITH 
    PASSWORD '${GLIMMR_API_DB_PASSWORD}' -- Use secret management
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION;

-- 2. Analytics User: Read-only access to specific tables for reporting
-- TODO: Replace with secret from 1Password in production
CREATE USER glimmr_analytics_user WITH 
    PASSWORD '${GLIMMR_ANALYTICS_DB_PASSWORD}' -- Use secret management
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION;

-- 3. Readonly User: Read-only access for monitoring/backup tools
-- TODO: Replace with secret from 1Password in production
CREATE USER glimmr_readonly_user WITH 
    PASSWORD '${GLIMMR_READONLY_DB_PASSWORD}' -- Use secret management
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION;

-- 4. Backup User: For database backups and maintenance
CREATE USER glimmr_backup_user WITH 
    PASSWORD '${GLIMMR_BACKUP_DB_PASSWORD}' -- Use secret management
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    REPLICATION; -- Required for logical replication backups

-- =============================================================================
-- GRANT DATABASE ACCESS
-- =============================================================================

GRANT CONNECT ON DATABASE glimmr TO glimmr_api_user;
GRANT CONNECT ON DATABASE glimmr TO glimmr_analytics_user;
GRANT CONNECT ON DATABASE glimmr TO glimmr_readonly_user;
GRANT CONNECT ON DATABASE glimmr TO glimmr_backup_user;

-- Switch to the glimmr database for schema-level permissions
\c glimmr;

-- =============================================================================
-- API USER PERMISSIONS (Full CRUD on application tables)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO glimmr_api_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO glimmr_api_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO glimmr_api_user;

-- Future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO glimmr_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO glimmr_api_user;

-- =============================================================================
-- ANALYTICS USER PERMISSIONS (Read-only on specific tables)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO glimmr_analytics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO glimmr_analytics_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO glimmr_analytics_user;

-- Specific restrictions for sensitive data (customize based on your schema)
-- Example: REVOKE SELECT ON sensitive_table FROM glimmr_analytics_user;

-- =============================================================================
-- READONLY USER PERMISSIONS (Monitoring/observability)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO glimmr_readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO glimmr_readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO glimmr_readonly_user;

-- Additional monitoring permissions
GRANT SELECT ON pg_stat_database TO glimmr_readonly_user;
GRANT SELECT ON pg_stat_user_tables TO glimmr_readonly_user;

-- =============================================================================
-- BACKUP USER PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO glimmr_backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO glimmr_backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO glimmr_backup_user;

-- =============================================================================
-- SECURITY HARDENING
-- =============================================================================

-- Revoke dangerous permissions
REVOKE ALL ON SCHEMA information_schema FROM PUBLIC;
REVOKE ALL ON SCHEMA pg_catalog FROM PUBLIC;

-- Ensure application users cannot access system schemas
REVOKE ALL ON SCHEMA information_schema FROM glimmr_api_user, glimmr_analytics_user, glimmr_readonly_user, glimmr_backup_user;
REVOKE ALL ON SCHEMA pg_catalog FROM glimmr_api_user, glimmr_analytics_user, glimmr_readonly_user, glimmr_backup_user;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- =============================================================================
-- Enable RLS on sensitive tables for additional security
-- Example for production:

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY user_isolation ON users FOR ALL TO glimmr_api_user USING (true);

-- =============================================================================
-- AUDIT LOGGING SETUP
-- =============================================================================
-- Enable audit logging for security monitoring
-- This requires the pgaudit extension

-- CREATE EXTENSION IF NOT EXISTS pgaudit;
-- SET pgaudit.log = 'all';
-- SET pgaudit.log_relation = on;

-- =============================================================================
-- CONNECTION LIMITS
-- =============================================================================
-- Set connection limits to prevent resource exhaustion

ALTER USER glimmr_api_user CONNECTION LIMIT 50;
ALTER USER glimmr_analytics_user CONNECTION LIMIT 10;
ALTER USER glimmr_readonly_user CONNECTION LIMIT 5;
ALTER USER glimmr_backup_user CONNECTION LIMIT 2;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 
    rolname,
    rolsuper,
    rolcreatedb,
    rolcreaterole,
    rolcanlogin,
    rolreplication,
    rolconnlimit
FROM pg_roles 
WHERE rolname LIKE 'glimmr_%'
ORDER BY rolname;

COMMIT;