# Session Coherence Validation - API Reference

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**API Endpoint:** `ws://localhost:8765`

## Overview

The Session Coherence Validation API provides 8 WebSocket commands for real-time 5-layer coherence validation. All commands follow the WebSocket format:

```json
{
  "command": "command_name",
  "params": { /* command-specific parameters */ }
}
```

Responses follow standard format:

```json
{
  "success": true|false,
  "data": { /* response data */ },
  "error": "error message if success=false"
}
```

## Complete Command Reference

### 1. coherence_init_session

Initialize a new session for real-time coherence tracking.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_init_session`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Unique session identifier |
| initialData | object | No | {} | Initial baseline data |
| initialData.os | string | No | null | Operating system (e.g., "Windows 10") |
| initialData.browser | string | No | null | Browser info (e.g., "Chrome 114") |
| initialData.userAgent | string | No | null | Full User-Agent string |
| initialData.country | string | No | null | ISO country code (e.g., "US") |
| initialData.ip | string | No | null | IP address |
| initialData.fingerprint | object | No | {} | Device fingerprints {canvas, webgl, audio} |
| initialData.behavior | object | No | {} | Behavior metrics {mouseVelocity, typingSpeed} |
| initialData.device | object | No | {} | Device specs {screenWidth, screenHeight} |
| initialData.network | object | No | {} | Network info {latency, bandwidth} |
| initialData.headers | object | No | {} | HTTP headers |

**Request Example:**

```json
{
  "command": "coherence_init_session",
  "params": {
    "sessionId": "sess_investigator_20260613_001",
    "initialData": {
      "os": "Windows 10",
      "browser": "Chrome 114",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "country": "US",
      "ip": "203.0.113.42",
      "fingerprint": {
        "canvas": "abc123def456789",
        "webgl": "vendor:NVIDIA,gpu:GeForce",
        "audioContext": "sampleRate:48000"
      },
      "behavior": {
        "mouseVelocity": 245,
        "typingSpeed": 62,
        "scrollAccel": 1.8
      },
      "device": {
        "screenWidth": 1920,
        "screenHeight": 1080,
        "colorDepth": 24,
        "devicePixelRatio": 1
      }
    }
  }
}
```

**Response on Success:**

```json
{
  "success": true,
  "sessionId": "sess_investigator_20260613_001",
  "initialized": true,
  "message": "Session coherence tracking initialized"
}
```

**Response on Error:**

```json
{
  "success": false,
  "error": "sessionId is required"
}
```

**Error Codes:**

| Error | Cause | Resolution |
|-------|-------|-----------|
| "sessionId is required" | Missing sessionId parameter | Provide non-empty sessionId |
| "Session {id} already initialized" | Session ID already in use | Use different sessionId |
| "Invalid initialData format" | initialData is malformed JSON | Check initialData structure |

**Latency:** 1-3ms

---

### 2. coherence_record_interaction

Record a browser interaction and perform real-time coherence validation.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_record_interaction`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Target session ID |
| interactionData | object | Yes | Interaction details |
| interactionData.type | string | Yes | Type: navigate, click, type, scroll, submit, dwell, hover |
| interactionData.url | string | No | URL for navigation events |
| interactionData.timestamp | number | Yes | Timestamp in milliseconds |
| interactionData.requestData | object | No | Network/device/behavior data |
| interactionData.requestData.network | object | No | IP, latency, bandwidth |
| interactionData.requestData.headers | object | No | HTTP headers |
| interactionData.requestData.tls | object | No | TLS info (ja3 fingerprint) |
| interactionData.requestData.device | object | No | Screen, plugins, hardware |
| interactionData.requestData.behavior | object | No | Mouse, typing, scroll metrics |

**Request Example:**

```json
{
  "command": "coherence_record_interaction",
  "params": {
    "sessionId": "sess_investigator_20260613_001",
    "interactionData": {
      "type": "navigate",
      "url": "https://example.com/page",
      "timestamp": 1686786225000,
      "requestData": {
        "network": {
          "ip": "203.0.113.42",
          "latency": 45,
          "bandwidth": 10000
        },
        "headers": {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Sec-Ch-Ua": "\"Chromium\";v=\"114\""
        },
        "tls": {
          "ja3": "771,4865-4866-4867,10-11-35-16-5-51-45-43-27-21,23-65281,0"
        },
        "device": {
          "screenWidth": 1920,
          "screenHeight": 1080,
          "colorDepth": 24,
          "plugins": ["Chrome PDF Plugin"]
        },
        "behavior": {
          "mouseVelocity": 242,
          "mouseAccel": 1.9,
          "typingSpeed": 63,
          "pauseDuration": 120
        },
        "cookies": ["sessionid=abc123", "tracking=def456"],
        "localStorage": ["prefs={...}", "history=[...]"]
      }
    }
  }
}
```

**Response on Success:**

```json
{
  "success": true,
  "interactionId": "interaction_0_1686786225123",
  "coherenceResult": {
    "timestamp": "2026-06-13T14:23:45Z",
    "overallScore": 0.94,
    "layers": {
      "layer1": {
        "name": "IP/Network",
        "score": 0.98,
        "status": "COHERENT",
        "details": "IP consistent, latency within variance"
      },
      "layer2": {
        "name": "TLS/HTTP",
        "score": 0.92,
        "status": "COHERENT",
        "details": "JA3 fingerprint consistent"
      },
      "layer3": {
        "name": "Device",
        "score": 0.96,
        "status": "COHERENT",
        "details": "Screen resolution consistent, plugins match"
      },
      "layer4": {
        "name": "Behavioral",
        "score": 0.89,
        "status": "COHERENT",
        "details": "Mouse/typing patterns within baseline"
      },
      "layer5": {
        "name": "Timeline",
        "score": 0.95,
        "status": "COHERENT",
        "details": "Event sequence valid, no time travel"
      }
    },
    "violations": [],
    "recommendations": []
  }
}
```

**Response on Violation:**

```json
{
  "success": true,
  "interactionId": "interaction_5_1686786235000",
  "coherenceResult": {
    "timestamp": "2026-06-13T14:24:00Z",
    "overallScore": 0.71,
    "layers": {
      "layer1": {
        "score": 0.65,
        "status": "VIOLATION",
        "details": "IP changed from 203.0.113.42 to 198.51.100.99"
      }
    },
    "violations": [
      {
        "layer": 1,
        "component": "ip_consistency",
        "severity": "high",
        "description": "IP address changed unexpectedly",
        "previousValue": "203.0.113.42",
        "currentValue": "198.51.100.99"
      }
    ],
    "recommendations": [
      {
        "severity": "WARNING",
        "suggestion": "Stabilize IP address - avoid rapid IP changes",
        "command": "stabilize_ip"
      }
    ]
  }
}
```

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing sessionId |
| "Session not found" | Session not initialized |
| "interactionData is required" | Missing interaction details |
| "type is required in interactionData" | Missing interaction type |

**Latency:** 5-15ms (varies with requestData complexity)

---

### 3. coherence_analyze

Get comprehensive 5-layer coherence analysis for entire session.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_analyze`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Target session ID |

**Request Example:**

```json
{
  "command": "coherence_analyze",
  "params": {
    "sessionId": "sess_investigator_20260613_001"
  }
}
```

**Response on Success:**

```json
{
  "success": true,
  "sessionId": "sess_investigator_20260613_001",
  "overallCoherence": 0.942,
  "isCoherent": true,
  "timestamp": "2026-06-13T14:30:45Z",
  "layers": {
    "temporal": {
      "score": 0.961,
      "status": "COHERENT",
      "fingerprintDrift": 0.01,
      "violations": [],
      "evidence": {
        "initialFingerprint": {
          "canvas": "abc123def456789",
          "webgl": "vendor:NVIDIA"
        },
        "driftAnalysis": "Fingerprint drift 1.0% (threshold 2.0%)"
      }
    },
    "behavioral": {
      "score": 0.89,
      "status": "COHERENT",
      "patternConsistency": 0.89,
      "violations": [],
      "evidence": {
        "mousePattern": "45 interactions tracked, velocity stable",
        "typingPattern": "IKT 120±25ms, within human range",
        "scrollPattern": "Consistent acceleration profile"
      }
    },
    "network": {
      "score": 0.92,
      "status": "COHERENT",
      "requestPatternMatch": 0.92,
      "violations": [],
      "evidence": {
        "requestTiming": "25±8ms variance, consistent",
        "headerConsistency": "All headers stable",
        "bandwidthMatch": "10 Mbps consistent with claimed device"
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
        "screenConsistency": "1920x1080 constant",
        "pluginConsistency": "3 plugins consistent across 45 interactions"
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
        "noTimeTravel": true,
        "maxGap": "3600ms (user reading content)"
      }
    }
  },
  "history": [
    {
      "timestamp": "2026-06-13T14:23:45Z",
      "coherenceScore": 0.94,
      "layerScores": {
        "temporal": 0.96,
        "behavioral": 0.88,
        "network": 0.91,
        "device": 0.96,
        "timeline": 0.94
      }
    }
  ],
  "totalInteractions": 45,
  "sessionDuration": 234567,
  "recoveryStrategies": []
}
```

**Response with Violations:**

```json
{
  "success": true,
  "sessionId": "sess_compromised_20260613_002",
  "overallCoherence": 0.68,
  "isCoherent": false,
  "timestamp": "2026-06-13T14:35:00Z",
  "layers": {
    "temporal": {
      "score": 0.45,
      "status": "VIOLATION",
      "fingerprintDrift": 0.15,
      "violations": [
        {
          "component": "canvas_fingerprint",
          "severity": "critical",
          "drift": 0.15,
          "previousValue": "abc123",
          "currentValue": "xyz789"
        }
      ]
    }
  },
  "recoveryStrategies": [
    {
      "violation": "Canvas fingerprint drift 15% (threshold 2%)",
      "severity": "CRITICAL",
      "suggestion": "Restart session immediately - canvas spoofing detected",
      "command": "restart_session"
    },
    {
      "violation": "5 high-severity violations detected",
      "severity": "WARNING",
      "suggestion": "Apply evasion recovery measures",
      "command": "apply_evasion_recovery"
    }
  ]
}
```

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing sessionId |
| "Session not found" | Session ID invalid/cleaned up |

**Latency:** 5-20ms depending on interaction count

**Notes:**
- Layer scores are calculated from weighted layer history
- Thresholds: temporal=0.92, behavioral=0.90, network=0.88, device=0.95, timeline=0.91
- Overall score uses weights: temporal(20%), behavioral(20%), network(15%), device(25%), timeline(20%)

---

### 4. coherence_compare_sessions

Compare two sessions for similarity and user matching.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_compare_sessions`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId1 | string | Yes | First session ID |
| sessionId2 | string | Yes | Second session ID |

**Request Example:**

```json
{
  "command": "coherence_compare_sessions",
  "params": {
    "sessionId1": "sess_user_20260613_001",
    "sessionId2": "sess_user_20260613_002"
  }
}
```

**Response - Likely Same User:**

```json
{
  "success": true,
  "session1Id": "sess_user_20260613_001",
  "session2Id": "sess_user_20260613_002",
  "deviceMatch": 0.98,
  "behaviorMatch": 0.85,
  "networkMatch": 0.92,
  "overallMatch": 0.92,
  "likelyUserMatch": true,
  "differenceFactors": [
    "Device fingerprint differs: 98.0% match (acceptable)",
    "Behavioral patterns differ (acceptable for time-shifted sessions)"
  ],
  "timestamp": "2026-06-13T14:45:00Z"
}
```

**Response - Different Users:**

```json
{
  "success": true,
  "session1Id": "sess_attacker_20260613_001",
  "session2Id": "sess_attacker_20260613_002",
  "deviceMatch": 0.42,
  "behaviorMatch": 0.31,
  "networkMatch": 0.15,
  "overallMatch": 0.31,
  "likelyUserMatch": false,
  "differenceFactors": [
    "Device fingerprint differs significantly (42% match)",
    "IP addresses differ (different geographic locations)",
    "Behavioral patterns differ significantly (31% match - different typing speed, mouse patterns)"
  ],
  "timestamp": "2026-06-13T14:45:30Z"
}
```

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId1 and sessionId2 are required" | Missing either session ID |
| "One or both sessions not found" | Session IDs invalid |

**Latency:** 2-10ms

**Notes:**
- Device match: Compares fingerprints (screen, plugins, headers)
- Behavior match: Compares typing speed, mouse velocity, scroll patterns
- Network match: Compares request frequency and patterns
- Overall match: Weighted average (device 35%, behavior 35%, network 30%)
- likelyUserMatch = true if overallMatch >= 0.75

---

### 5. coherence_export

Export session coherence data for forensic analysis and legal proceedings.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_export`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Target session ID |

**Request Example:**

```json
{
  "command": "coherence_export",
  "params": {
    "sessionId": "sess_investigator_20260613_001"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_investigator_20260613_001",
    "createdAt": "2026-06-13T14:00:00Z",
    "duration": 234567,
    "coherenceReport": {
      "overallScore": 0.942,
      "isCoherent": true,
      "timestamp": "2026-06-13T14:30:45Z",
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
    "layerDetails": {
      "temporal": {
        "history": [
          {
            "timestamp": "2026-06-13T14:23:45Z",
            "coherenceScore": 0.94,
            "layerScores": {
              "temporal": 0.96,
              "behavioral": 0.88,
              "network": 0.91,
              "device": 0.96,
              "timeline": 0.94
            }
          }
        ],
        "fingerprintDrift": 0.01
      },
      "behavioral": {
        "patterns": 45,
        "interactionTypes": {
          "navigate": 8,
          "click": 22,
          "type": 10,
          "scroll": 5
        }
      },
      "network": {
        "requests": 45,
        "uniqueIPs": 1
      },
      "device": {
        "changes": 0,
        "metadata": {
          "os": "Windows 10",
          "browser": "Chrome 114",
          "userAgent": "Mozilla/5.0..."
        }
      },
      "timeline": {
        "events": 45,
        "gaps": 0,
        "timeTravel": false
      }
    },
    "recommendations": [],
    "forensicHash": "sha256:abc123def456789ghi111jkl222mno333pqr444"
  }
}
```

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing sessionId |
| "Session not found" | Session ID invalid |

**Latency:** 10-30ms

**Notes:**
- forensicHash is SHA-256 of session data
- Used for legal proceedings - maintains integrity
- Export payload can be 50-500KB; recommend gzip compression

---

### 6. coherence_summary

Get quick coherence status without detailed analysis.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_summary`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Target session ID |

**Request Example:**

```json
{
  "command": "coherence_summary",
  "params": {
    "sessionId": "sess_investigator_20260613_001"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_investigator_20260613_001",
    "overallCoherence": 0.942,
    "isCoherent": true,
    "timestamp": "2026-06-13T14:30:45Z",
    "violationCount": 0,
    "interactionCount": 45,
    "criticalViolations": 0,
    "highViolations": 0,
    "warnings": []
  }
}
```

**Response with Warnings:**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_compromised_20260613_002",
    "overallCoherence": 0.68,
    "isCoherent": false,
    "timestamp": "2026-06-13T14:35:00Z",
    "violationCount": 3,
    "interactionCount": 23,
    "criticalViolations": 1,
    "highViolations": 2,
    "warnings": [
      "Canvas fingerprint drift 15% (threshold 2%)",
      "IP consistency violation",
      "Behavioral deviation 35% (threshold 10%)"
    ]
  }
}
```

**Latency:** 1-3ms (fastest command)

**Notes:**
- Use for frequent polling (every 1-2 seconds)
- Use coherence_analyze for detailed breakdown (every 30 seconds)

---

### 7. coherence_list_sessions

List all active coherence-tracked sessions.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_list_sessions`

**Parameters:** (none)

**Request Example:**

```json
{
  "command": "coherence_list_sessions",
  "params": {}
}
```

**Response:**

```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_user_20260613_001",
      "createdAt": "2026-06-13T14:00:00Z",
      "interactionCount": 45,
      "overallCoherence": 0.942,
      "isCoherent": true,
      "lastInteractionTime": "2026-06-13T14:23:45Z"
    },
    {
      "sessionId": "sess_user_20260613_002",
      "createdAt": "2026-06-13T14:10:00Z",
      "interactionCount": 23,
      "overallCoherence": 0.871,
      "isCoherent": true,
      "lastInteractionTime": "2026-06-13T14:22:30Z"
    },
    {
      "sessionId": "sess_compromised_20260613_003",
      "createdAt": "2026-06-13T14:15:00Z",
      "interactionCount": 12,
      "overallCoherence": 0.42,
      "isCoherent": false,
      "lastInteractionTime": "2026-06-13T14:18:45Z"
    }
  ],
  "totalSessions": 3
}
```

**Latency:** 1-5ms

**Notes:**
- Returns summary for all sessions
- Useful for monitoring dashboard
- Sessions removed after cleanup (default: 1 hour idle)

---

### 8. coherence_cleanup

Clean up old sessions to manage memory.

**Endpoint:** `ws://localhost:8765`

**Command Name:** `coherence_cleanup`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| maxAgeMs | number | No | 3600000 | Max age in milliseconds |

**Request Example:**

```json
{
  "command": "coherence_cleanup",
  "params": {
    "maxAgeMs": 1800000
  }
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

**Latency:** 1-10ms

**Notes:**
- Default: removes sessions idle >1 hour
- 30-minute cleanup: `maxAgeMs: 1800000`
- Call periodically in long-running servers
- Recommended interval: every 10 minutes

---

## Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": {
    /* command-specific data */
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Error Handling

All commands return `success: true/false`. On error, always check:

```json
{
  "success": false,
  "error": "error message"
}
```

Example error handling:

```javascript
const response = await sendWebSocketCommand(msg);

if (!response.success) {
  console.error(`Command failed: ${response.error}`);
  
  if (response.error.includes('not found')) {
    // Session doesn't exist - initialize it
    await initializeSession(sessionId);
  } else if (response.error.includes('required')) {
    // Missing parameter - check request format
    console.error('Check parameter names and types');
  }
}
```

## Performance Expectations

| Command | Latency | Use Case |
|---------|---------|----------|
| coherence_summary | 1-3ms | Frequent polling |
| coherence_list_sessions | 1-5ms | Dashboard updates |
| coherence_cleanup | 1-10ms | Scheduled maintenance |
| coherence_init_session | 1-3ms | Session setup |
| coherence_record_interaction | 5-15ms | Real-time tracking |
| coherence_analyze | 5-20ms | Detailed analysis |
| coherence_compare_sessions | 2-10ms | User comparison |
| coherence_export | 10-30ms | Forensic export |

**Notes:**
- Latencies are per-command, not round-trip
- Add ~20-50ms for WebSocket round-trip overhead
- Batch commands for 30-40% throughput improvement
- Gzip compression reduces payload size by 70-90%

## Event Types

The server may emit events via WebSocket:

```json
{
  "event": "coherence_violation",
  "data": {
    "sessionId": "sess_123",
    "layer": 1,
    "component": "ip_consistency",
    "severity": "high",
    "timestamp": "2026-06-13T14:30:00Z"
  }
}
```

Supported events:
- `coherence_violation` - Coherence violation detected
- `coherence_recovery_applied` - Recovery strategy activated
- `session_cleaned` - Session removed by cleanup

---

## Related Documentation

- [Session Coherence Validation - Integration Guide](../integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md)
- [Session Coherence Validation - Architecture](../technical/SESSION-COHERENCE-VALIDATION-ARCHITECTURE.md)
- [Session Coherence Validation - User Guide](../guides/SESSION-COHERENCE-VALIDATION-USER-GUIDE.md)
