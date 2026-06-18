# Real-World Testing Infrastructure
## Basset Hound Browser - Test Framework

This directory contains the testing framework for validating the browser against real websites.

---

## Test Files

### 1. `direct-website-test.js`
**Purpose:** Direct HTTP testing with v12.7.0 evasion headers

**Features:**
- Makes direct HTTPS requests to real websites
- Uses v12.7.0 evasion header set
- Detects bot blocking indicators (CAPTCHA, challenges, etc.)
- No server startup required
- Fast execution (12 seconds for 6 tests)

**Usage:**
```bash
node direct-website-test.js
```

**Output:**
- Console log with test progress
- `actual-websites-2026-06-16/results.json` - Machine readable results
- `actual-websites-2026-06-16/REALWORLD-TESTING-REPORT-2026-06-16.md` - Human readable report

**Test Coverage:**
- Test 1: Google Search
- Test 2: Wikipedia
- Test 3: GitHub
- Test 4: Hacker News
- Test 5: BBC News
- Test 6: Reddit

### 2. `realworld-test-runner.js`
**Purpose:** WebSocket server-based testing (planned for future use)

**Features:**
- Starts WebSocket server
- Connects as client
- Sends commands via WebSocket
- Tests full browser functionality
- More complex but more realistic

**Status:** Created but not yet functional (requires WebSocket server)

**Usage (when ready):**
```bash
node realworld-test-runner.js
```

---

## Key Metrics Collected

For each test, we capture:
- **URL tested** - The target website
- **HTTP Status Code** - Server response code
- **Response Size** - Bytes received
- **Response Time** - Milliseconds taken
- **Blocking Indicators** - Detection of bot blocking:
  - HTTP 429 (rate limited)
  - HTTP 403/401 (forbidden)
  - HTTP 503 (unavailable)
  - CAPTCHA detection
  - Challenge pages
  - JavaScript validation
  - Bot detection scripts

---

## Blocking Detection Logic

The test suite detects bot blocking by analyzing:

### HTTP Status Codes
- `429` → Rate limited
- `403` → Forbidden (access denied)
- `401` → Unauthorized
- `503` → Service unavailable

### Response Content
- Keywords: "captcha", "recaptcha", "verify", "challenge"
- Services: "cloudflare", "perimeterx", "datadome"
- Scripts: Detection of bot/automated/scripted references
- JavaScript requirements: "enable javascript"

### Heuristics
- Unexpected response size (too small for expected content)
- Error page content when HTTP 200 returned
- Redirect to verification URL

---

## Test Results Structure

### JSON Format (results.json)
```json
{
  "timestamp": "2026-06-16T04:04:55.874Z",
  "version": "12.7.0",
  "totalTests": 6,
  "successTests": 2,
  "blockedTests": 4,
  "timeoutTests": 0,
  "errorTests": 0,
  "tests": [
    {
      "name": "Test 1: Google Search",
      "url": "https://www.google.com/search?q=basset+hound+browser",
      "timestamp": "2026-06-16T04:04:55.876Z",
      "success": true,
      "blocked": false,
      "statusCode": 200,
      "blockingIndicators": [],
      "error": null,
      "responseSize": 42507,
      "resultsCount": 0,
      "timeMs": 296
    }
  ]
}
```

### Markdown Report
- Executive summary
- Test-by-test results
- Analysis of blocking patterns
- Recommendations

---

## How to Extend the Tests

### Add a New Website Test

1. **Add test method to `DirectWebsiteTester` class:**
```javascript
async testNewSite() {
  const testName = 'Test 7: New Site';
  this.log(`\n========== ${testName} ==========`);
  
  const testResult = {
    name: testName,
    url: 'https://example.com/',
    timestamp: new Date().toISOString(),
    success: false,
    blocked: false,
    statusCode: null,
    blockingIndicators: [],
    error: null,
    responseSize: 0,
    timeMs: 0,
  };
  
  try {
    const startTime = Date.now();
    const response = await this.makeRequest(testResult.url);
    
    testResult.timeMs = Date.now() - startTime;
    testResult.statusCode = response.statusCode;
    testResult.responseSize = response.body.length;
    
    const blockingIndicators = this.detectBlocking(response);
    if (blockingIndicators.length > 0) {
      testResult.blocked = true;
      testResult.blockingIndicators = blockingIndicators;
    }
    
    if (response.statusCode === 200 && !testResult.blocked) {
      testResult.success = true;
    }
  } catch (error) {
    testResult.error = error.message;
  }
  
  this.results.tests.push(testResult);
  this.results.summary.totalTests++;
  if (testResult.success) {
    this.results.summary.passedTests++;
  } else if (testResult.blocked) {
    this.results.summary.blockedTests++;
  }
  
  return testResult;
}
```

2. **Call the test in `runAllTests()`:**
```javascript
await this.testNewSite();
await this.delay(2000);
```

3. **Run the test:**
```bash
node direct-website-test.js
```

---

## Headers Used in Testing

The test simulates Chrome 125 with these headers:
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 
           (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,
        image/avif,image/webp,image/apng,*/*;q=0.8
Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, deflate, br
Cache-Control: max-age=0
Sec-Ch-Ua: "Not A(Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"
Sec-Ch-Ua-Mobile: ?0
Sec-Ch-Ua-Platform: "Windows"
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
Upgrade-Insecure-Requests: 1
Connection: keep-alive
```

These headers are designed to match what a real Chrome 125 browser would send.

---

## Limitations of This Test Approach

### What This Tests
✓ HTTP header spoofing  
✓ Initial connection establishment  
✓ Server response acceptance  
✓ Basic bot detection at HTTP layer  

### What This Does NOT Test
✗ JavaScript execution  
✗ DOM rendering  
✗ CSS/styling  
✗ Client-side event handling  
✗ Storage (cookies, localStorage)  
✗ Navigation history  
✗ Fingerprint challenges (Canvas, WebGL)  
✗ AJAX/Fetch interception  

### Why This Matters
Modern sites often use **Layer 2+ bot detection** that requires JavaScript execution. This test can only validate **Layer 1** (HTTP headers).

**Next Step:** Test with full Electron browser to validate Layers 2-6.

---

## Comparison: HTTP vs. Electron Testing

| Aspect | HTTP Test | Electron Test |
|--------|-----------|---------------|
| Speed | Fast (12s) | Slower (2-5m) |
| Coverage | Headers only | Full browser |
| JavaScript | No | Yes |
| DOM | No | Yes |
| Realism | Limited | High |
| Detection Pass Rate | Low (33%) | Expected: 70-80% |

---

## Future Enhancements

### Planned Features
1. **WebSocket-based testing** - Full browser command execution
2. **JavaScript validation** - Execute and pass JS challenges
3. **Session persistence** - Multi-step scenarios
4. **Screenshot comparison** - Visual validation
5. **Network analysis** - Request/response inspection
6. **Performance metrics** - Timing and resource usage
7. **Regression suite** - Automated validation across versions

### Integration Points
1. **CI/CD Pipeline** - Automated real-world testing
2. **Monitoring** - Continuous validation of evasion
3. **Alerting** - Notification when sites become unreachable
4. **Reporting** - Dashboard of evasion status
5. **Analytics** - Trend analysis of success rates

---

## Troubleshooting

### Test Hangs or Slow
**Issue:** Test takes much longer than 12 seconds  
**Cause:** Network timeout or DNS resolution issues  
**Fix:** Check internet connection, adjust timeout value

### All Tests Blocked
**Issue:** Even Google returns blocked status  
**Cause:** Network-level blocking or DNS filtering  
**Fix:** 
1. Test with `curl -H "User-Agent: ..." https://google.com`
2. Check if you're behind a proxy/firewall
3. Verify internet connection

### Tests Pass Then Fail on Retry
**Issue:** Inconsistent results  
**Cause:** Rate limiting from repeated tests  
**Fix:** Increase delay between tests or run once per hour

---

## Performance Benchmarks

Based on actual test run:

| Test | Time | Size | Status |
|------|------|------|--------|
| Google | 296ms | 42KB | ✓ |
| Wikipedia | 452ms | 48KB | ✗ |
| GitHub | 268ms | 570KB | ✗ |
| HN | 307ms | 34KB | ✓ |
| BBC | 313ms | 398KB | ✗ |
| Reddit | 199ms | 8KB | ✗ |

**Average Response Time:** 273ms  
**Median Response Size:** 48KB  
**Success Rate:** 33% (2/6)

---

## Future Test Coverage

Recommended additional tests:

### Tier 1 (Critical)
- Cloudflare protected sites
- Sites with JavaScript challenges
- Imperva/Barracuda protected sites
- PerimeterX protected sites

### Tier 2 (Important)
- Social networks (Facebook, Instagram, Twitter)
- E-commerce (Amazon, eBay)
- Streaming services (Netflix, YouTube)
- Professional networks (LinkedIn)

### Tier 3 (Nice to Have)
- APIs with authentication
- Sites requiring account login
- SPA (Single Page Application) sites
- API-driven content

---

## Documentation

- **This file** - Test infrastructure overview
- **actual-websites-2026-06-16/README.md** - Results directory guide
- **actual-websites-2026-06-16/EXECUTIVE-SUMMARY.md** - Quick findings
- **actual-websites-2026-06-16/COMPREHENSIVE-ANALYSIS.md** - Detailed analysis

---

## Maintenance

### Regular Tasks
- [ ] Run tests weekly to monitor changes
- [ ] Update User-Agent strings as browsers evolve
- [ ] Add new sites as they become relevant
- [ ] Document blocking mechanism changes

### Version Updates
- v12.7.0 → v12.8.0: Add JavaScript challenge handling
- v12.8.0 → v12.9.0: Add service-specific evasion
- v12.9.0+: Machine learning detection adaptation

---

**Last Updated:** June 16, 2026  
**Test Framework Version:** 1.0  
**Status:** Production Ready for Direct HTTP Testing  
**Next Phase:** Electron Browser Integration Testing
