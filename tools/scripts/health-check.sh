#!/bin/bash

# =============================================================================
# GLIMMR COMPREHENSIVE HEALTH CHECK
# Verifies all services in the Glimmr platform
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0

# Configuration
ENVIRONMENT="${ENVIRONMENT:-development}"
TIMEOUT="${TIMEOUT:-10}"

# Function to perform health check
check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local required="${4:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n -e "${BLUE}🔍 Checking $service_name... ${NC}"
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null); then
        if [[ "$response" =~ ^($expected_status)$ ]]; then
            echo -e "${GREEN}✅ OK ($response)${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            if [ "$required" = "true" ]; then
                echo -e "${RED}❌ FAILED (status: $response, expected: $expected_status)${NC}"
            else
                echo -e "${YELLOW}⚠️  WARNING (status: $response, expected: $expected_status)${NC}"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
            fi
        fi
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ FAILED (connection error)${NC}"
        else
            echo -e "${YELLOW}⚠️  WARNING (connection error)${NC}"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
        fi
    fi
}

# Function to check Docker container health
check_container() {
    local container_name="$1"
    local required="${2:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n -e "${BLUE}🐳 Checking container $container_name... ${NC}"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up.*"; then
        # Check if container has health check
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
        if [ "$health_status" = "healthy" ] || [ "$health_status" = "none" ]; then
            echo -e "${GREEN}✅ Running${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            if [ "$required" = "true" ]; then
                echo -e "${RED}❌ Unhealthy (status: $health_status)${NC}"
            else
                echo -e "${YELLOW}⚠️  Unhealthy (status: $health_status)${NC}"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
            fi
        fi
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Not running${NC}"
            # Show container status for debugging
            docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep "$container_name" || echo "   Container not found"
        else
            echo -e "${YELLOW}⚠️  Not running (optional service)${NC}"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
        fi
    fi
}

# Function to check database connectivity
check_database() {
    local db_name="$1"
    local container_name="$2"
    local user="$3"
    local database="$4"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n -e "${BLUE}🔍 Checking $db_name connection... ${NC}"
    
    if docker exec "$container_name" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ Connection failed${NC}"
    fi
}

# Start health check
echo -e "${CYAN}🏥 Glimmr Platform Health Check${NC}"
echo -e "${CYAN}===============================${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Timeout: ${TIMEOUT}s${NC}"
echo ""

# Check Docker daemon
echo -e "${BLUE}🐳 Docker System${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
echo -n -e "${BLUE}🔍 Checking Docker daemon... ${NC}"
if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Docker daemon not running${NC}"
    echo -e "${RED}Please start Docker and try again${NC}"
    exit 1
fi
echo ""

# Check core infrastructure containers
echo -e "${BLUE}📦 Core Infrastructure${NC}"
check_container "glimmr-postgres" "true"
check_container "glimmr-redis" "true"
check_container "glimmr-minio" "true"
echo ""

# Check authentication services
echo -e "${BLUE}🔐 Authentication Services${NC}"
check_container "glimmr-authentik-postgres" "false"
check_container "glimmr-authentik-redis" "false"
check_container "glimmr-authentik-server" "false"
check_container "glimmr-authentik-worker" "false"
echo ""

# Check application services
echo -e "${BLUE}🚀 Application Services${NC}"
check_container "glimmr-api" "true"
check_container "glimmr-web" "true"
echo ""

# Check optional services
echo -e "${BLUE}📧 Email & Development Services${NC}"
check_container "glimmr-inbucket" "false"
echo ""

# Check database connections
echo -e "${BLUE}🗄️  Database Connections${NC}"
check_database "Main PostgreSQL" "glimmr-postgres" "postgres" "glimmr_dev"

# Check if production database exists
if [ "$ENVIRONMENT" = "production" ]; then
    check_database "Production Database" "glimmr-postgres" "glimmr_api_user" "glimmr_prod"
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
echo -n -e "${BLUE}🔍 Checking Redis connection... ${NC}"
if docker exec glimmr-redis redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Connected${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Connection failed${NC}"
fi
echo ""

# Check service endpoints
echo -e "${BLUE}🌐 Service Endpoints${NC}"
check_service "Glimmr API Health" "http://localhost:3000/api/v1/health" "200" "true"
check_service "Glimmr Web App" "http://localhost:5174" "200" "true"
check_service "MinIO Console" "http://localhost:9001" "200" "true"
check_service "Authentik Server" "http://localhost:9002/-/health/live/" "200" "false"
check_service "Inbucket Web UI" "http://localhost:8025" "200" "false"
echo ""

# Check API endpoints
echo -e "${BLUE}🔗 API Endpoints${NC}"
check_service "API Documentation" "http://localhost:3000/api/docs" "200" "true"
check_service "Hospitals Endpoint" "http://localhost:3000/api/v1/hospitals" "200" "true"
check_service "Prices Endpoint" "http://localhost:3000/api/v1/prices" "200" "true"
check_service "Analytics Endpoint" "http://localhost:3000/api/v1/analytics/summary" "200" "true"
echo ""

# Check storage health
echo -e "${BLUE}💾 Storage Health${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
echo -n -e "${BLUE}🔍 Checking MinIO health... ${NC}"
if curl -f http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Health check failed${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}📊 Health Check Summary${NC}"
echo -e "${CYAN}======================${NC}"

failed_checks=$((TOTAL_CHECKS - PASSED_CHECKS - WARNING_CHECKS))

echo -e "${BLUE}Total Checks: $TOTAL_CHECKS${NC}"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
if [ $WARNING_CHECKS -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
fi
if [ $failed_checks -gt 0 ]; then
    echo -e "${RED}Failed: $failed_checks${NC}"
fi
echo ""

if [[ $failed_checks -eq 0 ]]; then
    if [[ $WARNING_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 All checks passed! Platform is fully healthy!${NC}"
        echo -e "${GREEN}✅ Ready for operation${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Platform is functional with $WARNING_CHECKS warnings${NC}"
        echo -e "${YELLOW}🔧 Optional services may need attention${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Critical issues detected ($failed_checks failed checks)${NC}"
    echo -e "${RED}🚨 Platform requires immediate attention${NC}"
    echo ""
    echo -e "${BLUE}💡 Troubleshooting tips:${NC}"
    echo "   • Check service logs: docker-compose logs [service-name]"
    echo "   • Restart services: docker-compose restart [service-name]"
    echo "   • Rebuild if needed: docker-compose up -d --build"
    exit 1
fi
