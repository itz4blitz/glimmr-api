#!/bin/bash
set -euo pipefail

echo "📊 Glimmr Production Deployment Status"
echo "======================================="

# Use docker compose (new) or docker-compose (legacy)
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo "❌ Neither 'docker compose' nor 'docker-compose' is available."
        exit 1
    fi
fi

# Function to check service status and display with color
check_and_display_status() {
    local service_name=$1
    local check_command=$2
    local url=$3
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo "✅ $service_name: HEALTHY"
        if [ -n "$url" ]; then
            echo "   🔗 Access: $url"
        fi
    else
        echo "❌ $service_name: UNHEALTHY"
        if [ -n "$url" ]; then
            echo "   🔗 Should be: $url"
        fi
    fi
}

echo ""
echo "🌍 Service Health Status:"
echo "------------------------"

# Check all services
check_and_display_status "PostgreSQL Database" \
    "$COMPOSE_CMD -f docker-compose.production.yml exec -T postgres pg_isready -U postgres -d glimmr" \
    ""

check_and_display_status "Redis Cache" \
    "$COMPOSE_CMD -f docker-compose.production.yml exec -T redis redis-cli --no-auth-warning -a \$REDIS_PASSWORD ping" \
    ""

check_and_display_status "MinIO Storage" \
    "curl -sf http://localhost:9000/minio/health/live" \
    "http://localhost:9001 (Console)"

check_and_display_status "Glimmr API" \
    "curl -sf http://localhost:3000/api/v1/health" \
    "http://localhost:3000/api/docs"

check_and_display_status "Glimmr Web App" \
    "curl -sf http://localhost:5174" \
    "http://localhost:5174"

check_and_display_status "Authentik SSO" \
    "curl -sf http://localhost:9002/-/health/live/" \
    "http://localhost:9002"

check_and_display_status "Airflow Scheduler" \
    "curl -sf http://localhost:8081/health" \
    "http://localhost:8081"

echo ""
echo "🐳 Docker Container Status:"
echo "---------------------------"
$COMPOSE_CMD -f docker-compose.production.yml ps

echo ""
echo "💾 Database Information:"
echo "-----------------------"
if $COMPOSE_CMD -f docker-compose.production.yml exec -T postgres pg_isready -U postgres -d glimmr >/dev/null 2>&1; then
    echo "✅ Database connection: OK"
    # Get database stats if possible
    if $COMPOSE_CMD -f docker-compose.production.yml exec -T postgres psql -U postgres -d glimmr -c "SELECT 'Hospitals: ' || COUNT(*) FROM hospitals;" 2>/dev/null; then
        echo "📊 Database statistics retrieved"
    fi
else
    echo "❌ Database connection: FAILED"
fi

echo ""
echo "🗄️ Storage Information:"
echo "----------------------"
if curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo "✅ MinIO storage: OK"
    echo "🪣 Default bucket: glimmr-prod"
else
    echo "❌ MinIO storage: FAILED"
fi

echo ""
echo "📈 System Resources:"
echo "-------------------"
echo "🖥️  System load: $(uptime | awk -F'load average:' '{print $2}')"
echo "💽 Disk usage: $(df -h . | tail -1 | awk '{print $5}') used"
echo "🧠 Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"

echo ""
echo "🎯 Quick Access URLs:"
echo "--------------------"
echo "🌐 Web App:      http://localhost:5174"
echo "🔧 API Docs:     http://localhost:3000/api/docs"
echo "🔐 Auth Portal:  http://localhost:9002"
echo "📊 Airflow:      http://localhost:8081"
echo "🗄️  MinIO:        http://localhost:9001"
echo "📋 Job Monitor:  http://localhost:3000/api/v1/admin/queues"

echo ""
echo "✨ Deployment completed at: $(date)"
echo "🚀 Glimmr is ready for production use!"