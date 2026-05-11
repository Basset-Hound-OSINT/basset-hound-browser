# v12.0.0 Deployment Runbooks - Complete Index

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Release:** Basset Hound Browser v12.0.0  
**Target Upgrade:** From v11.3.0 → v12.0.0  

---

## Quick Start

For first-time readers, start here:

1. **Pre-deployment**: Read "PRE-DEPLOYMENT CHECKLIST" in CANARY-DEPLOYMENT-RUNBOOK.md
2. **Executing canary**: Follow CANARY-DEPLOYMENT-RUNBOOK.md (45 min + 4h monitoring)
3. **Progressive rollout**: Follow PRODUCTION-ROLLOUT-RUNBOOK.md (6 hours total)
4. **If issues arise**: Jump to ROLLBACK-RUNBOOK.md (5 min recovery)
5. **Post-deployment**: Execute POST-DEPLOYMENT-VALIDATION.md (at 1h, 24h, 1w)

---

## Runbook Reference

### 1. CANARY-DEPLOYMENT-RUNBOOK.md

**Purpose:** Deploy v12.0.0 to single canary instance for validation  
**Duration:** 45 min deployment + 4 hours monitoring  
**Participants:** Deployment Lead, Technical Lead, Backup Operator, Communication Lead  
**Risk Level:** LOW (isolated instance)

**Contains:**
- Pre-deployment checklist (30 min)
- Deployment procedure (10 min)
- Monitoring checklist (4 hours)
- Go/No-Go decision criteria
- Rollback procedure (if needed)

**Key Decisions:**
- Canary health check every 15 minutes (first hour)
- Canary health check every 30 minutes (remaining 3 hours)
- GO/NO-GO decision at 4-hour mark

**Exit Criteria:**
- ✓ GO: Proceed to Progressive Rollout (PROGRESSIVE-ROLLOUT-RUNBOOK.md)
- ✗ NO-GO: Execute rollback (ROLLBACK-RUNBOOK.md)

**File Size:** 17 KB | **Sections:** 8

---

### 2. PROGRESSIVE-ROLLOUT-RUNBOOK.md

**Purpose:** Gradually roll out v12.0.0 from canary (25% → 50% → 100%)  
**Duration:** 6 hours total (2 hours per stage)  
**Participants:** Deployment Lead, Technical Lead, Infrastructure Lead, Communication Lead  
**Risk Level:** MEDIUM (staged rollout with active traffic)

**Contains:**
- Pre-rollout verification
- Stage 1: 25% rollout (2 instances, 2 hours)
- Stage 2: 50% rollout (5 instances, 2 hours)
- Stage 3: 100% rollout (10 instances, 1 hour)
- Monitoring procedures for each stage
- Stage completion decision criteria
- Rollback procedures at any stage

**Key Decisions:**
- After Stage 1 (25%): Proceed to 50% or rollback
- After Stage 2 (50%): Proceed to 100% or rollback
- After Stage 3 (100%): Complete rollout, proceed to validation

**Exit Criteria:**
- ✓ SUCCESS: All instances on v12.0.0, proceed to POST-DEPLOYMENT-VALIDATION.md
- ✗ FAILURE (any stage): Execute ROLLBACK-RUNBOOK.md

**File Size:** 20 KB | **Sections:** 8 (3 stages + supporting procedures)

---

### 3. ROLLBACK-RUNBOOK.md

**Purpose:** Emergency return to v11.3.0 if critical issues detected  
**Duration:** < 5 minutes from decision to stable state  
**Participants:** Primary On-Call, SRE Lead, Deployment Lead  
**Risk Level:** HIGH (requires immediate action, but low complexity)

**Contains:**
- Automatic rollback triggers (no approval needed)
- Approved rollback criteria (needs sign-off)
- Pre-rollback checklist (1 min)
- Single instance rollback procedure (5 min)
- Fleet-wide rollback procedure (3-4 min)
- Post-rollback verification
- Health check procedures
- Incident communication template

**Critical Triggers (Automatic):**
- WebSocket unreachable > 2 minutes
- 5+ CRITICAL errors within 10 min
- Memory > 150% baseline and growing
- Error rate > 10% for 5+ min
- Data corruption detected

**File Size:** 16 KB | **Sections:** 7

---

### 4. PRODUCTION-MONITORING.md

**Purpose:** Define monitoring infrastructure and metrics for deployment  
**Duration:** Activate 1 hour before deployment, monitor during entire rollout  
**Participants:** Technical Lead, Infrastructure Lead  
**Risk Level:** N/A (setup document)

**Contains:**
- Monitoring architecture overview
- Key metrics to track (13 categories)
  - WebSocket API (connections, latency, throughput)
  - Command execution (success rate, response time)
  - Errors (rate, types, severity levels)
  - Resources (CPU, memory, disk I/O)
  - Business metrics (transactions, data volume, session duration)
- Alert thresholds by deployment stage
- Grafana dashboard specifications
- Elasticsearch log aggregation setup
- Prometheus exporter configuration
- Alert routing (PagerDuty, Slack)
- Incident response procedures
- Log analysis queries
- Metrics collection implementation
- Validation test procedures

**Alert Types:**
- CRITICAL: Automatic rollback triggers
- WARNING: Investigation required
- INFO: Status updates

**File Size:** 25 KB | **Sections:** 12

---

### 5. POST-DEPLOYMENT-VALIDATION.md

**Purpose:** Validate v12.0.0 is stable and production-ready at key intervals  
**Duration:** 15 min @ 1h, 30 min @ 24h, 1h @ 1 week  
**Participants:** Technical Lead, SRE Lead, Engineering Manager (week 1)  
**Risk Level:** N/A (validation document)

**Contains:**

**1-Hour Validation (Execute immediately post-100% deployment):**
- Infrastructure health check (3 min)
  - All instances responding
  - Version verification
  - No restarts
  - Load balancer status
- Functional tests (5 min)
  - navigate, click, fillForm, screenshot, getStatus, storage
- Performance baseline (4 min)
  - Latency p95, error rate, memory, CPU, success rate
- Log analysis (2 min)
  - Error scanning, critical error check

**24-Hour Stability Check (Execute at 24-hour mark):**
- Container uptime & stability
- Performance degradation analysis
- Concurrent load test (50 clients)
- Data integrity verification

**1-Week Performance Review (Execute at 7-day mark):**
- Comprehensive metrics summary
- Release readiness assessment
- Complete sign-off

**File Size:** 29 KB | **Sections:** 5 (3 validation points + helpers)

---

## Deployment Flow Diagram

```
START
  ↓
├─ Read PRE-DEPLOYMENT-CHECKLIST (CANARY-DEPLOYMENT-RUNBOOK.md)
│  Duration: 30 minutes
│  ↓
├─ CANARY-DEPLOYMENT (CANARY-DEPLOYMENT-RUNBOOK.md)
│  Duration: 45 min + 4 hours monitoring
│  ↓
│  Decision Point: GO/NO-GO?
│  ├─ ✗ NO-GO → ROLLBACK (ROLLBACK-RUNBOOK.md) → Root Cause Analysis → STOP
│  │
│  └─ ✓ GO → Continue to Progressive Rollout
│     ↓
├─ PROGRESSIVE-ROLLOUT (PROGRESSIVE-ROLLOUT-RUNBOOK.md)
│  ├─ STAGE 1: 25% (2 hours) → Decision: GO/NO-GO?
│  │  └─ ✗ NO-GO → ROLLBACK → STOP
│  │
│  ├─ STAGE 2: 50% (2 hours) → Decision: GO/NO-GO?
│  │  └─ ✗ NO-GO → ROLLBACK → STOP
│  │
│  └─ STAGE 3: 100% (1 hour) → Complete
│     ↓
├─ POST-DEPLOYMENT-VALIDATION (POST-DEPLOYMENT-VALIDATION.md)
│  ├─ 1-HOUR: Infrastructure + Functional + Performance (15 min)
│  │  └─ Decision: ✓ PASS/✗ FAIL
│  │
│  ├─ 24-HOUR: Stability + Load + Data Integrity (30 min)
│  │  └─ Decision: ✓ STABLE/✗ ISSUES
│  │
│  └─ 1-WEEK: Comprehensive Review + Sign-off (1 hour)
│     └─ Decision: ✓ PRODUCTION READY/✗ CONTINUE MONITORING
│
└─ RELEASE COMPLETE
   v12.0.0 is now the official production version
```

---

## Runbook Execution Timeline

### Example Full Deployment Schedule

**Monday 9:00 AM UTC**
- Start pre-deployment checklist (CANARY-DEPLOYMENT-RUNBOOK.md)
- Set up monitoring (PRODUCTION-MONITORING.md)
- Team standup - confirm readiness

**Monday 10:00 AM UTC**
- Execute canary deployment (CANARY-DEPLOYMENT-RUNBOOK.md)
- Start 4-hour monitoring window
- Continuous monitoring dashboards active

**Monday 2:00 PM UTC**
- Canary decision: GO or NO-GO
- If GO: Start progressive rollout

**Monday 2:00 PM - 8:00 PM UTC** (6 hours)
- Stage 1 (25%): 2:00 PM - 4:00 PM
- Stage 2 (50%): 4:00 PM - 6:00 PM
- Stage 3 (100%): 6:00 PM - 8:00 PM
- All instances at v12.0.0

**Monday 8:00 PM - 8:15 PM UTC**
- 1-hour validation (POST-DEPLOYMENT-VALIDATION.md)
- Infrastructure health check
- Functional tests
- Performance baseline

**Tuesday 8:00 AM UTC** (24 hours)
- 24-hour stability check
- Performance degradation analysis
- Load testing

**Next Monday**
- 1-week performance review
- Release sign-off
- v12.0.0 certified production ready

---

## Key Contact Information Template

**Fill in before deployment:**

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Deployment Lead | | | | |
| Technical Lead | | | | |
| Infrastructure Lead | | | | |
| SRE Lead | | | | |
| Engineering Manager | | | | |
| Communication Lead | | | | |
| On-Call Primary | | | | |
| On-Call Secondary | | | | |
| CTO (Escalation) | | | | |

---

## Pre-Deployment Checklist

**Complete this 48 hours before canary deployment:**

### Planning & Approval
- [ ] Release notes finalized
- [ ] Stakeholder review complete
- [ ] Deployment window approved
- [ ] Team availability confirmed
- [ ] Customer notifications scheduled

### Technical Preparation
- [ ] v12.0.0 Docker image built and validated
- [ ] v12.0.0 code review completed
- [ ] v12.0.0 test suite passes (100% of critical tests)
- [ ] Baseline metrics captured (v11.3.0)
- [ ] Monitoring infrastructure tested
- [ ] Dashboards created
- [ ] Alert rules configured
- [ ] Log aggregation pipeline verified

### Infrastructure Verification
- [ ] Canary host ready and healthy
- [ ] Production fleet health verified
- [ ] Load balancer tested
- [ ] Database/session store backup created
- [ ] Network connectivity confirmed

### Team Readiness
- [ ] All on-call contacts confirmed
- [ ] War room created (if needed)
- [ ] Communication channels verified
- [ ] Escalation procedures reviewed
- [ ] Runbooks printed/accessible
- [ ] Team training complete

### Runbook Verification
- [ ] CANARY-DEPLOYMENT-RUNBOOK.md - Read & understood
- [ ] PROGRESSIVE-ROLLOUT-RUNBOOK.md - Read & understood
- [ ] ROLLBACK-RUNBOOK.md - Read & understood (quick reference card filled)
- [ ] PRODUCTION-MONITORING.md - Metrics dashboard active
- [ ] POST-DEPLOYMENT-VALIDATION.md - Validation scripts ready

---

## Common Issues & Quick Fixes

### Canary Won't Start

**Symptom:** Container fails to start after deployment

**Quick Fix:**
1. Check Docker logs: `docker logs basset-hound-browser | tail -50`
2. Verify image exists: `docker images | grep v12.0.0`
3. Check port availability: `netstat -tlnp | grep 8765`
4. **Action:** Execute ROLLBACK-RUNBOOK.md

### High Error Rate on Canary

**Symptom:** Error rate > 2% on canary, v11.3.0 baseline < 0.5%

**Quick Fix:**
1. Check error type: `docker logs --tail=100 basset-hound-browser | grep ERROR`
2. Is it a specific command? Check logs for pattern
3. Connectivity issue? Verify dependencies
4. **Action:** If systematic → Execute ROLLBACK-RUNBOOK.md

### Memory Leak Detected

**Symptom:** Memory growing 10%+ per hour

**Quick Fix:**
1. Verify with metrics: `docker stats --no-stream`
2. Check for large log files: `du -sh /var/log/basset*`
3. Investigate container process: `docker top basset-hound-browser`
4. **Action:** Execute ROLLBACK-RUNBOOK.md, investigate in staging

### WebSocket Connection Issues

**Symptom:** Clients can't connect to WebSocket API

**Quick Fix:**
1. Verify service listening: `docker exec basset-hound-browser netstat -tlnp | grep 8765`
2. Test from container: `docker exec basset-hound-browser curl http://localhost:8765`
3. Test from host: `curl http://localhost:8765`
4. Check firewall: `iptables -L | grep 8765`
5. **Action:** If persistent → Execute ROLLBACK-RUNBOOK.md

---

## Success Metrics Summary

### Canary Deployment (4-hour window)
- [ ] **Stability:** Container uptime 4h, 0 restarts
- [ ] **Health:** 100% of health checks pass
- [ ] **Performance:** Metrics ±10% of baseline
- [ ] **Functionality:** Core commands responding
- [ ] **Logs:** < 10 errors total
- **Status:** ✓ PASS → Proceed to Progressive Rollout

### Progressive Rollout (Each Stage)
- [ ] **Stability:** Each stage 0 restarts
- [ ] **Health:** 100% of instances healthy
- [ ] **Performance:** Metrics ±15% of baseline
- [ ] **Functionality:** All tested commands working
- [ ] **Load Balancer:** All backends active
- **Status:** ✓ PASS → Proceed to next stage

### 1-Hour Validation (Immediate post-100%)
- [ ] **Infrastructure:** 10/10 instances healthy
- [ ] **Functional:** 6/6 core commands pass
- [ ] **Performance:** ±20% baseline metrics
- [ ] **Stability:** 0 container restarts
- **Status:** ✓ PASS → Proceed to 24-hour check

### 24-Hour Stability Check
- [ ] **Uptime:** 24h with 0 restarts
- [ ] **Performance:** Drift < 10%
- [ ] **Load:** 90%+ success under concurrency
- [ ] **Data:** Zero corruption errors
- **Status:** ✓ STABLE → Proceed to 1-week review

### 1-Week Performance Review
- [ ] **Availability:** 99.9%+ uptime
- [ ] **Quality:** Error rate < 0.5%
- [ ] **Performance:** ±15% baseline
- [ ] **Customer:** Zero escalations
- **Status:** ✓ PRODUCTION READY → Release certified

---

## Decision Framework

### Canary: GO/NO-GO

**GO Criteria (All must pass):**
- Container running 4h without restart
- 100% health checks
- Latency p95 ±10% baseline
- Error rate ≤ 3× baseline
- Core commands working
- Team agrees

**NO-GO Criteria (Any triggers rollback):**
- Container restart
- Health check fails > 5%
- Latency p95 > baseline × 1.3
- Error rate > baseline × 5
- Core command failures
- Team concern raised

**Decision:** If GO → Execute PROGRESSIVE-ROLLOUT-RUNBOOK.md

---

### Progressive Rollout: Stage Decisions

**Each stage (25%, 50%, 100%) requires:**

**GO to next stage:**
- Previous stage: 0 restarts, healthy
- Metrics: ±15% baseline
- Load balancer: All instances active
- Logs: < 20 errors total
- Team sign-off

**ROLLBACK decision:**
- Any metric > ±30% baseline
- Error rate > baseline × 3
- Customer complaints
- Data integrity issues
- Team recommendation

**Procedure:** If ROLLBACK → Execute ROLLBACK-RUNBOOK.md

---

## Document Maintenance

### How to Update Runbooks

1. **Minor updates** (clarifications, formatting)
   - Edit the document
   - Update version number (e.g., 1.1, 1.2)
   - Add date of change

2. **Major updates** (new procedures, new stages)
   - Create new version file
   - Keep old version as reference
   - Update this INDEX to point to new version

3. **After Each Deployment**
   - Document actual timeline vs. planned
   - Note any issues and resolutions
   - Update estimated durations
   - Capture lessons learned

---

## Quick Reference Cards

### Canary Deployment Quick Card

```
CANARY DEPLOYMENT - 4.5 HOURS

30 min: Pre-deployment checklist
  ✓ Verify infrastructure ready
  ✓ Build validated
  ✓ Team ready

10 min: Deploy to canary
  ✓ docker push
  ✓ docker run
  ✓ health check

4 hours: Monitor
  ✓ Every 15 min (hr 1): health + metrics
  ✓ Every 30 min (hr 2-4): health + metrics
  ✓ Check logs for errors

5 min: Go/No-Go Decision
  ✓ PASS: Proceed to Progressive Rollout
  ✗ FAIL: Execute Rollback
```

### Progressive Rollout Quick Card

```
PROGRESSIVE ROLLOUT - 6 HOURS

STAGE 1: 25% (2 hours)
  ├─ Drain 2-3 instances from LB
  ├─ Deploy v12.0.0
  ├─ Monitor: Metrics, health, logs
  └─ Decision: GO to 50% or ROLLBACK

STAGE 2: 50% (2 hours)
  ├─ Drain 2-3 more instances
  ├─ Deploy v12.0.0
  ├─ Monitor: Metrics, health, logs
  └─ Decision: GO to 100% or ROLLBACK

STAGE 3: 100% (1 hour)
  ├─ Drain remaining instances
  ├─ Deploy v12.0.0
  ├─ Monitor: Metrics, health, logs
  └─ SUCCESS: All on v12.0.0
```

### Emergency Rollback Quick Card

```
ROLLBACK TO v11.3.0 - 5 MINUTES

1. STOP: docker stop [container] --time=30 (30 sec)
2. RESTART: docker start [backup] or docker run (1 min)
3. VERIFY: curl health check (30 sec)
4. LB: Restore to load balancer (1 min)
5. NOTIFY: Send incident message (1 min)

Total: < 5 minutes to stable state
```

---

## Appendix: Runbook File Locations

| Document | Path | Size |
|----------|------|------|
| CANARY-DEPLOYMENT-RUNBOOK.md | `/docs/CANARY-DEPLOYMENT-RUNBOOK.md` | 17 KB |
| PROGRESSIVE-ROLLOUT-RUNBOOK.md | `/docs/PROGRESSIVE-ROLLOUT-RUNBOOK.md` | 20 KB |
| ROLLBACK-RUNBOOK.md | `/docs/ROLLBACK-RUNBOOK.md` | 16 KB |
| PRODUCTION-MONITORING.md | `/docs/PRODUCTION-MONITORING.md` | 25 KB |
| POST-DEPLOYMENT-VALIDATION.md | `/docs/POST-DEPLOYMENT-VALIDATION.md` | 29 KB |
| DEPLOYMENT-RUNBOOKS-INDEX.md | `/docs/DEPLOYMENT-RUNBOOKS-INDEX.md` | This file |

**Total Documentation:** ~130 KB (5 comprehensive runbooks)

---

## Related Documentation

**For additional context, see:**
- `docs/ROADMAP.md` - Project roadmap and v12.0.0 objectives
- `docs/API-REFERENCE.md` - WebSocket API commands
- `docs/SCOPE.md` - Architectural boundaries
- `docs/deployment/` - Additional deployment guides

---

## Approval & Sign-off

**Document Approval (before first deployment):**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| SRE Lead | | | |
| Engineering Manager | | | |
| CTO | | | |

**Deployment Execution Sign-off (after successful deployment):**

| Checkpoint | Lead | Date | Status |
|-----------|------|------|--------|
| Pre-deployment | Deployment Lead | | ✓ Ready |
| Canary GO | Technical Lead | | ✓ GO |
| Stage 1 (25%) GO | Deployment Lead | | ✓ GO |
| Stage 2 (50%) GO | Deployment Lead | | ✓ GO |
| Stage 3 (100%) Complete | Deployment Lead | | ✓ Complete |
| 1-hour Validation | Technical Lead | | ✓ PASS |
| 24-hour Check | SRE Lead | | ✓ STABLE |
| 1-week Review | Engineering Manager | | ✓ READY |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-11 | Initial release - Complete v12.0.0 deployment runbooks |
| | | |

---

**Last Updated:** May 11, 2026  
**Next Review:** After v12.0.0 deployment complete  
**Maintained By:** DevOps/SRE Team

---

**End of Deployment Runbooks Index**

For questions or issues with these runbooks, contact the DevOps team or file an issue in the project repository.
