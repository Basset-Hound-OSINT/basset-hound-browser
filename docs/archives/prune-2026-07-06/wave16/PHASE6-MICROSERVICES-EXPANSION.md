# Wave 16 Phase 6-8 - Microservices Expansion & Service Architecture

**Date:** June 13, 2026  
**Status:** Strategic Planning  
**Timeline:** Phase 6-8 (August 2026 - March 2027)  
**Services:** 8+ new microservices  
**Total Service Lines:** 15,000+ (implementation)

---

## Executive Summary

Phase 6-8 evolves Basset Hound from monolithic application to distributed microservices architecture enabling independent scaling, specialized optimization, and feature innovation velocity.

**Current State (v12.0.0):**
- Single application server (multi-instance)
- Integrated WebSocket API
- Embedded session management
- Monolithic feature set

**Target State (Phase 8):**
- 12-15 specialized microservices
- API gateway coordination
- Distributed event streaming
- Pluggable service ecosystem

---

## New Microservices (Phase 6-8)

### Service 1: Evasion Coordinator Service

**Purpose:** Manage bot evasion across all detection vectors  
**Responsibility:** Advanced fingerprinting orchestration, detection vector testing, profile management  
**Phase:** 6 (foundation), 7-8 (enhancement)  
**Effort:** 180 hours

**API Endpoints:**
```
POST   /evasion/profiles          - Create evasion profile
GET    /evasion/profiles/:id      - Get profile details
PUT    /evasion/profiles/:id      - Update profile
DELETE /evasion/profiles/:id      - Delete profile
POST   /evasion/apply             - Apply evasion to session
GET    /evasion/success-rates     - Get success rate metrics
POST   /evasion/test              - Test against detector
GET    /evasion/vectors           - List supported vectors
POST   /evasion/vectors/:id/apply - Apply specific vector
```

**Dependencies:**
- Fingerprinting DB (PostgreSQL)
- Detector monitoring agent
- Session management

**Events Published:**
- `evasion.profile.created`
- `evasion.profile.updated`
- `evasion.test.completed`
- `evasion.vector.detected`

**Scaling:** Horizontal (stateless, session affinity optional)  
**SLA:** 99.95% uptime, <50ms response time

---

### Service 2: Intelligence Analysis Service

**Purpose:** AI-powered pattern detection and threat analysis  
**Responsibility:** Claude API integration, pattern detection, threat profiling, intelligence synthesis  
**Phase:** 7 (foundation), 8 (enhancement)  
**Effort:** 220 hours

**API Endpoints:**
```
POST   /intelligence/analyze           - Analyze evidence
POST   /intelligence/patterns          - Detect patterns
POST   /intelligence/threat-profile    - Generate threat profile
POST   /intelligence/intelligence-gaps - Identify missing info
GET    /intelligence/cache-stats       - Get cache performance
POST   /intelligence/verify            - Verify AI results
GET    /intelligence/audit-log         - Get decision audit trail
```

**Dependencies:**
- Claude API
- Evidence store
- Pattern DB
- Audit log

**Events Published:**
- `intelligence.analysis.completed`
- `intelligence.pattern.detected`
- `intelligence.gap.identified`
- `intelligence.confidence.low`

**Scaling:** Vertical (CPU intensive, few instances)  
**SLA:** 99.9% uptime, <5s response time for analysis

---

### Service 3: Forensics Service

**Purpose:** Automated evidence collection and legal-grade reporting  
**Responsibility:** Evidence chain management, metadata extraction, court-ready reporting  
**Phase:** 6 (foundation), 7-8 (enhancement)  
**Effort:** 200 hours

**API Endpoints:**
```
POST   /forensics/evidence            - Create evidence item
GET    /forensics/evidence/:id        - Get evidence details
POST   /forensics/chain-of-custody    - Record access
GET    /forensics/chain/:evidenceId   - Get custody chain
POST   /forensics/report              - Generate legal report
POST   /forensics/certify             - Generate certification
POST   /forensics/verify              - Verify integrity
GET    /forensics/metadata/:id        - Extract metadata
```

**Dependencies:**
- Evidence store (S3)
- Audit log
- Metadata DB
- Signature service

**Events Published:**
- `forensics.evidence.captured`
- `forensics.chain.accessed`
- `forensics.report.generated`
- `forensics.integrity.verified`

**Scaling:** Horizontal (stateless, some disk I/O)  
**SLA:** 99.95% uptime, <500ms for evidence capture

---

### Service 4: Compliance Service

**Purpose:** Automated compliance evidence and regulatory reporting  
**Responsibility:** Compliance framework templates, evidence collection, audit automation  
**Phase:** 6 (foundation), 7-8 (enhancement)  
**Effort:** 180 hours

**API Endpoints:**
```
POST   /compliance/report/:framework    - Generate report (SOC2, ISO, GDPR)
GET    /compliance/evidence             - Get compliance evidence
POST   /compliance/audit-log            - Record audit event
GET    /compliance/status               - Get current compliance status
POST   /compliance/remediation          - Record remediation
GET    /compliance/gaps                 - Identify compliance gaps
POST   /compliance/certification        - Request certification
```

**Dependencies:**
- Compliance templates DB
- Audit log
- Evidence store
- Configuration DB

**Events Published:**
- `compliance.report.generated`
- `compliance.gap.identified`
- `compliance.remediation.recorded`
- `compliance.certification.requested`

**Scaling:** Horizontal (stateless, batch processing)  
**SLA:** 99.9% uptime, <2s for report generation

---

### Service 5: Collaboration Service

**Purpose:** Real-time multi-user collaboration and session sharing  
**Responsibility:** CRDT state management, presence tracking, operation broadcasting  
**Phase:** 7 (foundation), 8 (enhancement)  
**Effort:** 240 hours

**API Endpoints:**
```
POST   /collab/session                   - Create collaboration session
GET    /collab/session/:id               - Get session details
POST   /collab/join                      - Join session
POST   /collab/operation                 - Apply collaborative operation
POST   /collab/annotation                - Add annotation
POST   /collab/finding                   - Create finding
GET    /collab/presence                  - Get user presence
GET    /collab/sync-state                - Get full state (for rejoining)
POST   /collab/cursor                    - Update user cursor
```

**Dependencies:**
- CRDT state store (Redis)
- Session store
- Activity log
- User management

**Events Published:**
- `collab.user.joined`
- `collab.user.left`
- `collab.operation.applied`
- `collab.state.synced`

**Scaling:** Horizontal with session affinity (sticky sessions)  
**SLA:** 99.95% uptime, <100ms for operation broadcast

---

### Service 6: Analytics Service

**Purpose:** Real-time metrics, usage analytics, and performance monitoring  
**Responsibility:** Event ingestion, metric aggregation, dashboard data, trend analysis  
**Phase:** 7 (foundation), 8 (enhancement)  
**Effort:** 160 hours

**API Endpoints:**
```
POST   /analytics/event                  - Record event
GET    /analytics/metrics                - Get metrics
GET    /analytics/dashboard              - Get dashboard data
GET    /analytics/trends                 - Get trend analysis
GET    /analytics/user-activity          - Get user activity
GET    /analytics/performance            - Get performance metrics
POST   /analytics/custom-query           - Run custom query
```

**Dependencies:**
- InfluxDB (time-series)
- Event streaming (Kafka/Pub-Sub)
- Cache (Redis)
- Data warehouse

**Events Published:**
- `analytics.metric.recorded`
- `analytics.anomaly.detected`
- `analytics.threshold.exceeded`
- `analytics.trend.identified`

**Scaling:** Horizontal (stateless, batch processing)  
**SLA:** 99.5% uptime (non-critical), <500ms for queries

---

### Service 7: Integration Service

**Purpose:** External service integrations and webhooks  
**Responsibility:** Third-party API coordination, webhook management, authentication  
**Phase:** 8 (foundation)  
**Effort:** 150 hours

**API Endpoints:**
```
POST   /integration/webhook              - Register webhook
GET    /integration/webhooks             - List webhooks
DELETE /integration/webhooks/:id         - Delete webhook
POST   /integration/external/:service    - Call external service
GET    /integration/providers            - List integration providers
POST   /integration/test/:service        - Test integration
```

**Dependencies:**
- Integration registry
- Credential vault
- Webhook queue
- Event streaming

**Events Published:**
- `integration.webhook.triggered`
- `integration.external.success`
- `integration.external.failed`
- `integration.credential.expired`

**Scaling:** Horizontal (stateless with retry queues)  
**SLA:** 99.9% uptime, <2s for webhook triggers

---

### Service 8: Workflow Engine Service

**Purpose:** Low-code investigation workflow automation  
**Responsibility:** Workflow definition, execution, conditional logic, state management  
**Phase:** 8 (foundation)  
**Effort:** 200 hours

**API Endpoints:**
```
POST   /workflow/template                - Create workflow template
GET    /workflow/templates               - List templates
POST   /workflow/instance                - Start workflow instance
GET    /workflow/instance/:id            - Get instance status
POST   /workflow/step/:instanceId        - Execute step
GET    /workflow/history/:instanceId     - Get execution history
POST   /workflow/pause/:instanceId       - Pause workflow
POST   /workflow/resume/:instanceId      - Resume workflow
```

**Dependencies:**
- Workflow definition DB
- Execution state store
- Task queue
- Rule engine

**Events Published:**
- `workflow.started`
- `workflow.step.completed`
- `workflow.completed`
- `workflow.error.occurred`

**Scaling:** Horizontal with persistent state  
**SLA:** 99.9% uptime, <1s for step execution

---

### Service 9: Reporting Service

**Purpose:** Advanced BI and custom report generation  
**Responsibility:** Report templates, data visualization, export formats, scheduling  
**Phase:** 7 (foundation), 8 (enhancement)  
**Effort:** 180 hours

**API Endpoints:**
```
POST   /reporting/report                 - Generate report
GET    /reporting/templates              - List templates
POST   /reporting/schedule               - Schedule report
GET    /reporting/scheduled              - List scheduled reports
GET    /reporting/export/:reportId       - Export report
GET    /reporting/visualization/:id      - Get visualization data
```

**Dependencies:**
- Report template DB
- Data warehouse
- Rendering engine
- Job scheduler

**Events Published:**
- `reporting.report.generated`
- `reporting.export.started`
- `reporting.scheduled.triggered`

**Scaling:** Horizontal (batch processing)  
**SLA:** 99.5% uptime, <10s for report generation

---

### Service 10: Auth & RBAC Service

**Purpose:** Authentication, authorization, and permission management  
**Responsibility:** User authentication, token management, permission checking, audit  
**Phase:** 6 (enhancement of current), 7-8 (advanced features)  
**Effort:** 140 hours

**API Endpoints:**
```
POST   /auth/login                       - Authenticate user
POST   /auth/logout                      - Logout
POST   /auth/token                       - Refresh token
GET    /auth/user                        - Get current user
POST   /auth/role                        - Create role
GET    /auth/role/:id                    - Get role details
POST   /auth/permission                  - Assign permission
GET    /auth/check                       - Check permission
```

**Dependencies:**
- User store (PostgreSQL)
- Token store (Redis)
- Permission matrix (PostgreSQL)
- Audit log

**Events Published:**
- `auth.login.successful`
- `auth.login.failed`
- `auth.permission.changed`
- `auth.token.issued`

**Scaling:** Horizontal (stateless, token-based)  
**SLA:** 99.99% uptime (critical), <50ms

---

## Microservice Communication Patterns

### 1. Synchronous (Request-Response)

Used for: Direct queries, real-time operations  
Protocol: HTTP/REST or gRPC  
Example: Get analysis results, apply evasion

```
Client 
  |
  +-> API Gateway
        |
        +-> Intelligence Service (analysis)
        +-> Evasion Service (profile application)
        |
        +-> Response back to client
```

### 2. Asynchronous (Event-Driven)

Used for: Batch operations, non-critical updates  
Protocol: Pub-Sub (Google Pub/Sub, Kafka, or Redis)  
Example: Compliance report generation, analytics

```
Evidence Captured
  |
  +-> Publish: "forensics.evidence.captured"
        |
        +-> Forensics Service (indexing)
        +-> Analytics Service (metrics)
        +-> Compliance Service (evidence collection)
        |
        +-> Independent async processing
```

### 3. Service-to-Service

Pattern: Direct REST, gRPC, or message queue  
Example: Forensics service calling Metadata service  

```
POST /forensics/report
  |
  +-> Forensics Service
        |
        +-> (internal call) GET /metadata/extract
        +-> (internal call) POST /signature/sign
        +-> (internal call) POST /audit/log
        |
        +-> Return report
```

---

## Data Flow Architecture

### Evidence Capture Flow

```
User navigates to page
  |
  v
Screenshot captured
  |
  v
Forensics Service
  +-- Extract metadata (image, network, DOM)
  +-- Generate chain of custody entry
  +-- Publish event
  |
  v
Evidence Item Created
  |
  v
Events published:
  - forensics.evidence.captured
  - analytics.event.recorded
  - compliance.audit.logged
  |
  v
(Async) Multiple services consume:
  - Intelligence Service: Pattern detection
  - Analytics Service: Metrics
  - Compliance Service: Evidence collection
  - Search Index: Indexing
```

### Collaboration Operation Flow

```
User annotates screenshot
  |
  v
Collaboration Service
  +-- Apply CRDT transform
  +-- Store in Redis
  +-- Generate operation ID
  |
  v
Broadcast to all users (WebSocket)
  |
  v
Each client applies operation
  |
  v
Publish event:
  - collab.operation.applied
  |
  v
(Async) Services consume:
  - Analytics Service: User activity
  - Audit Log: Record annotation
```

---

## Service Dependencies & Load

### Dependency Graph

```
API Gateway (entry point)
  |
  +-- Auth Service (all requests check auth)
  |
  +-- [Primary Services]
      +-- Evasion Service -> [Detector Monitoring]
      +-- Intelligence Service -> Claude API
      +-- Forensics Service -> Metadata Service
      +-- Collaboration Service -> Session Store
      +-- Compliance Service -> Audit Log
      +-- Analytics Service -> Event Stream
      +-- Integration Service -> External APIs
      +-- Workflow Service -> Task Queue
      +-- Reporting Service -> Data Warehouse
```

### Load Distribution (estimated Phase 8)

```
10M total msg/sec across all services:
  - Evasion Service: 25% (2.5M/sec)
  - Session Management: 30% (3M/sec)
  - Analytics: 20% (2M/sec)
  - Collaboration: 10% (1M/sec)
  - Intelligence: 5% (500K/sec)
  - Forensics: 5% (500K/sec)
  - Other: 5% (500K/sec)
```

---

## Deployment Topology (Phase 8)

### Kubernetes Deployment

```yaml
# Namespace: basset-hound
Deployment: api-gateway (5-10 replicas)
Deployment: evasion-service (3-5 replicas)
Deployment: intelligence-service (2-4 replicas)
Deployment: forensics-service (3-5 replicas)
Deployment: collaboration-service (3-5 replicas)
Deployment: compliance-service (2-3 replicas)
Deployment: analytics-service (2-3 replicas)
Deployment: integration-service (2-3 replicas)
Deployment: workflow-engine (2-3 replicas)
Deployment: reporting-service (2-3 replicas)
Deployment: auth-service (2-3 replicas)

Total Pods: 28-50 (auto-scaling)
Total vCPU: 20-40 (depending on load)
Total Memory: 60-120 GB (depending on load)
```

---

## Inter-Service API Design

### Service Registry Pattern

All services register with centralized registry:

```yaml
services:
  evasion-service:
    endpoints:
      - http://evasion-service.basset-hound:8001
      - http://evasion-service.basset-hound:8002
    health-check: /health
    dependencies:
      - fingerprinting-db
      - detector-monitoring
    rate-limit: 10K req/sec
    
  intelligence-service:
    endpoints:
      - http://intelligence-service.basset-hound:8010
    health-check: /health
    dependencies:
      - claude-api
      - evidence-store
    rate-limit: 1K req/sec (Claude API constrained)
```

### Circuit Breaker Pattern

```python
class CircuitBreaker:
    def call_evasion_service(self, request):
        try:
            if self.circuit.is_open():
                raise CircuitBreakerOpen()
            response = evasion_service.call(request)
            self.circuit.record_success()
            return response
        except Exception as e:
            self.circuit.record_failure()
            if self.circuit.failure_count > threshold:
                self.circuit.open()
            raise
```

---

## Monitoring & Observability Per Service

### Metrics Collection

Each service exports:
- Request latency (p50, p95, p99)
- Request count (total, by endpoint)
- Error rate (by type)
- Service dependencies health
- Resource usage (CPU, memory, disk)

### Logging Strategy

```
Structured JSON logging per service:
{
  "timestamp": "2026-06-13T10:30:00Z",
  "service": "intelligence-service",
  "level": "INFO",
  "event": "analysis.completed",
  "request_id": "req-12345",
  "duration_ms": 1250,
  "evidence_count": 42,
  "patterns_found": 7,
  "confidence": 0.92
}
```

### Distributed Tracing

All requests traced end-to-end across services:
```
POST /forensics/report
  |-> trace_id: trace-xyz
      |-> Forensics Service (span 1)
            |-> Metadata Service (span 2) - 150ms
            |-> Signature Service (span 3) - 50ms
      |-> Total: 250ms
```

---

## Phase-Based Microservice Rollout

### Phase 6 (Foundation)
- Evasion Service (new)
- Forensics Service (new)
- Compliance Service (new)
- Auth Service (enhanced)
- Total: 4 services

### Phase 7 (Expansion)
- Intelligence Service (new)
- Collaboration Service (new)
- Analytics Service (new)
- Reporting Service (new)
- Total: 8 services (+4)

### Phase 8 (Specialization)
- Integration Service (new)
- Workflow Engine (new)
- Total: 10+ services (+2)

---

## Performance Targets Per Service

| Service | Latency Target | Throughput | Load |
|---------|----------------|-----------|------|
| Evasion | <50ms | 2.5M/sec | CPU-intensive |
| Intelligence | <5000ms | 500K/sec | Memory-intensive |
| Forensics | <500ms | 500K/sec | I/O-intensive |
| Collaboration | <100ms | 1M/sec | Network-intensive |
| Compliance | <2000ms | 300K/sec | Batch-oriented |
| Analytics | <500ms | 2M/sec | I/O-intensive |
| Integration | <2000ms | 100K/sec | Variable (external) |
| Workflow | <1000ms | 200K/sec | State-intensive |
| Reporting | <10000ms | 50K/sec | Batch-oriented |
| Auth | <50ms | 3M/sec | Cache-intensive |

---

## Success Criteria

- [ ] All 10 services deployed and operational
- [ ] Service discovery working correctly
- [ ] Inter-service communication <200ms latency
- [ ] 99.95% uptime per service maintained
- [ ] Horizontal scaling working across all services
- [ ] Circuit breakers preventing cascading failures
- [ ] Distributed tracing providing end-to-end visibility
- [ ] Service-to-service authentication/authorization
- [ ] Zero data consistency issues across services

---

**Document Metrics:**
- Microservices: 10 detailed
- API endpoints: 60+
- Code patterns: 5+
- Deployment configurations: 3+
- Performance targets: Detailed per service

