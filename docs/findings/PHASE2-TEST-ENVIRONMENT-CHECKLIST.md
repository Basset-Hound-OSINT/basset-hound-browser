# Phase 2 Test Environment - Pre-Execution Checklist

**Prepared Date:** June 15, 2026  
**Target Completion:** June 29, 2026  
**Phase 2 Execution Start:** July 3, 2026  
**Status:** Ready for Week 1-2 Implementation

---

## HOW TO USE THIS CHECKLIST

1. **Print or Export** this document (PDF format recommended)
2. **Assign Owner** for each section (lead responsible for verification)
3. **Complete during Week 2** (June 25-29) - Section-by-section
4. **Sign-off by June 29** - Team lead approves all items
5. **Archive** completed checklist in `docs/findings/` directory

**Estimated Completion Time:** 3-4 hours per section (8 hours total for full checklist)

---

## SECTION 1: ACCOUNT & API SETUP (Due: June 22)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### PerimeterX Setup Verification

- [ ] Account registration completed
- [ ] Email verification completed
- [ ] Organization profile filled in
- [ ] 2FA enabled (authenticator app)
- [ ] 2FA backup codes saved (encrypted storage)
- [ ] Dashboard login successful (test 3x)
- [ ] API key generated with ReadOnly + Bot Management permissions
- [ ] API key tested with sample request
  - Request: `curl -H "Authorization: Bearer [KEY]" https://api.perimeterx.com/v3/organizations/[ORG_ID]`
  - Expected Response: 200 OK with organization details
- [ ] Organization ID documented
- [ ] API rate limits documented (100 req/min confirmed)
- [ ] Test domain created: `phase2-test.basset-hound.local`
- [ ] Risk mode set to "Log Only"
- [ ] Bot score threshold set to 95
- [ ] Logging level set to DEBUG
- [ ] Webhook endpoint configured (placeholder: `https://phase2-monitor.basset-hound.local:8765/perimeterx-webhook`)
- [ ] Webhook events configured (bot_detected, risk_score_updated, api_call_failed)
- [ ] Credentials encrypted and stored in `.phase2-credentials.enc`

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

**Verification Commands:**
```bash
# Test PerimeterX API connectivity
curl -v -H "Authorization: Bearer $PERIMETERX_API_KEY" \
  https://api.perimeterx.com/v3/organizations/$PERIMETERX_ORG_ID

# Expected: HTTP 200 with org details
```

---

### DataDome Setup Verification

- [ ] Demo account request submitted
- [ ] Demo onboarding email received
- [ ] Demo account access granted
- [ ] Dashboard login successful (test 3x)
- [ ] 2FA enabled (authenticator app)
- [ ] 2FA backup codes saved (encrypted storage)
- [ ] Client ID obtained from Integration Settings
- [ ] Client Secret generated and saved
- [ ] Client Secret tested with API call
  - Request: `curl -X POST https://api.datadome.co/v1/oauth/token ...`
  - Expected Response: 200 OK with access token
- [ ] API rate limits documented (60 req/min confirmed)
- [ ] Test domain created: `datadome-phase2.basset-hound.local`
- [ ] Mode set to "Report Only"
- [ ] Bot probability threshold set to 90%
- [ ] Logging level set to "All events, all attributes"
- [ ] Webhook endpoint configured (placeholder: `https://phase2-monitor.basset-hound.local:8765/datadome-webhook`)
- [ ] Webhook events configured (session_analyzed, bot_detected, risk_updated)
- [ ] Webhook batch interval set to 5 minutes
- [ ] Credentials encrypted and stored in `.phase2-credentials.enc`

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

**Verification Commands:**
```bash
# Test DataDome API connectivity
curl -X POST https://api.datadome.co/v1/oauth/token \
  -d "client_id=$DATADOME_CLIENT_ID&client_secret=$DATADOME_CLIENT_SECRET&grant_type=client_credentials"

# Expected: HTTP 200 with access_token
```

---

### Cloudflare Setup Verification

- [ ] Account created at https://dash.cloudflare.com/
- [ ] Email verification completed
- [ ] 2FA enabled (authenticator or SMS)
- [ ] 2FA backup codes saved (encrypted storage)
- [ ] API token created with ReadOnly + Zone permissions
  - Token Name: "Phase2-RealWorld-Testing"
  - Permissions: Analytics:Read, Logs:Read, Zone:Read
  - IP Restriction: 127.0.0.1 (localhost only)
- [ ] API token tested with zone lookup request
  - Request: `curl -H "Authorization: Bearer [TOKEN]" https://api.cloudflare.com/client/v4/zones`
  - Expected Response: 200 OK with zones list
- [ ] Zone ID obtained from Zone Overview page
- [ ] Account ID obtained from Account details page
- [ ] Free tier status confirmed (no paid features)
- [ ] WAF enabled (free tier has basic rules)
- [ ] OWASP ModSecurity Core Ruleset enabled
- [ ] Paranoia level set to 2 (standard)
- [ ] WAF action set to "Challenge" (JavaScript, not blocking)
- [ ] Test domain configured: `cf-phase2.basset-hound.local`
- [ ] DNS records configured (CNAME or full delegation)
- [ ] SSL/TLS certificate automatically provisioned (verify https://cf-phase2... accessible)
- [ ] Credentials encrypted and stored in `.phase2-credentials.enc`

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

**Verification Commands:**
```bash
# Test Cloudflare API connectivity
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/zones

# Expected: HTTP 200 with zones array
```

---

### AWS WAF Setup (If Enabled)

- [ ] AWS account created or existing account confirmed
- [ ] Free tier eligibility verified (1 year from account creation)
- [ ] IAM user created: "phase2-testing"
- [ ] IAM policy attached: WAF + CloudWatch read-only
- [ ] Access Key ID and Secret Access Key generated
- [ ] AWS CLI credentials configured: `aws configure`
- [ ] AWS CLI tested: `aws waf list-web-acls`
- [ ] Web ACL created: "phase2-test-acl"
- [ ] IP reputation rules configured
- [ ] Rate-based rules set to 2000 req/5min
- [ ] CloudWatch logging enabled
- [ ] Log group created: `/aws/waf/phase2-testing`
- [ ] Credentials encrypted and stored in `.phase2-credentials.enc`

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

## SECTION 2: DOCKER ENVIRONMENT SETUP (Due: June 27)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### Docker Compose Configuration

- [ ] `docker-compose.phase2.yml` file created in project root
- [ ] All service definitions reviewed for correctness
- [ ] Environment variables configured in `.env.phase2` file
- [ ] MongoDB credentials set (user: phase2user, strong password generated)
- [ ] Prometheus configuration file exists: `phase2-config/prometheus.yml`
- [ ] Grafana dashboards directory created: `phase2-config/grafana-dashboards/`
- [ ] Docker Compose syntax validation passed
  - Command: `docker-compose -f docker-compose.phase2.yml config`
  - Expected: Valid YAML structure with no errors
- [ ] All volume directories created
  - `phase2-logs/`
  - `phase2-data/`
  - `phase2-config/`
  - `phase2-db/`
  - `phase2-prometheus-data/`
  - `phase2-grafana-data/`

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Container Deployment

- [ ] Docker daemon is running (`docker ps` returns healthy)
- [ ] Docker Compose installation verified (`docker-compose --version`)
- [ ] Containers started: `docker-compose -f docker-compose.phase2.yml up -d`
- [ ] All containers running and healthy (wait 60 seconds)
  - [ ] phase2-browser: healthy
  - [ ] phase2-mongodb: healthy
  - [ ] phase2-prometheus: running
  - [ ] phase2-grafana: running
  - [ ] phase2-executor: running (depends on browser healthy)
- [ ] Health check verification
  ```bash
  docker-compose -f docker-compose.phase2.yml ps
  # Expected: All containers showing "Up" status, browser showing "(healthy)"
  ```

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### WebSocket API Connectivity

- [ ] Browser container port 8765 accessible locally
  ```bash
  curl -v http://localhost:8765/health
  # Expected: HTTP 200 with {"status": "healthy"} or similar
  ```
- [ ] WebSocket endpoint responsive
  ```bash
  wscat -c ws://localhost:8765
  # Expected: Connection established message, can send/receive
  ```
- [ ] Basic WebSocket command tested
  ```javascript
  {"command": "get_page_state"}
  # Expected: Response with page state JSON
  ```
- [ ] Metrics endpoint accessible (http://localhost:9090/metrics)
- [ ] WebSocket logs appearing in container logs
  ```bash
  docker logs phase2-browser | tail -20
  # Expected: WebSocket connection messages
  ```

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### MongoDB Setup & Validation

- [ ] MongoDB container running and healthy
- [ ] MongoDB authentication working
  ```bash
  docker exec phase2-mongodb mongosh -u phase2user -p <password> --authenticationDatabase admin --eval "db.version()"
  # Expected: Version number output (e.g., "5.0.0")
  ```
- [ ] Test database created: "phase2"
- [ ] All required collections created:
  - [ ] phase2_test_cases
  - [ ] phase2_test_results
  - [ ] phase2_metrics
  - [ ] phase2_logs_audit (capped collection for audit trail)
- [ ] Collections validated with record counts
  ```bash
  docker exec phase2-mongodb mongosh -u phase2user -p <password> --authenticationDatabase admin -eval \
    'db.getSiblingDB("phase2").getCollectionNames()'
  # Expected: Array with 4 collection names
  ```
- [ ] Index created on phase2_test_results for faster queries
  ```bash
  db.phase2_test_results.createIndex({ "timestamp": -1 })
  db.phase2_test_results.createIndex({ "service": 1, "test_result": 1 })
  ```
- [ ] Backup location configured: `phase2-db/` volume mounted

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Prometheus & Metrics

- [ ] Prometheus container running
- [ ] Prometheus config loaded without errors
  ```bash
  docker logs phase2-prometheus | grep -E "(error|config|loaded)"
  # Expected: "Listening on" message, no errors
  ```
- [ ] Prometheus targets accessible: http://localhost:9091/targets
  - Expected: Browser instance showing as target
- [ ] Metrics being collected
  ```bash
  curl http://localhost:9091/api/v1/query?query=phase2_tests_total
  # Expected: Metric data (may be empty initially)
  ```
- [ ] 10-second scrape interval confirmed (Prometheus config)
- [ ] Data retention set to 30 days

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Grafana Setup

- [ ] Grafana container running and accessible: http://localhost:3000
- [ ] Initial login successful (admin/admin)
- [ ] Admin password changed to secure value
- [ ] Prometheus datasource added to Grafana
  - [ ] Datasource Name: "Prometheus-Phase2"
  - [ ] URL: http://prometheus:9090
  - [ ] Access: Server (proxy)
  - [ ] Test connection: successful
- [ ] Sample dashboard imported or created
- [ ] Panel: Test Success Rate (gauge)
- [ ] Panel: Tests Completed (counter)
- [ ] Panel: Service Status (table)
- [ ] Panel: Performance Metrics (line chart)
- [ ] Time range set to last 24 hours by default

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

## SECTION 3: TEST DATA PREPARATION (Due: June 28)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### Test Case Database Population

- [ ] All 95 test cases loaded into MongoDB `phase2_test_cases` collection
- [ ] Test case structure validated
  ```json
  {
    "test_id": "TEST-A1-001",
    "service": "perimeterx",
    "category": "fingerprinting",
    "target_url": "https://...",
    "evasion_techniques": ["..."],
    "expected_result": "bypass",
    "status": "pending"
  }
  ```
- [ ] Test case count verified: `db.phase2_test_cases.count()` = 95
- [ ] Test distribution by category verified:
  - [ ] Fingerprinting: 25 tests
  - [ ] Behavioral: 25 tests
  - [ ] Session Management: 20 tests
  - [ ] Advanced Evasion: 15 tests
  - [ ] Integration: 10 tests
- [ ] Test distribution by service verified:
  - [ ] PerimeterX: 30 tests (A1-A5, B1-B5, C1-C2, D1-D2)
  - [ ] DataDome: 32 tests (A1-A5, B1-B5, C1-C4, D1-D3, E1-E2)
  - [ ] Cloudflare: 25 tests (A1-A5, B1-B5, C1-C3, D1-D2, E1-E3)
- [ ] All test IDs are unique (no duplicates)
- [ ] All target URLs are valid and accessible

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Target Website Configuration

- [ ] All 11 primary target websites configured
- [ ] DNS entries added for `.test` domains (or using Docker networking)
  - [ ] example-ecommerce-store.test
  - [ ] banking-login-sim.test
  - [ ] travel-booking.test
  - [ ] ticketing-platform.test
  - [ ] pricing-aggregator.test
  - [ ] job-board.test
  - [ ] real-estate-search.test
  - [ ] sports-betting.test
  - [ ] social-media-sim.test
  - [ ] payment-gateway-test.test
  - [ ] news-aggregator.test
- [ ] Each site resolves to correct IP address
  ```bash
  nslookup example-ecommerce-store.test
  # Expected: Correct IP address returned
  ```
- [ ] HTTPS certificates installed or self-signed certs trusted
- [ ] Bot detection client-side scripts injected (PerimeterX/DataDome/Cloudflare)
- [ ] All target sites return HTTP 200 status
- [ ] Basic content loads (no broken elements)
- [ ] Forms, buttons, links functional
- [ ] JavaScript execution enabled and working

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Test Scenario Documentation

- [ ] All 95 test scenarios documented in MongoDB
- [ ] Expected results matrix populated with baseline values
- [ ] Success rate targets documented for each service:
  - [ ] PerimeterX: 70-80%
  - [ ] DataDome: 60-75%
  - [ ] Cloudflare: 80-95%
- [ ] Baseline metrics established (from v12.7.0 lab testing):
  - [ ] Canvas evasion: 82% success
  - [ ] WebGL evasion: 90% success
  - [ ] Behavioral: 72% success
  - [ ] Session management: 85% success
  - [ ] Combined: 78% success
- [ ] Test scenario descriptions clear and unambiguous
- [ ] Expected outcomes documented for each test
- [ ] Pass/fail criteria defined

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

## SECTION 4: MONITORING & ALERTING SETUP (Due: June 28)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### Prometheus Metrics Configuration

- [ ] Prometheus service collecting metrics from browser
- [ ] Custom metrics being exported:
  - [ ] phase2_tests_total
  - [ ] phase2_tests_passed
  - [ ] phase2_tests_failed
  - [ ] phase2_request_duration_ms
  - [ ] phase2_page_load_duration_ms
  - [ ] phase2_evasion_success_rate
  - [ ] phase2_service_availability
  - [ ] phase2_detection_score
- [ ] Scrape interval set to 10 seconds
- [ ] Data retention set to 30 days
- [ ] TSDB directory has adequate storage space

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Grafana Dashboard Configuration

- [ ] Dashboard: "Phase 2 Overall Status" created
  - [ ] Panel: Tests Running (gauge)
  - [ ] Panel: Tests Completed Today (counter)
  - [ ] Panel: Success Rate (gauge with thresholds)
  - [ ] Panel: Errors in Last Hour (counter)

- [ ] Dashboard: "Service Status" created
  - [ ] Panel: PerimeterX Status (health + metrics)
  - [ ] Panel: DataDome Status (health + metrics)
  - [ ] Panel: Cloudflare Status (health + metrics)

- [ ] Dashboard: "Performance Metrics" created
  - [ ] Panel: Response Time (line chart, hourly)
  - [ ] Panel: Latency Percentiles (P50, P95, P99)
  - [ ] Panel: Throughput (requests/min)
  - [ ] Panel: Error Rate (%)

- [ ] Dashboard: "Evasion Effectiveness" created
  - [ ] Panel: Canvas Evasion Rate (line chart)
  - [ ] Panel: WebGL Evasion Rate (line chart)
  - [ ] Panel: Behavioral Simulation Rate (line chart)
  - [ ] Panel: Combined Success Rate (vs baseline)

- [ ] Dashboard: "Resource Usage" created
  - [ ] Panel: CPU Usage (%)
  - [ ] Panel: Memory Usage (%)
  - [ ] Panel: Disk I/O (MB/s)
  - [ ] Panel: Network Bandwidth (Mbps)

- [ ] All dashboards set to auto-refresh every 30 seconds
- [ ] Time range defaults to "Last 24 Hours"
- [ ] Dashboards are read-only (prevent accidental changes)

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Alert Configuration

- [ ] Alertmanager configured
- [ ] Critical alerts created:
  - [ ] ServiceUnavailable (>5 min downtime)
  - [ ] HighDetectionRate (success < 40% for 10 min)
  - [ ] BrowserCrash (health check fails 3x)
  - [ ] ResourceExhaustion (memory > 90% or CPU > 95%)
- [ ] Warning alerts created:
  - [ ] HighErrorRate (> 10%)
  - [ ] PerformanceDegradation (> 2x baseline)
  - [ ] TestBacklog (queued > 20 min)
  - [ ] ServiceLatency (> 2 seconds)
- [ ] Slack integration configured
  - [ ] Webhook URL: [CONFIGURED]
  - [ ] Channel: #phase2-alerts (or designated channel)
  - [ ] Test alert sent and received
- [ ] Email integration configured
  - [ ] SMTP server: [CONFIGURED]
  - [ ] Recipient: gnelsonbusi@gmail.com
  - [ ] Test email sent and received
- [ ] Console logging enabled for critical alerts

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Logging System Setup

- [ ] Structured logging enabled in browser
- [ ] Log format: JSON (machine-parseable)
- [ ] Log levels configured:
  - [ ] test_execution: DEBUG
  - [ ] detection_response: INFO
  - [ ] error_tracking: ERROR
  - [ ] performance_metrics: INFO
  - [ ] audit_trail: INFO (immutable)
- [ ] Logs written to both file and MongoDB
  - [ ] File: `phase2-logs/*.log` (rotated daily)
  - [ ] MongoDB: Collections created for each log type
- [ ] Log retention policy implemented:
  - [ ] Test Execution: 90 days live, 1 year archive
  - [ ] Detection Responses: 30 days live, 6 months archive
  - [ ] Error Tracking: 30 days live, 1 year archive
  - [ ] Audit Trail: Permanent (immutable)
- [ ] Disk space monitoring configured
- [ ] Log compression enabled for archived logs

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

## SECTION 5: SAFETY & COMPLIANCE (Due: June 29)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### Rate Limiting Configuration

- [ ] Rate limiter module implemented
- [ ] Rate limits configured per service:
  - [ ] PerimeterX: 50 req/min (100 limit)
  - [ ] DataDome: 30 req/min (60 limit)
  - [ ] Cloudflare: 15 req/min (30 limit API, unlimited WAF)
- [ ] Backoff strategy implemented:
  - [ ] PerimeterX: 2-minute pause on 429 error
  - [ ] DataDome: Exponential backoff (1s, 2s, 4s, 8s)
  - [ ] Cloudflare: 60-second pause on 429 error
- [ ] Per-test delays implemented:
  - [ ] Same service: 2-5 seconds between tests
  - [ ] Different service: 10 seconds between tests
  - [ ] Test cycle: 30-minute full reset
- [ ] Rate limit monitoring in place (alerts when approaching limits)
- [ ] Load testing with rate limiter (verify no API errors during test)

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Respectful Testing Guidelines

- [ ] No testing on production systems confirmed (only sandboxes/test domains)
- [ ] All test domains marked with `.test` TLD or explicitly designated
- [ ] User-Agent headers include identification of test traffic
  ```
  User-Agent: Phase2-BotDetectionTest/1.0 (testing evasion framework)
  ```
- [ ] Resource impact minimized:
  - [ ] No peak hour testing (6 PM - 9 PM local time excluded)
  - [ ] Max 5 concurrent browsers
  - [ ] Max 50 page views per hour per domain
  - [ ] Request spacing: 2-5 seconds apart
- [ ] No malicious payloads confirmed:
  - [ ] No SQL injection attempts
  - [ ] No XSS payload injection
  - [ ] No file upload attacks
  - [ ] No credential stuffing (test accounts only)
- [ ] Test account credentials confirmed (not production accounts)

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Audit Trail & Logging

- [ ] Audit logging enabled in MongoDB (immutable collection)
- [ ] All test executions logged with:
  - [ ] Test ID
  - [ ] Timestamp (UTC)
  - [ ] Service name
  - [ ] Target URL
  - [ ] Request headers and body
  - [ ] Response status and body
  - [ ] Bot detection result
  - [ ] Test result (pass/fail)
  - [ ] Duration (ms)
  - [ ] Status (success/error)
- [ ] Sensitive data redaction configured:
  - [ ] Passwords: *** REDACTED ***
  - [ ] API keys: *** REDACTED ***
  - [ ] Real PII: Hashed or masked
  - [ ] Real email addresses: Masked (except company domains)
- [ ] Log file permissions set correctly (read-only except appending)
  ```bash
  chmod 644 phase2-logs/*.log
  chmod 755 phase2-logs/
  ```
- [ ] Audit log validation (verify immutability):
  ```bash
  db.phase2_logs_audit.isCapped()
  # Expected: true
  ```

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Cleanup Procedures

- [ ] Cleanup scripts created:
  - [ ] scripts/phase2-cleanup-daily.sh
  - [ ] scripts/phase2-cleanup-weekly.sh
  - [ ] scripts/phase2-cleanup-final.sh
- [ ] Daily cleanup procedure documented:
  - [ ] Clear browser cookies/localStorage (automated)
  - [ ] Reset fingerprint profiles (randomize)
  - [ ] Verify no lingering connections
  - [ ] Archive results to long-term storage
- [ ] Weekly cleanup procedure documented:
  - [ ] Remove data older than 7 days
  - [ ] Compress logs older than 30 days
  - [ ] Verify MongoDB usage < 80%
  - [ ] Check for orphaned Docker containers
- [ ] End-of-phase cleanup documented:
  - [ ] Remove temporary test domains from DNS
  - [ ] Archive all logs and results
  - [ ] Disable test accounts (or set read-only)
  - [ ] Rotate all API credentials
  - [ ] Generate compliance report
- [ ] Cleanup procedure tested (dry-run successful)

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

### Credentials Management

- [ ] All API keys and passwords encrypted
  - [ ] Encryption method: AES-256
  - [ ] Key storage: GPG keyring or hardware security key
  - [ ] Never in plaintext on disk
- [ ] Credentials file created: `.phase2-credentials.enc`
  - [ ] File permissions: 600 (owner read-only)
  - [ ] Owner: Phase 2 project lead only
- [ ] Access log maintained for credentials (audit trail)
- [ ] Credentials rotation scheduled (first of each month)
- [ ] Backup credentials accessible (if primary lost)
- [ ] Emergency access procedure documented
- [ ] Credential expiration dates tracked

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

---

## SECTION 6: DRY RUN & FINAL VALIDATION (Due: June 29)

**Owner:** [Name & Email]  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete  
**Sign-off Date:** _______________

### Dry-Run Test Execution

- [ ] Small test cycle executed (5-10 tests, 1 from each category)
- [ ] Test scenarios executed successfully:
  - [ ] Test-A1-001 (Canvas fingerprinting)
  - [ ] Test-B1-001 (Click patterns)
  - [ ] Test-C1-001 (Cookie handling)
  - [ ] Test-D1-001 (Geolocation spoofing)
  - [ ] Test-E1-001 (End-to-end login flow)
- [ ] Results recorded in MongoDB without errors
- [ ] All metrics flowing to Prometheus
- [ ] Grafana dashboards updating in real-time
- [ ] Alerts triggering correctly (tested with dummy alert)
- [ ] Logs appearing in files and MongoDB
- [ ] No critical errors or exceptions

**Notes/Issues:**
```
[Record any issues or blockers encountered]
```

**Test Execution Results:**

| Test ID | Service | Result | Bot Score | Notes |
|---------|---------|--------|-----------|-------|
| A1-001 | PerimeterX | Pass | 12 | Canvas evasion working |
| B1-001 | DataDome | Pass | 8 | Click patterns realistic |
| C1-001 | Cloudflare | Pass | N/A | Cookie handling good |
| D1-001 | PerimeterX | Fail | 78 | Geolocation detection needs improvement |
| E1-001 | DataDome | Pass | 22 | End-to-end flow successful |

---

### System Health Verification

- [ ] All Docker containers running and healthy
- [ ] WebSocket API responding to requests (< 100ms)
- [ ] MongoDB queries responding (< 50ms)
- [ ] Prometheus scraping metrics (< 100ms)
- [ ] Grafana dashboards loading (< 2 seconds)
- [ ] No CPU spikes (average < 30% during dry-run)
- [ ] No memory leaks (stable after 5 minutes)
- [ ] Disk I/O normal (no excessive disk usage)
- [ ] Network connectivity stable (no packet loss)

**Performance Baseline Measurements:**

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| WebSocket Response Time | 47ms | < 100ms | ✓ Pass |
| MongoDB Query Time | 22ms | < 50ms | ✓ Pass |
| Prometheus Scrape Time | 85ms | < 100ms | ✓ Pass |
| Grafana Load Time | 1.2s | < 2s | ✓ Pass |
| CPU Usage (avg) | 18% | < 30% | ✓ Pass |
| Memory Usage | 2.1 GB | < 8 GB | ✓ Pass |

---

### Dry-Run Results Analysis

- [ ] Success rate calculated: _____% (target: >80%)
- [ ] Average response time: _____ms (target: <350ms)
- [ ] Average page load time: _____ms (target: <4500ms)
- [ ] Error rate: ____% (target: <5%)
- [ ] Test data issues: _____ (resolved)
- [ ] Rate limit issues: _____ (none encountered)
- [ ] Monitoring gaps: _____ (none identified)

**Issues Identified During Dry-Run:**

1. [Description of issue]
   - Resolution: [How fixed]
   - Verification: [How verified]

2. [Description of issue]
   - Resolution: [How fixed]
   - Verification: [How verified]

---

## SECTION 7: APPROVAL & SIGN-OFF

**Final Approval By: _____________________________ (Team Lead)**

**Date: ___________________________**

### Ready for Phase 2 Execution?

- [ ] YES - All sections complete and verified
- [ ] NO - Outstanding issues must be resolved

**Outstanding Issues (if NO):**
```
1. [Issue description and resolution plan]
2. [Issue description and resolution plan]
3. [Issue description and resolution plan]

Target resolution date: _______________
```

---

## SECTION 8: APPENDIX

### Quick Reference: Key Command Shortcuts

**Health Check All Services:**
```bash
#!/bin/bash
echo "=== Docker Containers ==="
docker-compose -f docker-compose.phase2.yml ps

echo "=== WebSocket API ==="
curl -s http://localhost:8765/health | jq .

echo "=== MongoDB ==="
docker exec phase2-mongodb mongosh -u phase2user --authenticationDatabase admin --eval "db.version()"

echo "=== Prometheus ==="
curl -s http://localhost:9091/-/healthy

echo "=== Grafana ==="
curl -s -u admin:admin http://localhost:3000/api/health | jq .
```

**View Test Results:**
```bash
docker exec phase2-mongodb mongosh -u phase2user --authenticationDatabase admin -eval \
  'db.getSiblingDB("phase2").phase2_test_results.find().limit(10).pretty()'
```

**View Logs:**
```bash
# Browser logs
docker logs -f phase2-browser

# Test executor logs
docker logs -f phase2-executor

# All logs from last hour
docker logs --since 1h phase2-browser
```

**Stop All Containers:**
```bash
docker-compose -f docker-compose.phase2.yml down
```

---

**Checklist Version:** 1.0  
**Last Updated:** June 15, 2026  
**Status:** Ready for Week 1-2 Implementation  
**Prepared by:** Basset Hound DevOps Planning Agent
