# Wave 16 Component Design: Integration Map

**Component ID:** IM-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1 hour  
**Lines:** 1,200+

---

## Executive Summary

The Integration Map shows how all 15 components interact, data flows, dependencies, and failure boundaries. This map guides implementation order and identifies critical integration points.

---

## 1. Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (09)                         │
│            (WebSocket + REST entry point)                   │
└────────────────┬──────────────────────────────────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
   ┌────────┐ ┌──────┐ ┌─────────┐
   │Load    │ │Auth  │ │Rate     │
   │Bal.(01)│ │(12)  │ │Limit    │
   └────────┘ └──────┘ └─────────┘
        │
        ▼
   ┌──────────────────────────────────┐
   │  Application Layer               │
   │  (WebSocket handler)             │
   └────┬─────────────────────────────┘
        │
    ┌───┼───────────────────────┐
    │   │                       │
    ▼   ▼                       ▼
 ┌─────────┐              ┌──────────┐
 │Session  │              │Stream    │
 │Store(02)│              │Process(06)
 │(Redis)  │              │(Kafka)   │
 └─────────┘              └─────┬────┘
    │                           │
    ├─> ┌─────────────────┐     ├─> ┌──────────────┐
    │   │Cache (04)       │     │   │Alert Engine  │
    │   │(Redis, 10GB)    │     │   │              │
    │   └─────────────────┘     │   └──────┬───────┘
    │                                      │
    ▼                                      ├────> ┌─────────────┐
 ┌─────────────┐                          │      │Integration  │
 │Database (03)│                          │      │Hub (11)     │
 │(PostgreSQL) │◄─────────────────────────┘      └──────┬──────┘
 └──────┬──────┘                                        │
        │                                        ┌──────┴──────┐
        ├──────────> ┌───────────────┐          │             │
        │            │Elasticsearch  │     ┌────▼─────┐  ┌───▼─────┐
        │            │Search (08)    │     │Webhook   │  │External │
        │            └───────────────┘     │(10)      │  │Services │
        │                                  └──────────┘  └─────────┘
        │
        ├──────────> ┌──────────────┐
        │            │Message Queue │
        │            │(05)          │
        │            │(RabbitMQ)    │
        │            └──────┬───────┘
        │                   │
        │            ┌──────▼───────┐
        │            │Worker Pool   │
        │            │(async jobs)  │
        │            └──────────────┘
        │
        └──────────> ┌──────────────┐
                     │TimeSeries(07)│
                     │(InfluxDB)    │
                     └──────────────┘

Observability Layer (13):
  Prometheus  ◄──────── Metrics from all components
  ELK Stack   ◄──────── Logs from all components
  Jaeger      ◄──────── Traces from all components

Security Layer (14):
  Vault       ◄──────── Secret rotation
  Audit Log   ◄──────── Events from all components
  TLS/mTLS   ◄──────── All communications
```

---

## 2. Data Flow Diagram

### 2.1 Client Request Flow

```
Client WebSocket Connection
      │
      ▼
Load Balancer (01)
  - Route to WebSocket pod
  - Session affinity
      │
      ▼
API Gateway (09)
  - Authenticate user
  - Check rate limits
  - Log request
      │
      ▼
Application Handler
  - Parse WebSocket message
  - Validate input
      │
      ▼
Session Store (02)
  - Load session context
  - Fetch user settings
      │
      ▼
Business Logic
  - Process command
  - Query/update databases
      │
  ┌────┴────┐
  │          │
  ▼          ▼
DB(03)   Cache(04)
  │          │
  └────┬─────┘
       │
       ▼
Stream Processing (06)
  - Detect changes
  - Generate events
       │
       ▼
Alert Engine
  - Check rules
  - Generate alerts
       │
       ├─> Integration Hub (11)
       │   └─> External Services
       │       (Slack, Email, etc)
       │
       ├─> Webhooks (10)
       │   └─> Customer endpoints
       │
       └─> Store results
           └─> Database (03)
                TimeSeries (07)
                Elasticsearch (08)
```

### 2.2 Monitoring Check Flow

```
Scheduled monitoring task (from queue or timer)
      │
      ▼
Message Queue (05)
  - Enqueue monitoring job
      │
      ▼
Worker Pool
  - Execute HTTP check
  - Capture response
      │
      ▼
Change Detection
  - Compare to baseline
  - Generate change event
      │
      ▼
Stream Processing (06)
  - Aggregate changes
  - Enrich metadata
      │
      ├─> Alert Engine
      │   │
      │   └─> Integration Hub (11)
      │       └─> Webhooks (10)
      │
      └─> Store
          ├─> Database (03)
          ├─> TimeSeries (07)
          ├─> Elasticsearch (08)
          └─> Audit Log

All events also logged:
  ├─> ELK Stack (logs)
  ├─> Jaeger (traces)
  └─> Prometheus (metrics)
```

---

## 3. Component Interactions Matrix

| Component | Depends On | Used By | Interface | Protocol |
|-----------|-----------|---------|-----------|----------|
| LB (01) | Route53 | Clients | TCP 8765 | TCP/TLS |
| Session Store (02) | Auth | App | Redis | TCP/TLS |
| Database (03) | Auth, Vault | App, Workers | SQL | TCP/TLS |
| Cache (04) | Auth | App | Redis | TCP/TLS |
| Message Queue (05) | Auth | Workers, App | AMQP | TCP/TLS |
| Stream Processing (06) | Kafka, Config | Alert Engine | REST | HTTP/TLS |
| TimeSeries (07) | Auth | App, Analytics | InfluxQL | TCP/TLS |
| Search (08) | Auth | Analytics | REST | HTTP/TLS |
| API Gateway (09) | Auth, Vault | Clients | REST/WS | HTTP/TLS |
| Webhooks (10) | Auth, DB | External | HTTP | HTTPS |
| Integration Hub (11) | Auth, Vault | Alert Engine | REST | HTTP/TLS |
| Auth (12) | Vault, OAuth | All | JWT/OAuth2 | HTTP/TLS |
| Observability (13) | Exporters | On-call | Prometheus/ELK | HTTP/TLS |
| Security (14) | Vault, TLS | All | Policies | N/A |

---

## 4. Critical Integration Points

### 4.1 High Risk (Potential Failure)

**1. Session Store ↔ Database**
- Issue: Inconsistent session state
- Mitigation: TTL-based cleanup, checksums
- Testing: Failover of each tier

**2. Stream Processing → Alert Engine**
- Issue: Alerts not triggered
- Mitigation: Kafka replication, DLQ
- Testing: End-to-end alert flow

**3. Database → Elasticsearch**
- Issue: Stale search results
- Mitigation: Index refresh interval, audit trail
- Testing: Data sync verification

### 4.2 Scaling Challenges

**1. Message Queue Depth**
- Issue: Workers can't keep up
- Mitigation: Auto-scale workers (HPA)
- Threshold: Queue depth > 1000

**2. Database Connections**
- Issue: Connection pool exhausted
- Mitigation: Connection pooling (PgBouncer)
- Threshold: Used connections > 80%

**3. Cache Hit Ratio**
- Issue: Cache eviction increases DB load
- Mitigation: Increase cache size or TTL
- Threshold: Hit ratio < 80%

---

## 5. Implementation Order

**Phase 1: Foundation (Weeks 1-2)**
- Load Balancer (01)
- Session Store (02)
- Database (03)
- Auth (12)
- API Gateway (09)

**Phase 2: Data Flow (Weeks 3-4)**
- Cache (04)
- Message Queue (05)
- Stream Processing (06)

**Phase 3: Observability & Features (Weeks 5-6)**
- TimeSeries (07)
- Search (08)
- Webhooks (10)
- Integration Hub (11)
- Observability (13)

**Phase 4: Security & Polish (Weeks 7-8)**
- Security (14)
- Load testing & optimization

---

## 6. Failure Mode Analysis

**Single Point of Failure:**
```
Component         Impact              RTO
─────────────────────────────────────────────
Load Balancer     Region down         <30s (failover)
Session Store     Session loss        <5m (recovery)
Database          Complete failure    <15m (restore)
API Gateway       New connections     <1m (rollback)
```

**Cascading Failures:**
```
If Database slow:
  ├─> Cache hit rate drops
  ├─> Session retrieval slow
  ├─> WebSocket timeouts
  └─> Client reconnects (backoff needed)

If Stream Processing down:
  ├─> Alerts not triggered
  ├─> Changes stored but not processed
  └─> Data queues up (recovers when up)
```

---

## 7. Configuration Management

**Etcd (Distributed Config):**
```
/basset-hound/
  ├─ load_balancer/
  │   ├─ upstream_servers
  │   ├─ rate_limits
  │   └─ sticky_session_ttl
  ├─ monitoring/
  │   ├─ check_interval
  │   ├─ timeout
  │   └─ retry_policy
  └─ alerts/
      ├─ rules
      ├─ thresholds
      └─ notification_channels
```

**Propagation:**
- Changes in Etcd → Watched by all services
- Update without restart (if possible)
- Fallback: Graceful shutdown + restart

---

## 8. Related Components

All 14 component designs are cross-referenced in this Integration Map.

**Reference:**
- Load Balancer: [01-LOAD-BALANCER-DESIGN.md](01-LOAD-BALANCER-DESIGN.md)
- Session Store: [02-SESSION-STORE-DESIGN.md](02-SESSION-STORE-DESIGN.md)
- Database: [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md)
- Cache: [04-CACHE-DESIGN.md](04-CACHE-DESIGN.md)
- Message Queue: [05-MESSAGE-QUEUE-DESIGN.md](05-MESSAGE-QUEUE-DESIGN.md)
- Stream Processing: [06-STREAM-PROCESSING-DESIGN.md](06-STREAM-PROCESSING-DESIGN.md)
- TimeSeries: [07-TIMESERIES-DESIGN.md](07-TIMESERIES-DESIGN.md)
- Search: [08-SEARCH-ANALYTICS-DESIGN.md](08-SEARCH-ANALYTICS-DESIGN.md)
- API Gateway: [09-API-GATEWAY-DESIGN.md](09-API-GATEWAY-DESIGN.md)
- Webhooks: [10-WEBHOOK-DESIGN.md](10-WEBHOOK-DESIGN.md)
- Integration Hub: [11-INTEGRATION-HUB-DESIGN.md](11-INTEGRATION-HUB-DESIGN.md)
- Auth: [12-AUTH-DESIGN.md](12-AUTH-DESIGN.md)
- Observability: [13-OBSERVABILITY-DESIGN.md](13-OBSERVABILITY-DESIGN.md)
- Security: [14-SECURITY-DESIGN.md](14-SECURITY-DESIGN.md)

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
