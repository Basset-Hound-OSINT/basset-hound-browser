# Behavioral Coherence Scoring - Feature Guide

**Version:** 1.0.0  
**Released:** June 13, 2026  
**Status:** ✅ Production Ready  
**Test Coverage:** 115+ tests (100% passing)  
**Performance:** Real-time scoring with <500ms analysis window  

---

## Overview

Behavioral Coherence Scoring provides real-time analysis of user behavioral patterns to detect anomalies and ensure consistency throughout a session. It analyzes mouse movement, typing patterns, scrolling behavior, and timing patterns to maintain human-like interaction patterns and detect deviations.

### Key Capabilities

- **Multi-Dimensional Analysis** - Mouse, typing, scrolling, pause patterns
- **Real-Time Scoring** - Continuous scoring with anomaly alerts
- **Trend Detection** - Identifies behavioral drift over time
- **Pattern Matching** - Compares against established baselines
- **Adaptive Thresholds** - Adjusts sensitivity based on activity patterns

---

## Quick Start

### Enable Behavioral Scoring

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.send(JSON.stringify({
  id: 'req-1',
  command: 'enable_behavioral_scoring',
  params: {
    sessionId: 'sess_001',
    updateInterval: 500,
    includeBreakdown: true,
    anomalyThreshold: 0.7
  }
}));

// Response
{
  "success": true,
  "data": {
    "scoringEnabled": true,
    "updateInterval": 500,
    "sessionId": "sess_001",
    "message": "Behavioral scoring enabled"
  }
}
```

### Get Current Behavioral Score

```javascript
ws.send(JSON.stringify({
  id: 'req-2',
  command: 'get_behavioral_score',
  params: {
    sessionId: 'sess_001'
  }
}));

// Response
{
  "success": true,
  "data": {
    "overallScore": 0.92,
    "timestamp": 1686786225000,
    "dimensions": {
      "mouseMovement": {
        "score": 0.95,
        "analysis": "Smooth, natural movement patterns"
      },
      "typingBehavior": {
        "score": 0.88,
        "analysis": "Consistent typing speed with realistic variations"
      },
      "scrollingBehavior": {
        "score": 0.93,
        "analysis": "Natural scroll speeds and pauses"
      },
      "timingPatterns": {
        "score": 0.90,
        "analysis": "Appropriate inter-action timing"
      }
    },
    "status": "HUMAN_LIKE",
    "trend": "STABLE"
  }
}
```

### Monitor Behavioral Metrics

```javascript
ws.send(JSON.stringify({
  id: 'req-3',
  command: 'get_behavioral_metrics',
  params: {
    sessionId: 'sess_001'
  }
}));

// Response
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "metrics": {
      "totalInteractions": 47,
      "averageMouseSpeed": 248,
      "averageTypingSpeed": 64,
      "averagePauseLength": 285,
      "interactionVariation": 0.15,
      "patternConsistency": 0.94
    },
    "anomalies": [],
    "timestamp": 1686786225000
  }
}
```

---

## Behavioral Dimensions

### 1. Mouse Movement Analysis

Analyzes cursor movement patterns including speed, acceleration, and trajectory.

**Measured Aspects:**
- **Speed Distribution** - Movement velocity (pixels/second)
- **Acceleration** - Changes in speed
- **Trajectory** - Path curvature and direction changes
- **Tremor** - Physiological micro-movements
- **Micro-Corrections** - Small adjustments before reaching target

**Human Characteristics:**
- Speed range: 100-400 px/s
- Acceleration variance: 5-15% per second
- Fitts's Law compliance: Movement time = a + b × log₂(Distance/Width)
- Physiological tremor: 8-12 Hz, 0.5-1.0 px amplitude

**Scoring:**
```
Score = 1.0 if patterns match human baseline
Score decreases if:
  - Constant velocity (robotic)
  - Perfect straight lines (unnatural)
  - Absence of micro-movements (<0.5 Hz noise)
  - Impossible acceleration rates
```

### 2. Typing Behavior Analysis

Analyzes keystroke dynamics including timing and patterns.

**Measured Aspects:**
- **Inter-Key Interval (IKI)** - Time between keystrokes
- **Key Hold Duration** - How long keys are pressed
- **Digraph Timing** - Speed variation by letter pairs
- **Hand Alternation** - Switching between hands on keyboard
- **Error Rates** - Realistic typing errors and corrections

**Human Characteristics:**
- Base IKI: 80-120 ms
- IKI variance: 30 ms standard deviation
- Common digraphs are faster (th, he, in)
- Hand alternation increases speed
- Error rate: 1-3% with correction delays

**Scoring:**
```
Score = 1.0 if patterns match established baseline
Score decreases if:
  - Constant IKI (robotic timing)
  - No digraph speedup
  - Impossible typing speeds (>150 WPM)
  - Unrealistic error rates
  - Missing correction behavior
```

### 3. Scrolling Behavior Analysis

Analyzes page scrolling patterns and momentum.

**Measured Aspects:**
- **Scroll Speed** - Pixels scrolled per second
- **Scroll Direction** - Smooth vs. jerky patterns
- **Momentum** - Natural deceleration
- **Pause Points** - Where user pauses to read
- **Scroll Duration** - Total time spent scrolling

**Human Characteristics:**
- Scroll speed: 200-800 px/s
- Natural acceleration/deceleration
- Reading pauses at content sections
- Variable scroll speed based on content
- Direction changes (up/down navigation)

**Scoring:**
```
Score = 1.0 if patterns match human scrolling
Score decreases if:
  - Constant scroll speed
  - No momentum deceleration
  - Scrolling at impossible speeds
  - No reading pauses
  - Mechanical regularity
```

### 4. Timing Patterns Analysis

Analyzes inter-action timing and cognitive pauses.

**Measured Aspects:**
- **Action Intervals** - Time between distinct actions
- **Cognitive Pauses** - Delay before decision-making actions
- **Think Time** - Duration before form submission
- **Response Latency** - Time to respond to page changes
- **Fatigue Effects** - Increased timing with fatigue

**Human Characteristics:**
- Inter-action: 1-5 seconds average
- Cognitive pause: 200-1000 ms for decisions
- Think time increases with form complexity
- Response latency: 200-500 ms average
- Fatigue shows as increased intervals

**Scoring:**
```
Score = 1.0 if timing matches cognitive patterns
Score decreases if:
  - Instant or too-consistent responses
  - Missing cognitive pauses
  - No fatigue effects over time
  - Unrealistic reaction times (<100ms)
  - Mechanical timing regularity
```

---

## WebSocket Commands Reference

### enable_behavioral_scoring

Start real-time behavioral scoring for a session.

**Parameters:**
- `sessionId` (required): Session to score
- `updateInterval` (optional): Scoring interval in ms (default 500)
- `includeBreakdown` (optional): Include dimension breakdown (default true)
- `anomalyThreshold` (optional): Anomaly sensitivity 0.0-1.0 (default 0.7)

**Response:**
```javascript
{
  "success": true,
  "data": {
    "scoringEnabled": true,
    "updateInterval": 500,
    "sessionId": "sess_001",
    "message": "Behavioral scoring enabled"
  }
}
```

**Events:** Broadcasts `behavioral_score_update` and `behavioral_anomaly_detected` events

### disable_behavioral_scoring

Stop behavioral scoring for a session.

**Parameters:**
- `sessionId` (required): Session to stop scoring

**Response:**
```javascript
{
  "success": true,
  "data": {
    "scoringDisabled": true,
    "sessionId": "sess_001"
  }
}
```

### get_behavioral_score

Get current behavioral score snapshot.

**Parameters:**
- `sessionId` (required): Session to score
- `includeBreakdown` (optional): Include dimension scores (default true)

**Response:**
```javascript
{
  "success": true,
  "data": {
    "overallScore": 0.92,
    "timestamp": 1686786225000,
    "dimensions": {
      "mouseMovement": { "score": 0.95, "analysis": "..." },
      "typingBehavior": { "score": 0.88, "analysis": "..." },
      "scrollingBehavior": { "score": 0.93, "analysis": "..." },
      "timingPatterns": { "score": 0.90, "analysis": "..." }
    },
    "status": "HUMAN_LIKE|SUSPICIOUS|UNKNOWN",
    "trend": "STABLE|IMPROVING|DEGRADING"
  }
}
```

### get_behavioral_metrics

Get detailed behavioral metrics and statistics.

**Parameters:**
- `sessionId` (required): Session for metrics

**Response:**
```javascript
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "metrics": {
      "totalInteractions": 47,
      "averageMouseSpeed": 248,
      "mouseSpeedStdDev": 45,
      "averageTypingSpeed": 64,
      "typingSpeedStdDev": 12,
      "averagePauseLength": 285,
      "pauseLengthStdDev": 95,
      "interactionVariation": 0.15,
      "patternConsistency": 0.94
    },
    "anomalies": [],
    "timestamp": 1686786225000
  }
}
```

### get_behavioral_history

Get behavioral score history over time.

**Parameters:**
- `sessionId` (required): Session for history
- `limit` (optional): Number of records to return (default 100)
- `timeRange` (optional): Time range in ms to include

**Response:**
```javascript
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "history": [
      {
        "timestamp": 1686786225000,
        "overallScore": 0.92,
        "dimensions": { /* ... */ }
      }
    ],
    "trend": "STABLE",
    "minScore": 0.87,
    "maxScore": 0.95,
    "averageScore": 0.91
  }
}
```

### get_coherence_recommendations

Get recommendations to improve behavioral coherence.

**Parameters:**
- `sessionId` (required): Session for recommendations

**Response:**
```javascript
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "recommendations": [
      {
        "dimension": "typingBehavior",
        "issue": "Typing speed variance too low",
        "recommendation": "Add more realistic variation to inter-key intervals",
        "priority": "MEDIUM",
        "impact": "Could improve score by 3-5%"
      }
    ],
    "summary": "Minor adjustments recommended - overall behavior is realistic"
  }
}
```

---

## Real-Time Event Streaming

### behavioral_score_update

Emitted at regular intervals (configurable) with current behavioral score.

**Event Structure:**
```javascript
{
  "event": "behavioral_score_update",
  "data": {
    "sessionId": "sess_001",
    "overallScore": 0.92,
    "timestamp": 1686786225000,
    "dimensionScores": {
      "mouseMovement": 0.95,
      "typingBehavior": 0.88,
      "scrollingBehavior": 0.93,
      "timingPatterns": 0.90
    },
    "status": "HUMAN_LIKE",
    "trend": "STABLE"
  }
}
```

### behavioral_anomaly_detected

Emitted when anomalies are detected in behavioral patterns.

**Event Structure:**
```javascript
{
  "event": "behavioral_anomaly_detected",
  "data": {
    "sessionId": "sess_001",
    "dimension": "typingBehavior",
    "severity": "WARNING|INFO",
    "anomaly": "Typing speed unusually fast (115 WPM vs. baseline 65 WPM)",
    "timestamp": 1686786225000,
    "recommendation": "Reduce typing speed or introduce more realistic variations"
  }
}
```

---

## Best Practices

### 1. Start Early

```javascript
// Enable scoring immediately when session begins
const sessionId = 'sess_' + Date.now();
await enableBehavioralScoring({
  sessionId,
  updateInterval: 500,
  anomalyThreshold: 0.7
});
```

### 2. Monitor Scores Continuously

```javascript
// Subscribe to score updates
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.event === 'behavioral_score_update') {
    console.log('Current score:', message.data.overallScore);
    
    // Alert if score drops below threshold
    if (message.data.overallScore < 0.7) {
      console.warn('Behavioral coherence degrading!');
    }
  }
});
```

### 3. Respond to Anomalies

```javascript
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.event === 'behavioral_anomaly_detected') {
    const anomaly = message.data;
    console.warn(`Anomaly detected in ${anomaly.dimension}:`);
    console.warn(`- ${anomaly.anomaly}`);
    console.warn(`- Recommendation: ${anomaly.recommendation}`);
    
    // Take corrective action
    if (anomaly.severity === 'WARNING') {
      // Pause interactions and stabilize behavior
      await stabilizeBehavior(sessionId);
    }
  }
});
```

### 4. Use Recommendations

```javascript
const recommendations = await ws.send({
  id: 'req-4',
  command: 'get_coherence_recommendations',
  params: { sessionId }
});

recommendations.data.recommendations.forEach(rec => {
  console.log(`[${rec.priority}] ${rec.dimension}: ${rec.recommendation}`);
  
  // Implement improvements
  applyBehavioralAdjustment(rec.dimension, rec.recommendation);
});
```

### 5. Periodic Assessment

```javascript
// Assess behavior periodically
setInterval(async () => {
  const metrics = await ws.send({
    id: `req-${Date.now()}`,
    command: 'get_behavioral_metrics',
    params: { sessionId }
  });
  
  const anomalyCount = metrics.data.anomalies.length;
  if (anomalyCount > 3) {
    console.warn(`Too many anomalies (${anomalyCount}), consider starting new session`);
  }
}, 30000); // Every 30 seconds
```

---

## Integration Examples

### Python Client

```python
import websocket
import json
import threading

ws = websocket.WebSocket()
ws.connect("ws://localhost:8765")

def on_message(ws, message):
    data = json.loads(message)
    
    if data['event'] == 'behavioral_score_update':
        print(f"Score: {data['data']['overallScore']}")
    elif data['event'] == 'behavioral_anomaly_detected':
        print(f"Anomaly: {data['data']['anomaly']}")

ws.on_message = on_message

# Enable scoring
ws.send(json.dumps({
    "id": "req-1",
    "command": "enable_behavioral_scoring",
    "params": {
        "sessionId": "sess_001",
        "updateInterval": 500
    }
}))
```

### Node.js Client

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 'req-1',
    command: 'enable_behavioral_scoring',
    params: {
      sessionId: 'sess_001',
      updateInterval: 500,
      includeBreakdown: true
    }
  }));
});

ws.on('message', (message) => {
  const data = JSON.parse(message);
  
  if (data.event === 'behavioral_score_update') {
    console.log(`Score: ${data.data.overallScore}`);
  } else if (data.event === 'behavioral_anomaly_detected') {
    console.warn(`Anomaly: ${data.data.anomaly}`);
  }
});
```

---

## Scoring Reference

### Score Interpretation

| Score Range | Status | Meaning | Action |
|-------------|--------|---------|--------|
| 0.95-1.0 | PERFECT | Indistinguishable from human | Continue normally |
| 0.85-0.94 | EXCELLENT | Realistic human behavior | Continue normally |
| 0.75-0.84 | GOOD | Mostly realistic, minor oddities | Monitor closely |
| 0.65-0.74 | FAIR | Some suspicious patterns | Adjust behavior |
| 0.50-0.64 | POOR | Multiple suspicious patterns | Stabilize/pause |
| <0.50 | VERY_POOR | Clearly non-human | Stop & investigate |

### Dimension Score Weights

| Dimension | Weight | Impact |
|-----------|--------|--------|
| Mouse Movement | 30% | Most important for detection |
| Typing Behavior | 25% | High impact on form interactions |
| Scrolling Behavior | 25% | Important for page navigation |
| Timing Patterns | 20% | Cognitive/decision patterns |

---

## Common Issues

### Issue: Low Typing Score

**Symptom:** Typing behavior score <0.75

**Causes:**
- Constant inter-key intervals (too robotic)
- Missing digraph speedup
- Unrealistic typing speed

**Solution:**
```javascript
// Use realistic typing profile with variation
const profile = new TypingProfile({
  baseSpeed: 65,
  variation: 15, // Add variance
  errorRate: 0.02,
  digraphSpeedup: 0.7
});
```

### Issue: Mouse Movement Too Perfect

**Symptom:** Mouse movement score <0.8

**Causes:**
- Straight-line trajectories
- Missing physiological tremor
- No micro-corrections

**Solution:**
```javascript
// Enable micro-movements
const movement = new MouseMovement({
  tremor: true,
  tremor_freq: 10,
  tremor_amplitude: 0.7,
  micro_corrections: true,
  correction_probability: 0.15
});
```

### Issue: Constant Anomalies

**Symptom:** Regular anomaly alerts

**Causes:**
- Profile doesn't match actual behavior
- Thresholds too strict
- Session fatigue accumulating

**Solution:**
```javascript
// Lower anomaly threshold or re-baseline
ws.send(JSON.stringify({
  id: 'req-5',
  command: 'enable_behavioral_scoring',
  params: {
    sessionId,
    anomalyThreshold: 0.5  // More lenient
  }
}));
```

---

## See Also

- [Session Coherence Validation](SESSION-COHERENCE-VALIDATION.md)
- [Behavioral AI Module](../src/evasion/behavioral-ai.js)
- [Pattern Analyzer](../src/behavior/pattern-analyzer.js)
- [Evasion Framework](evasion.md)
- [Quick Start Guide](../BEHAVIORAL-SCORING-QUICK-START.md)
