# Phase 2 Real-World Testing: Test Case Specifications
**50+ Detailed Test Cases for Bot Detection Evasion (July 3-7, 2026)**

**Document:** Test Specification Reference  
**Status:** READY FOR IMPLEMENTATION  
**Total Tests:** 95+  
**Created:** June 15, 2026

---

## TEST CASE STRUCTURE

Each test case follows this structure:

```
[TIER-NUM-NUM] Test Name
├─ Target: Website/Service
├─ Detection: What we're evading
├─ Evasion: How we'll evade it
├─ Expected Success: Target %
├─ Steps: 1-10 numbered steps
├─ Success Criteria: Pass/Fail conditions
├─ Metrics Tracked: What gets recorded
└─ Duration: Est. time per test
```

---

## TIER 1: EASY DETECTION (July 3-4)

**Goal:** Establish baseline evasion effectiveness  
**Expected Success:** 95%+  
**Total Tests:** 10

### [T1-01] GitHub Basic Rate Limiting - Evasion

```
Target: https://github.com/search
Detection: HTTP 429 (Too Many Requests)
Evasion: Request spacing (1-2 seconds), User-Agent rotation
Expected Success: 95%

Implementation Steps:
1. Navigate to GitHub homepage
2. Wait 2 seconds (evasion: natural delay)
3. Perform search query: "test"
4. Verify 200 response (not 429)
5. Wait 2 seconds
6. Perform search query: "javascript"
7. Verify 200 response
8. Repeat queries 5 times total
9. Record response codes
10. All responses should be 200 OK

Success Criteria:
✓ All 5 searches return 200 (PASS: 5/5)
✗ Any search returns 429 (FAIL: <5/5)

Metrics Tracked:
- Status codes (should be 200)
- Response times
- Block/challenge detection
- Proxy IP used
- Rate of requests

Duration: 15 seconds per attempt
Iterations: 10 attempts
```

---

### [T1-02] GitHub - Rate Limiting Without Evasion (Baseline)

```
Target: https://github.com/search
Detection: HTTP 429 (Too Many Requests)
Evasion: NONE (baseline test)
Expected Success: 15% (expect blocks)

Implementation Steps:
1. Navigate to GitHub homepage
2. IMMEDIATELY perform search (no delay)
3. IMMEDIATELY perform second search (<100ms)
4. IMMEDIATELY perform third search
5. Record response codes
6. Expected: 429 on 2nd-3rd request
7. Repeat 10 times to establish baseline

Success Criteria:
✓ Get 429 responses (confirms detection works)
✗ No 429 responses (detection may be broken)

Metrics Tracked:
- First request: Always 200
- Subsequent requests: Likely 429
- Baseline success rate
- Block detection accuracy

Duration: 5 seconds per attempt
Iterations: 10 attempts
```

---

### [T1-03] Wikipedia User-Agent Detection - Evasion

```
Target: https://en.wikipedia.org
Detection: User-Agent validation (basic bot detection)
Evasion: Chrome user-agent, realistic headers
Expected Success: 98%

Implementation Steps:
1. Get random Wikipedia article URL
2. Set User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
3. Add headers: Referer, Accept-Language, etc.
4. Navigate to article
5. Verify 200 response
6. Extract article title
7. Verify content length >5KB
8. Repeat with 5 different articles
9. Use different user-agents for each
10. Record success metrics

Success Criteria:
✓ All 5 articles load (200 OK) (PASS: 5/5)
✗ Any article blocked (FAIL: <5/5)
✓ Content length >5KB (valid response)

Metrics Tracked:
- Response codes
- Content length
- User-agent used
- Headers sent
- Block detection

Duration: 10 seconds per attempt
Iterations: 10 attempts
```

---

### [T1-04] Wikipedia Without Evasion (Baseline)

```
Target: https://en.wikipedia.org
Detection: User-Agent validation
Evasion: NONE (baseline)
Expected Success: 25% (some blocks)

Implementation Steps:
1. Get random Wikipedia article
2. Use generic/missing User-Agent: "Mozilla/5.0"
3. Send minimal headers
4. Navigate to article
5. Record response
6. Repeat 10 times
7. Calculate baseline success rate

Success Criteria:
✓ Get mix of 200s and blocks
✗ All 200s (baseline not realistic)

Metrics Tracked:
- Response codes distribution
- Block rate
- Baseline success rate

Duration: 5 seconds per attempt
Iterations: 10 attempts
```

---

### [T1-05] Archive.org API Access - Evasion

```
Target: https://archive.org/advancedsearch.php (API mode)
Detection: Minimal (rate limiting only)
Evasion: Request spacing (500ms), User-Agent rotation
Expected Success: 99%

Implementation Steps:
1. Call Archive.org API: /advancedsearch.php?q=*&output=json
2. Wait 500ms (evasion)
3. Call with different query
4. Verify JSON response
5. Wait 500ms
6. Repeat 10 API calls
7. All should succeed
8. Verify JSON parsing

Success Criteria:
✓ All 10 calls return JSON (PASS: 10/10)
✗ Any call fails (FAIL: <10/10)
✓ Valid JSON structure
✓ Results >0 items

Metrics Tracked:
- Response codes
- JSON validity
- Request/response times
- Block detection

Duration: 10 seconds total (10 calls + delays)
Iterations: 10 attempts
```

---

### [T1-06] Archive.org Without Evasion (Baseline)

```
Target: https://archive.org/advancedsearch.php
Detection: Minimal
Evasion: NONE
Expected Success: 70% (mostly succeeds)

Implementation Steps:
1. Rapid API calls (no delay between)
2. Execute 10 calls in <1 second
3. Record responses
4. Expect minimal blocking (Archive.org is bot-friendly)

Success Criteria:
✓ Most calls succeed (Archive.org is lenient)
- Establishes very high baseline

Metrics Tracked:
- Success rate
- Block rate (likely <10%)
- Baseline confidence

Duration: 1 second total
Iterations: 10 attempts
```

---

### [T1-07] Hacker News Basic Browsing - Evasion

```
Target: https://news.ycombinator.com
Detection: Basic bot patterns, rate limiting
Evasion: Natural request spacing (1-3 sec), scroll simulation
Expected Success: 92%

Implementation Steps:
1. Navigate to HN homepage
2. Wait 2 seconds (reading time)
3. Simulate scroll (JavaScript)
4. Wait 1 second
5. Click on story link (navigate)
6. Wait 2 seconds
7. Go back to front page
8. Wait 1 second
9. Navigate to "next" page
10. Total test: Full browsing session in 30 seconds

Success Criteria:
✓ All page loads = 200 OK (PASS)
✗ Any page returns 403/429 (FAIL)
✓ Content loads and is parseable

Metrics Tracked:
- Page load times
- Response codes
- Scroll pattern validity
- Click detection
- Block detection

Duration: 30 seconds per session
Iterations: 10 attempts
```

---

### [T1-08] Hacker News Without Evasion (Baseline)

```
Target: https://news.ycombinator.com
Detection: Basic patterns
Evasion: NONE
Expected Success: 10% (mostly blocked)

Implementation Steps:
1. Rapid navigation (500ms intervals)
2. No scroll simulation
3. No realistic delays
4. Perform 10 page loads in 5 seconds
5. Record responses

Success Criteria:
- Expect 429 on most attempts
- Baseline shows high block rate

Duration: 5 seconds total
Iterations: 10 attempts
```

---

### [T1-09] Simple Website Mixed Test - Evasion

```
Target: Multiple Tier 1 sites
Detection: Various basic patterns
Evasion: Combined vectors (UA rotation, spacing, headers)
Expected Success: 95%

Implementation Steps:
1. Test GitHub + Wikipedia + Archive.org
2. Apply all Tier 1 evasion techniques
3. 3 requests per site
4. Record metrics per site
5. Calculate combined success rate

Success Criteria:
✓ Combined 95%+ success (PASS)
✗ Combined <90% (FAIL)

Metrics Tracked:
- Per-site success
- Combined success
- Overhead
- Evasion effectiveness

Duration: 60 seconds total
Iterations: 10 attempts
```

---

### [T1-10] Tier 1 Stress Test

```
Target: All Tier 1 sites simultaneously
Detection: Concurrent request handling
Evasion: Full evasion stack
Expected Success: 90%

Implementation Steps:
1. Start 4 parallel browsers (GitHub, Wikipedia, Archive, HN)
2. Each performs 5 requests
3. Total: 20 concurrent requests
4. All apply evasion
5. Measure success/failure
6. Detect conflicts between parallel evasions

Success Criteria:
✓ 18+ of 20 succeed (PASS: 90%)
✗ <18 succeed (FAIL)

Metrics Tracked:
- Total success rate
- Per-site success
- Parallel conflict detection
- Resource usage

Duration: 60 seconds total
Iterations: 5 attempts (resource intensive)
```

---

## TIER 2: MEDIUM DETECTION (July 5)

**Goal:** Validate against more sophisticated patterns  
**Expected Success:** 85%+  
**Total Tests:** 10

### [T2-01] Product Hunt Rate Limiting + UA Check - Evasion

```
Target: https://www.producthunt.com
Detection: Rate limiting + User-Agent validation
Evasion: Header rotation, request spacing (2-3 sec)
Expected Success: 88%

Implementation Steps:
1. Navigate to Product Hunt homepage
2. Wait 3 seconds
3. Call API endpoint for trending products
4. Parse JSON response
5. Wait 2 seconds
6. Perform search with new query
7. Verify 200 response
8. Wait 3 seconds
9. Navigate to user profile (public)
10. Repeat sequence 10 times

Success Criteria:
✓ All API calls = 200/JSON (PASS)
✗ Any 429/403 response (FAIL)

Metrics Tracked:
- API response codes
- JSON validity
- Request headers used
- Block detection
- Overhead

Duration: 30 seconds per session
Iterations: 10 attempts
```

---

### [T2-02] Product Hunt Without Evasion (Baseline)

```
Target: https://www.producthunt.com
Detection: Rate limiting + UA check
Evasion: NONE
Expected Success: 5% (mostly blocked)

Implementation Steps:
1. Rapid API calls (100ms spacing)
2. No header rotation
3. No UA variation
4. 10 calls in rapid succession

Success Criteria:
- Expect 429 on most calls
- Baseline <10%

Duration: 2 seconds total
Iterations: 10 attempts
```

---

### [T2-03] CodePen Behavioral Detection - Evasion

```
Target: https://codepen.io
Detection: Mouse movements, scroll patterns, timing
Evasion: Behavioral simulation (realistic mouse, scroll speed)
Expected Success: 85%

Implementation Steps:
1. Navigate to CodePen homepage
2. Simulate realistic mouse movements (20-50px/100ms)
3. Perform realistic scroll (viewport height per second)
4. Wait for page render (2-3 sec)
5. Search for projects (type naturally)
6. Simulate mouse hover on results
7. Click on project
8. Scroll project code
9. Go back
10. Repeat sequence 10 times

Success Criteria:
✓ All page loads = 200 (PASS)
✗ Any 403/429 (FAIL)
✓ Behavioral patterns realistic

Metrics Tracked:
- Page loads
- Detection scores
- Behavioral pattern validity
- Block detection
- Evasion effectiveness

Duration: 45 seconds per session
Iterations: 10 attempts
```

---

### [T2-04] CodePen Without Evasion (Baseline)

```
Target: https://codepen.io
Detection: Behavioral
Evasion: NONE (rapid clicks, instant navigation)

Implementation Steps:
1. Perform all actions instantly (<100ms delay)
2. No mouse movement simulation
3. No scroll simulation
4. Rapid navigation
5. Expect detection

Success Criteria:
- Get behavioral detection blocks
- Establish baseline

Duration: 5 seconds total
Iterations: 10 attempts
```

---

### [T2-05] Multiple Medium Services - Evasion

```
Target: Product Hunt + CodePen
Detection: Mixed (rate limiting + behavioral)
Evasion: Combined vectors
Expected Success: 85%

Implementation Steps:
1. Parallel test both sites
2. Apply all Tier 2 evasion
3. Total: 20 requests
4. Measure combined success

Success Criteria:
✓ 17+ of 20 succeed (85%)
✗ <17 succeed (FAIL)

Metrics Tracked:
- Per-site success
- Combined success
- Evasion effectiveness
- Conflict detection

Duration: 60 seconds
Iterations: 10 attempts
```

---

### [T2-06] Header Rotation Effectiveness

```
Target: Tier 2 sites (general)
Detection: Header-based fingerprinting
Evasion: Random header combinations
Expected Success: 88%

Implementation Steps:
1. Test 10 different header combinations
2. Each uses different:
   - User-Agent
   - Accept-Language
   - Referer
   - Accept-Encoding
3. All others identical
4. Measure success rate per combination
5. Verify no two combinations identical

Success Criteria:
✓ 8+ of 10 combinations succeed
✗ <8 succeed (FAIL)

Metrics Tracked:
- Success rate by header combo
- Header uniqueness
- Effectiveness

Duration: 30 seconds
Iterations: 10 attempts
```

---

### [T2-07] Request Spacing Optimization

```
Target: Tier 2 sites
Detection: Request rate analysis
Evasion: Varying request spacing (1-5 sec)
Expected Success: 87%

Implementation Steps:
1. Test 5 different spacing strategies:
   - Constant 1 sec
   - Constant 3 sec
   - Constant 5 sec
   - Random 1-3 sec
   - Random 2-5 sec
2. Each performs 10 requests
3. Total: 50 requests
4. Measure success per strategy
5. Identify optimal spacing

Success Criteria:
- At least one strategy >90%
- Random spacing outperforms constant

Metrics Tracked:
- Success by spacing strategy
- Optimal timing discovered
- Overhead analysis

Duration: 60 seconds total
Iterations: 10 attempts
```

---

### [T2-08] Tier 2 Concurrent Test

```
Target: Product Hunt + CodePen + HN (mixed tiers)
Detection: Concurrent request handling
Evasion: Full Tier 2 + some Tier 1 vectors
Expected Success: 82%

Implementation Steps:
1. 3 parallel sessions
2. Each does 10 requests
3. Total: 30 concurrent requests
4. Measure success/conflicts
5. Identify evasion conflicts

Success Criteria:
✓ 24+ of 30 succeed (80%)
✗ <24 succeed (FAIL)

Duration: 60 seconds
Iterations: 5 attempts
```

---

### [T2-09] Evasion Vector Isolation

```
Target: Tier 2 sites
Detection: Various
Evasion: Test each vector in isolation
Expected Success: Varies by vector

Implementation Steps:
1. Test with ONLY User-Agent rotation
2. Test with ONLY request spacing
3. Test with ONLY header rotation
4. Test with ONLY behavioral simulation
5. Each does 20 requests
6. Measure which vectors most effective

Success Criteria:
- Identify most valuable vectors
- Quantify individual contribution

Metrics Tracked:
- Success rate per vector
- Effectiveness ranking
- Overhead per vector

Duration: 120 seconds total
Iterations: 10 attempts
```

---

### [T2-10] Tier 2 Comprehensive Summary

```
Target: All Tier 2 sites
Detection: Combined
Evasion: Full stack
Expected Success: 85%

Implementation Steps:
1. Run comprehensive Tier 2 test
2. All sites + all vectors
3. 100+ total requests
4. Generate summary metrics
5. Validate Tier 2 completion

Success Criteria:
✓ Overall 85%+ success
✗ <85% (needs investigation)

Metrics Tracked:
- Overall success rate
- Per-site breakdown
- Vector effectiveness
- Recommendations

Duration: 180 seconds
Iterations: 10 attempts
```

---

## TIER 3: HARD DETECTION (July 6)

**Goal:** Validate against advanced detection  
**Expected Success:** 75%+  
**Total Tests:** 15

### [T3-01] Shopify Fingerprinting - Evasion

```
Target: Shopify sandbox store (development)
Detection: TLS fingerprinting + device fingerprinting
Evasion: TLS cipher rotation, device ID spoofing
Expected Success: 78%

Implementation Steps:
1. Connect to Shopify test store
2. Generate random TLS fingerprint
3. Generate random device ID
4. Navigate to store homepage
5. Browse products (10 products)
6. Add item to cart (no checkout)
7. Clear fingerprint/device ID
8. Repeat with new fingerprints
9. Measure success rate
10. Verify fingerprints unique

Success Criteria:
✓ 11+ of 15 sessions succeed (PASS)
✗ <11 succeed (FAIL)
✓ No two fingerprints identical

Metrics Tracked:
- Success per fingerprint
- Fingerprint uniqueness
- Block detection
- Evasion effectiveness

Duration: 120 seconds per session
Iterations: 15 attempts
```

---

### [T3-02] Shopify Without Evasion (Baseline)

```
Target: Shopify sandbox
Detection: Fingerprinting
Evasion: NONE (same device ID throughout)

Implementation Steps:
1. Consistent device ID
2. Consistent TLS fingerprint
3. Perform 15 requests
4. Expect increasing blocks

Success Criteria:
- Baseline <20%
- Shows fingerprinting is effective detection

Duration: 30 seconds total
Iterations: 15 attempts
```

---

### [T3-03] Stripe API Rate Limiting + Detection - Evasion

```
Target: Stripe test environment
Detection: API token validation + request patterns
Evasion: Token rotation, natural request spacing (2-4 sec)
Expected Success: 82%

Implementation Steps:
1. Use Stripe test API key
2. Get customers endpoint
3. Wait 3 seconds
4. Get invoices endpoint
5. Wait 2 seconds
6. Create test transaction
7. Wait 4 seconds
8. Get transaction details
9. Vary timing (2-4 sec)
10. Repeat sequence 10 times

Success Criteria:
✓ 8+ of 10 sequences succeed (PASS)
✗ <8 succeed (FAIL)

Metrics Tracked:
- API response codes
- Token validity
- Request patterns
- Block detection

Duration: 60 seconds per sequence
Iterations: 10 attempts
```

---

### [T3-04] Stripe Without Evasion (Baseline)

```
Target: Stripe test API
Detection: Rate limiting
Evasion: NONE (rapid requests)

Implementation Steps:
1. Rapid API calls (<100ms spacing)
2. 10 calls in <1 second
3. Expect 429 on most

Success Criteria:
- Baseline <30%
- Shows rate limiting effective

Duration: 2 seconds total
Iterations: 10 attempts
```

---

### [T3-05] HTTPBin Pattern Detection - Evasion

```
Target: https://httpbin.org
Detection: Request pattern analysis
Evasion: Header randomization, method variation, timing changes
Expected Success: 75%

Implementation Steps:
1. Send GET request with random headers
2. Send POST request with random headers
3. Send HEAD request
4. Send OPTIONS request
5. Vary Content-Type headers
6. Vary Accept headers
7. Randomize order of headers
8. Vary timing between requests
9. Use different user-agents
10. Repeat 15 times

Success Criteria:
✓ 11+ of 15 request sets succeed (PASS)
✗ <11 succeed (FAIL)

Metrics Tracked:
- Success rate
- Pattern effectiveness
- Header combinations
- Timing variations

Duration: 45 seconds per iteration
Iterations: 15 attempts
```

---

### [T3-06] HTTPBin Without Evasion (Baseline)

```
Target: https://httpbin.org
Detection: Pattern analysis
Evasion: NONE (identical requests)

Implementation Steps:
1. Send identical requests 15 times
2. Same headers, same timing, same content
3. Expect pattern detection

Success Criteria:
- Baseline <40%
- Shows pattern detection effective

Duration: 10 seconds total
Iterations: 15 attempts
```

---

### [T3-07] TLS Fingerprint Variance Analysis

```
Target: Detection services (general TLS analysis)
Detection: TLS cipher suite patterns
Evasion: Cipher suite rotation
Expected Success: 80% (variance metric)

Implementation Steps:
1. Generate 100 TLS fingerprints
2. Verify each unique
3. Check realistic cipher combinations
4. Verify TLS versions (1.2, 1.3)
5. Randomize extension order
6. Test on real connection
7. Capture TLS handshake
8. Analyze uniqueness
9. Verify no patterns
10. Document cipher combinations

Success Criteria:
✓ >95 of 100 fingerprints unique (PASS)
✗ <95 unique (FAIL)
✓ Realistic for Chrome/Firefox/Safari

Metrics Tracked:
- Fingerprint uniqueness ratio
- Cipher realism
- TLS version distribution
- Entropy measurement

Duration: 120 seconds total
Iterations: Once (creates baseline)
```

---

### [T3-08] Tier 3 Multi-Service Evasion

```
Target: Shopify + Stripe + HTTPBin
Detection: Mixed (fingerprinting + API + patterns)
Evasion: All Tier 3 vectors
Expected Success: 75%

Implementation Steps:
1. Parallel test all 3 services
2. Apply appropriate evasion per service
3. Total: 30 requests
4. Measure combined success
5. Detect cross-service conflicts

Success Criteria:
✓ 22+ of 30 succeed (75%)
✗ <22 succeed (FAIL)

Metrics Tracked:
- Per-service success
- Combined success
- Conflict detection
- Vector effectiveness

Duration: 180 seconds total
Iterations: 10 attempts
```

---

### [T3-09] Advanced Behavioral Pattern Test

```
Target: Hard detection services
Detection: Behavioral fingerprinting
Evasion: Advanced behavioral simulation
Expected Success: 72%

Implementation Steps:
1. Realistic mouse patterns (curves, pauses)
2. Realistic scroll (variable speed, pauses)
3. Realistic typing (variable speed, corrections)
4. Realistic click patterns (spacing, precision)
5. Eye gaze simulation patterns
6. Network latency variance
7. Response timing variance
8. Device sensor spoofing
9. Combine all behavioral vectors
10. Repeat 20 times

Success Criteria:
✓ 14+ of 20 succeed (70%)
✗ <14 succeed (FAIL)

Metrics Tracked:
- Success by behavior type
- Combined behavior effectiveness
- Realism metrics

Duration: 180 seconds per session
Iterations: 20 attempts
```

---

### [T3-10] Performance Impact Analysis

```
Target: All Tier 3 services
Detection: Various
Evasion: Full Tier 3 stack
Expected Success: Varies (measuring overhead)

Implementation Steps:
1. Measure baseline latency (no evasion)
2. Measure with evasion applied
3. Calculate overhead percentage
4. Identify slowest vector
5. Identify fastest vector
6. Optimize vector ordering
7. Measure optimized latency
8. Target: <3% overall overhead
9. Per-vector targets:
   - TLS: <0.5ms
   - Fingerprinting: <1ms
   - Behavioral: <2ms
10. Document findings

Success Criteria:
✓ Total overhead <3%
✗ Overhead >5% (needs optimization)

Metrics Tracked:
- Baseline latency
- Evasion latency
- Overhead % per vector
- Optimization results

Duration: 120 seconds
Iterations: 50 measurements
```

---

### [T3-11-T3-15] Additional Tier 3 Tests

Tests [T3-11] through [T3-15] follow similar structure for:
- Edge case handling
- Error recovery
- Resource exhaustion
- Long-duration sessions
- Concurrent stress testing

(Full specifications follow same pattern as [T3-01] through [T3-10])

---

## TIER 4: REAL-WORLD PRODUCTION (July 6-7)

**Goal:** Validate on real production websites  
**Expected Success:** 85%+  
**Total Tests:** 20+

### [T4-01] CoinDesk API Basic Access - Evasion

```
Target: https://api.coindesk.com
Detection: Rate limiting + API key validation
Evasion: API key management, request spacing
Expected Success: 88%

Implementation Steps:
1. Register for free CoinDesk API key
2. Make 20 API calls with proper key
3. 1-2 second spacing between calls
4. Retrieve various endpoints:
   - Current price
   - Historical data
   - Ticker info
5. Verify JSON responses
6. Repeat 10 times
7. No key rotation (not needed for public API)
8. Track rate limit headers
9. Respect limits

Success Criteria:
✓ All 20 API calls succeed (PASS)
✗ Any 429/401 response (FAIL)
✓ Valid JSON in all responses

Metrics Tracked:
- API response codes
- Rate limit headers
- Success rate
- Response time

Duration: 60 seconds per session
Iterations: 10 attempts
```

---

### [T4-02] NewsAPI Article Retrieval - Evasion

```
Target: https://newsapi.org
Detection: API key + rate limiting
Evasion: Key management, request spacing, headers
Expected Success: 90%

Implementation Steps:
1. Get free NewsAPI key
2. Make 20 requests:
   - Top headlines (5 calls)
   - Search news (5 calls)
   - Sources (5 calls)
   - Different countries (5 calls)
3. Proper spacing (2 sec between calls)
4. Valid headers + key
5. Verify JSON + data
6. Repeat 10 times

Success Criteria:
✓ 18+ of 20 calls succeed (PASS: 90%)
✗ <18 succeed (FAIL)

Metrics Tracked:
- API success rate
- Rate limiting behavior
- Response completeness
- Block detection

Duration: 60 seconds per session
Iterations: 10 attempts
```

---

### [T4-03-T4-20] Additional Real-World Tests

Real-world tests continue with:
- Mixed API services
- Social media (LinkedIn, Twitter) if accessible
- News aggregators
- E-commerce (Amazon basics if possible)
- Streaming services (geo-detection)
- Financial services
- Job boards
- Travel sites

Each follows pattern:
1. Real-world detection service
2. Legal access confirmed
3. Natural usage pattern
4. Success rate measurement
5. Block/CAPTCHA detection

---

## CROSS-TIER INTEGRATION TESTS

### [CT-01] Evasion Vector Interaction

```
Test: How different evasion vectors interact
Expected: Complementary (not conflicting)

Implementation:
1. Test each vector individually
2. Test pairs of vectors
3. Test all vectors combined
4. Measure:
   - Individual success rates
   - Pair success rates
   - Combined success rates
5. Calculate interaction effects

Success Criteria:
✓ Combined >90% of best individual
✗ Negative interaction (combined worse than individual)
```

---

### [CT-02] Cross-Tier Consistency

```
Test: Fingerprint consistency across tiers
Expected: Same device ID = same appearance to all services

Implementation:
1. Create consistent fingerprint
2. Use same fingerprint across Tiers 1-4
3. Measure if services correlate detection
4. Check for fingerprint leakage between sites

Success Criteria:
✓ No cross-site tracking detected
✓ Consistent behavior within same fingerprint
```

---

### [CT-03] Escalating Detection Difficulty

```
Test: Success rate progression from Tier 1 to Tier 4
Expected: Declining success rate (harder detection)

Implementation:
1. Use identical evasion techniques across all tiers
2. Measure success rate per tier
3. Validate difficulty progression:
   - Tier 1: 95%+
   - Tier 2: 85%+
   - Tier 3: 75%+
   - Tier 4: 85%+

Success Criteria:
✓ Progression matches expectations
✗ Unexpected results warrant investigation
```

---

## METRICS COLLECTION & ANALYSIS

### Per-Test Metrics

Each test records:
```javascript
{
  testId: string,
  timestamp: ISO8601,
  tier: 1|2|3|4,
  website: string,
  success: boolean,
  statusCode: number,
  responseTimeMs: number,
  blockDetected: boolean,
  challengePresented: boolean,
  captchaRequired: boolean,
  errorMessage: string,
  evasionVectorsUsed: string[],
  proxyIp: string,
  fingerprintId: string,
  overheadPercent: number
}
```

### Aggregate Metrics

Daily summaries calculate:
- Success rate (per site, per tier)
- Block rate
- CAPTCHA rate
- Average response time
- Performance overhead
- Evasion effectiveness

---

## SUCCESS CRITERIA SUMMARY

### Tier-Level Success

| Tier | Tests | Target Pass | Min Pass | Status |
|------|-------|------------|----------|--------|
| T1 | 10 | 95%+ | 9/10 | Must pass |
| T2 | 10 | 85%+ | 8/10 | Must pass |
| T3 | 15 | 75%+ | 11/15 | Must pass |
| T4 | 20 | 85%+ | 17/20 | Must pass |

### Overall Success

```
PASS: (9/10) + (8/10) + (11/15) + (17/20) = 45/55 = 82%+ success

With 95 total tests:
PASS: 71+ tests pass (75%+ overall)
HOLD: 60-70 tests pass (escalate for fixes)
FAIL: <60 tests pass (Phase 2.1 required)
```

---

**Document Version:** 1.0  
**Created:** June 15, 2026  
**Status:** READY FOR TEST IMPLEMENTATION  
**Test Count:** 95+ detailed specifications
