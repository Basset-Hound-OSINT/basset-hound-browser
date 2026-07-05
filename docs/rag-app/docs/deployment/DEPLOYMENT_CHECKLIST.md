# RAG Bootstrap - Deployment Checklist

**Deployment Date**: ________________
**Deployed By**: ________________
**Deployment Window**: ________________
**Environment**: [ ] Dev [ ] Staging [ ] Production

---

## Pre-Deployment (T-2 Hours)

### Code & Testing
- [ ] Feature branch code reviewed and approved
- [ ] All unit tests passing (`pytest app/tests/`)
- [ ] Integration tests passing (`docker-compose -f docker-compose.test.yml up`)
- [ ] Load tests passed (`./scripts/load-test.sh`)
- [ ] No untracked files or uncommitted changes (`git status`)
- [ ] Latest code pulled (`git pull origin main`)

### Infrastructure
- [ ] Database backed up (`./scripts/backup-postgres.sh`)
- [ ] Backup verified and accessible
- [ ] Disk space available (>10GB free)
- [ ] Docker daemon running (`docker ps`)
- [ ] Docker images built (`docker-compose build`)

### Monitoring & Alerting
- [ ] Prometheus running and collecting metrics
- [ ] Grafana dashboards accessible
- [ ] Alertmanager configured and operational
- [ ] Alert channels (Slack) operational
- [ ] Baseline metrics recorded for comparison

### Communication
- [ ] Deployment window communicated to team
- [ ] On-call engineer assigned
- [ ] Incident channel created (#deployment-staging-MMDD)
- [ ] Status page updated (if applicable)

---

## Deployment (T-0)

### Stop & Backup

- [ ] **STOP**: Document current service status (screenshot dashboards)
- [ ] Run database backup: `./scripts/backup-postgres.sh`
- [ ] Verify backup created: `ls -lh data/backups/`
- [ ] Export current metrics for comparison

### Deploy Code

- [ ] Pull latest code: `git pull origin main`
- [ ] Verify correct branch: `git branch`
- [ ] Check git log: `git log -1 --oneline`
- [ ] Build Docker images: `docker-compose build`
- [ ] Verify build successful (no errors)

### Start Services

- [ ] Start main services: `docker-compose up -d postgres redis`
- [ ] Wait 30 seconds for database to initialize
- [ ] Verify database health: `docker-compose ps postgres`
- [ ] Start API: `docker-compose up -d api`
- [ ] Monitor logs: `docker-compose logs -f api | head -100`
- [ ] Wait for "Startup complete" message
- [ ] Start frontend: `docker-compose up -d frontend`

### Verify Services

- [ ] Health check endpoint responds: `curl http://localhost:8100/health`
- [ ] API is responding: `curl http://localhost:8100/api/status`
- [ ] Frontend loads: `curl http://localhost:8100/`
- [ ] Database is accessible: `docker-compose exec api python -c "import sqlalchemy; print('DB OK')"`
- [ ] Redis is accessible: `docker-compose exec redis redis-cli ping`
- [ ] No error logs: `docker-compose logs api | grep ERROR`

### Run Smoke Tests

```bash
./scripts/smoke-test.sh
```

- [ ] All endpoints responding
- [ ] No 5xx errors
- [ ] Latency within baseline (<2s)

### Monitor Metrics

- [ ] Prometheus scraping metrics
- [ ] Request rate normal
- [ ] Error rate <0.1%
- [ ] Latency p99 <1.0s
- [ ] CPU usage <50%
- [ ] Memory usage stable
- [ ] Database connections normal (<20)
- [ ] Redis memory usage normal (<500MB)

---

## Post-Deployment (T+10 Minutes)

### Final Validation

- [ ] All health checks passing
- [ ] No alerts firing (check Alertmanager)
- [ ] Logs show normal operation
- [ ] Metrics show expected traffic
- [ ] Error rate trending down (if elevated at start)
- [ ] Latency trending toward baseline

### Rollback Decision

**Is deployment healthy?**

- [ ] **YES** → Continue to Stabilization
- [ ] **NO** → Execute Rollback (see below)

### Stabilization (If Healthy)

- [ ] Monitor for 5 more minutes (total 15 min)
- [ ] No errors accumulating
- [ ] Performance stable
- [ ] Document any anomalies
- [ ] Brief team on deployment status

---

## Post-Deployment (T+30 Minutes)

### Extended Monitoring

- [ ] Error rate stable (<0.1%)
- [ ] Latency stable (p99 <1.0s)
- [ ] No resource utilization spikes
- [ ] No database replication lag
- [ ] No cache coherency issues

### Performance Baseline

Record these metrics for future comparison:

```
Request Rate (req/sec): __________
Error Rate (%):         __________
Latency p50 (ms):       __________
Latency p99 (ms):       __________
CPU Usage (%):          __________
Memory Usage (MB):      __________
Database Connections:   __________
Redis Memory (MB):      __________
```

### Logging

- [ ] New logs are flowing normally
- [ ] No ERROR or CRITICAL messages
- [ ] Application logs appearing in Loki
- [ ] Log aggregation working

---

## Rollback Procedure (If Needed)

Execute rollback if ANY of the following occur:

- [ ] Service is down (health check fails)
- [ ] Error rate >1% for >2 minutes
- [ ] Latency p99 >3.0s for >2 minutes
- [ ] Critical alerts firing
- [ ] Database unreachable
- [ ] Memory leak detected

### Quick Rollback (< 5 min)

```bash
# 1. Stop current services
docker-compose down

# 2. Restore database backup
./scripts/restore-postgres.sh data/backups/backup_<timestamp>.sql

# 3. Checkout previous code
git reset --hard HEAD~1

# 4. Rebuild and restart
docker-compose build && docker-compose up -d

# 5. Verify
curl http://localhost:8100/health

# 6. Monitor
docker-compose logs -f api
```

**Checklist:**
- [ ] Previous version code loaded
- [ ] Database restored
- [ ] Services started
- [ ] Health check passing
- [ ] Team notified
- [ ] Incident created for post-mortem

### Rollback Verification

After rollback, confirm:

- [ ] Health check endpoint working
- [ ] No error logs
- [ ] Error rate <0.1%
- [ ] Latency back to baseline
- [ ] Database responsive
- [ ] Redis responsive

---

## Post-Deployment Closeout

### Within 1 Hour

- [ ] Deployment marked as complete
- [ ] Final metrics recorded
- [ ] Team debriefing (if issues)
- [ ] Incident closed (if one was created)
- [ ] Runbook updated if needed

### Within 24 Hours

- [ ] Deployment tagged in git: `git tag deployment-<date>`
- [ ] Release notes updated
- [ ] Documentation updated if needed
- [ ] Any new operational procedures documented
- [ ] Performance benchmarks updated

### Issues Discovered

If any issues discovered during deployment:

1. Create issue in GitHub with label `post-deployment`
2. Assign to appropriate team member
3. Prioritize based on impact
4. Schedule for next sprint or hotfix

**Issues:**
- [ ] Issue #______: __________________________________________________
- [ ] Issue #______: __________________________________________________
- [ ] Issue #______: __________________________________________________

---

## Sign-Off

**Deployment Completed Successfully?** [ ] YES [ ] NO

**Deployed By**:
Name: ________________________
Date: ________________________
Time: ________________________

**Verified By** (Operations Lead):
Name: ________________________
Date: ________________________
Time: ________________________

**Approved For Production** (if applicable):
Name: ________________________
Date: ________________________
Time: ________________________

---

## Appendix: Quick Reference

### Key Commands

```bash
# Check status
docker-compose ps
docker stats --no-stream

# View logs
docker-compose logs --tail=100 api
docker-compose logs -f api

# Run health check
curl http://localhost:8100/health | jq

# Run smoke tests
./scripts/smoke-test.sh

# Backup database
./scripts/backup-postgres.sh

# Restore database
./scripts/restore-postgres.sh data/backups/backup_<timestamp>.sql

# Rollback deployment
git reset --hard HEAD~1
docker-compose build && docker-compose up -d
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | >0.1% | >1% | Investigate logs, consider rollback |
| Latency p99 | >1s | >3s | Check database/LLM performance |
| CPU | >80% | >95% | Scale horizontally or optimize |
| Memory | >85% | >95% | Increase limit or restart |
| DB Connections | >80 | >95 | Investigate leaks or restart |

### Rollback Decision Tree

```
Service responding?
  ├─ NO → Immediate rollback
  └─ YES → Check error rate
      ├─ >1% → Investigate, consider rollback
      └─ <1% → Check latency
          ├─ p99 >3s → Investigate, consider rollback
          └─ p99 <3s → OK to continue monitoring
```

---

**Document Version**: 1.0
**Last Updated**: 2026-05-07
**Next Review**: 2026-06-07
