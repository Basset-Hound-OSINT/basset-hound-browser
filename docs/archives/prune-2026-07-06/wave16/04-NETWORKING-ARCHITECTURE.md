# Wave 16: Networking & CDN Architecture

**Date:** June 2, 2026  
**Phase:** Architecture Design (Phase 2)  
**Duration:** 1 hour design  
**Status:** Detailed Design

---

## Executive Summary

The networking architecture enables global distribution of Basset Hound Browser with sub-100ms latency worldwide. This document defines multi-region deployment, CDN strategy, DDoS protection, and cross-region failover mechanisms.

---

## Global Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Global Load Balancer (Route 53)                 │
│           Geolocation + Health-based routing                 │
└──────────┬─────────────────────────────┬──────────────────────┘
           │                             │
    ┌──────▼──────┐            ┌────────▼────────┐
    │ US Region   │            │ EU Region       │
    │ (Primary)   │            │ (Secondary)     │
    │             │            │                 │
    │ us-east-1   │            │ eu-west-1      │
    │ 10 instances│            │ 5 instances    │
    │             │            │                 │
    │ Latency:    │            │ Latency:       │
    │ 10-50ms     │            │ 30-80ms        │
    └──────┬──────┘            └────────┬────────┘
           │                            │
           │   ┌─────────────────────┐  │
           │   │ CloudFront CDN      │  │
           │   │ (Static Assets)     │  │
           │   │ Edge locations: 200+│  │
           │   │ Cache TTL: 1-24h    │  │
           │   └─────────────────────┘  │
           │                            │
    ┌──────▼──────────────────────────▼─────┐
    │     APAC Region (Future, Phase 2)      │
    │     ap-southeast-1                     │
    │     2 instances (standby)              │
    └───────────────────────────────────────┘
```

---

## Region Configuration

### US Region (Primary)

**Infrastructure:**
- Cloud Provider: AWS (us-east-1)
- Instances: 10 initial (scale to 20)
- Database: PostgreSQL RDS (primary)
- Cache: Redis Sentinel cluster
- Load Balancer: HAProxy + NGINX

**Network:**
```
VPC: 10.0.0.0/16
  ├─ Public Subnet: 10.0.1.0/24 (Load Balancers)
  ├─ Private Subnet: 10.0.2.0/24 (App Instances)
  ├─ Private Subnet: 10.0.3.0/24 (Redis)
  └─ Private Subnet: 10.0.4.0/24 (PostgreSQL)

Internet Gateway: public-igw
NAT Gateway: nat-gateway (for private egress)
Security Groups:
  ├─ LB: Allow 8765 from 0.0.0.0/0
  ├─ App: Allow 8765 from LB only
  ├─ Redis: Allow 6379 from App only
  └─ PostgreSQL: Allow 5432 from App only
```

**Latency Profile:**
- Clients in US: 10-50ms
- Clients in EU: 80-120ms
- Clients in APAC: 150-200ms

### EU Region (Secondary/DR)

**Infrastructure:**
- Cloud Provider: AWS (eu-west-1)
- Instances: 5 initial (scale to 10)
- Database: PostgreSQL RDS (read replica from US)
- Cache: Redis Sentinel cluster (replicated from US)
- Load Balancer: HAProxy + NGINX

**Network:**
```
VPC: 10.1.0.0/16
  ├─ Public Subnet: 10.1.1.0/24
  ├─ Private Subnet: 10.1.2.0/24
  ├─ Private Subnet: 10.1.3.0/24
  └─ Private Subnet: 10.1.4.0/24
```

**Latency Profile:**
- Clients in EU: 20-60ms
- Clients in US: 100-150ms
- Clients in APAC: 120-180ms

### APAC Region (Planned Phase 2)

**Infrastructure (Future, Phase 2):**
- Cloud Provider: AWS (ap-southeast-1)
- Instances: 2 standby (scale to 5)
- Database: PostgreSQL RDS (read replica)
- Cache: Redis Sentinel cluster (replicated)
- Load Balancer: HAProxy + NGINX

**Latency Profile:**
- Clients in APAC: 20-80ms
- Clients in EU: 120-180ms
- Clients in US: 130-200ms

---

## Route 53 Geolocation Routing

**Primary Routing Rules:**

```
Location: US (North America)
  Default → us-east-1 (10.0.1.x)
  Failover → eu-west-1 if us-east-1 unhealthy

Location: Europe
  Default → eu-west-1 (10.1.1.x)
  Failover → us-east-1 if eu-west-1 unhealthy

Location: Asia Pacific
  Default → ap-southeast-1 (10.2.1.x, Phase 2)
  Failover → eu-west-1 if ap-southeast-1 unhealthy

Location: Default (all others)
  Primary → US (us-east-1)
  Secondary → EU (eu-west-1)
```

**Health Check Configuration:**

```
Type: HTTPS + TCP
Endpoint: https://LB-IP:8765/health/ready
Interval: 30 seconds
Failure threshold: 2 consecutive failures
Success threshold: 2 consecutive successes
TTL: 60 seconds (DNS cache)
Failover latency: 30-90 seconds (worst case)
```

---

## CDN Architecture (CloudFront)

### Content Classification

**Static Assets (Cacheable, 80-90% of requests):**
- JavaScript bundles (*.js)
- CSS stylesheets (*.css)
- Images (*.png, *.jpg, *.svg)
- Fonts (*.woff2, *.ttf)
- Manifest files (service-worker.js, manifest.json)

**Dynamic Content (Not cacheable, 10-20% of requests):**
- WebSocket upgrades (handled by regional LB)
- API responses (cache headers: no-cache)
- Real-time monitoring (cache headers: no-store)

### CloudFront Configuration

**Distribution Setup:**

```
Origin 1: us-east-1 Regional LB (primary)
Origin 2: eu-west-1 Regional LB (backup)

Behaviors:
1. Path: /static/* → Cache 24 hours (far-future expires)
2. Path: /api/* → Cache 0 seconds (always revalidate)
3. Path: /* → Origin default (LB decides)

Cache Key:
  - Include: Host, Path, Query String (no cookies for static)
  - Compress: Brotli + Gzip (40-80% size reduction)

TTL Configuration:
  - Default: 1 day (static assets)
  - Max: 1 year (versioned assets /static/v1.0/*)
  - Min: 0 seconds (API responses)

Headers:
  - Cache-Control: public, max-age=86400, immutable
  - ETag: enable (revalidation)
```

**Example Request Flows:**

```
Client in Asia → CloudFront edge location (Singapore)
    ↓
CloudFront cache hit? → Return immediately (1-10ms)
    ↓ Cache miss
CloudFront regional edge cache (Tokyo) hit?
    ↓ Hit: Return (20-30ms)
    ↓ Miss
CloudFront origin (US) → Fetch asset (100-200ms)
    ↓
Return to client with caching headers
    ↓
Cache at edge location for next 24 hours
```

### Cache Hit Rate Targets

| Asset Type | Cache TTL | Hit Rate Target |
|-----------|-----------|-----------------|
| JavaScript bundles | 24 hours | 95% |
| CSS stylesheets | 24 hours | 95% |
| Images | 24 hours | 90% |
| API responses | 5 minutes | 60% |
| WebSocket | N/A | 0% (not cached) |
| **Average** | - | **80-85%** |

**Bandwidth Savings:**
- Total bandwidth: 5 Gbps without CDN
- CDN offload: 80-85% of static assets (4 Gbps)
- Origin bandwidth: 1 Gbps (85% savings)
- Cost savings: ~$0.09 × 4 Gbps × 730 hours = ~$2,628/month

---

## Inter-Region Communication

### Database Replication (PostgreSQL)

**Master → Replica Replication:**

```
US Primary (us-east-1)
    │
    │ Streaming Replication
    │ (asynchronous, <100ms lag)
    │
    ├─→ EU Standby (eu-west-1) [Failover candidate]
    │
    └─→ APAC Read-Only (ap-southeast-1) [Analytics, Phase 2]

Configuration:
max_wal_senders = 5
wal_keep_segments = 64
hot_standby = on
max_standby_delay = 300s (5 minutes)

Replication Lag Target:
- US → EU: <50ms (same AWS backbone)
- US → APAC: <200ms (cross-continent, acceptable)
```

### Session Cache Replication (Redis)

**Master → Replica Replication:**

```
US Master (Redis)
    │
    │ Redis Sentinel
    │ (quorum voting)
    │
    ├─→ US Replica (same AZ, <1ms)
    │
    └─→ EU Replica (different region, 100-200ms)

Replication Mode: Asynchronous
Replication Lag: <100ms (acceptable for sessions)
Failover Time: <30 seconds (quorum vote)
```

### Configuration Synchronization

**Etcd (Distributed Configuration):**

```
Etcd Cluster:
  ├─ us-east-1-01 (quorum leader)
  ├─ eu-west-1-01
  └─ ap-southeast-1-01 (Phase 2)

Config Key Pattern:
  /basset/config/{service}/{parameter}

Example Keys:
  /basset/config/rate_limit/max_connections = 1000
  /basset/config/evasion/fingerprint_mode = adaptive
  /basset/config/monitoring/sample_rate = 0.1

Watch/Notify:
  - All instances watch Etcd for changes
  - Update propagation: <1 second
  - Rollback: revert to previous version
```

---

## DDoS Protection

### AWS Shield Integration

**Standard (Automatic):**
- Layer 3/4 DDoS protection
- Automatic traffic shaping
- No additional cost

**Advanced (Recommended):**
```
Cost: $3,000/month
Coverage:
  - Layer 7 DDoS (application-level attacks)
  - Real-time attack diagnostics
  - DDoS cost protection (refund if attack incurs charges)
```

### Rate Limiting (Regional)

**HAProxy Configuration:**

```haproxy
# Stick table for rate limiting
stick-table type ip size 100k expire 30s store http_req_rate(10s)

# Rate limiting rule (per IP)
http-request track-sc0 src
http-request deny if { sc_http_req_rate(0) gt 100 }
  # Limit: 100 requests per 10 seconds per IP

# Burst handling
http-request set-var(txn:burst) int(1) if { sc_http_req_rate(0) gt 50 }
http-request add-header X-Rate-Limit-Status if txn.burst

# Geo-based rate limiting (future)
# Different limits for different regions
http-request deny if { src 203.0.113.0/24 } { sc_http_req_rate(0) gt 50 }
```

**Application-Level Rate Limiting:**

```javascript
// Per-session rate limiting
const rateLimiter = {
  // Max commands per second per session
  commands: {
    max: 100,
    window: 1000  // milliseconds
  },
  
  // Max bandwidth per second per session
  bandwidth: {
    max: 10 * 1024 * 1024,  // 10 MB/s
    window: 1000
  },
  
  // Max concurrent connections per user
  concurrent: {
    max: 10,
    perRegion: 5
  }
};
```

### Anti-Scraping Measures

**Behavioral Fingerprinting:**
- User agent validation
- Browser capability detection
- Behavioral pattern analysis
- Geolocation consistency

**Rate Limits by User Type:**
| User Type | Connections | Commands/sec | Bandwidth |
|-----------|-------------|-------------|-----------|
| Free tier | 5 | 50 | 5 MB/s |
| Premium | 20 | 200 | 50 MB/s |
| Enterprise | Unlimited | Unlimited | Unlimited |
| Bot/Scraper | 1 | 10 | 100 KB/s |

---

## Network Monitoring

### CloudWatch Metrics

```
Monitored Metrics:
- BytesDownloaded (CDN offload effectiveness)
- Requests (per origin, per region)
- 4xxErrorRate (client errors)
- 5xxErrorRate (server errors)
- OriginLatency (inter-region RTT)
- OriginConnectivityError (failover triggers)

Alarms:
- Origin unavailable → Failover to backup
- High latency (>500ms) → Scale up instances
- High error rate (>1%) → Incident response
```

---

## Failover Procedures

### Instance Failure

**Detection:** HAProxy health check (10 seconds)
**Action:** Remove from LB, auto-restart via Kubernetes
**Impact:** Existing connections drop, auto-reconnect to other instance
**RTO:** <1 minute

### Regional Failure

**Detection:** Route 53 health check (30 seconds)
**Action:** Remove region from DNS, route to backup region
**Impact:** DNS propagation (30-60 seconds)
**RTO:** 1-2 minutes

**Failover Sequence:**
1. US primary unavailable (health check fails)
2. Route 53 removes us-east-1 from DNS
3. Clients resolve to eu-west-1 (via Route 53 secondary)
4. EU region serves increased load (auto-scaling kicks in)
5. Databases promote replicas (manual or automated)
6. Services resume on EU (1-2 minute downtime)

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | WAVE-16-PHASE-2-NETWORKING |
| Version | 1.0 |
| Status | Draft |
| Created | June 2, 2026 |
| Owner | Architecture Team |

---

**Next Document:** `/docs/wave16/05-MONITORING-OBSERVABILITY.md`
