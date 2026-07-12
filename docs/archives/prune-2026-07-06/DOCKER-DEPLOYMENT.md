# Docker Deployment Guide - Basset Hound Browser v12.7.0

## Overview

This guide covers Docker deployment of Basset Hound Browser, including multi-stage builds, health checks, resource limits, and production-ready configurations.

**Key Features:**
- Multi-stage Docker builds for minimal image size (<1GB target)
- Security hardening with non-root user and capability dropping
- Health checks and monitoring
- Resource limits and memory optimization
- Compose configuration for orchestration
- Comprehensive deployment scripts

## Quick Start

### 1. Build the Image

```bash
# Build with default tag (12.7.0)
./scripts/docker-build.sh

# Build with specific tag
./scripts/docker-build.sh latest

# Build without cache (clean rebuild)
./scripts/docker-build.sh 12.7.0 --no-cache
```

### 2. Run the Container

```bash
# Run with defaults
./scripts/docker-run.sh

# Run on custom WebSocket port
./scripts/docker-run.sh --port 9000

# Run with custom environment
./scripts/docker-run.sh --env .env.production

# Run in foreground with logs
./scripts/docker-run.sh --interactive
```

### 3. Check Health Status

```bash
# Basic health check
./scripts/docker-health-check.sh

# Verbose output
./scripts/docker-health-check.sh -v

# Continuous monitoring
./scripts/docker-health-check.sh -w
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
# Edit .env with your settings
docker-compose --env-file .env up -d
```

**Key Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node.js environment |
| `LOG_LEVEL` | info | Logging verbosity (error, warn, info, debug) |
| `WS_PORT` | 8765 | WebSocket API port |
| `SCREEN_RESOLUTION` | 1920x1080x24 | Virtual display size |
| `USE_SYSTEM_TOR` | true | Enable Tor network |
| `CONTAINER_CPU_LIMIT` | 2.0 | CPU cores limit |
| `CONTAINER_MEMORY_LIMIT` | 2G | Memory limit |
| `NODE_MAX_MEMORY` | 2048 | Node.js max heap (MB) |

### Docker Compose

#### Development Setup

```bash
# Start with development compose file
docker-compose up -d

# View logs
docker-compose logs -f basset-hound-browser

# Stop
docker-compose down
```

#### Production Setup

```bash
# Build and run
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Scale resources
docker-compose up -d --scale basset-hound-browser=3  # Multiple instances
```

## Image Details

### Build Stages

**Stage 1: Dependencies**
- Node.js 20 + build tools
- Installs production dependencies only
- Caches npm packages

**Stage 2: Builder**
- Compiles native modules (sharp, etc.)
- ~200MB intermediate image

**Stage 3: Runtime Base**
- Slim Node.js + Chromium libraries
- Tor + Xvfb for display

**Stage 4: Production**
- Copies compiled modules
- Creates non-root user
- Hardened security config

### Image Size

Target: **<1GB**

Typical breakdown:
- Node.js base: 200MB
- System libraries: 400MB
- node_modules: 250-300MB
- Application code: 50MB
- **Total: ~850-950MB**

### Security Features

✓ Non-root user (UID 1001)  
✓ Dropped capabilities (CAP_DROP: ALL)  
✓ SYS_ADMIN only for Electron  
✓ Read-only root filesystem (optional)  
✓ No-new-privileges security option  
✓ Health checks for container liveness

## Resource Management

### CPU Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'           # Hard limit
    reservations:
      cpus: '0.5'          # Guaranteed minimum
```

### Memory Limits

```yaml
deploy:
  resources:
    limits:
      memory: 2G            # Hard limit
    reservations:
      memory: 512M         # Guaranteed minimum
```

**Recommendations:**
- **Small workloads**: 1 CPU, 512MB memory
- **Standard workloads**: 2 CPUs, 2GB memory
- **High-concurrency**: 4 CPUs, 4GB memory

## Health Checks

### Health Check Configuration

```yaml
healthcheck:
  test: ["CMD", "/app/health-check.sh"]
  interval: 30s           # Check every 30 seconds
  timeout: 10s            # Timeout after 10 seconds
  retries: 3              # Fail after 3 failed checks
  start_period: 40s       # Grace period before first check
```

### Manual Health Checks

```bash
# Check container health
docker inspect basset-hound-browser --format='{{.State.Health.Status}}'

# View health check log
docker inspect basset-hound-browser --format='{{.State.Health.Log}}'

# Test WebSocket endpoint
curl -i http://localhost:8765/

# Using nc (netcat)
echo > /dev/tcp/localhost/8765 && echo "WebSocket port OK" || echo "Port unreachable"
```

## Logging

### Container Logs

```bash
# View logs
docker logs basset-hound-browser

# Follow logs
docker logs -f basset-hound-browser

# Last 100 lines
docker logs basset-hound-browser --tail 100

# With timestamps
docker logs -t basset-hound-browser
```

### Log Rotation

Configured in docker-compose.yml:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"       # Rotate at 10MB
    max-file: "10"        # Keep 10 rotated files
```

### Application Logs

```bash
# Inside container
docker exec basset-hound-browser tail -f /app/logs/basset-hound.log

# Copy logs to host
docker cp basset-hound-browser:/app/logs ./logs/
```

## Deployment Scenarios

### Single Container (Development)

```bash
./scripts/docker-run.sh --interactive
```

### Docker Compose (Production)

```bash
# Copy environment
cp .env.example .env

# Start services
docker-compose up -d

# Scale if needed
docker-compose up -d --scale basset-hound-browser=3
```

### Kubernetes (Enterprise)

See `infrastructure/kubernetes/` for Helm charts and manifests.

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy service
docker stack deploy -c docker-compose.yml basset-hound

# View status
docker service ls
docker service ps basset-hound_basset-hound-browser
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs basset-hound-browser

# Check status
docker ps -a | grep basset

# Inspect container
docker inspect basset-hound-browser

# Run with verbose logging
LOG_LEVEL=debug docker-compose up
```

### Health Check Failing

```bash
# Manual health check
docker exec basset-hound-browser /app/health-check.sh

# Test WebSocket
docker exec basset-hound-browser curl -v http://localhost:8765/

# Check Tor status
docker exec basset-hound-browser ps aux | grep tor
```

### High Memory Usage

```bash
# Check memory stats
docker stats basset-hound-browser

# Reduce Node.js heap
docker run -e NODE_MAX_MEMORY=1024 ...

# Monitor over time
watch -n 5 'docker stats --no-stream basset-hound-browser'
```

### Network/Port Issues

```bash
# Check exposed ports
docker port basset-hound-browser

# Test port on host
telnet localhost 8765

# Check container network
docker inspect basset-hound-browser --format='{{.NetworkSettings.Networks}}'

# Restart container with port mapping
docker stop basset-hound-browser
docker rm basset-hound-browser
docker-compose up -d
```

## Performance Optimization

### Image Build Performance

1. **Use .dockerignore** - Excludes 200+ MB from build context
2. **Multi-stage caching** - Dependencies cached separately
3. **Layer caching** - npm packages cached across rebuilds

```bash
# Rebuild with cache (fast)
./scripts/docker-build.sh

# Rebuild without cache (slow, clean)
./scripts/docker-build.sh 12.7.0 --no-cache
```

### Runtime Performance

1. **Memory limit tuning** - Set `NODE_MAX_MEMORY` appropriately
2. **CPU limits** - Prevent resource starvation
3. **Volume optimization** - Use named volumes instead of bind mounts

### Monitoring Performance

```bash
# Real-time stats
docker stats basset-hound-browser

# Detailed metrics
docker inspect basset-hound-browser --format='{{json .}}' | jq .

# Network traffic
docker stats --no-stream --format='table {{.Container}}\t{{.NetIO}}'
```

## Security Best Practices

### Secrets Management

```bash
# Create Docker secret
echo "your-ws-token" | docker secret create basset_ws_token -

# Use in compose
secrets:
  basset_ws_token:
    external: true
```

### SSL/TLS Configuration

```bash
# Generate certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Pass to container
docker run -e BASSET_WS_SSL_ENABLED=true \
  -v ./cert.pem:/run/secrets/server_cert \
  -v ./key.pem:/run/secrets/server_key \
  basset-hound-browser:12.7.0
```

### Image Scanning

```bash
# Scan for vulnerabilities
docker scan basset-hound-browser:12.7.0

# Use Trivy
trivy image basset-hound-browser:12.7.0
```

## Maintenance

### Clean Up

```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup
docker system prune -a
```

### Backup

```bash
# Backup data volume
docker run --rm -v basset-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/basset-data.tar.gz -C / data

# Restore
docker run --rm -v basset-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/basset-data.tar.gz -C /
```

### Update/Rollback

```bash
# Build new version
./scripts/docker-build.sh 12.8.0

# Test new version
./scripts/docker-run.sh --name basset-hound-test --port 9000

# Rollback to previous version
docker stop basset-hound-browser
docker rm basset-hound-browser
docker run basset-hound-browser:12.7.0
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Docker Image: basset-hound-browser:12.7.0 (~850-950MB)  │
├─────────────────────────────────────────────────────────┤
│ FROM node:20-bullseye-slim (Stage 4: Production)        │
│ ├─ Non-root user: basset:1001                           │
│ ├─ Capabilities: SYS_ADMIN only                         │
│ ├─ Health check: /app/health-check.sh                   │
│ └─ Entrypoint: /app/entrypoint.sh                       │
├─────────────────────────────────────────────────────────┤
│ Services                                                 │
│ ├─ WebSocket API (port 8765)                           │
│ ├─ Xvfb virtual display (:99)                          │
│ └─ Tor daemon (SOCKS 9050, control 9051)               │
├─────────────────────────────────────────────────────────┤
│ Volumes                                                  │
│ ├─ /app/data              → basset-data                │
│ ├─ /app/logs              → basset-logs                │
│ ├─ /app/screenshots       → basset-screenshots         │
│ ├─ /app/downloads         → basset-downloads           │
│ └─ /app/recordings        → basset-recordings          │
├─────────────────────────────────────────────────────────┤
│ Resource Limits                                          │
│ ├─ CPU: 2.0 cores (limit), 0.5 cores (reserved)       │
│ └─ Memory: 2GB (limit), 512MB (reserved)               │
└─────────────────────────────────────────────────────────┘
```

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Specification](https://github.com/compose-spec/compose-spec)
- [Electron in Docker](https://www.electronjs.org/docs/tutorial/linux#docker)
- [Container Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

## Support

For issues or questions:

1. Check logs: `docker logs basset-hound-browser`
2. Run health check: `./scripts/docker-health-check.sh -v`
3. Review this guide's Troubleshooting section
4. Contact the Basset Hound team
