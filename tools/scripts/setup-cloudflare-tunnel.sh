#!/bin/bash
set -e

echo "☁️ Setting up Cloudflare Tunnel for Glimmr"
echo ""

# Tunnel configuration
TUNNEL_ID="21945a72-7450-4553-9c17-dbc27883135a"
TUNNEL_NAME="glimmr"
DOMAIN="glimmr.health"

echo "🔧 Tunnel Details:"
echo "  ID: $TUNNEL_ID"
echo "  Name: $TUNNEL_NAME"
echo "  Domain: $DOMAIN"
echo ""

echo "📋 Required Cloudflare Dashboard Configuration:"
echo ""
echo "1. Go to: Cloudflare Dashboard > Zero Trust > Networks > Tunnels"
echo "2. Find tunnel: '$TUNNEL_NAME' (ID: $TUNNEL_ID)"
echo "3. Click 'Configure' and add these Public Hostnames:"
echo ""
echo "   Public Hostname                     Service"
echo "   =================================================="
echo "   dev-api.$DOMAIN              →  http://glimmr-api:3000"
echo "   dev-app.$DOMAIN              →  http://glimmr-web:5174"
echo "   dev-airflow.$DOMAIN          →  http://airflow-webserver:8080"
echo "   dev-airbyte.$DOMAIN          →  http://host.docker.internal:8000"
echo "   dev-minio.$DOMAIN            →  http://glimmr-minio:9001"
echo "   dev-auth.$DOMAIN             →  http://glimmr-authentik-server:9000"
echo ""
echo "4. Get the tunnel token from the tunnel dashboard"
echo "5. Update infrastructure/cloudflare/.env with the token"
echo ""
echo "⚠️  IMPORTANT: You need to:"
echo "   1. Configure the hostnames above in Cloudflare Dashboard"
echo "   2. Get the tunnel token and add it to .env file"
echo "   3. Then run: ./scripts/full-rebuild.sh"
echo ""
echo "🌐 After setup, your services will be available at:"
echo "   • https://dev-api.$DOMAIN"
echo "   • https://dev-app.$DOMAIN"
echo "   • https://dev-airflow.$DOMAIN"
echo "   • https://dev-airbyte.$DOMAIN"
echo "   • https://dev-minio.$DOMAIN"
echo "   • https://dev-auth.$DOMAIN"
echo ""

# Check if tunnel token exists
if [ -f "infrastructure/cloudflare/.env" ]; then
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN=eyJ" infrastructure/cloudflare/.env; then
        echo "✅ Tunnel token found in .env file"
        echo "🚀 Ready to deploy with: ./scripts/full-rebuild.sh"
    else
        echo "⚠️  Tunnel token not configured in infrastructure/cloudflare/.env"
        echo "   Please add your tunnel token to enable global access"
    fi
else
    echo "⚠️  Configuration file not found: infrastructure/cloudflare/.env"
fi