# Airbyte Integration (Kubernetes-based)

Airbyte is integrated into our stack using the official `abctl` tool, which runs Airbyte in a Kubernetes cluster (via kind) alongside our Docker-based services.

## 🚀 Quick Start

### Start Airbyte
```bash
abctl local install
```

### Stop Airbyte
```bash
abctl local uninstall
```

### Get Credentials
```bash
abctl local credentials
```

## 🔗 Access Points

- **Web UI**: http://localhost:8000
- **API**: http://localhost:8000/api/v1
- **Credentials**: Run `abctl local credentials`

## 🔧 Integration with Docker Stack

### Database Connections
Airbyte can connect to your Docker-based databases using:
- **Host**: `host.docker.internal` (from Airbyte to Docker services)
- **Ports**: Standard ports (5432 for PostgreSQL, 3306 for MySQL, etc.)

### Example Connection Strings
```bash
# PostgreSQL (from Airbyte to your Docker PostgreSQL)
Host: host.docker.internal
Port: 5432
Database: your_database
Username: your_user
Password: your_password

# Redis (from Airbyte to your Docker Redis)
Host: host.docker.internal
Port: 6379
```

### Airflow Integration
Your Airflow instance can trigger Airbyte jobs via API:

```python
# In your Airflow DAGs
from airflow.providers.http.operators.http import SimpleHttpOperator

airbyte_sync = SimpleHttpOperator(
    task_id='trigger_airbyte_sync',
    http_conn_id='airbyte_api',
    endpoint='/api/v1/jobs',
    method='POST',
    data={
        "connectionId": "your-connection-id",
        "jobType": "sync"
    }
)
```

## 📊 Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Development Stack                   │
├─────────────────────────────────────────────────────────────┤
│  Docker Compose Services:                                   │
│  ├── Traefik (Reverse Proxy)                               │
│  ├── Authentik (Auth)                                      │
│  ├── PostgreSQL (Main DB)                                  │
│  ├── Redis (Cache/Sessions)                                │
│  ├── Airflow (Orchestration)                               │
│  └── Your Application Services                             │
├─────────────────────────────────────────────────────────────┤
│  Kubernetes Services (via abctl):                          │
│  └── Airbyte (Data Integration)                            │
└─────────────────────────────────────────────────────────────┘
```

## 🛠 Management Commands

### Check Status
```bash
# Check Airbyte status
abctl local status

# Check all Docker services
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check Kubernetes pods (Airbyte)
kubectl --kubeconfig ~/.airbyte/abctl/abctl.kubeconfig get pods -n airbyte-abctl
```

### Logs
```bash
# Airbyte logs
abctl local logs

# Docker service logs
docker compose logs [service-name]
```

### Backup/Restore
```bash
# Backup Airbyte configuration
abctl local backup

# Restore from backup
abctl local restore [backup-file]
```

## 🔄 Production Considerations

### Option 1: Hybrid Approach (Recommended)
- Keep Docker Compose for your application stack
- Use managed Kubernetes or Airbyte Cloud for Airbyte
- Maintain same integration patterns

### Option 2: Full Kubernetes Migration
- Migrate entire stack to Kubernetes
- Use Helm charts for all services
- Unified orchestration

### Option 3: Airbyte Cloud
- Use Airbyte's managed service
- Keep Docker for everything else
- Simplest production setup

## 🚨 Troubleshooting

### Port Conflicts
If port 8000 is in use:
```bash
# Check what's using port 8000
lsof -i :8000

# Stop conflicting service or change Airbyte port
abctl local install --port 8001
```

### Docker/Kubernetes Communication
If Airbyte can't reach Docker services:
```bash
# Test connectivity from Airbyte pod
kubectl --kubeconfig ~/.airbyte/abctl/abctl.kubeconfig exec -it [pod-name] -n airbyte-abctl -- curl host.docker.internal:5432
```

### Reset Everything
```bash
# Complete reset
abctl local uninstall --persisted
docker compose down -v
# Then reinstall both
```
