# Monitoring & Operations Index

**Last Updated:** May 11, 2026  
**Version:** 11.3.0

---

## Overview

This directory contains monitoring setup guides, alert configurations, and operational documentation for production Basset Hound Browser deployments.

---

## Monitoring Documentation

### Setup & Configuration
- **MONITORING-METRICS.md** - Metrics to monitor
  - Performance metrics
  - Resource metrics
  - Application metrics
  - Custom metrics

- **ALERT-CONFIGURATION.md** - Alert setup
  - Alert types
  - Threshold values
  - Notification channels
  - Escalation policies

- **DASHBOARD-TEMPLATE.md** - Dashboard setup
  - Grafana dashboards
  - Metric visualization
  - Alert status
  - Performance graphs

### Operations
- **PRODUCTION-MONITORING.md** - Production monitoring
  - Real-time monitoring
  - Health checks
  - Alerting strategy
  - SLA definitions

---

## Key Metrics to Monitor

### Performance Metrics
- WebSocket command latency (p50, p95, p99)
- Screenshot capture time
- Navigation time
- Extraction time
- Message throughput

### Resource Metrics
- Memory usage
- CPU utilization
- Disk I/O
- Network bandwidth
- Connection count

### Application Metrics
- Commands executed
- Success rate
- Error rate
- Active connections
- Session duration

### Health Metrics
- Process uptime
- Database connectivity
- External service availability
- Proxy connectivity
- Tor connectivity

---

## Alert Thresholds

### Critical Alerts
- **Process down:** Immediate
- **Memory > 90%:** Immediate
- **Error rate > 5%:** Immediate
- **All connections lost:** Immediate

### Warning Alerts
- **Memory > 70%:** 5-minute sustained
- **CPU > 80%:** 5-minute sustained
- **Error rate > 2%:** 5-minute sustained
- **Latency p99 > 500ms:** 10-minute sustained

### Info Alerts
- **Memory > 50%:** Informational
- **CPU > 60%:** Informational
- **New deployment:** Informational
- **Service restart:** Informational

---

## Monitoring Setup

### Prerequisites
- Prometheus for metrics collection
- Grafana for visualization
- Alert manager for routing
- Log aggregation (ELK/Loki)

### Quick Start
```bash
./scripts/setup-monitoring.sh
```

This script:
- Configures Prometheus scraping
- Sets up Grafana dashboards
- Configures alerting rules
- Initializes log collection

---

## Dashboards

### Overview Dashboard
- Current status
- Key metrics
- Alert status
- Recent errors

### Performance Dashboard
- Response time trends
- Throughput graphs
- Resource usage
- Error rates

### Operations Dashboard
- Process status
- Connection count
- Active sessions
- System resources

### Health Dashboard
- Service dependencies
- Database health
- Proxy status
- Network status

---

## Log Monitoring

### Log Types
- Application logs
- Error logs
- Access logs
- Debug logs
- Audit logs

### Log Aggregation
- Centralized collection
- Full-text search
- Alert on patterns
- Historical analysis

### Log Retention
- 30 days online
- 90 days archived
- Indexed for 7 days
- Full text search enabled

---

## SLA Monitoring

### Availability SLA
- **Target:** 99.9%
- **Measurement:** Successful requests / Total requests
- **Alert:** Downtime > 1 minute

### Performance SLA
- **p99 Latency:** < 500ms
- **p95 Latency:** < 200ms
- **Throughput:** > 100 req/sec

### Error Rate SLA
- **Target:** < 0.1%
- **Critical:** > 1%
- **Warning:** > 0.5%

---

## Health Checks

### Liveness Check
- Process running
- Port responsive
- Basic connectivity

### Readiness Check
- All dependencies available
- Memory sufficient
- Connections established

### Startup Check
- Configuration valid
- Resources allocated
- Initial tests passing

---

## Alerting Channels

### Notification Methods
- Email
- Slack
- PagerDuty
- SMS (critical only)
- Webhooks

### Escalation Policy
1. **5 min:** Notify on-call
2. **15 min:** Escalate to team lead
3. **30 min:** Escalate to manager
4. **60 min:** All-hands alert

---

## Incident Response

### Detection
- Alert triggers
- Dashboard review
- Log analysis
- Metrics correlation

### Response
- Page on-call
- Diagnosis
- Mitigation
- Root cause analysis

### Recovery
- Service restoration
- Verification
- Cleanup
- Post-incident review

---

## Custom Metrics

### Application Metrics
- Command execution count
- Success/failure rates
- Latency percentiles
- Custom business metrics

### Business Metrics
- OSINT operations
- Bot evasion effectiveness
- Integration usage
- Feature adoption

---

## Monitoring Best Practices

### Collection
- Reasonable intervals (1-10 seconds)
- Efficient queries
- Aggregation at source
- Minimal overhead

### Retention
- Hot storage: 7 days
- Warm storage: 30 days
- Archive: 1 year
- Aggregation: Hourly after 7 days

### Alerting
- Clear alert names
- Actionable alerts
- Proper thresholds
- Runbook links

---

## Grafana Setup

### Dashboard Creation
1. Add Prometheus datasource
2. Create dashboard
3. Add metric panels
4. Configure alerts
5. Set up notifications

### Useful Queries
```
# Average latency
rate(command_latency_sum[5m]) / rate(command_latency_count[5m])

# Error rate
rate(command_errors_total[5m]) / rate(commands_total[5m])

# Memory usage
process_resident_memory_bytes

# Connections
websocket_connections
```

---

## References

- `/docs/monitoring/` - Monitoring configuration files
- `/docs/runbooks/` - Operational runbooks
- `/docs/TROUBLESHOOTING.md` - Troubleshooting guide
- `/docs/DEPLOYMENT.md` - Deployment guide

---

**Status:** ✅ Configured  
**Last Updated:** May 11, 2026  
**Alert Rules:** 15+ configured  
**Maintained By:** Operations Team
