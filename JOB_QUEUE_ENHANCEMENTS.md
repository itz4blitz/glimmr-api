# Job Queue Backend Enhancements

This document describes the backend enhancements made to support the new job queue UI features.

## Overview

The backend has been enhanced with comprehensive features to support real-time monitoring, advanced filtering, bulk operations, scheduling, analytics, and export functionality for the job queue system.

## New Features Implemented

### 1. WebSocket Support for Real-time Updates

**Implementation:**
- Created `JobsGateway` class for WebSocket communication
- Added JWT authentication for WebSocket connections
- Enhanced `JobEventListener` to emit real-time events
- Supports room-based subscriptions (per queue, per job, all jobs)

**Events Emitted:**
- `jobUpdate` - Job status changes
- `jobAdded` - New job added to queue
- `jobCompleted` - Job completed successfully
- `jobFailed` - Job failed
- `jobProgress` - Job progress updates
- `queueStats` - Queue statistics updates
- `queueStateChange` - Queue paused/resumed
- `systemStats` - System-wide statistics
- `alert` - System alerts and warnings

**Usage:**
```javascript
// Client connects to WebSocket
const socket = io('http://localhost:3000/jobs', {
  auth: { token: 'JWT_TOKEN' }
});

// Subscribe to specific queue
socket.emit('subscribeQueue', { queue: 'price-file-parser' });

// Listen for updates
socket.on('jobUpdate', (data) => {
  console.log('Job updated:', data);
});
```

### 2. Advanced Filtering and Search

**Endpoint:** `GET /api/v1/jobs/search`

**Features:**
- Search by job name or ID
- Filter by multiple statuses
- Filter by queue names
- Date range filtering
- Duration filtering (min/max)
- Priority filtering
- Pagination with offset/limit
- Sorting by multiple fields
- Include/exclude job data in response

**Example:**
```bash
GET /api/v1/jobs/search?search=price&status[]=completed&status[]=failed&queues[]=price-file-parser&startDate=2024-01-01&sortBy=duration&sortOrder=desc&page=1&limit=20
```

### 3. Bulk Operations

**Retry Multiple Jobs:**
- Endpoint: `POST /api/v1/jobs/bulk/retry`
- Body: `{ jobIds: ["job1", "job2", "job3"] }`
- Validates job states before retrying
- Returns detailed results for each job

**Cancel Multiple Jobs:**
- Endpoint: `POST /api/v1/jobs/bulk/cancel`
- Body: `{ jobIds: ["job1", "job2", "job3"] }`
- Only cancels jobs in cancellable states
- Returns detailed results for each job

### 4. Job Scheduling System

**Features:**
- Cron-based job scheduling
- Timezone support
- Template-based job configuration
- Automatic failure handling
- Schedule enable/disable
- Manual schedule execution

**Endpoints:**
- `GET /api/v1/jobs/schedules` - List all schedules
- `GET /api/v1/jobs/schedules/:id` - Get specific schedule
- `POST /api/v1/jobs/schedules` - Create new schedule
- `PUT /api/v1/jobs/schedules/:id` - Update schedule
- `DELETE /api/v1/jobs/schedules/:id` - Delete schedule
- `POST /api/v1/jobs/schedules/:id/run` - Run schedule immediately

**Example Schedule Creation:**
```json
{
  "name": "Daily Analytics Refresh",
  "description": "Refreshes analytics data every day at 2 AM",
  "templateId": "550e8400-e29b-41d4-a716-446655440000",
  "cronExpression": "0 2 * * *",
  "timezone": "America/New_York",
  "priority": 5,
  "isEnabled": true
}
```

### 5. Analytics Endpoints

**Success Trends:**
- Endpoint: `GET /api/v1/jobs/analytics/success-trends`
- Shows success rates over time
- Grouping by time intervals (15min, hour, day)
- Per-queue breakdown
- Trend analysis (improving/stable/declining)

**Performance Metrics:**
- Endpoint: `GET /api/v1/jobs/analytics/performance`
- Throughput (jobs/hour)
- Average processing time
- Min/max processing times
- Active/waiting job counts
- Failure rates

**Failure Analysis:**
- Endpoint: `GET /api/v1/jobs/analytics/failures`
- Failure counts by queue
- Top failure reasons
- Failure trends over time
- Top failing jobs
- Automated recommendations

**Resource Usage:**
- Endpoint: `GET /api/v1/jobs/analytics/resource-usage`
- CPU usage tracking
- Memory usage tracking
- Redis usage metrics
- Database usage metrics
- Queue-specific resource usage
- Resource alerts

### 6. Export Functionality

**Endpoint:** `POST /api/v1/jobs/export`

**Supported Formats:**
- CSV - Comma-separated values
- JSON - Structured JSON data
- Excel - Multi-sheet workbook with formatting

**Features:**
- Apply filters before export
- Select specific fields
- Include/exclude job data
- Include/exclude job logs
- Excel includes summary sheet
- Uploads to storage service
- Returns download URL

**Example:**
```json
{
  "format": "excel",
  "filters": {
    "status": ["completed", "failed"],
    "queues": ["price-file-parser"],
    "startDate": "2024-01-01"
  },
  "fields": ["id", "jobName", "status", "duration", "createdAt"],
  "includeData": false,
  "includeLogs": true
}
```

### 7. Enhanced Job Service Methods

**New Methods Added:**
- `searchJobs()` - Advanced search with filters
- `bulkRetryJobs()` - Retry multiple jobs
- `bulkCancelJobs()` - Cancel multiple jobs
- `getQueueConfigsWithSchedules()` - Configs with schedule info

## Database Schema Updates

The existing schema already supports:
- Job tracking (`jobs` table)
- Job logs (`job_logs` table)
- Job templates (`job_templates` table)
- Job schedules (`job_schedules` table)
- Queue configurations (`job_queue_configs` table)

## Required Dependencies

Install the following dependencies to use all features:

```bash
# WebSocket support
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io

# Export functionality
pnpm add exceljs csv-writer

# Scheduling (already installed via @nestjs/schedule)
# cron and cron-parser are already available
```

## Security Considerations

1. **WebSocket Authentication:**
   - JWT token required for connection
   - Role-based access control
   - Per-room authorization

2. **Rate Limiting:**
   - Applied to expensive operations
   - Bulk operations limited
   - Export operations throttled

3. **Data Access:**
   - Role-based filtering
   - Sensitive data excluded from WebSocket events
   - Audit logging for all operations

## Performance Optimizations

1. **Pagination:**
   - All list endpoints support pagination
   - Default and maximum limits enforced

2. **Caching:**
   - Queue statistics cached
   - Analytics data aggregated efficiently

3. **Database Queries:**
   - Indexed fields for common queries
   - Efficient aggregation queries
   - Connection pooling

## Monitoring and Alerts

1. **WebSocket Monitoring:**
   - Connected clients tracking
   - Event emission metrics
   - Connection health checks

2. **Queue Health:**
   - Automatic health status calculation
   - Alert thresholds configurable
   - WebSocket alerts for critical issues

3. **Resource Monitoring:**
   - CPU/Memory usage tracking
   - Redis connection monitoring
   - Database connection pool status

## Usage Examples

### Subscribe to Real-time Updates
```javascript
const socket = io('http://localhost:3000/jobs', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connected', () => {
  // Subscribe to specific queue
  socket.emit('subscribeQueue', { queue: 'price-file-parser' });
  
  // Or subscribe to all jobs (admin only)
  socket.emit('subscribeAll');
});

socket.on('jobUpdate', (data) => {
  console.log('Job updated:', data);
});
```

### Perform Bulk Retry
```javascript
const response = await fetch('/api/v1/jobs/bulk/retry', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jobIds: ['job1', 'job2', 'job3']
  })
});
```

### Create a Schedule
```javascript
const response = await fetch('/api/v1/jobs/schedules', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Hourly Price Update',
    templateId: 'price-update-template-id',
    cronExpression: '0 * * * *',
    timezone: 'UTC',
    isEnabled: true
  })
});
```

### Export Jobs to Excel
```javascript
const response = await fetch('/api/v1/jobs/export', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    format: 'excel',
    filters: {
      status: ['completed'],
      startDate: '2024-01-01'
    },
    includeLogs: true
  })
});

const { url } = await response.json();
// Download from the returned URL
```

## Testing

To test the new features:

1. **Install dependencies:**
   ```bash
   ./install-job-deps.sh
   ```

2. **Restart the API:**
   ```bash
   cd apps/api
   pnpm start:dev
   ```

3. **Test WebSocket connection:**
   - Use a WebSocket client or the frontend application
   - Authenticate with a valid JWT token
   - Subscribe to queues and monitor events

4. **Test endpoints:**
   - Use Swagger UI at http://localhost:3000/api/docs
   - All new endpoints are documented with examples

## Next Steps

1. **Frontend Integration:**
   - Connect the React UI to WebSocket events
   - Implement real-time updates in components
   - Add export download functionality

2. **Performance Tuning:**
   - Monitor WebSocket connection scaling
   - Optimize database queries for large datasets
   - Implement Redis caching for analytics

3. **Additional Features:**
   - Job templates UI
   - Advanced scheduling UI
   - Custom alert configurations
   - Job dependency management