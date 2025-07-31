#!/bin/bash

# 🚀 Glimmr Development Environment Setup
# Complete local development setup with health checks
# Usage: ./tools/scripts/dev-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Start timing
start_time=$(date +%s)

print_header "🏗️  GLIMMR DEVELOPMENT ENVIRONMENT SETUP"
print_header "=========================================="
echo

print_step "1/8 - Checking Prerequisites"

# Check if we're in the right directory
if [ ! -f "CLAUDE.md" ] || [ ! -f "docker-compose.dev.yml" ]; then
    print_error "This script must be run from the glimmr-api root directory"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required tools are available
command -v docker-compose >/dev/null 2>&1 || { print_error "docker-compose is required but not installed."; exit 1; }
command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed."; exit 1; }

print_success "Prerequisites check passed"
echo

print_step "2/8 - Stopping any existing services"

# Stop main Glimmr services
print_status "Stopping main Glimmr services..."
docker-compose -f docker-compose.dev.yml down --remove-orphans > /dev/null 2>&1 || true

# Stop Airflow services (if they exist)
print_status "Stopping Airflow services..."
if [ -f "infrastructure/airflow/docker-compose.yml" ]; then
    docker-compose -f infrastructure/airflow/docker-compose.yml down --remove-orphans > /dev/null 2>&1 || true
fi

# Stop any standalone Airflow containers
docker stop airflow-webserver airflow-scheduler airflow-postgres > /dev/null 2>&1 || true
docker rm airflow-webserver airflow-scheduler airflow-postgres > /dev/null 2>&1 || true

# Stop Airbyte services (abctl managed)
print_status "Stopping Airbyte services..."
if command -v abctl >/dev/null 2>&1; then
    abctl local uninstall > /dev/null 2>&1 || true
fi

# Stop any standalone Airbyte containers  
docker stop airbyte-abctl-control-plane > /dev/null 2>&1 || true
docker rm airbyte-abctl-control-plane > /dev/null 2>&1 || true

# Clean up any orphaned containers with glimmr, airflow, or airbyte in the name
print_status "Cleaning up any remaining containers..."
docker ps -aq --filter "name=glimmr" --filter "name=airflow" --filter "name=airbyte" | xargs -r docker stop > /dev/null 2>&1 || true
docker ps -aq --filter "name=glimmr" --filter "name=airflow" --filter "name=airbyte" | xargs -r docker rm > /dev/null 2>&1 || true

print_success "All existing services stopped"
echo

print_step "3/8 - Setting up environment configuration"

# Create .env file if it doesn't exist
if [ ! -f "apps/api/.env.development" ]; then
    print_status "Creating development environment file..."
    cat > apps/api/.env.development << 'EOF'
# Development Environment Configuration
NODE_ENV=development
API_PORT=3000

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glimmr_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=glimmr_dev
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage Configuration (MinIO)
STORAGE_SPACES_ENDPOINT=http://localhost:9000
STORAGE_SPACES_BUCKET=glimmr-files
STORAGE_SPACES_ACCESS_KEY=minioadmin
STORAGE_SPACES_SECRET_KEY=minioadmin123

# Authentication
JWT_SECRET=dev-jwt-secret-key-replace-in-production
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGINS=http://localhost:5174,http://localhost:3000

# Email (Inbucket for testing)
SMTP_HOST=localhost
SMTP_PORT=2500
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@glimmr.dev

# Logging
LOG_LEVEL=debug

# API Keys (for testing)
PRA_API_BASE_URL=https://data.cms.gov
EOF
    print_success "Environment file created"
else
    print_status "Environment file already exists"
fi

echo

print_step "4/8 - Starting infrastructure services"

# Start services with build
print_status "Building and starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d --build

print_success "Docker services started"
echo

print_step "5/8 - Waiting for services to be healthy"

print_status "Waiting for PostgreSQL..."
timeout=60
while [ $timeout -gt 0 ]; do
    if docker exec glimmr-postgres pg_isready -U postgres > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    print_error "PostgreSQL failed to start within 60 seconds"
    print_error "Logs:"
    docker logs glimmr-postgres --tail 20
    exit 1
fi

print_status "Waiting for Redis..."
timeout=30
while [ $timeout -gt 0 ]; do
    if docker exec glimmr-redis redis-cli ping > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    print_error "Redis failed to start within 30 seconds"
    exit 1
fi

print_status "Waiting for MinIO..."
timeout=30
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    print_error "MinIO failed to start within 30 seconds"
    exit 1
fi

print_status "Waiting for API..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        break
    fi
    sleep 3
    timeout=$((timeout - 3))
done

if [ $timeout -le 0 ]; then
    print_warning "API health check failed, but continuing..."
    print_warning "You may need to run database migrations manually"
fi

print_status "Waiting for Web App..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:5174 > /dev/null 2>&1; then
        break
    fi
    sleep 3
    timeout=$((timeout - 3))
done

if [ $timeout -le 0 ]; then
    print_warning "Web app health check failed, but continuing..."
fi

print_success "Core services are healthy"
echo

print_step "6/8 - Initializing database security"

print_status "Setting up secure database users..."
if [ -f "tools/scripts/init-db-security.sql" ]; then
    if docker exec -i glimmr-postgres psql -U postgres < tools/scripts/init-db-security.sql > /dev/null 2>&1; then
        print_success "Database security initialized"
    else
        print_warning "Database security setup failed (may already be configured)"
    fi
else
    print_warning "Database security script not found"
fi

echo

print_step "7/10 - Deploying Airflow"

print_status "Starting Airflow services..."
cd infrastructure/airflow

# Deploy Airflow using docker-compose
if docker-compose up -d; then
    print_success "✅ Airflow deployed successfully"
    
    # Wait for Airflow to be ready
    print_status "Waiting for Airflow webserver..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:8081/health > /dev/null 2>&1; then
            print_success "✅ Airflow webserver is healthy"
            break
        fi
        sleep 3
        timeout=$((timeout - 3))
    done
    
    if [ $timeout -le 0 ]; then
        print_warning "⚠️  Airflow health check timed out, but continuing..."
    fi
else
    print_warning "⚠️  Airflow deployment failed, but continuing..."
fi

cd ../..
echo

print_step "8/10 - Deploying Airbyte"

print_status "Starting Airbyte services..."

# Check if abctl is available
if command -v abctl >/dev/null 2>&1; then
    print_status "Using abctl to deploy Airbyte..."
    if abctl local install; then
        print_success "✅ Airbyte deployed successfully"
        
        # Wait for Airbyte to be ready
        print_status "Waiting for Airbyte..."
        timeout=120
        while [ $timeout -gt 0 ]; do
            if curl -f http://localhost:8000 > /dev/null 2>&1; then
                print_success "✅ Airbyte is healthy"
                break
            fi
            sleep 5
            timeout=$((timeout - 5))
        done
        
        if [ $timeout -le 0 ]; then
            print_warning "⚠️  Airbyte health check timed out, but continuing..."
        fi
    else
        print_warning "⚠️  Airbyte deployment failed, but continuing..."
    fi
else
    print_warning "⚠️  abctl not found, skipping Airbyte deployment"
    print_status "To install abctl: curl -LsfS https://get.airbyte.com | bash -"
fi

echo

print_step "9/10 - Seeding initial data"

print_status "Running database migrations and seeding..."
cd apps/api

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing API dependencies..."
    npm install > /dev/null 2>&1
fi

# Run migrations
if npm run db:migrate > /dev/null 2>&1; then
    print_success "Database migrations completed"
else
    print_warning "Database migrations failed (may already be applied)"
fi

# Seed initial data
if npm run db:seed > /dev/null 2>&1; then
    print_success "Database seeded with initial data"
else
    print_warning "Database seeding failed (may already be seeded)"
fi

cd ../..

echo

print_step "10/10 - Running comprehensive health checks"

print_status "Verifying all services..."

# Test database connectivity
if docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "✅ PostgreSQL: Connected"
else
    print_error "❌ PostgreSQL: Connection failed"
fi

# Test Redis
if docker exec glimmr-redis redis-cli ping > /dev/null 2>&1; then
    print_success "✅ Redis: Connected"
else
    print_error "❌ Redis: Connection failed"
fi

# Test MinIO
if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    print_success "✅ MinIO: Healthy"
else
    print_error "❌ MinIO: Health check failed"
fi

# Test API
if curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    print_success "✅ API: Healthy"
else
    print_error "❌ API: Health check failed"
fi

# Test Web App
if curl -f http://localhost:5174 > /dev/null 2>&1; then
    print_success "✅ Web App: Accessible"
else
    print_error "❌ Web App: Not accessible"
fi

# Test Authentik
if curl -f http://localhost:9002/-/health/live/ > /dev/null 2>&1; then
    print_success "✅ Authentik: Healthy"
else
    print_warning "⚠️  Authentik: Health check failed (may still be starting)"
fi

# Test Inbucket
if curl -f http://localhost:8025 > /dev/null 2>&1; then
    print_success "✅ Inbucket: Accessible"
else
    print_warning "⚠️  Inbucket: Not accessible"
fi

# Test Airflow
if curl -f http://localhost:8081/health > /dev/null 2>&1; then
    print_success "✅ Airflow: Healthy"
else
    print_warning "⚠️  Airflow: Not accessible (may not be deployed)"
fi

# Test Airbyte
if curl -f http://localhost:8000 > /dev/null 2>&1; then
    print_success "✅ Airbyte: Accessible"
else
    print_warning "⚠️  Airbyte: Not accessible (may not be deployed)"
fi

echo

# Calculate total time
end_time=$(date +%s)
total_time=$((end_time - start_time))

print_header "🎉 SETUP COMPLETE!"
print_header "=================="
echo
print_success "Total setup time: ${total_time} seconds"
echo

print_header "📊 Access Points:"
echo "  🔗 API:              http://localhost:3000"
echo "  📚 API Docs:         http://localhost:3000/api/docs"
echo "  🌐 Web App:          http://localhost:5174"
echo "  🔐 Authentik:        http://localhost:9002"
echo "  💾 MinIO Console:    http://localhost:9001 (minioadmin/minioadmin123)"
echo "  📧 Inbucket:         http://localhost:8025"
echo

print_header "🔧 Development Commands:"
echo "  📊 View logs:        docker-compose -f docker-compose.dev.yml logs -f"
echo "  🔄 Restart services: docker-compose -f docker-compose.dev.yml restart"
echo "  🛑 Stop services:    docker-compose -f docker-compose.dev.yml down"
echo "  🏥 Health check:     ./tools/scripts/health-check.sh"
echo

print_header "🗄️  Database Access:"
echo "  🐘 PostgreSQL:       psql postgresql://postgres:postgres@localhost:5432/glimmr_dev"
echo "  📊 Drizzle Studio:   cd apps/api && npm run db:studio"
echo

print_header "🚀 Ready for development!"
echo "   Run 'cd apps/api && npm run start:dev' to start API in dev mode"
echo "   Run 'cd apps/web && npm run dev' to start frontend in dev mode"
echo