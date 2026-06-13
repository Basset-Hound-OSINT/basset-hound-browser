# Complete Scaling Guide

**Basset Hound Browser v12.1.0**  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Table of Contents

1. [Scaling Overview](#scaling-overview)
2. [Quick Reference Decision Tree](#quick-reference-decision-tree)
3. [Scaling Scenarios](#scaling-scenarios)
4. [Common Scaling Mistakes](#common-scaling-mistakes)
5. [Cost Analysis Framework](#cost-analysis-framework)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## Scaling Overview

### The Scaling Journey

```
Phase 0: Single Instance (Baseline)
├─ Basset Hound: 1× t3.large
├─ Database: db.t3.medium (shared RDS)
├─ Capacity: 300 msg/s, 8,000 sessions
├─ Cost: $180/month
└─ Availability: 99.9% (single point of failure)

Phase 1: First Vertical Scale (Month 1-2)
├─ Basset Hound: 1× t3.xlarge (upgrade)
├─ Database: db.t3.medium (monitor)
├─ Capacity: 600 msg/s, 15,000 sessions
├─ Cost: $240/month (+33%)
└─ Availability: 99.9% (still single instance)

Phase 2: Horizontal Scale (Month 3-4)
├─ Basset Hound: 2-3 instances + load balancer
├─ Database: db.m5.large + read replica
├─ Capacity: 1,800-2,400 msg/s
├─ Cost: $500-600/month
└─ Availability: 99.99% (N+1 redundancy)

Phase 3: Database Optimization (Month 4-5)
├─ Basset Hound: 3-4 instances
├─ Database: db.m5.xlarge multi-AZ
├─ Capacity: 2,400-3,200 msg/s
├─ Cost: $800-1,000/month
└─ Availability: 99.99% (full HA)

Phase 4: Global Scale (Month 6+)
├─ Basset Hound: 5-10 instances per region
├─ Database: db.m5.2xlarge multi-region
├─ Capacity: 5,000+ msg/s per region
├─ Cost: $3,000+ per month
└─ Availability: 99.999% (multi-region)
```

### Scaling Fundamentals

**The Three Dimensions of Scaling:**

```
1. COMPUTE (CPU, threads, processes)
   ├─ Vertical: More cores per instance
   ├─ Horizontal: More instances
   └─ Best when: CPU is bottleneck

2. MEMORY (RAM, cache, sessions)
   ├─ Vertical: More RAM per instance
   ├─ Horizontal: Distribute sessions via Redis
   └─ Best when: Memory is bottleneck

3. STORAGE (Database, disk, logs)
   ├─ Read Scale: Add replicas
   ├─ Write Scale: Sharding (complex)
   ├─ Archival: Move old data to S3
   └─ Best when: Database is bottleneck
```

**Scaling Order (Most Important First):**

```
1. FIX QUERIES (Optimize before scaling)
   ├─ Add missing indexes (huge win)
   ├─ Rewrite slow queries
   ├─ Remove N+1 queries
   └─ Effort: Days, Cost: Free, Impact: 50%+ improvement

2. CACHE AGGRESSIVELY
   ├─ Redis for sessions (already done)
   ├─ Cache expensive queries
   ├─ Cache external API calls
   └─ Effort: 2-3 days, Cost: Low, Impact: 30-50%

3. VERTICAL SCALE
   ├─ Increase CPU, memory (easy)
   ├─ Usually solves 70% of issues
   └─ Effort: 30 minutes, Cost: Medium, Impact: Temporary

4. HORIZONTAL SCALE
   ├─ Add load balancer
   ├─ Add instances (complex)
   ├─ Replicate data
   └─ Effort: 2-4 hours, Cost: High, Impact: Unlimited

5. MULTI-REGION SCALE
   ├─ Global traffic routing
   ├─ Disaster recovery
   ├─ Reduced latency worldwide
   └─ Effort: 1-2 weeks, Cost: Very High, Impact: Excellent
```

---

## Quick Reference Decision Tree

### Scaling Decision Matrix (One-Page)

```
START: Performance Issue Detected

├─ Is it DATABASE SLOW?
│  ├─ YES: Latency >50ms, CPU >70%
│  │  ├─ Run EXPLAIN ANALYZE on slow queries
│  │  ├─ Add indexes (if needed)
│  │  ├─ Add read replicas
│  │  └─ Consider vertical DB scale
│  └─ NO: Continue
│
├─ Is it MEMORY PROBLEM?
│  ├─ YES: Usage >80%, GC frequent
│  │  ├─ Check for memory leaks (monitor/hour growth)
│  │  ├─ Increase cache TTL (evict stale)
│  │  ├─ Vertical scale (upgrade RAM)
│  │  └─ Horizontal scale if distributed workload
│  └─ NO: Continue
│
├─ Is it CPU PROBLEM?
│  ├─ YES: Usage >80%, latency high
│  │  ├─ Profile CPU (identify hot code)
│  │  ├─ Optimize algorithms (30 min - days)
│  │  ├─ Vertical scale (upgrade CPU)
│  │  └─ Horizontal scale (distribute work)
│  └─ NO: Continue
│
├─ Is it NETWORK PROBLEM?
│  ├─ YES: Bandwidth >800Mbps, packet loss
│  │  ├─ Reduce payload size (compression)
│  │  ├─ Optimize protocol (batch messages)
│  │  ├─ Horizontal scale (distribute)
│  │  └─ Consider CDN
│  └─ NO: Continue
│
└─ Is it CONNECTION LIMIT?
   ├─ YES: Active connections at limit
   │  ├─ Check for connection leaks
   │  ├─ Increase pool size (if room)
   │  ├─ Connection pooling (PgBouncer)
   │  └─ Horizontal scale (more instances)
   └─ NO: Possible false alarm - verify metrics
```

### Decision Quick Reference

| Current Load | Next Step | Timeline | Cost Impact |
|--------------|-----------|----------|------------|
| <40% capacity | Monitor | None | $0 |
| 40-60% | Plan scaling | 2 weeks | Minimal |
| 60-75% | Scaling decision | 1 week | Low-Medium |
| 75-85% | Execute scaling | Immediate | Medium |
| >85% | Emergency scaling | Now | High |

---

## Scaling Scenarios

### Scenario 1: Steady Growth (20% Monthly)

**Timeline: Months 1-6**

```
Month 0: Baseline
├─ CPU: 40%
├─ Memory: 35%
├─ Load: 100 msg/s
└─ Instance: t3.large

Month 1 (20% growth)
├─ CPU: 50% (18/12 × 40%)
├─ Memory: 42%
├─ Load: 120 msg/s
└─ Action: Monitor

Month 2 (20% growth)
├─ CPU: 60%
├─ Memory: 50%
├─ Load: 144 msg/s
└─ Action: Plan vertical scale

Month 3 (20% growth)
├─ CPU: 72%
├─ Memory: 60%
├─ Load: 173 msg/s
├─ Action: Execute vertical scale
└─ NEW INSTANCE: t3.xlarge

Month 4 (growth continues)
├─ CPU: 42% (reset after upgrade)
├─ Memory: 35%
├─ Load: 207 msg/s
└─ Action: Monitor again

Month 5 (20% growth)
├─ CPU: 52%
├─ Memory: 42%
├─ Load: 249 msg/s
└─ Action: Plan horizontal scale

Month 6 (20% growth)
├─ CPU: 62%
├─ Memory: 50%
├─ Load: 298 msg/s
├─ Action: Execute horizontal scale
└─ NEW SETUP: 2 × t3.xlarge + LB
```

**Key Points:**
- Vertical scale first (quick, less complex)
- Monitor 4-6 weeks after each scale
- Horizontal scale when approaching instance limits
- Cost increases gradually ($60 → $120 → $240)

### Scenario 2: Traffic Spike (Unexpected 3x Growth)

**Timeline: Hours 0-24**

```
Hour 0: Normal Operations
├─ Load: 100 msg/s
├─ CPU: 40%
├─ Status: All systems green

Hour 1-2: Spike Detected
├─ Load: 150 msg/s (50% increase)
├─ CPU: 60% (growing fast)
├─ Alerts: Yellow (monitor)

Hour 2-3: Rapid Growth
├─ Load: 250 msg/s (150% total increase)
├─ CPU: 75% (approaching red)
├─ Alerts: RED (scaling decision)
├─ Action: Activate war room

Hour 3-4: Emergency Scaling
├─ Load: 300 msg/s (3x baseline!)
├─ CPU: 85%+ (critical)
├─ Action: Horizontal scaling triggered
├─ START: Deploy load balancer
├─ START: Deploy 2 additional instances

Hour 4-5: Scale Execution
├─ LB: Online, routing traffic
├─ Instance 1: Original (100 msg/s capacity)
├─ Instance 2: New (100 msg/s capacity)
├─ Instance 3: New (100 msg/s capacity)
├─ Total capacity: 300 msg/s
├─ Action: Monitor health checks

Hour 5-6: Stabilization
├─ Load: 280 msg/s (stable)
├─ CPU: 60% per instance
├─ Error rate: <0.1%
├─ Status: Recovered, no degradation

Hour 6-24: Post-Incident
├─ Load: 200 msg/s (returning to normal)
├─ CPU: 50% per instance
├─ Action: Post-mortem
├─ Action: Plan for sustained growth
└─ Decision: Keep 3 instances or scale down?
```

**Response Checklist:**
- [ ] War room activated (Slack, Zoom)
- [ ] On-call team assembled
- [ ] Customer communication ready
- [ ] Rollback plan reviewed
- [ ] Horizontal scaling initiated (1 hour)
- [ ] Health checks monitoring (every minute)
- [ ] Cost tracking enabled
- [ ] Post-incident analysis scheduled

### Scenario 3: Seasonal Peak (Black Friday 5x)

**Timeline: Weeks 1-4**

```
Week 0 (Preparation)
├─ Forecast: 5x normal load expected
├─ Baseline load: 100 msg/s
├─ Peak expected: 500 msg/s
├─ Planning: Need 2 instances to stay under 80% CPU
├─ Action: Pre-provision instances
├─ Action: Run load tests
└─ Action: Brief team

Week 1 (Ramp-up)
├─ Load: 150 msg/s (1.5x)
├─ Status: Green, monitoring
├─ Decision: Instances ready but not yet online

Week 2 (Peak)
├─ Load: 450 msg/s (4.5x!)
├─ Status: Red without scaling
├─ Action: Activate additional instances
├─ New topology: 4 instances + LB
├─ CPU per instance: 55% (well-distributed)
├─ Monitoring: Intensive (every 5 min)

Week 3 (Sustained Peak)
├─ Load: 400 msg/s average
├─ Status: Stable, monitoring
├─ Action: Continue with 4 instances
├─ Cost: $480/month (temporary spike)

Week 4 (Wind Down)
├─ Load: 250 msg/s (declining)
├─ Status: Green, wind-down
├─ Decision: Scale down to 2 instances?
├─ Question: Will load return post-peak?
├─ Action: Keep 3 instances (N+1, balance)
└─ New baseline: 3 instances permanently
```

**Planning Checklist:**
- [ ] 4 weeks before: Forecast peak load
- [ ] 2 weeks before: Provision infrastructure
- [ ] 1 week before: Load test at peak
- [ ] Day before: Brief team, test procedures
- [ ] Peak day: Intensive monitoring
- [ ] 1 week after: Post-mortem
- [ ] 2 weeks after: Cost analysis

---

## Common Scaling Mistakes

### Mistake 1: Scaling Without Identifying Bottleneck

**What Happens:**
```
Symptom: Latency increasing
Action: "Let's just add more servers"
Result: 3 new instances deployed, latency still high
Cost: +$300/month wasted
```

**Correct Approach:**
```
Step 1: Collect metrics (CPU, memory, disk, network, DB)
Step 2: Identify which is >80% (bottleneck)
Step 3: Address THAT resource specifically
Step 4: Re-test

Example:
├─ CPU: 45% (not bottleneck)
├─ Memory: 85% (BOTTLENECK)
├─ Network: 30% (not bottleneck)
├─ Database: 70% (not bottleneck)
└─ Action: Vertical scale memory, not horizontal scale
```

**Impact:**
- Correct approach: Fix with 1 × RAM upgrade ($80/mo)
- Mistake approach: Add 3 instances ($300/mo) that don't help

### Mistake 2: Not Scaling Database (Bottleneck Moves)

**What Happens:**
```
Phase 1: Single instance saturated, horizontal scale to 3
├─ Result: CPU bottleneck removed ✓

Phase 2: Database connection pool now exhausted
├─ Result: All 3 instances blocked on DB queries ✗
├─ Latency: 500ms (worse than before!)
└─ Cost: $300/month for 3 instances doing nothing useful
```

**Correct Approach:**
```
Before horizontal scaling:
├─ Assess database capacity
├─ If connection pool >60% at peak: Add replicas first
├─ If queries >25ms p95: Optimize or add replicas
├─ Calculate: Need X database connections × N instances

Example:
├─ Baseline: 1 instance, 50 DB connections needed
├─ Scale to 3: Need 150 DB connections
├─ Action: Increase pool from 100 max to 200 max
├─ Better: Add read replicas (for read queries)
└─ Best: Optimize queries first (reduce connections needed)
```

**Prevention:**
- [ ] Database capacity assessment before horizontal scaling
- [ ] Load test with N×instances
- [ ] Verify DB connection pool sufficient
- [ ] Monitor DB latency post-scaling

### Mistake 3: Ignoring Query Optimization

**What Happens:**
```
Baseline: Single instance, 100 msg/s, 60% CPU
Action: Vertical scale to 4 CPU (was 2)
Result: Single instance, 200 msg/s, 60% CPU (expected)

But...
Action: Repeat every 3 months as load grows
Result: Year later: 32-CPU instance, $3,000/month
Reality: Could have optimized and stayed at $200/month
```

**Cost Impact:**
```
With Query Optimization:
├─ Baseline: t3.large ($60/mo) @ 300 msg/s
├─ Never upgrade (optimization reduces load 30%)
└─ Cost: $60/month

Without Query Optimization (scaling):
├─ Month 1: t3.xlarge ($120/mo)
├─ Month 3: m5.2xlarge ($320/mo)
├─ Month 6: m5.4xlarge ($640/mo)
├─ Month 12: Still hitting limits
└─ Cost: $640+/month

Difference: $580/month (~$7,000/year) wasted
```

**Prevention:**
- [ ] Profile before scaling (identify slow queries)
- [ ] Optimize 2-3 slow queries (30-50% impact often)
- [ ] Add indexes where missing
- [ ] Only scale when optimization exhausted

### Mistake 4: Scaling Without Testing

**What Happens:**
```
Horizontal Scaling Plan:
├─ Deploy load balancer: 30 min
├─ Deploy 2 new instances: 20 min
├─ Configure: 10 min
└─ Go live: 10 min → CRASH!

Real Results:
├─ Database connection pool exhausted
├─ Session affinity misconfigured
├─ Load balancer health checks wrong
└─ Recovery time: 2 hours
└─ Customer impact: Outage
```

**Correct Approach:**
```
Pre-Scaling Testing (staging environment):
├─ Deploy identical setup to staging
├─ Load test with production-like load
├─ Failure scenarios (one instance down)
├─ Database connection verification
├─ Session affinity verification
├─ Monitor for 1+ hours
├─ Document all findings
└─ Only then: Deploy to production
```

**Prevention:**
- [ ] Staging environment that mirrors production
- [ ] Load test before every scaling event
- [ ] Failure scenario tests (chaos engineering)
- [ ] Rollback procedure tested
- [ ] Team dry-run before actual execution

### Mistake 5: Over-Scaling for Peak (Leaving Unused Capacity)

**What Happens:**
```
Black Friday Planning:
├─ Forecast peak: 500 msg/s
├─ Deploy 5 instances (400+ msg/s capacity each)
├─ Reality: Peak was 350 msg/s only
├─ Cost: 2 instances wasted = $240/month
├─ Duration: Never scaled back down (forgot)
└─ Ongoing waste: $240/month × 12 months = $2,880/year
```

**Correct Approach:**
```
Scaling with Waste Avoidance:
├─ Conservative forecast: 500 msg/s
├─ Deploy 2 instances first (cover 200 msg/s baseline)
├─ Have ready-to-deploy 3rd and 4th (in 30 min)
├─ Monitor peak load continuously
├─ Add instances only as needed
├─ Scale down 1 day after peak (don't leave running)

Result:
├─ Day 1: 2 instances running
├─ Day 2 (peak): 4 instances (if needed)
├─ Day 3: 3 instances (keep 1 spare)
├─ Week later: 2 instances (return to baseline)
└─ Cost: Minimal unnecessary spend
```

**Prevention:**
- [ ] Forecast conservatively, scale incrementally
- [ ] Disable auto-scaling that never scales down
- [ ] Set scale-down rules explicitly
- [ ] Quarterly cost review for orphaned resources
- [ ] Set budget alerts

---

## Cost Analysis Framework

### Cost Per Request Model

**Formula:**
```
Cost Per Million Requests = (Monthly Infrastructure Cost / Monthly Requests) × 1,000,000
```

**Example Calculation:**

```
Baseline (t3.large, $60/month):
├─ Baseline load: 300 msg/s
├─ Hours in month: 730 (30 days)
├─ Average load: 200 msg/s (accounting for traffic variation)
├─ Requests/month: 200 msg/s × 3,600 s/hr × 730 hr/month
│   = 524,400,000 requests/month
├─ Cost per million: ($60 / 524.4M) × 1M = $0.114/million
└─ Cost per request: $0.000000114

With Scaling (m5.xlarge, $200/month):
├─ Load: 500 msg/s average
├─ Requests/month: 500 × 3,600 × 730 = 1,314,000,000
├─ Cost per million: ($200 / 1,314M) × 1M = $0.152/million
├─ ⚠️ Cost increased by 33% despite 2.5x throughput!
└─ But: System is now stable and has headroom
```

**Cost Trend Analysis:**

```
Vertical Scaling (Moore's Law): Costs grow exponentially
├─ t3.large: $60/mo, 300 msg/s = $0.20/M
├─ t3.xlarge: $120/mo, 600 msg/s = $0.20/M (similar!)
├─ t3.2xlarge: $240/mo, 1,000 msg/s = $0.24/M (worse!)
└─ Lesson: Single instance doesn't scale cost-effectively

Horizontal Scaling: Costs grow linearly
├─ 1 instance: $60/mo, 300 msg/s = $0.20/M
├─ 2 instances + LB: $160/mo, 600 msg/s = $0.27/M
├─ 3 instances + LB: $240/mo, 900 msg/s = $0.27/M
├─ 5 instances + LB: $400/mo, 1,500 msg/s = $0.27/M
└─ Lesson: Linear cost growth is sustainable long-term
```

### ROI Analysis

**When Does Scaling ROI Become Positive?**

```
Scenario: Horizontal Scaling Decision

One-Time Costs:
├─ Load Balancer setup: $1,000
├─ Instance provisioning: $500
├─ Configuration/testing: $1,000
└─ Total: $2,500

Recurring Costs:
├─ Before: 1 × t3.large = $60/month
├─ After: 2 × t3.xlarge + LB = $300/month
├─ Monthly increase: $240/month

Revenue Increase (assumed):
├─ Before: 300 msg/s peak = lost customers at peak
├─ After: 600 msg/s peak = capture more customers
├─ Assumption: 50% revenue increase from capacity
├─ Baseline revenue: $100k/month (needs assessment)
├─ New revenue: $150k/month = +$50k/month

Break-Even Analysis:
├─ One-time cost: $2,500
├─ Additional cost: $240/month
├─ Additional revenue: $50,000/month
├─ Break-even: < 1 month!
└─ ROI (Year 1): Positive ~10x
```

### Budget Forecasting

**6-Month Cost Projection:**

```
Conservative Scenario (10% growth/month):

Month 1:
├─ Basset Hound: 1 × t3.large = $60
├─ Database: db.t3.medium = $80
├─ Cache: cache.t3.small = $30
├─ LB/Network: $25
└─ Total: $195/month

Month 2:
├─ Growth: 10% → ~110 msg/s
├─ Instance: Still t3.large
└─ Total: $195/month

Month 3:
├─ Growth: 10% → ~132 msg/s
├─ Approaching limit
├─ Upgrade planned
└─ Total: $195/month

Month 4:
├─ Growth: 10% → ~145 msg/s
├─ Execute upgrade: t3.xlarge
├─ Basset Hound: 1 × t3.xlarge = $120
├─ Database: Upgraded to db.m5.large = $200
└─ Total: $395/month

Month 5:
├─ Growth: 10% → ~160 msg/s
├─ Horizontal scale: Add 1 instance
├─ Basset Hound: 2 × t3.xlarge + LB = $280
├─ Database: db.m5.large = $200
└─ Total: $555/month

Month 6:
├─ Growth: 10% → ~176 msg/s
├─ All instances stable
├─ Basset Hound: 2 × t3.xlarge + LB = $280
├─ Database: db.m5.large = $200
└─ Total: $555/month
```

---

## Troubleshooting Guide

### Issue: After Horizontal Scaling, Latency Increased

**Diagnosis:**

```bash
# 1. Check LB distribution
curl http://lb:9090/admin/backends | jq '.backends[] | {host, connections}'

# 2. Check per-instance latency
curl instance-1:9001/metrics | grep p99_latency
curl instance-2:9002/metrics | grep p99_latency
curl instance-3:9003/metrics | grep p99_latency

# 3. Check database latency
psql -h db -U basset -d basset -c "\timing on" -c "SELECT COUNT(*) FROM sessions;"

# 4. Check session affinity
for i in {1..5}; do
  curl -H "X-Session-ID: test" http://lb:8765/test -w "Instance: %{header_x-instance}\n" -o /dev/null
done
```

**Root Causes & Fixes:**

| Cause | Symptoms | Fix |
|-------|----------|-----|
| DB connection pool exhausted | Latency spike on all instances | Increase pool size or add replicas |
| Session affinity disabled | Requests bounce between instances | Enable sticky sessions in LB |
| One instance slow | Latency varies per instance | Investigate slow instance, possibly remove from LB |
| Network saturation | High packet loss | Optimize payloads, enable compression |
| Load not balanced | Some instances high, some low | Check LB algorithm (switch to least-connections) |
| Cache misses | Higher latency, more DB queries | Increase cache TTL, pre-warm cache |

### Issue: Database Becomes Bottleneck After Scaling

**Diagnosis:**

```bash
# 1. Check connection pool utilization
psql -h db -U basset -d basset -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# 2. Check slow queries
psql -h db -U basset -d basset -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"

# 3. Check indexes
psql -h db -U basset -d basset -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';"

# 4. Check replica lag
SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_wal_receive_lsn() IS NULL))::INT as lag_seconds;
```

**Solutions (in order of effort):**

1. **Quick Wins (Hours)**
   - Add missing indexes
   - Increase connection pool
   - Enable query cache
   
2. **Medium Term (Days)**
   - Add read replicas
   - Optimize slow queries
   - Archive old data
   
3. **Long Term (Weeks)**
   - Database vertical scale
   - Database horizontal scale (sharding)
   - Schema redesign

---

**Document Version:** 1.0.0  
**Last Updated:** June 13, 2026  
**Next Review:** June 27, 2026 (2 weeks)  
**Owner:** Infrastructure / DevOps Team
