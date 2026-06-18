# Phase 2 Real-World Bot Detection Testing - Infrastructure Index

**Created:** June 15, 2026  
**Status:** ✅ Ready for Week 1 Implementation (June 18)  
**Target Completion:** June 29, 2026  
**Phase 2 Execution:** July 3-7, 2026

---

## 📋 QUICK START GUIDE

### For Team Leads
1. Read: **PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md** (Complete Overview)
2. Assign: **PHASE2-TEST-ENVIRONMENT-CHECKLIST.md** (30-item verification)
3. Execute: **setup-phase2-environment.sh** (Automates Docker deployment)
4. Monitor: Grafana Dashboard at http://localhost:3000

### For Implementation Team
1. Follow: **PHASE2-TEST-ENVIRONMENT-CHECKLIST.md** (Section-by-section)
2. Reference: **PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md** (Detailed instructions)
3. Secure: **PHASE2-SANDBOX-CREDENTIALS-INDEX-TEMPLATE.md** (During Week 1 account setup)

### Timeline Overview
- **Week 1 (Jun 18-22):** Account signup and verification (Part 1)
- **Week 2 (Jun 25-29):** Environment setup and dry runs (Parts 2-6)
- **Execution (Jul 3-7):** Phase 2 real-world testing with 95 test cases

---

## 📚 DOCUMENT INVENTORY

### Primary Deliverables

#### 1. **PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md**
- **Type:** Comprehensive implementation guide (9 parts, 40+ pages)
- **Location:** `/home/devel/basset-hound-browser/docs/findings/`
- **Purpose:** Step-by-step instructions for all infrastructure setup
- **Key Sections:**
  - Part 1: Sandbox Account Setup (4 services)
  - Part 2: Test Environment Setup (Docker, MongoDB, Monitoring)
  - Part 3: Test Data Preparation (11 targets, 95 tests)
  - Part 4: Monitoring & Instrumentation (Dashboards, Alerts)
  - Part 5: Safety & Compliance (Rate limiting, Audit trail)
  - Part 6: Infrastructure Timeline (3-week schedule)
  - Part 7: Deliverables (Documentation & scripts)
  - Part 8: Verification Checklist
  - Part 9: Troubleshooting Guide

**Who Should Read:**
- Team leads (planning + oversight)
- DevOps engineers (infrastructure setup)
- QA leads (test execution planning)
- Compliance officer (safety & audit trail)

---

#### 2. **PHASE2-TEST-ENVIRONMENT-CHECKLIST.md**
- **Type:** 30-item verification checklist
- **Location:** `/home/devel/basset-hound-browser/docs/findings/`
- **Purpose:** Day-by-day verification during Weeks 1-2
- **Key Sections:**
  - Section 1: Account & API Setup (PerimeterX, DataDome, Cloudflare, AWS)
  - Section 2: Docker Environment Setup
  - Section 3: Test Data Preparation
  - Section 4: Monitoring & Alerting
  - Section 5: Safety & Compliance
  - Section 6: Dry-Run & Validation
  - Section 7: Final Sign-off

**Who Should Read:**
- Implementation team members (daily work tracking)
- Section owners (designated responsibility)
- QA leads (validation verification)

**Format:** Printable checklist with boxes, notes, and verification commands

---

#### 3. **PHASE2-SANDBOX-CREDENTIALS-INDEX-TEMPLATE.md**
- **Type:** Encrypted credentials reference (for Week 1 use)
- **Location:** `/home/devel/basset-hound-browser/docs/findings/`
- **Purpose:** Centralized credentials documentation template
- **Key Sections:**
  - PerimeterX credentials (Org ID, API Key, Dashboard URL)
  - DataDome credentials (Client ID, Secret, Dashboard URL)
  - Cloudflare credentials (API Token, Zone ID, Account ID)
  - AWS WAF credentials (Optional, if enabled)
  - Public detection services (No auth required)
  - Credential rotation schedule
  - Emergency access procedures
  - Audit log for credential access

**Who Should Read:**
- DevOps lead (credential management)
- Team lead (emergency access)
- Rotating monthly for credential maintenance

**Security:** Template should be encrypted to `.phase2-credentials.enc` after population

---

### Supporting Documents

#### 4. **Automation Scripts** (to be created during Week 2)
- `scripts/setup-phase2-environment.sh` - Full automated setup
- `scripts/phase2-run-tests.sh` - Test execution automation
- `scripts/phase2-monitor-dashboard.sh` - Real-time monitoring display
- `scripts/phase2-cleanup-daily.sh` - Daily cleanup tasks
- `scripts/phase2-cleanup-weekly.sh` - Weekly maintenance
- `scripts/phase2-cleanup-final.sh` - Post-phase2 final cleanup

#### 5. **Docker Configuration** (to be created during Week 2)
- `docker-compose.phase2.yml` - Complete service definition
- `phase2-config/prometheus.yml` - Metrics collection config
- `phase2-config/grafana-dashboards/*.json` - Dashboard definitions
- `.env.phase2` - Environment variables (with placeholders)

#### 6. **Test Data Files** (to be created during Week 2)
- `phase2-config/test-cases.json` - 95 test case definitions
- `phase2-config/targets.json` - 11 target website configuration
- `phase2-config/baseline-metrics.json` - v12.7.0 baseline establishment

---

## 🎯 EXECUTION TIMELINE

### WEEK 1: Account Signup & Verification (Jun 18-22)

**Monday, June 18**
- [ ] Send PerimeterX signup request
- [ ] Send DataDome demo request
- [ ] Create Cloudflare account
- [ ] Create AWS account (optional)
- **Owner:** DevOps Lead

**Tuesday, June 19**
- [ ] Follow up on email verifications
- [ ] Setup 2FA for all accounts
- [ ] **Owner:** DevOps Lead

**Wednesday, June 20**
- [ ] Test all API connectivity
- [ ] Create test domains
- [ ] **Owner:** DevOps Lead

**Thursday, June 21**
- [ ] Configure test mode for each service
- [ ] Setup webhooks
- [ ] **Owner:** DevOps Lead

**Friday, June 22**
- [ ] Document all credentials (encrypted)
- [ ] Complete rate limit testing
- [ ] **Owner:** DevOps Lead + QA Lead

**Week 1 Deliverable:** ✅ PHASE2-SANDBOX-CREDENTIALS-INDEX.md.enc (encrypted)

---

### WEEK 2: Environment Setup & Validation (Jun 25-29)

**Monday, June 25**
- [ ] Deploy Docker Compose environment
- [ ] Verify container health
- [ ] **Owner:** DevOps Lead

**Tuesday, June 26**
- [ ] Configure proxy rotation
- [ ] Setup MongoDB test data
- [ ] Configure logging
- [ ] **Owner:** DevOps Lead + Test Engineer

**Wednesday, June 27**
- [ ] Setup Grafana dashboards
- [ ] Configure alerts
- [ ] **Owner:** DevOps Lead + Monitoring Engineer

**Thursday, June 28**
- [ ] Execute dry-run tests
- [ ] Fix issues from dry runs
- [ ] **Owner:** QA Lead + Test Engineer

**Friday, June 29**
- [ ] Final health checks
- [ ] Team approval
- [ ] **Owner:** Team Lead

**Week 2 Deliverable:** ✅ PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (100% complete & signed off)

---

### PHASE 2 EXECUTION: Real-World Testing (Jul 3-7)

**Tuesday, July 3**
- [ ] Kick-off: Start automated test execution
- [ ] 20 PerimeterX tests
- [ ] **Owner:** QA Lead

**Wednesday, July 4**
- [ ] High-volume testing across all services
- [ ] Monitor success rates
- [ ] **Owner:** QA Lead + Test Engineer

**Thursday, July 5**
- [ ] Mid-point review (150+ tests completed)
- [ ] Adjust strategy if needed
- [ ] **Owner:** Team Lead + QA Lead

**Friday-Saturday, Jul 6-7**
- [ ] Final testing scenarios
- [ ] Generate comprehensive report
- [ ] **Owner:** QA Lead + Data Analyst

**Phase 2 Deliverable:** ✅ PHASE2-EXECUTION-LOG.md + Final Report

---

## 🔑 KEY INFRASTRUCTURE COMPONENTS

### Detection Services (5 services, 3+ primary)

| Service | Type | Status | Rate Limit | Purpose |
|---------|------|--------|-----------|---------|
| **PerimeterX** | JavaScript-based bot detection | Primary | 100 req/min | Real-time JavaScript challenge |
| **DataDome** | Behavioral bot detection | Primary | 60 req/min | Behavioral pattern analysis |
| **Cloudflare** | WAF + DDoS protection | Primary | 30 req/min | Common WAF baseline testing |
| **AWS WAF** | Application firewall | Secondary | Unlimited | Backup WAF testing |
| **Public Services** | CreepJS, BrowserLeaks, etc. | Reference | Free | Baseline fingerprint validation |

### Infrastructure Stack

```
├── Browser Layer (Basset Hound Browser v12.7.0)
│   ├── WebSocket API (port 8765)
│   ├── Evasion Framework (85-90% baseline)
│   └── Metrics Export (Prometheus format)
│
├── Data Layer (MongoDB)
│   ├── Test Cases (95 scenarios)
│   ├── Test Results (real-time collection)
│   ├── Metrics (time-series)
│   └── Audit Trail (immutable log)
│
├── Monitoring Layer (Prometheus + Grafana)
│   ├── Metrics Scraping (10s intervals)
│   ├── Dashboards (5+ real-time panels)
│   ├── Alerts (4 critical, 4 warning)
│   └── Data Retention (30 days)
│
└── Testing Layer
    ├── Test Executor (automated, parallel)
    ├── Target Websites (11 primary + 5 secondary)
    ├── Proxy Rotation (3-pool configuration)
    └── User Agent Rotation (5 categories)
```

---

## 📊 TEST MATRIX OVERVIEW

### Test Distribution

**By Category (95 total tests):**
- Fingerprinting Evasion: 25 tests (Canvas, WebGL, Audio, Fonts, WebRTC)
- Behavioral Simulation: 25 tests (Clicks, Typing, Movement, Scroll, Navigation)
- Session Management: 20 tests (Cookies, Storage, Headers, Profile rotation)
- Advanced Evasion: 15 tests (Geolocation, Device, Network, API, Request)
- Integration Scenarios: 10 tests (End-to-end flows, Edge cases, Concurrent)

**By Service (95 total tests):**
- PerimeterX: 30 tests (expecting 70-80% bypass rate)
- DataDome: 32 tests (expecting 60-75% bypass rate)
- Cloudflare: 25 tests (expecting 80-95% bypass rate)

**By Target Website (11 primary):**
- example-ecommerce-store.test
- banking-login-sim.test
- travel-booking.test
- ticketing-platform.test
- pricing-aggregator.test
- job-board.test
- real-estate-search.test
- sports-betting.test
- social-media-sim.test
- payment-gateway-test.test
- news-aggregator.test

---

## ✅ SUCCESS CRITERIA

### Week 1 Success (Account Setup)
- ✅ All 3+ services account created and verified
- ✅ API keys generated and working
- ✅ Test domains created on all services
- ✅ Rate limits documented and understood
- ✅ Webhook endpoints configured

### Week 2 Success (Environment Setup)
- ✅ Docker environment fully operational (5 containers running)
- ✅ All monitoring dashboards live and collecting data
- ✅ Dry-run tests 100% successful (5-10 tests passed)
- ✅ Baseline metrics established from v12.7.0
- ✅ Team trained and ready for execution

### Phase 2 Success (Real-World Testing)
- ✅ All 95 tests executed against real detection services
- ✅ Success rates measured and documented
- ✅ Evasion effectiveness analyzed by technique and service
- ✅ Performance metrics collected (latency, resource usage)
- ✅ Comprehensive final report generated

---

## 🚨 RISK MITIGATION

### Top Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| API rate limit exceeded | Medium | Medium | 50% throttling + 2-min backoff |
| Service downtime during testing | Low | High | Failover to secondary services |
| Docker container crash | Low | High | Automatic restart + monitoring |
| Data loss in MongoDB | Very Low | Critical | Daily backups + immutable audit trail |
| API credential exposure | Very Low | Critical | AES-256 encryption + GPG signing |
| Test domain DNS failure | Low | Medium | Local /etc/hosts fallback |

### Contingency Plans

1. **API Rate Limit Hit:** Reduce rate to 50%, wait 2 minutes, retry
2. **Service Down:** Skip that service's tests, focus on others
3. **Docker Crash:** Auto-restart enabled, alert team
4. **Credential Leak:** Rotate all API keys immediately (30-min turnaround)
5. **Data Loss:** Restore from MongoDB backup (hourly snapshots)

---

## 📞 CONTACT & ESCALATION

### Team Roles

| Role | Name | Email | Responsibility |
|------|------|-------|-----------------|
| Project Lead | [TBD] | [TBD] | Overall coordination, approval |
| DevOps Lead | [TBD] | [TBD] | Infrastructure setup, Docker |
| QA Lead | [TBD] | [TBD] | Test execution, result analysis |
| Test Engineer | [TBD] | [TBD] | Individual test implementation |
| Data Analyst | [TBD] | [TBD] | Metrics analysis, reporting |
| Security Officer | [TBD] | [TBD] | Compliance, audit trail |

### Escalation Path

**Issue Type → Contact → Escalation Timeline**
- API Connectivity Issue → DevOps Lead → 30 minutes
- Rate Limit Hit → QA Lead → Immediate (auto-throttle)
- Data Loss Concern → Project Lead → Immediate
- Security Issue → Security Officer → Immediate

---

## 📖 HOW TO USE THESE DOCUMENTS

### For Managers/Leads
1. **Review** PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Parts 6-8, Timeline & Deliverables)
2. **Assign** PHASE2-TEST-ENVIRONMENT-CHECKLIST.md sections to team members
3. **Monitor** weekly progress against timeline
4. **Approve** Week 1 and Week 2 sign-offs

### For DevOps/Architects
1. **Read** PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Parts 1-2, Account & Environment Setup)
2. **Follow** PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Sections 2-4, Infrastructure & Monitoring)
3. **Execute** automation scripts (Week 2)
4. **Verify** dry-run tests (Week 2, end)

### For QA/Testing
1. **Read** PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Parts 3-5, Test Data & Safety)
2. **Follow** PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Sections 3 & 6, Test Data & Validation)
3. **Execute** test scripts (Week 2 dry-run, then Phase 2 execution)
4. **Analyze** results and generate reports

### For Security/Compliance
1. **Review** PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Parts 5 & 8, Safety & Compliance)
2. **Verify** PHASE2-TEST-ENVIRONMENT-CHECKLIST.md (Section 5, Safety & Compliance)
3. **Monitor** audit logs during Phase 2 execution
4. **Approve** Phase 2 completion report

---

## 🎯 NEXT STEPS

### Immediate (Jun 15-16)
- [ ] Read this index document (5 min)
- [ ] Read PHASE2-INFRASTRUCTURE-SETUP-PLAN-2026-06-15.md (Sections 1-2, 30 min)
- [ ] Assign team members to checklist sections
- [ ] Schedule Week 1 kickoff meeting (Jun 17, 4 PM)

### Week 1 (Jun 18-22)
- [ ] Execute account signup (Part 1 of main plan)
- [ ] Daily checklist updates
- [ ] Friday sign-off: All accounts created & verified

### Week 2 (Jun 25-29)
- [ ] Execute environment setup (Parts 2-6 of main plan)
- [ ] Daily checklist verification
- [ ] Dry-run tests Thursday
- [ ] Friday approval & Phase 2 readiness sign-off

### Phase 2 (Jul 3-7)
- [ ] Execute 95 tests across all services
- [ ] Real-time monitoring and adjustment
- [ ] Daily result analysis
- [ ] Friday final report

---

## 📦 DELIVERABLES SUMMARY

| Deliverable | Type | Owner | Due Date | Status |
|------------|------|-------|----------|--------|
| Account credentials (encrypted) | Document | DevOps | Jun 22 | To be created |
| Test environment checklist (signed) | Checklist | Team | Jun 29 | To be created |
| Docker environment (operational) | Infrastructure | DevOps | Jun 27 | To be created |
| Grafana dashboards (live) | Monitoring | Monitoring Eng | Jun 28 | To be created |
| Dry-run test results | Test Results | QA | Jun 28 | To be created |
| Phase 2 execution log | Log | QA | Jul 7 | To be created |
| Final report + recommendations | Report | Data Analyst | Jul 8 | To be created |

---

## 🔗 CROSS-REFERENCES

### Related Basset Hound Documents

- `docs/ROADMAP.md` - v12.7.0 Phase 2 planning context
- `docs/handoffs/V12.3.0-PHASE-2-COMPLETE-2026-06-14.md` - Previous phase 2 context
- `docs/findings/V12.7.0-PHASE2-MASTER-PLAN-2026-06-15.md` - Development phase 2 planning
- `docker-compose.phase2.yml` - Docker configuration (to be created)
- `scripts/setup-phase2-environment.sh` - Automation script (to be created)

### External Service Documentation

- PerimeterX: https://docs.perimeterx.com/
- DataDome: https://docs.datadome.co/
- Cloudflare WAF: https://developers.cloudflare.com/waf/
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/

---

## ✨ DOCUMENT VERSION & HISTORY

**Current Version:** 1.0  
**Created:** June 15, 2026  
**Status:** ✅ Ready for Implementation  
**Last Review:** June 15, 2026  
**Next Review:** Upon Week 1 completion (June 22)

### Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-15 | DevOps Agent | Initial creation - complete setup plan |
| [TBD] | [TBD] | [Team] | Updates during Week 1-2 implementation |

---

**Prepared by:** Basset Hound Browser DevOps Planning Agent  
**For:** Team 1 Phase 2 Real-World Bot Detection Testing  
**Questions?** Refer to main infrastructure setup plan or contact team lead  

**Ready for June 18 Kickoff** ✅
