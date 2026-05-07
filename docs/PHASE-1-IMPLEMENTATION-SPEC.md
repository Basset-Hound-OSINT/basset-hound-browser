# Basset Hound v11.3.0 - Phase 1 Implementation Specification

**Date:** May 7, 2026  
**Target Release:** Mid-July 2026 (8 weeks)  
**Focus:** OSINT-ready with forensic capabilities

---

## Phase 1 Overview

Phase 1 consists of 4 concurrent development tracks:

1. **Tech Detection Module** - Website technology fingerprinting
2. **Behavioral Simulator** - Human-like interaction patterns
3. **Device Fingerprinter** - Authentic device profiles
4. **Testing Framework** - Real-world validation

All four components are independent and can be developed in parallel.

---

## Track 1: Website Technology Detection (Weeks 1-3)

### Module: `src/analysis/tech-detector.js`

**Purpose:** Identify technologies, frameworks, CMS, servers, and platforms running on target websites

**Dependencies:**
- Existing `src/analysis/site-analyzer.js` (extends this)
- Signature database (new)
- HTTP header parsing utilities

**Core Methods:**

```javascript
class TechDetector {
  // Initialize with signature database
  constructor(signatureDatabase)
  
  // Main detection method
  async detectTechnologies(pageData, networkRequests, headers)
  // Returns: { technologies: [...], confidence: 0-100, raw_evidence: {...} }
  
  // Detection strategies
  async detectByHeaders(headers)
  async detectByDOM(html, dom)
  async detectByJavaScript(scripts, resources)
  async detectByDOM(faviconHash)
  async detectByCertificate(tlsCertificate)
  async detectByDNS(dnsRecords)
  
  // Score and confidence calculation
  calculateConfidence(detectionMethod, matches)
}
```

**Detection Strategies:**

1. **HTTP Headers Analysis**
   - `Server: Apache/2.4.41`
   - `X-Powered-By: Express`
   - `X-AspNet-Version`
   - CDN headers (CloudFlare, Akamai, etc.)
   - Custom headers (framework-specific)

2. **JavaScript Library Detection**
   - Loaded script URLs (jQuery, React, Vue, Angular)
   - Window object properties (Stripe, Google Analytics)
   - Global variables and functions
   - CSS frameworks (Bootstrap, Tailwind)

3. **DOM/HTML Analysis**
   - Meta tags (generator, framework)
   - Comment patterns
   - CSS/JS file names
   - HTML structure patterns

4. **Favicon Hash Matching**
   - MD5/SHA-256 of favicon.ico
   - Database of known favicon hashes
   - Cross-reference with known platforms

5. **SSL/TLS Certificate Analysis**
   - Organization name from certificate
   - Subject alternative names (subdomains)
   - Certificate issuer hints

6. **DNS Analysis**
   - A/AAAA records
   - CNAME analysis (CDN/hosting provider)
   - MX records (email provider)
   - TXT records (SPF, DKIM, verification)

**Signature Database Format:**

```json
{
  "technologies": {
    "1": {
      "name": "React",
      "category": "JavaScript Framework",
      "website": "https://react.dev",
      "tags": ["ui-library", "javascript"],
      "headers": {},
      "js": {
        "patterns": ["React.version", "ReactDOM"]
      },
      "html": {
        "patterns": ["data-react-root"]
      },
      "scriptUrls": [
        "react\\..*\\.js"
      ],
      "confidenceJavaScript": 100
    },
    "2": {
      "name": "Express",
      "category": "Web Framework",
      "headers": {
        "Server": "Express"
      },
      "confidence": 100
    }
  }
}
```

**WebSocket Commands:**

```javascript
{
  "command": "detect_technologies",
  "parameters": {
    "includeRawEvidence": true,  // Return matching patterns
    "minConfidence": 50,          // Filter low-confidence detections
    "categories": ["cms", "web-framework", "analytics"]  // Optional filter
  }
}

// Response:
{
  "success": true,
  "technologies": [
    {
      "name": "WordPress",
      "category": "CMS",
      "confidence": 95,
      "evidence": [
        { "type": "header", "value": "X-Powered-By: WordPress 6.2" },
        { "type": "html_comment", "value": "WordPress 6.2" },
        { "type": "js_library", "value": "jquery-3.6.0.js" }
      ]
    },
    {
      "name": "CloudFlare",
      "category": "CDN",
      "confidence": 100,
      "evidence": [
        { "type": "header", "value": "CF-Ray: xxx" },
        { "type": "header", "value": "Server: cloudflare" }
      ]
    }
  ],
  "timestamp": "2026-05-07T12:00:00Z",
  "detectionTime": 1250  // milliseconds
}
```

**Deliverables:**

- [ ] `src/analysis/tech-detector.js` (400 lines)
- [ ] `data/technology-signatures.json` (1000+ signatures)
- [ ] Updated `src/analysis/site-analyzer.js` to call tech-detector
- [ ] WebSocket handler in `websocket/server.js`
- [ ] Unit tests: `tests/analysis/tech-detector.test.js` (15+ tests)
- [ ] Integration tests with real websites
- [ ] Performance tests (<2s per site detection)

**Success Criteria:**

- [ ] Detects 95%+ of major technologies in signature database
- [ ] <5% false positive rate on random websites
- [ ] <2 second detection time per site
- [ ] Confidence scores reflect actual detection reliability

---

## Track 2: Behavioral Pattern Simulator (Weeks 2-4)

### Module: `src/evasion/behavioral-simulator.js`

**Purpose:** Generate human-like interaction patterns to avoid behavioral detection

**Dependencies:**
- Ghost Cursor library (npm: `ghost-cursor`)
- Faker.js for realistic data
- Existing WebSocket command handlers

**Core Methods:**

```javascript
class BehavioralSimulator {
  constructor(options)
  
  // Pattern application
  async simulateMouseMovement(startPos, endPos)
  // Returns: { path: [...], duration, events: [...] }
  
  async simulateTyping(text, typingSpeed = 'normal')
  // Returns: { keystrokes: [...], duration, timings: [...] }
  
  async simulateScrolling(distance, scrollSpeed = 'normal')
  // Returns: { scrollEvents: [...], duration, mouseMovement: {...} }
  
  async simulatePause(durationRange)
  // Returns: { duration, reason: 'thinking|reading|processing' }
  
  // Pattern presets
  getMousePatterns()           // ["smooth", "erratic", "precise", "lazy"]
  getTypingPatterns()          // ["consistent", "variable", "fast", "slow"]
  getScrollPatterns()          // ["smooth", "jerky", "natural"]
  
  // Verification
  verifyBehaviorPlausibility(events)
  // Returns: { plausibility: 0-100, anomalies: [...] }
}
```

**Pattern Database:**

```javascript
const patterns = {
  mouse: {
    smooth: {
      curveType: 'ease-in-out',
      speedVariation: 0.1,  // 10% variation
      jerkinessReduction: 0.95
    },
    erratic: {
      curveType: 'linear',
      speedVariation: 0.4,
      jerkinessReduction: 0.7
    },
    precise: {
      curveType: 'ease-out',
      speedVariation: 0.05,
      jerkinessReduction: 0.99
    }
  },
  typing: {
    consistent: {
      wpm: 60,
      wpmVariation: 5,
      errorRate: 0.01
    },
    variable: {
      wpm: 50,
      wpmVariation: 20,
      errorRate: 0.02
    },
    fast: {
      wpm: 80,
      wpmVariation: 10,
      errorRate: 0.01
    }
  },
  scroll: {
    smooth: {
      acceleration: 0.2,
      duration: 500,
      pauseFrequency: 0.3
    },
    jerky: {
      acceleration: 0.5,
      duration: 300,
      pauseFrequency: 0.6
    }
  }
};
```

**WebSocket Commands:**

```javascript
{
  "command": "set_behavioral_pattern",
  "parameters": {
    "mouse": "smooth",
    "typing": "variable",
    "scroll": "natural",
    "pauseStyle": "reading"
  }
}

{
  "command": "enable_behavioral_evasion",
  "parameters": {
    "enabled": true,
    "patterns": "auto"  // Auto-select based on target site
  }
}

{
  "command": "get_behavior_metrics",
  "parameters": {}
}

// Response:
{
  "success": true,
  "metrics": {
    "currentPattern": "smooth",
    "plausibility": 98,
    "anomalies": [],
    "estimatedDetectionRisk": "low"
  }
}
```

**Integration Points:**

- Mouse movement interception (replace direct clicks)
- Keyboard input timing simulation
- Scroll event generation
- Apply to WebSocket commands: `click`, `type`, `scroll`, `navigate`

**Deliverables:**

- [ ] `src/evasion/behavioral-simulator.js` (500 lines)
- [ ] Pattern database (integrated into module)
- [ ] Ghost Cursor library integration
- [ ] WebSocket handlers for behavior commands
- [ ] Integration with existing click/type/scroll commands
- [ ] Unit tests: `tests/evasion/behavioral-simulator.test.js` (20+ tests)
- [ ] Validation against detection services
- [ ] Performance tests (minimal overhead)

**Success Criteria:**

- [ ] 90%+ pass rate against behavioral detection systems
- [ ] Patterns pass visual inspection as human-like
- [ ] <10% CPU overhead from pattern generation
- [ ] <50ms latency for pattern generation

---

## Track 3: Device Fingerprinter (Weeks 3-4)

### Module: `src/evasion/device-fingerprinter.js`

**Purpose:** Apply authentic device fingerprints preventing detection as impossible combination

**Dependencies:**
- Device profile database (new)
- UserAgent library for UA parsing/generation
- Existing fingerprint spoofing code

**Device Profile Database:**

```json
{
  "profiles": [
    {
      "id": "1",
      "name": "iPhone 13 Pro - Safari",
      "hardware": {
        "vendor": "Apple",
        "model": "iPhone13,3",
        "device": "iPhone"
      },
      "os": {
        "name": "iOS",
        "version": "15.6.1"
      },
      "browser": {
        "name": "Safari",
        "version": "15.6.1"
      },
      "screen": {
        "width": 1170,
        "height": 2532,
        "colorDepth": 32,
        "devicePixelRatio": 3
      },
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6_1 like Mac OS X)...",
      "pluginsString": "",
      "fonts": ["Arial", "Times New Roman", "Courier New"],
      "timezone": "America/Los_Angeles",
      "language": "en-US",
      "hardwareConcurrency": 6,
      "maxTouchPoints": 5,
      "webglVendor": "Apple",
      "webglRenderer": "Apple A15 Bionic"
    },
    {
      "id": "2",
      "name": "Windows 11 - Chrome",
      "hardware": {
        "vendor": "Intel",
        "model": "Core i7-12700K"
      },
      "os": {
        "name": "Windows",
        "version": "11"
      },
      "browser": {
        "name": "Chrome",
        "version": "114.0.0.0"
      },
      "screen": {
        "width": 1920,
        "height": 1080,
        "colorDepth": 32,
        "devicePixelRatio": 1
      },
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "timezone": "America/New_York",
      "language": "en-US",
      "hardwareConcurrency": 12,
      "maxTouchPoints": 0,
      "webglVendor": "Google Inc.",
      "webglRenderer": "ANGLE (Intel HD Graphics 630)"
    }
  ]
}
```

**Core Methods:**

```javascript
class DeviceFingerprinter {
  constructor(profileDatabase)
  
  // Profile management
  getProfile(profileId)
  getRandomProfile()
  getProfilesByCategory(os, browser)
  
  // Apply fingerprint
  async applyFingerprint(profileId)
  // Modifies: UserAgent, screen size, plugins, fonts, WebGL, Canvas, etc.
  
  // Validation
  validateFingerprintConsistency()
  // Returns: { valid: boolean, issues: [...] }
  
  // Verification against detection sites
  async checkFingerprintAuthenticity()
  // Returns: { authentic: boolean, impossibilities: [...] }
}
```

**WebSocket Commands:**

```javascript
{
  "command": "set_device_profile",
  "parameters": {
    "profileId": "1",  // iPhone 13 Pro
    "randomizeMinors": true  // Randomize OS/browser patch versions
  }
}

{
  "command": "randomize_device",
  "parameters": {
    "category": "mobile",  // "mobile", "desktop", "tablet", "random"
    "os": null,           // Filter by OS, null = all
    "browser": "Chrome"   // Filter by browser, null = all
  }
}

{
  "command": "get_device_fingerprint",
  "parameters": {}
}

// Response:
{
  "success": true,
  "profile": {
    "name": "iPhone 13 Pro - Safari",
    "fingerprint": {
      "userAgent": "...",
      "screen": { "width": 1170, "height": 2532 },
      "devicePixelRatio": 3,
      "timezone": "America/Los_Angeles"
    },
    "authentication": {
      "passed": true,
      "passedSites": ["browserleaks.com", "2.pwnjs.com"],
      "issues": []
    }
  }
}
```

**Device Profile Source:**

- 50 iPhone/iPad profiles (iOS versions)
- 30 Android profiles (Samsung, Pixel, Xiaomi)
- 50+ Windows profiles (Windows 10/11, various Chrome/Edge versions)
- 30+ macOS profiles (various versions, Safari/Chrome)
- 10+ Linux profiles (Ubuntu, other distros)

**Total: 170+ authentic device profiles**

**Deliverables:**

- [ ] `src/evasion/device-fingerprinter.js` (350 lines)
- [ ] `data/device-profiles.json` (170+ profiles)
- [ ] Profile validation/curation script
- [ ] WebSocket handlers
- [ ] Integration with TOR_SERVER fingerprint spoofing
- [ ] Unit tests: `tests/evasion/device-fingerprinter.test.js` (15+ tests)
- [ ] Validation against fingerprinting sites
- [ ] Documentation on fingerprint authenticity

**Success Criteria:**

- [ ] All profiles pass fingerprinting validation sites
- [ ] No impossible OS/browser combinations
- [ ] Profile consistency across session lifetime
- [ ] Variety of authentic profiles covering major devices

---

## Track 4: Real-World Testing Framework (Weeks 4-5)

### Module: `tests/real-world/validation-framework.js`

**Purpose:** Validate OSINT capabilities against realistic benchmark scenarios

**Test Scenarios:**

```
tests/real-world/
├── scenarios/
│   ├── 01-tech-detection/
│   │   ├── wordpress-site.js
│   │   ├── react-app.js
│   │   ├── django-api.js
│   │   ├── static-site.js
│   │   └── cloudflare-protected.js
│   ├── 02-evasion/
│   │   ├── behavioral-detection.js
│   │   ├── fingerprint-validation.js
│   │   ├── rate-limiting.js
│   │   └── captcha-handling.js
│   ├── 03-forensics/
│   │   ├── screenshot-accuracy.js
│   │   ├── metadata-extraction.js
│   │   ├── session-recording.js
│   │   └── evidence-preservation.js
│   └── results/
│       └── YYYY-MM-DD_scenario_report.json
└── harness.js
```

**Scenario: Technology Detection**

```javascript
// tests/real-world/scenarios/01-tech-detection/wordpress-site.js
const scenario = {
  name: "WordPress Site Detection",
  target: "https://wordpress.com",  // or demo site
  expectedTechnologies: {
    "WordPress": { minConfidence: 90 },
    "PHP": { minConfidence: 80 },
    "jQuery": { minConfidence: 85 },
    "Apache": { minConfidence: 70 }
  },
  successCriteria: {
    correctDetections: 0.95,  // 95% accuracy
    falsePositives: 0.05,
    detectionTime: 2000  // milliseconds
  }
};
```

**Scenario: Evasion Effectiveness**

```javascript
// tests/real-world/scenarios/02-evasion/behavioral-detection.js
const scenario = {
  name: "Behavioral Detection Evasion",
  target: "https://bot-test.site",
  behaviors: [
    { type: "mouse_movement", pattern: "smooth" },
    { type: "typing", pattern: "variable" },
    { type: "scroll", pattern: "natural" },
    { type: "pause", duration: "human_like" }
  ],
  expectedResults: {
    detectedAsBot: false,
    humanlikeness: { min: 85 }
  }
};
```

**Scenario: Forensic Accuracy**

```javascript
// tests/real-world/scenarios/03-forensics/screenshot-accuracy.js
const scenario = {
  name: "Screenshot Accuracy and Quality",
  target: "https://example.com",
  actions: [
    { type: "navigate", url: target },
    { type: "screenshot", format: "png" }
  ],
  validation: {
    screenshotExists: true,
    fileSize: { min: 50000 },
    dimensions: { width: 1920, height: 1080 },
    contentPresent: true,
    ocr_text_extracted: true
  }
};
```

**Test Metrics Collection:**

```javascript
class MetricsCollector {
  // Collect metrics during test execution
  recordDetection(technology, confidence, evidence)
  recordEvasion(success, detectionType, pattern)
  recordPerformance(operation, duration)
  recordError(errorType, message)
  
  // Generate report
  generateReport()
  // Returns: JSON report with statistics, charts, recommendations
}
```

**Report Generation:**

```json
{
  "timestamp": "2026-05-07T12:00:00Z",
  "scenarios": [
    {
      "name": "WordPress Site Detection",
      "passed": true,
      "metrics": {
        "detectedTechnologies": 4,
        "expectedTechnologies": 4,
        "accuracy": 1.0,
        "falsePositives": 0,
        "averageConfidence": 88.5,
        "detectionTime": 1250
      },
      "results": "PASS"
    }
  ],
  "summary": {
    "totalScenarios": 10,
    "passedScenarios": 9,
    "failedScenarios": 1,
    "successRate": 0.9,
    "recommendations": [
      "Improve detection on dynamic sites",
      "Optimize detection speed for tech X"
    ]
  }
}
```

**Deliverables:**

- [ ] `tests/real-world/harness.js` (400 lines, test runner)
- [ ] `tests/real-world/scenarios/` (10+ scenario files)
- [ ] `tests/real-world/validators.js` (validation logic)
- [ ] `tests/real-world/metrics.js` (metrics collection)
- [ ] Benchmark site setup (public target URLs)
- [ ] Report generation templates
- [ ] Performance dashboard (optional web UI)
- [ ] Documentation on scenario creation

**Success Criteria:**

- [ ] 10+ realistic test scenarios
- [ ] Automated metric collection
- [ ] Clear pass/fail determination
- [ ] Actionable recommendations from failures
- [ ] Repeatable and consistent results

---

## Integration & Coordination

All four tracks must integrate into unified system:

```
WebSocket Server
├── Tech Detection Commands
│   └── detect_technologies, get_tech_cache
├── Behavioral Commands
│   └── set_behavioral_pattern, enable_behavioral_evasion
├── Device Commands
│   └── set_device_profile, randomize_device
└── Testing Commands
    └── run_validation_suite, get_test_results
```

**Integration Checklist:**

- [ ] All WebSocket commands documented
- [ ] Error handling consistent across modules
- [ ] Performance impact assessed
- [ ] Logging/debugging enabled
- [ ] Configuration options provided
- [ ] Documentation complete

---

## Testing & Quality Assurance

### Unit Tests
- [ ] Tech detector: 15+ tests (signatures, detection, confidence)
- [ ] Behavioral simulator: 20+ tests (patterns, validation, performance)
- [ ] Device fingerprinter: 15+ tests (profiles, consistency, validation)
- [ ] Total: 50+ unit tests

### Integration Tests
- [ ] Tech detection + site analyzer
- [ ] Behavioral evasion + click/type/scroll commands
- [ ] Device fingerprint + spoofing engine
- [ ] All modules with real browser

### Real-World Tests
- [ ] 10+ benchmark scenarios
- [ ] Validation against public detection sites
- [ ] Performance metrics collection
- [ ] Evasion effectiveness measurement

### Performance Tests
- [ ] Tech detection: <2s per site
- [ ] Behavioral pattern generation: <50ms
- [ ] Device fingerprint application: <100ms
- [ ] Memory overhead: <50MB

---

## Success Criteria Summary

| Aspect | Metric | Target |
|--------|--------|--------|
| **Tech Detection** | Accuracy | 95%+ |
| **Tech Detection** | False Positives | <5% |
| **Tech Detection** | Speed | <2s |
| **Behavioral Sim** | Detection Pass Rate | 90%+ |
| **Device FP** | Validation Pass Rate | 100% |
| **Device FP** | Impossible Combos | 0% |
| **Overall Coverage** | Test Scenarios | 10+ |
| **Code Quality** | Test Coverage | >85% |
| **Documentation** | Completeness | 100% |

---

## Timeline

```
Week 1-2: Tech Detection (Development + 80% testing)
Week 2-3: Behavioral Simulator (Development + testing)
Week 3-4: Device Fingerprinter (Development + testing)
Week 4-5: Testing Framework (Development + validation)
Week 5-6: Integration & Bug Fixes
Week 6-7: Performance Optimization
Week 7-8: Documentation & Release Prep

Milestones:
  Week 2: Tech Detection MVP
  Week 3: Behavioral Simulator MVP
  Week 4: Device Fingerprinter MVP
  Week 5: All components integrated
  Week 6: Performance targets met
  Week 7: Documentation complete
  Week 8: Release ready (v11.3.0-beta)
```

---

**Specification Status:** Ready for implementation  
**Next Step:** Begin development on Track 1 (Tech Detection)
