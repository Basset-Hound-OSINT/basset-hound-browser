# Load Testing Suite - Wave 15

Comprehensive load testing framework for Basset Hound Browser v12.0.0+ under realistic production conditions.

## Overview

The load testing suite validates system performance across multiple dimensions:

- **Production Load Profile**: 300+ concurrent connections with mixed operation types
- **Dashboard Load**: Real-time updates to 50 competitors monitored by 300 simultaneous users
- **Spike Testing**: Sudden load spikes (0→200→500 concurrent) with recovery measurement
- **Sustained Load**: 300 concurrent connections for 8+ hours detecting memory leaks and degradation
- **Breaking Point**: Incremental load until failure to find maximum sustainable connections
- **Network Degradation**: Resilience under high latency, packet loss, and connection resets

## Test Suites

### Phase 1: Test Design (3-4 hours)

#### 1.1 Production Load Profile
**File**: `production-load-profile.test.js`

Simulates realistic production workload with 300+ concurrent connections:
- 70% Monitoring operations (get_url, get_content, screenshot, get_html)
- 20% Tech detection operations (get_headers, get_console_logs, detect_tech)
- 10% Dashboard operations (list_sessions, get_tab_info, get_analytics)
- Duration: 2 hours sustained
- Metrics: throughput, latency (P50/P95/P99), error rate

**Run**:
```bash
node tests/load/production-load-profile.test.js --full
node tests/load/production-load-profile.test.js --duration 5  # 5 minutes
```

#### 1.2 Dashboard Load Test
**File**: `dashboard-load.test.js`

Tests real-time dashboard with:
- 50 competitors monitored simultaneously
- 300 concurrent dashboard users
- Real-time updates every minute
- Metrics: response time, update latency, connection stability, data accuracy

**Run**:
```bash
node tests/load/dashboard-load.test.js --full
node tests/load/dashboard-load.test.js --duration 5  # 5 minutes
```

#### 1.3 Spike Testing
**File**: `spike-test.test.js`

Tests system response to sudden load spikes:
- Baseline: 0 concurrent (30 seconds)
- Spike 1: 0→200 concurrent (5 seconds ramp-up, then 5 minutes sustained)
- Spike 2: 200→500 concurrent (5 seconds ramp-up, then 2 minutes sustained)
- Recovery: 500→0 concurrent (measure stabilization time)
- Metrics: connection success rate, latency degradation, recovery time

**Run**:
```bash
node tests/stress/spike-test.test.js
```

#### 1.4 Sustained Load Test
**File**: `sustained-load.test.js`

Long-duration stress test detecting memory leaks and degradation:
- 300 concurrent connections
- 8+ hours sustained load
- Checkpoints every 30 minutes
- Metrics: memory growth, connection stability, message throughput, crashes

**Run**:
```bash
node tests/load/sustained-load.test.js --full        # 8 hours
node tests/load/sustained-load.test.js --duration 10 # 10 minutes
node tests/load/sustained-load.test.js --quick       # 10 minutes quick test
```

### Phase 3: Stress Testing (4-5 hours)

#### 3.1 Breaking Point Test
**File**: `stress/breaking-point.test.js`

Finds maximum sustainable concurrent connections:
- Start: 100 connections
- Increment: +100 every iteration
- Each iteration: 2 minutes sustained
- Stop when: >50% failure rate or system crash
- Metrics: failure mode, failure point, scalability recommendations

**Run**:
```bash
node tests/stress/breaking-point.test.js
node tests/stress/breaking-point.test.js --quick  # Small increments for testing
```

#### 3.2 Network Degradation Test
**File**: `stress/network-degradation.test.js`

Tests resilience under poor network conditions:
- Normal baseline (3 minutes)
- High latency (5s delays, 3 minutes)
- Packet loss scenarios (10%, 25%, 2 minutes each)
- Combined scenarios (2s latency + 10% loss, 3 minutes)
- Extreme scenario (5s latency + 25% loss, 2 minutes)
- Metrics: message loss, recovery rate, latency distribution

**Run**:
```bash
node tests/stress/network-degradation.test.js
node tests/stress/network-degradation.test.js --full # Full 100 concurrent
```

## Executor

### Orchestrated Test Execution
**File**: `executor.js`

Runs all test phases in sequence with automated recovery periods:
- Executes 6 major test phases in order
- 5-minute recovery delay between phases
- Generates comprehensive report
- Analyzes results and provides scaling recommendations

**Run**:
```bash
node tests/load/executor.js --all    # All tests (16-20 hours)
node tests/load/executor.js --quick  # Spike + Breaking + Network (3-4 hours)
node tests/load/executor.js          # Default (Production + Spike + Breaking)
```

## Results

All test results are saved to `/tests/results/` directory:

```
results/
├── load-profile-{timestamp}.json          # Production load profile
├── dashboard-load-{timestamp}.json        # Dashboard load test
├── spike-test-{timestamp}.json            # Spike testing
├── sustained-load-{timestamp}.json        # Sustained load (8hr+)
├── breaking-point-{timestamp}.json        # Breaking point analysis
├── network-degradation-{timestamp}.json   # Network degradation
├── LOAD-TESTING-REPORT.md                 # Executive report
└── LOAD-TESTING-COMPLETE.txt              # Completion summary
```

## Output Structure

Each test generates:
1. **Console Output**: Real-time progress and metrics
2. **JSON Results**: Detailed metrics for analysis
3. **Aggregated Report**: Summary with recommendations

### Typical Console Output

```
╔════════════════════════════════════════════════════════════════════════════╗
║           Production Load Profile Test - Basset Hound v12.0.0+           ║
║                     300+ Concurrent Connections, 2 Hours                    ║
╚════════════════════════════════════════════════════════════════════════════╝

Configuration:
  Concurrent Connections: 300
  Test Duration: 120 minutes
  Operation Distribution:
    - Monitoring: 70.0%
    - Detection: 20.0%
    - Dashboard: 10.0%
  Server: ws://localhost:8765

Connections established: 290/300

╔════════════════════════════════════════════════════════════════════════════╗
║                           TEST RESULTS                                   ║
╚════════════════════════════════════════════════════════════════════════════╝

Connection Statistics:
  Total Connections: 300
  Successful: 290
  Failed: 10
  Success Rate: 96.67%

Latency (ms):
  Min: 0.42
  Avg: 15.23
  P50: 12.50
  P95: 45.30
  P99: 92.10
  Max: 150.20

Performance:
  Throughput: 285.45 msgs/sec
  Duration: 120.00 minutes
```

## Performance Targets

### Production Load Profile
- Concurrent connections: 300
- Throughput: >200 msgs/sec
- P99 latency: <100ms
- Error rate: <1%

### Dashboard Load
- Concurrent users: 300
- Competitors monitored: 50
- Update latency: <500ms
- Success rate: >99%

### Spike Testing
- Peak concurrent: 500
- Recovery time: <2 minutes
- Success rate post-recovery: >90%

### Sustained Load (8 hours)
- Concurrent connections: 300
- Memory growth: <100MB/hour
- Connection stability: >95%
- Crash rate: 0

### Breaking Point
- Target: Find sustainable max
- Acceptable failure rate: <50%
- Test until failure mode identified

### Network Degradation
- Message loss tolerance: <10%
- Recovery success: 100%
- P99 latency under degradation: <5000ms

## Scaling Recommendations

Based on test results, the system can be scaled:

1. **Horizontal Scaling**
   - Scale beyond recommended capacity (typically 75-80% of breaking point)
   - Use load balancer for connection distribution
   - Monitor resource utilization on each instance

2. **Vertical Scaling**
   - Increase available memory if memory growth detected
   - Tune garbage collection for workload pattern
   - Optimize message compression

3. **Capacity Planning**
   - Use recommended capacity (80% of breaking point) for production
   - Monitor real-world usage patterns
   - Plan for 50% growth headroom

## Troubleshooting

### Connection Failures
- Check server is running on correct port (default 8765)
- Verify network connectivity
- Check file descriptor limits: `ulimit -n`

### High Memory Usage
- Review memory growth in sustained load test
- Check for connection pool leaks
- Verify garbage collection is tuned

### Latency Degradation
- Review operation distribution
- Check server CPU utilization
- Verify network bandwidth

### Breaking Point Issues
- Reduce increment step for finer granularity
- Increase iteration duration for stabilization
- Check system resource limits

## Integration with Wave 15

These tests validate Wave 15 features:
- Multi-competitor monitoring
- Real-time dashboard updates
- Tech detection at scale
- Session coherence under load
- Bot evasion effectiveness under stress

## Notes

- Tests require WebSocket server running on port 8765
- Some tests run for extended periods (8+ hours for sustained load)
- Results should be reviewed alongside production metrics
- Tests are non-destructive and don't modify system state
- Recommend running in isolated environment before production deployment

## References

- Parent project: Basset Hound Browser v12.0.0+
- WebSocket API: `/websocket/server.js`
- Performance baselines: `/docs/archives/session_records/2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md`
