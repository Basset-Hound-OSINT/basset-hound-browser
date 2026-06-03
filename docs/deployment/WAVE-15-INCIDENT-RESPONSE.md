# Wave 15 Incident Response Playbooks
## Basset Hound Browser v12.1.0 Deployment

**Document Version:** 1.0  
**Date:** June 2, 2026  
**Purpose:** Response procedures for deployment incidents  
**Scope:** Common deployment incident scenarios

---

## Incident Response Framework

### Response Phases

1. **Detection** (0-5 minutes): Identify the incident
2. **Assessment** (5-15 minutes): Understand scope and severity
3. **Response** (15-60 minutes): Execute remediation
4. **Recovery** (60+ minutes): Verify system stability
5. **Analysis** (post-incident): Determine root cause and prevent recurrence

### Severity Levels

| Level | Impact | Response Time | Action |
|-------|--------|---------------|--------|
| **P1 (Critical)** | Service down, customers affected | Immediate | Automatic rollback + page all leads |
| **P2 (High)** | Degraded performance, limited impact | <15 minutes | Investigate + escalate if needed |
| **P3 (Medium)** | Minor issues, no customer impact | <1 hour | Monitor and fix in next cycle |
| **P4 (Low)** | Informational, no action needed | <24 hours | Track for future improvement |

---

## Scenario 1: High Error Rate on Canary

**Symptoms:** Error rate >1% detected during canary monitoring

**Severity:** P1 (Critical)

**Detection:**
```bash
# Error rate monitoring detects threshold
Error count: 23 in last 100 requests
Error rate: 23%
Threshold: 1%
Status: TRIGGER ALERT
```

### Response Procedure

**Step 1: Immediate Notification (0-1 minutes)**
```bash
# Alert on-call engineer immediately
# This is automatic from monitoring system
# On-call engineer receives page/SMS

# Slack notification
echo "🚨 CRITICAL: Canary Error Rate Exceeded"
echo "Error rate: 23%"
echo "Threshold: 1%"
echo "Action: Initiating rollback..."
```

**Step 2: Collect Diagnostics (1-5 minutes)**
```bash
# Get canary container ID
CANARY=$(docker ps | grep basset-hound-v12.1.0-canary | awk '{print $NF}')

# Collect logs
docker logs $CANARY > /tmp/canary-failure-logs.txt

# Get detailed error information
docker logs $CANARY | grep ERROR | tail -20 > /tmp/canary-errors.txt

# Capture system state
docker stats --no-stream $CANARY > /tmp/canary-metrics.txt
```

**Step 3: Make Quick Decision (5 minutes)**
```bash
# Review error types
echo "=== Error Analysis ==="
grep -oE "Error: [^(]+" /tmp/canary-errors.txt | sort | uniq -c | sort -rn

# Common causes:
# - Memory exhaustion
# - Database connection pool exhausted
# - Timeout on external service
# - Configuration error
# - Dependency version mismatch
```

**Step 4: Execute Rollback (5-10 minutes)**
```bash
# If errors are application-level, rollback canary
# (See WAVE-15-ROLLBACK-PROCEDURES.md, "Single Instance Rollback")

docker stop $CANARY
docker rm $CANARY

# Verify v12.0.0 still running
docker ps | grep basset-hound-v12.0.0

# Test recovery
curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}'
```

**Step 5: Document and Analyze (Post-incident)**
```bash
# Create incident report
cat > /tmp/incident-canary-errors.txt << 'REPORT'
INCIDENT REPORT: Canary High Error Rate
========================================

Date: $(date)
Severity: P1 (Critical)
Duration: [TIME]

DETECTION:
- Error rate spike detected at [TIME]
- Error rate: 23% (threshold: 1%)
- Detection latency: < 2 minutes

ROOT CAUSE:
[Determine from logs]

IMPACT:
- Canary: Failed
- Production (v12.0.0): No impact
- Customers: No impact

RESPONSE:
- Rollback executed in 5 minutes
- Service recovered at [TIME]
- Zero customer impact

REMEDIATION:
1. [Fix for identified issue]
2. [Test to prevent recurrence]
3. [Deploy fix and retry]

LESSON LEARNED:
[What we learned from this incident]

REPORT

# Share report with team
echo "Incident report created: /tmp/incident-canary-errors.txt"
```

### Prevention

1. **Enhanced Testing:** Add error injection testing to staging
2. **Metrics Validation:** Monitor error rates in staging pre-deployment
3. **Canary Monitoring:** Increase alert sensitivity (0.5% instead of 1%)

---

## Scenario 2: Memory Leak During Phase 1

**Symptoms:** Memory growing steadily during Phase 1 monitoring

**Severity:** P1 (Critical)

**Detection:**
```
Baseline memory: 512MB (T+0:00)
Memory at T+15:00: 1.2GB
Memory at T+30:00: 2.0GB
Growth rate: ~50MB per 5 minutes
Status: MEMORY LEAK SUSPECTED
```

### Response Procedure

**Step 1: Immediate Assessment (0-5 minutes)**
```bash
# Identify affected instances
PHASE1_INSTANCES=("basset-hound-prod-instance-01" "basset-hound-prod-instance-02" "basset-hound-prod-instance-03")

for instance in "${PHASE1_INSTANCES[@]}"; do
  echo "Memory check: $instance"
  docker stats --no-stream $instance --format "table {{.Container}}\t{{.MemUsage}}"
done

# Capture memory details
for instance in "${PHASE1_INSTANCES[@]}"; do
  docker exec $instance ps aux --sort=-%mem | head -10 > /tmp/memory-${instance}.txt
done
```

**Step 2: Analyze Memory Pattern (5-15 minutes)**
```bash
# Check if leak is in one process or system-wide
echo "=== Process Memory Usage ==="
docker exec basset-hound-prod-instance-01 free -h

# Check for memory leaks in application
docker logs basset-hound-prod-instance-01 | grep -i "leak\|allocation\|gc"

# Look for specific process consuming memory
docker top basset-hound-prod-instance-01 -o %mem,cmd | head -5
```

**Step 3: Decision: Rollback or Monitor**

**If leak is critical and growing exponentially:**
```bash
# Rollback Phase 1 immediately
echo "Executing Phase 1 rollback due to memory leak..."
# (See WAVE-15-ROLLBACK-PROCEDURES.md, "Phase Rollback")
```

**If leak is slow and manageable:**
```bash
# Continue monitoring but prepare for rollback
echo "⚠️  Memory leak detected but manageable"
echo "   Will rollback if memory exceeds 4GB"

# Monitor with lower thresholds
while true; do
  MEM=$(docker stats --no-stream basset-hound-prod-instance-01 --format "{{.MemUsage}}" | grep -oE '^[0-9.]+')
  MEM_GB=$(echo "$MEM" | cut -d'.' -f1)
  
  if [ $MEM_GB -gt 4 ]; then
    echo "Memory exceeded safe limit, initiating rollback..."
    # Execute rollback
    break
  fi
  
  sleep 60
done
```

**Step 4: Post-Incident Analysis**
```bash
# Identify source of leak
echo "Analyzing memory leak source..."

# Check v12.1.0 specific changes
git log --oneline v12.0.0..v12.1.0 | head -20

# Look for common memory leak patterns:
# - Event listeners not removed
# - Timers not cleared
# - Objects retained in closures
# - Circular references

cat > /tmp/memory-leak-analysis.txt << 'ANALYSIS'
MEMORY LEAK ANALYSIS
====================

Pattern: Linear growth, ~50MB/5min
Duration: Detectable within 30 minutes
Severity: P1 if continues to 100% memory

Potential Causes:
1. Event listener accumulation
2. Timer/interval not cleared
3. Object pool exhaustion
4. Cache without eviction
5. Stream not closed

Files to Review:
- websocket/server.js (WebSocket connections)
- src/main/main.js (Electron lifecycle)
- evasion/ (Fingerprinting cache)

ANALYSIS

echo "Analysis complete: /tmp/memory-leak-analysis.txt"
```

### Prevention

1. **Memory Profiling:** Enable memory profiling in staging
2. **Baseline Comparison:** Compare v12.0.0 vs v12.1.0 memory profiles
3. **Load Testing:** Run load tests for 1+ hour to detect memory leaks

---

## Scenario 3: Latency Degradation During Phase 2

**Symptoms:** Response times degrading from <50ms to >200ms

**Severity:** P2 (High)

**Detection:**
```
Latency baseline: 45ms (P99)
Latency at T+1:30: 120ms (P99)
Latency at T+2:00: 250ms (P99)
Threshold: 100ms (warning), 500ms (critical)
Status: DEGRADATION TREND DETECTED
```

### Response Procedure

**Step 1: Identify Cause (5-15 minutes)**
```bash
# Check CPU usage
echo "=== CPU Usage ==="
for instance in basset-hound-prod-instance-01 basset-hound-prod-instance-02 basset-hound-prod-instance-03 \
                 basset-hound-prod-instance-04 basset-hound-prod-instance-05 basset-hound-prod-instance-06 \
                 basset-hound-prod-instance-07; do
  CPU=$(docker stats --no-stream $instance --format "{{.CPUPerc}}")
  echo "$instance: $CPU"
done

# Check network saturation
echo ""
echo "=== Network I/O ==="
docker stats --no-stream --format "table {{.Container}}\t{{.NetIO}}" | head -10

# Check disk I/O
echo ""
echo "=== Disk I/O ==="
iotop -b -n 1 -o -q

# Check request queue depth
echo ""
echo "=== Request Queue ==="
netstat -s | grep TCP | head -10
```

**Step 2: Common Latency Causes**

| Cause | Symptoms | Fix |
|-------|----------|-----|
| CPU exhaustion | CPU >80%, latency linear increase | Scale horizontally or optimize code |
| Memory pressure | High memory %, GC pauses | Check for memory leak, restart |
| Network saturation | Network I/O high, bandwidth used | Check for data transfer inefficiency |
| Disk I/O | Disk busy %, slow response | Check for excessive logging/writing |
| Connection pooling | Connection count high, timeouts | Increase pool size or close stale connections |

**Step 3: Mitigation Actions**

**If CPU is bottleneck:**
```bash
# Reduce load on affected instances temporarily
# Reduce traffic by adjusting load balancer weight
curl -s -X POST http://load-balancer:8080/backend/weight \
  -H "Content-Type: application/json" \
  -d '{"instance": "basset-hound-prod-instance-04", "weight": 50}'  # Reduce from 100

# Allow system to catch up
sleep 30

# Check if latency improves
curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' \
  -w "\nResponse time: %{time_total}s\n"
```

**If memory is issue:**
```bash
# Restart the affected instance to clear memory
docker restart basset-hound-prod-instance-04
sleep 10

# Monitor latency recovery
for i in {1..10}; do
  curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -w "[$(date '+%H:%M:%S')] Latency: %{time_total}s\n"
  sleep 5
done
```

**If degradation persists:**
```bash
# Consider rolling back the phase
echo "Latency degradation not improving"
echo "Initiating Phase 2 rollback..."
# (See WAVE-15-ROLLBACK-PROCEDURES.md)
```

**Step 4: Post-Incident**
```bash
# Create optimization plan
cat > /tmp/latency-optimization.txt << 'PLAN'
LATENCY DEGRADATION ANALYSIS
=============================

Cause: [Identified cause]
Peak latency: [MAX MS]
Impact duration: [TIME]
Customer impact: [YES/NO]

Optimization Plan:
1. [Optimization 1]
2. [Optimization 2]
3. [Optimization 3]

Timeline:
- Implement: [DATE]
- Test in staging: [DATE]
- Deploy: [DATE]

PLAN
```

### Prevention

1. **Baseline Profiling:** Establish baseline latency profiles
2. **Progressive Load Testing:** Gradually increase load to find inflection points
3. **Resource Limits:** Set container resource limits to prevent exhaustion

---

## Scenario 4: Dashboard Integration Failure

**Symptoms:** Dashboard metrics not updating or showing errors

**Severity:** P3 (Medium)

**Detection:**
```
Dashboard shows:
- Metrics: Last update 10+ minutes ago
- Errors: "Unable to fetch metrics"
- Latency graph: No data
Status: DASHBOARD CONNECTION BROKEN
```

### Response Procedure

**Step 1: Check Dashboard Service (0-5 minutes)**
```bash
# Verify dashboard is running
docker ps | grep dashboard
# Expected: dashboard container running

# Check dashboard logs
docker logs dashboard | tail -20

# Test dashboard endpoint
curl -s http://localhost:3000/api/metrics | jq .
```

**Step 2: Check Metrics Exporter (5-10 minutes)**
```bash
# Verify metrics exporter is running
ps aux | grep prometheus || ps aux | grep metrics

# Test metrics endpoint
curl -s http://localhost:9090/api/v1/targets | jq .

# Check if instances are registered
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected: >0 targets
```

**Step 3: Verify WebSocket Connectivity (10-15 minutes)**
```bash
# Check if dashboard can reach WebSocket
curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}'

# Check dashboard configuration
cat /etc/dashboard/config.json | jq '.websocket'
# Expected: {"host": "localhost", "port": 8765}

# Verify network connectivity
nc -zv localhost 8765
```

**Step 4: Remediation**

**If dashboard service is down:**
```bash
# Restart dashboard
docker restart dashboard

# Wait for startup
sleep 5

# Verify it's up
curl -s http://localhost:3000/api/health
```

**If metrics exporter is down:**
```bash
# Restart metrics exporter
systemctl restart prometheus

# Or via Docker
docker restart prometheus

# Verify it's up
curl -s http://localhost:9090/api/v1/status
```

**If WebSocket is unreachable:**
```bash
# This is serious - indicates v12.1.0 issue
# Check WebSocket service
docker logs $(docker ps | grep basset-hound-v12.1.0 | awk '{print $NF}') | tail -20

# If WebSocket is broken, consider deployment rollback
```

### Impact Assessment

- **Deployment Impact:** NONE (dashboard is monitoring tool, not production)
- **Monitoring Impact:** Metrics unavailable for ~5-10 minutes
- **Recommendation:** Fix dashboard, continue deployment (does not affect actual service)

---

## Scenario 5: Load Balancer Configuration Error

**Symptoms:** Traffic not distributed correctly, some instances not receiving requests

**Severity:** P2 (High)

**Detection:**
```
Expected traffic distribution (3 Phase 1 instances):
- Instance 01: 33% traffic (1,000 requests)
- Instance 02: 33% traffic (1,000 requests)
- Instance 03: 33% traffic (1,000 requests)

Actual distribution:
- Instance 01: 95% traffic (2,850 requests)
- Instance 02: 5% traffic (150 requests)
- Instance 03: 0% traffic (0 requests)

Status: TRAFFIC IMBALANCE DETECTED
```

### Response Procedure

**Step 1: Identify Load Balancer Issue (0-5 minutes)**
```bash
# Check load balancer status
curl -s http://load-balancer:8080/status | jq .

# Get current configuration
curl -s http://load-balancer:8080/backends | jq '.backends[] | {name, weight, connections}'

# Check if instances are marked healthy
curl -s http://load-balancer:8080/health | jq '.backends[] | {name, status}'
```

**Step 2: Verify Instance Health**
```bash
# Test each instance directly
for instance in basset-hound-prod-instance-01 basset-hound-prod-instance-02 basset-hound-prod-instance-03; do
  echo "Testing $instance:"
  curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 || echo "❌ NOT responding"
done
```

**Step 3: Fix Load Balancer**

**If backend weight is incorrect:**
```bash
# Set correct weights
for instance in basset-hound-prod-instance-01 basset-hound-prod-instance-02 basset-hound-prod-instance-03; do
  curl -s -X POST http://load-balancer:8080/backend/weight \
    -H "Content-Type: application/json" \
    -d "{\"instance\": \"$instance\", \"weight\": 100}"
done

# Verify new distribution
sleep 10
curl -s http://load-balancer:8080/stats | jq '.backends[] | {name, traffic_percent}'
```

**If instance is marked unhealthy:**
```bash
# Check why instance is marked unhealthy
curl -s http://load-balancer:8080/backends | jq '.[] | select(.name=="basset-hound-prod-instance-02") | .health_status'

# Verify instance is actually healthy
curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}'

# If healthy, mark as healthy in load balancer
curl -s -X POST http://load-balancer:8080/backend/health \
  -H "Content-Type: application/json" \
  -d '{"instance": "basset-hound-prod-instance-02", "status": "healthy"}'
```

**Step 4: Monitor Traffic Recovery**
```bash
# Monitor for 5 minutes
for i in {1..10}; do
  sleep 30
  curl -s http://load-balancer:8080/stats | jq '.backends[] | {name, requests_since_start}' | head -6
  echo ""
done

echo "✅ Traffic distribution verified"
```

### Prevention

1. **Health Check Validation:** Test health checks match actual instance status
2. **Configuration Versioning:** Version load balancer configs, easy rollback
3. **Traffic Monitoring:** Continuous monitoring of traffic distribution

---

## Escalation Matrix

```
P1 (Critical) Incident
├── Immediate: Page on-call engineer (SMS/Phone)
├── 1 min: Notify team lead
├── 5 min: Notify engineering manager
└── 10 min: Notify CTO if still unresolved

P2 (High) Incident
├── Notify: Slack @oncall
├── 5 min: Team lead assessment
├── 15 min: Decide on escalation
└── 1 hour: Resolution required

P3 (Medium) Incident
├── Notify: Slack #deployment-status
├── 1 hour: Assess impact
├── 4 hours: Resolution target
└── 24 hours: Hard deadline

P4 (Low) Incident
├── Track: Add to incident log
├── Document: Include in post-deployment report
└── Follow-up: Schedule for next cycle
```

---

## Incident Communication Template

```
Slack Channel: #deployment-status

[TIME] 🚨 INCIDENT DETECTED
Type: [INCIDENT TYPE]
Severity: [P1/P2/P3/P4]
Status: [INVESTIGATING/MITIGATING/RESOLVED]

Description: [Brief description]
Affected Instances: [LIST]
Customer Impact: [YES/NO]

Current Status: [CURRENT ACTION]
ETA to resolution: [TIME]

---

[TIME] 🔄 INVESTIGATION UPDATE
Finding: [New finding]
Action: [Action taken]
Next step: [Next step]

---

[TIME] ✅ INCIDENT RESOLVED
Root cause: [ROOT CAUSE]
Resolution: [WHAT WAS DONE]
Duration: [START TO END TIME]

Post-incident review scheduled for [DATE]
```

---

## Document Metadata

**Document ID:** WAVE-15-INCIDENTS  
**Version:** 1.0  
**Status:** Ready for use  
**Last Updated:** June 2, 2026

**Related Documents:**
- WAVE-15-DEPLOYMENT-STRATEGY.md
- WAVE-15-ROLLBACK-PROCEDURES.md
- WAVE-15-CANARY-RUNBOOK.md

---

**End of Incident Response Guide**

*This guide provides specific procedures for common deployment incidents. By following these playbooks, teams can respond quickly and effectively to deployment issues while maintaining service stability.*
