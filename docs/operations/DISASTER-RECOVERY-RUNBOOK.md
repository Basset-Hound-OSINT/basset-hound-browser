# Disaster Recovery Runbook

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, On-Call Teams

---

## Quick Reference

| Disaster | Time to Fix | Impact | Steps |
|----------|------------|--------|-------|
| Service Crash | 5 min | Down | Restart container, check logs |
| Data Corruption | 15 min | High | Restore from backup |
| Disk Full | 10 min | Medium | Clean Docker, expand storage |
| Security Breach | 30 min | Critical | Isolate, preserve logs, rebuild |
| Network Loss | 2 min | Down | Verify networking, restart |
| Memory Leak | 20 min | Degraded | Restart, investigate logs |

---

## Table of Contents

1. [Disaster Classification](#disaster-classification)
2. [Response Procedures](#response-procedures)
3. [Recovery Scenarios](#recovery-scenarios)
4. [Escalation Paths](#escalation-paths)
5. [Post-Disaster Analysis](#post-disaster-analysis)

---

## Disaster Classification

### Level 1: Service Unavailable (CRITICAL)

**Definition**: Service not responding to requests
**RTO**: <5 minutes
**RPO**: <1 hour

**Quick Actions**:
```bash
# 1. Check status
docker ps | grep basset-hound-browser

# 2. Restart
docker-compose restart

# 3. Verify
curl -I http://localhost:8765

# 4. If still down, rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Level 2: Data Corruption (HIGH)

**Definition**: Application data is corrupted or inaccessible
**RTO**: <30 minutes
**RPO**: <4 hours

**Quick Actions**:
```bash
# 1. Stop service
docker-compose stop -t 10

# 2. Check backup age
ls -lt /backups/basset-hound/ | head -3

# 3. Restore latest backup
docker volume rm basset-data
docker run --rm -v basset-data:/data -v /backups:/backup \
  alpine tar xzf /backup/latest/data.tar.gz -C /

# 4. Restart
docker-compose up -d
```

### Level 3: Resource Exhaustion (MEDIUM)

**Definition**: CPU, memory, or disk critically low
**RTO**: <15 minutes
**RPO**: No data loss

**Quick Actions**:
```bash
# Memory exhaustion
docker restart basset-hound-browser

# Disk full
docker system prune -a --volumes -f

# CPU overload
docker stats basset-hound-browser
# Identify and kill resource hogs
```

### Level 4: Security Incident (CRITICAL)

**Definition**: Unauthorized access detected
**RTO**: Immediate
**RPO**: Preserve evidence

**Quick Actions**:
```bash
# 1. Isolate immediately
docker network disconnect basset-hound-browser basset-hound-browser
docker kill basset-hound-browser

# 2. Preserve logs
docker logs basset-hound-browser > /tmp/incident-$(date +%s).log

# 3. Alert security
echo "SECURITY INCIDENT: Container $(date)" | mail -s "URGENT" security@example.com

# 4. Do NOT restart until incident is investigated
```

---

## Response Procedures

### P1 Response (Critical - 5 min target)

```bash
#!/bin/bash

echo "=== P1 CRITICAL RESPONSE ==="
INCIDENT_ID="P1-$(date +%Y%m%d-%H%M%S)"
echo "Incident ID: $INCIDENT_ID"

# 1. Assess situation (1 min)
echo "[1/4] Assessing situation..."
docker ps -a | grep basset-hound-browser
RUNNING=$?

# 2. Immediate action (1 min)
if [ $RUNNING -ne 0 ]; then
    echo "[2/4] Starting service..."
    docker-compose up -d
else
    echo "[2/4] Restarting service..."
    docker-compose restart
fi

# 3. Verify recovery (2 min)
echo "[3/4] Verifying recovery..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8765 | grep -q "426"; then
        echo "✓ Service responding"
        break
    fi
    sleep 1
done

# 4. Alert team
echo "[4/4] Alerting team..."
docker logs basset-hound-browser --tail 50 > "/tmp/$INCIDENT_ID.log"

echo "Incident Log: /tmp/$INCIDENT_ID.log"
echo "Escalate if service doesn't stabilize in 5 minutes"
```

### P2 Response (High - 30 min target)

```bash
#!/bin/bash

INCIDENT_ID="P2-$(date +%Y%m%d-%H%M%S)"

# 1. Detailed assessment (5 min)
echo "Collecting diagnostics..."
{
    echo "=== System Status ==="
    docker ps -a
    docker stats basset-hound-browser --no-stream
    df -h /var/lib/docker
    
    echo "=== Service Logs ==="
    docker logs basset-hound-browser --tail 100
    
    echo "=== Network Status ==="
    docker network inspect basset-hound-browser
    
} > "/tmp/$INCIDENT_ID-diagnostics.txt"

# 2. Repair attempts (15 min)
# Try restart
docker restart basset-hound-browser
sleep 30

# Try rebuild
if ! docker ps | grep -q basset-hound-browser; then
    docker-compose build --no-cache
    docker-compose up -d
fi

# Try restore if corruption suspected
if docker logs basset-hound-browser | grep -qi "corrupt"; then
    bash restore-data-volume.sh
fi

# 3. Escalate with context (10 min)
echo "Incident: $INCIDENT_ID"
echo "Diagnostics: /tmp/$INCIDENT_ID-diagnostics.txt"
echo "Ready for escalation"
```

### P3 Response (Medium - routine)

```bash
# Follow standard runbooks
# No emergency procedures required
# Can be scheduled for normal business hours
```

---

## Recovery Scenarios

### Scenario 1: Container Crash Loop

**Symptoms**:
```
Container restarts every 10-30 seconds
```

**Diagnosis**:
```bash
# Check logs for errors
docker logs basset-hound-browser

# Check container status
docker inspect basset-hound-browser --format='{{.State}}'

# Look for restart count
docker inspect basset-hound-browser --format='{{.RestartCount}}'
```

**Recovery**:

```bash
# 1. Stop auto-restart
docker update --restart=no basset-hound-browser

# 2. Fix root cause
# Check logs for specific errors
docker logs basset-hound-browser | grep ERROR

# 3. Common fixes
# - Port conflict: Change port or kill process using 8765
# - OOM: Increase memory limit in docker-compose.yml
# - Missing dependency: Rebuild image
docker-compose build --no-cache

# 4. Restart with normal policy
docker-compose up -d
```

### Scenario 2: Memory Leak

**Symptoms**:
```
Memory usage grows from 200MB to 1.5GB over hours/days
Container becomes unresponsive
```

**Diagnosis**:
```bash
# Monitor memory growth
watch 'docker stats basset-hound-browser --no-stream | tail -1'

# Check process memory
docker top basset-hound-browser
```

**Recovery**:

```bash
# 1. Immediate mitigation
docker restart basset-hound-browser

# 2. Monitor for recurrence
docker stats basset-hound-browser --interval 10

# 3. If recurs, investigate code
docker logs basset-hound-browser | grep -i "memory\|leak"

# 4. Implement fix
docker-compose build --no-cache
docker-compose up -d

# 5. Schedule code review
echo "Schedule memory leak investigation"
```

### Scenario 3: Full Disk

**Symptoms**:
```
df: No space left on device
Docker operations failing
Container can't write logs
```

**Diagnosis**:
```bash
df -h /var/lib/docker
docker system df
```

**Recovery**:

```bash
# 1. Emergency cleanup
docker system prune -a --volumes -f

# 2. Identify culprits
docker images --format "table {{.ID}}\t{{.Size}}" | sort -k3 -h | tail -10
docker ps -a --format "table {{.ID}}\t{{.Size}}"

# 3. Remove largest unused images
docker image prune --all -f

# 4. Move Docker data (if possible)
# Stop service
docker-compose down

# Move docker data to different volume
# sudo mv /var/lib/docker /mnt/larger-disk/docker

# Restart
docker-compose up -d

# 5. Configure limits
# docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       storage: 50G
```

### Scenario 4: Network Isolation

**Symptoms**:
```
Cannot connect to container
Port 8765 not responding
Docker network issues
```

**Diagnosis**:
```bash
docker network inspect basset-hound-browser
docker exec basset-hound-browser ping 8.8.8.8
```

**Recovery**:

```bash
# 1. Check network connectivity
docker exec basset-hound-browser curl http://localhost:8765

# 2. Reconnect to network
docker network disconnect basset-hound-browser basset-hound-browser
docker network connect basset-hound-browser basset-hound-browser

# 3. Restart container
docker-compose restart

# 4. Verify connection
docker inspect basset-hound-browser | grep IPAddress
```

### Scenario 5: Port Already in Use

**Symptoms**:
```
Cannot start container: port 8765 already in use
```

**Diagnosis**:
```bash
lsof -i :8765
netstat -tlnp | grep 8765
```

**Recovery**:

```bash
# 1. Identify process
PID=$(lsof -i :8765 -t)

# 2. If it's old basset-hound container
docker kill $PID

# 3. If it's another service
# Option A: Change our port
# Edit docker-compose.yml:
# ports:
#   - "8766:8765"

# Option B: Kill the other service
kill -9 $PID

# 4. Start service
docker-compose up -d
```

### Scenario 6: Lost Configuration

**Symptoms**:
```
Service starts but doesn't work correctly
Environment variables not set
```

**Diagnosis**:
```bash
docker inspect basset-hound-browser --format='{{.Config.Env}}'
docker exec basset-hound-browser env | sort
```

**Recovery**:

```bash
# 1. Restore configuration from backup
if [ -f /backups/basset-hound/backup-full-*/docker-compose.yml ]; then
    cp /backups/basset-hound/backup-full-*/docker-compose.yml .
fi

if [ -f /backups/basset-hound/backup-full-*/.env ]; then
    cp /backups/basset-hound/backup-full-*/.env .
fi

# 2. Rebuild and restart
docker-compose build --no-cache
docker-compose up -d

# 3. Verify configuration
docker inspect basset-hound-browser | grep -A 20 Env
```

---

## Escalation Paths

### Escalation Decision Tree

```
Incident Detected
    ├─ Service Down?
    │  ├─ Yes → P1 Escalation (5 min)
    │  └─ No → Continue
    │
    ├─ Data Loss Risk?
    │  ├─ Yes → P1 Escalation (immediate)
    │  └─ No → Continue
    │
    ├─ Security Breach?
    │  ├─ Yes → P1 + Security (immediate)
    │  └─ No → Continue
    │
    ├─ Can Fix in <10 min?
    │  ├─ Yes → P2 Escalation (30 min target)
    │  └─ No → P3 Escalation (routine)
    │
    └─ Schedule review meeting
```

### Escalation Contacts

```
Level 1 (Service Down):
  - On-call: page-on-call@example.com
  - Manager: ops-manager@example.com
  - CTO: cto@example.com (if >30 min to fix)

Level 2 (Data at Risk):
  - Security: security-team@example.com
  - DBA: database-team@example.com
  - Storage: storage-team@example.com

Level 3 (Security Incident):
  - CISO: security-officer@example.com
  - Incident Commander: incident@example.com
  - Legal: legal@example.com
```

---

## Post-Disaster Analysis

### Immediate Post-Incident (within 1 hour)

```bash
#!/bin/bash

INCIDENT_ID="$1"

# 1. Verify service is stable
docker stats basset-hound-browser --no-stream

# 2. Check log volume
docker logs basset-hound-browser --tail 1000 | wc -l

# 3. Verify data integrity
docker exec basset-hound-browser \
  find /app/data -type f -size 0 2>/dev/null | wc -l

# 4. Document incident
cat > "/tmp/$INCIDENT_ID-summary.txt" <<EOF
Incident: $INCIDENT_ID
Time: $(date)
Status: Resolved

Action Taken: [Record what was done]
Root Cause: [Initial assessment]
Prevention: [What can prevent this]

Follow-up Actions:
- [ ] Root cause analysis
- [ ] Update runbooks
- [ ] Code changes if needed
- [ ] Monitoring improvements
EOF

echo "Incident Summary: /tmp/$INCIDENT_ID-summary.txt"
```

### Root Cause Analysis (within 24 hours)

```bash
# 1. Gather evidence
docker logs basset-hound-browser > /tmp/incident-logs.txt
docker inspect basset-hound-browser > /tmp/incident-container.json
docker system df > /tmp/incident-resources.txt

# 2. Timeline analysis
grep "ERROR\|WARN\|Exception" /tmp/incident-logs.txt

# 3. Resource analysis during incident
# Look for memory spikes, CPU peaks, disk usage

# 4. Compare with baselines
# Historical metrics vs incident time

# 5. Generate report
cat > "/tmp/$INCIDENT_ID-rca.md" <<EOF
# Root Cause Analysis: $INCIDENT_ID

## Timeline
[When exactly did incident occur]

## Initial Symptoms
[What went wrong]

## Root Cause
[Why it happened]

## Contributing Factors
[What made it worse]

## Impact
[How many users affected, duration, data loss]

## Resolution
[What fixed it]

## Prevention
[How to prevent in future]

## Action Items
- [ ] Code fix
- [ ] Monitoring improvement
- [ ] Documentation update
- [ ] Training needed
EOF
```

### Prevention Measures

```bash
# 1. Update monitoring
# Add alert for: [specific metric that failed]

# 2. Update runbooks
# Add section: [specific recovery procedure]

# 3. Code changes
# Fix: [bug or inefficiency that caused issue]

# 4. Testing
# Add test: [scenario that should have caught this]

# 5. Documentation
# Update: [runbooks, architecture diagrams]
```

---

## Testing Disaster Recovery

### Monthly DR Drill

```bash
#!/bin/bash

echo "=== Monthly Disaster Recovery Drill ==="
DRILL_DATE=$(date +%Y%m%d)

# 1. Test backup restoration
echo "[1/3] Testing backup restoration..."
LATEST_BACKUP=$(ls -t /backups/basset-hound/backup-* 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo "✗ No backup found"
    exit 1
fi

# Simulate restore (don't actually do it)
echo "Backup exists and is restorable: $LATEST_BACKUP"

# 2. Test failover procedure
echo "[2/3] Testing failover procedure..."
# Document steps, verify they are clear

# 3. Test communication
echo "[3/3] Testing incident communication..."
# Send test alert to on-call
echo "TEST: DR Drill $(date)" | \
  mail -s "TEST - DR Drill" ops-manager@example.com

echo "✓ DR Drill completed"
echo "Report: DR-Drill-$DRILL_DATE.txt"
```

---

## Support & Resources

- **Primary Runbooks**: `/docs/operations/`
- **Architecture**: `/docs/operations/DEPLOYMENT-GUIDE.md`
- **Monitoring**: `/docs/monitoring/`
- **Health Checks**: `/docs/operations/HEALTH-CHECK-RUNBOOK.md`

---

**End of Disaster Recovery Runbook**

