# Health Check Runbook

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, Monitoring Teams

---

## Table of Contents

1. [Overview](#overview)
2. [Health Check Architecture](#health-check-architecture)
3. [Individual Health Checks](#individual-health-checks)
4. [Automated Health Check Suite](#automated-health-check-suite)
5. [Alert Configuration](#alert-configuration)
6. [Troubleshooting by Symptom](#troubleshooting-by-symptom)

---

## Overview

This runbook provides 15+ health checks for monitoring the Basset Hound Browser service. Checks are organized by component and criticality level.

### Health Check Levels

| Level | Impact | Interval | Action on Failure |
|-------|--------|----------|------------------|
| **Critical** | Service unavailable | 30s | Page on-call immediately |
| **Warning** | Service degraded | 60s | Alert but don't page |
| **Info** | Monitoring only | 5m | Log and track trends |

### Service Architecture

```
┌─────────────────────────────────────┐
│ Load Balancer / Client Interface    │
└──────────────┬──────────────────────┘
               │
               ↓ TCP:8765 (WebSocket)
               │
┌──────────────────────────────────────┐
│ WebSocket Server                     │
├──────────────────────────────────────┤
│ ✓ Port Listening (8765)              │
│ ✓ Connection Handler                 │
│ ✓ Message Router                     │
│ ✓ Error Recovery                     │
└──────────┬───────────────────────────┘
           │
    ┌──────┴──────┬──────────┬──────────┐
    ↓             ↓          ↓          ↓
┌───────┐   ┌──────────┐  ┌─────┐  ┌────────┐
│ Tor   │   │ Electron │  │Xvfb │  │Storage │
│ Proxy │   │ Browser  │  │Disp │  │(SQLite)│
└───────┘   └──────────┘  └─────┘  └────────┘
```

---

## Health Check Architecture

### Check Categories

1. **System Checks** (Infrastructure)
   - Docker container running
   - Port listening
   - Disk space
   - Memory/CPU usage

2. **Service Checks** (Components)
   - WebSocket connectivity
   - Tor proxy status
   - Xvfb display status
   - Browser process status

3. **Application Checks** (Functionality)
   - WebSocket message handling
   - Request processing
   - Error rate monitoring
   - Response time monitoring

4. **Data Checks** (Persistence)
   - Database connectivity
   - Data directory integrity
   - Volume mount status
   - File permission checks

---

## Individual Health Checks

### Check 1: Container Running (CRITICAL)

**Purpose**: Verify container is active and healthy

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Check if container exists and is running
RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)

if [ "$RUNNING" = "true" ]; then
    echo "✓ Container is running"
    
    # Also check Docker health status
    HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null)
    if [ "$HEALTH" = "healthy" ]; then
        echo "✓ Docker health check: healthy"
        exit 0
    elif [ "$HEALTH" = "starting" ]; then
        echo "⚠ Docker health check: starting (expected during startup)"
        exit 0
    else
        echo "✗ Docker health check: $HEALTH"
        exit 1
    fi
else
    echo "✗ Container is not running"
    exit 1
fi
```

**Success Criteria**:
- Output: `true` or `healthy`
- Exit code: 0

**Failure Actions**:
```bash
# Restart container
docker restart basset-hound-browser

# If still failing
docker-compose down
docker-compose up -d

# If persistent failure, check logs
docker logs basset-hound-browser | tail -50
```

---

### Check 2: WebSocket Port Listening (CRITICAL)

**Purpose**: Verify port 8765 is open and listening

**Command**:
```bash
#!/bin/bash

# Method 1: Using netstat
if netstat -tuln 2>/dev/null | grep -q ":8765 "; then
    echo "✓ Port 8765 is listening (netstat)"
    exit 0
fi

# Method 2: Using lsof
if lsof -i :8765 2>/dev/null | grep -q "LISTEN"; then
    echo "✓ Port 8765 is listening (lsof)"
    exit 0
fi

# Method 3: Using ss (newer systems)
if ss -tuln 2>/dev/null | grep -q ":8765 "; then
    echo "✓ Port 8765 is listening (ss)"
    exit 0
fi

# Method 4: Try connection
if timeout 1 bash -c 'echo "" >/dev/tcp/localhost/8765' 2>/dev/null; then
    echo "✓ Port 8765 is accepting connections"
    exit 0
fi

echo "✗ Port 8765 is not listening"
exit 1
```

**Success Criteria**:
- One of the methods confirms listening
- Exit code: 0

**Failure Actions**:
```bash
# Check what's using the port
lsof -i :8765

# Kill the process if not basset-hound
kill -9 <PID>

# Restart the service
docker-compose restart

# Verify port is released
sleep 2
netstat -tuln | grep 8765 || echo "Port released"
```

---

### Check 3: HTTP Upgrade Response (CRITICAL)

**Purpose**: Verify WebSocket server is responding to HTTP requests

**Command**:
```bash
#!/bin/bash

# Send HTTP request and check for Upgrade Required response
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765)

if [ "$HTTP_CODE" = "426" ]; then
    echo "✓ WebSocket server responding (HTTP 426 Upgrade Required)"
    exit 0
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo "⚠ Server responding but with error code: $HTTP_CODE"
    exit 1
elif [ "$HTTP_CODE" = "000" ]; then
    echo "✗ Cannot reach server (connection refused or timeout)"
    exit 1
else
    echo "⚠ Unexpected response code: $HTTP_CODE"
    exit 1
fi
```

**Success Criteria**:
- HTTP code: 426
- Exit code: 0

**Failure Actions**:
```bash
# Check container logs for errors
docker logs basset-hound-browser | grep -i "error\|exception"

# Check if WebSocket server process is running
docker exec basset-hound-browser \
  ps aux | grep -i "websocket\|node.*server"

# Restart WebSocket server
docker restart basset-hound-browser
```

---

### Check 4: Container Resource Usage (WARNING)

**Purpose**: Monitor CPU and memory consumption

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
MEMORY_LIMIT_MB=2000  # Alert if >2GB
CPU_LIMIT_PCT=80      # Alert if >80%

# Get container stats
STATS=$(docker stats "$CONTAINER" --no-stream --format "{{.CPUPerc}} {{.MemUsage}}")

# Parse CPU percentage
CPU=$(echo "$STATS" | awk '{print $1}' | sed 's/%//')

# Parse memory usage (in MB)
MEMORY=$(echo "$STATS" | awk '{print $2}' | sed 's/MiB//')

# Check thresholds
if (( $(echo "$MEMORY > $MEMORY_LIMIT_MB" | bc -l) )); then
    echo "✗ Memory usage critical: ${MEMORY}MiB (limit: ${MEMORY_LIMIT_MB}MiB)"
    exit 1
elif (( $(echo "$MEMORY > $((MEMORY_LIMIT_MB * 80 / 100))" | bc -l) )); then
    echo "⚠ Memory usage high: ${MEMORY}MiB"
    exit 1
fi

if (( $(echo "${CPU%.*} > $CPU_LIMIT_PCT" | bc -l) )); then
    echo "✗ CPU usage critical: ${CPU}% (limit: ${CPU_LIMIT_PCT}%)"
    exit 1
fi

echo "✓ Resource usage normal: CPU ${CPU}%, Memory ${MEMORY}MiB"
exit 0
```

**Success Criteria**:
- Memory: <1.6GB
- CPU: <80%
- Exit code: 0

**Failure Actions**:
```bash
# Check for memory leaks
docker logs basset-hound-browser | grep -i "memory\|leak"

# Identify processes consuming resources
docker exec basset-hound-browser ps aux --sort=-%mem,%cpu | head -10

# Restart container to clear memory
docker restart basset-hound-browser

# Monitor for recurrence
docker stats basset-hound-browser --interval 2
```

---

### Check 5: Disk Space (WARNING)

**Purpose**: Verify adequate disk space for operations

**Command**:
```bash
#!/bin/bash

# Minimum required disk space (GB)
MIN_DISK_GB=20

# Get available disk space for Docker
DISK_AVAILABLE=$(docker system df | grep "Local Volumes" | awk '{print $5}' | sed 's/GB//')

if [ -z "$DISK_AVAILABLE" ]; then
    # Fallback: check /var/lib/docker
    DISK_AVAILABLE=$(df /var/lib/docker | awk 'NR==2 {print $4 / 1048576}')
fi

if (( $(echo "$DISK_AVAILABLE < $MIN_DISK_GB" | bc -l) )); then
    echo "✗ Disk space critical: ${DISK_AVAILABLE}GB available (min: ${MIN_DISK_GB}GB)"
    
    # Show what's using space
    docker system df
    
    exit 1
fi

echo "✓ Disk space available: ${DISK_AVAILABLE}GB"
exit 0
```

**Success Criteria**:
- Available disk: >20GB
- Exit code: 0

**Failure Actions**:
```bash
# Clean up Docker system
docker system prune -a --volumes -f

# Remove old logs
docker logs basset-hound-browser > /tmp/logs.txt
docker logs basset-hound-browser --tail 0

# Remove unused images
docker image prune -a -f

# Check data volume size
docker exec basset-hound-browser du -sh /app/data
```

---

### Check 6: Container Logs for Errors (CRITICAL)

**Purpose**: Detect error patterns in recent logs

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
ERROR_THRESHOLD=5  # Alert if >5 errors in last 5 minutes

# Get logs from last 5 minutes
ERRORS=$(docker logs "$CONTAINER" --since 5m 2>&1 | \
  grep -iE "^\[ERROR\]|^ERROR:|Error:|Exception:" | \
  wc -l)

if [ "$ERRORS" -gt "$ERROR_THRESHOLD" ]; then
    echo "✗ Too many errors detected: $ERRORS (threshold: $ERROR_THRESHOLD)"
    echo "Recent errors:"
    docker logs "$CONTAINER" --since 5m 2>&1 | \
      grep -iE "^\[ERROR\]|^ERROR:|Error:|Exception:" | \
      head -10
    exit 1
elif [ "$ERRORS" -gt 0 ]; then
    echo "⚠ Errors detected: $ERRORS"
fi

echo "✓ Log check passed: $ERRORS errors"
exit 0
```

**Success Criteria**:
- Error count: <5 in last 5 minutes
- Exit code: 0

**Failure Actions**:
```bash
# Get full error context
docker logs basset-hound-browser --since 30m | grep -A 3 "ERROR"

# Check for specific error patterns
docker logs basset-hound-browser | grep -i "EADDRINUSE\|ENOMEM\|ENOSPC"

# Analyze error trends
docker logs basset-hound-browser | grep "ERROR" | tail -50 > /tmp/errors.log

# Restart if errors are transient
docker restart basset-hound-browser
```

---

### Check 7: Tor Proxy Status (INFO)

**Purpose**: Verify Tor integration is functional

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Test Tor SOCKS proxy
PROXY_IP=$(docker exec "$CONTAINER" \
  curl -s --proxy socks5://127.0.0.1:9050 \
  http://ifconfig.me 2>/dev/null)

if [ -z "$PROXY_IP" ]; then
    echo "⚠ Tor SOCKS proxy not responding"
    
    # Check if Tor process is running
    TOR_RUNNING=$(docker exec "$CONTAINER" \
      pgrep -c tor 2>/dev/null || echo 0)
    
    if [ "$TOR_RUNNING" -eq 0 ]; then
        echo "✗ Tor daemon is not running"
        exit 1
    fi
    
    exit 1
else
    echo "✓ Tor SOCKS proxy working: IP is $PROXY_IP"
    
    # Verify it's not the local IP
    HOST_IP=$(curl -s http://ifconfig.me 2>/dev/null || echo "unknown")
    if [ "$PROXY_IP" != "$HOST_IP" ]; then
        echo "✓ Proxy IP differs from host (correct)"
        exit 0
    else
        echo "⚠ Proxy IP matches host IP (may not be proxying)"
        exit 1
    fi
fi
```

**Success Criteria**:
- SOCKS proxy responds
- Returns non-local IP address
- Exit code: 0

**Failure Actions**:
```bash
# Check Tor process
docker exec basset-hound-browser ps aux | grep tor

# Check Tor logs
docker exec basset-hound-browser \
  tail -50 /var/log/tor/log

# Restart Tor
docker exec basset-hound-browser \
  pkill -f tor
docker exec basset-hound-browser \
  su -s /bin/bash debian-tor -c "tor -f /etc/tor/torrc" &

# Verify Tor SOCKS port
docker exec basset-hound-browser \
  netstat -tuln | grep 9050
```

---

### Check 8: Xvfb Display Status (WARNING)

**Purpose**: Verify virtual display is running

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
DISPLAY="${DISPLAY:-:99}"

# Check if Xvfb process is running
XVFB_RUNNING=$(docker exec "$CONTAINER" \
  pgrep -c Xvfb 2>/dev/null || echo 0)

if [ "$XVFB_RUNNING" -eq 0 ]; then
    echo "✗ Xvfb is not running"
    exit 1
fi

# Verify display is accessible
DISPLAY_OK=$(docker exec "$CONTAINER" \
  xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && echo 1 || echo 0)

if [ "$DISPLAY_OK" -eq 1 ]; then
    echo "✓ Xvfb display is accessible: $DISPLAY"
    
    # Get display info
    SCREEN_INFO=$(docker exec "$CONTAINER" \
      xdpyinfo -display "$DISPLAY" | grep "dimensions")
    echo "  $SCREEN_INFO"
    
    exit 0
else
    echo "✗ Xvfb display not accessible: $DISPLAY"
    exit 1
fi
```

**Success Criteria**:
- Xvfb process running
- Display accessible
- Exit code: 0

**Failure Actions**:
```bash
# Check X11 socket
docker exec basset-hound-browser ls -la /tmp/.X11-unix/

# Restart Xvfb
docker exec basset-hound-browser pkill Xvfb
docker exec basset-hound-browser \
  Xvfb :99 -screen 0 1920x1080x24 -ac &

# Verify restart
docker exec basset-hound-browser \
  xdpyinfo -display :99
```

---

### Check 9: Browser Process Status (WARNING)

**Purpose**: Verify Electron browser process is running

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Check for Electron process
ELECTRON_COUNT=$(docker exec "$CONTAINER" \
  pgrep -f "electron" | wc -l)

if [ "$ELECTRON_COUNT" -eq 0 ]; then
    echo "✗ Electron browser process is not running"
    exit 1
elif [ "$ELECTRON_COUNT" -lt 2 ]; then
    echo "⚠ Expected multiple Electron processes, found: $ELECTRON_COUNT"
    exit 1
else
    echo "✓ Electron browser running: $ELECTRON_COUNT processes"
    
    # Check browser responsiveness
    RESPONSE=$(docker exec "$CONTAINER" \
      node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
let responded = false;
ws.on('open', () => {
  ws.send(JSON.stringify({command: 'ping'}));
});
ws.on('message', () => {
  console.log('pong');
  responded = true;
  ws.close();
});
setTimeout(() => {
  if (responded) process.exit(0);
  else process.exit(1);
}, 2000);
" 2>/dev/null)
    
    if [ "$RESPONSE" = "pong" ]; then
        echo "✓ Browser is responsive"
        exit 0
    else
        echo "⚠ Browser not responding to ping"
        exit 1
    fi
fi
```

**Success Criteria**:
- Multiple Electron processes running
- Browser responds to ping
- Exit code: 0

**Failure Actions**:
```bash
# Restart browser
docker restart basset-hound-browser

# Check for browser errors
docker logs basset-hound-browser | grep -i "electron\|browser"

# Force kill and restart if needed
docker exec basset-hound-browser pkill -9 electron
docker restart basset-hound-browser
```

---

### Check 10: Data Directory Integrity (WARNING)

**Purpose**: Verify data volume is accessible and uncorrupted

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Check data directory exists
DATA_EXISTS=$(docker exec "$CONTAINER" \
  test -d /app/data && echo 1 || echo 0)

if [ "$DATA_EXISTS" -eq 0 ]; then
    echo "✗ Data directory does not exist"
    exit 1
fi

# Check directory is writable
WRITABLE=$(docker exec "$CONTAINER" \
  test -w /app/data && echo 1 || echo 0)

if [ "$WRITABLE" -eq 0 ]; then
    echo "✗ Data directory is not writable"
    exit 1
fi

# Check for corrupted files (empty files that shouldn't be)
CORRUPTED=$(docker exec "$CONTAINER" bash -c \
  'find /app/data -type f -size 0 2>/dev/null | wc -l')

if [ "$CORRUPTED" -gt 0 ]; then
    echo "⚠ Found $CORRUPTED empty files in data directory"
fi

# Get data directory size
SIZE=$(docker exec "$CONTAINER" du -sh /app/data | awk '{print $1}')

echo "✓ Data directory healthy: $SIZE"
exit 0
```

**Success Criteria**:
- Directory exists and is writable
- No unexpected empty files
- Exit code: 0

**Failure Actions**:
```bash
# Check permissions
docker exec basset-hound-browser ls -la /app/data

# Fix permissions if needed
docker exec basset-hound-browser \
  chown -R basset:basset /app/data

# Check for disk corruption
docker exec basset-hound-browser fsck /app/data || true

# Restore from backup if corrupted
docker volume rm basset-data
docker run --rm -v basset-data:/data -v /backup:/backup \
  alpine tar xzf /backup/data.tar.gz -C /
```

---

### Check 11: Active Connections Count (INFO)

**Purpose**: Track number of active client connections

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
WARN_THRESHOLD=50
CRIT_THRESHOLD=100

# Count established connections on WebSocket port
CONNECTIONS=$(docker exec "$CONTAINER" \
  netstat -tan 2>/dev/null | \
  grep -c "ESTABLISHED.*:8765" || echo 0)

if [ "$CONNECTIONS" -ge "$CRIT_THRESHOLD" ]; then
    echo "✗ Too many connections: $CONNECTIONS (critical: $CRIT_THRESHOLD)"
    exit 1
elif [ "$CONNECTIONS" -ge "$WARN_THRESHOLD" ]; then
    echo "⚠ High connection count: $CONNECTIONS (warning: $WARN_THRESHOLD)"
    exit 0
else
    echo "✓ Connection count normal: $CONNECTIONS"
    exit 0
fi
```

**Success Criteria**:
- Connections: <100
- Exit code: 0

**Failure Actions**:
```bash
# List active connections
docker exec basset-hound-browser \
  netstat -tan | grep "ESTABLISHED.*:8765"

# Identify clients
docker exec basset-hound-browser \
  netstat -tanp | grep "8765"

# If needed, rate limit or reject new connections
# (Implement in WebSocket server)
```

---

### Check 12: Response Time Monitoring (INFO)

**Purpose**: Monitor API response time

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
MAX_TIME_MS=1000  # Alert if response takes >1 second

# Measure WebSocket ping response time
START=$(date +%s%N)

docker exec "$CONTAINER" node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({command: 'ping'}));
});
ws.on('message', () => {
  ws.close();
  process.exit(0);
});
setTimeout(() => process.exit(1), 2000);
" >/dev/null 2>&1

RESULT=$?

END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))  # Convert to milliseconds

if [ "$RESULT" -eq 0 ]; then
    if [ "$ELAPSED" -gt "$MAX_TIME_MS" ]; then
        echo "⚠ Slow response time: ${ELAPSED}ms (threshold: ${MAX_TIME_MS}ms)"
        exit 1
    else
        echo "✓ Response time normal: ${ELAPSED}ms"
        exit 0
    fi
else
    echo "✗ Ping failed"
    exit 1
fi
```

**Success Criteria**:
- Response time: <1000ms
- Exit code: 0

**Failure Actions**:
```bash
# Check container load
docker stats basset-hound-browser --no-stream

# Monitor response times over time
for i in {1..10}; do
  time_ms=$(docker exec basset-hound-browser \
    node -e "console.time('ping'); ws.on('message', () => console.timeEnd('ping'))")
done

# If consistently slow, consider restarting
docker restart basset-hound-browser
```

---

### Check 13: Uptime Tracking (INFO)

**Purpose**: Monitor container uptime

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"
WARN_UPTIME_DAYS=30  # Alert if running >30 days without restart

# Get start time
START_TIME=$(docker inspect "$CONTAINER" \
  --format='{{.State.StartedAt}}')

# Calculate uptime
START_EPOCH=$(date -d "$START_TIME" +%s)
NOW_EPOCH=$(date +%s)
UPTIME_SECONDS=$((NOW_EPOCH - START_EPOCH))
UPTIME_DAYS=$((UPTIME_SECONDS / 86400))

echo "Container uptime: $UPTIME_DAYS days"

if [ "$UPTIME_DAYS" -gt "$WARN_UPTIME_DAYS" ]; then
    echo "⚠ Container running for extended period (>$WARN_UPTIME_DAYS days)"
    echo "Consider restart for memory cleanup"
    exit 0
fi

echo "✓ Uptime check passed"
exit 0
```

**Success Criteria**:
- Any uptime value
- Exit code: 0

**Failure Actions**:
```bash
# Schedule periodic restart
docker-compose stop -t 30
docker-compose up -d

# Or use restart policy in docker-compose.yml:
# restart: unless-stopped
# + cron job to restart weekly
```

---

### Check 14: Volume Mount Status (CRITICAL)

**Purpose**: Verify all volumes are properly mounted

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Get mount information
MOUNTS=$(docker inspect "$CONTAINER" \
  --format='{{json .Mounts}}')

# Check each critical mount
REQUIRED_MOUNTS=(
    "/app/data"
    "/app/downloads"
    "/app/screenshots"
)

for mount in "${REQUIRED_MOUNTS[@]}"; do
    if echo "$MOUNTS" | grep -q "\"Destination\":\"$mount\""; then
        echo "✓ Volume mounted: $mount"
    else
        echo "✗ Required volume not mounted: $mount"
        exit 1
    fi
done

exit 0
```

**Success Criteria**:
- All required volumes mounted
- Exit code: 0

**Failure Actions**:
```bash
# Check current mounts
docker inspect basset-hound-browser --format='{{json .Mounts}}' | jq '.'

# Restart container to remount
docker-compose restart

# Check docker-compose.yml volume configuration
grep -A 10 "volumes:" docker-compose.yml

# If still missing, manually mount
docker run -d -v basset-data:/app/data \
  basset-hound-browser
```

---

### Check 15: Health Check Status (CRITICAL)

**Purpose**: Use Docker's built-in health check

**Command**:
```bash
#!/bin/bash

CONTAINER="basset-hound-browser"

# Get health status from Docker
HEALTH=$(docker inspect "$CONTAINER" \
  --format='{{.State.Health.Status}}')

case "$HEALTH" in
    "healthy")
        echo "✓ Container health check: healthy"
        exit 0
        ;;
    "starting")
        echo "⚠ Container health check: starting (expected during startup)"
        exit 0
        ;;
    "unhealthy")
        echo "✗ Container health check: unhealthy"
        
        # Get failure count
        FAILURES=$(docker inspect "$CONTAINER" \
          --format='{{.State.Health.FailingStreak}}')
        echo "Health check failures: $FAILURES"
        
        # Show recent health check log
        docker inspect "$CONTAINER" \
          --format='{{json .State.Health.Log}}' | jq '.' | tail -5
        
        exit 1
        ;;
    *)
        echo "⚠ Unknown health status: $HEALTH"
        exit 1
        ;;
esac
```

**Success Criteria**:
- Status: healthy or starting
- Exit code: 0

**Failure Actions**:
```bash
# Restart container
docker restart basset-hound-browser

# Wait for startup and recheck
sleep 30
docker inspect basset-hound-browser \
  --format='{{.State.Health.Status}}'

# If still unhealthy, check logs
docker logs basset-hound-browser | tail -100
```

---

## Automated Health Check Suite

### Complete Health Check Script

Create: `/path/to/full-health-check.sh`

```bash
#!/bin/bash

set -o pipefail

CONTAINER="basset-hound-browser"
RESULTS_FILE="health-check-results-$(date +%Y%m%d-%H%M%S).txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CRITICAL_FAILED=0
WARNING_FAILED=0
INFO_FAILED=0

echo "=== Basset Hound Browser Health Check Suite ===" | tee "$RESULTS_FILE"
echo "Started at: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Helper functions
critical_check() {
    local name=$1
    local command=$2
    
    echo -n "CRITICAL: $name ... " | tee -a "$RESULTS_FILE"
    if eval "$command" >>"/tmp/check-output.txt" 2>&1; then
        echo -e "${GREEN}PASS${NC}" | tee -a "$RESULTS_FILE"
    else
        echo -e "${RED}FAIL${NC}" | tee -a "$RESULTS_FILE"
        cat /tmp/check-output.txt >> "$RESULTS_FILE"
        CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
    fi
}

warning_check() {
    local name=$1
    local command=$2
    
    echo -n "WARNING: $name ... " | tee -a "$RESULTS_FILE"
    if eval "$command" >>"/tmp/check-output.txt" 2>&1; then
        echo -e "${GREEN}PASS${NC}" | tee -a "$RESULTS_FILE"
    else
        echo -e "${YELLOW}WARN${NC}" | tee -a "$RESULTS_FILE"
        cat /tmp/check-output.txt >> "$RESULTS_FILE"
        WARNING_FAILED=$((WARNING_FAILED + 1))
    fi
}

info_check() {
    local name=$1
    local command=$2
    
    echo -n "INFO: $name ... " | tee -a "$RESULTS_FILE"
    if eval "$command" >>"/tmp/check-output.txt" 2>&1; then
        echo -e "${GREEN}PASS${NC}" | tee -a "$RESULTS_FILE"
    else
        echo -e "${YELLOW}FAIL${NC}" | tee -a "$RESULTS_FILE"
        INFO_FAILED=$((INFO_FAILED + 1))
    fi
}

# === CRITICAL CHECKS ===
echo "CRITICAL CHECKS:" | tee -a "$RESULTS_FILE"
critical_check "Container running" "docker inspect -f '{{.State.Running}}' $CONTAINER | grep -q true"
critical_check "Port 8765 listening" "netstat -tuln 2>/dev/null | grep -q ':8765 '"
critical_check "WebSocket HTTP response" "[ \$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8765) = '426' ]"
critical_check "Volume mounts" "docker inspect $CONTAINER --format='{{json .Mounts}}' | grep -q '/app/data'"
critical_check "Docker health" "docker inspect -f '{{.State.Health.Status}}' $CONTAINER | grep -qE 'healthy|starting'"
echo "" | tee -a "$RESULTS_FILE"

# === WARNING CHECKS ===
echo "WARNING CHECKS:" | tee -a "$RESULTS_FILE"
warning_check "Memory usage <2GB" "[ \$(docker stats $CONTAINER --no-stream --format '{{.MemUsage}}' | sed 's/MiB//') -lt 2000 ]"
warning_check "Disk space >20GB" "[ \$(df /var/lib/docker | awk 'NR==2 {print \$4}') -gt 20971520 ]"
warning_check "CPU usage <80%" "[ \$(docker stats $CONTAINER --no-stream --format '{{.CPUPerc}}' | sed 's/%//') -lt 80 ]"
warning_check "No critical errors" "[ \$(docker logs $CONTAINER --since 5m 2>&1 | grep -ci '^ERROR') -lt 5 ]"
warning_check "Xvfb running" "docker exec $CONTAINER pgrep -c Xvfb | grep -q [0-9]"
warning_check "Electron running" "docker exec $CONTAINER pgrep -f electron | wc -l | grep -qv '^0$'"
echo "" | tee -a "$RESULTS_FILE"

# === INFO CHECKS ===
echo "INFO CHECKS:" | tee -a "$RESULTS_FILE"
info_check "Tor proxy working" "[ -n \"\$(docker exec $CONTAINER curl -s --proxy socks5://127.0.0.1:9050 http://ifconfig.me 2>/dev/null)\" ]"
info_check "Data directory writable" "docker exec $CONTAINER test -w /app/data"
info_check "Active connections <100" "[ \$(docker exec $CONTAINER netstat -tan 2>/dev/null | grep -c 'ESTABLISHED.*:8765') -lt 100 ]"
info_check "Uptime <30 days" "[ \$(( (\$(date +%s) - \$(date -d \"\$(docker inspect $CONTAINER --format='{{.State.StartedAt}}')\" +%s)) / 86400 )) -lt 30 ]"
echo "" | tee -a "$RESULTS_FILE"

# === SUMMARY ===
echo "=== SUMMARY ===" | tee -a "$RESULTS_FILE"
echo "Critical Failed: $CRITICAL_FAILED" | tee -a "$RESULTS_FILE"
echo "Warnings: $WARNING_FAILED" | tee -a "$RESULTS_FILE"
echo "Info Issues: $INFO_FAILED" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Determine exit code
if [ "$CRITICAL_FAILED" -gt 0 ]; then
    echo -e "${RED}HEALTH CHECK FAILED${NC}" | tee -a "$RESULTS_FILE"
    echo "Critical issues detected. Service may be unhealthy." | tee -a "$RESULTS_FILE"
    exit 1
elif [ "$WARNING_FAILED" -gt 0 ]; then
    echo -e "${YELLOW}HEALTH CHECK WARNING${NC}" | tee -a "$RESULTS_FILE"
    echo "Non-critical issues detected. Service is running but may require attention." | tee -a "$RESULTS_FILE"
    exit 0
else
    echo -e "${GREEN}HEALTH CHECK PASSED${NC}" | tee -a "$RESULTS_FILE"
    exit 0
fi
```

Run the comprehensive check:

```bash
chmod +x full-health-check.sh
./full-health-check.sh
```

---

## Alert Configuration

### Prometheus Alert Rules

Create: `/etc/prometheus/rules/basset-hound-browser.yml`

```yaml
groups:
  - name: basset_hound_browser
    interval: 30s
    rules:
      # Container down (CRITICAL)
      - alert: BassetHoundContainerDown
        expr: up{job="basset-hound-browser"} == 0
        for: 1m
        annotations:
          summary: "Basset Hound Browser container is down"
          severity: critical
      
      # High memory usage (WARNING)
      - alert: BassetHoundHighMemory
        expr: container_memory_usage_bytes{name="basset-hound-browser"} > 1.6e9
        for: 5m
        annotations:
          summary: "Basset Hound Browser memory usage is high"
          severity: warning
      
      # High CPU usage (WARNING)
      - alert: BassetHoundHighCPU
        expr: rate(container_cpu_usage_seconds_total{name="basset-hound-browser"}[5m]) > 0.8
        for: 5m
        annotations:
          summary: "Basset Hound Browser CPU usage is high"
          severity: warning
      
      # Port not responding (CRITICAL)
      - alert: BassetHoundPortDown
        expr: up{job="basset-hound-browser-port"} == 0
        for: 2m
        annotations:
          summary: "Basset Hound Browser port 8765 not responding"
          severity: critical
      
      # Too many errors (WARNING)
      - alert: BassetHoundHighErrorRate
        expr: rate(basset_hound_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Basset Hound Browser error rate is elevated"
          severity: warning
```

---

## Troubleshooting by Symptom

### Symptom: Container Won't Start

| Check | Command | Expected | Action |
|-------|---------|----------|--------|
| Logs | `docker logs basset-hound-browser` | No ERROR | Check for missing dependencies |
| Ports | `netstat -tuln \| grep 8765` | No output | Clear port if needed |
| Disk | `df -h /var/lib/docker` | >50GB free | Clean up Docker |

### Symptom: High Memory Usage

| Check | Command | Expected | Action |
|-------|---------|----------|--------|
| Memory | `docker stats --no-stream` | <1.5GB | Check for memory leaks |
| Processes | `docker top basset-hound-browser` | Few processes | Kill hung processes |
| Logs | `docker logs --since 1h` | No memory errors | Restart container |

### Symptom: No Connections Accepted

| Check | Command | Expected | Action |
|-------|---------|----------|--------|
| Port | `lsof -i :8765` | LISTEN | Check WebSocket logs |
| Network | `docker network inspect` | Connected | Verify network config |
| Firewall | `sudo iptables -L -n \| grep 8765` | Allow rule | Add firewall rule |

---

**End of Health Check Runbook**

