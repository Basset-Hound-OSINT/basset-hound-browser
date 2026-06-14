# Migration Guide: v12.0.0 → v12.1.0

**Document Version:** 1.0  
**Date:** June 13, 2026  
**Release Date:** May 25, 2026  
**Target Audience:** DevOps, Platform Engineers, System Administrators

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Deprecations](#deprecations)
4. [Pre-Migration Checklist](#pre-migration-checklist)
5. [Migration Steps](#migration-steps)
6. [Post-Migration Validation](#post-migration-validation)
7. [Rollback Procedure](#rollback-procedure)
8. [Known Issues & Workarounds](#known-issues--workarounds)
9. [Support & Resources](#support--resources)

---

## Overview

The v12.1.0 release introduces scope clarifications, performance optimizations, and enhanced monitoring capabilities. This release maintains backward compatibility at the API level while introducing new features and internal refactorings.

### Key Changes in v12.1.0

- **Scope Clarification:** Removed out-of-scope intelligence/OSINT tools from MCP server
- **Session Coherence Validation:** 5-layer real-time detection for bot evasion validation
- **Performance Enhancements:** 22-27% throughput improvement, 60-80% memory reduction
- **Enhanced Monitoring:** New monitoring commands for real-time observability
- **Behavioral Scoring:** Coherence-based bot detection and validation
- **Architecture Refactoring:** WebSocket server modularization for maintainability

### Upgrade Path

```
v12.0.0 (Current) → v12.0.1 (optional patch) → v12.1.0 (target)
```

**Estimated Upgrade Time:** 30-60 minutes (including validation)  
**Downtime Required:** 5-15 minutes (rolling deployment possible)  
**Risk Level:** LOW (backward compatible at API level)

---

## Breaking Changes

### 1. MCP Server Command Removal

Several out-of-scope commands have been removed from the MCP server to clarify the project's data capture focus.

**Removed Commands:**
- Intelligence analysis commands
- OSINT-specific tools  
- Advanced reasoning commands
- Multi-step investigation workflows

**Impact:** If your integration uses MCP server for intelligence operations, you'll need to migrate to external AI agents for those tasks.

**Mitigation:**
```javascript
// BEFORE (v12.0.0)
mcp.callTool('analyze_intelligence', { data: targetData });

// AFTER (v12.1.0) - Use external AI agent instead
externalAiAgent.analyze(targetData);
```

**Action Required:** Review your integrations for any MCP intelligence command usage and plan transition to external services.

### 2. WebSocket API Endpoint Paths

The WebSocket API endpoint structure remains unchanged. The internal command dispatcher has been refactored but presents the same interface.

**No API changes required** for WebSocket clients.

### 3. Configuration Parameter Changes

New optional parameters added (backward compatible):
- `enableSessionCoherence` (default: true) - Enable 5-layer validation
- `monitoringLevel` (default: 'production') - Monitoring verbosity
- `performanceProfile` (default: 'balanced') - Tune throughput vs. accuracy

All existing configurations continue to work without modification.

---

## Deprecations

### Deprecated Commands (Still Supported but Will Be Removed in v12.2.0)

1. **`get_evasion_status`** → Use `get_evasion_metrics` instead
   - New command provides more granular metrics
   - Old command will redirect to new one through v12.1.0

2. **`set_proxy_rotation_mode`** → Use `configure_proxy_rotation` instead
   - More flexible configuration options
   - Legacy command supported with compatibility layer

3. **`get_session_fingerprint`** → Use `validate_session_coherence` instead
   - Better name reflects actual functionality
   - Old command available via shim

**Migration Timeline:**
- **v12.1.0:** Deprecated commands still work
- **v12.2.0:** Deprecated commands removed
- **Recommended Action:** Update your code before v12.2.0 release

**Example Migration:**

```javascript
// v12.0.0 - Deprecated in v12.1.0
const status = await client.send({
  command: 'get_evasion_status'
});

// v12.1.0 - Recommended (backward compatible)
const metrics = await client.send({
  command: 'get_evasion_metrics',
  includeDeprecated: false  // Use new metrics only
});
```

---

## Pre-Migration Checklist

Before starting the migration, ensure:

### Preparation Phase (24 hours before)

- [ ] Review this migration guide completely
- [ ] Check current v12.0.0 version: `curl localhost:8765/status`
- [ ] Document current configuration (for rollback):
  ```bash
  docker inspect basset-hound-browser > backup-v12.0.0-config.json
  ```
- [ ] Back up persistent volumes:
  ```bash
  docker cp basset-hound-browser:/app/data ./backup-v12.0.0-data
  docker cp basset-hound-browser:/app/profiles ./backup-v12.0.0-profiles
  ```
- [ ] Review your integration code for deprecated commands
- [ ] Check for any custom MCP server extensions (will need updates)
- [ ] Verify sufficient disk space (minimum 5 GB recommended)

### Compatibility Checks

- [ ] Verify Node.js version: 18.x LTS or higher
- [ ] Check Docker version: 20.10+ required
- [ ] Verify available memory: 2+ GB recommended
- [ ] Check network connectivity to dependency services
- [ ] Confirm all client SDKs are compatible (JS 1.2.0+, Python 1.2.0+)

### Testing Preparation

- [ ] Create staging environment identical to production
- [ ] Prepare test scripts to validate core functionality
- [ ] Have rollback plan documented
- [ ] Assign roles: migration lead, network engineer, database admin (if applicable)

---

## Migration Steps

### Option 1: Blue-Green Deployment (Recommended for Production)

**Best Practice:** Deploy v12.1.0 alongside v12.0.0, validate, then switch traffic.

#### Step 1: Prepare New Environment

```bash
# Pull new image
docker pull basset-hound-browser:v12.1.0

# Create v12.1.0 container
docker run -d \
  --name basset-hound-browser-v12.1 \
  --network basset-hound-browser \
  -p 8765:8765 \
  -v basset-profiles:/app/profiles \
  -v basset-data:/app/data \
  -e NODE_ENV=production \
  basset-hound-browser:v12.1.0
```

#### Step 2: Validate v12.1.0 Deployment

```bash
# Check health
curl http://localhost:8765/status

# Run integration tests
npm test tests/integration/smoke-tests.js

# Verify performance hasn't degraded
npm test tests/performance/baseline.js
```

#### Step 3: Warm-Up Period

Run v12.1.0 alongside v12.0.0 for 30 minutes:
- Monitor error rates
- Check memory usage
- Verify log output

```bash
# Monitor logs
docker logs -f basset-hound-browser-v12.1
```

#### Step 4: Switch Traffic

Once validated, switch your load balancer/reverse proxy to point to v12.1.0:

```bash
# If using load balancer
updateLoadBalancer newEndpoint=basset-hound-browser-v12.1:8765

# Or update client configuration
BROWSER_API_URL=http://basset-hound-browser-v12.1:8765
```

#### Step 5: Monitor New Version

```bash
# Keep v12.0.0 running for 1 hour as fallback
# Monitor error rates, latency, memory
docker stats basset-hound-browser-v12.1

# After 1 hour of stable operation, remove v12.0.0
docker stop basset-hound-browser
docker rm basset-hound-browser
```

### Option 2: Rolling Deployment (Suitable for Development/Staging)

```bash
# Stop v12.0.0
docker stop basset-hound-browser

# Backup data
docker cp basset-hound-browser:/app/data ./backup
docker cp basset-hound-browser:/app/profiles ./backup

# Remove old container
docker rm basset-hound-browser

# Run v12.1.0
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  -v basset-profiles:/app/profiles \
  -v basset-data:/app/data \
  basset-hound-browser:v12.1.0

# Wait for startup (4-5 seconds)
sleep 5

# Validate
curl http://localhost:8765/status
```

### Option 3: Docker Compose Update

```yaml
# docker-compose.yml
version: '3.8'

services:
  basset-hound:
    image: basset-hound-browser:v12.1.0
    ports:
      - "8765:8765"
    volumes:
      - basset-profiles:/app/profiles
      - basset-data:/app/data
    environment:
      NODE_ENV: production
      SESSION_COHERENCE: enabled
    networks:
      - basset-hound-browser
      
networks:
  basset-hound-browser:
    external: true
```

Upgrade:
```bash
docker-compose pull
docker-compose up -d --force-recreate basset-hound
```

---

## Post-Migration Validation

### Immediate Checks (0-5 minutes after startup)

```bash
# 1. Health check
curl http://localhost:8765/status

# 2. Verify WebSocket connectivity
npm test tests/connection/websocket-basic.test.js

# 3. Check basic navigation
npm test tests/integration/navigate.test.js

# 4. Verify screenshot capture
npm test tests/extraction/screenshot.test.js
```

### Functional Tests (5-30 minutes)

```bash
# Run comprehensive integration suite
npm test tests/integration/

# Run performance baseline
npm test tests/performance/baseline.test.js

# Run evasion tests
npm test tests/evasion/
```

### Extended Validation (30-60 minutes)

```bash
# Monitor memory usage - should be 60-80% lower than v12.0.0
docker stats basset-hound-browser

# Run load test
npm test tests/load-testing/

# Check logs for errors
docker logs basset-hound-browser | grep -i error

# Run SDK tests for each language
npm test tests/sdk/
```

### Success Criteria

All of the following must pass:

```
✓ WebSocket server healthy
✓ All health endpoints responding
✓ Navigation tests passing
✓ Screenshot capture working
✓ Evasion validation passing
✓ Memory usage < 1.5 GB
✓ Throughput > 400 msgs/sec
✓ Error rate < 0.1%
✓ No critical log errors
✓ Performance baseline met
```

**If any checks fail:** Proceed to [Rollback Procedure](#rollback-procedure)

---

## Rollback Procedure

If issues arise, rollback to v12.0.0 is straightforward.

### Quick Rollback (< 5 minutes)

```bash
# If still running blue-green:
docker stop basset-hound-browser-v12.1
docker start basset-hound-browser  # v12.0.0 still running

# Update load balancer
updateLoadBalancer endpoint=basset-hound-browser:8765
```

### Full Rollback (with data restore)

```bash
# Stop v12.1.0
docker stop basset-hound-browser-v12.1
docker rm basset-hound-browser-v12.1

# Restore from backup
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  -v basset-profiles:/app/profiles \
  -v basset-data:/app/data \
  basset-hound-browser:v12.0.0

# Restore data if needed
docker cp ./backup-v12.0.0-data/. basset-hound-browser:/app/data/

# Restart services
docker restart basset-hound-browser

# Verify
curl http://localhost:8765/status
```

### Partial Rollback (revert specific features)

If issues are specific to new features:

```javascript
// Disable new features in config
{
  "enableSessionCoherence": false,  // Disable v12.1.0 feature
  "monitoringLevel": "basic",        // Reduce monitoring overhead
  "performanceProfile": "maximum"    // Prioritize performance
}
```

**When to use partial rollback:**
- If only specific features cause issues
- If you want to keep v12.1.0 but disable new capabilities temporarily
- For gradual rollout of new features

---

## Known Issues & Workarounds

### 1. Session Coherence Validation Overhead

**Issue:** Initial session coherence validation adds 100-200ms latency on first evasion check.

**Impact:** Minimal (only first check per session)

**Workaround:**
```javascript
// Cache validation result
const session = await client.send({ 
  command: 'start_session',
  cacheCoheenceValidation: true  // New in v12.1.0
});
```

**Permanent Fix:** Included in v12.1.0 update (automatic caching)

### 2. MCP Server Commands Not Found

**Issue:** If you call removed MCP commands, you get "command not found" error.

**Workaround:** Update your integration code per the Breaking Changes section.

**Expected:** In v12.2.0, removed commands will trigger deprecation warnings.

### 3. Memory Usage Spikes on Load

**Issue:** Under very high load (>500 concurrent), memory may spike temporarily.

**Workaround:** Configure memory thresholds
```javascript
{
  "memoryThresholds": {
    "warning": 1500,  // MB
    "critical": 1800  // MB
  },
  "garbageCollectionMode": "aggressive"  // New in v12.1.0
}
```

### 4. Proxy Rotation Compatibility

**Issue:** Custom proxy rotation scripts from v12.0.0 may need updates.

**Workaround:** Use new `configure_proxy_rotation` command which has better error handling.

**Migration:**
```javascript
// v12.0.0
await client.send({ command: 'set_proxy_rotation_mode', mode: 'round-robin' });

// v12.1.0 (recommended)
await client.send({ 
  command: 'configure_proxy_rotation',
  strategy: 'round-robin',
  failoverBehavior: 'automatic'  // New feature
});
```

---

## Support & Resources

### Documentation

- **v12.1.0 Release Notes:** `/docs/RELEASE-NOTES-v12.1.0.md`
- **Performance Tuning:** `/docs/guides/PERFORMANCE-OPTIMIZATION-QUICK-REFERENCE.md`
- **Session Coherence:** `/docs/guides/SESSION-COHERENCE-VALIDATION-USER-GUIDE.md`
- **API Reference:** `/docs/API-REFERENCE-COMPLETE.md`

### Quick References

- **Configuration Options:** `/docs/deployment/CONFIGURATION-REFERENCE.md`
- **Monitoring Setup:** `/docs/operations/MONITORING-QUICK-START.md`
- **Troubleshooting:** `/docs/guides/TROUBLESHOOTING.md`

### Getting Help

1. **Check Documentation:** Start with guides above
2. **Review Logs:** `docker logs basset-hound-browser`
3. **Run Diagnostics:** `npm run diagnose`
4. **Community Support:** Contact development team
5. **Emergency Rollback:** Use rollback procedure above

### Post-Migration Success Metrics

After successful migration, you should see:

```
Performance Improvements:
- Throughput: +22-27% improvement
- Memory: -60-80% reduction  
- Latency: Maintained or improved
- Error Rate: < 0.1%

Feature Enhancements:
- Session coherence validation: 5-layer detection
- Enhanced monitoring: Real-time metrics
- Better evasion: Improved detection avoidance
```

---

## Version Comparison

| Feature | v12.0.0 | v12.1.0 | Change |
|---------|---------|---------|--------|
| WebSocket API | 164 commands | 164 commands | Same |
| REST API | Complete | Complete | Same |
| Bot Evasion | 4-layer | 5-layer validation | Enhanced |
| Memory Profile | Baseline | -60-80% | Improved |
| Throughput | Baseline | +22-27% | Improved |
| Monitoring | Basic | Advanced | New |
| Session Coherence | No | Yes | New |
| MCP Server | Full | Data capture only | Clarified |

---

## Rollback Readiness Checklist

Before considering your migration complete:

- [ ] v12.1.0 running stably for > 1 hour
- [ ] All validation tests passing
- [ ] Performance metrics meet expectations
- [ ] Error logs are clean
- [ ] Load testing passed
- [ ] Team trained on new features
- [ ] v12.0.0 container archived (kept for emergency use)
- [ ] Documentation updated for your team
- [ ] Monitoring alerts configured
- [ ] Incident response plan updated

Once all items checked, migration is considered **COMPLETE**.

---

## Next Steps

After successful v12.1.0 migration:

1. **Explore New Features:** Enable new monitoring and performance features
2. **Plan v12.2.0:** Review roadmap for next release (planned for August 2026)
3. **Optimize Configuration:** Fine-tune performance profile for your workload
4. **Monitor Growth:** Track metrics to ensure continued optimal performance

---

**Document Status:** ✅ Complete  
**Last Updated:** June 13, 2026  
**Version:** 1.0  
**Maintenance:** Managed by DevOps Team
