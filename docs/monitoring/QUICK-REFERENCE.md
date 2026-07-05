# Monitoring System - Quick Reference Card

**Print this page for desk reference**

---

## Health Endpoints

```
GET /health               → Full status (200 or 503)
GET /health/live          → Liveness (200)
GET /health/ready         → Readiness (200 or 503)
GET /health/metrics       → All metrics (200)
```

---

## WebSocket Commands

```javascript
// Current metrics
{command: 'get_metrics'}

// Performance stats
{command: 'get_performance_stats', params: {timeRange: '1m'}}

// Security metrics
{command: 'get_security_metrics'}

// Real-time stream
{command: 'stream_metrics'}
```

---

## Thresholds & Alerts

| Metric | Warning | Critical | Interval |
|--------|---------|----------|----------|
| **CPU** | 70% | 85% | 5 sec |
| **Memory** | 80% | 95% | 5 sec |
| **Error Rate** | 1% | 5% | Real-time |
| **Latency p99** | 500ms | 1000ms | Real-time |
| **Rate Limits** | 1/sec | 5/sec | Real-time |

---

## Storage Tiers

| Tier | Size | Duration | Use |
|------|------|----------|-----|
| Hot | < 5MB | 5 min | Real-time |
| Warm | 50-100MB | 24h | Recent |
| Archive | Small | 30d | History |
| Cold | Large | 90d+ | Compliance |

---

## Collection Intervals

- **Real-time:** Requests, errors, security events
- **5 seconds:** CPU, memory
- **10 seconds:** Disk I/O, network I/O, throughput
- **30 seconds:** Health checks
- **60 seconds:** Service availability

---

## Metric Families (23 Total)

### System (4)
- `system.cpu.usage` - CPU percentage
- `system.memory.usage` - Heap + system memory
- `system.disk.io` - Read/write throughput
- `system.network.io` - In/out throughput

### Application (8)
- `app.requests.total` - Total requests
- `app.requests.throughput` - Commands/sec
- `app.requests.latency` - Latency percentiles
- `app.errors.total` - Error count
- `app.connections.active` - Active connections
- `app.performance.memory` - Memory usage
- `app.performance.gc` - GC metrics
- `app.throughput.bytes` - Bytes/sec

### Security (6)
- `security.ratelimit.violations` - Rate limit rejections
- `security.validation.size` - Size limit rejections
- `security.validation.path` - Path validation failures
- `security.validation.input` - Input validation errors
- `security.auth.attempts` - Auth attempts
- `security.auth.failures` - Auth failures

### Health (5)
- `health.components.status` - Component health
- `health.service.status` - Service status
- `health.readiness.checks` - Readiness status
- `health.liveness.checks` - Liveness status
- `health.availability` - Service availability

---

## Configuration

```bash
# Enable monitoring
MONITORING_ENABLED=true

# Intervals (milliseconds)
SYSTEM_METRICS_INTERVAL=5000
APP_METRICS_INTERVAL=10000
HEALTH_CHECK_INTERVAL=30000

# Storage
METRICS_STORAGE_PATH=./data/metrics
METRICS_COMPRESSION_LEVEL=6
METRICS_RETENTION_WARM=86400000      # 24 hours
METRICS_RETENTION_ARCHIVE=2592000000 # 30 days

# Thresholds
ALERT_CPU_WARNING=70
ALERT_CPU_CRITICAL=85
ALERT_MEMORY_WARNING=80
ALERT_MEMORY_CRITICAL=95
```

---

## Troubleshooting

### Metrics Not Collecting
1. Check: `curl http://localhost:8765/health`
2. Enable: `MONITORING_ENABLED=true`
3. Verify: Check `/health/metrics` responds

### High Memory
1. Check hot storage size
2. Trigger cleanup: `hotStorage.cleanup()`
3. Force GC: `global.gc()`

### Storage Full
1. Check disk: `du -sh ./data/metrics/`
2. Cleanup warm: `find ./data/metrics/warm -mtime +1 -delete`
3. Compress archive: `gzip -9 ./data/metrics/archive.db`

### Dashboard Not Updating
1. Prometheus running: `docker-compose ps`
2. Metrics endpoint: `curl http://localhost:9090/metrics`
3. Restart: `docker-compose restart prometheus`

---

## Dashboards (4 Available)

| Dashboard | Use Case | Refresh |
|-----------|----------|---------|
| System Health | Infrastructure | 10s |
| Application Performance | Performance | 10s |
| Security Monitoring | Security | 30s |
| Real-Time Operations | On-call | 5s |

Access at: `http://localhost:3000/dashboards`

---

## Implementation Checklist

Setup Phase:
- [ ] Enable `MONITORING_ENABLED`
- [ ] Verify `/health` endpoint
- [ ] Check metrics collection

Storage Phase:
- [ ] Configure warm file storage
- [ ] Setup archive database
- [ ] Test retention policies

Dashboard Phase:
- [ ] Configure Prometheus scrape
- [ ] Import Grafana dashboards
- [ ] Setup notification channels

Operations Phase:
- [ ] Define runbooks
- [ ] Train team
- [ ] Schedule maintenance

---

## Performance Targets

| Metric | Target | Acceptable | Alert |
|--------|--------|-----------|-------|
| Collection overhead | < 1% CPU | < 2% | > 2% |
| Hot storage size | 3-5MB | < 5MB | > 5MB |
| Memory growth | 0 MB/hr | < 0.5 MB/hr | > 1 MB/hr |
| Query latency | < 100ms | < 200ms | > 500ms |
| Disk usage growth | < 100MB/day | < 150MB/day | > 200MB/day |

---

## Documentation Map

```
docs/monitoring/
├── MONITORING-SETUP-GUIDE.md (Start here - 5 min setup)
├── METRICS-DEFINITIONS.md (All metrics reference)
├── DASHBOARD-TEMPLATES.md (Grafana dashboards)
├── COLLECTION-AND-STORAGE-STRATEGY.md (Technical guide)
├── MONITORING-INDEX.md (Navigation & index)
├── COMPREHENSIVE-MONITORING-SUMMARY.md (Delivery summary)
└── QUICK-REFERENCE.md (This file)
```

---

## Quick Start (5 minutes)

```bash
# 1. Enable monitoring
export MONITORING_ENABLED=true
npm start

# 2. Check health
curl http://localhost:8765/health

# 3. View metrics
curl http://localhost:8765/health/metrics | jq .

# 4. Setup dashboards (see DASHBOARD-TEMPLATES.md)

# 5. Configure alerts (see MONITORING-INDEX.md)
```

---

## Support

- Setup issues: See MONITORING-SETUP-GUIDE.md
- Metric details: See METRICS-DEFINITIONS.md
- Dashboard help: See DASHBOARD-TEMPLATES.md
- Storage questions: See COLLECTION-AND-STORAGE-STRATEGY.md
- Navigation: See MONITORING-INDEX.md

---

**Version:** 1.0  
**Date:** June 21, 2026  
**Status:** Production Ready

Last updated: Keep with this card for reference
