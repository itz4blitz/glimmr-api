# System Architecture

Glimmr is designed as a distributed, microservices-based platform optimized for healthcare data processing at scale.

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   API Gateway   │    │   Admin Tools   │
│   (React/Vite)  │    │   (NestJS)      │    │  (Airflow/etc)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     Load Balancer       │
                    │   (Cloudflare Tunnel)   │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼─────────┐ ┌─────▼─────┐ ┌─────────▼─────────┐
    │   Data Ingestion  │ │    API    │ │   Orchestration   │
    │    (Airbyte)      │ │ (NestJS)  │ │    (Airflow)      │
    └─────────┬─────────┘ └─────┬─────┘ └─────────┬─────────┘
              │                 │                 │
              │        ┌────────▼────────┐        │
              │        │   Message Queue │        │
              │        │  (Redis/BullMQ) │        │
              │        └────────┬────────┘        │
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Data Storage       │
                    │   (PostgreSQL)        │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   File Storage        │
                    │ (MinIO/DO Spaces)     │
                    └───────────────────────┘
```

## 🎯 Core Components

### 1. API Layer (NestJS)
**Purpose**: RESTful API and business logic  
**Port**: 3000  
**URL**: https://api.glimmr.health

**Key Modules**:
- `HospitalModule` - Hospital data management
- `PriceModule` - Price data querying and analytics
- `AuthModule` - JWT authentication and RBAC
- `JobModule` - Background job management
- `AnalyticsModule` - Data aggregation and reporting

**Design Patterns**:
- Domain-driven design with module separation
- Repository pattern with Drizzle ORM
- Dependency injection throughout
- Event-driven architecture for async processing

### 2. Frontend (React + TypeScript)
**Purpose**: User interface and admin dashboard  
**Port**: 5174  
**URL**: https://app.glimmr.health

**Key Features**:
- **Authentication**: JWT-based login with role management
- **Dashboard**: Real-time metrics and job monitoring
- **Data Explorer**: Interactive price data querying
- **Admin Panel**: System configuration and user management
- **Responsive Design**: Mobile-first approach with Tailwind CSS

**State Management**: Zustand for auth, React Context for theme

### 3. Data Ingestion (Airbyte)
**Purpose**: ETL for external data sources  
**Port**: 8000  
**URL**: https://airbyte.glimmr.health

**Sources**:
- Patient Rights Advocate API
- Hospital website file downloads
- Government healthcare databases

**Destinations**:
- PostgreSQL staging tables
- MinIO for raw file storage
- Redis for caching

### 4. Workflow Orchestration (Airflow)
**Purpose**: Complex ETL pipeline management  
**Port**: 8080  
**URL**: https://airflow.glimmr.health

**DAGs**:
- **Hospital Discovery**: Daily PRA API scans
- **File Processing**: Parse and normalize transparency files
- **Data Quality**: Validation and error detection
- **Backup Management**: Automated database backups
- **Analytics Refresh**: Materialized view updates

### 5. Message Queue (Redis + BullMQ)
**Purpose**: Async job processing for real-time operations  
**Port**: 6379 (internal)

**Queues**:
- `user-actions` - User-triggered operations
- `notifications` - Real-time WebSocket events
- `file-processing` - Immediate file parsing
- `analytics` - Real-time metric updates

### 6. Database (PostgreSQL)
**Purpose**: Primary data storage  
**Port**: 5432 (internal), 5432 (external SSL)

**Key Schemas**:
```sql
-- Hospital information
hospitals (id, name, state, cms_id, website_url, ...)

-- Price transparency files
price_transparency_files (id, hospital_id, file_url, last_updated, ...)

-- Normalized price data
prices (id, hospital_id, service_code, description, price, payer, ...)

-- Analytics aggregations
analytics_summary (date, hospital_id, avg_price, record_count, ...)
```

### 7. File Storage (MinIO/DigitalOcean Spaces)
**Purpose**: Object storage for transparency files  
**Ports**: 9000 (API), 9001 (Console)

**Buckets**:
- `glimmr-prod` - Production transparency files
- `glimmr-backups` - Database backup storage
- `glimmr-temp` - Temporary processing files

## 🔄 Data Flow Architecture

### 1. Hospital Discovery Flow
```
PRA API → Airbyte → PostgreSQL staging → Airflow DAG → Hospital records
```

### 2. File Processing Flow
```
Hospital URLs → Airbyte download → MinIO storage → Airflow parsing → Price records
```

### 3. Real-time Operations Flow
```
User Request → NestJS API → BullMQ job → WebSocket notification → Frontend update
```

### 4. Analytics Flow
```
Price data → Airflow aggregation → Materialized views → API responses
```

## 🛡️ Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with 24h expiration
- **API Keys**: Service-to-service authentication
- **RBAC**: Role-based permissions (admin, analyst, viewer)
- **Rate Limiting**: Per-endpoint and per-user limits

### Network Security
- **SSL/TLS**: End-to-end encryption with Cloudflare Origin Certs
- **VPN Access**: Secure tunnel for administrative access
- **Firewall**: Docker network isolation
- **CORS**: Strict origin controls

### Data Security
- **Encryption at Rest**: PostgreSQL transparent encryption
- **Secrets Management**: 1Password integration
- **Audit Logging**: Comprehensive access tracking
- **Backup Encryption**: AES-256 encrypted backups

## 📊 Scalability Design

### Horizontal Scaling
- **API Servers**: Load-balanced NestJS instances
- **Worker Processes**: Multiple Airflow workers
- **Database**: Read replicas for analytics queries
- **Cache Layer**: Redis cluster for high availability

### Performance Optimization
- **Database Indexing**: Optimized for common query patterns
- **Caching Strategy**: Multi-layer caching (Redis, HTTP, CDN)
- **Streaming Processing**: Handle large files without memory issues
- **Connection Pooling**: Efficient database connection management

### Monitoring & Observability
- **Metrics**: Prometheus + Grafana dashboards
- **Logging**: Structured JSON logs with Pino
- **Tracing**: Request correlation across services
- **Health Checks**: Comprehensive endpoint monitoring

## 🚀 Deployment Architecture

### Container Orchestration
```yaml
# Production stack
services:
  - postgres (primary database)
  - redis (cache/queue)
  - minio (file storage)
  - api (NestJS application)
  - web (React frontend)
  - airflow (workflow orchestration)
  - airbyte (data ingestion)
  - authentik (identity provider)
  - prometheus (metrics)
  - grafana (monitoring)
  - cloudflare-tunnel (secure access)
```

### CI/CD Pipeline
1. **Code Push** → GitHub triggers workflow
2. **Build Phase** → Docker images built and pushed to registry
3. **Test Phase** → Unit/integration tests run
4. **Deploy Phase** → SSH deployment to production server
5. **Health Check** → Verify all services are healthy

### Infrastructure as Code
- **Docker Compose**: Service definitions and networking
- **GitHub Actions**: Automated deployment pipeline
- **1Password**: Secure secret management
- **Cloudflare**: DNS, SSL, and tunnel management

## 🔧 Development Architecture

### Local Development
```bash
# Minimal development stack
docker-compose.dev.yml:
  - postgres (local database)
  - redis (local cache)
  - minio (local storage)
  - inbucket (email testing)

# API runs on host for faster development
pnpm dev:services  # Start containers
cd apps/api && pnpm start:dev  # Start API on host
```

### Code Organization
```
apps/
├── api/           # NestJS backend
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   ├── hospitals/     # Hospital domain
│   │   ├── prices/        # Price domain
│   │   ├── jobs/          # Background jobs
│   │   ├── analytics/     # Analytics domain
│   │   └── database/      # Schemas and migrations
│   └── test/      # E2E tests
└── web/           # React frontend
    ├── src/
    │   ├── components/    # UI components
    │   ├── pages/         # Route components
    │   ├── hooks/         # Custom hooks
    │   └── stores/        # State management
    └── public/    # Static assets
```

---

🏗️ **Architecture Principles**:
- **Separation of Concerns**: Each service has a single responsibility
- **Event-Driven**: Async processing with message queues
- **Stateless Services**: Horizontally scalable components
- **Data-First**: Schema-driven development with strong types
- **Observability**: Comprehensive monitoring and logging