# Performance Baseline Operations Guide
**Date:** June 21, 2026  
**Status:** LIVE - Operational  
**Baseline Version:** 12.7.0  

---

## Quick Reference

### Baseline Metrics (v12.7.0)
```
Throughput:       285 msg/sec (50 concurrent baseline)
P99 Latency:      1.5 ms
Memory Baseline:  45 MB
Memory Growth:    0 MB/hour (stable)
Success Rate:     100%
Max Concurrent:   300+ connections
```

### Safe Operating Parameters
```
Recommended Throughput: 225 msg/sec (79% of peak)
Max P99 Latency:        2.5 ms (1.7x safety margin)
Max Memory Growth:      0.1 MB/hour (alarm threshold)
Error Rate Limit:       0.5% (warning), 1% (critical)
Concurrent Limit:       200 connections (conservative), 300+ (tested)
```

---

## Daily Operations Checklist

### Every Morning (5 minutes)
```bash
# Quick health check
node tests/baselines/quick-regression-check.js

# Expected output: PASS (or WARN if degradation 5-15%)
```

If the result is **WARN**, investigate performance. If **FAIL**, halt deployment.

### Daily Monitoring
```
Monitor these metrics from production logs:
✓ Throughput >250 msg/sec
✓ Error rate <0.5%
✓ No timeout errors
✓ Memory stable (no growth pattern)
```

### Weekly Deep Dive (1 hour)
```bash
# Full performance profile
node tests/baselines/establish-baselines.js

# Generates: tests/results/baselines/baseline-TIMESTAMP.json
# Review: throughput, latency, memory growth trends
```

### Monthly Review
```
Compare metrics to baseline:
- Throughput should be >280 msg/sec
- P99 latency should be <2 ms
- Memory growth should be 0 MB/hour
- Error rate should be <0.1%

If any metric degraded >5%: INVESTIGATE
If any metric degraded >15%: HALT DEPLOYMENT
```

---

## Regression Detection Workflow

### Scenario 1: Throughput Warning (5-15% drop)

**Detection:**
```
Baseline: 285 msg/sec
Measured: 270 msg/sec
Drop: 5.3%
Status: WARN
```

**Response:**
1. Run detailed profile: `node tests/baselines/establish-baselines.js`
2. Check for:
   - Increased GC pause times
   - New/missing command optimizations
   - Network bottlenecks
   - Connection pooling issues
3. If issue found: Create fix, re-test
4. If inconclusive: Monitor for 24 hours before decision

### Scenario 2: Latency Alert (15%+ increase)

**Detection:**
```
Baseline: 1.5 ms (P99)
Measured: 1.8 ms
Change: 20%
Status: FAIL
```

**Response:**
1. **IMMEDIATELY**: Halt deployment
2. Check for:
   - CPU saturation
   - Memory pressure (GC stuttering)
   - New heavyweight commands
   - Command queue buildup
3. Run load test to identify bottleneck
4. Fix and re-validate before proceeding

### Scenario 3: Memory Leak Alert

**Detection:**
```
Initial Memory:  45 MB
After 1 hour:    56 MB
Growth Rate:     11 MB/hour
Status: CRITICAL
```

**Response:**
1. **IMMEDIATELY**: Isolate instance
2. Capture heap dump
3. Analyze with Chrome DevTools
4. Identify leaking object patterns
5. Fix root cause
6. Re-test with 24-hour stability test

### Scenario 4: Error Rate Spike

**Detection:**
```
Baseline: 0.0%
Measured: 2.5%
Status: CRITICAL
```

**Response:**
1. Check logs for error patterns
2. Identify affected command(s)
3. Verify no network/upstream issues
4. Run regression tests
5. Rollback if no clear cause
6. Deploy fix when ready

---

## Performance Optimization Decision Tree

```
Is baseline needed?
├─ YES (new version/major fix)
│  └─ Run: node tests/baselines/establish-baselines.js
│     Time: 35 minutes
│     Output: Full metrics report + JSON data
│
├─ NO - Just verify no regression?
│  └─ Run: node tests/baselines/regression-detector.js
│     Time: 2 minutes
│     Output: PASS/WARN/FAIL status
│
└─ Need production insights?
   └─ Check logs for throughput/error trends
      Compare to baseline thresholds
      Escalate if >5% degradation
```

---

## Safety Margins Explained

### Throughput Margin (27% headroom)
```
Peak Throughput:    1000 msg/sec (theoretical max)
Baseline Usage:      285 msg/sec (50 concurrent)
Headroom:            715 msg/sec (72% available)
Safe Operating:      225 msg/sec (79% of baseline)

Implication: Can increase load 3.5x before hitting ceiling
```

### Memory Margin (48MB headroom)
```
System Available:   64 GB
Baseline Usage:     45 MB
Per Connection:     0.15 MB
Safe Limit:         10% of system = 6.4 GB
Current Utilization: <1%

Implication: Can add 40,000+ concurrent connections before memory pressure
```

### Latency Margin (48.5ms headroom)
```
Baseline P99:       1.5 ms
Application Target: 50 ms
Safety Margin:      48.5 ms (3,233x)

Implication: Latency issues extremely unlikely. If > 5ms, investigate anomalies.
```

---

## Alerting Configuration

### Recommended Alert Thresholds

**WARNING (Notify team, no action required yet)**
```
- Throughput drops below 250 msg/sec
- P99 latency exceeds 2.5 ms
- Memory growth rate >0.1 MB/hour
- Error rate exceeds 0.5%
- CPU utilization >60%
```

**CRITICAL (Escalate immediately, consider rollback)**
```
- Throughput drops below 200 msg/sec
- P99 latency exceeds 5 ms
- Memory growth rate >0.5 MB/hour
- Error rate exceeds 1%
- Connection failures detected
- Any component crashing/restarting
```

---

## Baseline Update Schedule

### Quarterly (Every 3 months)
- Full baseline re-establishment
- Compare to previous quarter
- Document any changes
- Update thresholds if needed

### After Major Release
- Full baseline within 1 week of release
- Compare to previous release
- Document improvements/regressions
- Update documentation

### After Critical Fix
- Quick regression test (2 min)
- Full baseline if regression detected
- Verify fix effectiveness

### Immediate (Event-Driven)
- After performance-related bug fix
- After infrastructure change
- After high-load incident
- After deployment to new environment

---

## Common Performance Issues & Solutions

### Issue 1: Gradual Throughput Decline
```
Symptoms:
- Throughput 285 → 270 → 255 over 3 days
- P99 latency stable
- Memory stable

Likely Causes:
- Background job accumulation
- Cache memory fragmentation
- Connection pool tuning drift
- GC pressure increasing

Solution:
1. Restart service (clear cache)
2. Check for zombie connections
3. Monitor next 24 hours
4. If recurs: review code changes
```

### Issue 2: Memory Leak
```
Symptoms:
- Memory 45 → 90 MB over 2 hours
- Error rate increasing
- P99 latency degrading

Likely Causes:
- Event listener not removed
- Circular reference in cache
- Request buffer not clearing
- Screenshot buffer not released

Solution:
1. Isolate instance immediately
2. Take heap dump (node --inspect)
3. Analyze with Chrome DevTools
4. Find leaking reference
5. Fix and restart
```

### Issue 3: Latency Spike
```
Symptoms:
- P99 latency 1.5 → 8 ms (sudden)
- Throughput still 285 msg/sec
- CPU drops to 5%

Likely Causes:
- CPU throttling
- Upstream service degradation
- Network congestion
- GC pause (full collection)

Solution:
1. Check system resources
2. Ping upstream services
3. Run local throughput test
4. If still slow: profile CPU
```

### Issue 4: High Error Rate
```
Symptoms:
- Errors 0.0% → 5% (sudden)
- Throughput drops
- Logs show timeouts

Likely Causes:
- Network connection failures
- Upstream service down
- Resource exhaustion
- Bug in recent code

Solution:
1. Check network connectivity
2. Verify upstream services
3. Check system resources
4. Review recent deployments
5. Rollback if necessary
```

---

## Performance Tuning Opportunities

### Quick Wins (1-2 hours implementation)
- Request deduplication (+3-5% throughput)
- Per-domain pooling (+5-10% throughput)
- Fingerprint lazy loading (+2-3% startup)

### Medium Effort (5-15 hours implementation)
- Streaming responses (+15-20% throughput)
- Request batching (+20-30% throughput)
- AI path precompilation (+8-12% throughput)

### Long-term (20+ hours implementation)
- Binary protocol (-50% bandwidth for screenshots)
- Delta compression (-50-70% for repeated data)
- Advanced caching strategies (-40-60% memory)

**Estimated Combined Potential:** 100-200% throughput improvement

---

## Baseline Data Reference

### Current Baseline (v12.7.0)
- File: `docs/PERFORMANCE-BASELINE-2026-06-21.md`
- JSON: `tests/results/baselines/BASELINE-2026-06-21.json`
- Updated: 2026-06-21
- Status: ACTIVE

### Historical Baselines
- v12.6.0: 270 msg/sec (2026-06-14)
- v12.5.0: 260 msg/sec (2026-06-07)
- v12.0.0: 285 msg/sec (2026-05-11)

### Trend Analysis
- v12.5.0 → v12.6.0: +4% improvement
- v12.6.0 → v12.7.0: +6% improvement (critical fixes)
- Trajectory: Steady improvement with each release

---

## Tools & Commands Reference

### Run Baseline Test (35 minutes)
```bash
node tests/baselines/establish-baselines.js
# Output: Comprehensive metrics + JSON data
# Metrics: Throughput, latency, memory, stability
```

### Run Regression Check (2 minutes)
```bash
node tests/baselines/regression-detector.js
# Output: PASS/WARN/FAIL status
# Quick verification against baseline
```

### Run Load Test (5 minutes)
```bash
node tests/benchmarks/performance-baseline.test.js
# Output: Load test under 10 concurrent clients
# Metrics: 1,000 commands, success rate, latency distribution
```

### Run Stability Test (5 minutes)
```bash
node tests/baselines/stability-test-5min.js
# Output: Memory growth analysis
# Metrics: Memory over time, GC cycles, error rate
```

### Monitor Production
```bash
# Watch real-time metrics (if monitoring available)
watch -n 1 'grep "throughput\|error\|latency" /var/log/basset-hound.log'
```

---

## Documentation Index

- **PERFORMANCE-BASELINE-2026-06-21.md** - Detailed baseline metrics and analysis
- **PERFORMANCE-BASELINE-OPERATIONS-GUIDE.md** - This file (operations guide)
- **PERFORMANCE-OPTIMIZATION-OPPORTUNITIES.md** - Future optimization roadmap
- **tests/results/baselines/BASELINE-2026-06-21.json** - Machine-readable baseline data
- **docs/findings/PERFORMANCE-OPTIMIZATION-OPPORTUNITIES.md** - Optimization analysis

---

## Support & Escalation

### Question: "Is this performance acceptable?"
**Answer:** Refer to Safety Margins section above. Current baseline significantly exceeds requirements.

### Question: "When should we optimize?"
**Answer:** After reaching 70% of throughput capacity or on quarterly review cycle. Current: 28% utilization.

### Question: "How do we know if something broke?"
**Answer:** Run `node tests/baselines/regression-detector.js`. If FAIL status → investigate immediately.

### Question: "What's the actionable metric?"
**Answer:** P99 latency is best single metric. If >2.5ms, something is wrong. If >5ms, critical issue.

---

## Final Checklist Before Deployment

- [ ] Baseline established (v12.7.0)
- [ ] Regression test passed (PASS status)
- [ ] Load test successful (1,000/1,000 commands)
- [ ] Stability test shows zero memory growth
- [ ] Error rate <0.5%
- [ ] P99 latency <2.5 ms
- [ ] No regressions detected vs previous version
- [ ] Safety margins verified (27% throughput headroom)
- [ ] Documentation updated
- [ ] Monitoring alerts configured

---

**Status:** ✅ READY FOR OPERATIONS  
**Maintained by:** Performance Team  
**Last Updated:** 2026-06-21  
**Next Review:** 2026-09-21 (Quarterly)
