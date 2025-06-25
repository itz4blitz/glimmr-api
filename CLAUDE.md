# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glimmr API is a healthcare price transparency data aggregation platform built as a TypeScript monorepo using:
- **Backend**: NestJS with PostgreSQL (Drizzle ORM)
- **Queue System**: BullMQ with Redis
- **Storage**: DigitalOcean Spaces (prod) / MinIO (dev)
- **Package Manager**: pnpm with Turborepo

The system discovers hospital pricing data, monitors changes, downloads files, and provides analytics.

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
```

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