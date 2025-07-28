#!/bin/bash

# Weekly Documentation Health Report Generator
# Runs documentation checks and generates comprehensive reports

set -euo pipefail

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📊 Weekly Documentation Health Report${NC}"
echo "====================================="
echo "Starting at: $(date)"

# Create report directory
REPORT_DIR=".claude/reports/weekly-$(date +%Y%m%d)"
mkdir -p "$REPORT_DIR"

# Function to run documentation freshness check
run_freshness_check() {
    echo -e "\n${YELLOW}1. Running documentation freshness check...${NC}"
    bash .claude/scripts/doc-freshness-check.sh 2>&1 | tee "$REPORT_DIR/freshness-check.log"
}

# Function to analyze documentation coverage trends
analyze_trends() {
    echo -e "\n${YELLOW}2. Analyzing documentation coverage trends...${NC}"
    
    # Create trends file if it doesn't exist
    TRENDS_FILE=".claude/reports/doc-coverage-trends.csv"
    if [ ! -f "$TRENDS_FILE" ]; then
        echo "date,total_files,documented,missing,outdated,coverage_percent" > "$TRENDS_FILE"
    fi
    
    # Extract metrics from latest freshness report
    if [ -f ".claude/reports/doc-health-"*.md ]; then
        LATEST_REPORT=$(ls -t .claude/reports/doc-health-*.md | head -1)
        
        # Parse metrics (this is a simplified example)
        TOTAL=$(grep "Total files analyzed:" "$LATEST_REPORT" | grep -oE "[0-9]+")
        DOCUMENTED=$(grep "Documented files:" "$LATEST_REPORT" | grep -oE "[0-9]+")
        MISSING=$(grep "Missing documentation:" "$LATEST_REPORT" | grep -oE "[0-9]+")
        OUTDATED=$(grep "Outdated documentation:" "$LATEST_REPORT" | grep -oE "[0-9]+")
        COVERAGE=$(grep "Documentation Coverage:" "$LATEST_REPORT" | grep -oE "[0-9]+\.[0-9]+")
        
        # Append to trends
        echo "$(date +%Y-%m-%d),$TOTAL,$DOCUMENTED,$MISSING,$OUTDATED,$COVERAGE" >> "$TRENDS_FILE"
    fi
}

# Function to identify documentation gaps
identify_gaps() {
    echo -e "\n${YELLOW}3. Identifying documentation gaps...${NC}"
    
    GAPS_REPORT="$REPORT_DIR/documentation-gaps.md"
    
    cat > "$GAPS_REPORT" <<EOF
# Documentation Gaps Analysis

Generated: $(date)

## Critical Gaps

### 1. Undocumented API Endpoints
EOF
    
    # Find controllers without swagger docs
    find apps/api/src -name "*.controller.ts" -exec grep -L "@ApiOperation" {} \; | while read -r file; do
        echo "- $file" >> "$GAPS_REPORT"
    done
    
    cat >> "$GAPS_REPORT" <<EOF

### 2. Components Without Stories
EOF
    
    # Find components without storybook stories
    find apps/web/src/components -name "*.tsx" | while read -r component; do
        STORY_FILE="${component%.tsx}.stories.tsx"
        if [ ! -f "$STORY_FILE" ] && [ ! -f "apps/web/src/stories/$(basename "$component" .tsx).stories.tsx" ]; then
            echo "- $component" >> "$GAPS_REPORT"
        fi
    done
    
    cat >> "$GAPS_REPORT" <<EOF

### 3. Services Without Examples
EOF
    
    # Find services without @example tags
    find apps/api/src -name "*.service.ts" -exec grep -L "@example" {} \; | while read -r file; do
        echo "- $file" >> "$GAPS_REPORT"
    done
}

# Function to generate documentation tasks
generate_doc_tasks() {
    echo -e "\n${YELLOW}4. Generating documentation tasks...${NC}"
    
    TASKS_FILE="$REPORT_DIR/documentation-tasks.md"
    
    cat > "$TASKS_FILE" <<EOF
# Documentation Tasks for Week of $(date +%Y-%m-%d)

## Priority 1: Security & Auth Documentation
EOF
    
    # Check auth-related files
    find apps/api/src/auth -name "*.ts" | while read -r file; do
        if ! grep -q "^\s*\/\*\*" "$file"; then
            echo "- [ ] Document $file" >> "$TASKS_FILE"
        fi
    done
    
    cat >> "$TASKS_FILE" <<EOF

## Priority 2: New Features Documentation

### Recently Added (Last 7 Days)
EOF
    
    # Find recently added files
    git log --since="7 days ago" --name-status --diff-filter=A | grep "^A" | grep -E "\.(ts|tsx)$" | while read -r status file; do
        echo "- [ ] Document new file: $file" >> "$TASKS_FILE"
    done
    
    cat >> "$TASKS_FILE" <<EOF

### Recently Modified (>5 commits)
EOF
    
    # Find frequently modified files
    git log --since="30 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -10 | while read -r count file; do
        if [ "$count" -gt 5 ] && [[ "$file" =~ \.(ts|tsx)$ ]]; then
            echo "- [ ] Update documentation for: $file (modified $count times)" >> "$TASKS_FILE"
        fi
    done
    
    cat >> "$TASKS_FILE" <<EOF

## Priority 3: Component Documentation

Components needing documentation:
EOF
    
    # List top 10 undocumented components
    find apps/web/src/components -name "*.tsx" | while read -r component; do
        if [ ! -f "docs/components/$(basename "$component" .tsx).md" ]; then
            echo "- [ ] $(basename "$component")" >> "$TASKS_FILE"
        fi
    done | head -10 >> "$TASKS_FILE"
}

# Function to create visual report
create_visual_report() {
    echo -e "\n${YELLOW}5. Creating visual documentation report...${NC}"
    
    # Generate a simple ASCII chart of coverage trends
    VISUAL_REPORT="$REPORT_DIR/visual-report.txt"
    
    echo "Documentation Coverage Trend (Last 4 Weeks)" > "$VISUAL_REPORT"
    echo "===========================================" >> "$VISUAL_REPORT"
    echo "" >> "$VISUAL_REPORT"
    
    if [ -f ".claude/reports/doc-coverage-trends.csv" ]; then
        tail -4 .claude/reports/doc-coverage-trends.csv | while IFS=',' read -r date total documented missing outdated coverage; do
            if [ "$date" != "date" ]; then
                # Create simple bar chart
                BAR_LENGTH=$(echo "scale=0; $coverage / 2" | bc)
                BAR=$(printf '█%.0s' $(seq 1 "$BAR_LENGTH"))
                EMPTY_LENGTH=$((50 - BAR_LENGTH))
                EMPTY=$(printf '░%.0s' $(seq 1 "$EMPTY_LENGTH"))
                
                printf "%s |%s%s| %.1f%%\n" "$date" "$BAR" "$EMPTY" "$coverage" >> "$VISUAL_REPORT"
            fi
        done
    fi
    
    echo "" >> "$VISUAL_REPORT"
    echo "Legend: █ = Documented, ░ = Undocumented" >> "$VISUAL_REPORT"
}

# Function to generate executive summary
generate_summary() {
    echo -e "\n${YELLOW}6. Generating executive summary...${NC}"
    
    SUMMARY_FILE="$REPORT_DIR/executive-summary.md"
    
    # Get current metrics
    CURRENT_COVERAGE=$(tail -1 .claude/reports/doc-coverage-trends.csv 2>/dev/null | cut -d',' -f6 || echo "0")
    PREV_COVERAGE=$(tail -2 .claude/reports/doc-coverage-trends.csv 2>/dev/null | head -1 | cut -d',' -f6 || echo "0")
    COVERAGE_CHANGE=$(echo "scale=2; $CURRENT_COVERAGE - $PREV_COVERAGE" | bc)
    
    # Determine trend
    TREND="→"
    TREND_COLOR=""
    if (( $(echo "$COVERAGE_CHANGE > 0" | bc -l) )); then
        TREND="↑"
        TREND_COLOR="green"
    elif (( $(echo "$COVERAGE_CHANGE < 0" | bc -l) )); then
        TREND="↓"
        TREND_COLOR="red"
    fi
    
    cat > "$SUMMARY_FILE" <<EOF
# Documentation Health Executive Summary

**Week of $(date +%Y-%m-%d)**

## Key Metrics

| Metric | Value | Trend |
|--------|-------|-------|
| Documentation Coverage | ${CURRENT_COVERAGE}% | $TREND ${COVERAGE_CHANGE}% |
| Critical Gaps | $(grep -c "^-" "$REPORT_DIR/documentation-gaps.md" || echo 0) | - |
| New Tasks | $(grep -c "^\- \[ \]" "$REPORT_DIR/documentation-tasks.md" || echo 0) | - |

## Highlights

### ✅ Achievements This Week
- Documentation coverage ${TREND} by ${COVERAGE_CHANGE}%
- Generated comprehensive documentation reports
- Identified priority documentation tasks

### ⚠️ Areas of Concern
EOF
    
    # Add top concerns
    if [ -f "$REPORT_DIR/documentation-gaps.md" ]; then
        echo "- $(grep -c "Undocumented API" "$REPORT_DIR/documentation-gaps.md" || echo 0) API endpoints lack documentation" >> "$SUMMARY_FILE"
        echo "- $(grep -c "Without Stories" "$REPORT_DIR/documentation-gaps.md" || echo 0) components without Storybook stories" >> "$SUMMARY_FILE"
    fi
    
    cat >> "$SUMMARY_FILE" <<EOF

### 🎯 Recommendations

1. **Immediate Actions**
   - Document all authentication-related code
   - Add Swagger decorators to API endpoints
   - Create Storybook stories for top 5 components

2. **This Week's Focus**
   - Achieve 80% documentation coverage
   - Document all new features from last sprint
   - Update outdated documentation

3. **Process Improvements**
   - Add documentation checks to PR reviews
   - Implement automated documentation generation
   - Schedule weekly documentation reviews

## Next Steps

1. Review detailed reports in \`$REPORT_DIR/\`
2. Assign documentation tasks from \`documentation-tasks.md\`
3. Run documentation generators:
   \`\`\`bash
   bash .claude/commands/docs/generate-api-docs.md
   bash .claude/commands/docs/generate-component-docs.md
   \`\`\`

---

*Report generated by Weekly Documentation Health System*
EOF
    
    echo -e "${GREEN}✅ Executive summary created${NC}"
}

# Function to send notifications (if configured)
send_notifications() {
    echo -e "\n${YELLOW}7. Sending notifications...${NC}"
    
    # Check if notification webhook is configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        COVERAGE=$(tail -1 .claude/reports/doc-coverage-trends.csv 2>/dev/null | cut -d',' -f6 || echo "0")
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"📚 Weekly Documentation Report\",
                \"blocks\": [
                    {
                        \"type\": \"section\",
                        \"text\": {
                            \"type\": \"mrkdwn\",
                            \"text\": \"*Documentation Coverage:* ${COVERAGE}%\n*Report:* $REPORT_DIR/\"
                        }
                    }
                ]
            }" 2>/dev/null || echo "Failed to send Slack notification"
    fi
    
    # Create a notification file for other systems
    echo "Documentation report available at: $REPORT_DIR/" > .claude/reports/latest-doc-report.txt
}

# Main execution
main() {
    run_freshness_check
    analyze_trends
    identify_gaps
    generate_doc_tasks
    create_visual_report
    generate_summary
    send_notifications
    
    echo -e "\n${GREEN}✅ Weekly documentation report complete!${NC}"
    echo "Reports available in: $REPORT_DIR/"
    echo ""
    echo "Quick actions:"
    echo "- View summary: cat $REPORT_DIR/executive-summary.md"
    echo "- View tasks: cat $REPORT_DIR/documentation-tasks.md"
    echo "- View gaps: cat $REPORT_DIR/documentation-gaps.md"
}

# Run main function
main