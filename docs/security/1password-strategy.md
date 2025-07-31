# 1Password Secret Management Strategy - Glimmr Healthcare Pipeline

## Secret Categories

### 1. Database Credentials
- **PostgreSQL Master**: `glimmr-postgres-master`
  - Username: `postgres`
  - Password: Auto-generated 32-char
  - Database: `healthcare_pricing`
  - Connection string with SSL

- **PostgreSQL App User**: `glimmr-postgres-app`
  - Username: `glimmr_app`
  - Password: Auto-generated 32-char
  - Limited permissions for API access

- **PostgreSQL Airflow User**: `glimmr-postgres-airflow`
  - Username: `airflow_user`
  - Password: Auto-generated 32-char
  - Permissions for pipeline operations

### 2. Cache & Queue Credentials
- **Redis Master**: `glimmr-redis-master`
  - Password: Auto-generated 32-char
  - Connection string for cache/queue

### 3. Orchestration Secrets
- **Airflow Admin**: `glimmr-airflow-admin`
  - Username: `admin`
  - Password: Auto-generated 24-char
  - Fernet key for encryption
  - Secret key for sessions

### 4. API Security
- **FastAPI Secrets**: `glimmr-api-secrets`
  - JWT secret key: Auto-generated 64-char
  - API rate limit keys
  - CORS origins configuration

### 5. Infrastructure Secrets
- **Traefik**: `glimmr-traefik-secrets`
  - Cloudflare API key (existing)
  - Basic auth for dashboard
  - SSL certificate paths

- **Monitoring**: `glimmr-monitoring-secrets`
  - Grafana admin credentials
  - Prometheus scrape tokens
  - Alert webhook URLs

### 6. External Service Credentials
- **GitHub Actions**: `glimmr-github-actions`
  - SSH private key for deployment
  - Docker registry credentials
  - 1Password service account token

## 1Password CLI Integration

### Installation & Setup
```bash
# Install 1Password CLI
curl -sS https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | tee /etc/apt/sources.list.d/1password.list
apt update && apt install 1password-cli

# Authenticate with service account
op account add --address glimmr.1password.com --email service-account@glimmr.health
op signin
```

### Secret Generation Script
```bash
#!/bin/bash
# generate-secrets.sh - Create all secrets in 1Password

# PostgreSQL secrets
op item create --category=database --title="glimmr-postgres-master" \
  --field="username=postgres" \
  --field="password=$(openssl rand -base64 32)" \
  --field="database=healthcare_pricing" \
  --field="host=postgres" \
  --field="port=5432"

# Redis secrets  
op item create --category=database --title="glimmr-redis-master" \
  --field="password=$(openssl rand -base64 32)" \
  --field="host=redis" \
  --field="port=6379"

# Airflow secrets
op item create --category=login --title="glimmr-airflow-admin" \
  --field="username=admin" \
  --field="password=$(openssl rand -base64 24)" \
  --field="fernet_key=$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')" \
  --field="secret_key=$(openssl rand -base64 64)"

# API secrets
op item create --category=api --title="glimmr-api-secrets" \
  --field="jwt_secret=$(openssl rand -base64 64)" \
  --field="api_key=$(openssl rand -base64 32)"
```

### GitHub Actions Integration
```yaml
# .github/workflows/deploy-secrets.yml
- name: Load secrets from 1Password
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
  run: |
    # Install 1Password CLI
    curl -sSfLo op.zip https://cache.agilebits.com/dist/1P/op2/pkg/v2.20.0/op_linux_amd64_v2.20.0.zip
    unzip -o op.zip && sudo mv op /usr/local/bin/
    
    # Load secrets and set as environment variables
    export POSTGRES_PASSWORD=$(op item get "glimmr-postgres-master" --field password)
    export REDIS_PASSWORD=$(op item get "glimmr-redis-master" --field password)
    export AIRFLOW_ADMIN_PASSWORD=$(op item get "glimmr-airflow-admin" --field password)
    export JWT_SECRET=$(op item get "glimmr-api-secrets" --field jwt_secret)
```

## Secret Rotation Strategy

### Automated Rotation (Monthly)
- Database passwords: Rotate monthly via GitHub Actions
- API keys: Rotate quarterly
- Infrastructure secrets: Rotate on security events

### Manual Rotation (As Needed)
- SSH keys: Annual or on compromise
- SSL certificates: Automatic via Let's Encrypt
- External service tokens: Per service policy

## Security Best Practices

1. **Principle of Least Privilege**: Each service gets only required secrets
2. **Secret Scoping**: Environment-specific secret isolation
3. **Audit Logging**: All secret access logged in 1Password
4. **Backup Strategy**: 1Password handles backup/recovery
5. **Emergency Access**: Break-glass procedures documented
