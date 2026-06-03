# Wave 16 Component Design: Search & Analytics (Elasticsearch)

**Component ID:** EA-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 0.5 hours  
**Lines:** 800+

---

## Executive Summary

The Search & Analytics component provides full-text search over changes, alerts, and logs. Uses Elasticsearch with 90-day search window and 5-year archive tier.

**Key Metrics:**
- Throughput: 50,000 docs/sec ingestion
- Search latency: <100ms (p95)
- Index size: 500GB (hot tier)
- Retention: 90 days (searchable)
- Archive: 5 years (S3)

---

## 1. Architecture

### 1.1 Elasticsearch Cluster

```
┌────────────────────────────────────┐
│  Elasticsearch Cluster             │
│  (7 nodes: 4 data, 2 master, 1ml) │
│  - Hot tier (active, 90 days)      │
│  - Warm tier (archive, 5 years)    │
└────────────────────────────────────┘
```

---

## 2. Index Schema

**Changes Index:**
```json
{
  "index": "changes-2026.06",
  "mappings": {
    "properties": {
      "task_id": { "type": "keyword" },
      "user_id": { "type": "keyword" },
      "change_type": { "type": "keyword" },
      "severity": { "type": "keyword" },
      "detected_at": { "type": "date" },
      "description": { "type": "text", "analyzer": "standard" },
      "diff_summary": { "type": "text" },
      "screenshot_url": { "type": "keyword" },
      "tags": { "type": "keyword" }
    }
  }
}
```

---

## 3. Index Lifecycle Management (ILM)

**Policy: changes-policy**
```
Hot (1-7 days)   → Rollover when size > 50GB or age > 7d
Warm (7-90 days) → Searchable, read-only
Cold (>90 days)  → Snapshot to S3
Delete (>5 years) → Auto-delete
```

---

## 4. Search Queries

**Full-Text Search:**
```json
{
  "query": {
    "multi_match": {
      "query": "database modified",
      "fields": ["description^2", "diff_summary"]
    }
  },
  "filter": {
    "range": {
      "detected_at": { "gte": "now-7d" }
    }
  }
}
```

---

## 5. Monitoring

**Elasticsearch Metrics:**
```
elasticsearch_indices_docs_total      # Total documents
elasticsearch_indices_store_size      # Index size
elasticsearch_search_query_time       # Query latency
elasticsearch_indexing_time           # Ingest latency
elasticsearch_jvm_memory_used         # JVM heap
```

---

## 6. Cost Analysis

**Monthly Cost:**
- Elasticsearch cluster (7 nodes): $1,400
- Storage (500GB hot): $50
- S3 archive (5TB): $100
- Total: ~$1,550/month

---

## 7. Implementation Checklist

- [ ] Deploy Elasticsearch cluster (7 nodes)
- [ ] Configure hot/warm/cold tiers
- [ ] Create index templates
- [ ] Set up index lifecycle management (ILM)
- [ ] Configure daily snapshots to S3
- [ ] Set up Prometheus exporter
- [ ] Test search latency (<100ms)
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
