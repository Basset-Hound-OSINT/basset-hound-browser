# TROUBLESHOOTING RUNBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [Diagnostic Framework](#diagnostic-framework)
3. [Common Issues and Solutions](#common-issues-and-solutions)
4. [Advanced Debugging](#advanced-debugging)
5. [Log Analysis Guide](#log-analysis-guide)
6. [Escalation Procedures](#escalation-procedures)

---

## Overview

This runbook provides structured troubleshooting guidance for common operational issues with Basset Hound Browser.

**Troubleshooting Philosophy**:
1. **Gather Information**: Collect symptoms, logs, metrics
2. **Isolate Problem**: Identify which component is failing
3. **Apply Solution**: Use relevant fix from this runbook
4. **Verify Fix**: Confirm issue resolved
5. **Document Findings**: Add to knowledge base

**Support Contacts**:
- **On-Call Engineer**: ops-oncall@basset-hound.example.com
- **Slack Channel**: #basset-hound-ops
- **Issue Tracker**: https://github.com/basset-hound/browser/issues
- **Status Page**: https://status.basset-hound.example.com

---

## Diagnostic Framework

### Quick Health Check (60 seconds)

Run this first to get baseline status:

```bash
#!/bin/bash
# Quick diagnostic script

echo "=== BASSET HOUND BROWSER - QUICK DIAGNOSTIC ==="
echo ""

# 1. Container status
echo "[1/6] Container Status:"
docker ps | grep basset-hound-browser || echo "  ✗ Not running"

# 2. Port accessibility
echo "[2/6] Port Accessibility:"
nc -zv localhost 8765 && echo "  ✓ Port 8765 accessible" || echo "  ✗ Port 8765 not accessible"

# 3. Health endpoint
echo "[3/6] Health Endpoint:"
curl -s -m 2 http://localhost:8765/health | jq '.status' 2>/dev/null || echo "  ✗ Health endpoint unreachable"

# 4. Memory usage
echo "[4/6] Memory Usage:"
docker stats basset-hound-browser --no-stream 2>/dev/null | tail -1 || echo "  ✗ Cannot get memory stats"

# 5. Recent errors
echo "[5/6] Recent Errors (last 10):"
docker logs basset-hound-browser 2>&1 | grep -i "error" | tail -10 || echo "  ✓ No errors found"

# 6. WebSocket connectivity
echo "[6/6] WebSocket Connectivity:"
timeout 3 bash -c 'echo {} | nc -w 1 localhost 8765' && echo "  ✓ WebSocket responding" || echo "  ✗ WebSocket not responding"

echo ""
echo "=== END DIAGNOSTIC ==="
```

Save as `/usr/local/bin/basset-quick-check` and run:

```bash
chmod +x /usr/local/bin/basset-quick-check
basset-quick-check
```

### Extended Diagnostic (5 minutes)

Comprehensive system check:

```bash
#!/bin/bash
# Extended diagnostic script

DIAGNOSTIC_DIR="/tmp/basset-diagnostics-$(date +%s)"
mkdir -p "$DIAGNOSTIC_DIR"

echo "Collecting diagnostics to: $DIAGNOSTIC_DIR"

# System info
docker version > "$DIAGNOSTIC_DIR/docker-version.txt"
docker-compose version >> "$DIAGNOSTIC_DIR/docker-version.txt"
uname -a > "$DIAGNOSTIC_DIR/system-info.txt"

# Container information
docker ps -a > "$DIAGNOSTIC_DIR/containers.txt"
docker inspect basset-hound-browser > "$DIAGNOSTIC_DIR/container-inspect.json"
docker exec basset-hound-browser ps aux > "$DIAGNOSTIC_DIR/processes.txt" 2>&1

# Logs
docker logs basset-hound-browser > "$DIAGNOSTIC_DIR/container-logs.txt" 2>&1
docker logs --tail=100 basset-hound-browser > "$DIAGNOSTIC_DIR/container-logs-recent.txt" 2>&1

# Network
docker exec basset-hound-browser netstat -tuln > "$DIAGNOSTIC_DIR/netstat.txt" 2>&1
curl -s http://localhost:8765/health > "$DIAGNOSTIC_DIR/health-check.json" 2>&1

# Resources
docker stats basset-hound-browser --no-stream > "$DIAGNOSTIC_DIR/stats.txt" 2>&1
df -h > "$DIAGNOSTIC_DIR/disk-usage.txt"
free -h > "$DIAGNOSTIC_DIR/memory.txt"

# Volumes
docker volume ls > "$DIAGNOSTIC_DIR/volumes.txt"
docker volume inspect basset-data >> "$DIAGNOSTIC_DIR/volumes.txt" 2>&1

echo "Diagnostics collected. Creating archive..."
tar czf "$DIAGNOSTIC_DIR.tar.gz" "$DIAGNOSTIC_DIR"
echo "Archive: $DIAGNOSTIC_DIR.tar.gz"
rm -rf "$DIAGNOSTIC_DIR"
```

---

## Common Issues and Solutions

### Issue 1: Container Won't Start

**Symptoms**:
- Container status shows "Exited"
- `docker ps` doesn't list the container
- Logs show startup errors

**Diagnosis**:

```bash
# Check exit code
docker inspect basset-hound-browser | jq '.State.ExitCode'
# Exit codes: 1 = general error, 127 = command not found, 137 = OOM killed

# Check recent logs
docker logs basset-hound-browser

# Check Docker daemon
docker version
docker system df
```

**Solutions**:

**A. Missing Environment Variables**
```bash
# Check environment
docker inspect basset-hound-browser | jq '.Config.Env'

# Add missing variables
docker run -e DISPLAY=:99 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  basset-hound-browser:12.7.0
```

**B. Port Already in Use**
```bash
# Check what's using port
sudo lsof -i :8765
sudo netstat -tuln | grep 8765

# Kill conflicting process (if safe)
sudo kill -9 <PID>

# Or use different port
docker run -p 8766:8765 basset-hound-browser:12.7.0
```

**C. Insufficient Memory**
```bash
# Check available memory
free -h

# If OOM, increase docker memory limit
# Edit docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 4G  # Increase from 2G

docker-compose up -d
```

**D. Display Server Not Available**
```bash
# Verify Xvfb running
docker exec basset-hound-browser ps aux | grep Xvfb

# Manually start if needed
docker exec basset-hound-browser Xvfb :99 -screen 0 1920x1080x24 -ac -noreset &

# Restart container
docker restart basset-hound-browser
```

**E. Permission Issues**
```bash
# Check user in container
docker exec basset-hound-browser id

# Check volume permissions
docker exec basset-hound-browser ls -la /app/

# Fix permissions
docker exec basset-hound-browser chown -R basset:basset /app/
```

---

### Issue 2: High Memory Usage

**Symptoms**:
- Memory usage > 1.5GB (single instance)
- Container killed with OOMKilled
- System becomes unresponsive

**Diagnosis**:

```bash
# Check memory trend
docker stats basset-hound-browser --no-stream

# Monitor over time
docker stats basset-hound-browser --interval 5 | head -20

# Check for memory leaks in logs
docker logs basset-hound-browser | grep -i "heap\|memory\|leak"

# Check Node.js process memory
docker top basset-hound-browser
```

**Solutions**:

**A. Restart to Free Memory**
```bash
# Simple restart
docker restart basset-hound-browser

# Wait for memory to stabilize
sleep 30
docker stats basset-hound-browser --no-stream
```

**B. Increase Allocated Memory**
```bash
# Edit docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=2048

# Or set higher limit
docker update --memory 4g basset-hound-browser
docker restart basset-hound-browser
```

**C. Identify Memory Leak**
```bash
# Enable detailed logging
docker exec basset-hound-browser \
  NODE_DEBUG=trace curl http://localhost:8765/health

# Check for stuck connections
curl -s http://localhost:8765/metrics | grep connections

# Review recent changes/commands
docker logs basset-hound-browser | tail -50 | grep -i "screenshot\|memory"
```

**D. Cleanup Cache and Temp Files**
```bash
# Clear cache
docker exec basset-hound-browser rm -rf /app/cache/*

# Remove temp files
docker exec basset-hound-browser find /tmp -type f -delete

# Restart
docker restart basset-hound-browser
```

---

### Issue 3: WebSocket Connection Refused

**Symptoms**:
- Cannot connect to ws://localhost:8765
- `Connection refused` error
- Health check fails

**Diagnosis**:

```bash
# Check if port is listening
docker exec basset-hound-browser netstat -tuln | grep 8765

# Check if process running
docker exec basset-hound-browser ps aux | grep "node\|websocket"

# Test connectivity from container
docker exec basset-hound-browser curl -I http://localhost:8765/

# Check firewall
sudo firewall-cmd --list-ports
sudo ufw status
```

**Solutions**:

**A. Port Not Bound**
```bash
# Check server startup logs
docker logs basset-hound-browser | grep -i "websocket\|listening"

# If not started, manually start
docker exec basset-hound-browser node websocket/server.js &

# Or restart container
docker-compose restart basset-hound-browser
```

**B. Port Already in Use**
```bash
# Find what's using port
sudo lsof -i :8765

# Kill conflicting process
sudo kill -9 <PID>

# Restart container
docker restart basset-hound-browser
```

**C. Firewall Blocking**
```bash
# Check firewall rules
sudo firewall-cmd --list-all

# Add port to firewall
sudo firewall-cmd --add-port=8765/tcp --permanent
sudo firewall-cmd --reload

# Or disable firewall temporarily (development only)
sudo systemctl stop firewalld
```

**D. Remote Connection Issues**
```bash
# Test local connection
curl -I http://localhost:8765/health

# Test from external host
curl -I http://<hostname>:8765/health

# Check routing/network
ping <hostname>
traceroute <hostname>

# Add port mapping if using Docker
docker run -p 0.0.0.0:8765:8765 basset-hound-browser:12.7.0
```

---

### Issue 4: High CPU Usage

**Symptoms**:
- CPU usage consistently > 70%
- System slow or unresponsive
- Container throttled

**Diagnosis**:

```bash
# Check CPU usage
docker stats basset-hound-browser --no-stream

# Monitor over time
docker stats basset-hound-browser --interval 2 | head -20

# Check what's consuming CPU
docker top basset-hound-browser

# Monitor CPU per thread
docker exec basset-hound-browser ps -eLf | grep node

# Check system-wide CPU
top -b -n 2 | grep "Cpu(s)"
```

**Solutions**:

**A. Identify Long-Running Operations**
```bash
# Check logs for slow operations
docker logs basset-hound-browser | grep -i "slow\|timeout\|hang"

# Check for infinite loops or stuck processes
docker exec basset-hound-browser ps aux | grep "R\|S"  # R=running, S=sleeping

# Kill stuck process if safe
docker exec basset-hound-browser kill -9 <PID>
```

**B. Optimize Application Configuration**
```bash
# Reduce concurrency if possible
docker exec basset-hound-browser \
  export MAX_CONCURRENT_OPERATIONS=10

# Adjust screenshot quality
export SCREENSHOT_COMPRESSION=high

# Restart
docker restart basset-hound-browser
```

**C. Horizontal Scaling**
```bash
# If single instance maxed, scale to multiple
kubectl scale deployment basset-hound-browser --replicas=3 -n basset-hound

# Monitor scaling
kubectl get pods -n basset-hound -w
```

**D. Rebuild Optimized Image**
```bash
# Build with optimization flags
docker build \
  --build-arg NODE_OPTIONS="--max-old-space-size=2048" \
  -t basset-hound-browser:12.7.0-optimized .

# Deploy optimized version
docker-compose up -d
```

---

### Issue 5: Health Check Failing

**Symptoms**:
- Health endpoint returns non-200
- Container shows "unhealthy"
- But service may still be working

**Diagnosis**:

```bash
# Check health endpoint
curl -v http://localhost:8765/health

# Check readiness
curl -v http://localhost:8765/ready

# Check liveness
curl -v http://localhost:8765/alive

# Review health check script
docker exec basset-hound-browser cat /app/health-check.sh

# Check logs around health failure time
docker logs basset-hound-browser | tail -20
```

**Solutions**:

**A. WebSocket Server Not Fully Started**
```bash
# Wait longer for startup
sleep 30
curl http://localhost:8765/health

# Check startup logs
docker logs basset-hound-browser | grep -E "Starting|ready|listening" | tail -5

# Extend health check timeout in docker-compose.yml
healthcheck:
  start_period: 60s  # Increase from 40s
```

**B. Temporary Hang or Deadlock**
```bash
# Restart container
docker restart basset-hound-browser

# Wait and verify health
sleep 15
curl -s http://localhost:8765/health | jq '.status'
```

**C. Metrics Endpoint Issue**
```bash
# Check individual health probes
curl -I http://localhost:8765/alive      # Liveness
curl -I http://localhost:8765/ready      # Readiness

# If one fails, investigate specific subsystem
# Check logs for which check is failing
docker logs basset-hound-browser | grep -i "health"
```

---

### Issue 6: Pod Crashes in Kubernetes

**Symptoms**:
- Pod status: CrashLoopBackOff
- Frequent restarts
- Ready: 0/1

**Diagnosis**:

```bash
# Check pod status
kubectl describe pod <pod-name> -n basset-hound

# View pod logs
kubectl logs <pod-name> -n basset-hound
kubectl logs <pod-name> -n basset-hound --previous  # Previous crashed instance

# Check events
kubectl get events -n basset-hound --sort-by='.lastTimestamp' | tail -20

# Check resource availability
kubectl describe nodes
kubectl top nodes
```

**Solutions**:

**A. Insufficient Resources**
```bash
# Check resource requests/limits
kubectl describe pod <pod-name> -n basset-hound | grep -A 5 "Limits\|Requests"

# Check node available resources
kubectl describe nodes | grep -A 10 "Allocatable"

# If insufficient, add nodes or reduce replicas
kubectl scale deployment basset-hound-browser --replicas=1 -n basset-hound

# Or increase node resources (depends on cloud provider)
```

**B. Image Pull Error**
```bash
# Check image availability
kubectl get pods -n basset-hound -o jsonpath='{.items[].status.containerStatuses[].imageID}'

# Check image credentials
kubectl get secrets -n basset-hound

# If using private registry
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=username \
  --docker-password=password \
  -n basset-hound

# Update deployment to use secret
kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "regcred"}]}' \
  -n basset-hound
```

**C. Liveness/Readiness Probe Misconfigured**
```bash
# Check probe configuration
kubectl describe pod <pod-name> -n basset-hound | grep -A 5 "Liveness\|Readiness"

# Edit to fix probes
kubectl edit deployment basset-hound-browser -n basset-hound

# Adjust timeouts if too aggressive
# livenessProbe:
#   initialDelaySeconds: 30
#   periodSeconds: 10
#   timeoutSeconds: 5
#   failureThreshold: 3
```

**D. Application Startup Error**
```bash
# Check detailed logs
kubectl logs <pod-name> -n basset-hound -c basset

# Common startup errors:
# - Missing environment variables
# - Missing dependencies
# - Port already in use

# Fix in deployment YAML and redeploy
kubectl apply -f infrastructure/kubernetes/deployment.yaml
```

---

### Issue 7: Slow Response Times

**Symptoms**:
- API latency > 500ms
- Load test shows high P95/P99 latency
- Users report slowness

**Diagnosis**:

```bash
# Measure latency
time curl http://localhost:8765/health

# Check WebSocket latency
# Use load test with latency reporting
./scripts/load-test.sh --duration 60 --metrics

# Check system load
top -b -n 1 | grep "load average"

# Check disk I/O
iostat -x 1 5

# Check network
iftop -i eth0
```

**Solutions**:

**A. High System Load**
```bash
# Check CPU/Memory/Disk
top
free -h
df -h

# If one is high, address specifically
# See Issue 2 (Memory), Issue 4 (CPU) above
```

**B. Database Queries Slow (if applicable)**
```bash
# Enable query logging
docker exec basset-hound-browser \
  export DB_DEBUG=true

# Check slow queries
docker logs basset-hound-browser | grep -i "slow\|duration"

# Optimize queries or add indexes
```

**C. Network Latency**
```bash
# Measure network latency
ping -c 5 localhost

# If high, check network interfaces
ethtool eth0 | grep -i "speed\|duplex"

# Check network errors
netstat -i
```

**D. Scale Horizontally**
```bash
# If single instance can't keep up
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound

# Verify load distributed
kubectl get endpoints -n basset-hound
```

---

### Issue 8: Disk Space Issues

**Symptoms**:
- Disk usage > 90%
- Write operations failing
- Docker commands slow

**Diagnosis**:

```bash
# Check disk usage
df -h /

# Check where space is used
du -sh /var/lib/docker/*
du -sh /app/*

# Check inode usage
df -i /

# List large files
find / -type f -size +100M -exec ls -lh {} \;
```

**Solutions**:

**A. Clean Docker Artifacts**
```bash
# List disk usage
docker system df

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused containers
docker container prune

# Deep cleanup (careful, removes everything unused)
docker system prune -a --volumes
```

**B. Delete Old Data/Logs**
```bash
# Find old logs
find /app/logs -type f -mtime +30

# Delete old logs
docker exec basset-hound-browser find /app/logs -type f -mtime +30 -delete

# Compress remaining logs
docker exec basset-hound-browser gzip /app/logs/*.log
```

**C. Move to Larger Volume**
```bash
# Create new larger volume
docker volume create basset-data-large

# Copy data
docker run --rm \
  -v basset-data:/old \
  -v basset-data-large:/new \
  alpine cp -a /old/* /new/

# Update docker-compose.yml to use new volume
# volumes:
#   - basset-data-large:/app/data

# Restart
docker-compose down
docker-compose up -d
```

---

## Advanced Debugging

### Enable Debug Logging

```bash
# Set debug environment variable
docker-compose down
export LOG_LEVEL=debug
docker-compose up -d

# Or in docker-compose.yml
environment:
  - LOG_LEVEL=debug

# Monitor debug logs
docker logs -f basset-hound-browser
```

### Attach to Running Container

```bash
# Interactive shell
docker exec -it basset-hound-browser bash

# Inside container, inspect
ps aux
netstat -tuln
cat /app/logs/*.log
env | grep -i basset
```

### Capture Network Traffic

```bash
# Install tcpdump in container
docker exec basset-hound-browser apt-get install -y tcpdump

# Capture traffic
docker exec basset-hound-browser tcpdump -i eth0 -w /app/traffic.pcap

# Download and analyze with Wireshark
docker cp basset-hound-browser:/app/traffic.pcap ./traffic.pcap
wireshark traffic.pcap
```

### Profile Performance

```bash
# CPU profiling (if Node.js v10+)
docker exec basset-hound-browser \
  node --prof websocket/server.js &

sleep 60

# Kill process and process profile
kill %1
docker exec basset-hound-browser \
  node --prof-process isolate-*.log > profile.txt

# Analyze
cat profile.txt
```

### Inspect Memory Dumps

```bash
# Heap snapshot
docker exec basset-hound-browser \
  kill -USR2 <PID>  # Trigger heap snapshot

# Analyze with V8
v8-tool heapdump.heapsnapshot
```

---

## Log Analysis Guide

### Find Errors in Logs

```bash
# Last 100 errors
docker logs basset-hound-browser 2>&1 | grep -i "error" | tail -100

# Errors with context
docker logs basset-hound-browser 2>&1 | grep -i "error" -A 2 -B 2

# Count errors by type
docker logs basset-hound-browser 2>&1 | grep -i "error" | cut -d':' -f2 | sort | uniq -c
```

### Find Warnings

```bash
# Recent warnings
docker logs basset-hound-browser 2>&1 | grep -i "warn" | tail -20

# Warnings with timestamps
docker logs basset-hound-browser 2>&1 | grep -i "warn" | grep -o "^\[.*\]" | sort | uniq -c
```

### Trace Specific Operations

```bash
# Find WebSocket operations
docker logs basset-hound-browser | grep -i "websocket"

# Find connection events
docker logs basset-hound-browser | grep -i "connect\|disconnect"

# Find command execution
docker logs basset-hound-browser | grep -i "command\|execute"

# Timeline view
docker logs basset-hound-browser | grep -E "^\[" | head -50
```

### Extract Metrics from Logs

```bash
# Count total connections
docker logs basset-hound-browser | grep "connected" | wc -l

# Average command duration
docker logs basset-hound-browser | grep "duration" | \
  grep -o "duration=[0-9.]*" | \
  awk -F= '{sum+=$2; count++} END {print sum/count}'

# Errors per minute
docker logs basset-hound-browser | \
  grep "error" | \
  grep -o "^\[[^]]*\]" | \
  sort | uniq -c
```

---

## Escalation Procedures

### Level 1: Self-Service Troubleshooting

Try the quick health check and common solutions above. If resolved, document in knowledge base.

### Level 2: Senior Engineer Assistance

If issue not resolved after 15 minutes:

1. **Collect diagnostics**:
   ```bash
   basset-quick-check > diagnostic.txt
   docker logs basset-hound-browser > logs.txt
   docker stats basset-hound-browser --no-stream > stats.txt
   ```

2. **Post to Slack**: #basset-hound-ops with:
   - Issue description
   - Symptoms observed
   - Steps already tried
   - Attached diagnostic files

3. **Assign on-call**: Page ops-oncall Slack bot
   ```
   @ops-oncall page <issue-summary>
   ```

### Level 3: Incident Management

If critical (service down, data loss risk):

1. **Declare incident**:
   ```bash
   incident-declare "Basset Hound down" p1 #basset-hound-ops
   ```

2. **Start bridge**:
   ```
   Join incident bridge: meet.example.com/basset-incident
   ```

3. **Execute incident response**:
   - Incident commander assigned
   - Senior engineers paged
   - Stakeholders notified
   - Timeline documented

4. **Post-incident review**:
   - Schedule within 24 hours
   - Document root cause
   - Create action items
   - Update runbooks

---

## Related Documentation

- [Deployment Runbook](./RUNBOOK-DEPLOYMENT.md)
- [Monitoring Runbook](./RUNBOOK-MONITORING.md)
- [Maintenance Runbook](./RUNBOOK-MAINTENANCE.md)
- [Infrastructure README](../infrastructure/README.md)
- [SECURITY.md](../security/SECURITY.md)
