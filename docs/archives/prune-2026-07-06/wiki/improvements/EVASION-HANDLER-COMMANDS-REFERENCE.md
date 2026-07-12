# v12.9.0 Feature 3: Predictive Evasion Handler - WebSocket Commands Reference

**Quick Reference Guide**  
**Version:** v12.9.0  
**Date:** July 3, 2026  
**Total Commands:** 6

---

## Command Summary Table

| # | Command | Purpose | Input | Output |
|---|---------|---------|-------|--------|
| 1 | `predict_detection_risk` | Score detection probability | Context (UA, timing, WebGL, network) | Risk score 0-100, risk level |
| 2 | `get_adaptive_response` | Get response strategies | Probability score | Selected strategies with config |
| 3 | `apply_evasion_strategies` | Execute strategies | Strategy list | Application results/success rates |
| 4 | `record_pattern_usage` | Record learning data | Pattern, strategy, outcome | Updated effectiveness score |
| 5 | `get_evasion_metrics` | Get statistics | History limit (optional) | Metrics, learning stats, history |
| 6 | `reset_evasion_learning` | Clear all data | None | Confirmation of cleared items |

---

## 1. predict_detection_risk

**Purpose:** Calculate bot detection probability (0-100%) and risk level

**Endpoint:** WebSocket command
**Method:** Request-Response
**Complexity:** Low
**Response Time:** <5ms typical

### Request

```json
{
  "command": "predict_detection_risk",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "navigationTiming": {
    "navigationStart": 1688393100000,
    "loadEventEnd": 1688393150000
  },
  "webGLInfo": {
    "vendor": "Google Inc. (NVIDIA)",
    "renderer": "ANGLE (NVIDIA GeForce GTX 1080)"
  },
  "networkMetrics": {
    "requestCount": 45,
    "averageLatency": 85
  }
}
```

### Response

```json
{
  "success": true,
  "overallScore": 62.5,
  "riskLevel": "HIGH",
  "vectorScores": {
    "headless_detection": 45.2,
    "fingerprinting": 67.8,
    "behavioral_analysis": 58.9,
    "network_analysis": 72.3,
    "plugin_detection": 38.1,
    "storage_analysis": 55.2
  },
  "vectors": {
    "headless_detection": 45.2,
    "fingerprinting": 67.8,
    "behavioral_analysis": 58.9,
    "network_analysis": 72.3,
    "plugin_detection": 38.1,
    "storage_analysis": 55.2
  },
  "timestamp": "2026-07-03T12:00:00.000Z",
  "confidence": 0.85
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid context object"
}
```

### Use Cases

- ✅ Pre-request risk assessment before making web requests
- ✅ Real-time detection threat monitoring
- ✅ Trigger strategy selection based on threshold
- ✅ Log and audit detection patterns
- ✅ Feed into alerting systems

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAgent | string | No | Browser user agent for analysis |
| navigationTiming | object | No | Navigation timing metrics |
| webGLInfo | object | No | WebGL vendor/renderer info |
| networkMetrics | object | No | Network request statistics |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| success | boolean | Operation success |
| overallScore | number | Combined detection probability (0-100) |
| riskLevel | string | MINIMAL / LOW / MEDIUM / HIGH / CRITICAL |
| vectorScores | object | Individual vector scores (0-100) |
| timestamp | string | ISO 8601 timestamp |
| confidence | number | Scoring confidence (0-1) |

---

## 2. get_adaptive_response

**Purpose:** Get recommended evasion strategies based on detection risk

**Endpoint:** WebSocket command
**Method:** Request-Response
**Complexity:** Medium
**Response Time:** <10ms typical

### Request

```json
{
  "command": "get_adaptive_response",
  "probabilityScore": 62.5,
  "riskLevel": "HIGH",
  "includeConfig": true
}
```

### Response

```json
{
  "success": true,
  "responseIntensity": 6,
  "selectedStrategies": [
    {
      "name": "webgl_spoofing",
      "patternName": "fingerprint_protection",
      "strategyId": "fingerprint_protection_strategy_1",
      "effectiveness": 0.90,
      "successRate": 0.87,
      "config": {
        "spoofVendor": true,
        "spoofRenderer": true,
        "cycleExtensions": true
      }
    },
    {
      "name": "natural_mouse_movement",
      "patternName": "behavioral_naturalization",
      "strategyId": "behavioral_naturalization_strategy_0",
      "effectiveness": 0.88,
      "successRate": 0.92,
      "config": {
        "useFittsLaw": true,
        "addTremor": true,
        "allowOvershoots": true
      }
    },
    {
      "name": "tls_version_rotation",
      "patternName": "network_obfuscation",
      "strategyId": "network_obfuscation_strategy_0",
      "effectiveness": 0.79,
      "successRate": 0.78,
      "config": {
        "versions": ["TLS1.2", "TLS1.3"],
        "rotateInterval": 3600,
        "supportedVersions": 3
      }
    },
    {
      "name": "canvas_randomization",
      "patternName": "fingerprint_protection",
      "strategyId": "fingerprint_protection_strategy_3",
      "effectiveness": 0.82,
      "successRate": 0.80,
      "config": {
        "randomizePixels": true,
        "noiseLevel": "medium",
        "preserveRealistic": true
      }
    },
    {
      "name": "realistic_plugin_list",
      "patternName": "plugin_masking",
      "strategyId": "plugin_masking_strategy_0",
      "effectiveness": 0.84,
      "successRate": 0.85,
      "config": {
        "includeCommon": true,
        "mimeTypes": 10,
        "pattern": "os_specific"
      }
    },
    {
      "name": "storage_quota_alignment",
      "patternName": "storage_normalization",
      "strategyId": "storage_normalization_strategy_0",
      "effectiveness": 0.76,
      "successRate": 0.82,
      "config": {
        "alignToOS": true,
        "quota": 52428800,
        "pattern": "realistic"
      }
    }
  ],
  "totalStrategies": 6,
  "estimatedEffectiveness": 0.85,
  "patterns": [
    "fingerprint_protection",
    "behavioral_naturalization",
    "network_obfuscation",
    "plugin_masking",
    "storage_normalization"
  ],
  "applicableTo": [
    "webgl_fingerprinting",
    "mouse_movement",
    "tls_fingerprinting",
    "canvas_fingerprinting",
    "plugin_enumeration",
    "storage_quota"
  ],
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

### Use Cases

- ✅ Get recommended strategies before request
- ✅ Plan evasion approach based on risk level
- ✅ Customize strategy selection manually
- ✅ Test different risk scenarios
- ✅ Integration with external decision systems

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| probabilityScore | number | **Yes** | Detection probability 0-100 |
| riskLevel | string | No | Override risk level (MINIMAL/LOW/MEDIUM/HIGH/CRITICAL) |
| includeConfig | boolean | No | Include strategy configs (default: true) |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| responseIntensity | number | Strategy count to apply (1-8) |
| selectedStrategies | array | Array of strategy objects |
| totalStrategies | number | Number of selected strategies |
| estimatedEffectiveness | number | Average effectiveness 0-1 |
| patterns | array | Unique pattern names |
| applicableTo | array | Detection techniques addressed |
| timestamp | string | ISO 8601 timestamp |

---

## 3. apply_evasion_strategies

**Purpose:** Apply selected evasion strategies to current session

**Endpoint:** WebSocket command
**Method:** Request-Response (async)
**Complexity:** High
**Response Time:** 10-50ms typical

### Request

```json
{
  "command": "apply_evasion_strategies",
  "strategies": [
    {
      "name": "webgl_spoofing",
      "patternName": "fingerprint_protection",
      "strategyId": "fingerprint_protection_strategy_1",
      "effectiveness": 0.90,
      "config": {
        "spoofVendor": true,
        "spoofRenderer": true,
        "cycleExtensions": true
      }
    },
    {
      "name": "natural_mouse_movement",
      "patternName": "behavioral_naturalization",
      "strategyId": "behavioral_naturalization_strategy_0",
      "effectiveness": 0.88,
      "config": {
        "useFittsLaw": true,
        "addTremor": true
      }
    }
  ],
  "context": {
    "domain": "example.com",
    "userType": "residential",
    "region": "US"
  }
}
```

### Response

```json
{
  "success": true,
  "totalApplied": 2,
  "successfulApplications": 2,
  "successRate": 1.0,
  "results": [
    {
      "strategyId": "fingerprint_protection_strategy_1",
      "success": true,
      "appliedAt": "2026-07-03T12:00:00.123Z",
      "error": null
    },
    {
      "strategyId": "behavioral_naturalization_strategy_0",
      "success": true,
      "appliedAt": "2026-07-03T12:00:00.145Z",
      "error": null
    }
  ],
  "timestamp": "2026-07-03T12:00:01.000Z"
}
```

### Use Cases

- ✅ Execute selected strategies
- ✅ Batch strategy application
- ✅ Automated evasion workflows
- ✅ Integration with orchestration systems
- ✅ Feedback loop for learning system

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| strategies | array | **Yes** | Array of strategy objects to apply |
| context | object | No | Context for learning system |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| totalApplied | number | Total strategies attempted |
| successfulApplications | number | Successful applications |
| successRate | number | Success ratio (0-1) |
| results | array | Per-strategy results |
| timestamp | string | ISO 8601 timestamp |

---

## 4. record_pattern_usage

**Purpose:** Record pattern usage and outcome for learning system

**Endpoint:** WebSocket command
**Method:** Request-Response
**Complexity:** Low
**Response Time:** <2ms typical

### Request

```json
{
  "command": "record_pattern_usage",
  "patternName": "fingerprint_protection",
  "strategyId": "fingerprint_protection_strategy_1",
  "success": true,
  "context": {
    "domain": "example.com",
    "userType": "residential",
    "detectionService": "DataDome"
  }
}
```

### Response

```json
{
  "success": true,
  "recorded": true,
  "effectiveness": 0.87,
  "usageCount": 42,
  "successRate": 0.88,
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

### Use Cases

- ✅ Record external validation results
- ✅ A/B testing integration
- ✅ Continuous learning feedback
- ✅ Manual outcome verification
- ✅ Batch feedback processing

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| patternName | string | **Yes** | Pattern name |
| strategyId | string | **Yes** | Strategy identifier |
| success | boolean | **Yes** | Success outcome |
| context | object | No | Context factors for learning |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| recorded | boolean | Recording confirmed |
| effectiveness | number | Current effectiveness score (0-1) |
| usageCount | number | Total pattern uses |
| successRate | number | Historical success rate (0-1) |
| timestamp | string | ISO 8601 timestamp |

---

## 5. get_evasion_metrics

**Purpose:** Get current evasion metrics and statistics

**Endpoint:** WebSocket command
**Method:** Request-Response
**Complexity:** Medium
**Response Time:** <5ms typical

### Request

```json
{
  "command": "get_evasion_metrics",
  "includeHistory": true,
  "historyLimit": 20
}
```

### Response

```json
{
  "success": true,
  "metrics": {
    "totalRequests": 1543,
    "successfulEvasions": 1389,
    "failedEvasions": 154,
    "averageScore": 58.3,
    "evasionRate": 0.90,
    "uptime": 86400000,
    "learningStatistics": {
      "totalPatternsMeasured": 12,
      "patternsWithSufficientData": 8,
      "averageSuccessRate": 0.82,
      "totalUsageRecorded": 1543,
      "topPerformingPatterns": [
        {
          "patternName": "fingerprint_protection",
          "strategyId": "fingerprint_protection_strategy_1",
          "successRate": 0.95,
          "usageCount": 245
        },
        {
          "patternName": "behavioral_naturalization",
          "strategyId": "behavioral_naturalization_strategy_0",
          "successRate": 0.92,
          "usageCount": 212
        }
      ]
    }
  },
  "status": {
    "enabled": true,
    "patternsAvailable": 6,
    "detectionVectors": 6
  },
  "recentScores": [
    {
      "overallScore": 62.5,
      "riskLevel": "HIGH",
      "timestamp": "2026-07-03T12:00:00.000Z"
    },
    {
      "overallScore": 55.2,
      "riskLevel": "MEDIUM",
      "timestamp": "2026-07-03T11:59:50.000Z"
    }
  ],
  "recentResponses": [
    {
      "probabilityScore": 62.5,
      "riskLevel": "HIGH",
      "totalStrategies": 6,
      "timestamp": "2026-07-03T12:00:01.000Z"
    }
  ],
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

### Use Cases

- ✅ Performance monitoring and analytics
- ✅ Evasion effectiveness tracking
- ✅ Learning system health assessment
- ✅ Dashboard and reporting
- ✅ SLA tracking and alerting

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| includeHistory | boolean | No | Include recent history |
| historyLimit | number | No | Number of entries (default: 10) |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| metrics | object | Comprehensive metrics object |
| status | object | Current status info |
| recentScores | array | Recent detection scores (if requested) |
| recentResponses | array | Recent responses (if requested) |
| timestamp | string | ISO 8601 timestamp |

---

## 6. reset_evasion_learning

**Purpose:** Reset evasion handler statistics and learning data

**Endpoint:** WebSocket command
**Method:** Request-Response
**Complexity:** Low
**Response Time:** <2ms typical

### Request

```json
{
  "command": "reset_evasion_learning",
  "clearAll": true
}
```

### Response

```json
{
  "success": true,
  "reset": true,
  "clearedMetrics": [
    "totalRequests",
    "successfulEvasions",
    "failedEvasions",
    "averageScore",
    "probabilityHistory",
    "strategyHistory",
    "learningData"
  ],
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

### Use Cases

- ✅ Performance baseline reset
- ✅ Testing and QA scenarios
- ✅ Periodic cache cleanup
- ✅ A/B testing segment separation
- ✅ Production troubleshooting

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| clearAll | boolean | No | Clear all data (default: true) |

### Response Fields

| Name | Type | Description |
|------|------|-------------|
| reset | boolean | Reset confirmation |
| clearedMetrics | array | List of cleared items |
| timestamp | string | ISO 8601 timestamp |

---

## Error Handling

All commands follow consistent error handling:

```json
{
  "success": false,
  "error": "Parameter 'probabilityScore' is required"
}
```

### Common Error Codes

| Scenario | Response |
|----------|----------|
| Missing required parameter | `success: false, error: "Parameter 'X' is required"` |
| Invalid server instance | `success: false, error: "Invalid server instance"` |
| Out of range values | `success: false, error: "Value out of valid range"` |
| Internal processing error | `success: false, error: "Error message"` |

---

## Integration Patterns

### Pattern 1: Risk Assessment → Response Selection

```javascript
// 1. Get risk score
const risk = await ws.send('predict_detection_risk', {
  userAgent: req.userAgent,
  navigationTiming: req.timing
});

// 2. Get adaptive response
if (risk.overallScore > 50) {
  const response = await ws.send('get_adaptive_response', {
    probabilityScore: risk.overallScore
  });
  
  // 3. Apply strategies
  const result = await ws.send('apply_evasion_strategies', {
    strategies: response.selectedStrategies
  });
}
```

### Pattern 2: Continuous Learning

```javascript
// Apply strategies
const result = await ws.send('apply_evasion_strategies', {
  strategies: selectedStrategies,
  context: { domain: req.domain }
});

// Record outcome
selectedStrategies.forEach((strategy, idx) => {
  ws.send('record_pattern_usage', {
    patternName: strategy.patternName,
    strategyId: strategy.strategyId,
    success: result.results[idx].success,
    context: { domain: req.domain }
  });
});
```

### Pattern 3: Metrics Monitoring

```javascript
// Get comprehensive metrics
const metrics = await ws.send('get_evasion_metrics', {
  includeHistory: true,
  historyLimit: 50
});

// Monitor learning progress
const stats = metrics.metrics.learningStatistics;
console.log(`Success rate: ${(stats.averageSuccessRate * 100).toFixed(1)}%`);
console.log(`Top pattern: ${stats.topPerformingPatterns[0].patternName}`);
```

---

## Performance Characteristics

| Command | Typical Time | Memory | Calls/sec |
|---------|-------------|--------|-----------|
| predict_detection_risk | <5ms | <1KB | 200+ |
| get_adaptive_response | <10ms | <5KB | 100+ |
| apply_evasion_strategies | 10-50ms | <10KB | 20+ |
| record_pattern_usage | <2ms | <2KB | 500+ |
| get_evasion_metrics | <5ms | <10KB | 200+ |
| reset_evasion_learning | <2ms | 0KB | 1000+ |

---

## Support & Documentation

- **Full Implementation:** `EVASION-HANDLER-IMPLEMENTATION.md`
- **Code Source:** `/src/v12-9-0/evasion-handler.js`
- **WebSocket Commands:** `/src/v12-9-0/evasion-websocket-commands.js`
- **Status:** Production Ready ✅

**Version:** v12.9.0 Feature 3  
**Last Updated:** July 3, 2026
