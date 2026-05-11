# Basset Hound Browser v12.0.0 - Dashboard Templates

**Version:** 1.0  
**Date:** May 11, 2026  
**Status:** Production Ready

## Overview

This document provides dashboard templates for monitoring Basset Hound Browser v12.0.0 in production. Templates are designed for Grafana and include real-time metrics, health status, alert status, and historical trends.

---

## DASHBOARD 1: Executive Summary (Overview)

**Intended Audience:** Managers, On-Call, Team Lead  
**Refresh Rate:** 30 seconds  
**Time Range:** Last 24 hours  
**Update Frequency:** Daily

### Layout Grid (4 columns x 6 rows)

#### Row 1: Service Health Status

**1.1 Service Status (1x1)**
```
Type: Stat Panel
Metric: service_health_status
Values:
  - Green: All systems healthy
  - Yellow: 1+ component degraded
  - Red: Critical component down
Last Update: Real-time
Show History: 24-hour trend
```

**1.2 Current Error Rate (1x1)**
```
Type: Stat Panel with Gauge
Metric: error_rate_percent
Current Value: 0.03%
Target: <0.1%
Color Scale:
  - Green: <0.1%
  - Yellow: 0.1% - 1%
  - Red: >1%
Alert Threshold Shown: Red line at 5%
```

**1.3 Success Rate (1x1)**
```
Type: Stat Panel
Metric: success_rate_percent
Current Value: 99.97%
Target: >99%
Inverse of error rate
Spark Line: 24-hour trend
```

**1.4 Uptime (1x1)**
```
Type: Stat Panel
Metric: service_uptime_percent
Time Period: Last 30 days
Current: 99.98%
Target: 99.95%
Show: Incidents count
```

#### Row 2: Real-Time Performance

**2.1 Throughput (Current) (2x1)**
```
Type: Stat Panel
Metric: throughput_ops_per_sec
Current: 4,523 ops/sec
Baseline: 6,522 ops/sec
Capacity: 20 clients × 6,522 = 130,440 ops/sec per 3 instances
Gauge:
  - Green: >5,500 ops/sec
  - Yellow: 3,000-5,500 ops/sec
  - Red: <3,000 ops/sec
Spark Line: Last 1 hour
```

**2.2 Active Connections (2x1)**
```
Type: Stat Panel + Gauge
Metric: connection_count
Current: 8 connections
Max per instance: 20
Total capacity: 60 connections (3 instances)
Percentage: 13.3%
Color:
  - Green: <50% capacity
  - Yellow: 50-80%
  - Red: >80%
Show individual instance count
```

#### Row 3: Latency Metrics

**3.1 Latency Percentiles (2x2)**
```
Type: Graph Panel
Y-Axis: Latency (ms)
Metrics Shown:
  - P50: Green line (target <150ms)
  - P95: Orange line (target <600ms)
  - P99: Red line (target <1500ms)
  - Average: Blue line (111ms baseline)
Time Range: Last 30 minutes
Threshold Lines:
  - 600ms (P95 alert)
  - 1000ms (P95 high alert)
Zoom enabled, legend on bottom
```

**3.2 Operation-Specific Latency (2x2)**
```
Type: Table Panel
Columns: Operation, P50, P95, P99, Trend
Rows: (all major operations)
  Navigation      | 1.2s | 2.5s | 3.0s | ↓ (improving)
  Screenshot      | 80ms | 300ms| 400ms| ↑ (slight increase)
  Fill/Type       | 20ms | 100ms| 150ms| → (stable)
  Content Extract | 30ms | 150ms| 200ms| → (stable)
Color code: Red if over threshold, green if good
Current values and 24-hour trend
```

#### Row 4: Memory & GC

**4.1 Memory Usage (2x2)**
```
Type: Graph Panel
Y-Axis: Memory (MB)
Metrics:
  - heapUsed: Blue (current)
  - heapTotal: Light blue (allocated)
  - Max Threshold: Red line at 400MB
  - Alert Threshold: Orange line at 400MB
Time Range: Last 1 hour
Annotation: Growth rate in MB/hour
Hover: Show % of limit
```

**4.2 Garbage Collection (2x2)**
```
Type: Graph Panel
Y-Axis: GC Pause (ms)
Metrics:
  - GC Pause Duration: Blue bars
  - Average (25-80ms baseline): Green line
  - Alert Threshold (100ms): Orange line
Time Range: Last 1 hour
Histogram: Show frequency distribution
Count: GC events per minute
```

#### Row 5: Cache & Compression

**5.1 Cache Performance (2x1)**
```
Type: Stat Panel + Gauge
Metric: cache_hit_rate_percent
Current: 42%
Target: >30%
Color:
  - Green: >30%
  - Yellow: 10-30%
  - Red: <10%
Show: Hits vs Misses
Spark Line: 24-hour trend
```

**5.2 Compression Effectiveness (2x1)**
```
Type: Stat Panel
Metric: compression_ratio_percent
Current: 76%
Target: >70%
Bandwidth Saved: 2.3GB last 24h
Show: Original vs Compressed sizes
Time Period: Rolling 1-hour
```

#### Row 6: Alert Status

**6.1 Active Alerts (2x1)**
```
Type: Alert List Panel
Show: Currently firing alerts
Columns: Alert Name, Severity, Duration, Value
Sort: By severity (CRITICAL first)
Color: Red for CRITICAL, Orange for HIGH, Yellow for MEDIUM
Refresh: Real-time (5s)
Link to: Alert details and runbook
```

**6.2 Alert Firing Rate (2x1)**
```
Type: Graph Panel
Y-Axis: Alert Count
Metrics:
  - CRITICAL: Red area
  - HIGH: Orange area
  - MEDIUM: Yellow area
Time Range: Last 24 hours
Show: Total incidents per hour
Click through to incident details
```

---

## DASHBOARD 2: Performance Deep Dive

**Intended Audience:** DevOps, Performance Engineer  
**Refresh Rate:** 10 seconds  
**Time Range:** Last 6 hours  
**Update Frequency:** Continuous

### Layout Grid (4 columns x 8 rows)

#### Row 1: Throughput Analysis

**1.1 Throughput vs Load (4x2)**
```
Type: Graph Panel
Y-Axis: Throughput (ops/sec)
X-Axis: Time
Metrics:
  - Throughput (blue): Actual ops/sec
  - Active Connections (orange): Right axis count
Time Range: Last 6 hours
Correlation: Show relationship between load and throughput
Annotations: Deployments, scaling events
Threshold: 6,500 ops/sec baseline (green zone)
```

#### Row 2: Latency Distribution

**2.1 Latency Heatmap (4x2)**
```
Type: Heatmap Panel
X-Axis: Time (5-minute buckets)
Y-Axis: Latency ranges
Colors: Intensity = request count
Ranges:
  0-50ms: Green
  50-100ms: Light green
  100-500ms: Yellow
  500-1000ms: Orange
  1000ms+: Red
Interpolation: Smooth
Show: Percentile lines (P50, P95, P99)
```

#### Row 3: Per-Operation Metrics

**3.1 Operation Type Breakdown (2x2)**
```
Type: Pie/Donut Chart
Metric: Command count by type
Show: Top 8-10 operations
Percentage of total traffic
Click: Drill down to operation details
```

**3.2 Operation Performance (2x2)**
```
Type: Table Panel
Columns: Operation, Count, Avg Latency, P95, Error Rate, Trend
Rows: All major operations
Sort: By error rate (highest first)
Color: Red if errors >0.1%, yellow if latency high
Show: 24-hour trend sparklines
```

#### Row 4: Error Analysis

**4.1 Error Rate by Type (2x2)**
```
Type: Table Panel
Columns: Error Type, Count, Percentage, Trend
Errors:
  - TIMEOUT (network)
  - INVALID_RESPONSE
  - RESOURCE_EXHAUSTED
  - NOT_FOUND
  - PERMISSION_DENIED
  - OTHER
Sort: By count
Color: Higher rate = redder
Link to logs for investigation
```

**4.2 Error Timeline (2x2)**
```
Type: Graph Panel
Y-Axis: Error Count per minute
Metrics:
  - Total Errors: Red area
  - By Type: Stacked areas (different colors)
Time Range: Last 6 hours
Show: Error rate alongside request rate
Annotation: Alert firings
Threshold: 5% error rate (red line)
```

#### Row 5: Resource Utilization

**5.1 Memory Trend (2x2)**
```
Type: Graph Panel
Y-Axis: Memory (MB)
Metrics:
  - heapUsed: Blue line
  - heapTotal: Light blue area
Time Range: Last 6 hours
Annotations: GC events, cache clears, session starts
Trend line: Linear regression
Growth rate annotation (MB/hour)
```

**5.2 CPU and Disk (2x2)**
```
Type: Dual Graph
Top: CPU usage (%, 0-100)
Bottom: Disk I/O (MB/s)
Time Range: Last 6 hours
CPU Metrics:
  - Process CPU
  - System CPU
  - 4-core system reference
Disk Metrics:
  - Read rate
  - Write rate
Color: Red if >85% CPU, orange if >70%
```

#### Row 6-8: Bottleneck Analysis

**6.1 Screenshot Encoding (4x2)**
```
Type: Graph + Stats
Metrics:
  - Encoding Time (ms): Red area
  - Screenshot Count: Blue line
  - Memory Usage: Green line
Time Range: Last 6 hours
P95: 400ms baseline
Current: Show if exceeding baseline
Trend: Seasonal patterns (more during recording)
Annotation: Recording start/stop events
```

**7.1 Network Performance (4x2)**
```
Type: Heatmap Panel
Y-Axis: Response Time ranges
X-Axis: Time buckets
Metric: Navigation operations latency
Colors: Intensity = request count
Overlay: Network latency (blue line)
Annotation: Network outages, latency spikes
Target: 3000ms for navigation (network-bound)
```

**8.1 GC Frequency vs Pause (4x2)**
```
Type: Dual Graph
Top: GC events per minute
Bottom: GC pause duration (ms)
Time Range: Last 6 hours
Show:
  - Frequency line (blue)
  - Average pause (green)
  - Max pause (red)
  - Threshold line (100ms)
Correlation: Check if frequency increase → pause increase
Tuning recommendations shown
```

---

## DASHBOARD 3: Health Status (Real-Time)

**Intended Audience:** On-Call Engineer  
**Refresh Rate:** 5 seconds  
**Time Range:** Current + Last 30 minutes  
**Intended Use:** Primary dashboard during incidents

### Layout Grid (2 columns x 6 rows)

#### Full-Width Sections

**1. Service Health Scorecard (2x1)**
```
Type: Status Panel
Sections:
  ✅ WebSocket Server: Connected, 50.3ms latency
  ✅ Screenshot Engine: Responding, last screenshot 2.1s ago
  ✅ Cache System: Operational, 42% hit rate
  ✅ Recording Manager: Idle, 0 active recordings
  ✅ Proxy Manager: Operational, Proxy #2 active
  ✅ Database Connection: OK, 5 connections
  ⚠️  Fingerprint Engine: Running, 3 profiles loaded (caution: update available)

Color: Green for healthy, Yellow for warning, Red for error
Last check: [timestamp]
Auto-refresh: Every 5 seconds
```

**2. Critical Metrics (2x1)**
```
Type: 4-Column Stat Panel
┌─────────────────────────────────────────────────────────┐
│ Error Rate │ Success Rate │ P95 Latency │ Memory Usage  │
│   0.03%    │   99.97%     │   531ms     │ 320MB (62%)   │
│   🟢 OK    │   🟢 OK      │   🟢 OK     │   🟢 OK       │
└─────────────────────────────────────────────────────────┘
Each shows:
  - Current value
  - Status (Green/Yellow/Red)
  - Threshold comparison
  - 1-hour sparkline trend
```

#### Column 1: Current Status

**3.1 Connection Status (1x2)**
```
Type: Stat Panel
Active Connections: 8 / 20 (40%)
Connections by type:
  - Command: 6
  - Monitor: 1
  - Streaming: 1
Active Sessions: 3
Average Connection Age: 12m 34s
Longest Running: 47m 22s
Status: Healthy
```

**4.1 Recent Errors (1x2)**
```
Type: Table Panel
Show: Last 10 errors (newest first)
Columns: Timestamp, Operation, Error, Source
Example rows:
  14:35:22 | Fill        | TIMEOUT     | Client 192.168.1.45
  14:34:18 | Navigate    | NOT_FOUND   | Client 192.168.1.50
  14:33:05 | Screenshot  | OOM         | Server
Sort: Newest first
Click: Drill to logs
```

**5.1 Active Alerts (1x2)**
```
Type: Alert List
Show: Firing alerts only
Format:
  🔴 CRITICAL: Error Rate > 5% (since 14:32)
  🟠 HIGH: P99 Latency > 1000ms (since 14:30)
  🟡 MEDIUM: Memory Growth High (since 13:45)
Acknowledge: Button to acknowledge
Silence: Dropdown to silence duration
Jump to runbook: Links
```

#### Column 2: Recent Trends

**3.2 Throughput (Last 30 min) (1x2)**
```
Type: Sparkline + Current
Format:
  Throughput: 4,523 ops/sec ↓ (red if down)
  [Sparkline showing last 30 minutes]
  Trend: Down 12% from 1hr ago
  Load: 8 connections at 565 ops/conn
Compare to baseline (green zone)
```

**4.2 Latency Percentiles (1x2)**
```
Type: Sparkline Table
Format:
  P50:  89ms ↓ [sparkline] ✅
  P95: 531ms → [sparkline] ✅
  P99: 555ms ↑ [sparkline] ⚠️
Color: Green if within bounds, Yellow if trending up
```

**5.2 Memory Timeline (1x2)**
```
Type: Sparkline + Status
Format:
  Memory: 320MB / 512MB (62%) ↑ [sparkline]
  Growth: +18MB last hour (1.8 MB/min - normal)
  GC Events: 12 (avg 52ms pause)
  Status: Normal
  Forecast: Will reach 90% in ~2 hours
Recommendation: Monitor, restart if >95%
```

---

## DASHBOARD 4: Incident Investigation

**Intended Audience:** On-Call Engineer, DevOps  
**Refresh Rate:** 10 seconds (auto-pause on focus)  
**Time Range:** Auto-scale to incident duration (min 30 min)  
**Used For:** Troubleshooting specific incidents

### Layout Grid (4 columns x 8 rows)

#### Row 1: Incident Timeline

**1.1 Alert Timeline (4x1)**
```
Type: Timeline Visualization
Show: All alerts chronologically
Color: CRITICAL (red), HIGH (orange), MEDIUM (yellow)
Format:
  14:32:45 🔴 CRITICAL: Error Rate spiked to 8.3%
  14:32:22 🟠 HIGH: P99 Latency jumped to 1,245ms
  14:31:50 🟡 MEDIUM: Memory growth accelerated
  14:31:30 Info: New deployment v12.0.0 started
Events: Deployments, scaling, restarts
Click: Expand for details, link to metrics at that time
```

#### Row 2: Correlation Analysis

**2.1 Error Rate vs Metrics (2x2)**
```
Type: Dual Axis Graph
Left Y: Error Rate (%)
Right Y: Active Connections
X: Time
Show:
  - Error rate (red area)
  - Connection count (blue line)
  - Memory usage (green line, right axis)
Observation: Did errors correlate with load/memory?
Time range: Around incident time ± 30 min
```

**2.2 Error Types During Incident (2x2)**
```
Type: Stacked Area Chart
Y: Error count
X: Time
Stacked by error type:
  - TIMEOUT (blue)
  - INVALID_RESPONSE (red)
  - RESOURCE_EXHAUSTED (orange)
  - Others (gray)
Highlight: Which error type spiked?
Time range: Incident duration
```

#### Row 3: Resource Analysis

**3.1 Memory Pressure (2x2)**
```
Type: Graph Panel
Y-Axis: Memory (MB)
Metrics during incident:
  - heapUsed (blue)
  - heapTotal (gray)
  - GC marker (red dots)
  - Cache clear marker (green dots)
Time range: Incident ± 1 hour
Observation: Was OOM the issue? GC frequency spike?
```

**3.2 CPU & Disk I/O (2x2)**
```
Type: Graph Panel
Top: CPU usage (%)
Bottom: Disk I/O (MB/s, Read blue, Write green)
Time range: Incident ± 30 min
Observation: CPU spike? Disk saturation?
Annotation: When did issue start/end?
```

#### Row 4: Operation Analysis

**4.1 Failing Operations (2x2)**
```
Type: Table Panel
Show: Operations with errors during incident
Columns: Operation, Error Count, Error Rate, Avg Latency
Sort: By error count
Color: Red if >0.1% error rate
Sample operations:
  Navigation  | 47 errors | 2.3% | 3,245ms ⚠️
  Screenshot  | 23 errors | 1.1% | 892ms
  Fill        | 5 errors  | 0.2% | 145ms
Drill down: Click to see individual errors
```

**4.2 Latency Impact (2x2)**
```
Type: Percentile Graph
Show: P50, P95, P99 during incident
Colors: Blue (P50), Orange (P95), Red (P99)
Overlay: Error rate area (light red)
Observation: Did latency spike before errors?
Timeline: Mark incident start/end
```

#### Row 5-8: Investigation Tools

**5.1 Log Viewer (4x1)**
```
Type: Logs Panel (Loki integration)
Query: Service error logs during incident
Show: Last 100 relevant logs
Filter: By error type, operation, client
Format: Timestamp | Level | Message | Context
Scroll: Most recent at top
Export: Download as CSV
```

**6.1 Configuration Check (2x2)**
```
Type: Stat/Table Panel
Show deployment/config info at incident time:
  Version: v12.0.0
  Heap Size: 512MB
  GC Interval: 60s
  Cache TTL: 5000ms
  Active Profiles: [list]
  Recent Changes: None before incident
Comparison: Config at healthy time
```

**6.2 Deployment History (2x2)**
```
Type: Timeline Panel
Show: Recent deployments
Format:
  14:31:30 Deploy v12.0.0 (5min before incident)
  12:45:00 Deploy v11.3.0 (successful)
  10:15:00 Deploy v11.3.0 (rollback)
Status: Correlation with incident start?
Link: To deployment details
```

**7.1 Client Analysis (2x2)**
```
Type: Geo Map / Table
Show: Affected clients during incident
Columns: Client ID, IP, Version, Operations, Errors
Highlight: Any geographic pattern? Version pattern?
Top affected:
  Client #5 (192.168.1.45): 45 errors
  Client #3 (192.168.1.50): 23 errors
Observation: All affected or specific clients?
```

**7.2 Performance Impact (2x2)**
```
Type: Stats/Summary
Impact analysis:
  Total Operations: 2,047
  Failed: 87 (4.2%)
  Affected Duration: 12m 35s
  Peak Error Rate: 8.3%
  Recovery Time: 3m 20s
Percentage improvement after fix:
  0.3% → 0.03% (90% improvement)
```

**8.1 Action Items (4x1)**
```
Type: Text Panel / Markdown
Auto-populated based on incident:

✅ Completed:
  - Restarted WebSocket server (14:35)
  - Cleared screenshot cache (14:36)

⏳ Pending:
  - Root cause analysis
  - Configuration tuning
  - Code fix for [issue]
  - Deployment of fix

📝 Follow-up:
  - Monitor memory trend for next 24h
  - Review error handling for timeout errors
  - Implement better alerting for error spikes
```

---

## DASHBOARD 5: Evasion Effectiveness (Phase 2)

**Intended Audience:** Security Team, Product Manager  
**Refresh Rate:** 60 seconds  
**Time Range:** Rolling 7 days + historical comparison  
**Update Frequency:** Test cycle driven (hourly or as-needed)

### Layout Grid (4 columns x 6 rows)

#### Row 1: Effectiveness Summary

**1.1 Overall Score (2x1)**
```
Type: Gauge Panel
Metric: Average evasion effectiveness across all services
Current: 77.2%
Target: >75%
Range:
  - Green: >75%
  - Yellow: 60-75%
  - Red: <60%
Status: ✅ On Target
Show: Trend (compare to 7 days ago)
```

**1.2 Services Scorecard (2x1)**
```
Type: Table with Status
Service              | Effectiveness | Target | Status
──────────────────────────────────────────────────────
bot.sannysoft       | 87%           | >80%   | ✅ Exceed
CreepJS             | 81%           | >75%   | ✅ Exceed
FingerprintJS       | 80%           | >75%   | ✅ Exceed
browserleaks        | 90%           | >80%   | ✅ Exceed
PerimeterX          | 65%           | >60%   | ✅ Meet
DataDome            | 55%           | >50%   | ✅ Meet
CloudFlare          | 70%           | >65%   | ✅ Meet
──────────────────────────────────────────────────────
Average             | 77.2%         | >75%   | ✅ Target
```

#### Row 2: Service-Specific Trends

**2.1 Effectiveness Trend (4x2)**
```
Type: Line Graph
Y-Axis: Effectiveness (%)
X-Axis: Time (daily points)
Time Range: Last 30 days
Lines (one per service):
  - bot.sannysoft: 87% (blue, stable)
  - CreepJS: 81% (orange, slight decline)
  - FingerprintJS: 80% (green, rising)
  - browserleaks: 90% (red, stable)
  - PerimeterX: 65% (purple, declining)
  - DataDome: 55% (yellow, very volatile)
  - CloudFlare: 70% (cyan, improving)

Target lines: Horizontal at each service target
Annotations: Profile updates, evasion changes
Click: Drill to details for specific date
```

#### Row 3: Detection Mechanism Analysis

**3.1 Detection Methods Bypassed (2x2)**
```
Type: Stacked Bar Chart
Y-Axis: Bypass count
X-Axis: Detection services
Stacked by method:
  - Canvas Fingerprinting: Blue
  - WebGL Fingerprinting: Green
  - Header Analysis: Orange
  - Behavior Tracking: Red
  - Other Methods: Gray

Show: What bypasses are most effective for each service?
Color intensity: Higher = more frequent bypass
Comparison: Current week vs previous week
```

**3.2 Detection Failures (Detection Rate) (2x2)**
```
Type: Table Panel
Columns: Service, Detection Rate, Common Cause
Rows:
  DataDome        | 45% detected   | Header inconsistencies
  PerimeterX      | 35% detected   | Session coherence breaks
  CloudFlare      | 30% detected   | Bot behavior patterns
  FingerprintJS   | 20% detected   | Canvas fingerprint mismatch
  Others          | 10% detected   | Rare edge cases

Color: Green if low detection, red if high
Show: Trending (improving or worsening)
Recommendation: Which methods need improvement?
```

#### Row 4-5: Detailed Analysis

**4.1 Canvas Fingerprinting Evasion (2x2)**
```
Type: Stat + Sparkline
Metric: Canvas evasion effectiveness
Baseline: 72% → Current: 82% (+10 points)
Sparkline: 30-day trend
Status: ✅ Above baseline
Details shown:
  - Randomization: 85% successful
  - Entropy injection: 81% successful
  - Noise patterns: 78% successful
```

**4.2 WebGL Fingerprinting Evasion (2x2)**
```
Type: Stat + Sparkline
Metric: WebGL evasion effectiveness
Baseline: 50% → Current: 90% (+40 points!)
Sparkline: 30-day trend (sharp upward)
Status: ✅ Major improvement achieved
Details shown:
  - GPU profiling evasion: 92% successful
  - Renderer string spoof: 88% successful
  - Vendor string spoof: 89% successful
```

**5.1 Session Coherence Score (2x2)**
```
Type: Radar Chart
5 Dimensions:
  1. Typing Pattern Match: 92%
  2. Mouse Movement Consistency: 88%
  3. Scroll Behavior: 85%
  4. Click Timing: 91%
  5. Navigation History: 87%

Center circle: Target (80%)
Outer circle: Maximum (100%)
Area: Colored to show coverage
Current assessment: 88.6% average coherence
Trend: Stable and consistent
```

**5.2 Advanced Evasion Components (2x2)**
```
Type: Table Panel
Component                 | Effectiveness | Impact | Notes
──────────────────────────────────────────────────────────
Audio Context Spoofing    | 76%           | High   | Hardware limits
Font Detection Evasion    | 84%           | Medium | Effective
WebRTC Leak Prevention    | 91%           | High   | Critical
Header Randomization      | 87%           | High   | Excellent
User Agent Rotation       | 94%           | High   | Very stable
Timezone Spoofing         | 98%           | Medium | Very reliable
Resolution Spoofing       | 99%           | Medium | Nearly perfect

Color: Green if >80%, yellow if 60-80%, red if <60%
```

#### Row 6: Test Results & Alerts

**6.1 Recent Test Results (2x1)**
```
Type: Table Panel
Latest test cycles (hourly):
  14:00 | bot.sannysoft | Attempt: 100 | Pass: 87 | 87%   ✅
  13:00 | CreepJS       | Attempt: 100 | Pass: 81 | 81%   ✅
  12:00 | FingerprintJS | Attempt: 100 | Pass: 80 | 80%   ✅
  11:00 | browserleaks  | Attempt: 100 | Pass: 90 | 90%   ✅
  10:00 | PerimeterX    | Attempt: 100 | Pass: 65 | 65%   ⚠️
  09:00 | DataDome      | Attempt: 100 | Pass: 55 | 55%   ⚠️

Show: Last 24 test cycles
Drilldown: Full test details
```

**6.2 Evasion Alerts (2x1)**
```
Type: Alert List
Show: Evasion-specific alerts
Format:
  ⚠️  MEDIUM: DataDome effectiveness down 8% (12h)
  🟡 INFO: PerimeterX testing in progress
  ✅ Cleared: Canvas evasion now at 82%

Actions: Acknowledge, dismiss, tune thresholds
```

---

## DASHBOARD 6: Business Metrics (Product)

**Intended Audience:** Product Manager, Leadership  
**Refresh Rate:** 60 seconds  
**Time Range:** Last 7 days + monthly comparison  
**Update Frequency:** Daily

### Layout Grid (4 columns x 6 rows)

#### Row 1: Key Business Metrics

**1.1 Feature Usage Distribution (4x2)**
```
Type: Pie Chart
Show: Command type distribution
Largest segments:
  - Navigation: 28%
  - Screenshots: 22%
  - Content Extraction: 18%
  - Input (click/fill): 15%
  - Bot Evasion: 12%
  - Other: 5%

Hover: Show absolute counts and trend
Click: Drill to detailed usage breakdown
Compare: Same period last month
```

#### Row 2: Client Distribution

**2.1 Client Version Adoption (2x2)**
```
Type: Stacked Bar Chart (time series)
X: Days (last 30)
Y: Client count
Stacked by version:
  - v12.0.0: Green (latest, growing)
  - v11.3.0: Blue (previous, declining)
  - v11.2.0: Orange (old, rare)
  - Older: Gray (deprecated)

Show: Percentage adoption
Trend: How fast are clients upgrading?
Next milestone: Target 100% on v12 by [date]
```

**2.2 Client Geographic Distribution (2x2)**
```
Type: Geo Map / Table
Show: Active clients by region
Top regions:
  North America: 45%
  Europe: 35%
  Asia: 15%
  Other: 5%

Color: Intensity by client count
Hover: Show absolute numbers and growth
Comparison: Same period last month
```

#### Row 3: Deployment Metrics

**3.1 Deployment Status (2x1)**
```
Type: Timeline Panel
Show: Last 10 deployments
Format:
  ✅ v12.0.0: Deployed 2h ago, 100% success
  ✅ v11.3.0: Deployed 3 days ago, 100% success
  ⚠️  v11.2.0: Deployed 1 week ago, 1 rollback
  ✅ v11.1.0: Archived

Status: Green (success), Yellow (with rollback), Red (failed)
Duration: Show deployment time
Impact: Any errors during/after?
```

**3.2 Uptime SLA (2x1)**
```
Type: Gauge Panel
Metric: SLA compliance
Current: 99.98% (Target: 99.95%)
Status: ✅ Exceeding target
Period: Last 30 days
Incidents: 1 (12m 35s)
Forecast: Trend shows improving uptime
Color: Green if >99%, yellow if <99%
```

#### Row 4: Usage Trends

**4.1 Daily Active Clients (2x2)**
```
Type: Line Graph + Area
Y-Axis: Active client count
X: Days (last 30)
Metrics:
  - Active clients (blue line)
  - Peak clients per day (light blue area)
  - 30-day average (green line)

Trend: Growing, stable, or declining?
Annotation: New features, marketing, outages
Forecast: Projected growth
```

**4.2 Commands Per Client (2x2)**
```
Type: Line Graph
Y-Axis: Avg commands per active client
X: Days (last 30)
Show:
  - Trend line (red)
  - Moving average (blue)
  - Min/Max range (gray)

Observation: Are clients more/less active?
Seasonal pattern: Weekly patterns visible?
Compare: Last month's activity level
```

#### Row 5: Engagement Metrics

**5.1 Feature Adoption (2x2)**
```
Type: Adoption Curve
Show: Cumulative adoption of new features (Phase 3)
Phase 3 Features:
  - Advanced Evasion: 65% adoption (15 days)
  - Session Recording: 42% adoption (10 days)
  - Forensic Analysis: 28% adoption (5 days)

Curve: S-curve expected, currently linear or accelerating?
Comparison: Historical adoption curves
Recommendation: Feature maturity status
```

**5.2 Issue Resolution Rate (2x2)**
```
Type: Table Panel
Columns: Issue Type, Reported, Resolved, Avg Time
Rows:
  Bug Reports      | 23  | 22  | 2.5h ✅
  Feature Requests | 12  | 3   | Pending
  Support Cases    | 47  | 45  | 4.2h ✅
  Performance      | 8   | 8   | 1.5h ✅

Show: SLA compliance
Color: Green if resolved within SLA, red if overdue
Trend: Is resolution time improving?
```

#### Row 6: Forecast & Goals

**6.1 Revenue Impact / ROI (2x2)**
```
Type: Stats Panel
Estimated metrics:
  Deployment Stability: 99.98% (↑ from 99.5%)
  Performance Improvement: 22-53% (Sprint 2 expected)
  Evasion Effectiveness: 77.2% (↑ from 72%)
  Client Satisfaction: 92% (based on feedback)

Value:
  Downtime reduction: $X,XXX/month saved
  Performance SLA credit: Reduced from $X → $Y
  Evasion premium customers: +15 new customers
```

**6.2 Quarterly Goals (2x2)**
```
Type: Progress Bars
Goals for Q2 2026:
  ✅ Evasion > 75%: 77.2% achieved (Exceeded)
  ✅ Uptime > 99.5%: 99.98% achieved (Exceeded)
  ⏳ Latency < 600ms P95: 531ms achieved (Exceeded)
  ⏳ 100 active clients: 87 clients (Approaching)

Color: Green if complete, blue if in progress, gray if not started
Expected completion dates shown
On-track to exceed targets?
```

---

## 7. Dashboard Implementation Checklist

### Pre-Deployment
- [ ] Grafana instance deployed and configured
- [ ] InfluxDB (or time-series DB) configured with retention policies
- [ ] Metrics export endpoint implemented in WebSocket server
- [ ] Dashboards created from templates above
- [ ] Test data loaded (24 hours of sample metrics)

### Testing
- [ ] Dashboard loads within 5 seconds
- [ ] Real-time refresh working (5-60s depending on dashboard)
- [ ] Drill-down links functional
- [ ] Alert correlation working
- [ ] All graphs rendering correctly
- [ ] Mobile view responsive (if required)

### Production Deployment
- [ ] Dashboards backed up
- [ ] Team trained on dashboard navigation
- [ ] On-call briefed on key metrics
- [ ] Alert links configured
- [ ] Performance validated under load

---

## 8. Customization Guide

### Adding Custom Metrics

```
Steps to add new metric to dashboard:

1. Create metric in monitoring code (e.g., `metrics/custom.js`)
2. Export metric via /metrics endpoint
3. Configure InfluxDB scrape job if needed
4. Add new panel to relevant dashboard
5. Configure alert thresholds if applicable
6. Test with sample data
7. Train team on new metric
```

### Threshold Tuning

```
If alert fires too frequently:
1. Review alert threshold (may be too aggressive)
2. Check for false positives (environmental factors)
3. Adjust threshold if pattern is known
4. Document tuning decision
5. Re-evaluate in 1 week
```

---

**Document Version:** 1.0  
**Last Updated:** May 11, 2026  
**Status:** Ready for Implementation
