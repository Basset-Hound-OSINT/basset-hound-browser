# Deployment & Operations Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 40 minutes

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Docker Deployment](#docker-deployment)
4. [Configuration](#configuration)
5. [Health Checks](#health-checks)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)

---

## Overview

### Architecture

```
┌──────────────────────────────────────────┐
│        Client Applications               │
│  (Python SDK, JavaScript, Custom)        │
└────────────────┬─────────────────────────┘
                 │ WebSocket (port 8765)
                 │
┌────────────────▼─────────────────────────┐
│    Basset Hound Browser Container        │
├──────────────────────────────────────────┤
│  WebSocket Server (port 8765)            │
│  ├─ Message Router                       │
│  ├─ Command Handlers                     │
│  ├─ Session Manager                      │
│  └─ Error Recovery                       │
│                                          │
│  Electron Browser Engine                 │
│  ├─ Chromium Browser                     │
│  ├─ Profile Manager                      │
│  └─ Storage (cookies, cache, etc.)       │
│                                          │
│  Services                                │
│  ├─ Screenshot Manager                   │
│  ├─ Proxy Manager                        │
│  ├─ Evasion Engine                       │
│  ├─ Technology Detector                  │
│  ├─ Monitoring Service                   │
│  └─ Session Persistence                  │
│                                          │
│  Storage                                 │
│  ├─ File System (profiles, screenshots)  │
│  ├─ SQLite (monitoring data)             │
│  └─ Memory Cache                         │
└──────────────────────────────────────────┘
```

---

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **Memory**: 2 GB RAM
- **Disk**: 20 GB (for screenshots and cache)
- **Network**: 1 Mbps connection
- **OS**: Linux (Ubuntu 20.04+), macOS 10.15+, Windows 10+

### Recommended Requirements

- **CPU**: 4+ cores
- **Memory**: 4-8 GB RAM
- **Disk**: 50+ GB SSD (better performance)
- **Network**: 10+ Mbps
- **GPU**: Optional (accelerates rendering)

### Development Environment

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  curl \
  wget \
  git \
  build-essential \
  libssl-dev \
  docker.io \
  docker-compose

# macOS
brew install curl wget git docker
brew services start docker

# Verify installation
docker --version
```

---

## Docker Deployment

### Build Image

#### From Repository

```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
docker build -t basset-hound:12.2.0 .
```

#### Build Options

```bash
# With custom tag
docker build -t myregistry/basset-hound:12.2.0 .

# With build arguments
docker build \
  --build-arg NODE_ENV=production \
  --build-arg VERSION=12.2.0 \
  -t basset-hound:12.2.0 .

# Multi-stage build (smaller image)
docker build -f Dockerfile.multi -t basset-hound:12.2.0 .
```

### Run Container

#### Basic Run

```bash
docker run \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound:12.2.0
```

#### With Volume Mounts

```bash
docker run \
  --name basset-hound \
  -p 8765:8765 \
  -v /opt/basset-hound/profiles:/app/profiles \
  -v /opt/basset-hound/screenshots:/app/screenshots \
  basset-hound:12.2.0
```

#### With Environment Variables

```bash
docker run \
  --name basset-hound \
  -p 8765:8765 \
  -e LOG_LEVEL=debug \
  -e MAX_CONCURRENT_SESSIONS=10 \
  -e SCREENSHOT_COMPRESSION=true \
  basset-hound:12.2.0
```

#### Full Production Example

```bash
docker run \
  --name basset-hound-prod \
  --restart always \
  -p 8765:8765 \
  -v /opt/basset-hound/profiles:/app/profiles \
  -v /opt/basset-hound/screenshots:/app/screenshots \
  -v /opt/basset-hound/logs:/app/logs \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e MAX_CONCURRENT_SESSIONS=50 \
  -e MEMORY_LIMIT=4096 \
  -e SCREENSHOT_FORMAT=webp \
  -e COMPRESSION_ENABLED=true \
  --memory=4g \
  --cpus=2.0 \
  basset-hound:12.2.0
```

### Docker Compose

#### Single Instance

```yaml
version: '3.8'

services:
  basset-hound:
    image: basset-hound:12.2.0
    container_name: basset-hound
    ports:
      - "8765:8765"
    volumes:
      - ./profiles:/app/profiles
      - ./screenshots:/app/screenshots
      - ./logs:/app/logs
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      MAX_CONCURRENT_SESSIONS: 10
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - basset-hound

networks:
  basset-hound:
    driver: bridge
```

#### With Load Balancer

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:latest
    container_name: basset-hound-lb
    ports:
      - "8765:8765"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - basset-hound-1
      - basset-hound-2
      - basset-hound-3
    networks:
      - basset-hound

  basset-hound-1:
    image: basset-hound:12.2.0
    environment:
      NODE_ENV: production
      INSTANCE_ID: bh-1
    volumes:
      - ./profiles:/app/profiles
      - ./screenshots:/app/screenshots
    networks:
      - basset-hound

  basset-hound-2:
    image: basset-hound:12.2.0
    environment:
      NODE_ENV: production
      INSTANCE_ID: bh-2
    volumes:
      - ./profiles:/app/profiles
      - ./screenshots:/app/screenshots
    networks:
      - basset-hound

  basset-hound-3:
    image: basset-hound:12.2.0
    environment:
      NODE_ENV: production
      INSTANCE_ID: bh-3
    volumes:
      - ./profiles:/app/profiles
      - ./screenshots:/app/screenshots
    networks:
      - basset-hound

networks:
  basset-hound:
```

---

## Configuration

### Environment Variables

#### WebSocket Server

```bash
# Port
WEBSOCKET_PORT=8765

# TLS/SSL
WEBSOCKET_SSL=false
WEBSOCKET_CERT=/path/to/cert.pem
WEBSOCKET_KEY=/path/to/key.pem

# Authentication
AUTH_ENABLED=false
AUTH_TOKEN=your-secret-token

# CORS
CORS_ORIGIN="*"
```

#### Browser Engine

```bash
# Headless mode (true = no UI)
HEADLESS=true

# Chromium binary path
CHROMIUM_PATH=/usr/bin/chromium

# Sandbox
SANDBOX=true

# User data directory
USER_DATA_DIR=/app/profiles

# Disable GPU
DISABLE_GPU=true
```

#### Performance

```bash
# Maximum concurrent sessions
MAX_CONCURRENT_SESSIONS=10

# Screenshot compression
SCREENSHOT_COMPRESSION=true
SCREENSHOT_FORMAT=webp  # png, jpeg, webp

# Memory limit (MB)
MEMORY_LIMIT=4096

# Cache size (MB)
CACHE_SIZE=512

# Timeout defaults (ms)
DEFAULT_TIMEOUT=30000
NAVIGATION_TIMEOUT=30000
```

#### Logging

```bash
# Log level: error, warn, info, debug, trace
LOG_LEVEL=info

# Log file
LOG_FILE=/app/logs/basset-hound.log

# Log format: simple, json, pretty
LOG_FORMAT=json

# Max log size (MB)
LOG_MAX_SIZE=100

# Keep logs (days)
LOG_RETENTION_DAYS=7
```

#### Features

```bash
# TOR support
TOR_MODE=off  # off, on, auto

# Monitoring service
MONITORING_ENABLED=true

# Session persistence
SESSION_PERSISTENCE_ENABLED=true

# Technology detection
TECH_DETECTION_ENABLED=true
```

### Configuration File

```yaml
# config.yaml
server:
  port: 8765
  ssl: false

browser:
  headless: true
  sandbox: true
  disableGpu: true

performance:
  maxConcurrentSessions: 10
  screenshotCompression: true
  memoryLimit: 4096

logging:
  level: info
  format: json
  maxSize: 100

features:
  monitoringService: true
  sessionPersistence: true
  technologyDetection: true
```

---

## Health Checks

### Endpoint: `/health`

```bash
curl http://localhost:8765/health
```

**Response**:
```json
{
  "status": "healthy",
  "version": "12.2.0",
  "uptime": 3600000,
  "timestamp": "2026-06-01T12:00:00Z",
  "checks": {
    "websocket": "ok",
    "browser": "ok",
    "storage": "ok",
    "memory": "ok"
  },
  "metrics": {
    "activeSessions": 2,
    "totalRequests": 1524,
    "averageLatency": 45,
    "memoryUsage": 512,
    "cpuUsage": 18.5
  }
}
```

### Kubernetes Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: basset-hound
spec:
  containers:
  - name: basset-hound
    image: basset-hound:12.2.0
    livenessProbe:
      httpGet:
        path: /health
        port: 8765
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /health
        port: 8765
      initialDelaySeconds: 10
      periodSeconds: 5
    startupProbe:
      httpGet:
        path: /health
        port: 8765
      failureThreshold: 30
      periodSeconds: 10
```

---

## Monitoring

### Prometheus Metrics

Metrics available at `http://localhost:8765/metrics`

```
# Request metrics
basset_requests_total{command="navigate"} 1250
basset_request_duration_ms{command="navigate"} 450
basset_request_errors_total{command="navigate"} 5

# Session metrics
basset_active_sessions 2
basset_sessions_created_total 150
basset_sessions_failed_total 3

# Performance metrics
basset_memory_usage_bytes 536870912
basset_cpu_usage_percent 18.5

# Browser metrics
basset_browser_pages_total 45
basset_browser_tabs_active 3
```

### Example Prometheus Config

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'basset-hound'
    static_configs:
      - targets: ['localhost:8765']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import dashboard from:
```
https://grafana.com/grafana/dashboards/basset-hound
```

Or create custom dashboard with queries:
```
# Active sessions
basset_active_sessions

# Request latency (95th percentile)
histogram_quantile(0.95, basset_request_duration_ms)

# Error rate
rate(basset_request_errors_total[5m])

# Memory usage
basset_memory_usage_bytes

# CPU usage
basset_cpu_usage_percent
```

---

## Troubleshooting

### Container Won't Start

**Error**: `docker: Error response from daemon: OCI runtime create failed`

**Solutions**:
1. Check available memory: `free -h`
2. Check disk space: `df -h`
3. View logs: `docker logs basset-hound`
4. Reduce resource limits in config

### High Memory Usage

**Symptoms**: Container using >80% memory

**Solutions**:
1. Reduce `MAX_CONCURRENT_SESSIONS`
2. Enable screenshot compression
3. Clear old profiles: `rm -rf /app/profiles/old-*`
4. Increase container memory limit

### Slow Performance

**Symptoms**: Requests taking >5 seconds

**Solutions**:
1. Check CPU usage: `docker stats`
2. Check network: `ping example.com`
3. Reduce concurrent sessions
4. Check browser tab count
5. Enable compression

### Connection Refused

**Error**: `Cannot connect to ws://localhost:8765`

**Solutions**:
1. Verify container is running: `docker ps`
2. Check port mapping: `docker port basset-hound`
3. Verify firewall: `ufw status`
4. Check host:port in client code

### Out of Memory

**Symptoms**: Container killed with exit code 137

**Solutions**:
1. Increase memory limit: `-m 8g`
2. Reduce `MAX_CONCURRENT_SESSIONS`
3. Enable swap (not recommended)
4. Monitor with `docker stats`

---

## Security

### Best Practices

1. **Use HTTPS/TLS**
```bash
WEBSOCKET_SSL=true
WEBSOCKET_CERT=/etc/secrets/cert.pem
WEBSOCKET_KEY=/etc/secrets/key.pem
```

2. **Enable Authentication**
```bash
AUTH_ENABLED=true
AUTH_TOKEN=$(openssl rand -base64 32)
```

3. **Network Isolation**
```bash
# Only expose to internal network
docker run -p 127.0.0.1:8765:8765 basset-hound:12.2.0
```

4. **Resource Limits**
```bash
docker run \
  --memory=4g \
  --cpus=2.0 \
  --ulimit nofile=4096:4096 \
  basset-hound:12.2.0
```

5. **Regular Updates**
```bash
# Check for security updates
docker pull basset-hound:12.2.0
docker run ... basset-hound:12.2.0
```

---

## Related Documentation

- [Monitoring Guide](/docs/operations/MONITORING-GUIDE.md) - Detailed monitoring setup
- [Scaling Guide](/docs/operations/SCALING-GUIDE.md) - Horizontal scaling
- [API Reference](/docs/API-REFERENCE.md) - Complete command reference

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026
