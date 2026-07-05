# Deployment Checklist - Basset Hound Browser v12.8.0

**Last Updated**: June 21, 2026  
**Version**: 1.0.0  

This checklist ensures your Basset Hound Browser deployment is secure, performant, and production-ready.

---

## Pre-Deployment Validation

### Code & Build
- [ ] All tests pass: `npm test` (target: 92%+ pass rate)
- [ ] No security warnings: `npm audit` (0 critical findings)
- [ ] Build succeeds: `npm run build`
- [ ] Docker image builds: `docker build -t basset-hound-browser:12.8.0 .`
- [ ] All dependencies at known versions (no auto-updates)
- [ ] `.gitignore` includes `node_modules/`, `dist/`, `.env`
- [ ] No hardcoded secrets in code
- [ ] No `console.log()` statements in production code (use logger)
- [ ] Environment variables documented in `.env.example`

### Documentation
- [ ] README.md is current (v12.8.0)
- [ ] API-REFERENCE-AUTHORITATIVE.md is complete
- [ ] SECURITY.md exists and is comprehensive
- [ ] DEPLOYMENT-GUIDE.md covers your specific scenario
- [ ] TROUBLESHOOTING.md addresses common issues
- [ ] Architecture documented in `/docs`
- [ ] Changelog includes all v12.8.0 changes

---

## Security Verification

### Rate Limiting
- [ ] `RATE_LIMIT_ENABLED=true` (never disabled in production)
- [ ] Appropriate limits set for deployment type:
  - Development: `RATE_LIMIT_UNAUTHENTICATED=100`
  - Production: `RATE_LIMIT_UNAUTHENTICATED=25-50`
- [ ] Per-command limits reviewed and acceptable
- [ ] Rate limit violations logged and monitored
- [ ] `get_rate_limit_status` command tested

### Request Size Validation
- [ ] Size limits configured appropriately:
  - Global: `REQUEST_SIZE_LIMIT_GLOBAL=52428800` (production)
  - Screenshot: `REQUEST_SIZE_LIMIT_SCREENSHOT=25165824` (production)
  - Default: `REQUEST_SIZE_LIMIT_DEFAULT=5242880` (production)
- [ ] Limits tested with actual workload
- [ ] Error handling verified for 413 (Payload Too Large)
- [ ] Monitoring set up for size violations

### Path Validation
- [ ] Allowed directories whitelist reviewed and correct
- [ ] No symlinks pointing outside allowed directories
- [ ] Path validation violations logged
- [ ] Audit trail enabled for file operations
- [ ] Test: path traversal (`../../etc/passwd`) properly rejected

### WebSocket Security
- [ ] TLS/SSL configured (WSS) for production
- [ ] Valid certificates (not self-signed) in use
- [ ] Certificate paths verified:
  - `WS_CERT_PATH=/etc/certs/cert.pem`
  - `WS_KEY_PATH=/etc/certs/key.pem`
- [ ] Certificate expiration date verified (>30 days remaining)
- [ ] Certificate renewal process documented
- [ ] Connection timeout set appropriately
- [ ] Connection validation enabled

### Authentication & Authorization
- [ ] Authentication mechanism documented (or explicitly disabled)
- [ ] If disabled, understand the security implications
- [ ] Network isolation confirmed (not exposed to internet)
- [ ] Firewall rules restrict access to authorized IPs only
- [ ] No default credentials in code or documentation

---

## Performance Baseline

### Load Testing
- [ ] Baseline performance metrics established:
  - Latency: target <2ms P99
  - Throughput: target >200 msgs/sec at 50 concurrent
  - Success rate: 100% at expected load
- [ ] Memory usage baseline: <2% utilization under normal load
- [ ] CPU usage baseline: <50% under normal load
- [ ] Load test with expected peak concurrency
- [ ] Stress test at 2x peak load
- [ ] Connection stability tested for 1+ hour

### Resource Monitoring
- [ ] Memory leak test performed (30+ min under load)
- [ ] CPU scaling verified across core counts
- [ ] I/O subsystem validated (disk, network)
- [ ] GC tuning verified (if applicable)
- [ ] Resource cleanup on client disconnect verified

### Feature Validation
- [ ] All 140+ commands tested:
  - [ ] Navigation commands (navigate, back, forward)
  - [ ] Content extraction (HTML, text, screenshots)
  - [ ] Evidence capture (forensic commands)
  - [ ] DOM snapshots and JavaScript extraction
  - [ ] Export formats (CSV, JSON, XML, HAR)
  - [ ] Batch operations
  - [ ] Rate limiting verification
- [ ] Error handling tested for all failure modes
- [ ] Timeout behaviors verified
- [ ] Concurrent operation stability confirmed

---

## Infrastructure & Deployment

### Docker Configuration
- [ ] Dockerfile review:
  - Minimal base image (debian:bookworm-slim or alpine)
  - Non-root user for application
  - Health check configured
  - Resource limits set
- [ ] Docker build parameters correct:
  - `--no-cache` for fresh builds
  - Target Node version matches requirements
  - All dependencies cached appropriately
- [ ] Container size acceptable (<2GB)
- [ ] Image pushed to registry with tags:
  - `basset-hound-browser:12.8.0`
  - `basset-hound-browser:latest`
- [ ] Registry security verified (authentication, encryption)

### Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] All security variables set:
  - `RATE_LIMIT_ENABLED=true`
  - `REQUEST_SIZE_LIMIT_GLOBAL=52428800`
  - `WS_SECURE=true`
  - `WS_CERT_PATH=/etc/certs/cert.pem`
  - `WS_KEY_PATH=/etc/certs/key.pem`
- [ ] No secrets in environment variables (use secrets management)
- [ ] `.env` not committed to version control
- [ ] Secrets management system configured (Vault, K8s Secrets, etc.)

### Network & Firewall
- [ ] WebSocket port (8765) restricted to authorized networks
- [ ] If Docker: internal port mapping verified
- [ ] If Kubernetes: NetworkPolicy configured
- [ ] Firewall rules document approved and enforced:
  - Port 8765: authorized IPs only
  - Port 443: HTTPS management (if applicable)
  - Egress: whitelisted destinations only
- [ ] DDoS mitigation configured (if exposed)
- [ ] Rate limiting provides additional DDoS protection

### Logging & Monitoring

#### Logging Setup
- [ ] Log destination configured:
  - File: `/var/log/basset-hound/`
  - Container: stdout/stderr to container logs
  - Centralized: syslog, ELK, Splunk, etc.
- [ ] Log rotation configured (if file-based)
- [ ] Log retention policy set (typically 30 days)
- [ ] Sensitive data NOT logged (passwords, tokens, etc.)
- [ ] Error logs include stack traces
- [ ] Security events logged:
  - Rate limit violations
  - Request size violations
  - Path validation failures
  - Connection errors

#### Monitoring Metrics
- [ ] Metrics collection configured:
  - Prometheus, CloudWatch, Datadog, etc.
- [ ] Key metrics monitored:
  - Active connections
  - Requests per second
  - Error rate
  - P50/P95/P99 latency
  - Memory usage
  - CPU usage
  - Rate limit violations
  - Request size violations
- [ ] Dashboards created for operational visibility
- [ ] Alerting configured for:
  - High error rate (>1%)
  - High latency (P99 >10ms)
  - High memory usage (>80%)
  - Rate limit violations (sustained)
  - Certificate expiration (<7 days)

#### Health Checks
- [ ] Health check endpoint verified: `/health` or equivalent
- [ ] Response time baseline: <100ms
- [ ] Failure detection: 3 failures = unhealthy
- [ ] Health check scheduling: every 30 seconds
- [ ] Load balancer uses health checks for routing

---

## Operational Procedures

### Startup & Shutdown
- [ ] Startup procedure documented
- [ ] Graceful shutdown implemented (cleanup resources)
- [ ] Startup sequence tested:
  1. Port is free
  2. Certificates loaded
  3. WebSocket server listens
  4. Health checks pass
  5. Application ready for requests
- [ ] Startup time <10 seconds
- [ ] Shutdown time <5 seconds

### Scaling & Load Balancing
- [ ] Horizontal scaling strategy defined:
  - Multiple instances behind load balancer
  - Sticky sessions or stateless design
- [ ] Load balancer configuration:
  - Algorithm: round-robin or least-connections
  - Health check frequency: 30 seconds
  - Failure threshold: 3 failures
  - Connection timeout: 30 seconds
- [ ] Sticky sessions tested (if applicable)
- [ ] State management verified (if stateful)

### Backup & Recovery
- [ ] Backup strategy for persistent data:
  - Browser profiles backed up (if persistent)
  - Configuration backed up
  - Logs archived
- [ ] Recovery time objective (RTO): <1 hour
- [ ] Recovery point objective (RPO): <1 hour
- [ ] Backup restore procedure tested
- [ ] Disaster recovery playbook documented

### Updates & Patches
- [ ] Security patch process defined
- [ ] Minor update process defined
- [ ] Major update process defined
- [ ] Rollback procedure documented and tested
- [ ] Update testing environment matches production
- [ ] Change management approval required

---

## Incident Response

### Monitoring & Alerting
- [ ] On-call rotation established
- [ ] Alert escalation defined
- [ ] Runbooks created for common issues:
  - High latency
  - Rate limit violations
  - OOM (out of memory)
  - Certificate expiration
  - Connection failures
- [ ] Incident communication plan documented

### Post-Incident
- [ ] Incident log template created
- [ ] Root cause analysis procedure defined
- [ ] Lessons learned documented
- [ ] Fixes prioritized and tracked

---

## Compliance & Audit

### Security Audit
- [ ] Code review completed (focus on security)
- [ ] Dependency audit passed (npm audit)
- [ ] OWASP Top 10 review completed
- [ ] Security documentation reviewed
- [ ] Deployment hardening verified

### Compliance
- [ ] Data handling policy documented
- [ ] Privacy policy reviewed (GDPR, CCPA, etc.)
- [ ] Data retention policy enforced
- [ ] Audit trail logging enabled
- [ ] Compliance requirements met for your jurisdiction

### Access Control
- [ ] Who has access to production? (documented)
- [ ] Access logs enabled
- [ ] Credentials rotated (if applicable)
- [ ] SSH key access configured (if applicable)
- [ ] No shared passwords

---

## Post-Deployment

### Smoke Testing
- [ ] Connect to WebSocket: `ws://host:8765`
- [ ] Execute basic command: `navigate`
- [ ] Verify rate limiting: `get_rate_limit_status`
- [ ] Extract content: `get_content`
- [ ] Take screenshot: `screenshot`
- [ ] Check logs for errors

### Validation
- [ ] All services responding
- [ ] Metrics being collected
- [ ] Logs being written
- [ ] Health checks passing
- [ ] No errors in first 10 minutes

### Stakeholder Notification
- [ ] Deployment team notified
- [ ] Operations team notified
- [ ] Development team notified
- [ ] Monitoring team notified
- [ ] Deployment documented in changelog

---

## Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| DevOps/SRE | | | |
| Security | | | |
| Development Lead | | | |
| Product Manager | | | |

---

## Deployment Environment Specific

### Development
- [ ] Rate limiting relaxed: `RATE_LIMIT_UNAUTHENTICATED=1000`
- [ ] Size limits relaxed for testing
- [ ] TLS optional
- [ ] Logging verbose
- [ ] Health checks every 60 seconds

### Staging
- [ ] Rate limiting moderate: `RATE_LIMIT_UNAUTHENTICATED=100`
- [ ] Size limits same as production
- [ ] TLS required
- [ ] Logging normal
- [ ] Full monitoring enabled
- [ ] Load testing performed

### Production
- [ ] Rate limiting strict: `RATE_LIMIT_UNAUTHENTICATED=25-50`
- [ ] Size limits conservative
- [ ] TLS required (valid certificates)
- [ ] Logging normal
- [ ] Full monitoring and alerting
- [ ] Backup configured
- [ ] Disaster recovery tested
- [ ] On-call support ready

---

## Quick Reference

### Critical Environment Variables
```bash
# Security (MUST SET IN PRODUCTION)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_UNAUTHENTICATED=25
RATE_LIMIT_AUTHENTICATED=250
REQUEST_SIZE_LIMIT_GLOBAL=52428800
REQUEST_SIZE_LIMIT_SCREENSHOT=25165824
REQUEST_SIZE_LIMIT_DEFAULT=5242880
WS_SECURE=true
WS_CERT_PATH=/etc/certs/cert.pem
WS_KEY_PATH=/etc/certs/key.pem

# Performance
NODE_ENV=production
LOG_LEVEL=info

# Application
WS_PORT=8765
WS_HOST=0.0.0.0
```

### Test Commands
```bash
# Basic connectivity
curl -i http://localhost:8765

# Run test suite
npm test

# Check security
npm audit

# Build Docker image
docker build -t basset-hound-browser:12.8.0 .

# Start container with security settings
docker run \
  -e RATE_LIMIT_ENABLED=true \
  -e RATE_LIMIT_UNAUTHENTICATED=25 \
  -e WS_SECURE=true \
  -v /etc/certs:/etc/certs \
  -p 8765:8765 \
  basset-hound-browser:12.8.0
```

---

## Support & Documentation

- **Main Documentation**: [README.md](README.md)
- **API Reference**: [docs/api/API-REFERENCE-AUTHORITATIVE.md](docs/api/API-REFERENCE-AUTHORITATIVE.md)
- **Security Details**: [SECURITY.md](SECURITY.md)
- **Deployment Guide**: [docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

**Last Review**: June 21, 2026  
**Next Review**: September 21, 2026 (quarterly)  

