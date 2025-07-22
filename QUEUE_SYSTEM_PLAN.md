# Queue System Implementation Plan

## Current State Analysis

### ✅ What's Working
1. **Infrastructure**
   - BullMQ setup with Redis
   - Queue configuration and registration
   - Job stats and monitoring endpoints
   - Schedule system with cron expressions
   - Web UI for monitoring queues

2. **Completed Processors**
   - `export-data` - Fully functional data export processor

3. **UI Features**
   - Queue dashboard with real-time stats
   - Job logs viewer
   - Queue configuration modal
   - Schedule information display
   - Notification system for job events

### ❌ What's Missing

#### 1. **Queue Processors (6 missing)**
All these queues are defined but have NO processor implementations:

- **`pra-unified-scan`**: Should discover hospitals and detect file changes
- **`pra-file-download`**: Should download price transparency files
- **`hospital-import`**: Should import hospital details
- **`price-file-download`**: Should process downloaded price files
- **`price-update`**: Should normalize and update price data
- **`analytics-refresh`**: Should calculate analytics and aggregations
- **`data-validation`**: Should validate data integrity

#### 2. **Job Creation Endpoints**
- No general `/jobs/create` endpoint
- Only specific triggers exist (e.g., `/jobs/pra/scan`)
- No way to manually create jobs for testing

#### 3. **Advanced Queue Features**
- Rate limiting not implemented
- No job prioritization logic
- Missing retry strategies
- No job dependencies/flows
- No job result persistence

#### 4. **Monitoring & Observability**
- No job performance metrics storage
- Missing detailed error tracking
- No alerting on failures
- Limited job history (only current queue state)

## Implementation Plan

### Phase 1: Core Processors (Priority: HIGH)

#### 1.1 PRA Unified Scan Processor
```typescript
// pra-unified-scan.processor.ts
- Fetch hospitals from Patient Rights Advocate API
- Compare with existing hospitals in DB
- Create jobs for new hospitals
- Detect file changes and queue downloads
```

#### 1.2 PRA File Download Processor
```typescript
// pra-file-download.processor.ts
- Download transparency files from hospital URLs
- Store in S3/MinIO with metadata
- Handle retries for failed downloads
- Update file tracking in database
```

#### 1.3 Price File Download Processor
```typescript
// price-file-download.processor.ts
- Process downloaded CSV/Excel files
- Parse price data structures
- Handle different file formats
- Queue price update jobs
```

#### 1.4 Price Update Processor
```typescript
// price-update.processor.ts
- Normalize price data
- Update prices table
- Handle duplicates and conflicts
- Track data lineage
```

### Phase 2: Support Processors

#### 2.1 Hospital Import Processor
```typescript
// hospital-import.processor.ts
- Import detailed hospital information
- Geocoding and address validation
- Update hospital metadata
```

#### 2.2 Analytics Refresh Processor
```typescript
// analytics-refresh.processor.ts
- Calculate aggregate statistics
- Update materialized views
- Generate trend data
- Cache computation results
```

#### 2.3 Data Validation Processor
```typescript
// data-validation.processor.ts
- Check data completeness
- Validate price ranges
- Detect anomalies
- Generate quality reports
```

### Phase 3: Advanced Features

#### 3.1 Job Management API
```typescript
// Enhanced JobsController
POST /jobs/create - Create any job type
GET /jobs/:id/retry - Retry specific job
DELETE /jobs/:id - Cancel job
GET /jobs/history - Historical job data
POST /jobs/bulk - Bulk job creation
```

#### 3.2 Job Flow System
```typescript
// Job dependencies and workflows
- Parent/child job relationships
- Sequential processing chains
- Conditional job execution
- Workflow templates
```

#### 3.3 Performance & Monitoring
```typescript
// Enhanced metrics and monitoring
- Job execution time tracking
- Success/failure rate trends
- Queue throughput metrics
- Resource utilization
- Custom alerts and thresholds
```

### Phase 4: UI Enhancements

#### 4.1 Queue Dashboard Updates
- Job creation UI
- Bulk operations
- Advanced filtering
- Export job data
- Performance graphs

#### 4.2 Job Details View
- Full job history
- Input/output data viewer
- Error stack traces
- Retry history
- Related jobs

#### 4.3 Workflow Builder
- Visual job flow designer
- Template management
- Schedule builder
- Dependency mapper

## Technical Considerations

### 1. **Error Handling**
- Implement consistent error types
- Add detailed error context
- Create retry strategies per job type
- Dead letter queue for failed jobs

### 2. **Performance**
- Batch processing for bulk operations
- Connection pooling for external APIs
- Caching for frequently accessed data
- Rate limiting for API calls

### 3. **Data Integrity**
- Transaction support for critical operations
- Idempotent job processing
- Checkpointing for long-running jobs
- Data validation at each step

### 4. **Scalability**
- Horizontal scaling with multiple workers
- Queue prioritization
- Resource-based job scheduling
- Backpressure handling

## Implementation Priority

1. **Immediate (Week 1)**
   - PRA Unified Scan Processor
   - PRA File Download Processor
   - Basic job creation endpoint

2. **Short Term (Week 2-3)**
   - Price File Download Processor
   - Price Update Processor
   - Job retry/cancel functionality

3. **Medium Term (Week 4-6)**
   - Remaining processors
   - Advanced monitoring
   - Performance optimizations

4. **Long Term (Month 2+)**
   - Workflow system
   - Visual UI builders
   - Advanced analytics

## Success Metrics

- All queues have functional processors
- < 1% job failure rate (excluding external errors)
- Average job processing time < 30s
- 100% data pipeline coverage
- Zero data loss or corruption
- Real-time monitoring and alerting