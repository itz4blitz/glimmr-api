#!/bin/bash

# Glimmr Project Context Gatherer
# This script collects runtime context to give Claude full project intelligence

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTEXT_DIR=".claude/memory"
CONTEXT_FILE="$CONTEXT_DIR/current-context.json"
API_URL="http://localhost:3000/api/v1"

# Ensure context directory exists
mkdir -p "$CONTEXT_DIR"

echo -e "${BLUE}Gathering Glimmr project context...${NC}"

# Initialize context object
cat > "$CONTEXT_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": {
    "nodeVersion": "$(node -v 2>/dev/null || echo 'not installed')",
    "npmVersion": "$(npm -v 2>/dev/null || echo 'not installed')",
    "pnpmVersion": "$(pnpm -v 2>/dev/null || echo 'not installed')",
    "dockerRunning": $(docker info &>/dev/null && echo "true" || echo "false"),
    "servicesRunning": {}
  },
EOF

# Check Docker services
if docker info &>/dev/null; then
    echo -e "${GREEN}✓ Docker is running${NC}"
    
    # Check each service
    services=("glimmr-api" "glimmr-postgres" "glimmr-redis" "glimmr-minio" "glimmr-web")
    echo "  \"servicesRunning\": {" >> "$CONTEXT_FILE"
    
    for i in "${!services[@]}"; do
        service="${services[$i]}"
        if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
            echo -e "  ${GREEN}✓ ${service} is running${NC}"
            status="running"
        else
            echo -e "  ${RED}✗ ${service} is not running${NC}"
            status="stopped"
        fi
        
        # Add comma except for last item
        comma=""
        if [ $i -lt $((${#services[@]} - 1)) ]; then
            comma=","
        fi
        echo "    \"${service}\": \"${status}\"${comma}" >> "$CONTEXT_FILE"
    done
    
    echo "  }," >> "$CONTEXT_FILE"
else
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "  }," >> "$CONTEXT_FILE"
fi

# API Health Check
echo -e "\n${BLUE}Checking API health...${NC}"
echo "  \"apiHealth\": {" >> "$CONTEXT_FILE"

if curl -s "${API_URL}/health" > /dev/null 2>&1; then
    health_response=$(curl -s "${API_URL}/health")
    echo -e "${GREEN}✓ API is healthy${NC}"
    echo "    \"status\": \"healthy\"," >> "$CONTEXT_FILE"
    echo "    \"response\": ${health_response}" >> "$CONTEXT_FILE"
else
    echo -e "${RED}✗ API is not responding${NC}"
    echo "    \"status\": \"unhealthy\"" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Job Queue Status
echo -e "\n${BLUE}Checking job queues...${NC}"
echo "  \"jobQueues\": {" >> "$CONTEXT_FILE"

if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "^glimmr-redis$"; then
    # Get queue lengths
    queues=("pra-unified-scan" "pra-file-download" "price-file-parser" "price-normalization" "analytics-refresh")
    
    for i in "${!queues[@]}"; do
        queue="${queues[$i]}"
        
        # Get various queue metrics
        waiting=$(docker exec glimmr-redis redis-cli llen "bull:${queue}:wait" 2>/dev/null || echo "0")
        active=$(docker exec glimmr-redis redis-cli llen "bull:${queue}:active" 2>/dev/null || echo "0")
        completed=$(docker exec glimmr-redis redis-cli zcard "bull:${queue}:completed" 2>/dev/null || echo "0")
        failed=$(docker exec glimmr-redis redis-cli zcard "bull:${queue}:failed" 2>/dev/null || echo "0")
        
        echo -e "  Queue: ${queue}"
        echo -e "    Waiting: ${waiting}, Active: ${active}, Completed: ${completed}, Failed: ${failed}"
        
        # Add to JSON
        comma=""
        if [ $i -lt $((${#queues[@]} - 1)) ]; then
            comma=","
        fi
        
        cat >> "$CONTEXT_FILE" << EOF
    "${queue}": {
      "waiting": ${waiting},
      "active": ${active},
      "completed": ${completed},
      "failed": ${failed}
    }${comma}
EOF
    done
else
    echo -e "${YELLOW}⚠ Redis not accessible, skipping queue metrics${NC}"
    echo "    \"error\": \"Redis not accessible\"" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Database Statistics
echo -e "\n${BLUE}Checking database statistics...${NC}"
echo "  \"database\": {" >> "$CONTEXT_FILE"

if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "^glimmr-postgres$"; then
    # Get row counts for main tables
    tables=("hospitals" "prices" "price_transparency_files" "jobs" "analytics")
    
    for i in "${!tables[@]}"; do
        table="${tables[$i]}"
        count=$(docker exec glimmr-postgres psql -U postgres -d glimmr_dev -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "0")
        count=$(echo $count | tr -d ' ')
        
        echo -e "  Table ${table}: ${count} rows"
        
        # Add to JSON
        comma=""
        if [ $i -lt $((${#tables[@]} - 1)) ]; then
            comma=","
        fi
        
        echo "    \"${table}_count\": ${count}${comma}" >> "$CONTEXT_FILE"
    done
else
    echo -e "${YELLOW}⚠ PostgreSQL not accessible, skipping database metrics${NC}"
    echo "    \"error\": \"PostgreSQL not accessible\"" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Recent Errors from Logs
echo -e "\n${BLUE}Checking recent errors...${NC}"
echo "  \"recentErrors\": [" >> "$CONTEXT_FILE"

if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "^glimmr-api$"; then
    # Get last 10 error logs
    errors=$(docker logs glimmr-api --tail 1000 2>&1 | grep -i "error" | tail -10 | head -5)
    
    if [ -n "$errors" ]; then
        echo -e "${YELLOW}Found recent errors:${NC}"
        error_count=0
        while IFS= read -r line; do
            # Escape quotes and add to JSON
            escaped_line=$(echo "$line" | sed 's/"/\\"/g')
            echo "    \"${escaped_line}\"," >> "$CONTEXT_FILE"
            echo "  - ${line}"
            ((error_count++))
        done <<< "$errors"
        
        # Remove trailing comma from last error
        sed -i '$ s/,$//' "$CONTEXT_FILE"
    else
        echo -e "${GREEN}✓ No recent errors found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ API logs not accessible${NC}"
fi

echo "  ]," >> "$CONTEXT_FILE"

# Test Coverage (if available)
echo -e "\n${BLUE}Checking test coverage...${NC}"
echo "  \"testCoverage\": {" >> "$CONTEXT_FILE"

if [ -f "apps/api/coverage/coverage-summary.json" ]; then
    coverage=$(cat apps/api/coverage/coverage-summary.json | jq '.total.lines.pct' 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ Test coverage: ${coverage}%${NC}"
    echo "    \"lines\": ${coverage}," >> "$CONTEXT_FILE"
    echo "    \"available\": true" >> "$CONTEXT_FILE"
else
    echo -e "${YELLOW}⚠ No test coverage data found${NC}"
    echo "    \"available\": false" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Performance Metrics
echo -e "\n${BLUE}Gathering performance metrics...${NC}"
echo "  \"performance\": {" >> "$CONTEXT_FILE"

if command -v docker &> /dev/null; then
    # Get container stats
    stats=$(docker stats --no-stream --format "json" glimmr-api glimmr-postgres glimmr-redis 2>/dev/null || echo "{}")
    
    if [ -n "$stats" ] && [ "$stats" != "{}" ]; then
        echo -e "${GREEN}✓ Collected performance metrics${NC}"
        echo "    \"containers\": [" >> "$CONTEXT_FILE"
        
        # Process each line of stats
        first=true
        while IFS= read -r line; do
            if [ "$first" = true ]; then
                first=false
            else
                echo "," >> "$CONTEXT_FILE"
            fi
            echo "      $line" >> "$CONTEXT_FILE"
        done <<< "$stats"
        
        echo "    ]" >> "$CONTEXT_FILE"
    else
        echo -e "${YELLOW}⚠ Could not collect performance metrics${NC}"
        echo "    \"available\": false" >> "$CONTEXT_FILE"
    fi
else
    echo "    \"available\": false" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Current Git Status
echo -e "\n${BLUE}Checking git status...${NC}"
echo "  \"gitStatus\": {" >> "$CONTEXT_FILE"

if command -v git &> /dev/null; then
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    modified=$(git status --porcelain | wc -l | tr -d ' ')
    last_commit=$(git log -1 --format="%h - %s" 2>/dev/null || echo "unknown")
    
    echo -e "  Branch: ${branch}"
    echo -e "  Modified files: ${modified}"
    echo -e "  Last commit: ${last_commit}"
    
    cat >> "$CONTEXT_FILE" << EOF
    "branch": "${branch}",
    "modifiedFiles": ${modified},
    "lastCommit": "${last_commit}"
EOF
else
    echo "    \"available\": false" >> "$CONTEXT_FILE"
fi

echo "  }," >> "$CONTEXT_FILE"

# Recent User Activity (if available)
echo -e "\n${BLUE}Checking recent activity...${NC}"
echo "  \"recentActivity\": {" >> "$CONTEXT_FILE"

if [ -f "error.log" ]; then
    last_error_time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" error.log 2>/dev/null || echo "unknown")
    echo "    \"lastErrorLog\": \"${last_error_time}\"" >> "$CONTEXT_FILE"
else
    echo "    \"lastErrorLog\": null" >> "$CONTEXT_FILE"
fi

echo "  }" >> "$CONTEXT_FILE"

# Close JSON
echo "}" >> "$CONTEXT_FILE"

# Create summary files for quick reference
echo -e "\n${BLUE}Creating summary files...${NC}"

# Current sprint goals (placeholder for user to fill)
if [ ! -f "$CONTEXT_DIR/current-sprint-goals.md" ]; then
    cat > "$CONTEXT_DIR/current-sprint-goals.md" << EOF
# Current Sprint Goals

## Sprint: $(date +"%Y-%m-%d")

### High Priority
- [ ] Complete job system enhancements
- [ ] Improve error handling
- [ ] Add monitoring dashboards

### Medium Priority
- [ ] Optimize database queries
- [ ] Add more test coverage
- [ ] Document API endpoints

### Low Priority
- [ ] Refactor legacy code
- [ ] Update dependencies

### Notes
Add your current sprint goals here to help Claude understand priorities.
EOF
fi

# Recent incidents (placeholder)
if [ ! -f "$CONTEXT_DIR/recent-incidents.md" ]; then
    cat > "$CONTEXT_DIR/recent-incidents.md" << EOF
# Recent Incidents & Issues

## Known Issues
- None currently tracked

## Recent Fixes
- None currently tracked

## Performance Bottlenecks
- Large CSV file processing can timeout
- Analytics refresh on full dataset is slow

Add incidents and resolutions here to help Claude avoid repeat issues.
EOF
fi

# Performance bottlenecks
cat > "$CONTEXT_DIR/performance-bottlenecks.md" << EOF
# Current Performance Bottlenecks

Generated: $(date)

## Database Queries
EOF

# Add slow queries if PostgreSQL is running
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "^glimmr-postgres$"; then
    echo "### Slow Queries (>100ms)" >> "$CONTEXT_DIR/performance-bottlenecks.md"
    docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
    SELECT query, mean_exec_time, calls 
    FROM pg_stat_statements 
    WHERE mean_exec_time > 100 
    ORDER BY mean_exec_time DESC 
    LIMIT 5;" 2>/dev/null >> "$CONTEXT_DIR/performance-bottlenecks.md" || echo "No slow query data available" >> "$CONTEXT_DIR/performance-bottlenecks.md"
fi

cat >> "$CONTEXT_DIR/performance-bottlenecks.md" << EOF

## Memory Usage
Check container stats above for current memory usage.

## Queue Processing
Large files (>1GB) may cause memory issues during parsing.

## API Response Times
Monitor /api/v1/admin/queues endpoint for real-time metrics.
EOF

echo -e "\n${GREEN}✓ Context gathering complete!${NC}"
echo -e "Context saved to: ${BLUE}${CONTEXT_FILE}${NC}"
echo -e "\nSummary files in ${BLUE}${CONTEXT_DIR}/${NC}:"
ls -la "$CONTEXT_DIR"/*.md 2>/dev/null | awk '{print "  - " $9}'

# Display quick summary
echo -e "\n${BLUE}Quick Summary:${NC}"
cat << EOF
- Environment: $(uname -s) $(uname -m)
- Docker: $(docker info &>/dev/null && echo "Running" || echo "Not running")
- API: $(curl -s "${API_URL}/health" &>/dev/null && echo "Healthy" || echo "Not responding")
- Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
- Modified Files: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

Run this script before complex tasks to give Claude full project context!
EOF