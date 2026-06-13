# High Error Rate Incident Playbook

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Executive Summary

This playbook provides procedures for diagnosing and resolving high error rate incidents (>1% of requests failing).

**Severity Classification:**
- **P1 (Critical):** >5% error rate OR complete service down
- **P2 (High):** 2-5% error rate, specific endpoints affected
- **P3 (Medium):** 1-2% error rate, degraded functionality
- **P4 (Low):** <1% error rate, isolated issues

**Objective:** Restore error rate to <0.1% within 15 minutes

---

## Incident Detection (2 minutes)

### 1.1 Alert Confirmation

- [ ] Alert acknowledged
  - Alert time: __________
  - Error rate: __________%
  - Affected endpoints: __________
  - Error count: __________

- [ ] Scope assessment
  - All endpoints: [ ] Yes [ ] No
  - Specific region: [ ] Yes [ ] No
  - Single customer: [ ] Yes [ ] No

### 1.2 Error Analysis

**Gather error information:**

```bash
# Get recent errors
curl -s http://prometheus:9090/api/v1/query?query=http_errors_total | jq .

# Check error distribution
tail -n 1000 /var/log/application.log | grep ERROR | cut -d' ' -f3 | sort | uniq -c

# Identify affected endpoints
tail -n 1000 /var/log/application.log | grep "status=5" | cut -d' ' -f2 | sort | uniq -c
```

- [ ] Error types identified: __________
- [ ] Error rate timeline: __________
- [ ] First error timestamp: __________

---

## Root Cause Investigation (5-10 minutes)

### 2.1 Categorize Errors

**Error Classification:**

1. **4xx Errors (Client):** Bad request, auth failure
   - Action: Check request format, authentication
   - Impact: Usually single user, not widespread

2. **5xx Errors (Server):** Application crash, dependency failure
   - Action: Check application logs, dependencies
   - Impact: Affects multiple users

3. **Timeout Errors:** Request took too long
   - Action: Check performance bottleneck
   - Impact: Compound effect

4. **Dependency Errors:** External service failed
   - Action: Check external service health
   - Impact: Cascading failures

### 2.2 Diagnostic Paths

#### Path 1: Application Crashes

```bash
docker logs basset-hound-browser --tail 100 | grep -i "error\|exception\|crash"
```

- [ ] Exception type: __________
- [ ] Stack trace: __________
- [ ] Frequency: __________

**Common causes:**
- Null pointer exception
- Out of memory
- Resource exhaustion
- Unhandled promise rejection

**Fix:**
- Deploy crash fix (restart app)
- Check recent code changes
- Review error logs

#### Path 2: Dependency Failures

```bash
# Check database connectivity
./scripts/check-db-connection.sh

# Check external API responses
curl -s http://external-api.example.com/health
```

- [ ] Database: [ ] Connected [ ] Down
- [ ] Cache: [ ] Connected [ ] Down
- [ ] External API: [ ] Responding [ ] Timeout

**Common causes:**
- Database connection timeout
- Connection pool exhausted
- External API returning 5xx errors
- Network connectivity issue

**Fix:**
- Restart database connection
- Scale up failing service
- Enable circuit breaker for external calls

#### Path 3: Logic Errors (Recent Deployments)

- [ ] Recent deployment within last hour: [ ] Yes [ ] No
- [ ] Errors started after deployment: [ ] Yes [ ] No
- [ ] Specific endpoint errors: [ ] Yes [ ] No

**Common causes:**
- Bad logic in new code
- Incorrect database query
- Missing validation
- Race condition

**Fix:**
- Rollback to previous version
- Fix logic and redeploy

#### Path 4: Resource Exhaustion

```bash
docker stats --no-stream
```

- [ ] Memory available: __________MB (should be >500MB)
- [ ] Disk space available: __________GB (should be >10GB)
- [ ] File descriptors: __________/limit

**Common causes:**
- Out of memory (OOM)
- Disk full
- Too many open files
- Process limits exceeded

**Fix:**
- Free up resources immediately
- Increase limits
- Deploy fix for resource leak

---

## Resolution Implementation (5-15 minutes)

### 3.1 Immediate Mitigation

**Based on error type:**

- [ ] **Application Crash:**
  - Restart container: `docker restart basset-hound-browser`
  - Monitor error rate

- [ ] **Dependency Down:**
  - Enable circuit breaker (fail fast)
  - Reduce timeout thresholds
  - Fallback to cached data if available

- [ ] **Resource Exhausted:**
  - Free up resources (clear caches, logs)
  - Increase limits temporarily
  - Restart application

- [ ] **Recent Deployment Issue:**
  - Initiate rollback (see Rollback Playbook)
  - Error rate should drop within 2 minutes

### 3.2 Verify Resolution

- [ ] Error rate trending down
  - Peak: __________%
  - Current: __________%
  - Target: <0.1%

- [ ] Error types decreasing
  - Previous count: __________
  - Current count: __________

- [ ] Dependent services recovering
  - Database: [ ] Healthy [ ] Still issues
  - Cache: [ ] Healthy [ ] Still issues
  - External API: [ ] Responding [ ] Still issues

---

## Post-Incident (5 minutes)

### 4.1 Verify Stability

- [ ] Error rate stable at <0.1%
- [ ] No new errors appearing
- [ ] All endpoints functioning

### 4.2 Incident Closure

- [ ] Incident marked RESOLVED
  - Time to resolution: __________minutes
  - Root cause: __________
  - Mitigation: __________

### 4.3 Prevention

**Prevent recurrence:**

- [ ] Code review for crash cause
- [ ] Add monitoring for specific error type
- [ ] Improve error handling
- [ ] Add circuit breaker for external calls
- [ ] Increase resource allocation

---

## Appendix: Error Code Reference

| Code | Meaning | Action |
|------|---------|--------|
| 500 | Internal Server Error | Check application logs |
| 502 | Bad Gateway | Check upstream service |
| 503 | Service Unavailable | Check service health |
| 504 | Gateway Timeout | Check performance metrics |
| 429 | Too Many Requests | Check rate limits |
| 408 | Request Timeout | Check timeout thresholds |
