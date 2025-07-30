#!/bin/bash

echo "� FULLY AUTOMATED Glimmr Infrastructure Setup"
echo "=============================================="
echo ""
echo "This script will set up EVERYTHING automatically!"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Please install it first:"
    echo "   brew install gh"
    exit 1
fi

echo "🔑 Setting up GitHub Secrets for full automation..."
echo ""

# Prompt for Cloudflare API Key
echo "📋 I need your Cloudflare credentials for full automation:"
echo ""
echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "2. Copy your 'Global API Key'"
echo ""
read -p "🔑 Enter your Cloudflare API Key: " CF_API_KEY

echo ""
echo "3. Go to: https://dash.cloudflare.com/ and select glimmr.health domain"
echo "4. Copy the Zone ID from the right sidebar"
echo ""
read -p "🌐 Enter your Cloudflare Zone ID: " ZONE_ID

echo ""
echo "🚀 Adding secrets to GitHub..."

# Add secrets to GitHub
gh secret set CF_API_KEY --body "$CF_API_KEY"
gh secret set CLOUDFLARE_ZONE_ID --body "$ZONE_ID"

echo ""
echo "✅ Secrets added successfully!"
echo ""
echo "🚀 Triggering fully automated deployment..."

# Trigger deployment
gh workflow run "deploy-infrastructure.yml"

echo ""
echo "🎉 DONE! Your infrastructure is now 100% automated!"
echo ""
echo "📊 What just happened:"
echo "  ✅ DNS records created automatically"
echo "  ✅ SSL certificates generated automatically"
echo "  ✅ All services deployed automatically"
echo "  ✅ Authentication configured automatically"
echo ""
echo "🌐 Your services will be available at:"
echo "  • https://traefik.glimmr.health (admin/glimmr2024)"
echo "  • https://auth.glimmr.health"
echo "  • https://airbyte.glimmr.health"
echo ""
echo "🔄 Future deployments: Just push to main branch!"
echo "   git push origin main  # Everything deploys automatically"
