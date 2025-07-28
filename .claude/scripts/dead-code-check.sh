#!/bin/bash

# Dead Code Prevention System for Glimmr
# This script scans for unused code across the monorepo

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Dead Code Prevention System${NC}"
echo "================================="

# Initialize counters
TOTAL_ISSUES=0
UNUSED_EXPORTS=0
UNUSED_COMPONENTS=0
UNUSED_ENDPOINTS=0
UNUSED_JOBS=0
UNUSED_COLUMNS=0

# Create temp directory for analysis
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to check unused TypeScript exports
check_unused_exports() {
    echo -e "\n${YELLOW}Checking for unused TypeScript exports...${NC}"
    
    # Check API exports
    if command -v ts-unused-exports &> /dev/null; then
        echo "Analyzing apps/api..."
        ts-unused-exports apps/api/tsconfig.json --excludePathsFromReport="node_modules;dist;coverage" > "$TEMP_DIR/api-unused.txt" 2>&1 || true
        
        echo "Analyzing apps/web..."
        ts-unused-exports apps/web/tsconfig.json --excludePathsFromReport="node_modules;dist;coverage" > "$TEMP_DIR/web-unused.txt" 2>&1 || true
    else
        # Fallback: Manual export checking
        echo "ts-unused-exports not found, using fallback method..."
        
        # Find all exported items in TypeScript files
        find apps/api/src apps/web/src -name "*.ts" -o -name "*.tsx" | while read -r file; do
            grep -E "^export\s+(class|interface|type|function|const|enum)" "$file" 2>/dev/null | while read -r export_line; do
                export_name=$(echo "$export_line" | sed -E 's/^export\s+(class|interface|type|function|const|enum)\s+([a-zA-Z0-9_]+).*/\2/')
                
                # Check if it's used anywhere else
                if [ -n "$export_name" ]; then
                    usage_count=$(grep -r "$export_name" apps --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist | grep -v "export.*$export_name" | wc -l)
                    if [ "$usage_count" -eq 0 ]; then
                        echo "$file: Unused export '$export_name'" >> "$TEMP_DIR/manual-unused.txt"
                        ((UNUSED_EXPORTS++))
                    fi
                fi
            done
        done
    fi
    
    # Count issues
    if [ -f "$TEMP_DIR/api-unused.txt" ]; then
        UNUSED_EXPORTS=$((UNUSED_EXPORTS + $(grep -c "is not imported" "$TEMP_DIR/api-unused.txt" 2>/dev/null || echo 0)))
    fi
    if [ -f "$TEMP_DIR/web-unused.txt" ]; then
        UNUSED_EXPORTS=$((UNUSED_EXPORTS + $(grep -c "is not imported" "$TEMP_DIR/web-unused.txt" 2>/dev/null || echo 0)))
    fi
    
    echo -e "${RED}Found $UNUSED_EXPORTS unused exports${NC}"
}

# Function to check unused React components
check_unused_components() {
    echo -e "\n${YELLOW}Checking for orphaned React components...${NC}"
    
    # Find all React component files
    find apps/web/src/components -name "*.tsx" -o -name "*.jsx" | while read -r file; do
        component_name=$(basename "$file" | sed 's/\.[tj]sx$//')
        
        # Check if component is imported anywhere
        import_count=$(grep -r "from.*${component_name}" apps/web/src --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "$file" | wc -l)
        
        if [ "$import_count" -eq 0 ]; then
            # Also check for direct file imports
            file_import_count=$(grep -r "from.*$(basename "$file")" apps/web/src 2>/dev/null | grep -v "$file" | wc -l)
            if [ "$file_import_count" -eq 0 ]; then
                echo "Orphaned component: $file" >> "$TEMP_DIR/orphaned-components.txt"
                ((UNUSED_COMPONENTS++))
            fi
        fi
    done
    
    echo -e "${RED}Found $UNUSED_COMPONENTS orphaned components${NC}"
}

# Function to check unused API endpoints
check_unused_endpoints() {
    echo -e "\n${YELLOW}Checking for unused API endpoints...${NC}"
    
    # Extract all defined routes from controllers
    grep -r "@(Get\|Post\|Put\|Delete\|Patch)" apps/api/src --include="*.controller.ts" | \
        sed -E "s/.*@(Get|Post|Put|Delete|Patch)\(['\"]?([^'\")\s]+)['\"]?\).*/\1 \2/" | \
        sort -u > "$TEMP_DIR/defined-routes.txt"
    
    # Check if routes are actually registered in modules
    while IFS= read -r route; do
        method=$(echo "$route" | cut -d' ' -f1)
        path=$(echo "$route" | cut -d' ' -f2-)
        
        # Check if the controller is imported in any module
        controller_file=$(grep -l "@${method}.*${path}" apps/api/src --include="*.controller.ts" | head -1)
        if [ -n "$controller_file" ]; then
            controller_name=$(basename "$controller_file" .controller.ts | sed 's/-/_/g')
            controller_class="${controller_name}Controller"
            
            # Check if controller is registered in any module
            if ! grep -r "$controller_class" apps/api/src --include="*.module.ts" &>/dev/null; then
                echo "Unregistered endpoint: $method $path (in $controller_file)" >> "$TEMP_DIR/unused-endpoints.txt"
                ((UNUSED_ENDPOINTS++))
            fi
        fi
    done < "$TEMP_DIR/defined-routes.txt"
    
    echo -e "${RED}Found $UNUSED_ENDPOINTS unregistered endpoints${NC}"
}

# Function to check unused job processors
check_unused_jobs() {
    echo -e "\n${YELLOW}Checking for unused BullMQ job processors...${NC}"
    
    # Find all processor files
    find apps/api/src/jobs/processors -name "*.processor.ts" | while read -r file; do
        processor_name=$(basename "$file" .processor.ts)
        processor_class="$(echo "$processor_name" | sed 's/-/_/g' | sed 's/\b\w/\u&/g')Processor"
        
        # Check if processor is registered in any module
        if ! grep -r "$processor_class" apps/api/src --include="*.module.ts" &>/dev/null; then
            echo "Unregistered processor: $file" >> "$TEMP_DIR/unused-jobs.txt"
            ((UNUSED_JOBS++))
        fi
    done
    
    echo -e "${RED}Found $UNUSED_JOBS unregistered job processors${NC}"
}

# Function to check unused database columns
check_unused_columns() {
    echo -e "\n${YELLOW}Checking for unused database columns...${NC}"
    
    # Extract all column definitions from schema files
    grep -r "^\s*[a-zA-Z_]*:" apps/api/src/database/schema --include="*.ts" | \
        grep -v "relations\|index\|primaryKey\|unique" | \
        sed -E 's/.*\/([^\/]+)\.ts:\s*([a-zA-Z_]+):.*/\1.\2/' > "$TEMP_DIR/all-columns.txt"
    
    # Check if columns are used in queries
    while IFS= read -r column_ref; do
        table=$(echo "$column_ref" | cut -d'.' -f1)
        column=$(echo "$column_ref" | cut -d'.' -f2)
        
        # Search for column usage in service files
        usage_count=$(grep -r "\.$column\b" apps/api/src --include="*.service.ts" --include="*.processor.ts" 2>/dev/null | wc -l)
        
        # Also check for column in select statements
        select_usage=$(grep -r "select.*$column" apps/api/src --include="*.ts" 2>/dev/null | wc -l)
        
        if [ "$usage_count" -eq 0 ] && [ "$select_usage" -eq 0 ]; then
            # Exclude common columns that might be used implicitly
            if [[ ! "$column" =~ ^(id|createdAt|updatedAt|deletedAt)$ ]]; then
                echo "Potentially unused column: $table.$column" >> "$TEMP_DIR/unused-columns.txt"
                ((UNUSED_COLUMNS++))
            fi
        fi
    done < "$TEMP_DIR/all-columns.txt"
    
    echo -e "${RED}Found $UNUSED_COLUMNS potentially unused columns${NC}"
}

# Function to generate report
generate_report() {
    TOTAL_ISSUES=$((UNUSED_EXPORTS + UNUSED_COMPONENTS + UNUSED_ENDPOINTS + UNUSED_JOBS + UNUSED_COLUMNS))
    
    echo -e "\n${BLUE}=== Dead Code Report ===${NC}"
    echo "Generated at: $(date)"
    echo ""
    echo "Summary:"
    echo "- Unused TypeScript exports: $UNUSED_EXPORTS"
    echo "- Orphaned React components: $UNUSED_COMPONENTS"
    echo "- Unregistered API endpoints: $UNUSED_ENDPOINTS"
    echo "- Unregistered job processors: $UNUSED_JOBS"
    echo "- Potentially unused DB columns: $UNUSED_COLUMNS"
    echo "- Total issues: $TOTAL_ISSUES"
    
    # Create detailed report
    REPORT_FILE=".claude/reports/dead-code-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p .claude/reports
    
    cat > "$REPORT_FILE" <<EOF
# Dead Code Report

Generated: $(date)

## Summary

| Category | Count |
|----------|-------|
| Unused TypeScript exports | $UNUSED_EXPORTS |
| Orphaned React components | $UNUSED_COMPONENTS |
| Unregistered API endpoints | $UNUSED_ENDPOINTS |
| Unregistered job processors | $UNUSED_JOBS |
| Potentially unused DB columns | $UNUSED_COLUMNS |
| **Total issues** | **$TOTAL_ISSUES** |

## Details

EOF
    
    # Add details from temp files
    if [ -f "$TEMP_DIR/manual-unused.txt" ]; then
        echo "### Unused TypeScript Exports" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/manual-unused.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    if [ -f "$TEMP_DIR/orphaned-components.txt" ]; then
        echo -e "\n### Orphaned React Components" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/orphaned-components.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    if [ -f "$TEMP_DIR/unused-endpoints.txt" ]; then
        echo -e "\n### Unregistered API Endpoints" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/unused-endpoints.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    if [ -f "$TEMP_DIR/unused-jobs.txt" ]; then
        echo -e "\n### Unregistered Job Processors" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/unused-jobs.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    if [ -f "$TEMP_DIR/unused-columns.txt" ]; then
        echo -e "\n### Potentially Unused Database Columns" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/unused-columns.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    fi
    
    echo -e "\n${GREEN}Report saved to: $REPORT_FILE${NC}"
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is required${NC}"
        exit 1
    fi
    
    # Install ts-unused-exports if not present
    if ! command -v ts-unused-exports &> /dev/null; then
        echo "Installing ts-unused-exports..."
        npm install -g ts-unused-exports
    fi
}

# Main execution
main() {
    check_dependencies
    check_unused_exports
    check_unused_components
    check_unused_endpoints
    check_unused_jobs
    check_unused_columns
    generate_report
    
    # Exit with error if issues found
    if [ "$TOTAL_ISSUES" -gt 0 ]; then
        echo -e "\n${YELLOW}⚠️  Found $TOTAL_ISSUES dead code issues${NC}"
        exit 1
    else
        echo -e "\n${GREEN}✓ No dead code issues found${NC}"
        exit 0
    fi
}

# Run main function
main