# Session Coherence Validation - User Guide

**Version:** v12.0.0  
**For:** Investigators, Forensic Analysts, Bug Bounty Hunters, Developers

## What Is Session Coherence Validation?

Session Coherence Validation monitors a browser session's "fingerprints" across 5 layers to detect when something changes unexpectedly. If someone (or something) hijacks your session, the system detects it.

**The 5 Layers:**
1. **Temporal** - Canvas/WebGL fingerprints stay the same
2. **TLS/HTTP** - Browser signature doesn't change
3. **Device** - Screen/plugins/OS claims consistent
4. **Behavioral** - Typing speed/mouse patterns similar
5. **Timeline** - Events happen in right order (no time travel)

## When to Use It

### Use Case 1: Verify Session Stability
"Did someone hijack my session during this investigation?"
- Record interactions throughout session
- Check coherence score regularly
- Score above 0.85 = session safe, below 0.70 = possible hijack

### Use Case 2: Monitor Multiple Parallel Sessions
"Are these two sessions the same person?"
- Initialize separate sessions
- Compare them with `coherence_compare_sessions`
- If match >0.90 = likely same person

### Use Case 3: Generate Forensic Evidence
"I need proof this session was coherent for court"
- Enable coherence tracking from start
- Call `coherence_export` when done
- Use for legal proceedings (includes forensic hash)

## Step-by-Step Tutorials

### Tutorial 1: Basic Session Monitoring

**Goal:** Monitor a single session and catch coherence issues

**Steps:**

1. **Initialize session** with baseline data
   ```javascript
   const sessionId = 'investigation_' + Date.now();
   const initMsg = {
     command: 'coherence_init_session',
     params: {
       sessionId,
       initialData: {
         os: 'Windows 10',
         browser: 'Chrome 114',
         country: 'US',
         ip: '203.0.113.42'
       }
     }
   };
   await send(initMsg);
   ```

2. **Record interactions** as you browse
   ```javascript
   // After each page load
   const interactMsg = {
     command: 'coherence_record_interaction',
     params: {
       sessionId,
       interactionData: {
         type: 'navigate',
         url: current_url,
         timestamp: Date.now(),
         requestData: {
           network: { ip: '203.0.113.42' },
           headers: { 'User-Agent': navigator.userAgent }
         }
       }
     }
   };
   await send(interactMsg);
   ```

3. **Check status periodically** (every 30 seconds)
   ```javascript
   setInterval(async () => {
     const summaryMsg = {
       command: 'coherence_summary',
       params: { sessionId }
     };
     const result = await send(summaryMsg);
     
     if (!result.data.isCoherent) {
       console.error('ALERT: Session compromised!');
       console.error('Score:', result.data.overallCoherence);
     }
   }, 30000);
   ```

4. **Get detailed analysis** if score drops
   ```javascript
   const analyzeMsg = {
     command: 'coherence_analyze',
     params: { sessionId }
   };
   const analysis = await send(analyzeMsg);
   
   // Check which layer failed
   for (const [layer, data] of Object.entries(analysis.layers)) {
     if (data.status === 'VIOLATION') {
       console.log(`${layer}: VIOLATION (score ${data.score})`);
       console.log('Evidence:', data.evidence);
     }
   }
   ```

### Tutorial 2: Session Comparison for User Identity

**Goal:** Determine if two sessions are from the same user

**Steps:**

1. **Collect baseline sessions**
   - Session A: Morning investigation (9am)
   - Session B: Same person, afternoon (2pm)
   - Session C: Different person (different IP, device)

2. **Compare Session A vs B** (likely same user)
   ```javascript
   const compareMsg = {
     command: 'coherence_compare_sessions',
     params: {
       sessionId1: 'session_A_20260613_morning',
       sessionId2: 'session_B_20260613_afternoon'
     }
   };
   const result = await send(compareMsg);
   
   if (result.data.overallMatch > 0.90) {
     console.log('Very likely same user');
   }
   if (result.data.likelyUserMatch) {
     console.log('User match confirmed');
   }
   ```

3. **Compare Session A vs C** (different users)
   ```javascript
   const compareMsg = {
     command: 'coherence_compare_sessions',
     params: {
       sessionId1: 'session_A_20260613_morning',
       sessionId2: 'session_C_20260613_different'
     }
   };
   const result = await send(compareMsg);
   
   if (result.data.overallMatch < 0.75) {
     console.log('Different users');
     result.data.differenceFactors.forEach(factor => {
       console.log('- ' + factor);
     });
   }
   ```

4. **Interpret results**
   - Match 0.90+: Definitely same user
   - Match 0.75-0.90: Probably same user
   - Match 0.50-0.75: Unclear (insufficient data)
   - Match <0.50: Different users

### Tutorial 3: Forensic Evidence Export

**Goal:** Create court-admissible coherence evidence

**Steps:**

1. **Track session from start**
   ```javascript
   const caseNumber = 'CASE-2026-0613-001';
   const sessionId = `case_${caseNumber}_investigation`;
   
   // Initialize
   const initMsg = {
     command: 'coherence_init_session',
     params: {
       sessionId,
       initialData: {
         os: 'Windows 10',
         browser: 'Chrome 114',
         country: 'US'
       }
     }
   };
   await send(initMsg);
   ```

2. **Record all interactions during investigation**
   - Document every page load
   - Every interaction recorded
   - Timestamps precise

3. **Export when done**
   ```javascript
   const exportMsg = {
     command: 'coherence_export',
     params: { sessionId }
   };
   const result = await send(exportMsg);
   
   // Save to file
   const report = {
     caseNumber,
     sessionId,
     analysis: result.data.coherenceReport,
     violations: result.data.violations,
     layerDetails: result.data.layerDetails,
     forensicHash: result.data.forensicHash,
     exportedAt: new Date().toISOString()
   };
   
   fs.writeFileSync(
     `coherence_evidence_${sessionId}.json`,
     JSON.stringify(report, null, 2)
   );
   ```

4. **Use in legal proceedings**
   - forensicHash proves integrity
   - Layer breakdown shows session was coherent
   - Timestamp logs prove authenticity
   - Ready for court

## Best Practices

### 1. Initialize Early and Properly

✅ **DO:**
```javascript
// Initialize with complete baseline
const initMsg = {
  command: 'coherence_init_session',
  params: {
    sessionId: unique_id,
    initialData: {
      os: os.platform(),
      browser: get_browser_info(),
      userAgent: navigator.userAgent,
      country: geolocation.country,
      ip: server_provided_ip,
      fingerprint: {
        canvas: generate_canvas_hash(),
        webgl: generate_webgl_hash()
      }
    }
  }
};
```

❌ **DON'T:**
```javascript
// Initialize with minimal data - less effective
const initMsg = {
  command: 'coherence_init_session',
  params: {
    sessionId: 'sess_123'
    // Missing initialData = less baseline to compare against
  }
};
```

### 2. Record Interactions Consistently

✅ **DO:**
```javascript
// Record with complete data on each interaction
const interactMsg = {
  command: 'coherence_record_interaction',
  params: {
    sessionId,
    interactionData: {
      type: 'navigate',
      url: current_url,
      timestamp: Date.now(),
      requestData: {
        network: { ip: current_ip, latency: measured_latency },
        headers: all_headers,
        tls: { ja3: calculated_ja3 },
        device: { screen: '1920x1080' },
        behavior: { mouseVelocity: recorded_velocity },
        cookies: active_cookies,
        localStorage: stored_data
      }
    }
  }
};
```

### 3. Monitor Strategically

✅ **DO:**
```javascript
// Check status every 30-60 seconds
setInterval(async () => {
  const result = await send({
    command: 'coherence_summary',
    params: { sessionId }
  });
  
  if (result.data.violationCount > 0) {
    // Alert on NEW violations
    handleViolation(result);
  }
}, 30000);
```

❌ **DON'T:**
```javascript
// Don't hammer the API
setInterval(async () => {
  // This is too frequent - creates overhead
  await send({ command: 'coherence_analyze', params });
}, 1000);
```

### 4. Handle Violations Properly

✅ **DO:**
```javascript
const analysis = await send({
  command: 'coherence_analyze',
  params: { sessionId }
});

if (!analysis.data.isCoherent) {
  // Check what actually changed
  const violations = analysis.data.layers;
  
  if (violations.temporal.status === 'VIOLATION') {
    console.log('Fingerprint drift detected - session may be compromised');
    // Take action: stop sensitive operations, alert user
  }
  
  if (violations.network.status === 'VIOLATION') {
    console.log('IP changed - expected if using VPN/proxy');
    // May be legitimate - check if expected
  }
}
```

❌ **DON'T:**
```javascript
// Don't ignore violations
if (coherenceScore < 0.85) {
  console.warn('Low coherence');
  // ...continuing as if nothing happened
}
```

### 5. Clean Up Old Sessions

✅ **DO:**
```javascript
// Periodically clean up to manage memory
setInterval(async () => {
  await send({
    command: 'coherence_cleanup',
    params: {
      maxAgeMs: 3600000  // 1 hour
    }
  });
}, 600000);  // Every 10 minutes
```

### 6. Compare Apples-to-Apples

✅ **DO:**
```javascript
// Compare similar sessions (same time window, same device)
const morningSession = sessions.filter(s => 
  s.startTime.getHours() >= 9 && 
  s.startTime.getHours() < 12
);

const afternoonSession = sessions.filter(s =>
  s.startTime.getHours() >= 14 &&
  s.startTime.getHours() < 17
);

// Compare sessions close in time
if (morningSession && afternoonSession) {
  const result = await send({
    command: 'coherence_compare_sessions',
    params: {
      sessionId1: morningSession[0].id,
      sessionId2: afternoonSession[0].id
    }
  });
}
```

## Troubleshooting Guide

### Q: My coherence score suddenly dropped. What happened?

**Check the 5 layers:**

```javascript
const analysis = await send({
  command: 'coherence_analyze',
  params: { sessionId }
});

// Check each layer
console.log('Temporal (fingerprints):', analysis.layers.temporal.status);
console.log('Network (TLS/HTTP):', analysis.layers.network.status);
console.log('Device (hardware claims):', analysis.layers.device.status);
console.log('Behavioral (patterns):', analysis.layers.behavioral.status);
console.log('Timeline (event order):', analysis.layers.timeline.status);
```

**Common causes:**
- **Temporal violation:** Canvas spoofing detected, disable evasion techniques
- **Network violation:** IP changed, use stable proxy/VPN
- **Device violation:** Screen resolution changed (unusual)
- **Behavioral violation:** Typing/mouse patterns changed, be more consistent
- **Timeline violation:** Events out of order (clock skew), sync system time

### Q: Sessions from same user aren't matching. Why?

**Likely causes:**

1. **Time gap too large**
   - Session A: 9am, Session B: 9pm (same day)
   - Behavior naturally changes over time
   - Solution: Compare sessions closer in time

2. **Device changed**
   - Morning: Chrome on Windows
   - Afternoon: Firefox on Mac
   - Solution: Compare sessions on same device

3. **Location changed**
   - Morning: US (203.0.113.x)
   - Afternoon: VPN to UK
   - Solution: Note expected IP changes

### Q: How accurate is session comparison?

**Accuracy by scenario:**

- **Same person, same device, close in time:** 90-95% match
- **Same person, same device, hours apart:** 85-90% match
- **Same person, different device:** 50-70% match (unreliable)
- **Same person, major IP change:** 70-85% match
- **Different people, similar patterns:** 40-60% match (ambiguous)

### Q: Session shows coherent but I think it's fake. Why?

**Possible reasons:**

1. **Good evasion techniques**
   - Attacker using advanced spoofing
   - Session still technically coherent
   - But other evidence (content, behavior) is suspicious

2. **Insufficient baseline data**
   - Not enough interactions to see patterns
   - More data needed for accurate verdict

3. **Limited detection methods**
   - Only checking 5 layers
   - Other signals (content, timing) ignored

**Solution:**
- Combine coherence analysis with other evidence
- Content analysis (what they accessed)
- Temporal analysis (when they accessed)
- Behavioral analysis (how they interacted)

---

## Quick Reference

### Essential Commands

```javascript
// Initialize
{ command: 'coherence_init_session', params: { sessionId, initialData } }

// Record interaction
{ command: 'coherence_record_interaction', params: { sessionId, interactionData } }

// Check quick status
{ command: 'coherence_summary', params: { sessionId } }

// Get detailed analysis
{ command: 'coherence_analyze', params: { sessionId } }

// Compare sessions
{ command: 'coherence_compare_sessions', params: { sessionId1, sessionId2 } }

// Export for evidence
{ command: 'coherence_export', params: { sessionId } }

// List active sessions
{ command: 'coherence_list_sessions', params: {} }

// Clean up old sessions
{ command: 'coherence_cleanup', params: { maxAgeMs } }
```

### Score Interpretation

| Score | Status | Action |
|-------|--------|--------|
| 0.95-1.00 | Excellent | Session very safe |
| 0.85-0.95 | Good | Session safe to proceed |
| 0.70-0.85 | Caution | Monitor closely |
| 0.50-0.70 | Warning | High risk, investigate |
| <0.50 | Critical | Likely compromised |

---

## Related Documentation

- [Session Coherence Validation - Integration Guide](../integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md)
- [Session Coherence Validation - API Reference](../archive/deprecated/SESSION-COHERENCE-VALIDATION-API-REFERENCE.md)
- [Session Coherence Validation - Architecture](../technical/SESSION-COHERENCE-VALIDATION-ARCHITECTURE.md)
