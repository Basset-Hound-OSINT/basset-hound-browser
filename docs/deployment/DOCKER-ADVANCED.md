# Basset Hound Browser - Advanced Docker Configuration

## Table of Contents
1. [Multi-Stage Build Optimization](#multi-stage-build-optimization)
2. [Security Hardening](#security-hardening)
3. [Performance Tuning](#performance-tuning)
4. [High Availability Setup](#high-availability-setup)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Custom Configurations](#custom-configurations)

## Multi-Stage Build Optimization

The Dockerfile uses three stages to optimize image size and build efficiency:

### Stage 1: Builder
- Base: `node:20-bullseye`
- Purpose: Compile dependencies and native modules
- Removed from final image
- Contains: build-essential, python3, git

### Stage 2: Runtime Base
- Base: `node:20-bullseye-slim`
- Purpose: Minimal runtime environment
- Contains: Xvfb, Electron libraries, Tor
- Size optimized: only runtime dependencies

### Stage 3: Production
- Inherits from: runtime-base
- Contains: compiled modules from builder
- Final image size: ~2.6GB

### Build Performance

```bash
# First build (no cache): ~6-8 minutes
docker build -f config/docker/Dockerfile -t basset-hound-browser:latest .

# Subsequent builds (with cache): ~30-60 seconds
docker build -f config/docker/Dockerfile -t basset-hound-browser:latest .

# Force rebuild of dependencies: ~2-3 minutes
docker build --no-cache -f config/docker/Dockerfile -t basset-hound-browser:latest .
```

### Layer Caching Strategy

The Dockerfile is organized for optimal caching:

1. **System packages** (rarely change)
   - Cached until base image updates

2. **Tor configuration** (rarely change)
   - Cached independently

3. **Dependencies** (sometimes change)
   - Cached with `npm ci --prefer-offline`
   - Rebuilds only when package*.json changes

4. **Application code** (frequently change)
   - Always rebuilt
   - Benefits from cached dependencies above

## Security Hardening

### Container Security

#### Capability Dropping
```yaml
cap_drop:
  - ALL
cap_add:
  - SYS_ADMIN  # Required for Electron sandbox
```

#### Security Options
```yaml
security_opt:
  - no-new-privileges:true
```

This prevents:
- Privilege escalation attacks
- Unexpected capability gains

### User Configuration

#### Non-Root User
```dockerfile
RUN groupadd -r basset && useradd -r -g basset -u 1000 basset
RUN usermod -aG debian-tor basset
RUN chown -R basset:basset /app
USER basset
```

Benefits:
- Limits damage if container is compromised
- Prevents accidental root-level modifications

#### Tor Group Membership
- Allows control port authentication
- Minimal privilege elevation

### Network Security

#### Network Isolation
```yaml
networks:
  basset-hound-prod:
    driver: bridge
```

#### Port Exposure
```yaml
ports:
  - "8765:8765"  # Only WebSocket exposed in production
```

Dev/Test expose Tor ports for debugging:
```yaml
ports:
  - "8765:8765"  # WebSocket
  - "9050:9050"  # Tor SOCKS (debug only)
  - "9051:9051"  # Tor Control (debug only)
```

### Tor Configuration Security

```torrc
# Restrict SOCKS connections to localhost
SocksPolicy accept 127.0.0.1
SocksPolicy reject *

# Safe logging
SafeLogging 1

# Minimize disk writes
AvoidDiskWrites 1

# Cookie-based authentication
CookieAuthentication 1
```

### Health Check Security

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/health-check.sh
```

Health check script:
```bash
#!/bin/bash
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765)
[ "$HEALTH" = "426" ] && exit 0 || exit 1
```

## Performance Tuning

### Resource Limits

#### Production (Conservative)
```yaml
deploy:
  resources:
    limits:
      cpus: '2'      # Hard limit
      memory: 2G
    reservations:
      cpus: '0.5'    # Guaranteed allocation
      memory: 512M
```

#### Development (Generous)
```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### Performance Metrics

Baseline measurements (v12.0.0):

- **Throughput:**
  - 50 concurrent: 481.48 msgs/sec
  - 200 concurrent: 285.45 msgs/sec
  - Linear scaling observed

- **Latency:**
  - Average: 0.04-0.05ms
  - P99: <2ms
  - P99.9: <5ms

- **Memory:**
  - Utilization: 1.15% of host
  - Growth rate: 0MB/hour
  - Excellent garbage collection

- **CPU:**
  - Under load: 18.16%
  - Idle: <2%

- **Compression:**
  - Average: 70-93% bandwidth reduction
  - Large payloads: >85% reduction

### Optimization Techniques

#### 1. Image Size Reduction
```bash
# Current: ~2.6GB
# Components:
# - Runtime dependencies: ~1.8GB
# - Node modules: ~500MB
# - Application code: ~300MB

# To further reduce:
# 1. Use alpine base (not suitable for Electron)
# 2. Remove unnecessary npm packages
# 3. Minify application code
```

#### 2. Dependency Optimization
```dockerfile
# Use npm ci for reproducible builds
RUN npm ci --no-optional --prefer-offline

# Avoid optional dependencies
RUN npm ci --no-optional

# Use npm prune in final stage
RUN npm prune --production
```

#### 3. Caching Optimization
```bash
# Separate dependency layer
COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
```

#### 4. Virtual Display Optimization
```bash
# Lower resolution for testing
SCREEN_RESOLUTION=1280x720x24  # Test mode
SCREEN_RESOLUTION=1920x1080x24 # Production
```

### Monitoring Performance

```bash
# Real-time metrics
docker stats

# Resource limits
docker inspect <container> | grep -A 10 '"HostConfig"'

# Historical metrics
docker logs <container> | grep "timing\|perf\|ms"
```

## High Availability Setup

### Load Balancing

For multiple instances behind a load balancer:

```yaml
services:
  basset-1:
    container_name: basset-hound-browser-1
    ports:
      - "8765:8765"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.basset1.rule=PathPrefix(/)"

  basset-2:
    container_name: basset-hound-browser-2
    ports:
      - "8766:8765"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.basset2.rule=PathPrefix(/)"

  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

### Restart Policies

#### Production
```yaml
restart: on-failure:5  # Restart up to 5 times on failure
```

#### Development
```yaml
restart: on-failure:3  # Restart up to 3 times
```

#### Testing
```yaml
restart: on-failure:10  # Aggressive retry for debugging
```

### Health Checks

```yaml
healthcheck:
  test: ["CMD", "/app/health-check.sh"]
  interval: 30s       # Check every 30 seconds
  timeout: 10s        # Timeout after 10 seconds
  retries: 3          # Fail after 3 consecutive failures
  start_period: 40s   # Wait 40s before first check
```

## Monitoring and Observability

### Container Logs

#### Structured Logging
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "5"
    labels: "env=production"
```

#### Log Collection
```bash
# Real-time logs
docker-compose logs -f

# Specific service
docker-compose logs -f basset-hound-browser

# Tail last 100 lines
docker-compose logs --tail 100

# Since timestamp
docker-compose logs --since 2024-01-15T10:00:00
```

### Metrics Collection

#### Docker Stats
```bash
# Real-time metrics
docker stats

# Non-streaming snapshot
docker stats --no-stream

# Specific container
docker stats basset-hound-browser-prod
```

#### Prometheus Integration
```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
```

### Application Monitoring

#### WebSocket Health
```bash
# Check connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8765
```

#### Resource Usage
```bash
# CPU and Memory
docker stats basset-hound-browser-prod

# Disk usage
docker exec basset-hound-browser-prod du -sh /app

# Network
docker stats --no-stream --format "{{.Container}}\t{{.NetIO}}"
```

## Custom Configurations

### Custom Dockerfile

To create a custom Dockerfile variant:

```dockerfile
# Inherit from production image
FROM basset-hound-browser:12.0.0

# Add custom packages
RUN apt-get update && apt-get install -y \
    custom-package

# Override entrypoint
ENTRYPOINT ["/app/custom-entrypoint.sh"]
```

### Custom Docker Compose

```yaml
version: '3.9'

services:
  basset-hound-browser:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    environment:
      - CUSTOM_VAR=value
    volumes:
      - ./custom-data:/app/custom
    networks:
      - custom-network

networks:
  custom-network:
    driver: bridge
```

### Build Arguments

```bash
docker build \
  --build-arg NODE_ENV=production \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  -t basset-hound-browser:custom .
```

### Environment Overrides

```bash
docker-compose run -e DEBUG=basset:* basset-hound-browser
```

## Troubleshooting Advanced Issues

### Out of Memory
```bash
# Check memory usage
docker exec basset-hound-browser free -h

# Increase limit
docker-compose down
# Edit docker-compose.yml and increase memory
docker-compose up -d

# Monitor closely
docker stats
```

### High CPU Usage
```bash
# Identify process
docker exec basset-hound-browser top

# Check for memory leaks
docker logs --since 1h | grep -i memory
```

### Network Issues
```bash
# Test connectivity
docker exec basset-hound-browser ping 8.8.8.8

# Check DNS
docker exec basset-hound-browser nslookup google.com

# Inspect network
docker network inspect basset-hound-prod
```

### Slow Startup
```bash
# Check startup logs
docker-compose logs | head -100

# Monitor during startup
docker stats basset-hound-browser

# Profile startup
docker-compose up --build 2>&1 | grep -E "Starting|Ready|Error"
```

## Best Practices

1. **Always use version tags** for images in production
2. **Separate dev/prod configurations** with different docker-compose files
3. **Use .env files** for sensitive configuration
4. **Monitor resource usage** continuously
5. **Regular security updates** for base images
6. **Test changes** in dev environment first
7. **Maintain detailed logs** for troubleshooting
8. **Use health checks** for automated recovery

## References

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
