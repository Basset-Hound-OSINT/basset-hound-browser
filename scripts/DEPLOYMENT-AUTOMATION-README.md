# Basset Hound Browser - Deployment Automation v12.9.0

## Overview

This deployment automation suite provides production-ready scripts for zero-downtime deployments, health checks, automated rollback, and comprehensive notifications for the Basset Hound Browser.

### Key Features

- **Zero-Downtime Blue-Green Deployment** - Deploy new versions without service interruption
- **Automated Health Checks** - Validate container health, resources, performance, and error logs
- **Intelligent Rollback** - Automatic rollback on deployment failure with optional manual control
- **Multi-Channel Notifications** - Send updates via Slack, email, and generic webhooks
- **Canary Deployments** - Test new versions with a subset of traffic before full rollout
- **Staged Rollout** - Gradually increase traffic (10% → 50% → 100%)
- **Dry-Run Mode** - Preview deployments without executing
- **Comprehensive Logging** - Detailed logs and JSON reports for auditing
- **Pre-Deployment Backup** - Automatic backup of previous version before deployment

## Quick Start

### 1. Basic Deployment

```bash
# Deploy with health checks and Slack notifications
./scripts/deploy-v12.9.0.sh \
    --slack https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    --email ops@company.com

# Dry run to preview
./scripts/deploy-v12.9.0.sh --dry-run --force --no-backup
```

### 2. Canary Deployment

```bash
# Deploy to 5% of traffic first, then confirm to proceed
./scripts/deploy-v12.9.0.sh --canary

# Monitor canary for issues, then proceed with staged rollout
./scripts/deploy-v12.9.0.sh --canary --staged
```

### 3. Health Check

```bash
# Run health checks once
./scripts/health-check-v12.9.0.sh

# Continuous monitoring (every 5 seconds)
./scripts/health-check-v12.9.0.sh --continuous

# Generate HTML report
./scripts/health-check-v12.9.0.sh --detailed --slack WEBHOOK
```

### 4. Rollback

```bash
# Automatic rollback to previous version
./scripts/rollback-v12.9.0.sh

# Rollback to specific version
./scripts/rollback-v12.9.0.sh --to-version 12.8.0

# Dry run rollback
./scripts/rollback-v12.9.0.sh --dry-run --force
```

## Script Reference

### deploy-v12.9.0.sh

Production deployment script with zero-downtime blue-green strategy.

**Options:**
```
--canary              Deploy to canary (5% traffic) first
--staged              Deploy in stages (10%, 50%, 100%)
--force               Skip safety checks
--skip-health-check   Skip post-deployment health checks
--dry-run             Show what would be deployed without deploying
--registry URL        Use custom Docker registry
--slack WEBHOOK       Send Slack notifications
--email ADDR          Send email notifications
--backup              Create backup before deployment (default: enabled)
--no-backup           Skip backup
--preserve-data       Keep data volumes after old container removal
```

**Examples:**
```bash
# Standard production deployment
./scripts/deploy-v12.9.0.sh \
    --slack https://hooks.slack.com/services/X/Y/Z \
    --email ops@company.com

# Canary + staged deployment
./scripts/deploy-v12.9.0.sh --canary --staged \
    --slack https://hooks.slack.com/services/X/Y/Z

# Force deployment without backups
./scripts/deploy-v12.9.0.sh --force --no-backup

# Dry run
./scripts/deploy-v12.9.0.sh --dry-run --force --no-backup
```

**Output:**
- Deployment log: `logs/deployments/deploy-12.9.0-TIMESTAMP.log`
- Deployment report: `logs/deployments/report-12.9.0-TIMESTAMP.json`

---

### health-check-v12.9.0.sh

Comprehensive health check script for container validation and monitoring.

**Options:**
```
--detailed        Generate detailed HTML report
--continuous      Run health checks continuously (5s interval)
--interval N      Custom check interval in seconds
--slack WEBHOOK   Send Slack notifications for failures
--email ADDR      Send email on failures
--threshold PCT   Alert if resource usage exceeds percentage (default: 80)
--export CSV      Export metrics to CSV file
```

**Checks Performed:**
1. Container Status - Running, healthy, uptime
2. WebSocket Connectivity - Port accessibility, HTTP endpoint
3. Memory Usage - Current usage vs limits, alerting
4. CPU Usage - Current utilization, elevated alerts
5. Disk Usage - Volume sizes and utilization
6. Error Logs - Recent error count and patterns
7. Network Connectivity - DNS resolution, connectivity
8. Performance Baseline - Latency and throughput

**Examples:**
```bash
# Single health check
./scripts/health-check-v12.9.0.sh

# Continuous monitoring
./scripts/health-check-v12.9.0.sh --continuous --interval 10

# Detailed report with notifications
./scripts/health-check-v12.9.0.sh --detailed \
    --slack https://hooks.slack.com/services/X/Y/Z \
    --email ops@company.com

# Export metrics
./scripts/health-check-v12.9.0.sh --export /tmp/metrics.csv
```

**Output:**
- Health report: `logs/healthcheck-reports/health-report-v12.9.0-TIMESTAMP.txt`
- HTML report: `logs/healthcheck-reports/health-report-v12.9.0-TIMESTAMP.html`
- Metrics: `logs/healthcheck-reports/metrics-v12.9.0-TIMESTAMP.json`

**Thresholds:**
- Memory Warning: > 1500 MB
- Memory Critical: > 1900 MB
- CPU Warning: > 75%
- Latency Warning: > 100 ms
- Latency Critical: > 500 ms
- Error Count: > 10 in 10 minutes

---

### rollback-v12.9.0.sh

Automated rollback script with instant recovery and verification.

**Options:**
```
--to-version VERSION      Rollback to specific version (default: auto-detect)
--force                   Skip safety confirmations
--dry-run                 Show what would be rolled back without executing
--preserve-data           Keep data volumes after rollback
--no-verify               Skip verification checks after rollback
--slack WEBHOOK           Send Slack notifications
--email ADDR              Send email notifications
```

**Examples:**
```bash
# Automatic rollback to previous stable version
./scripts/rollback-v12.9.0.sh

# Rollback to specific version
./scripts/rollback-v12.9.0.sh --to-version 12.8.0

# Force rollback without confirmations
./scripts/rollback-v12.9.0.sh --force

# Dry run
./scripts/rollback-v12.9.0.sh --dry-run --force
```

**Output:**
- Rollback log: `logs/rollbacks/rollback-v12.9.0-TIMESTAMP.log`
- Rollback report: `logs/rollbacks/report-v12.9.0-TIMESTAMP.json`

---

### notification-integration.sh

Multi-channel notification integration for deployments, health checks, and alerts.

**Options:**
```
--type TYPE               Notification type (deployment|health-check|rollback|alert)
--status STATUS           Status (pending|success|warning|error|failed|rolled_back)
--message MSG             Custom notification message
--version VERSION         Deployment version
--duration SECONDS        Deployment duration
--slack WEBHOOK           Slack webhook URL
--email-to ADDR           Email recipient
--email-from ADDR         Email sender
--email-smtp-host HOST    Email SMTP host
--webhook URL             Generic webhook URL
--config FILE             Configuration file path
--setup                   Interactive setup wizard
--test                    Test all configured notifications
```

**Setup:**
```bash
# Interactive setup wizard
./scripts/notification-integration.sh --setup

# Configure specific channels
./scripts/notification-integration.sh --setup \
    --slack https://hooks.slack.com/services/X/Y/Z \
    --email-to ops@company.com
```

**Send Notifications:**
```bash
# Deployment success
./scripts/notification-integration.sh \
    --type deployment \
    --status success \
    --version 12.9.0 \
    --duration 120 \
    --slack https://hooks.slack.com/services/X/Y/Z

# Health check alert
./scripts/notification-integration.sh \
    --type health-check \
    --status warning \
    --message "Memory usage high: 1800MB"

# Rollback notification
./scripts/notification-integration.sh \
    --type rollback \
    --status success \
    --version 12.8.0
```

**Test Notifications:**
```bash
./scripts/notification-integration.sh --test
```

**Output:**
- Configuration: `.env.notifications` (600 permissions)

---

### test-deployment-automation.sh

Comprehensive test suite for deployment automation scripts.

**Options:**
```
--verbose    Verbose output
--skip-docker  Skip Docker-dependent tests
```

**Examples:**
```bash
# Run full test suite
./scripts/test-deployment-automation.sh

# Verbose output
./scripts/test-deployment-automation.sh --verbose

# Skip Docker tests
./scripts/test-deployment-automation.sh --skip-docker
```

**Test Coverage:**
- Script validation (syntax, executability, documentation)
- Configuration validation (docker-compose, volumes, healthchecks)
- Functional tests (dry runs, argument parsing, version parsing)
- Integration tests (complete workflows)
- Edge cases and error handling

**Output:**
- Test report: `logs/test-results/deployment-automation-test-TIMESTAMP.json`

## Deployment Workflow

### Standard Production Deployment

```
1. Pre-Flight Checks (Docker, permissions, configurations)
2. Create Backup (Save previous version and data volumes)
3. Build Docker Image (New version)
4. Push to Registry (If registry specified)
5. Blue-Green Deployment:
   a. Start new container (GREEN)
   b. Health checks (Port, WebSocket, container health)
   c. Smoke tests (Version endpoint, connectivity)
   d. Switch traffic (Rename to production)
   e. Cleanup old container
6. Post-Deployment Verification
7. Send Notifications (Slack, email)
8. Generate Reports (Logs, JSON)
```

### Canary Deployment

```
1. Deploy to canary container (5% traffic, port 8766)
2. Wait for manual confirmation
3. If approved, proceed with staged deployment
4. Stage 1: 10% traffic for 30 seconds
5. Stage 2: 50% traffic for 30 seconds
6. Stage 3: 100% traffic (full rollout)
```

### Automatic Rollback

```
1. Deployment fails at any stage
2. Automatic rollback triggered
3. Stop new container
4. Rename old container back to production
5. Start old container with previous version
6. Verify rollback successful
7. Send alert notifications
```

## Configuration

### Notifications Setup

```bash
# Interactive setup
./scripts/notification-integration.sh --setup

# Manual configuration
export SLACK_WEBHOOK="https://hooks.slack.com/services/X/Y/Z"
export EMAIL_TO="ops@company.com"
export EMAIL_SMTP_HOST="smtp.gmail.com"
```

Configuration is stored in: `.env.notifications` (secure permissions: 600)

### Docker Compose Configuration

The deployment automation uses Docker Compose v3.9 with:
- Service: `basset-hound-browser`
- Ports: 8765 (WebSocket API)
- Volumes: `basset-prod-data`, `basset-logs`, `basset-downloads`, `basset-screenshots`
- Healthcheck: 30s interval, 10s timeout, 3 retries, 40s start period
- Restart policy: `on-failure:5`
- Resource limits: 2 CPU, 2GB memory

## Health Check Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory | > 1500 MB | > 1900 MB |
| CPU | > 75% | — |
| Latency | > 100 ms | > 500 ms |
| Errors | > 10 (10m) | > 100 (10m) |

## Logs and Reports

All deployment activities are logged to:

```
logs/
├── deployments/
│   ├── deploy-12.9.0-*.log
│   └── report-12.9.0-*.json
├── rollbacks/
│   ├── rollback-12.9.0-*.log
│   └── report-12.9.0-*.json
├── healthcheck-reports/
│   ├── health-report-v12.9.0-*.txt
│   ├── health-report-v12.9.0-*.html
│   └── metrics-v12.9.0-*.json
└── test-results/
    └── deployment-automation-test-*.json
```

### Report Format (JSON)

```json
{
  "deployment": {
    "version": "12.9.0",
    "previous_version": "12.8.0",
    "timestamp": "2026-07-03T14:35:00Z",
    "duration_seconds": 120,
    "status": "SUCCESS"
  },
  "deployment_mode": {
    "canary": false,
    "staged": false,
    "dry_run": false,
    "backup_enabled": true
  },
  "health_checks": {
    "backup_created": true,
    "backup_path": "logs/deployments/backup-12.9.0-20260703-143500",
    "failed_checks": ""
  },
  "notifications": {
    "slack_sent": true,
    "email_sent": true
  }
}
```

## Troubleshooting

### Deployment Fails

1. Check pre-flight logs: `cat logs/deployments/deploy-12.9.0-TIMESTAMP.log`
2. Verify Docker daemon: `docker ps`
3. Check image: `docker images | grep basset-hound-browser`
4. Review health check: `./scripts/health-check-v12.9.0.sh`

### Automatic Rollback Failed

1. Container may be in inconsistent state
2. Manual intervention required
3. Check rollback logs: `cat logs/rollbacks/rollback-12.9.0-TIMESTAMP.log`
4. Stop container manually: `docker stop basset-hound-browser-prod`
5. Restore from backup if available

### Health Check Failures

1. Container port not accessible: `nc -z 127.0.0.1 8765`
2. Memory/CPU exceeded: `docker stats basset-hound-browser-prod`
3. Error logs: `docker logs basset-hound-browser-prod`
4. Check container health: `docker inspect basset-hound-browser-prod | grep Health`

### Notifications Not Sending

1. Slack: Verify webhook URL is correct and reachable
2. Email: Check SMTP configuration in `.env.notifications`
3. Test: `./scripts/notification-integration.sh --test`
4. Logs: Check curl errors in deployment/rollback logs

## Best Practices

### 1. Always Test First

```bash
# Dry run deployment
./scripts/deploy-v12.9.0.sh --dry-run --force --no-backup

# Verify health checks
./scripts/health-check-v12.9.0.sh
```

### 2. Monitor During Deployment

```bash
# Continuous monitoring in separate terminal
./scripts/health-check-v12.9.0.sh --continuous --interval 5

# Tail logs in separate terminal
tail -f logs/deployments/deploy-12.9.0-*.log
```

### 3. Use Canary for High-Risk Changes

```bash
./scripts/deploy-v12.9.0.sh --canary --staged
```

### 4. Schedule Regular Health Checks

```bash
# Add to crontab
*/5 * * * * /home/devel/basset-hound-browser/scripts/health-check-v12.9.0.sh --slack WEBHOOK
```

### 5. Backup Important Configurations

```bash
# Backup before major deployments
docker inspect basset-hound-browser-prod > config-backup.json
```

### 6. Review Logs and Reports

```bash
# After deployment
cat logs/deployments/report-12.9.0-*.json | jq '.'

# Check for errors
grep "ERROR\|FAIL" logs/deployments/deploy-12.9.0-*.log
```

## Performance Benchmarks

Typical deployment duration: 120-180 seconds
- Backup: 10-15s
- Image build: 60-90s
- Health checks: 30-60s
- Container startup: 10-20s

Health check duration: 30-45 seconds

Rollback duration: 30-60 seconds

## Support and Maintenance

### Regular Maintenance

1. Clean up old logs: `find logs/ -mtime +30 -delete`
2. Validate configurations: `./scripts/test-deployment-automation.sh`
3. Test notifications: `./scripts/notification-integration.sh --test`
4. Review error logs: `grep -r "ERROR" logs/deployments/`

### Version Updates

When updating to a new deployment automation version:

1. Review changelog
2. Test in dry-run mode
3. Update configuration if needed
4. Update deployment procedures
5. Test all notification channels

## Related Documentation

- Docker Compose Configuration: `infrastructure/docker/docker-compose.prod.yml`
- Deployment Checklist: `DEPLOYMENT-COMPLETE-2026-05-11.md`
- API Reference: `docs/API-REFERENCE.md`
- Roadmap: `docs/ROADMAP.md`

## License

Basset Hound Browser - Deployment Automation v12.9.0
Part of the Basset Hound Browser project.
