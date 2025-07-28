# Build Feature Command - Complete Feature Development Workflow

This command orchestrates the entire feature development lifecycle using Claude Code's advanced capabilities.

## Usage
```
/glimmr:build-feature "feature description"
```

## Complete Workflow Automation

### 1. 📋 Planning Phase
```bash
# Analyze requirements and create implementation plan
/project:analyze architecture
/glimmr:plan-feature "$FEATURE_DESCRIPTION"

# Create feature branch
git checkout -b feature/$FEATURE_SLUG

# Generate feature specification from template
cp .claude/templates/feature-template.md docs/features/$FEATURE_SLUG.md
```

### 2. 🏗️ Implementation Phase

#### Backend Development (if needed)
Use the `healthcare-backend-architect` agent to:
- Design secure API endpoints
- Implement HIPAA-compliant data models
- Create job processors for async operations
- Add proper error handling and logging

```typescript
// Example endpoint structure
@ApiTags('$FEATURE_NAME')
@Controller('api/v1/$FEATURE_PATH')
@UseGuards(FlexibleAuthGuard)
export class $FEATURE_NAME$Controller {
  // Implementation follows established patterns
}
```

#### Frontend Development (if needed)
Use the `ui-architect` agent to:
- Build responsive React components
- Implement real-time updates via WebSocket
- Add smooth animations with Framer Motion
- Ensure mobile-first design

```typescript
// Example component structure
export const $FEATURE_NAME$Component: FC = () => {
  // Uses shadcn/ui components
  // Implements proper loading/error states
  // Follows established patterns
}
```

### 3. 🧪 Testing Phase
Use the `test-coverage-engineer` agent to:
- Create comprehensive unit tests
- Add integration tests for API endpoints
- Implement E2E tests for critical paths
- Ensure >80% code coverage

```bash
# Run all tests
pnpm test
pnpm test:e2e
pnpm test:cov
```

### 4. 📚 Documentation Phase
- Auto-generate API documentation via Swagger
- Update component storybook (if applicable)
- Create user-facing documentation
- Update CHANGELOG.md

### 5. 🔍 Quality Assurance
```bash
# Run all quality checks
pnpm lint
pnpm format
pnpm check-types
/code:security-scan

# Performance analysis
/glimmr:analyze-performance

# Check for common issues
grep -r "console.log" apps/ --include="*.ts" --include="*.tsx"
grep -r "TODO" apps/ --include="*.ts" --include="*.tsx"
```

### 6. 🚀 Finalization
```bash
# Commit changes with conventional commits
git add -A
git commit -m "feat($SCOPE): $DESCRIPTION

- Implementation details
- Breaking changes (if any)
- Closes #ISSUE_NUMBER"

# Create pull request
gh pr create \
  --title "feat($SCOPE): $DESCRIPTION" \
  --body "$(cat docs/features/$FEATURE_SLUG.md)" \
  --label "enhancement" \
  --label "needs-review"
```

## Example Workflows

### Example 1: Real-time Analytics Dashboard
```
/glimmr:build-feature "Add real-time analytics dashboard showing hospital pricing trends with WebSocket updates"
```

This will:
1. Plan WebSocket infrastructure
2. Create analytics aggregation jobs
3. Build React dashboard with live charts
4. Add comprehensive tests
5. Generate API and user docs

### Example 2: Bulk Hospital Import
```
/glimmr:build-feature "Add bulk hospital import feature with CSV upload and validation"
```

This will:
1. Design file upload endpoint
2. Create CSV parsing job processor
3. Build upload UI with progress tracking
4. Add validation and error handling
5. Test with various CSV formats

### Example 3: Advanced Search
```
/glimmr:build-feature "Implement advanced search with filters for hospitals and prices"
```

This will:
1. Design search API with Elasticsearch
2. Create search indexes
3. Build search UI with faceted filters
4. Add autocomplete functionality
5. Optimize for performance

## Feature Flags & Rollout
```typescript
// Consider feature flags for gradual rollout
if (featureFlags.isEnabled('$FEATURE_FLAG')) {
  // New feature code
}
```

## Monitoring & Metrics
```typescript
// Add metrics for new features
this.metricsService.increment('feature.$FEATURE_NAME.usage');
this.analyticsService.track('Feature Used', {
  feature: '$FEATURE_NAME',
  user: userId,
});
```

## Success Criteria
- [ ] All tests passing
- [ ] Code coverage >80%
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] PR approved by reviewers

## Post-Deployment
- Monitor error rates
- Track feature usage
- Gather user feedback
- Plan iterations

## Rollback Plan
```bash
# If issues arise post-deployment
git revert $COMMIT_HASH
pnpm deploy:rollback
```