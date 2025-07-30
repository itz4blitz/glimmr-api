# 🚀 Glimmr Infrastructure

This directory contains the Docker configurations for the Glimmr infrastructure components.

## 📁 Structure

```
infrastructure/
├── traefik/          # Reverse proxy and SSL termination
│   ├── docker-compose.yml
│   ├── traefik.yml
│   └── dynamic/      # Dynamic configuration files
└── authentik/        # Authentication and authorization
    ├── docker-compose.yml
    └── .env.example
```

## 🔧 Setup Instructions

### 1. Prerequisites

- Docker and Docker Compose installed
- Domain names configured (auth.glimmr.health, traefik.glimmr.health)
- Cloudflare API credentials for SSL certificates

### 2. Environment Configuration

```bash
# Copy and configure environment files
cp infrastructure/authentik/.env.example infrastructure/authentik/.env

# Edit the .env file with your actual values:
# - Generate PG_PASS: openssl rand -base64 32
# - Generate AUTHENTIK_SECRET_KEY: openssl rand -base64 60
# - Set AUTHENTIK_BOOTSTRAP_PASSWORD to your desired admin password
```

### 3. Network Setup

```bash
# Create Docker networks
docker network create glimmr-frontend
docker network create glimmr-backend
```

### 4. Deployment

```bash
# Deploy Traefik first
cd infrastructure/traefik
docker compose up -d

# Deploy Authentik
cd ../authentik
docker compose up -d
```

## 🌐 Access Points

- **Traefik Dashboard**: https://traefik.glimmr.health (admin:GlimmrHealth2025!)
- **Authentik Admin**: https://auth.glimmr.health
- **Airbyte**: https://airbyte.glimmr.health

## 🔐 Default Credentials

- **Authentik Admin**: 
  - Username: `akadmin`
  - Password: Set in `AUTHENTIK_BOOTSTRAP_PASSWORD`

## 🛠️ Troubleshooting

### CSRF Issues
If you encounter CSRF errors in Authentik, ensure:
- `AUTHENTIK_WEB__TRUSTED_ORIGINS` includes all your domains
- Restart Authentik containers after changes

### SSL Certificate Issues
- Verify Cloudflare API credentials
- Check DNS propagation
- Review Traefik logs: `docker compose logs traefik`

## 📝 Notes

- All sensitive data should be in `.env` files (not committed to git)
- SSL certificates are automatically managed by Traefik + Cloudflare
- Authentik uses PostgreSQL and Redis for data storage
