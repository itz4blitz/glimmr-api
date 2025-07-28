#!/bin/bash

# Documentation Freshness System
# Tracks documentation health and suggests updates

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📚 Documentation Freshness Check${NC}"
echo "================================="

# Initialize counters
TOTAL_FILES=0
DOCUMENTED_FILES=0
OUTDATED_DOCS=0
MISSING_DOCS=0
CRITICAL_MISSING=0

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to check TypeScript file documentation
check_ts_documentation() {
    local file=$1
    local has_jsdoc=false
    local doc_quality="none"
    
    # Check for JSDoc comments
    if grep -q "^\s*\/\*\*" "$file"; then
        has_jsdoc=true
        
        # Check documentation quality
        local comment_lines=$(grep -c "^\s*\*" "$file" || echo 0)
        local code_lines=$(wc -l < "$file")
        local doc_ratio=$(echo "scale=2; $comment_lines / $code_lines" | bc -l)
        
        if (( $(echo "$doc_ratio > 0.2" | bc -l) )); then
            doc_quality="good"
        elif (( $(echo "$doc_ratio > 0.1" | bc -l) )); then
            doc_quality="adequate"
        else
            doc_quality="minimal"
        fi
    fi
    
    echo "$has_jsdoc|$doc_quality"
}

# Function to check if documentation needs update
needs_update() {
    local source_file=$1
    local doc_file=$2
    
    if [ ! -f "$doc_file" ]; then
        return 0  # Needs documentation
    fi
    
    # Check if source is newer than documentation
    if [ "$source_file" -nt "$doc_file" ]; then
        return 0  # Needs update
    fi
    
    # Check if source has significant changes since doc was created
    local doc_date=$(stat -f "%m" "$doc_file" 2>/dev/null || stat -c "%Y" "$doc_file")
    local changes=$(git log --since="@$doc_date" --oneline -- "$source_file" | wc -l)
    
    if [ "$changes" -gt 3 ]; then
        return 0  # Significant changes, needs update
    fi
    
    return 1  # Documentation is fresh
}

# Function to analyze API endpoints
analyze_api_endpoints() {
    echo -e "\n${YELLOW}Analyzing API endpoints...${NC}"
    
    # Find all controller files
    find apps/api/src -name "*.controller.ts" | while read -r file; do
        ((TOTAL_FILES++))
        
        # Check for Swagger decorators
        local has_swagger=$(grep -c "@Api\(Operation\|Response\|Body\|Query\|Param\)" "$file" || echo 0)
        local endpoints=$(grep -c "@\(Get\|Post\|Put\|Delete\|Patch\)" "$file" || echo 0)
        
        if [ "$endpoints" -gt 0 ]; then
            if [ "$has_swagger" -lt "$endpoints" ]; then
                echo "$file|missing_swagger|$endpoints|$has_swagger" >> "$TEMP_DIR/api-docs-status.txt"
                ((CRITICAL_MISSING++))
            else
                ((DOCUMENTED_FILES++))
            fi
        fi
    done
}

# Function to analyze React components
analyze_react_components() {
    echo -e "\n${YELLOW}Analyzing React components...${NC}"
    
    # Find all component files
    find apps/web/src/components -name "*.tsx" | grep -v ".test\|.spec\|.stories" | while read -r file; do
        ((TOTAL_FILES++))
        
        local component_name=$(basename "$file" .tsx)
        local doc_file="docs/components/$component_name.md"
        
        # Check if component has props interface
        if grep -q "interface.*Props" "$file"; then
            # Check if documentation exists
            if [ ! -f "$doc_file" ]; then
                echo "$file|missing|critical" >> "$TEMP_DIR/component-docs-status.txt"
                ((MISSING_DOCS++))
            elif needs_update "$file" "$doc_file"; then
                echo "$file|outdated|$doc_file" >> "$TEMP_DIR/component-docs-status.txt"
                ((OUTDATED_DOCS++))
            else
                ((DOCUMENTED_FILES++))
            fi
        fi
    done
}

# Function to analyze service documentation
analyze_services() {
    echo -e "\n${YELLOW}Analyzing service documentation...${NC}"
    
    # Find all service files
    find apps/api/src -name "*.service.ts" | grep -v ".spec" | while read -r file; do
        ((TOTAL_FILES++))
        
        # Check inline documentation
        local doc_info=$(check_ts_documentation "$file")
        local has_jsdoc=$(echo "$doc_info" | cut -d'|' -f1)
        local doc_quality=$(echo "$doc_info" | cut -d'|' -f2)
        
        if [ "$has_jsdoc" = "false" ]; then
            echo "$file|no_documentation" >> "$TEMP_DIR/service-docs-status.txt"
            ((MISSING_DOCS++))
        elif [ "$doc_quality" = "minimal" ]; then
            echo "$file|poor_documentation" >> "$TEMP_DIR/service-docs-status.txt"
            ((OUTDATED_DOCS++))
        else
            ((DOCUMENTED_FILES++))
        fi
    done
}

# Function to check critical paths
check_critical_paths() {
    echo -e "\n${YELLOW}Checking critical path documentation...${NC}"
    
    # Define critical paths that must have documentation
    local critical_paths=(
        "apps/api/src/auth/"
        "apps/api/src/jobs/processors/"
        "apps/api/src/database/schema/"
        "apps/web/src/stores/"
        "apps/web/src/pages/"
    )
    
    for path in "${critical_paths[@]}"; do
        if [ -d "$path" ]; then
            find "$path" -name "*.ts" -o -name "*.tsx" | grep -v ".spec\|.test" | while read -r file; do
                local doc_info=$(check_ts_documentation "$file")
                local has_jsdoc=$(echo "$doc_info" | cut -d'|' -f1)
                
                if [ "$has_jsdoc" = "false" ]; then
                    echo "$file|critical_path|no_docs" >> "$TEMP_DIR/critical-missing.txt"
                    ((CRITICAL_MISSING++))
                fi
            done
        fi
    done
}

# Function to suggest documentation updates
generate_suggestions() {
    echo -e "\n${YELLOW}Generating documentation suggestions...${NC}"
    
    local suggestions_file="$TEMP_DIR/suggestions.md"
    
    cat > "$suggestions_file" <<EOF
# Documentation Update Suggestions

Generated: $(date)

## Priority 1: Critical Missing Documentation

These files are in critical paths and lack documentation:

EOF
    
    if [ -f "$TEMP_DIR/critical-missing.txt" ]; then
        while IFS='|' read -r file type detail; do
            echo "- **$file** - $detail" >> "$suggestions_file"
            
            # Generate suggested documentation template
            if [[ "$file" =~ \.controller\.ts$ ]]; then
                echo "  - Add Swagger decorators for all endpoints" >> "$suggestions_file"
                echo "  - Document request/response schemas" >> "$suggestions_file"
            elif [[ "$file" =~ \.service\.ts$ ]]; then
                echo "  - Add JSDoc comments for all public methods" >> "$suggestions_file"
                echo "  - Include @example tags with usage" >> "$suggestions_file"
            fi
        done < "$TEMP_DIR/critical-missing.txt"
    fi
    
    cat >> "$suggestions_file" <<EOF

## Priority 2: Outdated Documentation

These files have been modified since their documentation was last updated:

EOF
    
    if [ -f "$TEMP_DIR/component-docs-status.txt" ]; then
        grep "outdated" "$TEMP_DIR/component-docs-status.txt" | while IFS='|' read -r file status doc_file; do
            echo "- **$file** → $doc_file" >> "$suggestions_file"
            
            # Get recent changes
            local changes=$(git log --oneline -3 -- "$file" | sed 's/^/    - /')
            if [ -n "$changes" ]; then
                echo "  Recent changes:" >> "$suggestions_file"
                echo "$changes" >> "$suggestions_file"
            fi
        done
    fi
    
    cat >> "$suggestions_file" <<EOF

## Priority 3: Missing Component Documentation

These components lack documentation files:

EOF
    
    if [ -f "$TEMP_DIR/component-docs-status.txt" ]; then
        grep "missing" "$TEMP_DIR/component-docs-status.txt" | while IFS='|' read -r file status priority; do
            echo "- $file" >> "$suggestions_file"
        done
    fi
    
    # Add quick fix commands
    cat >> "$suggestions_file" <<EOF

## Quick Fix Commands

### Generate API documentation:
\`\`\`bash
bash .claude/commands/docs/generate-api-docs.md
\`\`\`

### Generate component documentation:
\`\`\`bash
bash .claude/commands/docs/generate-component-docs.md
\`\`\`

### Add JSDoc template to a service:
\`\`\`typescript
/**
 * Service description
 * 
 * @class ServiceName
 * @example
 * const service = new ServiceName();
 * const result = await service.method();
 */
\`\`\`
EOF
    
    cp "$suggestions_file" ".claude/reports/doc-suggestions-$(date +%Y%m%d-%H%M%S).md"
}

# Function to generate documentation health report
generate_health_report() {
    # Calculate documentation coverage
    local coverage=0
    if [ "$TOTAL_FILES" -gt 0 ]; then
        coverage=$(echo "scale=2; $DOCUMENTED_FILES * 100 / $TOTAL_FILES" | bc -l)
    fi
    
    # Determine health grade
    local grade="F"
    local grade_color=$RED
    
    if (( $(echo "$coverage >= 90" | bc -l) )); then
        grade="A"
        grade_color=$GREEN
    elif (( $(echo "$coverage >= 80" | bc -l) )); then
        grade="B"
        grade_color=$GREEN
    elif (( $(echo "$coverage >= 70" | bc -l) )); then
        grade="C"
        grade_color=$YELLOW
    elif (( $(echo "$coverage >= 60" | bc -l) )); then
        grade="D"
        grade_color=$YELLOW
    fi
    
    echo -e "\n${BLUE}=== Documentation Health Report ===${NC}"
    echo "Generated at: $(date)"
    echo ""
    echo "Summary:"
    echo "- Total files analyzed: $TOTAL_FILES"
    echo "- Documented files: $DOCUMENTED_FILES"
    echo "- Missing documentation: $MISSING_DOCS"
    echo "- Outdated documentation: $OUTDATED_DOCS"
    echo "- Critical missing: $CRITICAL_MISSING"
    echo ""
    echo -e "Documentation Coverage: ${grade_color}${coverage}% (Grade: $grade)${NC}"
    
    # Create detailed report
    local report_file=".claude/reports/doc-health-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p .claude/reports
    
    cat > "$report_file" <<EOF
# Documentation Health Report

Generated: $(date)

## Overall Health Score: ${coverage}% (Grade: $grade)

### Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Files | $TOTAL_FILES | 100% |
| Documented | $DOCUMENTED_FILES | ${coverage}% |
| Missing Docs | $MISSING_DOCS | $(echo "scale=2; $MISSING_DOCS * 100 / $TOTAL_FILES" | bc -l)% |
| Outdated | $OUTDATED_DOCS | $(echo "scale=2; $OUTDATED_DOCS * 100 / $TOTAL_FILES" | bc -l)% |
| Critical Missing | $CRITICAL_MISSING | - |

### Documentation by Type

#### API Endpoints
$([ -f "$TEMP_DIR/api-docs-status.txt" ] && wc -l < "$TEMP_DIR/api-docs-status.txt" || echo 0) endpoints with missing Swagger documentation

#### React Components  
$([ -f "$TEMP_DIR/component-docs-status.txt" ] && grep -c "missing" "$TEMP_DIR/component-docs-status.txt" || echo 0) components without documentation

#### Services
$([ -f "$TEMP_DIR/service-docs-status.txt" ] && wc -l < "$TEMP_DIR/service-docs-status.txt" || echo 0) services with poor documentation

### Recommendations

1. **Immediate Actions**
   - Document all critical path files (auth, jobs, database schemas)
   - Add Swagger decorators to all API endpoints
   - Create documentation for frequently used components

2. **Short-term Goals**
   - Achieve 80% documentation coverage
   - Update all outdated documentation
   - Establish documentation standards

3. **Long-term Strategy**
   - Implement automated documentation generation
   - Add documentation linting to CI/CD
   - Regular documentation reviews

### Next Steps

Run the following commands to improve documentation:

\`\`\`bash
# Generate missing API docs
bash .claude/commands/docs/generate-api-docs.md

# Generate missing component docs
bash .claude/commands/docs/generate-component-docs.md

# View detailed suggestions
cat .claude/reports/doc-suggestions-*.md
\`\`\`
EOF
    
    echo -e "\n${GREEN}Report saved to: $report_file${NC}"
}

# Function to integrate with CI/CD
generate_ci_config() {
    echo -e "\n${YELLOW}Generating CI documentation check...${NC}"
    
    cat > .claude/scripts/ci-doc-check.yml <<'EOF'
name: Documentation Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  doc-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Check documentation freshness
        run: |
          bash .claude/scripts/doc-freshness-check.sh
          
          # Fail if critical documentation is missing
          if grep -q "critical_path" .claude/reports/doc-suggestions-*.md; then
            echo "❌ Critical documentation missing!"
            exit 1
          fi
      
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('.claude/reports/doc-health-*.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '## 📚 Documentation Check\n\n' + report
            });
EOF
}

# Main execution
main() {
    analyze_api_endpoints
    analyze_react_components
    analyze_services
    check_critical_paths
    generate_suggestions
    generate_health_report
    generate_ci_config
}

# Run main function
main