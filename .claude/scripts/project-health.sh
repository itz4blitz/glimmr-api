#!/bin/bash

# Comprehensive Project Health Check Script
# Monitors all aspects of the Glimmr API project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAUDE_DIR")"
REPORT_DIR="$CLAUDE_DIR/memory/health-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/health-report-$TIMESTAMP.md"

mkdir -p "$REPORT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🏥 Running Comprehensive Health Check for Glimmr API..."
echo "# Glimmr API Health Report" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Function to check service health
check_service() {
    local service_name=$1
    local check_command=$2
    local status="❌ Down"
    
    if eval "$check_command" > /dev/null 2>&1; then
        status="✅ Healthy"
        echo -e "${GREEN}✅ $service_name: Healthy${NC}"
    else
        echo -e "${RED}❌ $service_name: Down${NC}"
    fi
    
    echo "- **$service_name**: $status" >> "$REPORT_FILE"
}

# 1. Service Health Checks
echo -e "\n${BLUE}🔍 Checking Service Health...${NC}"
echo "## Service Health" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_service "API Server" "curl -s http://localhost:3000/api/v1/health | grep -q '\"status\":\"ok\"'"
check_service "PostgreSQL" "docker exec glimmr-postgres pg_isready -U postgres"
check_service "Redis" "docker exec glimmr-redis redis-cli ping | grep -q PONG"
check_service "MinIO Storage" "curl -s http://localhost:9000/minio/health/ready"
check_service "Frontend" "curl -s http://localhost:5174 -o /dev/null"

# 2. Database Health
echo -e "\n${BLUE}🗄️ Checking Database Health...${NC}"
echo -e "\n## Database Statistics" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get table sizes and row counts
DB_STATS=$(docker exec glimmr-postgres psql -U postgres -d glimmr_dev -t -c "
SELECT 
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;")

echo "### Top 10 Tables by Size" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "$DB_STATS" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# Check for slow queries
echo -e "\n### Slow Queries (>100ms)" >> "$REPORT_FILE"
SLOW_QUERIES=$(docker exec glimmr-postgres psql -U postgres -d glimmr_dev -t -c "
SELECT 
    calls,
    round(mean_exec_time::numeric, 2) as avg_ms,
    round(max_exec_time::numeric, 2) as max_ms,
    left(query, 60) as query_preview
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 5;" 2>/dev/null || echo "pg_stat_statements not enabled")

echo '```' >> "$REPORT_FILE"
echo "$SLOW_QUERIES" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# 3. Job Queue Health
echo -e "\n${BLUE}📊 Checking Job Queue Health...${NC}"
echo -e "\n## Job Queue Status" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get queue statistics
QUEUE_STATS=$(curl -s http://localhost:3000/api/v1/jobs/status 2>/dev/null | jq -r '
.queues[] | 
"### \(.name)\n- Waiting: \(.waiting)\n- Active: \(.active)\n- Completed: \(.completed)\n- Failed: \(.failed)\n"' || echo "Unable to fetch queue stats")

echo "$QUEUE_STATS" >> "$REPORT_FILE"

# Check for stuck jobs
STUCK_JOBS=$(docker exec glimmr-redis redis-cli --raw eval "
local stuck = {}
local queues = {'pra-unified-scan', 'pra-file-download', 'price-file-parser', 'analytics-refresh'}
for _, queue in ipairs(queues) do
    local active = redis.call('lrange', 'bull:' .. queue .. ':active', 0, -1)
    for _, job in ipairs(active) do
        local job_data = redis.call('hget', 'bull:' .. queue .. ':' .. job, 'timestamp')
        if job_data and (tonumber(redis.call('time')[1]) - tonumber(job_data)/1000) > 3600 then
            table.insert(stuck, queue .. ':' .. job)
        end
    end
end
return #stuck" 0 2>/dev/null || echo "0")

if [ "$STUCK_JOBS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: $STUCK_JOBS stuck jobs detected${NC}"
    echo -e "\n⚠️  **Warning**: $STUCK_JOBS jobs appear to be stuck (>1 hour)" >> "$REPORT_FILE"
fi

# 4. Application Logs Analysis
echo -e "\n${BLUE}📝 Analyzing Application Logs...${NC}"
echo -e "\n## Log Analysis (Last 24 Hours)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count errors in last 24h
ERROR_COUNT=$(docker logs glimmr-api --since 24h 2>&1 | grep -c "ERROR" || echo "0")
WARN_COUNT=$(docker logs glimmr-api --since 24h 2>&1 | grep -c "WARN" || echo "0")

echo "- Errors: $ERROR_COUNT" >> "$REPORT_FILE"
echo "- Warnings: $WARN_COUNT" >> "$REPORT_FILE"

if [ "$ERROR_COUNT" -gt 50 ]; then
    echo -e "${RED}❌ High error rate detected: $ERROR_COUNT errors in 24h${NC}"
    
    # Get most common errors
    echo -e "\n### Most Common Errors" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    docker logs glimmr-api --since 24h 2>&1 | grep "ERROR" | 
        sed 's/.*ERROR.*: //' | sort | uniq -c | sort -rn | head -5 >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

# 5. Performance Metrics
echo -e "\n${BLUE}⚡ Checking Performance Metrics...${NC}"
echo -e "\n## Performance Metrics" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# API response times (if metrics endpoint exists)
RESPONSE_TIMES=$(curl -s http://localhost:3000/api/v1/metrics 2>/dev/null | jq -r '
.http_request_duration_seconds | 
"- P50: \(.p50)ms\n- P95: \(.p95)ms\n- P99: \(.p99)ms"' || echo "Metrics endpoint not available")

echo "### API Response Times" >> "$REPORT_FILE"
echo "$RESPONSE_TIMES" >> "$REPORT_FILE"

# Memory usage
MEMORY_USAGE=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep glimmr)
echo -e "\n### Container Resource Usage" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "$MEMORY_USAGE" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# 6. Security Scan
echo -e "\n${BLUE}🔒 Running Security Checks...${NC}"
echo -e "\n## Security Status" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check for npm vulnerabilities
cd "$PROJECT_ROOT"
NPM_AUDIT=$(pnpm audit --json 2>/dev/null | jq -r '
.metadata | 
"- Total: \(.vulnerabilities.total)\n- Critical: \(.vulnerabilities.critical)\n- High: \(.vulnerabilities.high)\n- Moderate: \(.vulnerabilities.moderate)\n- Low: \(.vulnerabilities.low)"' || echo "Unable to run audit")

echo "### Dependency Vulnerabilities" >> "$REPORT_FILE"
echo "$NPM_AUDIT" >> "$REPORT_FILE"

# Check for exposed secrets
SECRET_CHECK=$(grep -r "api_key\|secret\|password" apps/ --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | grep -v "process.env" | wc -l)
if [ "$SECRET_CHECK" -gt 0 ]; then
    echo -e "${RED}❌ Potential hardcoded secrets detected: $SECRET_CHECK occurrences${NC}"
    echo -e "\n⚠️  **Warning**: $SECRET_CHECK potential hardcoded secrets detected" >> "$REPORT_FILE"
fi

# 7. Test Coverage
echo -e "\n${BLUE}🧪 Checking Test Coverage...${NC}"
echo -e "\n## Test Coverage" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get test coverage if available
cd "$PROJECT_ROOT/apps/api"
if [ -f "coverage/coverage-summary.json" ]; then
    COVERAGE=$(cat coverage/coverage-summary.json | jq -r '
    .total | 
    "- Lines: \(.lines.pct)%\n- Statements: \(.statements.pct)%\n- Functions: \(.functions.pct)%\n- Branches: \(.branches.pct)%"')
    echo "$COVERAGE" >> "$REPORT_FILE"
else
    echo "Coverage report not available. Run \`pnpm test:cov\` to generate." >> "$REPORT_FILE"
fi

# 8. Documentation Coverage
echo -e "\n${BLUE}📚 Checking Documentation...${NC}"
echo -e "\n## Documentation Coverage" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count documented vs undocumented endpoints
TOTAL_ENDPOINTS=$(grep -r "@Controller\|@Get\|@Post\|@Put\|@Delete\|@Patch" "$PROJECT_ROOT/apps/api/src" --include="*.ts" | wc -l)
DOCUMENTED_ENDPOINTS=$(grep -r "@ApiOperation\|@ApiResponse" "$PROJECT_ROOT/apps/api/src" --include="*.ts" | wc -l)
DOC_PERCENTAGE=$((DOCUMENTED_ENDPOINTS * 100 / TOTAL_ENDPOINTS))

echo "- Total API Endpoints: $TOTAL_ENDPOINTS" >> "$REPORT_FILE"
echo "- Documented Endpoints: $DOCUMENTED_ENDPOINTS ($DOC_PERCENTAGE%)" >> "$REPORT_FILE"

# 9. Git Repository Health
echo -e "\n${BLUE}📦 Checking Repository Health...${NC}"
echo -e "\n## Repository Status" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"
UNCOMMITTED=$(git status --porcelain | wc -l)
BRANCH=$(git branch --show-current)
BEHIND=$(git rev-list --count HEAD..origin/$BRANCH 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count origin/$BRANCH..HEAD 2>/dev/null || echo "0")

echo "- Current Branch: $BRANCH" >> "$REPORT_FILE"
echo "- Uncommitted Changes: $UNCOMMITTED files" >> "$REPORT_FILE"
echo "- Behind Origin: $BEHIND commits" >> "$REPORT_FILE"
echo "- Ahead of Origin: $AHEAD commits" >> "$REPORT_FILE"

# 10. Generate Health Score
echo -e "\n${BLUE}🎯 Calculating Health Score...${NC}"
echo -e "\n## Overall Health Score" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Calculate score based on various factors
SCORE=100
ISSUES=""

# Deduct points for issues
[ "$ERROR_COUNT" -gt 50 ] && SCORE=$((SCORE - 10)) && ISSUES="$ISSUES\n- High error rate (-10)"
[ "$SECRET_CHECK" -gt 0 ] && SCORE=$((SCORE - 15)) && ISSUES="$ISSUES\n- Hardcoded secrets (-15)"
[ "$STUCK_JOBS" -gt 0 ] && SCORE=$((SCORE - 10)) && ISSUES="$ISSUES\n- Stuck jobs (-10)"
[ "$DOC_PERCENTAGE" -lt 50 ] && SCORE=$((SCORE - 5)) && ISSUES="$ISSUES\n- Low documentation coverage (-5)"
[ "$UNCOMMITTED" -gt 10 ] && SCORE=$((SCORE - 5)) && ISSUES="$ISSUES\n- Many uncommitted changes (-5)"

# Determine health status
if [ $SCORE -ge 90 ]; then
    STATUS="🟢 Excellent"
    COLOR=$GREEN
elif [ $SCORE -ge 70 ]; then
    STATUS="🟡 Good"
    COLOR=$YELLOW
elif [ $SCORE -ge 50 ]; then
    STATUS="🟠 Fair"
    COLOR=$YELLOW
else
    STATUS="🔴 Poor"
    COLOR=$RED
fi

echo -e "${COLOR}Health Score: $SCORE/100 - $STATUS${NC}"
echo "**Health Score: $SCORE/100 - $STATUS**" >> "$REPORT_FILE"

if [ -n "$ISSUES" ]; then
    echo -e "\n### Issues Detected:" >> "$REPORT_FILE"
    echo -e "$ISSUES" >> "$REPORT_FILE"
fi

# 11. Recommendations
echo -e "\n## Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

[ "$ERROR_COUNT" -gt 50 ] && echo "1. Investigate and fix high error rate in application logs" >> "$REPORT_FILE"
[ "$SECRET_CHECK" -gt 0 ] && echo "2. Remove hardcoded secrets and use environment variables" >> "$REPORT_FILE"
[ "$STUCK_JOBS" -gt 0 ] && echo "3. Clear stuck jobs and investigate job processing issues" >> "$REPORT_FILE"
[ "$DOC_PERCENTAGE" -lt 50 ] && echo "4. Improve API documentation coverage" >> "$REPORT_FILE"
[ "$UNCOMMITTED" -gt 10 ] && echo "5. Commit or stash uncommitted changes" >> "$REPORT_FILE"

# Save quick summary
SUMMARY_FILE="$CLAUDE_DIR/memory/context/health-summary.txt"
echo "Last Health Check: $(date)" > "$SUMMARY_FILE"
echo "Health Score: $SCORE/100 - $STATUS" >> "$SUMMARY_FILE"
echo "Errors (24h): $ERROR_COUNT" >> "$SUMMARY_FILE"
echo "Warnings (24h): $WARN_COUNT" >> "$SUMMARY_FILE"
echo "Stuck Jobs: $STUCK_JOBS" >> "$SUMMARY_FILE"

echo -e "\n${GREEN}✅ Health check complete!${NC}"
echo "📄 Full report saved to: $REPORT_FILE"
echo "📊 Summary saved to: $SUMMARY_FILE"

# If running in CI/CD, exit with appropriate code
if [ "$SCORE" -lt 50 ]; then
    exit 1
fi