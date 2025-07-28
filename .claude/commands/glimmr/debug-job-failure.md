---
name: debug-job-failure
description: Analyzes failed BullMQ jobs, examines job data, checks logs, suggests fixes, and can replay jobs with modifications
allowed-tools:
  - bash
  - read
  - grep
  - edit
---

# Debug Job Failure Command

Analyzes failed BullMQ jobs and helps diagnose and fix issues.

## Usage
```
/debug-job-failure <queue-name> [job-id]
```

Examples:
- `/debug-job-failure pra-unified-scan`
- `/debug-job-failure price-file-parser 12345`

## Steps

1. First, check the current job queue status:

```bash
# List all queues and their status
curl -s http://localhost:3000/api/v1/jobs/status | jq '.'

# Check specific queue stats
docker exec glimmr-redis redis-cli -h localhost -p 6379 <<EOF
LLEN bull:${queueName}:failed
LLEN bull:${queueName}:waiting
LLEN bull:${queueName}:active
LLEN bull:${queueName}:completed
EOF
```

2. Get failed jobs from the queue:

```bash
# List recent failed jobs
docker exec glimmr-redis redis-cli -h localhost -p 6379 <<EOF
LRANGE bull:${queueName}:failed 0 10
EOF

# If specific job ID provided, get job details
if [ -n "${jobId}" ]; then
  docker exec glimmr-redis redis-cli -h localhost -p 6379 <<EOF
HGETALL bull:${queueName}:${jobId}
EOF
fi
```

3. Check application logs for errors:

```bash
# Search for job-related errors in the last 100 lines
docker logs glimmr-api --tail 1000 | grep -E "(${queueName}|Job.*failed|Error processing)" | tail -20

# Look for specific job ID if provided
if [ -n "${jobId}" ]; then
  docker logs glimmr-api --tail 1000 | grep "${jobId}" | tail -20
fi

# Check for common error patterns
docker logs glimmr-api --tail 1000 | grep -E "(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|OOM|heap|memory)" | tail -10
```

4. Use bull-repl for interactive debugging:

```bash
# Start bull-repl session
docker exec -it glimmr-api npx bull-repl

# In the REPL, connect to the queue
> connect ${queueName}

# Get failed jobs
> failed

# Examine specific job
> get ${jobId}

# Get job logs
> logs ${jobId}

# Exit REPL
> exit
```

5. Analyze common failure patterns:

```bash
# Check for database connection issues
docker exec glimmr-postgres pg_isready -U postgres

# Check Redis connectivity
docker exec glimmr-api redis-cli -h glimmr-redis ping

# Check storage service (MinIO)
docker exec glimmr-api curl -s http://glimmr-minio:9000/minio/health/ready

# Check memory usage
docker stats glimmr-api --no-stream
```

6. Based on the error type, provide specific fixes:

### Network/Connection Errors
```bash
# ECONNREFUSED - Service not reachable
# Fix: Check if all services are running
docker-compose -f docker-compose.dev.yml ps

# Restart specific service if down
docker-compose -f docker-compose.dev.yml restart ${service}
```

### Memory/Performance Issues
```bash
# Check current memory limits
docker inspect glimmr-api | jq '.[0].HostConfig.Memory'

# Monitor memory usage during job processing
docker stats glimmr-api

# Suggestion: Increase memory or optimize batch sizes
```

### File Processing Errors
```bash
# Check if file exists in storage
docker exec glimmr-minio mc ls local/glimmr-files/${filePath}

# Check file permissions and size
docker exec glimmr-minio mc stat local/glimmr-files/${filePath}
```

### Database Errors
```bash
# Check for lock issues
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT pid, usename, application_name, state, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC;"

# Check for failed migrations
cd apps/api && pnpm db:migrate:status
```

7. Replay failed jobs with modifications:

```typescript
// Create a script to replay the job
cat > /tmp/replay-job.js << 'EOF'
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

async function replayJob() {
  const queue = new Queue('${queueName}', { connection: redis });
  
  // Get the failed job data
  const failedJob = await queue.getJob('${jobId}');
  if (!failedJob) {
    console.error('Job not found');
    process.exit(1);
  }

  console.log('Original job data:', failedJob.data);
  console.log('Failed reason:', failedJob.failedReason);
  console.log('Stack trace:', failedJob.stacktrace);

  // Modify job data based on the error
  const modifiedData = {
    ...failedJob.data,
    // Add modifications based on error type
    ${getModificationSuggestions(errorType)}
  };

  // Remove the failed job
  await failedJob.remove();

  // Add the job again with modifications
  const newJob = await queue.add(failedJob.name, modifiedData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });

  console.log('New job created with ID:', newJob.id);
  console.log('Modified data:', modifiedData);
  
  await redis.quit();
}

replayJob().catch(console.error);
EOF

# Run the replay script
docker exec glimmr-api node /tmp/replay-job.js
```

8. Monitor the replayed job:

```bash
# Watch job progress
watch -n 2 "curl -s http://localhost:3000/api/v1/jobs/status | jq '.[] | select(.name==\"${queueName}\")'"

# Tail logs for the new job
docker logs glimmr-api -f | grep -E "(${queueName}|${newJobId})"
```

## Common Issues and Solutions

### 1. File Download Failures
```bash
# Error: ENOTFOUND or ETIMEDOUT downloading file
# Solution: Add retry logic with exponential backoff

# Check if URL is accessible
curl -I "${fileUrl}"

# Replay with increased timeout
modifiedData.downloadTimeout = 300000; // 5 minutes
modifiedData.retryAttempts = 5;
```

### 2. Memory Exhaustion
```bash
# Error: JavaScript heap out of memory
# Solution: Process in smaller chunks

# Check file size first
docker exec glimmr-minio mc ls local/glimmr-files/${filePath} --json | jq '.size'

# Replay with smaller batch size
modifiedData.batchSize = 100; // Instead of 1000
modifiedData.streamProcessing = true;
```

### 3. Database Constraints
```bash
# Error: duplicate key value violates unique constraint
# Solution: Use upsert or check existence first

# Find duplicates
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT ${uniqueColumn}, COUNT(*) 
FROM ${table} 
GROUP BY ${uniqueColumn} 
HAVING COUNT(*) > 1;"

# Replay with conflict handling
modifiedData.conflictHandling = 'upsert';
```

### 4. Invalid Data Format
```bash
# Error: Unexpected token in JSON
# Solution: Validate and clean data

# Check file encoding
file -bi "${localFilePath}"

# Try different parsers
modifiedData.parserOptions = {
  encoding: 'utf-8',
  skipInvalidRows: true,
  maxErrors: 100,
};
```

### 5. Rate Limiting
```bash
# Error: 429 Too Many Requests
# Solution: Add delays between requests

# Check current rate
docker logs glimmr-api --tail 100 | grep -c "429"

# Replay with rate limiting
modifiedData.rateLimit = {
  maxConcurrent: 2,
  minTime: 1000, // 1 second between requests
};
```

## Automated Fix Suggestions

Based on the error pattern, here are automated fixes:

```javascript
function getModificationSuggestions(errorType) {
  const suggestions = {
    'ECONNREFUSED': {
      retryAttempts: 5,
      retryDelay: 10000,
      connectionTimeout: 30000,
    },
    'ENOMEM': {
      batchSize: 50,
      streamProcessing: true,
      gcInterval: 1000,
    },
    'ENOTFOUND': {
      validateUrl: true,
      fallbackUrl: null,
      skipOnError: true,
    },
    'SyntaxError': {
      strictParsing: false,
      encoding: 'utf-8',
      skipInvalidRows: true,
    },
    '429': {
      rateLimit: { maxConcurrent: 1, minTime: 2000 },
      exponentialBackoff: true,
    },
  };

  return suggestions[errorType] || {};
}
```

## Post-Fix Verification

After fixing and replaying the job:

```bash
# 1. Verify job completed successfully
curl -s http://localhost:3000/api/v1/jobs/status | jq ".[] | select(.name==\"${queueName}\")"

# 2. Check data was processed correctly
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT COUNT(*) FROM ${targetTable} WHERE created_at > NOW() - INTERVAL '5 minutes';"

# 3. Ensure no new errors
docker logs glimmr-api --tail 50 | grep -i error

# 4. Check queue health
curl -s http://localhost:3000/api/v1/admin/queues/${queueName}/health
```

## Prevention Tips

1. **Add comprehensive error handling** in processors
2. **Implement idempotent operations** to allow safe retries
3. **Use transactions** for multi-step operations
4. **Add validation** before processing
5. **Monitor memory usage** and implement streaming for large files
6. **Set appropriate timeouts** for external requests
7. **Log context** with every error for easier debugging