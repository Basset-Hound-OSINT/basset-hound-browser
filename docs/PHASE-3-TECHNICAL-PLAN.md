# Basset Hound Browser Phase 3 - Technical Implementation Plan
**Status:** Pre-Implementation  
**Target Version:** 12.0.0  
**Baseline:** v11.3.0 architecture

---

## Architecture Overview

Phase 3 maintains v11.3.0's core principles while extending capability domains:

```
┌─────────────────────────────────────────────────────────┐
│              External AI Agents (palletai)              │
│  Intelligence • Decision Making • Workflow Orchestration │
└────────────────────┬────────────────────────────────────┘
                     │
              ┌──────┴─────────────────┐
              │                        │
         MCP Server            WebSocket API
         (Enhanced with          (164→200+ commands)
         streaming, context)        │
              │                      │
┌─────────────▼──────────────────────▼──────────────────────┐
│         BASSET HOUND BROWSER v12.0.0                       │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Track 1: Workflow Automation                        │  │
│  │ ├─ Workflow Engine (conditions, loops, parallel)   │  │
│  │ ├─ Intelligent Waits (multi-selector, network)     │  │
│  │ ├─ Form Intelligence (dependencies, async)         │  │
│  │ └─ Pagination Intelligence (auto-discovery)        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Track 2: Detection Evasion (92-96% target)          │  │
│  │ ├─ Dynamic Fingerprinting (rotation, evolution)    │  │
│  │ ├─ Behavioral Consistency (cross-modal)            │  │
│  │ ├─ ML-Based Evasion (adversarial generation)       │  │
│  │ └─ TLS Mitigation (JA3 analysis, proxy guides)     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Track 3: Performance & Scalability                  │  │
│  │ ├─ Memory Optimization (200MB → 80MB)              │  │
│  │ ├─ Extraction Performance (2-5s → 500ms)           │  │
│  │ ├─ Screenshot Optimization (<100ms, <500KB)        │  │
│  │ └─ Concurrent Operations (10 → 50-100 pages)       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Track 4: Integration & Expansion                    │  │
│  │ ├─ MCP Enhancement (streaming, context, progress)  │  │
│  │ ├─ palletai Integration (predictions, feedback)    │  │
│  │ ├─ External Connectors (DB, API, webhooks)         │  │
│  │ └─ Feature Expansion (recording, forensics)        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Shared Infrastructure                              │  │
│  │ ├─ Electron Main Process (optimized)              │  │
│  │ ├─ WebSocket Server (v11.3.0 + enhancements)      │  │
│  │ ├─ Event System (pub/sub for tracking)            │  │
│  │ └─ Logging & Monitoring (performance metrics)      │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
                        ┌────────────┐
                        │ Web Pages  │
                        └────────────┘
```

---

## 1. WORKFLOW AUTOMATION TRACK

### 1.1 Workflow Engine Architecture

#### File Structure:
```
src/automation/
├── workflow-engine.js       (400 lines) - Core execution engine
├── workflow-validator.js    (150 lines) - Syntax/semantic validation
├── workflow-parser.js       (150 lines) - JSON → AST parsing
├── context-manager.js       (100 lines) - Variable/state management
├── step-executor.js         (200 lines) - Individual step execution
└── error-handler.js         (100 lines) - Error recovery
```

#### Core Design Pattern:

```javascript
class WorkflowEngine {
  // Workflow: { steps: [...], variables: {...}, errorHandling: "..." }
  
  async execute(workflow, context = {}) {
    // 1. Validate workflow
    const validation = this.validate(workflow);
    if (!validation.valid) throw new ValidationError(validation.errors);
    
    // 2. Initialize context
    const ctx = new ExecutionContext(context, workflow.variables);
    
    // 3. Execute steps as state machine
    const state = { currentStep: 0, status: "running", results: [] };
    
    while (state.currentStep < workflow.steps.length) {
      const step = workflow.steps[state.currentStep];
      const substituted = this.substituteVariables(step, ctx);
      
      try {
        const result = await this.executeStep(substituted, ctx);
        ctx.setVariable(`_step_${state.currentStep}_result`, result);
        state.results.push({ step: state.currentStep, success: true, result });
      } catch (error) {
        const recovery = this.handleError(step, error, ctx);
        if (recovery.action === "retry") {
          // Exponential backoff retry
          state.currentStep--; // Re-execute this step
        } else if (recovery.action === "skip") {
          // Skip to next
        } else if (recovery.action === "jump") {
          state.currentStep = recovery.targetStep;
        } else {
          throw error; // Fatal
        }
      }
      
      state.currentStep++;
    }
    
    return { success: true, results: state.results };
  }
  
  async executeStep(step, ctx) {
    switch (step.action) {
      case "navigate":
        return await this.browser.navigate(step.url);
      
      case "click":
        return await this.browser.click(step.selector);
      
      case "fill":
        return await this.browser.fill(step.selector, step.value);
      
      case "wait_for_element":
        return await this.browser.waitForElement(step.selector, step.timeout);
      
      case "if_element_exists":
        const exists = await this.browser.elementExists(step.selector);
        const branch = exists ? step.then : step.else;
        return await this.executeBranch(branch, ctx);
      
      case "loop":
        const results = [];
        for (let i = 0; i < step.count; i++) {
          ctx.setVariable("_loop_index", i);
          results.push(await this.executeBranch(step.body, ctx));
        }
        return results;
      
      case "parallel":
        return await Promise.all(
          step.steps.map(s => this.executeStep(s, ctx))
        );
      
      case "extract":
        return await this.browser.extract(step.template);
      
      // ... more actions
    }
  }
}
```

#### WebSocket Commands (8 commands):

```javascript
// Create workflow
{
  "command": "create_workflow",
  "name": "investigation_flow",
  "workflow": { "steps": [...] },
  "description": "Multi-step investigation"
}

// Execute workflow
{
  "command": "execute_workflow",
  "name": "investigation_flow",
  "variables": { "query": "...", "page_limit": 5 }
}

// Pause/Resume
{
  "command": "pause_workflow",
  "execution_id": "..."
}

// Get status
{
  "command": "get_workflow_status",
  "execution_id": "..."
}
```

#### Testing Strategy:

```javascript
// tests/unit/workflow-engine.test.js

describe("Workflow Engine", () => {
  describe("Step Execution", () => {
    test("should execute navigate step", async () => {
      const engine = new WorkflowEngine(mockBrowser);
      const workflow = {
        steps: [
          { action: "navigate", url: "https://example.com" }
        ]
      };
      const result = await engine.execute(workflow);
      expect(result.success).toBe(true);
    });
    
    test("should handle conditional branching", async () => {
      const workflow = {
        steps: [
          {
            action: "if_element_exists",
            selector: ".captcha",
            then: [{ action: "pause", reason: "CAPTCHA detected" }],
            else: [{ action: "click", selector: ".submit" }]
          }
        ]
      };
      // Verify correct branch executed
    });
    
    test("should support loops", async () => {
      const workflow = {
        steps: [
          {
            action: "loop",
            count: 3,
            body: [
              { action: "click", selector: ".next_button" },
              { action: "extract", template: "items" }
            ]
          }
        ]
      };
      // Verify loop executed 3 times
    });
  });
  
  describe("Error Handling", () => {
    test("should retry failed steps", async () => {
      // Verify exponential backoff
    });
    
    test("should support conditional recovery", async () => {
      // Verify error handlers
    });
  });
  
  describe("Variables", () => {
    test("should substitute variables in steps", async () => {
      const workflow = {
        steps: [{ action: "navigate", url: "${search_url}" }]
      };
      // Verify substitution
    });
  });
});
```

---

### 1.2 Intelligent Wait Strategies

#### File Structure:
```
src/automation/
├── wait-strategies.js       (200 lines) - All wait implementations
├── performance-observer.js  (100 lines) - Web Vitals monitoring
├── dom-observer.js          (100 lines) - DOM stability detection
└── network-monitor.js       (100 lines) - Network idle detection
```

#### Implementation:

```javascript
class WaitStrategies {
  // Wait for ANY of N selectors (first match wins)
  async waitForAnySelectorOf(selectors, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        const element = await this.browser.querySelectorInPage(selector);
        if (element) return { matched: selector, element };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new TimeoutError(`None of ${selectors.length} selectors appeared`);
  }
  
  // Wait for DOM to stop changing
  async waitForDOMStable(quietDuration = 500, timeout = 30000) {
    const observer = new MutationObserver(() => {
      observer.lastChangeTime = Date.now();
    });
    
    observer.lastChangeTime = Date.now();
    observer.observe(document, { subtree: true, childList: true, attributes: true });
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (Date.now() - observer.lastChangeTime >= quietDuration) {
        observer.disconnect();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new TimeoutError(`DOM did not stabilize within ${timeout}ms`);
  }
  
  // Wait for network idle
  async waitForNetworkIdle(idleDuration = 1000, timeout = 30000) {
    return new Promise((resolve, reject) => {
      let activeRequests = 0;
      let idleTimer = null;
      const startTime = Date.now();
      
      const checkIdle = () => {
        if (activeRequests === 0) {
          if (!idleTimer) {
            idleTimer = setTimeout(() => resolve(), idleDuration);
          }
        } else {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      };
      
      // Monitor fetch/XHR
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        activeRequests++;
        checkIdle();
        return originalFetch.apply(this, args)
          .then(response => {
            activeRequests--;
            checkIdle();
            return response;
          })
          .catch(error => {
            activeRequests--;
            checkIdle();
            throw error;
          });
      };
      
      const timeoutHandle = setTimeout(
        () => reject(new TimeoutError(`Network idle timeout after ${timeout}ms`)),
        timeout
      );
    });
  }
  
  // Wait for performance metrics
  async waitForPerformanceMetric(metric, threshold, timeout = 30000) {
    // metric = "LCP" | "FCP" | "CLS"
    // LCP < 2.5s, FCP < 1.8s, CLS < 0.1
    
    return new Promise((resolve, reject) => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === metric && entry.value < threshold) {
            resolve(entry);
          }
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      
      setTimeout(
        () => reject(new TimeoutError(`${metric} not met within ${timeout}ms`)),
        timeout
      );
    });
  }
}
```

---

## 2. DETECTION EVASION TRACK

### 2.1 Dynamic Fingerprint Rotation

#### File Structure:
```
src/evasion/
├── dynamic-fingerprint.js    (300 lines) - Aging, rotation, evolution
├── fingerprint-evolution.js  (200 lines) - Realistic drift patterns
├── hardware-simulator.js     (150 lines) - Simulated upgrades
└── profile-retirement.js     (100 lines) - Retire old profiles
```

#### Core Algorithm:

```javascript
class DynamicFingerprinting {
  constructor(baseProfile) {
    this.baseProfile = baseProfile;
    this.interactionCount = 0;
    this.profileAge = 0;
    this.retirementThreshold = 100; // interactions before retire
    this.driftPercentRange = [0.01, 0.02]; // 1-2% drift per interaction
  }
  
  async evolveFingerprint() {
    // 1. Check if profile needs retirement
    if (this.interactionCount >= this.retirementThreshold) {
      return this.retireAndCreateNew();
    }
    
    // 2. Apply realistic drift to fingerprint
    const driftAmount = Math.random() * 
      (this.driftPercentRange[1] - this.driftPercentRange[0]) + 
      this.driftPercentRange[0];
    
    const evolved = this.applyDrift(this.baseProfile, driftAmount);
    
    // 3. Simulate "hardware upgrade" every N interactions
    if (this.interactionCount > 0 && this.interactionCount % 50 === 0) {
      evolved.gpu = this.simulateHardwareUpgrade(evolved.gpu);
      evolved.chromeVersion = this.nextRealisticChromeVersion(evolved.chromeVersion);
    }
    
    // 4. Validate coherence with behavioral profile
    this.validateBehavioralCoherence(evolved);
    
    this.interactionCount++;
    this.profileAge++;
    
    return evolved;
  }
  
  simulateHardwareUpgrade(currentGpu) {
    // Simulate realistic GPU upgrade: same vendor, slightly newer model
    // Example: "ANGLE (Intel HD Graphics 630)" → "ANGLE (Intel Iris Plus Graphics)"
    
    const upgrades = {
      "Intel HD Graphics 630": "Intel Iris Graphics 650",
      "NVIDIA GeForce GTX 1080": "NVIDIA GeForce RTX 2080",
      "AMD Radeon RX 580": "AMD Radeon RX 5700 XT"
    };
    
    return upgrades[currentGpu] || currentGpu;
  }
  
  nextRealisticChromeVersion(currentVersion) {
    // Chrome versions increment by ~1 every month
    // Don't jump too far ahead
    const current = parseInt(currentVersion.split('.')[0]);
    const jump = Math.random() > 0.7 ? 1 : 0;
    return `${current + jump}.0.0.0`;
  }
  
  validateBehavioralCoherence(fingerprint) {
    // Ensure fingerprint changes align with behavioral profile
    // e.g., if typing is slow, WebGL changes should be subtle
    
    const coherenceScore = this.calculateCoherence(
      fingerprint,
      this.behavioralProfile
    );
    
    if (coherenceScore < 0.8) {
      // Adjust fingerprint to improve coherence
      return this.rebalanceFingerprint(fingerprint, this.behavioralProfile);
    }
  }
  
  retireAndCreateNew() {
    // Fingerprint too old, retire it and create new profile
    const newProfile = this.generateNewProfile();
    this.baseProfile = newProfile;
    this.interactionCount = 0;
    this.profileAge = 0;
    return newProfile;
  }
}
```

#### Ensemble Detection Prevention:

```javascript
class EnsembleDetectionEvasion {
  // Prevent multiple detection vectors from "agreeing" on bot status
  
  analyzeEnsembleAlignment(fingerprints) {
    // fingerprints = { canvas: score, webgl: score, audio: score, ... }
    
    const consensusLevel = Math.max(...Object.values(fingerprints));
    
    if (consensusLevel > 0.85) {
      // Too many signals agreeing on "bot", redistribute scores
      return this.spreadDetectionSignals(fingerprints);
    }
    
    return fingerprints;
  }
  
  spreadDetectionSignals(fingerprints) {
    // Make some signals weaker to prevent consensus
    // If canvas is 0.9 and webgl is 0.88, weaken canvas
    
    const targets = Object.entries(fingerprints)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    const weakened = { ...fingerprints };
    for (const [key, value] of targets) {
      weakened[key] = value * 0.75; // Reduce top signals
    }
    
    return weakened;
  }
}
```

---

### 2.2 Behavioral Consistency Framework

#### File Structure:
```
src/evasion/
├── behavioral-consistency.js (250 lines) - Coherence enforcement
├── typing-coherence.js       (100 lines) - Typing speed consistency
├── mouse-coherence.js        (100 lines) - Mouse movement consistency
└── fatigue-simulator.js      (100 lines) - Session fatigue modeling
```

#### Coherence Validation:

```javascript
class BehavioralConsistency {
  validateProfile(profile) {
    // profile = { typingSpeed: 45wpm, mouseSpeed: "medium", errorRate: 0.03 }
    
    const violations = [];
    
    // Rule 1: Typing speed should correlate with mouse speed
    if (profile.typingSpeed > 60 && profile.mouseSpeed === "slow") {
      violations.push("Fast typist should move mouse quickly");
    }
    
    // Rule 2: Error rate should be consistent across all text input
    const errorRates = [
      profile.passwordErrorRate,
      profile.searchErrorRate,
      profile.commentErrorRate
    ];
    
    const variance = Math.max(...errorRates) - Math.min(...errorRates);
    if (variance > 0.02) {
      violations.push("Error rates too inconsistent");
    }
    
    // Rule 3: Decision time should increase with complexity
    const readingTimes = {
      simple: profile.readingTimeSimple,      // < 1s
      moderate: profile.readingTimeMedium,    // 1-3s
      complex: profile.readingTimeComplex     // 3-10s
    };
    
    if (readingTimes.simple > readingTimes.complex) {
      violations.push("Reading times illogical (simple takes longer than complex)");
    }
    
    return {
      valid: violations.length === 0,
      violations,
      coherenceScore: this.calculateScore(profile)
    };
  }
  
  enforceCoherence(profile) {
    // Adjust profile to satisfy all constraints
    
    // If mouse is slow, typing should be slow too
    if (profile.mouseSpeed === "slow" && profile.typingSpeed > 50) {
      profile.typingSpeed = 40;
    }
    
    // If error rate is high, should be consistently high
    const avgErrorRate = (profile.passwordErrorRate + 
                          profile.searchErrorRate + 
                          profile.commentErrorRate) / 3;
    
    profile.passwordErrorRate = avgErrorRate;
    profile.searchErrorRate = avgErrorRate;
    profile.commentErrorRate = avgErrorRate;
    
    return profile;
  }
}
```

---

### 2.3 ML-Based Detection Evasion

#### File Structure:
```
src/evasion/
├── adversarial-fingerprinting.js  (250 lines) - Adversarial generation
├── ml-detector-models.js           (200 lines) - Detection model simulation
├── feature-importance.js           (150 lines) - Understand what matters
└── multi-classifier-targeting.js   (100 lines) - Fool multiple models
```

#### Adversarial Fingerprint Generation:

```javascript
class AdversarialFingerprinting {
  // Use gradient-based methods to find fingerprints that fool ML models
  
  async generateEvasiveFingerprint(targetService, constraints) {
    // targetService = "datadome" | "perimetrex" | "cloudflare"
    // constraints = { typing_speed_percentile: 65, canvas_noise: [0.02, 0.05] }
    
    const model = this.loadDetectionModel(targetService);
    let fingerprint = this.generateRandomFingerprint(constraints);
    
    // Gradient-based optimization loop
    for (let iteration = 0; iteration < 100; iteration++) {
      // 1. Evaluate current fingerprint
      const score = model.predictBotProbability(fingerprint);
      
      if (score < 0.1) {
        // Evasion successful!
        return { fingerprint, botScore: score, iterations: iteration };
      }
      
      // 2. Compute gradients
      const gradients = this.computeGradients(model, fingerprint);
      
      // 3. Update fingerprint in direction of lower bot score
      fingerprint = this.updateFingerprint(fingerprint, gradients, constraints);
    }
    
    throw new Error("Could not generate evasive fingerprint");
  }
  
  computeGradients(model, fingerprint) {
    // For each feature, compute ∂(botScore)/∂(feature)
    // Negative gradient = direction to lower bot score
    
    const epsilon = 0.001;
    const gradients = {};
    
    const baseScore = model.predictBotProbability(fingerprint);
    
    for (const [feature, value] of Object.entries(fingerprint)) {
      const perturbed = { ...fingerprint, [feature]: value + epsilon };
      const perturbedScore = model.predictBotProbability(perturbed);
      
      gradients[feature] = (perturbedScore - baseScore) / epsilon;
    }
    
    return gradients;
  }
  
  updateFingerprint(fingerprint, gradients, constraints) {
    // Move in direction of negative gradient (lower bot score)
    const learningRate = 0.1;
    const updated = { ...fingerprint };
    
    for (const [feature, gradient] of Object.entries(gradients)) {
      const direction = gradient > 0 ? -1 : 1; // Opposite of gradient
      const newValue = fingerprint[feature] + (direction * learningRate * Math.abs(gradient));
      
      // Clamp to constraints
      if (constraints[feature]) {
        const [min, max] = constraints[feature];
        updated[feature] = Math.max(min, Math.min(max, newValue));
      }
    }
    
    return updated;
  }
}
```

---

## 3. PERFORMANCE TRACK

### 3.1 Memory Optimization

#### Analysis Phase (Manual):
1. Profile baseline memory usage
2. Identify largest allocations
3. Find long-lived objects
4. Detect circular references

#### Lazy Loading System:

```javascript
class LazyLoader {
  constructor() {
    this.loaded = new Set();
    this.modules = {
      'recording': () => require('../recording/interaction-recorder'),
      'forensics': () => require('../forensics/forensics-suite'),
      'proxy': () => require('../proxy/manager'),
      'tor': () => require('../proxy/tor-advanced'),
      // ...
    };
  }
  
  async require(moduleName) {
    if (!this.loaded.has(moduleName)) {
      const module = this.modules[moduleName];
      if (!module) throw new Error(`Unknown module: ${moduleName}`);
      
      const loaded = await module();
      this.loaded.add(moduleName);
      this[moduleName] = loaded;
    }
    
    return this[moduleName];
  }
  
  // Features register themselves for lazy loading
  registerModule(name, loader) {
    this.modules[name] = loader;
  }
}

// In main.js
const lazyLoader = new LazyLoader();
global.requireFeature = (name) => lazyLoader.require(name);
```

#### Event Listener Cleanup:

```javascript
class PageLifecycleManager {
  onPageDestroy(page) {
    // Clean up all event listeners
    page.removeAllListeners();
    
    // Clear references
    page.content = null;
    page.domSnapshot = null;
    page.networkHAR = null;
    
    // Unsubscribe from pub/sub events
    if (page.subscriptions) {
      page.subscriptions.forEach(sub => sub.unsubscribe());
      page.subscriptions.clear();
    }
    
    // Clear caches
    if (page.domCache) page.domCache.clear();
    if (page.selectorCache) page.selectorCache.clear();
  }
}
```

---

### 3.2 Content Extraction Performance

#### DOM Caching:

```javascript
class DOMCache {
  constructor(page) {
    this.page = page;
    this.treeCache = null;
    this.lastUpdateTime = Date.now();
    this.cacheVersion = 0;
  }
  
  async getTree(force = false) {
    if (!this.treeCache || force) {
      // Build tree from scratch
      this.treeCache = await this.page.evaluateFunction(() => {
        return this.buildTree(document.documentElement);
      });
      this.cacheVersion++;
    }
    
    return this.treeCache;
  }
  
  invalidateCache() {
    // Called on DOM mutations
    this.treeCache = null;
  }
  
  async querySelector(selector) {
    // Instead of re-traversing DOM, use indexed tree
    const tree = await this.getTree();
    return this.searchTree(tree, selector);
  }
}

// Use ElementIndex for O(1) lookups
class ElementIndex {
  constructor() {
    this.idMap = new Map();
    this.classList = new Map();
  }
  
  addElement(element) {
    if (element.id) this.idMap.set(element.id, element);
    for (const cls of element.classList) {
      if (!this.classList.has(cls)) this.classList.set(cls, []);
      this.classList.get(cls).push(element);
    }
  }
  
  querySelector(selector) {
    // If selector is #id or .class, use index (O(1))
    if (selector.startsWith('#')) {
      return this.idMap.get(selector.slice(1));
    }
    if (selector.startsWith('.')) {
      return this.classList.get(selector.slice(1))?.[0];
    }
    // Fall back to normal traversal for complex selectors
    return document.querySelector(selector);
  }
}
```

---

## 4. INTEGRATION TRACK

### 4.1 MCP Server Enhancement

#### Context Persistence:

```javascript
// mcp/context-manager.js

class ContextManager {
  constructor() {
    this.agents = new Map(); // agentId → context
  }
  
  getContext(agentId) {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        sessionId: generateId(),
        variables: {},
        history: [],
        startTime: Date.now()
      });
    }
    
    return this.agents.get(agentId);
  }
  
  setState(agentId, key, value) {
    const ctx = this.getContext(agentId);
    ctx.variables[key] = value;
    ctx.lastUpdate = Date.now();
  }
  
  recordAction(agentId, action, result) {
    const ctx = this.getContext(agentId);
    ctx.history.push({
      timestamp: Date.now(),
      action,
      result,
      duration: Date.now() - (ctx.lastActionTime || Date.now())
    });
    ctx.lastActionTime = Date.now();
  }
  
  cleanup(agentId) {
    this.agents.delete(agentId);
  }
}
```

#### Streaming Results:

```python
# mcp/server.py - FastMCP server

@server.tool()
async def browser_extract_large_page(
    selector: str,
    chunk_size: int = 100
) -> str:
    """Extract elements with streaming for large pages"""
    
    all_elements = await browser.query_selector_all(selector)
    
    for i in range(0, len(all_elements), chunk_size):
        chunk = all_elements[i:i+chunk_size]
        
        # Stream chunk as JSON Lines
        yield {
            "type": "chunk",
            "index": i,
            "count": len(chunk),
            "elements": chunk,
            "progress": f"{i+len(chunk)}/{len(all_elements)}"
        }
    
    yield {"type": "complete", "total": len(all_elements)}
```

---

## Testing Strategy

### Unit Tests (Per Component)
- 50+ tests per major module
- Mock WebSocket, Electron APIs
- Edge case coverage
- Error recovery testing

### Integration Tests
- Workflow + Wait strategies
- Evasion modules + Behavioral consistency
- Performance under load
- MCP + Agent communication

### End-to-End Tests
- Real website workflows
- Detection service evasion validation
- Memory profiling
- Long-running stability tests

### Performance Benchmarks
- Extract: target <500ms for large pages
- Screenshot: target <100ms
- Memory: target 80MB baseline
- Throughput: target 100+ operations/sec

---

## Development Guidelines

### Code Quality
- ESLint strict mode
- JSDoc comments on public methods
- Unit test coverage >85%
- Performance profiling for >100ms operations

### Backward Compatibility
- v11.3.0 API fully supported
- Deprecation warnings for changed APIs
- Migration guide for major changes
- Staged rollout over 2 releases

### Monitoring & Metrics
- Prometheus metrics for all major operations
- Distributed tracing for workflows
- Memory leak detection
- Performance regression detection

---

## Deployment Strategy

### Staged Rollout
1. **Beta (Week 13):** Ship to beta users, gather feedback
2. **RC (Week 14):** Release candidate, final testing
3. **Stable (Week 15):** Full production release

### Rollback Plan
- Keep v11.3.0 available
- Quick rollback if critical issues found
- Database migrations if needed

### Documentation
- API changes documented
- Migration guide for integrators
- Performance benchmarks published
- Example workflows provided

---

*This technical plan serves as the detailed implementation guide for Phase 3 engineers.*
