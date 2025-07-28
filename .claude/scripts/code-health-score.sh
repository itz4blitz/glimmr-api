#!/bin/bash

# Code Health Score Calculator for Glimmr
# Tracks various code quality metrics over time

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Code Health Score Calculator${NC}"
echo "=================================="

# Initialize scores
TOTAL_SCORE=100
TEST_COVERAGE_SCORE=0
DEAD_CODE_SCORE=0
TODO_SCORE=0
COMPLEXITY_SCORE=0
DUPLICATION_SCORE=0

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to calculate test coverage score
calculate_test_coverage() {
    echo -e "\n${YELLOW}Calculating test coverage...${NC}"
    
    # Run coverage for API
    if [ -d "apps/api" ]; then
        cd apps/api
        if command -v pnpm &> /dev/null; then
            pnpm test:cov --silent > "$TEMP_DIR/api-coverage.txt" 2>&1 || true
            
            # Extract coverage percentage
            API_COVERAGE=$(grep -E "All files.*\|.*\|.*\|.*\|" "$TEMP_DIR/api-coverage.txt" | awk '{print $10}' | sed 's/%//' | head -1)
            
            if [ -n "$API_COVERAGE" ]; then
                echo "API Test Coverage: ${API_COVERAGE}%"
                
                # Score calculation (target: 80%)
                if (( $(echo "$API_COVERAGE >= 80" | bc -l) )); then
                    TEST_COVERAGE_SCORE=25
                elif (( $(echo "$API_COVERAGE >= 60" | bc -l) )); then
                    TEST_COVERAGE_SCORE=20
                elif (( $(echo "$API_COVERAGE >= 40" | bc -l) )); then
                    TEST_COVERAGE_SCORE=10
                else
                    TEST_COVERAGE_SCORE=0
                fi
            fi
        fi
        cd - > /dev/null
    fi
    
    echo -e "${GREEN}Test Coverage Score: $TEST_COVERAGE_SCORE/25${NC}"
}

# Function to calculate dead code score
calculate_dead_code_score() {
    echo -e "\n${YELLOW}Calculating dead code score...${NC}"
    
    # Run dead code check
    if [ -f ".claude/scripts/dead-code-check.sh" ]; then
        bash .claude/scripts/dead-code-check.sh > "$TEMP_DIR/dead-code.txt" 2>&1 || true
        
        # Extract total issues
        DEAD_CODE_COUNT=$(grep "Total issues:" "$TEMP_DIR/dead-code.txt" | awk '{print $3}' | tail -1)
        
        if [ -n "$DEAD_CODE_COUNT" ]; then
            echo "Dead Code Issues: $DEAD_CODE_COUNT"
            
            # Score calculation
            if [ "$DEAD_CODE_COUNT" -eq 0 ]; then
                DEAD_CODE_SCORE=20
            elif [ "$DEAD_CODE_COUNT" -le 10 ]; then
                DEAD_CODE_SCORE=15
            elif [ "$DEAD_CODE_COUNT" -le 25 ]; then
                DEAD_CODE_SCORE=10
            elif [ "$DEAD_CODE_COUNT" -le 50 ]; then
                DEAD_CODE_SCORE=5
            else
                DEAD_CODE_SCORE=0
            fi
        fi
    fi
    
    echo -e "${GREEN}Dead Code Score: $DEAD_CODE_SCORE/20${NC}"
}

# Function to calculate TODO/FIXME score
calculate_todo_score() {
    echo -e "\n${YELLOW}Calculating TODO/FIXME age...${NC}"
    
    # Find all TODO/FIXME comments with git blame to get age
    TODO_COUNT=0
    OLD_TODO_COUNT=0
    
    # Search for TODOs and FIXMEs
    grep -rn "TODO\|FIXME" apps --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | while read -r line; do
        ((TODO_COUNT++))
        
        # Extract file and line number
        FILE=$(echo "$line" | cut -d: -f1)
        LINE_NUM=$(echo "$line" | cut -d: -f2)
        
        # Get the commit date for this line
        if command -v git &> /dev/null && [ -d ".git" ]; then
            COMMIT_DATE=$(git blame -L "$LINE_NUM,$LINE_NUM" "$FILE" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
            
            if [ -n "$COMMIT_DATE" ]; then
                # Calculate age in days
                AGE_DAYS=$(( ($(date +%s) - $(date -d "$COMMIT_DATE" +%s)) / 86400 ))
                
                if [ "$AGE_DAYS" -gt 30 ]; then
                    ((OLD_TODO_COUNT++))
                    echo "Old TODO (${AGE_DAYS} days): $line" >> "$TEMP_DIR/old-todos.txt"
                fi
            fi
        fi
    done
    
    echo "Total TODOs/FIXMEs: $TODO_COUNT"
    echo "Old TODOs (>30 days): $OLD_TODO_COUNT"
    
    # Score calculation
    if [ "$OLD_TODO_COUNT" -eq 0 ]; then
        TODO_SCORE=15
    elif [ "$OLD_TODO_COUNT" -le 5 ]; then
        TODO_SCORE=10
    elif [ "$OLD_TODO_COUNT" -le 15 ]; then
        TODO_SCORE=5
    else
        TODO_SCORE=0
    fi
    
    echo -e "${GREEN}TODO/FIXME Score: $TODO_SCORE/15${NC}"
}

# Function to calculate complexity score
calculate_complexity_score() {
    echo -e "\n${YELLOW}Calculating code complexity...${NC}"
    
    # Count functions with high line counts
    COMPLEX_FUNCTIONS=0
    
    # Find TypeScript functions longer than 50 lines
    find apps -name "*.ts" -o -name "*.tsx" | while read -r file; do
        # Simple heuristic: count functions with more than 50 lines
        awk '/^[[:space:]]*(async[[:space:]]+)?function|^[[:space:]]*(public|private|protected)?[[:space:]]*(async[[:space:]]+)?[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\(/ {
            start = NR
        }
        /^[[:space:]]*\}[[:space:]]*$/ {
            if (start > 0) {
                lines = NR - start
                if (lines > 50) {
                    print FILENAME ":" start "-" NR " (" lines " lines)"
                    complex++
                }
                start = 0
            }
        }
        END {
            if (complex > 0) exit complex
        }' "$file" >> "$TEMP_DIR/complex-functions.txt" 2>/dev/null || true
    done
    
    COMPLEX_FUNCTIONS=$(wc -l < "$TEMP_DIR/complex-functions.txt" 2>/dev/null || echo 0)
    echo "Complex functions (>50 lines): $COMPLEX_FUNCTIONS"
    
    # Score calculation
    if [ "$COMPLEX_FUNCTIONS" -eq 0 ]; then
        COMPLEXITY_SCORE=20
    elif [ "$COMPLEX_FUNCTIONS" -le 5 ]; then
        COMPLEXITY_SCORE=15
    elif [ "$COMPLEX_FUNCTIONS" -le 15 ]; then
        COMPLEXITY_SCORE=10
    elif [ "$COMPLEX_FUNCTIONS" -le 30 ]; then
        COMPLEXITY_SCORE=5
    else
        COMPLEXITY_SCORE=0
    fi
    
    echo -e "${GREEN}Complexity Score: $COMPLEXITY_SCORE/20${NC}"
}

# Function to calculate duplication score
calculate_duplication_score() {
    echo -e "\n${YELLOW}Calculating code duplication...${NC}"
    
    # Use jscpd if available
    if command -v jscpd &> /dev/null; then
        jscpd apps --reporters json --silent --output "$TEMP_DIR" 2>/dev/null || true
        
        if [ -f "$TEMP_DIR/jscpd-report.json" ]; then
            DUPLICATION_PERCENT=$(jq -r '.statistics.total.percentage // 0' "$TEMP_DIR/jscpd-report.json" 2>/dev/null || echo "0")
            echo "Code Duplication: ${DUPLICATION_PERCENT}%"
            
            # Score calculation
            if (( $(echo "$DUPLICATION_PERCENT < 3" | bc -l) )); then
                DUPLICATION_SCORE=20
            elif (( $(echo "$DUPLICATION_PERCENT < 5" | bc -l) )); then
                DUPLICATION_SCORE=15
            elif (( $(echo "$DUPLICATION_PERCENT < 10" | bc -l) )); then
                DUPLICATION_SCORE=10
            elif (( $(echo "$DUPLICATION_PERCENT < 15" | bc -l) )); then
                DUPLICATION_SCORE=5
            else
                DUPLICATION_SCORE=0
            fi
        fi
    else
        echo "jscpd not installed, using simple duplicate detection..."
        
        # Simple duplicate line detection
        find apps -name "*.ts" -o -name "*.tsx" | xargs cat | sort | uniq -c | sort -rn | head -20 > "$TEMP_DIR/duplicate-lines.txt"
        DUPLICATE_COUNT=$(grep -c "^ *[2-9]" "$TEMP_DIR/duplicate-lines.txt" || echo 0)
        
        echo "Duplicate line patterns: $DUPLICATE_COUNT"
        
        if [ "$DUPLICATE_COUNT" -le 10 ]; then
            DUPLICATION_SCORE=15
        elif [ "$DUPLICATE_COUNT" -le 30 ]; then
            DUPLICATION_SCORE=10
        else
            DUPLICATION_SCORE=5
        fi
    fi
    
    echo -e "${GREEN}Duplication Score: $DUPLICATION_SCORE/20${NC}"
}

# Function to generate health report
generate_health_report() {
    # Calculate total score
    TOTAL_SCORE=$((TEST_COVERAGE_SCORE + DEAD_CODE_SCORE + TODO_SCORE + COMPLEXITY_SCORE + DUPLICATION_SCORE))
    
    # Determine grade
    if [ "$TOTAL_SCORE" -ge 90 ]; then
        GRADE="A"
        GRADE_COLOR=$GREEN
    elif [ "$TOTAL_SCORE" -ge 80 ]; then
        GRADE="B"
        GRADE_COLOR=$GREEN
    elif [ "$TOTAL_SCORE" -ge 70 ]; then
        GRADE="C"
        GRADE_COLOR=$YELLOW
    elif [ "$TOTAL_SCORE" -ge 60 ]; then
        GRADE="D"
        GRADE_COLOR=$YELLOW
    else
        GRADE="F"
        GRADE_COLOR=$RED
    fi
    
    echo -e "\n${BLUE}=== Code Health Report ===${NC}"
    echo "Generated at: $(date)"
    echo ""
    echo "Scores:"
    echo "- Test Coverage: $TEST_COVERAGE_SCORE/25"
    echo "- Dead Code: $DEAD_CODE_SCORE/20"
    echo "- TODO/FIXME Age: $TODO_SCORE/15"
    echo "- Code Complexity: $COMPLEXITY_SCORE/20"
    echo "- Code Duplication: $DUPLICATION_SCORE/20"
    echo ""
    echo -e "Total Score: ${GRADE_COLOR}$TOTAL_SCORE/100 (Grade: $GRADE)${NC}"
    
    # Create detailed report
    REPORT_FILE=".claude/reports/code-health-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p .claude/reports
    
    cat > "$REPORT_FILE" <<EOF
# Code Health Report

Generated: $(date)

## Overall Health Score: $TOTAL_SCORE/100 (Grade: $GRADE)

### Detailed Scores

| Metric | Score | Max | Percentage |
|--------|-------|-----|------------|
| Test Coverage | $TEST_COVERAGE_SCORE | 25 | $((TEST_COVERAGE_SCORE * 100 / 25))% |
| Dead Code | $DEAD_CODE_SCORE | 20 | $((DEAD_CODE_SCORE * 100 / 20))% |
| TODO/FIXME Age | $TODO_SCORE | 15 | $((TODO_SCORE * 100 / 15))% |
| Code Complexity | $COMPLEXITY_SCORE | 20 | $((COMPLEXITY_SCORE * 100 / 20))% |
| Code Duplication | $DUPLICATION_SCORE | 20 | $((DUPLICATION_SCORE * 100 / 20))% |

### Trends

\`\`\`
TODO: Compare with previous reports to show trends
\`\`\`

### Recommendations

EOF
    
    # Add recommendations based on scores
    if [ "$TEST_COVERAGE_SCORE" -lt 20 ]; then
        echo "- **Improve Test Coverage**: Current coverage is below target. Focus on testing critical business logic." >> "$REPORT_FILE"
    fi
    
    if [ "$DEAD_CODE_SCORE" -lt 15 ]; then
        echo "- **Remove Dead Code**: Run code janitor to clean up unused exports and components." >> "$REPORT_FILE"
    fi
    
    if [ "$TODO_SCORE" -lt 10 ]; then
        echo "- **Address Old TODOs**: Review and resolve TODOs older than 30 days." >> "$REPORT_FILE"
    fi
    
    if [ "$COMPLEXITY_SCORE" -lt 15 ]; then
        echo "- **Reduce Complexity**: Refactor large functions into smaller, more manageable pieces." >> "$REPORT_FILE"
    fi
    
    if [ "$DUPLICATION_SCORE" -lt 15 ]; then
        echo "- **Eliminate Duplication**: Extract common code into shared utilities." >> "$REPORT_FILE"
    fi
    
    # Add detailed findings if they exist
    if [ -f "$TEMP_DIR/old-todos.txt" ]; then
        echo -e "\n### Old TODOs (>30 days)\n" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        head -20 "$TEMP_DIR/old-todos.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    if [ -f "$TEMP_DIR/complex-functions.txt" ] && [ -s "$TEMP_DIR/complex-functions.txt" ]; then
        echo -e "\n### Complex Functions\n" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        head -20 "$TEMP_DIR/complex-functions.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    echo -e "\n${GREEN}Report saved to: $REPORT_FILE${NC}"
    
    # Save score history
    HISTORY_FILE=".claude/reports/health-history.csv"
    if [ ! -f "$HISTORY_FILE" ]; then
        echo "date,total_score,test_coverage,dead_code,todo_age,complexity,duplication" > "$HISTORY_FILE"
    fi
    echo "$(date +%Y-%m-%d),$TOTAL_SCORE,$TEST_COVERAGE_SCORE,$DEAD_CODE_SCORE,$TODO_SCORE,$COMPLEXITY_SCORE,$DUPLICATION_SCORE" >> "$HISTORY_FILE"
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    MISSING_DEPS=""
    
    if ! command -v bc &> /dev/null; then
        MISSING_DEPS="$MISSING_DEPS bc"
    fi
    
    if ! command -v jq &> /dev/null; then
        MISSING_DEPS="$MISSING_DEPS jq"
    fi
    
    if [ -n "$MISSING_DEPS" ]; then
        echo -e "${YELLOW}Optional dependencies missing: $MISSING_DEPS${NC}"
        echo "Some features may be limited. Install with: brew install $MISSING_DEPS"
    fi
}

# Main execution
main() {
    check_dependencies
    calculate_test_coverage
    calculate_dead_code_score
    calculate_todo_score
    calculate_complexity_score
    calculate_duplication_score
    generate_health_report
}

# Run main function
main