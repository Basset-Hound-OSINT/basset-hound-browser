# Behavioral Coherence Scoring - User Guide

**Version:** v12.0.0  
**For:** Investigators, Penetration Testers, Automation Developers

## What Is Behavioral Coherence Scoring?

Behavioral Coherence Scoring watches HOW you interact with a website and gives you a score (0-100) for how "human" your behavior is. Detection systems look for bot behavior - now you can check if YOUR automation looks human enough.

**Score Meaning:**
- 90-100: Excellent human-like behavior
- 75-89: Good, normal behavior, undetectable
- 60-74: Caution, some patterns are off
- 40-59: Warning, bot-like patterns detected
- 0-39: Critical, likely to trigger detection

## When to Use It

### Scenario 1: Test Your Bot
"I built automation to interact with a website. Is it detected as a bot?"

### Scenario 2: Optimize Evasion
"My bot is getting blocked. Where should I improve?"

### Scenario 3: Monitor Real User
"Does this user session show natural behavior?"

## Step-by-Step Tutorials

### Tutorial 1: Check Your Typing Speed

**Goal:** See if your typing looks human

**Steps:**

1. **Start behavioral monitoring**
   ```javascript
   const sessionId = 'typing_test_' + Date.now();
   
   const enableMsg = {
     command: 'enable_behavioral_scoring',
     params: {
       sessionId,
       updateInterval: 500,  // Update every 500ms
       includeBreakdown: true,
       anomalyThreshold: 0.7
     }
   };
   
   await send(enableMsg);
   console.log('Behavioral scoring enabled');
   ```

2. **Type something naturally**
   ```javascript
   // Simulate typing: "hello world"
   const text = 'hello world';
   let lastTime = Date.now();
   
   for (const char of text) {
     // Random delay between keystrokes (50-300ms)
     const delay = Math.random() * 250 + 50;
     await sleep(delay);
     
     // Record the keystroke
     await send({
       command: 'record_interaction',
       params: {
         sessionId,
         type: 'typing',
         data: {
           char,
           timestamp: Date.now(),
           interKeystrokeTime: Date.now() - lastTime,
           keyCode: char.charCodeAt(0)
         }
       }
     });
     
     lastTime = Date.now();
   }
   ```

3. **Check your typing score**
   ```javascript
   const scoreMsg = {
     command: 'get_behavioral_score',
     params: { sessionId }
   };
   
   const result = await send(scoreMsg);
   const typingScore = result.data.dimensions.typingPattern;
   
   console.log('Typing Score:', typingScore);
   if (typingScore < 60) {
     console.log('⚠ Typing looks robotic');
     console.log('Recommendations:', result.data.recommendations);
   } else {
     console.log('✓ Typing looks human');
   }
   ```

### Tutorial 2: Optimize Mouse Movement

**Goal:** Make mouse movement look natural

**Steps:**

1. **Record mouse movements**
   ```javascript
   document.addEventListener('mousemove', (e) => {
     // Calculate velocity (simplified)
     const velocity = calculateVelocity(e.clientX, e.clientY);
     
     send({
       command: 'record_interaction',
       params: {
         sessionId,
         type: 'mouse',
         data: {
           x: e.clientX,
           y: e.clientY,
           timestamp: Date.now(),
           velocity: velocity,
           acceleration: calculateAcceleration()
         }
       }
     });
   });
   ```

2. **Get mouse movement metrics**
   ```javascript
   const metricsMsg = {
     command: 'get_behavioral_metrics',
     params: {
       sessionId,
       dimension: 'mouseMovement'
     }
   };
   
   const metrics = await send(metricsMsg);
   console.log('Mouse velocity:', metrics.data.metrics.averageVelocity);
   console.log('Directness ratio:', metrics.data.metrics.directnessRatio);
   console.log('Pause frequency:', metrics.data.metrics.pauseFrequency);
   ```

3. **Apply improvements**
   ```javascript
   // If directness is too high (>0.9), add curves
   if (metrics.averageDirectness > 0.9) {
     console.log('⚠ Mouse movement too straight');
     console.log('Solution: Add slight curves to paths');
     // Modify your cursor movement to be less linear
   }
   
   // If pause frequency is too low (<0.1), add pauses
   if (metrics.pauseFrequency < 0.1) {
     console.log('⚠ No pauses in mouse movement');
     console.log('Solution: Add 200-500ms pauses mid-movement');
   }
   ```

### Tutorial 3: Monitor Session for Bot Detection Risk

**Goal:** Real-time monitoring with alerts

**Steps:**

1. **Start scoring with event listeners**
   ```javascript
   const sessionId = 'monitored_session_' + Date.now();
   
   // Enable scoring
   await send({
     command: 'enable_behavioral_scoring',
     params: {
       sessionId,
       updateInterval: 1000,  // Update every second
       includeBreakdown: true
     }
   });
   
   // Listen for score updates
   wsServer.on('behavioral_score_update', (event) => {
     if (event.data.sessionId === sessionId) {
       const score = event.data.overallScore;
       const botRisk = event.data.botDetectionRisk;
       
       console.log(`Score: ${score}/100, Bot Risk: ${(botRisk*100).toFixed(1)}%`);
       
       // Alert if risk increases
       if (botRisk > 0.5) {
         console.warn('⚠ High bot detection risk detected');
       }
     }
   });
   ```

2. **Get recommendations when score drops**
   ```javascript
   wsServer.on('behavioral_anomaly_detected', (event) => {
     if (event.data.sessionId === sessionId) {
       console.error(`Anomaly in ${event.data.dimension}:`);
       console.error(`  Severity: ${event.data.severity}`);
       console.error(`  Issue: ${event.data.anomaly}`);
       
       // Get recommendations
       const recs = await send({
         command: 'get_coherence_recommendations',
         params: { sessionId }
       });
       
       recs.data.recommendations.forEach(rec => {
         console.log(`  Fix: ${rec.recommendation}`);
       });
     }
   });
   ```

3. **Stop monitoring when done**
   ```javascript
   await send({
     command: 'disable_behavioral_scoring',
     params: { sessionId }
   });
   ```

## Best Practices

### 1. Variable Typing Speed

✅ **DO:**
```javascript
// Vary typing speed (40-80 WPM is human)
const baseWPM = 65;
const variance = Math.random() * 30 - 15;  // ±15 WPM
const targetWPM = baseWPM + variance;
const delay = (60000 / (targetWPM * 5)) + (Math.random() * 50 - 25);

await sleep(delay);
```

❌ **DON'T:**
```javascript
// Constant typing speed (too perfect)
await sleep(100);  // Every keystroke exactly 100ms
```

### 2. Natural Mouse Movement

✅ **DO:**
```javascript
// Use Bezier curves for smooth movement
// Add micro-pauses (200-500ms) during movement
// Slight overshoot then correction
// Vary velocity (not constant)
```

❌ **DON'T:**
```javascript
// Straight line movement (0-1 coordinates)
// Constant velocity
// No pauses or hesitation
```

### 3. Human-Like Pauses

✅ **DO:**
```javascript
// Add idle time (reading pauses)
// 5-30 seconds is normal for text content
const readingTime = Math.random() * 25000 + 5000;  // 5-30s
await sleep(readingTime);
```

❌ **DON'T:**
```javascript
// No idle periods (suspicious)
// Or too frequent/too long pauses
```

### 4. Error Correction

✅ **DO:**
```javascript
// Occasional typos (0.5-2% error rate)
if (Math.random() < 0.01) {
  // Type wrong character
  await typeChar('x');
  // Pause while "noticing" (500-1000ms)
  await sleep(Math.random() * 500 + 500);
  // Delete and correct
  await typeChar('\b');  // Backspace
  await typeChar('h');   // Correct char
}
```

❌ **DON'T:**
```javascript
// Perfect typing (never makes mistakes)
// Or constant errors (too much correction)
```

### 5. Monitor Multiple Dimensions

✅ **DO:**
```javascript
// Check overall score AND specific dimensions
const score = await get_behavioral_score({ sessionId });

if (score.data.dimensions.typingPattern < 60) {
  console.log('Fix typing');
}
if (score.data.dimensions.mouseMovement < 70) {
  console.log('Fix mouse');
}
if (score.data.dimensions.idlePatterns < 65) {
  console.log('Add reading pauses');
}
```

## Common Problems & Solutions

### Problem: Typing Score Too Low (< 60)

**Cause:** Typing too fast, too perfect, no errors

**Solutions:**
1. **Slow down:** Target 40-80 WPM (average human is 65)
2. **Add typos:** 1-2 mistakes per 100 characters
3. **Variable speed:** Don't type same speed throughout
4. **Longer pauses:** Between words (100-150ms typical)

**Fix:**
```javascript
// Reduced speed
const wpm = 60;
const delayMs = (60000 / (wpm * 5)) + (Math.random() * 100 - 50);
await sleep(delayMs);

// Add occasional mistakes
if (Math.random() < 0.015) {  // 1.5% error rate
  await typeChar(getRandomChar());  // Wrong char
  await sleep(800);  // Notice error
  await typeChar('\b');  // Delete
  await typeChar(correctChar);  // Type correct
}
```

### Problem: Mouse Movement Score Too Low (< 70)

**Cause:** Movement too straight/fast

**Solutions:**
1. **Add curves:** Use Bezier curves (not straight lines)
2. **Vary speed:** Acceleration should be smooth
3. **Add pauses:** Natural hesitation points
4. **Reduce directness:** 0.83-0.88 is target range

**Fix:**
```javascript
// Generate curved path (Bezier curve)
const path = generateBezierPath(fromX, fromY, toX, toY);

// Move along path with variable speed
for (const point of path) {
  const speed = Math.random() * 100 + 150;  // 150-250 px/s
  await moveToPoint(point, speed);
  
  // Random pauses
  if (Math.random() < 0.15) {
    await sleep(Math.random() * 300 + 200);  // 200-500ms
  }
}
```

### Problem: Score Drops After Idle Period

**Cause:** Normal - behavior patterns change

**Solution:**
```javascript
// After idle, "warm up" with slower interactions
// Don't jump into fast actions immediately

// Resume with caution
const firstActionSpeed = Math.random() * 500 + 500;  // 500-1000ms
await sleep(firstActionSpeed);  // Slower first action
```

### Problem: Anomalies Detected

**What's an anomaly?**

Sudden change in a metric. Examples:
- Typing speed suddenly jumps 45%
- Mouse movement gets too fast
- Pauses disappear
- Clicking patterns change

**Solution:**
```javascript
// Get recommendations
const recs = await get_coherence_recommendations({ sessionId });

// Apply prioritized fixes
recs.data.scoreProjection.priority.forEach(priority => {
  console.log(`Priority 1: ${priority}`);
  applyFix(priority);
});

// Verify improvement
const newScore = await get_behavioral_score({ sessionId });
console.log(`New score: ${newScore.data.overallScore}`);
```

---

## Quick Reference

### Behavioral Dimensions (12)

| Dimension | Ideal Range | Problem If |
|-----------|-------------|-----------|
| Typing Speed | 40-80 WPM | <30 or >100 WPM |
| Inter-keystroke | 50-300ms | <50 or >500ms |
| Mouse Velocity | 150-350 px/s | <100 or >500 px/s |
| Click Duration | 100-200ms | <50 or >300ms |
| Idle Duration | 5-30 seconds | <2s or >60s |
| Directness Ratio | 0.83-0.88 | <0.75 or >0.95 |
| Pause Frequency | 15% | 0% or >30% |
| Error Rate | 0.5-2% | 0% or >5% |

### Commands Cheat Sheet

```javascript
// Enable
{ command: 'enable_behavioral_scoring', params: { sessionId } }

// Get current score
{ command: 'get_behavioral_score', params: { sessionId } }

// Get detailed metrics
{ command: 'get_behavioral_metrics', params: { sessionId, dimension } }

// Get history + trend
{ command: 'get_behavioral_history', params: { sessionId, timeWindow } }

// Record interaction
{ command: 'record_interaction', params: { sessionId, type, data } }

// Get improvements
{ command: 'get_coherence_recommendations', params: { sessionId } }

// Stop
{ command: 'disable_behavioral_scoring', params: { sessionId } }
```

---

## Related Documentation

- [Behavioral Coherence Scoring - Integration Guide](../integration/BEHAVIORAL-COHERENCE-SCORING-INTEGRATION-GUIDE.md)
- [Behavioral Coherence Scoring - API Reference](../api/BEHAVIORAL-COHERENCE-SCORING-API-REFERENCE.md)
- [Behavioral Coherence Scoring - Architecture](../technical/BEHAVIORAL-COHERENCE-SCORING-ARCHITECTURE.md)
