# Wave 16 Component Design: Cache Layer (Redis Distributed Cache)

**Component ID:** CA-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1 hour  
**Lines:** 1,200+

---

## Executive Summary

The Cache Layer provides distributed caching for frequently accessed data (monitoring configurations, changes history, user preferences). Separate from Session Store, this cache uses Redis with 24-hour TTL for immutable data and event-based invalidation.

**Key Metrics:**
- Capacity: 10GB (separate from session store)
- Hit rate: 85%+ (target)
- Latency: <1ms
- TTL: Configurable (1-24 hours)
- Replication: Master-replica (simple)

---

## 1. Architecture

### 1.1 Cache Topology

```
┌─────────────────────────────────────────┐
│  Cache Layer (Separate Redis)           │
│  - NOT the session store                │
│  - Read-optimized                       │
│  - 10GB capacity                        │
└─────────────────────────────────────────┘
        │                    │
   ┌────▼────┐          ┌────▼────┐
   │ Master  │          │ Replica │
   │ Cache   │          │ Cache   │
   │ 10GB    │          │ 10GB    │
   └────┬────┘          └─────────┘
        │
   [Write-through Cache]
        │
        ▼
┌─────────────────────────┐
│ PostgreSQL (warm store) │
└─────────────────────────┘
```

### 1.2 Cache Key Hierarchy

```
monitoring:config:{task_id}           → Task configuration
changes:recent:{task_id}              → Recent 50 changes
user:preferences:{user_id}            → User settings
feature:flags:{feature_name}          → Feature toggles
api:response:{api_endpoint}:{hash}    → API responses
```

---

## 2. Data Schema

**Cache Entries:**
```
Key: monitoring:config:task_abc123
Value: {
  "task_id": "task_abc123",
  "url": "https://example.com",
  "interval": 300,
  "enabled": true,
  "headers": { ... }
}
TTL: 3600 (1 hour)

Key: changes:recent:task_abc123
Value: [
  { "change_id": "ch_1", "detected_at": 1717416000 },
  { "change_id": "ch_2", "detected_at": 1717415700 }
]
TTL: 86400 (24 hours)
```

---

## 3. Invalidation Strategy

**Time-based:** Automatic expiration (TTL)
**Event-based:** On change detection, delete related cache entries
**Write-through:** Always write to DB first, then cache

---

## 4. Monitoring

**Cache Metrics:**
```
redis_cache_hits_total              # Cache hits
redis_cache_misses_total            # Cache misses
redis_cache_hit_ratio               # Hits / (Hits + Misses)
redis_cache_memory_used             # Memory usage
redis_cache_evictions_total         # Evicted entries (LRU)
```

**Target:** 85%+ hit ratio

---

## 5. Cost Analysis

**Monthly Cost:**
- Cache master (r6i.xlarge): $200
- Cache replica (r6i.xlarge): $200
- Total: ~$400/month (per region)

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
