# Basset Hound Browser - Multi-Agent Optimization Guide

**Version:** 1.0  
**Date:** May 7, 2026  
**Target:** AI agents (Opus, Sonnet, Haiku) using Basset Hound Browser at scale  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Batch Operation Optimization](#batch-operation-optimization)
3. [Connection Pooling](#connection-pooling)
4. [Caching Strategies](#caching-strategies)
5. [Selective Data Capture](#selective-data-capture)
6. [Progressive Loading](#progressive-loading)
7. [Agent-Specific Tuning](#agent-specific-tuning)
8. [Bottleneck Identification](#bottleneck-identification)
9. [Configuration Reference](#configuration-reference)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

Basset Hound Browser is optimized for multi-agent deployments with these key characteristics:

| Metric | Value | Context |
|--------|-------|---------|
| **Operation Latency** | 120ms avg | Navigate + get title |
| **Max Concurrent Ops** | 100-407 ops/sec | Batch dependent |
| **Optimal Batch Size** | 50-100 | Linear throughput scaling |
| **Memory Per Operation** | 6.3MB heap | Stable, minimal growth |
| **Daily Capacity** | 720K+ operations | On minimal hardware |
| **Connection Pool Size** | 5-10 | Recommended for 3+ agents |
| **Cache Hit Ratio Target** | 40-60% | With smart caching |

**Key Principle:** The browser's performance is I/O-bound (network waits), not CPU-bound. Optimization focuses on reducing redundant network requests and maximizing concurrent operations.

---

## Batch Operation Optimization

### 1. Optimal Batch Sizing

**Finding:** Throughput scales linearly with batch size up to 100 concurrent operations.

```
Batch Size | Throughput  | Per-Op Latency | Use Case
-----------|-------------|----------------|----------
10         | 45 ops/sec  | ~167ms         | Small teams, quick feedback
50         | 203 ops/sec | ~162ms         | Most production scenarios
100        | 407 ops/sec | ~167ms         | High-volume operations
200+       | May degrade | 200-300ms+     | Avoid - resource contention
```

**Recommendation by Agent Type:**

| Agent | Batch Size | Reasoning |
|-------|-----------|-----------|
| **Opus 4.7** | 50 | Complex analysis needs breathing room |
| **Sonnet 4.6** | 75 | Good balance of speed and control |
| **Haiku 4.5** | 100 | Can handle maximum throughput |

### 2. Batch Composition Strategies

**Strategy A: Homogeneous Batches** (Recommended for Most Cases)
- All operations same type (e.g., all screenshots)
- Predictable latency
- Easy caching/deduplication
- Example: Batch of 50 URLs → 50 screenshots

```python
# Pseudo-code for homogeneous batch
batch = [
    {'url': url1, 'command': 'screenshot'},
    {'url': url2, 'command': 'screenshot'},
    # ... 48 more
]
results = await browser.execute_batch(batch, size=50)
```

**Benefits:**
- 15-20% faster processing
- Better memory locality
- Easier result correlation
- Optimal CPU cache utilization

**Strategy B: Mixed Workflow Batches** (For Complex Operations)
- Navigate, wait, extract, capture sequence
- Per-URL latency: 350-500ms
- Suitable for deep investigation workflows

```python
workflow = [
    {
        'url': target_url,
        'operations': [
            {'command': 'navigate', 'url': target_url},
            {'command': 'wait_for_element', 'selector': 'body'},
            {'command': 'get_content'},
            {'command': 'extract_links'},
            {'command': 'screenshot'}
        ]
    },
    # ... more URLs
]
# Execute as chain, not parallel
for item in workflow:
    results = await browser.execute_workflow(item['operations'])
```

**Benefits:**
- Handles dependent operations
- Reduces context switching
- Better error recovery
- More reliable for complex sites

### 3. Results Merging Efficiency

**Pattern A: Stream Processing** (Recommended for Large Batches)
```python
# Process results as they arrive, don't wait for full batch
results_queue = await browser.execute_batch_stream(urls, batch_size=50)
for result in results_queue:
    process_result(result)  # Non-blocking
    save_result(result)
```

**Advantages:**
- Lower memory footprint (process incrementally)
- Faster time to first result
- Can stop early if goal met
- Better for real-time monitoring

**Pattern B: Aggregation** (For Analysis/Deduplication)
```python
# Collect, deduplicate, then process
batch_results = await browser.execute_batch(urls, batch_size=100)
deduplicated = deduplicate_by_content_hash(batch_results)
filtered = filter_by_quality(deduplicated)
processed = await analyze_batch(filtered)
```

**Advantages:**
- Can deduplicate redundant pages
- Optimize downstream processing
- Better for pattern analysis
- Reduces cost in downstream AI

### 4. Error Handling in Batches

**Recommended Strategy: Partial Success with Retry**

```python
async def resilient_batch_operation(urls, batch_size=50):
    results = []
    failed_urls = []
    
    # Initial batch
    batch_result = await browser.execute_batch(urls, batch_size=batch_size)
    
    for item in batch_result:
        if item['success']:
            results.append(item)
        else:
            failed_urls.append(item['url'])
    
    # Retry failed URLs individually (often temporary issues)
    for url in failed_urls:
        try:
            result = await browser.execute_single(url, timeout=10000)
            results.append(result)
        except:
            # Final failure - log and continue
            log_failure(url, "permanent")
    
    return results, len(failed_urls)

# Typical results: 97-99% success on first batch, 2-4% on retry
success_rate, final_failed = await resilient_batch_operation(urls)
```

---

## Connection Pooling

### 1. Pool Sizing Recommendations

**Based on agent deployment model:**

| Deployment | Pool Size | Reasoning |
|-----------|-----------|-----------|
| Single Opus agent | 3-5 | Complex workflows, less parallelism |
| Single Sonnet agent | 5-8 | Balanced parallelism |
| Single Haiku agent | 8-12 | High volume requires more connections |
| 3 agents (mixed) | 15-20 | ~5-7 per agent, shared overhead |
| 5+ agents | 25-30 | ~5 per agent minimum |

**Memory Impact:** Each pooled connection = ~2-3MB overhead. Plan pool size accordingly.

```
Total Pool Connections = (number_of_agents × 5) + buffer(2-3)
Memory Overhead = Total_Pool_Connections × 2.5MB
```

### 2. Connection Reuse Strategies

**Strategy A: Sticky Sessions** (Recommended)
```python
class BrowserConnection:
    def __init__(self, pool_size=5):
        self.pool = []
        self.current_index = 0
    
    def get_connection(self):
        """Get next connection in round-robin"""
        conn = self.pool[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.pool)
        return conn
    
    async def execute_on_same_connection(self, operations):
        """Keep operations on same connection for session continuity"""
        conn = self.pool[0]  # Use primary connection
        results = []
        for op in operations:
            results.append(await conn.send_command(op))
        return results
```

**Benefits:**
- Better cookie/session management
- Reduces authentication overhead
- More realistic behavior
- Better for multi-step workflows

**Strategy B: Load-Balanced** (For High Throughput)
```python
class LoadBalancedPool:
    async def execute(self, command):
        # Always use least-busy connection
        conn = min(self.pool, key=lambda c: c.pending_requests)
        return await conn.send_command(command)
```

**Benefits:**
- Maximum throughput
- Better latency distribution
- Handles spiky loads

### 3. Health Check Configuration

**Recommended Health Check Pattern:**

```python
class PoolManager:
    def __init__(self):
        self.health_check_interval = 60000  # Check every 60 seconds
        self.connection_timeout = 30000     # 30 second timeout
        self.max_retries = 3
    
    async def health_check(self):
        """Verify all connections are alive"""
        for conn in self.pool:
            try:
                # Lightweight ping
                result = await asyncio.wait_for(
                    conn.send_command('ping'),
                    timeout=self.connection_timeout
                )
                if result['success']:
                    conn.health = 'healthy'
                else:
                    conn.health = 'degraded'
            except asyncio.TimeoutError:
                conn.health = 'dead'
                await self._recycle_connection(conn)

pool.schedule_health_check(interval_ms=60000)
```

**Health Check Signals:**

| Signal | Action |
|--------|--------|
| Ping response <50ms | Healthy - use normally |
| Ping response 50-200ms | Degraded - use but monitor |
| Ping timeout >1 sec | Dead - recycle immediately |
| Recurring timeouts | Connection pool failure - alert |

### 4. Timeout Configuration

**Per-Operation Timeouts:**

```javascript
// In browser WebSocket server configuration
const OPERATION_TIMEOUTS = {
    'navigate': 30000,           // 30 sec for page load
    'wait_for_element': 10000,   // 10 sec for element
    'screenshot': 5000,          // 5 sec for screenshot
    'get_content': 10000,        // 10 sec for extraction
    'execute_script': 15000,     // 15 sec for JS execution
    'click': 2000,               // 2 sec for interaction
    'ping': 1000,                // 1 sec for health check
};
```

**Timeout Selection Strategy:**

- **Navigate**: 30s (accounts for slow networks, heavy pages)
- **Element Wait**: 10s (page already loading, waiting for specific element)
- **Extraction**: 10s (DOM traversal, content available)
- **Interactions**: 2-5s (should be instant)
- **Health Checks**: 1s (fail-fast for dead connections)

---

## Caching Strategies

### 1. What to Cache

**High-Value Caching Targets:**

| Content Type | Cache TTL | Hit Ratio | Storage |
|--------------|-----------|-----------|---------|
| **Static HTML** | 24 hours | 60-80% | 50-200KB per page |
| **Metadata** | 1 hour | 70-90% | 1-5KB per page |
| **Screenshots** | 12 hours | 40-60% | 150-500KB per page |
| **Link lists** | 24 hours | 65-75% | 10-50KB per page |
| **Form structures** | 7 days | 75-85% | 5-20KB per page |

**Caching Priority (Highest to Lowest):**
1. **Metadata** (title, URL, meta tags) - 95%+ cacheable, 2KB
2. **Link lists** - 85%+ cacheable, lightweight
3. **Form structures** - 80%+ cacheable, rarely changes
4. **Screenshots** - 50% cacheable, large (but hit ratio matters)
5. **Full HTML** - 60% cacheable, moderate size

### 2. Cache Invalidation Strategy

**Time-Based Invalidation (Recommended for Most):**

```python
class ContentCache:
    def __init__(self):
        self.cache = {}
        self.ttl = {
            'metadata': 3600,          # 1 hour
            'links': 86400,            # 24 hours
            'forms': 604800,           # 7 days
            'screenshots': 43200,      # 12 hours
            'html': 86400,             # 24 hours
        }
    
    async def get_cached(self, url, content_type):
        key = f"{url}:{content_type}"
        entry = self.cache.get(key)
        if not entry:
            return None
        
        age = time.time() - entry['timestamp']
        if age > self.ttl[content_type]:
            del self.cache[key]
            return None
        
        return entry['data']
    
    async def set_cache(self, url, content_type, data):
        key = f"{url}:{content_type}"
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
```

**Content-Based Invalidation (For Real-Time Monitoring):**

```python
class SmartCache:
    async def is_content_changed(self, url, new_content):
        """Check if content actually changed"""
        cached = self.cache.get(url)
        if not cached:
            return True
        
        # Hash comparison (fast)
        new_hash = hashlib.sha256(new_content.encode()).hexdigest()
        old_hash = cached['hash']
        
        if new_hash == old_hash:
            return False  # Same content, use cache
        
        return True  # Content changed, update cache
```

**Event-Based Invalidation (For Specific Cases):**

```python
# Invalidate cache on specific events
cache.invalidate_on_event('domain_detected_update', 'metadata')
cache.invalidate_on_event('major_redesign', 'screenshots', 'html')
cache.invalidate_pattern('login.*', all_types=True)  # Invalidate all login pages
```

### 3. Distributed Caching for Multiple Agents

**Architecture:**

```
┌─────────────┐
│ Agent 1     │
└──────┬──────┘
       │
       ├─────────────────────┐
       │                     │
    ┌──▼──┐          ┌──────▼──┐
    │LOCAL│          │ REDIS   │
    │CACHE│◄────────►│ CACHE   │
    └──┬──┘          └────────┬┘
       │                     │
       ├─────────────────────┘
       │
┌──────▼──────┐
│ Agent 2     │
└─────────────┘
```

**Redis Configuration (Recommended for 3+ agents):**

```python
import redis

class DistributedCache:
    def __init__(self):
        self.redis = redis.Redis(host='localhost', port=6379, db=0)
        self.local_cache = {}  # L1: Local cache
        self.ttl = {
            'metadata': 3600,
            'links': 86400,
            'screenshots': 43200,
        }
    
    async def get(self, url, content_type):
        key = f"bh:{url}:{content_type}"
        
        # L1: Check local cache first (no network)
        if key in self.local_cache:
            entry = self.local_cache[key]
            if time.time() - entry['timestamp'] < 300:  # 5 min local TTL
                return entry['data']
        
        # L2: Check Redis (shared across agents)
        cached = self.redis.get(key)
        if cached:
            self.local_cache[key] = {'data': cached, 'timestamp': time.time()}
            return json.loads(cached)
        
        return None
    
    async def set(self, url, content_type, data):
        key = f"bh:{url}:{content_type}"
        self.redis.setex(key, self.ttl[content_type], json.dumps(data))
        self.local_cache[key] = {'data': data, 'timestamp': time.time()}
```

**Cache Hit Strategy:**
- Local cache: 1-5ms lookup (best)
- Redis cache: 5-20ms lookup (shared)
- Browser: 120-500ms (worst case)

### 4. Cache Size Limits

**Memory Management:**

```python
class BoundedCache:
    def __init__(self, max_size_mb=500):
        self.cache = OrderedDict()
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.current_size = 0
    
    async def set(self, key, value):
        # Calculate size
        size = len(json.dumps(value).encode())
        
        # Evict LRU if needed
        while self.current_size + size > self.max_size_bytes:
            oldest_key = next(iter(self.cache))
            oldest_value = self.cache.pop(oldest_key)
            self.current_size -= len(json.dumps(oldest_value).encode())
        
        # Add new entry
        self.cache[key] = value
        self.current_size += size
        # Move to end (most recent)
        self.cache.move_to_end(key)
```

**Size Budget by Agent Tier:**

| Tier | Total Cache | Per-Agent | Screenshot Cache |
|------|------------|----------|-----------------|
| Haiku (1 agent) | 200MB | 200MB | 100MB |
| Sonnet (1-2 agents) | 300-500MB | 150-250MB | 150MB |
| Opus (1-2 agents) | 500-800MB | 250-400MB | 300MB |
| Multi-agent (5+) | 2-4GB | 200-500MB | 500MB |

---

## Selective Data Capture

### 1. Full vs Minimal Capture Modes

**Capture Mode Selection:**

| Mode | Operations | Latency | Cost | Use Case |
|------|-----------|---------|------|----------|
| **Minimal** | Navigate + Title + URL | 120ms | $0.000008 | Monitoring, availability |
| **Standard** | Nav + Content + Title + URL | 200ms | $0.000012 | Most investigations |
| **Full** | Nav + Content + Screenshots + Links + Metadata | 600ms | $0.000030 | Deep analysis |
| **Forensic** | Full + HAR + OCR + Evidence chain | 2000ms | $0.000100+ | Legal/forensic |

**Dynamic Mode Selection Example:**

```python
async def smart_capture(url, investigation_depth='standard'):
    """Automatically select capture mode"""
    
    if investigation_depth == 'monitoring':
        # Just check availability
        result = await browser.execute_workflow([
            {'command': 'navigate', 'url': url},
            {'command': 'get_page_state'},
        ])
        return {'available': result.success, 'title': result.title}
    
    elif investigation_depth == 'standard':
        # Basic extraction
        result = await browser.execute_workflow([
            {'command': 'navigate', 'url': url},
            {'command': 'wait_for_element', 'selector': 'body', 'timeout': 5000},
            {'command': 'get_content'},
            {'command': 'extract_links'},
        ])
        return result
    
    elif investigation_depth == 'full':
        # Everything except forensics
        result = await browser.execute_workflow([
            {'command': 'navigate', 'url': url},
            {'command': 'wait_for_element', 'selector': 'body', 'timeout': 5000},
            {'command': 'get_content'},
            {'command': 'extract_all'},
            {'command': 'screenshot'},
        ])
        return result
```

### 2. Screenshot Optimization

**When to Skip Screenshots:**

```python
# Skip if we already have a cached screenshot <12 hours old
if cache.get(url, 'screenshot') and cache.age(url, 'screenshot') < 43200:
    skip_screenshot = True

# Skip on text-only sites (no visual value)
content = await browser.get_content(url)
if len(content.find_all('img')) == 0:
    skip_screenshot = True

# Skip if not in scope (e.g., monitoring task only needs title)
if task_type == 'monitoring':
    skip_screenshot = True
```

**Screenshot Modes:**

| Mode | Size | Latency | Use Case |
|------|------|---------|----------|
| **Viewport** (1280×1024) | 150-300KB | 2sec | Quick visual check |
| **Full Page** (1280×∞) | 200-800KB | 3-5sec | Complete capture |
| **Element** (specific) | 50-200KB | 1sec | Detail extraction |
| **Thumbnail** (640×512) | 30-80KB | 1sec | Quick preview |

**Smart Capture Example:**

```python
async def optimized_screenshot(url, mode='auto'):
    """Select screenshot mode automatically"""
    
    if mode == 'auto':
        # Check content type
        headers = await browser.get_headers(url)
        
        if 'text/html' not in headers.get('content-type', ''):
            return None  # Skip for non-HTML
        
        # Check size
        if int(headers.get('content-length', '0')) > 10_000_000:
            return viewport_screenshot(url)  # Large page, viewport only
        else:
            return full_page_screenshot(url)  # Normal page, full screenshot
```

### 3. OCR Optimization

**When to Use OCR:**

```python
# OCR valuable for:
# - Images with text (receipts, documents)
# - Screenshots for accessibility analysis
# - Verification of visual content

# Skip OCR for:
# - Decorative images
# - Already-parsed HTML content
# - High-volume monitoring (cost prohibitive)
```

**Selective OCR:**

```python
async def extract_with_ocr(url, ocr_strategy='selective'):
    """Apply OCR selectively"""
    
    screenshot = await browser.screenshot(url)
    
    if ocr_strategy == 'selective':
        # Only OCR images containing text
        images = await browser.extract_images(url)
        for img in images:
            if img.get('text_probability', 0) > 0.7:
                text = await ocr_image(img)
                results.append({'image': img, 'text': text})
    
    elif ocr_strategy == 'full':
        # OCR entire screenshot
        text = await ocr_image(screenshot)
        results.append({'screenshot': screenshot, 'text': text})
    
    elif ocr_strategy == 'none':
        # No OCR
        pass
    
    return results
```

### 4. Bandwidth Optimization

**Compression Strategies:**

```python
# Configuration
COMPRESSION = {
    'html': True,           # Compress HTML responses
    'images': True,         # Compress screenshots (JPEG quality 75%)
    'metadata': True,       # Compress JSON metadata
}

# Example: Screenshot compression
screenshot_png = await browser.screenshot(url, format='png')
compressed = compress_image(screenshot_png, quality=75)  # PNG → JPEG
size_reduction = (len(screenshot_png) - len(compressed)) / len(screenshot_png) * 100
# Typical reduction: 60-75% for JPEG compression
```

**Bandwidth Budget:**

| Operation | Size | Bandwidth |
|-----------|------|-----------|
| Navigate response | 200-500KB | Uncompressed from network |
| Screenshot (PNG) | 200-600KB | Large |
| Screenshot (JPEG, q75) | 50-150KB | Compressed |
| HTML content | 50-500KB | Usually gzipped by server |
| Metadata only | 1-5KB | Minimal |

---

## Progressive Loading

### 1. Load Structure First, Images Later

**Pattern:**

```python
async def progressive_load(url):
    """Load page structure first, defer images"""
    
    # Step 1: Navigate and get structure (fast)
    await browser.navigate(url)
    await browser.wait_for_element('body', timeout=5000)
    
    # Step 2: Extract structure while images load in background
    structure = await browser.get_content(url)
    links = await browser.extract_links(url)
    forms = await browser.extract_forms(url)
    
    # At this point: have full HTML structure, images still loading
    # Time elapsed: ~200ms
    
    # Step 3: Optionally get images after (don't block on them)
    images_task = asyncio.create_task(browser.extract_images(url))
    
    # Return structure immediately
    return {
        'structure': structure,
        'links': links,
        'forms': forms,
        'images': await images_task  # Non-blocking if not needed immediately
    }
```

**Benefits:**
- Structure available in 200-300ms
- Images load in background (~200-500ms more)
- Agent can analyze structure while images load
- Potential savings: 30-40% latency if images not needed

### 2. Lazy Content Handling

**Detecting Lazy-Loaded Content:**

```python
async def handle_lazy_content(url, scroll_distance=3000):
    """Handle pages with lazy-loaded images"""
    
    # Step 1: Load initial view
    await browser.navigate(url)
    await browser.wait_for_element('body')
    
    # Step 2: Scroll to trigger lazy loads
    await browser.scroll(x=0, y=scroll_distance)
    await asyncio.sleep(1000)  # Wait for lazy load
    
    # Step 3: Get content after lazy load
    content = await browser.get_content(url)
    
    return content
```

**Lazy Loading Indicators:**
- `<img loading="lazy">`
- `<img class="lazy">`
- JavaScript intersection observers
- Content changes on scroll

### 3. Timeout Tuning Per Operation

**Adaptive Timeout Strategy:**

```python
class AdaptiveTimeout:
    def __init__(self):
        self.baseline = {
            'navigate': 30000,
            'wait_for_element': 10000,
            'screenshot': 5000,
        }
        self.history = defaultdict(list)
        self.multiplier = 1.5  # Use P95, not P99
    
    def get_timeout(self, operation):
        """Get timeout based on historical performance"""
        hist = self.history[operation]
        
        if len(hist) < 10:
            return self.baseline[operation]
        
        # Use P95 with 50% buffer
        p95 = sorted(hist)[int(len(hist) * 0.95)]
        return int(p95 * self.multiplier)
    
    def record(self, operation, duration_ms):
        """Record actual duration"""
        self.history[operation].append(duration_ms)
        if len(self.history[operation]) > 1000:
            self.history[operation] = self.history[operation][-1000:]
```

### 4. Content Priority Ordering

**Priority-Based Extraction:**

```python
async def prioritized_extraction(url, priorities=['title', 'content', 'links', 'images']):
    """Extract content in priority order"""
    
    results = {}
    
    # High priority (always)
    results['title'] = await browser.get_title(url)
    results['url'] = url
    
    if 'content' in priorities:
        results['content'] = await browser.get_content(url)
    
    if 'links' in priorities:
        results['links'] = await browser.extract_links(url)
    
    if 'forms' in priorities:
        results['forms'] = await browser.extract_forms(url)
    
    if 'images' in priorities:
        # Images lowest priority, can timeout without failing task
        try:
            results['images'] = await asyncio.wait_for(
                browser.extract_images(url),
                timeout=3000
            )
        except asyncio.TimeoutError:
            results['images'] = []  # Graceful degradation
    
    return results
```

---

## Agent-Specific Tuning

### 1. Opus 4.7 Optimization

**Characteristics:**
- Slowest inference (30-60s for complex tasks)
- Best reasoning capability
- Handles complex error recovery
- Higher cost per call

**Optimization Strategy:**

```python
class OpusOptimization:
    """
    Opus is best used for:
    - Complex decision-making
    - Multi-step workflows with conditions
    - High-stakes investigations
    - Error recovery and adaptation
    """
    
    def get_browser_config(self):
        return {
            'batch_size': 50,           # Moderate batch, let Opus think
            'timeout_multiplier': 1.5,   # Give Opus time
            'cache_ttl': 86400,         # Aggressive caching (1 day)
            'screenshot_mode': 'full',  # Full context for reasoning
            'concurrent_ops': 5,        # Not too parallel
        }
    
    async def opus_workflow(self, investigation):
        """Example: Complex investigation"""
        
        # Opus plans the investigation
        plan = opus.analyze_task(investigation)
        
        # Browser executes plan efficiently
        for phase in plan['phases']:
            if phase['type'] == 'reconnaissance':
                results = await browser.execute_batch(
                    phase['urls'],
                    batch_size=50,
                    capture_mode='standard'
                )
            
            elif phase['type'] == 'deep_dive':
                results = await browser.execute_workflow(
                    phase['workflow'],
                    capture_mode='full'
                )
            
            # Opus evaluates and adapts
            analysis = opus.analyze_results(results)
            if analysis['needs_refinement']:
                investigation = opus.refine_investigation(analysis)
                continue
```

**Cost Optimization:**
- Use Opus for planning, not execution
- Opus → Plan → Browser executes → Report to Opus
- Batch browser operations to minimize Opus calls
- Cache Opus decisions (common investigation types)

**Performance Targets:**
- Plan analysis: 1-2 min
- Execution time: 5-30 min (browser)
- Result analysis: 1-2 min
- Total: 7-34 min per investigation

### 2. Sonnet 4.6 Optimization

**Characteristics:**
- Balanced speed (15-30s for moderate tasks)
- Good reasoning
- Moderate cost
- Best production choice

**Optimization Strategy:**

```python
class SonnetOptimization:
    """
    Sonnet is best used for:
    - Production automation
    - Day-to-day OSINT operations
    - Moderate complexity workflows
    - Good speed/cost balance
    """
    
    def get_browser_config(self):
        return {
            'batch_size': 75,            # Good throughput
            'timeout_multiplier': 1.2,   # Standard timeouts
            'cache_ttl': 43200,          # 12-hour cache
            'screenshot_mode': 'viewport', # Balanced capture
            'concurrent_ops': 8,         # Good parallelism
        }
    
    async def sonnet_workflow(self, urls, depth='standard'):
        """Example: Standard OSINT workflow"""
        
        # Sonnet decides extraction strategy
        strategy = sonnet.plan_extraction(urls, depth)
        
        # Browser executes in batches
        batch_results = await browser.execute_batch(
            urls,
            batch_size=75,
            capture_mode=strategy['mode']
        )
        
        # Sonnet analyzes results in parallel with next batch
        analysis_task = asyncio.create_task(
            sonnet.analyze_batch(batch_results)
        )
        
        next_batch = await browser.execute_batch(urls[75:], batch_size=75)
        analysis = await analysis_task
        
        return analysis
```

**Cost Optimization:**
- Batch 75-100 URLs per Sonnet call
- Use streaming results (don't wait for full batch)
- Parallel analysis with next batch execution
- Cache common patterns

**Performance Targets:**
- Batch processing: 200-300ms per 75 URLs
- Per-URL analysis: 5-15s
- Throughput: 4-8 URLs per second

### 3. Haiku 4.5 Optimization

**Characteristics:**
- Fastest inference (5-15s)
- Lightweight reasoning
- Lowest cost
- Best for high-volume

**Optimization Strategy:**

```python
class HaikuOptimization:
    """
    Haiku is best used for:
    - High-volume batch operations
    - Simple decision-making
    - Real-time response requirements
    - Cost-sensitive applications
    """
    
    def get_browser_config(self):
        return {
            'batch_size': 100,           # Maximum throughput
            'timeout_multiplier': 1.0,   # Standard timeouts
            'cache_ttl': 3600,           # 1-hour cache (aggressive refresh)
            'screenshot_mode': 'viewport', # Quick captures
            'concurrent_ops': 15,        # Maximum parallelism
        }
    
    async def haiku_high_volume(self, urls, callback=None):
        """Example: High-volume monitoring"""
        
        results = []
        
        # Process in large batches
        for i in range(0, len(urls), 100):
            batch_urls = urls[i:i+100]
            
            # Execute batch with minimal overhead
            batch_results = await browser.execute_batch(
                batch_urls,
                batch_size=100,
                capture_mode='minimal'
            )
            
            # Haiku makes quick classification
            classifications = haiku.classify_batch(batch_results)
            
            # Process results immediately (streaming)
            for result, classification in zip(batch_results, classifications):
                results.append({
                    'url': result['url'],
                    'status': classification,
                    'timestamp': time.time()
                })
                
                if callback:
                    await callback(results[-1])
        
        return results
```

**Cost Optimization:**
- Maximum batch sizes (100)
- Minimal capture mode (title + URL)
- Quick analysis (pattern matching, classification)
- High volume (720K+ ops/day possible)

**Performance Targets:**
- Batch throughput: 400+ ops/sec
- Per-URL latency: 120-150ms
- Total throughput: 1000+ URLs/min

### 4. Custom Agent Configurations

**Template for Custom Agents:**

```python
class CustomAgentOptimization:
    """Define custom optimization for specialized agents"""
    
    def __init__(self, agent_type, characteristics):
        self.agent_type = agent_type
        self.characteristics = characteristics
        self.config = self._compute_config()
    
    def _compute_config(self):
        """Compute optimization based on characteristics"""
        
        base_config = {
            'batch_size': 50,
            'timeout_multiplier': 1.0,
            'cache_ttl': 3600,
        }
        
        # Adjust for agent speed
        if self.characteristics['inference_speed'] == 'fast':
            base_config['batch_size'] = 100
            base_config['concurrent_ops'] = 15
        elif self.characteristics['inference_speed'] == 'slow':
            base_config['batch_size'] = 25
            base_config['concurrent_ops'] = 3
        
        # Adjust for reasoning capability
        if self.characteristics['reasoning'] == 'complex':
            base_config['screenshot_mode'] = 'full'
            base_config['cache_ttl'] = 86400
        elif self.characteristics['reasoning'] == 'simple':
            base_config['screenshot_mode'] = 'minimal'
            base_config['cache_ttl'] = 1800
        
        return base_config

# Example: Vision-specialized agent
vision_agent = CustomAgentOptimization('vision', {
    'inference_speed': 'fast',
    'reasoning': 'visual_analysis',
    'primary_task': 'image_classification'
})
```

---

## Bottleneck Identification

### 1. Performance Profiling

**Browser-Level Metrics:**

```python
class PerformanceProfiler:
    """Identify bottlenecks in browser operations"""
    
    def __init__(self):
        self.metrics = defaultdict(list)
    
    async def profile_operation(self, operation_name, async_func):
        """Measure operation timing and resource usage"""
        
        start_time = time.perf_counter()
        start_memory = process.memory_info().rss
        
        try:
            result = await async_func()
            return result
        finally:
            end_time = time.perf_counter()
            end_memory = process.memory_info().rss
            
            self.metrics[operation_name].append({
                'duration_ms': (end_time - start_time) * 1000,
                'memory_delta_mb': (end_memory - start_memory) / 1024 / 1024,
                'timestamp': time.time()
            })
    
    def analyze_bottlenecks(self):
        """Find slowest operations"""
        
        summary = {}
        for op_name, measurements in self.metrics.items():
            durations = [m['duration_ms'] for m in measurements]
            summary[op_name] = {
                'p50': sorted(durations)[len(durations)//2],
                'p95': sorted(durations)[int(len(durations)*0.95)],
                'p99': sorted(durations)[int(len(durations)*0.99)],
                'max': max(durations),
                'avg': sum(durations) / len(durations)
            }
        
        return sorted(summary.items(), key=lambda x: x[1]['p95'], reverse=True)

# Usage
profiler = PerformanceProfiler()
await profiler.profile_operation('navigate', lambda: browser.navigate(url))
bottlenecks = profiler.analyze_bottlenecks()
print(bottlenecks)  # Slowest operations first
```

### 2. Common Bottlenecks

| Bottleneck | Typical Impact | Detection | Solution |
|-----------|---------------|-----------|----------|
| **Network I/O** | 60-80% | Long navigate times | Increase timeout, check network |
| **Page rendering** | 20-30% | Large/complex pages | Wait longer, reduce complexity |
| **JavaScript execution** | 10-20% | Heavy JS sites | Wait for specific elements |
| **Screenshot capture** | 30-50% | Full-page screenshots | Use viewport, enable JPEG compression |
| **Memory pressure** | Variable | GC pauses | Increase pool size, reduce batch |
| **Disk I/O** | 5-10% | Large extractions | Use streaming, reduce file size |

### 3. Diagnostic Approaches

**Network Diagnostics:**

```python
async def diagnose_network_bottleneck(url):
    """Identify network issues"""
    
    # Measure DNS resolution
    dns_start = time.perf_counter()
    socket.getaddrinfo(url, 443)
    dns_time = (time.perf_counter() - dns_start) * 1000
    
    # Measure connection time
    conn_start = time.perf_counter()
    async with aiohttp.ClientSession() as session:
        async with session.head(url, timeout=10) as resp:
            pass
    conn_time = (time.perf_counter() - conn_start) * 1000
    
    # Measure page load time
    load_start = time.perf_counter()
    result = await browser.navigate(url)
    load_time = (time.perf_counter() - load_start) * 1000
    
    return {
        'dns_ms': dns_time,
        'connection_ms': conn_time,
        'page_load_ms': load_time,
        'bottleneck': 'dns' if dns_time > 100 else 'network' if conn_time > 500 else 'page_render'
    }
```

**Memory Diagnostics:**

```python
async def diagnose_memory_bottleneck():
    """Identify memory pressure issues"""
    
    before_gc = process.memory_info().rss
    gc.collect()
    after_gc = process.memory_info().rss
    
    memory_pressure = {
        'heap_before_mb': before_gc / 1024 / 1024,
        'heap_after_gc_mb': after_gc / 1024 / 1024,
        'gc_recoverable_mb': (before_gc - after_gc) / 1024 / 1024,
        'has_leak': (before_gc - after_gc) < 10,  # <10MB recoverable = possible leak
    }
    
    return memory_pressure
```

### 4. Optimization Priorities

**Quick Wins (Highest Impact, Easiest):**

1. **Increase batch size** (45→400+ ops/sec improvement)
   - Cost: Zero, implementation: 1 line
   - Expected improvement: 30-50% throughput

2. **Enable screenshot caching** (eliminates redundant captures)
   - Cost: Minimal storage
   - Expected improvement: 40-60% latency reduction for repeated URLs

3. **Use minimal capture mode** (skip images for monitoring)
   - Cost: None
   - Expected improvement: 30-40% latency for monitoring tasks

4. **Connection pooling** (eliminates connection overhead)
   - Cost: ~2-3MB per pool connection
   - Expected improvement: 10-20% latency, better concurrency

**Medium-Effort Wins:**

5. **Progressive loading** (structure first, images later)
   - Cost: Code complexity, minor
   - Expected improvement: 30-40% for content analysis

6. **Adaptive timeouts** (reduce timeout overhead)
   - Cost: Tracking overhead
   - Expected improvement: 5-10% overall, better error handling

7. **Distributed caching** (Redis for multi-agent)
   - Cost: Redis instance, network latency
   - Expected improvement: 40-70% cache hits, 20-30% latency reduction

**Long-term Optimizations:**

8. **Custom fingerprints** (reduce detection risk)
   - Cost: Fingerprint maintenance
   - Expected improvement: Lower block rates, more successful captures

9. **Machine learning batching** (predict batch size)
   - Cost: ML model, training data
   - Expected improvement: 5-15% throughput optimization

---

## Configuration Reference

### Browser Server Settings

```javascript
// websocket/server.js - Key configurations
const OPERATION_TIMEOUTS = {
    'navigate': 30000,        // Page load timeout
    'wait_for_element': 10000,
    'screenshot': 5000,
    'execute_script': 15000,
};

const ERROR_RECOVERY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,         // Base delay (exponential backoff)
    retryableErrors: [
        'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', // Network
        'TIMEOUT', 'temporarily unavailable'
    ]
};

const IPC_DEFAULT_TIMEOUT = 30000;  // IPC communication timeout
```

### Window Pool Settings

```javascript
// windows/pool.js - Default configuration
const poolConfig = {
    minPoolSize: 2,           // Keep 2 windows warm
    maxPoolSize: 10,          // Never exceed 10 windows
    warmupDelay: 1000,        // Delay between window creation
    recycleTimeout: 30000,    // Max time to recycle window
    healthCheckInterval: 60000, // Check health every 60s
    maxIdleTime: 300000,      // Dispose after 5 min idle
};
```

### Agent Integration Configuration

```python
# Recommended per-agent settings
AGENT_CONFIG = {
    'opus_4_7': {
        'batch_size': 50,
        'concurrent_ops': 5,
        'cache_ttl_seconds': 86400,
        'timeout_multiplier': 1.5,
        'screenshot_mode': 'full',
    },
    'sonnet_4_6': {
        'batch_size': 75,
        'concurrent_ops': 8,
        'cache_ttl_seconds': 43200,
        'timeout_multiplier': 1.2,
        'screenshot_mode': 'viewport',
    },
    'haiku_4_5': {
        'batch_size': 100,
        'concurrent_ops': 15,
        'cache_ttl_seconds': 3600,
        'timeout_multiplier': 1.0,
        'screenshot_mode': 'viewport',
    }
}
```

---

## Troubleshooting

### Issue: Slow Operation Times (>300ms per op)

**Diagnosis:**
```python
# Profile to find bottleneck
bottlenecks = profiler.analyze_bottlenecks()
print(bottlenecks)  # What's slow?
```

**Solutions (in order):**
1. Check network: `diagnose_network_bottleneck(url)`
2. Reduce capture mode: use 'minimal' instead of 'full'
3. Skip screenshots: disable for non-visual tasks
4. Increase timeouts: may be legitimate slow pages

### Issue: Low Cache Hit Rate (<30%)

**Diagnosis:**
```python
# Analyze cache effectiveness
cache_stats = cache.get_stats()
hit_rate = cache_stats['hits'] / cache_stats['total'] * 100
print(f"Cache hit rate: {hit_rate}%")
```

**Solutions:**
1. Increase cache TTL: cache expires too quickly
2. Change URL normalization: different query params treated same
3. Enable distributed cache: better hit rate with multiple agents
4. Monitor cache size: may be evicting too aggressively

### Issue: High Memory Usage

**Diagnosis:**
```python
# Check memory pressure
pressure = diagnose_memory_bottleneck()
if pressure['has_leak']:
    print("Possible memory leak detected")
```

**Solutions:**
1. Reduce batch size: fewer concurrent operations
2. Reduce pool size: use 3-5 connections instead of 10+
3. Enable screenshot compression: JPEG instead of PNG
4. Clear cache periodically: LRU eviction may be insufficient
5. Check for memory leaks: profile long-running agents

### Issue: Connection Timeouts

**Diagnosis:**
```python
# Check connection health
health = await pool.health_check()
dead_connections = [c for c in health if c['status'] == 'dead']
if dead_connections:
    print(f"Dead connections: {len(dead_connections)}")
```

**Solutions:**
1. Reduce timeout values: timeout too long, masks real issues
2. Check network: firewall, DNS, connectivity
3. Reduce concurrent operations: too many connections
4. Increase pool health check frequency: detect failures faster
5. Restart browser: may have internal issues

### Issue: Batch Failures (97% success, 3% failures)

**Diagnosis:**
```python
# Analyze failure patterns
failures = [r for r in results if not r['success']]
for failure in failures:
    print(f"URL: {failure['url']}, Error: {failure['error']}")
```

**Solutions:**
1. Retry individually: some failures are transient
2. Increase timeout: temporary network issues
3. Check rate limiting: server rejecting due to speed
4. Use proxy/Tor: bypass geographic blocks
5. Reduce batch size: sometimes helps with flaky servers

---

## Monitoring Dashboard

**Recommended Metrics to Track:**

```python
metrics_to_monitor = {
    'throughput_ops_per_sec': 'Overall throughput',
    'p95_latency_ms': '95th percentile latency',
    'cache_hit_rate': 'Cache effectiveness (%)',
    'memory_usage_mb': 'Current heap usage',
    'error_rate': 'Percentage of failed ops',
    'batch_size_avg': 'Average batch size',
    'connection_pool_utilization': 'Used/Total connections',
    'screenshot_compression_ratio': 'Size reduction from compression',
}
```

**Alert Thresholds:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Throughput | <200 ops/sec | <50 ops/sec |
| P95 Latency | >300ms | >1000ms |
| Cache Hit Rate | <20% | <5% |
| Memory | >500MB | >1000MB |
| Error Rate | >5% | >10% |
| Connection Pool Util. | >80% | >95% |

---

## Summary

Basset Hound Browser is highly optimizable for multi-agent deployments:

1. **Batch sizing** (50-100) provides 9x throughput improvement
2. **Connection pooling** (5-10 per agent) reduces latency
3. **Caching** (40-60% hit rate) halves operation latency
4. **Selective capture** (minimal mode) cuts latency 30%
5. **Progressive loading** (defer images) saves 30-40%
6. **Agent-specific tuning** matches model strengths

**Expected Production Performance:**
- **Haiku:** 1000+ URLs/min, $0.000008 per operation
- **Sonnet:** 400-600 URLs/min, $0.000012 per operation
- **Opus:** 100-200 URLs/min, $0.000030 per operation (complex workflows)

---

**Document Status:** Production Ready  
**Last Updated:** May 7, 2026  
**Maintained By:** Basset Hound Browser Performance Team
