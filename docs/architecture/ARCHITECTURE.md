# 🏗️ Glimmr Architecture Overview

## 🌐 **Cloudflare-First Architecture**

Glimmr uses a modern, cloud-first architecture with Cloudflare as the primary networking and security layer, eliminating the need for traditional reverse proxies.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE NETWORK                  │
│  ✅ Global CDN    ✅ DDoS Protection    ✅ WAF Security      │
│  ✅ SSL/TLS       ✅ Rate Limiting      ✅ Access Control    │
└─────────────────────┬───────────────────────────────────────┘
                      │ Cloudflare Tunnel (Zero-Trust)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT                       │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   APPLICATION   │  │   DATA LAYER    │  │  ANALYTICS  │  │
│  │                 │  │                 │  │             │  │
│  │ • NestJS API    │  │ • PostgreSQL    │  │ • Airflow   │  │
│  │ • React Web     │  │ • Redis Cache   │  │ • Airbyte   │  │
│  │ • Authentik     │  │ • MinIO Storage │  │ • dbt       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 **Data Flow Architecture**

### **Real-Time Processing Pipeline**
```
External APIs → Airbyte → PostgreSQL → API → React Frontend
                    ↓
              Airflow Orchestration
                    ↓
               dbt Transformations
                    ↓
           Analytics & Reporting
```

### **Security & Authentication Flow**
```
User → Cloudflare Access → Authentik SSO → Application
                ↓
         RBAC Permissions
                ↓
      Database (Least Privilege)
```

## 🏢 **Service Architecture**

### **Core Application Services**
- **glimmr-api** (NestJS) - Main backend API
- **glimmr-web** (React) - Frontend application
- **glimmr-postgres** - Primary database with secure users
- **glimmr-redis** - Caching and session storage
- **glimmr-minio** - S3-compatible object storage

### **Authentication & Security**
- **glimmr-authentik-server** - SSO and identity management
- **glimmr-authentik-postgres** - Dedicated auth database
- **Cloudflare Tunnel** - Zero-trust network access

### **Data Processing & Analytics**
- **airbyte** (Kubernetes) - Data integration platform
- **airflow-webserver** - Workflow orchestration
- **airflow-postgres** - Dedicated workflow database
- **dbt** (On-demand) - Data transformation

## 🔒 **Security Architecture**

### **Database Security (Least Privilege)**
```sql
-- Dedicated database users with minimal permissions
glimmr_api_user       → Full CRUD on application tables
glimmr_analytics_user → Read-only for reporting
glimmr_readonly_user  → Monitoring and backups
```

### **Network Security (Zero-Trust)**
- **No open ports** - All traffic through Cloudflare Tunnel
- **End-to-end encryption** - TLS termination at edge
- **Access policies** - Cloudflare Access for team authentication
- **WAF protection** - Automatic threat detection and blocking

### **Authentication & Authorization**
- **SSO Integration** - Authentik with multiple providers
- **RBAC System** - Role-based access control
- **Session Management** - Secure JWT tokens with Redis
- **API Security** - Rate limiting and CORS protection

## 🌍 **Global Access Strategy**

### **Development Environment**
- **Local**: `localhost:3000`, `localhost:5174`
- **Global**: `dev-api.yourdomain.com`, `dev-app.yourdomain.com`

### **Production Environment**
- **API**: `api.glimmr.health`
- **App**: `app.glimmr.health`
- **Analytics**: `airflow.glimmr.health`
- **Data**: `airbyte.glimmr.health`

## 🚀 **Deployment Architecture**

### **Development Deployment**
```bash
# Complete stack deployment
./scripts/full-rebuild.sh

# Services start order:
# 1. Database & Cache (PostgreSQL, Redis)
# 2. Storage (MinIO) 
# 3. Authentication (Authentik)
# 4. Application (API, Web)
# 5. Analytics (Airflow, Airbyte)
# 6. Networking (Cloudflare Tunnel)
```

### **Production Deployment**
- **Infrastructure as Code** - Terraform or CDK
- **Container Orchestration** - Kubernetes or Docker Swarm
- **Database** - Managed PostgreSQL (RDS, Cloud SQL)
- **Secrets Management** - 1Password, AWS Secrets Manager
- **Monitoring** - Cloudflare Analytics, DataDog, Sentry

## 📊 **Scalability Patterns**

### **Horizontal Scaling**
- **API**: Multiple container replicas behind Cloudflare Load Balancer
- **Database**: Read replicas for analytics workloads
- **Cache**: Redis cluster for high availability
- **Storage**: Distributed object storage

### **Performance Optimization**
- **CDN Caching** - Static assets cached globally
- **Database Indexing** - Optimized for healthcare data queries
- **Connection Pooling** - Efficient database connections
- **Async Processing** - Background jobs via Airflow

## 🔍 **Monitoring & Observability**

### **Application Monitoring**
- **Health Checks** - Built-in service health endpoints
- **Logging** - Structured JSON logs with correlation IDs
- **Metrics** - Custom business metrics and KPIs
- **Tracing** - Request flow tracking

### **Infrastructure Monitoring**
- **Cloudflare Analytics** - Traffic, performance, security
- **Container Health** - Docker health checks
- **Database Performance** - Query optimization and slow query logs
- **Resource Usage** - CPU, memory, storage utilization

## 🧪 **Testing Strategy**

### **Application Testing**
- **Unit Tests** - Individual service testing
- **Integration Tests** - API endpoint testing
- **E2E Tests** - Full user journey testing
- **Load Testing** - Performance and scalability testing

### **Infrastructure Testing**
- **Health Checks** - Automated service availability
- **Security Testing** - Vulnerability scanning
- **Disaster Recovery** - Backup and restore testing
- **Configuration Testing** - Infrastructure as code validation

## 🔧 **Development Workflow**

### **Local Development**
1. **Start services**: `./scripts/full-rebuild.sh`
2. **Code changes**: Hot reload enabled
3. **Database migrations**: Automatic via Drizzle
4. **Testing**: Run test suites locally

### **CI/CD Pipeline**
1. **Code commit** → Automated testing
2. **Build images** → Container registry
3. **Security scan** → Vulnerability assessment
4. **Deploy staging** → Integration testing
5. **Deploy production** → Blue-green deployment

---

## 🎯 **Architecture Benefits**

✅ **Simplified Infrastructure** - No traditional reverse proxy complexity  
✅ **Global Performance** - Cloudflare's 290+ edge locations  
✅ **Enterprise Security** - Built-in DDoS, WAF, and access control  
✅ **Zero Network Config** - No port forwarding or firewall management  
✅ **Scalable Foundation** - Cloud-native architecture patterns  
✅ **Developer Experience** - Fast local development and deployment  

This architecture provides a robust, secure, and scalable foundation for healthcare data processing while maintaining simplicity and developer productivity.