# Welcome to the Glimmr Wiki

**Glimmr is a healthcare price transparency data aggregation platform that automatically discovers, downloads, and analyzes hospital pricing files to provide comprehensive analytics on healthcare costs across the United States.**

## 📚 Documentation Sections

### 🏗️ Architecture & Design
- **[System Architecture](./System-Architecture)** - Complete technical overview
- **[Data Pipeline](./Data-Pipeline)** - Hospital discovery to analytics flow
- **[Database Schema](./Database-Schema)** - PostgreSQL schema documentation
- **[API Design](./API-Design)** - RESTful API architecture and patterns

### 🚀 Deployment & Operations  
- **[Production Deployment](./Production-Deployment)** - GitHub Actions CI/CD pipeline
- **[Development Setup](./Development-Setup)** - Local development environment
- **[Infrastructure](./Infrastructure)** - Docker services and configuration
- **[Monitoring](./Monitoring)** - Health checks, metrics, and alerting

### 💾 Data Processing
- **[Hospital Discovery](./Hospital-Discovery)** - PRA API integration and scanning
- **[File Processing](./File-Processing)** - Parsing CSV/JSON/XML transparency files
- **[Price Normalization](./Price-Normalization)** - Data standardization and validation
- **[Analytics Engine](./Analytics-Engine)** - Aggregation and insights generation

### 🔧 Development
- **[Contributing Guide](./Contributing-Guide)** - Development workflow and standards
- **[Testing Strategy](./Testing-Strategy)** - Unit, integration, and E2E testing
- **[Code Patterns](./Code-Patterns)** - NestJS patterns and conventions
- **[Troubleshooting](./Troubleshooting)** - Common issues and solutions

### 🌐 External Integrations
- **[Patient Rights Advocate API](./PRA-API-Integration)** - Hospital data source
- **[Healthcare Regulations](./Healthcare-Regulations)** - CMS compliance and requirements
- **[File Format Standards](./File-Format-Standards)** - CSV/JSON schema variations

## 🎯 Quick Links

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production API** | https://api.glimmr.health | Main API endpoint |
| **Web App** | https://app.glimmr.health | React frontend |
| **Swagger Docs** | https://api.glimmr.health/api/docs | API documentation |
| **Airflow** | https://airflow.glimmr.health | Workflow orchestration |
| **Airbyte** | https://airbyte.glimmr.health | Data ingestion |
| **Grafana** | https://grafana.glimmr.health | Monitoring dashboard |

## 🏥 Healthcare Context

The platform addresses the **CMS Hospital Price Transparency Rule** which requires hospitals to publish:
- Gross charges for all items and services
- Discounted cash prices  
- Payer-specific negotiated charges
- Machine-readable files updated at least annually

**Key Challenges:**
- 6,000+ hospitals with varying file formats
- Inconsistent data quality and schemas
- Large files (1GB+) requiring streaming processing
- Complex pricing structures and rate variations

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | NestJS + TypeScript | API and business logic |
| **Frontend** | React + Vite + TypeScript | User interface |
| **Database** | PostgreSQL + Drizzle ORM | Primary data storage |
| **Cache/Queue** | Redis + BullMQ | Caching and job processing |
| **Storage** | MinIO/DigitalOcean Spaces | File storage |
| **ETL** | Airbyte + Airflow | Data ingestion and orchestration |
| **Monitoring** | Prometheus + Grafana | Metrics and alerting |
| **Auth** | Authentik | Identity and access management |

## 📊 Current Status

**Production Metrics** (as of latest deployment):
- **Hospitals Tracked**: 6,000+ facilities across all US states
- **Price Records**: 100M+ normalized pricing entries
- **Files Processed**: 50GB+ of transparency data monthly
- **API Uptime**: 99.9% availability with health monitoring
- **Processing Speed**: 10,000 price records/minute average

## 🎯 Roadmap

### Phase 1: Foundation ✅
- Hospital discovery and file monitoring
- Basic price data extraction and normalization
- RESTful API with authentication
- Production deployment pipeline

### Phase 2: Analytics 🚧
- Advanced price analytics and trending
- Geographic and payer-based insights
- Real-time data processing improvements
- Enhanced monitoring and alerting

### Phase 3: Intelligence 📋
- Machine learning for price prediction
- Anomaly detection for pricing errors
- Automated data quality scoring
- Consumer-facing price comparison tools

---

📝 **Last Updated**: $(date +'%Y-%m-%d')  
🏗️ **Architecture**: Microservices with event-driven processing  
🔐 **Security**: JWT auth, API keys, role-based access control  
📊 **Scale**: Designed for 10M+ price records, 1000+ concurrent users