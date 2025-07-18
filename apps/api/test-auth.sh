#!/bin/bash

# Test script for authentication and authorization
set -e

echo "🔐 Running Authentication & Authorization Test Suite"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required environment is available
echo -e "${YELLOW}Checking test environment...${NC}"

# Check if test database is accessible
if ! pg_isready -h localhost -p 5432 -q; then
    echo -e "${RED}❌ PostgreSQL is not running. Please start the database first.${NC}"
    echo "Run: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

# Check if Redis is accessible
if ! redis-cli -p 6379 ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Redis is not running. Please start Redis first.${NC}"
    echo "Run: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo -e "${GREEN}✅ Test environment ready${NC}"

# Run database migrations for test
echo -e "${YELLOW}Setting up test database...${NC}"
export NODE_ENV=test
pnpm db:migrate

echo -e "${YELLOW}Running unit tests...${NC}"

# Run unit tests first
echo "📋 Authentication Service Tests"
npm test src/auth/auth.service.spec.ts

echo "📋 Users Service Tests"
npm test src/users/users.service.spec.ts

echo "📋 Guard Tests"
npm test src/auth/guards/roles.guard.spec.ts
npm test src/auth/guards/flexible-auth.guard.spec.ts

echo "📋 Strategy Tests"
npm test src/auth/strategies/jwt.strategy.spec.ts
npm test src/auth/strategies/local.strategy.spec.ts

echo "📋 Middleware Tests"
npm test src/auth/middleware/bull-board-auth.middleware.spec.ts

echo -e "${YELLOW}Running e2e integration tests...${NC}"

# Run e2e tests
echo "🌐 Authentication & Authorization E2E Tests"
npm run test:e2e test/auth.e2e-spec.ts

echo "🔒 Role-Based Access Control Tests"
npm run test:e2e test/rbac.e2e-spec.ts

echo "🛡️ Security Edge Cases Tests"
npm run test:e2e test/security.e2e-spec.ts

echo -e "${GREEN}🎉 All authentication tests passed!${NC}"

# Generate coverage report
echo -e "${YELLOW}Generating test coverage report...${NC}"
npm run test:cov

echo ""
echo -e "${GREEN}✅ Authentication & Authorization Test Suite Complete${NC}"
echo "📊 Check coverage report in: ./coverage/lcov-report/index.html"
echo ""
echo "🔐 Security Features Validated:"
echo "  ✅ JWT Authentication"
echo "  ✅ API Key Authentication"
echo "  ✅ Role-Based Access Control (RBAC)"
echo "  ✅ Password Security (bcrypt)"
echo "  ✅ Request Validation"
echo "  ✅ Bull Board Admin Protection"
echo "  ✅ SQL Injection Prevention"
echo "  ✅ XSS Prevention"
echo "  ✅ Authentication Bypass Prevention"
echo "  ✅ Concurrent Request Handling"
echo "  ✅ Information Disclosure Prevention"