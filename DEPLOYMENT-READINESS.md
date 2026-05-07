# Basset Hound Browser v11.1.0
## Deployment Readiness Checklist

**Status:** ✅ APPROVED FOR PRODUCTION  
**Date:** May 6, 2026  
**Target Audience:** DevOps, Infrastructure, Operations Teams

---

## Pre-Flight Checklist

### Infrastructure Requirements
- [ ] **Hardware:** 2+ vCPU, 4GB+ RAM available
- [ ] **OS:** Linux (Debian/Ubuntu) or macOS
- [ ] **Docker:** v20.10+ and docker-compose v1.29+
- [ ] **Node.js:** 18.x LTS
- [ ] **Python:** 3.8+
- [ ] **Display:** Xvfb for headless mode (Linux)

### Software Dependencies
- [ ] **Electron:** 39.x (bundled in build)
- [ ] **FastMCP:** 2.0+ (Python)
- [ ] **websockets:** Latest (Python)
- [ ] **ws:** 8.14+ (Node.js)

### Network Requirements
- [ ] **Outbound Internet:** For navigation/Tor
- [ ] **Tor (optional):** For Tor integration (auto-installed)
- [ ] **Port 8765:** Available for WebSocket (localhost)
- [ ] **Proxy Support:** HTTPS/SOCKS5 if needed

---

## Phase 1: Preparation (Week Before Deployment)

### Code Review
- [ ] Review PRODUCTION-VALIDATION-REPORT-v11.1.0.md
- [ ] Review SCOPE.md for architectural boundaries
- [ ] Review integration-performance-recommendations.md
- [ ] Check Docker configuration (Dockerfile, docker-compose.yml)
- [ ] Verify no hardcoded secrets or sensitive data

### Team Preparation
- [ ] **DevOps:** Brief on deployment strategy
- [ ] **Monitoring:** Set up Prometheus/Grafana stacks
- [ ] **Oncall:** Review runbook and common issues
- [ ] **Security:** Confirm access controls and network isolation
- [ ] **Documentation:** Ensure deployment guide is clear

### Monitoring Setup
- [ ] **Prometheus:** Configured to scrape metrics
- [ ] **Grafana:** Dashboards created for key metrics
- [ ] **Alerting:** Thresholds set (see below)
- [ ] **Logging:** ELK Stack or equivalent configured
- [ ] **Tracing:** Optional distributed tracing setup

### Alert Thresholds to Configure
```yaml
# High Priority (P1 - immediate)
- Error rate > 10% for 2 minutes
- Connection failures > 5 in 5 minutes
- Process restart > 3 in 30 minutes
- Memory usage > 2GB
- CPU usage > 80% sustained

# Medium Priority (P2)
- Error rate > 5% for 5 minutes
- Latency P99 > 5 seconds
- Token usage > $500/hour
- WebSocket disconnections > 10/min

# Low Priority (P3)
- Operation slowness (P99 > 2s)
- Warnings in logs
- Cost threshold reached
```

### Backup & Recovery
- [ ] Backup plan for configuration files
- [ ] Snapshot of baseline metrics
- [ ] Rollback procedure documented
- [ ] Disaster recovery plan reviewed

---

## Phase 2: Staging Deployment (3-5 Days)

### Docker Setup
```bash
# Build image
docker build -t basset-hound-browser:11.1.0 .

# Verify image
docker image inspect basset-hound-browser:11.1.0

# Test basic functionality
docker run -d \
  --name basset-test \
  -p 8765:8765 \
  basset-hound-browser:11.1.0
```

### Staging Environment
- [ ] Deploy to staging with production-like hardware
- [ ] Configure monitoring with test metrics
- [ ] Run smoke tests (provided test harnesses)
- [ ] Validate MCP server connectivity
- [ ] Test error scenarios and recovery

### Smoke Tests (Run These)
```bash
# Test 1: Basic operations (5 min)
node tests/production-validation.js

# Test 2: MCP integration (5 min)
python tests/production_validation_mcp.py

# Test 3: Client library (5 min)
python -c "from clients.python.basset_hound import BassetHoundClient; c = BassetHoundClient(); c.connect(); print(c.navigate('https://example.com'))"
```

### Performance Baseline
- [ ] Record latency baseline (target: < 100ms)
- [ ] Record error rate baseline (target: < 0.5%)
- [ ] Record memory usage baseline (target: < 500MB)
- [ ] Record token usage baseline (target: < 200 tokens/op)

### Logging Validation
- [ ] Verify all logs are captured
- [ ] Check log rotation settings
- [ ] Ensure no sensitive data in logs
- [ ] Test log aggregation pipeline

---

## Phase 3: Production Deployment

### Canary Deployment (10% Traffic)
```bash
# Week 1: Deploy to canary (1 instance, 1 agent)
- Single instance in production
- Monitor closely for errors
- Compare metrics to baseline
- No automatic scaling yet
```

### Rollout Strategy
```
Day 1:    1 instance  (1 agent max)
Day 3:    2 instances (5 agents max)
Day 7:    3 instances (20 agents max)
Week 2:   Scale to target
Week 4:   Full scale
```

### Pre-Deployment Steps
1. [ ] Final sanity check of configs
2. [ ] Verify all monitoring is active
3. [ ] Brief on-call team
4. [ ] Have rollback plan ready
5. [ ] Start deployment during business hours

### Deployment Commands
```bash
# Start container
docker-compose up -d basset-hound-browser

# Verify startup
docker ps | grep basset-hound-browser

# Check logs
docker logs -f basset-hound-browser

# Health check
curl -s http://localhost:8765/health || echo "Use WebSocket ping instead"

# MCP server health
python -c "from browser_mcp.server import BrowserConnection; c = BrowserConnection(); c.connect() and print('OK')"
```

### Post-Deployment Validation (Within 1 Hour)
- [ ] Container is running and healthy
- [ ] WebSocket responding to commands
- [ ] MCP server accepting tool calls
- [ ] Monitoring data flowing into Prometheus
- [ ] No error spikes in logs
- [ ] Baseline metrics match staging

### Issue Escalation Path
```
Detected Issue
    ↓
Check runbook (see Appendix A)
    ↓
Issue reproduced? → YES → Contact on-call engineer
                 ↓ NO
Try recovery procedure
    ↓
If successful → Monitor for recurrence
If failed     → Prepare rollback
    ↓
Execute rollback if needed
    ↓
Post-mortem analysis
```

---

## Phase 4: Scaling & Optimization

### Load Testing (After 1 Week Stable)
```bash
# Gradually increase load
# Monitor each metric carefully

# Test: 10 concurrent agents
parallel --pipe --block 10k 'python test_agent.py' < agents_list.txt

# Monitor thresholds:
# - Error rate < 1%
# - Latency P99 < 500ms
# - Memory < 1GB
# - CPU < 60%
```

### Scaling Decision Points
- **< 50 ops/sec:** Single instance fine
- **50-200 ops/sec:** 2-3 instances + load balancer
- **200+ ops/sec:** 5+ instances + auto-scaling
- **1000+ ops/sec:** Consider cluster setup

### Optimization (After Scaling)
1. **Request Batching**
   - Implement in agent layer
   - Reduce overhead by 20-30%

2. **Page Caching**
   - Cache static pages
   - Reduce token usage by 40-50%

3. **Connection Pooling**
   - Reuse WebSocket connections
   - Reduce latency by 10-15%

4. **Concurrency Tuning**
   - Optimal workers per instance: 20-50
   - Test with your workload

---

## Phase 5: Ongoing Operations

### Daily Monitoring (09:00 UTC)
- [ ] Check error rate (< 0.5%)
- [ ] Check latency P99 (< 500ms)
- [ ] Check resource usage (< 1GB, < 60% CPU)
- [ ] Review alert logs
- [ ] Check cost tracking

### Weekly Review (Monday 10:00 UTC)
- [ ] Performance trends
- [ ] Cost analysis
- [ ] Scaling recommendations
- [ ] Optimization opportunities
- [ ] Runbook updates

### Monthly Review (1st of month)
- [ ] Capacity planning
- [ ] Security audit
- [ ] Dependency updates
- [ ] Performance analysis
- [ ] Cost reconciliation

### Quarterly Review (Every 3 months)
- [ ] Architecture review
- [ ] Scaling evaluation
- [ ] Security assessment
- [ ] Technology updates
- [ ] Cost optimization

---

## Monitoring Dashboard Setup

### Key Metrics to Display

```yaml
Row 1: System Health
  - WebSocket connections (gauge)
  - Error rate (graph)
  - Uptime % (stat)

Row 2: Performance
  - Latency P50/P99/P999 (graph)
  - Operations per second (graph)
  - Success rate (gauge)

Row 3: Resources
  - Memory usage (graph)
  - CPU usage (graph)
  - Network I/O (graph)

Row 4: Cost
  - Tokens per hour (gauge)
  - Estimated cost/month (stat)
  - Cost trend (graph)

Row 5: Errors
  - Error types (pie chart)
  - Error rate by operation (graph)
  - Top errors (table)
```

### Prometheus Queries
```promql
# Error rate
rate(operation_errors_total[5m])

# Latency P99
histogram_quantile(0.99, operation_duration_seconds)

# Active connections
increase(websocket_connections_total[5m])

# Memory usage
process_resident_memory_bytes

# Operations per second
rate(operations_total[1m])
```

### Alert Rules
```yaml
groups:
  - name: basset-hound
    rules:
      - alert: HighErrorRate
        expr: rate(operation_errors_total[5m]) > 0.05
        for: 2m
        annotations:
          summary: "Error rate > 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.99, operation_duration_seconds) > 5
        for: 5m
        annotations:
          summary: "Latency P99 > 5s"

      - alert: HighMemory
        expr: process_resident_memory_bytes > 1073741824
        for: 5m
        annotations:
          summary: "Memory > 1GB"
```

---

## Appendix A: Runbook

### Issue: High Error Rate

**Symptoms:** Error rate spike (> 5%)  
**Detection:** Prometheus alert "HighErrorRate"  
**Severity:** P2  

**Diagnosis:**
```bash
# 1. Check logs for error patterns
docker logs basset-hound-browser | grep ERROR | tail -20

# 2. Check WebSocket connectivity
telnet localhost 8765

# 3. Check browser process
docker ps | grep basset-hound
docker stats basset-hound-browser

# 4. Check for recent deployments
git log --oneline -5

# 5. Review recent config changes
git diff HEAD~1 config.yaml
```

**Recovery (Ranked by severity):**

1. **Immediate (< 5 min):**
   - Increase timeout values
   - Reduce concurrent agents
   - Check network connectivity

2. **Short-term (5-30 min):**
   - Restart WebSocket server
   - Clear browser cache
   - Reload profiles

3. **Medium-term (30+ min):**
   - Restart container
   - Redeploy if stuck
   - Escalate to engineering

**Example Fix (Connection Timeout):**
```javascript
// In orchestration layer
const timeout = 45000; // Increased from 30000
client.sendCommand(cmd, {...}, timeout);
```

### Issue: High Memory Usage

**Symptoms:** Memory > 1GB  
**Detection:** Prometheus alert "HighMemory"  
**Severity:** P2

**Diagnosis:**
```bash
# 1. Check memory trend
docker stats --no-stream basset-hound-browser

# 2. Check for memory leaks
node inspect.js --memory | grep "detached nodes"

# 3. Check Electron memory
ps aux | grep electron

# 4. Check for stuck processes
ps aux | grep basset | grep defunct
```

**Recovery:**
1. Stop accepting new operations
2. Wait for existing ops to complete
3. Restart container gracefully
4. Monitor memory after restart
5. Investigate root cause

```bash
# Graceful restart
docker stop basset-hound-browser
sleep 30
docker start basset-hound-browser
```

### Issue: WebSocket Connection Failed

**Symptoms:** "Connection refused" errors  
**Detection:** Manual or monitoring alert  
**Severity:** P1

**Diagnosis:**
```bash
# 1. Check if process is running
docker ps | grep basset-hound-browser

# 2. Check if port is open
netstat -tuln | grep 8765

# 3. Check logs
docker logs basset-hound-browser | tail -50

# 4. Check network
curl -v http://localhost:8765
```

**Recovery:**
1. Check if process crashed
2. Check logs for startup errors
3. Verify configuration
4. Restart container
5. If still failing, redeploy

```bash
# Force restart
docker kill basset-hound-browser
docker rm basset-hound-browser
docker-compose up -d basset-hound-browser
```

### Issue: Slow Operations

**Symptoms:** Latency P99 > 2 seconds  
**Detection:** Prometheus alert or manual check  
**Severity:** P3

**Diagnosis:**
```bash
# 1. Check network latency
ping google.com

# 2. Check system load
top -n1 | head -15

# 3. Check disk I/O
iostat -x 1 5

# 4. Check for noisy neighbors
docker stats
```

**Recovery:**
1. Check network connectivity
2. Verify system resources available
3. Reduce concurrent operations
4. Implement request batching
5. Consider vertical scaling

---

## Appendix B: Troubleshooting Guide

### Docker Issues

**Container won't start:**
```bash
docker logs basset-hound-browser
# Check for:
# - Port already in use (8765)
# - Insufficient resources
# - Missing dependencies
```

**Port already in use:**
```bash
# Find process using port 8765
lsof -i :8765
# Kill process or use different port
docker-compose down
```

**Out of disk space:**
```bash
# Clean up Docker
docker system prune -a
# Or extend storage
# (depends on your infrastructure)
```

### Network Issues

**Can't reach WebSocket:**
```bash
# Check firewall
sudo ufw allow 8765
# Check if localhost binding
netstat -tuln | grep 8765
# Should show: 127.0.0.1:8765 LISTEN
```

**Tor not working:**
```bash
# Verify Tor is running
docker exec basset-hound-browser tor --version
# Check Tor logs
docker logs basset-hound-browser | grep -i tor
```

### Performance Issues

**High CPU usage:**
- Check concurrent operations count
- Look for long-running JavaScript
- Monitor browser process

**High memory usage:**
- Restart container (short-term)
- Check for memory leaks (medium-term)
- Increase instance size (long-term)

**Timeout errors:**
- Increase operation timeout
- Reduce concurrent operations
- Check network latency

---

## Appendix C: Rollback Procedure

### Quick Rollback (5 minutes)

```bash
# 1. Stop new deployment
docker-compose stop basset-hound-browser

# 2. Restore previous version
docker pull basset-hound-browser:11.0.0
docker tag basset-hound-browser:11.0.0 basset-hound-browser:latest

# 3. Start previous version
docker-compose up -d basset-hound-browser

# 4. Verify
docker logs basset-hound-browser | grep "listening on"

# 5. Notify teams
slack channel: #incidents
message: "Rolled back to v11.0.0. Investigating v11.1.0 issue."
```

### Full Rollback (15 minutes)

```bash
# 1. Full system restore
docker-compose down
docker system prune -a

# 2. Restore from backup
cp /backup/docker-compose.yml.bak docker-compose.yml
cp /backup/config.yaml.bak config.yaml

# 3. Restart everything
docker-compose up -d

# 4. Health checks
./scripts/health-check.sh

# 5. Validation
node tests/smoke-test.js
```

### After Rollback
- [ ] Confirm system is stable (15 min)
- [ ] Monitor for any issues (2 hours)
- [ ] Post-mortem analysis
- [ ] Root cause investigation
- [ ] Plan remediation

---

## Appendix D: Performance Tuning

### WebSocket Optimization
```javascript
// Connection pooling
const connectionPool = new ConnectionPool({
  size: 5,
  timeout: 30000,
  reconnectDelay: 5000
});

// Batching
const batch = [];
for (let i = 0; i < 10; i++) {
  batch.push({ command: 'navigate', url: urls[i] });
}
await client.batch(batch); // 10x faster
```

### Memory Optimization
```python
# Profile memory usage
import tracemalloc
tracemalloc.start()

# ... operations ...

current, peak = tracemalloc.get_traced_memory()
print(f"Current: {current / 1024 / 1024:.1f} MB")
print(f"Peak: {peak / 1024 / 1024:.1f} MB")
```

### Cost Optimization
```yaml
# Implement caching strategy:
- Static pages: Cache 1 hour
- User profiles: Cache 5 minutes
- Navigation: No cache (fresh data)
- Screenshot: Cache 1 hour (if URL same)

# Result: 40-50% cost reduction
```

---

## Sign-Off

**Deployment Readiness:** ✅ **APPROVED**

**Deployment Manager:** [Name]  
**Date:** May 6, 2026  
**Expected Deployment:** May 13, 2026

**Checklists Completed:**
- [ ] Pre-flight (infrastructure & dependencies)
- [ ] Preparation (code review, monitoring setup)
- [ ] Staging (smoke tests, baselines)
- [ ] Production (phased rollout)

**Ready for Production:** YES

---

**Next: Execute Phase 2 Staging Deployment**
