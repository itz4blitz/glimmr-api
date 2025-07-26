#!/bin/bash

echo "Running comprehensive error check..."
echo "==================================="
echo ""

# Clear caches
echo "Clearing caches..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .eslintcache 2>/dev/null || true
echo "✓ Caches cleared"
echo ""

# Type check
echo "Running TypeScript type check..."
pnpm check-types 2>&1 | tee /tmp/typecheck-full.txt
TS_ERRORS=$(grep -c "error TS" /tmp/typecheck-full.txt || echo "0")
echo "TypeScript errors: $TS_ERRORS"
echo ""

# ESLint
echo "Running ESLint..."
pnpm lint 2>&1 | tee /tmp/eslint-full.txt

# Count different types of issues
ESLINT_ERRORS=$(grep -E "^\s*[0-9]+:[0-9]+\s+error\s+" /tmp/eslint-full.txt | wc -l | tr -d ' ')
ESLINT_WARNINGS=$(grep -E "^\s*[0-9]+:[0-9]+\s+warning\s+" /tmp/eslint-full.txt | wc -l | tr -d ' ')
ANY_ERRORS=$(grep -c "@typescript-eslint/no-explicit-any" /tmp/eslint-full.txt || echo "0")
REFRESH_ERRORS=$(grep -c "react-refresh/only-export-components" /tmp/eslint-full.txt || echo "0")
OTHER_ERRORS=$((ESLINT_ERRORS - ANY_ERRORS - REFRESH_ERRORS))

echo ""
echo "Summary:"
echo "========"
echo "TypeScript errors: $TS_ERRORS"
echo "ESLint errors: $ESLINT_ERRORS"
echo "  - 'any' type errors: $ANY_ERRORS"
echo "  - React refresh errors: $REFRESH_ERRORS"
echo "  - Other errors: $OTHER_ERRORS"
echo "ESLint warnings: $ESLINT_WARNINGS"
echo ""
echo "Total issues to fix: $((TS_ERRORS + OTHER_ERRORS))"
echo "Lower priority issues: $((ANY_ERRORS + REFRESH_ERRORS + ESLINT_WARNINGS))"

# Save summary
echo "{
  \"timestamp\": \"$(date)\",
  \"typescript_errors\": $TS_ERRORS,
  \"eslint_errors\": $ESLINT_ERRORS,
  \"any_type_errors\": $ANY_ERRORS,
  \"react_refresh_errors\": $REFRESH_ERRORS,
  \"other_errors\": $OTHER_ERRORS,
  \"eslint_warnings\": $ESLINT_WARNINGS,
  \"total_critical\": $((TS_ERRORS + OTHER_ERRORS)),
  \"total_low_priority\": $((ANY_ERRORS + REFRESH_ERRORS + ESLINT_WARNINGS))
}" > error-summary.json

echo ""
echo "Full outputs saved to:"
echo "  - /tmp/typecheck-full.txt"
echo "  - /tmp/eslint-full.txt"
echo "  - error-summary.json"