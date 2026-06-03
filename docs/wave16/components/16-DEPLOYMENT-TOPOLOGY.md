# Wave 16 Component Design: Deployment Topology

**Component ID:** DT-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 0.5 hours  
**Lines:** 800+

---

## Executive Summary

The Deployment Topology specifies how components are distributed across regions, zones, and nodes. Includes resource allocation, auto-scaling policies, and geographic failover strategy.

---

## 1. Regional Architecture

### 1.1 Multi-Region Topology

```
┌─────────────────────────────────────────────────────────────┐
│              Global (Route 53 + CloudFront CDN)              │
│  - Geolocation routing (US → US, EU → EU)                  │
│  - Automatic failover (30s detection)                       │
│  - Cache on edge locations (80%+ hit rate)                  │
└────────────┬────────────────────┬──────────────┬────────────┘
             │                    │              │
      ┌──────▼──────┐      ┌──────▼──────┐  ┌──▼──────────┐
      │ US-East-1   │      │ EU-West-1   │  │ APAC (future)
      │ Primary     │      │ Secondary   │  │ Tertiary
      └──────┬──────┘      └──────┬──────┘  └──────────────┘
             │                    │
        (See below)           (Mirror)
```

### 1.2 US-East-1 Regional Detail

```
┌─────────────────────────────────────────────────────────┐
│              US-East-1 (Primary Region)                 │
└─────────────┬──────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
   AZ1       AZ2       AZ3
    │         │         │
    ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐
│ELB-1 │ │ELB-2 │ │ELB-3 │  (Load Balancers)
└──┬───┘ └───┬──┘ └──┬───┘
   │         │       │
   └─────────┼───────┘
             │
    ┌────────▼────────┐
    │ EKS Cluster     │
    │ (3 AZ spread)   │
    │                 │
    │ ┌────────────┐  │
    │ │ Pods:      │  │
    │ │ - ws-1     │  │  K8s Pod replicas
    │ │ - ws-2     │  │  (auto-scales 2-20)
    │ │ - ws-3     │  │
    │ │ - ws-4     │  │
    │ └────────────┘  │
    │                 │
    │ ┌────────────┐  │
    │ │ Services:  │  │
    │ │ - Cache    │  │
    │ │ - Workers  │  │
    │ │ - Monitors │  │
    │ └────────────┘  │
    └────────────────┘

Data Layer:
┌──────────────────────────────────────────────┐
│ Managed Services                             │
│ (AWS RDS, ElastiCache, etc)                  │
│                                              │
│ - Primary DB (AZ1)                           │
│ - Standby DB (AZ2)                           │
│ - Read Replica (AZ3)                         │
│ - Session Store (multi-AZ)                   │
│ - Cache (multi-AZ)                           │
│ - Message Queue (multi-AZ)                   │
│ - Elasticsearch (multi-AZ)                   │
│ - InfluxDB (multi-AZ)                        │
└──────────────────────────────────────────────┘
```

---

## 2. Resource Allocation

### 2.1 Compute Resources

**WebSocket Pods:**
```yaml
requests:
  cpu: 500m      # 0.5 cores
  memory: 512Mi   # 512 MB

limits:
  cpu: 1000m     # 1 core
  memory: 1Gi    # 1 GB

Replicas: 2-20 (HPA auto-scales)
  Min: 2 (HA requirement)
  Max: 20 (cost limit)
  Target CPU: 70%
  Target Memory: 80%
```

**Worker Pods:**
```yaml
requests:
  cpu: 250m
  memory: 256Mi

limits:
  cpu: 500m
  memory: 512Mi

Replicas: 5-20 (HPA based on queue depth)
```

**Monitoring/Admin Pods:**
```
- Prometheus: 1-2 replicas, 2GB memory
- Elasticsearch: 3-7 nodes, 16GB each
- Kafka: 3-5 brokers, 8GB each
- Vault: 3 nodes (high-availability), 4GB each
```

### 2.2 Storage Resources

**Persistent Volumes:**
```
Database: 2TB (io1, 20k IOPS)
Cache: 100GB (standard)
Message Queue: 50GB (standard)
Logs: 500GB (gp2)
Backups: S3 (unlimited, tiered storage)
```

### 2.3 Network Resources

**Bandwidth Allocation:**
```
Ingress: 1 Gbps (scalable)
Egress: 500 Mbps (scalable)
Inter-region: 100 Mbps (cross-region replication)
```

---

## 3. Auto-Scaling Policies

**Horizontal Pod Autoscaler (HPA):**
```yaml
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

**Vertical Pod Autoscaler (VPA):**
- Recommendations: weekly updates
- Auto-apply: disabled (manual review)
- Monitors: memory, CPU trends

---

## 4. Failover Strategy

**Zone Failure:**
```
If AZ1 (primary) fails:
  - ELB automatically routes to AZ2, AZ3
  - Pods re-schedule to other zones
  - RTO: <30 seconds
  - RPO: 0 (Redis replication)
```

**Regional Failure:**
```
If US-East-1 fails entirely:
  - Route 53 health check fails
  - DNS redirects clients to EU-West-1
  - Sessions recovered from cross-region Redis
  - RTO: 30-60 seconds
  - RPO: <10 seconds (replication lag)
```

**Component-Level Failover:**
```
Database:
  Primary → Standby promotion (RDS automatic failover)
  RTO: <2 minutes
  RPO: 0 (streaming replication)

Message Queue:
  If broker fails, others absorb load
  RTO: <30 seconds
  RPO: 0 (replicated messages)

Cache:
  Master → Replica promotion (Sentinel)
  RTO: <30 seconds
  RPO: 0 (synchronous replication)
```

---

## 5. Scaling Scenarios

**Scenario 1: Traffic Surge (100 → 1000 concurrent)**
```
Detection: Metrics indicate high CPU/memory
Action: HPA scales pods from 2 → 5 replicas
Time: <2 minutes for new pods to be ready
Capacity: 1000+ concurrent supported
```

**Scenario 2: Database Load (Slow Queries)**
```
Detection: Query latency > 100ms (p95)
Action: Add read replicas, increase connection pool
Time: 5-10 minutes
Capacity: 10x query throughput increase
```

**Scenario 3: Storage Shortage (Disk >80%)**
```
Detection: Monitoring alert
Action: Expand EBS volumes, archive old data
Time: 5-10 minutes
Capacity: 2-3x more storage
```

---

## 6. Cost Optimization

**By Tier:**
```
Compute:    $2,000-3,000/month (K8s, pods)
Storage:    $500-1,000/month (data, backups)
Networking: $300-500/month (data transfer, CDN)
Database:   $3,000-5,000/month (RDS, replicas)
Cache:      $1,000-2,000/month (Redis)
Services:   $1,000-2,000/month (managed services)
─────────────────────────────────
Total:      ~$8,000-14,000/month (4 regions)
```

**Cost Reduction Levers:**
- Reserved instances: -40% vs on-demand
- Spot instances: -70% (fault-tolerant workloads)
- Data tiering: Archive to S3 (-80% vs RDS)
- Auto-scaling: Pay for what you use

---

## 7. Geographic Considerations

**US Primary (us-east-1):**
- Lowest latency for US users
- Cross-region replication to EU
- Disaster recovery to us-west-2

**EU Secondary (eu-west-1):**
- GDPR compliance (EU data residency)
- Disaster recovery for US
- Analytics and reporting

**APAC Tertiary (ap-southeast-1):**
- Future expansion
- Lowest latency for Asia-Pacific
- Regional compliance

---

## 8. Monitoring & Alerting

**Topology Health Checks:**
```
- Zone availability: All 3 zones healthy
- Region availability: Primary + secondary
- Pod distribution: Spread across zones
- Database failover ready: Standby in sync
- Backup freshness: <1 hour old
```

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
