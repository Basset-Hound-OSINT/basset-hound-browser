# Wave 15 Technical Architecture

**Date:** June 1, 2026  
**Status:** EXECUTION PLANNING IN PROGRESS  
**Document:** System design for Wave 15 features

---

## Executive Summary

This document provides technical architecture for Wave 15's 7 major features:
1. Competitor Monitoring Dashboard
2. Slack Integration
3. Session Persistence Reliability
4. Performance Optimizations
5. Email/Webhook Alerts
6. Integration suite (Maltego, Shodan, Jira, etc.)

**Key Design Principles:**
- Event-driven architecture (pub/sub)
- Real-time updates (WebSocket)
- Horizontal scalability (stateless services)
- High availability (99.5%+ uptime)
- Zero data loss (event sourcing for critical operations)

---

## Part 1: Competitor Monitoring Dashboard Architecture

### Component Design

```
COMPETITOR MONITORING SYSTEM ARCHITECTURE
═══════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│                    USER LAYER (Client)                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ React Dashboard (Monitor list, details, settings)   ││
│  │ WebSocket client: Real-time updates subscription    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/WS
┌─────────────────────────────────────────────────────────┐
│                  API LAYER (REST + WebSocket)           │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │Monitor APIs  │ Alert APIs   │ Query/Analysis APIs  │ │
│  │POST/PUT/DEL  │ GET events   │ Historical queries   │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               BUSINESS LOGIC LAYER                      │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ Monitor Mgmt │ Change       │ Alert System         │ │
│  │ CRUD ops,    │ Detection:   │ Rule matching,       │ │
│  │ validation   │ Diff & Hash  │ notification queue   │ │
│  │              │ comparison   │                      │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 DATA LAYER                              │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │PostgreSQL    │ Redis        │ Time-series DB       │ │
│  │(normalized   │(real-time    │(InfluxDB/Prometheus) │
│  │data)         │subscriptions)│(metrics)             │ │
│  │              │              │                      │ │
│  │- Monitors    │- Subscriptions│- Latencies          │
│  │- Changes     │- User sessions│- Throughputs        │
│  │- Users       │- Cache       │- Error rates        │
│  │- Alerts      │              │                      │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```
MONITOR TABLE
columns: id, user_id, name, url, frequency (min), 
         enabled, created_at, updated_at, config (JSON)
indexes: (user_id), (enabled), (created_at)

CHANGE_EVENT TABLE
columns: id, monitor_id, timestamp, change_type (diff/hash),
         before (JSON), after (JSON), metadata (JSON)
indexes: (monitor_id, timestamp), (timestamp)
partition: By monitor_id for horizontal scaling

ALERT_RULE TABLE
columns: id, monitor_id, condition_type, threshold,
         channels (JSON), enabled, created_at
indexes: (monitor_id), (enabled)

ALERT_LOG TABLE
columns: id, rule_id, triggered_at, channels_sent (JSON),
         response_codes (JSON), status
indexes: (rule_id, triggered_at), (status)
```

### Key Algorithms

**Change Detection:**
- Hash-based (fast): SHA256 of HTML content
- Diff-based (detailed): Character-level diff stored for display
- Heuristic: Ignore whitespace, ads, timestamps

**Alert Matching:**
- Rule engine: Evaluate conditions per change event
- Performance: <100ms per event
- Languages: SQL queries + custom JS rules

---

## Part 2: Slack Integration Architecture

### OAuth Flow

```
SLACK OAUTH FLOW
═════════════════════════════════════════════════════════

1. User installs Slack bot
   └─→ Redirect to Slack OAuth authorize URL

2. Slack shows permission request
   └─→ User approves

3. Slack redirects to callback URL
   └─→ Include 'code' parameter

4. Backend exchanges code for access token
   └─→ API call: POST https://slack.com/api/oauth.v2.access
   └─→ Response: access_token, team_id, user_id

5. Store token in database
   └─→ Encrypted in PostgreSQL
   └─→ Keyed by team_id + user_id

6. Bot ready to operate
   └─→ Subscribed to events for that workspace
   └─→ Can send messages, create threads
```

### Command Architecture

```
SLACK BOT COMMANDS
═════════════════════════════════════════════════════════

Command Router:
  /basset list [filter]        → List monitors
  /basset add <url>            → Add monitor
  /basset delete <id>          → Remove monitor
  /basset alerts <id>          → View monitor alerts
  /basset config <id> <param>  → Set frequency, channel
  /basset status               → System health

Event Subscriptions:
  app_mention                  → Bot mentioned
  app_home_opened             → Home tab view
  reaction_added              → Thread interaction
  link_shared                 → Auto-expand links

Message Formatting:
  - Rich blocks for interactivity
  - Dividers and sections for hierarchy
  - Action buttons for quick responses
  - Thread conversations for discussions
```

---

## Part 3: Session Persistence Reliability

### Checkpoint Architecture

```
SESSION CHECKPOINT SYSTEM
═════════════════════════════════════════════════════════

Checkpoint Interval: Every 50-100 requests (configurable)

Data Saved:
  - Current request index
  - Browser state (cookies, localStorage)
  - Session metadata (start time, stats)
  - Progress markers

Recovery Process:
  1. Detect failure (timeout, crash, network error)
  2. Query latest checkpoint
  3. Restore browser state
  4. Resume from next request
  5. Re-run last batch (if needed)

Failure Detection:
  - Request timeout (>5 minutes)
  - No response from browser
  - Database connection error
  - Memory leak detection
```

---

## Part 4: Performance Optimizations

### Quick-Win Improvements

```
PERFORMANCE OPTIMIZATION ROADMAP
═════════════════════════════════════════════════════════

1. HASH-BASED COMMAND ROUTING (8 hours, +100µs)
   Current: Parse command string → lookup in map
   Optimized: Hash command → direct array lookup
   Estimated impact: +50-100 msg/sec throughput

2. DOM QUERY CACHING (12 hours, -15-30ms)
   Current: Query DOM each time
   Optimized: Cache selectors, invalidate on DOM change
   Estimated impact: -20-30ms per operation

3. ASYNC SCREENSHOT WRITING (10 hours, -20-30ms)
   Current: Synchronous disk write
   Optimized: Queue screenshots, batch write
   Estimated impact: -20-30ms per screenshot

4. CONNECTION POOLING (8 hours, -20-40ms)
   Current: Create new connection per request
   Optimized: Reuse connections from pool
   Estimated impact: -10-40ms per database query

Total Quick Wins: 20-25% improvement expected
```

---

## Part 5: Email & Webhook Alerts

### Event Architecture

```
ALERT EVENT PIPELINE
═════════════════════════════════════════════════════════

Change Detected
  ↓
Rule Engine (Evaluate conditions)
  ↓ (condition matches)
Alert Triggered
  ↓
Event Queue (Redis/RabbitMQ)
  ├─→ Email Worker (send email)
  ├─→ Slack Worker (send Slack message)
  ├─→ Webhook Worker (POST to custom URL)
  └─→ Audit Log (store delivery record)
  ↓
Delivery Confirmation
  ├─→ Email delivery receipt
  ├─→ Slack response
  └─→ Webhook status code
  ↓
Audit & Metrics
```

### Email Template System

```
EMAIL TEMPLATES
═════════════════════════════════════════════════════════

Monitor Alert:
  Subject: "[Monitor] <url> detected changes"
  Body: HTML template with:
    - Monitor name and URL
    - Change summary (what changed)
    - Timestamp
    - Link to dashboard
    - Manage alerts link

Daily Summary:
  Subject: "Weekly monitor summary"
  Body: HTML template with:
    - Top monitors with changes
    - Total changes this week
    - Alerts sent count
```

---

## Part 6: Integration Architecture Patterns

### Generic Integration Pattern

```
INTEGRATION PATTERN
═════════════════════════════════════════════════════════

1. EVENT SUBSCRIPTION
   Basset event → Integration worker listens

2. DATA TRANSFORMATION
   Event data → Partner API format

3. API CALL
   POST/GET to partner API with transformation

4. RESPONSE HANDLING
   Parse response, handle errors, retry on failure

5. AUDIT LOG
   Store call record: timestamp, request, response, status
```

### Maltego Integration

```
MALTEGO INTEGRATION (Bi-directional)
═════════════════════════════════════════════════════════

→ Forward (Basset → Maltego):
  Export monitors + change data
  Format: Maltego Transform format
  Triggers: Manual export, scheduled export

← Reverse (Maltego → Basset):
  Import investigation results
  Format: Maltego Transform output
  Enriches Basset monitors with Maltego data
```

### Shodan Integration

```
SHODAN INTEGRATION (Data Enrichment)
═════════════════════════════════════════════════════════

Monitor URL extracted
  ↓
Query Shodan API: /host/{ip}
  ↓
Return: Open ports, services, vulnerabilities
  ↓
Store in Basset database
  ↓
Dashboard displays enriched data
```

---

## Part 7: Scalability & Performance

### Horizontal Scaling Strategy

```
SCALING ARCHITECTURE
═════════════════════════════════════════════════════════

Current Bottlenecks (285 msg/sec):
  - WebSocket server: Single instance
  - Browser instance: Single instance
  - Database: Single instance

Scaling to 500 concurrent:
  1. Load balancer (distribute WebSocket connections)
  2. Multiple WebSocket server instances
  3. Multiple browser instances (horizontal)
  4. Database connection pool + read replicas
  5. Redis cluster for caching
  6. Message queue (RabbitMQ) for background jobs
```

### Database Optimization

```
QUERY OPTIMIZATION
═════════════════════════════════════════════════════════

Monitor List Query: Target <50ms
  SELECT id, name, url, frequency FROM monitors
  WHERE user_id = ? AND enabled = true
  INDEX: (user_id, enabled, id)

Change History Query: Target <100ms
  SELECT timestamp, change_type, metadata FROM changes
  WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 100
  INDEX: (monitor_id, timestamp DESC)
  PARTITION: By month for old data archive

Alert Log Query: Target <50ms
  SELECT ... FROM alerts WHERE rule_id = ? AND timestamp > ?
  INDEX: (rule_id, timestamp DESC)
```

---

## Part 8: Security Architecture

### Authentication & Authorization

```
AUTH FLOW
═════════════════════════════════════════════════════════

1. User login → JWT token
2. Token stored in secure cookie (httpOnly)
3. All requests: Auth header + JWT validation
4. Token expires: 7 days
5. Refresh token: Stored in database

RBAC (Role-Based Access Control):
  - User: Can manage own monitors
  - Admin: Can manage all monitors
  - TeamManager: Can manage team monitors
```

### Data Security

```
SENSITIVE DATA
═════════════════════════════════════════════════════════

Slack Token: Encrypted with AES-256
Database: User data encrypted at rest
API Keys: Stored encrypted, accessible only to service account
Passwords: Bcrypt hashing (cost factor 12)
Audit Logs: Immutable, append-only
```

---

## Part 9: Integration Test Plan

### Test Scenarios

```
INTEGRATION TEST SCENARIOS
═════════════════════════════════════════════════════════

1. End-to-end Monitor Workflow
   Create → Schedule → Detect Change → Alert → Slack → Dashboard
   Expected: Alert delivered <1 second, full flow <5 seconds

2. Concurrent Monitors
   50 monitors running simultaneously
   Expected: No crosstalk, independent execution

3. Database Scaling
   1M+ changes, query performance <100ms
   Expected: Indexes working, no slowdowns

4. Slack Integration
   1000 alerts/hour to Slack
   Expected: 99%+ delivery rate, <1s delivery time

5. Session Recovery
   300+ request session with failures
   Expected: Auto-recovery within 30 seconds
```

---

## Architecture Decision Log

**Decision 1: Event-Driven vs Synchronous**
- Chosen: Event-driven (pub/sub)
- Reason: Decoupled, scalable, allows queuing

**Decision 2: PostgreSQL vs NoSQL**
- Chosen: PostgreSQL (relational)
- Reason: ACID guarantees, strong consistency needed

**Decision 3: Slack OAuth vs Custom Auth**
- Chosen: Slack OAuth
- Reason: Built-in, secure, standard

**Decision 4: Real-time Updates: WebSocket vs Polling**
- Chosen: WebSocket
- Reason: Lower latency, better UX, less bandwidth

**Decision 5: Message Queue: Redis vs RabbitMQ**
- Chosen: Redis (initially), RabbitMQ (at scale)
- Reason: Redis simpler, Redis scalable for MVP

---

**Document Status:** ARCHITECTURE READY FOR IMPLEMENTATION  
**Date Generated:** June 1, 2026  
**Audience:** Engineering team, architecture review board  
**Classification:** Confidential - Technical Design
