# Session Coherence Validation - Integration Guide

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**Status:** Production Ready

## Feature Overview

Session Coherence Validation is a 5-layer real-time detection system that validates the consistency of browser interactions across network, device, behavioral, and temporal dimensions. It detects when a session's fingerprints, network characteristics, or behavior patterns diverge significantly, signaling potential detection or compromise.

The system monitors:
1. **IP/Network Consistency** - Validates IP address, network patterns, request timing
2. **TLS/HTTP Fingerprints** - Ensures consistent TLS handshakes and HTTP headers
3. **Device Fingerprints** - Validates OS, browser, hardware claims across interactions
4. **Behavioral Patterns** - Monitors mouse velocity, typing speed, scroll patterns
5. **Timeline Coherence** - Ensures event sequence validity and detects time anomalies

## Quick Start

### Minimal Example - Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Initialize a session for coherence tracking
  const initMsg = {
    command: 'coherence_init_session',
    params: {
      sessionId: 'sess_user123',
      initialData: {
        os: 'Windows 10',
        browser: 'Chrome 114',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        country: 'US',
        ip: '203.0.113.42',
        fingerprint: {
          canvas: 'abc123def456',
          webgl: 'vendor:gpu',
          audioContext: 'sampleRate:48000'
        },
        behavior: {
          mouseVelocity: 250,
          typingSpeed: 65
        }
      }
    }
  };
  
  ws.send(JSON.stringify(initMsg));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
});
```

### Python Example

```python
import json
import asyncio
import websockets

async def coherence_example():
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Initialize session
        init_msg = {
            "command": "coherence_init_session",
            "params": {
                "sessionId": "sess_user123",
                "initialData": {
                    "os": "macOS",
                    "browser": "Safari 16",
                    "country": "GB",
                    "ip": "198.51.100.42"
                }
            }
        }
        
        await websocket.send(json.dumps(init_msg))
        response = json.loads(await websocket.recv())
        print("Initialized:", response)
        
        # Record an interaction
        interact_msg = {
            "command": "coherence_record_interaction",
            "params": {
                "sessionId": "sess_user123",
                "interactionData": {
                    "type": "navigate",
                    "url": "https://example.com",
                    "timestamp": 1686786225000,
                    "requestData": {
                        "network": {"ip": "198.51.100.42"},
                        "headers": {"User-Agent": "Mozilla/5.0..."},
                        "device": {"screenWidth": 1920}
                    }
                }
            }
        }
        
        await websocket.send(json.dumps(interact_msg))
        response = json.loads(await websocket.recv())
        print("Interaction recorded:", response)

asyncio.run(coherence_example())
```

### JavaScript/Browser Example

```javascript
// Using fetch API to simulate WebSocket interaction
async function initializeCoherence() {
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'coherence_init_session',
      params: {
        sessionId: 'sess_browser_' + Date.now(),
        initialData: {
          os: 'Windows 10',
          browser: 'Firefox 113',
          userAgent: navigator.userAgent,
          ip: '', // Obtained server-side
          fingerprint: {
            canvas: getCanvasFingerprint(),
            webgl: getWebGLFingerprint()
          }
        }
      }
    })
  });
  
  return await response.json();
}

function recordBrowserInteraction(sessionId, type, data) {
  const msg = {
    command: 'coherence_record_interaction',
    params: {
      sessionId,
      interactionData: {
        type,
        timestamp: Date.now(),
        requestData: {
          device: {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
          },
          behavior: data
        }
      }
    }
  };
  
  // Send via WebSocket or queue for batch sending
  return msg;
}
```

## WebSocket Commands

### Command Overview

| Command | Purpose | Params | Returns |
|---------|---------|--------|---------|
| `coherence_init_session` | Initialize session tracking | sessionId, initialData | {success, sessionId, initialized, message} |
| `coherence_record_interaction` | Record + validate interaction | sessionId, interactionData | {success, interactionId, coherenceResult} |
| `coherence_analyze` | Get 5-layer analysis | sessionId | {success, overallCoherence, layers, violations} |
| `coherence_compare_sessions` | Compare 2 sessions | sessionId1, sessionId2 | {success, deviceMatch, behaviorMatch, overallMatch} |
| `coherence_export` | Export forensic report | sessionId | {success, data{sessionId, coherenceReport, violations}} |
| `coherence_summary` | Quick status check | sessionId | {success, data{overallCoherence, violationCount}} |
| `coherence_list_sessions` | List active sessions | (none) | {success, sessions[], totalSessions} |
| `coherence_cleanup` | Remove old sessions | maxAgeMs (optional) | {success, cleaned, remaining} |

### Command Details

#### coherence_init_session

Initialize a new session for real-time coherence tracking.

**Parameters:**
```json
{
  "sessionId": "sess_123",
  "initialData": {
    "os": "Windows 10",
    "browser": "Chrome 114",
    "userAgent": "Mozilla/5.0...",
    "country": "US",
    "ip": "203.0.113.42",
    "fingerprint": {
      "canvas": "abc123def456",
      "webgl": "vendor:gpu",
      "audioContext": {...}
    },
    "behavior": {
      "mouseVelocity": 250,
      "typingSpeed": 65
    },
    "device": {
      "screenWidth": 1920,
      "screenHeight": 1080
    },
    "network": {...},
    "headers": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "sess_123",
  "initialized": true,
  "message": "Session coherence tracking initialized"
}
```

**Error Cases:**
- Missing sessionId: `{success: false, error: "sessionId is required"}`
- Already initialized: `{success: false, error: "Session sess_123 already initialized"}`

#### coherence_record_interaction

Record a browser interaction and perform real-time coherence validation.

**Parameters:**
```json
{
  "sessionId": "sess_123",
  "interactionData": {
    "type": "navigate|click|type|scroll",
    "url": "https://example.com",
    "timestamp": 1686786225000,
    "requestData": {
      "network": {
        "ip": "203.0.113.42",
        "requestTiming": 245
      },
      "headers": {
        "User-Agent": "Mozilla/5.0...",
        "Accept-Language": "en-US"
      },
      "tls": {
        "ja3": "tlsv12,28674,10-11-35-16..."
      },
      "device": {
        "screenWidth": 1920,
        "screenHeight": 1080
      },
      "behavior": {
        "mouseVelocity": 250,
        "typingSpeed": 65
      },
      "cookies": [...],
      "localStorage": [...],
      "cache": {...}
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "interactionId": "interaction_0_1686786225123",
  "coherenceResult": {
    "timestamp": "2026-06-13T14:23:45Z",
    "overallScore": 0.94,
    "layers": {
      "layer1": {"score": 0.98, "status": "COHERENT"},
      "layer2": {"score": 0.92, "status": "COHERENT"},
      "layer3": {"score": 0.96, "status": "COHERENT"},
      "layer4": {"score": 0.89, "status": "COHERENT"},
      "layer5": {"score": 0.95, "status": "COHERENT"}
    },
    "violations": []
  }
}
```

#### coherence_analyze

Get comprehensive 5-layer coherence analysis for the entire session.

**Parameters:**
```json
{
  "sessionId": "sess_123"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "sess_123",
  "overallCoherence": 0.942,
  "isCoherent": true,
  "timestamp": "2026-06-13T14:23:45Z",
  "layers": {
    "temporal": {
      "score": 0.961,
      "status": "COHERENT",
      "fingerprintDrift": 0.01,
      "violations": [],
      "evidence": {
        "initialFingerprint": {...},
        "driftAnalysis": "Fingerprint drift 1% (max 2%)"
      }
    },
    "behavioral": {
      "score": 0.89,
      "status": "COHERENT",
      "patternConsistency": 0.89,
      "violations": [],
      "evidence": {
        "mousePattern": "45 interactions tracked",
        "typingPattern": "Consistency analyzed across keystroke timing",
        "scrollPattern": "Scroll behavior validated"
      }
    },
    "network": {
      "score": 0.92,
      "status": "COHERENT",
      "requestPatternMatch": 0.92,
      "violations": [],
      "evidence": {
        "requestTiming": "Consistent within 20-30ms variance",
        "headerConsistency": "All headers validated",
        "bandwidthMatch": "Matches claimed device capabilities"
      }
    },
    "device": {
      "score": 0.96,
      "status": "COHERENT",
      "contradictions": 0,
      "violations": [],
      "evidence": {
        "osConsistency": "Windows 10 consistently claimed",
        "browserConsistency": "Chrome 114 consistently claimed",
        "screenConsistency": "1920x1080 consistent",
        "pluginConsistency": "Plugin presence consistent"
      }
    },
    "timeline": {
      "score": 0.95,
      "status": "COHERENT",
      "gaps": [],
      "violations": [],
      "evidence": {
        "totalEventCount": 45,
        "eventSequenceValid": true,
        "noTimeTravel": true
      }
    }
  },
  "history": [...],
  "totalInteractions": 45,
  "sessionDuration": 234567,
  "recoveryStrategies": []
}
```

#### coherence_compare_sessions

Compare two sessions for coherence similarity and user matching.

**Parameters:**
```json
{
  "sessionId1": "sess_123",
  "sessionId2": "sess_456"
}
```

**Response:**
```json
{
  "success": true,
  "session1Id": "sess_123",
  "session2Id": "sess_456",
  "deviceMatch": 0.98,
  "behaviorMatch": 0.85,
  "networkMatch": 0.92,
  "overallMatch": 0.92,
  "likelyUserMatch": true,
  "differenceFactors": [
    "Device fingerprint differs: 98% match",
    "Behavioral patterns differ (acceptable for time-shifted sessions)"
  ],
  "timestamp": "2026-06-13T14:30:00Z"
}
```

#### coherence_export

Export session coherence data for forensic analysis and legal proceedings.

**Parameters:**
```json
{
  "sessionId": "sess_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "createdAt": "2026-06-13T14:00:00Z",
    "duration": 234567,
    "coherenceReport": {
      "overallScore": 0.942,
      "isCoherent": true,
      "timestamp": "2026-06-13T14:23:45Z",
      "layerScores": {
        "temporal": 0.961,
        "behavioral": 0.89,
        "network": 0.92,
        "device": 0.96,
        "timeline": 0.95
      }
    },
    "violations": [],
    "interactionCount": 45,
    "layerDetails": {...},
    "recommendations": [],
    "forensicHash": "sha256:abc123def456..."
  }
}
```

#### coherence_summary

Get quick coherence status summary without detailed analysis.

**Parameters:**
```json
{
  "sessionId": "sess_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "overallCoherence": 0.942,
    "isCoherent": true,
    "timestamp": "2026-06-13T14:23:45Z",
    "violationCount": 0,
    "interactionCount": 45,
    "criticalViolations": 0,
    "highViolations": 0,
    "warnings": []
  }
}
```

#### coherence_list_sessions

List all active coherence-tracked sessions.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_123",
      "createdAt": "2026-06-13T14:00:00Z",
      "interactionCount": 45,
      "overallCoherence": 0.942,
      "isCoherent": true,
      "lastInteractionTime": "2026-06-13T14:23:45Z"
    },
    {
      "sessionId": "sess_456",
      "createdAt": "2026-06-13T14:10:00Z",
      "interactionCount": 23,
      "overallCoherence": 0.871,
      "isCoherent": true,
      "lastInteractionTime": "2026-06-13T14:22:30Z"
    }
  ],
  "totalSessions": 2
}
```

#### coherence_cleanup

Clean up old sessions to manage memory usage.

**Parameters:**
```json
{
  "maxAgeMs": 3600000
}
```

**Response:**
```json
{
  "success": true,
  "cleaned": 5,
  "remaining": 10
}
```

## Use Cases

### Use Case 1: Monitor Active Session Coherence

Continuously monitor a session for coherence violations and trigger alerts when suspicious patterns emerge.

```javascript
async function monitorSessionCoherence(sessionId) {
  // Start monitoring
  const enableMsg = {
    command: 'coherence_analyze',
    params: { sessionId }
  };
  
  // Check every 5 seconds
  setInterval(async () => {
    const response = await sendWebSocketCommand(enableMsg);
    
    if (!response.success) return;
    
    const coherence = response.overallCoherence;
    
    // Alert on violations
    if (coherence < 0.85) {
      console.warn(`ALERT: Coherence drop for ${sessionId}: ${coherence}`);
      
      // Get detailed analysis
      response.recoveryStrategies.forEach(strategy => {
        console.log(`Recommendation: ${strategy.suggestion}`);
      });
    }
    
    // Track trend
    if (response.layers.temporal.status === 'VIOLATION') {
      console.error('Fingerprint drift detected - session may be compromised');
    }
  }, 5000);
}
```

### Use Case 2: Validate User Continuity Across Sessions

Compare multiple sessions to determine if they belong to the same user or different users.

```javascript
async function validateUserContinuity(sessionIds) {
  const comparison = [];
  
  // Compare each pair
  for (let i = 0; i < sessionIds.length - 1; i++) {
    const compareMsg = {
      command: 'coherence_compare_sessions',
      params: {
        sessionId1: sessionIds[i],
        sessionId2: sessionIds[i + 1]
      }
    };
    
    const result = await sendWebSocketCommand(compareMsg);
    comparison.push(result);
    
    if (result.likelyUserMatch && result.overallMatch > 0.90) {
      console.log(`Sessions ${sessionIds[i]} and ${sessionIds[i+1]} likely same user`);
    } else {
      console.log(`Sessions appear to be different users - match: ${result.overallMatch}`);
    }
  }
  
  return comparison;
}
```

### Use Case 3: Export Session Evidence for Legal Proceedings

Generate forensic-grade session coherence report for court proceedings with chain of custody.

```javascript
async function exportSessionForLegal(sessionId, investigatorName) {
  const exportMsg = {
    command: 'coherence_export',
    params: { sessionId }
  };
  
  const result = await sendWebSocketCommand(exportMsg);
  
  // Create legal document
  const legalReport = {
    title: `Session Coherence Analysis Report - ${sessionId}`,
    date: new Date().toISOString(),
    investigator: investigatorName,
    sessionAnalysis: result.data.coherenceReport,
    
    findings: {
      coherent: result.data.coherenceReport.isCoherent,
      score: result.data.coherenceReport.overallScore,
      violations: result.data.violations,
      interactionCount: result.data.interactionCount,
      duration: result.data.duration
    },
    
    forensicHash: result.data.forensicHash,
    layerBreakdown: result.data.layerDetails,
    
    conclusion: `Session analysis complete. Overall coherence: ${
      (result.data.coherenceReport.overallScore * 100).toFixed(1)
    }%. ${result.data.coherenceReport.isCoherent ? 
      'Session shows coherent behavior.' : 
      'Session shows incoherent behavior - possible detection or compromise.'}`
  };
  
  return legalReport;
}
```

### Use Case 4: Detect and Recover from Coherence Violations

Automatically detect violations and apply recovery strategies.

```javascript
async function monitorAndRecover(sessionId) {
  const analyzeMsg = {
    command: 'coherence_analyze',
    params: { sessionId }
  };
  
  const result = await sendWebSocketCommand(analyzeMsg);
  
  if (!result.isCoherent) {
    console.warn(`Coherence violation detected: ${result.overallCoherence}`);
    
    // Apply recovery strategies
    for (const strategy of result.recoveryStrategies) {
      console.log(`Applying: ${strategy.suggestion}`);
      
      switch (strategy.command) {
        case 'restart_session':
          await restartSession(sessionId);
          break;
        case 'stabilize_ip':
          await stabilizeIP(sessionId);
          break;
        case 'fix_tls_fingerprint':
          await fixTLSFingerprint(sessionId);
          break;
        case 'fix_user_agent':
          await fixUserAgent(sessionId);
          break;
      }
    }
  }
}
```

## Troubleshooting

### "Session not found" Error

**Problem:** `{success: false, error: "Session not found: sess_123"}`

**Solution:** 
- Ensure session was initialized with `coherence_init_session` before recording interactions
- Session ID may have been cleaned up by `coherence_cleanup` if idle >1 hour
- Check session exists with `coherence_list_sessions`

### Low Coherence Scores (< 0.85)

**Problem:** Session coherence dropping below safe threshold

**Solutions:**
1. Check for IP changes - use VPN/proxy to stabilize
2. Verify User-Agent remains constant throughout session
3. Ensure TLS fingerprint is consistent (use same browser/TLS settings)
4. Add delays between interactions to appear more human-like
5. Verify device fingerprints match claimed specs (screen resolution, etc.)

### "sessionId1 and sessionId2 are required" Error

**Problem:** Session comparison fails with missing session

**Solution:**
- Verify both session IDs are valid using `coherence_list_sessions`
- Ensure both sessions have sufficient interactions (>5) for accurate comparison
- Sessions must be from same browser profile for meaningful comparison

### Coherence Violations After VPN/Proxy Change

**Problem:** Session shows violation when IP changes

**Explanation:** This is expected behavior. Layer 1 (network) validates IP consistency.

**Solution:**
- Initialize new session after IP change with new session ID
- Or document IP change in recovery strategies before it occurs

### Memory Growing with Many Sessions

**Problem:** Server memory increases when tracking many sessions

**Solution:**
- Call `coherence_cleanup` periodically to remove old sessions
- Default cleanup removes sessions idle >1 hour
- Adjust `maxAgeMs` parameter: `{maxAgeMs: 1800000}` for 30-minute cleanup
- Implement scheduled cleanup: `cleanup_interval = setInterval(() => sendCommand({command: 'coherence_cleanup'}), 600000)`

## Performance Tips

1. **Batch Interactions**: Record multiple interactions in rapid succession, then analyze periodically
   - Instead of analyzing after each interaction, batch 5-10 interactions, then call `coherence_analyze`
   - Reduces computational overhead by 60-70%

2. **Use Summary for Polling**: For frequent status checks, use `coherence_summary` instead of `coherence_analyze`
   - Summary is 10x faster (no layer recalculation)
   - Use summary every 1-2 seconds, detailed analysis every 30 seconds

3. **Session Cleanup Strategy**:
   - Schedule `coherence_cleanup` every 10 minutes for long-running servers
   - Set appropriate `maxAgeMs` based on typical session duration
   - Recommended: cleanup sessions older than session duration + 60 minutes

4. **Comparison Optimization**:
   - Don't compare every session pair in real-time
   - Store comparison results in cache
   - Re-compare only when new sessions created

5. **Monitor Layer Weights**:
   - Coherence uses weighted layer scores (see coherence-manager.js lines 470-485)
   - Device consistency (25%) and Temporal (20%) have highest impact
   - Focus evasion efforts on device fingerprint consistency first

6. **Network Request Timing**:
   - Latency: 1-5ms average for summary, 5-15ms for full analysis
   - Throughput: 100+ concurrent session tracking on single thread
   - Use gzip compression for large export payloads (70-90% reduction)

## Related Documentation

- [Session Coherence Validation - API Reference](../archive/deprecated/SESSION-COHERENCE-VALIDATION-API-REFERENCE.md)
- [Session Coherence Validation - Architecture](../technical/SESSION-COHERENCE-VALIDATION-ARCHITECTURE.md)
- [Session Coherence Validation - User Guide](../guides/SESSION-COHERENCE-VALIDATION-USER-GUIDE.md)
- [Evidence Packaging & Chain of Custody](../archives/prune-2026-07-06/integration/EVIDENCE-PACKAGING-INTEGRATION-GUIDE.md)
- [Behavioral Coherence Scoring](../archives/prune-2026-07-06/integration/BEHAVIORAL-COHERENCE-SCORING-INTEGRATION-GUIDE.md)
