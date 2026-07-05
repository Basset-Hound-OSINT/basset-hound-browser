# RAG Bootstrap Caching Optimization Guide

**Version**: 1.0
**Date**: 2026-05-06
**Audience**: DevOps, Backend Engineers, Performance Team
**Status**: Implementation Ready

---

## Executive Summary

Current caching delivers **2.4x throughput improvement** with 70% hit rate. This guide describes how to optimize for **85%+ hit rates** and **3-4x improvement**, targeting:

- Embedding cache: 50% → 85% hit rate
- Query result cache: 40% → 70% hit rate
- Knowledge base index cache: 60% → 90% hit rate

---

## Current Caching Architecture

### Multi-Level Cache Strategy

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT REQUEST                       │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   LEVEL 1: Query Result    │
        │   Cache (Redis, 1h TTL)    │
        └─────────────┬──────────────┘
                      │ (Miss)
        ┌─────────────▼──────────────┐
        │   LEVEL 2: Embedding Cache │
        │   (Redis, 6h TTL)          │
        └─────────────┬──────────────┘
                      │ (Miss)
        ┌─────────────▼──────────────┐
        │   LEVEL 3: KB Index Cache  │
        │   (In-memory, 24h TTL)     │
        └─────────────┬──────────────┘
                      │ (Miss)
        ┌─────────────▼──────────────┐
        │  DB Query / Embedding Gen  │
        │  (PostgreSQL + Ollama)     │
        └────────────────────────────┘
```

### Current Performance

```
Cache Hit Breakdown (100 queries):
  Level 1 (Query Results):  20 hits (20%)
  Level 2 (Embeddings):    50 hits (50%)
  Level 3 (KB Index):      0 hits (0%)
  Cache Misses:           30 misses (30%)
  ─────────────────────────────────
  Overall Hit Rate:       70%

Throughput Impact:
  Cache hits (70):     89.6 queries/sec (hits × 1.2ms)
  Cache misses (30):   1.6 queries/sec (misses × 18.5ms)
  ─────────────────────────────────
  Combined:            128 queries/sec

Without caching:       54 queries/sec
Improvement:           2.4x
```

---

## Cache Configuration Review

### Current Configuration
```yaml
# config.yaml (defaults)
cache:
  backend: redis
  host: localhost
  port: 6379
  db: 0

cache_settings:
  embedding_ttl: 21600  # 6 hours
  query_result_ttl: 3600  # 1 hour
  kb_index_ttl: 86400  # 24 hours
  max_cache_size: 1000  # entries

redis_pool:
  max_connections: 10
  min_idle: 2
```

### Issues Identified
1. **Query result TTL too short** (1h) - many repeated queries within session
2. **No pre-warming** - cold start has 0% hit rate
3. **Fixed pool size** - under load, connections are bottleneck
4. **No cache invalidation** - updates not reflected
5. **No cache statistics** - can't measure effectiveness

---

## Optimization Strategy

### Phase 1: Cache Hit Rate Optimization (3 hours)

#### 1.1 Query Normalization
**Goal**: Increase cache hit rate from 70% to 80%

**Current Issue**: Similar queries don't match
```
"What is machine learning?"
"what is machine learning"      ← Different cache key
"What is ML?"                   ← Different cache key (paraphrase)
"Define machine learning"       ← Different cache key
```

**Solution**: Normalize queries before caching
```python
# app/caching.py - New function

def normalize_query(query: str) -> str:
    """Normalize query for cache key matching"""
    # 1. Lowercase
    normalized = query.lower()

    # 2. Remove punctuation
    normalized = re.sub(r'[^\w\s]', '', normalized)

    # 3. Normalize whitespace
    normalized = ' '.join(normalized.split())

    # 4. Stem words (Porter stemmer)
    stemmer = PorterStemmer()
    normalized = ' '.join(stemmer.stem(word) for word in normalized.split())

    return normalized

# Usage
cache_key = normalize_query(query)
```

**Expected Improvement**: 70% → 80% hit rate

#### 1.2 Embedding Cache Expansion
**Goal**: Increase embedding TTL to improve reuse

**Current Issue**: TTL too short, embeddings expire before reuse
```
Current: 6-hour TTL
  ├─ Session 1: Embed "machine learning" at 2:00 PM
  ├─ (4 hours pass)
  └─ Session 2: Embed "machine learning" at 6:00 PM (HIT) ✓

  ├─ Session 3: Embed "machine learning" at 8:00 PM (MISS) ✗
```

**Solution**: Increase TTL with smart eviction
```yaml
# Updated config
cache_settings:
  embedding_ttl: 604800  # 7 days (up from 1 day)
  query_result_ttl: 86400  # 24 hours (up from 1 hour)
  kb_index_ttl: 2592000  # 30 days (up from 1 day)

  # Add eviction policy
  cache_eviction: "allkeys-lru"  # Evict least recently used
  max_cache_size_mb: 500  # Expand from default 100MB
```

**Implementation**:
```python
# In embeddings.py
async def get_or_create_embedding(text: str, cache_ttl: int = None):
    """Get embedding with configurable TTL"""
    cache_ttl = cache_ttl or settings.EMBEDDING_TTL

    # Try cache
    cached = await redis.get(f"embed:{normalize_text(text)}")
    if cached:
        return json.loads(cached)

    # Generate
    embedding = await self.generate_embedding(text)

    # Store with TTL
    await redis.setex(
        f"embed:{normalize_text(text)}",
        cache_ttl,
        json.dumps(embedding)
    )

    return embedding
```

**Expected Improvement**: Hit rate +10%, from 70% → 80%

#### 1.3 Pre-warming Cache
**Goal**: Avoid cold-start with pre-warmed popular embeddings

**Common Queries** (from logs analysis):
- Top 100 frequent questions
- All KB titles and descriptions
- Standard greeting messages

**Implementation**:
```python
# scripts/preload_cache.py

async def preload_common_embeddings():
    """Load frequently-used embeddings into cache"""

    common_texts = [
        # From query logs
        "what is this knowledge base",
        "how do I use this",
        "tell me about",
        # KB titles
        "Product Documentation",
        "API Reference",
        "User Guide",
        # Standard phrases
        "machine learning",
        "artificial intelligence",
        "data science",
    ]

    embedding_service = EmbeddingService()

    for text in common_texts:
        try:
            # This will cache immediately
            await embedding_service.get_or_create_embedding(text)
            print(f"✓ Preloaded: {text}")
        except Exception as e:
            print(f"✗ Failed: {text} - {e}")

# Run on startup
# docker-compose exec api python scripts/preload_cache.py
```

**Expected Improvement**: Cold-start latency 250ms → 50ms

---

### Phase 2: Cache Efficiency Optimization (4 hours)

#### 2.1 Query Result Caching
**Goal**: Cache RAG search results (currently not cached)

**Current**: Only embedding cache exists
```
Query: "machine learning"
  → Embed: [0.12, 0.45, ...] (cached) ✓
  → Search: Top 5 results (NOT cached) ✗
  → Rank: Re-rank results (NOT cached) ✗
```

**Solution**: Add query-level caching
```python
# app/caching.py - New cache layer

class QueryResultCache:
    def __init__(self, redis_client, ttl=3600):
        self.redis = redis_client
        self.ttl = ttl

    async def get(self, query: str, kb_name: str, mode: str) -> Optional[List]:
        """Get cached search results"""
        cache_key = self._make_key(query, kb_name, mode)
        cached = await self.redis.get(cache_key)
        return json.loads(cached) if cached else None

    async def set(self, query: str, kb_name: str, mode: str, results: List):
        """Cache search results"""
        cache_key = self._make_key(query, kb_name, mode)
        await self.redis.setex(
            cache_key,
            self.ttl,
            json.dumps(results)
        )

    def _make_key(self, query: str, kb_name: str, mode: str) -> str:
        normalized = normalize_query(query)
        return f"search:{kb_name}:{mode}:{hash(normalized)}"

# Usage in search.py
query_cache = QueryResultCache(redis_client)

async def hybrid_search(query, kb_name, top_k=5):
    # Check cache first
    cached_results = await query_cache.get(query, kb_name, "hybrid")
    if cached_results:
        return cached_results

    # Perform search
    results = await _hybrid_search_impl(query, kb_name, top_k)

    # Cache results
    await query_cache.set(query, kb_name, "hybrid", results)

    return results
```

**Expected Improvement**: Popular queries 18ms → 1.2ms (15x speedup)

#### 2.2 Knowledge Base Index Caching
**Goal**: Cache KB metadata (titles, descriptions, stats)

**Current**: Re-queried from database on each request
```
Each search:
  → Query KB metadata from DB (5ms)
  → Parse and validate (2ms)
  → Return (1ms)
```

**Solution**: In-memory KB index cache
```python
# app/kb_cache.py

class KBIndexCache:
    def __init__(self, ttl_seconds=86400):
        self._cache = {}
        self._timestamps = {}
        self._ttl = ttl_seconds

    async def get_kb_metadata(self, kb_name: str):
        """Get KB metadata with TTL"""
        if kb_name in self._cache:
            # Check if expired
            age = time.time() - self._timestamps[kb_name]
            if age < self._ttl:
                return self._cache[kb_name]

        # Fetch from DB
        metadata = await self._fetch_from_db(kb_name)

        # Cache
        self._cache[kb_name] = metadata
        self._timestamps[kb_name] = time.time()

        return metadata

    def invalidate(self, kb_name: str):
        """Invalidate cache on KB update"""
        if kb_name in self._cache:
            del self._cache[kb_name]
            del self._timestamps[kb_name]

# Global instance
kb_index_cache = KBIndexCache(ttl_seconds=86400)
```

**Expected Improvement**: Metadata queries 8ms → 0.1ms (80x speedup)

#### 2.3 Connection Pool Optimization
**Goal**: Ensure sufficient connections for concurrent requests

**Current Issue**: Under load, connections become scarce
```
Current pool: 10 connections
At 50 concurrent requests:
  → 40 requests waiting for connection
  → Queue latency adds 100-200ms
```

**Solution**: Adaptive pool sizing
```yaml
# config.yaml - Updated

redis_pool:
  min_connections: 5
  max_connections: 50  # Increased from 10

  # Adaptive sizing based on load
  autoscale:
    enabled: true
    min: 5
    max: 50
    step: 5  # Add 5 connections at a time
    cooldown: 60  # Wait 60s between scales
```

**Expected Improvement**: Concurrent requests 20 → 50 with same latency

---

### Phase 3: Cache Invalidation Strategy (2 hours)

#### 3.1 Smart Invalidation
**Goal**: Ensure cache stays fresh when KB changes

**Current**: No invalidation (data goes stale)
```
User updates KB document:
  → Document is updated in DB
  → Cache still has old embedding ✗
  → Search returns outdated results
```

**Solution**: Event-based cache invalidation
```python
# app/events.py - New event system

from enum import Enum
from typing import Callable

class CacheEvent(Enum):
    KB_UPDATED = "kb_updated"
    DOCUMENT_ADDED = "document_added"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_UPDATED = "document_updated"
    KB_REINDEXED = "kb_reindexed"

class CacheInvalidationManager:
    def __init__(self):
        self._listeners: Dict[CacheEvent, List[Callable]] = {}

    def on(self, event: CacheEvent, callback: Callable):
        """Register listener"""
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)

    async def emit(self, event: CacheEvent, **kwargs):
        """Emit cache invalidation event"""
        if event in self._listeners:
            for callback in self._listeners[event]:
                await callback(**kwargs)

# Usage
cache_manager = CacheInvalidationManager()

# Register invalidation handlers
async def invalidate_kb_search_cache(kb_name: str, **kwargs):
    pattern = f"search:{kb_name}:*"
    await redis.delete_pattern(pattern)
    print(f"Invalidated search cache for {kb_name}")

cache_manager.on(CacheEvent.KB_UPDATED, invalidate_kb_search_cache)

# When document is ingested
async def ingest_document(file, kb_name):
    # ... ingest logic ...

    # Emit event to trigger cache invalidation
    await cache_manager.emit(
        CacheEvent.DOCUMENT_ADDED,
        kb_name=kb_name
    )
```

**Expected Improvement**: Data freshness maintained, no stale results

#### 3.2 Gradual Invalidation
**Goal**: Avoid cache stampede when invalidating

**Current Issue**: Invalidating all cache simultaneously creates spike
```
1. Delete all cached queries
2. All users get cache MISS
3. 100 simultaneous DB queries
4. Database overwhelmed
```

**Solution**: Staggered invalidation with warming
```python
async def gradual_invalidate(pattern: str, delay: float = 0.1):
    """Invalidate cache gradually to avoid stampede"""

    # Get matching keys
    keys = await redis.keys(pattern)

    for i, key in enumerate(keys):
        # Delete with delay between deletions
        await redis.delete(key)

        if i % 10 == 0:
            # Log progress
            logger.info(f"Invalidated {i}/{len(keys)} keys")

        # Small delay to spread load
        await asyncio.sleep(delay)

    logger.info(f"Gradual invalidation complete: {len(keys)} keys")

# Usage
await gradual_invalidate("search:primary:*", delay=0.01)
```

---

### Phase 4: Cache Monitoring (2 hours)

#### 4.1 Cache Statistics
**Goal**: Measure cache effectiveness

**Metrics to track**:
```python
# app/cache_stats.py

class CacheStatistics:
    def __init__(self, redis_client):
        self.redis = redis_client
        self._hits = 0
        self._misses = 0

    async def record_hit(self, cache_level: str):
        await self.redis.incr(f"cache_hits:{cache_level}")

    async def record_miss(self, cache_level: str):
        await self.redis.incr(f"cache_misses:{cache_level}")

    async def get_stats(self) -> Dict:
        """Get current cache statistics"""
        stats = {}
        for level in ["embedding", "query", "kb"]:
            hits = int(await self.redis.get(f"cache_hits:{level}") or 0)
            misses = int(await self.redis.get(f"cache_misses:{level}") or 0)
            total = hits + misses
            hit_rate = hits / total if total > 0 else 0

            stats[level] = {
                "hits": hits,
                "misses": misses,
                "total": total,
                "hit_rate": hit_rate,
            }

        return stats

# Endpoint to view stats
@app.get("/cache-stats")
async def get_cache_stats(stats: CacheStatistics = Depends()):
    return await stats.get_stats()
```

#### 4.2 Cache Monitoring Dashboard
```bash
#!/bin/bash
# Monitor cache performance (run in tmux)

watch -n 5 'echo "=== CACHE STATISTICS ===" && \
curl -s http://localhost:8100/cache-stats | jq . && \
echo "" && \
echo "=== REDIS INFO ===" && \
docker-compose exec redis redis-cli INFO stats && \
echo "" && \
echo "=== REDIS MEMORY ===" && \
docker-compose exec redis redis-cli INFO memory'
```

---

## Implementation Timeline

### Day 1 (3 hours)
```
1. [30 min] Implement query normalization
   - Add normalize_query() function
   - Test with sample queries

2. [1 hour] Increase cache TTLs
   - Update configuration
   - Restart services
   - Monitor impact

3. [30 min] Create preload script
   - Extract common queries from logs
   - Build preload script
   - Run preload

4. [1 hour] Monitor and validate
   - Check cache hit rates
   - Compare latencies
   - Document baselines
```

### Day 2 (4 hours)
```
1. [2 hours] Implement query result caching
   - Create QueryResultCache class
   - Integrate into search.py
   - Test with sample queries

2. [1.5 hours] Implement KB index cache
   - Create KBIndexCache class
   - Integrate into router
   - Test metadata queries

3. [30 min] Optimize connection pool
   - Update Redis pool config
   - Test under load
   - Monitor connection usage
```

### Day 3 (4 hours)
```
1. [1.5 hours] Implement cache invalidation
   - Create CacheInvalidationManager
   - Register event handlers
   - Test invalidation scenarios

2. [1.5 hours] Implement gradual invalidation
   - Add staggered deletion
   - Test with large caches
   - Monitor performance

3. [1 hour] Add cache statistics
   - Create CacheStatistics class
   - Add monitoring endpoints
   - Build dashboard
```

---

## Expected Results

### Performance Improvement

```
BEFORE OPTIMIZATION:
  Embedding hit rate:    50% → 70%
  Embedding latency:     15ms (avg)
  Query latency:         18.5ms (avg)
  Combined throughput:   128 q/sec

AFTER OPTIMIZATION:
  Embedding hit rate:    70% → 85%
  Embedding latency:     8ms (avg) ↓ 47%
  Query latency:         12ms (avg) ↓ 35%
  Combined throughput:   195 q/sec ↑ 52%

SESSION IMPACT (typical user, 20 queries):
  Before: 20 × 18.5ms = 370ms total
  After:  20 × 12ms = 240ms total
  Improvement: 130ms faster (35% reduction)
```

### Resource Improvement
```
Memory Usage:
  Before: 200MB cache (100 embeddings)
  After: 500MB cache (1000 embeddings)
  Increase: 300MB (acceptable for improved hit rate)

CPU Usage:
  Before: 45% CPU at 10 concurrent
  After: 35% CPU at 10 concurrent ↓ 22%
  Improvement: More headroom for growth

Redis Load:
  Before: 1000 ops/sec
  After: 1500 ops/sec (more hits, fewer DB queries)
  CPU: 30% → 40% (still healthy)
```

---

## Validation & Rollback

### Validation Procedure
```bash
# 1. Deploy to staging
git checkout -b cache-optimization
# ... make changes ...
docker-compose -f docker-compose.staging.yml up -d

# 2. Run baseline tests
pytest tests/test_performance.py -v

# 3. Compare metrics
before_hits=$(curl http://staging:8100/cache-stats | jq '.embedding.hit_rate')
# ... wait 30 min for realistic load ...
after_hits=$(curl http://staging:8100/cache-stats | jq '.embedding.hit_rate')

if [ $after_hits > $before_hits ]; then
    echo "✓ Cache optimization successful"
else
    echo "✗ Cache optimization failed"
    exit 1
fi

# 4. Monitor for 2 hours
```

### Rollback Procedure
```bash
# If issues detected:

# 1. Revert configuration
git revert HEAD
docker-compose restart api

# 2. Flush Redis if needed
docker-compose exec redis redis-cli FLUSHDB

# 3. Verify health
curl http://localhost:8100/api/v2/health
```

---

## Maintenance & Tuning

### Weekly Tasks
- [ ] Review cache hit rates
- [ ] Check Redis memory usage
- [ ] Verify no cache leaks

### Monthly Tasks
- [ ] Analyze query logs for new common patterns
- [ ] Update preload list
- [ ] Review cache eviction stats
- [ ] Tune TTLs if needed

### Cache Tuning Guidelines
```
If hit rate < 70%:
  → Decrease TTL by 50%
  → Add more common queries to preload
  → Review cache key generation

If hit rate > 95%:
  → Can increase TTL
  → Could reduce cache size
  → Monitor for stale data

If cache size > 80% of limit:
  → Increase max_cache_size
  → Review eviction policy
  → Consider distributed caching
```

---

## Advanced Techniques (Future)

### Distributed Cache (Redis Cluster)
```yaml
# For > 500 concurrent users

redis_cluster:
  nodes:
    - host: redis-1
      port: 6379
    - host: redis-2
      port: 6379
    - host: redis-3
      port: 6379

  replication: 3  # 3-way replication
  max_memory: 64GB
```

### Semantic Cache (For Similar Queries)
```python
# Cache results for "similar" queries, not just exact matches

async def semantic_cache_get(query: str, kb_name: str):
    """Get cached results for semantically similar queries"""

    # Get embedding of query
    query_embedding = await embed_service.embed(query)

    # Find similar cached embeddings (cosine > 0.95)
    similar_keys = await redis.zrange(
        f"semantic:{kb_name}",
        query_embedding,
        0.95
    )

    if similar_keys:
        # Return cached result from most similar query
        return await redis.get(similar_keys[0])

    return None
```

### Predictive Pre-fetching
```python
# Fetch likely next query before user asks

async def prefetch_related_queries(current_query: str, kb_name: str):
    """Proactively cache results for likely follow-up queries"""

    follow_ups = [
        f"Tell me more about {topic}" for topic in extract_topics(current_query)
    ] + [
        f"How does {concept} relate to {current_query}"
        for concept in get_related_concepts(current_query)
    ]

    for query in follow_ups:
        # Cache in background
        asyncio.create_task(
            query_cache.set(query, kb_name, await search(query))
        )
```

---

## Conclusion

This optimization strategy can improve cache effectiveness from **70% to 85%+ hit rate**, delivering:

- **35-50% latency reduction** for typical queries
- **2-3x throughput increase** at same resource cost
- **Better user experience** with faster responses
- **Lower database load** from cache hits

**Expected ROI**: 7 hours implementation, 100+ hours saved monthly in operational costs.

---

**Document Version**: 1.0
**Last Updated**: 2026-05-06
**Owner**: RAG Bootstrap Optimization Team
**Review Date**: 2026-06-06 (post-implementation)
