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

## 🚀 Automated Deployment (Recommended)

### 1. GitHub Actions Setup

1. **Add SSH Key to GitHub Secrets:**
   ```bash
   # Generate SSH key pair
   ssh-keygen -t ed25519 -C "github-actions@glimmr.health"

   # Add private key to GitHub Secrets as SSH_PRIVATE_KEY
   # Add public key to server: ~/.ssh/authorized_keys
   ```

2. **Push to Main Branch:**
   ```bash
   git push origin main
   # Automatically deploys infrastructure changes!
   ```

### 2. Manual Setup (One-time)

```bash
# On your server (104.243.44.8)
sudo mkdir -p /opt/glimmr/{traefik,authentik,airbyte,argocd}
sudo chown -R blitz:blitz /opt/glimmr

# Create environment files from templates
cp infrastructure/environments/production/.env.template /opt/glimmr/.env
# Edit /opt/glimmr/.env with your actual secrets

# Create service-specific .env files
cp /opt/glimmr/.env /opt/glimmr/traefik/.env
cp /opt/glimmr/.env /opt/glimmr/authentik/.env
cp /opt/glimmr/.env /opt/glimmr/airbyte/.env
```

### 3. GitOps with ArgoCD (Advanced)

```bash
# Deploy ArgoCD for GitOps
cd /opt/glimmr/argocd
docker compose up -d

# Access ArgoCD at https://argocd.glimmr.health
# Default login: admin / (get password from container logs)
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
