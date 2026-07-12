# Monitoring & Health Checks

Setup monitoring and health checks for production.

## Health Check Endpoint

```bash
curl http://localhost:8765/api/diagnostics
```

Response:
```json
{
  "status": "ok",
  "version": "12.8.0",
  "uptime": 12345,
  "memory": {
    "used": 123456789,
    "total": 2147483648
  },
  "connections": 5
}
```

## Docker Health Check

In `docker-compose.yml`:

```yaml
services:
  basset-hound:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/api/diagnostics"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Metrics to Monitor

- Response time (latency)
- Memory usage
- CPU usage
- Active connections
- Request/response counts
- Error rates

## Logging

View logs:
```bash
# npm
npm start:prod 2>&1 | tee app.log

# Docker
docker logs -f basset-hound
```

Set log level:
```bash
export LOG_LEVEL=error  # production
export LOG_LEVEL=debug  # development
```

## Alerting

**Setup alerts for:**
- Container restart failures
- High memory usage (>80%)
- High CPU usage (>80%)
- WebSocket connection failures
- Error rate spikes

## Performance Baseline

Document baseline metrics:
- Average latency: < 100ms
- P99 latency: < 1s
- Memory growth: < 100MB/hour
- CPU under load: < 50%
- Throughput: > 100 requests/sec

## Monitoring Tools

- Prometheus (metrics collection)
- Grafana (dashboards)
- ELK Stack (logging)
- DataDog, New Relic (APM)

## See Also

- **[Pre-Deployment Checklist](PRE-DEPLOYMENT-CHECKLIST.md)** - Verification steps
- **[Performance Tuning](PERFORMANCE-TUNING.md)** - Optimization guide
- **[Rate Limiting](RATE-LIMITING-SECURITY.md)** - Rate limit setup
