# Scaling Decision Matrix

**Basset Hound Browser v12.1.0**  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Scaling Decision Matrix](#scaling-decision-matrix)
3. [Threshold Definitions](#threshold-definitions)
4. [Scaling Triggers](#scaling-triggers)
5. [Decision Automation Rules](#decision-automation-rules)
6. [Scaling Decision Examples](#scaling-decision-examples)

---

## Overview

This document provides automated decision logic for determining when and how to scale the Basset Hound Browser infrastructure. It eliminates guesswork from scaling decisions and enables rapid response to load changes.

**Key Principles:**
- Decisions are data-driven (metrics-based)
- Multiple signals confirm scaling need (avoid false positives)
- Thresholds account for normal fluctuations (no action on spikes)
- Clear escalation path from monitoring to action
- Rollback procedures always available

---

## Scaling Decision Matrix

### Primary Scaling Matrix

| Metric | Green (<70%) | Yellow (70-85%) | Red (85-95%) | Critical (>95%) | Action |
|--------|------------|----------------|-------------|-----------------|--------|
| **CPU Usage** | Healthy | Monitor | Investigate | Scale immediately | Vertical first |
| **Memory Usage** | Healthy | Monitor | Investigate | Scale immediately | Vertical or horizontal |
| **Database Connections** | Healthy | Monitor | Add replicas | Scale immediately | Horizontal + DB |
| **Disk Space** | Healthy | Monitor | Cleanup + plan | Cleanup + scale | Add storage |
| **Network I/O** | Healthy | Monitor | Investigate | Scale immediately | Horizontal |
| **Queue Depth** | Healthy | Monitor | Drain queue | Auto-scale workers | Horizontal |
| **P99 Latency** | <100ms | 100-250ms | 250-500ms | >500ms | Identify bottleneck |
| **Error Rate** | <0.1% | 0.1-0.5% | 0.5-1% | >1% | Page on-call |

### Secondary Scaling Matrix (Confirming Signals)

| Scenario | CPU | Memory | Disk | Latency | Connections | Action Needed |
|----------|-----|--------|------|---------|-------------|---------------|
| Normal load | <60% | <50% | <60% | <50ms | <30 | None |
| Steady growth | 60-70% | 50-70% | 60-75% | 50-100ms | 30-60 | Plan scaling |
| Approaching limit | 70-85% | 70-85% | 75-85% | 100-250ms | 60-80 | Execute scaling |
| At capacity | 85-95% | 85-95% | 85-95% | 250-500ms | 80-100 | Scale immediately |
| Overloaded | >95% | >95% | >95% | >500ms | >100 | Emergency response |

### Decision Logic Tree

```
START: Performance Monitoring Alert

├─ Is CPU > 85% for 5+ minutes? 
│  ├─ YES: Is memory also > 85%?
│  │  ├─ YES: Vertical scaling needed (upgrade instance type)
│  │  └─ NO: Possible CPU bottleneck - investigate
│  └─ NO: Continue to next check
│
├─ Is Memory > 85% for 5+ minutes?
│  ├─ YES: Check memory growth trend
│  │  ├─ Growing >10MB/hour: Possible memory leak - investigate
│  │  ├─ Stable: Memory pressure, need larger instance or horizontal
│  │  └─ Shrinking: GC working, continue monitoring
│  └─ NO: Continue to next check
│
├─ Is Disk > 85%?
│  ├─ YES: Check growth rate
│  │  ├─ >100MB/day: Need storage expansion or cleanup
│  │  └─ <100MB/day: Can defer if <90% within 7 days
│  └─ NO: Continue to next check
│
├─ Is P99 Latency > 250ms for 10+ minutes?
│  ├─ YES: Is DB latency high?
│  │  ├─ YES: Database bottleneck - add replicas or optimize
│  │  ├─ NO: Is CPU high?
│  │  │  ├─ YES: Compute bottleneck - scale
│  │  │  └─ NO: Network/cache issue - investigate
│  └─ NO: Continue to next check
│
├─ Is Error Rate > 0.5% for 5+ minutes?
│  ├─ YES: Is it transient or growing?
│  │  ├─ Transient: Monitor for recurrence
│  │  └─ Growing: Page on-call, investigate immediately
│  └─ NO: All systems healthy
│
└─ All metrics green: Continue normal operations
```

---

## Threshold Definitions

### CPU Utilization Thresholds

**Green Zone (0-60%):**
- Normal operating range
- Plenty of headroom for spikes
- No action needed
- Monitor for growth trends

**Yellow Zone (60-75%):**
- Sustained high load detected
- Schedule scaling review
- Monitor next 24-48 hours
- Identify growth cause
- Action: Plan scaling

**Red Zone (75-85%):**
- Approaching capacity limit
- Scaling decision needed soon
- Risk of temporary spikes exceeding capacity
- Action: Begin scaling execution

**Critical Zone (>85%):**
- At or exceeding capacity
- Risk of service degradation
- Immediate action required
- Action: Execute emergency scaling

**Sustained Over Time:**
```
<5 minutes:  Likely spike, monitor
5-15 min:    Possible sustained load, consider action
15-60 min:   Sustained high load, begin scaling
>60 min:     Critical, scale immediately
```

### Memory Utilization Thresholds

**Green Zone (0-60%):**
- Healthy memory usage
- Good GC efficiency
- No action needed

**Yellow Zone (60-75%):**
- Memory pressure increasing
- More frequent GC
- Monitor for growth rate
- Plan memory optimization
- Action: Monitor and plan

**Red Zone (75-85%):**
- Approaching out-of-memory
- GC becoming frequent
- Risk of OOM errors
- Action: Immediate analysis + scaling

**Critical Zone (>85%):**
- Severe memory pressure
- High risk of OOM crashes
- Immediate mitigation required
- Action: Scale or restart

**Growth Rate Indicator:**
```
<1MB/hour:    Normal memory churn
1-10MB/hour:  Possible memory growth, monitor
10-50MB/hour: Definite growth, investigate
>50MB/hour:   Memory leak likely, urgent fix needed
```

### Database Connection Pool Thresholds

**Utilization Formula:**
```
Pool_Utilization = Active_Connections / Max_Connections
```

**Green Zone (0-60%):**
- Plenty of available connections
- No queueing or wait time
- No action needed

**Yellow Zone (60-75%):**
- Approaching pool limit
- Add read replicas to distribute load
- Consider query optimization
- Action: Plan database scaling

**Red Zone (75-85%):**
- High risk of connection exhaustion
- Queries may queue
- Action: Execute database scaling

**Critical Zone (>85%):**
- Connection pool exhaustion imminent
- Queries queuing or timing out
- Action: Emergency connection scaling

**Example:**
```
Max Connections: 100
Active Connections: 75 (75% utilization)
├─ Zone: Red
├─ Action: Add read replica or optimize queries
└─ Timeline: Within 48 hours
```

### Disk Space Thresholds

**Green Zone (0-60% used):**
- Comfortable headroom
- No action needed
- Monitor for growth trends

**Yellow Zone (60-75% used):**
- Plan storage expansion
- Schedule cleanup of old logs
- Monitor growth rate
- Action: Plan storage scaling

**Red Zone (75-85% used):**
- Storage scaling needed soon
- Increase monitoring frequency
- Begin expansion process
- Action: Execute storage expansion

**Critical Zone (>85% used):**
- Immediate storage action needed
- Risk of disk full within 24-48 hours
- Cleanup old data/logs
- Action: Expand immediately

**Growth Rate Indicator:**
```
<100MB/day:   Slow growth, no urgency
100-500MB/day: Moderate growth, plan within 2 weeks
500MB-2GB/day: Fast growth, plan within 1 week
>2GB/day:     Very fast growth, plan immediately
```

### Response Latency Thresholds

**Green Zone (P99 <100ms):**
- Excellent performance
- User experience good
- No action needed

**Yellow Zone (P99 100-250ms):**
- Some latency increase
- Investigate root cause
- Monitor for deterioration
- Action: Monitor and investigate

**Red Zone (P99 250-500ms):**
- Noticeable latency
- Customer complaints possible
- Root cause analysis urgent
- Action: Diagnose and fix

**Critical Zone (P99 >500ms):**
- Severe latency
- Customer experience degraded
- Immediate action required
- Action: Page on-call, diagnose urgently

**Breakdown by Component:**
```
Target: P99 <100ms total
├─ Network: <5ms
├─ Load Balancer: <1ms
├─ Server Processing: <50ms
├─ Database: <30ms
└─ Response Serialization: <5ms

Diagnosis:
- High server processing? → CPU/memory scaling
- High database latency? → Query optimization or replicas
- High network latency? → Network investigation or geo-distribution
```

### Error Rate Thresholds

**Green Zone (<0.1%):**
- Excellent reliability
- Normal error distribution
- No action needed

**Yellow Zone (0.1-0.5%):**
- Slightly elevated errors
- Investigate error types
- May be transient
- Action: Monitor and investigate

**Red Zone (0.5-1.0%):**
- Significant error rate increase
- Customer-visible impact
- Likely systemic issue
- Action: Page on-call, diagnose

**Critical Zone (>1.0%):**
- Service reliability compromised
- Immediate incident response
- Action: Escalate, war room, fix urgently

**Error Type Analysis:**
```
5xx errors:    Server issue, likely infrastructure
4xx errors:    Client issue or API change
Timeout errors: Latency or resource exhaustion
Auth errors:   Security or session issue
Database err:  DB connectivity or performance
```

---

## Scaling Triggers

### Automatic Triggers (No Approval Needed)

**Immediate Action Thresholds:**

1. **Memory Critical (>90% for 2+ minutes)**
   ```
   Action: Trigger garbage collection + alert
   Auto-action: Restart if not responding
   Escalation: Page on-call if restart fails
   ```

2. **Disk Critical (>95% for 1+ minute)**
   ```
   Action: Emergency cleanup routine
   Auto-action: Delete logs >7 days old
   Escalation: Alert if cleanup insufficient
   ```

3. **Error Rate Critical (>1% for 5+ minutes)**
   ```
   Action: Page on-call immediately
   Auto-action: Enable read-only mode if necessary
   Escalation: Incident commander engagement
   ```

4. **P99 Latency Critical (>1000ms for 10+ minutes)**
   ```
   Action: Page on-call, assess scaling need
   Auto-action: Enable request queueing
   Escalation: Service degradation notification to customers
   ```

### Manual Triggers (Review Required)

**Requires Human Decision:**

1. **Sustained High CPU (75%+ for 30+ minutes)**
   ```
   Trigger: Monitoring alert
   Owner: On-call engineer
   Decision: Vertical vs horizontal scaling
   Timeline: 1 hour to decision
   ```

2. **Approaching Capacity (70%+ on 2+ resources)**
   ```
   Trigger: Capacity planning alert
   Owner: Infrastructure lead
   Decision: Scaling timeline and approach
   Timeline: 24 hours to decision
   ```

3. **High Database Load (80%+ connections for 20+ minutes)**
   ```
   Trigger: Database monitoring alert
   Owner: DBA or infrastructure lead
   Decision: Replicas, optimization, or schema changes
   Timeline: 24 hours to decision
   ```

4. **Rapid Growth (20%+ increase in 1 week)**
   ```
   Trigger: Growth metrics alert
   Owner: Product + infrastructure leads
   Decision: Proactive scaling plan
   Timeline: 48 hours to plan
   ```

### Planned Triggers (Scheduled Review)

**Routine Capacity Reviews:**

1. **Weekly Review (Every Monday)**
   ```
   Metrics: CPU avg, memory peak, disk used, request count
   Action: Compare to previous week, identify trends
   Owner: On-call engineer
   Decision: Any immediate scaling needs?
   ```

2. **Monthly Review (1st of month)**
   ```
   Metrics: Full month trend, capacity forecast, cost
   Action: Update capacity projections, review growth rate
   Owner: Infrastructure lead
   Decision: Scaling for next 3 months?
   ```

3. **Quarterly Review (Every 3 months)**
   ```
   Metrics: Quarterly trends, architecture assessment, cost-benefit
   Action: Major architecture decisions, vendor negotiations
   Owner: Engineering leadership
   Decision: Infrastructure investments for next quarter?
   ```

---

## Decision Automation Rules

### Rule Engine Configuration

**Format: IF [Condition] FOR [Duration] THEN [Action]**

```yaml
rules:
  - rule_id: cpu_high_sustained
    name: "CPU High - Sustained"
    condition: "cpu_usage_percent > 75"
    duration: "5m"
    severity: "warning"
    action: "alert_oncall"
    message: "CPU sustained at {current}% for 5+ min, assess scaling"
    
  - rule_id: cpu_critical
    name: "CPU Critical"
    condition: "cpu_usage_percent > 85"
    duration: "2m"
    severity: "critical"
    action: "trigger_scaling_alert"
    message: "CPU critical at {current}%, begin vertical scaling"
    
  - rule_id: memory_pressure
    name: "Memory Pressure"
    condition: "memory_usage_percent > 85"
    duration: "5m"
    severity: "critical"
    action: "trigger_gc_and_alert"
    message: "Memory pressure at {current}%, force GC and assess scaling"
    
  - rule_id: database_connections_high
    name: "Database Connections High"
    condition: "db_pool_utilization > 80"
    duration: "10m"
    severity: "warning"
    action: "alert_dba"
    message: "DB connections {current}% of {max}, consider replicas"
    
  - rule_id: disk_critical
    name: "Disk Critical"
    condition: "disk_usage_percent > 90"
    duration: "1m"
    severity: "critical"
    action: "trigger_cleanup"
    message: "Disk critical at {current}%, running cleanup"
    
  - rule_id: latency_high
    name: "Latency High"
    condition: "p99_latency_ms > 250"
    duration: "10m"
    severity: "warning"
    action: "diagnose_bottleneck"
    message: "P99 latency high at {current}ms, investigating"
    
  - rule_id: error_rate_high
    name: "Error Rate High"
    condition: "error_rate_percent > 0.5"
    duration: "5m"
    severity: "critical"
    action: "page_oncall"
    message: "Error rate critical at {current}%, escalating"
    
  - rule_id: connections_active_high
    name: "Active Connections High"
    condition: "active_connections > 500"
    duration: "15m"
    severity: "warning"
    action: "plan_horizontal_scaling"
    message: "Active connections high at {current}, plan horizontal scaling"
```

### Auto-Scaling Policies

**Horizontal Scaling Policy:**

```yaml
horizontal_scaling:
  enabled: true
  
  trigger_metrics:
    - metric: cpu_usage_percent
      threshold: 75
      duration: 5m
      scale_amount: 1  # Add 1 instance
      max_instances: 10
      
    - metric: active_connections
      threshold: 1000
      duration: 10m
      scale_amount: 2
      max_instances: 10
      
    - metric: message_queue_depth
      threshold: 5000
      duration: 2m
      scale_amount: 1
      max_instances: 10
  
  scale_down:
    trigger_metric: cpu_usage_percent
    threshold: 40
    duration: 30m  # Only scale down after sustained low load
    scale_amount: 1
    min_instances: 2
  
  cooldown_period: 5m  # Minimum time between scaling actions
  
  testing:
    - max_scale_per_day: 10  # Prevent scaling loop
    - max_scale_per_week: 50
```

**Vertical Scaling Policy:**

```yaml
vertical_scaling:
  enabled: true
  
  trigger_metrics:
    - metric: memory_usage_percent
      threshold: 85
      duration: 10m
      action: upgrade_instance_type
      target_instance_type: "next_size_up"
      
    - metric: cpu_usage_percent
      AND: memory_usage_percent > 70
      threshold: 85
      duration: 5m
      action: upgrade_instance_type
      target_instance_type: "next_size_up"
  
  instance_upgrade_path:
    t3.large: t3.xlarge
    t3.xlarge: m5.large
    m5.large: m5.xlarge
    m5.xlarge: m5.2xlarge
    m5.2xlarge: m5.4xlarge
  
  max_upgrade_per_month: 2
```

---

## Scaling Decision Examples

### Example 1: Gradual CPU Growth (Conservative Scenario)

**Week 1 (Baseline):**
```
CPU: 45% average, peak 55%
Memory: 35% average, peak 45%
Disk: 40% used
P99 Latency: 50ms
Decision: GREEN - No action needed, monitor
```

**Week 2:**
```
CPU: 52% average, peak 62%
Memory: 40% average, peak 50%
Disk: 42% used
P99 Latency: 55ms
Trend: +7% CPU week-over-week
Decision: GREEN - Growth rate moderate, continue monitoring
Timeline: Capacity reached in ~8 weeks at current rate
```

**Week 3:**
```
CPU: 58% average, peak 68%
Memory: 45% average, peak 52%
Disk: 44% used
P99 Latency: 60ms
Trend: +6% CPU week-over-week (growth stable)
Decision: YELLOW - Schedule scaling review
Timeline: Capacity reached in ~5-6 weeks
Action: Plan vertical scaling (t3.xlarge to m5.large)
```

**Week 4:**
```
CPU: 63% average, peak 73%
Memory: 50% average, peak 58%
Disk: 46% used
P99 Latency: 65ms
Trend: +5% CPU week-over-week (growth slowing)
Decision: YELLOW - Initiate scaling preparation
Timeline: Capacity reached in ~4 weeks
Action: Order new instance, schedule maintenance window
```

**Week 5:**
```
CPU: 68% average, peak 78%
Memory: 54% average, peak 62%
Disk: 48% used
P99 Latency: 72ms
Trend: +5% CPU week-over-week
Decision: RED - Execute scaling within 7 days
Timeline: Critical level in ~3 weeks
Action: 
  1. Complete new instance setup
  2. Perform load test
  3. Schedule cutover
  4. Execute upgrade
```

### Example 2: Sudden Traffic Spike (Aggressive Scenario)

**Time T=0 (Normal)**
```
Active connections: 100
CPU: 40%
Memory: 35%
Status: NORMAL
```

**Time T+1 hour**
```
Active connections: 500
CPU: 65%
Memory: 50%
Status: YELLOW
Cause: Unknown traffic surge
Action: Investigation started
```

**Time T+2 hours**
```
Active connections: 1,200
CPU: 82%
Memory: 72%
P99 Latency: 180ms
Error Rate: 0.3%
Status: RED
Cause: Customer campaign or viral adoption
Action: 
  1. Page on-call engineer
  2. Begin horizontal scaling
  3. Enable aggressive caching
  4. Consider rate limiting
```

**Time T+3 hours**
```
Active connections: 1,500 (growing)
CPU: 88%
Memory: 78%
P99 Latency: 280ms
Error Rate: 0.6%
Status: CRITICAL
Action:
  1. Auto-scale triggered (add 2 instances)
  2. Enable request queuing
  3. Deploy circuit breakers
  4. War room activated
```

**Time T+4 hours**
```
Active connections: 1,200 (stabilizing)
CPU: 65% (distributed across 3 instances)
Memory: 55% (per-instance average)
P99 Latency: 120ms
Error Rate: 0.2%
Status: RECOVERING
Action:
  1. Confirm auto-scaling successful
  2. Monitor for stability
  3. Adjust rate limits if needed
  4. Continue to T+24 hours
```

**Time T+24 hours**
```
Active connections: 300 (traffic returning to normal)
CPU: 42% (across 3 instances)
Memory: 38%
P99 Latency: 55ms
Error Rate: 0.1%
Status: STABLE
Action:
  1. Begin scale-down planning
  2. Document incident
  3. Post-mortem scheduled
  4. Review auto-scaling effectiveness
```

### Example 3: Database Bottleneck (Slow Onset)

**Week 1**
```
Active connections: 80/100 (80% utilization)
Query latency: 15ms (p95)
Database CPU: 35%
Status: YELLOW
Decision: Monitor database performance
```

**Week 2**
```
Active connections: 85/100 (85% utilization)
Query latency: 25ms (p95)
Database CPU: 45%
Slow query count: 5
Status: RED
Decision: 
  - Add read replica (3-4 hours setup)
  - Optimize slow queries (1-2 weeks)
  - Monitor connection pool
```

**After Read Replica Deployment:**
```
Active connections: 60/100 (60% utilization)
  - Write: 15/100 (primary)
  - Read: 45/100 (replicas)
Query latency: 12ms (p95)
Database CPU: 25%
Slow query count: 2
Status: RECOVERED
Decision: Continue query optimization, monitor trend
```

---

## Implementation Checklist

### Setting Up Automated Scaling

- [ ] Install monitoring solution (Prometheus + Grafana)
- [ ] Define all threshold values (CPU, memory, disk, etc.)
- [ ] Configure alert rules in monitoring system
- [ ] Create runbooks for each scaling scenario
- [ ] Set up automated notifications (Slack, PagerDuty)
- [ ] Configure auto-scaling policies (if supported)
- [ ] Test scaling procedures in staging
- [ ] Document escalation paths
- [ ] Schedule regular capacity reviews
- [ ] Train team on decision matrix
- [ ] Create dashboard for capacity planning
- [ ] Set up cost tracking and alerts
- [ ] Validate rollback procedures
- [ ] Conduct scaling drills quarterly

---

## Related Documents

- [CAPACITY-ASSESSMENT.md](./CAPACITY-ASSESSMENT.md) - Detailed capacity analysis
- [HORIZONTAL-SCALING-PROCEDURES.md](./HORIZONTAL-SCALING-PROCEDURES.md) - How to add instances
- [VERTICAL-SCALING-PROCEDURES.md](./VERTICAL-SCALING-PROCEDURES.md) - How to upgrade instances
- [MONITORING-QUICK-START.md](./MONITORING-QUICK-START.md) - Metrics setup

---

**Document Version:** 1.0.0  
**Last Updated:** June 13, 2026  
**Next Review:** June 27, 2026 (2 weeks)  
**Owner:** Infrastructure Team
