# Phase 2 Infrastructure Setup - Quick Reference Guide

**Purpose:** One-page quick lookup during Week 1-2 implementation  
**Print:** Yes (fits on 2 pages)  
**Last Updated:** June 15, 2026

---

## 🚀 QUICK START COMMANDS

### Week 1 Tasks
```bash
# PerimeterX Account Test
curl -H "Authorization: Bearer $PERIMETERX_API_KEY" \
  https://api.perimeterx.com/v3/organizations/$PERIMETERX_ORG_ID

# DataDome Account Test
curl -X POST https://api.datadome.co/v1/oauth/token \
  -d "client_id=$DATADOME_CLIENT_ID&client_secret=$DATADOME_CLIENT_SECRET&grant_type=client_credentials"

# Cloudflare Account Test
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/zones
```

### Week 2 Docker Commands
```bash
# Start environment
docker-compose -f docker-compose.phase2.yml up -d

# Check health
docker-compose -f docker-compose.phase2.yml ps

# View logs (browser)
docker logs -f phase2-browser

# Test WebSocket
wscat -c ws://localhost:8765

# MongoDB shell
docker exec -it phase2-mongodb mongosh -u phase2user -p <password> --authenticationDatabase admin

# Stop all
docker-compose -f docker-compose.phase2.yml down
```

---

## 📋 RATE LIMITS & THROTTLING

| Service | API Limit | Phase 2 Limit | Buffer | Backoff |
|---------|----------|---------------|--------|---------|
| PerimeterX | 100/min | 50/min | 50% | 2 min on 429 |
| DataDome | 60/min | 30/min | 50% | Exponential |
| Cloudflare | 30/min | 15/min | 50% | 60 sec on 429 |
| AWS WAF | Unlimited | Low usage | High | None needed |

**Safe defaults:** Start at 50% of limit with 2-minute backoff on errors.

---

## 🔐 CREDENTIAL MANAGEMENT

### Where to Store
```
✓ Encrypted file: .phase2-credentials.enc
✗ Plain text: NEVER
✗ Git repository: NEVER
✗ Email/Chat: NEVER
```

### Encryption Command
```bash
gpg --symmetric --cipher-algo AES256 \
    PHASE2-SANDBOX-CREDENTIALS-INDEX-TEMPLATE.md
```

### Decryption (Temporary)
```bash
gpg --decrypt .phase2-credentials.enc > temp-creds.md
# [VIEW CONTENTS]
shred -fvz -n 10 temp-creds.md  # Securely delete
```

---

## 📊 TEST MATRIX QUICK VIEW

### By Category (95 total)
| Category | Count | Success Target |
|----------|-------|-----------------|
| Fingerprinting | 25 | 70-85% |
| Behavioral | 25 | 65-75% |
| Session | 20 | 75-85% |
| Advanced | 15 | 70-80% |
| Integration | 10 | 60-70% |

### By Service (95 total)
| Service | Count | Target |
|---------|-------|--------|
| PerimeterX | 30 | 70-80% |
| DataDome | 32 | 60-75% |
| Cloudflare | 25 | 80-95% |

### By Target Website (11 primary)
1. example-ecommerce-store.test
2. banking-login-sim.test
3. travel-booking.test
4. ticketing-platform.test
5. pricing-aggregator.test
6. job-board.test
7. real-estate-search.test
8. sports-betting.test
9. social-media-sim.test
10. payment-gateway-test.test
11. news-aggregator.test

---

## ⏰ CRITICAL DATES & MILESTONES

```
┌─────────────────────────────────────────────────────────┐
│                    WEEK 1: ACCOUNTS                      │
├────┬────────────────────────────────────────────────────┤
│ 06/18 │ Mon │ Signup: PerimeterX, DataDome, Cloudflare, AWS
│ 06/19 │ Tue │ Email verification, 2FA setup
│ 06/20 │ Wed │ API testing & key generation
│ 06/21 │ Thu │ Test mode configuration
│ 06/22 │ Fri │ ✅ SIGN-OFF: All accounts verified
└────┴────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    WEEK 2: ENVIRONMENT                   │
├────┬────────────────────────────────────────────────────┤
│ 06/25 │ Mon │ Docker deployment
│ 06/26 │ Tue │ Database & proxy setup
│ 06/27 │ Wed │ Monitoring configuration
│ 06/28 │ Thu │ Dry-run tests (5-10 scenarios)
│ 06/29 │ Fri │ ✅ SIGN-OFF: Ready for Phase 2
└────┴────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               PHASE 2: EXECUTION (5 DAYS)                │
├────┬────────────────────────────────────────────────────┤
│ 07/03 │ Tue │ Kickoff: 20 PerimeterX tests
│ 07/04 │ Wed │ High-volume across all services
│ 07/05 │ Thu │ Mid-point review (150+ tests)
│ 06/06 │ Fri │ Final testing & analysis
│ 07/07 │ Sat │ ✅ COMPLETION: Report generated
└────┴────────────────────────────────────────────────────┘
```

---

## 🎯 APPROVAL CHECKPOINTS

### Week 1 Sign-off (Jun 22)
Team Lead must verify:
- [ ] All 3+ service accounts created
- [ ] API keys tested and working
- [ ] Rate limits documented
- [ ] Webhook endpoints configured

**Sign-off:** _________________ (Initials & Date)

### Week 2 Sign-off (Jun 29)
Team Lead must verify:
- [ ] Docker environment operational
- [ ] Monitoring dashboards live
- [ ] Dry-run tests passed (5-10 tests)
- [ ] Baseline metrics established
- [ ] Team trained and ready

**Sign-off:** _________________ (Initials & Date)

---

## 🚨 EMERGENCY CONTACTS

### Service Support Hotlines
| Service | Email | Portal | Response Time |
|---------|-------|--------|---------------|
| PerimeterX | support@perimeterx.com | https://support.perimeterx.com | 2-4 hours |
| DataDome | support@datadome.co | https://support.datadome.co | 2-4 hours |
| Cloudflare | support@cloudflare.com | https://support.cloudflare.com | 2-4 hours |

### Team Escalation
| Issue | Contact | Level |
|-------|---------|-------|
| API connectivity | DevOps Lead | P1 (30 min) |
| Docker crash | DevOps Lead | P1 (immediate) |
| Rate limit hit | QA Lead | P2 (auto-throttle) |
| Data loss | Project Lead | P1 (immediate) |
| Security concern | Security Officer | P1 (immediate) |

---

## 📱 MONITORING DASHBOARD URLs

| Dashboard | URL | Credentials |
|-----------|-----|-------------|
| Grafana | http://localhost:3000 | admin / [PASSWORD] |
| Prometheus | http://localhost:9091 | None (local) |
| MongoDB | localhost:27017 | phase2user / [PASSWORD] |
| Browser API | ws://localhost:8765 | None (local WebSocket) |

---

## 🔄 DAILY ROUTINE (Week 2)

### Morning (9 AM)
```bash
# Check all services
docker-compose -f docker-compose.phase2.yml ps

# View overnight logs
docker logs --since 12h phase2-browser | tail -50

# Check MongoDB size
docker exec phase2-mongodb du -sh /data/db
```

### Midday (12 PM)
```bash
# Check dashboard metrics
curl -s http://localhost:9091/api/v1/query?query=phase2_tests_total

# Verify no errors
docker logs phase2-browser | grep -i error | tail -10
```

### Evening (5 PM)
```bash
# Prepare daily report
docker exec phase2-mongodb mongosh -u phase2user --authenticationDatabase admin -eval \
  'db.getSiblingDB("phase2").phase2_test_results.countDocuments({timestamp: {$gt: ISODate("2026-06-25T00:00:00Z")}})'

# Backup database
docker exec phase2-mongodb mongosh --oplog \
  --archive=/data/backup/daily-$(date +%Y%m%d).archive
```

---

## ✅ QUICK CHECKLIST

### Pre-Week 1
- [ ] Read PHASE2-INFRASTRUCTURE-INDEX-2026-06-15.md (5 min)
- [ ] Assign team members to sections
- [ ] Schedule Week 1 kickoff meeting

### During Week 1
- [ ] Follow PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Section 1)
- [ ] Mark each item as completed
- [ ] Note any issues and resolutions
- [ ] Friday 5 PM: Request sign-off

### During Week 2
- [ ] Follow PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Sections 2-6)
- [ ] Mark each item as completed daily
- [ ] Run health checks each morning
- [ ] Friday 5 PM: Request final sign-off

### Phase 2 Execution (Jul 3-7)
- [ ] Execute test batches from `phase2-run-tests.sh`
- [ ] Monitor dashboards continuously
- [ ] Log issues and resolutions
- [ ] Daily result summaries
- [ ] Friday: Final report

---

## 📞 WHO TO CONTACT

| Question | Contact |
|----------|---------|
| Account setup help | DevOps Lead |
| Docker issues | DevOps Lead |
| Rate limit problems | QA Lead |
| Test execution | QA Lead |
| Results analysis | Data Analyst |
| Compliance questions | Security Officer |
| Overall coordination | Project Lead |

---

## 📚 DOCUMENT QUICK MAP

```
START HERE:
├─ PHASE2-INFRASTRUCTURE-INDEX-2026-06-15.md
│  └─ Overview, timeline, contacts
│
FOR WEEK 1:
├─ PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Part 1)
│  └─ Account setup step-by-step
├─ PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Section 1)
│  └─ Daily verification tasks
└─ PHASE2-SANDBOX-CREDENTIALS-INDEX-TEMPLATE.md
   └─ Credential documentation template
│
FOR WEEK 2:
├─ PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Parts 2-6)
│  └─ Environment, test data, monitoring, safety
├─ PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Sections 2-6)
│  └─ Daily verification tasks
├─ docker-compose.phase2.yml (to be created)
│  └─ Docker configuration
└─ scripts/setup-phase2-environment.sh (to be created)
   └─ Automated setup

DURING PHASE 2:
└─ PHASE2-EXECUTION-LOG.md (auto-generated)
   └─ Daily results and analysis
```

---

## 🎓 TRAINING MINUTES REQUIRED

| Role | Docs to Read | Minutes |
|------|--------------|---------|
| Team Lead | Index + Plan (Sections 6-8) | 45 |
| DevOps Lead | Plan (Parts 1-2) + Checklist (Secs 2-4) | 90 |
| QA Lead | Plan (Parts 3-5) + Checklist (Secs 3,6) | 90 |
| Test Engineer | Checklist + Quick Ref + Part 3 | 60 |
| Data Analyst | Plan (Part 4) + Grafana training | 60 |
| Security Officer | Plan (Parts 5,8) + Checklist (Sec 5) | 45 |

**Total team training:** ~5-6 hours (distributed across team)

---

## 💡 PRO TIPS

1. **Print the checklist** - Easier to mark off daily tasks
2. **Set daily 9 AM standup** - Quick 10-min sync on blockers
3. **Automate backups** - Don't rely on manual backup procedures
4. **Monitor rate limits proactively** - Alert at 75% of limit
5. **Keep credentials encrypted** - Zero plaintext files
6. **Test everything during Week 2** - No surprises during Phase 2
7. **Document issues immediately** - Don't rely on memory
8. **Celebrate Week 1 & 2 wins** - Success builds momentum

---

## 🔗 RELATED DOCS

| Document | Location | When to Read |
|----------|----------|--------------|
| Full Infrastructure Plan | `/docs/findings/` | Week 1 before starting |
| Environment Checklist | `/docs/findings/` | Daily during Weeks 1-2 |
| Credentials Template | `/docs/findings/` | During Week 1 credential setup |
| Index (this file) | `/docs/findings/` | Quick lookup any time |
| Main Roadmap | `/docs/ROADMAP.md` | Context/background |
| v12.7.0 Planning | `/docs/findings/V12.7.0-*` | Feature context |

---

**Version:** 1.0  
**Created:** June 15, 2026  
**Status:** ✅ Ready for Use  
**Print-Friendly:** Yes (2 pages)  
**Updated:** As needed during Weeks 1-2

**Keep this guide handy during Week 1 & 2 implementation!** 📌
