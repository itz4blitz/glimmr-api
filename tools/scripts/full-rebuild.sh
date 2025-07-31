#!/bin/bash
set -e

echo "🔥 NUCLEAR REBUILD WITH CLOUDFLARE (NO TRAEFIK)"

# Stop everything
echo "Stopping all services..."
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true  
docker volume rm $(docker volume ls -q) 2>/dev/null || true
docker network rm $(docker network ls -q --filter type=custom) 2>/dev/null || true
abctl local uninstall --persisted 2>/dev/null || true

echo "🧹 Cleaning up..."
docker system prune -af --volumes

# Rebuild
echo "🚀 Rebuilding from scratch (NO TRAEFIK)..."
docker network create glimmr-backend
docker network create glimmr-frontend

# Copy secure config
cp apps/api/.env.docker.secure apps/api/.env.docker

# Start main stack WITHOUT TRAEFIK
docker-compose -f docker-compose.dev.yml up -d

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
sleep 30

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL health..."
until docker exec glimmr-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "  PostgreSQL not ready, waiting 5 more seconds..."
    sleep 5
done
echo "✅ PostgreSQL ready!"

# Initialize security
echo "🔒 Setting up database security..."
docker exec -i glimmr-postgres psql -U postgres < scripts/init-db-security.sql

# Deploy Airflow
echo "🌊 Deploying Airflow..."
cd infrastructure/airflow
docker compose up -d
cd ../..

# Wait for Airflow PostgreSQL
echo "⏳ Waiting for Airflow database..."
sleep 20

# Deploy Airbyte
echo "🔄 Deploying Airbyte..."
abctl local install

# Deploy Cloudflare Tunnel
echo "☁️ Deploying Cloudflare Tunnel..."
cd infrastructure/cloudflare
if [ -f .env ]; then
    echo "  Starting Cloudflare Tunnel..."
    docker compose up -d
    echo "✅ Cloudflare Tunnel deployed"
    echo ""
    echo "🌐 Your services are now accessible globally:"
    echo "  https://dev-api.yourdomain.com"
    echo "  https://dev-app.yourdomain.com" 
    echo "  https://dev-airflow.yourdomain.com"
    echo "  https://dev-airbyte.yourdomain.com"
else
    echo "⚠️  Cloudflare tunnel not configured"
    echo "   To enable global access:"
    echo "   1. Copy .env.example to .env"
    echo "   2. Add your Cloudflare tunnel token"
    echo "   3. Configure hostnames in Cloudflare Dashboard"
fi
cd ../..

echo ""
echo "✅ CLOUDFLARE REBUILD COMPLETE!"
echo ""
echo "🔗 Local Access Points:"
echo "  API: http://localhost:3000"
echo "  API Docs: http://localhost:3000/api/v1/docs"
echo "  Web UI: http://localhost:5174"
echo "  Airbyte: http://localhost:8000"
echo "  Airflow: http://localhost:8081"
echo "  MinIO: http://localhost:9001"
echo "  Authentik: http://localhost:9002"
echo ""
echo "🔑 Get Airbyte credentials:"
echo "  abctl local credentials"
echo ""
echo "☁️ Benefits of Cloudflare Tunnel:"
echo "  ✅ Global CDN performance"
echo "  ✅ Free SSL certificates"
echo "  ✅ DDoS protection"
echo "  ✅ WAF security"
echo "  ✅ Zero network configuration"
echo "  ✅ No more Traefik complexity!"