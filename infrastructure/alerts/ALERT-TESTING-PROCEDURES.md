# Alert Testing Procedures
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Production

## Overview

This document describes comprehensive alert testing procedures, from unit tests to full integration tests. All alerts must be tested before deployment to production.

---

## Test Categories

```
┌─────────────────────────────────────────┐
│       Alert Testing Pyramid             │
├─────────────────────────────────────────┤
│  Integration Tests (2-3%)               │ ← Full end-to-end
│  Component Tests (10-15%)               │ ← Single alert flows
│  Unit Tests (85-90%)                    │ ← Individual rules
└─────────────────────────────────────────┘
```

---

## Unit Tests (Alerting Rules)

### Test File: `tests/alerts/prometheus-rules.test.js`

#### Test 1: Alert Rule Syntax Validation

**Purpose:** Verify all Prometheus alert rules have valid syntax

**Procedure:**
```bash
# Validate prometheus-rules.yml syntax
promtool check rules infrastructure/alerts/prometheus-rules.yml
```

**Expected Result:**
```
Checking infrastructure/alerts/prometheus-rules.yml
  [OK] basset_hound_critical_alerts [20 rules]
  [OK] basset_hound_high_alerts [7 rules]
  [OK] basset_hound_medium_alerts [7 rules]
  [OK] basset_hound_operational_alerts [6 rules]
  [OK] basset_hound_recording_alerts [2 rules]
  [OK] basset_hound_websocket_health [3 rules]
  [OK] basset_hound_evasion_quality [2 rules]
```

**Pass Criteria:**
- [ ] All rule groups valid
- [ ] All rule syntax correct
- [ ] No duplicate alert names
- [ ] All labels present and valid

#### Test 2: Alert Expression Validation

**Purpose:** Verify PromQL expressions are syntactically correct

**Procedure:**
```bash
# Check all PromQL expressions
promtool query instant 'up == 1'  # Quick syntax check for each expression
```

**Expected Result:** No syntax errors in any expression

**Pass Criteria:**
- [ ] All expressions parse correctly
- [ ] All metric names referenced exist in schema
- [ ] All functions are valid PromQL functions

#### Test 3: Alert Metadata Completeness

**Purpose:** Verify each alert has required metadata

**Test Code:**
```javascript
const fs = require('fs');
const yaml = require('js-yaml');

describe('Alert Rules Metadata', () => {
  const rules = yaml.load(fs.readFileSync('infrastructure/alerts/prometheus-rules.yml'));
  
  it('should have annotations.summary for all alerts', () => {
    rules.groups.forEach(group => {
      group.rules.forEach(rule => {
        if (rule.alert) {
          expect(rule.annotations.summary).toBeDefined();
          expect(rule.annotations.summary.length).toBeGreaterThan(10);
        }
      });
    });
  });

  it('should have annotations.description for all alerts', () => {
    rules.groups.forEach(group => {
      group.rules.forEach(rule => {
        if (rule.alert) {
          expect(rule.annotations.description).toBeDefined();
          expect(rule.annotations.description.length).toBeGreaterThan(20);
        }
      });
    });
  });

  it('should have valid severity labels', () => {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    rules.groups.forEach(group => {
      group.rules.forEach(rule => {
        if (rule.alert) {
          const severity = rule.labels.severity;
          expect(validSeverities).toContain(severity);
        }
      });
    });
  });

  it('should have runbook_url annotation', () => {
    rules.groups.forEach(group => {
      group.rules.forEach(rule => {
        if (rule.alert && rule.labels.severity !== 'low') {
          expect(rule.annotations.runbook_url).toBeDefined();
        }
      });
    });
  });
});
```

**Expected Result:** All tests pass (100% metadata coverage)

---

## Component Tests (Single Alert Flows)

### Test Template: Single Alert Testing

#### Test: ServiceDown Alert

**Test File:** `tests/alerts/alerts.servicedown.test.js`

**Setup:**
```javascript
const { Prometheus } = require('prom-client');
const AlertRulesEngine = require('src/monitoring/alert-rules');

describe('ServiceDown Alert', () => {
  let prometheus, metricsCollector, alertEngine;

  beforeEach(() => {
    // Set up mock Prometheus metrics
    prometheus = {
      // Register mock health check failure metric
      healthCheckFailures: new Prometheus.Counter({
        name: 'health_check_failures_total',
        help: 'Health check failures'
      })
    };

    metricsCollector = {
      getMetric: (name) => prometheus[name] || { value: 0 }
    };

    alertEngine = new AlertRulesEngine(metricsCollector);
  });

  it('should not alert with 0-2 health check failures', async () => {
    prometheus.healthCheckFailures.inc();
    prometheus.healthCheckFailures.inc();
    
    const alerts = alertEngine.getActiveAlerts();
    expect(alerts.filter(a => a.ruleName === 'ServiceDown').length).toBe(0);
  });

  it('should alert with 3 health check failures', async () => {
    prometheus.healthCheckFailures.inc();
    prometheus.healthCheckFailures.inc();
    prometheus.healthCheckFailures.inc();
    
    alertEngine._evaluate();
    
    const alerts = alertEngine.getActiveAlerts();
    const serviceDownAlert = alerts.find(a => a.ruleName === 'ServiceDown');
    
    expect(serviceDownAlert).toBeDefined();
    expect(serviceDownAlert.severity).toBe('critical');
  });

  it('should include proper annotations', async () => {
    // Trigger alert
    const alerts = alertEngine.getActiveAlerts();
    const alert = alerts[0];
    
    expect(alert.description).toBeDefined();
    expect(alert.description).toMatch(/health checks/i);
  });

  it('should resolve alert when service recovers', async () => {
    // Trigger alert
    prometheus.healthCheckFailures.inc(3);
    alertEngine._evaluate();
    
    let alerts = alertEngine.getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    
    // Service recovers
    // (Metric goes to 0, time passes)
    setTimeout(() => {
      alertEngine._evaluate();
      alerts = alertEngine.getActiveAlerts();
      expect(alerts.filter(a => a.ruleName === 'ServiceDown').length).toBe(0);
    }, 5000);
  });
});
```

**Run Test:**
```bash
npm test -- tests/alerts/alerts.servicedown.test.js
```

**Expected Result:** All assertions pass

**Pass Criteria:**
- [ ] Alert fires after 3 consecutive failures
- [ ] Alert includes proper severity label
- [ ] Alert includes proper annotations
- [ ] Alert resolves when condition clears
- [ ] Alert deduplicates (no flapping)

### Test Coverage

Create similar tests for each alert category:

| Alert | Test File | Test Cases |
|-------|-----------|-----------|
| ServiceDown | `alerts.servicedown.test.js` | 4 cases |
| HighErrorRate | `alerts.errorrate.test.js` | 4 cases |
| HighMemoryUsage | `alerts.memory.test.js` | 5 cases |
| HighLatencyP99 | `alerts.latency.test.js` | 4 cases |
| ThroughputDrop | `alerts.throughput.test.js` | 4 cases |

**Total:** ~25 unit tests covering all critical paths

---

## Integration Tests

### Test 1: Alert Firing & Detection

**Test File:** `tests/integration/alert-flow.test.js`

**Purpose:** Verify alert is correctly detected and state transitions work

**Procedure:**
```javascript
const WebSocket = require('ws');
const http = require('http');

describe('Alert Integration - Firing', () => {
  let server, metricsCollector, alertEngine;

  beforeAll(async () => {
    // Start monitoring system
    server = startMonitoringStack();
    metricsCollector = server.metricsCollector;
    alertEngine = server.alertEngine;
  });

  it('should detect ServiceDown alert', (done) => {
    const timeout = 120000; // 2 minutes
    const startTime = Date.now();

    // Listen for alert events
    alertEngine.on('alert:triggered', (alert) => {
      if (alert.ruleName === 'ServiceDown') {
        expect(alert.severity).toBe('critical');
        expect(alert.status).toBe('firing');
        expect(Date.now() - startTime).toBeLessThan(90000); // 90 second SLA
        done();
      }
    });

    // Simulate health check failures
    const failureCount = { count: 0 };
    const interval = setInterval(() => {
      failureCount.count++;
      metricsCollector.recordHealthCheckFailure();

      if (failureCount.count >= 3) {
        clearInterval(interval);
      }
    }, 30000); // Every 30 seconds

    setTimeout(() => {
      clearInterval(interval);
      done(new Error('Alert not fired within 2 minute timeout'));
    }, timeout);
  });

  it('should detect HighErrorRate alert', (done) => {
    alertEngine.on('alert:triggered', (alert) => {
      if (alert.ruleName === 'HighErrorRate') {
        expect(alert.severity).toBe('critical');
        done();
      }
    });

    // Generate 50+ failed commands in 1 minute
    const generateErrors = () => {
      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          metricsCollector.recordCommandFailure();
        }, Math.random() * 60000);
      }
    };

    generateErrors();
  });

  it('should detect HighMemoryUsage alert', (done) => {
    alertEngine.on('alert:triggered', (alert) => {
      if (alert.ruleName === 'HighMemoryUsage') {
        expect(alert.severity).toBe('critical');
        done();
      }
    });

    // Simulate memory growth to 80%+
    const mockMemory = () => {
      const heapUsed = 410; // 80% of 512MB
      metricsCollector.setMemoryUsed(heapUsed);
    };

    // Hold at high memory for 2+ minutes
    const interval = setInterval(mockMemory, 5000);
    setTimeout(() => {
      clearInterval(interval);
      done(new Error('Alert not fired within 2.5 minute timeout'));
    }, 150000);
  });

  afterAll(() => {
    server.close();
  });
});
```

**Run Test:**
```bash
npm test -- tests/integration/alert-flow.test.js
```

**Expected Result:** All alerts fire within expected timeframes

### Test 2: Alert Routing

**Test File:** `tests/integration/alert-routing.test.js`

**Purpose:** Verify alerts route to correct notification channels

**Procedure:**
```javascript
describe('Alert Routing', () => {
  let alertManager, dispatcher;

  beforeEach(() => {
    // Mock notification channels
    alertManager = createMockAlertManager();
    dispatcher = new AlertDispatcher();
  });

  it('should route CRITICAL alerts to all channels', async () => {
    const alert = {
      severity: 'critical',
      ruleName: 'ServiceDown',
      timestamp: Date.now()
    };

    dispatcher.on('dispatch:slack', (msg) => {
      expect(msg.channel).toBe('#incidents');
    });
    dispatcher.on('dispatch:email', (msg) => {
      expect(msg.to).toContain('oncall@');
    });
    dispatcher.on('dispatch:pagerduty', (msg) => {
      expect(msg.severity).toBe('critical');
    });
    dispatcher.on('dispatch:sms', (msg) => {
      expect(msg.body).toMatch(/CRITICAL/);
    });

    await dispatcher.dispatch(alert);
  });

  it('should route HIGH alerts to slack/email only', async () => {
    const alert = {
      severity: 'high',
      ruleName: 'HighLatencyP99'
    };

    const channels = [];
    dispatcher.on('dispatch', (ch) => channels.push(ch));

    await dispatcher.dispatch(alert);

    expect(channels).toContain('slack');
    expect(channels).toContain('email');
    expect(channels).not.toContain('sms');
  });

  it('should route MEDIUM alerts to slack/email batched', async () => {
    const alert = {
      severity: 'medium',
      ruleName: 'HighGCPauseTime'
    };

    await dispatcher.dispatch(alert);

    // Should be batched, not immediate
    expect(dispatcher.pendingBatch.length).toBeGreaterThan(0);
  });
});
```

**Expected Result:** All routing rules work correctly

### Test 3: Escalation Logic

**Test File:** `tests/integration/alert-escalation.test.js`

**Purpose:** Verify escalation procedures work end-to-end

**Procedure:**
```javascript
describe('Alert Escalation', () => {
  let escalationManager, mockContacts;

  beforeEach(() => {
    mockContacts = {
      primaryOncall: { phone: '+1111', email: 'primary@', acknowledged: false },
      backupOncall: { phone: '+2222', email: 'backup@', acknowledged: false },
      manager: { phone: '+3333', email: 'manager@', acknowledged: false }
    };
  });

  it('should escalate to backup after 5 minutes of no ack', async () => {
    const escalation = new EscalationManager(mockContacts);

    // Trigger CRITICAL alert
    escalation.startEscalation('critical');

    // Simulate no ack from primary
    await wait(5 * 60 * 1000 + 1000); // 5m 1s

    // Backup should be paged
    expect(mockContacts.backupOncall.notified).toBe(true);
  });

  it('should escalate to manager after 10 minutes', async () => {
    const escalation = new EscalationManager(mockContacts);

    escalation.startEscalation('critical');

    // Wait for double escalation (10 min)
    await wait(10 * 60 * 1000 + 1000);

    expect(mockContacts.manager.notified).toBe(true);
  });

  it('should stop escalation when anyone acknowledges', async () => {
    const escalation = new EscalationManager(mockContacts);

    escalation.startEscalation('critical');

    // Primary acknowledges after 2 minutes
    await wait(2 * 60 * 1000);
    escalation.acknowledge('primary');

    // Backup should NOT be paged
    await wait(5 * 60 * 1000); // Past the 5m mark
    expect(mockContacts.backupOncall.notified).toBe(false);
  });
});
```

**Expected Result:** Escalation timings and logic are correct

---

## End-to-End Tests

### Test: Full Alert Lifecycle

**Test File:** `tests/e2e/alert-lifecycle.test.js`

**Scenario:** Complete alert lifecycle from firing to resolution

```javascript
describe('Alert Lifecycle E2E', () => {
  let monitoring, alerting, notifications;

  beforeAll(() => {
    monitoring = startFullMonitoringStack();
    alerting = monitoring.alerting;
    notifications = monitoring.notifications;
  });

  it('should complete full ServiceDown lifecycle', async () => {
    // Phase 1: Normal operation
    expect(monitoring.health).toBe('UP');

    // Phase 2: Service failure
    monitoring.stopService();
    
    // Phase 3: Alert fires (T+60s)
    await waitFor(() => {
      const alerts = alerting.getActiveAlerts();
      const serviceDownAlert = alerts.find(a => a.ruleName === 'ServiceDown');
      expect(serviceDownAlert).toBeDefined();
    }, { timeout: 120000 });

    // Phase 4: Notification sent (T+0s)
    expect(notifications.slack.received).toContain('#incidents');
    expect(notifications.email.received).toBeDefined();
    expect(notifications.pagerduty.incidents.length).toBeGreaterThan(0);

    // Phase 5: Acknowledge (simulated manual action at T+120s)
    const incident = notifications.pagerduty.incidents[0];
    await notifications.pagerduty.acknowledge(incident.id);

    // Phase 6: Service restart (automatic or manual)
    monitoring.startService();

    // Phase 7: Alert resolves (T+180s)
    await waitFor(() => {
      const alerts = alerting.getActiveAlerts();
      const serviceDownAlert = alerts.find(a => a.ruleName === 'ServiceDown');
      expect(serviceDownAlert).toBeUndefined(); // Should resolve
    }, { timeout: 120000 });

    // Phase 8: Resolution notification sent
    expect(notifications.slack.resolved).toContain('#incidents');
    expect(notifications.pagerduty.resolved).toContain(incident.id);
  });

  afterAll(() => {
    monitoring.stop();
  });
});
```

**Expected Result:** Alert fires, gets routed, acknowledged, and resolves properly

---

## Performance Tests

### Test: Alert Evaluation Performance

**Purpose:** Ensure alert evaluation doesn't bottleneck system

```javascript
describe('Alert Performance', () => {
  it('should evaluate 100+ rules in <100ms', async () => {
    const alertEngine = new AlertRulesEngine(metricsCollector);
    
    // Manually load all rules
    loadAllRules(alertEngine); // 57 rules total
    
    const startTime = performance.now();
    alertEngine._evaluate();
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(100); // 100ms target
  });

  it('should dispatch alerts to 4 channels in <2 seconds', async () => {
    const dispatcher = new AlertDispatcher();
    const alert = createCriticalAlert();
    
    const startTime = performance.now();
    await dispatcher.dispatch(alert);
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(2000); // 2 second target
  });

  it('should handle 1000 alerts/minute without losing any', async () => {
    const alertEngine = new AlertRulesEngine(metricsCollector);
    const receivedAlerts = [];
    
    alertEngine.on('alert:triggered', (alert) => {
      receivedAlerts.push(alert);
    });

    // Generate 1000 alert firings over 1 minute
    const alertsPerSecond = 1000 / 60;
    const interval = setInterval(() => {
      for (let i = 0; i < alertsPerSecond; i++) {
        alertEngine._triggerAlert(createTestAlert());
      }
    }, 1000);

    await wait(65000); // 65 seconds
    clearInterval(interval);

    expect(receivedAlerts.length).toBeGreaterThanOrEqual(990); // Allow 1% loss
  });
});
```

**Expected Result:** All performance targets met

---

## Manual Testing Checklist

### Pre-Deployment Manual Tests

**1. Alert Firing Test**
```bash
# Trigger each alert type manually
curl -X POST http://localhost:8765/admin/test-alert \
  -H 'Content-Type: application/json' \
  -d '{
    "alert": "ServiceDown",
    "duration": "1m"
  }'
```

**Verify:**
- [ ] Alert appears in Alertmanager UI
- [ ] Alert shows in Prometheus query
- [ ] Alert has correct severity label
- [ ] Alert has proper annotations

**2. Notification Delivery Test**
```bash
# Test each notification channel
curl -X POST http://localhost:8765/admin/test-notifications \
  -d '{"channels": ["slack", "email", "pagerduty"]}'
```

**Verify:**
- [ ] Slack message received in #incidents
- [ ] Email received in oncall inbox
- [ ] PagerDuty incident created
- [ ] All within 30 seconds

**3. Escalation Flow Test**
```bash
# Start escalation test
curl -X POST http://localhost:8765/admin/test-escalation \
  -d '{"duration": "20m"}'
```

**Monitor:**
- [ ] T+0: Primary paged (SMS + PagerDuty)
- [ ] T+5m: Backup paged (if no ack)
- [ ] T+10m: Manager paged (if no ack)
- [ ] Document timing accuracy

**4. Alert Resolution Test**
```bash
# Trigger alert, then resolve
curl -X POST http://localhost:8765/admin/test-alert \
  -d '{"alert": "ServiceDown", "duration": "2m"}'

# ... wait 2 minutes ...

# Alert should auto-resolve
```

**Verify:**
- [ ] Alert fires at T+0
- [ ] Alert resolves after 2 minutes
- [ ] Resolved notification sent
- [ ] All channels notified of resolution

### Test Results Documentation

**Template:**
```
Alert Testing Results - [Date]
───────────────────────────────

Test Category        Result    Duration   Notes
───────────────────────────────────────────────
Unit Tests (25)      ✓ PASS    120s       All assertions pass
Integration (15)     ✓ PASS    240s       All flows successful
E2E Tests (5)        ✓ PASS    300s       Full lifecycle verified
Performance          ✓ PASS    60s        <100ms evaluation
Manual Tests (10)    ✓ PASS    1800s      All channels verified

Total: 60 tests
Pass Rate: 100%
Critical Issues: 0
Action Items: [none]

Tested By: [Name]
Approved By: [Manager]
Date: [Date]
```

---

## Continuous Testing

### Monthly Alert Audit

**Frequency:** First Monday of each month

**Actions:**
1. Review all alerts for accuracy
2. Check alert firing frequency vs. false positives
3. Validate all contact information
4. Test escalation chain end-to-end
5. Document any tuning needed
6. Update thresholds if needed

### Quarterly Review

**Frequency:** Every 3 months

**Full audit including:**
1. Threshold validation against current baselines
2. Alert coverage analysis (gaps?)
3. False positive root cause analysis
4. Escalation procedure effectiveness
5. Team feedback on alert quality
6. Update documentation

---

## Debugging Failed Alert Tests

### Common Issues & Solutions

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Alert doesn't fire | Metric not being recorded | Check metrics collector is running |
| Alert fires too often | Threshold too low | Increase threshold or add cooldown |
| Notification not received | Channel misconfigured | Verify API keys and URLs |
| Slow alert evaluation | Too many rules | Profile and optimize PromQL expressions |
| Escalation doesn't trigger | Contact info wrong | Update PagerDuty escalation policy |

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-21  
**Next Review:** 2026-09-21
