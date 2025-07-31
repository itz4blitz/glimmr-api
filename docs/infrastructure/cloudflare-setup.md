# ☁️ Cloudflare Tunnel Setup Guide

## 🌟 **Why Cloudflare Tunnel?**

Since you already have Cloudflare DNS, adding Cloudflare Tunnel gives you:

✅ **Secure Public Access** - Expose local services securely  
✅ **Zero Network Config** - No port forwarding or firewall changes  
✅ **Built-in Security** - DDoS protection, WAF, rate limiting  
✅ **Free SSL Certificates** - Automatic HTTPS for all services  
✅ **Access Control** - Cloudflare Access for team authentication  
✅ **Performance** - Global CDN acceleration  
✅ **Development to Production** - Same config scales seamlessly  

## 🚀 **Quick Setup (5 minutes)**

### 1. Create Tunnel in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** > **Zero Trust** > **Networks** > **Tunnels**
2. Click **Create a tunnel**
3. Choose **Cloudflared** connector
4. Name it `glimmr-dev` (or `glimmr-prod` for production)
5. **Copy the tunnel token** - you'll need this

### 2. Configure Environment

```bash
cd infrastructure/cloudflare
cp .env.example .env

# Edit .env and add your tunnel token:
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWJjZGVmZ2hpams...
```

### 3. Configure Hostnames in Cloudflare

In the Cloudflare Tunnel dashboard, add these hostname configurations:

| Hostname | Service | URL |
|----------|---------|-----|
| `dev-api.yourdomain.com` | HTTP | `glimmr-api:3000` |
| `dev-app.yourdomain.com` | HTTP | `glimmr-web:5174` |
| `dev-airflow.yourdomain.com` | HTTP | `airflow-webserver:8080` |
| `dev-airbyte.yourdomain.com` | HTTP | `host.docker.internal:8000` |
| `dev-minio.yourdomain.com` | HTTP | `glimmr-minio:9001` |
| `dev-auth.yourdomain.com` | HTTP | `glimmr-authentik-server:9000` |

### 4. Deploy Tunnel

```bash
cd infrastructure/cloudflare
docker compose up -d
```

### 5. Test Access

Your services are now accessible globally:
- 🌐 **API**: https://dev-api.yourdomain.com
- 🌐 **Web App**: https://dev-app.yourdomain.com
- 🌐 **Airflow**: https://dev-airflow.yourdomain.com
- 🌐 **Airbyte**: https://dev-airbyte.yourdomain.com

## 🏗️ **Integration with Existing Stack**

### Updated Full Rebuild Script

Add to `scripts/full-rebuild.sh`:

```bash
# After Airbyte deployment, add:
echo "☁️ Deploying Cloudflare Tunnel..."
cd infrastructure/cloudflare
if [ -f .env ]; then
    docker compose up -d
    echo "✅ Cloudflare Tunnel deployed"
else
    echo "⚠️  Cloudflare tunnel not configured - create .env file"
fi
cd ../..
```

### Environment Variable Updates

Update CORS settings in `apps/api/.env.docker.secure`:

```bash
# Add your tunnel domains
CORS_ORIGINS=http://localhost:5174,http://localhost:3000,https://dev-api.yourdomain.com,https://dev-app.yourdomain.com
```

## 🔒 **Security Enhancements**

### 1. Cloudflare Access (Team Authentication)

Configure in **Zero Trust** > **Access** > **Applications**:

```yaml
# Example policy for Airflow
Application: Airflow Dashboard
Subdomain: dev-airflow.yourdomain.com
Policies:
  - Name: Glimmr Team Only
    Rule: Emails ending in @yourcompany.com
```

### 2. WAF Rules

Configure in **Security** > **WAF**:
- Block malicious IPs
- Rate limiting (100 req/min per IP)
- Bot protection

### 3. DNS Security

Enable in **DNS** > **Settings**:
- DNSSEC
- DNS filtering for malware

## 🌍 **Production Deployment**

### Domain Strategy

**Development:**
- `dev-api.glimmr.health`
- `dev-app.glimmr.health`
- `dev-airflow.glimmr.health`

**Staging:**
- `staging-api.glimmr.health`
- `staging-app.glimmr.health`

**Production:**
- `api.glimmr.health`
- `app.glimmr.health`
- `airflow.glimmr.health`

### Zero-Downtime Deployments

1. Deploy to staging tunnel first
2. Test thoroughly
3. Switch DNS to production tunnel
4. Blue-green deployments via tunnel hostname switching

## 📊 **Monitoring & Analytics**

Cloudflare provides built-in analytics:
- **Traffic Analytics** - Requests, bandwidth, errors
- **Security Analytics** - Blocked threats, bot traffic
- **Performance Analytics** - Response times, cache hit ratio
- **Origin Health** - Uptime monitoring

Access via **Analytics & Logs** in Cloudflare Dashboard.

## 🔧 **Advanced Configuration**

### Custom Headers

Add security headers automatically:

```yaml
# In Cloudflare tunnel config
originRequest:
  httpHeadersToOrigin:
    X-Forwarded-Proto: https
    X-Real-IP: $remote_addr
```

### Load Balancing

For production high availability:

1. Create **Load Balancer** in Cloudflare
2. Multiple origin servers
3. Health checks and failover

### Caching Rules

Optimize performance:
- Cache static assets (CSS, JS, images)
- Edge-side includes for dynamic content
- Purge cache on deployments

## ⚡ **Performance Benefits**

**Before Cloudflare Tunnel:**
- Direct connection to your server
- Limited by your internet connection
- No DDoS protection

**After Cloudflare Tunnel:**
- 290+ global edge locations
- Automatic image optimization
- HTTP/3 and Brotli compression
- Smart routing and load balancing

## 🚨 **Security Considerations**

### Firewall Configuration

With Cloudflare Tunnel, you can:
1. **Block all incoming ports** on your server
2. **Only allow Cloudflare IPs** if needed
3. **Zero-trust model** - no direct server access

### IP Allowlisting

Restrict access to specific IPs:
```bash
# In Cloudflare tunnel config
originRequest:
  accessPolicy:
    - allow: 192.168.1.0/24  # Your office network
    - deny: all
```

## 🎯 **Next Steps**

1. **Set up the tunnel** following steps above
2. **Configure team access** via Cloudflare Access
3. **Enable WAF protection** for your APIs
4. **Set up monitoring** alerts
5. **Plan production domain strategy**

This gives you enterprise-grade infrastructure with zero server configuration! 🚀