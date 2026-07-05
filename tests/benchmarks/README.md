# Performance Benchmark Suite

Comprehensive before/after performance measurement framework for Basset Hound Browser.

## Overview

This benchmark suite measures and compares performance metrics before and after critical fixes are applied. It provides detailed analysis of:

- **Throughput**: Commands per second
- **Latency**: P50, P95, P99 percentiles
- **Memory**: Baseline, peak, and growth rates
- **Reliability**: Success rate and error tracking
- **Memory Stability**: Long-running leak detection

## Components

### 1. Performance Baseline Test (`performance-baseline.test.js`)

Main load testing framework for throughput, latency, and memory measurements.

**Features:**
- 10 concurrent clients (configurable)
- 100 commands per client (configurable)
- Mixed realistic command types
- Latency percentile calculations
- Memory profiling
- Reliability tracking

**Metrics Collected:**
- Throughput (msg/sec)
- Latency: P50, P95, P99, min, max
- Memory: baseline, peak, growth, growth rate
- Success rate and failure tracking

### 2. Memory Stability Test (`memory-stability.test.js`)

Long-running test to detect memory leaks and validate GC behavior.

**Features:**
- 30-minute duration (configurable)
- Continuous load from 5 clients
- 20 commands/second baseline
- 5-second sampling interval
- Phase-based growth analysis

**Analysis:**
- Early phase (0-5 min): Initial allocation pattern
- Middle phase (5-15 min): Stabilization
- Late phase (15-30 min): Stability confirmation
- Leak detection: Growth rate comparison
- Volatility measurement

### 3. Regression Detector (`regression-detector.js`)

Automated regression analysis with severity classification.

**Thresholds (Configurable):**
- Throughput: -5% acceptable degradation
- Latency: +10% acceptable increase
- Memory: +10% acceptable growth
- Reliability: -1% acceptable drop

**Severity Levels:**
- CRITICAL: >100% deviation
- HIGH: >50% deviation
- MEDIUM: >20% deviation
- LOW: <20% deviation

### 4. Benchmark Report Generator (`benchmark-report.js`)

Generates comprehensive markdown and JSON reports.

**Output Formats:**
- Markdown report with tables and analysis
- JSON report for programmatic analysis
- Executive summary with key findings
- Detailed metrics comparison
- Regression analysis
- Memory stability findings
- Actionable recommendations

### 5. Suite Driver (`run-benchmarks.js`)

Orchestrates the complete benchmark process.

**Phases:**
1. BEFORE: Baseline measurement
2. AFTER: Post-fix measurement
3. MEMORY: 30-minute stability test
4. ANALYSIS: Regression detection and reporting

## Usage

### Quick Start

```bash
# Run complete benchmark suite (before + after + memory)
node tests/benchmarks/run-benchmarks.js

# Run only BEFORE baseline
node tests/benchmarks/run-benchmarks.js --phase before

# Run only AFTER optimization
node tests/benchmarks/run-benchmarks.js --phase after

# Customize test parameters
node tests/benchmarks/run-benchmarks.js \
  --phase both \
  --duration 600000 \
  --clients 20 \
  --memory-duration 3600000
```

### Command Line Options

- `--phase [before|after|both]`: Which phase to run (default: both)
- `--duration <ms>`: Load test duration in milliseconds (default: 300000 = 5 min)
- `--clients <n>`: Concurrent WebSocket clients (default: 10)
- `--memory-duration <ms>`: Memory stability test duration (default: 1800000 = 30 min)

## Test Scenarios

### 1. Load Test Scenario (300 seconds)

**Configuration:**
- 10 concurrent clients
- 100 commands per client
- ~1000 total commands executed
- Mixed command types

**Simulates:**
- Realistic concurrent usage
- Command throughput capacity
- Latency under moderate load
- Memory behavior under sustained load

### 2. Memory Stability Scenario (1800 seconds)

**Configuration:**
- 5 continuous clients
- 20 commands/second baseline
- 5-second sampling interval
- Total: ~36,000 commands executed

**Detects:**
- Memory leaks (growth > 1 MB/min)
- GC effectiveness
- Long-term stability
- Resource cleanup

## Performance Targets

### Throughput
- Target: >200 msg/sec (10 concurrent clients)
- Acceptable regression: <-5%
- Goal: +20% improvement after fixes

### Latency
- Target P99: <2.0ms
- Target P95: <1.5ms
- Acceptable regression: <+10%
- Goal: -15% improvement after fixes

### Memory
- Target growth: <5 MB per test
- Acceptable regression: <+10%
- Goal: -20% improvement after fixes

### Reliability
- Target success rate: >99.5%
- Acceptable regression: <-1%
- Goal: 100% (zero failures)

## Output Files

Results are saved to `tests/results/benchmarks/`:

```
benchmarks/
├── before-results.json           # BEFORE baseline metrics
├── after-results.json            # AFTER optimization metrics
├── memory-stability-results.json  # Memory leak analysis
├── regression-analysis.json       # Regression detection results
├── BENCHMARK-REPORT.md           # Human-readable markdown report
└── comprehensive-benchmark-report.json  # Complete JSON report
```

## Interpretation Guide

### Success Criteria

**PASS:**
- No regressions detected
- All metrics within thresholds
- Memory stable (growth rate < 1 MB/min)
- Success rate >99%

**REGRESSION DETECTED:**
- One or more metrics exceed thresholds
- Severity classification provided
- Specific recommendations given
- Requires investigation

### Key Metrics Explained

**Throughput (msg/sec)**
- Higher is better
- Measures command processing capacity
- Affected by: serialization, dispatch, response time

**Latency Percentiles**
- P50: Median response time
- P95: 95th percentile (catches outliers)
- P99: 99th percentile (tail latency)
- Lower is better

**Memory Growth**
- Measures heap usage increase
- Lower is better
- Growth rate > 1 MB/min indicates leak

**Success Rate**
- Percentage of successful commands
- Target: 100%
- <99% indicates reliability issues

## Critical Fixes to Measure

### Security Fixes (v12.8.0)

1. **WSS Enforcement for Credentials**
   - Prevents plaintext credential transmission
   - Expected impact: Minimal overhead (<1%)
   - Metric: Latency increase

2. **Rate Limiting for TOTP**
   - Prevents brute force attacks
   - Expected impact: 1-2% throughput reduction
   - Metric: Throughput at high request rates

3. **Request Size Validation**
   - Prevents oversized payloads
   - Expected impact: Memory savings
   - Metric: Peak memory reduction

4. **Path Validation**
   - Prevents directory traversal
   - Expected impact: Minimal overhead
   - Metric: Latency increase

## Troubleshooting

### WebSocket Connection Refused

**Problem:** "ECONNREFUSED" errors

**Solution:**
```bash
# Ensure WebSocket server is running
npm start

# Check port 8765 is available
lsof -i :8765
```

### Insufficient Commands Executed

**Problem:** Expected 1000 commands but only got 100

**Solution:**
- Increase `--duration` parameter
- Reduce number of clients to avoid contention
- Check network latency
- Monitor server logs for errors

### Memory Test Takes Too Long

**Problem:** 30-minute memory test is impractical

**Solution:**
```bash
# Run shorter memory test (5 minutes)
node tests/benchmarks/run-benchmarks.js \
  --phase both \
  --memory-duration 300000
```

### Inconsistent Results

**Problem:** Results vary between runs

**Solution:**
- Restart WebSocket server between runs
- Close other applications to reduce system load
- Run benchmarks multiple times and average results
- Run at consistent time of day

## Advanced Usage

### Custom Command Set

Modify `getRandomCommand()` in `performance-baseline.test.js`:

```javascript
getRandomCommand() {
  const commands = [
    { cmd: 'your-command', param: 'value' },
    // ... add more as needed
  ];
  return commands[Math.floor(Math.random() * commands.length)];
}
```

### Regression Threshold Customization

Adjust thresholds in `run-benchmarks.js`:

```javascript
const regressionDetector = new RegressionDetector(
  this.beforeResults,
  this.afterResults,
  {
    throughputThreshold: -10,  // Allow 10% degradation
    latencyThreshold: 20,       // Allow 20% latency increase
    memoryThreshold: 15,        // Allow 15% memory growth
    reliabilityThreshold: -2    // Allow 2% reliability drop
  }
);
```

### Continuous Benchmarking

Run benchmarks on schedule:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/project && node tests/benchmarks/run-benchmarks.js
```

## Performance Optimization Tips

Based on benchmark results, consider:

### High Throughput Bottleneck
- Profile command dispatcher
- Optimize WebSocket message serialization
- Check for synchronous operations
- Review memory allocations in hot paths

### High Latency
- Analyze command handlers for long operations
- Check for blocking I/O
- Profile garbage collection pauses
- Review promise chain depth

### Memory Growth
- Run memory stability test longer
- Profile heap snapshots at different phases
- Check for event listener leaks
- Review object creation patterns

### Low Success Rate
- Check error logs for patterns
- Verify timeout values
- Test with smaller payload sizes
- Check WebSocket buffer limits

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Benchmarks

on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start WebSocket server
        run: npm start &
      
      - name: Wait for server
        run: sleep 5
      
      - name: Run benchmarks
        run: node tests/benchmarks/run-benchmarks.js
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: benchmark-results
          path: tests/results/benchmarks/
```

## References

- WebSocket API: `websocket/server.js`
- Performance Metrics: `utils/memory-manager.js`
- Command Dispatcher: `websocket/command-dispatcher.js`
- Rate Limiter: `websocket/rate-limiter.js`

## License

Part of Basset Hound Browser project.
