#!/bin/bash

# Glimmr Infrastructure Deployment Script

set -e

echo "🚀 Deploying Glimmr Infrastructure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create networks if they don't exist
print_status "Creating Docker networks..."
docker network create glimmr-frontend 2>/dev/null || print_warning "Network glimmr-frontend already exists"
docker network create glimmr-backend 2>/dev/null || print_warning "Network glimmr-backend already exists"

# Deploy Traefik first
print_status "Deploying Traefik..."
cd traefik
if [ ! -f .env ]; then
    print_warning "No .env file found in traefik directory. Please create one with CF_API_KEY."
fi
docker compose up -d
cd ..

# Wait for Traefik to be ready
print_status "Waiting for Traefik to be ready..."
sleep 10

# Deploy Authentik
print_status "Deploying Authentik..."
cd authentik
if [ ! -f .env ]; then
    print_error "No .env file found in authentik directory. Please copy .env.example to .env and configure it."
    exit 1
fi
docker compose up -d
cd ..

# Deploy Airbyte
print_status "Deploying Airbyte..."
cd airbyte
if [ ! -f .env ]; then
    print_warning "No .env file found in airbyte directory. Copying from .env.example..."
    cp .env.example .env
    print_warning "Please edit airbyte/.env with your database passwords before running Airbyte."
fi
docker compose up -d
cd ..

print_status "Deployment complete! 🎉"
echo ""
echo "📊 Access Points:"
echo "  • Traefik Dashboard: https://traefik.glimmr.health (admin:GlimmrHealth2025!)"
echo "  • Authentik Admin:   https://auth.glimmr.health"
echo "  • Airbyte:          https://airbyte.glimmr.health"
echo ""
echo "🔧 Next Steps:"
echo "  1. Configure your .env files with proper passwords"
echo "  2. Update DNS records to point to your server"
echo "  3. Wait for SSL certificates to be issued"
echo ""
print_status "Run 'docker compose logs -f' in each directory to monitor the services."
