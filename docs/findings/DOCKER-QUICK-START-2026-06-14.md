# Docker Quick Start Guide - Basset Hound Browser
**Version:** 1.0  
**Date:** June 14, 2026  
**Status:** Ready to use

---

## 5-Minute Setup

### Single Container (Recommended for Development)

```bash
# 1. Build (first time, ~6 minutes)
cd /home/devel/basset-hound-browser
docker build -t basset-hound-browser:latest config/docker/

# 2. Run
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  -e DISPLAY=:99 \
  basset-hound-browser:latest

# 3. Test (should return 426)
sleep 5 && curl -w "\n" http://localhost:8765
```

**Done!** Browser API available at: `ws://localhost:8765`

### Cleanup

```bash
docker stop basset-hound-browser
docker rm basset-hound-browser
```

---

## Full Setup with Monitoring

### Using Docker Compose Network (5-10 minutes)

1. **Create compose file** (`config/docker/docker-compose.monitoring.yml`):

```yaml
version: '3.8'

services:
  basset-browser:
    build:
      context: ../../
      dockerfile: config/docker/Dockerfile
    container_name: basset-hound-browser
    networks:
      - basset-hound
    ports:
      - "8765:8765"
    environment:
      - DISPLAY=:99
      - ELECTRON_DISABLE_SANDBOX=1
    volumes:
      - basset-data:/app/data
      - basset-screenshots:/app/screenshots
      - basset-downloads:/app/downloads
    cap_drop:
      - ALL
    cap_add:
      - SYS_ADMIN
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  prometheus:
    image: prom/prometheus:latest
    container_name: basset-prometheus
    networks:
      - basset-hound
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: basset-grafana
    networks:
      - basset-hound
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: basset-exporter
    networks:
      - basset-hound
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - "--path.procfs=/host/proc"
      - "--path.sysfs=/host/sys"
      - "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)"
    restart: unless-stopped

volumes:
  basset-data:
  basset-screenshots:
  basset-downloads:
  prometheus-data:
  grafana-data:

networks:
  basset-hound:
    driver: bridge
```

2. **Create Prometheus config** (`config/docker/config/prometheus.yml`):

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']
```

3. **Start everything**:

```bash
docker-compose -f config/docker/docker-compose.monitoring.yml up -d
```

4. **Access services**:
   - Browser API: `ws://localhost:8765`
   - Prometheus: `http://localhost:9090`
   - Grafana: `http://localhost:3000` (admin/admin)

5. **Cleanup**:

```bash
docker-compose -f config/docker/docker-compose.monitoring.yml down -v
```

---

## Common Tasks

### View Logs

```bash
# Single container
docker logs -f basset-hound-browser

# Docker Compose
docker-compose logs -f basset-browser
```

### Access Container Shell

```bash
docker exec -it basset-hound-browser /bin/bash
```

### Monitor Resources

```bash
docker stats basset-hound-browser --no-stream
```

### Run Tests

```bash
# Inside container
docker exec basset-hound-browser npm run test:unit

# Or include in docker run
docker run --rm basset-hound-browser npm run test:unit
```

### Restart Container

```bash
docker restart basset-hound-browser
```

### Update Configuration

```bash
# Mount config volumes
docker run -d \
  -v $(pwd)/config/custom.json:/app/config.json:ro \
  ...
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 8765
lsof -i :8765

# Kill process (if needed)
kill -9 <PID>

# Or use different port
docker run -p 8766:8765 ...
```

### Container Exits Immediately

```bash
# Check error logs
docker logs basset-hound-browser

# Common issues:
# - Xvfb startup failure
# - Tor initialization error
# - Display already in use

# Try debug mode
docker run -it basset-hound-browser /bin/bash
```

### Health Check Failing

```bash
# Manual health check
docker exec basset-hound-browser curl -v http://localhost:8765

# Expected response: 426 Upgrade Required
# If fails, increase startup time or check logs
```

### High Memory Usage

```bash
# Check memory
docker stats basset-hound-browser

# Reduce limit
docker update --memory="1.5g" basset-hound-browser

# Or restart
docker restart basset-hound-browser
```

---

## Performance Tips

1. **Pre-build image before heavy testing:**
   ```bash
   docker build -t basset-hound-browser:latest config/docker/
   ```

2. **Use --no-cache only when necessary:**
   ```bash
   docker build --no-cache ...
   ```

3. **Monitor during use:**
   ```bash
   docker stats basset-hound-browser
   ```

4. **Clean up old images:**
   ```bash
   docker image prune
   docker volume prune
   ```

5. **Use resource limits to prevent system slowdown:**
   ```bash
   docker run --memory="2g" --cpus="2" ...
   ```

---

## Next Steps

1. Read `DOCKER-DEPLOYMENT-STRATEGY-2026-06-14.md` for full documentation
2. Implement monitoring setup for production
3. Set up CI/CD integration
4. Configure log aggregation (optional)

**For help:** Check logs with `docker logs <container_name>`
