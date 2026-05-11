# v12.0.0 Deployment Quick Start Guide

**Purpose:** Get deployment team started in 5 minutes  
**Audience:** Deployment Lead, Technical Lead, SRE Lead  
**Date:** May 11, 2026

---

## What You Need to Know (TL;DR)

**v12.0.0 deployment has 3 main phases:**

1. **CANARY** (45 min + 4h monitoring) → Test on 1 instance → Decide GO/NO-GO
2. **PROGRESSIVE ROLLOUT** (6 hours) → Roll out to 25% → 50% → 100%
3. **VALIDATION** (at 1h, 24h, 1 week) → Confirm stability and performance

**If anything breaks:** Use ROLLBACK-RUNBOOK.md (5 minutes back to v11.3.0)

---

## Quick Start Checklist

### 48 Hours Before Deployment

- [ ] Read DEPLOYMENT-RUNBOOKS-INDEX.md (overview)
- [ ] Confirm team availability
- [ ] Verify v12.0.0 Docker image is built
- [ ] Set up monitoring dashboards (see PRODUCTION-MONITORING.md)
- [ ] Create communication channels (Slack, war room)
- [ ] Print quick reference cards (end of this document)

### 1 Hour Before Deployment

- [ ] Open CANARY-DEPLOYMENT-RUNBOOK.md → "PRE-DEPLOYMENT CHECKLIST"
- [ ] Work through the 30-minute checklist
- [ ] Confirm all items ✓ completed
- [ ] Team ready? → Proceed to canary deployment

### During Canary (4.5 hours)

1. **Deployment (10 min):** Follow "CANARY DEPLOYMENT PROCEDURE"
2. **Monitoring (4 hours):** Monitor every 15-30 minutes using checklist
3. **Decision (5 min):** Review go/no-go criteria → Decide

**Result:** GO → Progressive Rollout | NO-GO → Rollback → Stop

### During Progressive Rollout (6 hours)

1. **Stage 1 (2 hours):** 25% rollout + monitoring
2. **Stage 2 (2 hours):** 50% rollout + monitoring
3. **Stage 3 (1 hour):** 100% rollout + monitoring

**At each stage:** GO → Next stage | NO-GO → Rollback → Stop

### Post-Deployment (1 week)

1. **1-Hour:** Infrastructure + functional + performance checks
2. **24-Hour:** Stability and load testing
3. **1-Week:** Comprehensive review and release sign-off

---

## The 5 Runbooks at a Glance

### 1. CANARY-DEPLOYMENT-RUNBOOK.md

**When:** First deployment phase  
**Time:** 45 min + 4 hours  
**Key Sections:**
- Line 30: Pre-deployment checklist
- Line 150: Deployment procedure
- Line 250: Monitoring checklist
- Line 400: Go/No-Go decision criteria
- Line 500: Rollback if needed

**Quick Summary:**
```
1. Pre-deployment checklist (30 min)
2. Deploy v12.0.0 to canary instance (10 min)
3. Monitor for 4 hours
4. Decide: GO or NO-GO
5. If GO: Progressive Rollout
   If NO-GO: Rollback
```

### 2. PROGRESSIVE-ROLLOUT-RUNBOOK.md

**When:** After canary GO decision  
**Time:** 6 hours total  
**Key Sections:**
- Line 50: Pre-rollout verification
- Line 150: Stage 1 (25%) - 2 hours
- Line 300: Stage 2 (50%) - 2 hours
- Line 450: Stage 3 (100%) - 1 hour
- Line 600: Rollback at any stage

**Quick Summary:**
```
Stage 1: 25% (2-3 instances) → 2 hours
Stage 2: 50% (5 instances) → 2 hours
Stage 3: 100% (10 instances) → 1 hour
Decision at each stage: Continue or Rollback
```

### 3. ROLLBACK-RUNBOOK.md

**When:** Critical issues detected (any time)  
**Time:** < 5 minutes  
**Key Sections:**
- Line 30: Automatic triggers (no approval needed)
- Line 80: Approved rollback (needs approval)
- Line 150: Single instance rollback
- Line 200: Fleet-wide rollback
- Line 300: Verification and communication

**Quick Summary:**
```
1. Stop v12.0.0 container (30 sec)
2. Start v11.3.0 container (1 min)
3. Verify health (30 sec)
4. Restore to load balancer (1 min)
5. Notify team (1 min)
Total: < 5 minutes
```

### 4. PRODUCTION-MONITORING.md

**When:** Set up 1 hour before deployment, monitor throughout  
**Duration:** Ongoing  
**Key Sections:**
- Line 20: Monitoring architecture
- Line 150: Key metrics to monitor (13 categories)
- Line 400: Alert thresholds by stage
- Line 600: Grafana dashboards
- Line 800: Incident response procedures

**Key Metrics:**
- WebSocket latency (p95)
- Error rate
- Memory usage
- CPU usage
- Command success rate

**Alert Levels:**
- CRITICAL → Automatic rollback
- WARNING → Investigation
- INFO → Status updates

### 5. POST-DEPLOYMENT-VALIDATION.md

**When:** After 100% rollout complete  
**Checkpoints:** 1-hour, 24-hour, 1-week  
**Key Sections:**
- Line 50: 1-hour validation (infrastructure + functional + performance)
- Line 300: 24-hour stability check
- Line 500: 1-week performance review

**1-Hour Validation (15 min):**
```
✓ Infrastructure health (3 min)
✓ Functional tests (5 min)
✓ Performance baseline (4 min)
✓ Log analysis (2 min)
→ Result: PASS/FAIL
```

---

## Critical Go/No-Go Decision Points

### After Canary (4-hour mark)

**GO if all TRUE:**
- Container running 4h no restarts ✓
- 100% health checks passing ✓
- Latency ±10% of baseline ✓
- Error rate ≤ 3× baseline ✓
- Core commands working ✓
- Team agrees ✓

**NO-GO if any TRUE:**
- Container restarted ✗
- Health checks fail > 5% ✗
- Latency > baseline × 1.3 ✗
- Error rate > baseline × 5 ✗
- Core command failures ✗
- Team concern ✗

### After Each Rollout Stage

**GO to next stage if:**
- Previous stage 0 restarts
- All metrics ±15% baseline
- Error rate acceptable
- Team sign-off

**ROLLBACK if:**
- Any metric > ±30% baseline
- Error rate > baseline × 3
- Customer complaints
- Data integrity issues

---

## Emergency Procedures

### Container Won't Start

```bash
# 1. Check logs
docker logs basset-hound-browser | tail -50

# 2. Verify image
docker images | grep v12.0.0

# 3. Check port
netstat -tlnp | grep 8765

# 4. If stuck: Execute ROLLBACK-RUNBOOK.md
```

### High Error Rate

```bash
# 1. Check error pattern
docker logs --tail=100 basset-hound-browser | grep ERROR

# 2. Is it systematic?
# Yes → ROLLBACK-RUNBOOK.md
# No → Investigate and monitor

# 3. If unsure: ROLLBACK-RUNBOOK.md
```

### WebSocket Down

```bash
# 1. Verify listening
docker exec basset-hound-browser netstat -tlnp | grep 8765

# 2. Test locally
curl http://localhost:8765

# 3. If down: ROLLBACK-RUNBOOK.md
```

### Memory Leak Detected

```bash
# 1. Confirm growth
docker stats --no-stream

# 2. If > 10% per hour: ROLLBACK-RUNBOOK.md

# 3. Or escalate to investigation
```

---

## File Reference

| Document | Path | Size | Read For... |
|----------|------|------|-------------|
| Quick Start | `/docs/DEPLOYMENT-QUICK-START.md` | 4 KB | Overview (this file) |
| Index | `/docs/DEPLOYMENT-RUNBOOKS-INDEX.md` | 18 KB | Complete overview |
| Canary | `/docs/CANARY-DEPLOYMENT-RUNBOOK.md` | 17 KB | First phase (45m + 4h) |
| Rollout | `/docs/PROGRESSIVE-ROLLOUT-RUNBOOK.md` | 20 KB | Stages 1-3 (6h) |
| Rollback | `/docs/ROLLBACK-RUNBOOK.md` | 16 KB | Emergency recovery (5m) |
| Monitoring | `/docs/PRODUCTION-MONITORING.md` | 25 KB | Metrics & alerts setup |
| Validation | `/docs/POST-DEPLOYMENT-VALIDATION.md` | 29 KB | Validation checks (1h, 24h, 1w) |

**Total:** ~130 KB of comprehensive deployment documentation

---

## Typical Deployment Timeline

```
Monday 9:00 AM
├─ Pre-deployment checklist (30 min)
│
Monday 10:00 AM
├─ CANARY DEPLOYMENT (45 min)
│  └─ 10:00 - 10:45: Deploy & start monitoring
│
Monday 10:45 AM - 2:45 PM
├─ MONITORING (4 hours)
│  └─ Every 15 min (1st hour), every 30 min (rest)
│
Monday 2:45 PM
├─ GO/NO-GO DECISION (5 min)
│  └─ GO: Continue to rollout
│     NO-GO: Execute rollback, stop
│
Monday 2:50 PM - 8:50 PM
├─ PROGRESSIVE ROLLOUT (6 hours)
│  ├─ Stage 1 (25%): 2:50 - 4:50 PM
│  ├─ Stage 2 (50%): 4:50 - 6:50 PM
│  └─ Stage 3 (100%): 6:50 - 8:50 PM
│
Monday 8:50 PM - 9:05 PM
├─ 1-HOUR VALIDATION (15 min)
│  └─ Infrastructure + functional + performance
│
Tuesday 8:50 AM (24-hour mark)
├─ 24-HOUR STABILITY CHECK (30 min)
│  └─ Uptime + performance + load test
│
Next Monday (1-week mark)
├─ 1-WEEK PERFORMANCE REVIEW (1 hour)
│  └─ Comprehensive review + sign-off
│
└─ v12.0.0 PRODUCTION READY
```

---

## Quick Reference: Key Commands

### Deployment

```bash
# Deploy v12.0.0
docker pull registry.basset-prod.local/basset-hound-browser:v12.0.0
docker stop basset-hound-browser --time=30
docker rm basset-hound-browser
docker run -d --name basset-hound-browser \
  --network basset-hound-browser -p 8765:8765 \
  basset-hound-browser:v12.0.0
sleep 30
```

### Health Check

```bash
# Quick health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:8765
# Should return 426

# Full WebSocket test
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({cmd: 'getStatus'}));
  ws.on('message', (msg) => { console.log(msg); ws.close(); });
  setTimeout(() => { ws.close(); process.exit(1); }, 3000);
});
"
```

### Rollback

```bash
# Quick rollback (single instance)
docker stop basset-hound-browser --time=10
docker rm basset-hound-browser
docker run -d --name basset-hound-browser \
  --network basset-hound-browser -p 8765:8765 \
  basset-hound-browser:v11.3.0
sleep 30
curl -s -o /dev/null -w "%{http_code}" http://localhost:8765
```

### Monitoring

```bash
# Container stats
docker stats --no-stream basset-hound-browser

# Recent errors
docker logs --tail=100 basset-hound-browser | grep -i error

# Check version
docker inspect basset-hound-browser | jq '.[0].Config.Image'

# Load balancer status
curl -s http://load-balancer:8080/stats | jq '.backends | length'
```

---

## Team Communication Template

### Pre-Deployment (24h before)

```
📌 v12.0.0 Deployment Scheduled

Deployment Window: [DAY] [TIME] UTC
Duration: ~12 hours (canary + rollout + validation)
Target: Upgrade from v11.3.0 to v12.0.0

Status: Canary → 25% → 50% → 100%
Go/No-Go checkpoints at: +4h, +6h, +8h, +9h

Channels: #deployments, #incidents

Questions? Reach out before window starts.
```

### Deployment Started

```
🚀 v12.0.0 Deployment STARTED

Timeline:
- Phase 1 (Canary): [TIME] - [TIME] (45m + 4h monitoring)
- Phase 2 (Rollout): [TIME] - [TIME] (6 hours)
- Phase 3 (Validation): [TIME] - [TIME] (ongoing)

Status: CANARY DEPLOYMENT IN PROGRESS

Monitoring: [Dashboard Link]
Incidents: #incidents
Status: [GREEN/YELLOW/RED]
```

### Stage Progression

```
✅ Canary: GO DECISION

Metrics:
- Uptime: 4h, 0 restarts ✓
- Health checks: 100% ✓
- Latency: 120ms (baseline: 120ms) ✓
- Error rate: 0.3% (baseline: 0.3%) ✓

Decision: PROCEED TO PROGRESSIVE ROLLOUT

Next: Stage 1 (25%) deployment at [TIME]
```

### Deployment Complete

```
✅ v12.0.0 DEPLOYMENT COMPLETE

Final Status:
- All 10 instances: Running v12.0.0 ✓
- Health: 100% ✓
- Performance: Baseline ✓
- Errors: Minimal ✓

Next Steps:
- 1-hour validation: [TIME]
- 24-hour check: [TIME]
- 1-week review: [TIME]

Monitoring continues. 🟢 GREEN status.
```

### If Rollback Needed

```
⚠️ ROLLBACK INITIATED

Reason: [Brief reason]
Duration: 5 minutes
Target: v11.3.0 (restoration)

Timeline:
- 00:00 - Issue detected
- 00:30 - Container stopped
- 01:30 - v11.3.0 restored
- 02:00 - Verification complete
- 02:30 - All systems normal

Status: PRODUCTION STABLE

Post-incident review to follow.
```

---

## Troubleshooting Decision Tree

```
Issue Detected?
│
├─ Container won't start?
│  └─ Check logs, verify image, check port
│     → If can't fix: ROLLBACK-RUNBOOK.md
│
├─ Error rate too high?
│  └─ Check error pattern, is it systematic?
│     └─ Yes → ROLLBACK-RUNBOOK.md
│     └─ No → Monitor and investigate
│
├─ Latency high?
│  └─ Is it temporary or sustained?
│     └─ Sustained > 20% → ROLLBACK-RUNBOOK.md
│     └─ Temporary → Monitor
│
├─ Memory growing?
│  └─ Growth rate > 10% per hour?
│     └─ Yes → ROLLBACK-RUNBOOK.md
│     └─ No → Monitor
│
├─ WebSocket down?
│  └─ Verify listening, test locally
│     → If unreachable > 2 min: ROLLBACK-RUNBOOK.md
│
└─ Data corruption?
   └─ ROLLBACK-RUNBOOK.md immediately
```

---

## Success Criteria at Each Phase

### Canary (4 hours)

- [ ] ✓ Container stable (0 restarts)
- [ ] ✓ Health checks 100%
- [ ] ✓ Latency ±10% baseline
- [ ] ✓ Error rate acceptable
- [ ] ✓ Core commands working
- [ ] ✓ Team agrees → **GO**

### Stage 1 (25%, 2 hours)

- [ ] ✓ Deploy successful
- [ ] ✓ Health checks pass
- [ ] ✓ Metrics ±15% baseline
- [ ] ✓ Load balanced correctly
- [ ] ✓ Team approves → **GO to Stage 2**

### Stage 2 (50%, 2 hours)

- [ ] ✓ Deployment successful
- [ ] ✓ All metrics green
- [ ] ✓ 5 instances stable
- [ ] ✓ No customer impact
- [ ] ✓ Team approves → **GO to Stage 3**

### Stage 3 (100%, 1 hour)

- [ ] ✓ All 10 instances deployed
- [ ] ✓ All health checks pass
- [ ] ✓ 100% traffic on v12.0.0
- [ ] ✓ Metrics stable → **GO to Validation**

### 1-Hour Validation

- [ ] ✓ Infrastructure healthy
- [ ] ✓ Functional tests pass
- [ ] ✓ Performance baseline
- [ ] ✓ Logs clean → **PASS**

### 24-Hour Check

- [ ] ✓ Uptime maintained
- [ ] ✓ Performance stable
- [ ] ✓ Load test passes
- [ ] ✓ Data integrity → **STABLE**

### 1-Week Review

- [ ] ✓ 99.9%+ availability
- [ ] ✓ Quality metrics good
- [ ] ✓ No escalations
- [ ] ✓ Team sign-off → **PRODUCTION READY**

---

## Key Contacts (Fill In)

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| **Deployment Lead** | | | | |
| **Technical Lead** | | | | |
| **SRE Lead** | | | | |
| On-Call Primary | | | | |
| On-Call Secondary | | | | |
| Engineering Manager | | | | |

---

## Final Checklist (Before You Start)

- [ ] All runbooks downloaded and accessible
- [ ] Team contacts filled in above
- [ ] Monitoring dashboards created
- [ ] Communication channels ready
- [ ] v12.0.0 Docker image verified
- [ ] Canary host ready
- [ ] Load balancer tested
- [ ] Rollback procedure understood
- [ ] Team trained and ready
- [ ] Management approval obtained

**Status:** ✓ READY TO DEPLOY

---

## Quick Help

**Need to find something fast?**

- **Deploying to canary?** → CANARY-DEPLOYMENT-RUNBOOK.md
- **Rolling out to all?** → PROGRESSIVE-ROLLOUT-RUNBOOK.md
- **Need to rollback?** → ROLLBACK-RUNBOOK.md
- **Setting up monitoring?** → PRODUCTION-MONITORING.md
- **Validating deployment?** → POST-DEPLOYMENT-VALIDATION.md
- **Overview of all runbooks?** → DEPLOYMENT-RUNBOOKS-INDEX.md

**In doubt?** Read the relevant section in the specific runbook, or escalate to Technical Lead.

---

**Good luck! You've got this. 🚀**

For detailed procedures, see the specific runbooks listed above.

Last Updated: May 11, 2026
