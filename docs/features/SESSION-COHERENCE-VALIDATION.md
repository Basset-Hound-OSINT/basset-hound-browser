# Session Coherence Validation - Feature Guide

**Version:** 1.0.0  
**Released:** June 13, 2026  
**Status:** ✅ Production Ready  
**Test Coverage:** 145 tests (100% passing)  
**Performance:** <5ms per coherence check  

---

## Overview

Session Coherence Validation is a 5-layer real-time detection system that validates consistency across browser sessions and HTTP requests. It detects suspicious behavioral patterns and inconsistencies that indicate bot detection evasion failures or session anomalies.

### Key Capabilities

- **5-Layer Validation Framework** - IP/Network, TLS/HTTP, Device, Behavioral, Session Identity
- **Real-Time Analysis** - <5ms checks with minimal overhead
- **Anomaly Detection** - Identifies suspicious patterns before they trigger detection services
- **Session Comparison** - Compare two sessions for similarity and consistency
- **Export & Reporting** - Generate detailed coherence analysis reports

---

## Quick Start

### Initialize Coherence Tracking

```javascript
const ws = new WebSocket('ws://localhost:8765');

// Initialize session for coherence tracking
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'coherence_init_session',
  params: {
    sessionId: 'sess_001',
    initialData: {
      os: 'macOS',
      browser: 'Chrome 114',
      userAgent: 'Mozilla/5.0...',
      country: 'US',
      ip: '1.2.3.4',
      fingerprint: {
        canvas: 'hash_abc123...',
        webgl: 'hash_def456...',
        audio: 'hash_ghi789...'
      },
      behavior: {
        mouseSpeed: 250,
        typingSpeed: 65
      }
    }
  }
}));

// Response
{
  "success": true,
  "sessionId": "sess_001",
  "initialized": true,
  "message": "Session coherence tracking initialized"
}
```

### Record Interactions

```javascript
ws.send(JSON.stringify({
  id: 'req-2',
  command: 'coherence_record_interaction',
  params: {
    sessionId: 'sess_001',
    interactionData: {
      type: 'navigate',
      url: 'https://example.com',
      timestamp: 1686786225000,
      requestData: {
        network: {
          ip: '1.2.3.4',
          asn: 'AS12345',
          country: 'US'
        },
        headers: {
          'user-agent': 'Mozilla/5.0...',
          'accept-language': 'en-US,en;q=0.9'
        },
        tls: {
          ja3: 'hash_tls...',
          cipher: 'TLS_AES_128_GCM_SHA256'
        },
        device: {
          canvas: 'hash_abc123...',
          webgl: 'hash_def456...'
        },
        behavior: {
          mouseSpeed: 245,
          typingSpeed: 64
        }
      }
    }
  }
}));

// Response
{
  "success": true,
  "interactionId": "interaction_0_1686786225123",
  "coherenceResult": {
    "timestamp": "2026-06-13T14:23:45Z",
    "overallScore": 0.94,
    "layers": {
      "ipNetwork": {
        "score": 1.0,
        "status": "PASS",
        "messages": ["IP consistent", "Geolocation valid"]
      },
      "tlsHttp": {
        "score": 0.95,
        "status": "PASS",
        "messages": ["JA3 fingerprint matches"]
      },
      "device": {
        "score": 0.92,
        "status": "PASS",
        "messages": ["Canvas fingerprint 98% match"]
      },
      "behavioral": {
        "score": 0.90,
        "status": "PASS",
        "messages": ["Mouse speed within 5% variance"]
      },
      "sessionIdentity": {
        "score": 0.95,
        "status": "PASS",
        "messages": ["Cookies persistent"]
      }
    },
    "violations": []
  }
}
```

### Get Comprehensive Analysis

```javascript
ws.send(JSON.stringify({
  id: 'req-3',
  command: 'coherence_analyze',
  params: {
    sessionId: 'sess_001'
  }
}));

// Response
{
  "success": true,
  "analysis": {
    "sessionId": "sess_001",
    "overallCoherence": 0.94,
    "layerScores": {
      "ipNetwork": 1.0,
      "tlsHttp": 0.95,
      "device": 0.92,
      "behavioral": 0.90,
      "sessionIdentity": 0.95
    },
    "inconsistencies": [],
    "recommendations": [
      "Behavioral score slightly low - consider increasing mouse movement smoothness"
    ],
    "interactionCount": 5,
    "averageCheckTime": 3.2,
    "lastUpdated": "2026-06-13T14:23:45Z"
  }
}
```

---

## 5-Layer Validation Architecture

### Layer 1: IP/Network Consistency (IPNetworkValidator)

Validates IP address and geolocation consistency across requests.

**Checks:**
- IP address changes (same IP = high score, reasonable travel = pass, impossible = fail)
- Geolocation travel speed (max 900 km/h realistic travel)
- ASN/ISP consistency
- Haversine distance calculation

**Thresholds:**
- Same IP: Score 1.0
- Reasonable travel (within speed limit): Score 0.9
- Impossible travel (<30 seconds): Score 0.0

**Example:**
```javascript
// NYC to London in 3 hours = realistic travel
// Score: 0.9 (PASS)

// NYC to London in 10 seconds = impossible travel
// Score: 0.0 (FAIL)
```

### Layer 2: TLS/HTTP Fingerprint Validator (TLSHttpValidator)

Validates consistency of TLS handshake and HTTP header signatures.

**Checks:**
- JA3 fingerprint stability (TLS handshake signature)
- Cipher suite consistency
- TLS version matching
- HTTP header ordering and values

**Thresholds:**
- JA3 exact match: Score 1.0
- JA3 within 1-2 difference: Score 0.95
- Major JA3 differences: Score 0.0

**Example:**
```javascript
// Session 1 JA3: "771,49195,51,52,53,..."
// Session 2 JA3: "771,49195,51,52,53,..." (same)
// Score: 1.0 (PASS)
```

### Layer 3: Device Fingerprint Validator (DeviceFingerprintValidator)

Validates consistency of device fingerprinting across requests.

**Checks:**
- Canvas fingerprint stability (98% threshold)
- WebGL fingerprint consistency
- Audio fingerprint matching
- Component-level similarity scoring

**Thresholds:**
- 98%+ similarity: Score 1.0
- 90-98% similarity: Score 0.9
- <90% similarity: Score 0.0

**Example:**
```javascript
// Canvas hash consistency: 99.2%
// WebGL consistency: 97.8%
// Combined score: 0.97 (PASS)
```

### Layer 4: Behavioral Pattern Validator (BehavioralPatternValidator)

Validates consistency of user behavioral patterns.

**Checks:**
- Mouse speed deviation (40% threshold)
- Typing speed consistency (35% threshold)
- Pause timing validation
- Statistical deviation calculation

**Thresholds:**
- Within 5% deviation: Score 1.0
- Within 20% deviation: Score 0.9
- >40% deviation: Score 0.0

**Example:**
```javascript
// Baseline mouse speed: 250px/s
// Current mouse speed: 255px/s (2% variance)
// Score: 1.0 (PASS)

// Baseline typing speed: 65 WPM
// Current typing speed: 92 WPM (41% faster)
// Score: 0.0 (FAIL) - exceeds 40% threshold
```

### Layer 5: Session Identity Validator (SessionIdentityValidator)

Validates persistence of session identifiers and storage data.

**Checks:**
- Cookie persistence monitoring
- localStorage value tracking
- Cache behavior validation
- Important cookie identification

**Thresholds:**
- All cookies persistent: Score 1.0
- Minor inconsistencies: Score 0.95
- Major cookie loss: Score 0.0

**Example:**
```javascript
// Session cookies: present
// Important cookies (session_id, auth_token): present
// Cache consistency: valid
// Score: 0.95 (PASS - minor cache inconsistency)
```

---

## WebSocket Commands Reference

### coherence_init_session

Initialize a new session for real-time coherence tracking.

**Parameters:**
- `sessionId` (required): Unique session identifier
- `initialData` (required): Initial device/behavior profile
  - `os`: Operating system
  - `browser`: Browser name and version
  - `userAgent`: Full user agent string
  - `country`: Country code
  - `ip`: IP address
  - `fingerprint`: Device fingerprint object
  - `behavior`: Behavioral characteristics
  - `device`: Device identifiers
  - `network`: Network properties
  - `headers`: HTTP headers

**Response:**
```javascript
{
  "success": true,
  "sessionId": "sess_123",
  "initialized": true,
  "message": "Session coherence tracking initialized"
}
```

### coherence_record_interaction

Record and validate a browser interaction for coherence.

**Parameters:**
- `sessionId` (required): Session to record to
- `interactionData` (required): Interaction details
  - `type`: Interaction type (navigate, click, submit, etc.)
  - `url`: Target URL
  - `timestamp`: Interaction timestamp
  - `requestData`: Network/device/behavior data from request

**Response:**
```javascript
{
  "success": true,
  "interactionId": "interaction_0_1686786225123",
  "coherenceResult": {
    "timestamp": "2026-06-13T14:23:45Z",
    "overallScore": 0.94,
    "layers": { /* 5-layer scores */ },
    "violations": []
  }
}
```

### coherence_analyze

Get comprehensive coherence analysis for a session.

**Parameters:**
- `sessionId` (required): Session to analyze

**Response:**
```javascript
{
  "success": true,
  "analysis": {
    "sessionId": "sess_123",
    "overallCoherence": 0.94,
    "layerScores": { /* per-layer scores */ },
    "inconsistencies": [],
    "recommendations": [],
    "interactionCount": 5,
    "averageCheckTime": 3.2
  }
}
```

### coherence_compare_sessions

Compare two sessions for similarity and consistency.

**Parameters:**
- `sessionId1` (required): First session ID
- `sessionId2` (required): Second session ID

**Response:**
```javascript
{
  "success": true,
  "comparison": {
    "sessionId1": "sess_001",
    "sessionId2": "sess_002",
    "similarity": 0.87,
    "layerComparisons": {
      "ipNetwork": { "similar": true, "score": 1.0 },
      "tlsHttp": { "similar": true, "score": 0.95 },
      "device": { "similar": true, "score": 0.92 },
      "behavioral": { "similar": false, "score": 0.70 },
      "sessionIdentity": { "similar": true, "score": 0.95 }
    },
    "differences": [
      "Behavioral patterns differ (70% similarity)"
    ]
  }
}
```

### coherence_export

Export session coherence data in specified format.

**Parameters:**
- `sessionId` (required): Session to export
- `format` (optional): Export format (json, csv, xml, html)

**Response:**
```javascript
{
  "success": true,
  "format": "json",
  "data": { /* coherence data */ },
  "exportTime": 45
}
```

### coherence_summary

Get quick status summary for a session.

**Parameters:**
- `sessionId` (required): Session ID

**Response:**
```javascript
{
  "success": true,
  "summary": {
    "sessionId": "sess_001",
    "status": "COHERENT",
    "overallScore": 0.94,
    "interactionCount": 5,
    "violations": 0,
    "lastChecked": "2026-06-13T14:23:45Z"
  }
}
```

### coherence_list_sessions

List all tracked sessions with summary status.

**Parameters:** None

**Response:**
```javascript
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_001",
      "status": "COHERENT",
      "overallScore": 0.94,
      "interactionCount": 5
    }
  ],
  "totalSessions": 1
}
```

---

## Best Practices

### 1. Initialize Early

```javascript
// Initialize session BEFORE recording interactions
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'coherence_init_session',
  params: {
    sessionId: 'sess_001',
    initialData: captureInitialDeviceProfile()
  }
}));
```

### 2. Record Consistently

```javascript
// Record all significant interactions for accurate analysis
ws.send(JSON.stringify({
  id: 'req-2',
  command: 'coherence_record_interaction',
  params: {
    sessionId: 'sess_001',
    interactionData: {
      type: 'navigate',
      url: 'https://example.com',
      timestamp: Date.now(),
      requestData: captureRequestData()
    }
  }
}));
```

### 3. Monitor Scores

```javascript
// Regular monitoring detects issues early
setInterval(async () => {
  const summary = await ws.send({
    id: `req-${Date.now()}`,
    command: 'coherence_summary',
    params: { sessionId: 'sess_001' }
  });
  
  if (summary.summary.status !== 'COHERENT') {
    console.warn('Session coherence issue detected:', summary);
  }
}, 5000);
```

### 4. Handle Violations

```javascript
// Detect and respond to violations
if (coherenceResult.violations.length > 0) {
  console.warn('Coherence violations detected:');
  coherenceResult.violations.forEach(v => {
    console.warn(`- ${v.layer}: ${v.message}`);
  });
  
  // Consider: wait, adjust fingerprint, or abort
}
```

### 5. Use Recommendations

```javascript
// Implement suggested improvements
const analysis = await ws.send({
  id: 'req-3',
  command: 'coherence_analyze',
  params: { sessionId: 'sess_001' }
});

analysis.analysis.recommendations.forEach(rec => {
  console.log('Recommendation:', rec);
  // Implement fixes based on recommendations
});
```

---

## Common Issues & Troubleshooting

### Issue: Low Behavioral Score

**Symptom:** Behavioral layer score <0.8

**Causes:**
- Mouse speed variance >40%
- Typing speed inconsistency
- Unrealistic pause timings

**Solution:**
```javascript
// Adjust behavioral profile
const profile = new BehavioralProfile({
  speedMultiplier: 0.9,
  accuracyLevel: 0.95,
  fatigueRate: 0.00015
});

// Record adjustments in next interactions
```

### Issue: Impossible Travel Detected

**Symptom:** IP layer score 0.0

**Causes:**
- IP changed from NYC to London in <30 seconds
- ASN/ISP inconsistency

**Solution:**
```javascript
// Wait before continuing in new location
await new Promise(r => setTimeout(r, 3600000)); // Wait 1 hour

// Or use appropriate proxy/VPN
```

### Issue: Canvas Fingerprint Mismatch

**Symptom:** Device layer score <0.9

**Causes:**
- Canvas fingerprint not properly spoofed
- Browser configuration changed
- Rendering engine inconsistency

**Solution:**
```javascript
// Regenerate stable fingerprint
const fingerprint = new FingerprintProfile({
  seed: 'stable-seed-123',
  consistency: 'high'
});

// Re-initialize session with new fingerprint
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Check time (5 layers) | <5ms |
| Memory per session | ~2-5 KB |
| Storage overhead | Minimal (history caching) |
| CPU impact | <1% per session |
| Maximum sessions | 1,000+ (tested) |

---

## Limitations

1. **Relative Check** - Validates consistency within session, not absolute authenticity
2. **Behavioral Profile** - Requires initial capture of realistic behavior
3. **Travel Speed** - Based on reasonable travel assumptions (may fail for air travel)
4. **Fingerprint Updates** - Cannot detect legitimate browser updates
5. **VPN/Proxy** - Cannot distinguish between user and automated proxy rotation

---

## Integration Examples

### Python Client

```python
import websocket
import json
import time

ws = websocket.WebSocket()
ws.connect("ws://localhost:8765")

# Initialize session
ws.send(json.dumps({
    "id": "req-1",
    "command": "coherence_init_session",
    "params": {
        "sessionId": "sess_001",
        "initialData": {...}
    }
}))

response = json.loads(ws.recv())
print("Session initialized:", response)

# Record interaction
ws.send(json.dumps({
    "id": "req-2",
    "command": "coherence_record_interaction",
    "params": {
        "sessionId": "sess_001",
        "interactionData": {...}
    }
}))

response = json.loads(ws.recv())
print("Coherence result:", response)
```

### Node.js Client

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', async () => {
  // Initialize
  ws.send(JSON.stringify({
    id: 'req-1',
    command: 'coherence_init_session',
    params: {
      sessionId: 'sess_001',
      initialData: {...}
    }
  }));
});

ws.on('message', (message) => {
  const response = JSON.parse(message);
  console.log('Response:', response);
});
```

---

## See Also

- [Session Coherence Implementation](../SESSION-COHERENCE-IMPLEMENTATION.md)
- [Behavioral Coherence Scoring](BEHAVIORAL-COHERENCE-SCORING.md)
- [Evasion Framework](evasion.md)
- [Bot Evasion Techniques](../guides/ADVANCED-EVASION-IMPLEMENTATION-GUIDE.md)
