# Service Shutdown Runbook

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, On-Call Teams

---

## Table of Contents

1. [Overview](#overview)
2. [Graceful Shutdown Procedure](#graceful-shutdown-procedure)
3. [Emergency Shutdown Procedure](#emergency-shutdown-procedure)
4. [Data Protection & Verification](#data-protection--verification)
5. [Post-Shutdown Checks](#post-shutdown-checks)
6. [Cleanup Procedures](#cleanup-procedures)

---

## Overview

This runbook provides procedures for safely shutting down the Basset Hound Browser service while protecting data and ensuring clean state for restart.

### Shutdown Types

| Type | Duration | Use Case | Data Loss Risk |
|------|----------|----------|----------------|
| **Graceful** | 30-60 seconds | Maintenance, upgrades, healthy shutdown | None |
| **Emergency** | 1-2 seconds | Service hung, resource exhaustion, security incident | Low |
| **Forced** | Immediate | Container won't respond to signals | Low |

### Shutdown Flow

```
Request Shutdown
    ↓
Drain Active Connections
    ↓
Wait for In-Flight Operations
    ↓
Close Resources Cleanly
    ↓
Preserve State Data
    ↓
Stop Container
    ↓
Verify Clean Shutdown
```

---

## Graceful Shutdown Procedure

This is the **recommended** method for planned shutdowns.

### Step 1: Preparation

Before initiating shutdown, notify stakeholders and prepare the service:

```bash
# 1. Check current active connections
docker exec basset-hound-browser ps aux | grep -E "node|electron"

# Expected: Several processes running

# 2. Get container statistics
docker stats basset-hound-browser --no-stream

# 3. Check if any long-running operations are in progress
docker logs basset-hound-browser | tail -20 | grep -E "Processing|Executing"

# 4. Notify monitoring systems (if applicable)
# Send message to monitoring/alerting system:
# "Scheduled maintenance: Basset Hound Browser shutting down for [reason]"
```

### Step 2: Connection Draining

Gracefully stop accepting new connections:

```bash
# 1. Send graceful shutdown command to WebSocket server
docker exec basset-hound-browser node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({
    command: 'shutdown',
    type: 'graceful',
    timeout: 30000
  }));
  console.log('Graceful shutdown initiated');
  setTimeout(() => process.exit(0), 1000);
});
" 2>/dev/null || echo "WebSocket shutdown not available"

# 2. Wait for existing connections to complete (30 seconds max)
echo "Draining active connections... (waiting up to 30 seconds)"
for i in {30..1}; do
    CONNECTION_COUNT=$(docker exec basset-hound-browser \
      netstat -tan 2>/dev/null | grep -c ESTABLISHED || echo 0)
    
    if [ "$CONNECTION_COUNT" -eq 0 ]; then
        echo "✓ All connections closed"
        break
    fi
    
    echo "Active connections: $CONNECTION_COUNT (${i}s remaining)"
    sleep 1
done
```

### Step 3: Resource Cleanup

Prepare the service for shutdown:

```bash
# 1. Flush any pending data to storage
docker exec basset-hound-browser node -e "
const fs = require('fs');
try {
  // Sync any pending writes
  require('child_process').execSync('sync');
  console.log('✓ Flushed pending disk writes');
} catch (e) {
  console.error('Warning: Could not flush writes');
}
" 2>/dev/null

# 2. Clear temporary data
docker exec basset-hound-browser bash -c "
  rm -rf /tmp/basset-hound-* 2>/dev/null
  rm -rf /tmp/.X*-* 2>/dev/null
  echo '✓ Temporary data cleared'
"

# 3. Archive recent logs (optional)
docker logs basset-hound-browser > "/tmp/basset-hound-logs-$(date +%s).log" 2>&1
echo "✓ Logs archived"
```

### Step 4: Container Stop

Stop the container with grace period:

```bash
# Use docker-compose for clean shutdown
docker-compose stop -t 30

# Alternative (direct Docker command):
# docker stop --time=30 basset-hound-browser

# Expected behavior:
# - Container receives SIGTERM signal
# - Waiting up to 30 seconds for graceful shutdown
# - After 30 seconds, sends SIGKILL if still running
```

**What Happens During Stop**:

1. **SIGTERM Signal** (0-1 second)
   - Container receives termination signal
   - Application has opportunity to shutdown gracefully
   - Resources begin cleanup

2. **Shutdown Window** (1-30 seconds)
   - Application closes connections
   - Flushes in-flight data
   - Saves state to disk
   - Closes file handles

3. **Force Kill** (>30 seconds)
   - If container doesn't stop, SIGKILL is sent
   - Immediate termination without cleanup
   - Should rarely happen with proper code

```bash
# Monitor the shutdown process
echo "Waiting for container to stop..."
TIMEOUT=40
ELAPSED=0

while docker ps | grep -q basset-hound-browser; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "ERROR: Container did not stop within ${TIMEOUT}s"
        break
    fi
    
    echo "Container still running... (${ELAPSED}s elapsed)"
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if ! docker ps | grep -q basset-hound-browser; then
    echo "✓ Container stopped successfully"
fi
```

### Step 5: Verify Shutdown State

Confirm the service is completely stopped:

```bash
# 1. Check container status
docker ps -a | grep basset-hound-browser

# Expected: Container exists but is "Exited"

# 2. Verify port is released
netstat -tuln | grep 8765

# Expected: No output (port not listening)

# 3. Check for orphaned processes
docker ps -a --filter "label=basset-hound" | grep -v "Exited"

# Expected: No running containers with basset-hound label

# 4. Verify data was saved
docker inspect basset-hound-browser \
  --format='{{json .State}}' | jq '.ExitCode'

# Expected: 0 (successful exit) or 143 (SIGTERM)
```

### Step 6: Data Preservation

Optionally preserve data for backup or analysis:

```bash
# 1. Backup data volume
docker run --rm \
  -v basset-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/basset-data-$(date +%Y%m%d-%H%M%S).tar.gz /data

echo "✓ Data volume backed up"

# 2. Archive logs
mkdir -p ./logs
docker logs basset-hound-browser > "./logs/shutdown-$(date +%Y%m%d-%H%M%S).log"

echo "✓ Logs archived to ./logs/"

# 3. Export container state (optional)
docker inspect basset-hound-browser > "./container-state-$(date +%Y%m%d-%H%M%S).json"

echo "✓ Container state exported"
```

---

## Emergency Shutdown Procedure

Use this procedure when immediate shutdown is required (service hung, security incident, resource exhaustion).

### Step 1: Stop Container Immediately

```bash
# Force container stop with short timeout
docker stop --time=1 basset-hound-browser

# Or force kill
docker kill basset-hound-browser

echo "✓ Container killed"
```

### Step 2: Verify Immediate Shutdown

```bash
# Check container is stopped
docker inspect basset-hound-browser \
  --format='{{.State.Running}}'

# Expected: false

# Verify port is released
if netstat -tuln 2>/dev/null | grep -q ":8765"; then
    echo "WARNING: Port 8765 still in use after kill"
    echo "Checking for zombie processes..."
    ps aux | grep -E "node|electron" | grep -v grep
fi
```

### Step 3: Critical Data Preservation

If data preservation is critical:

```bash
# 1. Backup data volume immediately
docker run --rm \
  -v basset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/emergency-backup-$(date +%s).tar.gz /data

echo "✓ Emergency backup created"

# 2. Export logs for investigation
docker logs basset-hound-browser > \
  "/tmp/emergency-logs-$(date +%s).log" 2>&1

echo "✓ Logs exported for investigation"
```

### Step 4: Cleanup and Reset

```bash
# Remove the container to allow fresh start
docker rm -f basset-hound-browser

# Clean up Docker artifacts
docker system prune --volumes -f

echo "✓ Emergency cleanup complete"
```

---

## Data Protection & Verification

### Pre-Shutdown Data Verification

```bash
# 1. Verify data directory integrity
docker exec basset-hound-browser bash -c "
  cd /app/data
  
  # Check directory structure
  if [ -d 'profiles' ] && [ -d 'cache' ]; then
    echo '✓ Data directory structure intact'
  else
    echo '✗ Data directory structure corrupted'
    exit 1
  fi
  
  # Check file count
  FILE_COUNT=\$(find . -type f | wc -l)
  echo \"✓ Total files: \$FILE_COUNT\"
"

# 2. Verify file permissions
docker exec basset-hound-browser bash -c "
  stat -c '%A %U:%G %n' /app/data/* | head -10
"

# 3. Check for corruption
docker exec basset-hound-browser bash -c "
  # Verify no truncated or partial files
  for file in /app/data/*; do
    if [ -f \$file ]; then
      # Check file size is reasonable
      SIZE=\$(stat -f%z \$file 2>/dev/null || stat -c%s \$file 2>/dev/null)
      if [ \$SIZE -eq 0 ]; then
        echo \"⚠ Empty file: \$file\"
      fi
    fi
  done
"
```

### Backup Before Shutdown

```bash
#!/bin/bash

BACKUP_DIR="./backups/pre-shutdown-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating pre-shutdown backup..."

# 1. Backup data volume
docker run --rm \
  -v basset-data:/data \
  -v $(pwd):"$BACKUP_DIR" \
  alpine tar czf "$BACKUP_DIR/data.tar.gz" /data

# 2. Backup configuration
docker inspect basset-hound-browser > "$BACKUP_DIR/container-config.json"

# 3. Export logs
docker logs basset-hound-browser > "$BACKUP_DIR/logs.txt"

# 4. Backup profiles and screenshots (if mounted)
if [ -d ./screenshots ]; then
  tar czf "$BACKUP_DIR/screenshots.tar.gz" ./screenshots
fi

echo "✓ Backup created at: $BACKUP_DIR"
echo "  Total size: $(du -sh "$BACKUP_DIR" | awk '{print $1}')"
```

---

## Post-Shutdown Checks

After shutdown is complete, verify the system is in a clean state:

### Verification Checklist

```bash
#!/bin/bash

echo "=== Post-Shutdown Verification ==="
echo ""

# 1. Container status
if docker ps -a | grep -q "basset-hound-browser"; then
    STATUS=$(docker inspect basset-hound-browser --format='{{.State.Status}}')
    echo "Container status: $STATUS"
else
    echo "✓ Container removed"
fi

# 2. Port availability
if netstat -tuln 2>/dev/null | grep -q ":8765"; then
    echo "✗ Port 8765 still in use"
    lsof -i :8765 || true
else
    echo "✓ Port 8765 released"
fi

# 3. Network cleanup
if docker network inspect basset-hound-browser >/dev/null 2>&1; then
    CONTAINERS=$(docker network inspect basset-hound-browser \
      --format='{{len .Containers}}')
    if [ "$CONTAINERS" -eq 0 ]; then
        echo "✓ Network isolated (no containers)"
    else
        echo "⚠ Network has $CONTAINERS containers"
    fi
else
    echo "✓ Network removed"
fi

# 4. Disk space verification
DISK_USAGE=$(docker system df | tail -1 | awk '{print $3}')
echo "Docker disk usage: $DISK_USAGE"

# 5. Process cleanup
ORPHANED=$(pgrep -f "basset-hound" | wc -l)
if [ "$ORPHANED" -eq 0 ]; then
    echo "✓ No orphaned processes"
else
    echo "⚠ Found $ORPHANED orphaned processes"
    pgrep -f "basset-hound" -a
fi

# 6. Logs availability
if [ -d ./logs ]; then
    LATEST=$(ls -t ./logs | head -1)
    echo "✓ Logs available: ./logs/$LATEST"
else
    echo "ℹ No logs directory"
fi

echo ""
echo "Post-shutdown verification complete!"
```

Run the verification:

```bash
chmod +x post-shutdown-check.sh
./post-shutdown-check.sh
```

---

## Cleanup Procedures

### Clean Shutdown Cleanup

After a successful graceful shutdown:

```bash
# 1. Remove container (data persists in volumes)
docker-compose down

# Expected: Container removed, volumes preserved

# 2. Clean Docker system (optional)
docker system prune -f

# This removes:
# - Dangling images
# - Stopped containers
# - Unused networks
# WARNING: Only do this if no other projects are running
```

### Complete Cleanup (Remove All Data)

If you need to remove all data and start fresh:

```bash
# WARNING: This deletes ALL data!

# 1. Stop container
docker-compose down

# 2. Remove volumes
docker-compose down -v

# Expected: Container and volumes removed

# 3. Remove images
docker rmi basset-hound-browser

# 4. Clean Docker system
docker system prune -a --volumes -f

echo "⚠ All data has been removed"
```

### Archive and Preserve

To safely preserve data before complete cleanup:

```bash
#!/bin/bash

ARCHIVE_NAME="basset-hound-archive-$(date +%Y%m%d-%H%M%S)"

echo "Creating archive: $ARCHIVE_NAME"

# 1. Create archive directory
mkdir -p "./archives/$ARCHIVE_NAME"

# 2. Backup data volume
docker run --rm \
  -v basset-data:/data \
  -v $(pwd)/archives/"$ARCHIVE_NAME":/archive \
  alpine tar czf /archive/data.tar.gz /data

# 3. Backup logs
docker logs basset-hound-browser > "./archives/$ARCHIVE_NAME/logs.txt"

# 4. Export container metadata
docker inspect basset-hound-browser > "./archives/$ARCHIVE_NAME/metadata.json"

# 5. Archive important directories
for dir in screenshots downloads; do
    if [ -d "$dir" ]; then
        tar czf "./archives/$ARCHIVE_NAME/$dir.tar.gz" "$dir"
    fi
done

# 6. Create manifest
cat > "./archives/$ARCHIVE_NAME/MANIFEST.txt" <<EOF
Archive Name: $ARCHIVE_NAME
Date: $(date)
Contents:
- data.tar.gz: Application data volume
- logs.txt: Container logs
- metadata.json: Container configuration
- screenshots.tar.gz: Screenshot archive (if present)
- downloads.tar.gz: Downloads archive (if present)

To restore:
1. Extract archive
2. Create data volume and restore data.tar.gz
3. Start container with: docker-compose up -d
EOF

echo "✓ Archive created at: ./archives/$ARCHIVE_NAME"
echo "  Total size: $(du -sh "./archives/$ARCHIVE_NAME" | awk '{print $1}')"

# 7. Now safe to remove all data
docker-compose down -v
echo "✓ Container and volumes removed (data preserved in archive)"
```

---

## Troubleshooting Shutdown Issues

### Issue: Container Won't Stop

**Symptoms**:
```bash
docker stop basset-hound-browser
# ... waits 30 seconds then:
# Error response from daemon: container already stopped
```

**Solution**:

```bash
# 1. Check if container is actually running
docker ps | grep basset-hound-browser

# 2. Try force kill
docker kill --signal=SIGKILL basset-hound-browser

# 3. Remove container if stopped
docker rm basset-hound-browser

# 4. Check for orphaned processes
ps aux | grep -E "node|electron" | grep basset
```

### Issue: Port Still in Use After Shutdown

**Symptoms**:
```bash
netstat -tuln | grep 8765
# tcp    0    0 0.0.0.0:8765       0.0.0.0:*    LISTEN
```

**Solution**:

```bash
# 1. Find process using port
lsof -i :8765

# 2. Kill the process
kill -9 <PID>

# 3. Wait and verify
sleep 2
netstat -tuln | grep 8765 || echo "✓ Port released"

# 4. If still in use, restart networking
sudo systemctl restart network  # systemd systems
# or on macOS:
sudo pfctl -f /etc/pf.conf
```

### Issue: Data Loss During Shutdown

**Prevention**:

```bash
# 1. Always create backup before shutdown
docker run --rm -v basset-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%s).tar.gz /data

# 2. Verify backup created
ls -lh ./backup-*.tar.gz | tail -1

# 3. Then proceed with shutdown
docker-compose down -v
```

**Recovery**:

```bash
# 1. Stop any running containers
docker-compose down

# 2. Extract backup
mkdir -p /tmp/recovery
tar xzf ./backup-*.tar.gz -C /tmp/recovery

# 3. Restore to volume
docker volume create basset-data
docker run --rm -v basset-data:/data -v /tmp/recovery:/backup \
  alpine tar xzf /backup/data.tar.gz -C /

# 4. Restart service
docker-compose up -d
```

---

## Shutdown Scenarios

### Scenario 1: Scheduled Maintenance Window

```bash
#!/bin/bash

echo "Starting scheduled maintenance shutdown..."

# 1. Announce shutdown
echo "Notifying users..."
# Send notification to monitoring/alerting

# 2. Gracefully shut down
docker-compose stop -t 60

# 3. Perform maintenance
echo "Performing maintenance..."
# Docker image update, system patches, etc.

# 4. Restart
docker-compose up -d

# 5. Verify
./health-check.sh

echo "Maintenance complete"
```

### Scenario 2: Emergency Shutdown (Security)

```bash
#!/bin/bash

echo "EMERGENCY SHUTDOWN - Security incident"

# 1. Immediate stop
docker kill basset-hound-browser

# 2. Preserve evidence
docker logs basset-hound-browser > /tmp/security-incident-$(date +%s).log

# 3. Isolate network
docker network disconnect basset-hound-browser basset-hound-browser 2>/dev/null || true

# 4. Alert security team
echo "Security incident logs: /tmp/security-incident-*.log"

# Do NOT restart until incident is investigated
```

### Scenario 3: Resource Exhaustion

```bash
#!/bin/bash

echo "Resource exhaustion detected - emergency shutdown"

# 1. Get current stats
docker stats basset-hound-browser --no-stream

# 2. Immediately stop
docker stop --time=1 basset-hound-browser

# 3. Clean up
docker system prune -a --volumes -f

# 4. Reduce resource limits in docker-compose.yml
# cpus: '1'
# memory: 1G

# 5. Restart
docker-compose up -d
```

---

## Support & Escalation

| Issue | Action | Escalate If |
|-------|--------|-------------|
| Graceful stop slow | Wait full timeout | >2 minutes |
| Force kill needed | Use docker kill | Multiple force kills required |
| Data backup fails | Check disk space | Cannot create backup |
| Port still in use | Kill process | Still in use after kill -9 |

---

**End of Shutdown Runbook**

