#!/bin/bash

# =============================================================================
# GLIMMR SECRETS MANAGEMENT - 1PASSWORD INTEGRATION
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VAULT_NAME="Glimmr Infrastructure"
ENV_FILE=".env.production"

echo -e "${BLUE}🔐 Loading secrets from 1Password...${NC}"

# Check if 1Password CLI is installed and authenticated
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ 1Password CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if authenticated
if ! op account list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with 1Password. Please run: op signin${NC}"
    exit 1
fi

# Function to get secret from 1Password
get_secret() {
    local item_name="$1"
    local field_name="$2"
    
    echo -e "${BLUE}  📋 Getting ${item_name}/${field_name}...${NC}"
    op item get "$item_name" --vault "$VAULT_NAME" --fields "$field_name" 2>/dev/null || {
        echo -e "${RED}❌ Failed to get ${item_name}/${field_name}${NC}"
        return 1
    }
}

# Create production environment file
echo -e "${GREEN}📝 Creating production environment file...${NC}"

cat > "$ENV_FILE" << EOF
# =============================================================================
# GLIMMR PRODUCTION ENVIRONMENT - GENERATED FROM 1PASSWORD
# =============================================================================
# Generated on: $(date)
# DO NOT EDIT MANUALLY - Use 1Password and regenerate

# Database Secrets
POSTGRES_PASSWORD=$(get_secret "Glimmr Database" "password")
POSTGRES_APP_PASSWORD=$(get_secret "Glimmr Database" "app_password")
REDIS_PASSWORD=$(get_secret "Glimmr Redis" "password")

# API Secrets
JWT_SECRET=$(get_secret "Glimmr API" "jwt_secret")
API_ENCRYPTION_KEY=$(get_secret "Glimmr API" "encryption_key")

# Airbyte Secrets
AIRBYTE_CONFIG_PASSWORD=$(get_secret "Airbyte Database" "config_password")
AIRBYTE_JOBS_PASSWORD=$(get_secret "Airbyte Database" "jobs_password")

# Authentik Secrets
AUTHENTIK_SECRET_KEY=$(get_secret "Authentik" "secret_key")
AUTHENTIK_POSTGRES_PASSWORD=$(get_secret "Authentik Database" "password")
AUTHENTIK_REDIS_PASSWORD=$(get_secret "Authentik Redis" "password")

# External Services
CLOUDFLARE_API_KEY=$(get_secret "Cloudflare" "api_key")
SLACK_WEBHOOK_URL=$(get_secret "Slack Integration" "webhook_url")

# MinIO Secrets
MINIO_ROOT_USER=$(get_secret "MinIO" "root_user")
MINIO_ROOT_PASSWORD=$(get_secret "MinIO" "root_password")

# Monitoring
GRAFANA_ADMIN_PASSWORD=$(get_secret "Grafana" "admin_password")

EOF

echo -e "${GREEN}✅ Production environment file created: $ENV_FILE${NC}"
echo -e "${YELLOW}⚠️  Remember to add $ENV_FILE to .gitignore${NC}"
