# v12.3.0 Deployment Checklist

**Release:** v12.3.0  
**Date:** June 14, 2026  
**Status:** Ready for Production

---

## PRE-DEPLOYMENT (1 Hour Before)

### Code & Version Verification
- [ ] Verify v12.3.0 tag in git: `git tag | grep v12.3.0`
- [ ] Confirm package.json version: `grep "version" package.json` → "12.3.0"
- [ ] Check git status is clean: `git status` → "working tree clean"
- [ ] Review RELEASE-NOTES-v12.3.0.md for completeness

### Infrastructure Readiness
- [ ] Docker daemon running: `docker ps`
- [ ] Docker Compose available: `docker-compose --version`
- [ ] Port 8765 available: `netstat -tulpn | grep 8765` (should be empty)
- [ ] Disk space adequate: `df -h` (at least 10GB free)
- [ ] Network connectivity confirmed: `ping 8.8.8.8`

### Backup & Rollback Plan
- [ ] Current version backed up
- [ ] Previous Docker image available: `docker images | grep basset-hound`
- [ ] Rollback procedure reviewed: `docs/DEPLOYMENT-RUNBOOK-v12.3.0.md`
- [ ] Rollback tested in staging environment

### Team Readiness
- [ ] Deployment lead assigned
- [ ] Monitoring team on standby
- [ ] Support team notified of deployment window
- [ ] Escalation contacts verified

---

## DEPLOYMENT (30 Minutes)

### Build Phase
- [ ] Pull latest code: `git checkout v12.3.0`
- [ ] Install dependencies: `npm install`
- [ ] Build Docker image: `docker build -t basset-hound-browser:12.3.0 .`
- [ ] Verify image created: `docker images | grep 12.3.0`
- [ ] Tag as latest: `docker tag basset-hound-browser:12.3.0 basset-hound-browser:latest`

### Staging Phase (Optional but Recommended)
- [ ] Deploy to staging: `docker-compose -f docker-compose.staging.yml up -d`
- [ ] Wait 30 seconds for startup
- [ ] Run health check: `curl -s http://localhost:8765/health`
- [ ] Verify version in health response: "12.3.0"
- [ ] Run smoke tests: `npm run test:integration`
- [ ] Review logs for errors: `docker-compose logs app | grep ERROR`
- [ ] If passed, proceed to production; if failed, rollback to v12.0.0

### Production Deployment
- [ ] Start new container: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Wait 40 seconds for startup (health check start period)
- [ ] Check container status: `docker-compose ps`
- [ ] Verify container is "healthy": `docker ps | grep basset-hound`
- [ ] Run health check: `curl -s http://localhost:8765/health | jq '.'`
- [ ] Verify response status is "healthy"
- [ ] Verify version in response is "12.3.0"

### Validation Phase
- [ ] Test WebSocket connectivity: `wscat -c ws://localhost:8765`
- [ ] Send ping command: `{"command":"ping"}`
- [ ] Verify pong response
- [ ] Check system metrics: `curl -s http://localhost:8765/metrics | jq '.'`
- [ ] Monitor logs for 5 minutes: `docker-compose logs -f --tail=50 app`
- [ ] Verify no ERROR or CRITICAL messages

---

## POST-DEPLOYMENT (First Hour)

### Immediate Verification (5 Minutes)
- [ ] All health checks passing
- [ ] No error messages in logs
- [ ] Deployment metrics recorded
- [ ] Monitoring dashboards updated

### Short-Term Monitoring (1 Hour)
- [ ] Error rate normal: < 0.1%
- [ ] Latency acceptable: < 100ms P95
- [ ] CPU usage normal: < 50%
- [ ] Memory usage normal: < 1.5GB
- [ ] No spike in error logs
- [ ] API response time stable

### Stakeholder Communication
- [ ] Update status page (if applicable)
- [ ] Notify team of successful deployment
- [ ] Log deployment in change management system
- [ ] Schedule post-release review meeting

### Monitoring Setup
- [ ] Prometheus metrics endpoint accessible
- [ ] Grafana dashboards operational
- [ ] Alert rules configured and active
- [ ] Log aggregation receiving data

---

## ROLLBACK DECISION TREE

### Continue Monitoring If:
- ✅ All health checks passing
- ✅ Error rate < 0.5%
- ✅ No critical errors in logs
- ✅ Performance metrics normal
- ✅ Users not reporting issues

**Action:** Continue production deployment

---

### Investigate Further If:
- ⚠️ Error rate 0.5-2%
- ⚠️ Occasional errors in logs
- ⚠️ Performance slightly degraded
- ⚠️ Minor user reports

**Action:** Review logs, monitor for 30 minutes, then decide

---

### Immediate Rollback If:
- ❌ Error rate > 2%
- ❌ Critical errors in logs
- ❌ Health checks failing
- ❌ Performance severely degraded
- ❌ API responses timing out
- ❌ Users reporting major issues

**Action:** Execute rollback procedure immediately

---

## ROLLBACK PROCEDURE (If Needed)

### Quick Rollback (< 5 Minutes)

```bash
# 1. Stop current deployment
docker-compose down

# 2. Restore previous version
docker load < backup-v12.0.0.tar

# 3. Start previous version
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify rollback
curl -s http://localhost:8765/health | jq '.'

# Expected version: 12.0.0
```

### Rollback Verification
- [ ] Container running: `docker-compose ps`
- [ ] Container healthy: Check health endpoint
- [ ] Correct version: `curl -s http://localhost:8765/version`
- [ ] No errors: Check logs for last 10 minutes

### Post-Rollback
- [ ] Notify all stakeholders of rollback
- [ ] Document rollback reason
- [ ] Schedule incident review
- [ ] Identify root cause
- [ ] Plan remediation

---

## 24-HOUR POST-DEPLOYMENT REVIEW

### Day 1 Verification (Next Morning)
- [ ] No overnight errors
- [ ] Performance metrics stable
- [ ] Users reporting no issues
- [ ] All systems operational

### Metrics Review
- [ ] Error rate: _______% (target: < 0.1%)
- [ ] Average latency: _______ ms (target: < 100ms)
- [ ] P95 latency: _______ ms (target: < 200ms)
- [ ] CPU usage: _______% (target: < 50%)
- [ ] Memory usage: _______ MB (target: < 1,500MB)
- [ ] Uptime: _______ hours (target: 100%)

### Sign-Off
- [ ] Deployment successful
- [ ] All quality gates met
- [ ] No critical issues found
- [ ] Release locked in (no rollback)

**Deployment completed successfully!**

---

## CONTACT INFORMATION

**On-Call Deployment Lead:** [Name/Contact]  
**Monitoring Team:** [Name/Contact]  
**Support Team Lead:** [Name/Contact]  
**Escalation Contact:** gnelsonerau@gmail.com

---

## USEFUL COMMANDS

```bash
# Health check
curl -s http://localhost:8765/health | jq '.'

# Version check
curl -s http://localhost:8765/version | jq '.'

# View logs
docker-compose logs -f app

# View logs with filter
docker-compose logs app | grep ERROR

# Container status
docker-compose ps

# System metrics
docker stats basset-hound-browser

# Stop deployment
docker-compose down

# Restart deployment
docker-compose restart

# Clean up old containers
docker-compose down -v
docker system prune -a
```

---

**Version:** v12.3.0  
**Last Updated:** June 14, 2026  
**Status:** Ready for Production Deployment
