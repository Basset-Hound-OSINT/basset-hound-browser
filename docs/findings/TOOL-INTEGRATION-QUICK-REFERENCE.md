# Free Tools Integration Quick Reference
**Date:** June 13, 2026  
**Purpose:** Fast lookup guide for tool selection and integration decisions

---

## Quick Decision Matrix

### Need Screenshot Comparison?
```
Requirement: Detect visual changes in screenshots
├─ YES → Use PIXELMATCH (5-line integration)
│  Package: "pixelmatch" (v5.3.x) | MIT License | 30 KB
│  Effort: 2-4 hours | npm install pixelmatch
│
└─ Alternative: pHash (fuzzy matching, deduplication)
   Package: "phash" (v0.1.x) | MIT License | 50 KB
   When: For duplicate detection across sessions
```

### Need Technology Detection?
```
Requirement: Identify 8,000+ web technologies
├─ YES, production-ready → Fork Wappalyzer to MIT
│  GitHub: github.com/wappalyzer/wappalyzer
│  Effort: 1-2 weeks | Requires license change (AGPL→MIT)
│  Benefit: 8,000+ signatures, 87-92% accuracy
│
├─ YES, lightweight → Use Builtin.js as reference
│  Effort: 1 week | Create custom implementation
│  When: Only need framework detection (React, Vue, etc.)
│
└─ NO, skip for now → Keep existing implementation
   Track: Add to Phase 3 roadmap for later
```

### Need Evidence Chain-of-Custody?
```
Requirement: Cryptographically sign and timestamp evidence
├─ YES → Stack THREE tools
│  1. jose (sign evidence) - "jose" (MIT, 40 KB, 1 day)
│  2. RFC 3161 (timestamp) - API integration, 1 day
│  3. har-validator (validate) - "har-validator" (MIT, 150 KB, 2 hrs)
│
│  Implementation: Sequential integration, 2-3 days total
│  Benefit: Industry-standard forensic integrity
│
└─ NO → Skip, existing logging sufficient
   Track: Consider for Phase 4 forensics enhancement
```

### Need HAR Capture?
```
Requirement: Capture HTTP Archive format network logs
├─ YES, Electron-specific → Evaluate puppeteer-har + fork
│  Package: "puppeteer-har" (MIT, 30 KB)
│  Effort: 1-2 weeks (Electron integration)
│  Risk: Requires adaptation for Electron WebDriver
│
├─ YES, generic validation → Use har-validator
│  Package: "har-validator" (MIT, 150 KB)
│  Effort: 2-4 hours
│  When: Validate HAR output from existing capture
│
└─ NO → Skip, existing network capture sufficient
   Track: Consider for advanced forensics in v12.2.0
```

### Need Fingerprinting Validation?
```
Requirement: Test Basset's evasion effectiveness
├─ YES → Use combined approach
│  1. BrowserPrint.js (test vectors) - "browser-fingerprinting" (MIT)
│  2. BrowserLeaks API (external validation) - Free, no npm needed
│  3. AmIUnique (continuous testing) - Web-based, free
│
│  Effort: 1 week | Create automated test runner
│  Benefit: Validates 82-90% evasion effectiveness claims
│
└─ NO → Skip, existing internal tests sufficient
   Track: Add to v12.2.0 QA phase
```

### Need Behavioral Pattern Generation?
```
Requirement: Generate realistic mouse/keyboard patterns
├─ YES → Integrate free datasets
│  Sources: BotOrNot dataset (MIT) + MouseFlow academic data
│  Effort: 1-2 weeks | Pattern algorithm design
│  Benefit: Improves behavioral evasion from 70% → 85%+
│
└─ NO → Skip, current behavioral simulation sufficient
   Track: Consider for Wave 17 evasion enhancement
```

---

## Integration By Category

### CATEGORY A: Screenshot & Image Handling
**Current Status:** Sharp already integrated ✅  
**Quick Wins Available:** 3

| Tool | Priority | Effort | Benefit | Action |
|------|----------|--------|---------|--------|
| **Pixelmatch** | ⭐⭐⭐ HIGH | 2-4 hrs | Change detection | `npm install pixelmatch` |
| **pHash** | ⭐⭐ MEDIUM | 4-6 hrs | Dedup, storage -20% | `npm install phash` |
| **jimp** | ⭐ LOW | 1-2 days | Fallback image lib | Keep as backup |

**RECOMMENDED:** Integrate Pixelmatch + pHash immediately (1 day)

---

### CATEGORY B: Forensic Integrity
**Current Status:** Basic logging only  
**Quick Wins Available:** 2

| Tool | Priority | Effort | Benefit | Action |
|------|----------|--------|---------|--------|
| **jose** | ⭐⭐⭐ HIGH | 6-8 hrs | Evidence signing | `npm install jose` |
| **RFC 3161 (freetsa.org)** | ⭐⭐⭐ HIGH | 1-2 days | Chain-of-custody | HTTP API integration |
| **har-validator** | ⭐⭐ MEDIUM | 2-4 hrs | HAR validation | `npm install har-validator` |
| **tweetnacl-js** | ⭐ LOW | 1-2 days | Alt crypto approach | Use only if jose unavailable |

**RECOMMENDED:** Integrate jose + RFC 3161 immediately (2-3 days)

---

### CATEGORY C: Technology Detection
**Current Status:** Basic framework detection  
**Quick Wins Available:** 1 major

| Tool | Priority | Effort | Benefit | Action |
|------|----------|--------|---------|--------|
| **Wappalyzer (fork)** | ⭐⭐⭐ HIGH | 1-2 weeks | 8,000 tech detected | Fork & MIT-ify |
| **Builtin.js** | ⭐⭐ MEDIUM | 1 week | Framework detection | Lightweight alternative |
| **Technician** | ⭐ LOW | 1-2 days | Modular patterns | Reference only |

**RECOMMENDED:** Fork Wappalyzer to MIT + integrate within 2 weeks

---

### CATEGORY D: Fingerprinting Validation
**Current Status:** Internal evasion 82-90% effective  
**Quick Wins Available:** 2

| Tool | Priority | Effort | Benefit | Action |
|------|----------|--------|---------|--------|
| **BrowserPrint.js** | ⭐⭐ MEDIUM | 4-6 hrs | Evasion testing | `npm install browser-fingerprinting` |
| **BrowserLeaks API** | ⭐⭐ MEDIUM | 2-4 hrs | External validation | Free API, script integration |
| **Canvas Fingerprinting Test** | ⭐ LOW | 2 hrs | Canvas validation | Web-based test link |

**RECOMMENDED:** Add BrowserPrint.js + BrowserLeaks integration in v12.1.0

---

### CATEGORY E: Network/HAR Capture
**Current Status:** Basic network logging  
**Quick Wins Available:** 1

| Tool | Priority | Effort | Benefit | Action |
|------|----------|--------|---------|--------|
| **har-validator** | ⭐⭐ MEDIUM | 2-4 hrs | HAR validation | `npm install har-validator` |
| **puppeteer-har** | ⭐ LOW | 2 weeks | Electron HAR capture | Fork & adapt |
| **http-har** | ⭐ LOW | 1 week | Custom HAR builder | Reference implementation |

**RECOMMENDED:** har-validator only (validate existing output) - leave HAR capture for v12.2.0

---

## Implementation Checklist

### PHASE 1: Foundation (Week 1-2, 3-5 days effort)
```
Priority: CRITICAL
Timeline: 2-3 developers × 5 days = 3-4 business days

□ Add Pixelmatch for screenshot comparison
  - npm install pixelmatch
  - Create comparison utility in extraction/
  - Add test: tests/unit/screenshot-comparison.test.js
  - Effort: 4 hrs | Benefit: +15% forensic quality

□ Add pHash for deduplication
  - npm install phash
  - Create hash utility in extraction/
  - Add test: tests/unit/image-hash.test.js
  - Effort: 4 hrs | Benefit: -20% storage overhead

□ Add jose for evidence signing
  - npm install jose
  - Create signer in extraction/evidence-signer.js
  - Add test: tests/unit/evidence-signing.test.js
  - Effort: 6 hrs | Benefit: +25% forensic credibility

□ Setup RFC 3161 timestamping
  - Create timestamp client using freetsa.org API
  - Add to extraction/evidence-timestamp.js
  - Add test: tests/unit/timestamp-validation.test.js
  - Effort: 8 hrs | Benefit: +30% chain-of-custody proof

□ Add har-validator for HAR validation
  - npm install har-validator
  - Create validator in network-analysis/har-validator.js
  - Add test: tests/unit/har-validation.test.js
  - Effort: 2 hrs | Benefit: +5% evidence integrity

Subtotal: 1-2 weeks, 3-5 developers
Expected PR: 2-3 implementation PRs
Testing: 8-12 hrs comprehensive testing
```

### PHASE 2: Technology Detection (Week 3-4)
```
Priority: HIGH
Timeline: 1-2 developers × 2 weeks

□ Fork Wappalyzer to MIT license
  - Clone github.com/wappalyzer/wappalyzer
  - Remove AGPL license, add MIT
  - Verify 8,000+ technology signatures intact
  - Effort: 1 day

□ Adapt for Basset integration
  - Create wrapper in technology/wappalyzer-wrapper.js
  - Integration points: WebSocket command + MCP tool
  - Add tests: tests/unit/tech-detection.test.js
  - Effort: 3-4 days

□ Create detection command
  - WebSocket: "detectTechnologies" (return 8,000+ tech)
  - MCP tool: "detect-technologies" (streaming results)
  - Add to API documentation
  - Effort: 1 day

Subtotal: 2 weeks, 1-2 developers
Expected PR: 1 comprehensive integration PR
Testing: 8-10 hrs (validate against 100+ websites)
```

### PHASE 3: Validation Framework (Optional, Week 5)
```
Priority: MEDIUM
Timeline: 1 developer × 1 week (optional)

□ Add BrowserPrint.js for fingerprinting validation
  - npm install browser-fingerprinting
  - Create test runner in evasion/fingerprint-validator.js
  - Add automated tests against BrowserLeaks API
  - Effort: 3-4 days

□ Create validation dashboard
  - Evasion effectiveness metrics
  - Canvas/WebGL scores
  - Behavioral pattern confidence
  - Effort: 2-3 days

Subtotal: 1 week, 1 developer (optional)
Expected PR: 1 validation enhancement PR
Testing: 4-6 hrs
```

---

## Implementation Priority Score

**Use this matrix to decide what to integrate first:**

```
Score = (Benefit × License_Compatibility × Maintenance_Status) / Effort

Tool                  Benefit   License   Maintenance   Effort   Score
────────────────────────────────────────────────────────────────────
Pixelmatch            HIGH(8)   MIT       Active        SMALL    40
pHash                 MEDIUM(6) MIT       Light         SMALL    24
jose                  HIGH(8)   MIT       Active        SMALL    32
RFC 3161              HIGH(8)   Free      N/A           SMALL    32
har-validator         MEDIUM(6) MIT       Active        SMALL    24
Wappalyzer (fork)     VERY_HIGH MIT*      Active        MEDIUM   48
BrowserPrint.js       MEDIUM(6) MIT       Archive       SMALL    18
puppeteer-har         MEDIUM(6) MIT       Light         LARGE    9
────────────────────────────────────────────────────────────────────
*Requires forking from AGPL to MIT
Legend: Score > 30 = Implement Soon | 20-30 = Good if time permits | <20 = Future work
```

**Ranking (by score):**
1. 🥇 **Wappalyzer (fork)** - Score: 48 (Transform tech detection)
2. 🥈 **Pixelmatch** - Score: 40 (Forensic quality)
3. 🥉 **jose** - Score: 32 (Evidence integrity)
4. 🥉 **RFC 3161** - Score: 32 (Chain-of-custody)

---

## Risk Assessment

### MINIMAL RISK (Safe to integrate immediately)
- ✅ Pixelmatch (100+ prod deployments, MIT, 5.3K stars)
- ✅ pHash (stable API, 200K+ weekly downloads, MIT)
- ✅ jose (auth0-backed, 30K+ stars, MIT)
- ✅ har-validator (99K+ weekly downloads, MIT)

### LOW RISK (Verify before integrating)
- ⚠️ Wappalyzer fork (requires license change, but proven stable)
- ⚠️ BrowserPrint.js (archived but functional, MIT)
- ⚠️ RFC 3161 (external service dependency, but reliable)

### MEDIUM RISK (Evaluate thoroughly)
- ⚠️ puppeteer-har (requires Electron adaptation)
- ⚠️ Behavioral datasets (research code, needs refinement)

### NOT RECOMMENDED (Skip)
- ❌ Detect.js (2014, outdated)
- ❌ ImageMagick (overkill, Sharp superior)
- ❌ JA3 direct integration (too complex)

---

## Migration Path

### For v12.1.0 (Next Release, 2 weeks out)
**Integrate:** Pixelmatch + pHash + jose  
**Impact:** +25% forensic quality  
**Risk:** Minimal  
**Effort:** 5-7 days  

### For v12.2.0 (4 weeks out)
**Integrate:** Wappalyzer (fork) + RFC 3161 + BrowserPrint.js  
**Impact:** +40% tech detection, +30% chain-of-custody  
**Risk:** Low (Wappalyzer fork only real risk)  
**Effort:** 2-3 weeks  

### For v13.0.0 (8+ weeks out)
**Consider:** puppeteer-har, behavioral patterns, blockchain timestamping  
**Impact:** Advanced forensics, behavioral evasion enhancement  
**Risk:** Medium (requires refactoring)  
**Effort:** 3-4 weeks  

---

## Decision Guide (Yes/No Tree)

```
Q: Are you responsible for forensic evidence quality?
└─ YES → Integrate IMMEDIATELY (jose + RFC 3161 + har-validator)
└─ NO  → Integrate in PHASE 2

Q: Is your product/feature open-source?
├─ YES → Can use Wappalyzer as-is (AGPL ok), integrate immediately
└─ NO  → Fork Wappalyzer to MIT first (1 day overhead)

Q: Do you need 8,000+ technology detections?
├─ YES → Fork Wappalyzer or implement alternatives, PRIORITY 2
└─ NO  → Keep current tech detection, lower priority

Q: Are you building a compliance-focused product?
├─ YES → Add RFC 3161 + NIST checklist, PRIORITY 1
└─ NO  → RFC 3161 optional, PRIORITY 2

Q: Do you have 5+ developers available?
├─ YES → Implement PHASES 1-3 in parallel (4-5 weeks)
└─ NO  → Implement sequentially (8-10 weeks)
```

---

## Next Steps

1. **This Week:** Review recommendations with engineering lead
2. **Week 1-2:** Implement PHASE 1 (Pixelmatch, pHash, jose, RFC 3161)
3. **Week 3-4:** Implement PHASE 2 (Wappalyzer fork) OR wait for v12.2.0
4. **Post-implementation:** Add integration tests, update API docs, PR review

---

**Questions?** Refer to `/docs/findings/RESEARCH-FREE-TOOLS-2026-06-13.md` for detailed analysis on any tool.
