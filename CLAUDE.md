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

### **Recent Updates (2025-07-26)**

**✅ Component Consolidation**: Cleaned up duplicate "Enhanced" components:
- `EnhancedQueueDashboard` → `QueueDashboard` (with WebSocket support, real-time updates)
- `EnhancedQueueLogsModal` → `QueueLogsModal` (with metrics tab, job details)
- `TriggerJobModalEnhanced` → `TriggerJobModal` (with guided mode, state selection)

**✅ Backend Job System**: All job services are integrated and provide:
- **JobsGateway**: WebSocket support for real-time job updates
- **JobMonitorService**: Automated health checks and orphaned file detection
- **JobAnalyticsService**: Performance metrics and failure analysis
- **JobExportService**: Data extraction and reporting capabilities
- **JobSchedulingService**: Automated recurring scans

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

## Domain Context

### Healthcare Price Transparency

#### Regulations & Compliance
- **CMS Hospital Price Transparency Rule**: Requires hospitals to publish pricing in machine-readable formats
- **Standard Charge Files**: Must include gross charges, discounted cash prices, payer-specific negotiated charges
- **Update Frequency**: Files must be updated at least annually, but hospitals may update more frequently
- **Accessibility**: Files must be easily accessible without barriers (no login requirements)

#### File Formats & Standards
- **CSV Format**: Most common, but inconsistent column naming and structure across hospitals
- **JSON Format**: Usually follows CMS schema but with hospital-specific variations
- **XML Format**: Less common, often legacy systems
- **Common Issues**:
  - Inconsistent date formats (MM/DD/YYYY vs YYYY-MM-DD)
  - Mixed encoding (UTF-8, ISO-8859-1, Windows-1252)
  - Nested price structures in flat CSV files
  - Missing or invalid CPT/DRG codes
  - Payer names vary wildly (e.g., "BCBS", "Blue Cross", "BlueCross Blue Shield")

#### Data Quality Challenges
- **Duplicate Entries**: Same service with slightly different descriptions
- **Price Outliers**: $0.01 placeholder prices or $999,999 max values
- **Missing Data**: Blank negotiated rates, missing payer information
- **Code Mismatches**: Invalid CPT codes, proprietary hospital codes
- **Rate Structures**: Complex tiered pricing, percentage of charges
- **File Size**: Files can be 1GB+ requiring streaming parsers

#### PRA API Integration
- **Patient Rights Advocate API**: Aggregates hospital transparency URLs
- **Rate Limiting**: 100 requests per minute, implement exponential backoff
- **Data Structure**: Returns hospital metadata with file URLs
- **Change Detection**: Compare lastUpdated timestamps and file hashes
- **State Coverage**: Not all states fully represented, data quality varies

## Critical Paths

### Job Processing Pipeline

#### 1. Hospital Discovery Flow
```
pra-unified-scan
├── Fetches hospitals from PRA API by state
├── Compares with existing hospital records
├── Detects new hospitals and file URL changes
└── Triggers → pra-file-download (for each changed file)
```

#### 2. File Download & Processing
```
pra-file-download
├── Downloads transparency files to MinIO/S3
├── Validates file format and size
├── Calculates file hash for change detection
├── Updates price_transparency_files table
└── Triggers → price-file-parser
```

#### 3. Price Extraction & Normalization
```
price-file-parser
├── Detects file format (CSV/JSON/XML)
├── Streams large files in chunks
├── Extracts price records with validation
├── Handles format-specific parsing logic
└── Triggers → price-normalization

price-normalization
├── Standardizes payer names
├── Validates CPT/DRG codes
├── Normalizes price amounts
├── Deduplicates records
└── Triggers → analytics-refresh
```

#### 4. Analytics Generation
```
analytics-refresh
├── Aggregates prices by service, payer, geography
├── Calculates statistical measures
├── Updates materialized views
└── Emits WebSocket events for real-time updates
```

### BullMQ Job Dependencies
- Jobs use `parent-child` relationships for workflow orchestration
- Failed jobs trigger exponential backoff: 1s, 2s, 4s, 8s, 16s
- Dead letter queue after 5 failed attempts
- Progress reporting every 100 records for large files
- Graceful shutdown handling for long-running jobs

### Drizzle ORM Patterns
```typescript
// Always use transactions for multi-table operations
await db.transaction(async (tx) => {
  const hospital = await tx.insert(hospitals).values({...}).returning();
  await tx.insert(priceTransparencyFiles).values({
    hospitalId: hospital[0].id,
    ...
  });
});

// Use proper indexes from schema definitions
// Example: Search by hospital name uses GIN index
const results = await db.select()
  .from(hospitals)
  .where(sql`name_tsvector @@ plainto_tsquery('english', ${searchTerm})`);
```

### WebSocket Event Flows
```typescript
// Job status updates
@WebSocketGateway()
export class JobsGateway {
  // Emitted events:
  // 'job:started' - When job begins processing
  // 'job:progress' - Progress updates (0-100%)
  // 'job:completed' - Job finished successfully
  // 'job:failed' - Job failed with error
  // 'queue:stats' - Queue statistics update
}
```

## Code Generation Rules

### Work File-by-File, Never Bulk Automate
- **NEVER** create shell scripts, JavaScript files, or any automation scripts to make bulk changes
- **NEVER** use `find`, `sed`, `awk`, or similar tools to modify multiple files at once
- **ALWAYS** work on one file at a time using the Read, Edit, and MultiEdit tools
- **ALWAYS** understand the context before making changes
- **WHY**: Bulk automation creates errors, breaks functionality, and bypasses type safety

### NestJS Module Pattern
```typescript
// Always create three files for each module:
// 1. module.ts - Module definition with imports/exports
@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HospitalController],
  providers: [HospitalService],
  exports: [HospitalService],
})
export class HospitalModule {}

// 2. service.ts - Business logic with dependency injection
@Injectable()
export class HospitalService {
  constructor(
    @Inject('DB') private db: Database,
    private readonly logger: PinoLogger,
  ) {}
}

// 3. controller.ts - HTTP endpoints with Swagger docs
@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}
}
```

### Drizzle Schema Usage
```typescript
// Always import from centralized schema files
import { hospitals, prices, priceTransparencyFiles } from '@/database/schema';

// Use proper types from schema
import type { Hospital, Price, NewHospital } from '@/database/schema';

// Reference relations for joins
import { hospitalsRelations } from '@/database/schema/hospitals';
```

### React Component Patterns
```typescript
// Use existing UI components from shadcn/ui
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Follow established patterns for forms
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Use our custom hooks
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
```

### Error Handling with PinoLogger
```typescript
// Always inject and use PinoLogger
constructor(private readonly logger: PinoLogger) {
  logger.setContext(HospitalService.name);
}

// Log with appropriate context
this.logger.error(
  { err: error, hospitalId, context: 'file-download' },
  'Failed to download transparency file'
);

// Use try-catch with proper error types
try {
  // operation
} catch (error) {
  if (error instanceof ValidationError) {
    throw new BadRequestException(error.message);
  }
  this.logger.error({ err: error }, 'Unexpected error');
  throw new InternalServerErrorException();
}
```

### Job Processing Patterns
```typescript
// Always implement progress tracking
async process(job: Job<PriceFileData>) {
  const totalRecords = await this.countRecords(job.data.filePath);
  let processed = 0;

  for await (const batch of this.streamBatches(job.data.filePath)) {
    await this.processBatch(batch);
    processed += batch.length;
    
    // Report progress every 100 records
    if (processed % 100 === 0) {
      await job.updateProgress((processed / totalRecords) * 100);
    }
  }
}

// Implement proper cleanup
finally {
  await this.cleanup(job.data.tempFiles);
}
```

## Anti-Patterns to Avoid

### Automation Scripts
```bash
# ❌ NEVER create shell scripts to automate changes across multiple files
# This creates tons of errors and bypasses proper type checking
cat > fix-all-types.sh << 'EOF'
for file in $(find . -name "*.ts"); do
  sed -i 's/as any//g' "$file"
done
EOF

# ❌ NEVER create JS/TS scripts to bulk modify files
// fix-all-any-types.js
const files = glob.sync('**/*.ts');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, content.replace(/as any/g, ''));
});

# ✅ ALWAYS work file by file using the provided tools
# Use Read to understand the file
# Use Edit/MultiEdit to make precise, context-aware changes
# This ensures proper type checking and avoids breaking code
```

**Why this matters:**
- Automated scripts can't understand context and make incorrect replacements
- Bulk operations bypass TypeScript's type checking
- Scripts often create syntax errors or break functionality
- Working file-by-file ensures each change is validated and correct
- The tools provided (Read, Edit, MultiEdit, Grep, etc.) are designed for safe, precise operations

### TypeScript
```typescript
// ❌ NEVER use double type assertion - this is a code smell that bypasses type safety
const value = someArray as unknown as string; 

// ✅ Fix the underlying type issue instead
const value = someArray[0]; // If you need first element
const value = someArray.join(','); // If you need string representation

// ❌ NEVER use as any when proper types can be defined
authService.validateApiKey.mockResolvedValue(mockUser as any);

// ✅ Use proper types or fix the mock setup
authService.validateApiKey.mockResolvedValue(mockUser);

// ❌ NEVER bypass TypeScript with multiple assertions
const headers = {
  authorization: ["Bearer token"] as any,
};

// ✅ Create proper mock types for tests
interface MockHeaders {
  [key: string]: string | string[] | undefined;
}
const headers: MockHeaders = {
  authorization: ["Bearer token"],
};
```

### Storage Layer
```typescript
// ❌ NEVER bypass storage abstraction
import * as fs from 'fs';
fs.writeFileSync('/tmp/file.csv', data);

// ✅ ALWAYS use StorageService
await this.storageService.uploadFile(buffer, 'hospitals/file.csv');
```

### Database Schemas
```typescript
// ❌ NEVER create duplicate schemas
const myHospitalsTable = pgTable('my_hospitals', {...});

// ✅ ALWAYS extend existing schemas
import { hospitals } from '@/database/schema/hospitals';
// Use the existing schema or propose modifications
```

### Redis Operations
```typescript
// ❌ NEVER use Redis directly for job management
const redis = new Redis();
await redis.lpush('my-queue', jobData);

// ✅ ALWAYS use BullMQ
await this.myQueue.add('job-name', jobData, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
});
```

### Authentication
```typescript
// ❌ NEVER implement auth logic outside auth module
const user = await db.select().from(users).where(eq(users.email, email));
const isValid = await bcrypt.compare(password, user.password);

// ✅ ALWAYS use AuthService
const user = await this.authService.validateUser(email, password);
const token = await this.authService.generateToken(user);
```

### File Processing
```typescript
// ❌ NEVER load entire file into memory
const fileContent = fs.readFileSync(largeCsvFile, 'utf-8');
const lines = fileContent.split('\n');

// ✅ ALWAYS use streaming for large files
import { pipeline } from 'stream/promises';
import * as csv from 'csv-parser';

await pipeline(
  fs.createReadStream(largeCsvFile),
  csv(),
  new Transform({
    objectMode: true,
    transform: this.processRow.bind(this)
  })
);
```

## Testing Requirements

### Service Method Testing
```typescript
// Every service method needs a test
describe('HospitalService', () => {
  let service: HospitalService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    // Setup mocks
  });

  describe('findByState', () => {
    it('should return hospitals for given state', async () => {
      // Arrange
      const mockHospitals = [{ id: 1, name: 'Test Hospital', state: 'CA' }];
      mockDb.select.mockResolvedValue(mockHospitals);

      // Act
      const result = await service.findByState('CA');

      // Assert
      expect(result).toEqual(mockHospitals);
      expect(mockDb.select).toHaveBeenCalledWith(/* expected query */);
    });

    it('should handle database errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

### API Endpoint Testing
```typescript
// Integration tests for all endpoints
describe('HospitalController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/hospitals (GET)', () => {
    it('should return paginated hospitals', () => {
      return request(app.getHttpServer())
        .get('/hospitals?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });
});
```

### Job Processor Testing
```typescript
// Test job processors with mocked dependencies
describe('PriceFileParserProcessor', () => {
  let processor: PriceFileParserProcessor;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockJob: jest.Mocked<Job>;

  beforeEach(() => {
    mockJob = {
      data: { fileId: '123', filePath: 'hospitals/test.csv' },
      updateProgress: jest.fn(),
    } as any;
  });

  it('should parse CSV file and extract prices', async () => {
    // Mock file stream
    const mockStream = new Readable();
    mockStorageService.getFileStream.mockReturnValue(mockStream);

    // Process job
    const processPromise = processor.process(mockJob);

    // Simulate CSV data
    mockStream.push('CPT,Description,Price\n');
    mockStream.push('99213,Office Visit,150.00\n');
    mockStream.push(null); // End stream

    await processPromise;

    // Verify progress updates
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
  });
});
```

### React Component Testing
```typescript
// Use React Testing Library
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('HospitalList', () => {
  it('should display hospitals and handle pagination', async () => {
    render(<HospitalList />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Hospital')).toBeInTheDocument();
    });

    // Test pagination
    const nextButton = screen.getByRole('button', { name: /next/i });
    await userEvent.click(nextButton);

    // Verify new data loaded
    await waitFor(() => {
      expect(screen.getByText('Page 2 Hospital')).toBeInTheDocument();
    });
  });
});
```

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% coverage for business logic
- **Integration Tests**: All API endpoints must have e2e tests
- **Job Tests**: Each processor must test success and failure scenarios
- **Component Tests**: Interactive components need user interaction tests
- **Error Scenarios**: Test error handling and edge cases

## Dynamic Context & Intelligence

### Project Intelligence Files
The `.claude/memory/` directory contains domain-specific knowledge to enhance Claude's understanding:

- **hospital-data-patterns.json**: Common file formats, encoding issues, data quality patterns
- **pricing-terminology.json**: Healthcare pricing terms, payer categories, code types
- **compliance-requirements.json**: CMS rules, penalties, audit checklists
- **performance-benchmarks.json**: Target metrics for API, jobs, database, and frontend

### Gathering Runtime Context
Before complex tasks, run the context gathering script:

```bash
.claude/scripts/project-context.sh
```

This collects:
- Current service status (Docker, API, database, Redis)
- Job queue metrics (waiting, active, completed, failed)
- Database statistics (row counts per table)
- Recent errors from logs
- Test coverage data
- Performance metrics
- Git status

### Context Files for Planning
Update these files to guide Claude's decisions:

**`.claude/memory/current-sprint-goals.md`**
- Current priorities and tasks
- Sprint objectives
- Blockers and dependencies

**`.claude/memory/recent-incidents.md`**
- Production issues and resolutions
- Lessons learned
- Patterns to avoid

**`.claude/memory/performance-bottlenecks.md`**
- Auto-generated from project-context.sh
- Slow queries and API endpoints
- Memory usage concerns

### Code Pattern References
For implementation examples:
- **Job Processing**: See `@apps/api/src/jobs/processors/`
- **React Components**: See `@apps/web/src/components/admin/`
- **Database Queries**: See `@apps/api/src/analytics/`
- **Authentication**: See `@apps/api/src/auth/`
- **Error Handling**: See `@apps/api/src/common/exceptions/`

### AI Learning Loop
Claude improves over time by:
1. Tracking accepted/rejected suggestions
2. Learning from code review feedback
3. Adapting to team coding patterns
4. Updating memory files with new patterns

### Using Domain Knowledge
When working with healthcare data:
1. Reference `hospital-data-patterns.json` for file format handling
2. Use `pricing-terminology.json` for correct healthcare terms
3. Check `compliance-requirements.json` for regulatory compliance
4. Target `performance-benchmarks.json` metrics in optimizations
