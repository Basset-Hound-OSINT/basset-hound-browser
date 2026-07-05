# Dependency Security Audit - Quick Win #2
**Date:** June 20, 2026  
**Project:** Basset Hound Browser v12.7.0  
**Status:** 20 vulnerabilities identified, upgrade plan created

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Vulnerabilities** | 20 |
| **Critical** | 0 |
| **High** | 1 |
| **Moderate** | 18 |
| **Low** | 1 |
| **Outdated Packages** | 7 |
| **Target:** | 0 vulnerabilities |

---

## Vulnerability Analysis

### High Severity (1)

#### 1. undici (Multiple vulnerabilities)
**Package:** `undici <=6.26.0`  
**Severity:** HIGH  
**Issues:**
- HTTP header injection via Set-Cookie percent-decoding (GHSA-p88m-4jfj-68fv)
- WebSocket client DoS via fragment count bypass (GHSA-vxpw-j846-p89q)
- HTTP response queue poisoning via keep-alive socket reuse (GHSA-35p6-xmwp-9g52)
- Set-Cookie SameSite attribute downgrade via substring matching (GHSA-g8m3-5g58-fq7m)

**Current Version:** Unknown (transitive dependency)  
**Fix:** `npm audit fix` (available)  
**Root Cause:** Indirect dependency through Node.js modules  
**Impact:** WebSocket connections vulnerable to injection and DoS attacks

---

### Moderate Severity (18)

#### 2. js-yaml (via @istanbuljs/load-nyc-config)
**Package:** `js-yaml <=4.1.1`  
**Severity:** MODERATE  
**Issue:** Quadratic-complexity DoS in merge key handling via repeated aliases (GHSA-h67p-54hq-rp68)  
**Affected Chain:** 
```
jest (29.7.0)
  └─ jest-cli
     └─ create-jest
        └─ jest-config
           └─ babel-jest
              └─ babel-plugin-istanbul
                 └─ @istanbuljs/load-nyc-config
                    └─ js-yaml <=4.1.1
```

**Current Status:** Transitive dependency  
**Fix Available:** `npm audit fix --force` (requires jest upgrade to 25.0.0 - breaking change)  
**Recommendation:** Upgrade jest to 30.4.2 instead (non-breaking, more current)

#### 3-10. Jest Ecosystem Vulnerabilities
**Affected Packages:**
- @jest/core (>=25.1.0)
- @jest/reporters (>=25.1.0)
- @jest/transform (>=25.1.0)
- @jest/expect (all versions)
- @jest/globals (>=28.0.0-alpha.0)
- jest-config (all versions via js-yaml)
- jest-runner (>=25.1.0)
- jest-runtime (>=25.1.0)
- jest-snapshot (>=27.0.0-next.0)
- jest-resolve-dependencies (>=27.0.0-next.0)
- babel-jest (>=25.1.0)
- babel-plugin-istanbul (>=6.0.0-beta.0)
- create-jest (>=29.7.0)

**Severity:** MODERATE  
**Root Cause:** Cascading from js-yaml vulnerability  
**Current:** jest 29.7.0  
**Recommendation:** Upgrade to jest 30.4.2

---

### Low Severity (1)

#### 4. @babel/core
**Package:** `@babel/core <=7.29.0`  
**Severity:** LOW  
**Issue:** Arbitrary File Read via sourceMappingURL Comment (GHSA-4x5r-pxfx-6jf8)  
**CVSS Score:** 3.2/10 (Low impact)  
**CWE:** CWE-22 (Path Traversal), CWE-200 (Information Exposure)  
**Impact:** Local file system information disclosure  
**Fix:** `npm audit fix` (available)  
**Current Status:** Transitive dependency through babel-jest chain

---

## Outdated Packages (7 Found)

| Package | Current | Latest | Major Gap | Action |
|---------|---------|--------|-----------|--------|
| 1. **electron** | 39.8.10 | 41.7.1 | 2+ versions | Update (review breaking changes) |
| 2. **jest** | 29.7.0 | 30.4.2 | 1 version | Update (fixes js-yaml chain) |
| 3. **jest-environment-node** | 29.7.0 | 30.4.1 | 1 version | Update (paired with jest) |
| 4. **jest-junit** | 8.0.0 | 16.0.0 | 8 versions | Update (CI reporting) |
| 5. **@playwright/test** | 1.59.1 | 1.61.0 | 2 minor versions | Update |
| 6. **electron-updater** | 6.8.3 | 6.8.9 | 1 patch version | Update |
| 7. **uuid** | 14.0.0 | 14.0.1 | 1 patch version | Update |

---

## Upgrade Plan (Phased Approach)

### Phase 1: Non-Breaking Updates (IMMEDIATE)
These updates resolve vulnerabilities with no breaking changes expected.

**Dependencies to Update:**
```json
{
  "uuid": "^14.0.1",
  "electron-updater": "^6.8.9",
  "@playwright/test": "^1.61.0"
}
```

**Time to Execute:** 15 minutes  
**Testing Required:** Quick smoke test  
**Risk Level:** LOW

**Commands:**
```bash
npm install uuid@^14.0.1 --save
npm install electron-updater@^6.8.9 --save
npm install --save-dev @playwright/test@^1.61.0
```

---

### Phase 2: Jest Ecosystem Upgrade (CRITICAL - Fixes 18 vulnerabilities)
This is the main upgrade targeting js-yaml and jest ecosystem vulnerabilities.

**Dependencies to Update:**
```json
{
  "jest": "^30.4.2",
  "jest-environment-node": "^30.4.1",
  "jest-junit": "^16.0.0"
}
```

**Time to Execute:** 30-45 minutes (including test regression testing)  
**Testing Required:** Full test suite + manual verification  
**Risk Level:** MEDIUM (jest version upgrade, check breaking changes)

**Breaking Changes to Review:**
- jest 29.7.0 → 30.4.2: Check release notes for config changes
- jest-junit 8.0.0 → 16.0.0: Verify CI/CD integrations (GitHub Actions, etc.)

**Commands:**
```bash
npm install --save-dev jest@^30.4.2
npm install --save-dev jest-environment-node@^30.4.1
npm install --save-dev jest-junit@^16.0.0
npm test
npm run test:coverage
npm run test:integration
```

**Expected Outcome:**
- Resolves 18 moderate vulnerabilities (js-yaml chain)
- Removes @babel/core low severity vulnerability
- All jest tests should pass without configuration changes

---

### Phase 3: Electron Update (OPTIONAL - Version gap)
Consider for future release cycle.

**Package to Update:**
```json
{
  "electron": "^41.7.1"
}
```

**Time to Execute:** 1-2 hours (build + full testing)  
**Testing Required:** Full E2E testing, rebuild native modules  
**Risk Level:** MEDIUM-HIGH (major version jump from 39.x to 41.x)

**Breaking Changes to Review:**
- Electron 39.8.10 → 41.7.1: Major version bump (likely API changes)
- Review Electron release notes for deprecations
- Test Chromium compatibility with existing profiles/evasion modules

**Recommendation:** Schedule this for next release cycle with dedicated testing time.

---

## Vulnerability Resolution Summary

### By Phase Execution

**After Phase 1 (Non-Breaking):**
- Vulnerabilities Fixed: 0 (Phase 1 doesn't target vulnerabilities)
- Remaining: 20 vulnerabilities
- Status: Improved package freshness

**After Phase 2 (Jest Ecosystem):**
- Vulnerabilities Fixed: 19 (all js-yaml chain + @babel/core)
- Remaining: 1 (undici)
- Status: 95% complete, major vulnerability resolved

**After Phase 3 (Electron):**
- Vulnerabilities Fixed: 0 (Electron not vulnerable)
- Remaining: 1 (undici)
- Note: Electron update is for features/performance, not security

### Undici Vulnerability (Final Item)

**Package:** `undici <=6.26.0`  
**Status:** Cannot be directly updated (transitive dependency)  
**Current Location:** node_modules/undici  
**Affected By:** Node.js core, global-agent, or similar packages  

**Resolution Options:**
1. **Automatic:** `npm audit fix` handles this automatically
2. **Manual:** Identify and update package that depends on undici
3. **Force:** `npm audit fix --force` (may cause other issues)

**Action Plan:**
```bash
# After Phase 1 & 2 complete, run:
npm audit fix
# This will update undici to the fixed version
```

---

## Testing & Verification Strategy

### Pre-Upgrade Baseline
```bash
npm audit          # Document current state
npm test           # Record baseline test results
npm run test:coverage
```

### Phase 1 Testing (15 min)
```bash
npm install uuid@^14.0.1 electron-updater@^6.8.9 @playwright/test@^1.61.0
npm test           # Quick regression
npm audit          # Verify no regressions
```

### Phase 2 Testing (45 min)
```bash
npm install --save-dev jest@^30.4.2 jest-environment-node@^30.4.1 jest-junit@^16.0.0
npm test           # Full test suite
npm run test:unit
npm run test:integration
npm run test:bot-detection
npm audit          # Verify 19 vulnerabilities resolved
```

### Phase 3 Testing (2 hours - if executing)
```bash
npm install electron@^41.7.1
npm run build
npm test
npm run test:e2e
# Verify all evasion modules work correctly
```

### Final Verification
```bash
npm audit          # Should show 0 vulnerabilities
npm outdated       # Review remaining outdated packages
npm list --depth=0 # Verify package versions
```

---

## Implementation Schedule

| Phase | Task | Duration | Effort | Dependencies |
|-------|------|----------|--------|--------------|
| 1 | Non-breaking updates (uuid, electron-updater, @playwright/test) | 15 min | LOW | None |
| 2 | Jest ecosystem upgrade | 45 min | MEDIUM | Phase 1 complete |
| 3 | (Optional) Electron major version | 2 hours | HIGH | Phase 1 & 2 complete |
| - | Final verification & commit | 10 min | LOW | All phases complete |

**Total Time (Phase 1 & 2):** ~70 minutes  
**Total Time (All Phases):** ~2.5 hours

---

## Risk Assessment

### Phase 1 Risk: **LOW**
- Patch/minor version updates only
- No breaking changes expected
- Easy to rollback if issues occur

### Phase 2 Risk: **MEDIUM**
- Jest major version update (29.x → 30.x)
- jest-junit major version update (8.x → 16.x)
- Requires full test suite validation
- Mitigated by: Comprehensive test coverage (2,500+ tests)

### Phase 3 Risk: **HIGH**
- Electron major version jump (39.x → 41.x)
- Chromium version jump, possible API changes
- Evasion modules may need adjustments
- Recommendation: Schedule separately with dedicated time

---

## Success Criteria

✓ All vulnerabilities resolved (except undici - after Phase 2)  
✓ All 2,500+ tests passing  
✓ No test coverage regressions (>50% threshold maintained)  
✓ Application builds and runs without errors  
✓ `npm audit` shows 0 vulnerabilities (after Phase 2)  
✓ Package versions documented and committed  

---

## Rollback Plan

### If Phase 1 Fails
```bash
git checkout package-lock.json package.json
npm install
```

### If Phase 2 Fails
```bash
npm install --save-dev jest@29.7.0
npm install --save-dev jest-environment-node@29.7.0
npm install --save-dev jest-junit@8.0.0
npm install
```

### If Phase 3 Fails
```bash
npm install electron@39.8.10
npm run build
```

---

## Compliance & Reporting

- **OWASP:** Addresses dependency vulnerabilities (A06:2021 - Vulnerable and Outdated Components)
- **CWE:** Mitigates CWE-22 (Path Traversal), CWE-200 (Information Exposure)
- **CVE:** Resolves vulnerabilities in GHSA advisory ecosystem
- **Audit Trail:** All changes committed with detailed messages

---

## Next Steps

1. **Immediate (Today):**
   - Execute Phase 1 (non-breaking updates)
   - Run full test suite
   - Commit changes

2. **Short-term (Within 48 hours):**
   - Execute Phase 2 (jest ecosystem)
   - Resolve any test failures
   - Final npm audit verification
   - Commit and push

3. **Future (Next release cycle):**
   - Plan Phase 3 (Electron major version)
   - Monitor for new vulnerabilities
   - Schedule regular dependency audits

---

## Appendix: Vulnerability Details

### GHSA References

1. **GHSA-4x5r-pxfx-6jf8** (@babel/core)
   - Type: Arbitrary File Read
   - Vector: Local
   - Requires: Malicious babel configuration
   - CVSS 3.2: Low Impact

2. **GHSA-h67p-54hq-rp68** (js-yaml)
   - Type: Denial of Service
   - Vector: Network
   - Requires: Malicious YAML input
   - CVSS: Moderate

3. **GHSA-p88m-4jfj-68fv** (undici)
   - Type: HTTP Header Injection
   - Vector: Network
   - Requires: Malicious server response
   - CVSS: High

4. **GHSA-vxpw-j846-p89q** (undici)
   - Type: WebSocket DoS
   - Vector: Network
   - Requires: Malicious WebSocket frames
   - CVSS: High

5. **GHSA-35p6-xmwp-9g52** (undici)
   - Type: HTTP Response Poisoning
   - Vector: Network
   - Requires: Malicious keep-alive reuse
   - CVSS: High

6. **GHSA-g8m3-5g58-fq7m** (undici)
   - Type: Set-Cookie SameSite Downgrade
   - Vector: Network
   - Requires: Malicious server response
   - CVSS: Moderate

---

**Report Generated:** 2026-06-20  
**Audit Tool Version:** npm 10.x  
**Next Audit Scheduled:** 2026-07-20 (30 days)
