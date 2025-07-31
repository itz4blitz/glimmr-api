# ☁️ Cloudflare Dashboard Configuration Guide

## 🎯 **Quick Setup for Tunnel ID: 21945a72-7450-4553-9c17-dbc27883135a**

### **Step 1: Access Cloudflare Dashboard**
1. Go to: https://one.dash.cloudflare.com
2. Navigate to: **Zero Trust** > **Networks** > **Tunnels**
3. Find tunnel: **"glimmr"** (ID: `21945a72-7450-4553-9c17-dbc27883135a`)
4. Click **"Configure"**

### **Step 2: Add Public Hostnames**
Click **"Add a public hostname"** for each of these:

| Hostname | Service | Path |
|----------|---------|------|
| `dev-api.glimmr.health` | `http://glimmr-api:3000` | *(leave blank)* |
| `dev-app.glimmr.health` | `http://glimmr-web:5174` | *(leave blank)* |
| `dev-airflow.glimmr.health` | `http://airflow-webserver:8080` | *(leave blank)* |
| `dev-airbyte.glimmr.health` | `http://host.docker.internal:8000` | *(leave blank)* |
| `dev-minio.glimmr.health` | `http://glimmr-minio:9001` | *(leave blank)* |
| `dev-auth.glimmr.health` | `http://glimmr-authentik-server:9000` | *(leave blank)* |

### **Step 3: Configuration Details**
For each hostname, use these settings:
- **Type**: HTTP
- **URL**: *(as specified in table above)*
- **Path**: *(leave blank)*
- **Additional application settings**: *(leave default)*

### **Step 4: Save Configuration**
Click **"Save hostname"** after adding each one.

### **Step 5: Test Your Setup**
After running `./scripts/full-rebuild.sh`, your services will be available at:

🌐 **Global URLs:**
- **API**: https://dev-api.glimmr.health
- **Web App**: https://dev-app.glimmr.health
- **Airflow**: https://dev-airflow.glimmr.health
- **Airbyte**: https://dev-airbyte.glimmr.health
- **MinIO Console**: https://dev-minio.glimmr.health
- **Authentik**: https://dev-auth.glimmr.health

🏠 **Local URLs (still work):**
- **API**: http://localhost:3000
- **Web App**: http://localhost:5174
- **Airflow**: http://localhost:8081
- **Airbyte**: http://localhost:8000
- **MinIO Console**: http://localhost:9001
- **Authentik**: http://localhost:9002

## 🚀 **Deploy Your Stack**

Once you've configured the hostnames in Cloudflare Dashboard:

```bash
# Deploy everything with Cloudflare Tunnel
./scripts/full-rebuild.sh
```

The script will:
1. ✅ Stop and clean all existing services
2. ✅ Deploy PostgreSQL with secure database users
3. ✅ Deploy Redis, MinIO, Authentik
4. ✅ Deploy your API and Web applications
5. ✅ Deploy Airflow and Airbyte
6. ✅ Deploy Cloudflare Tunnel with global access

## 🔒 **Security Benefits**

With Cloudflare Tunnel, you get:
- ✅ **Zero open ports** on your server
- ✅ **DDoS protection** automatically
- ✅ **Free SSL certificates** for all services
- ✅ **WAF protection** against attacks
- ✅ **Global CDN** performance
- ✅ **Access control** via Cloudflare Access

## 🎉 **You're Done!**

After configuration, you'll have:
- Enterprise-grade global access to your development environment
- Secure, encrypted connections to all services
- Zero network configuration complexity
- Production-ready infrastructure patterns