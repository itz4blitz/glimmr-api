#!/bin/bash

# 🚀 Glimmr Infrastructure Deployment Wrapper
# This script provides options for different deployment scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    print_header "🚀 Glimmr Deployment Script"
    print_header "============================"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -d, --dev         Deploy development environment"
    echo "  -p, --prod        Deploy production environment"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --dev          # Deploy complete development environment"
    echo "  $0 --prod         # Deploy production environment with security"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    -d|--dev)
        print_header "🏗️  Deploying Development Environment"
        print_header "===================================="
        echo ""
        print_status "Starting development deployment..."
        
        # Check if scripts exist
        if [ ! -f "tools/scripts/dev-setup.sh" ]; then
            print_error "Development setup script not found: tools/scripts/dev-setup.sh"
            exit 1
        fi
        
        # Run development setup
        ./tools/scripts/dev-setup.sh
        ;;
        
    -p|--prod)
        print_header "🏭  Deploying Production Environment"
        print_header "==================================="
        echo ""
        print_status "Starting production deployment..."
        
        # Check if scripts exist
        if [ ! -f "tools/scripts/deploy-prod.sh" ]; then
            print_error "Production deployment script not found: tools/scripts/deploy-prod.sh"
            exit 1
        fi
        
        # Confirm production deployment
        print_warning "You are about to deploy to PRODUCTION environment."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Production deployment cancelled."
            exit 0
        fi
        
        # Run production deployment
        ./tools/scripts/deploy-prod.sh
        ;;
        
    -h|--help)
        show_usage
        exit 0
        ;;
        
    "")
        print_error "No deployment option specified."
        echo ""
        show_usage
        exit 1
        ;;
        
    *)
        print_error "Unknown option: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac

echo ""
print_header "🎉 Deployment completed successfully!"
print_status "Run './tools/scripts/health-check.sh' to verify all services are healthy"
