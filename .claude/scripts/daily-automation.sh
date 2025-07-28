#!/bin/bash

# Daily Automation Routine for Glimmr API
# Performs maintenance, analysis, and optimization tasks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAUDE_DIR")"
REPORT_DIR="$CLAUDE_DIR/memory/daily-reports"
TIMESTAMP=$(date +%Y%m%d)
REPORT_FILE="$REPORT_DIR/daily-report-$TIMESTAMP.md"

mkdir -p "$REPORT_DIR"
mkdir -p "$CLAUDE_DIR/memory/analytics"
mkdir -p "$CLAUDE_DIR/memory/performance"
mkdir -p "$CLAUDE_DIR/memory/security"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🌅 Starting Daily Automation Routine - $(date)"
echo "# Daily Automation Report - $TIMESTAMP" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 1. Security Vulnerability Check
echo -e "\n${BLUE}🔒 Checking Security Vulnerabilities...${NC}"
echo "## Security Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Check npm vulnerabilities
echo "### NPM Audit Results" >> "$REPORT_FILE"
AUDIT_RESULT=$(pnpm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"total":0}}}')
VULN_COUNT=$(echo "$AUDIT_RESULT" | jq -r '.metadata.vulnerabilities.total')
CRITICAL=$(echo "$AUDIT_RESULT" | jq -r '.metadata.vulnerabilities.critical // 0')
HIGH=$(echo "$AUDIT_RESULT" | jq -r '.metadata.vulnerabilities.high // 0')

echo "- Total vulnerabilities: $VULN_COUNT" >> "$REPORT_FILE"
echo "- Critical: $CRITICAL" >> "$REPORT_FILE"
echo "- High: $HIGH" >> "$REPORT_FILE"

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    echo -e "${RED}❌ Critical/High vulnerabilities found!${NC}"
    echo "" >> "$REPORT_FILE"
    echo "#### Vulnerability Details:" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    echo "$AUDIT_RESULT" | jq '.vulnerabilities' >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    
    # Try to auto-fix
    echo "Attempting automatic fix..." >> "$REPORT_FILE"
    pnpm audit fix 2>&1 | tail -20 >> "$REPORT_FILE"
fi

# Check for exposed secrets
echo -e "\n### Secret Exposure Check" >> "$REPORT_FILE"
SECRET_PATTERNS=(
    "api_key"
    "apikey"
    "secret"
    "password"
    "private_key"
    "access_token"
    "auth_token"
)

EXPOSED_SECRETS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    COUNT=$(grep -ri "$pattern" apps/ --include="*.ts" --include="*.tsx" --include="*.js" \
        --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next \
        | grep -v "process.env" | grep -v "interface" | grep -v "type" | wc -l)
    EXPOSED_SECRETS=$((EXPOSED_SECRETS + COUNT))
done

echo "- Potential exposed secrets: $EXPOSED_SECRETS" >> "$REPORT_FILE"

# 2. Dependency Updates
echo -e "\n${BLUE}📦 Checking for Dependency Updates...${NC}"
echo -e "\n## Dependency Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Outdated Dependencies" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
pnpm outdated | head -20 >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# Count outdated deps
OUTDATED_COUNT=$(pnpm outdated --json 2>/dev/null | jq '. | length' || echo "0")
echo -e "\nTotal outdated dependencies: $OUTDATED_COUNT" >> "$REPORT_FILE"

# 3. Performance Analysis
echo -e "\n${BLUE}⚡ Analyzing Performance...${NC}"
echo -e "\n## Performance Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check bundle sizes for frontend
if [ -d "$PROJECT_ROOT/apps/web/dist" ]; then
    echo "### Frontend Bundle Size" >> "$REPORT_FILE"
    BUNDLE_SIZE=$(du -sh "$PROJECT_ROOT/apps/web/dist" 2>/dev/null | cut -f1 || echo "N/A")
    echo "- Total bundle size: $BUNDLE_SIZE" >> "$REPORT_FILE"
    
    # List largest files
    echo -e "\nLargest bundle files:" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    find "$PROJECT_ROOT/apps/web/dist" -type f -name "*.js" -exec ls -lh {} \; | 
        sort -k5 -hr | head -5 | awk '{print $5 " " $9}' >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

# Database query performance
echo -e "\n### Database Performance" >> "$REPORT_FILE"
SLOW_QUERY_COUNT=$(docker exec glimmr-postgres psql -U postgres -d glimmr_dev -t -c "
SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 100;" 2>/dev/null || echo "0")
echo "- Slow queries (>100ms): $SLOW_QUERY_COUNT" >> "$REPORT_FILE"

# Save performance metrics
PERF_FILE="$CLAUDE_DIR/memory/performance/metrics-$TIMESTAMP.json"
cat > "$PERF_FILE" << EOF
{
  "date": "$TIMESTAMP",
  "slowQueries": $SLOW_QUERY_COUNT,
  "bundleSize": "$BUNDLE_SIZE",
  "outdatedDeps": $OUTDATED_COUNT
}
EOF

# 4. Test Coverage Analysis
echo -e "\n${BLUE}🧪 Analyzing Test Coverage...${NC}"
echo -e "\n## Test Coverage" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT/apps/api"
if [ -f "coverage/coverage-summary.json" ]; then
    COVERAGE=$(cat coverage/coverage-summary.json | jq -r '.total')
    LINES=$(echo "$COVERAGE" | jq -r '.lines.pct')
    BRANCHES=$(echo "$COVERAGE" | jq -r '.branches.pct')
    FUNCTIONS=$(echo "$COVERAGE" | jq -r '.functions.pct')
    
    echo "- Line Coverage: ${LINES}%" >> "$REPORT_FILE"
    echo "- Branch Coverage: ${BRANCHES}%" >> "$REPORT_FILE"
    echo "- Function Coverage: ${FUNCTIONS}%" >> "$REPORT_FILE"
    
    # Find uncovered files
    echo -e "\n### Files with Low Coverage (<50%)" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    jq -r 'to_entries | map(select(.key != "total" and .value.lines.pct < 50)) | 
        .[] | "\(.value.lines.pct)% - \(.key)"' coverage/coverage-summary.json | 
        sort -n | head -10 >> "$REPORT_FILE" 2>/dev/null || echo "No low coverage files"
    echo '```' >> "$REPORT_FILE"
else
    echo "No coverage report available. Run tests with coverage to generate." >> "$REPORT_FILE"
fi

# 5. Code Quality Metrics
echo -e "\n${BLUE}📊 Calculating Code Quality Metrics...${NC}"
echo -e "\n## Code Quality" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Count TODOs and FIXMEs
TODO_COUNT=$(grep -r "TODO\|FIXME" apps/ --include="*.ts" --include="*.tsx" --include="*.js" | wc -l)
echo "- TODOs/FIXMEs: $TODO_COUNT" >> "$REPORT_FILE"

# Check for console.log statements
CONSOLE_COUNT=$(grep -r "console\.log" apps/ --include="*.ts" --include="*.tsx" --include="*.js" | 
    grep -v "eslint-disable" | wc -l)
echo "- Console.log statements: $CONSOLE_COUNT" >> "$REPORT_FILE"

# TypeScript strict mode coverage
TS_STRICT=$(find apps/ -name "tsconfig.json" -exec grep -l '"strict": true' {} \; | wc -l)
TS_TOTAL=$(find apps/ -name "tsconfig.json" | wc -l)
echo "- TypeScript strict mode: $TS_STRICT/$TS_TOTAL configs" >> "$REPORT_FILE"

# 6. Documentation Generation
echo -e "\n${BLUE}📚 Updating Documentation...${NC}"
echo -e "\n## Documentation Updates" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Generate API documentation stats
API_CONTROLLERS=$(find "$PROJECT_ROOT/apps/api/src" -name "*.controller.ts" | wc -l)
DOCUMENTED_APIS=$(grep -r "@ApiOperation" "$PROJECT_ROOT/apps/api/src" --include="*.ts" | wc -l)
echo "- API Controllers: $API_CONTROLLERS" >> "$REPORT_FILE"
echo "- Documented Endpoints: $DOCUMENTED_APIS" >> "$REPORT_FILE"

# Check README freshness
README_AGE=$(find "$PROJECT_ROOT" -name "README.md" -mtime +30 | wc -l)
if [ "$README_AGE" -gt 0 ]; then
    echo "- ⚠️  README files older than 30 days: $README_AGE" >> "$REPORT_FILE"
fi

# 7. Optimization Opportunities
echo -e "\n${BLUE}🔧 Finding Optimization Opportunities...${NC}"
echo -e "\n## Optimization Opportunities" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Find large files that might need optimization
echo "### Large Source Files (>500 lines)" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
find apps/ -name "*.ts" -o -name "*.tsx" | 
    xargs wc -l | sort -nr | head -10 | 
    grep -E "^\s*[5-9][0-9]{2,}|^\s*[1-9][0-9]{3,}" >> "$REPORT_FILE" || echo "No large files found"
echo '```' >> "$REPORT_FILE"

# Find potential N+1 queries
echo -e "\n### Potential N+1 Query Patterns" >> "$REPORT_FILE"
N_PLUS_ONE=$(grep -r "forEach.*await\|map.*await" "$PROJECT_ROOT/apps/api/src" --include="*.ts" | wc -l)
echo "- Async operations in loops: $N_PLUS_ONE occurrences" >> "$REPORT_FILE"

# 8. Job Queue Optimization
echo -e "\n${BLUE}🎯 Analyzing Job Queue Performance...${NC}"
echo -e "\n## Job Queue Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get failed job patterns
FAILED_JOBS=$(curl -s http://localhost:3000/api/v1/jobs/failed-summary 2>/dev/null || echo "{}")
if [ "$FAILED_JOBS" != "{}" ]; then
    echo "### Failed Job Patterns" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    echo "$FAILED_JOBS" | jq '.' >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

# 9. Generate Action Items
echo -e "\n${BLUE}📋 Generating Action Items...${NC}"
echo -e "\n## Action Items" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

PRIORITY_HIGH=()
PRIORITY_MEDIUM=()
PRIORITY_LOW=()

# Categorize issues
[ "$CRITICAL" -gt 0 ] && PRIORITY_HIGH+=("Fix $CRITICAL critical security vulnerabilities")
[ "$HIGH" -gt 0 ] && PRIORITY_HIGH+=("Fix $HIGH high security vulnerabilities")
[ "$EXPOSED_SECRETS" -gt 0 ] && PRIORITY_HIGH+=("Remove $EXPOSED_SECRETS potential exposed secrets")
[ "$CONSOLE_COUNT" -gt 10 ] && PRIORITY_MEDIUM+=("Remove $CONSOLE_COUNT console.log statements")
[ "$TODO_COUNT" -gt 50 ] && PRIORITY_MEDIUM+=("Address $TODO_COUNT TODO/FIXME comments")
[ "$OUTDATED_COUNT" -gt 20 ] && PRIORITY_MEDIUM+=("Update $OUTDATED_COUNT outdated dependencies")
[ "$N_PLUS_ONE" -gt 5 ] && PRIORITY_MEDIUM+=("Optimize $N_PLUS_ONE potential N+1 query patterns")
[ "$README_AGE" -gt 0 ] && PRIORITY_LOW+=("Update $README_AGE outdated README files")

echo "### High Priority" >> "$REPORT_FILE"
if [ ${#PRIORITY_HIGH[@]} -eq 0 ]; then
    echo "- ✅ No high priority issues" >> "$REPORT_FILE"
else
    for item in "${PRIORITY_HIGH[@]}"; do
        echo "- 🔴 $item" >> "$REPORT_FILE"
    done
fi

echo -e "\n### Medium Priority" >> "$REPORT_FILE"
if [ ${#PRIORITY_MEDIUM[@]} -eq 0 ]; then
    echo "- ✅ No medium priority issues" >> "$REPORT_FILE"
else
    for item in "${PRIORITY_MEDIUM[@]}"; do
        echo "- 🟡 $item" >> "$REPORT_FILE"
    done
fi

echo -e "\n### Low Priority" >> "$REPORT_FILE"
if [ ${#PRIORITY_LOW[@]} -eq 0 ]; then
    echo "- ✅ No low priority issues" >> "$REPORT_FILE"
else
    for item in "${PRIORITY_LOW[@]}"; do
        echo "- 🟢 $item" >> "$REPORT_FILE"
    done
fi

# 10. Update Analytics
echo -e "\n${BLUE}📈 Updating Analytics...${NC}"

# Log daily metrics
ANALYTICS_FILE="$CLAUDE_DIR/memory/analytics/daily-metrics.csv"
if [ ! -f "$ANALYTICS_FILE" ]; then
    echo "date,vulnerabilities,outdated_deps,todos,console_logs,test_coverage" > "$ANALYTICS_FILE"
fi

# Append today's metrics
echo "$TIMESTAMP,$VULN_COUNT,$OUTDATED_COUNT,$TODO_COUNT,$CONSOLE_COUNT,${LINES:-0}" >> "$ANALYTICS_FILE"

# 11. Generate Summary Dashboard
SUMMARY_FILE="$CLAUDE_DIR/memory/daily-summary.md"
cat > "$SUMMARY_FILE" << EOF
# Daily Summary - $TIMESTAMP

## 🚨 Critical Issues
- Security Vulnerabilities: **$VULN_COUNT** (Critical: $CRITICAL, High: $HIGH)
- Exposed Secrets: **$EXPOSED_SECRETS**

## 📊 Code Health
- TODOs/FIXMEs: **$TODO_COUNT**
- Console.logs: **$CONSOLE_COUNT**
- Test Coverage: **${LINES:-N/A}%**

## 📦 Dependencies
- Outdated: **$OUTDATED_COUNT**

## 🎯 Top Priorities
EOF

if [ ${#PRIORITY_HIGH[@]} -gt 0 ]; then
    echo "1. ${PRIORITY_HIGH[0]}" >> "$SUMMARY_FILE"
fi
if [ ${#PRIORITY_MEDIUM[@]} -gt 0 ]; then
    echo "2. ${PRIORITY_MEDIUM[0]}" >> "$SUMMARY_FILE"
fi

# Create notification if critical issues
if [ "$CRITICAL" -gt 0 ] || [ "$EXPOSED_SECRETS" -gt 0 ]; then
    NOTIFICATION_FILE="$CLAUDE_DIR/memory/notifications/critical-$(date +%s).txt"
    mkdir -p "$CLAUDE_DIR/memory/notifications"
    echo "CRITICAL ISSUES DETECTED on $TIMESTAMP" > "$NOTIFICATION_FILE"
    echo "- Critical vulnerabilities: $CRITICAL" >> "$NOTIFICATION_FILE"
    echo "- Exposed secrets: $EXPOSED_SECRETS" >> "$NOTIFICATION_FILE"
fi

echo -e "\n${GREEN}✅ Daily automation complete!${NC}"
echo "📄 Full report: $REPORT_FILE"
echo "📊 Summary: $SUMMARY_FILE"
echo "📈 Analytics updated: $ANALYTICS_FILE"

# Exit with error if critical issues found
if [ "$CRITICAL" -gt 0 ] || [ "$EXPOSED_SECRETS" -gt 0 ]; then
    echo -e "\n${RED}❌ Critical issues detected - manual intervention required${NC}"
    exit 1
fi