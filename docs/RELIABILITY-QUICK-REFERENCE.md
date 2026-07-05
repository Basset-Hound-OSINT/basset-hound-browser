# Basset Hound Browser v12.9.0 - Reliability Quick Reference

## Health Endpoints (HTTP)

| Endpoint | Method | Response | Purpose |
|----------|--------|----------|---------|
| `/health` | GET | 200/503 | Full health status with SLA |
| `/health/live` | GET | 200 | Liveness probe (Kubernetes) |
| `/health/ready` | GET | 200/503 | Readiness probe (Kubernetes) |
| `/health/metrics` | GET | 200 | Detailed per-command metrics |
| `/health/reliability` | GET | 200 | SLA-focused metrics |

## WebSocket Commands

```json
// Full health status
{
  "command": "getHealth",
  "id": "req-1"
}

// SLA-focused health
{
  "command": "getHealthStatus",
  "id": "req-2"
}
```

## Retry Behavior

| Scenario | Behavior |
|----------|----------|
| Transient error + retryable command | Auto-retry (max 3 attempts) |
| Permanent error | Return immediately (no retry) |
| Non-retryable command | Return immediately (no retry) |
| Timeout | Retry as transient error |

## Transient Errors (Auto-Retried)

```
ETIMEDOUT          - Connection timeout
ECONNRESET         - Connection reset
ECONNREFUSED       - Connection refused
EPIPE              - Broken pipe
ENOTFOUND          - DNS resolution failed
ENETUNREACH        - Network unreachable
EAI_AGAIN          - Temporary DNS failure
TIMEOUT            - Command execution timeout
EHOSTUNREACH       - Host unreachable
socket hang up     - Socket connection lost
```

## Permanent Errors (No Retry)

```
INVALID_PARAMETERS - Invalid command parameters
AUTH_FAILED        - Authentication failure
UNAUTHORIZED       - Authorization denied
FORBIDDEN          - Access forbidden
NOT_FOUND          - Resource not found
BAD_REQUEST        - Malformed request
Unknown command    - Unsupported command
```

## Retryable Commands

### Read Operations (GET-like)
```
get_url                    get_content
get_page_state            get_cookies
get_all_cookies           get_local_storage
get_session_storage       get_network_logs
get_console_logs          get_downloads
```

### Status Queries
```
status                     ping
getHealth                  getHealthStatus
get_rate_limit_status     get_proxy_status
get_user_agent_status     get_connection_status
```

### Screenshots
```
screenshot                 screenshot_viewport
screenshot_full_page      screenshot_element
```

### Listings
```
list_sessions             list_tabs
list_profiles             list_scripts
```

## Retry Timing

```
Attempt 1: Immediate
Attempt 2: 1000ms delay (1 second)
Attempt 3: 2000ms delay (2 seconds)
Attempt 4: 4000ms delay (4 seconds)
Total Max Time: ~7 seconds
```

## Timeout Guarantees

```
Standard Commands:        30 seconds
Large HTML (>5MB):        45 seconds
Very Large (>20MB):      120 seconds
```

## Response Format

### Successful Command
```json
{
  "id": "req-123",
  "command": "navigateTo",
  "success": true,
  "result": { ... },
  "attempts": 1,
  "latency": 145,
  "retried": false,
  "timedOut": false
}
```

### Failed Command
```json
{
  "id": "req-124",
  "command": "navigateTo",
  "success": false,
  "error": "Connection timeout",
  "attempts": 4,
  "latency": 32100,
  "retried": true,
  "timedOut": true,
  "suggestion": "Command execution timeout..."
}
```

## Kubernetes Configuration

### Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8765
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Readiness Probe
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8765
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Monitoring Commands

### Check SLA Compliance
```bash
curl http://localhost:8765/health/reliability | jq '.sla.compliant'
# Output: true (compliant) or false (not compliant)
```

### Get Per-Command Reliability
```bash
curl http://localhost:8765/health/reliability | jq '.commands'
# Shows reliability % for each command
```

### Get Global Success Rate
```bash
curl http://localhost:8765/health/metrics | \
  jq '.requestCount, .errorCount, .errorRate'
```

### Get Latency Percentiles
```bash
curl http://localhost:8765/health/metrics | jq '.latencyPercentiles'
# Shows p50, p95, p99 latency
```

## Metrics Structure

### Per-Command
```
reliability        string   (e.g., "99.2%")
successCount      number   (count of successful calls)
failureCount      number   (count of failed calls)
totalAttempts     number   (including retries)
avgLatency        string   (e.g., "120ms")
p50Latency        string   (median latency)
p95Latency        string   (95th percentile)
p99Latency        string   (99th percentile)
retries           number   (count of retry attempts)
timeouts          number   (count of timeout failures)
```

### Global
```
totalRequests      number   (total command executions)
successfulRequests number   (successful executions)
failedRequests     number   (failed executions)
successRate        string   (e.g., "99.00%")
transientRetries   number   (total retry attempts)
timeoutFailures    number   (timeout count)
commandCount       number   (unique commands tracked)
```

## SLA Targets

| Metric | Target | Core Commands | All Commands |
|--------|--------|---------------|--------------|
| Reliability | % | 99%+ | 95%+ |
| Response Time P99 | ms | <2000 | <2000 |
| Uptime | % | 99.5% | 99.5% |

## Core Commands (99%+ SLA)

```
Navigate/Interact:
  navigateTo, navigate, click, fill, scroll, hover

Content Extraction:
  get_url, get_content, get_page_state

Screenshots:
  screenshot, screenshot_viewport, screenshot_full_page, screenshot_element

Data Access:
  get_cookies, get_all_cookies, get_local_storage, get_session_storage

Status:
  status, ping, getHealth, getHealthStatus
```

## Client-Side Error Handling

```javascript
async function executeCommand(cmd, params) {
  const response = await ws.send(cmd, params);
  
  if (response.success) return response;
  
  // Check if server already retried
  if (response.retried) {
    // Server already tried automatic retries
    console.error(`${cmd} failed after retries`);
    throw new Error(response.error);
  }
  
  // Handle permanent error
  throw new Error(`${cmd} failed: ${response.error}`);
}
```

## Configuration Defaults

```javascript
// Reliability Manager
maxRetries: 3
commandTimeout: 30000 (ms)
metricsWindow: 10000 (ms)
maxRecentRequests: 5000

// Health Endpoint Manager
maxSamples: 1000 (per command)
version: "12.9.0"
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Latency Overhead | <1ms |
| Memory Overhead | 1-2MB |
| CPU Overhead | <1% |
| Throughput Impact | Negligible |

## Documentation Files

| File | Purpose |
|------|---------|
| RELIABILITY-SLA.md | Complete SLA definition |
| RELIABILITY-INTEGRATION.md | Integration guide |
| RELIABILITY-CODE-SHOWCASE.md | Code examples |
| examples/reliability-usage-example.js | Runnable examples |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Commands below 99% SLA | Check /health/metrics for details |
| Timeout errors | Check server load, increase timeout if needed |
| High retry rate | May indicate network issues, check logs |
| Health endpoint 503 | System degraded, check readiness checks |

## Common Queries

### Python Example
```python
import requests
response = requests.get('http://localhost:8765/health/reliability')
sla_data = response.json()
print(f"SLA Compliant: {sla_data['sla']['compliant']}")
```

### Node.js Example
```javascript
const health = await fetch('http://localhost:8765/health/reliability');
const data = await health.json();
console.log(`Reliability: ${data.sla.current}`);
```

### cURL Examples
```bash
# Full health
curl http://localhost:8765/health | jq

# SLA only
curl http://localhost:8765/health/reliability | jq '.sla'

# Top commands
curl http://localhost:8765/health/reliability | \
  jq '.topCommands | .[0:3]'
```

---

**Quick Tip**: All health endpoints are available 24/7 and don't count against rate limits. Perfect for monitoring and alerting systems!

**Version**: 12.9.0  
**Last Updated**: June 21, 2026
