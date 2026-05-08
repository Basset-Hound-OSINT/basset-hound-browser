# Deep Performance Analysis Report - v11.3.0-fixed
Generated: 2026-05-08T22:46:10.632Z

## Network Latency Analysis

### get_text (minimal)
- p50: 0ms
- p90: 1ms
- p95: 1ms
- p99: 1ms
- Average: 0ms
- Range: 0ms - 1ms
- StdDev: 0ms

### get_html (medium)
- p50: 0ms
- p90: 1ms
- p95: 1ms
- p99: 1ms
- Average: 0ms
- Range: 0ms - 1ms
- StdDev: 0ms

### screenshot (heavy)
- p50: 0ms
- p90: 1ms
- p95: 1ms
- p99: 1ms
- Average: 0ms
- Range: 0ms - 1ms
- StdDev: 0ms

## Memory Fragmentation

| After 20 ops | 7MB / 11MB | 36% frag | +0MB growth |
| After 40 ops | 7MB / 11MB | 34% frag | +0MB growth |
| After 60 ops | 7MB / 11MB | 33% frag | +1MB growth |
| After 80 ops | 7MB / 11MB | 31% frag | +1MB growth |
| After 100 ops | 8MB / 11MB | 30% frag | +1MB growth |

## Command Dispatch

- Single Command Avg: 0ms
- 10 Concurrent Commands: 1ms
- Concurrent Throughput: 10000 ops/sec
- Min: 0ms
- Max: 0ms

## Identified Bottlenecks

### [LOW] CPU Usage
Issue: High CPU usage: 104ms total
Impact: May impact other processes

