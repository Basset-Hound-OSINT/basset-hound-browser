# MAINTENANCE RUNBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [Maintenance Windows](#maintenance-windows)
3. [Backup Procedures](#backup-procedures)
4. [Database/Data Cleanup](#data-cleanup)
5. [Log Rotation](#log-rotation)
6. [Security Patching](#security-patching)
7. [Performance Tuning](#performance-tuning)
8. [Certificate Management](#certificate-management)
9. [Dependency Updates](#dependency-updates)
10. [Regular Maintenance Schedule](#regular-maintenance-schedule)

---

## Overview

This runbook covers operational maintenance activities to keep Basset Hound Browser running optimally and securely.

**Maintenance Categories**:
- **Backup & Recovery**: Data protection and disaster recovery
- **Cleanup**: Remove old logs, cache, temporary files
- **Security**: Patch vulnerabilities, update dependencies
- **Performance**: Optimize memory, tune configurations
- **Monitoring**: Verify health and collect metrics

**SLAs**:
- Planned downtime: 2 hours per month (outside business hours)
- Unplanned outage: < 30 minutes RTO
- Data backup: Daily (full backup weekly)
- Security patches: Within 48 hours of release
- Dependency updates: Monthly review cycle

---

## Maintenance Windows

### Scheduled Maintenance Windows

Perform maintenance during these windows:

**Production Environment**:
- **Primary Window**: Saturdays 2:00 AM - 4:00 AM UTC
- **Secondary Window**: Tuesdays 3:00 AM - 4:00 AM UTC (if needed)
- **Emergency**: Can be performed outside windows with on-call approval

**Development Environment**:
- Anytime (no restrictions)

### Notification Procedure

Before maintenance:

1. **Notify stakeholders** (at least 24 hours notice):
   - Email: ops@basset-hound.example.com
   - Slack: #basset-hound-ops channel
   - Status page: Update status.basset-hound.example.com

2. **Prepare maintenance plan**:
   - Document steps and expected duration
   - Identify rollback procedures
   - Assign on-call engineer

3. **Create backup**:
   ```bash
   ./infrastructure/scripts/backup-automation.sh --full
   ```

4. **Verify maintenance readiness**:
   - All scripts tested in staging
   - Rollback plan documented
   - Monitoring active

### Maintenance Rollout

```bash
# 30 minutes before: Final system check
curl -s http://localhost:8765/health | jq '.'

# During: Monitor progress
tail -f /app/logs/maintenance.log

# After: Verification
curl -s http://localhost:8765/health
docker logs basset-hound-browser | tail -20
```

---

## Backup Procedures

### Automated Backup Strategy

**Backup Schedule**:
- Full backup: Daily at 1:00 AM UTC
- Incremental backup: Hourly
- Retention: 30 days
- Off-site: Weekly copy to S3 or equivalent

### Full Backup Procedure

#### Step 1: Initiate Full Backup

```bash
# Run full backup
./infrastructure/scripts/backup-automation.sh --full

# Expected output:
# [INFO] Starting full backup...
# [INFO] Backing up data volume...
# [INFO] Backing up logs volume...
# [INFO] Compressing backup files...
# [SUCCESS] Backup complete: backups/full-2026-06-21-010000.tar.gz
```

#### Step 2: Verify Backup Integrity

```bash
# List backups
ls -lah backups/full-*.tar.gz

# Verify backup integrity
./infrastructure/scripts/backup-automation.sh --verify backups/full-2026-06-21-010000.tar.gz

# Expected output:
# [SUCCESS] Backup integrity verified
# [SUCCESS] Backup size: 2.5 GB
# [SUCCESS] File count: 1234
```

#### Step 3: Backup to Off-Site Storage

```bash
# Option A: AWS S3
aws s3 cp backups/full-2026-06-21-010000.tar.gz \
  s3://basset-backups/production/full/ \
  --storage-class GLACIER \
  --sse AES256

# Option B: Azure Blob Storage
az storage blob upload \
  --account-name bassetbackups \
  --container-name production \
  --name full-2026-06-21-010000.tar.gz \
  --file backups/full-2026-06-21-010000.tar.gz

# Option C: Google Cloud Storage
gsutil -m cp backups/full-2026-06-21-010000.tar.gz \
  gs://basset-backups/production/full/

# Verify upload
gsutil ls -lh gs://basset-backups/production/full/
```

#### Step 4: Cleanup Old Backups

```bash
# Remove backups older than 30 days (automated)
find backups/ -type f -mtime +30 -delete

# Or manually
rm -v backups/full-*.tar.gz  # Select which to delete
```

### Incremental Backup Procedure

```bash
# Run incremental backup
./infrastructure/scripts/backup-automation.sh --incremental

# Incremental backups only backup changes since last full backup
# Faster than full backups, suitable for frequent backup schedules
```

### Backup Verification Test

Monthly: Test that backups can be restored:

```bash
# Create test environment
docker run -it --rm \
  -v basset-data-test:/app/data \
  -v ./backups:/backups:ro \
  basset-hound-browser:12.7.0 bash

# Extract backup to test location
cd /app/data
tar xzf /backups/full-2026-06-21-010000.tar.gz

# Verify files
ls -la

# Exit test
exit

# Cleanup
docker volume rm basset-data-test
```

---

## Data Cleanup

### Cache Cleanup

Remove unused cache to free disk space:

```bash
# Docker: Cleanup cache
docker system prune -a --volumes

# More conservative: Remove only unused items
docker image prune -a
docker volume prune
docker container prune

# Kubernetes: Clear pod ephemeral storage
kubectl delete pods -n basset-hound --all  # Force new pod startup

# Application cache
docker exec basset-hound-browser rm -rf /app/cache/*
```

### Screenshot/Download Cleanup

Screenshots and downloads accumulate over time:

```bash
# Remove old screenshots (> 30 days)
find /app/screenshots -type f -mtime +30 -delete
docker exec basset-hound-browser find /app/screenshots -type f -mtime +30 -delete

# Remove incomplete downloads
find /app/downloads -name "*.tmp" -delete
docker exec basset-hound-browser find /app/downloads -name "*.tmp" -delete

# List disk usage by directory
docker exec basset-hound-browser du -sh /app/*
```

### WebSocket Session Cleanup

Clean up stuck or dead sessions:

```bash
# Check active WebSocket connections
curl -s http://localhost:8765/metrics | grep websocket_connections

# If high number of connections (> 1000), may need cleanup
# Restart container to force cleanup
docker restart basset-hound-browser

# Or graceful shutdown
docker-compose down
sleep 5
docker-compose up -d
```

### Temp File Cleanup

Remove temporary files that can accumulate:

```bash
# Remove files in /tmp older than 7 days
docker exec basset-hound-browser find /tmp -type f -mtime +7 -delete

# Remove core dumps (if any)
docker exec basset-hound-browser find / -name "core.*" -delete
```

---

## Log Rotation

### Docker Log Rotation

Docker automatically rotates logs based on driver configuration:

```bash
# Current configuration (from docker-compose.yml)
# logging:
#   driver: json-file
#   options:
#     max-size: "10m"
#     max-file: "10"
#
# This means:
# - Each log file max 10MB
# - Keep maximum 10 files (100MB total)
# - Older files automatically deleted

# View current logs
docker logs basset-hound-browser

# View specific log file
ls -lh /var/lib/docker/containers/*/basset-hound-browser*/*-json.log

# Manually rotate (not needed with auto-rotation)
docker kill -s SIGUSR1 basset-hound-browser  # Tell app to rotate
```

### Application Log Rotation

If application logs to files:

```bash
# Find log files
docker exec basset-hound-browser find /app/logs -type f -name "*.log"

# Compress old logs (older than 7 days)
docker exec basset-hound-browser bash -c \
  'find /app/logs -type f -name "*.log" -mtime +7 -exec gzip {} \;'

# Verify compression
docker exec basset-hound-browser ls -lh /app/logs/

# Archive old compressed logs to backup
docker exec basset-hound-browser bash -c \
  'find /app/logs -name "*.gz" -mtime +30 -exec rm {} \;'
```

### Kubernetes Log Rotation

Kubernetes manages pod logs, but ensure nodes have sufficient disk:

```bash
# Check node disk usage
kubectl describe nodes | grep -A 10 "Allocatable"

# Check PVC usage
kubectl get pvc -n basset-hound
kubectl exec -it <pod-name> -n basset-hound -- du -sh /app/logs

# Cleanup if needed
kubectl exec -it <pod-name> -n basset-hound -- \
  find /app/logs -type f -mtime +30 -delete
```

### Prometheus Metrics Retention

If using Prometheus monitoring:

```bash
# Default retention: 15 days
# To change (update prometheus.yml):
# global:
#   scrape_interval: 15s
#   evaluation_interval: 15s
#   external_labels:
#     monitor: 'basset-hound'
# storage:
#   retention:
#     time: 30d  # Keep 30 days of metrics
#     size: 50GB # Or until 50GB used

# Restart Prometheus to apply
docker-compose restart prometheus

# Check Prometheus data directory
du -sh /prometheus
```

---

## Security Patching

### System Package Updates

Apply OS-level security patches:

```bash
# Check available updates
docker exec basset-hound-browser apt-get update
docker exec basset-hound-browser apt-get upgrade --dry-run

# Apply patches (plan 30-minute maintenance window)
docker exec basset-hound-browser apt-get update
docker exec basset-hound-browser apt-get upgrade -y
docker exec basset-hound-browser apt-get autoremove -y

# Restart container to ensure patches loaded
docker restart basset-hound-browser

# Verify patches applied
docker exec basset-hound-browser apt-get update
docker exec basset-hound-browser apt-get upgrade --dry-run
# Should show 0 packages to upgrade
```

### Node.js Dependency Updates

Update npm dependencies:

```bash
# Check for vulnerable dependencies
npm audit

# Audit for specific severity
npm audit --audit-level=moderate

# Fix vulnerabilities
npm audit fix

# For breaking changes, update major versions carefully
npm update                    # Safe: update minor/patch versions
npm install package@latest    # Major version update (test before!)

# After updates:
npm test
docker build -t basset-hound-browser:12.7.0-updated .
docker-compose up -d
```

### Docker Image Scanning

Scan for vulnerabilities in container images:

```bash
# Using Trivy
trivy image basset-hound-browser:12.7.0

# Using Snyk
snyk container test basset-hound-browser:12.7.0

# Using Docker Scout
docker scout cves basset-hound-browser:12.7.0

# Fix vulnerabilities
# 1. Update base image
# 2. Update dependencies
# 3. Rebuild image
docker build -t basset-hound-browser:12.7.1 .
```

### SSL/TLS Certificate Renewal

If using HTTPS/WSS:

```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.crt -noout -dates

# If expiring within 30 days, renew:

# Option A: Let's Encrypt (automated via cert-manager in K8s)
# Already handled by cert-manager, just verify:
kubectl get certificate -n basset-hound

# Option B: Manual renewal
openssl req -new -key /path/to/server.key \
  -out /path/to/server.csr

# Send CSR to CA, receive new certificate
# Update certificate in container secret
kubectl create secret tls basset-tls \
  --cert=/path/to/new-cert.crt \
  --key=/path/to/server.key \
  -n basset-hound --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to load new certificate
kubectl rollout restart deployment/basset-hound-browser -n basset-hound
```

### Vulnerability Disclosure Monitoring

Regularly check security advisories:

```bash
# Check Node.js security updates
curl -s https://nodejs.org/en/blog/ | grep -i security

# Check Electron security updates
curl -s https://github.com/electron/electron/releases | grep -i security

# Subscribe to mailing lists
# - npm-security-updates (npm updates)
# - nodejs-security (Node.js security)
```

---

## Performance Tuning

### Memory Optimization

Monitor and optimize memory usage:

```bash
# Check current memory usage
docker stats basset-hound-browser --no-stream

# If memory usage high:
# 1. Check for memory leaks in logs
docker logs basset-hound-browser | grep -i "memory\|heap\|leak"

# 2. Increase Node.js max old space size
# In docker-compose.yml:
# environment:
#   - NODE_OPTIONS=--max-old-space-size=2048  # Increase from 2048 to 3072

# 3. Restart container
docker-compose restart basset-hound-browser

# 4. Monitor improvement
docker stats basset-hound-browser --no-stream
```

### CPU Optimization

Optimize CPU-intensive operations:

```bash
# Monitor CPU usage
docker stats basset-hound-browser --no-stream

# Check what's consuming CPU
docker top basset-hound-browser

# If high CPU:
# 1. Check for long-running operations in logs
docker logs basset-hound-browser | grep -i "slow\|timeout"

# 2. Adjust batch sizes or concurrency
# Edit docker-compose.yml environment variables

# 3. Consider horizontal scaling
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound
```

### Disk I/O Optimization

```bash
# Check disk usage
docker exec basset-hound-browser df -h /app

# Check disk I/O
docker stats basset-hound-browser --no-stream | grep -i "io"

# If high disk I/O:
# 1. Cleanup old files
docker exec basset-hound-browser find /app -mtime +30 -delete

# 2. Compress logs
docker exec basset-hound-browser gzip /app/logs/*.log

# 3. Move to faster storage (if available)
# Update docker-compose volume mounts
```

### Network Optimization

```bash
# Check network usage
docker stats basset-hound-browser --no-stream

# Monitor WebSocket connections
curl -s http://localhost:8765/metrics | grep websocket

# If high connection overhead:
# 1. Enable compression (check if already enabled)
# 2. Reduce message frequency
# 3. Implement client-side batching
```

---

## Certificate Management

### Self-Signed Certificate Generation (Development)

```bash
# Generate private key
openssl genrsa -out /path/to/server.key 2048

# Generate certificate signing request
openssl req -new -key /path/to/server.key \
  -out /path/to/server.csr \
  -subj "/CN=basset.local/O=Basset/C=US"

# Self-sign certificate (valid 365 days)
openssl x509 -req -days 365 \
  -in /path/to/server.csr \
  -signkey /path/to/server.key \
  -out /path/to/server.crt

# For Kubernetes, create secret
kubectl create secret tls basset-tls \
  --cert=/path/to/server.crt \
  --key=/path/to/server.key \
  -n basset-hound
```

### Let's Encrypt Certificate (Production)

Install cert-manager and configure:

```yaml
# cert-manager ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@basset-hound.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

Apply and verify:

```bash
kubectl apply -f cert-manager-issuer.yaml

# Check issuer status
kubectl get clusterissuer

# Certificates automatically managed by cert-manager
kubectl get certificate -n basset-hound
```

---

## Dependency Updates

### Monthly Dependency Review

```bash
# Check for outdated packages
npm outdated

# Review package changelog
npm view <package> changelog

# Test update in staging
npm install <package>@latest
npm test

# If tests pass, update in production
npm install <package>@latest --save
docker build -t basset-hound-browser:12.7.1 .
```

### Security Vulnerability Fixes

```bash
# Audit dependencies
npm audit

# Fix automatically
npm audit fix

# For breaking changes, manual update
npm install package-name@major-version

# Test thoroughly
npm test
# Run full integration tests
./scripts/test-all.sh
```

### Major Version Upgrades

Plan for major upgrades carefully:

```bash
# Create feature branch
git checkout -b upgrade/node-20-to-22

# Update Node.js version in Dockerfile
# FROM node:20-bullseye -> FROM node:22-bullseye

# Rebuild and test
docker build -t basset-hound-browser:test .
npm test

# Integration test
docker-compose -f docker-compose.yml up -d
./scripts/load-test.sh

# Review breaking changes
git log v20..v22

# Commit and merge
git add .
git commit -m "chore: upgrade to Node.js 22"
git push origin upgrade/node-20-to-22
```

---

## Regular Maintenance Schedule

### Daily Maintenance (Automated)

These should be automated via cron jobs:

```bash
# 1:00 AM UTC - Full backup
0 1 * * * /path/to/infrastructure/scripts/backup-automation.sh --full

# 4:00 AM UTC - Cleanup old files
0 4 * * * docker exec basset-hound-browser find /app -mtime +30 -delete

# Every 6 hours - Metrics export
0 */6 * * * curl -s http://localhost:9090/api/v1/targets > /var/log/basset-metrics.log
```

Add to crontab:

```bash
crontab -e

# Add entries above
# Save and exit
```

### Weekly Maintenance (Manual)

Perform each Monday:

```bash
# 1. Check disk usage
df -h /
du -sh /var/lib/docker

# 2. Review logs for errors
docker logs basset-hound-browser | grep -i "error" | head -10

# 3. Check security updates available
apt update && apt upgrade --dry-run

# 4. Verify backup integrity
./infrastructure/scripts/backup-automation.sh --verify \
  backups/full-$(date -d "yesterday" +%Y-%m-%d)*.tar.gz

# 5. Performance metrics review
curl -s http://localhost:9090/metrics | head -30
```

### Monthly Maintenance (Manual)

Perform first week of month:

```bash
# 1. Test disaster recovery
# See backup verification test above

# 2. Review and update documentation
# - Check if procedures need updates
# - Update runbooks with lessons learned
# - Review on-call schedules

# 3. Security audit
npm audit
docker scout cves basset-hound-browser:12.7.0

# 4. Update dependencies
npm update
npm audit fix

# 5. Capacity planning
kubectl top nodes
kubectl top pods -n basset-hound
# Review if scaling needed

# 6. Database maintenance (if applicable)
# - Index optimization
# - Statistics update
# - Vacuum/cleanup
```

### Quarterly Maintenance (Planned)

Perform each quarter:

```bash
# 1. Major version updates
# - Node.js updates
# - Docker image updates
# - Kubernetes version updates

# 2. Infrastructure optimization
# - Review and adjust resource limits
# - Optimize storage
# - Review cost

# 3. Security review
# - Vulnerability assessment
# - Penetration testing
# - Access control review

# 4. Disaster recovery drill
# - Full restoration test
# - Document issues and improvements
# - Update recovery procedures

# 5. Documentation review
# - Update runbooks
# - Update architecture docs
# - Update contact lists
```

### Annual Maintenance (Planned)

Perform annually:

```bash
# 1. Major platform upgrades
# - Kubernetes cluster upgrade
# - OS upgrades
# - Database version upgrades

# 2. Complete infrastructure audit
# - Security hardening review
# - Performance baseline reset
# - Cost optimization

# 3. Capacity planning for next year
# - Growth projections
# - Infrastructure investment
# - Training needs

# 4. Certification and compliance
# - SOC2 compliance review
# - GDPR/privacy audit
# - Regular compliance certification
```

---

## Maintenance Checklist Template

Use this for each maintenance window:

```markdown
# Maintenance Window: [DATE] [TIME] UTC

## Pre-Maintenance
- [ ] Notify stakeholders
- [ ] Create backup
- [ ] Test rollback procedure
- [ ] Assign on-call engineer
- [ ] Final system health check

## Maintenance Tasks
- [ ] Task 1: [description]
- [ ] Task 2: [description]
- [ ] Task 3: [description]

## Post-Maintenance Verification
- [ ] System health check
- [ ] All endpoints responding
- [ ] Metrics collection active
- [ ] No error rate increase
- [ ] Backup created

## Notification
- [ ] Stakeholders notified
- [ ] Status page updated
- [ ] Incident documented (if any)

## Duration: [X minutes]
## Status: [SUCCESS/ISSUES/ROLLBACK]
```

---

## Related Documentation

- [Deployment Runbook](./RUNBOOK-DEPLOYMENT.md)
- [Monitoring Runbook](./RUNBOOK-MONITORING.md)
- [Troubleshooting Runbook](./RUNBOOK-TROUBLESHOOTING.md)
- [Infrastructure README](../infrastructure/README.md)
- [SECURITY.md](../SECURITY.md)
