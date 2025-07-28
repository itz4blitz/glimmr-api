# Glimmr - Healthcare Price Transparency Platform

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Features](#core-features)
6. [Development Workflow](#development-workflow)
7. [Database Architecture](#database-architecture)
8. [Job Processing System](#job-processing-system)
9. [Frontend Application](#frontend-application)
10. [API Documentation](#api-documentation)
11. [Authentication & Security](#authentication--security)
12. [Storage System](#storage-system)
13. [Monitoring & Analytics](#monitoring--analytics)
14. [Testing Strategy](#testing-strategy)
15. [Deployment & DevOps](#deployment--devops)
16. [Performance Considerations](#performance-considerations)

## Project Overview

Glimmr is a comprehensive healthcare price transparency data aggregation platform designed to collect, process, and analyze hospital pricing data across the United States. The platform automates the discovery and monitoring of hospital price transparency files, processes them to extract meaningful pricing information, and provides analytics and insights through a modern web interface.

### Key Objectives

- **Automated Discovery**: Continuously discover and monitor hospital pricing data from various sources
- **Smart Change Detection**: Efficiently detect changes in pricing files to minimize unnecessary downloads
- **Data Processing**: Parse and normalize various file formats (CSV, JSON, XML) containing pricing data
- **Analytics**: Generate insights and aggregated analytics from collected pricing data
- **Compliance**: Help healthcare organizations comply with price transparency regulations
- **Accessibility**: Provide easy access to pricing data through modern APIs and user interfaces

## Architecture

### System Architecture

The platform follows a microservices-inspired monorepo architecture with clear separation of concerns:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Web UI  │────▶│   NestJS API    │────▶│   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  BullMQ/Redis   │     │ Drizzle ORM     │
                        └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Object Storage │
                        │  (MinIO/DO)     │
                        └─────────────────┘
```

### Monorepo Structure

The project uses Turborepo with pnpm workspaces for efficient monorepo management:

- **apps/api**: NestJS backend application
- **apps/web**: React frontend application
- **packages/ui**: Shared UI components and utilities
- **packages/config**: Shared configuration files

## Technology Stack

### Backend Technologies

- **Framework**: NestJS (Node.js framework with TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Queue System**: BullMQ with Redis for job processing
- **Storage**: DigitalOcean Spaces (production) / MinIO (development)
- **Authentication**: JWT with Passport.js
- **Documentation**: Swagger/OpenAPI
- **Logging**: Pino logger
- **Testing**: Jest for unit/integration tests

### Frontend Technologies

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **State Management**: Zustand for global state, React Context for theme
- **Routing**: React Router v6 with protected routes
- **UI Components**: shadcn/ui (all 47 components implemented)
- **Styling**: Tailwind CSS with OKLCH color system
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion
- **Notifications**: Sonner for toast notifications
- **HTTP Client**: Axios with interceptors

### DevOps & Infrastructure

- **Containerization**: Docker & Docker Compose
- **Package Management**: pnpm with workspaces
- **Build System**: Turborepo for monorepo builds
- **Environment Management**: dotenv for configuration
- **Database Migrations**: Drizzle Kit
- **Code Quality**: ESLint, Prettier, TypeScript

## Project Structure

```
glimmr-api/
├── apps/
│   ├── api/                    # NestJS backend application
│   │   ├── src/
│   │   │   ├── activity/       # User activity tracking
│   │   │   ├── analytics/      # Analytics and reporting
│   │   │   ├── auth/           # Authentication & authorization
│   │   │   ├── common/         # Shared utilities and middleware
│   │   │   ├── database/       # Database schemas and configuration
│   │   │   ├── email/          # Email service
│   │   │   ├── external-apis/  # External API integrations
│   │   │   ├── health/         # Health checks
│   │   │   ├── hospitals/      # Hospital management
│   │   │   ├── jobs/           # Background job processing
│   │   │   ├── notifications/  # Notification system
│   │   │   ├── odata/          # OData endpoints
│   │   │   ├── prices/         # Price data processing
│   │   │   ├── redis/          # Redis configuration
│   │   │   ├── storage/        # File storage abstraction
│   │   │   └── users/          # User management
│   │   ├── test/               # E2E tests
│   │   ├── drizzle/            # Database migrations
│   │   └── scripts/            # Utility scripts
│   │
│   └── web/                    # React frontend application
│       ├── src/
│       │   ├── components/     # React components
│       │   │   ├── admin/      # Admin dashboard components
│       │   │   ├── auth/       # Authentication components
│       │   │   ├── common/     # Shared components
│       │   │   ├── layout/     # Layout components
│       │   │   ├── notifications/
│       │   │   ├── profile/    # User profile components
│       │   │   └── ui/         # shadcn/ui components
│       │   ├── contexts/       # React contexts
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Utilities and helpers
│       │   ├── pages/          # Page components
│       │   ├── router/         # React Router configuration
│       │   ├── services/       # API service layer
│       │   ├── stores/         # Zustand stores
│       │   └── types/          # TypeScript types
│       └── public/             # Static assets
│
├── packages/
│   ├── ui/                     # Shared UI utilities
│   └── config/                 # Shared configurations
│
├── docker-compose.dev.yml      # Development environment
├── docker-compose.yml          # Production environment
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── CLAUDE.md                   # AI assistant instructions
```

## Core Features

### 1. Hospital Discovery & Monitoring

The platform automatically discovers hospitals and their pricing files through:

- **Patient Rights Advocate (PRA) API Integration**: Connects to external APIs to discover hospitals
- **Smart Change Detection**: Uses checksums and timestamps to detect file changes
- **State-by-State Processing**: Processes hospitals by geographic regions
- **Automated Scheduling**: Regular scans for new hospitals and file updates

### 2. File Processing Pipeline

Robust file processing capabilities:

- **Multi-Format Support**: Handles CSV, JSON, XML pricing files
- **Streaming Processing**: Memory-efficient processing of large files
- **Error Recovery**: Automatic retries with exponential backoff
- **Progress Tracking**: Real-time progress updates during processing

### 3. Price Data Management

Comprehensive price data handling:

- **Data Normalization**: Standardizes pricing data from various formats
- **Version Control**: Tracks changes in pricing over time
- **Relationship Mapping**: Links prices to procedures, insurance plans, and hospitals
- **Data Validation**: Ensures data integrity and quality

### 4. Analytics & Reporting

Advanced analytics capabilities:

- **Aggregated Metrics**: Hospital counts, file statistics, processing metrics
- **Trend Analysis**: Price changes over time
- **Geographic Analytics**: State and region-based insights
- **Performance Metrics**: Job processing statistics and system health

### 5. User Management

Complete user and access management:

- **Role-Based Access Control (RBAC)**: Admin, viewer, and custom roles
- **User Profiles**: Customizable user profiles with preferences
- **Activity Tracking**: Comprehensive audit logs
- **Team Management**: Organization and team features

### 6. Real-Time Updates

WebSocket-based real-time features:

- **Job Progress**: Live updates on job processing
- **Notifications**: Real-time alerts and notifications
- **Dashboard Updates**: Live metrics and statistics
- **Collaborative Features**: Real-time collaboration tools

## Development Workflow

### Initial Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd glimmr-api
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   cp apps/api/.env.production.example apps/api/.env
   # Update environment variables as needed
   ```

4. **Start Development Environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

5. **Run Database Migrations**
   ```bash
   cd apps/api
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

6. **Start Development Servers**
   ```bash
   pnpm dev  # Starts both API and web
   ```

### Development Commands

#### API Development
```bash
cd apps/api
pnpm start:dev          # Start with hot reload
pnpm db:studio          # Open database GUI
pnpm db:generate        # Generate migrations
pnpm db:migrate         # Apply migrations
pnpm test               # Run tests
pnpm test:e2e           # Run E2E tests
```

#### Frontend Development
```bash
cd apps/web
npm run dev             # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
```

#### Code Quality
```bash
pnpm lint               # Run linting
pnpm format             # Format code
pnpm check-types        # TypeScript checking
```

### Git Workflow

The project follows a feature branch workflow:

1. Create feature branch from `main`
2. Make changes and commit
3. Run tests and linting
4. Create pull request
5. Code review and merge

## Database Architecture

### Schema Design

The database uses a domain-driven design with clear schema separation:

#### Core Schemas

1. **Users & Authentication**
   - `users`: User accounts and profiles
   - `user_sessions`: Active sessions
   - `user_preferences`: User settings
   - `roles` & `permissions`: RBAC implementation

2. **Hospitals**
   - `hospitals`: Hospital entities
   - `hospital_configs`: Per-hospital configurations
   - `hospital_locations`: Geographic data

3. **Price Transparency Files**
   - `price_transparency_files`: Tracked files
   - `file_versions`: Version history
   - `file_metadata`: Extended metadata

4. **Prices**
   - `prices`: Individual price entries
   - `price_items`: Service/procedure details
   - `insurance_plans`: Insurance information
   - `price_history`: Historical pricing

5. **Jobs**
   - `jobs`: Job execution records
   - `job_configurations`: Job settings
   - `job_schedules`: Recurring schedules
   - `job_logs`: Execution logs

6. **Analytics**
   - `analytics_summaries`: Aggregated metrics
   - `analytics_trends`: Time-series data
   - `analytics_reports`: Generated reports

### Database Optimization

- **Indexes**: Strategic indexes on frequently queried columns
- **Partitioning**: Time-based partitioning for large tables
- **Connection Pooling**: Optimized connection management
- **Query Optimization**: Efficient queries with proper joins

## Job Processing System

### Queue Architecture

The job system uses BullMQ with Redis for reliable background processing:

#### Primary Queues

1. **pra-unified-scan**
   - Discovers hospitals from external APIs
   - Detects file changes
   - Schedules download jobs

2. **pra-file-download**
   - Downloads price transparency files
   - Handles retries and failures
   - Stores files in object storage

3. **price-file-parser**
   - Parses downloaded files
   - Extracts pricing data
   - Validates data quality

4. **price-normalization**
   - Normalizes price data
   - Maps to standard formats
   - Updates database

5. **analytics-refresh**
   - Generates analytics
   - Updates aggregated metrics
   - Creates reports

### Job Features

- **Concurrency Control**: Configurable worker concurrency
- **Rate Limiting**: API rate limit compliance
- **Progress Tracking**: Real-time progress updates
- **Error Handling**: Comprehensive error recovery
- **Scheduling**: Cron-based job scheduling
- **Priority Queues**: Job prioritization

### Job Monitoring

- **Bull Board**: Visual queue monitoring at `/api/v1/admin/queues`
- **WebSocket Updates**: Real-time job status
- **Metrics Collection**: Performance tracking
- **Alert System**: Failure notifications

## Frontend Application

### Component Architecture

The React application uses a modular component structure:

#### Core Components

1. **Layout Components**
   - `AppLayout`: Main application layout
   - `Sidebar`: Navigation sidebar
   - `Header`: Top navigation bar
   - `MobileNav`: Mobile navigation

2. **Authentication**
   - `LoginForm`: User login
   - `RegisterForm`: User registration
   - `AuthGuard`: Route protection
   - `ProtectedRoute`: Role-based access

3. **Admin Dashboard**
   - `QueueDashboard`: Job monitoring
   - `UserManagement`: User administration
   - `ActivityDashboard`: System activity
   - `AnalyticsDashboard`: Data insights

4. **User Features**
   - `ProfilePage`: User profile management
   - `NotificationCenter`: Alerts and updates
   - `PreferencesSettings`: User preferences

### State Management

The application uses multiple state management strategies:

1. **Zustand Stores**
   - `authStore`: Authentication state
   - `userManagementStore`: Admin features
   - `sidebarStore`: UI state

2. **React Context**
   - `ThemeContext`: Theme management
   - `UnsavedChangesContext`: Form state tracking

3. **React Query**
   - API data fetching
   - Cache management
   - Optimistic updates

### UI/UX Features

- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Full theme support
- **Animations**: Smooth transitions with Framer Motion
- **Accessibility**: WCAG compliance
- **Performance**: Code splitting and lazy loading

## API Documentation

### RESTful Endpoints

The API follows RESTful conventions with comprehensive Swagger documentation:

#### Core Endpoints

1. **Authentication**
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/refresh`
   - `POST /api/v1/auth/logout`

2. **Hospitals**
   - `GET /api/v1/hospitals`
   - `GET /api/v1/hospitals/:id`
   - `PUT /api/v1/hospitals/:id`
   - `DELETE /api/v1/hospitals/:id`

3. **Prices**
   - `GET /api/v1/prices`
   - `GET /api/v1/prices/search`
   - `GET /api/v1/prices/analytics`

4. **Jobs**
   - `GET /api/v1/jobs/status`
   - `POST /api/v1/jobs/pra/scan`
   - `GET /api/v1/jobs/queue/:name`

5. **Analytics**
   - `GET /api/v1/analytics/summary`
   - `GET /api/v1/analytics/trends`
   - `POST /api/v1/analytics/export`

### WebSocket Events

Real-time communication through WebSocket:

```typescript
// Job events
'job:started'
'job:progress'
'job:completed'
'job:failed'

// System events
'metrics:update'
'notification:new'
'user:activity'
```

## Authentication & Security

### Security Features

1. **JWT Authentication**
   - Access tokens with short expiry
   - Refresh token rotation
   - Secure HTTP-only cookies

2. **Role-Based Access Control**
   - Predefined roles (Admin, Viewer)
   - Custom permissions
   - Resource-level access control

3. **API Security**
   - Rate limiting per endpoint
   - CORS configuration
   - Input validation
   - SQL injection prevention

4. **Data Protection**
   - Password hashing with bcrypt
   - Sensitive data encryption
   - Audit logging
   - GDPR compliance features

### Security Best Practices

- No hardcoded secrets
- Environment-based configuration
- Regular security updates
- Penetration testing
- Security headers (Helmet.js)

## Storage System

### Object Storage Architecture

The platform uses object storage for file management:

1. **Development**: MinIO (S3-compatible)
2. **Production**: DigitalOcean Spaces

### Storage Features

- **Bucket Organization**: Structured file organization
- **Access Control**: Pre-signed URLs for secure access
- **Versioning**: File version tracking
- **Compression**: Automatic file compression
- **CDN Integration**: Fast file delivery

### File Types

- Hospital pricing files (CSV, JSON, XML)
- Generated reports
- User uploads
- System backups

## Monitoring & Analytics

### System Monitoring

1. **Health Checks**
   - Database connectivity
   - Redis availability
   - Storage access
   - External API status

2. **Performance Metrics**
   - Response times
   - Queue processing rates
   - Database query performance
   - Memory usage

3. **Error Tracking**
   - Structured logging with Pino
   - Error aggregation
   - Alert thresholds
   - Debug information

### Business Analytics

1. **Hospital Metrics**
   - Total hospitals tracked
   - File update frequency
   - Geographic distribution

2. **Price Analytics**
   - Price ranges by procedure
   - Insurance plan comparisons
   - Temporal price changes

3. **System Analytics**
   - Job success rates
   - Processing times
   - User activity patterns

## Testing Strategy

### Testing Levels

1. **Unit Tests**
   - Service layer testing
   - Utility function tests
   - Component testing

2. **Integration Tests**
   - API endpoint testing
   - Database integration
   - External API mocking

3. **E2E Tests**
   - Critical user flows
   - Authentication flows
   - Admin workflows

### Testing Tools

- **Jest**: Unit and integration testing
- **Supertest**: API testing
- **React Testing Library**: Component testing
- **Playwright**: E2E testing (optional)

### Test Coverage

- Target: 80% code coverage
- Critical paths: 100% coverage
- CI/CD integration
- Pre-commit hooks

## Deployment & DevOps

### Container Architecture

```yaml
# Docker services
- glimmr-api: NestJS application
- glimmr-web: React application
- glimmr-postgres: PostgreSQL database
- glimmr-redis: Redis for queues
- glimmr-minio: Object storage
- glimmr-inbucket: Email testing
```

### Environment Management

1. **Development**
   - Docker Compose setup
   - Hot reloading
   - Debug tools

2. **Staging**
   - Production-like environment
   - Performance testing
   - Integration testing

3. **Production**
   - Horizontal scaling
   - Load balancing
   - Blue-green deployments

### CI/CD Pipeline

1. **Build Stage**
   - Dependency installation
   - TypeScript compilation
   - Asset optimization

2. **Test Stage**
   - Unit tests
   - Integration tests
   - Code quality checks

3. **Deploy Stage**
   - Container building
   - Environment deployment
   - Health verification

## Performance Considerations

### Optimization Strategies

1. **Database Performance**
   - Query optimization
   - Index management
   - Connection pooling
   - Read replicas

2. **API Performance**
   - Response caching
   - Pagination
   - Field filtering
   - Compression

3. **Frontend Performance**
   - Code splitting
   - Lazy loading
   - Asset optimization
   - CDN usage

4. **Job Processing**
   - Parallel processing
   - Batch operations
   - Memory management
   - Queue optimization

### Scalability

- Horizontal scaling for API servers
- Queue worker scaling
- Database sharding capabilities
- Caching layers (Redis)

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Machine learning insights
   - Predictive pricing models
   - Anomaly detection

2. **Integration Expansion**
   - Additional data sources
   - Third-party integrations
   - API marketplace

3. **User Experience**
   - Mobile applications
   - Advanced visualizations
   - Collaborative features

4. **Enterprise Features**
   - Multi-tenancy
   - White-labeling
   - Advanced RBAC
   - Compliance tools

## Conclusion

Glimmr represents a comprehensive solution for healthcare price transparency, combining modern web technologies with robust data processing capabilities. The platform's modular architecture, comprehensive testing, and focus on performance make it a scalable solution for aggregating and analyzing healthcare pricing data at scale.

The combination of automated discovery, intelligent processing, and user-friendly interfaces positions Glimmr as a valuable tool for healthcare organizations, researchers, and consumers seeking transparency in healthcare pricing.