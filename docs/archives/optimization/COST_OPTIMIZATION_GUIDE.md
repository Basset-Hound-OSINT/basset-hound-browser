# Cost Optimization Implementation Guide

## Basset Hound Browser - palletai Integration

This guide provides practical implementation patterns for cost-optimized palletai agents using Basset Hound Browser.

---

## Table of Contents

1. [Workflow Patterns](#workflow-patterns)
2. [Batch Operation Strategies](#batch-operation-strategies)
3. [Resource Optimization](#resource-optimization)
4. [Monitoring and Cost Tracking](#monitoring-and-cost-tracking)
5. [Implementation Examples](#implementation-examples)
6. [Troubleshooting](#troubleshooting)

---

## Workflow Patterns

### Pattern 1: Minimal Workflow (120ms per operation)

**Best for:** Monitoring, availability checks, baseline reconnaissance

**Operations:**
1. Navigate to URL
2. Get Title
3. Get URL

**Execution:**
```javascript
async function minimalWorkflow(url) {
  const startTime = performance.now();
  
  // 1. Navigate (91ms)
  const navResult = await client.send('navigate', { url });
  if (!navResult.success) throw new Error(`Navigation failed: ${url}`);
  
  // 2. Get Title (17ms)
  const titleResult = await client.send('get_title');
  
  // 3. Get URL (10ms)
  const urlResult = await client.send('get_url');
  
  const duration = performance.now() - startTime;
  
  return {
    url: urlResult.url,
    title: titleResult.title,
    available: true,
    duration
  };
}
```

**Cost:** $0.000019 per operation at scale
**Throughput:** 455 ops/minute (1 at a time), 24K+ ops/minute in batch
**Memory:** 6.3MB per operation

---

### Pattern 2: Standard Workflow (140ms per operation)

**Best for:** Content analysis, investigations, data extraction

**Operations:**
1. Navigate
2. Get Content
3. Get Title
4. Get URL

**Execution:**
```javascript
async function standardWorkflow(url) {
  const startTime = performance.now();
  
  // 1. Navigate
  const navResult = await client.send('navigate', { url });
  if (!navResult.success) throw new Error(`Navigation failed: ${url}`);
  
  // 2. Get Content (64ms)
  const contentResult = await client.send('get_content');
  
  // 3. Get metadata in parallel
  const [titleResult, urlResult] = await Promise.all([
    client.send('get_title'),
    client.send('get_url')
  ]);
  
  const duration = performance.now() - startTime;
  
  return {
    url: urlResult.url,
    title: titleResult.title,
    content: contentResult.content,
    contentLength: contentResult.contentLength,
    duration
  };
}
```

**Cost:** $0.000022 per operation at scale
**Throughput:** 400 ops/minute (1 at a time)
**Memory:** 6.5MB per operation

---

### Pattern 3: Hybrid Workflow (Two-Phase)

**Best for:** Large-scale operations with selective deep analysis

**Phase 1:** Minimal screening (high volume, low cost)
**Phase 2:** Selective enhancement (based on Phase 1 results)

**Execution:**
```javascript
async function hybridWorkflow(urls, threshold = 0.7) {
  // Phase 1: Minimal screening of all URLs
  console.log(`Phase 1: Screening ${urls.length} URLs...`);
  const screeningResults = await batchMinimalWorkflow(urls, { batchSize: 100 });
  
  // Phase 2: Deep analysis of interesting results
  const interestingUrls = screeningResults
    .filter(r => calculateInterestScore(r) > threshold)
    .map(r => r.url);
  
  console.log(`Phase 2: Deep analysis of ${interestingUrls.length} URLs...`);
  const detailedResults = await batchStandardWorkflow(interestingUrls, { batchSize: 50 });
  
  // Combine results
  const detailedMap = new Map(detailedResults.map(r => [r.url, r]));
  const finalResults = screeningResults.map(r => 
    detailedMap.has(r.url) ? detailedMap.get(r.url) : r
  );
  
  return finalResults;
}

function calculateInterestScore(result) {
  let score = 0;
  
  // Title quality indicators
  if (result.title && result.title.length > 10) score += 0.3;
  
  // URL path complexity
  if (result.url && result.url.includes('/')) score += 0.2;
  
  // Content availability
  if (result.content) score += 0.5;
  
  return score;
}
```

**Cost Savings:** 60-80% reduction compared to full analysis on all URLs
**Throughput:** Phase 1: 24K ops/min, Phase 2: 12K ops/min
**Memory:** Efficient - only deep analysis on selected URLs

---

### Pattern 4: Monitoring Workflow (Recurring Checks)

**Best for:** Continuous monitoring, change detection, alert systems

**Execution:**
```javascript
async function monitoringWorkflow(urls, interval = 3600) {
  const cache = new Map(); // Cache previous results
  const changes = [];
  
  setInterval(async () => {
    const results = await batchMinimalWorkflow(urls, { batchSize: 50 });
    
    for (const result of results) {
      const cached = cache.get(result.url);
      
      if (cached && cached.title !== result.title) {
        changes.push({
          url: result.url,
          change: 'title',
          previous: cached.title,
          current: result.title,
          timestamp: new Date()
        });
      }
      
      if (cached && cached.available !== result.available) {
        changes.push({
          url: result.url,
          change: 'availability',
          previous: cached.available,
          current: result.available,
          timestamp: new Date()
        });
      }
      
      cache.set(result.url, result);
    }
    
    if (changes.length > 0) {
      await alertSystem.sendAlerts(changes);
    }
  }, interval);
}
```

**Cost:** Minimal - only minimal workflow operations
**Throughput:** 24K+ ops/minute with batching
**Perfect for:** 24/7 monitoring with minimal cost

---

## Batch Operation Strategies

### Strategy 1: Concurrent Batching

**Optimal for:** Moderate to high volume (100-1000 ops/day)

```javascript
async function batchMinimalWorkflow(urls, { batchSize = 50 } = {}) {
  const results = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Execute all operations in batch concurrently
    const batchResults = await Promise.all(
      batch.map(url => minimalWorkflow(url).catch(err => ({
        url,
        success: false,
        error: err.message
      })))
    );
    
    results.push(...batchResults);
    
    // Log progress
    console.log(`Processed ${Math.min(i + batchSize, urls.length)}/${urls.length} URLs`);
  }
  
  return results;
}
```

**Performance:**
- Batch size 50: 203 ops/second
- Batch size 100: 407 ops/second

**Recommendation:** Use batch size 50 for balanced throughput/latency

---

### Strategy 2: Queued Batching with Priority

**Optimal for:** Mixed priority operations (urgent + background)

```javascript
class PriorityBatchQueue {
  constructor(client, { highPriorityBatchSize = 10, normalBatchSize = 50 } = {}) {
    this.client = client;
    this.highPriorityQueue = [];
    this.normalQueue = [];
    this.highPriorityBatchSize = highPriorityBatchSize;
    this.normalBatchSize = normalBatchSize;
    this.processing = false;
  }
  
  addHighPriority(urls) {
    this.highPriorityQueue.push(...urls.map(url => ({ url, priority: 'high' })));
    this.process();
  }
  
  addNormal(urls) {
    this.normalQueue.push(...urls.map(url => ({ url, priority: 'normal' })));
    this.process();
  }
  
  async process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.highPriorityQueue.length > 0 || this.normalQueue.length > 0) {
      // Process high priority first
      if (this.highPriorityQueue.length > 0) {
        const batch = this.highPriorityQueue.splice(0, this.highPriorityBatchSize);
        await this.processBatch(batch, 'high');
      }
      
      // Then process normal
      if (this.normalQueue.length > 0) {
        const batch = this.normalQueue.splice(0, this.normalBatchSize);
        await this.processBatch(batch, 'normal');
      }
    }
    
    this.processing = false;
  }
  
  async processBatch(items, priority) {
    const urls = items.map(item => item.url);
    console.log(`Processing ${priority} batch: ${urls.length} items`);
    
    const results = await Promise.all(
      urls.map(url => minimalWorkflow(url).catch(err => ({ url, error: err })))
    );
    
    return results;
  }
}
```

**Use Case:** Mix urgent agent tasks with background monitoring

---

### Strategy 3: Adaptive Batching Based on System Load

**Optimal for:** Dynamic environments with variable load

```javascript
class AdaptiveBatchExecutor {
  constructor(client, { minBatch = 10, maxBatch = 100, cpuThreshold = 0.8 } = {}) {
    this.client = client;
    this.minBatch = minBatch;
    this.maxBatch = maxBatch;
    this.cpuThreshold = cpuThreshold;
  }
  
  async determineBatchSize() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length; // Normalized CPU usage
    
    if (cpuUsage > this.cpuThreshold) {
      // High load: use smaller batches
      return Math.max(this.minBatch, Math.floor(this.maxBatch * 0.3));
    } else if (cpuUsage > this.cpuThreshold * 0.7) {
      // Moderate load: medium batches
      return Math.floor((this.minBatch + this.maxBatch) / 2);
    } else {
      // Low load: large batches
      return this.maxBatch;
    }
  }
  
  async execute(urls) {
    const results = [];
    let offset = 0;
    
    while (offset < urls.length) {
      const batchSize = await this.determineBatchSize();
      const batch = urls.slice(offset, offset + batchSize);
      
      console.log(`Executing batch of ${batch.length} (adaptive size)`);
      
      const batchResults = await Promise.all(
        batch.map(url => minimalWorkflow(url).catch(err => ({ url, error: err })))
      );
      
      results.push(...batchResults);
      offset += batchSize;
    }
    
    return results;
  }
}
```

---

## Resource Optimization

### Memory Optimization

**Current baseline:** 6.3MB per operation

```javascript
// Optimization 1: Reuse client connection
const client = new WebSocketClient();
await client.connect();

// Good: Process many operations on same connection
for (const url of urls) {
  await minimalWorkflow(url);
}

// Bad: Create new connection per operation (wasteful)
for (const url of urls) {
  const newClient = new WebSocketClient();
  await newClient.connect();
  await minimalWorkflow(url);
  await newClient.disconnect();
}
```

### CPU Optimization

**Identified bottleneck:** Navigation operations (91ms, 35% CPU)

```javascript
// Optimization 1: Reduce number of navigations
async function efficientWorkflow(urls) {
  // Bad: Navigate to every URL
  for (const url of urls) {
    await client.send('navigate', { url });
    await client.send('get_title');
  }
  
  // Good: Use navigation only when necessary
  const urlsByDomain = groupBy(urls, 'domain');
  const results = [];
  
  for (const [domain, domainUrls] of urlsByDomain) {
    // Navigate to domain once
    await client.send('navigate', { url: `https://${domain}` });
    
    // Get title for main domain
    results.push({
      url: `https://${domain}`,
      title: await client.send('get_title')
    });
    
    // For subpaths, use extraction without navigation
    // (In production, this might require caching or clever DOM manipulation)
  }
}
```

### Network Optimization

**Current baseline:** ~1KB per operation

```javascript
// Optimization 1: Selective content extraction
async function networkOptimizedWorkflow(url) {
  // Only extract HTML if needed
  const title = await client.send('get_title');
  const isInteresting = title.includes('important_keyword');
  
  if (isInteresting) {
    // Only fetch full content for interesting pages
    const content = await client.send('get_content');
    return { url, title, content };
  } else {
    // Skip content for uninteresting pages
    return { url, title };
  }
}

// Optimization 2: Compression in transit
// (If server supports, enable compression on WebSocket)
const client = new WebSocketClient({
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    }
  }
});
```

---

## Monitoring and Cost Tracking

### Metrics Collection

```javascript
class CostTracker {
  constructor() {
    this.operations = [];
    this.startTime = Date.now();
  }
  
  recordOperation(operation, duration, success = true) {
    this.operations.push({
      timestamp: Date.now(),
      operation,
      duration,
      success,
      costEstimate: this.estimateCost(duration)
    });
  }
  
  estimateCost(durationMs) {
    // Cost model: $0.10/hour compute @ 35% CPU
    const computeHourMs = 1000 * 60 * 60;
    const computeCost = (durationMs / computeHourMs) * 0.10 * 0.35;
    return computeCost;
  }
  
  getSummary() {
    const total = this.operations.length;
    const successful = this.operations.filter(o => o.success).length;
    const totalCost = this.operations.reduce((sum, o) => sum + o.costEstimate, 0);
    const avgDuration = this.operations.reduce((sum, o) => sum + o.duration, 0) / total;
    
    return {
      totalOperations: total,
      successRate: ((successful / total) * 100).toFixed(2) + '%',
      averageDuration: avgDuration.toFixed(2) + 'ms',
      totalCost: '$' + totalCost.toFixed(4),
      costPerOperation: '$' + (totalCost / total).toFixed(6),
      estimatedDailyOps: Math.floor((24 * 60 * 60 * 1000) / avgDuration),
      estimatedMonthlyCost: '$' + (totalCost * 30).toFixed(2)
    };
  }
  
  printReport() {
    const summary = this.getSummary();
    console.log('\n=== Cost Summary ===');
    console.log(`Total Operations: ${summary.totalOperations}`);
    console.log(`Success Rate: ${summary.successRate}`);
    console.log(`Average Duration: ${summary.averageDuration}`);
    console.log(`Total Cost: ${summary.totalCost}`);
    console.log(`Cost per Operation: ${summary.costPerOperation}`);
    console.log(`Estimated Daily Capacity: ${summary.estimatedDailyOps}`);
    console.log(`Estimated Monthly Cost: ${summary.estimatedMonthlyCost}`);
  }
}
```

### Real-time Monitoring

```javascript
class OperationMonitor {
  constructor() {
    this.metrics = {
      successRate: 0,
      avgLatency: 0,
      throughput: 0,
      memoryUsage: 0
    };
  }
  
  async monitorOperation(operationFn) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await operationFn();
      const duration = performance.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;
      
      this.updateMetrics(duration, true, memoryDelta);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updateMetrics(duration, false);
      throw error;
    }
  }
  
  updateMetrics(duration, success, memoryDelta = 0) {
    // Update success rate
    // Update average latency
    // Update throughput
    // Update memory usage
  }
  
  getMetrics() {
    return this.metrics;
  }
  
  alertIfThresholdsExceeded() {
    if (this.metrics.successRate < 0.95) {
      console.warn('WARNING: Success rate below 95%');
    }
    if (this.metrics.avgLatency > 200) {
      console.warn('WARNING: Average latency exceeds 200ms');
    }
    if (this.metrics.memoryUsage > 0.8 * os.freemem()) {
      console.warn('WARNING: Memory usage high');
    }
  }
}
```

---

## Implementation Examples

### Example 1: palletai Agent - OSINT Reconnaissance

```python
# palletai agent using cost-optimized workflows
import asyncio
from basset_hound import BrowserClient

class OSINTReconAgent:
    def __init__(self):
        self.browser = BrowserClient(ws_url='ws://browser:8765')
        self.cost_tracker = CostTracker()
    
    async def investigate_domain(self, domain, budget_ms=10000):
        """
        Cost-optimized domain investigation
        Estimates 83 operations at 120ms each
        """
        urls = [
            f'https://{domain}',
            f'https://www.{domain}',
            f'https://{domain}/admin',
            f'https://{domain}/api',
            # ... more variations
        ]
        
        # Phase 1: Minimal workflow (120ms per URL)
        # Cost: 83 URLs × $0.000019 = $0.0016
        results = await self.browser.batch_minimal_workflow(
            urls,
            batch_size=50
        )
        
        return {
            'domain': domain,
            'urls_checked': len(urls),
            'available_count': sum(1 for r in results if r.get('available')),
            'estimated_cost': '$0.0016',
            'results': results
        }
    
    async def monitor_targets(self, targets, interval_hours=24):
        """
        Continuous cost-optimized monitoring
        Uses minimal workflow (9ms per check)
        """
        while True:
            results = await self.browser.batch_minimal_workflow(
                targets,
                batch_size=100
            )
            
            # Detect changes
            changes = self.detect_changes(results)
            
            if changes:
                await self.alert_system(changes)
            
            # Sleep until next interval
            await asyncio.sleep(interval_hours * 3600)
```

### Example 2: Batch Processing with Error Handling

```javascript
async function robustBatchProcessing(urls, options = {}) {
  const {
    batchSize = 50,
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000
  } = options;
  
  const results = [];
  const failures = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    try {
      const batchResults = await Promise.allSettled(
        batch.map(url => executeWithRetry(url, maxRetries, retryDelay, timeout))
      );
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failures.push({
            url: batch[j],
            error: result.reason,
            retries: maxRetries
          });
        }
      }
      
      console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${batchResults.filter(r => r.status === 'fulfilled').length}/${batch.length} successful`);
      
    } catch (error) {
      console.error(`Batch processing error:`, error);
      failures.push(...batch.map(url => ({ url, error: error.message })));
    }
  }
  
  return {
    successful: results,
    failed: failures,
    successRate: ((results.length / urls.length) * 100).toFixed(2) + '%'
  };
}

async function executeWithRetry(url, maxRetries, delay, timeout) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        minimalWorkflow(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}
```

---

## Troubleshooting

### Issue: High Latency (>200ms per operation)

**Causes:**
1. Network latency to browser service
2. Browser under high load
3. Page is slow to respond

**Solutions:**
```javascript
// 1. Check browser health
const health = await client.send('ping');
if (!health.success) {
  // Browser is unhealthy, consider failover
}

// 2. Reduce batch size if browser struggling
if (avgLatency > 200) {
  batchSize = Math.max(10, batchSize / 2);
}

// 3. Use timeout to fail fast
const result = await Promise.race([
  minimalWorkflow(url),
  timeout(5000)  // Fail if takes >5s
]);
```

### Issue: High Memory Usage

**Causes:**
1. Too many concurrent operations
2. Memory leak in browser
3. Large pages loaded

**Solutions:**
```javascript
// 1. Reduce concurrent operations
const MAX_CONCURRENT = 50;
const semaphore = new Semaphore(MAX_CONCURRENT);

// 2. Add memory checks
if (process.memoryUsage().heapUsed > 500 * 1024 * 1024) {
  // Too much memory, stop accepting work
  console.warn('Memory threshold exceeded');
}

// 3. Periodic restart
setTimeout(() => {
  client.disconnect();
  client = new WebSocketClient();
  client.connect(); // Restart connection
}, 1000 * 60 * 60); // Every hour
```

### Issue: Low Success Rate (<95%)

**Causes:**
1. Network instability
2. Browser crashes
3. Page timeouts

**Solutions:**
```javascript
// 1. Increase timeout
const TIMEOUT = 30000; // 30 seconds

// 2. Implement automatic retry
const result = await executeWithRetry(url, maxRetries = 3);

// 3. Monitor success rate
if (successRate < 0.95) {
  // Alert operations, consider fallback
  await alertSystem.notifyFailure();
}
```

---

## Performance Tuning Checklist

- [ ] Use minimal workflows by default
- [ ] Batch operations in groups of 50-100
- [ ] Monitor latency and success rate
- [ ] Implement retry logic with exponential backoff
- [ ] Use adaptive batching based on load
- [ ] Cache results when possible
- [ ] Implement cost tracking
- [ ] Set up alerting for degradation
- [ ] Test with expected production load
- [ ] Document SLA targets (e.g., 95% operations <200ms)

---

**Ready to deploy!** Use these patterns for efficient, cost-optimized palletai agents.
