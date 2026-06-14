# Migration Guide: v12.1.0 → v12.2.0

**Document Version:** 1.0  
**Date:** June 13, 2026  
**Target Release:** August 15, 2026  
**Target Audience:** DevOps, Platform Engineers, System Administrators

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Deprecations & Removals](#deprecations--removals)
4. [New Features & Capabilities](#new-features--capabilities)
5. [Pre-Migration Checklist](#pre-migration-checklist)
6. [Migration Steps](#migration-steps)
7. [Post-Migration Validation](#post-migration-validation)
8. [Rollback Procedure](#rollback-procedure)
9. [Configuration Updates](#configuration-updates)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The v12.2.0 release focuses on **advanced feature expansion** and **architectural optimization**. This release builds on v12.1.0's performance improvements and introduces enterprise-grade capabilities for large-scale deployments.

### Key Changes in v12.2.0

**New Capabilities:**
- Multi-session parallelization framework
- Advanced behavioral simulation modes (6+ new detection vectors)
- Extended evasion vector coverage
- Performance trend prediction
- Adaptive compression tuning
- Enhanced multi-agent orchestration

**Improvements:**
- +5-10% throughput increase
- Better resource utilization for concurrent operations
- Enhanced monitoring and analytics
- Improved error recovery mechanisms

**Changes:**
- Removal of deprecated v12.0.0 commands
- New configuration schema v2.0
- Enhanced authentication framework
- Updated WebSocket protocol (backward compatible)

### Upgrade Path

```
v12.1.0 (Current) → v12.2.0 (target)
```

**Estimated Upgrade Time:** 45-90 minutes (including full validation)  
**Downtime Required:** 10-20 minutes (rolling deployment possible)  
**Risk Level:** MEDIUM (new features recommended for staging first)  

**Recommendation:** Test in staging environment for 24 hours before production deployment

---

## Breaking Changes

### 1. Removal of Deprecated Commands

Commands deprecated in v12.1.0 are **completely removed** in v12.2.0.

**Removed Commands:**

```javascript
// THESE NO LONGER WORK IN v12.2.0:
- get_evasion_status          → Use: get_evasion_metrics
- set_proxy_rotation_mode     → Use: configure_proxy_rotation
- get_session_fingerprint     → Use: validate_session_coherence
```

**Action Required:** 
- [ ] Audit your codebase for these commands
- [ ] Update to new command names before upgrade
- [ ] Test in staging before production

**Migration Example:**

```javascript
// ❌ WILL FAIL in v12.2.0
const status = await client.send({
  command: 'get_evasion_status'
});

// ✅ USE THIS INSTEAD
const metrics = await client.send({
  command: 'get_evasion_metrics',
  detailed: true
});
```

### 2. Configuration Schema v2.0

Configuration format has evolved to support new features.

**v12.1.0 Configuration (Still Works):**
```json
{
  "enableSessionCoherence": true,
  "monitoringLevel": "production",
  "performanceProfile": "balanced"
}
```

**v12.2.0 Configuration (Recommended):**
```json
{
  "version": "2.0",
  "core": {
    "sessionCoherence": {
      "enabled": true,
      "validationLayers": 5
    }
  },
  "performance": {
    "profile": "balanced",
    "parallelization": {
      "enabled": true,
      "maxSessions": 10,
      "adaptive": true
    },
    "compression": {
      "adaptive": true,
      "algorithm": "brotli"
    }
  },
  "monitoring": {
    "level": "production",
    "trendsEnabled": true,
    "predictionEnabled": true
  }
}
```

**Compatibility:** v12.1.0 configs are auto-migrated to v2.0 schema on first startup.

### 3. Authentication Enhancement

New optional authentication method: OAuth2/OIDC support

**Backward Compatible Changes:**
- Existing token-based auth still works
- New OAuth2 endpoints available (optional)
- No breaking changes to existing auth flows

**New Configuration:**
```json
{
  "authentication": {
    "legacy": {
      "enabled": true,
      "tokenBased": true
    },
    "oauth2": {
      "enabled": false,
      "provider": "okta",
      "clientId": "${OAUTH_CLIENT_ID}"
    }
  }
}
```

---

## Deprecations & Removals

### Commands Removed in v12.2.0

| Command | Removed Version | Replacement | Timeline |
|---------|-----------------|-------------|----------|
| `get_evasion_status` | v12.2.0 | `get_evasion_metrics` | Immediate |
| `set_proxy_rotation_mode` | v12.2.0 | `configure_proxy_rotation` | Immediate |
| `get_session_fingerprint` | v12.2.0 | `validate_session_coherence` | Immediate |

**Note:** Commands deprecated in v12.1.0 are **completely removed** - no compatibility layer

### Features Requiring Updates

#### Multi-Session Management

**Old Pattern (v12.1.0):**
```javascript
// Sequential session handling
const session1 = await client.send({ command: 'start_session' });
const session2 = await client.send({ command: 'start_session' });
// Sessions run one at a time

// Navigate in session1
await client.send({ command: 'navigate', url: 'http://example.com' });
// Session2 blocked while session1 active
```

**New Pattern (v12.2.0):**
```javascript
// Parallel session handling
const sessions = await client.send({
  command: 'create_session_group',
  count: 2,
  parallelization: true
});

// Sessions now run in parallel
const [session1, session2] = sessions;

// Both can operate simultaneously
await Promise.all([
  client.send({ command: 'navigate', sessionId: session1, url: 'http://example.com' }),
  client.send({ command: 'navigate', sessionId: session2, url: 'http://example.org' })
]);
```

**Migration:** Update your session management logic to use new parallel patterns.

---

## New Features & Capabilities

### 1. Multi-Session Parallelization

**What it is:** Run multiple sessions concurrently with independent state

**Usage:**
```javascript
const client = new BassetHoundClient();

// Create parallel session group
const group = await client.send({
  command: 'create_session_group',
  count: 5,
  parallelization: {
    enabled: true,
    resourcePooling: true,
    independentState: true
  }
});

// Use sessions in parallel
const promises = group.sessionIds.map(sessionId =>
  client.send({
    command: 'navigate',
    sessionId,
    url: 'http://example.com'
  })
);

await Promise.all(promises);
```

**Benefits:**
- 5-10% throughput improvement
- Better CPU utilization
- Reduced latency for multi-target operations

### 2. Advanced Behavioral Simulation

**What it is:** 6+ new detection vector evasion techniques

**New Vectors:**
- Sensor evasion (accelerometer, gyroscope)
- Bluetooth simulation
- NFC spoofing
- Hardware acceleration detection
- Canvas rendering behavior
- Network timing analysis

**Usage:**
```javascript
const client = new BassetHoundClient();

await client.send({
  command: 'configure_behavior',
  simulationMode: 'advanced',
  vectors: {
    sensorEvasion: true,
    bluetoothSimulation: true,
    nfcSpoofing: true,
    hardwareAcceleration: 'enabled',
    networkTiming: 'natural'
  }
});
```

### 3. Performance Trend Prediction

**What it is:** Predictive analytics for performance optimization

**Usage:**
```javascript
const trends = await client.send({
  command: 'get_performance_trends',
  window: '24h',
  predictions: {
    enabled: true,
    horizon: '1h'
  }
});

// Response includes predicted throughput, memory usage, etc.
{
  "current": { "throughput": 450 },
  "predicted1h": { "throughput": 475 },
  "recommendations": [
    "Increase resource allocation at 14:00 UTC"
  ]
}
```

### 4. Adaptive Compression Tuning

**What it is:** Automatic compression algorithm selection based on content type

**Previous (v12.1.0):** Fixed compression algorithm  
**New (v12.2.0):** Automatic selection per payload type

```javascript
{
  "compression": {
    "adaptive": true,
    "algorithms": ["brotli", "gzip", "deflate"],
    "tuning": {
      "textContent": "brotli",
      "binary": "gzip",
      "json": "brotli"
    }
  }
}
```

**Expected Benefit:** Additional 3-5% bandwidth reduction

### 5. Enhanced Multi-Agent Orchestration

**What it is:** Better integration with external AI agents and palletai

**New Commands:**
- `register_external_handler` - Register custom message handlers
- `query_agent_status` - Query external agent health
- `prioritize_agent_work` - Set task priority for agents

```javascript
await client.send({
  command: 'register_external_handler',
  agentId: 'palletai-agent-1',
  eventTypes: ['screenshot_captured', 'navigation_complete'],
  handler: 'http://external-service:3000/webhook'
});
```

---

## Pre-Migration Checklist

### 72 Hours Before Migration

**Planning:**
- [ ] Review this migration guide completely
- [ ] Schedule maintenance window (off-peak hours)
- [ ] Notify stakeholders of planned downtime
- [ ] Assign team members (lead, backup, communications)
- [ ] Plan communication schedule

**Preparation:**
- [ ] Create staging environment (copy of production)
- [ ] Audit codebase for removed commands (grep for deprecated commands)
- [ ] Update configuration to v2.0 schema (optional but recommended)
- [ ] Review v12.2.0 release notes in detail
- [ ] Test all integrations in staging

### 24 Hours Before Migration

**Backup & Safety:**
- [ ] Full production backup:
  ```bash
  docker cp basset-hound-browser:/app/data ./backup-v12.1.0-data
  docker cp basset-hound-browser:/app/profiles ./backup-v12.1.0-profiles
  docker exec basset-hound-browser npm run backup
  ```
- [ ] Document current configuration
- [ ] Capture current metrics baseline
- [ ] Test rollback procedure in staging

**Testing:**
- [ ] Complete v12.2.0 staging validation
- [ ] Run performance benchmarks in staging
- [ ] Verify all integrations work
- [ ] Confirm rollback procedure

### 1 Hour Before Migration

**Final Checks:**
- [ ] All team members ready
- [ ] Backup verified
- [ ] Rollback plan confirmed
- [ ] Monitoring alerts configured
- [ ] Communication channels open

---

## Migration Steps

### Phase 1: Pre-Migration (15 minutes)

**1.1 Notify Stakeholders**
```
Migration to v12.2.0 starting in 10 minutes
Expected downtime: 10-15 minutes
Current time: 14:30 UTC, Expected completion: 14:50 UTC
```

**1.2 Drain Connections**
```bash
# Stop accepting new connections
docker exec basset-hound-browser npm run graceful-shutdown --timeout=300

# Wait for existing connections to close
sleep 5

# Verify all connections closed
curl http://localhost:8765/connection-status
```

**1.3 Create Final Backup**
```bash
docker cp basset-hound-browser:/app ./final-backup-v12.1.0-$(date +%s)
```

### Phase 2: Deploy v12.2.0 (20 minutes)

**Option A: Blue-Green Deployment (Recommended)**

```bash
# 2.1 Pull new image
docker pull basset-hound-browser:v12.2.0

# 2.2 Start v12.2.0 in parallel
docker run -d \
  --name basset-hound-browser-v12.2 \
  --network basset-hound-browser \
  -p 8766:8765 \
  -v basset-profiles:/app/profiles \
  -v basset-data:/app/data \
  -e NODE_ENV=production \
  -e VERSION_CHECK=enabled \
  basset-hound-browser:v12.2.0

# 2.3 Wait for startup
sleep 5

# 2.4 Run health check
curl http://localhost:8766/status
```

**Option B: In-Place Upgrade**

```bash
# 2.1 Stop v12.1.0
docker stop basset-hound-browser

# 2.2 Rename container for safety
docker rename basset-hound-browser basset-hound-browser-v12.1-backup

# 2.3 Start v12.2.0
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  -v basset-profiles:/app/profiles \
  -v basset-data:/app/data \
  basset-hound-browser:v12.2.0

# 2.4 Wait for migration
sleep 10
```

**2.3 Database Schema Migration (if applicable)**

```bash
# Automatic migration runs on first startup
docker logs basset-hound-browser | grep -i "migration"

# Manual migration (if needed)
docker exec basset-hound-browser npm run migrate --version=2.0
```

### Phase 3: Validation (20 minutes)

**3.1 Health Check**
```bash
curl http://localhost:8765/status
# Should return: { "status": "healthy", "version": "12.2.0" }
```

**3.2 Connection Test**
```bash
npm test tests/integration/connection.test.js
```

**3.3 Core Functionality**
```bash
npm test tests/integration/smoke-tests.js
```

**3.4 New Features**
```bash
npm test tests/features/multi-session-parallelization.test.js
npm test tests/features/behavioral-simulation.test.js
```

**3.5 Performance Validation**
```bash
npm test tests/performance/baseline.test.js
# Expected: 5-10% improvement over v12.1.0
```

### Phase 4: Switch Traffic (5 minutes)

**If using blue-green:**
```bash
# Update load balancer/reverse proxy
updateLoadBalancer targetPort=8766

# Or update DNS
updateDNS basset-hound.example.com -> new-blue-instance
```

**If in-place:**
```bash
# Verify v12.2.0 running on correct port
curl http://localhost:8765/status | grep version
```

### Phase 5: Cleanup (5 minutes)

**5.1 Remove old container (after 1 hour of stable operation)**
```bash
# Monitor for 1 hour first
sleep 3600

# Then remove old container
docker stop basset-hound-browser-v12.1-backup
docker rm basset-hound-browser-v12.1-backup
```

**5.2 Update backups**
```bash
# Archive old backup
tar czf backup-v12.1.0-$(date +%Y%m%d).tar.gz ./backup-v12.1.0-*
rm -rf ./backup-v12.1.0-*

# Keep new backup fresh
cp -r /var/lib/docker/volumes/basset-data ./backup-v12.2.0-$(date +%Y%m%d)
```

---

## Post-Migration Validation

### Immediate Validation (0-5 minutes)

```bash
# 1. Check service status
curl http://localhost:8765/status

# 2. Verify version
curl http://localhost:8765/status | jq '.version'
# Should output: "12.2.0"

# 3. Check logs for errors
docker logs basset-hound-browser | tail -50 | grep -i error

# 4. Basic connectivity
npm test tests/integration/ping.test.js
```

### Functional Validation (5-30 minutes)

```bash
# 1. Navigation test
npm test tests/integration/navigate.test.js

# 2. Screenshot test
npm test tests/extraction/screenshot.test.js

# 3. Multi-session test
npm test tests/features/multi-session-parallelization.test.js

# 4. Evasion test
npm test tests/evasion/
```

### Performance Validation (30-60 minutes)

```bash
# 1. Baseline performance
npm test tests/performance/baseline.test.js

# 2. Compare with v12.1.0
npm test tests/performance/comparison.test.js
# Expected improvement: 5-10%

# 3. Memory usage (should not increase)
docker stats basset-hound-browser

# 4. Load testing
npm test tests/load-testing/standard.test.js
```

### Extended Validation (1-4 hours)

```bash
# 1. Run full regression suite
npm test tests/regression/

# 2. Monitor production metrics
# Track:
# - Error rate (should be < 0.1%)
# - P99 latency (should be improved or maintained)
# - Throughput (should be 5-10% better)
# - Memory (should be stable)

# 3. Run integration tests with all SDKs
npm test tests/sdk/

# 4. Verify external integrations
npm test tests/integration/external-agents.test.js
```

### Success Criteria

Migration is successful when **ALL** criteria met:

```
✓ Service running v12.2.0
✓ Health check passing
✓ All integration tests passing
✓ Performance improved 5-10%
✓ No error spikes in logs
✓ Memory usage stable
✓ External integrations working
✓ Load testing passed
✓ Stable for > 2 hours
```

**If any criteria fails:** See Rollback Procedure

---

## Rollback Procedure

### Quick Rollback (< 5 minutes)

```bash
# 1. Stop v12.2.0
docker stop basset-hound-browser

# 2. Restart v12.1.0
docker start basset-hound-browser-v12.1-backup

# 3. Verify
curl http://localhost:8765/status
```

### Full Rollback (with data restore)

```bash
# 1. Stop v12.2.0
docker stop basset-hound-browser
docker rm basset-hound-browser

# 2. Restore data
docker cp ./backup-v12.1.0-data/. basset-hound-browser-v12.1-backup:/app/data/
docker cp ./backup-v12.1.0-profiles/. basset-hound-browser-v12.1-backup:/app/profiles/

# 3. Start old version
docker start basset-hound-browser-v12.1-backup

# 4. Verify
curl http://localhost:8765/status
```

### When to Rollback

Rollback if you observe:
- Service health check failures (> 5 minutes)
- Error rate spike (> 1% of requests)
- Memory leak (> 500MB growth in 10 minutes)
- Critical features broken
- External integration failures

### Rollback Limits

```
Most recent automatic backup: 1 hour old
Manual backup available: 24 hours
Full point-in-time restore: 7 days (if snapshots available)
```

---

## Configuration Updates

### Auto-Migration

Configuration files are automatically migrated on first startup:

```json
// v12.1.0 config (still works)
{
  "enableSessionCoherence": true
}

// Automatically becomes v2.0 config:
{
  "version": "2.0",
  "core": {
    "sessionCoherence": {
      "enabled": true,
      "validationLayers": 5
    }
  }
}
```

### Manual Configuration Update (Recommended)

Create new config file:

```json
{
  "version": "2.0",
  "core": {
    "sessionCoherence": {
      "enabled": true,
      "validationLayers": 5,
      "caching": true
    }
  },
  "performance": {
    "profile": "balanced",
    "parallelization": {
      "enabled": true,
      "maxSessions": 10,
      "adaptive": true,
      "resourcePooling": true
    },
    "compression": {
      "adaptive": true,
      "algorithms": ["brotli", "gzip"],
      "tuning": {
        "textContent": "brotli",
        "binary": "gzip"
      }
    },
    "trendPrediction": {
      "enabled": true,
      "lookbackWindow": "24h",
      "forecastHorizon": "1h"
    }
  },
  "monitoring": {
    "level": "production",
    "trendsEnabled": true,
    "predictionEnabled": true,
    "metricsRetention": "7d"
  },
  "authentication": {
    "legacy": {
      "enabled": true
    },
    "oauth2": {
      "enabled": false
    }
  }
}
```

### Validation

Verify config after update:

```bash
docker exec basset-hound-browser npm run validate-config
# Should output: ✓ Configuration valid (schema v2.0)
```

---

## Troubleshooting

### Issue: Service won't start

**Symptoms:** Container exits with error

**Solution:**
```bash
# 1. Check logs
docker logs basset-hound-browser

# 2. Verify volume permissions
ls -la /var/lib/docker/volumes/basset-data/_data/

# 3. Check disk space
df -h /var/lib/docker/

# 4. Rollback if needed
# Use Quick Rollback procedure above
```

### Issue: Deprecated command errors

**Symptoms:** Requests fail with "command not found"

**Solution:**
```bash
# 1. Find deprecated commands
grep -r "get_evasion_status\|set_proxy_rotation_mode\|get_session_fingerprint" .

# 2. Update to new commands
# get_evasion_status → get_evasion_metrics
# set_proxy_rotation_mode → configure_proxy_rotation
# get_session_fingerprint → validate_session_coherence

# 3. Test updated code
npm test tests/integration/
```

### Issue: Configuration not recognized

**Symptoms:** Old config settings ignored

**Solution:**
```bash
# 1. Validate config
docker exec basset-hound-browser npm run validate-config

# 2. Check for v2.0 schema
cat config.json | grep '"version"'
# Should show "2.0"

# 3. Migrate config manually
docker exec basset-hound-browser npm run migrate-config --from=1.0 --to=2.0
```

### Issue: Performance degradation

**Symptoms:** Throughput < v12.1.0, increased latency

**Solution:**
```bash
# 1. Check resource availability
docker stats basset-hound-browser

# 2. Disable new features if needed
{
  "parallelization": { "enabled": false },
  "compression": { "adaptive": false }
}

# 3. Review performance recommendations
npm run diagnose --detailed
```

---

## Next Steps After Migration

### Day 1 - Monitor & Validate
- Continuous monitoring of error rates
- Performance metric tracking
- External integration validation
- Team notification that migration complete

### Day 2-3 - Optimize
- Tune parallelization settings based on workload
- Enable adaptive compression if beneficial
- Configure trend prediction thresholds
- Update runbooks with v12.2.0 procedures

### Week 1 - Document & Train
- Update team documentation
- Conduct team training on new features
- Update incident response procedures
- Update monitoring dashboards

### Plan for v12.3.0
- Monitor community feedback on new features
- Plan additional improvements
- Monitor for any long-term issues

---

## Comparison: v12.1.0 vs v12.2.0

| Feature | v12.1.0 | v12.2.0 | Improvement |
|---------|---------|---------|-------------|
| Throughput | 481 msgs/sec | 510 msgs/sec | +6% |
| Multi-session | Sequential | Parallel | 5-10x faster |
| Evasion Vectors | 4-layer | 6+ vectors | Enhanced |
| Compression | Fixed algorithm | Adaptive | +3-5% |
| Monitoring | Basic | Advanced with trends | Real-time prediction |
| Configuration | v1.0 schema | v2.0 schema | More flexible |
| Memory | Baseline | Stable | No growth |

---

## Support & Documentation

**Key Resources:**
- Release Notes: `/docs/RELEASE-NOTES-v12.2.0.md`
- Configuration: `/docs/deployment/CONFIGURATION-REFERENCE-v2.0.md`
- Features: `/docs/V12.2.0-FEATURE-GUIDE.md`
- Troubleshooting: `/docs/guides/TROUBLESHOOTING-v12.2.0.md`

**Emergency Contacts:**
- On-call engineer: DevOps team
- Escalation: Platform team lead
- Emergency hotline: See runbook

---

**Document Status:** ✅ Complete  
**Last Updated:** June 13, 2026  
**Version:** 1.0  
**Maintenance:** DevOps Team
