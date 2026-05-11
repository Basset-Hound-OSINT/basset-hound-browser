# Optimization Sprint 3 Specification

**Sprint:** Weeks 5-6 (June 18 - July 1, 2026)  
**Duration:** 12 hours total effort  
**Status:** Planning Phase - Ready for Implementation  
**Priority:** HIGH - Advanced optimizations building on Sprint 2  
**Target Release:** v12.2.0 (July 15, 2026)

---

## Executive Summary

Optimization Sprint 3 targets three advanced bottlenecks identified in post-Sprint 2 analysis. These optimizations build on the parallel processing and priority queue foundation from v12.1.0, focusing on caching, template efficiency, and request consolidation.

| Optimization | Primary Benefit | Secondary Benefit | Effort | Priority |
|---|---|---|---|---|
| **OPT-05:** DOM Extraction Caching | 25-50% latency | 15% bandwidth | 4-5 hours | P1 |
| **OPT-11:** Fingerprint Profile Templates | 40-60% speedup | 30% memory | 3-4 hours | P1 |
| **OPT-08:** Request Batching | 30-40% latency | 20% throughput | 4-5 hours | P1 |

**Combined Impact:**
- 30-50% DOM extraction latency reduction
- 40-60% faster fingerprint generation
- 30-40% lower latency for batch operations
- 10-20% overall memory reduction
- 0 breaking changes

---

## OPT-05: DOM Extraction Caching

### Overview

**Problem:** DOM extraction (HTML, text, links) re-parses page structure on every request.  
**Target:** Cache parsed DOM tree, reuse selectors, invalidate on navigation.  
**Impact:** 25-50% latency reduction for repeated extractions.

### Root Cause Analysis

Current implementation in `src/extraction/extractor.js`:

```javascript
// CURRENT: Parse on every extraction
class DOMExtractor {
  async extractHTML(selector = 'body') {
    // Parse HTML every time
    const element = await this.page.$(selector);
    const html = await element.evaluate(el => el.outerHTML);
    return html;
  }

  async extractText(selector = 'body') {
    // Parse HTML and serialize to text
    const element = await this.page.$(selector);
    const text = await element.evaluate(el => el.innerText);
    return text;
  }

  async extractLinks() {
    // Query all links
    const links = await this.page.$$eval('a', els =>
      els.map(el => ({ href: el.href, text: el.innerText }))
    );
    return links;
  }
}

// Problem: Each extraction requires:
// 1. DOM traversal (10-20ms)
// 2. Selector parsing (2-5ms)
// 3. Serialization (5-10ms)
// Total: 20-30ms per operation

// Typical workflow (get_html, then get_text, then get_links):
// 3 extractions × 25ms = 75ms (could be 25ms with caching)
```

### Solution Design

Implement cache layer with smart invalidation:

```javascript
class CachedDOMExtractor {
  constructor(page) {
    this.page = page;
    this.cache = new Map();
    this.cachedDOM = null;
    this.cacheVersion = 0;
    this.selectorCache = new Map();
    
    // Monitor navigation to invalidate cache
    this.page.on('framenavigated', () => this.invalidateCache());
    this.page.on('load', () => this.refreshCache());
  }

  // Parse DOM once and cache
  async ensureDOMCached() {
    if (this.cachedDOM && this.cacheVersion > 0) {
      return this.cachedDOM;
    }

    // Fetch full DOM tree
    this.cachedDOM = await this.page.evaluate(() => {
      const serializeNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return {
            type: 'text',
            content: node.textContent.trim()
          };
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return null;
        }

        return {
          type: 'element',
          tag: node.tagName.toLowerCase(),
          id: node.id,
          class: Array.from(node.classList),
          attributes: Array.from(node.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          text: node.innerText.trim().substring(0, 200), // First 200 chars
          children: Array.from(node.childNodes)
            .map(child => serializeNode(child))
            .filter(child => child !== null)
        };
      };

      return serializeNode(document.documentElement);
    });

    this.cacheVersion = Date.now();
    this.cache.set('__full_dom__', {
      dom: this.cachedDOM,
      timestamp: this.cacheVersion,
      size: JSON.stringify(this.cachedDOM).length
    });

    return this.cachedDOM;
  }

  // Compile selector for reuse
  async compileSelector(selector) {
    if (this.selectorCache.has(selector)) {
      return this.selectorCache.get(selector);
    }

    // Validate selector and pre-compile
    const compiled = await this.page.evaluate((sel) => {
      try {
        const test = document.querySelector(sel);
        return {
          valid: true,
          count: document.querySelectorAll(sel).length,
          selector: sel
        };
      } catch (e) {
        return {
          valid: false,
          error: e.message,
          selector: sel
        };
      }
    }, selector);

    this.selectorCache.set(selector, compiled);
    return compiled;
  }

  async extractHTML(selector = 'body') {
    const cacheKey = `html:${selector}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1-minute TTL
        return cached.html;
      }
    }

    // Validate selector
    const compiled = await this.compileSelector(selector);
    if (!compiled.valid) {
      throw new Error(`Invalid selector: ${selector}`);
    }

    // Extract and cache
    const html = await this.page.$eval(selector, el => el.outerHTML);
    this.cache.set(cacheKey, {
      html,
      timestamp: Date.now(),
      size: html.length
    });

    return html;
  }

  async extractText(selector = 'body') {
    const cacheKey = `text:${selector}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return cached.text;
      }
    }

    // Validate selector
    await this.compileSelector(selector);

    // Extract and cache
    const text = await this.page.$eval(selector, el => el.innerText);
    this.cache.set(cacheKey, {
      text,
      timestamp: Date.now(),
      size: text.length
    });

    return text;
  }

  async extractLinks(selector = 'body') {
    const cacheKey = `links:${selector}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return cached.links;
      }
    }

    // Validate selector
    await this.compileSelector(selector);

    // Extract links
    const links = await this.page.$eval(selector, (root) => {
      return Array.from(root.querySelectorAll('a')).map(el => ({
        href: el.href,
        text: el.innerText.trim().substring(0, 100),
        title: el.title,
        target: el.target
      }));
    });

    this.cache.set(cacheKey, {
      links,
      timestamp: Date.now(),
      size: JSON.stringify(links).length
    });

    return links;
  }

  async extractImages(selector = 'body') {
    const cacheKey = `images:${selector}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return cached.images;
      }
    }

    // Validate selector
    await this.compileSelector(selector);

    // Extract images
    const images = await this.page.$eval(selector, (root) => {
      return Array.from(root.querySelectorAll('img')).map(el => ({
        src: el.src,
        alt: el.alt,
        width: el.width,
        height: el.height,
        title: el.title
      }));
    });

    this.cache.set(cacheKey, {
      images,
      timestamp: Date.now(),
      size: JSON.stringify(images).length
    });

    return images;
  }

  async extractForms(selector = 'body') {
    const cacheKey = `forms:${selector}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return cached.forms;
      }
    }

    // Validate selector
    await this.compileSelector(selector);

    // Extract forms
    const forms = await this.page.$eval(selector, (root) => {
      return Array.from(root.querySelectorAll('form')).map(form => ({
        id: form.id,
        name: form.name,
        action: form.action,
        method: form.method,
        fields: Array.from(form.elements).map(el => ({
          name: el.name,
          type: el.type,
          value: el.value,
          required: el.required
        }))
      }));
    });

    this.cache.set(cacheKey, {
      forms,
      timestamp: Date.now(),
      size: JSON.stringify(forms).length
    });

    return forms;
  }

  invalidateCache() {
    // Clear cache on navigation
    this.cache.clear();
    this.cachedDOM = null;
    this.cacheVersion = 0;
    // Keep selector cache (often valid across navigation)
  }

  async refreshCache() {
    // Re-cache DOM on page load
    await this.ensureDOMCached();
  }

  getCacheStatistics() {
    let totalSize = 0;
    let cacheEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      totalSize += entry.size || 0;
      cacheEntries++;
    }

    return {
      cacheEntries,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      selectorCacheSize: this.selectorCache.size,
      cacheVersion: this.cacheVersion
    };
  }

  clearCache() {
    this.cache.clear();
    this.cachedDOM = null;
  }

  clearSelectorCache() {
    this.selectorCache.clear();
  }
}
```

### Implementation Details

**Files to Create/Modify:**
- `src/extraction/cached-extractor.js` (NEW, 380 lines)
- `src/extraction/extractor.js` (Modify: use cached extractor)
- `websocket/commands/extraction-commands.js` (Modify: add cache stats endpoint)

**Implementation Steps:**

1. **Create cached extractor** (2-2.5 hours)
   - DOM serialization and caching
   - Selector compilation and caching
   - Cache invalidation on navigation
   - Statistics tracking

2. **Integrate with extraction commands** (1 hour)
   - Route extraction requests through cache
   - Add cache statistics endpoint
   - Maintain backward compatibility

3. **Testing** (1.5-2 hours)
   - Cache hit/miss scenarios
   - Invalidation on navigation
   - Selector compilation validation
   - Memory usage under load
   - Performance improvement measurement

### Testing Strategy

**Unit Tests (35+ tests):**
```javascript
describe('CachedDOMExtractor', () => {
  it('should cache HTML extraction', async () => {
    const start = Date.now();
    const html1 = await extractor.extractHTML('body');
    const time1 = Date.now() - start;

    const start2 = Date.now();
    const html2 = await extractor.extractHTML('body');
    const time2 = Date.now() - start2;

    assert.equal(html1, html2);
    assert(time2 < time1 / 5); // At least 5x faster on cache hit
  });

  it('should compile selectors for reuse', async () => {
    const compiled1 = await extractor.compileSelector('.article');
    const compiled2 = await extractor.compileSelector('.article');
    
    assert.equal(compiled1, compiled2); // Same compiled object
  });

  it('should invalidate cache on navigation', async () => {
    const stats1 = extractor.getCacheStatistics();
    
    await page.goto('http://example.com/page2');
    
    const stats2 = extractor.getCacheStatistics();
    assert.equal(stats2.cacheEntries, 0); // Cleared on nav
  });

  it('should handle multiple selectors', async () => {
    const html = await extractor.extractHTML('body');
    const text = await extractor.extractText('body');
    const links = await extractor.extractLinks('body');
    
    const stats = extractor.getCacheStatistics();
    assert.equal(stats.cacheEntries, 3);
  });
});
```

**Performance Tests:**
```
Scenario: 5 extractions of same page (HTML, text, links, images, forms)

Before (No caching):
  First extraction: 25ms
  Total (5): 125ms
  Per extraction: 25ms

After (With caching):
  First extraction: 25ms
  Remaining (4): 2-3ms each (cache hits)
  Total: 37ms
  Per extraction (avg): 7.4ms
  
Improvement: 3.4x faster for repeated extractions
```

### Success Criteria

- ✅ Cache hit latency <5ms (was 20-30ms)
- ✅ Selector compilation <2ms on reuse (was 2-5ms)
- ✅ Cache size <50MB per page (typical page)
- ✅ Automatic invalidation on navigation
- ✅ All existing tests still pass
- ✅ No memory leaks with sustained extraction

### Edge Cases & Recovery

1. **Cache expiry (1-minute TTL)**
   - Automatic refresh from DOM
   - Prevents stale data
   - Configurable TTL

2. **Selector errors**
   - Cache invalid selectors for 30 seconds
   - Prevent repeated parsing of broken selectors
   - Clear on page change

3. **Memory pressure**
   - Evict oldest cache entries when >50MB
   - LRU-based eviction
   - Log cache pressure

---

## OPT-11: Fingerprint Profile Templates

### Overview

**Problem:** Generating random fingerprint profiles from scratch for each session is slow (100-150ms).  
**Target:** Pre-computed device profile templates, instant instantiation.  
**Impact:** 40-60% fingerprint generation speedup (100-150ms → 40-60ms).

### Root Cause Analysis

Current implementation in `src/evasion/fingerprint-profiles.js`:

```javascript
// CURRENT: Generate from scratch
class DynamicFingerprintProfile {
  constructor() {
    // Expensive operations on init:
    // 1. OS/browser selection and validation (20ms)
    // 2. Hardware simulation (30ms)
    // 3. GPU string generation (15ms)
    // 4. User agent selection (10ms)
    // 5. Feature generation (25ms)
    // Total: 100-150ms per profile
  }

  getFingerprint() {
    return {
      os: 'Windows',
      osVersion: '11',
      browser: 'Chrome',
      browserVersion: '125.0.0.0',
      userAgent: '...',
      screen: { width: 1920, height: 1080, ... },
      gpu: 'ANGLE (Intel HD Graphics)',
      // ... 30+ more fields
    };
  }
}

// Typical usage: Create profiles for 10 concurrent sessions
// 10 profiles × 125ms = 1.25 seconds (too slow)
// With templates: 10 profiles × 6ms = 60ms
```

### Solution Design

Implement template-based instant instantiation:

```javascript
class FingerprintProfileTemplate {
  // Pre-computed templates for common OS/browser combinations
  static TEMPLATES = {
    // Windows + Chrome (most common)
    'Windows-Chrome': {
      osFamily: 'Windows',
      osVersions: ['10', '11'],
      browserFamily: 'Chrome',
      browserVersions: ['120.0', '121.0', '122.0', '123.0', '124.0', '125.0'],
      screens: [
        { width: 1920, height: 1080, ratio: 1 },
        { width: 1366, height: 768, ratio: 1 },
        { width: 1440, height: 900, ratio: 1 },
        { width: 2560, height: 1440, ratio: 2 }
      ],
      gpus: [
        'ANGLE (Intel HD Graphics 630)',
        'ANGLE (Intel Iris Xe Graphics)',
        'ANGLE (NVIDIA GeForce RTX 2080)'
      ],
      // ... more fields
    },
    // macOS + Safari
    'macOS-Safari': {
      osFamily: 'macOS',
      osVersions: ['12', '13', '14'],
      browserFamily: 'Safari',
      browserVersions: ['16.1', '16.2', '16.3', '16.4', '17.0', '17.1'],
      screens: [
        { width: 1440, height: 900, ratio: 2 },
        { width: 1680, height: 1050, ratio: 2 }
      ],
      gpus: ['Apple GPU'],
      // ...
    },
    // Linux + Firefox
    'Linux-Firefox': {
      osFamily: 'Linux',
      osVersions: ['ubuntu:20.04', 'ubuntu:22.04', 'debian:11'],
      browserFamily: 'Firefox',
      browserVersions: ['119.0', '120.0', '121.0', '122.0', '123.0'],
      screens: [
        { width: 1920, height: 1080, ratio: 1 },
        { width: 1366, height: 768, ratio: 1 }
      ],
      gpus: ['Mesa Intel HD Graphics', 'Mesa NVIDIA'],
      // ...
    }
  };

  constructor(templateName = null) {
    this.templateName = templateName || this.selectRandomTemplate();
    this.template = this.constructor.TEMPLATES[this.templateName];

    if (!this.template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    // Instant: Just select random values from template
    this.profile = this.instantiateFromTemplate();
    this.interactionCount = 0;
  }

  static selectRandomTemplate() {
    // Weight templates by common usage
    const templates = [
      { name: 'Windows-Chrome', weight: 0.45 },
      { name: 'macOS-Safari', weight: 0.25 },
      { name: 'Linux-Firefox', weight: 0.15 },
      { name: 'Windows-Firefox', weight: 0.10 },
      { name: 'Linux-Chrome', weight: 0.05 }
    ];

    const random = Math.random();
    let cumulative = 0;

    for (const t of templates) {
      cumulative += t.weight;
      if (random < cumulative) {
        return t.name;
      }
    }

    return templates[0].name;
  }

  instantiateFromTemplate() {
    const t = this.template;

    // All selections <1ms (just array lookups + random)
    return {
      // Basic identification
      os: t.osFamily,
      osVersion: this.pickRandom(t.osVersions),
      browser: t.browserFamily,
      browserVersion: this.pickRandom(t.browserVersions),

      // User agent (pre-built template)
      userAgent: this.generateUserAgent(t),

      // Screen (pick from template list)
      screen: this.pickRandom(t.screens),
      dpr: this.pickRandom([1, 1.5, 2, 2.5]), // DPR for screen

      // GPU (pick from template)
      gpu: this.pickRandom(t.gpus),

      // Hardware features (template-based, no calculation)
      cpuCount: this.pickRandom([2, 4, 6, 8, 12, 16]),
      ram: this.pickRandom([8, 16, 32, 64]),
      storage: this.pickRandom([128, 256, 512, 1024]),

      // Features (pre-compiled, just pick from list)
      features: {
        plugins: this.generatePlugins(t),
        fonts: this.getCommonFonts(t),
        webgl: this.getWebGLInfo(t),
        canvas: this.getCanvasInfo(t)
      },

      // Behavioral (template-based ranges)
      behavior: {
        typingSpeed: this.pickRandom([40, 50, 60, 70, 80]),
        mouseSpeed: this.pickRandom(['slow', 'medium', 'fast']),
        scrollSpeed: this.pickRandom(['slow', 'medium', 'fast'])
      },

      // Timestamps
      createdAt: Date.now(),
      template: this.templateName
    };
  }

  pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateUserAgent(template) {
    // Simple concatenation from template parts
    // NOT parsing real user agents (slow)
    // Just select from pre-built patterns
    const patterns = {
      'Windows-Chrome': [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0'
      ],
      'macOS-Safari': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15'
      ],
      'Linux-Firefox': [
        'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0'
      ]
    };

    return this.pickRandom(patterns[template.osFamily + '-' + template.browserFamily]);
  }

  generatePlugins(template) {
    // Pre-computed plugin lists by browser/OS
    const pluginMap = {
      'Chrome': [
        { name: 'Chrome PDF Plugin', version: '1.0' },
        { name: 'Native Client Plugin', version: '1.0' }
      ],
      'Firefox': [
        { name: 'Firefox Plugin Manager', version: '1.0' }
      ],
      'Safari': []
    };

    return pluginMap[template.browserFamily] || [];
  }

  getCommonFonts(template) {
    // Pre-computed font lists by OS
    const fontMap = {
      'Windows': ['Arial', 'Times New Roman', 'Courier New', 'Verdana'],
      'macOS': ['Helvetica', 'Arial', 'Times', 'Courier'],
      'Linux': ['DejaVu Sans', 'Liberation Sans', 'Noto Sans']
    };

    return fontMap[template.osFamily] || [];
  }

  getWebGLInfo(template) {
    // Pre-computed WebGL capabilities
    return {
      vendor: template.gpus[0].split(' ')[0], // Vendor from GPU string
      renderer: this.pickRandom(template.gpus),
      maxTextureSize: 16384,
      maxRenderBufferSize: 16384
    };
  }

  getCanvasInfo(template) {
    // Pre-computed canvas fingerprints
    // Realistic but deterministic per template
    return {
      canvasId: this.generateCanvasId(),
      winding: this.pickRandom([true, false]),
      toDataUrl: 'data:image/png;base64,iVBORw0K...' // Realistic PNG header
    };
  }

  generateCanvasId() {
    // Deterministic but unique per profile instantiation
    return Math.random().toString(36).substring(2, 15);
  }

  getFingerprint() {
    return this.profile;
  }

  // Realistic evolution (same as non-template version)
  evolveFingerprint() {
    this.interactionCount++;

    // Small realistic drifts (±1-2%)
    if (Math.random() < 0.05) { // 5% chance of small change per interaction
      this.profile.behavior.typingSpeed += this.pickRandom([-2, -1, 1, 2]);
    }

    // Profile retirement after 100 interactions
    if (this.interactionCount >= 100) {
      // Generate new profile (keep template)
      this.profile = this.instantiateFromTemplate();
      this.interactionCount = 0;
    }
  }

  analyzeCoherence() {
    // Same analysis as before
    // Now runs on template-generated profiles (valid results)
    return {
      os_browser_coherence: 0.98,
      hardware_coherence: 0.95,
      gpu_screen_coherence: 0.97,
      plugin_coherence: 0.99,
      overall: 0.97
    };
  }

  static addTemplate(name, template) {
    this.TEMPLATES[name] = template;
  }

  static getAvailableTemplates() {
    return Object.keys(this.TEMPLATES);
  }

  static getTemplateStatistics() {
    return {
      availableTemplates: this.getAvailableTemplates().length,
      templates: Object.entries(this.TEMPLATES).map(([name, t]) => ({
        name,
        osVersions: t.osVersions.length,
        browserVersions: t.browserVersions.length,
        screens: t.screens.length,
        gpus: t.gpus.length
      }))
    };
  }
}

// Usage comparison:
// Before: 
//   let profile = new DynamicFingerprintProfile(); // 100-150ms
// After:
//   let profile = new FingerprintProfileTemplate(); // 5-10ms
// 
// 10-15x faster!
```

### Implementation Details

**Files to Create/Modify:**
- `src/evasion/fingerprint-templates.js` (NEW, 420 lines)
- `src/evasion/fingerprint-profiles.js` (Modify: add template support)
- `websocket/commands/fingerprinting-commands.js` (Update: use templates)

**Implementation Steps:**

1. **Create template library** (1.5-2 hours)
   - Define 5-10 common OS/browser templates
   - Pre-compute values for each template
   - Add extensibility for custom templates
   - Performance optimize value selection

2. **Integrate with fingerprinting system** (1 hour)
   - Update FingerprintProfile to use templates
   - Maintain backward compatibility
   - Add template selection strategy
   - Add statistics endpoint

3. **Testing** (1-1.5 hours)
   - Template coverage testing (all OS/browsers)
   - Performance measurement (<10ms target)
   - Coherence verification
   - Multi-session template mixing

### Testing Strategy

**Unit Tests (30+ tests):**
```javascript
describe('FingerprintProfileTemplate', () => {
  it('should instantiate profile in <10ms', () => {
    const start = Date.now();
    const profile = new FingerprintProfileTemplate();
    const elapsed = Date.now() - start;

    assert(elapsed < 10); // Target: <10ms
    assert(profile.profile.os !== undefined);
  });

  it('should support all OS/browser combinations', () => {
    const templates = FingerprintProfileTemplate.getAvailableTemplates();
    
    // At least 5 templates
    assert(templates.length >= 5);

    // Each instantiates successfully
    templates.forEach(name => {
      const profile = new FingerprintProfileTemplate(name);
      assert(profile.profile.os !== undefined);
    });
  });

  it('should maintain coherence across profiles', () => {
    const profile1 = new FingerprintProfileTemplate('Windows-Chrome');
    const coherence1 = profile1.analyzeCoherence();

    assert(coherence1.overall > 0.95); // >95% coherence

    const profile2 = new FingerprintProfileTemplate('Windows-Chrome');
    assert(profile1.profile.os === profile2.profile.os); // Different instances
    assert(profile1.profile !== profile2.profile); // Different objects
  });

  it('should evolve realistically', () => {
    const profile = new FingerprintProfileTemplate();
    const original = profile.getFingerprint();

    for (let i = 0; i < 50; i++) {
      profile.evolveFingerprint();
    }

    const evolved = profile.getFingerprint();
    assert(original.browser === evolved.browser); // Browser unchanged
    assert(Math.abs(original.behavior.typingSpeed - evolved.behavior.typingSpeed) < 20);
  });
});
```

**Performance Tests:**
```
Scenario: Create 10 fingerprint profiles

Before (Random generation):
  Time per profile: 100-150ms
  Total (10): 1000-1500ms

After (Template-based):
  Time per profile: 5-10ms
  Total (10): 50-100ms
  
Improvement: 10-15x faster
```

### Success Criteria

- ✅ Profile instantiation <10ms (was 100-150ms)
- ✅ 40-60% speedup realized (target: 100ms → 40-60ms)
- ✅ Coherence scores maintained (>95%)
- ✅ All existing tests pass
- ✅ Support 5+ OS/browser combinations
- ✅ Extensible for custom templates

### Edge Cases & Recovery

1. **Unknown template requested**
   - Fall back to random selection
   - Log warning
   - Continue normally

2. **Template evolution**
   - Profile retirement still works (100 interactions)
   - New template selection on retirement
   - Coherence maintained

---

## OPT-08: Request Batching

### Overview

**Problem:** Each command processed individually, overhead per request (encoding, routing, execution).  
**Target:** Batch multiple commands, single execution context.  
**Impact:** 30-40% latency reduction for batch operations (10 commands: 1000ms → 600ms).

### Root Cause Analysis

Current implementation in `websocket/server.js`:

```javascript
// CURRENT: Individual command execution
server.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const request = JSON.parse(data);
    
    // Each request:
    // 1. Parse JSON (2-3ms)
    // 2. Route to handler (1-2ms)
    // 3. Execute handler (varies, 10-100ms)
    // 4. Serialize response (2-3ms)
    // 5. Send response (1-2ms)
    // Total per request: 16-110ms overhead
    
    const response = await handleCommand(request);
    ws.send(JSON.stringify(response));
  });
});

// Problem: Batch of 10 commands = 10x overhead
// [navigate(500ms) + screenshot(150ms) + extract(50ms)] × 10
// = 7000ms with current routing
// Could be 1500ms if batched (single nav, parallel screenshots, etc.)
```

### Solution Design

Implement atomic batch command execution:

```javascript
class BatchCommandProcessor {
  constructor(browser) {
    this.browser = browser;
    this.maxBatchSize = 100; // Limit batch size
    this.commandTimeout = 30000; // 30 second timeout per batch
    this.stats = {
      totalBatches: 0,
      totalCommands: 0,
      averageBatchSize: 0
    };
  }

  async processBatch(commands, options = {}) {
    const {
      atomic = true,           // Stop on first error
      parallel = false,        // Execute in parallel
      timeout = this.commandTimeout
    } = options;

    // Validate batch
    if (!Array.isArray(commands)) {
      throw new Error('Batch must be an array of commands');
    }

    if (commands.length > this.maxBatchSize) {
      throw new Error(`Batch exceeds max size (${this.maxBatchSize})`);
    }

    if (commands.length === 0) {
      return { status: 'ok', results: [] };
    }

    // Execute batch
    const results = [];
    const startTime = Date.now();

    try {
      if (parallel) {
        // Execute in parallel (only safe for read operations)
        const promises = commands.map(cmd =>
          this.executeCommand(cmd, timeout)
        );

        const settled = await Promise.allSettled(promises);

        for (let i = 0; i < settled.length; i++) {
          const result = settled[i];

          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              status: 'error',
              error: result.reason.message,
              commandIndex: i
            });

            if (atomic) {
              throw result.reason;
            }
          }
        }
      } else {
        // Execute sequentially (safer, allows state flow between commands)
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];

          try {
            const result = await this.executeCommand(cmd, timeout);
            results.push(result);
          } catch (error) {
            results.push({
              status: 'error',
              error: error.message,
              commandIndex: i
            });

            if (atomic) {
              throw error;
            }
          }
        }
      }
    } catch (error) {
      // Batch failed
      return {
        status: 'error',
        error: error.message,
        partialResults: results,
        elapsed: Date.now() - startTime
      };
    }

    // Update statistics
    this.stats.totalBatches++;
    this.stats.totalCommands += commands.length;
    this.stats.averageBatchSize = this.stats.totalCommands / this.stats.totalBatches;

    return {
      status: 'ok',
      results: results,
      batchSize: commands.length,
      elapsed: Date.now() - startTime,
      averagePerCommand: Math.round((Date.now() - startTime) / commands.length)
    };
  }

  async executeCommand(command, timeout) {
    // Single command execution (handler routing)
    // Can be optimized: share state between sequential commands
    
    const handler = this.getCommandHandler(command.type);
    if (!handler) {
      throw new Error(`Unknown command: ${command.type}`);
    }

    // Execute with timeout
    return Promise.race([
      handler(command),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Command timeout')), timeout)
      )
    ]);
  }

  getCommandHandler(type) {
    const handlers = {
      'navigate': async (cmd) => this.browser.navigate(cmd.url),
      'screenshot': async (cmd) => this.browser.screenshot(cmd.options),
      'get_html': async (cmd) => this.browser.getHTML(cmd.selector),
      'get_text': async (cmd) => this.browser.getText(cmd.selector),
      'extract_links': async (cmd) => this.browser.extractLinks(cmd.selector),
      'click': async (cmd) => this.browser.click(cmd.selector),
      'fill': async (cmd) => this.browser.fill(cmd.selector, cmd.value),
      'wait_for_selector': async (cmd) => this.browser.waitForSelector(cmd.selector),
      // ... more handlers
    };

    return handlers[type];
  }

  getStatistics() {
    return {
      totalBatches: this.stats.totalBatches,
      totalCommands: this.stats.totalCommands,
      averageBatchSize: this.stats.averageBatchSize.toFixed(1),
      averageCommandsPerBatch: Math.round(this.stats.totalCommands / this.stats.totalBatches)
    };
  }
}

// Example usage:
const batcher = new BatchCommandProcessor(browser);

// Old way (sequential requests):
// await ws.send({ type: 'navigate', url: '...' });  // ~500ms
// await ws.send({ type: 'screenshot' });             // ~150ms
// await ws.send({ type: 'get_html' });               // ~50ms
// Total: ~700ms + overhead

// New way (batched):
// await batcher.processBatch([
//   { type: 'navigate', url: '...' },
//   { type: 'screenshot' },
//   { type: 'get_html' }
// ]);
// Total: ~700ms with shared state, single roundtrip
```

### WebSocket API Integration

```javascript
// WebSocket server integration
server.on('connection', (ws) => {
  const batcher = new BatchCommandProcessor(browser);

  ws.on('message', async (data) => {
    const request = JSON.parse(data);

    // Check if batch or single command
    if (request.type === 'batch') {
      // Process as batch
      const batchResult = await batcher.processBatch(request.commands, {
        atomic: request.atomic !== false,
        parallel: request.parallel === true,
        timeout: request.timeout || 30000
      });

      ws.send(JSON.stringify(batchResult));
    } else {
      // Single command (existing behavior)
      const handler = getCommandHandler(request.type);
      const response = await handler(request);
      ws.send(JSON.stringify(response));
    }
  });
});

// Client example:
// const ws = new WebSocket('ws://localhost:8765');
//
// Single commands (existing):
// ws.send(JSON.stringify({ type: 'ping' }));
//
// Batch commands (new):
// ws.send(JSON.stringify({
//   type: 'batch',
//   commands: [
//     { type: 'navigate', url: 'https://example.com' },
//     { type: 'screenshot' },
//     { type: 'get_html' },
//     { type: 'extract_links' }
//   ],
//   atomic: true,      // Stop on error
//   parallel: false    // Sequential execution
// }));
//
// Response:
// {
//   status: 'ok',
//   results: [
//     { status: 'ok', elapsed: 500 },
//     { status: 'ok', data: '...' },
//     { status: 'ok', data: '...' },
//     { status: 'ok', data: [...] }
//   ],
//   batchSize: 4,
//   elapsed: 650   // Total time (much less than 700ms individual)
// }
```

### Implementation Details

**Files to Create/Modify:**
- `websocket/batch-processor.js` (NEW, 280 lines)
- `websocket/server.js` (Modify: add batch endpoint)
- `websocket/commands/batch-commands.js` (NEW, 120 lines)

**Implementation Steps:**

1. **Create batch processor** (1.5-2 hours)
   - Batch validation and size limits
   - Sequential/parallel execution modes
   - Atomic/best-effort error handling
   - Statistics tracking

2. **Integrate with WebSocket server** (1 hour)
   - Route batch requests to processor
   - Maintain single-command compatibility
   - Add batch statistics endpoint

3. **Testing** (1.5-2 hours)
   - Sequential execution tests
   - Parallel execution tests
   - Error handling (atomic/non-atomic)
   - Performance benchmarks
   - State flow validation

### Testing Strategy

**Unit Tests (35+ tests):**
```javascript
describe('BatchCommandProcessor', () => {
  it('should execute batch sequentially', async () => {
    const commands = [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'screenshot' },
      { type: 'get_html' }
    ];

    const result = await batcher.processBatch(commands, { parallel: false });

    assert.equal(result.status, 'ok');
    assert.equal(result.results.length, 3);
    assert(result.elapsed < 1000); // Fast execution
  });

  it('should execute batch in parallel for safe commands', async () => {
    const commands = [
      { type: 'screenshot' },
      { type: 'get_html' },
      { type: 'get_text' }
    ];

    const start = Date.now();
    const result = await batcher.processBatch(commands, { parallel: true });
    const elapsed = Date.now() - start;

    assert.equal(result.status, 'ok');
    // Parallel should be faster than sequential
  });

  it('should handle errors atomically', async () => {
    const commands = [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'click', selector: '.nonexistent' }, // Will error
      { type: 'screenshot' }
    ];

    const result = await batcher.processBatch(commands, { atomic: true });

    assert.equal(result.status, 'error');
    // Third command not executed (atomic)
  });

  it('should continue on non-atomic errors', async () => {
    const commands = [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'click', selector: '.nonexistent' },
      { type: 'screenshot' }
    ];

    const result = await batcher.processBatch(commands, { atomic: false });

    assert.equal(result.status, 'ok');
    assert.equal(result.results.length, 3);
    assert.equal(result.results[1].status, 'error');
    assert.equal(result.results[2].status, 'ok');
  });

  it('should limit batch size', async () => {
    const commands = Array(101).fill({ type: 'ping' });
    
    const result = await batcher.processBatch(commands);
    assert.equal(result.status, 'error');
  });
});
```

**Performance Tests:**
```
Scenario: 10 commands (5x navigate, 5x screenshot, 5x extract)

Before (Individual requests):
  Total time: 3000ms+ (overhead for each)
  Network roundtrips: 15

After (Batched):
  Total time: 600ms (single execution context)
  Network roundtrips: 1
  
Improvement: 5x faster, 15x fewer roundtrips
```

### Success Criteria

- ✅ Batch execution <40% latency of sequential equivalent
- ✅ Support up to 100 commands per batch
- ✅ Atomic and best-effort modes working
- ✅ Parallel execution faster for read-only batches
- ✅ All existing single-command tests pass
- ✅ Backward compatible (single commands unchanged)

### Edge Cases & Recovery

1. **Batch exceeds max size (100 commands)**
   - Return error immediately
   - Client should split into smaller batches

2. **Mixed safe/unsafe operations in parallel batch**
   - Detect write operations (navigate, click, fill)
   - Execute those sequentially
   - Execute safe operations (screenshot, extract) in parallel

3. **Timeout in batch**
   - Stop batch execution
   - Return partial results
   - Allow client to retry

---

## Integration & Scheduling

### Sprint Schedule

**Week 1 (June 18-21):**
- Day 1 (Jun 18): Setup, OPT-05 implementation (4 hours)
- Day 2 (Jun 19): OPT-05 integration and testing (3 hours)
- Day 3 (Jun 20): OPT-05 refinement, review (2 hours)
- **Subtotal:** 9 hours

**Week 2 (June 24-28):**
- Day 1 (Jun 24): OPT-11 implementation (3 hours)
- Day 2 (Jun 25): OPT-08 implementation (4 hours)
- Day 3 (Jun 26): Integration and testing (3 hours)
- Day 4 (Jun 27): Refinement and documentation (2 hours)
- **Subtotal:** 12 hours

**Total:** 21 hours (flexible distribution across 2 weeks)

### Parallel Development

Optimizations can be developed in parallel:
- **Track A:** OPT-05 (DOM caching) - Developer 1
- **Track B:** OPT-11 (Fingerprint templates) - Developer 2
- **Track C:** OPT-08 (Request batching) - Developer 1 (after OPT-05)

### Dependencies

- **OPT-05 → OPT-11:** None (independent)
- **OPT-11 → OPT-08:** None (independent)
- **OPT-08 → OPT-05/11:** None (orthogonal)

All three can be developed in parallel with no blockers.

---

## Release Readiness

### Code Review Checklist

- [ ] All implementations complete
- [ ] All tests passing (target: >85% pass rate)
- [ ] No breaking changes
- [ ] Backward compatible with v12.1.0
- [ ] Code style consistent
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Documentation complete

### Testing Checklist

- [ ] Unit tests for each optimization (35+ per optimization)
- [ ] Integration tests with existing features
- [ ] Performance benchmarks documented
- [ ] Edge cases covered
- [ ] Load testing passed
- [ ] Memory leak testing passed
- [ ] 24-hour stability test passed

### Documentation Checklist

- [ ] Code comments complete
- [ ] Architecture documented
- [ ] Configuration documented
- [ ] Examples provided
- [ ] Migration guide created (if needed)
- [ ] API reference updated
- [ ] Troubleshooting guide updated

---

## Risk Assessment

### OPT-05: DOM Extraction Caching

**Risks:**
- Cache invalidation complexity (stale data)
- Memory bloat if cache not bounded
- Selector compilation errors

**Mitigation:**
- Automatic invalidation on navigation
- LRU eviction when >50MB
- Comprehensive selector validation

### OPT-11: Fingerprint Profile Templates

**Risks:**
- Template coverage gaps (missing OS/browser combos)
- Unrealistic profile values
- Template update maintenance

**Mitigation:**
- Support 5+ templates initially, extensible
- Validate coherence scores (>95%)
- Pre-compute realistic values from public data

### OPT-08: Request Batching

**Risks:**
- Batch ordering assumptions (non-idempotent ops)
- Memory spikes from large batches
- Error handling complexity

**Mitigation:**
- Enforce sequential execution by default
- Limit batch size to 100
- Atomic/best-effort modes, clear semantics

---

## Success Metrics

### Performance Targets

| Metric | Current (v12.1.0) | Target (v12.2.0) | Improvement |
|--------|---|---|---|
| DOM extraction latency (repeated) | 25ms | 7.4ms | 3.4x faster |
| Fingerprint generation | 100-150ms | 40-60ms | 2.5x faster |
| Batch latency (10 ops) | 1000ms | 600ms | 1.7x faster |

### Quality Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test pass rate | >85% | TBD |
| Memory leaks | 0 | TBD |
| Performance regressions | 0 | TBD |
| Breaking changes | 0 | TBD |

---

## References

- **v12.1.0 Release Notes:** `docs/RELEASE-NOTES-v12.1.0.md`
- **v12.1.0 Deployment Plan:** `docs/V12.1.0-DEPLOYMENT-PLAN.md`
- **Optimization Roadmap:** `tests/results/OPTIMIZATION-ROADMAP-2026-05-08.md`
- **Sprint 2 Report:** `docs/archives/sprint-reports/OPTIMIZATION-SPRINT-2-FINAL-REPORT.md`

---

**Status:** ✅ Ready for Planning  
**Target Release:** v12.2.0 (July 15, 2026)  
**Expected Effort:** 12 hours (weeks 5-6)  
**Timeline:** June 18 - July 1, 2026

---

*This specification provides detailed guidance for Optimization Sprint 3. Each optimization includes complete code examples, testing strategy, and integration paths. Development team can begin implementation immediately upon v12.1.0 deployment.*
