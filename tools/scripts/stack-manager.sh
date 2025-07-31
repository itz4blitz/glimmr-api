#!/bin/bash

# Glimmr Data Pipeline Stack Manager
# Manages both Docker Compose and Kubernetes (Airbyte) services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="../docker-compose.yml"
AIRBYTE_PORT=8000
AIRFLOW_PORT=8081
TRAEFIK_PORT=8080

print_header() {
    echo -e "${BLUE}🚀 Glimmr Data Pipeline Stack Manager${NC}"
    echo -e "${BLUE}======================================${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v abctl &> /dev/null; then
        print_error "abctl is not installed. Run: curl -LsfS https://get.airbyte.com | bash -"
        exit 1
    fi
    
    print_status "All dependencies found"
}

start_docker_stack() {
    echo "🐳 Starting Docker services..."
    cd "$(dirname "$0")/.."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker compose up -d
        print_status "Docker services started"
    else
        print_warning "Docker compose file not found at $DOCKER_COMPOSE_FILE"
    fi
}

start_airbyte() {
    echo "☸️  Starting Airbyte (Kubernetes)..."
    
    if abctl local status &> /dev/null; then
        print_warning "Airbyte is already running"
    else
        abctl local install
        print_status "Airbyte started"
    fi
}

stop_docker_stack() {
    echo "🐳 Stopping Docker services..."
    cd "$(dirname "$0")/.."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker compose down
        print_status "Docker services stopped"
    else
        print_warning "Docker compose file not found"
    fi
}

stop_airbyte() {
    echo "☸️  Stopping Airbyte..."
    
    if abctl local status &> /dev/null; then
        abctl local uninstall
        print_status "Airbyte stopped"
    else
        print_warning "Airbyte is not running"
    fi
}

show_status() {
    echo "📊 Stack Status:"
    echo ""
    
    # Docker services
    echo "🐳 Docker Services:"
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(traefik|airflow|postgres|redis|authentik|dbt)" &> /dev/null; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAMES|traefik|airflow|postgres|redis|authentik|dbt)"
    else
        print_warning "No Docker services running"
    fi
    
    echo ""
    
    # Airbyte status
    echo "☸️  Airbyte Status:"
    if abctl local status &> /dev/null; then
        print_status "Airbyte is running"
        echo "   Web UI: http://localhost:$AIRBYTE_PORT"
    else
        print_warning "Airbyte is not running"
    fi
    
    echo ""
    
    # Service URLs
    echo "🔗 Service URLs:"
    echo "   Airbyte:  http://localhost:$AIRBYTE_PORT"
    echo "   Airflow:  http://localhost:$AIRFLOW_PORT"
    echo "   Traefik:  http://localhost:$TRAEFIK_PORT"
}

show_credentials() {
    echo "🔑 Service Credentials:"
    echo ""
    
    echo "Airbyte:"
    if abctl local status &> /dev/null; then
        abctl local credentials
    else
        print_warning "Airbyte is not running"
    fi
    
    echo ""
    echo "Airflow:"
    echo "   Username: admin"
    echo "   Password: admin"
    echo "   URL: http://localhost:$AIRFLOW_PORT"
}

show_logs() {
    local service=$1
    
    case $service in
        "airbyte")
            echo "📋 Airbyte logs:"
            abctl local logs
            ;;
        "airflow")
            echo "📋 Airflow logs:"
            cd "$(dirname "$0")/.."
            docker compose logs airflow-webserver airflow-scheduler
            ;;
        "traefik")
            echo "📋 Traefik logs:"
            cd "$(dirname "$0")/.."
            docker compose logs traefik
            ;;
        "dbt")
            echo "📋 dbt logs:"
            cd "$(dirname "$0")/../dbt"
            docker compose logs dbt
            ;;
        *)
            echo "📋 All Docker logs:"
            cd "$(dirname "$0")/.."
            docker compose logs
            ;;
    esac
}

show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start         Start the entire stack (Docker + Airbyte)"
    echo "  stop          Stop the entire stack"
    echo "  restart       Restart the entire stack"
    echo "  status        Show status of all services"
    echo "  credentials   Show service credentials"
    echo "  logs [service] Show logs (service: airbyte, airflow, traefik, dbt, or all)"
    echo "  docker-start  Start only Docker services"
    echo "  docker-stop   Stop only Docker services"
    echo "  airbyte-start Start only Airbyte"
    echo "  airbyte-stop  Stop only Airbyte"
    echo "  help          Show this help message"
}

# Main script logic
case "${1:-help}" in
    "start")
        print_header
        check_dependencies
        start_docker_stack
        start_airbyte
        echo ""
        show_status
        ;;
    "stop")
        print_header
        stop_airbyte
        stop_docker_stack
        print_status "Stack stopped"
        ;;
    "restart")
        print_header
        stop_airbyte
        stop_docker_stack
        sleep 2
        start_docker_stack
        start_airbyte
        echo ""
        show_status
        ;;
    "status")
        print_header
        show_status
        ;;
    "credentials")
        print_header
        show_credentials
        ;;
    "logs")
        print_header
        show_logs "$2"
        ;;
    "docker-start")
        print_header
        check_dependencies
        start_docker_stack
        ;;
    "docker-stop")
        print_header
        stop_docker_stack
        ;;
    "airbyte-start")
        print_header
        check_dependencies
        start_airbyte
        ;;
    "airbyte-stop")
        print_header
        stop_airbyte
        ;;
    "help"|*)
        print_header
        show_help
        ;;
esac
