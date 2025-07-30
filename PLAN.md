# 🚀 Docker + Portainer + A/B Deployment Infrastructure Plan

## 📋 Overview
Build modern Docker-based infrastructure on existing Ubuntu server featuring:
- **Portainer Community** for container management
- **Cloudflared tunnels** for secure access
- **Automated A/B deployments** via GitHub Actions
- **Zero-downtime** blue-green deployments
- **Canary releases** with traffic splitting
- **Automated rollbacks** on failure

## 🏗️ Architecture Components

### Core Infrastructure
- **Docker Engine** - Container runtime
- **Portainer CE** - Web-based container management
- **Traefik** - Reverse proxy with load balancing
- **Cloudflared** - Secure tunnel to Cloudflare
- **Docker Swarm** - Container orchestration (optional)

### Deployment Pipeline
- **GitHub Actions** - CI/CD automation
- **GitHub Container Registry** - Image storage
- **Blue-Green deployments** - Zero downtime
- **Canary releases** - Gradual rollouts
- **Automated testing** - Quality gates

### Monitoring & Security
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **AlertManager** - Automated alerts
- **Trivy** - Container vulnerability scanning
- **Docker security** - Hardened configurations

## 🎯 Phase 1: Base Infrastructure Setup

### 1.1 Docker Installation & User Setup
```bash
# Update existing Ubuntu system
sudo apt update && sudo apt upgrade -y

# Install Docker on Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Add blitz user to docker group
sudo usermod -aG docker blitz
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Test Docker access (should work without sudo)
docker ps
```

### 1.2 Docker Security Hardening
```bash
# Configure Docker daemon security on Ubuntu
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "userns-remap": "default",
  "no-new-privileges": true,
  "icc": false,
  "userland-proxy": false,
  "experimental": false,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Enable and restart Docker service
sudo systemctl enable docker
sudo systemctl restart docker

# Verify Docker daemon is running
sudo systemctl status docker
```

### 1.3 Network Setup
```bash
# Create custom Docker networks for service isolation
docker network create --driver bridge frontend
docker network create --driver bridge --internal backend
docker network create --driver bridge monitoring

# Verify networks created
docker network ls

# Create application directories
sudo mkdir -p /opt/app/{traefik,monitoring,scripts}
sudo chown -R blitz:blitz /opt/app
```

## 🎯 Phase 2: Core Services Deployment

### 2.1 Portainer Community Edition
```bash
# Create Portainer volume
docker volume create portainer_data

# Deploy Portainer
docker run -d \
  --name portainer \
  --restart=always \
  -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  --network frontend \
  portainer/portainer-ce:latest
```

### 2.2 Traefik Reverse Proxy
```yaml
# traefik/docker-compose.yml
version: '3.8'
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - ./dynamic:/etc/traefik/dynamic:ro
      - traefik-certs:/certs
    networks:
      - frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.premierstudio.ai`)"
      - "traefik.http.routers.dashboard.service=api@internal"

volumes:
  traefik-certs:

networks:
  frontend:
    external: true
```

### 2.3 Cloudflared Tunnel
```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create premierstudio-server

# Configure tunnel
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml << 'EOF'
tunnel: premierstudio-server
credentials-file: /home/blitz/.cloudflared/[TUNNEL-ID].json

ingress:
  - hostname: portainer.premierstudio.ai
    service: http://localhost:9000
  - hostname: traefik.premierstudio.ai
    service: http://localhost:8080
  - hostname: "*.premierstudio.ai"
    service: http://localhost:80
  - service: http_status:404
EOF

# Install as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 🎯 Phase 3: A/B Deployment Infrastructure

### 3.1 Application Template Structure
```yaml
# app/docker-compose.production.yml
version: '3.8'
services:
  app-blue:
    image: ghcr.io/itz4blitz/glimmr-api:${BLUE_VERSION:-latest}
    container_name: app-blue
    restart: unless-stopped
    networks:
      - frontend
      - backend
    environment:
      - NODE_ENV=production
      - VERSION=blue
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.app-blue.loadbalancer.server.port=3000"
      - "traefik.http.services.app-blue.loadbalancer.healthcheck.path=/health"

  app-green:
    image: ghcr.io/itz4blitz/glimmr-api:${GREEN_VERSION:-latest}
    container_name: app-green
    restart: unless-stopped
    networks:
      - frontend
      - backend
    environment:
      - NODE_ENV=production
      - VERSION=green
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.app-green.loadbalancer.server.port=3000"
      - "traefik.http.services.app-green.loadbalancer.healthcheck.path=/health"

networks:
  frontend:
    external: true
  backend:
    external: true
```

### 3.2 Traffic Splitting Configuration
```yaml
# traefik/dynamic/app-routing.yml
http:
  services:
    app-weighted:
      weighted:
        services:
          - name: app-blue
            weight: 100  # Start with 100% to blue
          - name: app-green
            weight: 0    # 0% to green initially

  routers:
    app-main:
      rule: "Host(`api.premierstudio.ai`)"
      service: app-weighted
      tls:
        certResolver: cloudflare
      middlewares:
        - secure-headers

  middlewares:
    secure-headers:
      headers:
        accessControlAllowMethods:
          - GET
          - OPTIONS
          - PUT
          - POST
        accessControlAllowOriginList:
          - "https://premierstudio.ai"
        accessControlMaxAge: 100
        addVaryHeader: true
```

## 🎯 Phase 4: CI/CD Pipeline Setup

### 4.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: A/B Deployment Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
      - name: Run tests
        run: |
          docker run --rm ${{ steps.meta.outputs.tags }} npm test

  deploy-canary:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy Green (Canary)
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/app
            export GREEN_VERSION="${{ needs.build-and-test.outputs.image-tag }}"
            docker compose -f docker-compose.production.yml up -d app-green
            
            # Health check
            sleep 30
            curl -f http://localhost:3000/health || exit 1
            
            # Start canary with 10% traffic
            curl -X PUT http://localhost:8080/api/rawdata \
              -H "Content-Type: application/json" \
              -d '{"http":{"services":{"app-weighted":{"weighted":{"services":[{"name":"app-blue","weight":90},{"name":"app-green","weight":10}]}}}}}'

  monitor-and-promote:
    needs: deploy-canary
    runs-on: ubuntu-latest
    steps:
      - name: Monitor Canary (10 minutes)
        run: |
          for i in {1..20}; do
            response=$(curl -s -o /dev/null -w "%{http_code}" https://api.premierstudio.ai/health)
            if [ $response -ne 200 ]; then
              echo "Health check failed: $response"
              exit 1
            fi
            sleep 30
          done
          
      - name: Promote to Full Traffic
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            # Promote green to 100%
            curl -X PUT http://localhost:8080/api/rawdata \
              -H "Content-Type: application/json" \
              -d '{"http":{"services":{"app-weighted":{"weighted":{"services":[{"name":"app-green","weight":100}]}}}}}'
            
            # Wait and stop blue
            sleep 60
            docker compose -f docker-compose.production.yml stop app-blue
```

## 🎯 Phase 5: Monitoring & Observability

### 5.1 Monitoring Stack
```yaml
# monitoring/docker-compose.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - monitoring
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.prometheus.rule=Host(`prometheus.premierstudio.ai`)"

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.premierstudio.ai`)"

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    external: true
```

## 🎯 Phase 6: Deployment Scripts

### 6.1 Deployment Automation
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
DEPLOYMENT_TYPE=${3:-blue-green}  # blue-green or canary

echo "🚀 Starting deployment..."
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"
echo "Type: $DEPLOYMENT_TYPE"

# Health check function
health_check() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health; then
            echo "✅ $service is healthy"
            return 0
        fi
        echo "⏳ Waiting for $service to be healthy (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    echo "❌ $service failed health check"
    return 1
}

# Deploy new version to green
echo "📦 Deploying version $VERSION to green environment..."
export GREEN_VERSION=$VERSION
docker compose -f docker-compose.production.yml up -d app-green

# Health check
if ! health_check "app-green"; then
    echo "❌ Deployment failed - rolling back"
    docker compose -f docker-compose.production.yml stop app-green
    exit 1
fi

if [ "$DEPLOYMENT_TYPE" = "canary" ]; then
    echo "🐤 Starting canary deployment (10% traffic)"
    # Update Traefik config for 10% traffic to green
    # Monitor for specified time
    # Promote or rollback based on metrics
else
    echo "🔄 Starting blue-green deployment"
    # Switch all traffic to green
    # Stop blue after verification
fi

echo "✅ Deployment completed successfully"
```

## 📊 Success Metrics

### Key Performance Indicators
- **Deployment frequency**: Multiple times per day
- **Lead time**: < 30 minutes from commit to production
- **Mean time to recovery**: < 5 minutes
- **Change failure rate**: < 5%
- **Zero downtime**: 99.9% uptime during deployments

### Monitoring Dashboards
- **Application metrics**: Response time, error rate, throughput
- **Infrastructure metrics**: CPU, memory, disk, network
- **Deployment metrics**: Success rate, rollback frequency
- **Business metrics**: User engagement, conversion rates

## 🔐 Security Considerations

### Container Security
- Non-root user execution
- Read-only filesystems where possible
- Minimal base images (Alpine/Distroless)
- Regular vulnerability scanning
- Secrets management via Docker secrets

### Network Security
- Internal networks for backend services
- TLS termination at Traefik
- Cloudflare WAF protection
- Rate limiting and DDoS protection

### Access Control
- Portainer RBAC
- GitHub Actions secrets
- SSH key-based authentication
- Audit logging

## 🚀 Implementation Timeline

### Week 1: Foundation
- [ ] Docker installation and hardening on Ubuntu
- [ ] User permissions and security setup
- [ ] Portainer deployment
- [ ] Basic networking setup
- [ ] Cloudflared tunnel configuration

### Week 2: Core Services
- [ ] Traefik reverse proxy
- [ ] Application containerization
- [ ] Basic deployment pipeline
- [ ] Health checks implementation

### Week 3: A/B Infrastructure
- [ ] Blue-green deployment setup
- [ ] Traffic splitting configuration
- [ ] Automated rollback mechanisms
- [ ] Canary release pipeline

### Week 4: Monitoring & Polish
- [ ] Prometheus and Grafana setup
- [ ] Alerting configuration
- [ ] Security scanning integration
- [ ] Documentation and runbooks

This plan provides a complete, production-ready Docker infrastructure on Ubuntu with modern DevOps practices, automated deployments, and enterprise-grade reliability. No virtualization layer needed - containers provide excellent isolation and performance on the bare metal Ubuntu server.
