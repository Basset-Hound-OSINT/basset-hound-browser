# Behavioral Coherence Scoring - API Reference

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**API Endpoint:** `ws://localhost:8765`

## Command Reference

### 1. enable_behavioral_scoring

Start real-time behavioral scoring with periodic updates.

**Command Name:** `enable_behavioral_scoring`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Session identifier |
| updateInterval | number | No | 500 | Update interval in ms |
| includeBreakdown | boolean | No | true | Include dimension scores |
| anomalyThreshold | number | No | 0.7 | Anomaly sensitivity |

**Request:**
```json
{
  "command": "enable_behavioral_scoring",
  "params": {
    "sessionId": "sess_behavior_001",
    "updateInterval": 500,
    "includeBreakdown": true,
    "anomalyThreshold": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scoringEnabled": true,
    "updateInterval": 500,
    "sessionId": "sess_behavior_001",
    "message": "Behavioral scoring enabled"
  }
}
```

**Emitted Events:**

Every 500ms (configurable):
```json
{
  "event": "behavioral_score_update",
  "data": {
    "sessionId": "sess_behavior_001",
    "overallScore": 75.4,
    "timestamp": 1686786225123,
    "dimensionScores": {
      "mouseMovement": 82.0,
      "typingPattern": 71.5,
      "scrollBehavior": 78.2,
      "clickTiming": 73.0,
      "idlePatterns": 68.5,
      "navigationTiming": 76.0,
      "formInteraction": 70.0,
      "viewportUsage": 79.0,
      "browserInteraction": 74.5,
      "interactionSequencing": 72.0,
      "deviceSpecific": 77.0,
      "entropyMetrics": 75.5
    },
    "status": "NORMAL",
    "trend": "IMPROVING"
  }
}
```

On anomaly:
```json
{
  "event": "behavioral_anomaly_detected",
  "data": {
    "sessionId": "sess_behavior_001",
    "dimension": "typingPattern",
    "severity": "WARNING",
    "anomaly": "Typing speed increase of 45%",
    "timestamp": 1686786235000
  }
}
```

**Latency:** Async - updates every updateInterval

---

### 2. disable_behavioral_scoring

Stop behavioral scoring for a session.

**Command Name:** `disable_behavioral_scoring`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |

**Request:**
```json
{
  "command": "disable_behavioral_scoring",
  "params": {
    "sessionId": "sess_behavior_001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scoringEnabled": false,
    "sessionId": "sess_behavior_001",
    "message": "Behavioral scoring disabled"
  }
}
```

**Latency:** 1-3ms

---

### 3. get_behavioral_score

Get current behavioral score without history.

**Command Name:** `get_behavioral_score`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |

**Request:**
```json
{
  "command": "get_behavioral_score",
  "params": {
    "sessionId": "sess_behavior_001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_behavior_001",
    "overallScore": 75.4,
    "status": "NORMAL",
    "timestamp": 1686786225000,
    "trend": "IMPROVING",
    "dimensions": {
      "mouseMovement": 82.0,
      "typingPattern": 71.5,
      "scrollBehavior": 78.2,
      "clickTiming": 73.0,
      "idlePatterns": 68.5,
      "navigationTiming": 76.0,
      "formInteraction": 70.0,
      "viewportUsage": 79.0,
      "browserInteraction": 74.5,
      "interactionSequencing": 72.0,
      "deviceSpecific": 77.0,
      "entropyMetrics": 75.5
    },
    "anomalies": [
      {
        "dimension": "typingPattern",
        "severity": "warning",
        "anomaly": "Typing speed deviation 32% above baseline"
      }
    ],
    "botDetectionRisk": 0.15,
    "recommendations": [
      "Typing speed too fast - add variable delays",
      "Mouse movement pattern changing - be more consistent"
    ]
  }
}
```

**Score Status:**

| Score | Status | Meaning |
|-------|--------|---------|
| 90-100 | EXCELLENT | Highly natural behavior |
| 75-89 | NORMAL | Natural, undetectable |
| 60-74 | CAUTION | Some anomalies, acceptable |
| 40-59 | WARNING | Suspicious patterns |
| 0-39 | CRITICAL | Strong bot detection risk |

**Latency:** 3-5ms

---

### 4. get_behavioral_metrics

Get detailed behavioral metrics for all dimensions or single dimension.

**Command Name:** `get_behavioral_metrics`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |
| dimension | string | No | Single dimension (null for all) |

**Request (All Dimensions):**
```json
{
  "command": "get_behavioral_metrics",
  "params": {
    "sessionId": "sess_behavior_001",
    "dimension": null
  }
}
```

**Response (All Dimensions):**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_behavior_001",
    "metrics": {
      "mouseMovement": {
        "averageVelocity": 248,
        "velocityStdDev": 78,
        "accelerationMean": 1.92,
        "accelerationStdDev": 0.76,
        "pauseFrequency": 0.16,
        "directnessRatio": 0.87,
        "interactionCount": 245
      },
      "typingPattern": {
        "wpmAverage": 62,
        "interKeystrokeMean": 118,
        "interKeystrokeStdDev": 28,
        "errorRate": 0.008,
        "errorCorrectionTime": 820,
        "typingCount": 487
      },
      "scrollBehavior": {
        "averageVelocity": 295,
        "velocityStdDev": 98,
        "pauseFrequency": 0.31,
        "accelerationProfile": "eased",
        "scrollCount": 67
      },
      "clickTiming": {
        "averageClickDuration": 148,
        "clickDurationStdDev": 48,
        "interClickMean": 2450,
        "interClickStdDev": 1200,
        "doubleClickRate": 0.019,
        "clickCount": 156
      },
      "idlePatterns": {
        "averageIdleDuration": 4800,
        "idleDurationStdDev": 2100,
        "idleFrequency": 0.28,
        "idlePeriods": 42
      }
    }
  }
}
```

**Request (Single Dimension):**
```json
{
  "command": "get_behavioral_metrics",
  "params": {
    "sessionId": "sess_behavior_001",
    "dimension": "typingPattern"
  }
}
```

**Response (Single Dimension):**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_behavior_001",
    "dimension": "typingPattern",
    "metrics": {
      "wpmAverage": 62,
      "interKeystrokeMean": 118,
      "interKeystrokeStdDev": 28,
      "errorRate": 0.008,
      "errorCorrectionTime": 820,
      "typingCount": 487
    }
  }
}
```

**Latency:** 2-5ms

---

### 5. get_behavioral_history

Get historical scores and trend analysis.

**Command Name:** `get_behavioral_history`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Session identifier |
| timeWindow | number | No | null | Window in ms (null = all) |
| dimension | string | No | null | Single dimension filter |

**Request:**
```json
{
  "command": "get_behavioral_history",
  "params": {
    "sessionId": "sess_behavior_001",
    "timeWindow": 300000,
    "dimension": null
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_behavior_001",
    "history": [
      {
        "timestamp": 1686786225000,
        "overallScore": 72.1,
        "dimensions": {
          "mouseMovement": 80.0,
          "typingPattern": 68.5,
          "scrollBehavior": 75.2
        }
      },
      {
        "timestamp": 1686786225500,
        "overallScore": 73.8,
        "dimensions": {
          "mouseMovement": 81.2,
          "typingPattern": 69.1,
          "scrollBehavior": 76.0
        }
      }
    ],
    "trend": "IMPROVING",
    "volatility": 2.4,
    "recordCount": 45
  }
}
```

**Trend Values:**
- `IMPROVING` - Score increasing by >5 points
- `STABLE` - Score within ±5 points
- `DEGRADING` - Score decreasing by >5 points

**Latency:** 3-8ms

---

### 6. record_interaction

Record a user interaction (called internally during actions).

**Command Name:** `record_interaction`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |
| type | string | Yes | Interaction type |
| data | object | Yes | Interaction data (type-specific) |

**Mouse Interaction:**
```json
{
  "command": "record_interaction",
  "params": {
    "sessionId": "sess_behavior_001",
    "type": "mouse",
    "data": {
      "x": 450,
      "y": 320,
      "timestamp": 1686786225000,
      "velocity": 248,
      "acceleration": 1.92
    }
  }
}
```

**Typing Interaction:**
```json
{
  "command": "record_interaction",
  "params": {
    "sessionId": "sess_behavior_001",
    "type": "typing",
    "data": {
      "char": "a",
      "timestamp": 1686786225000,
      "interKeystrokeTime": 118,
      "keyCode": 65
    }
  }
}
```

**Click Interaction:**
```json
{
  "command": "record_interaction",
  "params": {
    "sessionId": "sess_behavior_001",
    "type": "click",
    "data": {
      "x": 450,
      "y": 320,
      "timestamp": 1686786225000,
      "duration": 148,
      "button": "left"
    }
  }
}
```

**Scroll Interaction:**
```json
{
  "command": "record_interaction",
  "params": {
    "sessionId": "sess_behavior_001",
    "type": "scroll",
    "data": {
      "y": 500,
      "timestamp": 1686786225000,
      "velocity": 295,
      "scrollDistance": 500
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recorded": true,
    "sessionId": "sess_behavior_001",
    "interactionId": "interaction_123"
  }
}
```

**Latency:** <1ms

---

### 7. get_coherence_recommendations

Get recommendations to improve behavioral score.

**Command Name:** `get_coherence_recommendations`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |

**Request:**
```json
{
  "command": "get_coherence_recommendations",
  "params": {
    "sessionId": "sess_behavior_001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_behavior_001",
    "currentScore": 75.4,
    "recommendations": [
      {
        "dimension": "typingPattern",
        "severity": "WARNING",
        "current": 71.5,
        "recommendation": "Typing speed too fast (62 WPM avg). Slow down and add random delays",
        "expectedImprovement": 85.0,
        "action": "Add 20-50ms random delays between keystrokes"
      },
      {
        "dimension": "mouseMovement",
        "severity": "INFO",
        "current": 82.0,
        "recommendation": "Mouse movement is good, but could add slight directness variation",
        "expectedImprovement": 88.0,
        "action": "Reduce directnessRatio from 0.87 to 0.83"
      },
      {
        "dimension": "idlePatterns",
        "severity": "WARNING",
        "current": 68.5,
        "recommendation": "Idle periods too short. Add longer reading pauses",
        "expectedImprovement": 82.0,
        "action": "Increase average idle duration from 4.8s to 6-8s"
      }
    ],
    "scoreProjection": {
      "ifNoChanges": 75.4,
      "ifAllApplied": 85.5,
      "priority": [
        "Fix typing speed",
        "Increase idle durations",
        "Add mouse movement variation"
      ]
    }
  }
}
```

**Latency:** 5-10ms

---

## Error Codes

| Error | Cause | Resolution |
|-------|-------|-----------|
| "sessionId required" | Missing sessionId | Provide session ID |
| "Analyzer not initialized" | Scoring not enabled | Call enable_behavioral_scoring first |
| "Scorer not initialized" | Scoring not enabled | Call enable_behavioral_scoring first |
| "Invalid interaction type" | Unknown type | Use: mouse, typing, click, scroll, dwell, navigation, form |

---

## Performance Expectations

| Command | Latency | Use Case |
|---------|---------|----------|
| enable_behavioral_scoring | Async | Startup |
| disable_behavioral_scoring | 1-3ms | Cleanup |
| get_behavioral_score | 3-5ms | Poll status |
| get_behavioral_metrics | 2-5ms | Analyze dimension |
| get_behavioral_history | 3-8ms | Review trend |
| record_interaction | <1ms | Internal |
| get_coherence_recommendations | 5-10ms | Optimization |

---

## Related Documentation

- [Behavioral Coherence Scoring - Integration Guide](../integration/BEHAVIORAL-COHERENCE-SCORING-INTEGRATION-GUIDE.md)
- [Behavioral Coherence Scoring - Architecture](../technical/BEHAVIORAL-COHERENCE-SCORING-ARCHITECTURE.md)
- [Behavioral Coherence Scoring - User Guide](../guides/BEHAVIORAL-COHERENCE-SCORING-USER-GUIDE.md)
