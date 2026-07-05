# RAG Bootstrap Production Deployment Runbook

**Version**: 1.0
**Last Updated**: 2026-05-06
**Owner**: Operations Team
**Audience**: DevOps, SRE, Infrastructure Engineers

---

## Quick Start (30 minutes)

### Prerequisites Check
```bash
# Check Docker version (>= 20.10)
docker --version

# Check docker-compose availability
docker-compose --version  # OR: docker compose --version

# Check required ports available
netstat -tuln | grep -E ':(8100|5432|6379|11434)'
# Should return nothing if ports are free

# Check disk space (need 50GB for models + data)
df -h / | tail -1
```

### Minimal Deployment (30 min)
```bash
# 1. Clone and enter directory
cd /path/to/rag-bootstrap

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings:
#   OLLAMA_BASE_URL=http://localhost:11434
#   POSTGRES_PASSWORD=your-secure-password
#   RAG_PORT=8100

# 3. Start services
docker-compose up -d

# 4. Verify health (wait 10-15 seconds)
curl http://localhost:8100/api/v2/health
# Should return: {"status":"healthy"}

# 5. Test basic functionality
curl -X POST http://localhost:8100/api/v2/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```

---

## Full Production Setup (2-3 hours)

### Phase 1: Infrastructure Preparation (30 min)

#### 1.1 Environment Setup
```bash
# Create deployment directory
mkdir -p /srv/rag-bootstrap/{data,config,logs}
cd /srv/rag-bootstrap

# Clone repository
git clone https://github.com/your-org/rag-bootstrap.git .
git checkout main

# Create .env with production settings
cat > .env << 'EOF'
# Network Configuration
RAG_NETWORK_NAME=rag-bootstrap-prod
RAG_PORT=8100
RAG_DOCS_VOLUME=/srv/rag-bootstrap/data/documents

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ragdb_prod
POSTGRES_USER=raguser
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Embedding Configuration
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
EMBEDDING_BACKEND=sentence-transformers
CHUNK_SIZE=512
CHUNK_OVERLAP=50

# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3.1:70b
LLM_TEMPERATURE=0.3
LLM_TIMEOUT=300

# Search Configuration
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.7

# Project Configuration
PROJECT_NAME=rag-bootstrap-prod
EOF

# Restrict permissions
chmod 600 .env
```

#### 1.2 Disk Space Allocation
```bash
# Create data directory structure
mkdir -p data/{docker/postgres,docker/redis,cache/embeddings,logs,exports,registry}

# Allocate space (example: 200GB)
# Option A: Separate partition
sudo mount -t tmpfs -o size=200G tmpfs /mnt/rag-data

# Option B: LVM logical volume
sudo lvcreate -L 200G -n rag-data vg0
sudo mkfs.ext4 /dev/vg0/rag-data
sudo mount /dev/vg0/rag-data /srv/rag-bootstrap/data

# Verify allocation
df -h /srv/rag-bootstrap/data
```

#### 1.3 Database Preparation
```bash
# Pre-create database volumes with proper permissions
sudo mkdir -p /var/lib/rag-bootstrap/postgres
sudo mkdir -p /var/lib/rag-bootstrap/redis

# Set ownership (if running as specific user)
sudo chown 999:999 /var/lib/rag-bootstrap/postgres
sudo chown 999:999 /var/lib/rag-bootstrap/redis

# Set appropriate permissions
sudo chmod 700 /var/lib/rag-bootstrap/postgres
sudo chmod 700 /var/lib/rag-bootstrap/redis
```

### Phase 2: Service Deployment (45 min)

#### 2.1 Prepare Docker Compose
```bash
# Use multi-KB compose file for production
cp docker-compose.multi-kb.yml docker-compose.prod.yml

# Edit for production (increase limits, add logging)
cat >> docker-compose.prod.yml << 'EOF'

# Add to api service:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

# Add to postgres service:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

# Add monitoring service (optional):
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - rag-net
EOF
```

#### 2.2 Deploy Services
```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services in background
docker-compose -f docker-compose.prod.yml up -d

# Monitor startup progress
docker-compose -f docker-compose.prod.yml logs -f

# Wait for services to be healthy
docker-compose -f docker-compose.prod.yml ps
# All services should show "Up" status
```

#### 2.3 Verify Service Health
```bash
# Check API health
curl -v http://localhost:8100/api/v2/health

# Check database connectivity
docker-compose exec api python -c "
from app.database import engine
import asyncio
async def test():
    async with engine.begin() as conn:
        result = await conn.execute('SELECT 1')
        print('Database OK')
asyncio.run(test())
"

# Check Redis connectivity
docker-compose exec redis redis-cli ping
# Should respond: PONG

# Check Ollama connectivity
curl http://localhost:11434/api/tags
# Should list available models
```

### Phase 3: Initial Configuration (30 min)

#### 3.1 Load Documents
```bash
# Place documents in configured volume
cp /path/to/documents/* /srv/rag-bootstrap/data/documents/

# Ingest documents via API
curl -X POST http://localhost:8100/api/v2/ingest \
  -F "file=@document.pdf" \
  -F "kb_name=primary"

# Or via command line
docker-compose exec api python -m app.ingestion \
  --input-dir /data/documents \
  --kb-name primary \
  --batch-size 10
```

#### 3.2 Configure Knowledge Bases
```bash
# Create primary KB
curl -X POST http://localhost:8100/api/v2/kbs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "primary",
    "description": "Main knowledge base",
    "search_mode": "hybrid",
    "chunk_size": 512
  }'

# Create backup KB (for redundancy)
curl -X POST http://localhost:8100/api/v2/kbs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "secondary",
    "description": "Backup knowledge base",
    "search_mode": "semantic"
  }'
```

#### 3.3 Validate Configuration
```bash
# List all KBs
curl http://localhost:8100/api/v2/kbs

# Check indexing status
curl http://localhost:8100/api/v2/kbs/primary/status

# Sample search query
curl -X POST http://localhost:8100/api/v2/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "kb_name": "primary",
    "mode": "hybrid",
    "top_k": 5
  }'
```

### Phase 4: Proxy Configuration (30 min)

#### 4.1 Setup Nginx Reverse Proxy
```bash
# Create nginx configuration
sudo tee /etc/nginx/sites-available/rag-bootstrap > /dev/null << 'EOF'
upstream rag_backend {
    server localhost:8100;
}

server {
    listen 443 ssl http2;
    server_name rag.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rag.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rag.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Proxy Configuration
    location / {
        proxy_pass http://rag_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://rag_backend;
    }
}

server {
    listen 80;
    server_name rag.example.com;
    return 301 https://$server_name$request_uri;
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/rag-bootstrap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.2 Setup Auth Proxy (Example: OAuth2-Proxy)
```bash
# Install oauth2-proxy
curl -sL https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v7.4.0/oauth2-proxy-v7.4.0.linux-amd64.tar.gz | tar xz

# Create configuration
cat > oauth2-proxy.cfg << 'EOF'
http_address = "127.0.0.1:4180"
upstream = "http://localhost:8100"

provider = "oidc"
oidc_issuer_url = "https://your-auth-provider.com"
client_id = "your-client-id"
client_secret = "your-client-secret"

cookie_secret = "$(openssl rand -base64 32)"
cookie_secure = true
cookie_httponly = true
cookie_samesite = "Lax"

email_domains = ["*"]
authenticated_emails_file = "/etc/oauth2-proxy/allowed-emails.txt"
EOF

# Start proxy
./oauth2-proxy -c oauth2-proxy.cfg
```

---

## Operational Procedures

### Monitoring

#### Health Check Dashboard
```bash
#!/bin/bash
# Monitor all services in real-time

watch -n 5 'echo "=== RAG Bootstrap Status ===" && \
docker-compose ps && \
echo "" && \
echo "API Health:" && \
curl -s http://localhost:8100/api/v2/health | jq . && \
echo "" && \
echo "Database Status:" && \
docker-compose exec -T postgres pg_isready -U raguser && \
echo "" && \
echo "Redis Status:" && \
docker-compose exec -T redis redis-cli ping'
```

#### Log Monitoring
```bash
# Tail all service logs
docker-compose logs -f --tail=100

# Tail specific service
docker-compose logs -f api

# Search for errors
docker-compose logs | grep -i error

# Export logs for analysis
docker-compose logs > logs/rag-bootstrap-$(date +%Y%m%d-%H%M%S).log
```

### Performance Monitoring

#### CPU and Memory
```bash
# Real-time resource usage
docker stats

# Generate report
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" > resources.csv
```

#### Database Performance
```bash
# Connect to database
docker-compose exec postgres psql -U raguser -d ragdb

# Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check query performance
EXPLAIN ANALYZE SELECT * FROM documents WHERE embedding <-> query_vector LIMIT 5;

# Monitor active queries
SELECT pid, query, state FROM pg_stat_activity;
```

#### API Metrics
```bash
# Access count by endpoint
curl http://localhost:8100/metrics | grep -i request_count

# Response time distribution
curl http://localhost:8100/metrics | grep -i request_duration

# Error rate
curl http://localhost:8100/metrics | grep -i request_errors
```

### Backup & Recovery

#### Automated Backups
```bash
#!/bin/bash
# Daily backup script (cron: 2 AM daily)

BACKUP_DIR="/srv/rag-bootstrap/backups"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

# Backup database
docker-compose exec -T postgres pg_dump -U raguser ragdb | \
  gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup Redis data
docker-compose exec -T redis redis-cli BGSAVE
cp /var/lib/rag-bootstrap/redis/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"

# Backup documents
tar czf "$BACKUP_DIR/documents-$DATE.tar.gz" /srv/rag-bootstrap/data/documents/

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "Backup completed at $(date)" >> "$BACKUP_DIR/backup.log"
```

#### Restore Procedure
```bash
#!/bin/bash
# Restore from backup

BACKUP_DIR="/srv/rag-bootstrap/backups"
RESTORE_DATE="20260506-143000"  # Adjust to desired backup

echo "Stopping services..."
docker-compose down

echo "Restoring database..."
gunzip < "$BACKUP_DIR/db-$RESTORE_DATE.sql.gz" | \
  docker-compose exec -T postgres psql -U raguser ragdb

echo "Restoring Redis..."
cp "$BACKUP_DIR/redis-$RESTORE_DATE.rdb" /var/lib/rag-bootstrap/redis/dump.rdb

echo "Restoring documents..."
cd /srv/rag-bootstrap/data
tar xzf "$BACKUP_DIR/documents-$RESTORE_DATE.tar.gz"

echo "Starting services..."
docker-compose up -d

echo "Restore completed. Verify health:"
curl http://localhost:8100/api/v2/health
```

### Scaling Operations

#### Horizontal Scaling (Multiple API Instances)
```bash
# Update docker-compose to have multiple API replicas
services:
  api:
    deploy:
      replicas: 3

  api-2:
    extends: api
    container_name: rag-bootstrap-api-2

  api-3:
    extends: api
    container_name: rag-bootstrap-api-3

# Update nginx upstream to include all replicas
upstream rag_backend {
    server rag-bootstrap-api:8000;
    server rag-bootstrap-api-2:8000;
    server rag-bootstrap-api-3:8000;
}

# Deploy
docker-compose up -d
```

#### Vertical Scaling (Larger Containers)
```yaml
# In docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '8'      # Increase from 4
          memory: 16G    # Increase from 8G
```

### Incident Response

#### Service Failure Recovery
```bash
#!/bin/bash
# Automatic recovery script

SERVICE=${1:-api}

echo "Checking $SERVICE health..."
if ! curl -f http://localhost:8100/api/v2/health > /dev/null 2>&1; then
    echo "Service unhealthy. Restarting..."
    docker-compose restart $SERVICE

    # Wait for recovery
    sleep 10

    # Verify recovery
    if curl -f http://localhost:8100/api/v2/health > /dev/null 2>&1; then
        echo "✓ Service recovered"
    else
        echo "✗ Service still failing. Manual intervention needed."
        echo "Logs:"
        docker-compose logs $SERVICE | tail -20
    fi
fi
```

#### Database Corruption Recovery
```bash
# 1. Identify corruption
docker-compose exec postgres psql -U raguser -d ragdb -c \
  "SELECT * FROM pg_database_corruption_report();"

# 2. Backup remaining valid data
docker-compose exec postgres pg_dump -U raguser ragdb > backup-corrupted.sql

# 3. Drop and recreate database
docker-compose exec postgres psql -U raguser -d postgres -c \
  "DROP DATABASE ragdb;"
docker-compose exec postgres psql -U raguser -d postgres -c \
  "CREATE DATABASE ragdb;"

# 4. Restore from latest good backup
gunzip < backups/db-20260505-020000.sql.gz | \
  docker-compose exec -T postgres psql -U raguser ragdb

# 5. Verify data integrity
docker-compose exec postgres psql -U raguser -d ragdb -c \
  "SELECT COUNT(*) FROM documents;"
```

---

## Troubleshooting Guide

### Issue: Services Won't Start
```bash
# Check Docker daemon
sudo systemctl status docker
sudo systemctl start docker

# Check available ports
sudo netstat -tuln | grep -E ':(8100|5432|6379)'

# Check disk space
df -h

# Check docker-compose syntax
docker-compose config

# View detailed logs
docker-compose up --no-detach  # Run in foreground to see errors
```

### Issue: API Responding Slowly
```bash
# Check resource usage
docker stats

# Check database performance
docker-compose exec postgres psql -U raguser -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check query cache hit rate
docker-compose exec redis redis-cli INFO stats | grep hits

# Increase resource limits in docker-compose.prod.yml
# Then: docker-compose up -d --no-deps --build api
```

### Issue: Database Connection Errors
```bash
# Check postgres service
docker-compose logs postgres

# Verify connectivity from API
docker-compose exec api python -c \
  "import psycopg2; psycopg2.connect('dbname=ragdb user=raguser password=ragpass host=postgres')"

# Check connection pool
docker-compose exec postgres psql -U raguser -c \
  "SELECT count(*) as active_connections FROM pg_stat_activity;"

# Increase max connections if needed
docker-compose exec postgres psql -U raguser -c \
  "ALTER SYSTEM SET max_connections = 400; SELECT pg_reload_conf();"
```

### Issue: Memory Leak / Continuously Growing Memory
```bash
# Monitor memory over time
watch -n 5 'docker stats --no-stream'

# Check for memory leaks in code
docker-compose logs api | grep -i "memory"

# Restart problematic service
docker-compose restart api

# Increase swap space if needed
sudo fallocate -l 10G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Disaster Recovery Plan

### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: 30 minutes
- **RPO (Recovery Point Objective)**: 1 hour

### Disaster Scenarios

#### Scenario 1: Single Service Failure
- **Time to Fix**: 1-5 minutes
- **Impact**: No impact (auto-restart by Docker)
- **Action**: Monitor logs, no manual intervention usually needed

#### Scenario 2: Database Corruption
- **Time to Fix**: 15-30 minutes
- **Impact**: High (data loss possible)
- **Action**: Restore from latest backup, re-ingest if needed

#### Scenario 3: Complete Infrastructure Failure
- **Time to Fix**: 30-60 minutes
- **Impact**: Complete downtime
- **Action**:
  1. Deploy to backup infrastructure
  2. Restore databases from backups
  3. Update DNS/load balancer
  4. Verify all services

#### Scenario 4: Ransomware / Data Corruption
- **Time to Fix**: 2-4 hours
- **Impact**: Severe
- **Action**:
  1. Isolate all systems (disconnect from network)
  2. Restore from offline backups
  3. Verify integrity before bringing online
  4. Security audit

---

## Maintenance Windows

### Weekly (Every Monday 2 AM)
- Database optimization (VACUUM, ANALYZE)
- Index maintenance
- Log rotation

### Monthly (First Sunday 1 AM)
- Full backup verification (restore to test system)
- Security updates
- Performance tuning review

### Quarterly (First of each quarter)
- Disaster recovery drill
- Capacity planning review
- Architecture assessment

---

## Contact & Escalation

### Support Levels
1. **Level 1 - Operational Issues**
   - Services down, connectivity problems
   - Escalate: Immediately to on-call SRE

2. **Level 2 - Performance Issues**
   - Slow responses, high resource usage
   - Escalate: After 30 min if unresolved

3. **Level 3 - Data Issues**
   - Corruption, loss, inconsistency
   - Escalate: Immediately to DBA + Security

### Emergency Contacts
- **On-call SRE**: +1-xxx-xxx-xxxx (Slack: @sre-oncall)
- **DBA**: +1-xxx-xxx-xxxx (Slack: @dba)
- **Security**: security@company.com

---

## Sign-Off

This runbook should be reviewed and updated:
- After every major incident
- After every infrastructure change
- Quarterly minimum

**Prepared By**: RAG Bootstrap Operations
**Version**: 1.0
**Date**: 2026-05-06
**Review Date**: 2026-06-06
