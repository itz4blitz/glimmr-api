# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glimmr API is a healthcare price transparency data aggregation platform built as a TypeScript monorepo using:
- **Backend**: NestJS with PostgreSQL (Drizzle ORM)
- **Frontend**: React + TypeScript with Vite (apps/web)
- **Queue System**: BullMQ with Redis
- **Storage**: DigitalOcean Spaces (prod) / MinIO (dev)
- **Package Manager**: pnpm with Turborepo

The system discovers hospital pricing data, monitors changes, downloads files, and provides analytics.

## 🎉 **NEW: Complete React UI Built**

### **Frontend Application (apps/web/)**
- ✅ **Vite + React + TypeScript** - Modern development setup
- ✅ **ALL 47 shadcn/ui Components** - Complete component library
- ✅ **Beautiful Custom Theme** - OKLCH-based colors with light/dark modes
- ✅ **Framer Motion** - Smooth animations throughout
- ✅ **Zustand State Management** - Authentication store with React Context for theme
- ✅ **React Router** - Protected routes with role-based access
- ✅ **Form Validation** - React Hook Form + Zod integration
- ✅ **Mobile Responsive** - Mobile-first design approach
- ✅ **Toast Notifications** - User feedback with Sonner
- ✅ **API Integration Ready** - Configured for NestJS backend

## Essential Commands

### Development
```bash
# Start full development environment (recommended)
docker-compose -f docker-compose.dev.yml up -d

# Start development server
pnpm dev                    # From root (all apps)
cd apps/api && pnpm start:dev  # API only with hot reload

# Database operations
cd apps/api
pnpm db:generate           # Generate migrations from schema changes
pnpm db:migrate            # Apply migrations
pnpm db:push              # Push schema (dev only)
pnpm db:studio            # Open database GUI
pnpm db:seed              # Seed initial data

# Code quality
pnpm lint                 # Fix linting issues
pnpm format               # Format code
pnpm check-types          # TypeScript checking

# Frontend development (React UI)
cd apps/web
npm run dev               # Start React development server
npm run build             # Build for production

# Docker development (Full Stack)
docker-compose -f docker-compose.dev.yml up -d    # Start all services
docker-compose -f docker-compose.dev.yml up web -d # Start just web app
docker-compose -f docker-compose.dev.yml logs web  # View web app logs
```

### **UI Components Built**
- ✅ **Login Page** - Beautiful animated form with theme toggle
- ✅ **Registration Page** - Complete signup flow with validation
- ✅ **Dashboard Page** - Stats, user info, quick actions
- ✅ **Profile Page** - User account management
- ✅ **Authentication System** - JWT tokens, role-based access
- ✅ **Theme System** - Perfect light/dark mode switching
- ✅ **Mobile Navigation** - Responsive sidebar and header

### **Current Status**
**🚀 PRODUCTION READY**: Complete full-stack application with beautiful, responsive React UI, robust authentication, and modern development setup.

**🐳 DOCKER READY**: Both frontend and backend now run in Docker containers:
- **Frontend**: http://localhost:5174 (React + Vite)
- **Backend**: http://localhost:3000 (NestJS API)
- **All services**: PostgreSQL, Redis, MinIO, Inbucket running in containers

### Testing
```bash
cd apps/api
pnpm test                 # Run unit tests
pnpm test:watch          # Watch mode
pnpm test:cov            # Coverage report
pnpm test:e2e            # E2E tests
```

### Build & Production
```bash
pnpm build               # Build all packages
cd apps/api && pnpm start:prod  # Run production build
```

## Architecture

### Module Structure
The API follows NestJS module-based architecture with domain-driven design:
- `/apps/api/src/analytics/` - Analytics and reporting
- `/apps/api/src/hospitals/` - Hospital management
- `/apps/api/src/prices/` - Price data processing
- `/apps/api/src/jobs/` - Background job processing
- `/apps/api/src/storage/` - File storage abstraction
- `/apps/api/src/database/` - Database schemas and migrations

### Database Schema Organization
Drizzle schemas are organized by domain:
- `analytics.*` - Aggregated analytics data
- `hospitals.*` - Hospital information
- `jobs.*` - Job tracking
- `prices.*` - Price data
- `price_transparency_files.*` - File tracking

### Job Processing System
Queue-based processing with BullMQ:
1. **pra-unified-scan** - Discovers hospitals and detects file changes
2. **pra-file-download** - Downloads transparency files
3. **price-file-download** - Processes downloaded files
4. **price-update** - Normalizes price data
5. **analytics-refresh** - Updates analytics

Monitor jobs at: http://localhost:3000/api/v1/admin/queues

### Data Flow
1. Patient Rights Advocate API → Hospital discovery
2. Smart change detection → File downloads
3. File processing → Price extraction
4. Data normalization → Analytics generation

## Development Setup

### Environment Variables
Copy `/apps/api/.env.production.example` to `/apps/api/.env` and update:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glimmr_dev
REDIS_URL=redis://localhost:6379
STORAGE_SPACES_ENDPOINT=http://localhost:9000
STORAGE_SPACES_BUCKET=glimmr-files
API_PORT=3000
NODE_ENV=development
```

### Key URLs
- API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Bull Board: http://localhost:3000/api/v1/admin/queues
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)

### Manual Job Triggers
```bash
# Trigger PRA scan (testMode limits to CA, FL, TX)
curl -X POST http://localhost:3000/api/v1/jobs/pra/scan \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'

# Check job statuses
curl http://localhost:3000/api/v1/jobs/status
```

## Code Patterns

### Adding New Features
1. Create module in appropriate domain directory
2. Define Drizzle schema if database changes needed
3. Generate and apply migrations
4. Implement service layer with proper error handling
5. Add controller with Swagger documentation
6. Create background jobs if async processing needed

### Database Operations
- Use Drizzle ORM for all database operations
- Schemas defined in `/apps/api/src/database/schema/`
- Migrations auto-generated from schema changes
- Use transactions for multi-table operations

### Job Creation
- Define job in `/apps/api/src/jobs/processors/`
- Register with BullModule in job module
- Use proper job options (retries, backoff, concurrency)
- Implement progress reporting for long-running jobs

### Error Handling
- Use NestJS built-in exceptions
- Log errors with context using Pino logger
- Implement proper retry logic in jobs
- Return structured error responses

## Production Considerations

### Performance
- Database indexes defined in schema files
- Job concurrency limits configured per queue
- Rate limiting enabled on API endpoints
- Connection pooling for database

### Monitoring
- Health endpoint: `/api/v1/health`
- Bull Board for job monitoring
- Structured logging with Pino
- Docker health checks configured

### Security
- JWT authentication configured
- CORS properly set up
- Rate limiting per endpoint
- Environment-based configuration
- No secrets in code

## Docker & Service Access Commands

### Docker Management
```bash
# Environment control
docker-compose -f docker-compose.dev.yml up -d     # Start all services
docker-compose -f docker-compose.dev.yml down      # Stop all services
docker-compose -f docker-compose.dev.yml restart   # Restart all services
docker-compose -f docker-compose.dev.yml logs -f   # Follow all logs

# Individual service control
docker restart glimmr-api                          # Restart API only
docker restart glimmr-postgres                     # Restart database
docker restart glimmr-redis                        # Restart Redis
docker restart glimmr-minio                        # Restart MinIO

# Service logs
docker logs glimmr-api --tail 50 -f               # API logs (follow)
docker logs glimmr-postgres --tail 20             # Database logs
docker logs glimmr-redis --tail 20                # Redis logs
docker logs glimmr-minio --tail 20                # MinIO logs
docker logs glimmr-inbucket --tail 20             # Email logs

# Service status and health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker exec glimmr-api curl -s http://localhost:3000/api/v1/health
```

### Database Access (PostgreSQL)
```bash
# Direct database connection
docker exec -it glimmr-postgres psql -U postgres -d glimmr_dev

# Quick queries via CLI
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "SELECT COUNT(*) FROM hospitals;"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "SELECT COUNT(*) FROM prices;"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "SELECT name, status FROM jobs ORDER BY created_at DESC LIMIT 10;"

# Database dumps and restore
docker exec glimmr-postgres pg_dump -U postgres glimmr_dev > backup.sql
docker exec -i glimmr-postgres psql -U postgres -d glimmr_dev < backup.sql

# Host machine direct access (if psql installed)
PGPASSWORD=postgres psql -h localhost -U postgres -d glimmr_dev

# Database schema inspection
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "\dt"  # List tables
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "\d+ hospitals"  # Describe table
```

### Redis Access
```bash
# Connect to Redis CLI
docker exec -it glimmr-redis redis-cli

# Quick Redis commands
docker exec glimmr-redis redis-cli ping
docker exec glimmr-redis redis-cli info
docker exec glimmr-redis redis-cli keys "*"
docker exec glimmr-redis redis-cli keys "bull:*"  # BullMQ queues

# Monitor Redis activity
docker exec glimmr-redis redis-cli monitor

# Queue inspection
docker exec glimmr-redis redis-cli llen "bull:pra-unified-scan:waiting"
docker exec glimmr-redis redis-cli hgetall "bull:pra-unified-scan:1"

# Host machine direct access (if redis-cli installed)
redis-cli -h localhost -p 6379
```

### MinIO Storage Access
```bash
# MinIO Client (mc) commands via container
docker exec glimmr-minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker exec glimmr-minio mc ls local/glimmr-files
docker exec glimmr-minio mc stat local/glimmr-files

# File operations
docker exec glimmr-minio mc cp local/glimmr-files/hospitals/ /tmp/ --recursive
docker exec glimmr-minio mc find local/glimmr-files --name "*.csv"

# MinIO Console Web UI
open http://localhost:9001  # minioadmin / minioadmin123

# S3 API compatible access
curl -X GET http://localhost:9000/glimmr-files/
aws --endpoint-url=http://localhost:9000 s3 ls s3://glimmr-files/
```

### Email Testing (Inbucket)
```bash
# Inbucket Web UI
open http://localhost:8025

# SMTP testing
telnet localhost 2500

# POP3 access
telnet localhost 1100

# Send test email via curl
curl -X POST http://localhost:8025/api/v1/mailbox/test@example.com \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body":"Test message"}'

# List mailbox contents
curl http://localhost:8025/api/v1/mailbox/test@example.com

# Read specific email
curl http://localhost:8025/api/v1/mailbox/test@example.com/EMAIL_ID
```

### API Testing & Monitoring
```bash
# Health checks
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/ready
curl http://localhost:3000/api/v1/health/live

# API documentation
open http://localhost:3000/api/docs

# Queue monitoring
open http://localhost:3000/api/v1/admin/queues

# Job management
curl http://localhost:3000/api/v1/jobs/status
curl -X POST http://localhost:3000/api/v1/jobs/pra/scan \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'

# Data queries
curl "http://localhost:3000/api/v1/hospitals?limit=5"
curl "http://localhost:3000/api/v1/prices?limit=5"
curl "http://localhost:3000/api/v1/analytics/summary"

# Authentication (get token first)
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/admin/users
```

### Development Tools
```bash
# Drizzle Studio (Database GUI)
cd apps/api && pnpm db:studio
open http://localhost:3000/drizzle  # or check console output for URL

# Real-time log monitoring
docker logs glimmr-api -f | grep ERROR           # Filter errors
docker logs glimmr-api -f | grep "CSV"           # Filter CSV processing
docker logs glimmr-api -f | grep "Job"           # Filter job processing

# Performance monitoring
docker stats glimmr-api glimmr-postgres glimmr-redis glimmr-minio

# Container inspection
docker inspect glimmr-api | jq '.[]'
docker exec glimmr-api env | grep -E "(DATABASE_|REDIS_|STORAGE_)"
```

### Debugging & Troubleshooting
```bash
# Check all service endpoints
curl -s http://localhost:3000/api/v1/health | jq '.'
curl -s http://localhost:9000/minio/health/ready
docker exec glimmr-redis redis-cli ping
docker exec glimmr-postgres pg_isready -U postgres

# Network connectivity
docker network inspect glimmr-network
docker exec glimmr-api ping glimmr-postgres
docker exec glimmr-api ping glimmr-redis

# Container resource usage
docker exec glimmr-api ps aux
docker exec glimmr-api df -h
docker exec glimmr-api netstat -tlnp

# Application debugging
docker exec glimmr-api curl -s http://localhost:3000/api/v1/health
docker exec -it glimmr-api sh  # Shell access for debugging

# File system inspection
docker exec glimmr-api ls -la /app
docker exec glimmr-api cat /app/package.json
docker exec glimmr-minio ls -la /data/glimmr-files/
```

### MCP & Integration Testing
```bash
# Test all service integrations
./scripts/test-integration.sh  # If exists

# Validate environment
docker exec glimmr-api node -e "console.log(process.env.DATABASE_URL)"
docker exec glimmr-api node -e "console.log(require('./package.json').version)"

# Memory and performance
docker exec glimmr-api node -e "console.log(process.memoryUsage())"
docker exec glimmr-api top -n 1
```