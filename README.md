# Glimmr API

A healthcare price transparency data aggregation platform that discovers, monitors, and processes hospital pricing data to provide valuable analytics and insights.

## Overview

Glimmr API is a comprehensive TypeScript monorepo that automates the collection and analysis of hospital price transparency data. The platform continuously monitors healthcare pricing information, detects changes, and provides structured data through a robust API.

### Key Features

- **Automated Hospital Discovery**: Discovers hospitals through the Patient Rights Advocate API
- **Smart Change Detection**: Monitors pricing files for updates and changes
- **Data Processing Pipeline**: Downloads, processes, and normalizes pricing data
- **Analytics & Reporting**: Generates insights and analytics from collected data
- **RESTful API**: Provides structured access to pricing data and analytics
- **Queue-Based Processing**: Handles large-scale data processing with background jobs
- **Real-time Monitoring**: Track job progress and system health

## Tech Stack

- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Queue System**: BullMQ with Redis
- **Storage**: DigitalOcean Spaces (production) / MinIO (development)
- **Package Manager**: pnpm with Turborepo
- **Authentication**: JWT with role-based access control
- **Documentation**: Swagger/OpenAPI

## Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- Docker and Docker Compose
- pnpm

### Development Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd glimmr-api
pnpm install
```

2. **Start development environment**:
```bash
# Start all services (PostgreSQL, Redis, MinIO)
docker-compose -f docker-compose.dev.yml up -d

# Copy environment configuration
cp apps/api/.env.production.example apps/api/.env
```

3. **Set up database**:
```bash
cd apps/api
pnpm db:migrate    # Apply migrations
pnpm db:seed       # Seed initial data
```

4. **Start development server**:
```bash
# Start all apps
pnpm dev

# Or start API only
cd apps/api && pnpm start:dev
```

### Environment Configuration

Update `apps/api/.env` with your settings:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glimmr_dev
REDIS_URL=redis://localhost:6379
STORAGE_SPACES_ENDPOINT=http://localhost:9000
STORAGE_SPACES_BUCKET=glimmr-files
API_PORT=3000
NODE_ENV=development
```

## API Endpoints

### Core Services

- **API Base**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health
- **Job Monitoring**: http://localhost:3000/api/v1/admin/queues

### Key Endpoints

- `GET /api/v1/hospitals` - List hospitals
- `GET /api/v1/prices` - Query pricing data
- `GET /api/v1/analytics` - Get analytics data
- `POST /api/v1/jobs/pra/scan` - Trigger hospital discovery
- `GET /api/v1/jobs/status` - Check job statuses

## Architecture

### Data Processing Pipeline

1. **Discovery**: PRA Unified Scanner discovers hospitals and detects file changes
2. **Download**: File download processors retrieve transparency files
3. **Processing**: Price processors extract and normalize data
4. **Analytics**: Analytics processors generate insights and reports

### Module Structure

```
apps/api/src/
├── analytics/          # Analytics and reporting
├── auth/              # Authentication and authorization
├── hospitals/         # Hospital management
├── jobs/              # Background job processing
├── prices/            # Price data processing
├── storage/           # File storage abstraction
├── database/          # Schemas and migrations
└── external-apis/     # External API integrations
```

### Database Schema

- `hospitals.*` - Hospital information and metadata
- `prices.*` - Normalized pricing data
- `price_transparency_files.*` - File tracking and metadata
- `jobs.*` - Job execution tracking
- `analytics.*` - Aggregated analytics data

## Development Commands

### Database Operations
```bash
cd apps/api
pnpm db:generate      # Generate migrations from schema changes
pnpm db:migrate       # Apply migrations
pnpm db:push         # Push schema (development only)
pnpm db:studio       # Open database GUI
pnpm db:seed         # Seed initial data
```

### Code Quality
```bash
pnpm lint            # Fix linting issues
pnpm format          # Format code with Prettier
pnpm check-types     # TypeScript type checking
```

### Testing
```bash
cd apps/api
pnpm test            # Run unit tests
pnpm test:watch      # Run tests in watch mode
pnpm test:cov        # Generate coverage report
pnpm test:e2e        # Run end-to-end tests
```

### Build & Production
```bash
pnpm build           # Build all packages
cd apps/api && pnpm start:prod  # Run production build
```

## Job Processing

The system uses BullMQ for background job processing:

### Available Jobs

- **pra-unified-scan**: Discovers hospitals and detects file changes
- **pra-file-download**: Downloads transparency files
- **price-file-download**: Processes downloaded files
- **price-update**: Normalizes price data
- **analytics-refresh**: Updates analytics

### Manual Job Triggers

```bash
# Trigger PRA scan (test mode limits to CA, FL, TX)
curl -X POST http://localhost:3000/api/v1/jobs/pra/scan \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'

# Check job statuses
curl http://localhost:3000/api/v1/jobs/status
```

## Monitoring & Administration

### Development Tools

- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin123)
- **Bull Board**: http://localhost:3000/api/v1/admin/queues
- **Database Studio**: `pnpm db:studio`

### Health Monitoring

The application provides comprehensive health checks:
- Database connectivity
- Redis connectivity
- Storage service availability
- Job queue health

## Contributing

1. Follow the existing code patterns and conventions
2. Write tests for new features
3. Ensure all linting and type checking passes
4. Use proper error handling and logging
5. Document API changes in Swagger

### Code Patterns

- Use Drizzle ORM for all database operations
- Implement proper error handling with NestJS exceptions
- Use structured logging with Pino
- Follow domain-driven design principles
- Implement background jobs for async processing

## Security

- JWT-based authentication with role-based access control
- API key authentication for external integrations
- Rate limiting on all endpoints
- CORS configuration
- Input validation with class-validator
- Secure secret management

## License

UNLICENSED - Private repository

## Author

Justin Scroggins