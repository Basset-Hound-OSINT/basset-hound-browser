# Phase 2 Real-World Bot Detection Testing - Infrastructure Setup Plan

**Date:** June 15, 2026  
**Version:** 1.0  
**Status:** Ready for Implementation  
**Target Launch:** June 18, 2026  
**Duration:** 3 weeks (Jun 18 - Jul 7)

---

## EXECUTIVE SUMMARY

This document provides a complete infrastructure setup guide for Phase 2 of real-world bot detection testing against production detection services. Phase 2 validates the effectiveness of Basset Hound Browser's evasion framework (85-90% baseline) against actual bot detection systems in controlled sandbox environments.

### Key Objectives
- ✅ Establish sandbox accounts with 5+ detection services
- ✅ Configure test environment with monitoring and logging
- ✅ Set up test data matrix (11 target sites, 95 test cases)
- ✅ Implement real-time monitoring and alerting
- ✅ Validate compliance and safety guardrails
- ✅ Execute 3-week testing campaign (Jun 18 - Jul 7)

### Success Criteria
- All sandbox accounts verified and accessible
- Test environment passing 100% health checks
- Baseline metrics established for v12.7.0 performance
- Zero safety violations or rate limit triggers
- Complete audit trail for all test executions

---

## PART 1: SANDBOX ACCOUNT SETUP

### 1.1 PerimeterX - Free Trial Account

**Service Type:** Bot detection and application security platform  
**Primary Use:** Real-world JavaScript-heavy site testing  
**Trial Duration:** 14-30 days (varies by signup)

#### Registration Steps

1. **Navigate to signup:** https://www.perimeterx.com/free-trial
2. **Complete account form:**
   - Email: `gnelsonbusi@gmail.com`
   - Company: "Basset Hound Security Research"
   - Use case: "Bot evasion validation testing (authorized)"
   - Country: United States
3. **Verify email:** Check inbox for verification link
4. **Create dashboard login:** Set secure password (26+ chars, mixed case/numbers/symbols)
5. **Complete company profile:** Enable 2FA via authenticator app

#### API Key Acquisition

1. **Access Admin Dashboard:**
   - Navigate: Settings → Integration → API Keys
   - Find section: "Organization API Keys"
2. **Generate new key:**
   - Click "Create New API Key"
   - Label: "Phase2-RealWorld-Testing"
   - Permissions: ReadOnly, Bot Management Console
   - Expiration: 90 days
3. **Copy credentials:**
   - API Key: Store in `.env.perimeterx`
   - Organization ID: Available in Account settings

#### Test Mode Configuration

1. **Enable test mode websites:**
   - Admin Dashboard → Domains
   - Add test domain: `phase2-test.basset-hound.local`
   - Configure: Risk Mode = "Log Only" (no blocking)
   - Enable detailed logging (all events)

2. **Configure bot score thresholds:**
   - Default risk threshold: 75 (blocks at >75 score)
   - Test threshold: Set to 95 (logs but doesn't block)
   - Logging level: DEBUG (all request details)

3. **Setup webhook for notifications:**
   - Endpoint: `https://phase2-monitor.basset-hound.local:8765/perimeterx-webhook`
   - Events: bot_detected, risk_score_updated, api_call_failed
   - Retry policy: 3 retries, 5-second delay

#### Rate Limit Expectations

| Metric | Value | Notes |
|--------|-------|-------|
| API calls/min | 100 | Shared across all organization API keys |
| API calls/day | 50,000 | Cumulative limit |
| Events logged/day | Unlimited | Within fair-use policy |
| Dashboard sessions | 5 concurrent | Per account |
| Test domains | 2 | With free trial |
| Data retention | 30 days | Rolling window |

**Safety Strategy:** Implement request throttling at 50 req/min (50% of limit) with 2-minute backoff on 429 errors.

---

### 1.2 DataDome - Demo/Sandbox Account

**Service Type:** Behavioral bot detection focused on evasion resistance  
**Primary Use:** Behavioral pattern analysis  
**Demo Duration:** Usually 30 days

#### Registration Steps

1. **Request demo:** https://www.datadome.co/request-demo
2. **Complete demo form:**
   - Email: `gnelsonbusi@gmail.com`
   - Organization: "Basset Hound Security Research"
   - Use case: "Bot detection framework validation"
   - Primary industry: "Security Research"
3. **Schedule onboarding call** (optional, can skip for faster access)
4. **Receive demo credentials** via email (typically 24-48 hours)
5. **Accept terms:** Agree to responsible use policy

#### API Key Acquisition

1. **Access Dashboard:**
   - URL: `https://console.datadome.co/` (credentials in email)
   - First login: Set 2FA via SMS or authenticator
2. **Navigate to API section:**
   - Menu → Settings → API Keys
3. **Generate test token:**
   - Client ID: Available under "Integration Settings"
   - Client Secret: Generate new secret (store securely)
   - Scope: "read:events", "read:bot_scores"
4. **Note API endpoints:**
   - Event API: `https://api.datadome.co/v1/events`
   - Dashboard: Already configured in demo account

#### Test Mode Configuration

1. **Enable demo website:**
   - Dashboard → Websites → Add Website
   - Domain: `datadome-phase2.basset-hound.local`
   - Mode: "Report Only" (no blocking)
   - Data collection: Maximum detail level

2. **Configure behavioral thresholds:**
   - Bot probability threshold: 90% (log only until reaching 90% confidence)
   - Logging level: All events, all attributes
   - Session tracking: Enabled with 60-minute cookie window

3. **Setup event webhook:**
   - Endpoint: `https://phase2-monitor.basset-hound.local:8765/datadome-webhook`
   - Event types: session_analyzed, bot_detected, risk_updated
   - Batch interval: Send every 5 minutes or 100 events

#### Rate Limit Expectations

| Metric | Value | Notes |
|--------|-------|-------|
| API requests/min | 60 | Per API key |
| Events logged/day | Unlimited | Demo account |
| Concurrent sessions | 10 | Per domain |
| API keys | 2 | Recommended: 1 for testing, 1 for monitoring |
| Demo duration | 30 days | Can be extended |

**Safety Strategy:** Cap testing at 30 req/min (50% limit) with exponential backoff starting at 1 second.

---

### 1.3 Cloudflare - Free Tier WAF Configuration

**Service Type:** DDoS protection + WAF (includes bot management in paid tier, but free tier has basic detection)  
**Primary Use:** Common WAF testing, baseline evasion validation  
**Cost:** Free tier (no billing required)

#### Registration/Setup Steps

1. **Create Cloudflare account:** https://dash.cloudflare.com/signup
   - Email: `gnelsonbusi@gmail.com`
   - Password: 26+ chars, mixed case/numbers/symbols
2. **Verify email and enable 2FA**
3. **Add test domain:**
   - Dashboard → Add Site → Add your site
   - Domain: `cf-phase2.basset-hound.local` (or use real subdomain if available)
   - Select Free plan
4. **Update nameservers** (if using real domain) or configure via CNAME for subdomain

#### WAF Configuration

1. **Navigate to Security → WAF:**
   - Cloudflare Dashboard → Security → WAF
2. **Enable free WAF rules:**
   - Managed Rules: Enable "Cloudflare OWASP ModSecurity Core Ruleset"
   - Paranoia Level: 2 (standard, not aggressive)
   - Action: Challenge (CAPTCHA) - log but don't block automatically

3. **Configure Bot Management (Paid Features - skip for free):**
   - Free tier: Only basic JavaScript challenge
   - Alternative: Use "Challenge" for suspicious patterns

4. **Setup logging:**
   - Enable Logpush (requires paid tier) OR
   - Use GraphQL API to query bot traffic: `https://api.cloudflare.com/client/v4/graphql`
   - Query: Access logs filtered by `BotManagementScore` (if available)

#### API Configuration

1. **Generate API token:**
   - User → API Tokens → Create Token
   - Template: "Read Logs" OR create custom
   - Permissions: 
     - `Analytics:Read`
     - `Logs:Read` (if using Logpush)
     - `Zone:Read`
   - Zone Resources: Specific zone or All zones
   - Client IP Restriction: `127.0.0.1` (restrictive)

2. **Store credentials:**
   - API Token: In `.env.cloudflare`
   - Zone ID: From Zone Overview page
   - Account ID: From Account details

#### Rate Limit Expectations

| Metric | Value | Notes |
|--------|-------|-------|
| API calls/min | 30 | Free tier |
| API calls/day | 40,000 | Approximate fair-use limit |
| WAF rule evaluations | Unlimited | All traffic monitored |
| JavaScript challenges | Unlimited | No cost |
| Analytics retention | 3 days | Free tier |

**Safety Strategy:** Limit API calls to 10/min (33% of free tier). Use dashboard analytics instead of API when possible.

---

### 1.4 Alternative Free/Public Detection Services

#### Option A: AWS WAF (Free Tier)

**Setup:** 
1. Create AWS account if not exists
2. Activate free tier: https://aws.amazon.com/free/
3. Navigate to WAF console
4. Create test web ACL with free tier IP reputation lists
5. Enable IP logging via CloudWatch

**Rate Limits:** 10,000 rules processed per second (easily sufficient)  
**Cost:** Free tier includes limited monthly requests  

**Endpoint for Testing:**
```
https://phase2-test-waf.basset-hound.local (point to AWS WAF)
```

#### Option B: Imperva - Free Trial

**Setup:**
1. Request trial: https://www.imperva.com/free-trial/
2. Configure test domain
3. Set to "Alert Only" mode
4. Enable detailed logging

**Rate Limits:** 50 API requests/min  
**Duration:** 14 days typically

#### Option C: Public Detection Services (No Auth Required)

**Browser Leak Tests (Free, Used for Baseline):**
- CreepJS: https://www.creepjs.com
- BrowserLeaks: https://browserleaks.com
- FingerPrintJS: https://fingerprint.com/products/demo/
- Bot.Sannysoft: https://bot.sannysoft.com

**Integration:** Use as read-only validation points (no account needed)

---

## PART 2: TEST ENVIRONMENT SETUP

### 2.1 Infrastructure Requirements

#### Hardware Specifications

**Minimum Requirements:**
- CPU: 8 cores (for parallel test execution)
- RAM: 16 GB (Docker containers + browsers)
- Storage: 100 GB (logs, screenshots, test data)
- Network: 100 Mbps stable connection

**Recommended Setup:**
- CPU: 16 cores
- RAM: 32 GB
- Storage: 500 GB SSD (better for log I/O)
- Network: 1 Gbps dedicated

#### Docker Compose Configuration

Create `/home/devel/basset-hound-browser/docker-compose.phase2.yml`:

```yaml
version: '3.9'

services:
  # Main Basset Hound Browser instance
  browser:
    image: basset-hound-browser:latest
    container_name: phase2-browser
    environment:
      - TOR_MODE=AUTO
      - LOG_LEVEL=debug
      - ENABLE_METRICS=true
      - METRICS_PORT=9090
      - WEBSOCKET_PORT=8765
    ports:
      - "8765:8765"      # WebSocket API
      - "9090:9090"      # Prometheus metrics
    volumes:
      - ./tests/results:/app/tests/results
      - ./phase2-logs:/app/logs
      - ./phase2-data:/app/data
    networks:
      - phase2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # MongoDB for test result storage
  mongodb:
    image: mongo:latest
    container_name: phase2-mongodb
    environment:
      - MONGO_INITDB_ROOT_USERNAME=phase2user
      - MONGO_INITDB_ROOT_PASSWORD=secure_password_here
    ports:
      - "27017:27017"
    volumes:
      - ./phase2-db:/data/db
    networks:
      - phase2-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  # Prometheus for metrics collection
  prometheus:
    image: prom/prometheus:latest
    container_name: phase2-prometheus
    volumes:
      - ./phase2-config/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./phase2-prometheus-data:/prometheus
    ports:
      - "9091:9090"
    networks:
      - phase2-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: phase2-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - ./phase2-grafana-data:/var/lib/grafana
      - ./phase2-config/grafana-dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - phase2-network

  # Test executor service
  test-executor:
    image: phase2-test-executor:latest  # To be built
    container_name: phase2-executor
    environment:
      - BROWSER_HOST=browser
      - BROWSER_PORT=8765
      - MONGODB_URI=mongodb://phase2user:secure_password_here@mongodb:27017/phase2
      - LOG_LEVEL=debug
    depends_on:
      browser:
        condition: service_healthy
    volumes:
      - ./phase2-scripts:/app/scripts
      - ./tests/results:/app/results
      - ./phase2-logs:/app/logs
    networks:
      - phase2-network

networks:
  phase2-network:
    driver: bridge

volumes:
  phase2-db:
  phase2-prometheus-data:
  phase2-grafana-data:
```

### 2.2 Proxy Configuration

#### Residential Proxy Setup

**For Test Execution (with rotation):**

```bash
# phase2-proxy-config.json
{
  "enabled": true,
  "provider": "residential",
  "rotation_mode": "performance",
  "rotation_interval_requests": 25,
  "max_retries": 3,
  "timeout_seconds": 10,
  "pools": [
    {
      "name": "primary_residential",
      "type": "residential",
      "endpoints": [
        "http://proxy1.residential.local:8080",
        "http://proxy2.residential.local:8080",
        "http://proxy3.residential.local:8080"
      ],
      "auth": {
        "username": "phase2_user",
        "password": "phase2_password"
      }
    },
    {
      "name": "datacenter_backup",
      "type": "datacenter",
      "endpoints": [
        "http://backup1.datacenter.local:8080"
      ],
      "auth": {
        "username": "phase2_user",
        "password": "phase2_password"
      }
    }
  ],
  "health_check": {
    "enabled": true,
    "interval_seconds": 300,
    "timeout_seconds": 5,
    "url": "https://httpbin.org/ip"
  }
}
```

#### User Agent Rotation

```bash
# phase2-useragent-config.json
{
  "rotation_mode": "category",
  "rotation_interval": "every_5_requests",
  "categories": [
    "chrome_desktop_latest",
    "firefox_desktop_latest",
    "safari_desktop_latest",
    "chrome_mobile_latest",
    "firefox_mobile_latest"
  ],
  "regional_variation": true,
  "allow_bot_user_agents": false
}
```

### 2.3 Test Database Setup

#### MongoDB Collections

**Collection: `phase2_test_cases`**
```javascript
{
  _id: ObjectId,
  test_id: "TEST-001",
  service: "perimeterx",
  target_url: "https://example.com/login",
  evasion_techniques: ["fingerprint_spoof", "behavioral_simulation"],
  expected_result: "bypass",
  test_data: { /* ... */ },
  created_at: ISODate("2026-06-18T00:00:00Z"),
  status: "pending"  // pending, running, completed, failed
}
```

**Collection: `phase2_test_results`**
```javascript
{
  _id: ObjectId,
  test_case_id: "TEST-001",
  service: "perimeterx",
  execution_timestamp: ISODate("2026-06-18T10:30:00Z"),
  request_details: {
    user_agent: "Mozilla/5.0...",
    ip_address: "192.168.1.100",
    headers: { /* ... */ },
    cookies: { /* ... */ }
  },
  response_details: {
    status_code: 200,
    bot_score: 15,
    bot_detected: false,
    detection_method: "javascript_challenge",
    risk_indicators: []
  },
  test_result: "passed",  // passed, failed, inconclusive
  metrics: {
    response_time_ms: 245,
    page_load_time_ms: 3200,
    resource_count: 42,
    request_count: 18
  },
  error_details: null,
  notes: "Successful bypass with canvas fingerprinting + behavioral simulation"
}
```

**Collection: `phase2_metrics`**
```javascript
{
  _id: ObjectId,
  timestamp: ISODate("2026-06-18T10:30:00Z"),
  service: "perimeterx",
  metrics: {
    tests_completed: 45,
    tests_passed: 38,
    tests_failed: 7,
    success_rate: 0.844,
    avg_response_time_ms: 312,
    avg_page_load_time_ms: 2850,
    unique_ips_used: 12,
    unique_user_agents: 8
  }
}
```

---

### 2.4 Logging System Configuration

#### Structured Logging Setup

**Log Levels & Channels:**

```javascript
// phase2-logging-config.js
module.exports = {
  loggers: {
    test_execution: {
      level: "debug",
      format: "json",
      output: [
        "file:logs/test-execution.log",
        "mongodb:phase2_logs_execution"
      ]
    },
    detection_response: {
      level: "info",
      format: "json",
      output: [
        "file:logs/detection-responses.log",
        "mongodb:phase2_logs_detection",
        "console:json"
      ]
    },
    error_tracking: {
      level: "error",
      format: "json",
      output: [
        "file:logs/errors.log",
        "mongodb:phase2_logs_errors",
        "slack:phase2-errors"
      ]
    },
    performance_metrics: {
      level: "info",
      format: "json",
      output: [
        "file:logs/performance.log",
        "mongodb:phase2_logs_metrics",
        "prometheus:phase2_metrics"
      ]
    },
    audit_trail: {
      level: "info",
      format: "json",
      immutable: true,
      output: [
        "file:logs/audit-trail.log",
        "mongodb:phase2_logs_audit"
      ]
    }
  }
};
```

#### Log Retention Policy

| Log Type | Retention | Archive Location |
|----------|-----------|------------------|
| Test Execution | 90 days live, 1 year archive | `phase2-logs/archive/` |
| Detection Responses | 30 days live, 6 months archive | `phase2-logs/responses/` |
| Error Tracking | 30 days live, 1 year archive | `phase2-logs/errors/` |
| Performance Metrics | 7 days live (Prometheus), forever in DB | MongoDB |
| Audit Trail | Permanent | MongoDB (immutable collection) |

---

## PART 3: TEST DATA PREPARATION

### 3.1 Target Websites Selection (11 Primary + 5 Secondary)

#### Primary Targets (11 Sites)

| # | Domain | Detection Service | Risk Level | Reason for Selection |
|---|--------|-------------------|-----------|----------------------|
| 1 | example-ecommerce-store.test | PerimeterX | Low | High JavaScript usage, common bot target |
| 2 | banking-login-sim.test | DataDome | Medium | Behavioral pattern analysis required |
| 3 | travel-booking.test | Cloudflare WAF | Low | Form automation testing |
| 4 | ticketing-platform.test | PerimeterX | Medium | Real-time availability checking |
| 5 | pricing-aggregator.test | DataDome | Medium | Content scraping simulation |
| 6 | job-board.test | Cloudflare WAF | Low | Bulk profile downloads |
| 7 | real-estate-search.test | PerimeterX | Low | Search automation |
| 8 | sports-betting.test | DataDome | High | Behavioral + fingerprinting |
| 9 | social-media-sim.test | Cloudflare WAF | Medium | Login + session testing |
| 10 | payment-gateway-test.test | PerimeterX | Medium | Transaction sequence testing |
| 11 | news-aggregator.test | DataDome | Low | Content extraction testing |

**Setup Instructions:**
1. Host test versions locally or use iframe redirects
2. Configure local DNS entries in `/etc/hosts` (or Docker networking)
3. Install PerimeterX/DataDome/Cloudflare client-side scripts on each test site
4. Ensure all sites use HTTPS with self-signed certs (add to browser trust store)

#### Secondary Targets (5 Backup Sites)

- `api-rate-limit-sim.test` - API endpoint testing
- `carousel-form-test.test` - Dynamic form handling
- `infinite-scroll-page.test` - Scroll-based loading
- `spa-framework-test.test` - Single Page App evasion
- `webgl-canvas-heavy.test` - Graphics API testing

---

### 3.2 Test Scenarios (95 Total Test Cases)

#### Category A: Fingerprinting Evasion (25 Tests)

**A1: Canvas Fingerprinting (5 tests)**
- Test-A1-001: Canvas to WebGL fallback
- Test-A1-002: Canvas noise injection
- Test-A1-003: Canvas readPixels mocking
- Test-A1-004: Canvas context restoration
- Test-A1-005: Multiple canvas element spoofing

**A2: WebGL Fingerprinting (5 tests)**
- Test-A2-001: WebGL shader spoofing
- Test-A2-002: WebGL renderer string obfuscation
- Test-A2-003: WebGL parameter randomization
- Test-A2-004: WebGL extension hiding
- Test-A2-005: GPU model switching

**A3: Audio Context (5 tests)**
- Test-A3-001: Audio context noise addition
- Test-A3-002: Oscillator frequency variation
- Test-A3-003: Sample rate randomization
- Test-A3-004: Channel count spoofing
- Test-A3-005: Destination channel behavior

**A4: Font Enumeration (5 tests)**
- Test-A4-001: Font list randomization
- Test-A4-002: Font availability spoofing
- Test-A4-003: Font metrics variation
- Test-A4-004: System font hiding
- Test-A4-005: Custom font addition

**A5: WebRTC Leaks (5 tests)**
- Test-A5-001: IP leak prevention
- Test-A5-002: Port prediction blocking
- Test-A5-003: mDNS randomization
- Test-A5-004: RTCDataChannel obfuscation
- Test-A5-005: Peer connection state spoofing

#### Category B: Behavioral Simulation (25 Tests)

**B1: Click Patterns (5 tests)**
- Test-B1-001: Variable click intervals (min 150ms, max 800ms)
- Test-B1-002: Click coordinate randomization
- Test-B1-003: Double-click simulation
- Test-B1-004: Right-click context menu
- Test-B1-005: Drag-and-drop sequences

**B2: Typing Patterns (5 tests)**
- Test-B2-001: Variable keystroke intervals (40-120ms)
- Test-B2-002: Typo introduction and correction
- Test-B2-003: Copy-paste vs manual entry mix
- Test-B2-004: Backspace and deletion patterns
- Test-B2-005: Form field focus behavior

**B3: Mouse Movement (5 tests)**
- Test-B3-001: Bezier curve movement (not straight line)
- Test-B3-002: Acceleration/deceleration patterns
- Test-B3-003: Jitter injection
- Test-B3-004: Pause and resume movements
- Test-B3-005: Movement velocity variance

**B4: Scroll Behavior (5 tests)**
- Test-B4-001: Variable scroll speeds
- Test-B4-002: Scroll pause patterns
- Test-B4-003: Scroll direction changes
- Test-B4-004: Smooth vs instant scrolls
- Test-B4-005: Touch scroll simulation

**B5: Navigation Timing (5 tests)**
- Test-B5-001: Page dwell time (realistic 3-15 seconds)
- Test-B5-002: Link click delays
- Test-B5-003: Form submission timing
- Test-B5-004: Cross-page navigation intervals
- Test-B5-005: Back button usage patterns

#### Category C: Session Management (20 Tests)

**C1: Cookie Handling (5 tests)**
- Test-C1-001: Cookie persistence across sessions
- Test-C1-002: Third-party cookie isolation
- Test-C1-003: Cookie domain scope validation
- Test-C1-004: Secure/HttpOnly flag handling
- Test-C1-005: Cookie rotation on new session

**C2: Local Storage (5 tests)**
- Test-C2-001: localStorage key randomization
- Test-C2-002: Storage quota enforcement
- Test-C2-003: Storage clearing between sessions
- Test-C2-004: Cross-domain storage isolation
- Test-C2-005: IndexedDB consistency

**C3: Session Headers (5 tests)**
- Test-C3-001: Accept-Language rotation
- Test-C3-002: Accept-Encoding consistency
- Test-C3-003: Referer header management
- Test-C3-004: Origin header validation
- Test-C3-005: DNT and privacy headers

**C4: Profile Rotation (5 tests)**
- Test-C4-001: Different profile per 5 requests
- Test-C4-002: Profile-specific fingerprint consistency
- Test-C4-003: Profile history isolation
- Test-C4-004: Cache clearing between profiles
- Test-C4-005: Authentication token management

#### Category D: Advanced Evasion (15 Tests)

**D1: Geolocation Spoofing (3 tests)**
- Test-D1-001: Geolocation coordinates spoofing
- Test-D1-002: Timezone spoofing
- Test-D1-003: Locale-specific content delivery

**D2: Device Spoofing (3 tests)**
- Test-D2-001: Mobile device emulation
- Test-D2-002: Screen resolution variation
- Test-D2-003: Device model/brand spoofing

**D3: Network Evasion (3 tests)**
- Test-D3-001: Proxy rotation validation
- Test-D3-002: VPN/Tor circuit changes
- Test-D3-003: DNS leak prevention

**D4: API Evasion (3 tests)**
- Test-D4-001: Battery API spoofing
- Test-D4-002: Sensor API randomization
- Test-D4-003: Notification API mocking

**D5: Request Manipulation (3 tests)**
- Test-D5-001: Request header injection
- Test-D5-002: Response header stripping
- Test-D5-003: TLS fingerprinting evasion

#### Category E: Integration Scenarios (10 Tests)

**E1: Full End-to-End Flows (4 tests)**
- Test-E1-001: Complete login flow with evasion (7-step sequence)
- Test-E1-002: Shopping cart checkout (8-step sequence)
- Test-E1-003: Job application submission (6-step sequence)
- Test-E1-004: Flight booking flow (10-step sequence)

**E2: Edge Cases (3 tests)**
- Test-E2-001: JavaScript disabled mode
- Test-E2-002: Slow network simulation (3G speeds)
- Test-E2-003: Mobile browser constraints

**E3: Concurrent Operations (3 tests)**
- Test-E3-001: Multiple parallel requests
- Test-E3-002: Tab switching during operations
- Test-E3-003: Session cross-contamination prevention

---

### 3.3 Expected vs Actual Results Matrix

#### Test Result Status Definitions

| Status | Definition | Action |
|--------|-----------|--------|
| **PASS** | Bot detection bypassed, no blocking/challenge | Document success metrics |
| **FAIL** | Bot detection triggered, request blocked/challenged | Analyze detection vector |
| **INCONCLUSIVE** | Timeout or ambiguous response | Retry with adjusted parameters |
| **ERROR** | Technical error (crash, network failure) | Investigate and fix |
| **SKIP** | Test condition not met (e.g., service down) | Retry in next cycle |

#### Expected Results by Service

**PerimeterX (Target: 70-80% bypass rate)**
- Canvas evasion: 75-85% success
- WebGL evasion: 80-90% success
- Behavioral simulation: 65-75% success
- Session management: 70-80% success
- Combined multi-vector: 70-85% success

**DataDome (Target: 60-75% bypass rate)**
- Behavioral patterns: 50-65% success
- Fingerprinting evasion: 65-75% success
- Session consistency: 60-70% success
- Combined approach: 60-75% success

**Cloudflare WAF (Target: 80-95% bypass rate)**
- Basic WAF rules: 85-95% success
- JavaScript challenge: 75-85% success
- Rate limiting bypass: 70-80% success
- Combined approach: 80-95% success

#### Result Collection Template

```json
{
  "test_id": "TEST-A1-001",
  "timestamp": "2026-06-18T10:30:45Z",
  "service": "perimeterx",
  "target_url": "https://example-ecommerce-store.test/login",
  "evasion_technique": "canvas_fingerprinting",
  "expected_result": "bypass",
  "actual_result": "pass",
  "bot_detection": {
    "score": 15,
    "threshold": 75,
    "triggered": false
  },
  "metrics": {
    "request_duration_ms": 245,
    "page_load_duration_ms": 3200,
    "resource_count": 42,
    "third_party_requests": 8
  },
  "validation": {
    "response_code": 200,
    "content_length": 52834,
    "content_type": "text/html",
    "security_headers": {
      "x-frame-options": "SAMEORIGIN",
      "x-content-type-options": "nosniff"
    }
  },
  "notes": "Canvas spoofing effective with WebGL fallback. Browser profiles differ consistently.",
  "retry_count": 0
}
```

---

### 3.4 Baseline Metrics (v12.7.0 Performance)

#### Baseline Establishment (Week of June 16-18)

**Controlled Lab Testing (Pre-Real-World):**

1. **Canvas Fingerprinting Evasion**
   - Baseline success rate: 82% (from v12.3.0 implementation)
   - Average response time: 312ms
   - Detection service: local CreepJS simulator

2. **WebGL Fingerprinting Evasion**
   - Baseline success rate: 90% (from v12.3.0 implementation)
   - Average response time: 289ms
   - Detection service: local browserleaks simulator

3. **Behavioral Simulation**
   - Baseline success rate: 72% (conservative estimate)
   - Average interaction time: 4500ms (realistic human-like)
   - Metric: Click variance, typing speed

4. **Session Management**
   - Baseline success rate: 85% (5-layer validation)
   - Session coherence: 100% consistent profiles
   - Cookie/storage isolation: 100%

5. **Combined Multi-Vector Approach**
   - Baseline success rate: 78% (from v12.3.0 comprehensive testing)
   - Average total time: 8200ms
   - Resource efficiency: 2.3 MB average payload

#### Metrics to Collect

```javascript
{
  timestamp: "2026-06-18T00:00:00Z",
  version: "12.7.0",
  baseline_metrics: {
    canvas_evasion: {
      success_rate: 0.82,
      avg_response_ms: 312,
      detection_avoidance: 0.82,
      false_positive_rate: 0.03
    },
    webgl_evasion: {
      success_rate: 0.90,
      avg_response_ms: 289,
      detection_avoidance: 0.90,
      false_positive_rate: 0.02
    },
    behavioral_simulation: {
      success_rate: 0.72,
      avg_interaction_ms: 4500,
      pattern_consistency: 0.88,
      variance_metrics: {
        click_interval_cv: 0.35,
        keystroke_interval_cv: 0.42
      }
    },
    session_management: {
      success_rate: 0.85,
      coherence_score: 1.0,
      profile_consistency: 1.0,
      isolation_score: 1.0
    }
  }
}
```

---

## PART 4: MONITORING & INSTRUMENTATION

### 4.1 Real-Time Test Execution Monitoring

#### Dashboard Setup

**Grafana Dashboard Panels (Create in Phase 2 Startup):**

1. **Overall Status Panel**
   - Current tests running (gauge 0-10)
   - Tests completed today (counter)
   - Success rate (gauge 0-100%)
   - Errors in last hour (counter)

2. **Service Status Panel** (by detection service)
   - PerimeterX: tests running, pass rate, last error
   - DataDome: tests running, pass rate, last error
   - Cloudflare: tests running, pass rate, last error

3. **Performance Metrics Panel**
   - Avg response time (line graph, hourly)
   - P50, P95, P99 latency (stacked area)
   - Throughput (requests/minute)
   - Error rate (%)

4. **Evasion Effectiveness Panel**
   - Canvas evasion rate (line graph)
   - WebGL evasion rate (line graph)
   - Behavioral simulation rate (line graph)
   - Combined success rate (comparison to baseline)

5. **Resource Usage Panel**
   - CPU usage (%)
   - Memory usage (%)
   - Disk I/O (reads/writes per second)
   - Network bandwidth (in/out)

#### Prometheus Metrics Export

```javascript
// Key metrics to export
{
  'phase2_tests_total': Counter,  // Total tests executed
  'phase2_tests_passed': Counter,  // Passed tests
  'phase2_tests_failed': Counter,  // Failed tests
  'phase2_request_duration_ms': Histogram,  // Request latency
  'phase2_page_load_duration_ms': Histogram,  // Page load time
  'phase2_evasion_success_rate': Gauge,  // Success rate by technique
  'phase2_service_availability': Gauge,  // Service up/down (0-1)
  'phase2_detection_score': Gauge,  // Bot detection score by service
  'phase2_resource_usage_bytes': Gauge  // Memory, disk usage
}
```

### 4.2 Success/Failure Rate Tracking

#### Automated Failure Analysis

Create script: `/home/devel/basset-hound-browser/scripts/phase2-failure-analyzer.js`

**Failure Categories:**
1. **Detection Service Issues** (Service down, API error, auth failure)
2. **Browser Issues** (Crash, timeout, connection lost)
3. **Evasion Failure** (Detection triggered, bot score high)
4. **Environmental Issues** (Network timeout, DNS failure, proxy down)
5. **Test Data Issues** (Invalid URL, malformed request, missing config)

**Actions:**
- Log all failures to MongoDB with full context
- Trigger alerts for critical failures (>5 consecutive)
- Auto-retry with exponential backoff (1s, 2s, 4s, 8s, stop)
- Generate failure report daily

#### Success Rate Reporting

**Daily Report Email (to `gnelsonbusi@gmail.com`):**

```
Subject: Phase 2 Daily Test Report - [DATE]

Test Execution Summary
======================
Total Tests: 95
Completed: 85
Passed: 71
Failed: 14
Success Rate: 83.5%

By Service
==========
PerimeterX: 28/30 (93.3%) ✓
DataDome: 24/32 (75.0%) ⚠
Cloudflare: 19/25 (76.0%) ⚠

By Category
===========
Fingerprinting: 22/25 (88.0%) ✓
Behavioral: 18/25 (72.0%) ⚠
Session Management: 17/20 (85.0%) ✓
Advanced Evasion: 11/15 (73.3%) ⚠
Integration: 3/10 (30.0%) ✗ NEEDS INVESTIGATION

Critical Issues
===============
- DataDome webhook not responding (6 tests failed)
- Cloudflare WAF timing out on high-load tests
- Integration test E1-004 flight booking flow timeout

Next Steps
==========
1. Check DataDome API status
2. Investigate Cloudflare timeout root cause
3. Reduce concurrent load on integration tests
```

### 4.3 Performance Metrics Collection

#### Key Metrics by Category

**Latency Metrics:**
- Request round-trip time (ms)
- Browser navigation time (ms)
- Detection response time (ms) - from bot detection service

**Throughput Metrics:**
- Tests per hour
- Requests per second
- Successful bypasses per hour

**Resource Metrics:**
- Memory consumption (MB) - browser instance
- CPU usage (%) - container
- Disk I/O (MB/s) - log writes
- Network bandwidth (Mbps)

**Evasion Metrics:**
- Bypass success rate (%)
- Detection score average (0-100)
- False positive rate (%)
- Detection latency (ms)

#### Collection Intervals

| Metric Category | Collection Interval | Retention |
|-----------------|-------------------|-----------|
| Test Results | Real-time (per test) | 90 days |
| Performance Summary | Every 1 minute | 7 days detailed, 1 year hourly |
| Evasion Effectiveness | Hourly aggregation | 3 years |
| Resource Usage | Every 10 seconds | 7 days |
| Audit Trail | Per event | Permanent |

---

### 4.4 Alert Configuration

#### Alert Rules (Prometheus/Alertmanager)

**Critical Alerts (Immediate notification):**

1. `ServiceUnavailable` - Detection service API down
   ```
   IF down time > 5 minutes THEN page on-call engineer
   ```

2. `HighDetectionRate` - Evasion failing consistently
   ```
   IF success_rate < 40% for 10 minutes THEN alert
   ```

3. `BrowserCrash` - Browser instance down
   ```
   IF health_check fails 3 times THEN restart + alert
   ```

4. `ResourceExhaustion` - Memory/CPU critical
   ```
   IF memory > 90% OR CPU > 95% for 2 minutes THEN alert
   ```

**Warning Alerts (Daily digest):**

1. `HighErrorRate` - Error rate > 10%
2. `PerformanceDegradation` - Response time > 2x baseline
3. `TestBacklog` - Tests queued > 20 minutes
4. `ServiceLatency` - Detection service response > 2 seconds

#### Notification Channels

| Alert Severity | Channel | Escalation |
|---|---|---|
| Critical | Email + Slack + Console | 5 min if not acked |
| Warning | Slack + Daily email | None (digest) |
| Info | Log file only | None |

---

## PART 5: SAFETY & COMPLIANCE

### 5.1 Rate Limiting Strategy

#### Request Throttling Policy

**By Detection Service:**

| Service | Max Req/Min | Phase 2 Limit | Buffer | Backoff |
|---------|------------|---------------|--------|---------|
| PerimeterX | 100 | 50 | 50% | 2 minutes |
| DataDome | 60 | 30 | 50% | 2 minutes |
| Cloudflare | 30 | 15 | 50% | 2 minutes |

**Implementation:**
```javascript
// phase2-rate-limiter.js
class RateLimiter {
  constructor(maxReqPerMin = 30) {
    this.maxReqPerMin = maxReqPerMin;
    this.requests = [];
    this.backoffUntil = null;
  }

  async acquireToken() {
    if (this.backoffUntil && Date.now() < this.backoffUntil) {
      const waitMs = this.backoffUntil - Date.now();
      await sleep(waitMs);
    }

    // Clean old requests (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.requests = this.requests.filter(t => t > oneMinuteAgo);

    if (this.requests.length >= this.maxReqPerMin) {
      // Too many requests, initiate backoff
      this.backoffUntil = Date.now() + 120000;  // 2 minute backoff
      throw new RateLimitExceededError();
    }

    this.requests.push(Date.now());
  }
}
```

#### Per-Test Delays

**Between Tests (same service):** 2-5 seconds (randomized)  
**Between Services:** 10 seconds (allow API cool-down)  
**Between Test Cycles:** 30 minutes (full reset)

### 5.2 Respectful Testing of Real Websites

#### Website Testing Guidelines

1. **Never test on production systems** without explicit authorization
2. **Use designated test/sandbox domains** only (marked with `.test` TLD)
3. **Identify as automated test traffic** in User-Agent when possible
4. **Minimize resource impact:**
   - Avoid peak hours (6 AM - 9 PM local time)
   - Space out requests (max 5 concurrent browsers)
   - Limit page views (no more than 50 per hour per domain)
5. **No malicious payloads:**
   - No SQL injection attempts
   - No XSS payload injection
   - No file upload attacks
   - No credential stuffing (use test accounts only)

### 5.3 Logging for Audit Trail

#### Audit Log Fields (Mandatory)

Every test execution must log:

```json
{
  "audit_id": "AUDIT-20260618-00001",
  "timestamp": "2026-06-18T10:30:45.123Z",
  "actor": "phase2-test-executor",
  "action": "execute_test",
  "resource": {
    "test_id": "TEST-A1-001",
    "service": "perimeterx",
    "target_url": "https://example-ecommerce-store.test/login"
  },
  "request_data": {
    "method": "GET",
    "url": "https://example-ecommerce-store.test/login",
    "headers": {
      "user-agent": "Mozilla/5.0...",
      "referer": "https://..."
    },
    "ip_address": "198.51.100.42",
    "proxy_used": "residential-proxy-1"
  },
  "response_data": {
    "status_code": 200,
    "detection_score": 15,
    "bot_detected": false
  },
  "test_result": "passed",
  "duration_ms": 2450,
  "status": "success"
}
```

**Retention:** Permanent (immutable MongoDB collection)  
**Access Control:** Only authorized Phase 2 team members

#### Sensitive Data Handling

**Fields to Redact in Logs (if containing real credentials):**
- Passwords / API keys (use placeholders like `***REDACTED***`)
- Real credit card numbers (keep only last 4 digits)
- Real PII (use hashed identifiers)
- Real email addresses (unless in company domain)

### 5.4 Cleanup Procedures

#### Post-Testing Cleanup Checklist

**After Each Test Cycle:**
- [ ] Clear browser cookies and local storage
- [ ] Reset fingerprint profiles (randomize for next test)
- [ ] Verify no lingering connections (check with `netstat`)
- [ ] Archive test results to long-term storage

**Weekly Cleanup:**
- [ ] Remove test data older than 7 days (keep summary)
- [ ] Compress logs older than 30 days
- [ ] Verify MongoDB disk usage < 80%
- [ ] Check for orphaned Docker containers

**End-of-Phase Cleanup:**
- [ ] Remove temporary test domains from DNS
- [ ] Archive all logs and results
- [ ] Disable test accounts or set to read-only
- [ ] Remove credentials from memory (rotate all API keys)
- [ ] Generate final compliance report

---

## PART 6: INFRASTRUCTURE TIMELINE

### WEEK 1: Account Signup & Verification (Jun 18-22)

#### Monday, June 18
- [ ] Morning (9 AM): Send PerimeterX signup request
- [ ] 11 AM: Send DataDome demo request
- [ ] 12 PM: Create Cloudflare account
- [ ] 2 PM: Create AWS account (optional WAF testing)
- [ ] 4 PM: Initial credential setup, basic email verification

#### Tuesday, June 19
- [ ] 9 AM: Follow up on PerimeterX email verification
- [ ] 10 AM: Setup Cloudflare 2FA, WAF basic configuration
- [ ] 2 PM: DataDome demo onboarding call (if scheduled)
- [ ] 4 PM: Generate API keys for all services

#### Wednesday, June 20
- [ ] 9 AM: Test PerimeterX API connectivity
- [ ] 10 AM: Test DataDome API connectivity
- [ ] 11 AM: Test Cloudflare API connectivity
- [ ] 2 PM: Create test domains and add to each service
- [ ] 4 PM: Validate all API keys working

#### Thursday, June 21
- [ ] 9 AM: Configure test mode for PerimeterX
- [ ] 10 AM: Configure test mode for DataDome
- [ ] 11 AM: Configure WAF rules for Cloudflare
- [ ] 2 PM: Setup webhooks for all services
- [ ] 4 PM: End-to-end test for each service API call

#### Friday, June 22
- [ ] 9 AM: Document all credentials (encrypted storage)
- [ ] 10 AM: Complete rate limit testing
- [ ] 11 AM: Verify all health checks passing
- [ ] 2 PM: Review Week 1 accomplishments
- [ ] 4 PM: Prepare for Week 2 (environment setup)

**Week 1 Success Criteria:**
- ✅ All 3+ services account created and accessible
- ✅ API keys generated and validated
- ✅ Test domains created on all services
- ✅ Rate limits documented
- ✅ Webhook endpoints configured

---

### WEEK 2: Test Environment Setup & Dry Runs (Jun 25-29)

#### Monday, June 25
- [ ] 9 AM: Deploy Docker Compose environment
- [ ] 10 AM: Start MongoDB, Prometheus, Grafana
- [ ] 11 AM: Verify all containers healthy
- [ ] 1 PM: Deploy Basset Hound Browser container
- [ ] 3 PM: Test WebSocket API connectivity

#### Tuesday, June 26
- [ ] 9 AM: Configure proxy rotation pools
- [ ] 10 AM: Setup test data database (MongoDB collections)
- [ ] 11 AM: Create 95 test cases in database
- [ ] 2 PM: Configure logging system
- [ ] 4 PM: Verify all logs flowing to MongoDB

#### Wednesday, June 27
- [ ] 9 AM: Setup Grafana dashboard panels
- [ ] 10 AM: Create Prometheus alert rules
- [ ] 11 AM: Configure Alertmanager notification channels
- [ ] 1 PM: Test alert system with dummy alert
- [ ] 3 PM: Run dry-run test cycle (5 tests from each category)

#### Thursday, June 28
- [ ] 9 AM: Analyze dry-run results
- [ ] 10 AM: Fix any issues found in dry runs
- [ ] 11 AM: Re-run dry tests (full pass)
- [ ] 2 PM: Establish baseline metrics from dry runs
- [ ] 4 PM: Prepare test execution scripts

#### Friday, June 29
- [ ] 9 AM: Final health check of all systems
- [ ] 10 AM: Verify all documentation complete
- [ ] 11 AM: Team review of setup
- [ ] 1 PM: Approve for Phase 2 execution
- [ ] 3 PM: Standby for Phase 2 kickoff (Jul 3)

**Week 2 Success Criteria:**
- ✅ Docker environment fully operational
- ✅ All monitoring dashboards live and collecting data
- ✅ Dry-run tests 100% successful
- ✅ Baseline metrics established
- ✅ Test execution scripts ready
- ✅ Team trained and ready for execution

---

### PHASE 2 EXECUTION: Real-World Testing (Jul 3-7)

#### Tuesday, July 3 - Kick-off Day
- [ ] 9 AM: Final systems check
- [ ] 10 AM: Start automated test execution (PerimeterX, 20 tests)
- [ ] 2 PM: Daily results review
- [ ] 4 PM: Adjust strategy if needed, proceed

#### Wednesday, July 4 - High-Volume Testing
- [ ] Continuous test execution (all 95 tests across services)
- [ ] Monitor success rates and adjust evasion techniques as needed
- [ ] Collect metrics for performance analysis

#### Thursday, July 5 - Mid-Point Review
- [ ] 9 AM: Analyze results from 150+ tests
- [ ] 11 AM: Calculate success rates by service and technique
- [ ] 1 PM: Decision point: continue, modify, or pivot strategy
- [ ] 3 PM: Communicate findings to team

#### Friday-Saturday, July 6-7 - Final Testing & Analysis
- [ ] Complete remaining test scenarios
- [ ] Generate comprehensive final report
- [ ] Archive all test data and logs
- [ ] Prepare Phase 3 recommendations

---

## PART 7: DELIVERABLES

### 7.1 Documentation Deliverables

#### 1. PHASE2-INFRASTRUCTURE-SETUP-GUIDE-2026-06-15.md
**Location:** `/home/devel/basset-hound-browser/docs/findings/`  
**Content:**
- Complete step-by-step setup instructions (this document)
- Account registration procedures for all services
- API key configuration details
- Test environment deployment guide
- Monitoring setup instructions

#### 2. PHASE2-SANDBOX-CREDENTIALS-INDEX.md
**Location:** `/home/devel/basset-hound-browser/docs/findings/`  
**Content (Encrypted Storage):**
```markdown
# Phase 2 Sandbox Credentials Index
**ENCRYPTED - Access restricted to Phase 2 team**

## PerimeterX
- Organization ID: [ENCRYPTED]
- API Key: [ENCRYPTED]
- Dashboard URL: https://[account].perimeterx.com
- Test Domain: phase2-test.basset-hound.local
- 2FA Backup Codes: [ENCRYPTED]

## DataDome
- Client ID: [ENCRYPTED]
- Client Secret: [ENCRYPTED]
- Dashboard URL: https://console.datadome.co/
- Test Domain: datadome-phase2.basset-hound.local
- 2FA Backup Codes: [ENCRYPTED]

## Cloudflare
- API Token: [ENCRYPTED]
- Zone ID: [ENCRYPTED]
- Account ID: [ENCRYPTED]
- Dashboard URL: https://dash.cloudflare.com/
- 2FA Backup Codes: [ENCRYPTED]

## Emergency Contacts
- PerimeterX Support: support@perimeterx.com
- DataDome Support: support@datadome.co
- Cloudflare Support: support@cloudflare.com
```

**Security:** AES-256 encrypted, GPG signed by team lead

#### 3. PHASE2-TEST-ENVIRONMENT-CHECKLIST.md
**Location:** `/home/devel/basset-hound-browser/docs/findings/`  
**Content:**
- Pre-execution checklist (30-item verification)
- System health checks
- Service connectivity validation
- Monitoring system verification
- Rate limit configuration review
- Cleanup procedures post-execution

#### 4. PHASE2-EXECUTION-LOG.md (Auto-generated)
**Location:** `/home/devel/basset-hound-browser/docs/findings/`  
**Generated During:** Weeks of Jun 25-29, Jul 3-7  
**Content:**
- Daily test execution summary
- Success rates by service
- Issues encountered and resolutions
- Evasion technique effectiveness
- Recommendations for Phase 3

---

### 7.2 Automation Scripts

#### scripts/setup-phase2-environment.sh

**Purpose:** Automate entire Week 1-2 setup  
**Location:** `/home/devel/basset-hound-browser/scripts/`  
**Execution:** `bash setup-phase2-environment.sh`

**Functionality:**
```bash
#!/bin/bash
# Phase 2 Environment Setup Script
# Automates: Docker deployment, database setup, monitoring configuration

set -e  # Exit on error

echo "=== Phase 2 Infrastructure Setup ==="

# 1. Create directories
mkdir -p phase2-{logs,data,config,db,prometheus-data,grafana-data}
echo "✓ Directories created"

# 2. Copy docker-compose configuration
cp docker-compose.phase2.yml docker-compose.yml
echo "✓ Docker Compose configured"

# 3. Create environment files
cat > .env.phase2 <<EOF
PERIMETERX_ORG_ID=<INSERT_FROM_ACCOUNT>
PERIMETERX_API_KEY=<INSERT_FROM_ACCOUNT>
DATADOME_CLIENT_ID=<INSERT_FROM_ACCOUNT>
DATADOME_CLIENT_SECRET=<INSERT_FROM_ACCOUNT>
CLOUDFLARE_API_TOKEN=<INSERT_FROM_ACCOUNT>
CLOUDFLARE_ZONE_ID=<INSERT_FROM_ACCOUNT>
MONGODB_USER=phase2user
MONGODB_PASSWORD=<GENERATE_SECURE_PASSWORD>
TOR_MODE=AUTO
LOG_LEVEL=debug
EOF
echo "✓ Environment configuration created"

# 4. Start Docker containers
docker-compose up -d
echo "✓ Docker containers started"

# 5. Wait for health checks
for i in {1..30}; do
  if docker-compose ps | grep "phase2-browser.*healthy" > /dev/null; then
    echo "✓ Browser container healthy"
    break
  fi
  echo "Waiting for container health... ($i/30)"
  sleep 10
done

# 6. Validate connectivity
echo "=== Validating Service Connectivity ==="
curl -s http://localhost:8765/health | jq .
echo "✓ WebSocket API responsive"

# 7. Initialize database
docker exec phase2-mongodb mongosh <<EOF
db.auth('phase2user', 'password')
db.createCollection('phase2_test_cases')
db.createCollection('phase2_test_results')
db.createCollection('phase2_metrics')
db.createCollection('phase2_logs_audit', { capped: true, size: 104857600 })
print('✓ Collections created')
EOF

# 8. Configure Prometheus
cp config/prometheus.yml phase2-config/
docker exec phase2-prometheus curl -X POST http://localhost:9090/-/reload
echo "✓ Prometheus configured"

# 9. Setup Grafana datasources and dashboards
# (Would import JSON dashboard definitions)

echo "=== Phase 2 Setup Complete ==="
echo "Dashboard: http://localhost:3000 (admin/admin)"
echo "Prometheus: http://localhost:9091"
echo "Next: Run 'bash scripts/phase2-run-tests.sh' to execute tests"
```

#### scripts/phase2-run-tests.sh

**Purpose:** Execute full test suite  
**Location:** `/home/devel/basset-hound-browser/scripts/`  
**Execution:** `bash phase2-run-tests.sh`

**Features:**
- Load 95 test cases from MongoDB
- Execute in batches with rate limiting
- Collect results in real-time
- Monitor for failures and retry
- Generate hourly reports
- Stop on critical errors

#### scripts/phase2-monitor-dashboard.sh

**Purpose:** Display real-time monitoring dashboard  
**Location:** `/home/devel/basset-hound-browser/scripts/`  
**Execution:** `bash phase2-monitor-dashboard.sh`

**Display:**
```
╔════════════════════════════════════════════════════════════╗
║             Phase 2 Real-Time Monitor                      ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Tests Running: 3/95                                       ║
║  Success Rate: 73/95 (76.8%) ████████░░░░░░░░░░░░░░░░     ║
║                                                            ║
║  By Service:                                               ║
║    PerimeterX:  28/30 (93.3%) ✓                           ║
║    DataDome:    24/32 (75.0%) ⚠                           ║
║    Cloudflare:  21/25 (84.0%) ✓                           ║
║                                                            ║
║  By Category:                                              ║
║    Fingerprinting: 22/25 (88%) ✓                          ║
║    Behavioral:    18/25 (72%) ⚠                           ║
║    Session:       17/20 (85%) ✓                           ║
║    Advanced:      11/15 (73%) ⚠                           ║
║    Integration:   5/10 (50%)  ✗                           ║
║                                                            ║
║  Performance:                                              ║
║    Avg Response:  324ms                                    ║
║    Avg Page Load: 3,420ms                                  ║
║    Memory Usage:  2.3 GB / 16 GB (14%)                    ║
║    CPU Usage:     18% / 8 cores                            ║
║                                                            ║
║  Last Error: DataDome API timeout (22 min ago)            ║
║  Status: RUNNING - Keep monitoring                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Refreshing every 10 seconds... (Press Ctrl+C to exit)
```

---

## PART 8: VERIFICATION CHECKLIST

### Pre-Execution Checklist (Before July 3)

#### Account & API Access
- [ ] PerimeterX account created and verified
- [ ] PerimeterX API key tested and working
- [ ] PerimeterX rate limits documented
- [ ] DataDome account created and verified
- [ ] DataDome API key tested and working
- [ ] DataDome rate limits documented
- [ ] Cloudflare account created and verified
- [ ] Cloudflare API key tested and working
- [ ] Cloudflare WAF configured in test mode

#### Infrastructure
- [ ] Docker Compose environment deployed
- [ ] All containers (browser, MongoDB, Prometheus, Grafana) running
- [ ] WebSocket API health check passing
- [ ] MongoDB connectivity verified
- [ ] Proxy pools configured and healthy
- [ ] User agent rotation enabled

#### Test Data
- [ ] All 95 test cases loaded in MongoDB
- [ ] All 11 target websites configured and accessible
- [ ] Test domains DNS resolved correctly
- [ ] Expected results matrix documented
- [ ] Baseline metrics established

#### Monitoring
- [ ] Grafana dashboards created and populated
- [ ] Prometheus metrics collecting
- [ ] Alert rules configured and tested
- [ ] Slack/Email notification channels working
- [ ] Logging system operational

#### Safety & Compliance
- [ ] Rate limiting enabled and configured
- [ ] Audit logging enabled
- [ ] Cleanup procedures documented
- [ ] Credentials encrypted and secured
- [ ] Team trained on procedures

---

### Post-Execution Checklist (After July 7)

- [ ] All test results collected in MongoDB
- [ ] Success rates calculated and validated
- [ ] Performance metrics analyzed
- [ ] Final report generated
- [ ] Recommendations documented
- [ ] All logs archived
- [ ] Credentials rotated
- [ ] Test accounts cleaned up or disabled
- [ ] Docker environment shut down
- [ ] Phase 2 summary presented to team

---

## PART 9: TROUBLESHOOTING GUIDE

### Common Issues & Resolution

#### Issue: API Rate Limit Hit

**Symptom:** Receiving HTTP 429 (Too Many Requests) errors

**Resolution:**
1. Immediately pause test execution
2. Wait 2 minutes (backoff period)
3. Reduce rate limiter to 50% of current setting
4. Resume testing with increased delays

**Prevention:**
- Monitor request rate in real-time
- Set up proactive alerts at 80% of limit
- Batch tests by service to avoid overlapping requests

#### Issue: Service Webhook Timeout

**Symptom:** Webhook data not appearing in logs for 10+ minutes

**Resolution:**
1. Check webhook endpoint URL configuration
2. Verify firewall rules allow inbound traffic
3. Check service provider webhook delivery status
4. Temporarily switch to polling-based approach
5. File support ticket with service provider

#### Issue: Browser Memory Leak

**Symptom:** Browser container memory grows continuously

**Resolution:**
1. Reduce concurrent test browsers (max 3)
2. Increase garbage collection frequency
3. Add `--no-sandbox` flag if safe (reduces memory ~20%)
4. Restart browser container every 8 hours

#### Issue: MongoDB Disk Full

**Symptom:** "Disk quota exceeded" errors when writing logs

**Resolution:**
1. Archive old test results (>30 days old)
2. Compress and delete verbose logs
3. Reduce logging level from DEBUG to INFO
4. Add more storage if permanent solution needed

---

## CONCLUSION

This infrastructure setup plan provides a comprehensive foundation for Phase 2 real-world bot detection testing. By following the timeline and checklists, the team can execute controlled, compliant, and effective testing against major detection services.

**Key Success Factors:**
1. ✅ Careful account setup and rate limit management
2. ✅ Robust monitoring and alerting
3. ✅ Systematic test data organization
4. ✅ Audit trail for compliance
5. ✅ Realistic timelines with buffer

**Ready for Team 1 to Begin June 18** ✓

---

**Document Version:** 1.0  
**Last Updated:** June 15, 2026  
**Status:** Ready for Implementation  
**Next Review:** Upon completion of Week 1 (Jun 22)  
**Prepared by:** Basset Hound DevOps Planning Agent
