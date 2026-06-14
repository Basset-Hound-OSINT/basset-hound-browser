# Behavioral Coherence Scoring - Architecture

**Version:** v12.0.0  
**Last Updated:** June 13, 2026

## System Overview

Behavioral Coherence Scoring provides real-time behavioral analysis (0-100 score) to validate evasion effectiveness and detect anomalies. The system monitors 12+ behavioral dimensions including mouse movement, typing patterns, scroll behavior, and form interactions.

```
┌─────────────────────────────────────────────┐
│    WebSocket Command Layer                   │
│  enable_behavioral_scoring                   │
│  get_behavioral_score                        │
│  get_behavioral_metrics                      │
│  record_interaction                          │
└────────────────────────┬────────────────────┘
                         │
┌────────────────────────▼────────────────────┐
│  BehavioralCoherenceScorer (Main Scorer)    │
│  - Dimension weighting                       │
│  - Real-time scoring                         │
│  - Anomaly detection                         │
│  - Bot risk estimation                       │
└────────────────────────┬────────────────────┘
                         │
┌────────────────────────▼────────────────────┐
│    PatternAnalyzer (Data Collection)        │
│  - Mouse movement tracking                   │
│  - Typing pattern analysis                   │
│  - Scroll behavior measurement               │
│  - Click timing analysis                     │
│  - Form interaction logging                  │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. BehavioralCoherenceScorer

**File:** `src/behavior/coherence-scorer.js`

**Responsibility:** Real-time behavioral coherence scoring across 12 dimensions.

**Key Properties:**
```javascript
{
  analyzer: PatternAnalyzer,           // Data collector
  referencePatterns: { /* defaults */ }, // Human behavior baselines
  scoreHistory: [],                     // Score history (max 300)
  maxHistorySize: 300,                  // 2.5 minutes @ 500ms
  dimensionWeights: {
    mouseMovement: 0.15,
    typingPattern: 0.12,
    scrollBehavior: 0.10,
    clickTiming: 0.10,
    idlePatterns: 0.08,
    navigationTiming: 0.08,
    formInteraction: 0.10,
    viewportUsage: 0.08,
    browserInteraction: 0.08,
    interactionSequencing: 0.07,
    deviceSpecific: 0.06,
    entropyMetrics: 0.08
  },
  anomalySensitivity: 2.0,             // Sensitivity threshold
  botDetectionFactors: { /* weights */ }
}
```

**Key Methods:**
```javascript
analyzeCoherence(metrics)      // Calculate overall score
calculateDimensionScore(dimension, metrics)  // Per-dimension
getScoreHistory(timeWindow)    // Historical data
recordInteraction(interaction) // Log interaction
getBotDetectionRisk(score)     // Estimate bot risk
```

### 2. PatternAnalyzer

**File:** `src/behavior/pattern-analyzer.js`

**Responsibility:** Collect and analyze behavioral patterns from interactions.

**Tracked Interactions:**
- Mouse movement (velocity, acceleration, pauses)
- Typing (WPM, inter-keystroke timing, error rate)
- Scrolling (velocity, acceleration, pause points)
- Clicking (duration, timing, button type)
- Dwell time (reading pauses, idle periods)
- Navigation (page load timing, URL patterns)
- Form submission (field filling speed, validation)

**Key Methods:**
```javascript
recordMouseMovement(x, y, timestamp, velocity, acceleration)
recordTyping(char, timestamp, interKeystrokeTime)
recordScroll(y, timestamp, velocity)
recordClick(x, y, timestamp, duration, button)
recordDwell(duration, location)
recordNavigation(url, loadTime)
recordFormInteraction(fieldId, value, timeSpent)
getMetricsSummary()              // All metrics at once
calculateBehaviorEntropy()        // Information entropy
```

## Behavioral Dimensions

### 1. Mouse Movement (Weight: 15%)

**Metrics Collected:**
```javascript
{
  averageVelocity: 250,      // pixels/ms
  velocityStdDev: 80,        // variance
  accelerationMean: 2.0,     // smooth curves
  accelerationStdDev: 0.8,
  pauseFrequency: 0.15,      // 15% have pauses
  directnessRatio: 0.85,     // straight paths (0-1)
  interactionCount: 245      // total movements
}
```

**Scoring Logic:**
```javascript
// Compare against reference patterns
const velocityScore = compareDistribution(
  currentVelocity,
  referencePatterns.mouseMovement.averageVelocity,
  referencePatterns.mouseMovement.velocityStdDev
);
// Score based on how close to human range
// High score = natural movement
```

### 2. Typing Pattern (Weight: 12%)

**Metrics Collected:**
```javascript
{
  wpmAverage: 62,            // Words Per Minute
  interKeystrokeMean: 118,   // milliseconds
  interKeystrokeStdDev: 28,
  errorRate: 0.008,          // 0.8%
  errorCorrectionTime: 820,  // ms to fix typo
  typingCount: 487           // total keystrokes
}
```

**Scoring Logic:**
```javascript
// Check if WPM within human range (40-80 typical)
const wpmScore = (wpm < 40 || wpm > 120) ? 0.5 : 1.0;

// Check inter-keystroke timing variance
const iksScore = calculateVariance(
  interKeystrokeTimes,
  referencePatterns.typingPattern
);

// Penalize if no errors (too perfect)
const errorScore = errorRate > 0.005 ? 0.8 : 0.5;

// Combined score
return (wpmScore + iksScore + errorScore) / 3;
```

### 3. Scroll Behavior (Weight: 10%)

**Metrics Collected:**
```javascript
{
  averageVelocity: 295,      // pixels/second
  velocityStdDev: 98,
  pauseFrequency: 0.31,      // 31% include pauses
  accelerationProfile: "eased", // natural curve
  scrollCount: 67            // total scrolls
}
```

**Scoring Logic:**
- Natural acceleration profile (eased)
- Pauses correlate with content (longer on text)
- Velocity variation (not constant speed)
- Occasional backscrolling (re-reading)

### 4. Click Timing (Weight: 10%)

**Metrics Collected:**
```javascript
{
  averageClickDuration: 148, // milliseconds
  clickDurationStdDev: 48,
  interClickMean: 2450,      // time between clicks
  interClickStdDev: 1200,
  doubleClickRate: 0.019,    // 1.9%
  clickCount: 156            // total clicks
}
```

**Scoring Logic:**
- Click duration 100-200ms (realistic)
- Inter-click time variable (not uniform)
- Occasional double-clicks (natural accident)
- Button distribution (mostly left, some right)

### 5-12. Additional Dimensions

- **Idle Patterns**: Reading pauses, attention span
- **Navigation Timing**: Page load expectations, DOM ready
- **Form Interaction**: Field filling speed, validation waits
- **Viewport Usage**: Eye tracking simulation, focus patterns
- **Browser Interaction**: Back/forward, refresh, bookmarks
- **Interaction Sequencing**: Logical flow, coherence
- **Device Specific**: Matching claimed device specs
- **Entropy Metrics**: Information-theoretic randomness

## Scoring Algorithm

### Overall Score Calculation

```javascript
overallScore = sum(dimensionScore * weight) for all dimensions

// With weights summing to 1.0
overallScore = 
  mouseMovement * 0.15 +
  typingPattern * 0.12 +
  scrollBehavior * 0.10 +
  clickTiming * 0.10 +
  idlePatterns * 0.08 +
  navigationTiming * 0.08 +
  formInteraction * 0.10 +
  viewportUsage * 0.08 +
  browserInteraction * 0.08 +
  interactionSequencing * 0.07 +
  deviceSpecific * 0.06 +
  entropyMetrics * 0.08;

// Score range: 0-100
// Convert internal 0-1 to 0-100
finalScore = overallScore * 100;
```

### Per-Dimension Scoring

Each dimension produces 0-1 score:

```javascript
// Example: typing pattern scoring
typingPatternScore = (
  scoreWPM(wpm) * 0.4 +           // 40% weight on WPM
  scoreInterKeystroke(ikt) * 0.4 + // 40% weight on IKT
  scoreErrors(errorRate) * 0.2     // 20% weight on errors
);
```

### Anomaly Detection

Compares current behavior to baseline:

```javascript
const deviation = (current - baseline) / baseline;

// Threshold-based anomaly
if (Math.abs(deviation) > anomalyThreshold) {
  anomaly = {
    dimension: "typing_speed",
    severity: Math.abs(deviation) > 0.45 ? "WARNING" : "INFO",
    anomaly: `${dimension} ${deviation > 0 ? 'increase' : 'decrease'} 
              of ${Math.abs(deviation * 100).toFixed(0)}%`,
    expectedValue: baseline,
    observedValue: current,
    deviation: deviation
  };
}
```

### Bot Detection Risk

Estimates risk based on score and anomalies:

```javascript
botDetectionRisk = (
  (1 - overallScore/100) * 0.40 +     // 40% from low score
  anomalyCount * 0.25 +               // 25% from anomalies
  (entropyScore < 0.6 ? 0.25 : 0) +   // 25% from low entropy
  (patternConsistency > 0.95 ? 0.10 : 0) // 10% from over-consistency
);

// Risk interpretation:
// 0.0-0.1 = Very low risk
// 0.1-0.3 = Low risk (acceptable)
// 0.3-0.6 = Medium risk (caution)
// 0.6-0.9 = High risk (suspicious)
// 0.9-1.0 = Very high risk (likely detected)
```

## Data Structures

### Interaction Record

```javascript
{
  type: "mouse|typing|click|scroll|dwell|navigation|form",
  timestamp: 1686786225000,
  data: {
    // Type-specific data
    // Mouse: {x, y, velocity, acceleration}
    // Typing: {char, keyCode, interKeystrokeTime}
    // Click: {x, y, duration, button}
    // Scroll: {y, velocity, scrollDistance}
    // Dwell: {duration, location}
    // Navigation: {url, loadTime}
    // Form: {fieldId, value, timeSpent}
  },
  processedMetrics: {
    // Calculated from data
    // Updated incrementally
  }
}
```

### Score History Entry

```javascript
{
  timestamp: 1686786225000,
  overallScore: 75.4,
  status: "NORMAL|CAUTION|WARNING|CRITICAL",
  trend: "IMPROVING|STABLE|DEGRADING",
  dimensions: {
    mouseMovement: 82.0,
    typingPattern: 71.5,
    scrollBehavior: 78.2,
    // ... other 9 dimensions
  },
  anomalies: [
    {
      dimension: "typingPattern",
      severity: "WARNING",
      anomaly: "Typing speed increase of 45%"
    }
  ],
  botDetectionRisk: 0.15,
  recommendations: [
    "Slow down typing speed",
    "Add more variable pauses"
  ]
}
```

## Real-Time Event Emission

### Score Update Events

Server broadcasts periodically:
```json
{
  "event": "behavioral_score_update",
  "data": {
    "sessionId": "sess_behavior_001",
    "overallScore": 75.4,
    "timestamp": 1686786225123,
    "dimensionScores": {...},
    "status": "NORMAL",
    "trend": "IMPROVING"
  }
}
```

### Anomaly Alerts

Sent when anomaly threshold exceeded:
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

## Trend Analysis

### Volatility Calculation

```javascript
// Calculate standard deviation of recent scores
const scores = history.map(h => h.overallScore);
const mean = scores.reduce((a,b) => a+b, 0) / scores.length;
const variance = scores.reduce((sum, s) => 
  sum + Math.pow(s - mean, 2), 0) / scores.length;
const volatility = Math.sqrt(variance);

// Interpretation:
// <5: Very stable
// 5-15: Stable
// 15-30: Variable (normal)
// >30: Highly volatile (concerning)
```

### Trend Direction

```javascript
// Compare recent 5 vs older 5 (10-point windows)
const recent = history.slice(-5);
const older = history.slice(-10, -5);

const recentAvg = recent.reduce((a,b) => a+b.score, 0) / recent.length;
const olderAvg = older.reduce((a,b) => a+b.score, 0) / older.length;

if (recentAvg > olderAvg + 5) {
  trend = "IMPROVING";
} else if (recentAvg < olderAvg - 5) {
  trend = "DEGRADING";
} else {
  trend = "STABLE";
}
```

## Reference Patterns

Default human behavior baselines loaded at startup:

```javascript
loadDefaultReferences() {
  return {
    mouseMovement: {
      averageVelocity: 250,
      velocityStdDev: 80,
      accelerationMean: 2.0,
      accelerationStdDev: 0.8,
      pauseFrequency: 0.15,
      directnessRatio: 0.85
    },
    typingPattern: {
      wpmMin: 30,
      wpmMax: 100,
      wpmMean: 65,
      interKeystrokeMin: 50,
      interKeystrokeMax: 300,
      interKeystrokeMean: 120,
      errorRate: 0.01,
      errorCorrectionTime: 800
    },
    // ... additional patterns
  };
}
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|----------|-------|
| recordInteraction | O(1) | Append to history |
| calculateScore | O(d) | d = dimensions (12) |
| getMetricsSummary | O(i) | i = interactions |
| getTrend | O(h) | h = history window |

### Memory Usage

- Per-session scorer: ~100-200KB
- Score history (300 entries): ~50KB
- Interaction buffer: ~20KB
- Total per session: ~200KB

### Latency

| Operation | Typical | Range |
|-----------|---------|-------|
| recordInteraction | <1ms | Very fast |
| calculateScore | 2-5ms | Per-dimension calc |
| getScoreHistory | 3-8ms | Window extraction |
| anomalyDetection | 1-3ms | Threshold check |
| trendAnalysis | 2-5ms | History analysis |

## Integration

### WebSocket Command Flow

```javascript
// Enable scoring
enable_behavioral_scoring()
  └─> Initialize PatternAnalyzer
  └─> Initialize BehavioralCoherenceScorer
  └─> Start periodic scoring interval (500ms default)
  └─> Begin emitting score_update events

// Record interaction (called from browser)
record_interaction()
  └─> Pass to PatternAnalyzer
  └─> Update metrics
  └─> (if scoring enabled) recalculate scores

// Get score
get_behavioral_score()
  └─> Call scorer.analyzeCoherence()
  └─> Return dimension breakdown + anomalies
```

### Event Loop

```
Main Loop (every 500ms):
1. PatternAnalyzer.getMetricsSummary()
2. BehavioralCoherenceScorer.analyzeCoherence()
3. Calculate anomalies
4. Emit behavioral_score_update event
5. Check for high-severity anomalies
6. Emit behavioral_anomaly_detected if needed
```

## Testing

### Unit Tests

- `test-pattern-analyzer.js` - Metric calculation
- `test-coherence-scorer.js` - Scoring algorithm
- `test-dimension-scoring.js` - Per-dimension scores
- `test-anomaly-detection.js` - Anomaly logic
- `test-trend-analysis.js` - Trend calculation

### Integration Tests

- `test-behavioral-scoring-flow.js` - End-to-end
- `test-scoring-events.js` - Event emission
- `test-scoring-performance.js` - Performance benchmarks

---

## Related Documentation

- [Behavioral Coherence Scoring - Integration Guide](../integration/BEHAVIORAL-COHERENCE-SCORING-INTEGRATION-GUIDE.md)
- [Behavioral Coherence Scoring - User Guide](../guides/BEHAVIORAL-COHERENCE-SCORING-USER-GUIDE.md)
