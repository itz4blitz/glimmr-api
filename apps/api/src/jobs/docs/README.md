# Glimmr API Job System

A comprehensive job processing system for healthcare price transparency data aggregation, featuring automated hospital discovery, smart file change detection, and efficient data processing.

## 🏗️ Architecture Overview

The job system is built on **BullMQ** with **Redis** as the message broker, providing reliable background processing with monitoring via **Bull Board**.

### Core Components

- **Queue Management**: Centralized queue configuration and monitoring
- **Job Processors**: Specialized workers for different data processing tasks
- **Scheduled Jobs**: Automated cron-based data collection
- **Manual Triggers**: API endpoints for on-demand job execution

## 📋 Job Queues

### **Hospital Data Jobs**

#### `pra-unified-scan` 🆕

**Primary hospital discovery and file change detection system**

- **Purpose**: Scans all 51 US states via Patient Rights Advocate API
- **Frequency**: Twice daily (6 AM & 6 PM)
- **Features**:
  - Discovers new hospitals automatically
  - Detects file changes using retrieved timestamps
  - Smart queueing (only processes updated files)
  - Test mode for development (CA, FL, TX only)

**Recent Performance**:

```
Full Scan: 51 states, 6,675 hospitals in 3 minutes
- New hospitals: 631 (9.4%)
- Updated hospitals: 6,043 (90.5%)
- Files queued: 708 (10.6% - smart detection working)
- Success rate: 100% (0 errors)
```

#### `hospital-import`

**Legacy hospital import system**

- **Purpose**: Imports hospital data from various sources
- **Triggers**: Manual or scheduled
- **Sources**: CMS data, manual uploads, API integrations

#### `pra-file-download`

**Downloads price transparency files from hospitals**

- **Purpose**: Downloads files queued by unified scanner
- **Features**: Retry logic, progress tracking, metadata storage
- **Storage**: DigitalOcean Spaces (production) / MinIO (development)

### **Price Data Processing Jobs**

#### `price-file-download`

**Processes downloaded price files**

- **Purpose**: Extracts price data from CSV/Excel files
- **Features**: Format normalization, batch processing, error handling
- **Formats**: CSV, XLSX, XLS, JSON

#### `price-update`

**Updates and normalizes price data**

- **Purpose**: Data quality improvements and standardization
- **Features**: Duplicate detection, price validation, format consistency

### **Analytics & Maintenance Jobs**

#### `analytics-refresh`

**Refreshes analytics data and calculations**

- **Purpose**: Updates dashboards and reporting data
- **Frequency**: Configurable based on data volume

#### `data-validation`

**Validates data integrity and quality**

- **Purpose**: Ensures data consistency across the system
- **Features**: Referential integrity, data quality metrics

#### `export-data`

**Handles data exports for external systems**

- **Purpose**: PowerBI integration, API exports, data sharing
- **Formats**: OData, JSON, CSV

## 🚀 Getting Started

### Prerequisites

- Redis/Valkey running
- PostgreSQL database
- DigitalOcean Spaces (production) or MinIO (development)

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/glimmr

# Storage
STORAGE_ENDPOINT=your-spaces-endpoint
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=your-bucket-name
```

### Running the System

```bash
# Start the API (includes job processors)
npm run start:dev

# Access Bull Board Dashboard
http://localhost:3000/api/v1/admin/queues
```

## 📡 API Endpoints

### Manual Job Triggers

```bash
# Trigger PRA unified scan
POST /api/v1/jobs/pra/scan
{
  "testMode": false,
  "forceRefresh": false
}

# Get PRA pipeline status
GET /api/v1/jobs/pra/status

# Trigger full refresh
POST /api/v1/jobs/pra/full-refresh

# Get all job statuses
GET /api/v1/jobs/status
```

### Response Example

```json
{
  "message": "PRA unified scan triggered",
  "jobId": "1",
  "testMode": false,
  "forceRefresh": false
}
```

## ⏰ Scheduled Jobs

| Job                 | Schedule          | Description                                  |
| ------------------- | ----------------- | -------------------------------------------- |
| PRA Unified Scan    | 6 AM & 6 PM daily | Hospital discovery and file change detection |
| Weekly Full Refresh | Sunday 1 AM       | Complete hospital data refresh               |
| Job Cleanup         | Daily 3 AM        | Remove old completed/failed jobs             |

## 🔧 Configuration

### Queue Settings

Located in `src/jobs/queues/queue.config.ts`:

```typescript
export const QUEUE_CONFIGS = {
  [QUEUE_NAMES.PRA_UNIFIED_SCAN]: {
    defaultJobOptions: {
      removeOnComplete: 5,
      removeOnFail: 10,
      attempts: 2,
      backoff: { type: "exponential", delay: 60000 },
    },
  },
  // ... other queues
};
```

### Job Priorities

- **Manual triggers**: 8-10 (highest)
- **Scheduled jobs**: 5-7 (medium)
- **Background processing**: 1-4 (lowest)

## 📊 Monitoring

### Bull Board Dashboard

Access the visual job monitoring dashboard at:
`http://localhost:3000/api/v1/admin/queues`

**Features**:

- Real-time job status
- Queue statistics
- Job details and logs
- Manual job management
- Performance metrics

### Logging

All jobs use structured logging with:

- Job IDs for tracing
- Performance metrics
- Error details
- Operation context

## 🛠️ Development

### Adding New Jobs

1. **Create Processor**:

```typescript
@Injectable()
@Processor(QUEUE_NAMES.YOUR_QUEUE)
export class YourProcessor extends WorkerHost {
  async process(job: Job<YourJobData>): Promise<YourJobResult> {
    // Implementation
  }
}
```

2. **Register Queue**:

```typescript
// In queue.config.ts
export const QUEUE_NAMES = {
  YOUR_QUEUE: "your-queue-name",
};
```

3. **Add to Module**:

```typescript
// In jobs.module.ts
providers: [
  YourProcessor,
  // ... other processors
];
```

### Testing Jobs

```bash
# Test mode (limited states)
curl -X POST http://localhost:3000/api/v1/jobs/pra/scan \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'

# Check job status
curl http://localhost:3000/api/v1/jobs/pra/status
```

## 🔍 Troubleshooting

### Common Issues

1. **Jobs not processing**: Check Redis connection
2. **High memory usage**: Adjust batch sizes in processors
3. **API rate limits**: Increase delays between requests
4. **Storage errors**: Verify DigitalOcean Spaces credentials

### Performance Tuning

- **Batch sizes**: Adjust based on available memory
- **Concurrency**: Configure worker concurrency in BullMQ
- **Cleanup**: Regular job cleanup to prevent memory leaks

## 📈 Performance Metrics

### Current Benchmarks

- **Hospital scanning**: ~36 hospitals/second
- **File processing**: 1000 records/batch
- **API efficiency**: 10.6% file update rate (smart detection)
- **Error rate**: <0.1% across all operations

## 🤝 Contributing

1. Follow existing patterns for job processors
2. Include comprehensive error handling
3. Add appropriate logging and monitoring
4. Test with both test mode and full runs
5. Update this README for new features

## 📚 Related Documentation

- [Bull Board Documentation](https://github.com/felixmosh/bull-board)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Patient Rights Advocate API](https://pts.patientrightsadvocatefiles.org/)
