# Service Startup Runbook

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, On-Call Teams

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Startup Checks](#pre-startup-checks)
4. [Startup Procedures](#startup-procedures)
5. [Health Checks](#health-checks)
6. [Troubleshooting](#troubleshooting)
7. [Rollback](#rollback)

---

## Overview

This runbook provides step-by-step instructions for starting the Basset Hound Browser service. The service consists of multiple components:

- **Tor Daemon**: Provides proxy connectivity and circuit management
- **Xvfb**: Virtual display server for headless Electron rendering
- **Electron Browser**: The core browser automation engine
- **WebSocket Server**: API interface on port 8765
- **MCP Server**: Model Context Protocol interface for AI agents

### Architecture Flow

```
Pre-Startup Checks
    ↓
Environment Validation
    ↓
Docker Image Verification
    ↓
Network Setup
    ↓
Container Start (Tor + Xvfb + Electron)
    ↓
Health Checks (15+ checks)
    ↓
Ready for Connections
```

---

## Prerequisites

Before starting the service, verify the following prerequisites are met:

### System Requirements

- **OS**: Linux (Ubuntu 20.04+) or Docker Desktop (macOS/Windows)
- **CPU**: 2+ cores available
- **Memory**: 4 GB RAM available (at minimum)
- **Disk**: 50 GB free space for Docker and artifacts
- **Network**: 1+ Mbps outbound bandwidth

### Software Requirements

- **Docker**: Version 20.10+ (check with `docker --version`)
- **Docker Compose**: Version 1.29+ (check with `docker-compose --version`)
- **bash/sh**: For running scripts
- **curl**: For health checks and API testing
- **netcat**: For port connectivity verification

### Installation Check

```bash
# Verify Docker is installed and running
docker ps

# Verify Docker Compose
docker-compose --version

# Verify disk space
df -h /var/lib/docker

# Verify network connectivity
ping -c 1 8.8.8.8
```

If any check fails, install missing prerequisites before proceeding.

---

## Pre-Startup Checks

### 1. System Health Verification

```bash
# Check available memory
FREE_MEM=$(free -m | awk 'NR==2 {print $7}')
if [ "$FREE_MEM" -lt 2048 ]; then
    echo "WARNING: Available memory is less than 2GB: ${FREE_MEM}MB"
    echo "Service may experience performance issues"
fi

# Check disk space
DISK_AVAIL=$(df /var/lib/docker | awk 'NR==2 {print $4}')
if [ "$DISK_AVAIL" -lt 52428800 ]; then  # 50GB in KB
    echo "ERROR: Less than 50GB free disk space available"
    exit 1
fi

# Check for running Docker daemon
if ! docker ps >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running"
    echo "Start Docker with: sudo systemctl start docker"
    exit 1
fi

echo "✓ System health checks passed"
```

### 2. Configuration Verification

```bash
# Verify necessary configuration files exist
CONFIG_FILES=(
    "docker-compose.yml"
    "Dockerfile"
    "package.json"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "ERROR: Missing configuration file: $file"
        exit 1
    fi
done

# Verify .env file (if using custom configuration)
if [ -f ".env" ]; then
    source .env
    echo "✓ Configuration loaded from .env"
else
    echo "ℹ Using default configuration (no .env file)"
fi

echo "✓ Configuration verification passed"
```

### 3. Port Availability Check

```bash
# Check if WebSocket port is available
if netstat -tuln 2>/dev/null | grep -q ":8765 "; then
    echo "ERROR: Port 8765 is already in use"
    echo "Current process using port 8765:"
    lsof -i :8765 || netstat -tlnp | grep 8765
    exit 1
fi

# Check Docker daemon port (if using Docker socket)
if ! docker ps >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to Docker daemon"
    exit 1
fi

echo "✓ Port availability checks passed"
```

### 4. Cleanup Old Containers (Optional)

```bash
# Stop and remove any existing containers with the same name
CONTAINER_NAME="basset-hound-browser"

if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing existing container: $CONTAINER_NAME"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo "✓ Old container removed"
fi
```

---

## Startup Procedures

### Option 1: Docker Compose (Recommended)

#### Step 1: Build Docker Image

```bash
cd /path/to/basset-hound-browser

# Build the image (only needed once or when code changes)
docker-compose build

# Expected output:
# [+] Building 45.3s (18/18) FINISHED
# => CACHED [base 1/1]
# => [dependencies 2/4]
# ...
```

**Time Required**: 1-5 minutes (depends on Docker cache)

**Common Issues**:
- If build fails with "npm ERR! code EACCES", run `docker system prune -a` and retry
- If Node version mismatch errors, ensure `package.json` is not corrupted

#### Step 2: Start Container

```bash
# Start the service in the background
docker-compose up -d

# Expected output:
# Creating basset-hound-browser ... done
```

**Time Required**: 30-60 seconds

**Monitoring the startup**:
```bash
# View real-time logs
docker-compose logs -f

# Watch for these key messages:
# - "Starting system Tor daemon"
# - "Tor SOCKS proxy is ready"
# - "Starting Xvfb on display"
# - "Starting Basset Hound Browser"
# - "WebSocket server listening on port 8765"
```

**Key Startup Events to Observe**:

1. **Tor Bootstrap** (0-10 seconds)
   ```
   Starting system Tor daemon as debian-tor user...
   Waiting for Tor to bootstrap...
   Tor SOCKS proxy is ready on 127.0.0.1:9050
   Tor control port is ready on 127.0.0.1:9051
   ```

2. **Xvfb Display** (0-5 seconds)
   ```
   Starting Xvfb on display :99...
   Xvfb started successfully
   ```

3. **Electron Browser** (10-20 seconds)
   ```
   Starting Basset Hound Browser in headless mode...
   Electron app loaded successfully
   ```

4. **WebSocket Server** (5-10 seconds)
   ```
   WebSocket server listening on port 8765
   Server ready for connections
   ```

#### Step 3: Verify Container Status

```bash
# Check container status
docker-compose ps

# Expected output:
# NAME                   COMMAND            STATUS              PORTS
# basset-hound-browser   "/app/docker-e..."  Up 30 seconds       0.0.0.0:8765->8765/tcp
```

### Option 2: Docker Direct Commands

If not using Docker Compose:

```bash
# Build image
docker build -t basset-hound-browser .

# Start container
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  --network basset-hound-browser \
  -e DISPLAY=:99 \
  -e SCREEN_RESOLUTION=1920x1080x24 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  -v $(pwd)/downloads:/app/downloads \
  -v $(pwd)/screenshots:/app/screenshots \
  -v basset-data:/app/data \
  --cap-drop=ALL \
  --cap-add=SYS_ADMIN \
  --security-opt no-new-privileges:true \
  --restart unless-stopped \
  basset-hound-browser

# Create network if needed
docker network create basset-hound-browser || true
```

### Option 3: Development (Local Execution)

For local development without Docker:

```bash
# Install dependencies
npm install

# Start Tor (if available)
# tor -f /etc/tor/torrc &

# Start Xvfb (Linux only)
# Xvfb :99 -screen 0 1920x1080x24 &

# Start the application
npm start

# Or with custom port:
BASSET_WS_PORT=8765 npm start
```

---

## Health Checks

### Comprehensive Health Check Suite

After startup, run the following health checks to verify all components are operational:

#### Check 1: Container Status

```bash
# Get container status
docker inspect basset-hound-browser \
  --format='{{.State.Running}}'

# Expected output: true

# Get container health status
docker inspect basset-hound-browser \
  --format='{{.State.Health.Status}}'

# Expected output: healthy
```

#### Check 2: Port Connectivity

```bash
# Verify WebSocket port is listening
netstat -tuln | grep 8765
# or
lsof -i :8765

# Expected output:
# tcp    0    0 0.0.0.0:8765       0.0.0.0:*    LISTEN
```

#### Check 3: WebSocket HTTP Upgrade Response

```bash
# Send HTTP request (should get Upgrade Required response)
curl -v http://localhost:8765 2>&1 | grep -E "HTTP|Upgrade"

# Expected output:
# < HTTP/1.1 426 Upgrade Required
```

#### Check 4: Docker Container Logs

```bash
# Check for startup errors
docker logs basset-hound-browser | tail -50

# Look for these success indicators:
# - "WebSocket server listening on port 8765"
# - "Server is ready for connections"
# - "All services initialized"

# Look for these error indicators:
# - "ERROR" (case-sensitive)
# - "EADDRINUSE"
# - "Failed to"
```

#### Check 5: Tor Integration Check

```bash
# Access container and verify Tor is running
docker exec basset-hound-browser \
  curl -s --proxy socks5://127.0.0.1:9050 \
  http://ifconfig.me

# Expected output: An IP address (not your host IP)
```

#### Check 6: WebSocket Connection Test

```bash
# Use Node.js to test WebSocket connection
docker exec basset-hound-browser node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  console.log('✓ WebSocket connection successful');
  ws.send(JSON.stringify({command: 'ping'}));
});
ws.on('message', (data) => {
  console.log('✓ Received message:', data);
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('✗ Connection error:', err.message);
  process.exit(1);
});
setTimeout(() => {
  console.error('✗ Connection timeout');
  process.exit(1);
}, 5000);
"
```

#### Check 7: CPU and Memory Usage

```bash
# Get resource usage
docker stats basset-hound-browser --no-stream

# Expected output shows:
# CPU%: 1-5% at idle
# MEMORY: <500MB at idle
# MEMORY%: <15% of available

# If CPU is >20% or memory is >1GB, investigate:
docker logs basset-hound-browser | grep -E "ERROR|WARN" | tail -20
```

#### Check 8: Database/Data Directory

```bash
# Check if data directory is writable and has correct permissions
docker exec basset-hound-browser \
  test -w /app/data && echo "✓ Data directory writable"

# Check data directory size
docker exec basset-hound-browser \
  du -sh /app/data

# Expected: Should be small initially (<100MB)
```

#### Check 9: File System Checks

```bash
# Verify critical directories exist
docker exec basset-hound-browser bash -c "
  for dir in /app/data /app/screenshots /app/downloads /app/blocking-data; do
    if [ -d \$dir ]; then
      echo \"✓ \$dir exists\"
    else
      echo \"✗ \$dir missing\"
      exit 1
    fi
  done
"
```

#### Check 10: Network Connectivity

```bash
# Verify container can reach external networks (for proxy functionality)
docker exec basset-hound-browser \
  ping -c 1 8.8.8.8

# Expected: 1 packet received
```

### Quick Health Check Script

Create a file: `/path/to/health-check.sh`

```bash
#!/bin/bash

set -e

CONTAINER="basset-hound-browser"

echo "=== Basset Hound Browser Health Check ==="
echo ""

# Check 1: Container running
if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    echo "✓ Container is running"
else
    echo "✗ Container is not running"
    exit 1
fi

# Check 2: Port listening
if netstat -tuln 2>/dev/null | grep -q ":8765"; then
    echo "✓ WebSocket port 8765 is listening"
else
    echo "✗ WebSocket port 8765 is not listening"
    exit 1
fi

# Check 3: HTTP response
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765)
if [ "$HTTP_CODE" = "426" ]; then
    echo "✓ HTTP response code is 426 (Upgrade Required)"
else
    echo "✗ HTTP response code is $HTTP_CODE (expected 426)"
    exit 1
fi

# Check 4: Resource usage
MEMORY=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | awk '{print $1}' | sed 's/MiB//')
if (( $(echo "$MEMORY < 1000" | bc -l) )); then
    echo "✓ Memory usage is ${MEMORY}MiB (normal)"
else
    echo "⚠ Memory usage is ${MEMORY}MiB (higher than expected)"
fi

# Check 5: No critical errors in logs
ERRORS=$(docker logs "$CONTAINER" 2>&1 | grep -c "^ERROR" || true)
if [ "$ERRORS" -eq 0 ]; then
    echo "✓ No critical errors in logs"
else
    echo "⚠ Found $ERRORS critical errors in logs"
fi

echo ""
echo "Health check completed successfully!"
echo "Service is ready for connections on port 8765"
```

Run the health check:

```bash
chmod +x health-check.sh
./health-check.sh
```

---

## Troubleshooting

### Issue: Docker Build Fails with "npm ERR!"

**Symptoms**:
```
npm ERR! code EACCES
npm ERR! syscall mkdir
```

**Solution**:
```bash
# Clear Docker cache and rebuild
docker system prune -a --volumes
docker-compose build --no-cache
docker-compose up -d
```

### Issue: Port 8765 Already in Use

**Symptoms**:
```
ERROR: for basset-hound-browser Cannot start service basset-hound-browser:
bind: address already in use
```

**Solution**:
```bash
# Find what's using port 8765
lsof -i :8765

# Kill the process
kill -9 <PID>

# Or use a different port in docker-compose.yml:
# ports:
#   - "8766:8765"
```

### Issue: Tor Fails to Start

**Symptoms**:
```
ERROR: Tor failed to start within 60s
```

**Solution**:
```bash
# Check Tor logs
docker logs basset-hound-browser | grep -i tor

# Verify Tor configuration
docker exec basset-hound-browser cat /etc/tor/torrc

# Try restarting without Tor
docker-compose down
docker-compose up -d -e USE_SYSTEM_TOR=false
```

### Issue: Xvfb Display Not Starting

**Symptoms**:
```
ERROR: Failed to start Xvfb
```

**Solution**:
```bash
# Check for display conflicts
docker exec basset-hound-browser ps aux | grep Xvfb

# Try different display number
docker-compose down
# Edit docker-compose.yml:
# - DISPLAY=:100  # Changed from :99
docker-compose up -d
```

### Issue: Container Exits Immediately

**Symptoms**:
```
docker-compose up
Creating basset-hound-browser ... done
[Container exits after 1-2 seconds]
```

**Solution**:
```bash
# Check detailed logs
docker-compose logs

# Check startup script permissions
docker exec basset-hound-browser \
  test -x /app/docker-entrypoint.sh && echo "✓ Script is executable"

# Check for circular dependencies in startup
docker logs basset-hound-browser 2>&1 | head -50
```

### Issue: WebSocket Connection Refused

**Symptoms**:
```
curl: (7) Failed to connect to localhost port 8765
```

**Solution**:
```bash
# Verify container is running
docker ps | grep basset-hound-browser

# Check if port is mapped
docker port basset-hound-browser

# Inspect network configuration
docker network inspect basset-hound-browser

# Check firewall rules
sudo iptables -L -n | grep 8765
```

### Issue: High Memory Usage

**Symptoms**:
```
Memory usage: >1.5GB
Memory%: >30%
```

**Solution**:
```bash
# Check for memory leaks in logs
docker logs basset-hound-browser | grep -i "memory\|leak"

# Inspect running processes
docker exec basset-hound-browser ps aux --sort=-%mem | head -10

# Restart container to clear memory
docker-compose restart

# If persistent, check for infinite loops in code
docker logs basset-hound-browser --since 5m
```

### Issue: Slow Startup (>2 minutes)

**Symptoms**:
```
Time to "WebSocket server listening": >120 seconds
```

**Solution**:
```bash
# Check Docker performance
docker stats basset-hound-browser

# Check disk I/O
docker exec basset-hound-browser iostat

# Enable debug logging
docker-compose down
BASSET_LOG_LEVEL=debug docker-compose up -d
docker logs -f basset-hound-browser
```

---

## Rollback

If startup fails or the service is unstable after startup, rollback to the previous state:

### Quick Rollback

```bash
# Stop the current container
docker-compose down

# Remove failed container and volumes (if needed)
docker-compose down -v

# Restart with previous configuration
docker-compose up -d

# Verify health
./health-check.sh
```

### Complete Rollback Procedure

If the rollback above doesn't work:

```bash
# 1. Stop all services
docker-compose down -v

# 2. Verify no container is running
docker ps -a | grep basset-hound-browser

# 3. Remove any orphaned containers
docker rm -f $(docker ps -aq --filter "name=basset-hound-browser") || true

# 4. Reset Docker daemon (if needed)
docker system prune -a --volumes

# 5. Restore from backup (if applicable)
if [ -f "/backup/basset-hound-browser-backup.tar.gz" ]; then
    docker load -i /backup/basset-hound-browser-backup.tar.gz
fi

# 6. Start fresh
docker-compose up -d
```

---

## Post-Startup Verification

After all health checks pass, perform these final verification steps:

```bash
# 1. Test WebSocket echo command
curl -X GET "http://localhost:8765/health" || \
  echo "WebSocket server is running (HTTP not supported)"

# 2. Verify no error logs
docker logs basset-hound-browser | grep -i "error" | wc -l
# Expected: 0

# 3. Check uptime
docker inspect basset-hound-browser \
  --format='Started: {{.State.StartedAt}}'

# 4. Verify all volumes are mounted
docker inspect basset-hound-browser \
  --format='{{json .Mounts}}' | jq '.'

# 5. Document startup time
START_TIME=$(docker inspect basset-hound-browser --format='{{.State.StartedAt}}')
echo "Service started at: $START_TIME"
```

---

## Support & Escalation

| Issue | Action | Escalate If |
|-------|--------|-------------|
| Port in use | Kill process or use different port | Cannot find process or still fails |
| Build fails | Clear cache and rebuild | Fails 3+ times |
| Container exits | Check logs | Logs don't indicate root cause |
| Memory high | Restart container | Usage >2GB or doesn't stabilize |
| Tor fails | Start without Tor, check logs | Needed for functionality |

For additional support, refer to:
- Logs: `docker logs basset-hound-browser`
- Documentation: `/docs/TROUBLESHOOTING.md`
- Architecture: `/docs/operations/DEPLOYMENT-GUIDE.md`

---

**End of Startup Runbook**

