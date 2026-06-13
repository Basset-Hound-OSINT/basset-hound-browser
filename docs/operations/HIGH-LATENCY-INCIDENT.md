# High Latency Incident Playbook

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  
**Owner:** Operations / Performance Engineering  

---

## Executive Summary

This playbook provides step-by-step procedures for diagnosing and resolving high latency incidents in production. High latency degrades user experience and can trigger cascading failures in dependent systems.

**Severity Classification:**
- **P2 (High):** P99 latency > 500ms, >20% of requests affected
- **P3 (Medium):** P99 latency 200-500ms, 5-20% of requests affected
- **P4 (Low):** P99 latency slightly elevated, <5% of requests affected

**Objective:** Reduce latency to baseline within 15-30 minutes

---

## Incident Detection & Initial Assessment (2-5 minutes)

### 1.1 Alert Confirmation

**Responsible Party:** On-Call Engineer  
**Time Box:** 2 minutes

#### 1.1.1 Alert Details

- [ ] Alert acknowledged
  - Alert time: __________
  - Threshold: P99 > 500ms
  - Actual value: __________ms
  - Duration: __________minutes

- [ ] Alert is not transient noise
  - Previous similar alerts: [ ] Yes [ ] No
  - Sustained > 1 minute: [ ] Yes [ ] No
  - Affecting multiple endpoints: [ ] Yes [ ] No

#### 1.1.2 Scope of Impact

- [ ] Which endpoints affected
  - API endpoint: __________
  - Latency: __________ms
  - Percentage of requests: _________%

- [ ] Geographic scope
  - All regions: [ ] Yes [ ] No
  - Specific regions: __________

- [ ] Estimate customer impact
  - Active users: __________
  - Estimated affected: __________%

### 1.2 Gather Initial Telemetry (3 minutes)

**Responsible Party:** On-Call Engineer  
**Time Box:** 3 minutes

#### 1.2.1 Application Metrics

```bash
# Check latency percentiles
curl -s http://prometheus:9090/api/v1/query?query=http_request_latency_p99 | jq .

# Check error rates (are errors correlated?)
curl -s http://prometheus:9090/api/v1/query?query=http_requests_total | jq .

# Check request volume (did traffic spike?)
curl -s http://prometheus:9090/api/v1/query?query=http_requests_per_second | jq .
```

- [ ] P99 latency: __________ms (was __________ms)
- [ ] Error rate: _________% (baseline: ___%)
- [ ] Request volume: __________req/s (baseline: ___req/s)
- [ ] Traffic spike: [ ] Yes [ ] No

#### 1.2.2 Infrastructure Metrics

```bash
# Check CPU utilization
curl -s http://prometheus:9090/api/v1/query?query=node_cpu_usage | jq .

# Check memory utilization
curl -s http://prometheus:9090/api/v1/query?query=node_memory_usage_percent | jq .

# Check disk I/O
curl -s http://prometheus:9090/api/v1/query?query=node_disk_io_seconds | jq .
```

- [ ] CPU usage: _________% (baseline: ___%)
- [ ] Memory usage: _________% (baseline: ___%)
- [ ] Disk I/O: __________ms (baseline: ___ms)

#### 1.2.3 Database Metrics

```bash
# Check database response time
curl -s http://prometheus:9090/api/v1/query?query=db_query_duration_p99 | jq .

# Check database connection pool
curl -s http://prometheus:9090/api/v1/query?query=db_connection_pool_usage | jq .

# Check database locks
curl -s http://prometheus:9090/api/v1/query?query=db_lock_wait_time | jq .
```

- [ ] Database P99 latency: __________ms
- [ ] Connection pool usage: __________% full
- [ ] Lock wait time: __________ms

---

## Root Cause Investigation (5-15 minutes)

### 2.1 Diagnostic Path Selection

**Based on initial telemetry, select appropriate diagnostic path:**

#### 2.1.1 Path A: Application-Level (High CPU, Memory, or Request Volume)

**Indicators:**
- High CPU utilization (>80%)
- High memory utilization (>85%)
- Request volume spike
- Error rate increase (potential timeouts)

**Proceed to Section 2.2**

#### 2.1.2 Path B: Database-Level (High DB Query Latency or Lock Waits)

**Indicators:**
- Database P99 latency elevated
- Lock wait times increasing
- Database connection pool nearly exhausted
- Slow query logs showing suspicious queries

**Proceed to Section 2.3**

#### 2.1.3 Path C: Infrastructure-Level (Hardware Performance)

**Indicators:**
- Disk I/O very high (>50ms)
- Network latency elevated
- GC pauses visible in logs
- No other obvious culprits

**Proceed to Section 2.4**

#### 2.1.4 Path D: External Dependency (Third-party Services)

**Indicators:**
- No internal metrics elevated
- Upstream service call latency high
- External API calls timing out
- Network connectivity to external service degraded

**Proceed to Section 2.5**

---

### 2.2 Diagnostic Path A: Application-Level Issues

#### 2.2.1 CPU Hotspot Analysis

- [ ] Identify CPU-intensive operations
  - Command: `docker stats basset-hound-browser --no-stream`
  - CPU usage: __________%
  - Single thread or multi-threaded: __________

- [ ] Analyze CPU-consuming code
  - Profiling: Check current flame graph
  - Top functions: __________
  - Percentage of CPU: __________%

- [ ] Check for known CPU consumers
  - [ ] JavaScript parsing/compilation (V8)
  - [ ] Regular expressions (complex pattern matching)
  - [ ] Image processing or heavy computation
  - [ ] Recursive algorithms or loops

**Common fixes:**
- Reduce complexity of regex patterns
- Move heavy computation to background queue
- Add caching for computed results
- Optimize loop efficiency

#### 2.2.2 Memory Pressure Analysis

- [ ] Check garbage collection events
  - Command: `docker logs basset-hound-browser | grep -i "gc"`
  - GC pause duration: __________ms
  - GC frequency: Every __________ seconds

- [ ] Identify memory leaks
  - Command: `node --inspect basset-hound-browser`
  - Object count trending up: [ ] Yes [ ] No
  - Detached DOM nodes: __________
  - Unclosed resources: __________

- [ ] Check memory allocation patterns
  - Large allocations: __________
  - Array accumulation: __________
  - Buffer retention: __________

**Common fixes:**
- Implement object pooling
- Clear event listeners on cleanup
- Implement size limits on caches
- Add memory monitoring and alerts

#### 2.2.3 Request Queue Analysis

- [ ] Check request queuing
  - Queued requests: __________
  - Queue size: __________
  - Average queue time: __________ms

- [ ] Identify bottleneck operations
  - Slow middleware: __________
  - Slow route handlers: __________
  - Blocking I/O operations: __________

**Common fixes:**
- Increase worker pool size
- Optimize middleware chain
- Move blocking I/O to async
- Implement request prioritization

#### 2.2.4 Known Application Issues

```
HIGH CPU:
├─ Regex compilation in hot path
├─ Inefficient DOM queries
├─ Heavy JSON parsing
├─ Unoptimized sorting/filtering
└─ Infinite loops in event handlers

MEMORY PRESSURE:
├─ Event listener accumulation
├─ Circular reference chains
├─ Unbounded caches
├─ Large buffer retention
└─ Memory leak in third-party library

REQUEST QUEUEING:
├─ Slow database queries blocking requests
├─ Synchronous file I/O
├─ External API timeouts
├─ Thread pool starvation
└─ Lock contention in multi-threaded code
```

---

### 2.3 Diagnostic Path B: Database-Level Issues

#### 2.3.1 Query Performance Analysis

- [ ] Identify slow queries
  - Command: `SHOW PROCESSLIST; SHOW FULL PROCESSLIST;` (MySQL)
  - Slow query log enabled: [ ] Yes [ ] No
  - Top slow queries: __________

- [ ] Analyze query execution plans
  - Command: `EXPLAIN [slow query]`
  - Full table scans: [ ] Yes [ ] No
  - Using indexes: [ ] Yes [ ] No
  - Row estimate: __________

- [ ] Check query volume increase
  - Queries per second: __________
  - Queries per second baseline: __________
  - Spike magnitude: __________x

**Common slow query patterns:**
- `SELECT * FROM large_table WHERE complex_condition` (no index)
- `JOIN without proper indexes` (expensive join)
- `N+1 queries` (one query per row)
- `Cartesian product` (unfiltered cross join)

#### 2.3.2 Lock Analysis

- [ ] Check for lock contention
  - Command: `SHOW OPEN TABLES WHERE In_use > 0;`
  - Tables with locks: __________
  - Lock wait time: __________ms
  - Blocked queries: __________

- [ ] Identify lock-causing queries
  - Command: `SELECT * FROM information_schema.INNODB_LOCKS;`
  - Lock holder: __________
  - Lock waiter: __________
  - Lock type: __________

- [ ] Check for deadlocks
  - Command: `SHOW ENGINE INNODB STATUS;` (look for DEADLOCK section)
  - Recent deadlocks: __________
  - Frequency: __________per minute

**Common lock issues:**
- Long-running transaction holding locks
- Update query locking entire table
- Implicit locks from SELECT FOR UPDATE
- Deadlock between transactions A and B

#### 2.3.3 Connection Pool Issues

- [ ] Check connection pool status
  - Total connections: __________/limit
  - Active connections: __________
  - Idle connections: __________
  - Connection wait time: __________ms

- [ ] Identify connection leaks
  - Command: Check application logs for unclosed connections
  - Connections not being returned: [ ] Yes [ ] No
  - Leak location: __________

**Common connection issues:**
- Connection pool exhaustion from slow queries
- Connection leak in error handling path
- Timeout in connection acquisition
- Too small connection pool size

#### 2.3.4 Replication Lag (if applicable)

- [ ] Check replica status
  - Command: `SHOW SLAVE STATUS;`
  - Seconds behind master: __________seconds
  - Lag threshold: 5 seconds
  - Status: [ ] Healthy [ ] Lagging [ ] Stopped

- [ ] Identify replication bottleneck
  - Single-threaded replication: [ ] Yes [ ] No
  - Large transaction in write-ahead log: [ ] Yes [ ] No
  - Network latency to replica: __________ms

**Common replication issues:**
- Single-threaded replication with high write volume
- Large DELETE/UPDATE queries
- Network latency between primary and replica

#### 2.3.5 Known Database Issues

```
SLOW QUERIES:
├─ Missing index on commonly filtered column
├─ Full table scan on large table
├─ Complex JOIN without proper indexes
├─ N+1 query pattern (app fetching rows one by one)
└─ GROUP BY without index on grouped column

LOCK CONTENTION:
├─ Long transaction holding table lock
├─ UPDATE without WHERE clause
├─ SELECT FOR UPDATE on high-concurrency table
├─ Deadlock cycle between two transactions
└─ Implicit locks from unique constraint check

CONNECTION POOL:
├─ Connections not being returned (leak)
├─ Pool size too small for load
├─ Queries timing out (not returning connections)
├─ Connection acquisition contention
└─ Connection idle timeout too short
```

---

### 2.4 Diagnostic Path C: Infrastructure-Level Issues

#### 2.4.1 Disk I/O Analysis

- [ ] Check disk I/O metrics
  - Command: `iostat -x 1` (Linux)
  - % util: __________% (high: >70%)
  - Read latency: __________ms
  - Write latency: __________ms

- [ ] Identify I/O-intensive processes
  - Command: `iotop` (Linux)
  - Top I/O consumer: __________
  - I/O rate: __________MB/s

- [ ] Check database I/O
  - Command: `SHOW STATUS LIKE 'Innodb_pages_read'` (MySQL)
  - Pages read per second: __________
  - Pages written per second: __________

**Common I/O issues:**
- Swap usage (page faults)
- Full disk (no more space for writes)
- Hardware failure (intermittent I/O)
- Large temporary tables being created

#### 2.4.2 Network Latency Analysis

- [ ] Check network interface
  - Command: `ethtool -S [interface]` or `ifstat`
  - Packet loss: __________%
  - Collisions: __________
  - Errors: __________

- [ ] Check network latency to dependencies
  - Command: `ping [database-host]`
  - Latency: __________ms
  - Packet loss: __________%

- [ ] Check connection tracking table
  - Command: `nstat -a | grep -i tcp`
  - TCP retransmits: __________
  - TCP timeouts: __________

**Common network issues:**
- Network congestion
- Packet loss on WAN links
- DNS resolution slow
- Routing inefficiency

#### 2.4.3 Garbage Collection Analysis

- [ ] Check JVM GC pauses (if Java)
  - Command: Check GC logs
  - GC pause time: __________ms
  - GC frequency: Every __________ seconds
  - Full GC: [ ] Yes [ ] No

- [ ] Check JavaScript GC (if Node.js)
  - Command: `node --trace-gc app.js`
  - Mark-sweep pauses: __________ms
  - Frequency: Every __________ seconds

**Common GC issues:**
- Heap too small (frequent GC)
- Large objects causing full GC
- GC tuning suboptimal

#### 2.4.4 Known Infrastructure Issues

```
DISK I/O:
├─ Disk nearly full (>90%)
├─ Swap in use (performance cliff)
├─ Database working set > RAM
├─ Lots of temporary file creation
└─ Slow disk or hardware failure

NETWORK:
├─ Network saturation (>80% utilization)
├─ Packet loss on specific route
├─ DNS resolution slow
├─ Connection tracking table exhaustion
└─ BGP route flapping

GC PAUSES:
├─ Heap too small relative to load
├─ Large object allocations
├─ Old generation collection needed
├─ GC pause time > acceptable latency
└─ Concurrent marking can't keep up
```

---

### 2.5 Diagnostic Path D: External Dependency Issues

#### 2.5.1 External API Latency

- [ ] Identify slow external calls
  - Command: Analyze request logs for external API calls
  - External API: __________
  - Latency: __________ms
  - Baseline latency: __________ms
  - Degradation: __________ms

- [ ] Check external service status
  - Status page: __________
  - Reported issues: __________
  - Our connectivity: [ ] Normal [ ] Degraded [ ] Down

- [ ] Network path to external service
  - Command: `traceroute [external-api-host]`
  - Hops to external: __________
  - Latency per hop: __________
  - Slow hop: __________

**Common external dependency issues:**
- External API experiencing outage/degradation
- Our network path to external is degraded
- External API rate limiting our requests
- Increased timeout due to geographical distance

#### 2.5.2 Upstream Service Dependencies

- [ ] Identify internal service dependencies
  - Services called by main API: __________
  - Latency per service: __________ms
  - Slowest service: __________

- [ ] Check health of dependent services
  - Service 1: [ ] Healthy [ ] Degraded [ ] Down
  - Service 2: [ ] Healthy [ ] Degraded [ ] Down
  - Service 3: [ ] Healthy [ ] Degraded [ ] Down

**Common upstream issues:**
- Dependent service under high load
- Dependent service has bug (infinite loop, leak)
- Dependent service database issues

---

## Root Cause Confirmation (2-5 minutes)

### 3.1 Root Cause Statement

**Fill in the determined root cause:**

```
Root Cause: [Path A/B/C/D - Specific issue]

Evidence:
1. __________
2. __________
3. __________

Affected:
- Endpoints: __________
- Users: __________%
- Duration: __________minutes

Impact:
- Latency increase: __________ms (from __________ms to __________ms)
- Request success rate: __________%
```

### 3.2 Confidence Level

- [ ] **High (90%+):** Clear evidence of root cause
- [ ] **Medium (70-90%):** Strong indicators but not definitive
- [ ] **Low (<70%):** Multiple possibilities, needs further investigation

---

## Resolution Implementation (5-20 minutes)

### 4.1 Resolution Options by Path

#### 4.1.1 Path A: Application Fixes

**High CPU:**
- [ ] Deploy CPU optimization fix
- [ ] Restart application (triggers fix)
- [ ] Monitor CPU usage

**High Memory:**
- [ ] Increase memory limit (temporary)
- [ ] Deploy memory leak fix
- [ ] Monitor memory usage

**Request Queueing:**
- [ ] Increase worker pool size
- [ ] Optimize slow operation
- [ ] Add request prioritization

#### 4.1.2 Path B: Database Fixes

**Slow Queries:**
- [ ] Add missing index: `CREATE INDEX ... ON ...;`
- [ ] Kill long-running query: `KILL [query_id];`
- [ ] Optimize query structure
- [ ] Cache query results

**Lock Contention:**
- [ ] Kill blocking query: `KILL [query_id];`
- [ ] Optimize transaction duration
- [ ] Split transaction into smaller ones

**Connection Pool:**
- [ ] Increase pool size (if under-provisioned)
- [ ] Identify and fix connection leak
- [ ] Reduce query timeout to fail fast

**Replication Lag:**
- [ ] Optimize slow query on primary
- [ ] Increase replica resources
- [ ] Enable parallel replication (MySQL 5.7+)

#### 4.1.3 Path C: Infrastructure Fixes

**Disk I/O:**
- [ ] Clear temporary files: `rm -rf /tmp/*`
- [ ] Increase available disk space
- [ ] Disable swap if causing issues
- [ ] Add more RAM to reduce paging

**Network:**
- [ ] Verify network connectivity: `ping [host]`
- [ ] Check routing: `traceroute [host]`
- [ ] Increase network timeout thresholds
- [ ] Failover to different network path (if available)

**Garbage Collection:**
- [ ] Increase heap size (temporary)
- [ ] Tune GC parameters
- [ ] Reduce memory pressure

#### 4.1.4 Path D: External Dependency Fixes

**External API Latency:**
- [ ] Implement request caching
- [ ] Use circuit breaker (fail fast)
- [ ] Add retry with exponential backoff
- [ ] Fallback to cached/stale data

**Upstream Service Issues:**
- [ ] Scale up upstream service
- [ ] Enable circuit breaker to fail fast
- [ ] Fallback to alternative service (if available)
- [ ] Implement request batching

### 4.2 Mitigation Strategies (If Root Cause Fix Takes Time)

**Apply while working on permanent fix:**

- [ ] **Request Rate Limiting:** Limit requests per user
  - Prevents cascading failures
  - Preserves service for other users

- [ ] **Caching:** Increase cache TTL temporarily
  - Reduces load on slow backend
  - Trades freshness for speed

- [ ] **Circuit Breaker:** Fail fast on slow dependencies
  - Prevents request pile-up
  - Allows service to recover

- [ ] **Request Queuing:** Implement priority queue
  - High-priority requests get through
  - Low-priority requests queued

- [ ] **Graceful Degradation:** Disable non-critical features
  - Reduce load on critical path
  - Restore service availability

---

## Verification & Resolution Confirmation (5 minutes)

### 5.1 Verify Latency Improvement

- [ ] Latency metrics retrieved
  - Command: `curl -s http://prometheus:9090/api/v1/query?query=http_request_latency_p99 | jq .`
  - P99 latency: __________ms
  - Target: <200ms (or previous baseline)
  - Status: [ ] Resolved [ ] Improving [ ] Still elevated

- [ ] Error rates normal
  - Current error rate: __________%
  - Expected: <0.1%
  - Status: [ ] Normal [ ] Slightly elevated [ ] High

- [ ] Request volume normalized
  - Current: __________req/s
  - Baseline: __________req/s
  - Status: [ ] Normal [ ] Elevated [ ] Exceeds capacity

### 5.2 Impact Assessment

- [ ] Customer impact ended
  - Affected users can now access service: [ ] Yes [ ] No
  - Service quality restored: [ ] Yes [ ] No

- [ ] Dependent services recovered
  - All downstream services healthy: [ ] Yes [ ] No
  - No cascading failures: [ ] Confirmed [ ] Need verification

### 5.3 Incident Closure

- [ ] Incident marked as RESOLVED
  - Incident ID: __________
  - Resolution time: __________minutes (from alert to resolution)
  - Severity: P2 / P3 / P4

- [ ] Postmortem scheduled (if P2)
  - Meeting time: __________
  - Participants: __________

---

## Prevention & Learning

### 6.1 Why-5 Analysis (Root Cause)

**Question:** Why did this latency spike occur?

1. **Why?** __________
2. **Why?** __________
3. **Why?** __________
4. **Why?** __________
5. **Why?** __________

### 6.2 Preventive Measures

**Actions to prevent recurrence:**

- [ ] Add index to database
  - Query: __________
  - Index: __________
  - Impact: __________%
  - Priority: [ ] High [ ] Medium [ ] Low

- [ ] Optimize application code
  - Function: __________
  - Optimization: __________
  - Expected improvement: __________

- [ ] Increase resource limits
  - Resource: __________
  - Current limit: __________
  - New limit: __________
  - Reason: __________

- [ ] Improve monitoring/alerting
  - New metric: __________
  - Alert threshold: __________
  - Lead time: __________ minutes before impact

- [ ] Add circuit breaker
  - Service: __________
  - Threshold: __________
  - Fallback: __________

---

## Appendix A: Quick Reference - Common Fixes

| Issue | Quick Fix | Verify |
|-------|-----------|--------|
| High CPU | Restart app | CPU drops <50% |
| High Memory | Increase limit | Memory <80% |
| Slow Query | Add index | Query latency <100ms |
| Lock Wait | Kill blocking query | Lock wait <10ms |
| Connection Pool | Increase size | Connections acquired quickly |
| Network Latency | Check connectivity | Ping <50ms |
| External API Slow | Enable cache | Reduce calls by 50% |

---

## Appendix B: Diagnostic Commands Cheat Sheet

```bash
# Application metrics
curl -s http://prometheus:9090/api/v1/query?query=http_request_latency_p99

# CPU usage
docker stats --no-stream
top -b -n 1

# Memory
free -h
docker stats --no-stream

# Disk I/O
iostat -x 1
iotop

# Database
mysql -e "SHOW PROCESSLIST"
mysql -e "SHOW OPEN TABLES WHERE In_use > 0"
mysql -e "SHOW ENGINE INNODB STATUS"

# Network
ping [host]
traceroute [host]
netstat -an | grep ESTABLISHED | wc -l

# Logs
docker logs [container] --tail 100
tail -f /var/log/application.log | grep ERROR
```

---

## Appendix C: Escalation Matrix

| Time | Action | Escalate To |
|------|--------|-------------|
| T+5m | Investigate | L1 on-call |
| T+10m | Implement fix | L2 engineering lead |
| T+15m | If not improving | L3 infrastructure |
| T+30m | If not resolved | VP Engineering |
| T+60m | If still ongoing | CTO |
