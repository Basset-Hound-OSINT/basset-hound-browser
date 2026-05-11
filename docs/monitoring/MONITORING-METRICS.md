# Basset Hound Browser v12.0.0 - Monitoring Metrics Definition

**Version:** 1.0  
**Date:** May 11, 2026  
**Status:** Production Ready

## Overview

This document defines all critical metrics for monitoring Basset Hound Browser in production. Metrics are organized into three categories: Performance, Health, and Business metrics. Each metric includes baseline thresholds derived from Sprint 1 optimization testing.

---

## 1. PERFORMANCE METRICS

### 1.1 Throughput

**Metric Name:** `throughput_ops_per_sec`

**Description:** Number of WebSocket commands processed per second

**Baseline Values:**
- Baseline (idle): 6,522 ops/sec
- Light load (5 clients): 50 ops/sec per instance
- Medium load (10 clients): 100 ops/sec per instance
- Heavy load (20 clients): 200 ops/sec per instance
- Max per-instance concurrent clients: 20

**Collection Method:**
- Count successful command completions per second
- Sample every 10 seconds
- Aggregate over 1-minute windows

**Alert Thresholds:**
- WARNING: <5,500 ops/sec (15% drop)
- CRITICAL: <3,000 ops/sec (50% drop)

**Formula:**
```
throughput = successful_commands / sample_period_seconds
```

---

### 1.2 Latency

**Metric Name:** `latency_*`

**Description:** Response time for WebSocket commands

**Baseline Values (from v11.3.0 optimization):**
- Average latency: 111.67ms
- P50 (median): ~80-120ms
- P95: 531ms average (operation-dependent)
- P99: 555ms average (operation-dependent)

**Per-Operation Breakdown:**
```
Operation Type          | P50   | P95   | P99
─────────────────────────────────────────────
Navigation             | 1.2s  | 2.5s  | 3.0s (network-bound)
Screenshot             | 80ms  | 300ms | 400ms
Click/Fill             | 20ms  | 100ms | 150ms
Get Content            | 30ms  | 150ms | 200ms
Get Cookies            | 10ms  | 50ms  | 80ms
Status/Ping            | 5ms   | 20ms  | 50ms
```

**Collection Method:**
- Record timestamp on request arrival and completion
- Calculate percentiles per operation type
- Sample every command (100% coverage)
- Window: 1-minute rolling

**Alert Thresholds:**
- P95 > 1000ms: HIGH alert (operation specific)
- P99 > 1500ms: CRITICAL alert (operation specific)
- Average > 500ms: MEDIUM alert (trends)

**Formulas:**
```
latency = completion_timestamp - request_timestamp
p50 = percentile(latencies, 50)
p95 = percentile(latencies, 95)
p99 = percentile(latencies, 99)
```

---

### 1.3 Memory Usage

**Metric Name:** `memory_*`

**Description:** Node.js process memory consumption

**Baseline Values (from v11.3.0 optimization):**
- Peak heap (1 hour): 320MB
- Memory growth rate: 2-4 MB/hour (with optimization)
- Growth without optimization: 8-12 MB/hour
- Recommended heap: 256-512MB

**Per-Component Memory:**
```
Component              | Typical | Max
─────────────────────────────────────────
Base process          | 40MB    | 60MB
Screenshot cache      | 50-100MB| 200MB (optimized OPT-02)
Session recording     | 10-30MB | 100MB (per hour session)
Fingerprinting cache  | 5-15MB  | 30MB
WebSocket buffers     | 10-20MB | 50MB
DOM cache             | 5-10MB  | 25MB
```

**Collection Method:**
- Use `process.memoryUsage()`
- Sample every 5 seconds
- Calculate trend over 1-hour window
- Track: heapUsed, heapTotal, external, rss

**Alert Thresholds:**
- Memory growth > 6 MB/hour: MEDIUM alert (anomaly detected)
- Heap usage > 80% of limit: HIGH alert
- Heap usage > 95% of limit: CRITICAL alert (may crash)
- Memory > 400MB (hard limit): CRITICAL alert

**Formulas:**
```
memory_used = process.memoryUsage().heapUsed / 1024 / 1024 (MB)
memory_limit_percent = (heapUsed / heapTotal) * 100
growth_rate = (current_memory - memory_1hr_ago) / 60 (MB/min)
```

---

### 1.4 GC Pause Times

**Metric Name:** `gc_pause_*`

**Description:** Time spent in garbage collection

**Baseline Values (from v11.3.0 optimization):**
- GC pause time: 25-80ms (improved from 45-150ms)
- Improvement: 44-50% pause reduction with OPT-07
- Frequency: ~60-second interval (configured)

**Collection Method:**
- Hook V8 GC events via performance observer
- Record pause duration for each GC cycle
- Calculate max, avg, p95 per minute
- Sample all GC events

**Alert Thresholds:**
- Single pause > 150ms: MEDIUM alert
- Average pause > 100ms: HIGH alert
- Pause > 300ms: CRITICAL alert (impacts latency)

**Formulas:**
```
gc_pause_duration = gc_end_time - gc_start_time (ms)
gc_pause_avg = mean(pause_durations)
gc_pause_p95 = percentile(pause_durations, 95)
```

---

### 1.5 CPU Usage

**Metric Name:** `cpu_*`

**Description:** CPU utilization by the Node.js process

**Collection Method:**
- Sample `os.cpus()` every 10 seconds
- Calculate per-core and total usage
- Account for number of CPU cores
- Window: 1-minute rolling average

**Alert Thresholds:**
- CPU > 75%: MEDIUM alert
- CPU > 85%: HIGH alert
- CPU > 95%: CRITICAL alert

**Formulas:**
```
cpu_percent = (process_cpu_time / total_cpu_time) * 100
process_cpu_time = user_time + system_time
```

---

### 1.6 WebSocket Compression Ratio

**Metric Name:** `compression_ratio`

**Description:** Effectiveness of WebSocket message compression (OPT-01)

**Baseline Values:**
- Compression ratio: 70-80% reduction
- Large payloads (>10KB): 120KB → 30KB
- Small payloads (<1KB): No compression (overhead)

**Collection Method:**
- Track original and compressed message sizes
- Calculate per-message and aggregate ratios
- Sample: Every message with compression enabled
- Window: 1-hour rolling

**Alert Thresholds:**
- Compression ratio < 50%: MEDIUM alert (may indicate misconfiguration)
- Ratio improving: INFO (normal)

**Formulas:**
```
compression_ratio = (compressed_size / original_size) * 100
bandwidth_saved = original_size - compressed_size
```

---

### 1.7 Cache Performance

**Metric Name:** `cache_*`

**Description:** Screenshot cache hit rate (OPT-02)

**Baseline Values:**
- Target cache hit rate: >30%
- Memory reduction: 80-90% with caching
- TTL: 5000ms (5 seconds)
- Max cache size: 500MB

**Collection Method:**
- Count cache hits vs misses
- Calculate hit rate per minute
- Track memory reduction achieved
- Window: 1-minute rolling

**Alert Thresholds:**
- Cache hit rate < 10%: MEDIUM alert (cache ineffective)
- Hit rate > 30%: INFO (normal operation)

**Formulas:**
```
cache_hit_rate = hits / (hits + misses) * 100
cache_memory_saved = entries * avg_screenshot_size - cached_size
```

---

## 2. HEALTH METRICS

### 2.1 Error Rate

**Metric Name:** `error_rate_percent`

**Description:** Percentage of failed WebSocket commands

**Baseline Values:**
- Production target: <0.1% error rate
- Light load: <0.01%
- Heavy load (20 clients): 0.13% acceptable
- Stress test (50 clients): 0.13% acceptable

**Collection Method:**
- Count failed requests vs total requests
- Sample every command (100% coverage)
- Calculate per minute and per hour
- Track by error type

**Alert Thresholds:**
- Error rate > 1%: MEDIUM alert
- Error rate > 5%: CRITICAL alert (page immediately)

**Formulas:**
```
error_rate = (failed_commands / total_commands) * 100
errors_per_minute = error_count / 60
```

---

### 2.2 Success Rate

**Metric Name:** `success_rate_percent`

**Description:** Percentage of successful WebSocket commands (inverse of error rate)

**Baseline Values:**
- Production target: >99.9% success
- Load test target: >99%
- Stress test: >99.87%

**Collection Method:**
- Count successful requests
- Inverse of error rate calculation
- Window: 1-minute and 1-hour rolling

**Alert Thresholds:**
- Success rate < 99%: MEDIUM alert
- Success rate < 95%: CRITICAL alert

**Formulas:**
```
success_rate = (successful_commands / total_commands) * 100
success_rate = 100 - error_rate
```

---

### 2.3 Connection Count

**Metric Name:** `connection_count`

**Description:** Current number of active WebSocket connections

**Collection Method:**
- Count active connections on WebSocket server
- Sample every 10 seconds
- Track by connection type (command, monitor, streaming)
- Track max connections reached

**Alert Thresholds:**
- Connections > 50 per instance: INFO (scaling consideration)
- Connections > 100 per instance: WARNING (at max capacity)

**Formulas:**
```
active_connections = ws_server.clients.size
max_connections_per_instance = 20 (hard limit)
total_capacity = instances * 20
```

---

### 2.4 Active Sessions

**Metric Name:** `active_sessions`

**Description:** Number of currently active browser sessions

**Collection Method:**
- Count sessions with active tabs
- Sample every 30 seconds
- Track by session type (regular, isolated, recording)
- Include session lifetime

**Alert Thresholds:**
- Sessions > 100: INFO (monitoring)
- Sessions > 500: WARNING (resource pressure)

**Formulas:**
```
active_sessions = count(session.status == 'active')
total_tabs = sum(session.tab_count)
avg_session_age = mean(current_time - session_creation_time)
```

---

### 2.5 Resource Exhaustion

**Metric Name:** `resource_exhaustion_*`

**Description:** Detection of resource limits being approached

**Key Resources:**
```
Resource           | Limit   | Warning | Critical
─────────────────────────────────────────────────
File descriptors   | 10000   | 8000    | 9500
Open connections   | 1000    | 800     | 950
Memory heap        | 512MB   | 400MB   | 480MB
Temp disk space    | 50GB    | 40GB    | 45GB
```

**Collection Method:**
- Monitor `/proc/[pid]/limits` on Linux
- Track: open files, memory, disk
- Sample every 30 seconds
- Compare to system limits

**Alert Thresholds:**
- >80% of any limit: HIGH alert
- >95% of any limit: CRITICAL alert

**Formulas:**
```
utilization_percent = (current_usage / limit) * 100
headroom = limit - current_usage
```

---

### 2.6 Service Health

**Metric Name:** `service_health_*`

**Description:** Health of critical service components

**Components to Monitor:**
```
Component              | Health Check
────────────────────────────────────────
WebSocket server       | Can accept connections
Electron window        | Window still responsive
Screenshot engine      | Can generate screenshots
Recording manager      | Can write to disk
Proxy manager          | Proxy rotation working
Fingerprint engine     | Profile loading works
Cache system           | Cache operations succeed
```

**Collection Method:**
- Periodic health checks (every 30 seconds)
- Execute diagnostic operation
- Record success/failure
- Track recovery time

**Alert Thresholds:**
- Component failed: HIGH alert
- Component unresponsive >5 seconds: CRITICAL alert

**Formulas:**
```
component_uptime = (successes / total_checks) * 100
component_recovery_time = down_time
```

---

## 3. BUSINESS METRICS

### 3.1 Evasion Effectiveness

**Metric Name:** `evasion_effectiveness_*`

**Description:** Success rate of bot detection evasion (Phase 2)

**Baseline Values (from Phase 2 testing):**
```
Detection Service     | Bypass Rate | Target
──────────────────────────────────────────────
bot.sannysoft        | 87%         | >80%
CreepJS              | 81%         | >75%
FingerprintJS        | 80%         | >75%
browserleaks         | 90%         | >80%
PerimeterX           | 65%         | >60%
DataDome             | 55%         | >50%
CloudFlare           | 70%         | >65%
```

**Collection Method:**
- Run detection service tests periodically
- Record bypass/detection results
- Aggregate by service and time
- Track trending

**Alert Thresholds:**
- Effectiveness drops >5%: MEDIUM alert (investigation needed)
- Effectiveness drops >10%: CRITICAL alert (system issue)

**Formulas:**
```
effectiveness = (successful_bypasses / total_attempts) * 100
trend = current_effectiveness - effectiveness_7d_ago
```

---

### 3.2 Feature Usage by Type

**Metric Name:** `feature_usage_*`

**Description:** Count and breakdown of command usage

**Core Features:**
```
Category           | Examples
───────────────────────────────────────────
Navigation        | navigate, wait, reload
Content Extraction| get_content, get_page_state
Screenshots       | screenshot, screenshot_element
Input             | click, fill, type, scroll
Bot Evasion       | set_user_agent, rotate_proxy
Fingerprinting    | get_device_profile, set_profile
Recording         | start_recording, stop_recording
Analysis          | analyze_content, extract_links
```

**Collection Method:**
- Log command type on every request
- Aggregate counts by type
- Sample: 100% coverage
- Window: Per minute, per hour, per day

**Alert Thresholds:**
- Unusual usage pattern: INFO (for review)
- Command never used: INFO (potential dead feature)

**Formulas:**
```
usage_percent = (command_type_count / total_commands) * 100
trending = (current_day_usage - prev_day_usage) / prev_day_usage
```

---

### 3.3 Client Versions

**Metric Name:** `client_version_distribution`

**Description:** Distribution of client versions connecting to service

**Collection Method:**
- Extract version from client headers/identification
- Track unique versions and client counts
- Sample: 100% coverage
- Window: Per hour, per day

**Alert Thresholds:**
- Significant drop in current version: WARNING
- Orphaned old versions still active: INFO (support planning)

**Formulas:**
```
version_percent = (clients_on_version / total_clients) * 100
version_adoption_rate = new_version_clients / total_new_clients
```

---

### 3.4 Deployment Status

**Metric Name:** `deployment_status_*`

**Description:** Status and health of deployment

**Collection Method:**
- Monitor container/instance status
- Track deployment version
- Record deployment time and success
- Track rollback events

**Alert Thresholds:**
- Deployment failed: CRITICAL alert
- Deployment >30 min ongoing: HIGH alert
- Version mismatch across instances: MEDIUM alert

**Formulas:**
```
deployment_duration = end_time - start_time
successful_deployments = count(status == 'success')
rollback_rate = rollbacks / total_deployments
```

---

## 4. METRIC COLLECTION SUMMARY

### Collection Frequencies

```
Metric Category        | Frequency | Window Size | Storage
─────────────────────────────────────────────────────────────
Performance (latency)  | Every req | 1 min       | Last 24h
Performance (throughput)| Every 10s | 1 min       | Last 24h
Memory                 | Every 5s  | 1 min       | Last 7d
GC Pause               | Per event | 1 min       | Last 24h
CPU                    | Every 10s | 1 min       | Last 24h
Error/Success Rate     | Every req | 1 min       | Last 24h
Connection Count       | Every 10s | Current     | Last 24h
Active Sessions        | Every 30s | Current     | Last 24h
Resource Exhaustion    | Every 30s | Current     | Last 24h
Service Health         | Every 30s | Current     | Last 24h
Evasion Effectiveness  | Hourly    | Per test    | Last 30d
Feature Usage          | Every req | 1 min       | Last 7d
Client Versions        | Every req | 1 hour      | Last 30d
Deployment Status      | Per event | Per deploy  | All-time
```

### Storage Requirements

Assuming average of 1,000 commands/minute:

```
Metric Type            | Daily    | Weekly   | Monthly
────────────────────────────────────────────────────────
Performance metrics    | 150MB    | 1GB      | 4.5GB
Health metrics         | 50MB     | 350MB    | 1.5GB
Business metrics       | 20MB     | 140MB    | 600MB
────────────────────────────────────────────────────────
Total                  | 220MB    | 1.5GB    | 6.6GB
```

**Recommendation:** Store 24 hours of high-frequency metrics in memory/Redis, 7 days in time-series DB (InfluxDB), 30+ days in cold storage (S3/archive).

---

## 5. METRIC AGGREGATION

### Real-Time Aggregations (1-minute windows)
- Throughput (ops/sec)
- Latency percentiles (p50, p95, p99)
- Error/success rates
- Memory usage snapshot
- CPU usage

### Medium-Term Aggregations (1-hour windows)
- Average throughput
- Peak latency
- Memory growth rate
- GC pause statistics
- Evasion effectiveness

### Long-Term Aggregations (1-day windows)
- Daily throughput average
- Peak and trough metrics
- Cumulative error count
- Feature usage breakdown
- Trend analysis

---

## 6. BASELINE SOURCES

All baseline thresholds derived from:
- **Sprint 1 Performance Analysis:** May 11, 2026
  - File: `tests/results/00-READ-FIRST-PERFORMANCE-SUMMARY.txt`
  - File: `tests/results/BOTTLENECK-REPORT-2026-05-11.md`

- **Phase 1 Validation:** May 7, 2026
  - File: `docs/archives/session_records/2026-05-07_PHASE-1-AUTONOMOUS-EXECUTION.md`

- **Phase 2 Validation:** May 7, 2026
  - File: `docs/PHASE-2-COMPLETION-SUMMARY-2026-05-07.md`

---

## 7. MONITORING TOOL RECOMMENDATIONS

### Metrics Collection
- **Prometheus:** Scrape metrics at /metrics endpoint (5s intervals)
- **StatsD/InfluxDB:** Agent-based collection for high-frequency metrics
- **Node.js native:** Built-in profiler and perf_hooks for detailed metrics

### Time-Series Database
- **InfluxDB 2.x:** Optimized for time-series, built-in alerting
- **TimescaleDB:** PostgreSQL extension, lower memory overhead
- **Prometheus:** For metrics storage with long-term retention

### Dashboard & Visualization
- **Grafana:** Connect to InfluxDB/Prometheus for real-time dashboards
- **Datadog:** For comprehensive APM and alerting
- **New Relic:** Full-stack monitoring and distributed tracing

### Alerting
- **Prometheus AlertManager:** Flexible rule evaluation
- **InfluxDB Tasks:** Built-in alerting for time-series data
- **Custom Node.js:** Thin layer for custom alert logic

---

## 8. NEXT STEPS

1. **Implement Metrics Collection** (3-4 hours)
   - Add metrics collection to WebSocket server
   - Integrate memory/CPU monitoring
   - Set up metrics export endpoint

2. **Configure Time-Series Database** (2-3 hours)
   - Deploy InfluxDB or similar
   - Set retention policies
   - Configure data rollup

3. **Build Dashboards** (4-5 hours)
   - Create Grafana dashboards
   - Configure real-time visualizations
   - Set up custom panels

4. **Implement Alerting** (2-3 hours)
   - Define alert rules
   - Configure notifications
   - Set up escalation chains

5. **Integration Testing** (2-3 hours)
   - Test metric collection under load
   - Validate alert triggers
   - Test dashboard accuracy

---

## Appendix: Glossary

- **Latency P95:** The 95th percentile response time (95% of requests faster)
- **Throughput:** Commands processed per second
- **GC Pause:** Time spent in garbage collection (blocks main thread)
- **Cache Hit Rate:** Percentage of cache requests that return data
- **Error Rate:** Percentage of failed operations
- **Resource Exhaustion:** Approaching system limits (memory, FDs, etc.)

---

**Document Version:** 1.0  
**Last Updated:** May 11, 2026  
**Status:** Ready for Implementation
