#!/bin/bash

# Weekly Code Janitor Script
# Runs all code health checks and generates reports

set -euo pipefail

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🧹 Weekly Code Janitor${NC}"
echo "======================"
echo "Starting at: $(date)"
echo ""

# Create log directory
LOG_DIR=".claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/janitor-$(date +%Y%m%d-%H%M%S).log"

# Function to log output
log() {
    echo "$@" | tee -a "$LOG_FILE"
}

# Run dead code check
log -e "\n${YELLOW}1. Running dead code check...${NC}"
if bash .claude/scripts/dead-code-check.sh 2>&1 | tee -a "$LOG_FILE"; then
    log -e "${GREEN}✓ Dead code check completed${NC}"
else
    log -e "${YELLOW}⚠ Dead code check found issues${NC}"
fi

# Run code health score
log -e "\n${YELLOW}2. Calculating code health score...${NC}"
if bash .claude/scripts/code-health-score.sh 2>&1 | tee -a "$LOG_FILE"; then
    log -e "${GREEN}✓ Code health score calculated${NC}"
else
    log -e "${YELLOW}⚠ Code health score calculation had issues${NC}"
fi

# Run jscpd for duplication detection
log -e "\n${YELLOW}3. Detecting code duplication...${NC}"
if command -v jscpd &> /dev/null; then
    jscpd apps \
        --min-tokens 50 \
        --reporters "json,html" \
        --output ".claude/reports/duplication" \
        --ignore "**/*.spec.ts,**/*.test.ts,**/node_modules/**,**/dist/**" \
        2>&1 | tee -a "$LOG_FILE" || true
    log -e "${GREEN}✓ Duplication detection completed${NC}"
else
    log -e "${YELLOW}⚠ jscpd not installed - skipping duplication detection${NC}"
    log "Install with: npm install -g jscpd"
fi

# Generate summary report
log -e "\n${YELLOW}4. Generating summary report...${NC}"

SUMMARY_FILE=".claude/reports/weekly-summary-$(date +%Y%m%d).md"
cat > "$SUMMARY_FILE" <<EOF
# Weekly Code Janitor Summary

Generated: $(date)

## Reports Generated

- Dead Code Report: \`$(ls -t .claude/reports/dead-code-report-*.md | head -1)\`
- Code Health Report: \`$(ls -t .claude/reports/code-health-*.md | head -1)\`
- Duplication Report: \`.claude/reports/duplication/jscpd-report.html\`

## Quick Stats

EOF

# Extract key metrics
if [ -f ".claude/reports/health-history.csv" ]; then
    LATEST_SCORE=$(tail -1 .claude/reports/health-history.csv | cut -d',' -f2)
    echo "- **Overall Health Score**: $LATEST_SCORE/100" >> "$SUMMARY_FILE"
fi

# Add action items
echo -e "\n## Recommended Actions\n" >> "$SUMMARY_FILE"

# Check for critical issues
CRITICAL_ISSUES=0

# Check dead code count
if [ -f ".claude/reports/dead-code-report-"*.md ]; then
    DEAD_CODE_COUNT=$(grep "Total issues" $(ls -t .claude/reports/dead-code-report-*.md | head -1) | grep -oE "[0-9]+" | tail -1 || echo 0)
    if [ "$DEAD_CODE_COUNT" -gt 50 ]; then
        echo "1. **Critical**: Remove dead code - $DEAD_CODE_COUNT issues found" >> "$SUMMARY_FILE"
        ((CRITICAL_ISSUES++))
    fi
fi

# Check old TODOs
OLD_TODOS=$(find apps -name "*.ts" -o -name "*.tsx" | xargs grep -l "TODO\|FIXME" | wc -l || echo 0)
if [ "$OLD_TODOS" -gt 30 ]; then
    echo "2. **Important**: Address old TODOs - $OLD_TODOS files with TODOs" >> "$SUMMARY_FILE"
    ((CRITICAL_ISSUES++))
fi

if [ "$CRITICAL_ISSUES" -eq 0 ]; then
    echo "✅ No critical issues found. Good job maintaining code health!" >> "$SUMMARY_FILE"
fi

log -e "${GREEN}✓ Summary report saved to: $SUMMARY_FILE${NC}"

# Send notification (if configured)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    log -e "\n${YELLOW}5. Sending notification...${NC}"
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"Weekly Code Janitor completed. Health Score: ${LATEST_SCORE:-N/A}/100\"}" \
        2>&1 | tee -a "$LOG_FILE" || true
fi

log -e "\n${GREEN}🎉 Weekly Code Janitor completed!${NC}"
log "Full log available at: $LOG_FILE"

# Cleanup old reports (keep last 4 weeks)
log -e "\n${YELLOW}Cleaning up old reports...${NC}"
find .claude/reports -name "*.md" -mtime +28 -delete 2>/dev/null || true
find .claude/logs -name "*.log" -mtime +28 -delete 2>/dev/null || true
log -e "${GREEN}✓ Cleanup completed${NC}"

exit 0