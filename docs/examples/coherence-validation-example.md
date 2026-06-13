# Session Coherence Validation - Usage Examples

This document provides practical examples of how to use the Session Coherence Validation API.

---

## Basic Usage: Initialize and Track a Session

### JavaScript/Node.js

```javascript
const { CoherenceManager } = require('../src/evasion/coherence-manager');

// Create manager instance (or reuse from WebSocket server)
const coherence = new CoherenceManager();

// Initialize a session with baseline device/fingerprint data
const initResult = coherence.initializeSession('session_123', {
  os: 'macOS 13.4',
  browser: 'Chrome 114',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  country: 'US',
  ip: '1.2.3.4',
  fingerprint: {
    canvas: 'abc123def456',
    webgl: 'canvas_hash_789'
  },
  device: {
    screenResolution: '1920x1080',
    colorDepth: 24
  },
  network: {
    bandwidth: 'high'
  }
});

console.log('Session initialized:', initResult);
// Output: { success: true, sessionId: 'session_123', initialized: true }
```

### Python (for palletai agents)

```python
import asyncio
import json
from websocket import WebSocket

async def init_coherence_session():
    ws = WebSocket('ws://localhost:8765')
    
    result = await ws.send({
        'command': 'coherence_init_session',
        'params': {
            'sessionId': 'agent_session_001',
            'initialData': {
                'os': 'Linux',
                'browser': 'Firefox',
                'userAgent': 'Mozilla/5.0 (X11; Linux x86_64)...',
                'country': 'UK',
                'ip': '123.45.67.89',
                'fingerprint': {
                    'canvas': 'hash_abc',
                    'webgl': 'hash_def'
                }
            }
        }
    })
    
    print(f"Initialized: {result}")
    return result
```

---

## Recording Interactions

### Record a Navigate Event

```javascript
const interactionResult = coherence.recordInteraction('session_123', {
  type: 'navigate',
  url: 'https://example.com/login',
  requestData: {
    network: {
      ip: '1.2.3.4',
      asn: 'AS12345',
      provider: 'ISP Name',
      timestamp: Date.now()
    },
    headers: {
      'user-agent': 'Mozilla/5.0...',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br'
    },
    tls: {
      ja3: 'current_ja3_fingerprint',
      tlsVersion: '1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384'
    },
    device: {
      canvas: 'abc123def456',  // Current fingerprint
      webgl: 'canvas_hash_789'
    },
    cookies: [
      { name: 'sessionid', value: 'abc123...', domain: '.example.com' },
      { name: 'tracking', value: 'xyz789...', domain: '.example.com' }
    ],
    localStorage: [
      { key: 'theme', value: 'dark' },
      { key: 'locale', value: 'en-US' }
    ]
  }
});

console.log('Interaction recorded:', interactionResult);
// Output includes coherence validation result
```

### Record Multiple Interactions in Sequence

```javascript
const interactions = [
  { type: 'navigate', url: 'https://example.com' },
  { type: 'click', selector: 'button.login' },
  { type: 'fill', selector: 'input.email', value: 'user@example.com' },
  { type: 'fill', selector: 'input.password', value: 'password' },
  { type: 'click', selector: 'button.submit' },
  { type: 'navigate', url: 'https://example.com/dashboard' }
];

for (let i = 0; i < interactions.length; i++) {
  const result = coherence.recordInteraction('session_123', {
    ...interactions[i],
    requestData: {
      network: {
        ip: '1.2.3.4',  // Should remain constant
        timestamp: Date.now() + (i * 1000)  // Sequential timestamps
      }
    }
  });
  
  if (result.coherenceResult) {
    console.log(`Step ${i+1}: Coherence = ${result.coherenceResult.overallScore}`);
  }
}
```

---

## Analyzing Coherence

### Get Full Coherence Analysis

```javascript
const analysis = coherence.analyzeCoherence('session_123');

console.log('Overall Coherence Score:', analysis.overallCoherence);
console.log('Is Coherent:', analysis.isCoherent);

// Per-layer scores
console.log('Layer Scores:');
console.log('  Temporal (Fingerprint):', analysis.layers.temporal.score);
console.log('  Behavioral (Patterns):', analysis.layers.behavioral.score);
console.log('  Network (IP/Headers):', analysis.layers.network.score);
console.log('  Device (Screen/UA):', analysis.layers.device.score);
console.log('  Timeline (Events):', analysis.layers.timeline.score);

// Violations
if (analysis.layers.temporal.violations.length > 0) {
  console.log('Temporal violations:');
  analysis.layers.temporal.violations.forEach(v => {
    console.log(`  - ${v.reason}`);
  });
}

// Recovery suggestions
if (analysis.recoveryStrategies.length > 0) {
  console.log('Recovery suggestions:');
  analysis.recoveryStrategies.forEach(s => {
    console.log(`  [${s.severity}] ${s.suggestion}`);
  });
}
```

### Quick Status Check

```javascript
const summary = coherence.getCoherenceSummary('session_123');

console.log('Session Status:');
console.log(`  Coherence: ${(summary.overallCoherence * 100).toFixed(1)}%`);
console.log(`  Coherent: ${summary.isCoherent ? '✅ Yes' : '❌ No'}`);
console.log(`  Interactions: ${summary.interactionCount}`);
console.log(`  Violations: ${summary.violationCount}`);
console.log(`  Critical: ${summary.criticalViolations}, High: ${summary.highViolations}`);

if (summary.warnings.length > 0) {
  console.log('  Warnings:');
  summary.warnings.forEach(w => {
    console.log(`    - ${w.suggestion}`);
  });
}
```

---

## Comparing Sessions

### Identify if Two Sessions are from Same User

```javascript
// Suppose you have two sessions you want to compare
const session1 = 'user_monday_session';
const session2 = 'user_tuesday_session';

const comparison = coherence.compareSessions(session1, session2);

console.log('Session Comparison:');
console.log(`  Device Match: ${(comparison.deviceMatch * 100).toFixed(1)}%`);
console.log(`  Behavior Match: ${(comparison.behaviorMatch * 100).toFixed(1)}%`);
console.log(`  Network Match: ${(comparison.networkMatch * 100).toFixed(1)}%`);
console.log(`  Overall Match: ${(comparison.overallMatch * 100).toFixed(1)}%`);
console.log(`  Likely Same User: ${comparison.likelyUserMatch ? 'YES' : 'NO'}`);

if (comparison.differenceFactors.length > 0) {
  console.log('  Differences:');
  comparison.differenceFactors.forEach(f => {
    console.log(`    - ${f}`);
  });
}
```

### Use Case: Multi-Session Fraud Detection

```javascript
function detectSuspiciousMultiSessions(sessionIds) {
  const suspiciousPairs = [];
  
  for (let i = 0; i < sessionIds.length; i++) {
    for (let j = i + 1; j < sessionIds.length; j++) {
      const comparison = coherence.compareSessions(sessionIds[i], sessionIds[j]);
      
      // If sessions match too well but claim different locations, suspicious
      if (comparison.overallMatch > 0.90 && comparison.likelyUserMatch) {
        const summary1 = coherence.getCoherenceSummary(sessionIds[i]);
        const summary2 = coherence.getCoherenceSummary(sessionIds[j]);
        
        if (summary1.interactionCount > 20 && summary2.interactionCount > 20) {
          suspiciousPairs.push({
            session1: sessionIds[i],
            session2: sessionIds[j],
            similarity: comparison.overallMatch,
            reason: 'Too similar for different users'
          });
        }
      }
    }
  }
  
  return suspiciousPairs;
}

// Usage:
const suspicious = detectSuspiciousMultiSessions([
  'account_123_session_1',
  'account_456_session_1',
  'account_789_session_1'
]);

if (suspicious.length > 0) {
  console.log('⚠️ Suspicious patterns detected:');
  suspicious.forEach(pair => {
    console.log(`  ${pair.session1} <-> ${pair.session2}: ${(pair.similarity*100).toFixed(1)}% match`);
  });
}
```

---

## Exporting Data for Forensics

### Export Session Coherence Report

```javascript
const exportData = coherence.exportSessionCoherence('session_123');

console.log('Session Coherence Export:');
console.log(`  Session ID: ${exportData.sessionId}`);
console.log(`  Duration: ${(exportData.duration / 1000).toFixed(1)}s`);
console.log(`  Overall Score: ${exportData.coherenceReport.overallScore}`);
console.log(`  Interactions: ${exportData.interactionCount}`);

// Save to file for forensic analysis
const fs = require('fs');
fs.writeFileSync(
  `/tmp/coherence_report_${exportData.sessionId}.json`,
  JSON.stringify(exportData, null, 2)
);

console.log(`  Saved to: /tmp/coherence_report_${exportData.sessionId}.json`);
```

### Verify Forensic Integrity

```javascript
// Export creates a forensic hash for integrity verification
const exportData1 = coherence.exportSessionCoherence('session_123');
const hash1 = exportData1.forensicHash;

// Later, export again and verify hash unchanged
const exportData2 = coherence.exportSessionCoherence('session_123');
const hash2 = exportData2.forensicHash;

if (hash1 === hash2) {
  console.log('✅ Forensic data integrity verified');
} else {
  console.log('⚠️ Forensic data has changed!');
}
```

---

## WebSocket API Integration

### Initialize via WebSocket

```javascript
// Client code
const ws = new WebSocket('ws://localhost:8765');

// Initialize session
ws.send(JSON.stringify({
  command: 'coherence_init_session',
  params: {
    sessionId: 'ws_session_001',
    initialData: {
      os: 'Windows',
      browser: 'Chrome',
      fingerprint: { canvas: 'hash...' }
    }
  }
}));

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};
```

### Record Interaction via WebSocket

```javascript
ws.send(JSON.stringify({
  command: 'coherence_record_interaction',
  params: {
    sessionId: 'ws_session_001',
    interactionData: {
      type: 'navigate',
      url: 'https://example.com',
      requestData: {
        network: { ip: '1.2.3.4' }
      }
    }
  }
}));
```

### Get Analysis via WebSocket

```javascript
ws.send(JSON.stringify({
  command: 'coherence_analyze',
  params: { sessionId: 'ws_session_001' }
}));

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.success) {
    console.log('Coherence Score:', response.overallCoherence);
    console.log('Status:', response.isCoherent ? 'COHERENT' : 'VIOLATION');
  }
};
```

---

## Real-World Scenario: Bot Evasion Validation

```javascript
async function validateBotEvasionTechniques() {
  const coherence = new CoherenceManager();
  
  // Start evasion session
  coherence.initializeSession('evasion_test_01', {
    os: 'Ubuntu 22.04',
    browser: 'Chrome 114',
    fingerprint: generateRandomizedFingerprint(),
    device: generateFakeDevice()
  });
  
  const evasionTechniques = [
    { name: 'VPN rotation', interval: 30000 },
    { name: 'User-Agent spoofing', interval: 60000 },
    { name: 'Canvas fingerprint rotation', interval: 120000 },
    { name: 'Typing pattern variation', interval: 5000 }
  ];
  
  // Simulate a session with evasion techniques
  let coherenceScore = 1.0;
  for (let i = 0; i < 20; i++) {
    // Record interaction with potentially evasive behavior
    const result = coherence.recordInteraction('evasion_test_01', {
      type: 'navigate',
      url: `https://target.com/page${i}`,
      requestData: {
        network: {
          ip: shouldRotateIP() ? generateRandomIP() : '1.2.3.4'
        },
        headers: {
          'user-agent': generateRotatedUserAgent()
        },
        device: {
          canvas: generateRandomCanvas()
        }
      }
    });
    
    if (result.coherenceResult) {
      coherenceScore = result.coherenceResult.overallScore;
      console.log(`Step ${i+1}: Coherence = ${coherenceScore.toFixed(3)}`);
      
      // If coherence drops, log violations
      if (coherenceScore < 0.80) {
        console.log('⚠️ Coherence violation detected!');
        const analysis = coherence.analyzeCoherence('evasion_test_01');
        analysis.recoveryStrategies.forEach(s => {
          console.log(`  Suggestion: ${s.suggestion}`);
        });
      }
    }
    
    // Wait between interactions
    await sleep(2000);
  }
  
  // Final report
  const finalAnalysis = coherence.analyzeCoherence('evasion_test_01');
  console.log('\nFinal Bot Evasion Validation:');
  console.log(`  Overall Coherence: ${(finalAnalysis.overallCoherence * 100).toFixed(1)}%`);
  console.log(`  Status: ${finalAnalysis.isCoherent ? '✅ COHERENT' : '❌ INCOHERENT'}`);
  
  if (finalAnalysis.isCoherent) {
    console.log('✅ Evasion techniques passed coherence validation!');
  } else {
    console.log('❌ Evasion techniques triggered coherence violations');
  }
  
  return finalAnalysis;
}

// Usage:
validateBotEvasionTechniques().then(result => {
  console.log('Validation complete');
});
```

---

## Monitoring & Dashboarding

### List All Active Sessions

```javascript
const sessions = coherence.sessions;  // Map of all sessions

console.log(`Active Sessions: ${sessions.size}`);
sessions.forEach((session, sessionId) => {
  const summary = coherence.getCoherenceSummary(sessionId);
  console.log(`  ${sessionId}:`);
  console.log(`    Coherence: ${(summary.overallCoherence * 100).toFixed(1)}%`);
  console.log(`    Interactions: ${summary.interactionCount}`);
  console.log(`    Status: ${summary.isCoherent ? '✅ OK' : '⚠️ Violations'}`);
});
```

### Memory Management

```javascript
// Clean up sessions older than 1 hour
const cleanup = coherence.cleanupOldSessions(3600000);
console.log(`Cleaned up ${cleanup.cleaned} old sessions`);
console.log(`Remaining sessions: ${coherence.sessions.size}`);
```

---

## Error Handling

```javascript
try {
  const analysis = coherence.analyzeCoherence('nonexistent_session');
} catch (error) {
  console.error('Error:', error.message);
  // Handle: "Session not found: nonexistent_session"
}

// Always check response success on WebSocket calls
const response = await callWebSocketCommand('coherence_analyze', {
  sessionId: 'session_123'
});

if (!response.success) {
  console.error('Command failed:', response.error);
  // Handle error appropriately
}
```

---

## Performance Tips

1. **Batch interactions:** Record multiple interactions before analyzing
2. **Periodic analysis:** Don't call `analyzeCoherence` on every interaction
3. **Memory cleanup:** Regularly call `cleanupOldSessions()` 
4. **Cache summaries:** Use `getCoherenceSummary()` for quick checks
5. **Async operations:** Run expensive exports asynchronously

---

## Troubleshooting

### Low Coherence Score
```javascript
const analysis = coherence.analyzeCoherence('session_123');

// Check which layers are problematic
const layerScores = {
  temporal: analysis.layers.temporal.score,
  behavioral: analysis.layers.behavioral.score,
  network: analysis.layers.network.score,
  device: analysis.layers.device.score,
  timeline: analysis.layers.timeline.score
};

Object.entries(layerScores).forEach(([layer, score]) => {
  if (score < 0.85) {
    console.log(`⚠️ ${layer} coherence low: ${score}`);
  }
});
```

### Frequent Violations
```javascript
// Check what specific violations are occurring
const analysis = coherence.analyzeCoherence('session_123');
const allViolations = [];

Object.values(analysis.layers).forEach(layer => {
  if (layer.violations) {
    allViolations.push(...layer.violations);
  }
});

// Group by component
const byComponent = {};
allViolations.forEach(v => {
  byComponent[v.component] = (byComponent[v.component] || 0) + 1;
});

console.log('Violations by component:', byComponent);
```

---

This documentation provides practical, real-world examples for using the Session Coherence Validation framework.
