# Phase 2 Medium-Priority Fixes - Team Assignments & Dependency Matrix

**Date:** June 20, 2026  
**Total Team:** 4 developers  
**Duration:** 6-7 days (168 hours of work, 48 hours wall-clock)  
**Status:** READY FOR ASSIGNMENT  

---

## Team Structure & Assignments

### Developer 1: Network Security Lead
**Name/ID:** [To be assigned]  
**Primary Track:** M-001 (WSS/HTTPS) + M-004 (Python SSL)  
**Secondary:** Integration support  
**Total Hours:** 14 hours development + 2 hours integration = 16 hours

#### Detailed Responsibilities

**M-001: WSS/HTTPS Enforcement (8 hours)**

| Task | Hours | Dependencies | Deliverables |
|------|-------|--------------|---------------|
| SSL Cert Manager Design | 0.5h | None | Design doc, class structure |
| SSL Cert Manager Implementation | 2h | Design | `/src/security/ssl-certificate-manager.js` |
| Certificate Loading & Validation | 1h | Cert Mgr | Certificate loading code |
| Certificate Expiry Monitoring | 1h | Cert Mgr | Background monitoring task |
| WebSocket Server Integration | 1.5h | Cert Mgr | HTTPS server, wss:// handling |
| Testing Implementation | 2h | All code | `/tests/unit/security/wss-enforcement.test.js` |

**Day 1 (8 hours):**
- 08:00-08:30: Standup, review specs
- 08:30-09:00: SSL Cert Manager design
- 09:00-11:00: Implementation of Cert Manager
- 11:00-12:00: Certificate loading/validation
- 12:00-13:00: Lunch break
- 13:00-14:00: Certificate expiry monitoring
- 14:00-15:30: WebSocket integration
- 15:30-16:30: Testing (first pass)
- 16:30-17:00: Standup, check-in

**M-004: Python Client SSL/TLS (6 hours)**

| Task | Hours | Dependencies | Deliverables |
|------|-------|--------------|---------------|
| SSL Config Class Enhancement | 0.5h | M-001 complete | Extended SSLConfig |
| Secure Browser Client | 2h | SSLConfig | `/sdks/python-sdk/basset_hound_secure.py` |
| mTLS Client Implementation | 1h | SSLConfig | MutualTLSClient class |
| Config Loader Implementation | 1h | None | `/sdks/python-sdk/ssl_config_loader.py` |
| Testing Implementation | 1.5h | All code | Python SSL tests |

**Days 3-4 (6 hours):**
- After M-001 complete
- 08:00-09:00: SSL config enhancements
- 09:00-11:00: Secure Browser Client
- 11:00-12:00: mTLS Client
- 12:00-13:00: Lunch
- 13:00-14:00: Config Loader
- 14:00-15:30: Testing
- 15:30-16:00: Integration check

#### Success Criteria (M-001)
- ✅ SSL Cert Manager handles all certificate operations
- ✅ WebSocket server enforces HTTPS in production
- ✅ Certificate expiry monitored with background task
- ✅ 40/40 tests passing
- ✅ <2ms latency overhead for SSL handshake
- ✅ Clear error messages for certificate issues

#### Success Criteria (M-004)
- ✅ Python SDK enforces wss:// by default
- ✅ Certificate validation working correctly
- ✅ mTLS authentication functional
- ✅ Config loader works with env vars and files
- ✅ 20/20 tests passing
- ✅ Backward compatible with existing code

---

### Developer 2: Content Security Specialist
**Name/ID:** [To be assigned]  
**Primary Track:** M-002 (HTML Sanitization)  
**Secondary:** Security review support  
**Total Hours:** 12.5 hours development + 1 hour integration = 13.5 hours

#### Detailed Responsibilities

**M-002: HTML Sanitization (12.5 hours)**

| Task | Hours | Dependencies | Deliverables |
|------|-------|--------------|---------------|
| HTML Sanitizer Design | 0.5h | None | Design patterns, approach |
| Core Sanitizer Implementation | 3h | Design | `/src/extraction/html-sanitizer.js` core |
| Link Sanitization | 1h | Core | Link validation functions |
| Image Sanitization | 1h | Core | Image source validation |
| CSS Attack Prevention | 1h | Core | Style attribute cleaning |
| WebSocket Integration | 1.5h | Sanitizer | get_html command modifications |
| Python SDK Validation | 2h | None (parallel) | `/sdks/python-sdk/html_sanitizer.py` |
| Testing Implementation | 2.5h | All code | `/tests/unit/extraction/html-sanitizer.test.js` |

**Days 2-3 (12.5 hours):**
- 08:00-08:30: Standup, review specs
- 08:30-09:00: HTML Sanitizer design
- 09:00-12:00: Core sanitizer implementation (3h)
- 12:00-13:00: Lunch
- 13:00-14:00: Link sanitization
- 14:00-15:00: Image sanitization
- 15:00-16:00: CSS attack prevention
- 16:00-17:00: Testing (first pass)

**Day 3 (continued):**
- 08:00-09:30: WebSocket integration (1.5h)
- 09:30-11:30: Python SDK validation (2h)
- 11:30-12:00: Testing continuation
- 12:00-13:00: Lunch
- 13:00-15:30: Complete testing (60 tests)
- 15:30-16:00: Integration check

#### Success Criteria
- ✅ All XSS patterns blocked (20 tests)
- ✅ Safe links preserved (10 tests)
- ✅ Safe images preserved (10 tests)
- ✅ CSS attacks prevented (8 tests)
- ✅ Sanitization modes working (8 tests)
- ✅ Edge cases handled (4 tests)
- ✅ 60/60 tests passing
- ✅ No false positives breaking legitimate HTML
- ✅ <10ms sanitization overhead
- ✅ Python client validation working

---

### Developer 3: Privacy & Evasion Specialist
**Name/ID:** [To be assigned]  
**Primary Track:** M-003 (WebRTC IP Redaction)  
**Secondary:** Privacy audit support  
**Total Hours:** 9 hours development + 1 hour integration = 10 hours

#### Detailed Responsibilities

**M-003: WebRTC IP Redaction (9 hours)**

| Task | Hours | Dependencies | Deliverables |
|------|-------|--------------|---------------|
| WebRTC Leak Detection Design | 0.5h | None | Detection approach, patterns |
| Leak Detection Implementation | 2h | Design | `/src/security/webrtc-leak-detector.js` |
| ICE Candidate Monitoring | 1h | Detector | Candidate capture script |
| WebRTC Blocking Implementation | 1.5h | Detector | `/src/security/webrtc-blocker.js` |
| Proxy/Tor Integration | 0.5h | Blocker | Auto-blocking when proxy active |
| WebSocket Command Implementation | 1h | Blocker | detect_webrtc_leaks, block_webrtc, get_webrtc_status |
| Testing Implementation | 1.5h | All code | `/tests/unit/security/webrtc-leak-detection.test.js` |

**Days 2-3 (9 hours):**
- 08:00-08:30: Standup, review specs
- 08:30-09:00: WebRTC design
- 09:00-11:00: Leak detection implementation
- 11:00-12:00: ICE candidate monitoring
- 12:00-13:00: Lunch
- 13:00-14:30: WebRTC blocker implementation
- 14:30-15:00: Proxy/Tor integration
- 15:00-16:00: WebSocket commands
- 16:00-17:00: Testing (first pass)

**Day 3 (continued):**
- 08:00-09:30: Complete testing (30 tests)
- 09:30-10:00: Integration check
- 10:00-11:00: Documentation review

#### Success Criteria
- ✅ IP leaks detected via ICE candidates (12 tests)
- ✅ WebRTC completely disabled when needed (10 tests)
- ✅ Non-proxied connections blocked (8 tests)
- ✅ Works with Tor/proxy configurations (8 tests)
- ✅ 30/30 tests passing
- ✅ <100ms detection overhead
- ✅ No false positives preventing legitimate WebRTC
- ✅ Logs all blocking events for audit

---

### Developer 4: QA Lead & Integration Manager
**Name/ID:** [To be assigned]  
**Primary Track:** Testing & Integration (all 4 issues)  
**Secondary:** Code review, gate decisions  
**Total Hours:** 8 hours infrastructure + 8 hours testing + 4 hours integration = 20 hours

#### Detailed Responsibilities

**Testing Infrastructure Setup (2 hours - Day 1 morning)**

| Task | Hours | Deliverables |
|------|-------|---------------|
| Jest/Mocha configuration | 0.5h | Test framework setup |
| Mock/stub utilities | 0.5h | Test helpers |
| WebSocket test server | 0.5h | Test server for W-S testing |
| SSL certificate test files | 0.5h | Test certs, keys, CA certs |

**Test Implementation & Execution (12+ hours)**

| Test Suite | Dev | Hours | Tests | Timeline |
|------------|-----|-------|-------|----------|
| M-001 SSL/TLS | Dev 4 | 2h | 40 | Day 2 PM |
| M-002 HTML Sanitizer | Dev 4 | 3h | 60 | Day 3 PM |
| M-003 WebRTC | Dev 4 | 2h | 30 | Day 3 PM |
| M-004 Python SSL | Dev 4 | 1.5h | 20 | Day 4 AM |
| **Total** | | **8.5h** | **150** | **Days 2-4** |

**Integration & Validation (4 hours - Days 4-5)**

| Task | Hours | Deliverables |
|------|-------|---------------|
| WebSocket server integration | 1h | All modules working together |
| Regression test suite | 1h | No existing functionality broken |
| Load testing (100+ concurrent) | 1h | Performance impact measured |
| Gate decision documentation | 1h | Ready for staging approval |

**Daily Responsibilities (Ongoing)**
- Monitor all test runs
- Investigate test failures
- Support dev teams with debugging
- Maintain CI/CD pipeline
- Document issues and blockers
- Provide daily status updates

#### Success Criteria
- ✅ 150/150 unit tests passing
- ✅ <5% performance impact
- ✅ Zero regressions in existing functionality
- ✅ All code reviewed and approved
- ✅ Documentation complete and accurate
- ✅ Ready for staging deployment

---

## Dependencies & Blocking Relationships

### Dependency Chain

```
START (Day 1)
│
├─ M-001: SSL Cert Manager (Dev 1)
│  │  (2 hours, independent)
│  └─ SSL Cert Manager COMPLETE ✓
│
├─ M-001: WebSocket HTTPS (Dev 1, depends on SSL Manager)
│  │  (1.5 hours)
│  └─ M-001 COMPLETE ✓
│       ├─ M-004: Secure Browser Client (Dev 1, depends on M-001)
│       │  │  (2 hours, Day 3 start)
│       │  └─ M-004 partial COMPLETE ✓
│       │
│       └─ M-001: Testing (Dev 4, depends on code)
│           │  (2 hours, Day 2)
│           └─ M-001 TESTING COMPLETE ✓
│
├─ M-002: HTML Sanitizer (Dev 2, independent)
│  │  (5 hours, Days 2-3)
│  ├─ M-002: WebSocket Integration (Dev 2, depends on sanitizer)
│  │  │  (1.5 hours)
│  │  └─ M-002 partial COMPLETE ✓
│  │
│  └─ M-002: Testing (Dev 4, depends on code)
│      │  (3 hours, Day 3)
│      └─ M-002 TESTING COMPLETE ✓
│
├─ M-003: WebRTC Detector (Dev 3, independent)
│  │  (3 hours, Days 2-3)
│  ├─ M-003: WebRTC Blocker (Dev 3, depends on detector)
│  │  │  (1.5 hours)
│  │  ├─ M-003: WebSocket Integration (Dev 3, depends on blocker)
│  │  │  │  (1 hour)
│  │  │  └─ M-003 partial COMPLETE ✓
│  │  │
│  │  └─ M-003: Testing (Dev 4, depends on code)
│  │      │  (2 hours, Day 3)
│  │      └─ M-003 TESTING COMPLETE ✓
│  │
│  └─ M-004: mTLS Client (Dev 1, depends on detector)
│     │  (Wait for M-003 design)
│     └─ M-004 partial (after M-003 tested)
│
├─ M-004: Config Loader (Dev 1, independent of other M-004)
│  │  (1 hour, Day 3)
│  └─ M-004 partial COMPLETE ✓
│
├─ M-004: Testing (Dev 4, depends on code)
│  │  (1.5 hours, Day 4)
│  └─ M-004 TESTING COMPLETE ✓
│
└─ INTEGRATION PHASE (Days 4-5)
   ├─ Combine all 4 modules
   ├─ Regression testing
   ├─ Load testing
   └─ Gate 4 approval → PRODUCTION READY ✓
```

### Critical Path Analysis

**Critical Path:** M-001 → M-004 integration (16.5 hours)
- M-001: SSL Cert Manager (2h)
- M-001: WebSocket HTTPS (1.5h)
- M-001: Testing (2h)
- M-004: Secure Client (2h)
- M-004: mTLS (1h)
- M-004: Config Loader (1h)
- M-004: Testing (1.5h)
- Integration & Final Testing (4h)
= **16.5 hours minimum wall-clock time**

**Non-Critical Paths** (can run in parallel):
- M-002 (12.5h) - starts Day 2, ends Day 3
- M-003 (9h) - starts Day 2, ends Day 3

**Optimal Scheduling:**
- Days 1-2: M-001 (critical path) + M-002 start
- Days 2-3: M-002 (full) + M-003 (full) in parallel with M-001 end
- Days 3-4: M-004 (depends on M-001) + Integration
- Days 4-5: Final integration & validation

---

## Timeline with Deliverables

### Day 1 (8 hours): Foundation

**Dev 1 (Network Security):**
- 08:00 - 08:30: Kickoff meeting, assign issues
- 08:30 - 09:00: SSL Cert Manager design review
- 09:00 - 11:00: Implement SSL Cert Manager
- 11:00 - 12:00: Implement certificate loading/validation
- 12:00 - 13:00: Lunch
- 13:00 - 14:00: Implement certificate expiry monitoring
- 14:00 - 15:30: WebSocket HTTPS server integration
- 15:30 - 16:00: Quick testing, check-in
- 16:00 - 17:00: Dev sync on progress

**Dev 2 (Content Security):**
- 08:00 - 08:30: Kickoff, read specifications
- 08:30 - 09:00: HTML Sanitizer design
- 09:00 - 12:00: Implement core sanitizer
- 12:00 - 13:00: Lunch
- 13:00 - 14:00: Implement link sanitization
- 14:00 - 15:00: Implement image sanitization
- 15:00 - 16:00: Implement CSS attack prevention
- 16:00 - 17:00: Dev sync

**Dev 3 (Privacy):**
- 08:00 - 08:30: Kickoff, read specifications
- 08:30 - 09:00: WebRTC design
- 09:00 - 11:00: Implement leak detection
- 11:00 - 12:00: Implement ICE candidate monitoring
- 12:00 - 13:00: Lunch
- 13:00 - 14:30: Implement WebRTC blocker
- 14:30 - 15:00: Implement proxy/Tor integration
- 15:00 - 16:00: Implement WebSocket commands
- 16:00 - 17:00: Dev sync

**Dev 4 (QA):**
- 08:00 - 08:30: Kickoff, testing plan review
- 08:30 - 09:00: Setup Jest/Mocha
- 09:00 - 09:30: Create test utilities
- 09:30 - 10:00: Setup WebSocket test server
- 10:00 - 10:30: Prepare SSL test certificates
- 10:30 - 12:00: Prepare test infrastructure for all 4 issues
- 12:00 - 13:00: Lunch
- 13:00 - 17:00: Monitor dev progress, assist with debugging

**Day 1 Deliverables:**
- ✅ SSL Cert Manager working draft
- ✅ HTML Sanitizer core implementation
- ✅ WebRTC Detector draft
- ✅ Test infrastructure ready

---

### Day 2 (8 hours): Development Continues

**Dev 1:**
- M-001 final touches
- M-001 testing preparation
- Quick review of M-004 design

**Dev 2:**
- M-002 WebSocket integration
- M-002 Python SDK validation start

**Dev 3:**
- M-003 testing preparation
- Integration testing planning

**Dev 4:**
- Run M-001 unit tests (40 tests)
- Debug and fix test failures
- Prepare M-002 test cases

**Day 2 Deliverables:**
- ✅ M-001: 40/40 tests PASSING
- ✅ M-002: WebSocket integration complete
- ✅ M-003: All code complete, testing prep done

---

### Day 3 (8 hours): Testing Sprint

**Dev 1:**
- Begin M-004 implementation
- Code review M-001 changes

**Dev 2:**
- M-002 Python SDK complete
- Final tweaks to sanitizer
- Code review M-002

**Dev 3:**
- Final integration testing
- Code review M-003

**Dev 4:**
- Run M-002 tests (60 tests) - morning
- Run M-003 tests (30 tests) - afternoon
- Debug failures
- Prepare regression test suite

**Day 3 Deliverables:**
- ✅ M-002: 60/60 tests PASSING
- ✅ M-003: 30/30 tests PASSING
- ✅ M-004: 50% complete
- ✅ Regression tests prepared

---

### Day 4 (8 hours): Final Push

**Dev 1:**
- Complete M-004 mTLS client
- Complete M-004 config loader
- All M-004 code review

**Dev 2:**
- M-002 final code review
- Documentation updates

**Dev 3:**
- M-003 final code review
- Documentation updates

**Dev 4:**
- Run M-004 tests (20 tests)
- Run full regression suite (existing functionality)
- Prepare integration test cases
- Start integration testing

**Day 4 Deliverables:**
- ✅ M-001: 40/40 tests PASSING
- ✅ M-002: 60/60 tests PASSING
- ✅ M-003: 30/30 tests PASSING
- ✅ M-004: 20/20 tests PASSING
- ✅ Regression tests: 300+/300+ PASSING
- ✅ **Total: 150/150 tests PASSING**

---

### Day 5 (4 hours): Integration & Validation

**All Devs:**
- System integration testing
- Load testing (100+ concurrent connections)
- Performance measurement
- Documentation review
- Gate 4 decision meeting

**Deliverables:**
- ✅ All 4 modules integrated successfully
- ✅ Performance impact measured (<5ms added latency)
- ✅ Zero regressions
- ✅ Documentation complete
- ✅ Ready for staging deployment

---

### Days 6-7: Staging & Production (Not dev hours, but timeline)

**Day 6: Staging Deployment**
- Deploy to staging environment
- Smoke tests
- Extended testing (load, stress, security)

**Day 7: Production Deployment**
- Deploy to production
- Monitor alerts and metrics
- Hotfix readiness

---

## Key Dates & Gates

### Gate 1: M-001 Code Complete (EOD Day 2)
**Owner:** Dev 1  
**Approval:** Dev 4 (QA)  
**Requirement:** 40/40 tests passing

### Gate 2: M-002 & M-003 Complete (EOD Day 3)
**Owner:** Dev 2 & 3  
**Approval:** Dev 4 (QA)  
**Requirement:** 60/60 + 30/30 tests passing

### Gate 3: M-004 Complete (EOD Day 4)
**Owner:** Dev 1  
**Approval:** Dev 4 (QA)  
**Requirement:** 20/20 tests passing

### Gate 4: Full Integration (EOD Day 5)
**Owner:** Dev 4  
**Approval:** Security team  
**Requirement:** 150/150 tests, <5% perf impact, 0 regressions

---

## Communication & Escalation

### Daily Standup (15 minutes)
- **Time:** 08:00-08:15 every day
- **Format:** What did you do? What are you doing? Blockers?
- **Owner:** Dev 4 (QA Lead)

### Development Check-in (30 minutes)
- **Time:** 10:00-10:30 every day
- **Format:** In-depth technical discussion, code reviews
- **Owner:** Dev 1 (Network Security Lead) chairs

### Testing Sync (30 minutes)
- **Time:** 14:00-14:30 every day
- **Format:** Test status, failure analysis, coverage
- **Owner:** Dev 4 (QA Lead)

### Escalation Path
1. **Dev-level blocker:** Raise in daily standup
2. **Cross-team blocker:** Escalate to lead (Dev 1/4)
3. **Critical blocker:** Escalate to project manager

### Code Review Process
- **All code must be reviewed before commit**
- **Minimum 1 approval required**
- **Security review required for sensitive modules**
- **Automated tests must pass before merge**

---

## Success Metrics & Tracking

### Development Progress
- Commits per developer per day (target: 3-5)
- Test coverage (target: 95%+)
- Code review turnaround (target: <2 hours)

### Quality Metrics
- Test pass rate (target: 100%)
- Bug discovery rate (target: <1 bug per 500 LOC)
- Code style violations (target: 0)

### Timeline Metrics
- On-time delivery per task (target: 95%+)
- Gate approval rate (target: 100%)
- Rework due to quality (target: 0%)

### Security Metrics
- Vulnerability findings (target: 0 in final code)
- Security test coverage (target: 100% of threat vectors)
- Penetration test results (target: no critical findings)

---

## Risk Mitigation

### Risk: Developer availability
- **Mitigation:** Confirm availability before start date
- **Backup:** Identify alternate devs in related disciplines

### Risk: Integration complexity
- **Mitigation:** Detailed integration tests prepared in advance
- **Backup:** Integration lead (Dev 4) starts early

### Risk: Test environment issues
- **Mitigation:** Test infrastructure setup on Day 1
- **Backup:** Use local development for testing if needed

### Risk: Certificate/SSL issues
- **Mitigation:** Prepare test certificates in advance
- **Backup:** Self-signed cert generation for testing

### Risk: Performance impact
- **Mitigation:** Measure latency throughout development
- **Backup:** Optimize hotspots if needed

---

## Handoff & Documentation

### Code Handoff
- All code committed to `phase2-medium-priority` branch
- Pull request created for review
- Code review approved before merge
- Merge to main on Day 5

### Documentation Handoff
- All modules documented with inline comments
- Test cases documented with expected behavior
- Integration guide prepared
- Deployment guide prepared
- Troubleshooting guide prepared

### Knowledge Transfer
- Dev 1 → All: SSL/TLS infrastructure
- Dev 2 → All: HTML sanitization approach
- Dev 3 → All: WebRTC privacy considerations
- Dev 4 → All: Testing and quality assurance

---

**Timeline Status:** Ready for execution  
**Next Action:** Assign developers and confirm availability  
**Target Start Date:** June 24, 2026  
**Target Completion:** June 30, 2026  

For detailed implementation specs, see: `/docs/PHASE2-MEDIUM-PRIORITY-SECURITY-FIXES-PLAN.md`
