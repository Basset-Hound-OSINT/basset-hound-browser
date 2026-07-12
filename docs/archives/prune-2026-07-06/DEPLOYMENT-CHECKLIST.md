> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# Deployment Checklist

**Version:** 12.8.0  
**Purpose:** Pre-deployment validation for production readiness  
**Time Estimate:** 30-45 minutes  
**Date:** June 21, 2026

---

## Phase 1: Code & Testing (5-10 minutes)

### Run Test Suite

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Expected result: 316+ tests passing (92%+ pass rate)
# BLOCKERS:
# ❌ If any CRITICAL tests fail, do not proceed to Phase 2
# ⚠️ If <90% pass rate, review failures and fix before deployment
```

**Validation Checklist:**
- [ ] All dependencies installed (`npm install` completes without errors)
- [ ] Test suite runs without hanging (`npm test` completes within 5 minutes)
- [ ] Pass rate ≥ 90% (typically 316+/342 tests passing)
- [ ] Zero critical test failures
- [ ] No timeout errors during test execution

### Code Quality

```bash
# Check for linting issues
npm run lint

# Check for security vulnerabilities
npm audit

# Build the app
npm run build
```

**Validation Checklist:**
- [ ] Linting passes (`npm run lint` has zero errors)
- [ ] No high-severity vulnerabilities from `npm audit`
- [ ] Build completes successfully (`npm run build` outputs to dist/)
- [ ] No console errors during build

---

## Phase 2: Configuration & Setup (10-15 minutes)

### TLS/HTTPS Configuration

If deploying to production with HTTPS:

```bash
# Generate self-signed certificate (dev/staging only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# For production, use proper CA-signed certificate
# Copy to deployment location
mkdir -p config/certs
cp cert.pem config/certs/
cp key.pem config/certs/
chmod 600 config/certs/key.pem
```

**Validation Checklist:**
- [ ] Certificate file exists (cert.pem)
- [ ] Key file exists (key.pem)
- [ ] Key file permissions correct (600 or 400)
- [ ] Certificate is valid (not expired)
- [ ] For production: Certificate is from trusted CA

**Enable TLS in code:**

Update `src/main/main.js`:
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  cert: fs.readFileSync('config/certs/cert.pem'),
  key: fs.readFileSync('config/certs/key.pem')
};

wsServer = new WebSocketServer({ https: options }, mainWindow);
```

### Rate Limiting Configuration

Edit `websocket/server.js`:

```javascript
// Rate limiting settings (adjust for your deployment)
const RATE_LIMITS = {
  global: {
    windowMs: 60000,        // 1 minute window
    max: 1000,              // 1000 requests per window
    authenticated: 2000     // 2000 for authenticated users
  },
  commands: {
    'screenshot': { max: 5, windowMs: 60000 },
    'navigate': { max: 15, windowMs: 60000 },
    'execute_script': { max: 20, windowMs: 60000 }
  }
};
```

**Validation Checklist:**
- [ ] Global rate limit configured (default: 1000 req/min)
- [ ] Command-specific limits set
- [ ] Limits match your infrastructure capacity
- [ ] Documentation updated with new limits

### Environment Variables

Create `.env.production`:

```bash
# Server
NODE_ENV=production
PORT=8765
LOG_LEVEL=info

# TLS (if using HTTPS)
TLS_CERT_PATH=/etc/basset-hound/certs/cert.pem
TLS_KEY_PATH=/etc/basset-hound/certs/key.pem

# Authentication (optional)
REQUIRE_AUTH=false
AUTH_TOKEN_SECRET=your-secret-key-here

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Resource Limits
MAX_CONCURRENT_CONNECTIONS=500
SESSION_TIMEOUT_MS=3600000  # 1 hour

# Tor (optional)
TOR_ENABLED=false
TOR_CONTROL_PORT=9051
TOR_SOCKS_PORT=9050
```

**Validation Checklist:**
- [ ] `.env.production` created
- [ ] All required variables set
- [ ] No secrets in version control
- [ ] Permissions correct (600 or 400)

---

## Phase 3: Monitoring & Health Checks (10-15 minutes)

### Health Check Endpoint

Verify health check is working:

```bash
# Start browser
npm start

# In another terminal, test health endpoint
curl http://localhost:8765/health

# Expected response:
# {
#   "status": "ok",
#   "uptime": 123.456,
#   "connections": 0,
#   "memoryUsage": {
#     "heapUsed": 45678901,
#     "heapTotal": 123456789
#   }
# }
```

**Validation Checklist:**
- [ ] Health endpoint responds with 200 status
- [ ] Response includes `status: "ok"`
- [ ] Memory usage reported correctly
- [ ] Connection count visible
- [ ] Endpoint response time < 100ms

### Prometheus Metrics Setup (Optional)

If using Prometheus for monitoring:

```bash
# Ensure metrics endpoint is enabled
curl http://localhost:9090/metrics

# Expected: Prometheus-format metrics output
```

**Validation Checklist:**
- [ ] Metrics port configured (default: 9090)
- [ ] Metrics endpoint accessible
- [ ] Key metrics visible:
  - [ ] `basset_websocket_connections_current`
  - [ ] `basset_commands_total`
  - [ ] `basset_command_duration_seconds`
  - [ ] `basset_process_memory_bytes`

### Docker Deployment (if applicable)

```bash
# Build image
docker build -t basset-hound-browser:12.8.0 .

# Test container startup
docker run --rm -p 8765:8765 basset-hound-browser:12.8.0

# In another terminal, test connection
curl http://localhost:8765/health

# Expected: health endpoint responds
```

**Validation Checklist:**
- [ ] Docker image builds without errors
- [ ] Container starts successfully
- [ ] Health endpoint responds from container
- [ ] WebSocket port (8765) is exposed
- [ ] Container shuts down cleanly (Ctrl+C)

---

## Phase 4: Performance Validation (5-10 minutes)

### Throughput Test

```bash
# Start the browser
npm start &

# Run throughput test (requires test framework)
npm run test:performance -- --type=throughput

# Expected results:
# - Throughput: > 450 messages/second
# - Latency P50: < 0.1ms
# - Latency P99: < 2.5ms
```

**Validation Checklist:**
- [ ] Throughput meets baseline (>450 msg/sec)
- [ ] Latency acceptable (P99 < 2.5ms)
- [ ] No memory growth during test
- [ ] CPU usage stays below 80%

### Load Test

```bash
# Start the browser
npm start &

# Run load test with 50 concurrent connections
npm run test:performance -- --concurrent=50 --duration=60

# Expected results:
# - Success rate: 100%
# - No connection timeouts
# - Memory stable (no growth > 1MB/hour)
```

**Validation Checklist:**
- [ ] 50 concurrent connections: 100% success
- [ ] 100 concurrent connections: >95% success (optional)
- [ ] No memory leaks (growth < 1MB/hour)
- [ ] No connection drops
- [ ] Response times stable

---

## Phase 5: Security Validation (5-10 minutes)

### Input Validation

```bash
# Test XSS protection
npm run test:security -- --test=xss

# Test path traversal protection
npm run test:security -- --test=path-traversal

# Test injection protection
npm run test:security -- --test=injection
```

**Validation Checklist:**
- [ ] XSS tests pass
- [ ] Path traversal tests pass
- [ ] SQL/command injection tests pass
- [ ] No unhandled errors from malformed input

### Network Security

```bash
# Check WebSocket uses proper headers
curl -i http://localhost:8765/health

# Should have security headers:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - X-XSS-Protection: 1; mode=block
```

**Validation Checklist:**
- [ ] Security headers present
- [ ] TLS configured (if using HTTPS)
- [ ] Certificate validation working
- [ ] No sensitive data in logs

### Dependency Audit

```bash
# Check for known vulnerabilities
npm audit

# Expected: Zero high-severity vulnerabilities
# If found, update packages:
npm audit fix

# Verify tests still pass after fix
npm test
```

**Validation Checklist:**
- [ ] No high/critical vulnerabilities
- [ ] npm audit fix completes without errors
- [ ] Tests still pass after dependencies updated
- [ ] No deprecated dependencies in use

---

## Phase 6: Production Readiness (Final Checks)

### Logging Configuration

```bash
# Verify logs are being generated
tail -f /var/log/basset-hound/app.log

# Should show startup messages without errors
# LOG LEVEL should be 'info' or 'warn' in production
```

**Validation Checklist:**
- [ ] Logs configured for your environment
- [ ] Log level appropriate (info/warn for production)
- [ ] Log rotation configured
- [ ] Logs don't contain sensitive data (passwords, tokens)

### Backup & Recovery

```bash
# Test backup procedure
./scripts/backup.sh

# Verify backup exists
ls -lh /backups/basset-hound-*

# Test restore procedure (in test environment)
./scripts/restore.sh /backups/basset-hound-latest.tar.gz
```

**Validation Checklist:**
- [ ] Backup script created
- [ ] Backup location verified
- [ ] Backup restoration tested
- [ ] Rollback procedure documented

### Documentation

```bash
# Verify deployment docs are complete
ls -la docs/DEPLOYMENT-CHECKLIST.md
ls -la docs/INTEGRATION-GUIDE.md
ls -la docs/TROUBLESHOOTING.md
```

**Validation Checklist:**
- [ ] Deployment guide completed and reviewed
- [ ] Troubleshooting guide up-to-date
- [ ] API documentation current
- [ ] Example code works (tested)

### Capacity Planning

- [ ] Expected concurrent users documented
- [ ] Resource requirements calculated:
  - [ ] CPU: 2-4 cores minimum
  - [ ] Memory: 4-8GB minimum
  - [ ] Disk: 50GB minimum (for logs/data)
  - [ ] Network: 100 Mbps minimum recommended
- [ ] Scaling strategy documented
- [ ] Load balancer configured (if applicable)

---

## Phase 7: Deployment Decision Matrix

### Can Deploy?

| Requirement | Status | Details |
|-------------|--------|---------|
| Test Pass Rate | ✅ | ≥90% (316+/342) |
| Security Audit | ✅ | Zero critical findings |
| Performance Test | ✅ | >450 msg/sec throughput |
| Load Test | ✅ | 100% success at 50 concurrent |
| Configuration | ✅ | TLS, rate limiting, monitoring |
| Documentation | ✅ | Complete and current |
| Backup/Recovery | ✅ | Tested and working |

**Deployment Approval:**
- [ ] All Phase 1-6 checklists completed
- [ ] Technical lead approves
- [ ] Operations team trained
- [ ] Rollback plan documented

---

## Deployment Steps

When all checks pass:

```bash
# 1. Stop current instance (if any)
docker stop basset-hound || true

# 2. Remove old container
docker rm basset-hound || true

# 3. Pull latest image (if using registry)
docker pull basset-hound-browser:12.8.0

# 4. Create backup
./scripts/backup.sh

# 5. Start new container
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  --network basset-hound-browser \
  --env-file .env.production \
  -v /etc/basset-hound/certs:/etc/certs:ro \
  -v /var/log/basset-hound:/app/logs \
  basset-hound-browser:12.8.0

# 6. Verify health
sleep 5
curl http://localhost:8765/health

# 7. Run smoke tests
npm run test:smoke
```

---

## Post-Deployment Monitoring

### First Hour

- [ ] Monitor logs for errors: `docker logs -f basset-hound`
- [ ] Check memory usage: `docker stats basset-hound`
- [ ] Verify WebSocket connections: `curl http://localhost:8765/health`
- [ ] Test basic commands work

### First Day

- [ ] Monitor 24-hour performance metrics
- [ ] Check error rates (should be <0.1%)
- [ ] Verify rate limiting is working
- [ ] Review application logs for warnings

### Ongoing

- [ ] Set up alerts for:
  - [ ] High memory usage (>80% of allocated)
  - [ ] High error rate (>1%)
  - [ ] Slow response times (P99 > 5ms)
  - [ ] Connection failures
- [ ] Weekly review of metrics
- [ ] Monthly dependency updates

---

## Rollback Procedure

If issues occur after deployment:

```bash
# 1. Stop current container
docker stop basset-hound

# 2. Remove problematic container
docker rm basset-hound

# 3. Restore backup
./scripts/restore.sh /backups/basset-hound-latest.tar.gz

# 4. Start previous version
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound-browser:12.7.0  # Previous stable version

# 5. Verify
curl http://localhost:8765/health

# 6. Notify team
# Alert: Rolled back to v12.7.0 due to [reason]
```

---

## Common Blockers & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Tests fail | Missing dependency | Run `npm install` |
| WebSocket doesn't connect | Port in use | `lsof -i :8765` and kill process |
| High memory usage | Memory leak | Upgrade Node.js or reduce concurrent |
| Rate limiting too strict | Limit too low | Increase in rate-limit config |
| Certificate error | Expired or invalid | Regenerate using openssl |
| Performance degradation | Too many connections | Add load balancer or scale |

---

## Support & Escalation

**If deployment fails:**

1. **Check logs:** `docker logs basset-hound | tail -100`
2. **Verify environment:** All variables set correctly
3. **Test connectivity:** `curl http://localhost:8765/health`
4. **Review checklist:** Did you skip any phase?
5. **Contact support:** 
   - Email: support@basset-hound.dev
   - Issues: https://github.com/basset-hound/basset-hound-browser/issues
   - Slack: [Channel if available]

---

## Sign-Off

**Deployed By:** ___________________  
**Date:** ___________________  
**Version:** 12.8.0  
**Environment:** [ ] Dev [ ] Staging [ ] Production  

**Approvals:**
- [ ] Technical Lead: ___________________
- [ ] Operations: ___________________
- [ ] Security: ___________________

---

**Ready to deploy? Start with Phase 1!** 🚀
