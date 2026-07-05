# Basset Hound Browser - Deployment Automation Guide (v12.7.0)

**Last Updated:** June 15, 2026  
**Version:** v12.7.0  
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Deployment Scripts](#deployment-scripts)
3. [Deployment Workflow](#deployment-workflow)
4. [Canary Deployment](#canary-deployment)
5. [Health Checks](#health-checks)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Docker Optimization](#docker-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

The Basset Hound Browser deployment automation suite provides enterprise-grade deployment tooling with:

- **Zero-downtime deployments** via canary rollout strategy
- **Automated health checks** and smoke tests
- **Instant rollback** with data preservation
- **Real-time monitoring** with anomaly detection
- **Email/Slack notifications** for deployment events
- **Comprehensive logging** for audit trails

### Key Features

| Feature | Description |
|---------|-------------|
| **Artifact Support** | Pre-built Docker images or direct builds |
| **Registry Integration** | Push to Docker registries automatically |
| **Backup & Recovery** | Automatic data volume backups before deployment |
| **Canary Deployment** | Progressive traffic rollout (10% → 50% → 100%) |
| **Health Verification** | Multi-layer health checks post-deployment |
| **Performance Monitoring** | Real-time latency and throughput tracking |
| **Security Hardened** | Non-root user, capability dropping, security scanning |

---

## Deployment Scripts

### 1. Main Deployment Script: `deploy-v12.7.0.sh`

**Purpose:** Build, validate, deploy, and verify new versions  
**Location:** `scripts/deploy-v12.7.0.sh`

#### Basic Usage

```bash
# Standard deployment (with confirmation)
./scripts/deploy-v12.7.0.sh

# Force deployment without confirmation
./scripts/deploy-v12.7.0.sh --force

# Use pre-built artifact
./scripts/deploy-v12.7.0.sh --artifact /path/to/image.tar --force

# Push to registry after build
./scripts/deploy-v12.7.0.sh --registry docker.io/myorg --force
```

#### Options

```
--artifact PATH              Use pre-built artifact instead of building
--registry URL              Push to Docker registry after build
--canary                    Enable canary deployment (10% traffic)
--force                     Force deployment without confirmations
--skip-tests                Skip smoke tests after deployment
--no-backup                 Don't backup current version
-h, --help                  Show help message
```

#### Workflow

1. **Pre-Deployment Checks**
   - Verify Docker daemon
   - Check Docker Compose
   - Validate project structure

2. **Version Validation**
   - Ensure version bump is correct
   - Prevent downgrades

3. **Image Build/Load**
   - Build Docker image from source OR
   - Load pre-built artifact

4. **Registry Push** (if configured)
   - Tag and push to container registry

5. **Backup Current Version**
   - Export container config
   - Backup data volumes

6. **Container Deployment**
   - Stop current container
   - Start new container with new image

7. **Post-Deployment Validation**
   - Wait for container health
   - Verify WebSocket connectivity
   - Run smoke tests

8. **Canary Deployment** (if enabled)
   - Phase 1: 10% traffic (5 min)
   - Phase 2: 50% traffic (5 min)
   - Phase 3: 100% traffic (5 min)

#### Example Deployment

```bash
# Deploy v12.7.0 with artifacts from CI/CD pipeline
./scripts/deploy-v12.7.0.sh \
  --artifact /tmp/basset-hound-v12.7.0.tar \
  --registry registry.example.com/basset-hound \
  --force

# Deploy with canary rollout
./scripts/deploy-v12.7.0.sh --canary
```

---

### 2. Canary Deployment Script: `canary-deploy.sh`

**Purpose:** Progressive deployment with traffic splitting  
**Location:** `scripts/canary-deploy.sh`

#### Basic Usage

```bash
# Deploy with canary (default: 5 min per phase)
./scripts/canary-deploy.sh --version 12.7.0

# Deploy with custom phase duration
./scripts/canary-deploy.sh --version 12.7.0 --duration 300

# Deploy with custom error threshold
./scripts/canary-deploy.sh --version 12.7.0 --threshold 10
```

#### Options

```
--version VERSION           Version to canary deploy (REQUIRED)
--stable-version VERSION    Fallback version (default: 12.5.0)
--threshold PERCENT         Error rate threshold % (default: 5)
--duration SECONDS          Phase duration in seconds (default: 300)
--no-metrics                Don't collect metrics during deployment
-h, --help                  Show help message
```

#### Phases

**Phase 1: Canary (10% traffic)**
- Monitors for 5 minutes
- Checks error rate < 5%
- Validates latency < 500ms

**Phase 2: Gradual (50% traffic)**
- Monitors for 5 minutes
- Same health checks

**Phase 3: Full Rollout (100% traffic)**
- Completes deployment
- Finalizes metrics

#### Automatic Rollback

If any phase fails:
1. Stops deployment
2. Rolls back to stable version
3. Preserves data volumes
4. Sends notifications

---

### 3. Health Check Script: `health-check-v12.7.0.sh`

**Purpose:** Comprehensive health validation  
**Location:** `scripts/health-check-v12.7.0.sh`

#### Basic Usage

```bash
# Run standard health check
./scripts/health-check-v12.7.0.sh

# Generate detailed report
./scripts/health-check-v12.7.0.sh --detailed

# Send reports via email and Slack
./scripts/health-check-v12.7.0.sh \
  --email ops@example.com \
  --slack https://hooks.slack.com/services/...
```

#### Options

```
--detailed                  Generate detailed report with all metrics
--email ADDRESS             Send report to email address
--slack WEBHOOK_URL         Send report to Slack webhook
--no-html                   Don't generate HTML report
-h, --help                  Show help message
```

#### Health Checks Performed

1. **WebSocket Connectivity** - Port 8765 accessible
2. **Container Health** - Docker health status
3. **Memory Usage** - Within configured limits
4. **CPU Usage** - No excessive spikes
5. **Error Logs** - No critical errors
6. **Performance Baseline** - Latency < 100ms
7. **Disk Usage** - Sufficient free space

#### Output Files

- `logs/health-report-TIMESTAMP.txt` - Text report
- `logs/health-report-TIMESTAMP.html` - HTML dashboard
- Email notification (if configured)
- Slack notification (if configured)

---

### 4. Rollback Script: `rollback-v12.7.0.sh`

**Purpose:** Emergency rollback with data preservation  
**Location:** `scripts/rollback-v12.7.0.sh`

#### Basic Usage

```bash
# Rollback to previous version (with confirmation)
./scripts/rollback-v12.7.0.sh

# Force rollback (emergency)
./scripts/rollback-v12.7.0.sh --force

# Rollback to specific version
./scripts/rollback-v12.7.0.sh --to-version 12.5.0 --force
```

#### Options

```
--to-version VERSION        Rollback to specific version (default: 12.5.0)
--force                     Skip confirmation prompt
--preserve-data             Keep data volumes (default: true)
--no-preserve-data          Remove data volumes during rollback
--skip-verify               Don't verify rollback success
-h, --help                  Show help message
```

#### Rollback Process

1. **Pre-Rollback Validation**
   - Verify rollback image exists
   - Check Docker connectivity

2. **Backup Current State**
   - Export container configuration
   - Save container logs
   - Backup data volumes

3. **Stop Current Container**
   - Gracefully stop via Docker Compose
   - Force stop if needed

4. **Restore Data Volumes**
   - Restore from backup if available
   - Preserves application state

5. **Start Rollback Version**
   - Bring up previous version image
   - Restore container configuration

6. **Verify Rollback**
   - Wait for health check to pass
   - Verify WebSocket connectivity

#### Recovery SLA

- **Total Rollback Time:** < 2 minutes
- **Data Loss:** Zero (data preserved)
- **Service Downtime:** < 30 seconds

---

### 5. Monitoring Script: `monitor-deployment-v12.7.0.sh`

**Purpose:** Real-time deployment monitoring  
**Location:** `scripts/monitor-deployment-v12.7.0.sh`

#### Basic Usage

```bash
# Monitor for 1 hour (default)
./scripts/monitor-deployment-v12.7.0.sh

# Monitor with custom duration
./scripts/monitor-deployment-v12.7.0.sh --duration 7200

# Monitor with email/Slack alerts
./scripts/monitor-deployment-v12.7.0.sh \
  --email ops@example.com \
  --slack https://hooks.slack.com/services/...
```

#### Options

```
--duration SECONDS          Monitor duration (default: 3600)
--interval SECONDS          Sample interval (default: 5)
--memory-threshold PCT      Memory threshold % (default: 85)
--cpu-threshold PCT         CPU threshold % (default: 80)
--email ADDRESS             Send alerts to email
--slack WEBHOOK_URL         Send alerts to Slack
-h, --help                  Show help message
```

#### Metrics Collected

- Memory usage and peak
- CPU usage and peak
- WebSocket latency
- Container health status
- Error count
- Request count

#### Output Files

- `logs/deployment-metrics-TIMESTAMP.csv` - Metrics data
- `logs/deployment-alerts-TIMESTAMP.txt` - Alert log
- `logs/deployment-dashboard.txt` - Live dashboard

---

## Deployment Workflow

### Standard Deployment

```mermaid
[Start] 
  → Validate Version
  → Build/Load Image
  → Backup Current
  → Deploy Container
  → Wait Health
  → Verify Connectivity
  → Run Smoke Tests
  → [Success]
```

### Canary Deployment

```mermaid
[Start]
  → Deploy Canary (10%)
  → Monitor 5min (Phase 1)
  → Deploy 50%
  → Monitor 5min (Phase 2)
  → Deploy 100%
  → Monitor 5min (Phase 3)
  → [Success or Rollback]
```

### Complete Deployment Process

**Step 1: Preparation**
```bash
cd /home/devel/basset-hound-browser

# Review version in package.json
cat package.json | grep version

# Build or prepare artifact
./scripts/deploy-v12.7.0.sh --artifact /path/to/image.tar
```

**Step 2: Deployment**
```bash
# Option A: Direct deployment
./scripts/deploy-v12.7.0.sh --force

# Option B: Canary deployment
./scripts/canary-deploy.sh --version 12.7.0 --duration 300
```

**Step 3: Validation**
```bash
# Run health checks
./scripts/health-check-v12.7.0.sh --detailed --email ops@example.com

# Monitor deployment
./scripts/monitor-deployment-v12.7.0.sh --duration 3600
```

**Step 4: Verification**
```bash
# Check logs
docker logs basset-hound-browser-prod

# Test WebSocket
curl -i http://localhost:8765

# Verify data
docker inspect basset-hound-browser-prod
```

---

## Canary Deployment

### When to Use Canary Deployment

- **Major feature releases** - Test new functionality safely
- **Performance-critical updates** - Validate performance improvements
- **High-risk changes** - Gradual rollout with rollback option
- **Complex deployments** - Multi-phase verification

### Canary Phases

| Phase | Traffic | Duration | Threshold |
|-------|---------|----------|-----------|
| Phase 1 | 10% | 5 min | Error Rate < 5% |
| Phase 2 | 50% | 5 min | Error Rate < 5% |
| Phase 3 | 100% | 5 min | Error Rate < 5% |

### Manual Traffic Split (Advanced)

For load balancer-based canary:

```bash
# Update load balancer to 10% new, 90% old
./scripts/canary-deploy.sh --version 12.7.0 --duration 300

# Monitor metrics
./scripts/monitor-deployment-v12.7.0.sh
```

---

## Health Checks

### Automated Health Checks

The deployment scripts automatically perform:

1. **Container Health Status**
   - Docker health check endpoint
   - Status: healthy/unhealthy/starting

2. **WebSocket Port Connectivity**
   - Port 8765 accessible
   - Connection establishment time < 100ms

3. **Performance Baseline**
   - 10 samples of connection latency
   - Average latency < 100ms

4. **Error Logs**
   - Last 100 lines of container logs
   - Must have < 5 error lines

### Manual Health Checks

```bash
# WebSocket connectivity
curl -i http://localhost:8765

# Container status
docker ps basset-hound-browser-prod

# Health status
docker inspect basset-hound-browser-prod --format='{{.State.Health}}'

# Memory usage
docker stats basset-hound-browser-prod

# Recent logs
docker logs --tail 50 basset-hound-browser-prod
```

### Health Check Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Memory | 85% | Alert |
| CPU | 80% | Alert |
| Latency | 500ms | Rollback |
| Error Rate | 5% | Rollback |
| Container Down | Any | Immediate Rollback |

---

## Rollback Procedures

### Emergency Rollback (< 2 minutes)

```bash
# Immediate rollback to previous version
./scripts/rollback-v12.7.0.sh --force

# Verify rollback
./scripts/health-check-v12.7.0.sh --detailed
```

### Planned Rollback (with data preservation)

```bash
# Rollback to specific version
./scripts/rollback-v12.7.0.sh --to-version 12.5.0

# Restore from backup
docker volume restore basset-prod-data from-backup
```

### Rollback Checklist

- [ ] Verify rollback image exists
- [ ] Confirm data backup created
- [ ] Review rollback logs
- [ ] Verify WebSocket connectivity post-rollback
- [ ] Check error logs
- [ ] Notify stakeholders

---

## Monitoring & Alerts

### Real-Time Monitoring

```bash
# Monitor deployment for 1 hour
./scripts/monitor-deployment-v12.7.0.sh \
  --duration 3600 \
  --interval 5 \
  --email ops@example.com \
  --slack https://hooks.slack.com/...
```

### Metrics Dashboard

Location: `logs/deployment-dashboard.txt`

Updated every 5 seconds with:
- Memory usage
- CPU usage
- Latency
- Health status
- Container uptime

### Alert Configuration

**Email Alerts**
```bash
./scripts/monitor-deployment-v12.7.0.sh \
  --email ops@example.com
```

**Slack Alerts**
```bash
./scripts/monitor-deployment-v12.7.0.sh \
  --slack https://hooks.slack.com/services/T00000/B00000/XXXXXXX
```

### Alert Thresholds

| Metric | Threshold | Severity |
|--------|-----------|----------|
| Memory > 85% | Alert | Warning |
| CPU > 80% | Alert | Warning |
| Latency > 500ms | Alert | Critical |
| Error Rate > 5% | Rollback | Critical |
| Container Down | Rollback | Critical |

---

## Docker Optimization

### Multi-Stage Build

The Dockerfile uses 3 stages for optimization:

**Stage 1: Builder**
- Compiles Node.js dependencies
- Builds native modules
- ~500MB intermediate

**Stage 2: Runtime Base**
- System libraries and Electron dependencies
- Tor daemon
- ~1.5GB

**Stage 3: Production**
- Application code and modules
- Final image size: ~2.2GB

### Image Optimization

```bash
# Build optimized image
docker build -t basset-hound-browser:v12.7.0 \
  -f config/docker/Dockerfile \
  --progress=plain .

# Verify image size
docker image ls basset-hound-browser

# Analyze layers
docker history basset-hound-browser:v12.7.0
```

### .dockerignore Optimization

Files excluded from build context:
- `.git/` - 500MB+
- `node_modules/` - 1GB+ (rebuilt in container)
- `tests/` - 100MB+
- Documentation files
- IDE metadata

Result: **50-70% faster builds**

### Layer Caching

Each RUN instruction creates a cached layer:
1. Base images cached
2. Dependencies cached
3. Code changes only rebuild final layer
4. Incremental deployments **3-5x faster**

---

## Troubleshooting

### Deployment Fails to Start

```bash
# Check logs
docker logs basset-hound-browser-prod

# Verify image exists
docker images basset-hound-browser

# Check Xvfb display
docker exec basset-hound-browser-prod echo $DISPLAY

# Test WebSocket manually
nc -zv localhost 8765
```

### High Memory Usage

```bash
# Check memory limit
docker inspect basset-hound-browser-prod | grep Memory

# Check actual usage
docker stats basset-hound-browser-prod

# Reduce limit if needed (edit docker-compose.production.yml)
```

### WebSocket Connection Timeout

```bash
# Verify port mapping
docker port basset-hound-browser-prod

# Check firewall
sudo iptables -L -n | grep 8765

# Test localhost
curl http://localhost:8765

# Test from remote
curl http://<server-ip>:8765
```

### Rollback Failed

```bash
# Restore from backup manually
docker volume restore basset-prod-data from-backup

# Start previous version
docker run -d --name basset-hound-browser-prod \
  -v basset-prod-data:/app/data \
  basset-hound-browser:12.5.0

# Verify
./scripts/health-check-v12.7.0.sh
```

---

## Best Practices

### Pre-Deployment

1. **Version Bump**
   - Update `package.json` version
   - Create git tag
   - Document changes

2. **Testing**
   - Run full test suite
   - Verify build succeeds
   - Test in staging environment

3. **Backup**
   - Backup database if applicable
   - Export critical configs
   - Save current metrics baseline

### During Deployment

1. **Communication**
   - Notify stakeholders
   - Monitor continuously
   - Have rollback ready

2. **Monitoring**
   - Watch real-time metrics
   - Check error logs
   - Monitor latency

3. **Documentation**
   - Log all actions
   - Record timings
   - Note any issues

### Post-Deployment

1. **Validation**
   - Verify all health checks pass
   - Test critical features
   - Check performance metrics

2. **Cleanup**
   - Remove old images (if space needed)
   - Archive logs
   - Update documentation

3. **Communication**
   - Report deployment success
   - Share metrics/insights
   - Close deployment tickets

---

## Advanced Configurations

### Custom Thresholds

```bash
# Deploy with custom error threshold (10%)
./scripts/canary-deploy.sh --version 12.7.0 --threshold 10

# Monitor with high CPU threshold (90%)
./scripts/monitor-deployment-v12.7.0.sh --cpu-threshold 90
```

### Registry Integration

```bash
# Push to Docker Hub
./scripts/deploy-v12.7.0.sh --registry docker.io/myorg

# Push to private registry
./scripts/deploy-v12.7.0.sh --registry registry.example.com:5000/basset

# Push to AWS ECR
./scripts/deploy-v12.7.0.sh --registry 123456789.dkr.ecr.us-east-1.amazonaws.com
```

### Artifact-Based Deployment

```bash
# Export image as artifact
docker save basset-hound-browser:v12.7.0 > /tmp/basset-v12.7.0.tar

# Deploy from artifact (offline/secure)
./scripts/deploy-v12.7.0.sh --artifact /tmp/basset-v12.7.0.tar --force
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Tests passing (100%)
- [ ] Dockerfile builds successfully
- [ ] .dockerignore optimized
- [ ] Backup strategy verified
- [ ] Stakeholders notified

### During Deployment
- [ ] Monitoring script running
- [ ] Logs being collected
- [ ] Health checks passing
- [ ] WebSocket connectivity verified
- [ ] Performance baseline met
- [ ] No critical errors in logs

### Post-Deployment
- [ ] All health checks green
- [ ] Performance metrics stable
- [ ] Error rate acceptable
- [ ] Deployment logs archived
- [ ] Rollback procedure verified
- [ ] Team notified of success

---

## Support & Troubleshooting

### Log Locations

- **Deployment Log:** `logs/deployment-v12.7.0-*.log`
- **Health Report:** `logs/health-report-*.txt`
- **Metrics Data:** `logs/deployment-metrics-*.csv`
- **Container Logs:** `docker logs basset-hound-browser-prod`

### Quick Commands

```bash
# View latest deployment
tail -100 logs/deployment-*.log

# Generate health report
./scripts/health-check-v12.7.0.sh --detailed

# Emergency rollback
./scripts/rollback-v12.7.0.sh --force

# Monitor in real-time
./scripts/monitor-deployment-v12.7.0.sh
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v12.7.0 | 2026-06-15 | Initial production release |
| v12.5.0 | 2026-05-11 | Previous stable version |

---

**For issues or questions, contact:** ops@example.com  
**Documentation:** `/docs/DEPLOYMENT-AUTOMATION-GUIDE-v12.7.0.md`
