#!/bin/bash
set -euo pipefail

echo "🔍 Waiting for all services to be healthy..."

# Maximum wait time in seconds (5 minutes)
MAX_WAIT=300
WAIT_TIME=0
SLEEP_INTERVAL=10

# Function to check if a service is healthy
check_service_health() {
    local service_name=$1
    local health_check=$2
    
    if eval "$health_check" >/dev/null 2>&1; then
        echo "✅ $service_name is healthy"
        return 0
    else
        echo "⏳ $service_name is not ready yet..."
        return 1
    fi
}

# Define health checks for each service
HEALTH_CHECKS=(
    "PostgreSQL:docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U postgres -d glimmr"
    "Redis:docker-compose -f docker-compose.production.yml exec -T redis redis-cli --no-auth-warning -a \$REDIS_PASSWORD ping"
    "MinIO:curl -sf http://localhost:9000/minio/health/live"
    "API:curl -sf http://localhost:3000/api/v1/health"
    "Web:curl -sf http://localhost:5174"
    "Authentik:curl -sf http://localhost:9002/-/health/live/"
    "Airflow:curl -sf http://localhost:8081/health"
)

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    all_healthy=true
    
    echo "🔄 Health check round $(($WAIT_TIME / $SLEEP_INTERVAL + 1))..."
    
    for check in "${HEALTH_CHECKS[@]}"; do
        service_name="${check%%:*}"
        health_command="${check#*:}"
        
        if ! check_service_health "$service_name" "$health_command"; then
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        echo ""
        echo "🎉 All services are healthy and ready!"
        echo "🌐 Access the platform at:"
        echo "   - Web App: http://localhost:5174"
        echo "   - API: http://localhost:3000/api/docs"
        echo "   - Authentik: http://localhost:9002"
        echo "   - Airflow: http://localhost:8081"
        echo "   - MinIO Console: http://localhost:9001"
        exit 0
    fi
    
    echo "⏱️  Waiting ${SLEEP_INTERVAL}s before next check..."
    sleep $SLEEP_INTERVAL
    WAIT_TIME=$((WAIT_TIME + SLEEP_INTERVAL))
done

echo "❌ Services failed to become healthy within ${MAX_WAIT} seconds"
echo "🔍 Checking service status..."

# Show service status for debugging
docker-compose -f docker-compose.production.yml ps

exit 1