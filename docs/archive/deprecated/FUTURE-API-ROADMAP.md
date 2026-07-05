# Basset Hound Browser API Roadmap

**Document Version:** 1.0  
**Last Updated:** June 20, 2026  
**Current Version:** v12.7.0 (164+ WebSocket commands)  
**Status:** API evolution planning  
**Audience:** Integrators, API users, architecture decision-makers

---

## Executive Summary

Basset Hound Browser currently provides a **comprehensive WebSocket API** with 164+ commands covering navigation, interaction, content extraction, and evasion. The API roadmap outlines evolution across three timeframes:

1. **Current (v12.7.0):** WebSocket API production-ready with full capabilities
2. **Medium-term (v12.8-v13.2):** Direct REST/HTTP endpoints for simplified integration
3. **Long-term (v13.5+):** Session-centric API supporting persistence, streaming, and collaboration

---

## PART 1: CURRENT API STATUS

### v12.7.0 API Overview

**Protocol:** WebSocket (ws://localhost:8765)  
**Format:** JSON request/response  
**Total Commands:** 164 (including v12.7.0 additions)

**Command Categories:**

| Category | Count | Examples |
|----------|-------|----------|
| Navigation | 6 | navigate, go_back, go_forward, reload, get_page_state |
| Interaction | 12 | click, fill, type, scroll, hover, wait_for_element |
| Extraction | 18 | get_content, get_links, get_images, get_forms, get_cookies |
| Screenshots | 5 | screenshot, screenshot_element, screenshot_full_page |
| JavaScript | 6 | execute_script, inject_script, capture_console_logs |
| Credentials | 8 | totp_generate, hotp_generate, backup_code_validate *(v12.7.0)* |
| Sessions | 6 | create_session, switch_session, persist_session *(v12.7.0)* |
| Evasion | 15 | set_user_agent, apply_fingerprint, enable_behavioral_ai *(v12.7.0)* |
| Monitoring | 8 | get_metrics, stream_metrics, alert_on_condition *(v12.7.0)* |
| Other | 80+ | proxies, headers, network analysis, plugins, recording, etc. |

### Current Strengths

1. **Comprehensive:** Covers 95% of browser automation needs
2. **Rich Data:** Returns detailed context (element selectors, timing, metadata)
3. **Flexible:** Supports both imperative (do X) and declarative (assert Y) patterns
4. **Production-Ready:** 100% test pass rate, 1.15% memory usage, <2ms P99 latency
5. **Extensible:** Plugin system allows custom commands

### Current Limitations

1. **WebSocket Only:** No REST/HTTP for simple use cases
2. **Client Library Friction:** Requires WebSocket client (ws/Socket.io)
3. **Verbose:** Request/response structure can be boilerplate-heavy
4. **Single Connection:** One WebSocket per session (no request-response model)
5. **No SDK:** Limited built-in client libraries beyond JavaScript

---

## PART 2: MEDIUM-TERM API EVOLUTION (6-12 MONTHS)

### Phase 1: REST/HTTP Gateway (Months 1-3)

**Goal:** Provide simple HTTP endpoints for common operations while preserving WebSocket API

**Architecture:**

```
┌─────────────────────────────────────────┐
│ HTTP REST Gateway Layer                 │
│ ├─ Route /api/v1/* → WebSocket pool    │
│ ├─ Connection pooling (reuse WebSocket) │
│ └─ Request/response translation         │
└─────────────────────────────────────────┘
            │
            │ Uses underlying
            ▼
┌─────────────────────────────────────────┐
│ Existing WebSocket API (unchanged)      │
│ ├─ 164+ commands                        │
│ └─ Full functionality preserved         │
└─────────────────────────────────────────┘
```

#### REST Endpoint Design

**Principle:** Simplify 80% use case, preserve WebSocket for complex cases

```
# Navigation
POST /api/v1/navigate
{
  "url": "https://example.com",
  "waitUntil": "networkidle2",
  "timeout": 30000
}

# Interaction
POST /api/v1/click
{
  "selector": "button.submit",
  "timeout": 5000
}

POST /api/v1/fill
{
  "selector": "input[name=email]",
  "text": "user@example.com"
}

# Extraction
GET /api/v1/content

POST /api/v1/screenshot
{
  "fullPage": true,
  "format": "png"
}

# Session Management
POST /api/v1/session
{ "name": "session_1" }

GET /api/v1/session/{id}

DELETE /api/v1/session/{id}

# Batch Operations
POST /api/v1/batch
{
  "operations": [
    { "command": "navigate", "url": "..." },
    { "command": "click", "selector": "..." },
    { "command": "screenshot" }
  ]
}
```

**Benefits:**
- Familiar REST paradigm (no WebSocket knowledge required)
- HTTP client available in every language
- Stateless operations (for simple cases)
- Compatible with API gateways, load balancers, CDNs

**Implementation Effort:** 500-800 LOC

#### Client Libraries (Months 2-3)

**JavaScript/TypeScript:**

```javascript
import { BrowserSession } from 'basset-hound';

const session = new BrowserSession('http://localhost:8765');

// Simple API
await session.navigate('https://example.com');
await session.click('button.search');
await session.fill('input#search', 'python');
await session.wait({ selector: '.results', timeout: 5000 });

const screenshot = await session.screenshot();
const content = await session.getContent();

// Close session
await session.close();
```

**Python:**

```python
from basset_hound import BrowserSession

async with BrowserSession('http://localhost:8765') as session:
    await session.navigate('https://example.com')
    await session.click('button.search')
    await session.fill('input#search', 'python')
    
    screenshot = await session.screenshot()
    content = await session.get_content()
    
    # Automatic cleanup on context exit
```

**Go:**

```go
package main

import (
    "github.com/basset-hound/go-client"
)

func main() {
    session := client.NewSession("http://localhost:8765")
    defer session.Close()
    
    session.Navigate("https://example.com")
    session.Click("button.search")
    session.Fill("input#search", "python")
    
    screenshot := session.Screenshot()
    // ... process result
}
```

**CLI Tool:**

```bash
# Navigate and screenshot
basset navigate https://example.com \
  click button.search \
  fill 'input#search' python \
  wait '.results' 5000 \
  screenshot output.png

# Batch operations from file
basset batch script.json --output results.json

# Session management
basset session create my_session
basset session list
basset session delete my_session
```

**Implementation Effort:** 1,500-2,500 LOC total

### Phase 2: Enhanced Error Handling (Months 2-4)

**Goal:** Robust error recovery with clear recovery strategies

#### Error Response Format (Enhanced)

```json
{
  "success": false,
  "error": "Element not found: button.submit",
  "errorCode": "SELECTOR_NOT_FOUND",
  "context": {
    "selector": "button.submit",
    "pageUrl": "https://example.com/form",
    "visibleElements": 45
  },
  "recovery": {
    "suggestions": [
      "Element might not have loaded. Try increasing timeout.",
      "Selector might have changed. Try: button[type=submit]",
      "Page might be showing error state. Check for alert dialogs."
    ],
    "alternativeCommands": [
      {
        "command": "click",
        "selector": "button[type='submit']",
        "description": "Try button with type attribute"
      },
      {
        "command": "wait_for_element",
        "selector": "button.submit",
        "timeout": 10000,
        "description": "Wait longer for element to appear"
      },
      {
        "command": "screenshot",
        "description": "Take screenshot to debug current state"
      }
    ],
    "isRetryable": true,
    "recommendedBackoff": "exponential",
    "maxRetries": 3
  }
}
```

#### Bot Detection Response

```json
{
  "success": false,
  "error": "Bot detection triggered",
  "errorCode": "BOT_DETECTED",
  "detection": {
    "type": "HTTP_403",
    "confidence": 0.95,
    "triggers": [
      "cloudflare_challenge_detected",
      "rate_limit_headers",
      "bot_detection_signature"
    ]
  },
  "recovery": {
    "options": [
      {
        "strategy": "rotate_user_agent",
        "description": "Try different user agent"
      },
      {
        "strategy": "rotate_proxy",
        "description": "Use different IP address"
      },
      {
        "strategy": "increase_delay",
        "description": "Add delays between requests"
      },
      {
        "strategy": "manual_intervention",
        "description": "Requires human CAPTCHA solving"
      }
    ],
    "recommendedStrategy": "rotate_proxy",
    "automationAvailable": true
  }
}
```

#### CAPTCHA Detection & Routing

```json
{
  "success": false,
  "error": "CAPTCHA detected on page",
  "errorCode": "CAPTCHA_PRESENT",
  "captcha": {
    "type": "recaptcha_v3",
    "position": { "x": 100, "y": 200 },
    "visible": true
  },
  "recovery": {
    "options": [
      {
        "service": "2captcha",
        "cost": 0.003,
        "description": "External CAPTCHA solving"
      },
      {
        "service": "manual",
        "description": "Pause and request user intervention"
      },
      {
        "service": "bypass_technique",
        "description": "Try alternative navigation path"
      }
    ]
  }
}
```

**Implementation Effort:** 1,000-1,500 LOC

### Phase 3: Optional Frontend (Months 4-6) - EXPERIMENTAL

**Status:** Optional, not required for production  
**Decision Point:** After customer research

#### Frontend Architecture

**Architecture Decision:** Web-based (React/Vue) vs. Electron

```javascript
// Web-based frontend (React)
// Pros:
// - Accessible from any browser
// - Lightweight deployment
// - Cross-platform automatically
// Cons:
// - Complex deployment and auth
// - Harder to access local resources

// Electron-based (desktop app)
// Pros:
// - Native OS integration
// - Local access easy
// - Single deployment artifact
// Cons:
// - Larger download (~200MB)
// - OS-specific builds needed
```

**Recommendation:** Start with Web-based MVP, migrate to Electron if needed

#### Frontend Components

**1. Session Monitor**

```jsx
<SessionMonitor sessionId="session_123">
  <ScreenshotViewer 
    source="ws://server/session/123/stream" 
    fps={2}
  />
  <StepHistory 
    steps={steps}
    onRollback={handleRollback}
  />
  <PerformanceMetrics 
    metrics={metrics}
  />
</SessionMonitor>
```

Features:
- Real-time screenshot streaming
- Step history with ability to jump to any point
- Performance metrics dashboard
- Network activity monitoring
- Error and alert notifications

**2. Script Builder**

```jsx
<ScriptBuilder sessionId="session_123">
  <InteractionRecorder 
    onStepRecorded={addStep}
  />
  <ScriptEditor 
    language="javascript"
    code={generatedCode}
    onChange={updateCode}
  />
  <ScriptTester 
    testCases={testCases}
    onValidate={validateScript}
  />
</ScriptBuilder>
```

Features:
- Record interactions and auto-generate code
- Edit generated code
- Test on sample data
- Export to multiple formats (JS, Python, YAML)
- Syntax highlighting and validation

**3. Batch Operations Dashboard**

```jsx
<BatchDashboard>
  <JobList 
    jobs={jobs}
    onCancel={cancelJob}
  />
  <ProgressChart 
    data={progressData}
  />
  <ResultsTable 
    results={results}
    exportable={true}
  />
</BatchDashboard>
```

Features:
- View job queue and progress
- Cancel jobs if needed
- See results and aggregate statistics
- Export results to CSV/JSON

**Implementation Effort:** 500-1,500 LOC (experimental MVP)

---

## PART 3: LONG-TERM API VISION (12+ MONTHS)

### Session-Centric API

**Concept:** Move from command-centric to session-centric paradigm

**Current API (Command-Centric):**
```
Request: { command: 'click', selector: 'button' }
Response: { success: true }
```

**Future API (Session-Centric):**
```
Session Object:
├─ Properties: id, status, createdAt, user
├─ Methods: navigate(), click(), fill(), screenshot()
├─ Events: onStep, onError, onComplete
└─ Persistence: save(), resume(), rollback()

Usage:
const session = await Session.create();
await session.navigate('https://example.com');
await session.click('button.search');
const result = await session.screenshot();
await session.save();  // Persist for later
```

### Streaming API

**Live Session Events:**

```javascript
const session = await Session.load('session_12345');

// Subscribe to live events
session.on('action', (action) => {
  console.log('User action:', action.type, action.selector);
  ui.updateStepHistory(action);
});

session.on('screenshot', (image) => {
  ui.updateScreenshot(image);
});

session.on('error', (error) => {
  ui.showAlert('Error: ' + error.message);
});

session.on('complete', (result) => {
  console.log('Session completed:', result);
});

// Connect to live stream
await session.startStreaming();
```

### Persistence API

```javascript
// Save session for later
const session = await Session.create();
await session.navigate('https://example.com');
// ... do stuff ...
await session.pause({ reason: 'Will resume tomorrow' });

// Load and resume next day
const session = await Session.load('session_12345');
console.log('Session status:', session.status);  // 'paused'
await session.resume();
// Continue from where we left off
```

### Script Generation API

```javascript
const session = await Session.load('session_12345');

// Generate script from recording
const script = await session.generateScript({
  language: 'python',
  format: 'async',
  validate: true
});

// Test generated script
const testResult = await script.test({
  testCases: [
    { input: 'data1', expectedOutput: 'result1' }
  ]
});

console.log('Accuracy:', testResult.passRate);  // 0.9

// Export
const code = script.export('python');
console.log(code);
```

### Multi-Session Orchestration API

```javascript
const pool = new SessionPool({ maxConcurrent: 50 });

const jobs = websites.map(w => ({
  name: `monitor_${w.id}`,
  script: 'scripts/monitor.js',
  input: { url: w.url }
}));

const results = await pool.executeBatch(jobs, {
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} complete`);
  },
  parallelism: 50,
  retryFailures: true,
  maxRetries: 3
});
```

### Collaborative API

```javascript
const session = await Session.load('session_12345');

// Share with other users
await session.share({
  users: ['bob@example.com'],
  permissions: 'view'  // or 'control'
});

// Track who did what
const history = await session.getAuditTrail();
history.forEach(event => {
  console.log(`${event.user} ${event.action} at ${event.timestamp}`);
});

// Multi-user control with locking
await session.acquireLock({ reason: 'Fixing selector' });
try {
  await session.click('new.selector');
} finally {
  await session.releaseLock();
}
```

---

## PART 4: BACKWARDS COMPATIBILITY STRATEGY

### Principle: Additive Evolution

All API changes follow this principle:

```
v12.7.0 (current)
   ├─ WebSocket API (164 commands) - PRESERVED
   │   └─ All commands remain functional
   │
v12.8 (HTTP gateway)
   ├─ WebSocket API - PRESERVED
   └─ REST API - NEW
     └─ Can coexist on same server
     └─ Can be used simultaneously
     └─ Gateway translates to WebSocket internally

v13.0 (session-centric)
   ├─ WebSocket API - PRESERVED (backwards compat mode)
   ├─ REST API - PRESERVED
   └─ Session API - NEW
     └─ Higher-level abstraction
     └─ Built on top of existing commands
     └─ Old API still works

v14.0 (streaming + persistence)
   └─ All previous APIs preserved
   └─ Streaming only adds new channels
   └─ Persistence is optional feature
```

### Migration Path for Users

**Phase 1 (v12.7 → v12.8):**
- No changes required if using WebSocket API
- Can optionally migrate to REST API
- Both protocols work in parallel

**Phase 2 (v12.8 → v13.0):**
- Old API continues to work
- Can optionally use higher-level Session API
- Gradual migration possible

**Phase 3 (v13.0 → v14.0):**
- Streaming is opt-in (activate on session)
- Persistence is opt-in (call .save())
- Legacy code unaffected

### Version Support Timeline

| Version | Release | Support Until | Notes |
|---------|---------|---------------|-------|
| v12.7 | Jun 2026 | Jun 2028 | Extended support |
| v12.8 | Aug 2026 | Aug 2027 | Stable |
| v13.0 | Nov 2026 | Nov 2027 | Recommended |
| v13.5 | Jan 2027 | Jan 2028 | Latest stable |
| v14.0 | Jul 2027 | Jul 2028 | Current |

**Support Policy:**
- Critical security fixes: All versions (2 years)
- Non-critical bugs: Current version + 1 previous
- New features: Current version only
- Deprecations: 6-month notice, 12-month support

---

## PART 5: ADOPTION TIMELINE & MILESTONES

### Quarterly Milestones

**Q3 2026 (Jul-Sep):**
- [ ] v12.8.0 released (DOM snapshot extraction)
- [ ] REST gateway v1 complete
- [ ] JavaScript client library stable
- [ ] Customer feedback on API simplification

**Q4 2026 (Oct-Dec):**
- [ ] Python client library released
- [ ] Error handling enhancements deployed
- [ ] Connective Sessions research prototype
- [ ] Frontend MVP (if approved)

**Q1 2027 (Jan-Mar):**
- [ ] Session API v1 (persistence + streaming)
- [ ] Go client library released
- [ ] CLI tool stable
- [ ] Load testing at 50+ concurrent sessions

**Q2 2027 (Apr-Jun):**
- [ ] Script generation MVP
- [ ] Multi-session orchestration API
- [ ] Enterprise documentation
- [ ] API stability certification (99.99% uptime)

**Q3 2027 (Jul-Sep):**
- [ ] v15.0.0 released (multi-user collaboration)
- [ ] Full Connective Sessions feature complete
- [ ] Performance certified at scale (100+ sessions)
- [ ] Customer advisory board feedback

---

## PART 6: SUCCESS CRITERIA & METRICS

### API Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Adoption** | 50% REST usage by Q2 2027 | Analytics from API gateway |
| **Time to First API Call** | <5 minutes | Developer onboarding survey |
| **Code Sample Clarity** | 4.5/5 rating | Doc feedback |
| **Error Recovery Rate** | >90% auto-recovery | Production error logs |
| **SDK Quality** | >95% test coverage | CI/CD metrics |
| **Documentation** | 0 unanswered FAQ | Support ticket analysis |
| **Breaking Changes** | 0 in 18 months | Changelog audit |
| **API Latency** | <100ms P99 | Monitoring data |

### Documentation Maturity

| Phase | Deliverables |
|-------|--------------|
| **Now (v12.7)** | API reference, command catalog, basic examples |
| **REST Gateway** | REST endpoint reference, client library docs, migration guide |
| **Session API** | Session object reference, persistence guide, recipes |
| **Streaming** | Real-time API reference, streaming architecture, examples |
| **Maturity** | Comprehensive API handbook, 100+ recipes, interactive tutorials |

---

## PART 7: RISK ASSESSMENT

### API Evolution Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Breaking changes alienate users** | HIGH | Strict backwards compatibility policy |
| **REST gateway becomes bottleneck** | MEDIUM | Connection pooling; distributed deployment option |
| **Session persistence doesn't scale** | MEDIUM | Database sharding strategy; S3 archival |
| **Script generation too fragile** | MEDIUM | Validation & user review required; fallback to manual |
| **Streaming bandwidth overwhelming** | MEDIUM | Diff compression; adaptive quality; opt-in feature |
| **Multi-user complexity | MEDIUM | Early security review; extensive testing; staged rollout |

### Technical Debt Prevention

- **Maintain API versioning discipline:** No mixed v1 + v2 code
- **Deprecation warnings:** 6-month notice before removal
- **Regular API audits:** Quarterly review for consistency
- **User feedback loops:** Integrate customer requests systematically
- **Performance budgets:** Monitoring to catch regressions

---

## CONCLUSION

The Basset Hound Browser API roadmap balances:
- **Stability:** WebSocket API preserved and production-ready
- **Simplification:** REST/HTTP endpoints for common cases (v12.8)
- **Innovation:** Session-centric paradigm (v13.5+)
- **Scalability:** Multi-session and multi-user support (v14.0+)

By following this roadmap, Basset Hound evolves from a developer tool to an interactive, collaborative automation platform while maintaining strict backwards compatibility.

---

**Document Status:** READY FOR IMPLEMENTATION  
**Next Review:** August 31, 2026 (v12.8 completion)  
**Feedback:** Accepted via GitHub issues, product@basset-hound.dev

