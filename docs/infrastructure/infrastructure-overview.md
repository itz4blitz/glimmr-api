# 🚀 Glimmr Infrastructure

This directory contains the Docker configurations for the Glimmr infrastructure components.

## 📁 Structure

```
infrastructure/
├── cloudflare/       # Cloudflare tunnel for global access
├── airflow/         # Airflow orchestration
├── airbyte/         # Data integration  
├── dbt/             # Data transformation
├── authentik/       # Authentication service
├── secrets/         # 1Password integration
└── scripts/         # Infrastructure deployment scripts
```

## 🚀 Quick Deployment

### Single Command Setup

Use the master deployment scripts from the tools directory:

```bash
# Complete local development setup
./tools/scripts/dev-setup.sh

# Complete production deployment
./tools/scripts/deploy-prod.sh
```

### Manual Component Deployment

#### Cloudflare Tunnel (Global Access)
```bash
cd infrastructure/cloudflare
docker-compose up -d
```

#### Airflow (Job Orchestration)
```bash
cd infrastructure/airflow  
docker-compose up -d
```

#### Airbyte (Data Integration)
```bash
abctl local install
```

#### Authentik (Authentication)
```bash
cd infrastructure/authentik
docker-compose up -d
```

## 🌐 Access Points

### Local Development
- **API**: http://localhost:3000
- **Web App**: http://localhost:5174
- **Airflow**: http://localhost:8081
- **Airbyte**: http://localhost:8000
- **Authentik**: http://localhost:9002

### Global Access (Cloudflare Tunnel)
- **API**: https://dev-api.glimmr.health
- **Web App**: https://dev-app.glimmr.health
- **Airflow**: https://dev-airflow.glimmr.health
- **Airbyte**: https://dev-airbyte.glimmr.health
- **Authentik**: https://dev-auth.glimmr.health

## 🔐 Security

### 1Password Integration
All secrets are managed through 1Password:
- Database credentials
- API keys
- SSL certificates
- Cloudflare tokens

### Database Security
- Dedicated users with least-privilege access
- No superuser access for applications
- Secure password generation

## 🛠️ Health Checks

All infrastructure components include comprehensive health checks:

```bash
# Run complete health verification
./tools/scripts/health-check.sh
```

## 📝 Development Notes

- All services run in Docker containers
- Environment-specific configurations
- Automatic SSL via Cloudflare
- Zero-trust networking through Cloudflare Tunnel
- Enterprise-grade authentication with Authentik