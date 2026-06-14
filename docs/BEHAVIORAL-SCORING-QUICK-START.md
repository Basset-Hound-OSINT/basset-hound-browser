# Behavioral Coherence Scoring - Quick Start Guide

## 5-Minute Overview

The Behavioral Coherence Scoring system analyzes human-like behavior patterns and scores how "natural" a user's behavior appears (0-100 scale). It's designed to validate bot evasion effectiveness and identify what makes behavior detection-risky.

## Quick Integration

### 1. Import the modules
```javascript
const { registerBehavioralScoringCommands } = require('./websocket/commands/behavior-scoring');

// In your WebSocket server initialization:
registerBehavioralScoringCommands(commandHandlers, executeInRenderer, wsServer);
```

### 2. Enable scoring for a session
```javascript
await client.send({
  command: 'enable_behavioral_scoring',
  params: {
    sessionId: 'my_session',
    updateInterval: 500
  }
});
// Server will start sending behavioral_score_update events every 500ms
```

### 3. Record user interactions
```javascript
// Mouse movement
await client.send({
  command: 'record_interaction',
  params: {
    sessionId: 'my_session',
    type: 'mouse',
    data: {
      from: { x: 100, y: 100 },
      to: { x: 200, y: 200 },
      duration: 150
    }
  }
});

// Typing
await client.send({
  command: 'record_interaction',
  params: {
    sessionId: 'my_session',
    type: 'typing',
    data: {
      char: 'a',
      ikiBefore: 100,   // inter-keystroke interval (ms)
      holdDuration: 80
    }
  }
});

// Click
await client.send({
  command: 'record_interaction',
  params: {
    sessionId: 'my_session',
    type: 'click',
    data: {
      x: 250,
      y: 300,
      target: 'button.submit',
      duration: 145
    }
  }
});

// Scroll
await client.send({
  command: 'record_interaction',
  params: {
    sessionId: 'my_session',
    type: 'scroll',
    data: {
      direction: 'down',
      distance: 200,
      duration: 600,
      paused: true
    }
  }
});
```

### 4. Get current score
```javascript
const response = await client.send({
  command: 'get_behavioral_score',
  params: { sessionId: 'my_session' }
});

const score = response.data;
console.log(`Score: ${score.overallScore}/100`);
console.log(`Human-like: ${score.isHumanLike ? 'Yes' : 'No'}`);
console.log(`Bot Risk: ${(score.botDetectionRisk * 100).toFixed(1)}%`);
console.log(`Status: ${score.status}`);
```

### 5. Listen to score updates
```javascript
client.on('behavioral_score_update', (event) => {
  console.log(`Score: ${event.data.overallScore}`);
  
  // Check individual dimensions
  if (event.data.dimensionScores) {
    console.log('Typing:', event.data.dimensionScores.typingPattern.score);
    console.log('Mouse:', event.data.dimensionScores.mouseMovement.score);
  }
});

client.on('behavioral_anomaly_detected', (event) => {
  console.warn(`${event.data.severity}: ${event.data.anomaly}`);
});
```

### 6. Get recommendations
```javascript
const recs = await client.send({
  command: 'get_coherence_recommendations',
  params: { sessionId: 'my_session' }
});

for (const rec of recs.data.recommendations) {
  if (rec.priority === 'HIGH') {
    console.log(`Fix: ${rec.suggestion}`);
  }
}
```

## The 12 Dimensions

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 1 | Mouse Movement | 15% | Velocity, acceleration, natural pause patterns |
| 2 | Typing Pattern | 12% | WPM consistency, inter-keystroke timing, errors |
| 3 | Scroll Behavior | 10% | Speed, distance consistency, pause frequency |
| 4 | Click Timing | 10% | Click duration, interval consistency |
| 5 | Idle Patterns | 8% | Time between actions, pause frequency |
| 6 | Navigation Timing | 8% | Page load awareness, click-to-nav delay |
| 7 | Form Interaction | 10% | Field completion time, tab vs click usage |
| 8 | Viewport Usage | 8% | Content coverage, reading patterns |
| 9 | Browser Interaction | 8% | Back/forward button usage patterns |
| 10 | Interaction Sequencing | 7% | Deliberate vs random action order |
| 11 | Device-Specific | 6% | DPI/screen size awareness |
| 12 | Entropy Metrics | 8% | Behavior randomness/predictability |

## Scoring Interpretation

| Score | Status | Meaning |
|-------|--------|---------|
| 85-100 | COHERENT | Very natural, low detection risk |
| 70-84 | COHERENT | Natural, acceptable risk |
| 50-69 | WARNING | Suspicious patterns detected |
| 0-49 | VIOLATION | Likely to be detected |

## Common Issues & Fixes

### Issue: Typing score too low
**Causes:**
- Typing too fast (IKI < 50ms)
- No typing errors (real humans make 1-5% errors)
- Inconsistent WPM

**Fixes:**
```javascript
// Add delays between keystrokes
data.ikiBefore = 80 + Math.random() * 50; // 80-130ms

// Simulate occasional errors
if (Math.random() < 0.02) {
  data.error = true;
}

// Variable WPM (not perfectly consistent)
data.char = String.fromCharCode(97 + Math.floor(Math.random() * 26));
```

### Issue: Mouse score too low
**Causes:**
- Perfectly linear movement paths
- Constant velocity (no acceleration)
- No pauses/tremor

**Fixes:**
```javascript
// Add natural acceleration
duration = 100 + Math.random() * 100; // Variable timing

// Add slight trajectory deviation
to.x += (Math.random() - 0.5) * 20; // ±10px deviation

// Include pauses sometimes
if (Math.random() < 0.15) {
  data.paused = true;
}
```

### Issue: Scroll score too low
**Causes:**
- No pauses during scrolling
- Perfectly consistent scroll distances
- Unrealistic scroll speeds

**Fixes:**
```javascript
// Add pauses 30% of time
data.paused = Math.random() < 0.3;

// Vary scroll distance
distance = 200 + (Math.random() - 0.5) * 100; // 150-250px

// Realistic speed (300 px/s average)
duration = distance / 0.3; // Adjust based on desired speed
```

### Issue: Overall score degrading over time
**Causes:**
- Fatigue factor increasing
- Pattern repetition detected
- No behavioral variation

**Fixes:**
```javascript
// Add behavioral variation
// Vary pause times, click intervals, scroll distances

// Include natural idle periods
if (actionsSinceLastIdle > 30) {
  // Take a break
  await sleep(Math.random() * 5000 + 2000);
}

// Simulate fatigue (slight slowdown)
speedFactor = 1.0 - (minutesElapsed / 60) * 0.1; // 10% slowdown per hour
```

## Testing Your Implementation

### Generate Test Interactions
```javascript
// Create a test session
const testSession = 'test_' + Date.now();

// Enable scoring
await client.send({
  command: 'enable_behavioral_scoring',
  params: { sessionId: testSession }
});

// Simulate 100 natural interactions
for (let i = 0; i < 100; i++) {
  await client.send({
    command: 'record_interaction',
    params: {
      sessionId: testSession,
      type: ['mouse', 'typing', 'click', 'scroll'][i % 4],
      data: generateNaturalInteraction(i)
    }
  });
}

// Check final score
const score = await client.send({
  command: 'get_behavioral_score',
  params: { sessionId: testSession }
});

console.log(`Final Score: ${score.data.overallScore}/100`);
assert(score.data.overallScore > 70, 'Score should be >70');
```

### View Score History
```javascript
const history = await client.send({
  command: 'get_behavioral_history',
  params: {
    sessionId: testSession,
    timeWindow: 60000  // Last 60 seconds
  }
});

console.log(`Score trend: ${history.data.trend}`);
console.log(`Volatility: ${history.data.volatility}`);
```

### Detect Anomalies
```javascript
const anomalies = await client.send({
  command: 'detect_behavior_anomalies',
  params: { sessionId: testSession }
});

console.log(`Detected ${anomalies.data.anomalyCount} anomalies:`);
for (const anom of anomalies.data.anomalies) {
  console.log(`- ${anom.type}: ${anom.description}`);
}
```

## Reference Values (Human Baselines)

### Mouse Movement
- Normal velocity: 200-300 px/ms
- Pause frequency: ~15% of movements
- Natural jitter: 0.5-1.5px deviation

### Typing
- Average WPM: 60-70
- Common digraphs 30% faster (th, he, in, etc.)
- Error rate: 2% (1 error per 50 characters)
- Error correction: 150-300ms pause then retry

### Scrolling
- Typical speed: 300 px/second
- Pause duration: 500-2000ms
- Pause frequency: 30% of scrolls

### Clicking
- Normal duration: 130-170ms
- Normal interval: 1000-4000ms between clicks
- Double-click rate: ~2%

### Forms
- Average field time: 2-5 seconds
- Tab usage: 70% (vs 30% mouse click)
- Optional field skip rate: ~5%

## Next Steps

1. **Integrate into websocket server** - Call `registerBehavioralScoringCommands` at startup
2. **Hook into interaction events** - Call `record_interaction` on user actions
3. **Monitor score updates** - Listen to `behavioral_score_update` events
4. **Act on recommendations** - Implement suggested behavior adjustments
5. **Validate against detection** - Compare scores with actual detection results

## Performance Tips

- **Update interval:** 500ms is optimal balance (accuracy vs overhead)
- **Window size:** 100 events default, increase for longer sessions
- **Memory:** ~2-5MB per session
- **Computation:** <50ms per score update

## Troubleshooting

**Q: Scores always seem low**
A: Check reference patterns - ensure your interactions match human baselines. Add randomness/variation.

**Q: Getting "Analyzer not initialized" errors**
A: Make sure you call `enable_behavioral_scoring` before `record_interaction`.

**Q: Score suddenly drops**
A: Check anomaly detection - you probably triggered a detection pattern. Use `detect_behavior_anomalies` to see what.

**Q: Memory growing**
A: Enable score history pruning with time window, or call `reset_behavioral_tracking` when done.

## More Information

- Full implementation: `/docs/findings/BEHAVIORAL-SCORING-IMPLEMENTATION.md`
- Test examples: `/tests/behavior/behavioral-coherence-scoring.test.js`
- Reference patterns: `/src/behavior/patterns-reference.json`
