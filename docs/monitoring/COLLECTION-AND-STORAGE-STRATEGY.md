# Basset Hound Browser - Metrics Collection & Storage Strategy

**Version:** 1.0.0  
**Date:** June 21, 2026  
**Purpose:** Complete specification for collecting, storing, and managing metrics

---

## Table of Contents

1. [Collection Strategy](#collection-strategy)
2. [Storage Strategy](#storage-strategy)
3. [Data Lifecycle](#data-lifecycle)
4. [Implementation Details](#implementation-details)
5. [Operational Procedures](#operational-procedures)
6. [Performance Optimization](#performance-optimization)

---

## Collection Strategy

### Collection Intervals by Metric Category

#### Real-Time Metrics (Per Request/Event)

These metrics are collected immediately when events occur:

| Metric | Trigger | Example |
|---|---|---|
| `app.requests.total` | Every command received | WebSocket message |
| `app.latency.*` | Every command completed | After execution |
| `app.errors.total` | Every error occurs | Exception thrown |
| `security.ratelimit.violations` | Rate limit triggered | Request rejected |
| `security.validation.input` | Validation fails | Invalid JSON |
| `app.connections.active` | Connection state change | Client connects/disconnects |

**Implementation:**

```javascript
// websocket/middleware/metrics-collector-middleware.js
class MetricsCollectorMiddleware {
  constructor(metricsCollector) {
    this.collector = metricsCollector;
  }

  async collect(command, data, context) {
    const startTime = Date.now();
    const tracker = {
      command,
      startTime,
      clientId: context.clientId,
      authenticated: context.authenticated
    };

    try {
      // Middleware execution
      const result = await this.executeCommand(command, data);
      
      const latency = Date.now() - startTime;
      
      // Collect real-time metrics
      this.collector.recordCommand({
        command,
        latency,
        status: 'success',
        bytesIn: JSON.stringify(data).length,
        bytesOut: JSON.stringify(result).length
      });

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // Collect error metrics
      this.collector.recordError({
        command,
        error: error.message,
        errorType: error.constructor.name,
        latency
      });

      throw error;
    }
  }
}
```

#### System Metrics (Fixed Intervals)

```javascript
// metrics/system-metrics-collector.js

class SystemMetricsCollector {
  constructor(options = {}) {
    this.intervals = {
      cpu: options.cpuInterval || 5000,      // 5 seconds
      memory: options.memoryInterval || 5000, // 5 seconds
      disk: options.diskInterval || 10000,    // 10 seconds
      network: options.networkInterval || 10000 // 10 seconds
    };

    this.start();
  }

  start() {
    // CPU collection
    setInterval(() => {
      const metrics = this.collectCpuMetrics();
      this.store('system.cpu', metrics);
    }, this.intervals.cpu);

    // Memory collection
    setInterval(() => {
      const metrics = this.collectMemoryMetrics();
      this.store('system.memory', metrics);
    }, this.intervals.memory);

    // Disk I/O collection
    setInterval(() => {
      const metrics = this.collectDiskMetrics();
      this.store('system.disk', metrics);
    }, this.intervals.disk);

    // Network I/O collection
    setInterval(() => {
      const metrics = this.collectNetworkMetrics();
      this.store('system.network', metrics);
    }, this.intervals.network);
  }

  collectCpuMetrics() {
    const cpus = os.cpus();
    const avgLoad = os.loadavg();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      timestamp: Date.now(),
      usage,
      cores: cpus.length,
      loadAverage: {
        oneMinute: avgLoad[0],
        fiveMinutes: avgLoad[1],
        fifteenMinutes: avgLoad[2]
      }
    };
  }

  collectMemoryMetrics() {
    const mem = process.memoryUsage();
    const sysMem = {
      total: os.totalmem(),
      free: os.freemem()
    };

    return {
      timestamp: Date.now(),
      heap: {
        used: mem.heapUsed,
        total: mem.heapTotal,
        usedPercent: (mem.heapUsed / mem.heapTotal) * 100
      },
      external: mem.external,
      rss: mem.rss,
      system: {
        total: sysMem.total,
        free: sysMem.free,
        used: sysMem.total - sysMem.free,
        usedPercent: ((sysMem.total - sysMem.free) / sysMem.total) * 100
      }
    };
  }

  collectDiskMetrics() {
    // Requires /proc/diskstats parsing (Linux) or fsstat (macOS/Windows)
    return {
      timestamp: Date.now(),
      devices: this.parseDiskStats()
    };
  }

  collectNetworkMetrics() {
    // Requires /proc/net/dev parsing (Linux) or platform APIs
    return {
      timestamp: Date.now(),
      interfaces: this.parseNetworkStats()
    };
  }
}
```

#### Application Metrics (Aggregated Intervals)

```javascript
// metrics/application-metrics-collector.js

class ApplicationMetricsCollector {
  constructor(options = {}) {
    this.aggregationInterval = options.aggregationInterval || 10000; // 10 seconds
    
    // Buffers for aggregation
    this.commands = [];
    this.errors = [];
    this.latencies = [];
    
    this.startAggregation();
  }

  startAggregation() {
    setInterval(() => {
      const aggregated = this.aggregate();
      this.store('app.metrics', aggregated);
      this.reset();
    }, this.aggregationInterval);
  }

  recordCommand(command, latency) {
    this.commands.push({
      command,
      timestamp: Date.now(),
      latency
    });
    this.latencies.push(latency);
  }

  recordError(error) {
    this.errors.push({
      ...error,
      timestamp: Date.now()
    });
  }

  aggregate() {
    const now = Date.now();
    const interval = this.aggregationInterval / 1000; // Convert to seconds

    return {
      timestamp: now,
      interval: this.aggregationInterval,
      throughput: {
        totalCommands: this.commands.length,
        commandsPerSecond: this.commands.length / interval,
        commandBreakdown: this.getCommandBreakdown()
      },
      latency: {
        ...this.calculatePercentiles(),
        samples: this.latencies.length
      },
      errors: {
        total: this.errors.length,
        rate: this.errors.length / interval,
        byType: this.getErrorBreakdown()
      }
    };
  }

  calculatePercentiles() {
    if (this.latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.50)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.90)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1],
      avg: (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2)
    };
  }

  getCommandBreakdown() {
    return this.commands.reduce((acc, cmd) => {
      acc[cmd.command] = (acc[cmd.command] || 0) + 1;
      return acc;
    }, {});
  }

  getErrorBreakdown() {
    return this.errors.reduce((acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    }, {});
  }

  reset() {
    this.commands = [];
    this.errors = [];
    this.latencies = [];
  }
}
```

---

## Storage Strategy

### Multi-Tier Storage Architecture

```
┌─────────────────────────────────────────────────┐
│         Tier 1: Hot Memory (< 5MB)              │
│     Last 5 minutes of real-time metrics         │
│     Ring buffer with automatic rotation         │
│     Retrieval time: < 1ms                       │
└──────────────┬──────────────────────────────────┘
               │
        Flush every 1 minute
               │
               ▼
┌─────────────────────────────────────────────────┐
│      Tier 2: Warm Files (50-100MB/day)          │
│      Last 24 hours in hourly files              │
│      Gzip compressed at level 6                 │
│      Retrieval time: 10-50ms                    │
└──────────────┬──────────────────────────────────┘
               │
        Aggregate nightly
               │
               ▼
┌─────────────────────────────────────────────────┐
│     Tier 3: Archive Database (30 days)          │
│     Time-series database or daily aggregates    │
│     Queryable via API                           │
│     Retrieval time: 100-500ms                   │
└──────────────┬──────────────────────────────────┘
               │
        Archive monthly
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Tier 4: Cold Storage (> 30 days / Compliance)  │
│     Compressed tar archives                     │
│     Optional cloud storage (S3, GCS)            │
│     For compliance and long-term analysis       │
└─────────────────────────────────────────────────┘
```

### Tier 1: Hot Memory Storage

**Purpose:** Real-time metric access (< 1ms latency)

```javascript
// metrics/storage/hot-storage.js

class HotStorageBuffer {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 5242880;  // 5MB
    this.maxAge = options.maxAge || 300000;     // 5 minutes
    
    this.metrics = [];
    this.size = 0;
    
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), 60000);
  }

  store(metric) {
    const entry = {
      data: metric,
      timestamp: Date.now(),
      size: JSON.stringify(metric).length
    };

    this.metrics.push(entry);
    this.size += entry.size;

    // Evict old entries if size exceeded
    while (this.size > this.maxSize && this.metrics.length > 0) {
      const removed = this.metrics.shift();
      this.size -= removed.size;
    }
  }

  query(startTime, endTime) {
    return this.metrics.filter(entry => 
      entry.timestamp >= startTime && 
      entry.timestamp <= endTime
    );
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (let i = 0; i < this.metrics.length; i++) {
      if (now - this.metrics[i].timestamp > this.maxAge) {
        this.size -= this.metrics[i].size;
        keysToDelete.push(i);
      }
    }

    // Remove in reverse order to maintain indices
    keysToDelete.reverse().forEach(i => {
      this.metrics.splice(i, 1);
    });
  }

  getMetrics() {
    return {
      count: this.metrics.length,
      sizeMB: (this.size / 1024 / 1024).toFixed(2),
      entries: this.metrics
    };
  }
}
```

### Tier 2: Warm File Storage

**Purpose:** Historical data (10-50ms latency, 24-hour retention)

```javascript
// metrics/storage/warm-storage.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class WarmStorageManager {
  constructor(options = {}) {
    this.storagePath = options.storagePath || './data/metrics/warm';
    this.rotationInterval = options.rotationInterval || 3600000; // 1 hour
    this.compressionLevel = options.compressionLevel || 6;
    this.maxRetention = options.maxRetention || 86400000; // 24 hours
    
    this.ensureDirectory();
    this.startRotation();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async store(metrics) {
    const now = new Date();
    const filename = this.getFilename(now);
    const filepath = path.join(this.storagePath, filename);

    const data = JSON.stringify({
      timestamp: now.toISOString(),
      metrics
    });

    // Append to file
    return new Promise((resolve, reject) => {
      const gzip = zlib.createGzip({ level: this.compressionLevel });
      const file = fs.createWriteStream(filepath, { flags: 'a' });
      
      file.on('finish', resolve);
      file.on('error', reject);
      
      gzip.pipe(file);
      gzip.write(data + '\n');
      gzip.end();
    });
  }

  async query(startTime, endTime) {
    const files = this.getFilesInRange(startTime, endTime);
    const results = [];

    for (const file of files) {
      const filepath = path.join(this.storagePath, file);
      const data = await this.readCompressed(filepath);
      results.push(...data);
    }

    return results;
  }

  getFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    
    return `${year}-${month}-${day}-${hour}.json.gz`;
  }

  getFilesInRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const files = [];

    for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
      const filename = this.getFilename(d);
      if (fs.existsSync(path.join(this.storagePath, filename))) {
        files.push(filename);
      }
    }

    return files;
  }

  async readCompressed(filepath) {
    return new Promise((resolve, reject) => {
      const gunzip = zlib.createGunzip();
      const file = fs.createReadStream(filepath);
      let data = '';

      gunzip.on('data', chunk => {
        data += chunk.toString();
      });

      gunzip.on('end', () => {
        const lines = data.trim().split('\n');
        const results = lines.map(line => JSON.parse(line));
        resolve(results);
      });

      gunzip.on('error', reject);
      file.pipe(gunzip);
    });
  }

  startRotation() {
    setInterval(() => this.cleanup(), 3600000);
  }

  async cleanup() {
    const now = Date.now();
    const files = fs.readdirSync(this.storagePath);

    for (const file of files) {
      const filepath = path.join(this.storagePath, file);
      const stat = fs.statSync(filepath);

      if (now - stat.mtimeMs > this.maxRetention) {
        fs.unlinkSync(filepath);
        console.log(`Deleted old file: ${file}`);
      }
    }
  }

  async getSize() {
    let totalSize = 0;
    const files = fs.readdirSync(this.storagePath);

    for (const file of files) {
      const filepath = path.join(this.storagePath, file);
      const stat = fs.statSync(filepath);
      totalSize += stat.size;
    }

    return totalSize;
  }
}
```

### Tier 3: Archive Database Storage

**Purpose:** Long-term queryable data (24 hours to 30 days)

```javascript
// metrics/storage/archive-storage.js

class ArchiveStorageManager {
  constructor(options = {}) {
    this.dbPath = options.dbPath || './data/metrics/archive.db';
    this.aggregationInterval = options.aggregationInterval || 86400000; // 1 day
    this.maxRetention = options.maxRetention || 2592000000; // 30 days
    
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Using simple JSON-based storage (can upgrade to SQLite or similar)
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify({
        version: '1.0',
        createdAt: new Date().toISOString(),
        records: []
      }));
    }
  }

  async storeAggregated(date, metrics) {
    const db = this.readDatabase();
    
    db.records.push({
      date: date.toISOString(),
      metrics,
      storedAt: new Date().toISOString()
    });

    // Keep only last 30 days
    const cutoff = Date.now() - this.maxRetention;
    db.records = db.records.filter(r => 
      new Date(r.date).getTime() > cutoff
    );

    this.writeDatabase(db);
  }

  async queryByDateRange(startDate, endDate) {
    const db = this.readDatabase();
    
    return db.records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  async queryByMetric(metric, startDate, endDate) {
    const records = await this.queryByDateRange(startDate, endDate);
    
    return records.map(record => ({
      date: record.date,
      value: this.getNestedValue(record.metrics, metric)
    })).filter(r => r.value !== undefined);
  }

  readDatabase() {
    const content = fs.readFileSync(this.dbPath, 'utf8');
    return JSON.parse(content);
  }

  writeDatabase(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => 
      current ? current[prop] : undefined, obj);
  }
}
```

### Tier 4: Cold Storage

**Purpose:** Compliance and long-term archive (> 30 days)

```javascript
// metrics/storage/cold-storage.js

class ColdStorageManager {
  constructor(options = {}) {
    this.archivePath = options.archivePath || './data/metrics/archive';
    this.cloudUpload = options.cloudUpload || null; // AWS S3, GCS, etc.
    this.compressionLevel = 9;
    
    this.ensureDirectory();
  }

  async archiveMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const sourceDir = path.join('./data/metrics/warm');
    const archiveName = `${year}-${month}-aggregated`;
    const archivePath = path.join(this.archivePath, `${archiveName}.tar.gz`);

    // Create tar.gz archive
    return new Promise((resolve, reject) => {
      const tar = require('tar');
      
      tar.c(
        {
          gzip: { level: this.compressionLevel },
          file: archivePath,
          cwd: './data/metrics'
        },
        [`warm/*-${month}.json.gz`]
      ).then(resolve).catch(reject);
    });
  }

  async uploadToCloud(archivePath) {
    if (!this.cloudUpload) {
      console.log('Cloud upload not configured');
      return;
    }

    // AWS S3 example
    const filename = path.basename(archivePath);
    const fileStream = fs.createReadStream(archivePath);

    try {
      const result = await this.cloudUpload.upload({
        Bucket: 'basset-hound-metrics',
        Key: `archive/${filename}`,
        Body: fileStream
      }).promise();

      console.log(`Uploaded to S3: ${result.Location}`);
      return result;
    } catch (error) {
      console.error(`Cloud upload failed: ${error.message}`);
      throw error;
    }
  }

  ensureDirectory() {
    if (!fs.existsSync(this.archivePath)) {
      fs.mkdirSync(this.archivePath, { recursive: true });
    }
  }
}
```

---

## Data Lifecycle

### Complete Data Journey

```
1. COLLECTION (0-5 min)
   └─ Real-time metric generation
   └─ Per-request/event basis
   └─ 5-minute window in memory

2. FLUSH TO WARM (5-60 min)
   └─ Write to compressed hourly files
   └─ Gzip compression (level 6)
   └─ Keep 24-hour rolling window

3. AGGREGATION (1-30 days)
   └─ Daily rollup to archive database
   └─ Calculate percentiles, trends
   └─ 30-day retention

4. ARCHIVAL (30+ days)
   └─ Monthly tar.gz archives
   └─ Gzip compression (level 9)
   └─ Optional cloud backup

5. DELETION
   └─ Delete > 30 days from archive
   └─ Compliance with retention policy
```

### Retention Timeline

```
Time        Storage Location       Size        Retention
────────────────────────────────────────────────────────
Now         Hot Memory            < 5MB       5 minutes
0-1 min     In-transit            Variable    Streaming
1-60 min    Warm Files (hourly)   50MB/day    24 hours
1-30 days   Archive DB            Small       30 days
30+ days    Cold Storage          Large       Compliance
```

---

## Implementation Details

### Metrics Collector Integration

```javascript
// websocket/server.js

const { SystemMetricsCollector } = require('../metrics/system-metrics-collector');
const { ApplicationMetricsCollector } = require('../metrics/application-metrics-collector');
const { HotStorageBuffer } = require('../metrics/storage/hot-storage');
const { WarmStorageManager } = require('../metrics/storage/warm-storage');
const { ArchiveStorageManager } = require('../metrics/storage/archive-storage');

class MetricsManager {
  constructor() {
    this.systemCollector = new SystemMetricsCollector();
    this.appCollector = new ApplicationMetricsCollector();
    this.hotStorage = new HotStorageBuffer();
    this.warmStorage = new WarmStorageManager();
    this.archiveStorage = new ArchiveStorageManager();

    this.setupPipeline();
  }

  setupPipeline() {
    // System metrics → Hot → Warm
    setInterval(async () => {
      const metrics = {
        system: this.systemCollector.getMetrics(),
        application: this.appCollector.getMetrics(),
        timestamp: Date.now()
      };

      this.hotStorage.store(metrics);
      await this.warmStorage.store(metrics);
    }, 60000); // Every minute

    // Warm → Archive (daily)
    setInterval(async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const warmData = await this.warmStorage.query(
        yesterday.setHours(0, 0, 0, 0),
        yesterday.setHours(23, 59, 59, 999)
      );

      const aggregated = this.aggregateDaily(warmData);
      await this.archiveStorage.storeAggregated(yesterday, aggregated);
    }, 86400000); // Every 24 hours
  }

  aggregateDaily(data) {
    // Calculate daily aggregates
    return {
      cpu: this.calculateStats(data.map(d => d.cpu.usage)),
      memory: this.calculateStats(data.map(d => d.memory.heapUsedPercent)),
      throughput: this.sumMetric(data.map(d => d.throughput)),
      errors: this.sumMetric(data.map(d => d.errors))
    };
  }

  calculateStats(values) {
    const sorted = values.sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }
}
```

---

## Operational Procedures

### Daily Operations

```bash
#!/bin/bash
# scripts/daily-metrics-maintenance.sh

# Archive previous day's metrics
node -e "
  const { ColdStorageManager } = require('./metrics/storage/cold-storage');
  const manager = new ColdStorageManager();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  manager.archiveMonth(yesterday);
"

# Check storage usage
du -sh ./data/metrics/

# Verify data integrity
node -e "
  const { ArchiveStorageManager } = require('./metrics/storage/archive-storage');
  const manager = new ArchiveStorageManager();
  const stats = manager.readDatabase();
  console.log('Archive records:', stats.records.length);
"
```

### Troubleshooting Commands

```bash
# Check hot storage status
curl http://localhost:8765/health/metrics | jq '.hot_storage'

# Query warm storage files
ls -lh ./data/metrics/warm/ | tail -10

# Verify archive database
file ./data/metrics/archive.db
du -h ./data/metrics/archive.db

# Check disk usage
df -h ./data/metrics/

# Monitor collection performance
watch -n 5 'ls -l ./data/metrics/warm/ | wc -l'
```

---

## Performance Optimization

### Memory Efficiency

```javascript
// Use streaming for large datasets
async function streamMetrics(startTime, endTime) {
  const warmStorage = new WarmStorageManager();
  const files = warmStorage.getFilesInRange(startTime, endTime);

  for (const file of files) {
    // Process file by file instead of loading all into memory
    const filepath = path.join(warmStorage.storagePath, file);
    
    const gunzip = zlib.createGunzip();
    const fileStream = fs.createReadStream(filepath);
    
    fileStream.pipe(gunzip).on('data', chunk => {
      // Process each line as it arrives
      processMetrics(chunk.toString());
    });
  }
}
```

### Query Optimization

```javascript
// Index frequently accessed metrics
class IndexedArchiveStorage {
  constructor() {
    this.index = new Map(); // command -> [dates with this command]
  }

  storeWithIndex(date, metrics) {
    const commands = Object.keys(metrics.commands || {});
    
    for (const cmd of commands) {
      if (!this.index.has(cmd)) {
        this.index.set(cmd, []);
      }
      this.index.get(cmd).push(date);
    }
  }

  queryByCommand(command, startDate, endDate) {
    if (!this.index.has(command)) {
      return [];
    }

    return this.index.get(command).filter(date =>
      date >= startDate && date <= endDate
    );
  }
}
```

### Compression Tuning

```javascript
// Dynamic compression based on content
class AdaptiveCompressionStorage {
  getCompressionLevel(metric) {
    // Metrics with low entropy benefit from higher compression
    const entropy = this.calculateEntropy(metric);
    
    if (entropy < 2.0) return 9; // Max compression
    if (entropy < 3.0) return 6; // Medium compression
    return 3;                      // Light compression
  }

  calculateEntropy(data) {
    const str = JSON.stringify(data);
    const freq = {};
    
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }
}
```

---

**End of Metrics Collection & Storage Strategy**
