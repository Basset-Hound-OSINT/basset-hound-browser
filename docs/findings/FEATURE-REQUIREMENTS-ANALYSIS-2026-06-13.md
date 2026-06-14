# Basset Hound Browser - Feature Requirements Analysis
**Date:** June 13, 2026  
**Version:** 1.0  
**Status:** Complete Specifications for Top 6 Recommended Features

---

## Executive Summary

This document provides detailed technical specifications for the top 6 recommended features that should be prioritized for Basset Hound Browser. These features address core gaps in existing OSINT and forensic capabilities, building on the solid foundation of v12.0.0 (Production Live).

**Key Finding:** Four of the six features have **significant partial implementations** that require completion and integration. This reduces implementation risk and accelerates time-to-market.

### Feature Status Overview

| Feature | Implementation Status | Priority | Dev Time |
|---------|----------------------|----------|----------|
| 1. Multi-Layer Technology Fingerprinting | **40% Complete** | HIGH | 80-100h |
| 2. Forensic Evidence Packaging | **35% Complete** | HIGH | 120-150h |
| 3. Session Coherence Validation | **50% Complete** | CRITICAL | 60-80h |
| 4. Real-Time Behavioral Coherence Scoring | **20% Complete** | MEDIUM | 100-130h |
| 5. Multi-Session Change Detection | **25% Complete** | MEDIUM | 90-120h |
| 6. Investigation Report Generation | **30% Complete** | MEDIUM | 100-130h |

---

## Feature 1: Multi-Layer Technology Fingerprinting (Wappalyzer Clone)

### Feature Specification

**Problem Solved:**  
Current technology detection is surface-level. Researchers need comprehensive identification of technologies, frameworks, CMS, servers, CDN providers, analytics platforms, and security tools running on target websites—comparable to Wappalyzer but integrated directly into the browser API for real-time forensic use.

**Core Functionality:**  
Implement 8+ detection layers (HTTP headers, JavaScript libraries, favicon hashing, SSL certificates, DOM patterns, Canvas fingerprinting, DNS records, JavaScript execution payloads) to identify 500+ technology signatures with confidence scoring. Return raw detection evidence alongside technology identification for forensic validation.

**Success Criteria:**
- Detect 95%+ of major frameworks, CMS, servers, CDN (validated against public OSINT targets)
- <100ms detection time per page load
- Confidence scores with supporting evidence
- <3% false positive rate on production sites
- Works across 50+ categories (frameworks, CMS, servers, CDN, analytics, etc.)

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "detect_technologies",
  "params": {
    "tabId": "tab_123",
    "includeRawEvidence": true,
    "confidenceThreshold": 0.70,
    "categories": ["frameworks", "cms", "servers", "cdn"]
  },
  "response": {
    "success": true,
    "data": {
      "detectionTime": 45,
      "technologies": [
        {
          "id": "wordpress",
          "category": "cms",
          "name": "WordPress",
          "version": "6.4.1",
          "confidence": 0.98,
          "detectionMethods": ["wp-content header", "wp-version comment", "theme detection"],
          "evidence": {
            "headers": {"X-Powered-By": "WordPress"},
            "patterns": ["/wp-includes/", "/wp-content/"],
            "html_patterns": ["wp-emoji-release.min.js"]
          }
        }
      ],
      "summary": {
        "totalDetected": 23,
        "highConfidence": 19,
        "mediumConfidence": 4,
        "categories": {"frameworks": 8, "cms": 1, "servers": 2, "cdn": 3, "analytics": 9}
      }
    }
  }
}
```

```json
{
  "command": "detect_technologies_from_html",
  "params": {
    "html": "<html>...",
    "headers": {...},
    "scripts": [...],
    "url": "https://example.com"
  },
  "response": {
    "success": true,
    "data": {
      "technologies": [...],
      "detectionTime": 12,
      "source": "static_analysis"
    }
  }
}
```

```json
{
  "command": "get_technology_signatures",
  "params": {
    "category": "frameworks",
    "count": 100
  },
  "response": {
    "success": true,
    "data": {
      "total_signatures": 1200,
      "returned": 100,
      "signatures": [...]
    }
  }
}
```

**Modified Commands:**
- `get_page_state` - Add `detectedTechnologies` field with quick tech summary
- `screenshot` - Add `metadata.detectedTechnologies` to forensic capture

**Data Structures:**
```javascript
// Technology signature object
{
  id: string,                    // tech-id
  name: string,                  // Human readable name
  category: string,              // frameworks, cms, servers, cdn, analytics, etc.
  website: string,               // Official website
  icon: string,                  // Icon URL
  icon_hash: string,             // Favicon SHA-256 hash
  headers: {[key]: value},      // HTTP header patterns
  js: [string],                  // JavaScript library signatures
  scripts: [string],             // Script URL patterns
  html: [string],                // HTML patterns
  dom: [string],                 // DOM element patterns
  css: [string],                 // CSS file/pattern detections
  meta: {[key]: value},         // Meta tag patterns
  implies: [string],             // Technologies this implies (Django implies Python)
  version_patterns: {[key]: string}, // Regex patterns for version extraction
  confidence_weights: {          // Weight for each detection method
    headers: 0.9,
    js: 0.8,
    favicon: 0.85,
    dom: 0.6
  }
}
```

### Integration Points

**Existing Systems:**
- `src/analysis/tech-detector.js` (538 lines) - Core detection engine, 40% complete
- `src/analysis/technology-patterns.js` (879 lines) - Signature database, needs expansion
- `src/analysis/signature-loader.js` (245 lines) - Loads and caches signatures
- WebSocket handlers in `websocket/handlers/technology-detector-handler.js`

**Modules to Modify:**
- `src/analysis/tech-detector.js` - Complete 6 remaining detection methods
- `websocket/server.js` - Integrate technology detection commands
- `src/main/main.js` - Initialize technology manager on startup

**External Dependencies:**
- `crypto` (built-in) - Favicon hashing
- Existing HTTP client libraries for header analysis
- No new npm packages required

### Implementation Complexity

**Estimate:**
- Lines of code: 400-600 new code
- Files to create/modify: 5-8 files
- Dev time: 80-100 hours
- Testing: 30-40 hours (20+ test suites)
- Total: 110-140 hours

**Testing Complexity:**
- Unit tests for each detection method (6 tests × 15 scenarios = 90 tests)
- Integration tests with real sites (50+ public targets)
- Accuracy validation against known technology sites
- Performance benchmarking (<100ms requirement)
- False positive rate validation

**Risk Areas:**
- Signature database needs continuous updates
- Performance under heavy concurrent requests
- Version detection accuracy (often complex regex)
- Favicon collision handling

### Technical Dependencies

**Must be done before:**
- Real-Time Behavioral Coherence Scoring (needs clean tech fingerprint baseline)
- Investigation Report Generation (tech detection included in forensic reports)

**Blocks:**
- Nothing critical; can proceed independently

**Parallelizable with:**
- Forensic Evidence Packaging
- Multi-Session Change Detection
- Session Coherence Validation

### Use Cases

**Security Researcher:**  
Quickly identify technology stack of target websites to determine attack surface, known vulnerabilities, and configuration weaknesses. Example: Discovering outdated WordPress version with known RCE vulnerability.

**Law Enforcement:**  
Document technology infrastructure of suspicious websites for forensic reports and evidence of sophistication level. Example: Identifying hosting provider, CMS, and security tools used by cybercriminal infrastructure.

**OSINT Analyst:**  
Build intelligence profiles of organizations by analyzing technology footprint across multiple domains. Example: "Company X uses AWS, WordPress, Cloudflare, and Google Analytics—indicating startup/small business infrastructure."

**Competitive Intelligence:**  
Monitor competitors' technology evolution over time. Example: "Competitor switched from Drupal to Headless CMS last quarter, indicating architecture modernization."

**Competitive Advantage:**  
- Integrated detection without separate API calls
- Forensic-grade evidence preservation (shows HOW detection occurred)
- Real-time analysis in WebSocket API
- Forensic chain-of-custody compatible

---

## Feature 2: Forensic Evidence Packaging & Chain of Custody

### Feature Specification

**Problem Solved:**  
Raw forensic data is scattered across multiple formats (HAR, screenshots, HTML, JSON). Investigators need a unified, cryptographically-verified evidence package that maintains legal chain of custody (RFC 3161, ISO 27037) for use in investigations and legal proceedings.

**Core Functionality:**  
Aggregate all forensic data from browser sessions (screenshots, HAR, DOM snapshots, metadata, network logs) into a single sealed evidence package with:
- Cryptographic hashing (SHA-256 per item, manifest hash)
- Digital timestamps (RFC 3161 TimeStamp Authority integration)
- Chain of custody logs (who accessed what, when)
- Compression and archival (WARC, TAR.GZ, ZIP formats)
- Export validators (verify package integrity)

**Success Criteria:**
- All forensic data captured in single package
- SHA-256 hashes with independent verification
- RFC 3161 timestamps for legal admissibility
- <500MB per 1-hour session (compression 70-90%)
- ISO 27037 compliance pathway documented
- Package integrity verification <1 second
- Compatible with legal evidence management systems

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "create_evidence_package",
  "params": {
    "sessionId": "sess_123",
    "title": "Investigation: Example.com Fraud",
    "investigator": "Officer Smith",
    "caseNumber": "CASE-2026-001",
    "includeScreenshots": true,
    "includeNetworkCapture": true,
    "includeDOM": true,
    "includeConsole": true,
    "format": "warc"  // or "tar.gz", "zip", "manifest"
  },
  "response": {
    "success": true,
    "data": {
      "packageId": "pkg_abc123def456",
      "size": 245321600,
      "compressed": true,
      "format": "warc",
      "itemCount": 2847,
      "manifestHash": "sha256:abc123...",
      "timestamp": "2026-06-13T14:23:45.123Z",
      "rfc3161Token": "...",
      "chainOfCustody": {
        "created": "2026-06-13T14:23:45Z",
        "creator": "Officer Smith",
        "sealed": true,
        "accessLog": []
      }
    }
  }
}
```

```json
{
  "command": "verify_evidence_package",
  "params": {
    "packageId": "pkg_abc123def456"
  },
  "response": {
    "success": true,
    "data": {
      "packageId": "pkg_abc123def456",
      "verificationStatus": "VERIFIED",
      "integrityOK": true,
      "itemsVerified": 2847,
      "itemsIntact": 2847,
      "manifestHashMatch": true,
      "timestampValid": true,
      "rfc3161Verified": true,
      "chainOfCustodyIntact": true,
      "verifiedAt": "2026-06-13T14:24:00Z",
      "verifier": "Verification Service v1.2"
    }
  }
}
```

```json
{
  "command": "export_evidence_package",
  "params": {
    "packageId": "pkg_abc123def456",
    "format": "warc",  // warc, tar.gz, zip, manifest
    "destination": "/path/to/export/",
    "includeMetadata": true
  },
  "response": {
    "success": true,
    "data": {
      "exported": true,
      "filePath": "/path/to/export/pkg_abc123def456.warc.gz",
      "fileSize": 245321600,
      "checksum": "sha256:xyz789...",
      "verificationInstructions": "..."
    }
  }
}
```

```json
{
  "command": "add_to_chain_of_custody",
  "params": {
    "packageId": "pkg_abc123def456",
    "action": "accessed",
    "actor": "Detective Johnson",
    "reason": "Evidence review for trial preparation",
    "timestamp": "2026-06-13T15:00:00Z"
  },
  "response": {
    "success": true,
    "data": {
      "entryId": "coc_entry_xyz",
      "timestamp": "2026-06-13T15:00:00Z",
      "sequenceNumber": 5,
      "signatureHash": "sha256:..."
    }
  }
}
```

**Modified Commands:**
- `screenshot` - Automatically adds to active evidence package
- `navigate` - Logs navigation in evidence timeline
- `get_page_state` - Returns forensic readiness status

**Data Structures:**
```javascript
// Evidence package manifest
{
  packageId: string,
  sessionId: string,
  created: ISO8601 timestamp,
  title: string,
  metadata: {
    investigator: string,
    caseNumber: string,
    jurisdiction: string,
    legalBasis: string
  },
  items: [
    {
      itemId: string,
      type: "screenshot" | "har" | "html" | "dom_snapshot" | "console" | "metadata",
      timestamp: ISO8601,
      hash: "sha256:...",
      size: number,
      url: string,
      contentType: string,
      forensicProvenanceId: string
    }
  ],
  manifests: {
    itemHashes: Map<itemId, hash>,
    manifestHash: "sha256:...",
    rfc3161Token: string,
    signatureAlgorithm: "SHA-256-RSA-2048"
  },
  chainOfCustody: [
    {
      sequenceNumber: number,
      timestamp: ISO8601,
      actor: string,
      action: "created" | "accessed" | "transferred" | "exported",
      reason: string,
      entryHash: "sha256:..."
    }
  ],
  compression: {
    algorithm: "gzip",
    originalSize: number,
    compressedSize: number,
    ratio: number
  },
  isoCompliance: {
    standard: "ISO/IEC 27037:2012",
    requirements: {
      integrityPreservation: true,
      authenticationPreservation: true,
      chainOfCustody: true,
      handlingDocumentation: true
    }
  }
}
```

### Integration Points

**Existing Systems:**
- `src/analysis/forensic-report-generator.js` (300+ lines) - Report generation exists, 35% complete
- `src/forensics/` - Evidence collection framework
- `src/extraction/evidence-collector.js` - Screenshot and HAR collection
- `src/compliance/soc2-compliance.js` - Compliance framework exists

**Modules to Create/Modify:**
- `src/forensics/evidence-packager.js` (NEW, 400-500 lines) - Package creation and sealing
- `src/forensics/chain-of-custody.js` (NEW, 250-300 lines) - COC tracking and logging
- `src/forensics/evidence-verifier.js` (NEW, 200-250 lines) - Integrity verification
- `src/forensics/rfc3161-integration.js` (NEW, 150-200 lines) - Timestamp integration
- Modify `websocket/server.js` - Add evidence package commands
- Modify `src/extraction/evidence-collector.js` - Integrate with packager

**External Dependencies:**
- `rfc3161ng` npm package - RFC 3161 timestamp tokens
- `archiver` npm package - WARC/TAR/ZIP creation (may be already present)
- `crypto` (built-in) - SHA-256 hashing
- `tar` npm package - TAR archive support

### Implementation Complexity

**Estimate:**
- Lines of code: 1200-1500 new code
- Files to create/modify: 6-8 files
- Dev time: 120-150 hours
- Testing: 40-50 hours (30+ test suites)
- Legal/compliance review: 20-30 hours
- Total: 180-230 hours

**Testing Complexity:**
- Package creation with various data volumes (1MB-1GB)
- Hash verification across 1000+ items
- RFC 3161 timestamp integration testing
- Chain of custody manipulation attempts (security tests)
- Format validation (WARC, TAR.GZ, ZIP)
- Compression ratio testing (verify 70-90% reduction)
- Legal evidence framework compatibility testing

**Risk Areas:**
- RFC 3161 provider availability and costs
- Large file handling (memory efficiency for 500MB+ packages)
- Hash collision detection
- Chain of custody tamper-proofing
- Legal compliance in different jurisdictions

### Technical Dependencies

**Must be done before:**
- Investigation Report Generation (reports reference evidence packages)

**Blocks:**
- Nothing critical; can proceed independently

**Parallelizable with:**
- Technology Fingerprinting
- Session Coherence Validation
- Real-Time Behavioral Coherence Scoring

### Use Cases

**Law Enforcement Digital Forensics:**  
Collect evidence from dark web investigation, seal in cryptographically-verified package, maintain chain of custody through arrest, trial, and appeal. Legal admissibility requires proving no tampering from collection to courtroom.

**Corporate Security Incident Response:**  
Investigate compromised employee account, package all forensic evidence (logins, downloads, communications), maintain audit trail of who reviewed evidence, export for compliance officer review.

**OSINT Investigator:**  
Investigate suspected fraud ring, collect evidence from multiple sites, seal evidence package with timestamp, use evidence package in report to law enforcement or financial institutions.

**Competitive Advantage:**
- RFC 3161 legal timestamps (competitors don't have)
- Chain of custody automation (no manual logging)
- Multi-format export (WARC, TAR, ZIP, manifest)
- Forensic-grade integrity verification
- ISO 27037 compliance pathway documented

---

## Feature 3: Session Coherence Validation (5-Layer Detection)

### Feature Specification

**Problem Solved:**  
Multi-request sessions exhibit internal inconsistencies that trigger bot detection: fingerprints that shift impossibly, behaviors that violate physics laws, network patterns that don't match device, device claims that contradict each other, timelines with impossible gaps. Currently validated manually or not at all. Need automated cross-layer coherence validation.

**Core Functionality:**  
Validate 5 layers of session coherence continuously:
1. **Temporal Layer:** Fingerprints shouldn't change >2% between requests
2. **Behavioral Layer:** Mouse/typing patterns remain consistent (confidence >92%)
3. **Network Layer:** Request patterns match claimed device capabilities
4. **Device Layer:** Screen resolution, browser version, OS don't contradict
5. **Timeline Layer:** No time-travel, gaps aligned with page load times

Return coherence score (0-100) and violation reports for each layer.

**Success Criteria:**
- All 5 layers validated per request
- Coherence score accurate ±3 points
- Violation detection <1ms overhead
- 95%+ detection of coherence violations
- Works with concurrent multi-page sessions
- Recovery suggestions for detected violations

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "get_session_coherence",
  "params": {
    "sessionId": "sess_123"
  },
  "response": {
    "success": true,
    "data": {
      "sessionId": "sess_123",
      "overallCoherence": 94.2,
      "isCoherent": true,
      "timestamp": "2026-06-13T14:23:45Z",
      "layers": {
        "temporal": {
          "score": 96.1,
          "status": "COHERENT",
          "fingerprintDrift": 0.01,
          "violations": [],
          "evidence": {
            "initialFingerprint": {...},
            "driftAnalysis": "Fingerprint stable within 1% tolerance"
          }
        },
        "behavioral": {
          "score": 93.8,
          "status": "COHERENT",
          "patternConsistency": 0.938,
          "violations": [],
          "evidence": {
            "mousePattern": "Bezier curves with natural acceleration",
            "typingPattern": "WPM consistent 65-75 throughout session"
          }
        },
        "network": {
          "score": 92.4,
          "status": "COHERENT",
          "requestPatternMatch": 0.924,
          "violations": [],
          "evidence": {
            "requestTiming": "Matches 1920x1080 display bandwidth expectations",
            "headerConsistency": "All requests claim same browser version"
          }
        },
        "device": {
          "score": 95.7,
          "status": "COHERENT",
          "contradictions": 0,
          "violations": [],
          "evidence": {
            "osConsistency": "macOS 13.4 consistent across 45 claims",
            "browserConsistency": "Chrome 114 consistent across 45 claims",
            "screenConsistency": "1920x1080 never contradicted"
          }
        },
        "timeline": {
          "score": 94.1,
          "status": "COHERENT",
          "gaps": [],
          "violations": [],
          "evidence": {
            "totalEventCount": 234,
            "eventSequenceValid": true,
            "noTimeTravel": true
          }
        }
      },
      "history": [
        {
          "timestamp": "2026-06-13T14:20:00Z",
          "coherenceScore": 94.2,
          "layerScores": {...}
        }
      ]
    }
  }
}
```

```json
{
  "command": "validate_coherence_request",
  "params": {
    "sessionId": "sess_123",
    "requestData": {
      "fingerprint": {...},
      "behavior": {...},
      "network": {...},
      "device": {...},
      "timestamp": "2026-06-13T14:23:45Z"
    }
  },
  "response": {
    "success": true,
    "data": {
      "coherenceScore": 94.2,
      "isCoherent": true,
      "layerAnalysis": [...],
      "violations": [],
      "warnings": [],
      "suggestions": []
    }
  }
}
```

```json
{
  "command": "get_coherence_violations",
  "params": {
    "sessionId": "sess_123",
    "layer": "temporal"  // or null for all
  },
  "response": {
    "success": true,
    "data": {
      "violationCount": 0,
      "violations": [],
      "timeline": [...],
      "recommendations": []
    }
  }
}
```

**Modified Commands:**
- All WebSocket commands - Add coherence validation hook
- `navigate`, `click`, `fill`, `scroll`, etc. - Return coherence check in response

**Data Structures:**
```javascript
// Coherence validation result
{
  sessionId: string,
  requestId: string,
  timestamp: ISO8601,
  overallCoherence: number, // 0-100
  isCoherent: boolean,
  layers: {
    temporal: {
      score: number,
      status: "COHERENT" | "VIOLATION" | "WARNING",
      fingerprintDrift: number, // 0-1, max acceptable 0.02
      violations: [],
      evidence: {
        initialFingerprint: object,
        driftAnalysis: string,
        maxDriftObserved: number
      }
    },
    behavioral: {
      score: number,
      patternConsistency: number, // 0-1
      deviations: [],
      evidence: {
        mousePattern: string,
        typingPattern: string,
        scrollPattern: string
      }
    },
    network: {
      score: number,
      requestPatternMatch: number,
      anomalies: [],
      evidence: {
        requestTiming: string,
        headerConsistency: string,
        bandwidthMatch: boolean
      }
    },
    device: {
      score: number,
      contradictions: number,
      impossibilities: [],
      evidence: {
        osConsistency: string,
        browserConsistency: string,
        screenConsistency: string,
        pluginConsistency: string
      }
    },
    timeline: {
      score: number,
      gaps: [],
      impossibilities: [],
      evidence: {
        totalEventCount: number,
        eventSequenceValid: boolean,
        noTimeTravel: boolean
      }
    }
  },
  recoveryStrategies: [
    {
      violation: string,
      severity: "INFO" | "WARNING" | "CRITICAL",
      suggestion: string,
      command: string
    }
  ]
}
```

### Integration Points

**Existing Systems:**
- `src/evasion/session-coherence.js` (784 lines) - Core framework exists, 50% complete
- `src/evasion/behavioral-micro-timing.js` (447 lines) - Behavioral analysis
- `src/evasion/device-fingerprinter.js` (483 lines) - Device tracking
- `src/evasion/fingerprint-validator.js` (374 lines) - Fingerprint validation
- WebSocket handlers for all commands

**Modules to Modify:**
- `src/evasion/session-coherence.js` - Complete 5-layer validation
- `src/evasion/behavioral-micro-timing.js` - Behavioral consistency scoring
- `src/evasion/device-fingerprinter.js` - Device contradiction detection
- `websocket/server.js` - Add coherence commands
- All WebSocket command handlers - Integrate coherence checks

**External Dependencies:**
- None new (uses existing evasion modules)

### Implementation Complexity

**Estimate:**
- Lines of code: 500-700 new code
- Files to create/modify: 8-10 files
- Dev time: 60-80 hours
- Testing: 35-45 hours (40+ test suites)
- Total: 95-125 hours

**Testing Complexity:**
- 5 independent layer tests (10+ scenarios each = 50 tests)
- Multi-request coherence tracking (50+ request sequences)
- Violation injection testing (test detection of intentional violations)
- Performance testing (coherence checks <1ms overhead)
- Edge case testing (session restart, fingerprint rotation)
- Concurrent session testing (multiple sessions simultaneously)

**Risk Areas:**
- Performance overhead of continuous validation
- False positives from legitimate fingerprint changes
- Complexity of behavioral pattern matching
- Timeline reconstruction with concurrent requests

### Technical Dependencies

**Must be done before:**
- Real-Time Behavioral Coherence Scoring (depends on this layer)
- Multi-Session Change Detection (needs clean coherence baseline)

**Blocks:**
- Real-Time Behavioral Coherence Scoring (this is prerequisite)

**Parallelizable with:**
- Technology Fingerprinting
- Forensic Evidence Packaging
- Investigation Report Generation

### Use Cases

**Bot Evasion Researcher:**  
Verify that evasion techniques don't create internal inconsistencies that trigger detection. Monitor coherence score during session to catch impossible device claims or behavioral anomalies.

**Forensic Investigator:**  
Validate that traffic truly came from claimed device/location. Example: "Suspect claims to be on iPhone from California, but fingerprint shows Linux desktop from Russian IP—coherence failure indicates spoofing."

**Malware Analyst:**  
Detect if botnet C2 traffic is exhibiting consistent behavior patterns or creating detection-triggering inconsistencies that reveal it as automated malware.

**Competitive Advantage:**
- Real-time coherence scoring (no post-analysis lag)
- 5-layer validation (deeper than competitors)
- Recovery suggestions (helps fix issues automatically)
- Forensic-grade violation evidence

---

## Feature 4: Real-Time Behavioral Coherence Scoring

### Feature Specification

**Problem Solved:**  
Bot detection systems track behavior anomalies (mouse movement statistics, typing patterns, scroll speed, pause timing, click velocity). Currently, behavior is analyzed after-the-fact or not at all. Researchers need real-time scoring (0-100) indicating how "human-like" current behavior appears to detection algorithms.

**Core Functionality:**  
Continuously score behavior across 12+ dimensions (mouse velocity, acceleration, pause patterns, typing speed, inter-keystroke timing, scroll acceleration, click timing, idle duration, form interaction patterns, navigation timing, viewport usage, typing errors). Return live score updated every 500ms, with per-dimension breakdowns and anomaly alerts.

**Success Criteria:**
- Behavioral score accurate ±5 points
- Real-time updates (<500ms latency)
- 12+ independent behavior dimensions tracked
- Anomaly detection <2 seconds after anomaly occurs
- <50ms computational overhead per update
- Correlates with actual bot detection success rates (validate against real detection systems)

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "enable_behavioral_scoring",
  "params": {
    "sessionId": "sess_123",
    "updateInterval": 500,
    "includeBreakdown": true,
    "anomalyThreshold": 0.7
  },
  "response": {
    "success": true,
    "data": {
      "scoringEnabled": true,
      "updateInterval": 500,
      "sessionId": "sess_123"
    }
  }
}
```

```json
{
  "command": "get_behavioral_score",
  "params": {
    "sessionId": "sess_123"
  },
  "response": {
    "success": true,
    "data": {
      "sessionId": "sess_123",
      "overallScore": 87.3,
      "isHumanLike": true,
      "confidence": 0.92,
      "timestamp": "2026-06-13T14:23:45.123Z",
      "dimensions": {
        "mouseMovement": {
          "score": 91.2,
          "status": "NATURAL",
          "metrics": {
            "averageVelocity": 245.3,
            "accelerationPattern": "smooth_bezier",
            "pauseFrequency": 0.23,
            "directnessRatio": 0.87,
            "totalDistance": 45234
          }
        },
        "typingPattern": {
          "score": 84.1,
          "status": "NATURAL",
          "metrics": {
            "wordsPerMinute": 68.5,
            "averageInterKeystrokeTime": 125,
            "pauseFrequency": 0.18,
            "typingErrors": 0.02,
            "errorCorrectionTime": 850
          }
        },
        "scrollBehavior": {
          "score": 89.4,
          "status": "NATURAL",
          "metrics": {
            "averageVelocity": 320,
            "accelerationProfile": "natural_deceleration",
            "pausesPerPage": 3,
            "directionChanges": 2
          }
        },
        "clickTiming": {
          "score": 92.1,
          "status": "NATURAL",
          "metrics": {
            "averageClickDuration": 145,
            "clickInterval": 2340,
            "doubleClickRate": 0.01
          }
        },
        "idlePatterns": {
          "score": 85.3,
          "status": "NATURAL",
          "metrics": {
            "averageIdleDuration": 8400,
            "idleFrequency": 1.2,
            "maxIdleDuration": 45000
          }
        },
        "navigationTiming": {
          "score": 88.7,
          "status": "NATURAL",
          "metrics": {
            "pageLoadAwarenessTime": 1230,
            "clickToNavigationDelay": 345,
            "interPageDelay": 5670
          }
        },
        "formInteraction": {
          "score": 86.5,
          "status": "NATURAL",
          "metrics": {
            "focusToTypeDelay": 340,
            "fieldCompletionTime": 4560,
            "tabVsClickUsage": 0.65,
            "fieldSkipRate": 0.05
          }
        },
        "viewportUsage": {
          "score": 90.2,
          "status": "NATURAL",
          "metrics": {
            "contentCoveragePct": 0.92,
            "viewportFocusArea": "content_rich_region",
            "readingPattern": "f_pattern"
          }
        },
        "browserInteraction": {
          "score": 89.1,
          "status": "NATURAL",
          "metrics": {
            "backButtonUsage": 0.12,
            "forwardButtonUsage": 0.03,
            "historyAwareness": 0.88
          }
        },
        "mouseHeatmap": {
          "score": 87.3,
          "status": "NATURAL",
          "metrics": {
            "concentrationArea": "primary_content",
            "interactionDensity": "moderate",
            "edgeCases": 0.01
          }
        },
        "interactionSequencing": {
          "score": 88.9,
          "status": "NATURAL",
          "metrics": {
            "randomSequenceRatio": 0.15,
            "deliberateInteractionRatio": 0.85,
            "exploratoryClicks": 0.08
          }
        },
        "deviceSpecificBehavior": {
          "score": 91.4,
          "status": "NATURAL",
          "metrics": {
            "dpiAwareness": 0.94,
            "screenSizeAwareness": 0.96,
            "touchpadVsMouse": "mouse_consistent"
          }
        }
      },
      "anomalies": [],
      "trend": "STABLE",
      "predictions": {
        "botDetectionRiskLevel": "LOW",
        "estimatedDetectionProbability": 0.08,
        "recommendedAdjustments": []
      }
    }
  }
}
```

```json
{
  "command": "get_behavioral_history",
  "params": {
    "sessionId": "sess_123",
    "timeWindow": 300000,  // 5 minutes in ms
    "dimension": "mouseMovement"  // null for all
  },
  "response": {
    "success": true,
    "data": {
      "history": [
        {
          "timestamp": "2026-06-13T14:20:00.000Z",
          "score": 85.1,
          "dimensions": {...}
        },
        {
          "timestamp": "2026-06-13T14:20:00.500Z",
          "score": 86.3,
          "dimensions": {...}
        }
      ],
      "trend": "IMPROVING",
      "volatility": 1.2
    }
  }
}
```

**New Events (WebSocket Server → Client):**
```json
{
  "event": "behavioral_score_update",
  "data": {
    "sessionId": "sess_123",
    "overallScore": 87.3,
    "timestamp": "2026-06-13T14:23:45.500Z",
    "dimensionScores": {...}
  }
}
```

```json
{
  "event": "behavioral_anomaly_detected",
  "data": {
    "sessionId": "sess_123",
    "dimension": "typingPattern",
    "severity": "WARNING",
    "anomaly": "Typing speed suddenly increased from 68 WPM to 120 WPM",
    "recommendation": "Add deliberate pauses to typing pattern",
    "timestamp": "2026-06-13T14:23:47.123Z"
  }
}
```

**Modified Commands:**
- All interaction commands (`click`, `fill`, `scroll`, etc.) - Include behavioral metrics in response

**Data Structures:**
```javascript
// Behavioral dimension measurement
{
  dimensionId: string,           // "mouseMovement", "typingPattern", etc.
  score: number,                 // 0-100
  status: "NATURAL" | "SUSPICIOUS" | "ANOMALOUS",
  confidenceLevel: number,       // 0-1
  metrics: {
    // Dimension-specific metrics
  },
  history: [
    {
      timestamp: ISO8601,
      score: number,
      metrics: {...},
      anomalies: []
    }
  ],
  anomalies: [
    {
      timestamp: ISO8601,
      description: string,
      severity: "INFO" | "WARNING" | "CRITICAL",
      correction: string
    }
  ]
}

// Real-time behavioral update
{
  sessionId: string,
  timestamp: ISO8601,
  overallScore: number,        // 0-100
  confidence: number,           // 0-1
  dimensions: Map<dimId, BehavioralDimension>,
  anomalies: [
    {
      dimensionId: string,
      description: string,
      severity: string,
      suggestion: string
    }
  ],
  trend: "IMPROVING" | "STABLE" | "DEGRADING",
  botDetectionRisk: number,    // 0-1
  recommendations: [string]    // Actionable suggestions
}
```

### Integration Points

**Existing Systems:**
- `src/evasion/behavioral-simulator.js` (384 lines) - Behavior generation
- `src/evasion/behavioral-micro-timing.js` (447 lines) - Timing analysis, 20% complete
- `src/evasion/multi-layer-coordinator.js` (596 lines) - Evasion orchestration
- WebSocket message handlers

**Modules to Create/Modify:**
- `src/evasion/behavioral-scorer.js` (NEW, 600-800 lines) - Real-time scoring engine
- `src/evasion/behavior-analytics.js` (NEW, 400-500 lines) - Dimension analysis
- `src/evasion/anomaly-detector.js` (NEW, 300-400 lines) - Anomaly detection
- `websocket/server.js` - Add behavioral scoring commands
- Modify all interaction command handlers - Capture behavior metrics

**External Dependencies:**
- `moving-average` npm package - For trend calculation
- `statistical-functions` npm package - For distribution analysis
- No new critical dependencies

### Implementation Complexity

**Estimate:**
- Lines of code: 1400-1800 new code
- Files to create/modify: 8-10 files
- Dev time: 100-130 hours
- Testing: 50-60 hours (50+ test suites)
- Total: 150-190 hours

**Testing Complexity:**
- 12 independent dimension tests (5+ scenarios each = 60 tests)
- Anomaly injection testing (trigger each anomaly, verify detection)
- Real-time update performance (verify <500ms latency)
- Trend analysis validation (compare against known behavioral patterns)
- Bot detection correlation testing (validate against real detection systems)
- Concurrent session scoring (multiple sessions simultaneously)
- Historical data accuracy (verify scoring retroactively)

**Risk Areas:**
- Real-time performance impact on browser operations
- Accurately scoring legitimate behavioral variations
- Anomaly detection false positive rate
- Correlation with actual bot detection (requires external validation)
- Handling of behavioral transitions (sleep → wake, desktop → mobile)

### Technical Dependencies

**Must be done before:**
- Investigation Report Generation (behavioral scoring included in reports)

**Blocks:**
- Nothing critical; depends on Session Coherence (should complete that first)

**Parallelizable with:**
- Technology Fingerprinting
- Forensic Evidence Packaging
- Multi-Session Change Detection

### Use Cases

**Bot Evasion Engineer:**  
Monitor behavioral score while developing new evasion techniques. Example: "Typing speed anomaly detected—add keystroke variation to bring score from 62 to 85."

**Security Researcher:**  
Understand what bot detection systems "see" when analyzing traffic. Use behavioral score as proxy for actual detection risk across multiple platforms.

**Adversarial Testing:**  
Build regression tests for evasion techniques. Example: "All regression tests must maintain behavioral score >85 throughout session."

**Competitive Advantage:**
- Real-time feedback (no wait for detection results)
- 12-dimensional analysis (competitors show 2-3)
- Anomaly prediction (warns before detection)
- Actionable recommendations (suggests specific fixes)

---

## Feature 5: Multi-Session Change Detection & Timeline

### Feature Specification

**Problem Solved:**  
Investigators need to monitor target websites across multiple sessions and detect when pages have changed: new content added, content removed, layout shifted, forms modified, JavaScript loaded/unloaded. Currently requires manual comparison or expensive CDN diff tools. Need automated change detection with forensic timeline.

**Core Functionality:**  
Continuously monitor target sites across multiple sessions, comparing page state (DOM structure, content hash, layout, JavaScript, CSS, images) and generating forensic timeline of detected changes. Return change matrix (what changed, when, how), with visual diffs and confidence scoring.

**Success Criteria:**
- Detect 95%+ of meaningful content changes
- <5% false positive rate for minor style changes
- Change detection <2 seconds after change loads
- Timeline reconstruction accurate to 100ms
- Works across 10+ concurrent monitoring sessions
- Export timeline in multiple formats (JSON, CSV, HTML)

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "start_change_monitoring",
  "params": {
    "sessionId": "sess_123",
    "monitoringIntervalMs": 30000,
    "trackElements": ["dom", "content", "layout", "images", "scripts", "styles"],
    "sensitivityLevel": "medium"  // low, medium, high
  },
  "response": {
    "success": true,
    "data": {
      "monitoringId": "mon_abc123",
      "sessionId": "sess_123",
      "active": true,
      "interval": 30000,
      "trackedElements": 5
    }
  }
}
```

```json
{
  "command": "get_page_changes",
  "params": {
    "sessionId": "sess_123",
    "monitoringId": "mon_abc123",
    "timeWindow": null  // null for all, or [startTime, endTime]
  },
  "response": {
    "success": true,
    "data": {
      "changeCount": 23,
      "changes": [
        {
          "changeId": "chg_001",
          "timestamp": "2026-06-13T14:20:15.342Z",
          "type": "content_change",
          "elementSelector": "body > div.news-item:nth-child(1)",
          "elementPath": ["html", "body", "div.news-item"],
          "changeDescription": "New article added to news section",
          "beforeSnapshot": {
            "html": "<div class='news-item'>...",
            "contentHash": "sha256:abc123...",
            "text": "..."
          },
          "afterSnapshot": {
            "html": "<div class='news-item'>...",
            "contentHash": "sha256:def456...",
            "text": "..."
          },
          "diffType": "content_insertion",
          "confidence": 0.99,
          "visualDiff": "data:image/png;base64,..."
        },
        {
          "changeId": "chg_002",
          "timestamp": "2026-06-13T14:25:30.891Z",
          "type": "dom_structure_change",
          "elementSelector": "div.sidebar",
          "changeDescription": "Sidebar element moved from right to left column",
          "beforeSnapshot": {...},
          "afterSnapshot": {...},
          "diffType": "dom_reordering",
          "confidence": 0.94,
          "impact": "HIGH"
        }
      ],
      "timeline": [
        {
          "timestamp": "2026-06-13T14:20:15.342Z",
          "changeCount": 1,
          "changes": ["chg_001"]
        }
      ],
      "summary": {
        "totalChanges": 23,
        "contentChanges": 15,
        "layoutChanges": 4,
        "imageChanges": 2,
        "scriptChanges": 2,
        "styleChanges": 0,
        "lastChangeTime": "2026-06-13T14:25:30.891Z"
      }
    }
  }
}
```

```json
{
  "command": "compare_page_snapshots",
  "params": {
    "sessionId": "sess_123",
    "snapshots": ["snap_001", "snap_002"],
    "includeVisualDiff": true
  },
  "response": {
    "success": true,
    "data": {
      "differences": [
        {
          "type": "content_change",
          "location": "body > div.main-content",
          "description": "..."
        }
      ],
      "changeScore": 0.45,
      "visualDiffImage": "data:image/png;base64,..."
    }
  }
}
```

```json
{
  "command": "export_change_timeline",
  "params": {
    "monitoringId": "mon_abc123",
    "format": "json",  // json, csv, html, markdown
    "includeSnapshots": false,
    "includeVisualDiffs": false
  },
  "response": {
    "success": true,
    "data": {
      "exported": true,
      "format": "json",
      "fileName": "change_timeline_mon_abc123.json",
      "content": {...}
    }
  }
}
```

**New Events:**
```json
{
  "event": "page_change_detected",
  "data": {
    "sessionId": "sess_123",
    "monitoringId": "mon_abc123",
    "changeId": "chg_001",
    "timestamp": "2026-06-13T14:20:15.342Z",
    "changeType": "content_change",
    "elementPath": ["html", "body", "div.news"],
    "description": "New article added",
    "confidence": 0.99
  }
}
```

**Modified Commands:**
- `navigate` - Returns change comparison with previous session visit
- `screenshot` - Include change detection info

**Data Structures:**
```javascript
// Change detection record
{
  changeId: string,
  sessionId: string,
  monitoringId: string,
  timestamp: ISO8601,
  type: "content_change" | "dom_structure_change" | "layout_change" | "image_change" | "script_change" | "style_change",
  elementSelector: string,      // CSS path to changed element
  elementPath: string[],        // Array path [html, body, div, ...]
  changeDescription: string,
  beforeSnapshot: {
    html: string,
    text: string,
    contentHash: "sha256:...",
    layoutMetrics: { ... },
    images: [...]
  },
  afterSnapshot: {
    html: string,
    text: string,
    contentHash: "sha256:...",
    layoutMetrics: { ... },
    images: [...]
  },
  diffType: "insertion" | "deletion" | "modification" | "reordering",
  confidence: number,           // 0-1
  impact: "LOW" | "MEDIUM" | "HIGH",
  visualDiff: string,          // Base64 encoded diff image
  metadata: {
    changeSize: number,         // Bytes changed
    percentageChange: number,   // % of element changed
    estimatedLoadTime: number   // ms estimated to load changed content
  }
}

// Change monitoring session
{
  monitoringId: string,
  sessionId: string,
  startedAt: ISO8601,
  changes: [ChangeRecord],
  statistics: {
    totalChanges: number,
    changeRate: number,         // changes per hour
    largestChange: ChangeRecord,
    mostFrequentElement: string,
    timeOfMostActivity: ISO8601
  },
  timeline: [
    {
      timestamp: ISO8601,
      changeCount: number,
      changes: [changeId]
    }
  ]
}
```

### Integration Points

**Existing Systems:**
- `src/monitoring/page-change-detector.js` (if exists) - Monitor framework
- `src/extraction/dom-snapshots.js` - DOM state capture
- `src/screenshots/screenshot-manager.js` - Visual diff support

**Modules to Create/Modify:**
- `src/monitoring/change-detector.js` (NEW, 600-800 lines) - Core change detection
- `src/monitoring/visual-diff-generator.js` (NEW, 300-400 lines) - Visual diff images
- `src/monitoring/change-timeline.js` (NEW, 400-500 lines) - Timeline aggregation
- `websocket/server.js` - Add change monitoring commands
- Create test suite: `tests/change-detection/` (50+ tests)

**External Dependencies:**
- `diff` npm package - Text diff algorithm
- `image-diff` npm package - Visual diff generation
- `html-diff` npm package - Semantic HTML diffing
- Existing DOM snapshot functionality

### Implementation Complexity

**Estimate:**
- Lines of code: 1500-2000 new code
- Files to create/modify: 6-8 files
- Dev time: 90-120 hours
- Testing: 40-50 hours (40+ test suites)
- Total: 130-170 hours

**Testing Complexity:**
- Change detection accuracy (inject 100+ change types, verify detection)
- False positive validation (make minor CSS changes, verify low sensitivity)
- Timeline reconstruction (verify chronological accuracy)
- Visual diff quality (verify human-readable diffs)
- Performance under load (10+ concurrent monitoring sessions)
- Export format validation (JSON, CSV, HTML formats)
- Change correlation (group related changes into logical units)

**Risk Areas:**
- Visual diff generation performance (expensive operation)
- Memory usage for storing snapshots (needs cleanup/archival)
- Detecting meaningful changes while ignoring ads/tracking changes
- Timeline reconstruction with network delays
- Handling concurrent changes on same element

### Technical Dependencies

**Must be done before:**
- Investigation Report Generation (change timeline included in reports)

**Blocks:**
- Nothing critical; can proceed independently

**Parallelizable with:**
- Technology Fingerprinting
- Forensic Evidence Packaging
- Behavioral Coherence Scoring
- Session Coherence Validation

### Use Cases

**Competitive Intelligence:**  
Monitor competitor website for changes over time. Example: "Detected new product page added June 10, pricing updated June 12, new team member added June 13."

**OSINT Investigator:**  
Track changes on target website to detect when malicious activity occurred. Example: "Malicious script injected June 8, removed June 10, reinjected June 15 at 14:23:45Z."

**Threat Intelligence Analyst:**  
Monitor dark web marketplace for new listings, price changes, or administrative changes. Example: "New listing of stolen data added, price adjusted from 0.5 BTC to 1.2 BTC."

**Web Archive Researcher:**  
Document evolution of websites over weeks/months. Example: "30 changes tracked over 30 days, including 5 major layout changes and 12 content updates."

**Competitive Advantage:**
- Automated change detection (no manual comparison)
- Visual diffs (see exactly what changed)
- Forensic timeline (precise timestamps)
- Multi-session tracking (track across multiple visits)

---

## Feature 6: Investigation Report Generation

### Feature Specification

**Problem Solved:**  
Forensic data is scattered across multiple formats and locations. Investigators need unified reports that combine: page content, technologies detected, screenshots, network captures, metadata, behavioral analysis, change timeline, and chain of custody into single professional documents suitable for law enforcement, legal teams, or management review.

**Core Functionality:**  
Aggregate all forensic data from browser sessions into comprehensive HTML/PDF reports with sections for: Executive Summary, Technologies Detected, Content Analysis, Network Forensics, Evidence Chain, Timeline, Screenshots with Annotations, Recommendations. Include filters for sensitive data, export capabilities, and digital signatures.

**Success Criteria:**
- All forensic data aggregated in single report
- Report generation <30 seconds
- HTML reports <50MB, PDF reports <100MB
- Professional formatting suitable for legal submission
- Digital signatures with verification capability
- Export formats: HTML, PDF, Markdown, JSON
- Sensitive data filtering (redaction capability)

### WebSocket API Changes

**New Commands:**

```json
{
  "command": "generate_investigation_report",
  "params": {
    "sessionId": "sess_123",
    "title": "Investigation Report: example.com",
    "investigator": "Detective Smith",
    "caseNumber": "CASE-2026-001",
    "includeScreenshots": true,
    "includeNetworkCapture": true,
    "includePageContent": true,
    "includeTechnologies": true,
    "includeTimeline": true,
    "includeRecommendations": true,
    "sensitiveDataFilter": ["email", "phone", "credit_card"],
    "format": "html"  // html, pdf, markdown, json
  },
  "response": {
    "success": true,
    "data": {
      "reportId": "rpt_abc123def456",
      "sessionId": "sess_123",
      "format": "html",
      "fileSize": 24567890,
      "pageCount": 48,
      "generatedAt": "2026-06-13T14:25:00.123Z",
      "sections": {
        "executiveSummary": {
          "generated": true,
          "wordCount": 342
        },
        "technologies": {
          "generated": true,
          "techCount": 23
        },
        "screenshots": {
          "generated": true,
          "imageCount": 12
        },
        "networkForensics": {
          "generated": true,
          "requestCount": 847
        },
        "evidence": {
          "generated": true,
          "itemCount": 2847
        },
        "timeline": {
          "generated": true,
          "eventCount": 234
        }
      },
      "downloadUrl": "/reports/rpt_abc123def456.html",
      "verificationHash": "sha256:xyz789..."
    }
  }
}
```

```json
{
  "command": "export_report",
  "params": {
    "reportId": "rpt_abc123def456",
    "format": "pdf",  // pdf, html, markdown, json
    "destination": "/path/to/export/"
  },
  "response": {
    "success": true,
    "data": {
      "exported": true,
      "filePath": "/path/to/export/investigation_report.pdf",
      "fileSize": 87654321,
      "exportTime": "2026-06-13T14:25:30.456Z"
    }
  }
}
```

```json
{
  "command": "get_report",
  "params": {
    "reportId": "rpt_abc123def456"
  },
  "response": {
    "success": true,
    "data": {
      "reportId": "rpt_abc123def456",
      "sessionId": "sess_123",
      "title": "Investigation Report: example.com",
      "generatedAt": "2026-06-13T14:25:00.123Z",
      "content": {...},
      "format": "html",
      "signature": "sha256:..."
    }
  }
}
```

```json
{
  "command": "annotate_report_screenshot",
  "params": {
    "reportId": "rpt_abc123def456",
    "screenshotId": "ss_001",
    "annotations": [
      {
        "type": "highlight",
        "coordinates": [100, 200, 400, 300],
        "color": "yellow",
        "note": "Suspicious element"
      }
    ]
  },
  "response": {
    "success": true,
    "data": {
      "annotated": true,
      "annotationCount": 1
    }
  }
}
```

**Data Structures:**
```javascript
// Investigation report
{
  reportId: string,
  sessionId: string,
  title: string,
  createdAt: ISO8601,
  metadata: {
    investigator: string,
    caseNumber: string,
    jurisdiction: string,
    purpose: string
  },
  sections: {
    executiveSummary: {
      content: string,
      findings: string[],
      recommendations: string[]
    },
    technologies: {
      detected: [
        {
          id: string,
          category: string,
          name: string,
          version: string,
          confidence: number,
          evidence: [string]
        }
      ],
      summary: string
    },
    screenshots: [
      {
        screenshotId: string,
        url: string,
        timestamp: ISO8601,
        image: "base64:...",
        annotations: [
          {
            type: "highlight" | "circle" | "arrow" | "text",
            coordinates: [x, y, x2, y2],
            note: string
          }
        ]
      }
    ],
    networkForensics: {
      totalRequests: number,
      totalDataTransferred: number,
      requests: [
        {
          timestamp: ISO8601,
          method: string,
          url: string,
          status: number,
          responseTime: number
        }
      ],
      securityHeaders: {},
      anomalies: [string]
    },
    contentAnalysis: {
      originalUrl: string,
      title: string,
      description: string,
      content: string,
      forms: [
        {
          id: string,
          fields: string[],
          action: string
        }
      ],
      links: [
        {
          url: string,
          text: string,
          type: "internal" | "external"
        }
      ]
    },
    evidence: {
      chainOfCustody: [
        {
          timestamp: ISO8601,
          actor: string,
          action: string,
          reason: string
        }
      ],
      itemCount: number,
      integrityVerified: boolean
    },
    timeline: [
      {
        timestamp: ISO8601,
        event: string,
        source: string,
        details: string
      }
    ],
    recommendations: [
      {
        priority: "HIGH" | "MEDIUM" | "LOW",
        recommendation: string,
        reasoning: string
      }
    ]
  },
  digitalSignature: {
    algorithm: string,
    hash: string,
    signedAt: ISO8601,
    signedBy: string
  }
}
```

### Integration Points

**Existing Systems:**
- `src/analysis/forensic-report-generator.js` (300+ lines) - Report generation exists, 30% complete
- `src/reporting/` - Reporting infrastructure
- `src/extraction/evidence-collector.js` - Evidence collection
- `src/analysis/tech-detector.js` - Technology detection
- `src/monitoring/` - Change detection results

**Modules to Create/Modify:**
- `src/reporting/report-generator.js` (NEW/ENHANCE, 800-1000 lines) - Complete report generation
- `src/reporting/html-report-template.js` (NEW, 400-500 lines) - HTML template generation
- `src/reporting/pdf-report-generator.js` (NEW, 300-400 lines) - PDF export
- `src/reporting/markdown-report-generator.js` (NEW, 200-300 lines) - Markdown export
- `websocket/server.js` - Add report commands
- Create test suite: `tests/reporting/` (30+ tests)

**External Dependencies:**
- `puppeteer` or `chrome-pdf` npm package - PDF generation
- `handlebars` or `ejs` npm package - Template rendering (may be present)
- `sanitize-html` npm package - HTML sanitization
- Existing HTML/CSS framework for professional styling

### Implementation Complexity

**Estimate:**
- Lines of code: 1500-2000 new code
- Files to create/modify: 8-10 files
- Dev time: 100-130 hours
- Testing: 30-40 hours (25+ test suites)
- Legal review: 15-20 hours
- Total: 145-190 hours

**Testing Complexity:**
- Report generation with varying data volumes (small/medium/large reports)
- All format exports (HTML, PDF, Markdown, JSON)
- Sensitive data redaction (verify email/phone/card removal)
- Section inclusion/exclusion (all permutations)
- Performance under load (report generation <30s)
- Digital signature verification
- Template rendering (no broken links, correct formatting)
- Annotation functionality

**Risk Areas:**
- PDF generation performance and file size
- Handling large screenshots and network captures
- Template formatting for professional appearance
- Sensitive data redaction edge cases
- Legal review requirements per jurisdiction

### Technical Dependencies

**Must be done before:**
- Nothing critical; this is final aggregation

**Blocks:**
- Nothing; this depends on other features

**Parallelizable with:**
- All other features (aggregates their outputs)

### Use Cases

**Law Enforcement Digital Forensics:**  
Generate court-admissible forensic report documenting dark web investigation. Report includes all evidence, chain of custody, screenshots with annotations, and digital signatures proving integrity.

**Corporate Security Incident Response:**  
Create professional report documenting compromised employee account for compliance review and management briefing. Report includes technologies used, network forensics, timeline, and recommendations.

**OSINT Investigator:**  
Generate comprehensive report on fraudulent website investigation documenting technologies, suspicious patterns, evidence of deception, and supporting screenshots.

**Legal Team:**  
Use report in civil litigation as evidence of competitor website structure/content on specific date, with cryptographic proof of integrity and chain of custody.

**Competitive Advantage:**
- Unified report format (all data in one document)
- Professional formatting (suitable for legal submission)
- Multiple export formats (flexibility for different audiences)
- Digital signatures (legal chain of custody)
- Annotation capability (highlight suspicious elements)

---

## Prioritization Matrix

### Impact & Effort Scoring

| Feature | Impact (1-10) | Effort (1-10) | Priority Score | Recommendation |
|---------|---------------|---------------|-----------------|-----------------|
| Session Coherence Validation | 9 | 7 | **1.29** | **DO FIRST** |
| Multi-Layer Technology Fingerprinting | 8 | 8 | 1.00 | 2ND |
| Forensic Evidence Packaging | 9 | 9 | 1.00 | 2ND |
| Real-Time Behavioral Coherence | 8 | 9 | 0.89 | 3RD |
| Multi-Session Change Detection | 7 | 8 | 0.88 | 4TH |
| Investigation Report Generation | 8 | 8 | 1.00 | 2ND-TIE |

**Scoring Rationale:**
- **Impact:** How much value to users (1=minimal, 10=critical)
  - Session Coherence: 9 (foundation for all evasion)
  - Tech Detection: 8 (standard OSINT capability)
  - Evidence Packaging: 9 (legal/compliance critical)
  - Behavioral Scoring: 8 (advanced evasion feedback)
  - Change Detection: 7 (monitoring, not baseline)
  - Reports: 8 (consolidation, not new capability)

- **Effort:** Development + testing complexity (1=trivial, 10=very hard)
  - Session Coherence: 7 (50% complete, integration work)
  - Tech Detection: 8 (40% complete, signature expansion)
  - Evidence Packaging: 9 (legal requirements, RFC 3161)
  - Behavioral Scoring: 9 (12 dimensions, real-time)
  - Change Detection: 8 (visual diffs, snapshots)
  - Reports: 8 (multiple formats, aggregation)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3, 240-300 hours)
**Focus:** Critical path dependencies - Session Coherence + Tech Detection

1. **Session Coherence Validation** (60-80h)
   - Complete 5-layer validation framework
   - Integrate with WebSocket handlers
   - Deploy and validate

2. **Multi-Layer Technology Fingerprinting** (80-100h)
   - Expand signature database to 500+ technologies
   - Optimize detection performance
   - Deploy and validate

**Deliverables:**
- Session coherence scoring in real-time
- Technology detection for 500+ technologies
- WebSocket API for both features
- Comprehensive test suites (60+ tests)

### Phase 2: Evidence & Analysis (Weeks 4-6, 240-300 hours)
**Focus:** Forensic capabilities + behavioral analysis

3. **Forensic Evidence Packaging** (120-150h)
   - Complete evidence aggregation
   - RFC 3161 timestamp integration
   - Chain of custody implementation

4. **Real-Time Behavioral Coherence Scoring** (100-130h)
   - 12-dimension behavioral analysis
   - Real-time scoring engine
   - Anomaly detection

**Deliverables:**
- Evidence packages with chain of custody
- Behavioral scoring with real-time updates
- RFC 3161 timestamp tokens
- WebSocket API for both features

### Phase 3: Monitoring & Reporting (Weeks 7-9, 220-290 hours)
**Focus:** Change detection + comprehensive reporting

5. **Multi-Session Change Detection** (90-120h)
   - Change detection across sessions
   - Visual diff generation
   - Timeline aggregation

6. **Investigation Report Generation** (100-130h)
   - Unified report generation
   - Multiple export formats
   - Professional formatting

**Deliverables:**
- Change timeline with visual diffs
- Professional investigation reports
- Multiple export formats (HTML, PDF, JSON, Markdown)
- Complete WebSocket API coverage

---

## Resource Allocation Estimate

### Development Hours by Feature

| Feature | Engineering | QA | Integration | Total |
|---------|-------------|-----|-------------|-------|
| Session Coherence | 60-80h | 35-45h | 15-20h | 110-145h |
| Tech Fingerprinting | 80-100h | 30-40h | 15-20h | 125-160h |
| Evidence Packaging | 120-150h | 40-50h | 20-30h | 180-230h |
| Behavioral Scoring | 100-130h | 50-60h | 15-20h | 165-210h |
| Change Detection | 90-120h | 40-50h | 15-20h | 145-190h |
| Report Generation | 100-130h | 30-40h | 15-20h | 145-190h |
| **TOTAL** | **550-710h** | **225-285h** | **95-130h** | **870-1125h** |

### Team Composition (Recommended)

- **2 Backend Engineers** (Session Coherence + Behavioral Scoring)
- **1 Backend Engineer** (Tech Detection + Evidence Packaging)
- **1 Backend/Full-Stack Engineer** (Change Detection + Reports)
- **1 QA Engineer** (All features, test suite development)
- **0.5 Product/Integration Engineer** (WebSocket API, cross-feature integration)

### Timeline (Realistic Estimates)

**Aggressive:** 12-14 weeks with 3-4 engineers
**Normal:** 16-20 weeks with 2-3 engineers
**Conservative:** 20-24 weeks with 2 engineers

---

## Dependency Graph

```
Session Coherence Validation (FOUNDATION)
├── Must complete before:
│   ├── Real-Time Behavioral Coherence (depends on clean coherence baseline)
│   └── Multi-Session Change Detection (needs coherence validation)
├── Blocks: Real-Time Behavioral Coherence
├── Parallelizable with: Tech Detection, Evidence Packaging
└── Risk: Medium (50% complete, integration work)

Multi-Layer Technology Fingerprinting
├── Must complete before:
│   └── Investigation Report Generation (tech detection in reports)
├── Blocks: None
├── Parallelizable with: All features
└── Risk: Low-Medium (40% complete, signature expansion)

Forensic Evidence Packaging
├── Must complete before:
│   └── Investigation Report Generation (reports reference packages)
├── Blocks: None
├── Parallelizable with: All features
└── Risk: High (legal/compliance complexity, RFC 3161)

Real-Time Behavioral Coherence Scoring
├── Must complete before:
│   └── Investigation Report Generation (behavioral metrics in reports)
├── Blocks: None
├── Depends on: Session Coherence Validation (complete first)
├── Parallelizable with: Tech Detection, Evidence Packaging, Change Detection
└── Risk: Medium-High (12 dimensions, real-time performance)

Multi-Session Change Detection
├── Must complete before: Investigation Report Generation
├── Blocks: None
├── Depends on: Session Coherence Validation
├── Parallelizable with: Tech Detection, Evidence Packaging, Behavioral Scoring
└── Risk: Medium (visual diffs, snapshot management)

Investigation Report Generation
├── Depends on:
│   ├── Tech Fingerprinting (tech section)
│   ├── Evidence Packaging (evidence section)
│   ├── Behavioral Scoring (behavioral metrics)
│   └── Change Detection (timeline section)
├── Blocks: None
├── Parallelizable with: Others (aggregates their outputs)
└── Risk: Low-Medium (template/formatting focus)
```

---

## Risk Assessment

### High Risk Areas

1. **RFC 3161 Integration (Evidence Packaging)**
   - External dependency on timestamp authority
   - Potential cost/availability issues
   - Mitigation: Research providers upfront, implement fallback

2. **Real-Time Performance (Behavioral Scoring)**
   - 12 dimensions updated every 500ms
   - Risk of browser lag
   - Mitigation: Aggressive optimization, load testing early

3. **Legal Compliance (Evidence Packaging)**
   - Different requirements per jurisdiction
   - Chain of custody standards vary
   - Mitigation: Legal review per target market

### Medium Risk Areas

1. **Signature Database Maintenance (Tech Detection)**
   - 500+ signatures need continuous updates
   - Mitigation: Automated validation pipeline

2. **Visual Diff Generation (Change Detection)**
   - Expensive image processing operation
   - Memory usage with large screenshots
   - Mitigation: Async processing, compression

3. **False Positive Rate (Change Detection)**
   - Legitimate ad/tracking changes shouldn't trigger
   - Mitigation: Sensitivity levels, exclusion filters

### Low Risk Areas

1. **Report Template Generation (Reports)**
   - Well-established technology
   - Multiple libraries available
   - Mitigation: Prototyping in week 1

---

## Success Metrics

### v12.1.0 Release Targets

**Session Coherence:**
- ✓ All 5 layers validating correctly
- ✓ Coherence score accurate ±3 points
- ✓ <1ms validation overhead
- ✓ 100+ concurrent sessions supported

**Tech Fingerprinting:**
- ✓ 95%+ detection accuracy on public OSINT targets
- ✓ <100ms detection time per page
- ✓ 500+ technology signatures
- ✓ <3% false positive rate

**Evidence Packaging:**
- ✓ RFC 3161 timestamps integrated
- ✓ Chain of custody tracking working
- ✓ 70-90% compression achieved
- ✓ ISO 27037 compliance documented

**Behavioral Coherence:**
- ✓ 12 dimensions scoring in real-time
- ✓ <500ms score update latency
- ✓ Anomaly detection <2 seconds
- ✓ Correlation with actual detection systems validated

**Change Detection:**
- ✓ 95%+ detection accuracy
- ✓ <2 second change detection
- ✓ Visual diffs generating correctly
- ✓ 10+ concurrent monitoring sessions

**Report Generation:**
- ✓ All sections generating
- ✓ <30 second generation time
- ✓ PDF/HTML/JSON formats working
- ✓ Professional formatting approved

---

## Conclusion

These six features address critical gaps in the OSINT/forensics market and leverage significant existing implementation (40-50% on average). The prioritized roadmap balances:

1. **Foundation First:** Session Coherence is prerequisite for clean evasion
2. **Legal Compliance:** Evidence Packaging requires careful implementation
3. **Advanced Capabilities:** Behavioral Scoring and Change Detection differentiate from competitors
4. **Professional Polish:** Report Generation provides user-facing value

**Total Effort:** 870-1125 developer hours across 9-20 weeks depending on team size and parallelization.

**Expected Outcome:** v12.1.0 release with industry-leading OSINT + forensics capabilities, legal-grade evidence handling, and real-time behavioral analysis.
