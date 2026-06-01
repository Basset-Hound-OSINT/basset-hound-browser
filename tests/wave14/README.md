# Wave 14 Performance Testing Framework

## Overview

Comprehensive performance testing suite for Wave 14 features under realistic load conditions. Tests validate:

1. **Baseline Impact** - Pre vs Post Wave14 performance comparison
2. **Long-Session Stability** - 8-hour stability test with memory monitoring
3. **Concurrent Operations** - 10 parallel campaigns with shared state
4. **Stress Testing** - 500 concurrent connections
5. **Feature Performance** - Tech detection, monitoring, proxy intelligence, session persistence
6. **Regression Detection** - Wave 13 optimizations remain effective

## Quick Start

### 1. Pre-Flight Check

```bash
cd /home/devel/basset-hound-browser/tests/wave14
node pre-flight-check.js
```

Validates:
- Node.js version (14+)
- Disk space (50+ GB)
- System resources (4+ cores, 8+ GB RAM)
- Required modules (ws, perf_hooks)
- Test scripts present
- WebSocket server connectivity

### 2. Run All Tests

```bash
node test-executor.js
```

Or run individual phases:

```bash
node test-executor.js --phase 1  # Baseline comparison (4 hours)
node test-executor.js --phase 2  # Extended campaigns (10 hours)
node test-executor.js --phase 3  # Feature performance (6 hours)
node test-executor.js --phase 4  # Reporting (2-3 hours)
```

### 3. Monitor Execution

```bash
# In separate terminal
tail -f /home/devel/basset-hound-browser/tests/wave14/wave14-test-execution.log
```

### 4. Review Results

All results saved to `/home/devel/basset-hound-browser/tests/wave14/`:

- `baseline-pre-wave14.txt` - Pre-feature baseline
- `baseline-post-wave14.txt` - Post-feature baseline
- `performance-impact-analysis.txt` - Comparison
- `campaign-test-report.txt` - Campaign results
- `feature-performance-results.json` - Feature metrics
- `WAVE-14-PERFORMANCE-COMPLETE.txt` - Final report
- `wave14-test-execution.log` - Full execution log

## Test Scripts

### pre-flight-check.js
**Purpose:** Validate system prerequisites
**Duration:** ~2 minutes
**Output:** preflight-check-results.json

Checks:
- Node.js version
- Disk space availability
- System resources (CPU, RAM)
- Required npm modules
- Test script presence
- WebSocket server connectivity

### phase1-baseline-comparison.js
**Purpose:** Measure pre vs post Wave14 performance
**Duration:** ~4 hours
**Load Profiles:** 50, 100, 200, 300 concurrent connections
**Metrics:** Throughput, latency (P50/P99/P999), memory, CPU

**Output:**
- baseline-pre-wave14.txt
- baseline-post-wave14.txt
- performance-impact-analysis.txt

**Success Criteria:** <10% overhead at 200 concurrent

### phase2-extended-campaign.js
**Purpose:** Long-session stability and concurrent campaign testing
**Duration:** ~10 hours

**Test 1: Long-Session Stability**
- Single 8-hour session
- 500 operations (1 per 57.6 seconds)
- Memory snapshots every 30 seconds
- Success: <2 MB/hour growth

**Test 2: Concurrent Campaigns**
- 10 parallel campaigns
- 30 minutes duration each
- 50 operations per campaign
- Shared state: proxy pools, fingerprint cache
- Success: No cross-campaign interference

**Test 3: Stress Test**
- 500 concurrent connections
- 100 commands/second
- Gradual ramp-up (50 conn increments)
- Success: <10% connection failures

**Output:**
- campaign-test-results.json
- campaign-test-report.txt

### phase3-feature-performance.js
**Purpose:** Feature-specific performance validation
**Duration:** ~6 hours

**Test 1: Tech Detection (1-2 hours)**
- 50 websites scanned
- Version fingerprinting + vulnerability scanning + config analysis
- Success: P99 <200ms per website

**Test 2: Competitor Monitoring (1 hour)**
- 50 monitors
- 5 monitoring cycles
- Change detection + alerting
- Success: P99 <250ms per cycle

**Test 3: Proxy Intelligence (1 hour)**
- Reputation scoring: 100 proxies (<10ms)
- Geo-consistency: 500 operations (<5ms each)
- Fallback decisions: 100 scenarios (<20ms)

**Test 4: Session Persistence (1-2 hours)**
- Checkpoint creation: 500 ops (<50ms)
- Checkpoint persistence: 100 ops (<100ms)
- Rollback operations: 50 ops (<200ms)
- History queries: 100 queries (<50ms)

**Output:**
- feature-performance-results.json
- feature-performance-results.txt

### regression-detection.js
**Purpose:** Validate Wave 13 optimizations remain effective
**Duration:** ~2 hours

**Tests:**
- Priority Queue Throughput (15%+ improvement)
- Compression Effectiveness (70-93% reduction)
- Memory Stability (<0.9 MB/hour)
- Latency Targets (P99 <1.0ms)

**Output:**
- regression-detection-results.json
- regression-detection-results.txt

### test-executor.js
**Purpose:** Orchestrate all testing phases
**Duration:** 22-23 hours total (all phases)

**Usage:**
```bash
node test-executor.js              # All phases
node test-executor.js --phase 1    # Phase 1 only
node test-executor.js --help       # Help
```

**Output:**
- wave14-test-execution.log
- execution-summary.json

## Performance Targets

### System-Level (200 concurrent)
| Metric | Target | Pass Threshold |
|--------|--------|-----------------|
| Throughput Overhead | <10% | <10% |
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

## Success Criteria

**GO Decision (Production Ready):**
- ✓ Phase 1: <10% overhead at 200 concurrent
- ✓ Phase 2.1: <2 MB/hour memory growth
- ✓ Phase 2.2: Zero cross-campaign interference
- ✓ Phase 2.3: <10% connection failures at 500 concurrent
- ✓ Phase 3.1: P99 <200ms for tech detection
- ✓ Phase 3.2: P99 <250ms for monitoring
- ✓ Phase 3.3: All proxy operations under target
- ✓ Phase 3.4: All persistence operations under target
- ✓ Regression: Wave 13 optimizations maintained

**WARN Decision (Proceed with Caution):**
- <10% tests failing
- Some metrics slightly above target (10-20%)
- Optimization recommendations provided

**NO-GO Decision (Do Not Deploy):**
- >10% tests failing
- Core performance degraded (>20% overhead)
- Memory leaks detected
- System instability

## Troubleshooting

### WebSocket Server Connection Failed
```bash
# Check if server is running
netstat -tlnp | grep 8765

# Start server if needed
npm start

# Or in Docker
docker run -p 8765:8765 basset-hound-browser
```

### Out of Disk Space
```bash
# Check available space
df -h /home/devel/basset-hound-browser

# Clean up old results
rm -rf /home/devel/basset-hound-browser/tests/results/
```

### Tests Timeout or Hang
```bash
# Check system load
top -b -n 1 | head -20

# Reduce concurrent connections in config
# Edit phase1-baseline-comparison.js, adjust loadProfiles
```

### Memory Leak Detected
```bash
# Enable heap profiling
node --inspect=9229 phase2-extended-campaign.js

# Use chrome://inspect to analyze heap dumps
```

## Running Tests in Segments

Tests can be distributed across multiple days:

**Day 1: Baseline (4 hours)**
```bash
node test-executor.js --phase 1
```

**Day 2-3: Extended Testing (10 hours)**
```bash
node test-executor.js --phase 2
```

**Day 4: Feature Performance (6 hours)**
```bash
node test-executor.js --phase 3
```

**Day 5: Reporting (2-3 hours)**
```bash
node test-executor.js --phase 4
```

## Command Reference

```bash
# Pre-flight validation
node pre-flight-check.js

# Full test suite
node test-executor.js

# Individual phases
node test-executor.js --phase 1
node test-executor.js --phase 2
node test-executor.js --phase 3
node test-executor.js --phase 4

# Individual tests (standalone)
node phase1-baseline-comparison.js
node phase2-extended-campaign.js
node phase3-feature-performance.js
node regression-detection.js

# Help
node test-executor.js --help

# Monitor execution
tail -f wave14-test-execution.log

# View results
cat baseline-pre-wave14.txt
cat baseline-post-wave14.txt
cat performance-impact-analysis.txt
cat campaign-test-report.txt
cat WAVE-14-PERFORMANCE-COMPLETE.txt
```

## Files Created

```
tests/wave14/
├── pre-flight-check.js                      # System validation
├── phase1-baseline-comparison.js            # Baseline testing
├── phase2-extended-campaign.js              # Campaign & stress testing
├── phase3-feature-performance.js            # Feature-level testing
├── regression-detection.js                  # Wave 13 validation
├── test-executor.js                         # Test orchestration
├── PERFORMANCE-TEST-PLAN.md                 # Detailed test plan
├── README.md                                # This file
├── preflight-check-results.json             # Pre-flight output
├── baseline-pre-wave14.txt                  # Phase 1 pre-output
├── baseline-post-wave14.txt                 # Phase 1 post-output
├── performance-impact-analysis.txt          # Phase 1 analysis
├── campaign-test-results.json               # Phase 2 output
├── campaign-test-report.txt                 # Phase 2 analysis
├── feature-performance-results.json         # Phase 3 output
├── feature-performance-results.txt          # Phase 3 analysis
├── regression-detection-results.json        # Regression output
├── regression-detection-results.txt         # Regression analysis
├── WAVE-14-PERFORMANCE-COMPLETE.txt        # Phase 4 final report
├── execution-summary.json                   # Execution metadata
└── wave14-test-execution.log                # Full execution log
```

## Monitoring During Tests

### Check Status
```bash
# Watch execution log
tail -f wave14-test-execution.log

# Check resource usage
watch -n 1 'ps aux | grep node'
top -p $(pgrep node)

# Monitor disk space
df -h /home/devel/basset-hound-browser

# Check WebSocket connections
netstat -an | grep 8765
```

### Expected Resource Usage
- **CPU:** 30-80% during load tests (peaks during stress test)
- **Memory:** 400-800 MB (1-2% of system)
- **Network:** ~1 GB total traffic during full suite
- **Disk:** ~500 MB for results

## Support & Contact

For issues:
1. Check log file: `wave14-test-execution.log`
2. Review specific phase output
3. Consult troubleshooting section
4. Check system resources

## Notes

- WebSocket server must be running before tests
- Tests generate significant network traffic
- CPU cores will be heavily utilized during tests
- GC may spike during long-session test (normal)
- Consider disabling automatic updates during execution
- Keep system idle (no heavy workloads) during testing

## Next Steps

After testing completes:
1. Review final report: `WAVE-14-PERFORMANCE-COMPLETE.txt`
2. Check success criteria status
3. Document optimization opportunities
4. Plan production deployment (if GO decision)
5. Schedule post-deployment monitoring

---

**Test Suite Version:** 1.0.0
**Created:** June 1, 2026
**Last Updated:** June 1, 2026
