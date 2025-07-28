#!/bin/bash

# Smart PR Documentation Generator
# Automatically generates documentation for changes in pull requests

set -euo pipefail

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📝 Smart PR Documentation Generator${NC}"
echo "===================================="

# Get git diff information
BASE_BRANCH="${1:-main}"
CURRENT_BRANCH=$(git branch --show-current)

# Create temporary directory for analysis
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to detect job system changes
detect_job_changes() {
    echo -e "\n${YELLOW}Checking for job system changes...${NC}"
    
    # Find new or modified job processors
    git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -E "jobs/processors/.*\.ts$" | while read -r file; do
        if [ -f "$file" ]; then
            echo "Found job processor change: $file"
            
            # Extract job name and documentation
            JOB_NAME=$(basename "$file" .processor.ts)
            
            # Generate job documentation
            cat > "$TEMP_DIR/job-$JOB_NAME.md" <<EOF
## New Job: $JOB_NAME

### Purpose
$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" | grep -A5 "^+.*@Processor" | grep "^+.*\/\*\*" | sed 's/^+.*\* //')

### Configuration
\`\`\`typescript
$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" | grep -A10 "^+.*@Processor")
\`\`\`

### Processing Logic
$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" | grep -A20 "^+.*async process" | head -20)

### Queue Configuration
- **Concurrency**: Check \`jobs.module.ts\` for concurrency settings
- **Retry Policy**: Default exponential backoff
- **Dead Letter Queue**: After 5 failed attempts

EOF
        fi
    done
}

# Function to detect database migration changes
detect_migration_changes() {
    echo -e "\n${YELLOW}Checking for database migrations...${NC}"
    
    # Check for schema changes
    git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -E "database/schema/.*\.ts$" | while read -r file; do
        if [ -f "$file" ]; then
            echo "Found schema change: $file"
            
            # Extract table and column changes
            CHANGES=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" | grep -E "^\+[[:space:]]*(.*Column\(|.*Table\(|.*Index\()")
            
            if [ -n "$CHANGES" ]; then
                cat > "$TEMP_DIR/migration-$(basename $file .ts).md" <<EOF
## Database Schema Change: $(basename $file .ts)

### Changes
\`\`\`sql
$CHANGES
\`\`\`

### Purpose
This migration modifies the $(basename $file .ts) schema to support:
- [TODO: Add purpose based on PR context]

### Backward Compatibility
- [TODO: Note any breaking changes]
- [TODO: Migration strategy for existing data]

### Rollback Plan
\`\`\`sql
-- Rollback SQL if needed
[TODO: Add rollback SQL]
\`\`\`
EOF
            fi
        fi
    done
}

# Function to generate ADR for significant changes
generate_adr() {
    echo -e "\n${YELLOW}Analyzing for architectural decisions...${NC}"
    
    # Check for significant architectural changes
    SIGNIFICANT_CHANGES=0
    
    # New modules
    NEW_MODULES=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -E "\.module\.ts$" | grep -v spec | wc -l)
    if [ "$NEW_MODULES" -gt 0 ]; then
        ((SIGNIFICANT_CHANGES++))
    fi
    
    # New services
    NEW_SERVICES=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -E "\.service\.ts$" | grep -v spec | wc -l)
    if [ "$NEW_SERVICES" -gt 2 ]; then
        ((SIGNIFICANT_CHANGES++))
    fi
    
    # Package.json changes
    if git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -q "package.json"; then
        ((SIGNIFICANT_CHANGES++))
    fi
    
    if [ "$SIGNIFICANT_CHANGES" -gt 1 ]; then
        ADR_NUMBER=$(find docs/adr -name "*.md" 2>/dev/null | wc -l || echo 0)
        ADR_NUMBER=$((ADR_NUMBER + 1))
        ADR_FILE="docs/adr/$(printf "%04d" $ADR_NUMBER)-$(echo $CURRENT_BRANCH | tr '/' '-').md"
        
        mkdir -p docs/adr
        
        cat > "$ADR_FILE" <<EOF
# ADR-$(printf "%04d" $ADR_NUMBER): ${CURRENT_BRANCH}

Date: $(date +%Y-%m-%d)

## Status

Proposed

## Context

This pull request introduces significant changes to the system architecture:

$(git log "$BASE_BRANCH".."$CURRENT_BRANCH" --oneline | head -10)

### Changed Files Summary
- New Modules: $NEW_MODULES
- New Services: $NEW_SERVICES
- Modified Dependencies: $(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- package.json | grep -c "^+" || echo 0)

## Decision

[TODO: Describe the architectural decision made]

## Consequences

### Positive
- [TODO: List positive consequences]

### Negative
- [TODO: List negative consequences]

### Neutral
- [TODO: List neutral consequences]

## Implementation Notes

Key files changed:
\`\`\`
$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | head -20)
\`\`\`

## References
- Pull Request: #[TODO: Add PR number]
- Related Issues: #[TODO: Add issue numbers]
EOF
        
        echo -e "${GREEN}Created ADR: $ADR_FILE${NC}"
    fi
}

# Function to generate user-facing changelog
generate_changelog() {
    echo -e "\n${YELLOW}Generating changelog entries...${NC}"
    
    CHANGELOG_FILE="$TEMP_DIR/changelog-entries.md"
    
    cat > "$CHANGELOG_FILE" <<EOF
## Changelog Entries

### Added
EOF
    
    # Find new features
    git log "$BASE_BRANCH".."$CURRENT_BRANCH" --oneline --grep="feat:" | while read -r line; do
        COMMIT_MSG=$(echo "$line" | sed 's/^[a-f0-9]* feat: //')
        echo "- $COMMIT_MSG" >> "$CHANGELOG_FILE"
    done
    
    echo -e "\n### Changed" >> "$CHANGELOG_FILE"
    git log "$BASE_BRANCH".."$CURRENT_BRANCH" --oneline --grep="refactor:\|perf:" | while read -r line; do
        COMMIT_MSG=$(echo "$line" | sed 's/^[a-f0-9]* \(refactor\|perf\): //')
        echo "- $COMMIT_MSG" >> "$CHANGELOG_FILE"
    done
    
    echo -e "\n### Fixed" >> "$CHANGELOG_FILE"
    git log "$BASE_BRANCH".."$CURRENT_BRANCH" --oneline --grep="fix:" | while read -r line; do
        COMMIT_MSG=$(echo "$line" | sed 's/^[a-f0-9]* fix: //')
        echo "- $COMMIT_MSG" >> "$CHANGELOG_FILE"
    done
    
    echo -e "\n### Breaking Changes" >> "$CHANGELOG_FILE"
    git log "$BASE_BRANCH".."$CURRENT_BRANCH" --oneline --grep="BREAKING CHANGE:\|breaking:" | while read -r line; do
        COMMIT_MSG=$(echo "$line" | sed 's/^[a-f0-9]* .*: //')
        echo "- ⚠️  $COMMIT_MSG" >> "$CHANGELOG_FILE"
    done
}

# Function to check documentation freshness
check_doc_freshness() {
    echo -e "\n${YELLOW}Checking documentation freshness...${NC}"
    
    OUTDATED_DOCS="$TEMP_DIR/outdated-docs.md"
    echo "## Potentially Outdated Documentation" > "$OUTDATED_DOCS"
    echo "" >> "$OUTDATED_DOCS"
    
    # Check if source files are newer than their docs
    git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | grep -E "\.(ts|tsx)$" | while read -r file; do
        # Look for corresponding documentation
        DOC_FILE=""
        
        if [[ "$file" =~ "apps/api/src/" ]]; then
            SERVICE_NAME=$(basename "$file" .ts | sed 's/\..*$//')
            DOC_FILE="docs/api/services/$SERVICE_NAME.md"
        elif [[ "$file" =~ "apps/web/src/components/" ]]; then
            COMPONENT_NAME=$(basename "$file" .tsx)
            DOC_FILE="docs/components/$COMPONENT_NAME.md"
        fi
        
        if [ -n "$DOC_FILE" ] && [ -f "$DOC_FILE" ]; then
            # Check if source is newer than doc
            if [ "$file" -nt "$DOC_FILE" ]; then
                echo "- $DOC_FILE may need updates (source: $file)" >> "$OUTDATED_DOCS"
            fi
        elif [ -n "$DOC_FILE" ]; then
            echo "- Missing documentation: $DOC_FILE (source: $file)" >> "$OUTDATED_DOCS"
        fi
    done
}

# Function to generate PR documentation summary
generate_pr_summary() {
    echo -e "\n${YELLOW}Generating PR documentation summary...${NC}"
    
    PR_DOCS="$TEMP_DIR/pr-documentation.md"
    
    cat > "$PR_DOCS" <<EOF
# Pull Request Documentation

Generated: $(date)
Branch: $CURRENT_BRANCH

## Overview

This PR includes the following changes that require documentation:

### Statistics
- Files changed: $(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --name-only | wc -l)
- Lines added: $(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --numstat | awk '{sum+=$1} END {print sum}')
- Lines removed: $(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" --numstat | awk '{sum+=$2} END {print sum}')

## Documentation Generated

EOF
    
    # Include all generated documentation
    for doc in "$TEMP_DIR"/*.md; do
        if [ -f "$doc" ] && [ "$doc" != "$PR_DOCS" ]; then
            echo -e "\n---\n" >> "$PR_DOCS"
            cat "$doc" >> "$PR_DOCS"
        fi
    done
    
    # Copy to output location
    mkdir -p .claude/pr-docs
    cp "$PR_DOCS" ".claude/pr-docs/pr-$CURRENT_BRANCH-$(date +%Y%m%d-%H%M%S).md"
    
    echo -e "${GREEN}✅ PR documentation generated${NC}"
    echo "View at: .claude/pr-docs/pr-$CURRENT_BRANCH-$(date +%Y%m%d-%H%M%S).md"
}

# Main execution
main() {
    detect_job_changes
    detect_migration_changes
    generate_adr
    generate_changelog
    check_doc_freshness
    generate_pr_summary
}

# Run main function
main