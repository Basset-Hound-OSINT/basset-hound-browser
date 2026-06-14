# Behavioral Coherence Scoring - Integration Guide

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**Status:** Production Ready

## Feature Overview

Behavioral Coherence Scoring provides real-time (0-100) behavioral analysis to validate evasion effectiveness and detect anomalous patterns. The system scores 12+ dimensions including mouse velocity, typing speed, scroll patterns, click timing, and form interaction sequences.

**Capabilities:**
- 7 interaction types: mouse, typing, click, scroll, dwell, navigation, form
- 12+ behavioral dimensions with individual scoring
- Real-time anomaly detection
- Bot detection risk estimation
- Trend analysis (improving/degrading/stable)
- Behavioral baseline comparison

## Quick Start

### Minimal Example - Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Enable behavioral scoring for a session
  const enableMsg = {
    command: 'enable_behavioral_scoring',
    params: {
      sessionId: 'sess_behavior_001',
      updateInterval: 500,
      includeBreakdown: true,
      anomalyThreshold: 0.7
    }
  };
  
  ws.send(JSON.stringify(enableMsg));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.event === 'behavioral_score_update') {
    console.log('Score:', response.data.overallScore);
    console.log('Status:', response.data.status);
  }
});
```

### Python Example

```python
import json
import asyncio
import websockets

async def behavioral_scoring_example():
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Enable scoring
        enable_msg = {
            "command": "enable_behavioral_scoring",
            "params": {
                "sessionId": "sess_behavior_001",
                "updateInterval": 500,
                "includeBreakdown": True,
                "anomalyThreshold": 0.7
            }
        }
        
        await websocket.send(json.dumps(enable_msg))
        response = json.loads(await websocket.recv())
        print("Scoring enabled:", response['success'])
        
        # Get current score
        score_msg = {
            "command": "get_behavioral_score",
            "params": {
                "sessionId": "sess_behavior_001"
            }
        }
        
        await websocket.send(json.dumps(score_msg))
        response = json.loads(await websocket.recv())
        score = response['data']
        
        print(f"Overall Score: {score['overallScore']}")
        print(f"Dimensions: {score.get('dimensions', {})}")
        print(f"Anomalies: {score.get('anomalies', [])}")

asyncio.run(behavioral_scoring_example())
```

## WebSocket Commands

### Command Overview

| Command | Purpose |
|---------|---------|
| `enable_behavioral_scoring` | Start real-time scoring |
| `disable_behavioral_scoring` | Stop real-time scoring |
| `get_behavioral_score` | Get current score |
| `get_behavioral_metrics` | Get detailed metrics |
| `get_behavioral_history` | Get historical scores |
| `record_interaction` | Record user interaction |
| `get_coherence_recommendations` | Get improvement suggestions |

## Command Details

### enable_behavioral_scoring

Start real-time behavioral scoring with periodic updates.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001",
  "updateInterval": 500,
  "includeBreakdown": true,
  "anomalyThreshold": 0.7
}
```

**Parameters Table:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sessionId | string | - | Session identifier |
| updateInterval | number | 500 | Update interval in ms |
| includeBreakdown | boolean | true | Include dimension scores |
| anomalyThreshold | number | 0.7 | Threshold for anomaly detection |

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

**Events Emitted:**

Server broadcasts updates every 500ms:
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
      "idlePatterns": 68.5
    },
    "status": "NORMAL",
    "trend": "IMPROVING"
  }
}
```

**Anomaly Detection Events:**
```json
{
  "event": "behavioral_anomaly_detected",
  "data": {
    "sessionId": "sess_behavior_001",
    "dimension": "typingPattern",
    "severity": "WARNING",
    "anomaly": "Typing speed increase of 45% (high deviation)",
    "timestamp": 1686786235000
  }
}
```

---

### disable_behavioral_scoring

Stop behavioral scoring for a session.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001"
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

---

### get_behavioral_score

Get current behavioral score without history.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001"
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

**Score Interpretation:**

| Score Range | Status | Meaning |
|------------|--------|---------|
| 90-100 | EXCELLENT | Highly natural behavior |
| 75-89 | NORMAL | Natural, undetectable |
| 60-74 | CAUTION | Some anomalies, acceptable |
| 40-59 | WARNING | Suspicious patterns detected |
| 0-39 | CRITICAL | Strong bot detection risk |

---

### get_behavioral_metrics

Get detailed behavioral metrics for analysis.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001",
  "dimension": null
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

---

### get_behavioral_history

Get historical scores and trend analysis.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001",
  "timeWindow": 300000,
  "dimension": null
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
          "typingPattern": 68.5
        }
      },
      {
        "timestamp": 1686786225500,
        "overallScore": 73.8,
        "dimensions": {
          "mouseMovement": 81.2,
          "typingPattern": 69.1
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
- `IMPROVING` - Score increasing by >5 points over time window
- `STABLE` - Score within ±5 points
- `DEGRADING` - Score decreasing by >5 points

---

### record_interaction

Record a user interaction manually.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001",
  "type": "mouse|typing|click|scroll|dwell|navigation|form",
  "data": {
    /* type-specific data */
  }
}
```

**Mouse Interaction Example:**
```json
{
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
```

**Typing Interaction Example:**
```json
{
  "sessionId": "sess_behavior_001",
  "type": "typing",
  "data": {
    "char": "a",
    "timestamp": 1686786225000,
    "interKeystrokeTime": 118,
    "keyCode": 65
  }
}
```

**Click Interaction Example:**
```json
{
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

---

### get_coherence_recommendations

Get recommendations to improve behavioral score.

**Parameters:**
```json
{
  "sessionId": "sess_behavior_001"
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

## Behavioral Dimensions

### 1. Mouse Movement (Weight: 15%)

**Metrics:**
- Velocity: pixels/ms (target: 200-300)
- Acceleration: smooth curves (target: 1.5-2.5)
- Pause frequency: natural stops (target: 12-18%)
- Directness: straight paths (target: 0.83-0.88)

**Optimization Tips:**
- Add Bézier curve smoothing
- Include random micro-pauses
- Vary velocity (not constant)
- Add slight overshooting then correction

### 2. Typing Pattern (Weight: 12%)

**Metrics:**
- WPM (Words Per Minute): target 40-80
- Inter-keystroke time: target 80-250ms
- Error rate: target 0.5-2%
- Error correction time: target 600-1200ms

**Optimization Tips:**
- Vary typing speed randomly
- Add typos and corrections
- Include holding keys longer
- Variable pause between words vs. letters

### 3. Scroll Behavior (Weight: 10%)

**Metrics:**
- Velocity: pixels/second
- Acceleration: easing functions
- Pause frequency: reading stops
- Direction changes: up/down patterns

**Optimization Tips:**
- Use natural easing curves
- Add pauses while "reading"
- Vary scroll distances
- Include backscrolling

### 4. Click Timing (Weight: 10%)

**Metrics:**
- Click duration: 100-200ms
- Inter-click time: 1000-5000ms
- Double-click rate: 0.5-3%
- Button used: left/right/middle

**Optimization Tips:**
- Variable click duration
- Realistic inter-click delays
- Occasional double-clicks
- Mix of left and right clicks

### 5. Idle Patterns (Weight: 8%)

**Metrics:**
- Average idle duration
- Idle frequency
- Distribution shape
- Correlation with content

**Optimization Tips:**
- Add reading pauses (5-30 seconds)
- Vary idle duration
- Idle more on text-heavy pages
- Occasional micro-idles (200-500ms)

### 6-12. Additional Dimensions (Weight: 45%)

Other dimensions include:
- Navigation Timing
- Form Interaction
- Viewport Usage
- Browser Interaction
- Interaction Sequencing
- Device-Specific Behavior
- Entropy Metrics

## Use Cases

### Use Case 1: Monitor Session for Natural Behavior

Real-time monitoring to ensure behavior remains undetectable.

```javascript
async function monitorBehavior(sessionId) {
  // Enable scoring
  const enableMsg = {
    command: 'enable_behavioral_scoring',
    params: {
      sessionId,
      updateInterval: 500,
      includeBreakdown: true,
      anomalyThreshold: 0.7
    }
  };
  
  await sendWebSocketCommand(enableMsg);
  
  // Listen for updates
  wsServer.on('behavioral_score_update', (event) => {
    if (event.data.sessionId === sessionId) {
      const score = event.data.overallScore;
      
      if (score < 70) {
        console.warn(`⚠ Score dropped to ${score} - adjust behavior`);
        
        // Request recommendations
        const recsMsg = {
          command: 'get_coherence_recommendations',
          params: { sessionId }
        };
        
        const recs = await sendWebSocketCommand(recsMsg);
        recs.data.recommendations.forEach(rec => {
          console.log(`Fix ${rec.dimension}: ${rec.recommendation}`);
        });
      }
    }
  });
}
```

### Use Case 2: Optimize Specific Dimension

Focus improvement efforts on lowest-scoring dimension.

```javascript
async function optimizeDimension(sessionId) {
  // Get current score
  const scoreMsg = {
    command: 'get_behavioral_score',
    params: { sessionId }
  };
  
  const score = await sendWebSocketCommand(scoreMsg);
  
  // Find worst dimension
  const dimensions = score.data.dimensions;
  const worst = Object.entries(dimensions)
    .sort(([,a], [,b]) => a - b)
    .shift();
  
  console.log(`Worst dimension: ${worst[0]} (${worst[1]})`);
  
  // Get metrics for that dimension
  const metricsMsg = {
    command: 'get_behavioral_metrics',
    params: { sessionId, dimension: worst[0] }
  };
  
  const metrics = await sendWebSocketCommand(metricsMsg);
  console.log('Current metrics:', metrics.data.metrics);
  
  // Apply improvements based on dimension type
  await improveByDimension(worst[0], metrics.data.metrics);
}
```

### Use Case 3: Track Behavior Trend Over Time

Monitor improvement/degradation trends.

```javascript
async function trackBehaviorTrend(sessionId, intervalMs = 60000) {
  const startScore = await getCurrentScore(sessionId);
  
  setInterval(async () => {
    const historyMsg = {
      command: 'get_behavioral_history',
      params: {
        sessionId,
        timeWindow: 300000  // Last 5 minutes
      }
    };
    
    const history = await sendWebSocketCommand(historyMsg);
    
    console.log(`Trend: ${history.data.trend}`);
    console.log(`Volatility: ${history.data.volatility}`);
    
    if (history.data.trend === 'DEGRADING') {
      console.warn('Score is degrading - needs intervention');
    } else if (history.data.trend === 'IMPROVING') {
      console.log('Score improving - adjustments working');
    }
  }, intervalMs);
}
```

## Troubleshooting

### Low Behavioral Score (< 60)

**Problem:** Behavioral score consistently low

**Solutions:**
1. Check typing speed - usually the culprit
2. Add more realistic idle patterns
3. Vary mouse movement (don't go in straight lines)
4. Include natural pauses between interactions
5. Add occasional clicking "mistakes"

### Anomalies in Typing Pattern

**Problem:** Typing pattern flagged as anomalous

**Solutions:**
- **Too fast:** Add 20-50ms delays between keystrokes
- **Too slow:** Speed up, but add variation
- **Inconsistent:** Randomize WPM (40-80 range)
- **No errors:** Add occasional typos (0.5-2% error rate)

### Mouse Movement Too Perfect

**Problem:** Mouse velocity/acceleration too consistent

**Solutions:**
- Add Bézier curve smoothing
- Include micro-pauses mid-movement
- Vary velocity (not constant speed)
- Add slight overshooting then correction
- Reduce directness ratio (0.83-0.88 target)

### Score Dropping After Long Idle

**Problem:** Score drops when resuming after idle period

**Explanation:** Detection systems can profile behavior changes

**Solutions:**
- Warm up gradually after idle (slow initial actions)
- Add randomization after pause
- Include jitter in first interactions post-idle
- Increase idle frequency (expected behavior)

## Performance Tips

1. **Update Interval**: Balance between responsiveness and overhead
   - 500ms: Real-time monitoring (high overhead)
   - 1000ms: Good balance
   - 5000ms: Lightweight monitoring

2. **Dimension Breakdown**: Only request detailed breakdown when needed
   - Default: Include breakdown every update
   - Optimization: Request metrics only on anomaly

3. **Historical Analysis**: Don't retrieve full history constantly
   - Use 5-minute window (300000ms)
   - Request history every 30-60 seconds

4. **Batch Interactions**: Record multiple interactions, then check score
   - Instead of: Record → Check Score → Record → Check
   - Do: Record 5-10 → Check Score (30% less overhead)

5. **Recommendation Latency**:
   - Typical: 5-10ms to generate recommendations
   - Use for periodic optimization (every 1-2 minutes)

## Related Documentation

- [Behavioral Coherence Scoring - User Guide](../guides/BEHAVIORAL-COHERENCE-SCORING-USER-GUIDE.md)
- [Behavioral Coherence Scoring - Architecture](../technical/BEHAVIORAL-COHERENCE-SCORING-ARCHITECTURE.md)
- [Session Coherence Validation](../integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md)
