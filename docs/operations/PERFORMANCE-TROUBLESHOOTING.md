# Performance Troubleshooting Guide - Basset Hound Browser

**Document Version:** 1.0  
**Last Updated:** June 4, 2026  
**Classification:** Internal Operations  
**Audience:** DevOps, SRE, Engineering Teams

---

## Table of Contents

1. [Performance Baseline](#performance-baseline)
2. [High Latency Diagnosis](#high-latency-diagnosis)
3. [High CPU Usage Diagnosis](#high-cpu-usage-diagnosis)
4. [High Memory Usage Diagnosis](#high-memory-usage-diagnosis)
5. [Database Performance Issues](#database-performance-issues)
6. [Network Bottlenecks](#network-bottlenecks)
7. [Query Optimization](#query-optimization)
8. [Caching Strategy Tuning](#caching-strategy-tuning)
9. [Diagnostic Commands](#diagnostic-commands)
10. [Quick Reference](#quick-reference)

---

## Performance Baseline

### Expected Metrics (v12.0.0)

**Request Latency:**
- P50: 10-20ms
- P95: 50-100ms
- P99: 100-200ms

**Throughput:**
- Single instance: 100-200 requests/second
- 5-instance cluster: 500-1000 requests/second
- 10-instance cluster: 1000-2000 requests/second

**Resource Usage:**
- CPU: 20-40% under normal load
- Memory: 200-400MB per instance
- Disk I/O: < 50MB/s average

**Error Rate:**
- Normal: < 0.1% (1 error per 1000 requests)
- Acceptable: < 0.5% (1 error per 200 requests)
- Alert: > 1% (1 error per 100 requests)

**Connection Pool:**
- Active connections: 50-100 per instance
- Idle connections: 10-20 per instance
- Max connections: 500 per instance

### Baseline Metrics Capture

```bash
#!/bin/bash
# capture_baseline.sh

echo "=== CAPTURING PERFORMANCE BASELINE ==="
echo "Timestamp: $(date -u)"

# CPU usage (5 minute average)
CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" $(docker ps -q) | tr '%' ' ' | awk '{sum+=$1} END {print sum/NR}')
echo "Average CPU: ${CPU}%"

# Memory usage
MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" $(docker ps -q) | awk -F'/' '{print $1}' | tr -d 'MiB' | awk '{sum+=$1} END {print sum/NR}')
echo "Average Memory: ${MEMORY}MB"

# Request latency (from Prometheus)
LATENCY=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds)' | jq '.[].value[1]')
echo "P95 Latency: ${LATENCY}s"

# Throughput
THROUGHPUT=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(http_requests_total[5m])' | jq 'add | .[1]')
echo "Throughput: ${THROUGHPUT} req/s"

# Error rate
ERROR_RATE=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(errors_total[5m])' | jq '.[].value[1]')
echo "Error Rate: ${ERROR_RATE}"

# Save to file
cat > baseline-$(date +%Y%m%d-%H%M%S).txt <<EOF
Timestamp: $(date -u)
CPU: ${CPU}%
Memory: ${MEMORY}MB
Latency P95: ${LATENCY}s
Throughput: ${THROUGHPUT} req/s
Error Rate: ${ERROR_RATE}
EOF
```

---

## High Latency Diagnosis

### Symptoms

- Request response time > 500ms (> 5× baseline)
- P95 latency > 200ms (expected 50-100ms)
- User reports slow API responses
- Application timeouts

### Quick Diagnosis (5 minutes)

```bash
#!/bin/bash
# diagnose_latency.sh

echo "=== HIGH LATENCY DIAGNOSIS ==="

# 1. Check if it's all instances or specific ones
echo "Latency by instance:"
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds) by (instance)' | \
  jq '.data.result[] | "\(.metric.instance): \(.value[1])"'

# 2. Check request types
echo "Latency by request type:"
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds) by (method)' | \
  jq '.data.result[] | "\(.metric.method): \(.value[1])"'

# 3. Check if it's upstream or app
echo "Database query latency:"
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,db_query_duration_seconds)' | \
  jq '.[].value[1]'

echo "Network latency (DNS):"
nslookup database.internal | grep "Query time"

# 4. Check CPU/Memory
echo "Current resource usage:"
docker stats --no-stream | tail -5

# 5. Check for GC pauses (if Node.js)
echo "GC activity (last 10 lines):"
docker logs --tail 10 basset-hound | grep -i "gc\|garbage"
```

### Root Cause Analysis

#### Cause 1: High CPU Usage
**Symptoms:** CPU > 80%, high context switching

**Solution:**
```bash
# Identify hot code paths
docker exec basset-hound npm run profile -- --duration=60

# Or use perf profiling
docker exec basset-hound perf record -p $(docker inspect -f '{{.State.Pid}}' basset-hound) -F 99 -- sleep 60
docker exec basset-hound perf report

# Optimize identified hot paths or scale horizontally
```

#### Cause 2: High Memory Pressure
**Symptoms:** Memory > 1.5GB, GC frequency increasing

**Solution:**
```bash
# Check for memory leak
docker exec basset-hound npm run heap-snapshot

# Analyze with chrome://inspect
# Look for detached DOM nodes, circular references

# Increase available memory or scale horizontally
docker run ... -m 2gb basset-hound  # Increase limit
```

#### Cause 3: Database Query Slow
**Symptoms:** DB query time > 100ms, database CPU high

**Solution:**
```bash
# Enable query logging
mysql -u user -p database -e "SET GLOBAL slow_query_log = 'ON';"

# Analyze slow queries
tail -100 /var/log/mysql/slow-query.log

# Optimize queries
# - Add indexes: CREATE INDEX idx_name ON table(column);
# - Analyze execution: EXPLAIN SELECT ...;
# - Reduce result set: Add WHERE, LIMIT clauses
```

#### Cause 4: Network Congestion
**Symptoms:** Network I/O saturated, packet loss

**Solution:**
```bash
# Check network statistics
iftop -i eth0  # Monitor interface

# Check packet loss
ping -c 10 database.internal | grep -i "loss"

# Check TCP connections
netstat -an | grep ESTABLISHED | wc -l

# Reduce payload size
# - Enable compression
# - Reduce batch sizes
# - Add caching
```

#### Cause 5: Load Balancer Misconfiguration
**Symptoms:** One instance gets all traffic, others idle

**Solution:**
```bash
# Check load balancer distribution
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(http_requests_total[5m]) by (instance)' | \
  jq '.data.result[]'

# Verify equal weights in config
cat /etc/load-balancer/production.conf | grep "weight"

# All should be weight=100 (or equal)
# If not:
# - Update load balancer config
# - Reload service
```

### Optimization Checklist

- [ ] Enable compression (HTTP gzip)
- [ ] Add caching (Redis, memcached)
- [ ] Optimize database queries
- [ ] Increase instance count (scale out)
- [ ] Upgrade instance resources (scale up)
- [ ] Use CDN for static assets
- [ ] Implement request batching

---

## High CPU Usage Diagnosis

### Symptoms

- CPU > 70% sustained
- Context switching > 1000/s
- Load average > number of cores
- User threads unable to run

### Diagnosis Procedure

```bash
#!/bin/bash
# diagnose_cpu.sh

echo "=== HIGH CPU USAGE DIAGNOSIS ==="

# 1. Overall CPU usage
echo "System CPU usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "CPU usage: " 100 - $1 "%"}'

# 2. Per-process CPU usage
echo "Process CPU usage:"
ps aux --sort=-%cpu | head -10

# 3. Container CPU usage
echo "Container CPU usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 4. Load average
echo "Load average:"
uptime

# 5. Context switches
echo "Context switches:"
vmstat 1 3 | tail -1

# 6. Kernel time vs user time (if available)
echo "CPU time breakdown:"
time docker exec basset-hound sleep 1
```

### High CPU - Root Causes and Solutions

#### Cause 1: CPU-Intensive Workload
**Diagnosis:**
```bash
# Check for expensive operations
docker logs --tail 100 basset-hound | grep -i "expensive\|slow"

# Profile application
docker exec basset-hound npm run cpu-profile
```

**Solution:**
```bash
# Option 1: Optimize code
# - Reduce algorithmic complexity
# - Cache expensive computations
# - Use worker threads for CPU-bound tasks

# Option 2: Scale horizontally
kubectl scale deployment basset-hound --replicas=10

# Option 3: Use GPU acceleration (if applicable)
# - Configure CUDA
# - Use GPU-accelerated libraries
```

#### Cause 2: Lock Contention
**Diagnosis:**
```bash
# Look for lock-related messages
docker logs basset-hound | grep -i "lock\|mutex"

# Check for hot locks in code
grep -r "lock\|mutex\|synchronized" src/ | head -20
```

**Solution:**
```bash
# Reduce lock scope
# Replace synchronized blocks with fine-grained locks
# Use lock-free data structures where possible

# Increase lock timeout or use lock-free algorithms
# Example: Use ConcurrentHashMap instead of synchronized HashMap
```

#### Cause 3: Garbage Collection Overhead
**Diagnosis:**
```bash
# Check GC frequency
docker logs basset-hound | grep -i "gc\|garbage"

# Measure GC impact
docker exec basset-hound java -XX:+PrintGCDetails -version
```

**Solution:**
```bash
# Tune JVM/Node.js heap
docker run ... -e NODE_OPTIONS="--max-old-space-size=2048" basset-hound

# Reduce memory pressure
# - Process less data per request
# - Increase instance count

# Use more efficient data structures
```

#### Cause 4: Inefficient Database Queries
**Diagnosis:**
```bash
# Enable query profiling
mysql -u user -p database -e "SET profiling = 1;"

# Run slow query
mysql -u user -p database < query.sql

# Check profile
mysql -u user -p database -e "SHOW PROFILE;"
```

**Solution:**
```bash
# Add indexes
ALTER TABLE sessions ADD INDEX idx_user_id (user_id);

# Reduce result set
SELECT * FROM sessions WHERE user_id = 123 LIMIT 1000;

# Use appropriate query
# - Avoid SELECT * unless necessary
# - Use COUNT() instead of fetching all rows
# - Use aggregate functions on database, not in application
```

---

## High Memory Usage Diagnosis

### Symptoms

- Memory usage > 80% of limit
- OOMKilled pods (Kubernetes)
- Container restart loops
- Swap usage > 0

### Diagnosis Procedure

```bash
#!/bin/bash
# diagnose_memory.sh

echo "=== HIGH MEMORY USAGE DIAGNOSIS ==="

# 1. Overall memory usage
echo "System memory:"
free -h

# 2. Container memory usage
echo "Container memory:"
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 3. Process memory breakdown
echo "Process memory:"
ps aux --sort=-%mem | head -10

# 4. Detailed container memory
echo "Container memory details:"
cat /sys/fs/cgroup/memory/docker/*/memory.stat | grep "total_"

# 5. Check for leaks (memory growing over time)
echo "Memory trend (every 10 seconds for 1 minute):"
for i in {1..6}; do
  docker stats --no-stream basset-hound --format "{{.MemUsage}}"
  sleep 10
done
```

### High Memory - Root Causes and Solutions

#### Cause 1: Memory Leak
**Diagnosis:**
```bash
# Generate heap dump
docker exec basset-hound npm run heap-dump

# Analyze with heap analyzer
# - Open in Chrome DevTools
# - Look for Detached DOM nodes
# - Look for circular references
# - Look for unreleased event listeners
```

**Solution:**
```bash
# Fix memory leak in application
# - Remove event listeners on cleanup
# - Nullify references when done
# - Use WeakMap for caches

# Increase garbage collection frequency
docker run ... -e NODE_OPTIONS="--expose-gc" \
  -e NODE_OPTIONS="--gc-interval=5000" basset-hound

# Scale horizontally (restart frequently)
docker run ... --restart on-failure:3 basset-hound
```

#### Cause 2: Large In-Memory Cache
**Diagnosis:**
```bash
# Check cache size
docker exec basset-hound redis-cli INFO memory

# Check hot cache entries
docker exec basset-hound redis-cli --bigkeys
```

**Solution:**
```bash
# Reduce cache retention
# - Set TTL on cache entries
# - Limit cache size

# Use LRU eviction policy
docker exec basset-hound redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Move to external cache
# - Use Redis cluster
# - Use memcached
# - Use separate cache servers
```

#### Cause 3: Large Dataset in Memory
**Diagnosis:**
```bash
# Check what data is loaded
docker logs basset-hound | grep -i "loading\|buffering\|caching"

# Analyze heap dump for large objects
```

**Solution:**
```bash
# Stream data instead of loading all
# - Use cursor-based pagination
# - Use iterator pattern
# - Process in batches

# Reduce batch size
# - Load 1000 records instead of 10000
# - Process incrementally

# Use external storage
# - Offload to database
# - Use message queue
```

#### Cause 4: Buffer Bloat
**Diagnosis:**
```bash
# Check buffer size
docker exec basset-hound lsof -p PID | grep -i buf

# Monitor network buffers
cat /proc/sys/net/ipv4/tcp_rmem  # Read buffer
cat /proc/sys/net/ipv4/tcp_wmem  # Write buffer
```

**Solution:**
```bash
# Reduce buffer sizes
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"

# Implement backpressure
// Don't queue requests, respond with 503 if overloaded
if (queue.length > threshold) {
  response.status(503).send('Service busy');
}
```

---

## Database Performance Issues

### Slow Query Diagnosis

```bash
# Enable slow query logging
mysql -u root -p database
mysql> SET GLOBAL slow_query_log = 'ON';
mysql> SET GLOBAL long_query_time = 0.1;
mysql> SET GLOBAL log_queries_not_using_indexes = 'ON';

# Analyze slow queries
mysqldumpslow -s at /var/log/mysql/slow-query.log | head -20

# Check query execution plan
EXPLAIN SELECT * FROM sessions WHERE user_id = 123;

# Look for:
# - Using filesort (no index)
# - Using temporary (no index)
# - Rows examined > 1000
```

### Index Optimization

```sql
-- Find missing indexes
SELECT object_schema, object_name, COUNT(*) as count
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NULL AND object_schema != 'mysql'
GROUP BY object_schema, object_name
ORDER BY count DESC;

-- Create indexes
CREATE INDEX idx_user_id ON sessions(user_id);
CREATE INDEX idx_created_at ON sessions(created_at DESC);
CREATE INDEX idx_composite ON sessions(user_id, created_at);

-- Monitor index usage
SELECT object_name, index_name, COUNT_READ, COUNT_WRITE
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema != 'mysql'
ORDER BY COUNT_READ DESC;
```

### Connection Pool Tuning

```javascript
// Basset Hound configuration
const pool = mysql.createPool({
  connectionLimit: 20,      // Max connections
  waitForConnections: true,
  queueLimit: 0,            // Queue all requests
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

// Monitor pool
pool.query('SELECT 1', (error, results) => {
  const poolStats = pool._cluster.getPoolStats();
  console.log('Pool stats:', poolStats);
  // Adjust connectionLimit based on usage
});
```

---

## Network Bottlenecks

### Diagnosis

```bash
# Network interface statistics
ethtool -S eth0

# Active connections
netstat -an | grep ESTABLISHED | wc -l

# Network throughput
iftop -i eth0 -n

# Bandwidth usage
bwm-ng -i eth0

# Check for packet loss
ping -c 100 database.internal | grep "loss"

# Check DNS resolution time
time nslookup database.internal
```

### Solutions

**Connection Pooling:**
```javascript
// Reuse connections
const pool = mysql.createPool({
  connectionLimit: 20,
  enableKeepAlive: true
});
```

**Connection Compression:**
```javascript
// Enable compression for large responses
const options = {
  compression: 'gzip',
  threshold: 1024  // Compress > 1KB
};
```

**Batching:**
```javascript
// Batch multiple requests
const batch = [
  { id: 1, action: 'read' },
  { id: 2, action: 'read' },
  { id: 3, action: 'read' }
];

connection.query('SELECT * FROM users WHERE id IN (?)', [batch.map(b => b.id)]);
```

---

## Query Optimization

### SELECT Query Optimization

```sql
-- BAD: Selects all columns
SELECT * FROM sessions;

-- GOOD: Select only needed columns
SELECT id, user_id, created_at FROM sessions;

-- BETTER: Add WHERE clause
SELECT id, user_id FROM sessions WHERE user_id = 123 LIMIT 1000;

-- BEST: Use covering index
CREATE INDEX idx_sessions_v2 ON sessions(user_id, id);
SELECT id FROM sessions WHERE user_id = 123 LIMIT 1000;
```

### JOIN Query Optimization

```sql
-- Use EXISTS instead of IN (for large datasets)
SELECT s.* FROM sessions s
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id AND u.active = 1);

-- Use JOIN instead of subquery
SELECT s.* FROM sessions s
INNER JOIN users u ON s.user_id = u.id
WHERE u.active = 1;

-- Use INNER JOIN instead of LEFT JOIN (if null not possible)
SELECT s.* FROM sessions s
INNER JOIN users u ON s.user_id = u.id;
```

### Aggregation Optimization

```sql
-- Let database do aggregation
SELECT user_id, COUNT(*) as session_count
FROM sessions
GROUP BY user_id;

-- Don't fetch all rows and count in application
-- SELECT * FROM sessions LIMIT 1000000  -- DON'T DO THIS
```

---

## Caching Strategy Tuning

### Redis Configuration

```bash
# Check memory usage
redis-cli INFO memory

# Set memory limit and eviction
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Optimize for workload
redis-cli CONFIG SET hz 10              # Lazy free
redis-cli CONFIG SET tcp-backlog 1000   # Connection queue

# Monitor key eviction
redis-cli INFO stats | grep evicted
```

### Cache Invalidation Strategy

```javascript
// TTL-based (automatic expiration)
cache.set('user:123', userData, { ttl: 3600 }); // 1 hour

// Event-based (manual invalidation)
cache.invalidate('user:*');  // Invalidate all user caches
emitter.on('userUpdated', (userId) => {
  cache.invalidate(`user:${userId}`);
});

// LRU-based (size-limited cache)
const cache = new LRU({
  max: 10000,      // Max entries
  maxSize: 1000,   // Max memory (MB)
  ttl: 3600000     // 1 hour TTL
});
```

### Multi-Level Caching

```javascript
// Application memory cache (fast, small)
const appCache = new LRU({ max: 100 });

// Redis cache (larger, multi-instance)
const redisCache = redis.createClient();

// Database (source of truth)

async function getData(key) {
  // Check application cache first
  let data = appCache.get(key);
  if (data) return data;

  // Check Redis cache
  data = await redisCache.get(key);
  if (data) {
    appCache.set(key, data);
    return data;
  }

  // Query database
  data = await database.query(key);
  
  // Populate caches
  appCache.set(key, data);
  await redisCache.set(key, data, 'EX', 3600);  // 1 hour
  
  return data;
}
```

---

## Diagnostic Commands

### Quick Diagnostics

```bash
# Memory snapshot
docker stats --no-stream basset-hound

# CPU usage
docker top basset-hound

# Open connections
netstat -an | grep :8765 | wc -l

# Error count (last hour)
docker logs --since 1h basset-hound | grep -i error | wc -l

# Slowest requests (last 100 logs)
docker logs --tail 100 basset-hound | grep -i "latency\|duration" | sort -t: -k2 -rn | head -10
```

### Performance Metrics Query

```bash
# Prometheus queries for metrics

# Current QPS (queries per second)
rate(http_requests_total[5m])

# Error rate percentage
(rate(errors_total[5m]) / rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(request_duration_seconds_bucket[5m]))

# Connection count
websocket_connections_active

# Memory trend
rate(container_memory_usage_bytes[5m])

# CPU usage percentage
rate(container_cpu_usage_seconds_total[5m]) * 100
```

---

## Quick Reference

| Issue | Symptom | Quick Check | Solution |
|-------|---------|-----------|----------|
| High Latency | Response > 500ms | Top slow requests | Optimize queries, scale out |
| High CPU | CPU > 70% | Top processes | Profile code, scale out |
| High Memory | Mem > 80% | Heap dump | Fix memory leak, scale out |
| Slow DB | Query > 100ms | Slow query log | Add indexes, optimize SQL |
| Network Issue | Packet loss | ping database | Check network, restart NIC |
| Lock Contention | Context switch spike | vmstat | Reduce lock scope |
| Cache Miss | No data in cache | Cache hit rate | Increase TTL, preload cache |
| Connection Pool Exhaustion | Connections queued | netstat | Increase pool size, optimize queries |

---

## Document Status

**Version:** 1.0  
**Created:** June 4, 2026  
**Last Updated:** June 4, 2026  
**Status:** Production Ready  
**Classification:** Internal Operations  

---

**End of Performance Troubleshooting Guide**
