# Basset Hound Browser - Performance Tuning Checklists

**Version:** 1.0  
**Date:** May 7, 2026  
**Target:** Deployment and ongoing optimization for multi-agent environments

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Haiku Agent Setup](#haiku-agent-setup)
3. [Sonnet Agent Setup](#sonnet-agent-setup)
4. [Opus Agent Setup](#opus-agent-setup)
5. [Production Monitoring Setup](#production-monitoring-setup)
6. [Performance Verification](#performance-verification)
7. [Troubleshooting Checklist](#troubleshooting-checklist)
8. [Monthly Optimization Review](#monthly-optimization-review)

---

## Pre-Deployment Checklist

### Infrastructure Setup

- [ ] **Browser Server**
  - [ ] Basset Hound Browser v11.1.0+ installed
  - [ ] WebSocket server listening on port 8765
  - [ ] TLS/SSL enabled (wss://) if required
  - [ ] Authentication token configured
  - [ ] Docker container memory limit set to 2GB minimum
  - [ ] Network connectivity verified (ping successful)

- [ ] **Connection Pool Configuration**
  - [ ] Window pool size: 5-10 (adjust for agent count)
  - [ ] Min pool size: 2
  - [ ] Max pool size: 10
  - [ ] Health check interval: 60 seconds
  - [ ] Connection timeout: 30 seconds
  - [ ] Idle timeout: 5 minutes

- [ ] **Memory Management**
  - [ ] Memory monitoring enabled
  - [ ] Garbage collection configured
  - [ ] Memory alert thresholds set (500MB warning, 800MB critical)
  - [ ] Heap snapshot capability verified

- [ ] **Logging and Monitoring**
  - [ ] WebSocket server logging enabled
  - [ ] Error recovery config verified (max retries: 3, delay: 1000ms)
  - [ ] Profiler/metrics collection configured
  - [ ] Log rotation configured (daily or 100MB)

### Agent Prerequisites

- [ ] **Claude API Setup**
  - [ ] API keys configured for Haiku/Sonnet/Opus
  - [ ] Rate limits documented (see Anthropic dashboard)
  - [ ] Cost monitoring enabled (CloudWatch, billing alerts)
  - [ ] Token counter library installed (for token tracking)

- [ ] **Caching Infrastructure** (if using)
  - [ ] Redis instance deployed (if 3+ agents)
  - [ ] Redis memory limit: 500MB-2GB
  - [ ] Redis persistence (RDB/AOF) configured
  - [ ] Redis connection pooling tested

- [ ] **Network Configuration**
  - [ ] Browser ↔ Agent latency <50ms (measure with ping)
  - [ ] Firewall rules allow WebSocket on port 8765
  - [ ] DNS resolution verified
  - [ ] Proxy/VPN setup (if needed) tested

---

## Haiku Agent Setup

### Configuration Checklist

**Deployment Profile:**
- [ ] Model: `claude-3-5-haiku-20241022`
- [ ] Batch size: 100 (maximum throughput)
- [ ] Concurrent operations: 10-15
- [ ] Cache TTL: 1 hour (aggressive refresh)
- [ ] Capture mode: Minimal (nav + title + URL)

**Code Configuration:**

```python
# haiku_config.py
HAIKU_OPTIMIZATION = {
    'batch_size': 100,
    'concurrent_operations': 15,
    'cache_ttl_seconds': 3600,
    'timeout_multiplier': 1.0,
    'screenshot_mode': 'minimal',
    'error_retry_attempts': 3,
    'operation_timeout_ms': 30000,
}

BROWSER_CONFIG = {
    'pool_size': 8,
    'min_pool': 2,
    'max_pool': 10,
    'health_check_interval': 60000,
}
```

- [ ] Configuration file created and verified
- [ ] Default values meet recommendations
- [ ] Custom overrides documented

**Performance Targets:**
- [ ] Throughput: 300+ ops/sec in batches
- [ ] P95 latency: <250ms per operation
- [ ] Error rate: <3%
- [ ] Memory: <500MB heap
- [ ] Cost: <$0.002 per operation

**Startup Verification:**

```bash
# Test 1: Basic connectivity
curl -s ws://localhost:8765/ping

# Test 2: Throughput test
python scripts/benchmark_haiku.py --operations 1000 --batch 100

# Test 3: Memory stability
python scripts/memory_test.py --duration 300 --operations-per-sec 100
```

- [ ] Connectivity test passes
- [ ] Throughput test achieves >300 ops/sec
- [ ] Memory test shows stable heap (<100MB growth over 5 min)

### Monitoring Setup

**Metrics Dashboard:**

- [ ] Operations per second graph
- [ ] Latency percentiles (P50, P95, P99)
- [ ] Error rate trend
- [ ] Memory usage graph
- [ ] Cache hit rate
- [ ] Cost trend ($/day)

**Alert Configuration:**

| Alert | Threshold | Action |
|-------|-----------|--------|
| Throughput drops | <100 ops/sec | Investigate latency |
| P95 latency spikes | >500ms | Check network/browser |
| Error rate | >5% | Review failed operations |
| Memory | >600MB | Restart pool, check leak |
| Cache hit rate | <10% | Increase cache TTL |

- [ ] Alerts configured in monitoring system
- [ ] Alert recipients configured (email, Slack)
- [ ] Escalation procedures documented

### Cost Monitoring

- [ ] Cost per operation tracked daily
- [ ] Expected daily cost: ~$0.02 per 1000 ops
- [ ] Monthly budget: $0.59 for 1000 daily ops
- [ ] Cost anomalies trigger review

---

## Sonnet Agent Setup

### Configuration Checklist

**Deployment Profile:**
- [ ] Model: `claude-3-5-sonnet-20241022`
- [ ] Batch size: 75 (balanced throughput)
- [ ] Concurrent operations: 8-10
- [ ] Cache TTL: 12 hours
- [ ] Capture mode: Standard (nav + content + links)

**Code Configuration:**

```python
# sonnet_config.py
SONNET_OPTIMIZATION = {
    'batch_size': 75,
    'concurrent_operations': 10,
    'cache_ttl_seconds': 43200,  # 12 hours
    'timeout_multiplier': 1.2,
    'screenshot_mode': 'viewport',
    'error_retry_attempts': 3,
    'operation_timeout_ms': 35000,
}

BROWSER_CONFIG = {
    'pool_size': 7,
    'min_pool': 2,
    'max_pool': 8,
    'health_check_interval': 60000,
}
```

- [ ] Configuration file created
- [ ] Timeout multiplier accounts for more complex analysis
- [ ] Screenshot mode set to viewport (balance quality/size)

**Performance Targets:**
- [ ] Throughput: 150-200 ops/sec in batches
- [ ] P95 latency: <400ms per operation
- [ ] Error rate: <2%
- [ ] Memory: <700MB heap
- [ ] Cost: <$0.015 per operation

**Startup Verification:**

```bash
# Test 1: Complex workflow test
python scripts/benchmark_sonnet.py --workflow standard --operations 500

# Test 2: Error handling
python scripts/test_error_recovery.py --attempts 3

# Test 3: Cache effectiveness
python scripts/test_cache.py --repeated-urls 100 --checks 5
```

- [ ] Standard workflow latency: 200-400ms per operation
- [ ] Error recovery: All 3 retries succeed, final rate >98%
- [ ] Cache hit rate: >50% with 5 repeated checks

### Optimization Steps

- [ ] Enable distributed caching if 3+ agents
- [ ] Configure Redis connection pool
- [ ] Set cache key namespacing (avoid collisions)
- [ ] Monitor cache hit rate daily

### Monitoring Setup

**Key Metrics:**

- [ ] Operations per second (expect 150-200)
- [ ] Latency percentiles (P50, P95, P99)
- [ ] Cache hit rate (expect 40-60%)
- [ ] Memory usage stability
- [ ] Token usage (for cost tracking)

**Dashboard Examples:**

```
Sonnet Agent Dashboard (Real-Time)
├─ Throughput: 187 ops/sec ✓
├─ P95 Latency: 356ms ✓
├─ Cache Hit Rate: 54% ✓
├─ Memory: 523MB ✓
├─ Errors: 1.2% ✓
└─ Cost: $4.11/day (30K ops)
```

- [ ] Dashboard created and populated
- [ ] Baseline metrics established
- [ ] Anomaly detection configured

### Integration Verification

- [ ] MCP server connectivity verified
- [ ] Token counting working
- [ ] Error recovery tested
- [ ] Parallel agent operation verified (if using multiple agents)

---

## Opus Agent Setup

### Configuration Checklist

**Deployment Profile:**
- [ ] Model: `claude-opus-4-1-20250805` (or latest)
- [ ] Batch size: 50 (moderate, allow thinking time)
- [ ] Concurrent operations: 5-8
- [ ] Cache TTL: 24 hours (less frequent refresh)
- [ ] Capture mode: Full (all extractions + context)

**Code Configuration:**

```python
# opus_config.py
OPUS_OPTIMIZATION = {
    'batch_size': 50,
    'concurrent_operations': 6,
    'cache_ttl_seconds': 86400,  # 24 hours
    'timeout_multiplier': 1.5,   # Extra time for reasoning
    'screenshot_mode': 'full',   # Complete context
    'error_retry_attempts': 3,
    'operation_timeout_ms': 45000,  # 45 seconds
    'extended_thinking': True,   # Enable if available
}

BROWSER_CONFIG = {
    'pool_size': 6,
    'min_pool': 2,
    'max_pool': 8,
    'health_check_interval': 60000,
}
```

- [ ] Configuration optimizes for complex reasoning
- [ ] Timeout multiplier allows extra processing time
- [ ] Extended thinking enabled (for complex analysis)

**Performance Targets:**
- [ ] Throughput: 50-100 ops/sec
- [ ] P95 latency: <800ms per operation
- [ ] Error rate: <1%
- [ ] Memory: <800MB heap
- [ ] Cost: <$0.15 per operation

**Startup Verification:**

```bash
# Test 1: Complex reasoning test
python scripts/benchmark_opus.py --complexity complex --operations 100

# Test 2: Extended thinking
python scripts/test_extended_thinking.py --scenarios 10

# Test 3: Recovery from errors
python scripts/test_complex_error_recovery.py
```

- [ ] Complex reasoning achieves >95% success
- [ ] Extended thinking working (if enabled)
- [ ] Error recovery maintains >98% final success

### Use Case Validation

- [ ] Review planned use cases for Opus
- [ ] Document where Opus necessary (vs Sonnet sufficient)
- [ ] Establish decision criteria for Opus deployment
- [ ] Cost-benefit analysis documented

**Opus Usage Criteria:**
- [ ] High-stakes investigations (legal, forensic)
- [ ] Complex multi-step decision logic
- [ ] Custom error recovery needed
- [ ] ROI >5x Sonnet cost differential

### Monitoring Setup

**Critical Metrics:**

- [ ] Throughput: 50-100 ops/sec (much slower than Haiku/Sonnet)
- [ ] Latency: P95 <1 second
- [ ] Complex task success rate: >95%
- [ ] Cost per operation: <$0.15
- [ ] Extended thinking usage (if enabled)

**Dashboard Example:**

```
Opus Agent Dashboard (Complex Investigations)
├─ Throughput: 67 ops/sec ✓
├─ Complex Task Success: 98% ✓
├─ Extended Thinking: Active (avg 15s) ✓
├─ Memory: 712MB ✓
├─ Errors: 0.8% ✓
└─ Cost: $42.87/month (10 daily ops)
```

- [ ] Dashboard created
- [ ] Success rate baseline established
- [ ] Cost tracking enabled

---

## Production Monitoring Setup

### Metrics Collection Infrastructure

**Option 1: Prometheus + Grafana (Recommended)**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'basset-hound-browser'
    static_configs:
      - targets: ['localhost:8765']
  - job_name: 'claude-api'
    static_configs:
      - targets: ['localhost:9090']
```

- [ ] Prometheus installed and configured
- [ ] Grafana dashboards created
- [ ] Alert rules configured (see table below)

**Option 2: CloudWatch (AWS)**

- [ ] CloudWatch agent installed
- [ ] Metrics pushed to CloudWatch
- [ ] Dashboards created in CloudWatch
- [ ] Alarms configured

**Option 3: Datadog (SaaS)**

- [ ] Datadog agent installed
- [ ] Metrics tagged appropriately
- [ ] Dashboards created
- [ ] APM enabled for performance tracking

### Essential Metrics

**Browser Performance:**

```
metrics = {
    'websocket.connections.active': gauge,
    'websocket.messages.sent': counter,
    'websocket.messages.received': counter,
    'operation.latency_ms': histogram,
    'operation.success_rate': gauge,
    'operation.error_rate': gauge,
    'pool.available_windows': gauge,
    'pool.total_windows': gauge,
    'memory.heap_used_mb': gauge,
    'memory.gc_count': counter,
}
```

- [ ] All metrics collected
- [ ] Storage configured (30-day retention minimum)
- [ ] Access controls configured

**Claude API Metrics:**

```
metrics = {
    'api.requests.total': counter,
    'api.requests.succeeded': counter,
    'api.requests.failed': counter,
    'api.tokens.input': counter,
    'api.tokens.output': counter,
    'api.latency_ms': histogram,
    'api.cost_usd': gauge,
}
```

- [ ] Token counting library integrated
- [ ] Cost tracking enabled
- [ ] Rate limit monitoring configured

### Alert Configuration

| Alert Name | Metric | Threshold | Severity | Action |
|-----------|--------|-----------|----------|--------|
| **Low Throughput** | ops/sec | <50 | Warning | Page on-call |
| **High Latency** | P95 latency | >1000ms | Warning | Investigate |
| **High Error Rate** | error % | >5% | Critical | Incident |
| **Memory Leak** | heap growth | >100MB/hour | Critical | Restart service |
| **Pool Exhaustion** | available_pool | 0 | Critical | Scale pool |
| **API Rate Limit** | 429 responses | >0 | Warning | Backoff requests |
| **Cache Hit Collapse** | cache hit % | <10% | Warning | Review invalidation |
| **Cost Overrun** | daily cost | >budget×1.2 | Warning | Review usage |

- [ ] All alerts configured
- [ ] Alert routing configured (email, Slack, PagerDuty)
- [ ] Alert testing verified (can send test alerts)

### Logging Setup

**Log Collection:**

```bash
# Logs to collect
/var/log/basset-hound-browser/server.log
/var/log/basset-hound-browser/websocket.log
/var/log/basset-hound-browser/errors.log
~/.claude-api.log  # API client logs
```

- [ ] Logs rotated (daily or 100MB)
- [ ] Retention: 30 days minimum
- [ ] Centralized collection configured (ELK, Splunk, CloudWatch)
- [ ] Search capabilities tested

**Log Alert Patterns:**

- [ ] "Connection timeout" - frequency check
- [ ] "Out of memory" - immediate alert
- [ ] "Rate limited" - pattern detection
- [ ] "Authentication failed" - immediate alert

---

## Performance Verification

### Baseline Testing

Before going to production, establish baselines:

**Test 1: Single Agent Throughput (Haiku)**

```bash
python scripts/baseline_throughput.py \
    --agent haiku \
    --batch-size 100 \
    --operations 10000 \
    --output baseline_haiku.json
```

**Acceptance Criteria:**
- [ ] Throughput: >300 ops/sec ✓
- [ ] P95 latency: <250ms ✓
- [ ] Success rate: >97% ✓
- [ ] Memory stable: <100MB growth ✓

**Test 2: Multi-Agent Coordination (Haiku + Sonnet)**

```bash
python scripts/baseline_multi_agent.py \
    --agents haiku,sonnet \
    --total-operations 5000 \
    --output baseline_multi.json
```

**Acceptance Criteria:**
- [ ] Combined throughput: >400 ops/sec ✓
- [ ] No resource contention visible ✓
- [ ] Cache sharing working (if enabled) ✓
- [ ] Error rates: <2% ✓

**Test 3: Stress Test (Max Load)**

```bash
python scripts/stress_test.py \
    --batch-size 150 \
    --concurrent-agents 3 \
    --duration 600 \
    --output stress_test.json
```

**Acceptance Criteria:**
- [ ] Sustains >500 ops/sec ✓
- [ ] No crashes or hangs ✓
- [ ] Graceful degradation under load ✓
- [ ] Recovery from overload automatic ✓

**Test 4: Cache Effectiveness**

```bash
python scripts/cache_effectiveness.py \
    --repeated-urls 100 \
    --checks-per-url 10 \
    --cache-ttl 3600 \
    --output cache_test.json
```

**Acceptance Criteria:**
- [ ] Hit rate: >50% ✓
- [ ] Latency reduction: 70-80% on hits ✓
- [ ] Cache invalidation working ✓

### Production Validation

**Week 1 - Warmup Phase:**

- [ ] Monitor all alerts (establish noise level)
- [ ] Verify log collection working
- [ ] Check dashboard data accuracy
- [ ] Review cost tracking

**Week 2-4 - Baseline Phase:**

- [ ] Collect 30 days of metrics
- [ ] Establish normal operating ranges
- [ ] Identify any recurring issues
- [ ] Validate cost projections

**Checklist:**

- [ ] Baselines established for all key metrics
- [ ] Alert thresholds tuned (false positive rate <5%)
- [ ] Runbooks created for common alerts
- [ ] On-call rotation established
- [ ] Escalation procedures documented

---

## Troubleshooting Checklist

### Issue: Throughput Degradation

```
Symptom: Ops/sec drops from 300 to 150
Expected: >300 ops/sec consistently
```

**Diagnosis Steps:**

- [ ] Check memory usage
  - [ ] If >700MB: Restart pool
  - [ ] If growing: Possible memory leak
  - [ ] If stable: Memory not issue

- [ ] Check latency
  - [ ] If P95 >500ms: Network/page load issue
  - [ ] If P95 stable: Check throughput calculation

- [ ] Check error rate
  - [ ] If >5%: Investigate errors
  - [ ] If <2%: Quality not issue

- [ ] Check pool health
  - [ ] Verify min 2 windows available
  - [ ] Check window creation logs
  - [ ] Verify no pool deadlock

**Resolution Path:**

1. If memory issue → Restart browser service
2. If network issue → Check DNS, firewall, latency
3. If error spike → Review recent changes
4. If pool issue → Increase pool size, check logs

### Issue: High Error Rate (>5%)

```
Symptom: 10% of operations failing
Expected: <2% error rate
```

**Error Analysis:**

```python
# Analyze errors
errors = analyze_failures()
error_types = group_by_error_type(errors)
for error_type, count in error_types.items():
    print(f"{error_type}: {count} ({count/total*100:.1f}%)")
```

**Common Error Causes:**

| Error Type | Typical Cause | Resolution |
|-----------|--------------|------------|
| ETIMEDOUT | Slow network | Increase timeout, check network |
| ECONNRESET | Browser crash | Restart, check logs |
| Element not found | Timing issue | Increase wait timeout |
| Navigation failed | Site blocking | Use Tor, rotate user-agent |
| Rate limited | Too fast | Reduce batch size, add delays |

- [ ] Identify primary error type
- [ ] Implement specific fix
- [ ] Verify error rate drops to <2%

### Issue: Memory Leak (Heap Growing)

```
Symptom: Heap grows from 200MB to 900MB over 6 hours
Expected: Stable <500MB
```

**Investigation Steps:**

```bash
# Collect heap snapshot
curl -s http://localhost:8765/debug/heap-snapshot > heap.json

# Analyze growth
python scripts/analyze_heap.py heap.json

# Check for common leaks
grep -r "TODO\|FIXME\|memory" websocket/server.js
```

- [ ] Collect heap snapshot during normal operation
- [ ] Compare before/after memory usage
- [ ] Identify largest growing objects
- [ ] Check for:
  - [ ] Unbounded arrays/maps
  - [ ] Missing event listener cleanup
  - [ ] Unreleased DOM references
  - [ ] Timer leaks (setTimeout not cleared)

**Resolution:**

1. Reduce batch size (temporarily) to slow leak
2. Implement workaround (periodic restart)
3. Fix underlying issue in code
4. Verify fix with 24-hour memory test

### Issue: Cache Hit Rate Too Low (<20%)

```
Symptom: Cache hit rate only 8%
Expected: 40-60% for repeated URLs
```

**Diagnosis:**

```python
# Analyze cache usage
cache_stats = get_cache_statistics()
print(f"Hit rate: {cache_stats['hits'] / cache_stats['total'] * 100:.1f}%")
print(f"Evictions: {cache_stats['evictions']}")
print(f"Misses: {cache_stats['misses']}")
```

**Common Causes:**

| Cause | Indicator | Fix |
|-------|-----------|-----|
| Cache TTL too short | Many expirations | Increase TTL |
| Cache too small | High eviction rate | Increase size |
| URL variations | Different params | Normalize URLs |
| Cache disabled | Hit rate = 0 | Check config |
| New dataset | All misses | Expected during warmup |

- [ ] Review cache configuration
- [ ] Check cache size adequacy
- [ ] Verify cache invalidation logic
- [ ] Monitor hit rate over 24 hours

### Issue: Connection Pool Exhaustion

```
Symptom: Cannot create new connections, pool at max
Expected: Pool <80% utilized
```

**Diagnosis:**

```python
pool_status = get_pool_status()
print(f"Available: {pool_status['available']}/{pool_status['total']}")
print(f"Utilization: {(1 - pool_status['available']/pool_status['total'])*100:.1f}%")
```

- [ ] Check concurrent operations (if >pool size)
- [ ] Verify window cleanup is happening
- [ ] Check for stuck/dead windows

**Solutions (in order):**

1. **Reduce load temporarily** → Immediately
2. **Increase pool size** → Permanent fix
3. **Check for stuck windows** → Investigate logs
4. **Restart browser** → Nuclear option

### Issue: Cost Spike (>150% normal)

```
Symptom: Daily cost jumped from $5 to $12
Expected: Stable daily cost
```

**Investigation:**

```python
# Analyze cost changes
cost_analysis = analyze_daily_costs()
for day, (cost, ops, cost_per_op) in cost_analysis.items():
    print(f"{day}: ${cost:.2f} ({ops} ops, ${cost_per_op:.6f}/op)")
```

**Common Causes:**

| Cause | Check | Fix |
|-------|-------|-----|
| Volume spike | ops/day increased | Check logs, reduce batch |
| Model switched | Using Opus instead | Verify config |
| Token bloat | tokens/op increased | Audit prompts |
| New workflow | Calling more APIs | Review changes |

- [ ] Compare ops/day (should be similar)
- [ ] Compare cost/op (should be stable)
- [ ] Check for config changes
- [ ] Review recent code deployments

---

## Monthly Optimization Review

### End-of-Month Checklist

**Performance Metrics Review:**

- [ ] Average throughput achieved: _____ ops/sec
- [ ] P95 latency: ______ ms (target: <400ms)
- [ ] Error rate: ______ % (target: <2%)
- [ ] Cache hit rate: ______ % (target: >40%)
- [ ] Uptime: ______ % (target: >99.5%)

**Cost Analysis:**

- [ ] Total monthly cost: $______
- [ ] Cost per operation: $______
- [ ] Cost per 1000 ops: $______
- [ ] Variance from projection: ______%
- [ ] Top cost drivers identified: ____________

**Optimization Opportunities:**

- [ ] Batch size optimization: ______ potential improvement
- [ ] Caching effectiveness: ______ cache hit rate achievable
- [ ] Workflow optimization: ______ candidate URLs for minimal mode
- [ ] Agent efficiency: Consider switching _____ to _____ agent
- [ ] Resource right-sizing: Pool size _____, memory limit _____

**Action Items for Next Month:**

1. [ ] _________________________________
2. [ ] _________________________________
3. [ ] _________________________________

**Review Meeting Notes:**

```
Date: ________________
Attendees: ________________
Topics Discussed:
- 
- 
- 

Decisions Made:
- 
- 

Follow-ups:
- 
- 
```

---

## Deployment Confirmation Checklist

**Pre-Production Sign-Off:**

- [ ] All baseline tests passed
- [ ] Monitoring/alerting operational
- [ ] Runbooks created for common issues
- [ ] On-call procedures documented
- [ ] Rollback procedure tested
- [ ] Cost projections reviewed and approved
- [ ] SLAs documented and accepted

**Compliance:**

- [ ] Security review completed
- [ ] Data privacy compliance verified
- [ ] API rate limits understood and documented
- [ ] Terms of service reviewed
- [ ] Billing setup verified

**Knowledge Transfer:**

- [ ] Operations team trained
- [ ] Documentation reviewed by team
- [ ] Troubleshooting guide explained
- [ ] Optimization procedures demonstrated
- [ ] Escalation procedures understood

**Sign-Off:**

```
Deployment Owner: ________________  Date: ________
Operations Lead: ________________   Date: ________
Finance Approver: ________________  Date: ________
```

---

## Summary

This checklist ensures:

1. **Infrastructure Ready** - Browser, caching, monitoring deployed
2. **Agents Optimized** - Each agent configured for its workload
3. **Baselines Established** - Performance targets and metrics
4. **Monitoring Active** - Real-time visibility into performance
5. **Issues Addressed** - Troubleshooting procedures ready
6. **Optimization Continuous** - Monthly review process

**Key Numbers to Remember:**

| Agent | Throughput | P95 Latency | Monthly Cost (1K ops) |
|-------|-----------|-------------|----------------------|
| Haiku | 300+ ops/sec | <250ms | $0.59 |
| Sonnet | 200+ ops/sec | <400ms | $4.11 |
| Opus | 50+ ops/sec | <800ms | $42.87 |

---

**Document Status:** Production Ready  
**Last Updated:** May 7, 2026  
**Maintained By:** Basset Hound Browser Operations Team
