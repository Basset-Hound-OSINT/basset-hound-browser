# Wave 14 Performance Testing Plan

## Overview

Comprehensive performance validation for Wave 14 features under realistic load conditions.

**Execution Duration:** 22-23 hours total
**Start Date:** [User-specified]
**Resources Required:** Single machine with:
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB free disk
- Network connectivity to localhost:8765

## Test Objectives

1. **Baseline Comparison** - Measure impact of Wave 14 features on core performance
2. **Long-Session Stability** - Validate memory/CPU behavior over extended operations
3. **Concurrent Operations** - Confirm system handles parallel campaigns
4. **Stress Testing** - Find breaking point and validate graceful degradation
5. **Feature-Specific Performance** - Validate each Wave 14 component

## Phase Breakdown

### Phase 1: Baseline Comparison (4 hours)
- **Purpose:** Compare pre-Wave14 and post-Wave14 performance
- **Load Profile:** 50 → 100 → 200 → 300 concurrent connections
- **Metrics:** Throughput, latency (P50/P99/P999), memory, CPU
- **Success Criteria:** <10% overhead at 200 concurrent

**Commands:**
```bash
node test-executor.js --phase 1
```

**Output:**
- `baseline-pre-wave14.txt` - Pre-feature measurements
- `baseline-post-wave14.txt` - Post-feature measurements
- `performance-impact-analysis.txt` - Comparison and analysis

### Phase 2: Extended Campaign Testing (10 hours)

#### Test 1: Long-Session Stability (8 hours)
- **Purpose:** Validate memory stability and GC behavior
- **Scenario:** Single session, 500 operations over 8 hours
- **Interval:** 57.6 seconds between operations
- **Monitoring:** Memory snapshots every 30 seconds
- **Success Criteria:** <2 MB/hour memory growth

#### Test 2: Concurrent Campaigns (30 min per campaign)
- **Purpose:** Validate multi-campaign interference
- **Scenario:** 10 parallel campaigns, 30 minutes each, 50 ops/campaign
- **Shared State:** Proxy pools, fingerprint cache, monitoring data
- **Success Criteria:** No cross-campaign interference

#### Test 3: Stress Test (10 minutes)
- **Purpose:** Find breaking point
- **Scenario:** 500 concurrent connections, 100 cmd/sec
- **Ramp-up:** Gradual (50 conn increments)
- **Success Criteria:** Graceful degradation, <10% connection failure

**Commands:**
```bash
node test-executor.js --phase 2
```

**Output:**
- `campaign-test-results.json` - Raw metrics
- `campaign-test-report.txt` - Analysis and findings

### Phase 3: Feature-Specific Performance (6 hours)

#### Test 1: Tech Detection Performance (1-2 hours)
- **Purpose:** Validate tech fingerprinting speed
- **Scope:** 50 websites, full detection pipeline
- **Metrics:**
  - Version fingerprinting latency
  - Vulnerability scanning latency
  - Configuration analysis latency
- **Success Criteria:** <100ms per website (P99 <200ms)

#### Test 2: Competitor Monitoring Performance (1 hour)
- **Purpose:** Validate change detection at scale
- **Scope:** 50 monitors, 5 cycles, change detection + alerting
- **Metrics:**
  - Per-monitor comparison latency
  - Alert generation latency
- **Success Criteria:** <200ms per cycle (P99 <250ms)

#### Test 3: Proxy Intelligence Performance (1 hour)
- **Purpose:** Validate decision-making speed
- **Operations:**
  - Reputation scoring: 100 proxies
  - Geo-consistency checks: 500 operations
  - Fallback decisions: 100 scenarios
- **Success Criteria:**
  - Reputation: <10ms per proxy
  - Geo-consistency: <5ms per check
  - Fallback: <20ms per decision

#### Test 4: Session Persistence Performance (1-2 hours)
- **Purpose:** Validate checkpoint operations
- **Operations:**
  - Checkpoint creation: 500 ops
  - Checkpoint persistence: 100 ops (1-10 MB each)
  - Rollback: 50 operations
  - History queries: 100 queries
- **Success Criteria:**
  - Create: <50ms
  - Save: <100ms
  - Rollback: <200ms
  - Query: <50ms

**Commands:**
```bash
node test-executor.js --phase 3
```

**Output:**
- `feature-performance-results.json` - Detailed metrics
- `feature-performance-results.txt` - Analysis

### Phase 4: Comprehensive Reporting (2-3 hours)
- Aggregate results from all phases
- Generate executive summary
- Provide go/no-go recommendation
- Document optimization opportunities

**Commands:**
```bash
node test-executor.js --phase 4
```

**Output:**
- `WAVE-14-PERFORMANCE-COMPLETE.txt` - Final report
- `execution-summary.json` - Execution metadata

## Quick Start

### Pre-Flight Checks

```bash
# 1. Verify WebSocket server running
curl http://localhost:8765 2>&1 | grep -q upgrade && echo "✓ Server OK"

# 2. Check disk space
df -h /home/devel/basset-hound-browser | awk 'NR==2 {print $4}'

# 3. Verify test scripts
ls -la /home/devel/basset-hound-browser/tests/wave14/*.js | wc -l

# 4. Check Node.js
node --version  # Must be 14+
npm list ws     # Must have WebSocket module
```

### Run All Tests
```bash
cd /home/devel/basset-hound-browser/tests/wave14
node test-executor.js

# Or run specific phase
node test-executor.js --phase 1
node test-executor.js --phase 2
node test-executor.js --phase 3
node test-executor.js --phase 4
```

### Monitor Execution
```bash
# In separate terminal
tail -f /home/devel/basset-hound-browser/tests/wave14/wave14-test-execution.log

# Check intermediate results
ls -lrt /home/devel/basset-hound-browser/tests/wave14/*.txt
```

## Performance Targets

### System-Level (200 concurrent connections)
| Metric | Target | Pass Threshold |
|--------|--------|-----------------|
| Throughput (post vs pre) | <10% overhead | < 10% |
| P99 Latency | <1.0ms | <1.5ms |
| Memory Growth | <2 MB/hour | <2.5 MB/hour |
| CPU Peak | <50% | <60% |
| Connection Success | 100% | >99% |

### Feature-Level
| Feature | Operation | Target | Pass |
|---------|-----------|--------|------|
| Tech Detection | Per-website | <100ms | P99 <200ms |
| Competitor Mon | Per-cycle | <200ms | P99 <250ms |
| Proxy Intel | Reputation | <10ms | P99 <15ms |
| Proxy Intel | Geo Check | <5ms | P99 <8ms |
| Proxy Intel | Fallback | <20ms | P99 <30ms |
| Session Persist | Checkpoint | <50ms | P99 <75ms |
| Session Persist | Save | <100ms | P99 <150ms |
| Session Persist | Rollback | <200ms | P99 <300ms |
| Session Persist | Query | <50ms | P99 <75ms |

## Success Criteria Summary

**GO Decision (all must pass):**
- [ ] Phase 1: <10% overhead at 200 concurrent
- [ ] Phase 2.1: <2 MB/hour memory growth
- [ ] Phase 2.2: Zero cross-campaign interference
- [ ] Phase 2.3: <10% connection failures at 500 concurrent
- [ ] Phase 3.1: P99 <200ms for tech detection
- [ ] Phase 3.2: P99 <250ms for monitoring cycles
- [ ] Phase 3.3: All proxy operations under target
- [ ] Phase 3.4: All persistence operations under target

**WARN Decision (minor issues):**
- <10% tests failing
- Some metrics slightly above target (10-20%)
- Optimization recommendations provided

**NO-GO Decision (critical issues):**
- >10% tests failing
- Core performance degraded (>20% overhead)
- Memory leaks detected
- System instability

## Expected Results Location

After testing completes, all results will be in:
```
/home/devel/basset-hound-browser/tests/wave14/
├── baseline-pre-wave14.txt                    # Phase 1 pre-feature baseline
├── baseline-post-wave14.txt                   # Phase 1 post-feature baseline
├── performance-impact-analysis.txt            # Phase 1 analysis
├── campaign-test-results.json                 # Phase 2 raw results
├── campaign-test-report.txt                   # Phase 2 analysis
├── feature-performance-results.json           # Phase 3 raw results
├── feature-performance-results.txt            # Phase 3 analysis
├── WAVE-14-PERFORMANCE-COMPLETE.txt          # Phase 4 final report
├── execution-summary.json                     # Execution metadata
└── wave14-test-execution.log                  # Full execution log
```

## Troubleshooting

### Issue: "Cannot connect to WebSocket server"
**Solution:** Ensure WebSocket server is running on localhost:8765
```bash
netstat -tlnp | grep 8765
# If not running, start with: npm start
```

### Issue: "Insufficient disk space"
**Solution:** Clean up old test results
```bash
rm -rf /home/devel/basset-hound-browser/tests/results/
df -h
```

### Issue: "Tests timeout or hang"
**Solution:** Check system resources
```bash
top -b -n 1 | head -20
# Look for high CPU/memory usage
# May need to reduce concurrent connections in config
```

### Issue: "Memory growth detected"
**Solution:** May indicate GC issue. Collect heap dumps
```bash
node --inspect=9229 phase2-extended-campaign.js
# Then use chrome://inspect to analyze
```

## Running Tests in Segments

Tests can be run in multiple sessions:

**Day 1:**
```bash
node test-executor.js --phase 1  # 4 hours
```

**Day 2:**
```bash
node test-executor.js --phase 2  # 10 hours (can break into multiple runs)
```

**Day 3:**
```bash
node test-executor.js --phase 3  # 6 hours
```

**Day 4:**
```bash
node test-executor.js --phase 4  # 2-3 hours (analysis/reporting)
```

## Notes

- Tests generate significant data (100+ MB)
- Network traffic: ~1 GB during full test suite
- CPU cores will be saturated during stress tests
- GC may spike during long-session test (normal)
- Consider disabling automatic updates during execution
- Keep WebSocket server responsive (don't run other heavy workloads)

## Contact & Support

For issues or questions:
1. Check log file: `wave14-test-execution.log`
2. Review specific phase output files
3. Consult troubleshooting section above
