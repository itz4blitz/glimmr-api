#!/bin/bash
# Glimmr Production Setup Script
set -euo pipefail

echo "🏥 Setting up Glimmr Healthcare Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root for security reasons"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Create necessary directories
print_status "Creating application directories..."
mkdir -p /opt/glimmr/{current,backups,logs}

# Check if .env.production exists
if [[ ! -f .env.production ]]; then
    print_error ".env.production file not found. Please create it with required environment variables."
    exit 1
fi

print_status "Loading environment variables..."
source .env.production

# Validate required environment variables
required_vars=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "AIRFLOW_ADMIN_PASSWORD"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_success "Environment validation completed"

# Create health check scripts
print_status "Creating health check scripts..."

cat > wait-for-health.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "⏳ Waiting for services to be healthy..."

services=(
    "http://localhost:3000/api/v1/health:API"
    "http://localhost:5174:Web"
    "http://localhost:8081/health:Airflow"
    "http://localhost:9002/-/health/live/:Authentik"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r url name <<< "$service_info"
    echo "Checking $name at $url..."
    
    for i in {1..30}; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ $name is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            echo "❌ $name failed to become healthy after 5 minutes"
            exit 1
        fi
        
        echo "⏳ $name not ready yet, waiting... ($i/30)"
        sleep 10
    done
done

echo "🎉 All services are healthy!"
EOF

cat > show-status.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "📊 Glimmr Service Status"
echo "=========================="

docker compose -f docker-compose.production.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔗 Service URLs:"
echo "• API: https://api.${DOMAIN:-glimmr.health}"
echo "• Web App: https://app.${DOMAIN:-glimmr.health}"
echo "• Airflow: https://airflow.${DOMAIN:-glimmr.health}"
echo "• Authentik: https://auth.${DOMAIN:-glimmr.health}"
echo ""

# Check service health
echo "🏥 Health Checks:"
services=(
    "API:http://localhost:3000/api/v1/health"
    "Web:http://localhost:5174"
    "Airflow:http://localhost:8081/health"
    "Authentik:http://localhost:9002/-/health/live/"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r name url <<< "$service_info"
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo "✅ $name: Healthy"
    else
        echo "❌ $name: Unhealthy"
    fi
done
EOF

chmod +x wait-for-health.sh show-status.sh

print_success "Setup completed successfully!"
print_status "You can now run './deploy.sh' to deploy the application"