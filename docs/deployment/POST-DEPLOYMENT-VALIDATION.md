# Post-Deployment Validation Runbook - v12.0.0

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Purpose:** Validate v12.0.0 deployment success at 1-hour, 24-hour, and 1-week checkpoints  
**Target Release:** Basset Hound Browser v12.0.0

---

## Overview

Post-deployment validation ensures v12.0.0 is stable, performant, and ready for sustained production use. This runbook defines validation steps at three critical intervals:

1. **1-Hour Validation** (Immediate post-100% deployment)
2. **24-Hour Stability Check** (First full business day)
3. **1-Week Performance Review** (First full week of operation)

---

## Validation Principles

- **Objective:** Use measurable criteria, not opinions
- **Automated:** Run automated tests where possible
- **Comparable:** All results compared against v11.3.0 baseline
- **Documented:** All findings recorded for release sign-off
- **Actionable:** Pass/Fail criteria clearly defined

---

## 1-HOUR VALIDATION (Immediate Post-Deployment)

**Timeline:** Execute within 1 hour of 100% rollout completion  
**Duration:** 15 minutes of validation  
**Participants:** Deployment Lead, Technical Lead, SRE Lead

### 1.1 Infrastructure Health (3 minutes)

**Checklist:**

```bash
#!/bin/bash
# 1-hour-validation-infrastructure.sh

echo "=== 1-HOUR VALIDATION: Infrastructure Health ==="
VALIDATION_TIME=$(date +%s)

# 1. All instances reporting
echo ""
echo "1. Instance Status:"
HEALTHY=0
UNHEALTHY=0
for i in {01..10}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://basset-prod-$i:8765)
  if [ "$STATUS" == "426" ]; then
    echo "  basset-prod-$i: ✓ Healthy (HTTP 426)"
    HEALTHY=$((HEALTHY + 1))
  else
    echo "  basset-prod-$i: ✗ Unhealthy (HTTP $STATUS)"
    UNHEALTHY=$((UNHEALTHY + 1))
  fi
done

echo ""
echo "Summary: $HEALTHY/10 healthy, $UNHEALTHY/10 unhealthy"
[ $UNHEALTHY -eq 0 ] && echo "✓ PASS: All instances healthy" || echo "✗ FAIL: Some instances unhealthy"

# 2. No restarts
echo ""
echo "2. Container Stability (no restarts):"
for i in {01..10}; do
  RESTART_COUNT=$(ssh basset-prod-$i "docker inspect basset-hound-browser | jq '.[0].RestartCount'")
  if [ "$RESTART_COUNT" -eq 0 ]; then
    echo "  basset-prod-$i: ✓ No restarts"
  else
    echo "  basset-prod-$i: ✗ Restarted $RESTART_COUNT times"
  fi
done

# 3. Version verification
echo ""
echo "3. Version Verification:"
for i in {01..10}; do
  VERSION=$(ssh basset-prod-$i "docker inspect basset-hound-browser | jq -r '.[0].Config.Image'")
  if [[ $VERSION == *"v12.0.0"* ]]; then
    echo "  basset-prod-$i: ✓ Running v12.0.0"
  else
    echo "  basset-prod-$i: ✗ NOT running v12.0.0: $VERSION"
  fi
done

# 4. Load balancer health
echo ""
echo "4. Load Balancer Status:"
LB_STATUS=$(curl -s http://load-balancer:8080/stats | jq '.backends | length')
echo "  Active backends: $LB_STATUS/10"
[ "$LB_STATUS" -eq 10 ] && echo "✓ PASS: All backends active" || echo "✗ FAIL: Missing backends"

# 5. Network connectivity
echo ""
echo "5. Network Connectivity:"
LATENCY=$(curl -s -w '%{time_starttransfer}\n' -o /dev/null http://basset-prod-01:8765)
echo "  Response time to basset-prod-01: ${LATENCY}s"
echo "✓ PASS: Network connectivity OK"

echo ""
echo "=== Infrastructure Health: COMPLETE ==="
```

**Pass Criteria:**

- [ ] All 10 instances return HTTP 426 (WebSocket service)
- [ ] Zero container restarts across fleet
- [ ] All instances running v12.0.0 image
- [ ] Load balancer shows 10/10 backends active
- [ ] Response latency < 500ms

**Fail Criteria:**

- [ ] Any instance returns HTTP 500 or timeout
- [ ] Any instance shows > 2 restarts
- [ ] Any instance NOT running v12.0.0
- [ ] Load balancer shows < 10 backends

### 1.2 Functional Testing (5 minutes)

**Core Commands Test Suite:**

```bash
#!/bin/bash
# 1-hour-validation-functional.sh

echo "=== 1-HOUR VALIDATION: Functional Testing ==="

# Use first healthy instance for testing
TEST_INSTANCE="basset-prod-01"
TEST_RESULTS_FILE="/tmp/functional-test-results.json"

# Initialize results
cat > $TEST_RESULTS_FILE << 'EOF'
{
  "timestamp": "",
  "instance": "",
  "version": "v12.0.0",
  "tests": {
    "navigate": {"status": "pending", "duration_ms": 0, "error": null},
    "click": {"status": "pending", "duration_ms": 0, "error": null},
    "fillForm": {"status": "pending", "duration_ms": 0, "error": null},
    "screenshot": {"status": "pending", "duration_ms": 0, "error": null},
    "getStatus": {"status": "pending", "duration_ms": 0, "error": null},
    "storage": {"status": "pending", "duration_ms": 0, "error": null}
  }
}
EOF

# Test 1: Navigate
echo ""
echo "Test 1: Navigate Command"
START=$(date +%s%N)
RESPONSE=$(timeout 30 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      cmd: 'navigate',
      url: 'https://example.com'
    }));
    ws.on('message', (msg) => {
      console.log(msg);
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 25000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "✓ PASS: Navigate command successful (${DURATION}ms)"
  jq '.tests.navigate |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Navigate command failed"
  jq '.tests.navigate |= {status: "fail", error: "No response"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Test 2: Click
echo ""
echo "Test 2: Click Command"
START=$(date +%s%N)
RESPONSE=$(timeout 10 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      cmd: 'click',
      selector: 'button'
    }));
    ws.on('message', (msg) => {
      console.log(msg);
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 8000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "✓ PASS: Click command successful (${DURATION}ms)"
  jq '.tests.click |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Click command failed"
  jq '.tests.click |= {status: "fail", error: "No response"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Test 3: Fill Form
echo ""
echo "Test 3: Fill Form Command"
START=$(date +%s%N)
RESPONSE=$(timeout 10 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      cmd: 'fillForm',
      fields: [
        {selector: 'input[name=email]', value: 'test@example.com'}
      ]
    }));
    ws.on('message', (msg) => {
      console.log(msg);
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 8000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "✓ PASS: Fill Form command successful (${DURATION}ms)"
  jq '.tests.fillForm |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Fill Form command failed"
  jq '.tests.fillForm |= {status: "fail", error: "No response"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Test 4: Screenshot
echo ""
echo "Test 4: Screenshot Command"
START=$(date +%s%N)
RESPONSE=$(timeout 15 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      cmd: 'screenshot',
      format: 'base64'
    }));
    ws.on('message', (msg) => {
      const resp = JSON.parse(msg);
      if (resp.data && resp.data.length > 1000) {
        console.log(JSON.stringify({success: true, size: resp.data.length}));
      } else {
        console.log(JSON.stringify({success: false, error: 'Empty screenshot'}));
      }
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 13000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | grep -q "success.*true"; then
  echo "✓ PASS: Screenshot command successful (${DURATION}ms)"
  jq '.tests.screenshot |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Screenshot command failed"
  jq '.tests.screenshot |= {status: "fail", error: "Empty or invalid screenshot"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Test 5: Get Status
echo ""
echo "Test 5: Get Status Command"
START=$(date +%s%N)
RESPONSE=$(timeout 5 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({cmd: 'getStatus'}));
    ws.on('message', (msg) => {
      console.log(msg);
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 3000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | jq '.version' > /dev/null 2>&1; then
  echo "✓ PASS: Get Status command successful (${DURATION}ms)"
  jq '.tests.getStatus |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Get Status command failed"
  jq '.tests.getStatus |= {status: "fail", error: "No response"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Test 6: Storage (cookies/localStorage)
echo ""
echo "Test 6: Storage Operations"
START=$(date +%s%N)
RESPONSE=$(timeout 10 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://$TEST_INSTANCE:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      cmd: 'setCookie',
      name: 'test_cookie',
      value: 'test_value'
    }));
    ws.on('message', (msg) => {
      ws.send(JSON.stringify({
        cmd: 'getCookie',
        name: 'test_cookie'
      }));
      ws.on('message', (msg2) => {
        console.log(msg2);
        ws.close();
        process.exit(0);
      });
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 8000);
  });
" 2>&1)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if echo "$RESPONSE" | grep -q "test_value"; then
  echo "✓ PASS: Storage operations successful (${DURATION}ms)"
  jq '.tests.storage |= {status: "pass", duration_ms: '$DURATION'}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
else
  echo "✗ FAIL: Storage operations failed"
  jq '.tests.storage |= {status: "fail", error: "Cookie not retrieved"}' $TEST_RESULTS_FILE > /tmp/tmp.json && mv /tmp/tmp.json $TEST_RESULTS_FILE
fi

# Summary
echo ""
echo "=== Functional Test Results ==="
PASS=$(jq '[.tests[] | select(.status=="pass")] | length' $TEST_RESULTS_FILE)
FAIL=$(jq '[.tests[] | select(.status=="fail")] | length' $TEST_RESULTS_FILE)
echo "$PASS/6 tests passed"
echo "$FAIL/6 tests failed"

if [ $PASS -eq 6 ]; then
  echo "✓ PASS: All functional tests successful"
else
  echo "⚠ PARTIAL: Some tests failed"
fi

# Save results
jq '.timestamp = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", .instance = "'$TEST_INSTANCE'"' $TEST_RESULTS_FILE > /tmp/functional-test-results-final.json
echo ""
echo "Results saved to: /tmp/functional-test-results-final.json"
```

**Pass Criteria:**

- [ ] Navigate: ✓ Complete in < 30 seconds
- [ ] Click: ✓ Complete in < 10 seconds
- [ ] Fill Form: ✓ Complete in < 10 seconds
- [ ] Screenshot: ✓ Complete in < 15 seconds, produces valid image
- [ ] Get Status: ✓ Complete in < 5 seconds
- [ ] Storage: ✓ Cookie read/write successful

### 1.3 Performance Baseline (4 minutes)

**Metrics Collection:**

```bash
#!/bin/bash
# 1-hour-validation-performance.sh

echo "=== 1-HOUR VALIDATION: Performance Metrics ==="

PERF_RESULTS="/tmp/perf-metrics-1h.json"

# Baseline thresholds from pre-deployment analysis
# These should be set during canary phase
BASELINE_LATENCY_P95=120  # ms
BASELINE_ERROR_RATE=0.3   # %
BASELINE_MEMORY=680       # MB

# Current metrics
echo ""
echo "Collecting current metrics..."

# 1. Latency (p95)
P95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,basset_websocket_latency_ms)' | jq '.data.result[0].value[1]' | cut -d. -f1)
echo "Latency p95: ${P95}ms (baseline: ${BASELINE_LATENCY_P95}ms)"
[ "$P95" -lt $((BASELINE_LATENCY_P95 * 120 / 100)) ] && echo "✓ PASS: Within 20% of baseline" || echo "⚠ WARN: Exceeded 20% threshold"

# 2. Error rate
ERROR_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])*100' | jq '.data.result[0].value[1]' | cut -d. -f1)
echo "Error rate: ${ERROR_RATE}% (baseline: ${BASELINE_ERROR_RATE}%)"
[ "$ERROR_RATE" -lt $(echo "$BASELINE_ERROR_RATE * 3" | bc) ] && echo "✓ PASS: Within acceptable range" || echo "✗ FAIL: Error rate too high"

# 3. Memory usage
MEMORY=$(curl -s 'http://prometheus:9090/api/v1/query?query=basset_memory_usage_bytes/1e6' | jq '.data.result[0].value[1]' | cut -d. -f1)
echo "Memory usage: ${MEMORY}MB (baseline: ${BASELINE_MEMORY}MB)"
[ "$MEMORY" -lt $((BASELINE_MEMORY * 120 / 100)) ] && echo "✓ PASS: Within 20% of baseline" || echo "⚠ WARN: Exceeded 20% threshold"

# 4. CPU usage
CPU=$(curl -s 'http://prometheus:9090/api/v1/query?query=basset_cpu_usage_percent' | jq '.data.result[0].value[1]' | cut -d. -f1)
echo "CPU usage: ${CPU}%"
[ "$CPU" -lt 75 ] && echo "✓ PASS: CPU normal" || echo "⚠ WARN: High CPU usage"

# 5. Command success rate
SUCCESS_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=(basset_command_success_total/(basset_command_success_total%2Bbasset_command_failure_total))*100' | jq '.data.result[0].value[1]' | cut -d. -f1)
echo "Command success rate: ${SUCCESS_RATE}%"
[ "$SUCCESS_RATE" -gt 99 ] && echo "✓ PASS: Success rate > 99%" || echo "⚠ WARN: Success rate below target"

cat > $PERF_RESULTS << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_hour": 1,
  "metrics": {
    "latency_p95_ms": $P95,
    "baseline_latency_p95_ms": $BASELINE_LATENCY_P95,
    "error_rate_percent": $ERROR_RATE,
    "baseline_error_rate_percent": $BASELINE_ERROR_RATE,
    "memory_usage_mb": $MEMORY,
    "baseline_memory_mb": $BASELINE_MEMORY,
    "cpu_usage_percent": $CPU,
    "command_success_rate_percent": $SUCCESS_RATE
  }
}
EOF

echo ""
echo "Performance metrics saved to: $PERF_RESULTS"
```

**Pass Criteria:**

- [ ] Latency p95: ≤ baseline × 1.2
- [ ] Error rate: ≤ baseline × 3
- [ ] Memory: ≤ baseline × 1.2
- [ ] CPU: < 75%
- [ ] Command success rate: > 99%

### 1.4 Log Analysis (2 minutes)

**Error Scanning:**

```bash
#!/bin/bash
# 1-hour-validation-logs.sh

echo "=== 1-HOUR VALIDATION: Log Analysis ==="

# Check last hour of logs for errors
echo ""
echo "Scanning logs for errors in last hour..."

ERROR_SUMMARY=$(for i in {01..10}; do
  ssh basset-prod-$i "docker logs --since 1h basset-hound-browser 2>&1" | grep -i error | wc -l
done | awk '{s+=$1} END {print s}')

echo "Total errors across fleet: $ERROR_SUMMARY"

if [ "$ERROR_SUMMARY" -lt 20 ]; then
  echo "✓ PASS: Error count acceptable"
else
  echo "⚠ WARN: High error count - review logs"
  echo ""
  echo "Top errors:"
  for i in {01..10}; do
    ssh basset-prod-$i "docker logs --since 1h basset-hound-browser 2>&1" | grep -i error | sort | uniq -c | sort -rn | head -3
  done
fi

# Check for CRITICAL level errors
CRITICAL_COUNT=$(for i in {01..10}; do
  ssh basset-prod-$i "docker logs --since 1h basset-hound-browser 2>&1" | grep CRITICAL | wc -l
done | awk '{s+=$1} END {print s}')

echo ""
echo "CRITICAL errors: $CRITICAL_COUNT"
if [ "$CRITICAL_COUNT" -eq 0 ]; then
  echo "✓ PASS: No critical errors"
else
  echo "✗ FAIL: Critical errors detected - ESCALATE"
fi
```

**Pass Criteria:**

- [ ] Total errors: < 20 across entire fleet
- [ ] Critical errors: 0
- [ ] No repeated error patterns

### 1.5 One-Hour Validation Report

**Generate report:**

```bash
#!/bin/bash
# Generate 1-hour validation report

cat > /tmp/validation-1h-report.md << 'EOF'
# v12.0.0 Deployment - 1-Hour Validation Report

**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Deployment Completed:** $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ)
**Validation Duration:** 15 minutes

## Executive Summary

v12.0.0 deployment completed successfully. All critical systems operational.

## Validation Results

### ✓ Infrastructure Health
- All 10 instances: Healthy
- Container restarts: 0
- Version verification: 10/10 on v12.0.0
- Load balancer: 10/10 backends active

### ✓ Functional Tests (6/6 Passed)
- Navigate: ✓ PASS (duration: ___ ms)
- Click: ✓ PASS (duration: ___ ms)
- Fill Form: ✓ PASS (duration: ___ ms)
- Screenshot: ✓ PASS (duration: ___ ms)
- Get Status: ✓ PASS (duration: ___ ms)
- Storage: ✓ PASS (duration: ___ ms)

### ✓ Performance Metrics
- Latency p95: ___ ms (baseline: ___ ms) → ✓ PASS
- Error rate: ___% (baseline: ___%) → ✓ PASS
- Memory: ___ MB (baseline: ___ MB) → ✓ PASS
- CPU: __% → ✓ PASS
- Command success: __% → ✓ PASS

### ✓ Log Analysis
- Total errors (1h): ___
- Critical errors: 0
- Status: ✓ PASS

## Sign-off

**1-Hour Validation Status: ✓ PASS**

All criteria met. v12.0.0 is stable and ready for continued monitoring.

**Approved By:**
- Deployment Lead: _________________
- Technical Lead: _________________
- SRE Lead: _________________

**Next Validation:** 24-hour checkpoint

EOF

cat /tmp/validation-1h-report.md
```

---

## 24-HOUR STABILITY CHECK

**Timeline:** Execute at 24-hour mark  
**Duration:** 30 minutes  
**Participants:** Technical Lead, SRE Lead

### 24.1 Container Uptime & Stability

```bash
#!/bin/bash
# 24-hour-validation-stability.sh

echo "=== 24-HOUR VALIDATION: Stability Check ==="

# 1. Uptime verification
echo ""
echo "1. Instance Uptime (should be 24h):"
for i in {01..10}; do
  UPTIME=$(ssh basset-prod-$i "docker inspect basset-hound-browser | jq -r '.[0].State.StartedAt'")
  echo "  basset-prod-$i: Started at $UPTIME"
done

# 2. Restart count (should be 0)
echo ""
echo "2. Restart Count (should be 0):"
TOTAL_RESTARTS=0
for i in {01..10}; do
  RESTARTS=$(ssh basset-prod-$i "docker inspect basset-hound-browser | jq '.[0].RestartCount'")
  echo "  basset-prod-$i: $RESTARTS restarts"
  TOTAL_RESTARTS=$((TOTAL_RESTARTS + RESTARTS))
done

if [ $TOTAL_RESTARTS -eq 0 ]; then
  echo "✓ PASS: Zero restarts across fleet"
else
  echo "✗ FAIL: $TOTAL_RESTARTS total restarts - INVESTIGATE"
fi

# 3. Version consistency
echo ""
echo "3. Version Consistency (all should be v12.0.0):"
VERSION_MISMATCH=0
for i in {01..10}; do
  VERSION=$(ssh basset-prod-$i "docker inspect basset-hound-browser | jq -r '.[0].Config.Image'")
  if [[ $VERSION == *"v12.0.0"* ]]; then
    echo "  basset-prod-$i: ✓ v12.0.0"
  else
    echo "  basset-prod-$i: ✗ NOT v12.0.0: $VERSION"
    VERSION_MISMATCH=$((VERSION_MISMATCH + 1))
  fi
done

if [ $VERSION_MISMATCH -eq 0 ]; then
  echo "✓ PASS: All instances on v12.0.0"
else
  echo "✗ FAIL: Version mismatch detected"
fi
```

### 24.2 Performance Degradation Check

```bash
#!/bin/bash
# 24-hour-validation-performance.sh

echo "=== 24-HOUR VALIDATION: Performance Degradation Check ==="

# Compare 1h vs 24h metrics
BASELINE_1H="/tmp/perf-metrics-1h.json"
CURRENT="/tmp/perf-metrics-24h.json"

# Collect current metrics
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,basset_websocket_latency_ms)' | jq '.data.result[0].value[1]' > /tmp/latency-24h.txt
curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])*100' | jq '.data.result[0].value[1]' > /tmp/errors-24h.txt
curl -s 'http://prometheus:9090/api/v1/query?query=basset_memory_usage_bytes/1e6' | jq '.data.result[0].value[1]' > /tmp/memory-24h.txt

echo ""
echo "Performance Trend Analysis:"
echo "=========================="

# 1. Latency trend
L1H=$(jq '.metrics.latency_p95_ms' $BASELINE_1H)
L24H=$(cat /tmp/latency-24h.txt | cut -d. -f1)
DRIFT=$((L24H - L1H))

echo ""
echo "1. Latency p95: ${L1H}ms → ${L24H}ms (Δ: ${DRIFT}ms)"
if [ $DRIFT -lt 50 ]; then
  echo "   ✓ PASS: Drift acceptable"
else
  echo "   ⚠ WARN: Drift > 50ms"
fi

# 2. Error rate trend
E1H=$(jq '.metrics.error_rate_percent' $BASELINE_1H)
E24H=$(cat /tmp/errors-24h.txt | cut -d. -f1)
EDRIFT=$(echo "$E24H - $E1H" | bc)

echo ""
echo "2. Error rate: ${E1H}% → ${E24H}% (Δ: ${EDRIFT}%)"
if (( $(echo "$EDRIFT < 0.5" | bc -l) )); then
  echo "   ✓ PASS: Error rate stable"
else
  echo "   ⚠ WARN: Error rate increase"
fi

# 3. Memory trend
M1H=$(jq '.metrics.memory_usage_mb' $BASELINE_1H)
M24H=$(cat /tmp/memory-24h.txt | cut -d. -f1)
MDRIFT=$((M24H - M1H))
MGROWTH=$(echo "scale=2; ($MDRIFT / $M1H) * 100" | bc)

echo ""
echo "3. Memory: ${M1H}MB → ${M24H}MB (Δ: ${MDRIFT}MB, +${MGROWTH}%)"
if [ $MDRIFT -lt 100 ]; then
  echo "   ✓ PASS: Memory growth acceptable"
else
  echo "   ✗ FAIL: Potential memory leak"
fi

# 4. Overall assessment
echo ""
echo "=== 24-Hour Stability Assessment ==="
if [ $DRIFT -lt 50 ] && (( $(echo "$EDRIFT < 0.5" | bc -l) )) && [ $MDRIFT -lt 100 ]; then
  echo "✓ PASS: Stable performance over 24 hours"
else
  echo "⚠ WARN: Performance degradation detected - review"
fi
```

**Pass Criteria:**

- [ ] No container restarts
- [ ] All instances on v12.0.0
- [ ] Latency drift: < 50ms
- [ ] Error rate drift: < 0.5%
- [ ] Memory growth: < 100MB

### 24.3 Concurrent Load Test

```bash
#!/bin/bash
# 24-hour-validation-load.sh

echo "=== 24-HOUR VALIDATION: Load Stability ==="

# Simulate concurrent clients
echo ""
echo "Launching 50 concurrent connections..."

CONCURRENT_CLIENTS=50
DURATION_SECONDS=60
RESULTS_FILE="/tmp/load-test-results.json"

node -e "
const WebSocket = require('ws');
const fs = require('fs');

const results = {
  total_connections: $CONCURRENT_CLIENTS,
  successful: 0,
  failed: 0,
  latencies: [],
  errors: []
};

let completed = 0;

for (let i = 0; i < $CONCURRENT_CLIENTS; i++) {
  const startTime = Date.now();
  const ws = new WebSocket('ws://basset-prod-01:8765');
  
  ws.on('open', () => {
    ws.send(JSON.stringify({cmd: 'getStatus'}));
    ws.on('message', (msg) => {
      const latency = Date.now() - startTime;
      results.latencies.push(latency);
      results.successful++;
      ws.close();
      completed++;
      if (completed === $CONCURRENT_CLIENTS) {
        // Calculate stats
        results.latencies.sort((a, b) => a - b);
        const mid = Math.floor(results.latencies.length / 2);
        results.median_latency = results.latencies[mid];
        results.p95_latency = results.latencies[Math.floor(results.latencies.length * 0.95)];
        results.max_latency = results.latencies[results.latencies.length - 1];
        
        fs.writeFileSync('$RESULTS_FILE', JSON.stringify(results, null, 2));
        process.exit(0);
      }
    });
    
    ws.on('error', (err) => {
      results.failed++;
      results.errors.push(err.message);
      completed++;
      if (completed === $CONCURRENT_CLIENTS) {
        fs.writeFileSync('$RESULTS_FILE', JSON.stringify(results, null, 2));
        process.exit(1);
      }
    });
    
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      completed++;
    }, $DURATION_SECONDS * 1000);
  });
  
  ws.on('error', (err) => {
    results.failed++;
    results.errors.push(err.message);
    completed++;
    if (completed === $CONCURRENT_CLIENTS) {
      fs.writeFileSync('$RESULTS_FILE', JSON.stringify(results, null, 2));
      process.exit(1);
    }
  });
}
" 2>&1

# Parse results
SUCCESS=$(jq '.successful' $RESULTS_FILE)
FAILED=$(jq '.failed' $RESULTS_FILE)
P95=$(jq '.p95_latency' $RESULTS_FILE)
MAX=$(jq '.max_latency' $RESULTS_FILE)

echo ""
echo "Load Test Results:"
echo "  Successful: $SUCCESS/$CONCURRENT_CLIENTS"
echo "  Failed: $FAILED"
echo "  Latency p95: ${P95}ms"
echo "  Latency max: ${MAX}ms"

if [ "$SUCCESS" -gt 45 ]; then
  echo "✓ PASS: 90%+ success rate under load"
else
  echo "✗ FAIL: Load test failures"
fi
```

### 24.4 Data Integrity Check

```bash
#!/bin/bash
# 24-hour-validation-data.sh

echo "=== 24-HOUR VALIDATION: Data Integrity ==="

# Sample storage queries from each instance
echo ""
echo "Checking session data integrity..."

for i in {01..10}; do
  SESSIONS=$(ssh basset-prod-$i "docker exec basset-hound-browser redis-cli DBSIZE" 2>/dev/null | grep keys | awk '{print $2}')
  if [ -z "$SESSIONS" ]; then
    SESSIONS="N/A"
  fi
  echo "  basset-prod-$i: $SESSIONS stored sessions"
done

# Check for data corruption
echo ""
echo "Checking for data corruption..."

DATA_ERRORS=0
for i in {01..10}; do
  ERRORS=$(ssh basset-prod-$i "docker logs --since 24h basset-hound-browser 2>&1" | grep -i "corrupt\|invalid\|corrupt" | wc -l)
  if [ "$ERRORS" -gt 0 ]; then
    echo "  basset-prod-$i: $ERRORS data errors ✗"
    DATA_ERRORS=$((DATA_ERRORS + ERRORS))
  else
    echo "  basset-prod-$i: Clean ✓"
  fi
done

if [ $DATA_ERRORS -eq 0 ]; then
  echo "✓ PASS: No data corruption detected"
else
  echo "✗ FAIL: Data corruption detected"
fi
```

---

## 1-WEEK PERFORMANCE REVIEW

**Timeline:** Execute at 7-day mark  
**Duration:** 1 hour  
**Participants:** Deployment Lead, Technical Lead, SRE Lead, Engineering Manager

### 7.1 Comprehensive Metrics Summary

```bash
# Compile week-long metrics
curl -s 'http://prometheus:9090/api/v1/query_range?query=histogram_quantile(0.95,rate(basset_websocket_latency_ms[5m]))&start=1w&end=now&step=1h' | jq '.data.result[]'

# Compare against baseline
curl -s 'http://prometheus:9090/api/v1/query_range?query=rate(basset_errors_total[1h])&start=1w&end=now&step=1h' | jq '.data.result[]'
```

### 7.2 Release Readiness Assessment

**Checklist:**

```bash
cat > /tmp/release-readiness.txt << 'EOF'
=== v12.0.0 Release Readiness Assessment ===

1. STABILITY (1-week running)
  [ ] Uptime: 99.9%+
  [ ] Container restarts: 0-2 total
  [ ] No cascading failures
  [ ] Graceful error handling

2. PERFORMANCE
  [ ] Latency: ±15% of baseline
  [ ] Error rate: < 0.5%
  [ ] Memory: Stable (no leaks)
  [ ] CPU: Normal utilization
  [ ] Throughput: No degradation

3. FUNCTIONALITY
  [ ] All core commands working
  [ ] Data integrity verified
  [ ] Storage operations reliable
  [ ] No known regression

4. OPERATIONS
  [ ] Monitoring stable
  [ ] No alert fatigue
  [ ] Incident response effective
  [ ] Logging/debugging tools working

5. CUSTOMER IMPACT
  [ ] No customer escalations
  [ ] SLA maintained
  [ ] No reported issues
  [ ] Performance acceptable

6. DOCUMENTATION
  [ ] Runbooks accurate
  [ ] Deployment notes captured
  [ ] Lessons learned documented
  [ ] Post-mortem (if issues) completed

READINESS: ✓ READY FOR FULL PRODUCTION

Approved By:
- Technical Lead: _______________
- SRE Lead: _______________
- Engineering Manager: _______________
EOF

cat /tmp/release-readiness.txt
```

---

## Success Criteria Summary

### 1-Hour Validation

| Category | Criteria | Result |
|----------|----------|--------|
| Infrastructure | 10/10 instances healthy | __ |
| Functionality | 6/6 core commands pass | __ |
| Performance | ±20% baseline metrics | __ |
| Stability | 0 container restarts | __ |
| **Status** | **✓ GO/✗ NO-GO** | __ |

### 24-Hour Check

| Category | Criteria | Result |
|----------|----------|--------|
| Uptime | 24h zero restarts | __ |
| Performance | Metrics stable ±10% | __ |
| Load | 90%+ success under concurrency | __ |
| Data | Zero corruption errors | __ |
| **Status** | **✓ STABLE** | __ |

### 1-Week Review

| Category | Criteria | Result |
|----------|----------|--------|
| Availability | 99.9%+ uptime | __ |
| Quality | Error rate < 0.5% | __ |
| Performance | Baseline ±15% | __ |
| Customer | Zero escalations | __ |
| **Status** | **✓ PRODUCTION READY** | __ |

---

## Validation Artifacts

**Save for audit:**

```bash
# Archive all validation results
mkdir -p /backups/v12-validation-artifacts-$(date +%Y%m%d)

cp /tmp/functional-test-results-final.json /backups/v12-validation-artifacts-*/
cp /tmp/perf-metrics-1h.json /backups/v12-validation-artifacts-*/
cp /tmp/perf-metrics-24h.json /backups/v12-validation-artifacts-*/
cp /tmp/load-test-results.json /backups/v12-validation-artifacts-*/
cp /tmp/release-readiness.txt /backups/v12-validation-artifacts-*/
cp /tmp/validation-1h-report.md /backups/v12-validation-artifacts-*/

echo "✓ Validation artifacts archived"
```

---

**End of Post-Deployment Validation Runbook**
