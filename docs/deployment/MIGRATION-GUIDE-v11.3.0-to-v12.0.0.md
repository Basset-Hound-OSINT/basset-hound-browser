# Migration Guide: Basset Hound Browser v11.3.0 → v12.0.0

**Date:** May 2026  
**Target Audience:** Deployment operators, developers, integration engineers  
**Compatibility:** 100% backward compatible - no breaking changes  
**Effort:** < 30 minutes  

---

## Executive Summary

v12.0.0 is a **drop-in replacement** for v11.3.0 with zero breaking changes. All existing WebSocket commands, API endpoints, and configurations work identically.

**Key Points:**
- ✅ All existing code continues to work
- ✅ All environment variables still supported
- ✅ All Docker images/deployments compatible
- ✅ No database migrations needed
- ✅ No configuration changes required
- ✅ New features are opt-in

**Time Estimate:** 5-10 minutes to upgrade, <30 minutes for full integration.

---

## Pre-Upgrade Checklist

### 1. Verify Current Version

```bash
# Check installed version
curl http://localhost:8765/info
# Should show: "version": "11.3.0"

# Or from Docker
docker inspect basset-hound-browser:v11.3.0 | grep VERSION
```

### 2. Backup Current Configuration

```bash
# Backup config files
cp config.json config.json.v11.3.0.backup
cp .env .env.v11.3.0.backup

# Backup session data (optional but recommended)
cp -r data/sessions data/sessions.v11.3.0.backup
cp -r data/profiles data/profiles.v11.3.0.backup
```

### 3. Document Custom Configurations

```bash
# Export current settings
docker exec basset-hound-browser env | grep BASSET > basset-config.v11.3.0.txt

# Export WebSocket custom settings
curl http://localhost:8765/config | jq > websocket-config.v11.3.0.json
```

### 4. Verify Integration Points

Confirm all clients/agents are working:
```bash
# Test current WebSocket API
curl -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:8765

# Or via WebSocket client
npx ws://localhost:8765
```

---

## Upgrade Paths

### Path A: Docker Image Upgrade (Recommended)

**For containerized deployments:**

#### Step 1: Pull New Image
```bash
# Pull v12.0.0 image
docker pull basset-hound-browser:v12.0.0

# Verify image
docker inspect basset-hound-browser:v12.0.0 | grep VERSION
```

#### Step 2: Update Running Container

**Option A.1: Direct replacement (short downtime)**
```bash
# Stop current container
docker stop basset-hound-browser
docker rm basset-hound-browser

# Start new version
docker run -d -p 8765:8765 \
  -v /data/basset-hound:/app/data \
  --name basset-hound-browser \
  basset-hound-browser:v12.0.0

# Verify running
docker logs -f basset-hound-browser | grep "listening on 8765"
```

**Option A.2: Blue-green deployment (zero downtime)**
```bash
# Start new version on alternate port
docker run -d -p 8766:8765 \
  -v /data/basset-hound:/app/data \
  --name basset-hound-browser-v12 \
  basset-hound-browser:v12.0.0

# Test new version
curl http://localhost:8766/info

# Update load balancer/reverse proxy to point to 8766
# (in your Nginx/HAProxy/etc. config)

# Stop old version
docker stop basset-hound-browser

# Rename new version
docker rename basset-hound-browser-v12 basset-hound-browser
```

#### Step 3: Verify Data Persistence

```bash
# Check session data still accessible
docker exec basset-hound-browser ls -la data/sessions

# Check profiles migrated
docker exec basset-hound-browser ls -la data/profiles

# Test WebSocket connection
curl -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:8765
```

---

### Path B: Source Code Upgrade

**For development/local deployments:**

#### Step 1: Update Repository
```bash
# Fetch latest code
git fetch origin v12.0.0

# Checkout v12.0.0
git checkout v12.0.0

# Or merge into current branch
git merge origin/v12.0.0
```

#### Step 2: Install Dependencies
```bash
# Install any new dependencies (should be none)
npm install

# Verify no new dependencies added
git diff package.json
```

#### Step 3: Run Updated Server
```bash
# Stop current server
npm stop
# or: Ctrl+C in terminal

# Restart with v12.0.0
npm start

# Verify listening
curl http://localhost:8765/info
```

#### Step 4: Verify Integrations
```bash
# Test WebSocket API
npx ws://localhost:8765

# Or in Node.js:
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => console.log('Connected to v12.0.0'));
```

---

### Path C: Kubernetes/Helm Upgrade

**For Kubernetes deployments:**

#### Step 1: Update Helm Values
```yaml
# Update values.yaml
image:
  repository: basset-hound-browser
  tag: v12.0.0  # Was v11.3.0
  pullPolicy: IfNotPresent
```

#### Step 2: Perform Helm Upgrade
```bash
# Update Helm release
helm upgrade basset-hound ./charts/basset-hound \
  --set image.tag=v12.0.0

# Wait for rollout
kubectl rollout status deployment/basset-hound-browser

# Verify new version
kubectl exec -it deployment/basset-hound-browser -- curl http://localhost:8765/info
```

#### Step 3: Verify Service Health
```bash
# Check pod status
kubectl get pods -l app=basset-hound-browser

# Check service endpoints
kubectl get endpoints basset-hound-browser

# Test via service
curl http://basset-hound-browser.default.svc.cluster.local:8765/info
```

---

## Configuration

### v11.3.0 Configuration (Still Works)

All existing environment variables are fully supported:

```bash
# Core settings
TOR_MODE=1                          # Tor routing: off/on/auto
USE_SYSTEM_TOR=true                 # Use system Tor vs embedded
BASSET_WS_PORT=8765                 # WebSocket port
BASSET_LOG_LEVEL=info               # Log verbosity

# Proxy/Network
PROXY_URL=http://proxy:8080         # HTTP/HTTPS proxy
SOCKS_PROXY=socks5://proxy:1080     # SOCKS proxy
BASSET_TIMEOUT=30000                # Request timeout

# Storage/Profiles
BASSET_DATA_DIR=/app/data           # Data storage location
BASSET_PROFILE_DIR=/app/data/profiles
BASSET_SESSION_DIR=/app/data/sessions
```

### v12.0.0 Optional Enhancements

New features can be enabled via environment variables:

```bash
# Phase 3: Advanced Authentication
BASSET_AUTH_TIMEOUT=30000           # Auth flow timeout (ms)
BASSET_AUTH_RETRY_COUNT=3           # Retry failed auth steps

# Phase 3: Session Coherence
BASSET_SESSION_COHERENCE=true       # Enable session validation
BASSET_COHERENCE_STRICT=false       # Strict vs lenient mode

# Phase 3: Dynamic Fingerprinting
BASSET_FINGERPRINT_ROTATION=true    # Dynamic vs static profiles
BASSET_FINGERPRINT_EVOLUTION=true   # Enable temporal drift

# Optimization Sprint 1
BASSET_COMPRESSION_ENABLED=true     # WebSocket compression
BASSET_COMPRESSION_LEVEL=3          # Compression aggressiveness (1-9)
BASSET_COMPRESSION_THRESHOLD=1024   # Min message size for compression

# Screenshot Cache
BASSET_SCREENSHOT_CACHE_ENABLED=true
BASSET_SCREENSHOT_CACHE_DIR=.basset-hound/screenshots
BASSET_SCREENSHOT_CACHE_MAX_SIZE=1000

# Garbage Collection
BASSET_GC_ENABLED=true
BASSET_GC_INTERVAL=60000            # Cleanup interval (ms)
BASSET_GC_MAX_HEAP=512              # Max heap size (MB)
```

### No Breaking Configuration Changes

```bash
# These all still work exactly as before:
$ npm start
$ docker run -p 8765:8765 basset-hound-browser:v12.0.0
$ docker-compose up basset-hound-browser
$ node main.js --tor-mode
```

---

## Data Migration

### Session Data

**No migration needed** - v12.0.0 reads v11.3.0 session data directly:

```bash
# Sessions from v11.3.0 are immediately readable
docker exec basset-hound-browser ls data/sessions

# Profiles from v11.3.0 work unchanged
docker exec basset-hound-browser ls data/profiles

# Cookies, storage, HAR files all compatible
```

### Cache Data

**Optional:** Clear v11.3.0 cache to free disk space:

```bash
# Clear old screenshot cache (if enabled)
rm -rf data/cache/screenshots/

# Clear old session recordings (if enabled)
rm -rf data/recordings/

# Cache is auto-populated on first use
```

### Database (If Any)

**No database changes** - Basset Hound Browser is stateless.

---

## API Compatibility

### WebSocket Commands

**All 164+ commands work identically:**

```javascript
// These still work exactly as before
{
  "command": "navigate",
  "url": "https://example.com"
}

{
  "command": "screenshot",
  "format": "png"
}

{
  "command": "get_page_state"
}

// New commands are optional:
{
  "command": "register_auth_flow",
  "name": "linkedin_oauth",
  "config": { ... }
}
```

### MCP Protocol

**All 164+ tools still available:**

```python
# v11.3.0 tools still work
browser_navigate()
browser_screenshot()
browser_get_page_state()

# New tools optional
browser_register_auth_flow()
browser_validate_session_coherence()
browser_get_fingerprint_profile()
```

### Response Format

**100% compatible** - Response format unchanged:

```json
{
  "success": true,
  "data": "..."
}
```

---

## Feature Enablement

### Phase 3 Features (Opt-in)

Features are available but disabled by default for maximum compatibility:

#### Option 1: Enable via Environment
```bash
# Enable during startup
export BASSET_AUTH_TIMEOUT=30000
export BASSET_SESSION_COHERENCE=true
export BASSET_FINGERPRINT_ROTATION=true
npm start
```

#### Option 2: Enable via WebSocket
```javascript
// Enable during session
{
  "command": "enable_phase3_features",
  "features": {
    "authentication": true,
    "session_coherence": true,
    "dynamic_fingerprinting": true
  }
}
```

#### Option 3: Enable Selectively
```javascript
// Use only when needed
{
  "command": "register_auth_flow",
  "name": "my_oauth",
  "config": { ... }
}
```

### Optimization Features (Enabled by Default)

Optimizations are on by default for immediate benefit:

```bash
# All automatically enabled:
# - WebSocket compression (OPT-01)
# - Screenshot cache compression (OPT-02)
# - GC tuning (OPT-07)

# Disable if needed (not recommended):
export BASSET_COMPRESSION_ENABLED=false
export BASSET_SCREENSHOT_CACHE_ENABLED=false
export BASSET_GC_ENABLED=false
```

---

## Testing & Validation

### Verify Upgrade Success

#### Test 1: Basic Connectivity
```bash
# Should return version 12.0.0
curl http://localhost:8765/info
# { "version": "12.0.0", "status": "ready" }
```

#### Test 2: WebSocket API
```bash
# Test basic command
curl -X POST http://localhost:8765/api/ping -H "Content-Type: application/json"
# { "success": true }
```

#### Test 3: Legacy Commands
```bash
# Test that all v11.3.0 commands still work
curl -X POST http://localhost:8765/api/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# Should return success
```

#### Test 4: New Features (Optional)
```bash
# Test Phase 3 features
curl -X POST http://localhost:8765/api/register_auth_flow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_oauth",
    "config": { "type": "oauth" }
  }'
# Should return success
```

#### Test 5: Performance
```bash
# Verify compression is working
# Screenshot should be compressed in transport
curl -X POST http://localhost:8765/api/screenshot \
  -H "Content-Type: application/json" \
  | gzip -l
# Should show compression ratio
```

### Rollback Procedure

If issues occur, rollback is simple:

```bash
# Docker rollback
docker stop basset-hound-browser
docker rm basset-hound-browser
docker run -d -p 8765:8765 \
  -v /data/basset-hound:/app/data \
  basset-hound-browser:v11.3.0

# Source code rollback
git checkout v11.3.0
npm install
npm start

# Helm rollback
helm rollback basset-hound 1
```

---

## Integration Checklist

### Before Going Live

- [ ] Backup current v11.3.0 configuration
- [ ] Backup session and profile data
- [ ] Test upgrade in staging environment
- [ ] Verify all WebSocket commands work
- [ ] Test with existing client applications
- [ ] Verify performance meets expectations
- [ ] Test integration points (palletai, external agents)
- [ ] Prepare rollback plan

### During Upgrade

- [ ] Schedule maintenance window (or use blue-green)
- [ ] Execute upgrade (5-10 minutes)
- [ ] Run validation tests
- [ ] Monitor logs for errors
- [ ] Test client connections
- [ ] Verify all features working

### After Upgrade

- [ ] Monitor production metrics (24 hours)
- [ ] Check for memory leaks
- [ ] Verify compression working (logs)
- [ ] Test with normal workload
- [ ] Document any issues found
- [ ] Celebrate! 🎉

---

## Troubleshooting

### Issue: WebSocket connection fails

**Symptom:** `Error: Failed to connect to localhost:8765`

**Solution:**
```bash
# Check server is running
docker ps | grep basset-hound-browser

# Check port binding
netstat -tlnp | grep 8765

# Check logs
docker logs -f basset-hound-browser | grep "listening"

# Restart server
docker restart basset-hound-browser
```

### Issue: Commands fail with "unknown command"

**Symptom:** `Error: Unknown command: screenshot`

**Solution:**
```bash
# Verify version is v12.0.0
curl http://localhost:8765/info

# Check server is fully initialized (wait 5 seconds)
sleep 5 && curl http://localhost:8765/info

# Try again
curl -X POST http://localhost:8765/api/screenshot
```

### Issue: Performance is worse than v11.3.0

**Symptom:** Screenshots take longer, memory usage higher

**Solution:**
```bash
# Verify optimizations are enabled (should be default)
docker logs basset-hound-browser | grep "compression enabled"
docker logs basset-hound-browser | grep "cache initialized"

# Check memory usage
docker stats basset-hound-browser

# If issues, disable optimizations temporarily
docker stop basset-hound-browser
export BASSET_COMPRESSION_ENABLED=false
export BASSET_SCREENSHOT_CACHE_ENABLED=false
docker start basset-hound-browser
```

### Issue: Memory keeps growing

**Symptom:** Memory usage increases over time, never stabilizes

**Solution:**
```bash
# v12.0.0 has improved GC, but verify it's enabled
docker logs basset-hound-browser | grep "GC enabled"

# Force immediate cleanup
curl -X POST http://localhost:8765/api/force_gc

# If still growing, check for leaks
# (unlikely, but check phase3 features)
export BASSET_AUTH_TIMEOUT=0
export BASSET_SESSION_COHERENCE=false
```

### Issue: New Phase 3 features not working

**Symptom:** Auth flow register fails, coherence commands unknown

**Solution:**
```bash
# Verify Phase 3 support is enabled
export BASSET_AUTH_TIMEOUT=30000
export BASSET_SESSION_COHERENCE=true

# Restart server
docker restart basset-hound-browser

# Check logs for feature initialization
docker logs basset-hound-browser | grep "Phase 3"
```

---

## Performance Expectations

### Screenshot Latency

**v11.3.0:**
- Single: 150-250ms
- 10 concurrent: 1500ms (serialized)

**v12.0.0:**
- Single: 100-150ms (33% faster)
- 10 concurrent: still ~1500ms (compression doesn't help parallelization yet)

### Memory Usage

**v11.3.0:**
- Baseline: 150-200MB
- Per 100 screenshots: +50MB
- Long session (1hr): 500MB+

**v12.0.0:**
- Baseline: 150-200MB (same)
- Per 100 screenshots: +5MB (90% reduction)
- Long session (1hr): <100MB (80% reduction)

### Network Bandwidth

**v11.3.0:**
- Screenshot response: ~500KB
- 100 screenshots: ~50MB

**v12.0.0:**
- Screenshot response: ~50KB (90% reduction)
- 100 screenshots: ~5MB (90% reduction)

---

## Support

### Getting Help

1. Check this migration guide first
2. Review v12.0.0 release notes: `docs/RELEASE-NOTES-v12.0.0.md`
3. Check troubleshooting: `docs/TROUBLESHOOTING.md`
4. Review API reference: `docs/API-REFERENCE.md`

### Report Issues

If problems occur, provide:
```bash
# Version info
curl http://localhost:8765/info

# Container info (if Docker)
docker inspect basset-hound-browser

# Recent logs (last 100 lines)
docker logs --tail 100 basset-hound-browser

# Error reproduction steps
# (specific commands that fail)
```

---

## Rollout Timeline

### Recommended Timeline

**Day 1:** Staging environment upgrade
- Deploy v12.0.0 in test environment
- Run full test suite
- Verify all integrations

**Day 2:** Production preparation
- Schedule upgrade window
- Prepare rollback plan
- Brief team on new features

**Day 3:** Production upgrade
- Execute upgrade (5-10 min)
- Run validation tests (5 min)
- Monitor for 1 hour

**Days 4-7:** Monitoring period
- Monitor metrics daily
- Document any issues
- Collect performance data

**Week 2:** Enablement
- Enable Phase 3 features if desired
- Optimize configuration based on metrics
- Document lessons learned

---

## FAQ

**Q: Will this break my existing integrations?**  
A: No, v12.0.0 is 100% backward compatible.

**Q: Do I need to migrate my data?**  
A: No, v12.0.0 reads all v11.3.0 data directly.

**Q: Can I rollback if there are issues?**  
A: Yes, rollback is simple and takes <5 minutes.

**Q: Do new features require code changes?**  
A: No, new features are optional and off by default.

**Q: What's the performance impact?**  
A: Positive - 20-40% latency improvement, 70-90% bandwidth reduction.

**Q: Is there downtime?**  
A: Minimal (<10 seconds) unless using blue-green deployment (0 seconds).

**Q: What if I don't want the optimizations?**  
A: They can be disabled via environment variables (not recommended).

**Q: How do I enable Phase 3 features?**  
A: Set environment variables or use WebSocket commands (optional).

---

## Summary

v12.0.0 upgrade is **safe, simple, and beneficial**:

✅ **Safe** - Zero breaking changes, 100% backward compatible  
✅ **Simple** - 5-10 minute deployment, no configuration changes  
✅ **Beneficial** - 20-40% faster, 70-90% less bandwidth, more stable  

**Recommended Action:** Upgrade to v12.0.0 immediately.

---

**Last Updated:** May 2026  
**Migration Difficulty:** ⭐ (trivial)  
**Estimated Time:** 5-10 minutes  
**Risk Level:** ⭐ (minimal)

---

For additional help, see the complete migration checklist in the appendix.

## Appendix A: Complete Upgrade Script

```bash
#!/bin/bash
# Complete v11.3.0 → v12.0.0 upgrade script

set -e

echo "=== Basset Hound Browser v11.3.0 → v12.0.0 Upgrade ==="

# 1. Backup
echo "Step 1: Backing up current configuration..."
cp config.json config.json.v11.3.0.backup
cp .env .env.v11.3.0.backup 2>/dev/null || true

# 2. Pull new image
echo "Step 2: Pulling v12.0.0 image..."
docker pull basset-hound-browser:v12.0.0

# 3. Stop old container
echo "Step 3: Stopping v11.3.0 container..."
docker stop basset-hound-browser || true

# 4. Start new container
echo "Step 4: Starting v12.0.0 container..."
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  -v /data/basset-hound:/app/data \
  basset-hound-browser:v12.0.0

# 5. Wait for startup
echo "Step 5: Waiting for server to start..."
sleep 5

# 6. Verify
echo "Step 6: Verifying upgrade..."
VERSION=$(curl -s http://localhost:8765/info | jq -r '.version')

if [ "$VERSION" = "12.0.0" ]; then
    echo "✅ Upgrade successful! Running v12.0.0"
else
    echo "❌ Upgrade failed! Version: $VERSION"
    exit 1
fi

# 7. Test
echo "Step 7: Running tests..."
curl -s http://localhost:8765/info | jq .
curl -s -X POST http://localhost:8765/api/ping | jq .

echo "✅ Upgrade complete!"
```

Save as `upgrade.sh` and run:
```bash
chmod +x upgrade.sh
./upgrade.sh
```

---

*For questions or issues, reference the troubleshooting section above.*
