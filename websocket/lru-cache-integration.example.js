/**
 * LRU Cache Integration Example
 * Shows how to integrate LRUCache with WebSocket server for request/response caching
 */

const { LRUCache } = require('./lru-cache');

/**
 * Example 1: Screenshot Caching
 * Cache screenshot results to avoid re-rendering the same page
 */
function screenshotCacheExample() {
  const screenshotCache = new LRUCache(500); // Cache last 500 screenshots

  function getScreenshot(pageUrl, options) {
    // Create cache key from URL and key options
    const cacheKey = `screenshot:${pageUrl}:${JSON.stringify(options)}`;

    // Check cache first
    const cached = screenshotCache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${pageUrl}`);
      return cached;
    }

    // Render screenshot if not cached
    console.log(`Rendering screenshot for ${pageUrl}`);
    const screenshot = renderScreenshot(pageUrl, options); // Mock function

    // Store in cache
    screenshotCache.set(cacheKey, screenshot);
    return screenshot;
  }

  // Usage
  const url = 'https://example.com';
  const options = { width: 1920, height: 1080 };

  getScreenshot(url, options); // Renders
  getScreenshot(url, options); // Cache hit
  getScreenshot(url, options); // Cache hit

  console.log('Screenshot Cache Metrics:', screenshotCache.getMetrics());
  // Output: { size: 1, maxSize: 500, hits: 2, misses: 1, hitRate: '66.67%', utilization: '0.20%' }
}

/**
 * Example 2: HTML Content Caching
 * Cache page HTML to avoid re-fetching
 */
function htmlCacheExample() {
  const htmlCache = new LRUCache(1000); // Cache last 1000 pages
  const metadataCache = new LRUCache(1000); // Separate cache for metadata

  function getPageContent(url) {
    const cached = htmlCache.get(url);
    if (cached) {
      return cached;
    }

    const html = fetchPageHTML(url); // Mock function
    htmlCache.set(url, html);
    return html;
  }

  function getPageMetadata(url) {
    const cached = metadataCache.get(url);
    if (cached) {
      return cached;
    }

    const metadata = extractMetadata(url); // Mock function
    metadataCache.set(url, metadata);
    return metadata;
  }

  // Usage with typical Pareto distribution (80/20 rule)
  const commonUrls = [
    'https://google.com',
    'https://facebook.com',
    'https://twitter.com'
  ];

  // Simulate 1000 requests with 80% going to common URLs
  let requests = 0;
  for (let i = 0; i < 1000; i++) {
    const isCommon = Math.random() < 0.8;
    const url = isCommon
      ? commonUrls[Math.floor(Math.random() * commonUrls.length)]
      : `https://uncommon-${i}.com`;

    getPageContent(url);
    requests++;
  }

  console.log('HTML Cache Metrics:', htmlCache.getMetrics());
  // Output: high hit rate due to Pareto distribution
}

/**
 * Example 3: WebSocket Command Response Caching
 * Cache expensive command results
 */
function websocketCommandCacheExample() {
  const commandCache = new LRUCache(2000); // Cache 2000 command responses

  function handleWebSocketCommand(command, args) {
    // Create deterministic cache key
    const cacheKey = `${command}:${JSON.stringify(args)}`;

    // Check cache for idempotent operations
    if (isCacheableCommand(command)) {
      const cached = commandCache.get(cacheKey);
      if (cached) {
        console.log(`Cached result for ${command}`);
        return { ...cached, fromCache: true };
      }
    }

    // Execute command
    const result = executeCommand(command, args); // Mock function

    // Cache result if appropriate
    if (isCacheableCommand(command)) {
      commandCache.set(cacheKey, result);
    }

    return { ...result, fromCache: false };
  }

  function isCacheableCommand(command) {
    // Only cache read-only commands
    const cacheableCommands = ['getHTML', 'screenshot', 'getLinks', 'getText'];
    return cacheableCommands.includes(command);
  }

  // Simulate WebSocket commands
  handleWebSocketCommand('getHTML', { url: 'https://example.com' }); // Executes
  handleWebSocketCommand('getHTML', { url: 'https://example.com' }); // Cache hit
  handleWebSocketCommand('click', { selector: '.button' }); // Not cached

  console.log('Command Cache Metrics:', commandCache.getMetrics());
}

/**
 * Example 4: Performance Monitoring
 * Track cache performance over time
 */
class CacheMonitor {
  constructor(cache, name = 'Cache') {
    this.cache = cache;
    this.name = name;
    this.snapshots = [];
  }

  takeSnapshot() {
    this.snapshots.push({
      timestamp: Date.now(),
      ...this.cache.getMetrics()
    });
    return this.snapshots[this.snapshots.length - 1];
  }

  getReport() {
    if (this.snapshots.length === 0) {
      return null;
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const earliest = this.snapshots[0];

    return {
      name: this.name,
      duration: latest.timestamp - earliest.timestamp,
      totalSnapshots: this.snapshots.length,
      currentMetrics: latest,
      startMetrics: earliest,
      hitRateTrend: this.calculateTrend()
    };
  }

  calculateTrend() {
    if (this.snapshots.length < 2) return 'insufficient data';

    const recent = this.snapshots.slice(-5); // Last 5 snapshots
    const hitRates = recent.map(s => parseFloat(s.hitRate));
    const avgRecent = hitRates.reduce((a, b) => a + b, 0) / hitRates.length;

    if (avgRecent > 90) return 'excellent (>90%)';
    if (avgRecent > 80) return 'good (80-90%)';
    if (avgRecent > 70) return 'fair (70-80%)';
    return 'poor (<70%)';
  }
}

function monitoringExample() {
  const cache = new LRUCache(100);
  const monitor = new CacheMonitor(cache, 'Request Cache');

  // Simulate workload
  for (let i = 0; i < 5; i++) {
    // Populate cache
    for (let j = 0; j < 50; j++) {
      cache.set(`key-${j % 30}`, Math.random());
    }

    // Access pattern
    for (let j = 0; j < 100; j++) {
      cache.get(`key-${j % 30}`);
    }

    monitor.takeSnapshot();
  }

  console.log('Cache Monitoring Report:');
  console.log(JSON.stringify(monitor.getReport(), null, 2));
}

/**
 * Example 5: Multi-tier Caching
 * Use multiple caches for different data types
 */
function multiTierCachingExample() {
  const caches = {
    screenshots: new LRUCache(500),
    html: new LRUCache(1000),
    metadata: new LRUCache(2000),
    computed: new LRUCache(300)
  };

  function getDataWithCache(type, key, fetchFn) {
    if (!caches[type]) {
      throw new Error(`Unknown cache type: ${type}`);
    }

    const cache = caches[type];
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const data = fetchFn();
    cache.set(key, data);
    return data;
  }

  // Usage
  getDataWithCache('html', 'https://example.com', () => 'html content');
  getDataWithCache('metadata', 'https://example.com', () => ({ title: 'Example' }));

  // Print all cache metrics
  console.log('\n=== Multi-tier Cache Metrics ===');
  for (const [type, cache] of Object.entries(caches)) {
    console.log(`${type}:`, cache.getMetrics());
  }
}

// Mock functions for examples
function renderScreenshot(url, options) {
  return Buffer.from(`screenshot-${url}-${JSON.stringify(options)}`);
}

function fetchPageHTML(url) {
  return `<html><body>Content from ${url}</body></html>`;
}

function extractMetadata(url) {
  return { title: url, description: 'Page description' };
}

function executeCommand(command, args) {
  return { success: true, data: args };
}

// Run examples if executed directly
if (require.main === module) {
  console.log('=== LRU Cache Integration Examples ===\n');

  console.log('1. Screenshot Caching:');
  screenshotCacheExample();

  console.log('\n2. HTML Content Caching:');
  htmlCacheExample();

  console.log('\n3. WebSocket Command Caching:');
  websocketCommandCacheExample();

  console.log('\n4. Performance Monitoring:');
  monitoringExample();

  console.log('\n5. Multi-tier Caching:');
  multiTierCachingExample();
}

module.exports = {
  screenshotCacheExample,
  htmlCacheExample,
  websocketCommandCacheExample,
  CacheMonitor,
  monitoringExample,
  multiTierCachingExample
};
