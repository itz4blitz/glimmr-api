# 🔒 Glimmr Database Security Setup

## Overview

This document outlines the secure database configuration implemented for the Glimmr healthcare pricing platform, providing least-privilege access with dedicated database users for enhanced security.

## 🛡️ Security Implementation

### Database Users Created

| User | Purpose | Permissions | Password |
|------|---------|-------------|----------|
| `glimmr_api_user` | Main API operations | Full CRUD on all tables | `glimmr_api_secure_2025!` |
| `glimmr_analytics_user` | Reporting & analytics | Read-only on all tables | `glimmr_analytics_secure_2025!` |
| `glimmr_readonly_user` | Monitoring & backups | Read-only on all tables | `glimmr_readonly_secure_2025!` |
| `glimmr_backup_user` | Production backups | Read-only + replication | Production only |

### Security Benefits

✅ **Least Privilege Access**: Each user has only the minimum permissions needed  
✅ **Attack Surface Reduction**: No superuser access for application users  
✅ **Audit Trail**: Separate users enable better activity tracking  
✅ **Incident Containment**: Compromised user limited to specific operations  
✅ **Production Ready**: Scales to production with secrets management  

## 🔧 Connection Strings

### Development Environment

```bash
# Main API Database (Full Access)
postgresql://glimmr_api_user:glimmr_api_secure_2025!@localhost:5432/glimmr

# Analytics Database (Read-Only)
postgresql://glimmr_analytics_user:glimmr_analytics_secure_2025!@localhost:5432/glimmr

# Monitoring Database (Read-Only)
postgresql://glimmr_readonly_user:glimmr_readonly_secure_2025!@localhost:5432/glimmr

# Redis Cache
redis://default:glimmr123@localhost:6379/0

# Airflow Database (Separate)
postgresql://airflow:airflow_dev_password_123@localhost:5432/airflow
```

### Test Connections

```bash
# Test API user
psql postgresql://glimmr_api_user:glimmr_api_secure_2025!@localhost:5432/glimmr

# Test analytics user
psql postgresql://glimmr_analytics_user:glimmr_analytics_secure_2025!@localhost:5432/glimmr

# Test Redis
redis-cli -h localhost -p 6379 -a glimmr123
```

## 📋 Updated Access Points

### 🚀 Main Application
- **API**: http://localhost:3000 ✅
- **API Docs**: http://localhost:3000/api/v1/docs ✅
- **Web UI**: http://localhost:5174 ✅

### 🔧 Data & Infrastructure Tools
- **Airbyte**: http://localhost:8000 ✅
  - Email: `justinscroggins@outlook.com`
  - Password: `ZJbjlmuqI68eK2OHEjw8xYZrmRQLikeM`
- **Airflow**: http://localhost:8081 ✅
  - Username: `admin`
  - Password: `admin123`
- **MinIO Console**: http://localhost:9001 ✅
  - Username: `minioadmin`
  - Password: `minioadmin`
- **Authentik**: http://localhost:9002 ✅
  - First visit: Create admin user
- **Cloudflare Tunnel**: Configure via Cloudflare Dashboard ✅
- **Inbucket (Email Testing)**: http://localhost:8025 ✅

## 🏗️ Files Created

### Security Implementation
- `scripts/init-db-security.sql` - Development security setup
- `infrastructure/production/secure-db-init.sql` - Production security template
- `apps/api/.env.secure` - Secure environment template
- `apps/api/.env.docker.secure` - Docker-specific secure config

### Usage
```bash
# Apply security setup (already done)
docker exec -i glimmr-postgres psql -U postgres < scripts/init-db-security.sql

# Use secure environment
cp apps/api/.env.docker.secure apps/api/.env.docker
docker restart glimmr-api
```

## 🏭 Production Considerations

### 1. Secrets Management
- Replace hardcoded passwords with 1Password/AWS Secrets Manager
- Use environment variable substitution: `${GLIMMR_API_DB_PASSWORD}`
- Rotate passwords regularly (90-day cycle recommended)

### 2. SSL/TLS Configuration
```sql
-- Enable SSL in production
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/server.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/server.key';
```

### 3. Connection Limits & Monitoring
```sql
-- Set connection limits
ALTER USER glimmr_api_user CONNECTION LIMIT 50;
ALTER USER glimmr_analytics_user CONNECTION LIMIT 10;

-- Enable audit logging
CREATE EXTENSION pgaudit;
SET pgaudit.log = 'all';
```

### 4. Row Level Security (Future Enhancement)
```sql
-- Enable RLS for multi-tenant isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users FOR ALL TO glimmr_api_user USING (organization_id = current_setting('app.current_org')::uuid);
```

## 🔍 Security Verification

### Check User Permissions
```sql
-- Verify users exist with correct permissions
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolconnlimit 
FROM pg_roles 
WHERE rolname LIKE 'glimmr_%';

-- Check table permissions
SELECT grantee, table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE grantee LIKE 'glimmr_%'
ORDER BY grantee, table_name;
```

### Test Access Restrictions
```bash
# Should work: API user can insert
psql postgresql://glimmr_api_user:glimmr_api_secure_2025!@localhost:5432/glimmr -c "INSERT INTO users (email) VALUES ('test@example.com');"

# Should work: Analytics user can read
psql postgresql://glimmr_analytics_user:glimmr_analytics_secure_2025!@localhost:5432/glimmr -c "SELECT COUNT(*) FROM users;"

# Should fail: Analytics user cannot write
psql postgresql://glimmr_analytics_user:glimmr_analytics_secure_2025!@localhost:5432/glimmr -c "INSERT INTO users (email) VALUES ('test@example.com');"
```

## ✅ Security Checklist

- [x] Dedicated database users created with least-privilege access
- [x] Application using secure database credentials
- [x] Connection limits configured
- [x] Sensitive permissions revoked
- [x] Development and production templates created
- [x] Documentation and verification procedures established
- [ ] Production secrets management integration (next phase)
- [ ] SSL/TLS certificates configuration (production)
- [ ] Row-level security implementation (future enhancement)
- [ ] Regular security audit procedures (operational)

## 🚨 Security Notes

1. **Never commit passwords to version control** - Use `.env.example` files instead
2. **Change default passwords** in production environments
3. **Monitor database connections** for unusual activity
4. **Regular security audits** of user permissions
5. **Backup encryption** for sensitive data protection

---

*Database security implemented with least-privilege access principles for enhanced protection of healthcare data.*