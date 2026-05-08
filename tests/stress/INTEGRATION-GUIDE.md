# Evasion Validator - Integration & Deployment Guide

Comprehensive guide for integrating and deploying the Evasion Validator stress test framework.

## Quick Start

```bash
# Navigate to project root
cd /home/devel/basset-hound-browser

# Ensure browser is running
npm start &

# Wait for browser to initialize
sleep 5

# Run evasion validator with 50 sessions
node tests/stress/evasion-validator.js

# Results saved to:
# - tests/results/stress/evasion-validator-results.json
# - tests/results/stress/evasion-validator-findings.txt
```

## File Structure

```
tests/stress/
├── evasion-validator.js              # Main validator (791 lines, 27KB)
├── README.md                          # Usage documentation
├── INTEGRATION-GUIDE.md               # This file
│
└── [Supporting files from Phase 2]
    ├── browser-stress.js              # Browser load testing
    ├── websocket-stress.js            # WebSocket protocol testing
    ├── memory-monitor.js              # Memory leak detection
    ├── error-recovery.js              # Error handling validation
    └── quick-memory-test.js           # Quick memory check

tests/results/stress/
├── evasion-validator-results.json            # Test results (JSON)
├── evasion-validator-findings.txt            # Test findings (TXT)
├── evasion-validator-results-example.json    # Example output
├── evasion-validator-findings-example.txt    # Example findings
│
└── [Historical results from Phase 2]
    ├── browser-stress-results.json
    ├── browser-stress-findings.txt
    ├── websocket-stress-results.json
    ├── error-recovery-results.json
    ├── error-recovery-findings.txt
    ├── STRESS-TEST-ANALYSIS.md
    ├── TEST-EXECUTION-SUMMARY.txt
```

## Evasion Validator Architecture

### Class: EvasionValidator

**Constructor Parameters:**
- None (all configuration via CONFIG object)

**Key Methods:**

```javascript
// Session management
createSession()                   // Creates WebSocket connection
delay(ms)                         // Sleep utility

// Validation tests
testCanvasFingerprinting()       // Tests canvas evasion (30 sessions)
testWebGLFingerprinting()        // Tests WebGL evasion (30 sessions)
testBehavioralAI()               // Tests mouse/typing (25 sessions)
testSessionCoherence()           // Tests multi-op consistency (20 sessions)
testTorIntegration()             // Tests Tor reliability (15 sessions)
testHoneypotDetection()          // Tests honeypot detection (10 sessions)
testRateLimitDetection()         // Tests rate limiting (1 session)

// Results handling
calculateOverallEffectiveness()  // Computes weighted scores
saveResults()                    // Writes JSON + findings
generateFindings()               // Creates findings report
generateRecommendations()        // Suggests improvements

// Orchestration
runAllTests()                    // Main test entry point
```

### Configuration

```javascript
const CONFIG = {
  WS_URL: 'ws://localhost:8765',          // Browser WebSocket endpoint
  NUM_SESSIONS: 50,                       // Total concurrent sessions
  VERBOSE: false,                         // Detailed logging
  SESSION_TIMEOUT_MS: 30000,              // Request timeout
  RESULTS_DIR: 'tests/results/stress/',   // Output directory
  PAGE_LOAD_DELAY: 3000,                  // Wait time after navigation
  FINGERPRINT_TEST_SITES: {
    canvas: 'https://browserleaks.com/canvas',
    webgl: 'https://browserleaks.com/webgl',
    behavioral: 'https://example.com'
  }
};
```

### Session Protocol

Each test session follows this pattern:

```javascript
// 1. Create WebSocket connection
const session = await validator.createSession();

// 2. Send WebSocket command
const result = await session.send('command_name', {
  param1: 'value1',
  param2: 'value2'
});

// 3. Process response
if (result.success) {
  // Extract data
  const data = result.result;
  // Validate/analyze
  // Update metrics
}

// 4. Close session
await session.close();
```

## Test Specification

### Canvas Fingerprinting Test

**Objective:** Validate canvas spoofing consistency across 30 sessions

**Process:**
1. Create canvas element (256×150)
2. Draw text with specific styling
3. Export to PNG data URL
4. Hash result
5. Compare hashes across sessions

**Target Metrics:**
- Consistency: 98%+ (≤2 unique hashes from 30 sessions)
- Effectiveness: 82%+ (success rate)
- Issues: <3 per test run

**Implementation Details:**
```javascript
// Canvas test draws:
- Foreground text "Browser Fingerprint" in Arial
- Additional text "Canvas FP" with transparency
- Colored rectangles for rendering variation
- Measures font rendering consistency
```

### WebGL Fingerprinting Test

**Objective:** Validate GPU profile selection consistency

**Process:**
1. Create WebGL context
2. Query vendor/renderer strings
3. Get max texture sizes
4. Get extension list
5. Build profile fingerprint

**Target Metrics:**
- Consistency: 99%+ (≤3 unique profiles)
- Effectiveness: 90%+ (success rate)
- Issues: <2 per test run

**GPU Profiles Tested:**
- NVIDIA GTX 1080 (desktop)
- NVIDIA Tegra (mobile)
- Intel HD Graphics (desktop/mobile)
- AMD Radeon (desktop/mobile)
- Apple M1 (Metal)
- Qualcomm Adreno (mobile)
- ARM Mali (mobile)

### Behavioral AI Test

**Objective:** Validate human-like interaction pattern consistency

**Process:**
1. Generate Bézier curve mouse path
2. Simulate keystroke timing
3. Apply pattern variation
4. Validate against detection baselines

**Target Metrics:**
- Consistency: 95%+ (pattern uniformity)
- Effectiveness: 87%+ (human-like score)
- Samples: 25 sessions (mouse + typing)

**Behavioral Characteristics:**
```
Mouse Movement:
- Distance: 100-600 pixels
- Duration: 1.5-3 seconds (realistic speed)
- Path: Bézier curve (not straight line)
- Jerkiness: 90% reduction (human-like smoothness)

Typing Patterns:
- Speed: 40-60 WPM (average human range)
- Variation: ±10-20% per keystroke
- Pauses: 5% of keystrokes (thinking)
- Duration: 100-300ms per pause
```

### Session Coherence Test

**Objective:** Validate fingerprint persistence across multi-operation workflows

**Process:**
1. Navigate to page (https://example.com)
2. Extract page info
3. Navigate to different page
4. Verify consistency
5. Check fingerprint stability

**Target Metrics:**
- Consistency: 94%+ (operation success)
- Effectiveness: 91%+ (coherence score)
- Samples: 20 sessions

**Validation Checks:**
- URL consistency maintained
- Referrer header correct
- Cookies/storage preserved
- Fingerprint unchanged
- DOM state valid

### Tor Integration Test

**Objective:** Validate Tor connectivity, circuit management, and exit node rotation

**Process:**
1. Check SOCKS5 proxy connectivity
2. Detect current exit node
3. Trigger circuit change
4. Verify new exit node
5. Measure rotation frequency

**Target Metrics:**
- Reliability: 99%+ (connection success)
- Exit node rotation: YES (confirmed)
- Samples: 15 sessions

**Circuit Management:**
- Automatic rotation every 8-12 sessions
- Geographic diversity (5+ regions)
- No circuit reuse within 100ms
- Connection time: <5 seconds

## Running the Validator

### Command Line Options

```bash
# Run with custom session count
node tests/stress/evasion-validator.js --sessions=100

# Connect to remote browser
WS_URL=ws://192.168.1.100:8765 node tests/stress/evasion-validator.js

# Enable verbose logging
node tests/stress/evasion-validator.js --verbose

# Combined
WS_URL=ws://remote:8765 node tests/stress/evasion-validator.js --sessions=50 --verbose
```

### Environment Variables

```bash
# WebSocket URL (default: ws://localhost:8765)
export WS_URL=ws://custom-host:8765

# Run command
node tests/stress/evasion-validator.js
```

## Results Analysis

### JSON Results Structure

```json
{
  "test_sessions": 50,                    // Total sessions tested
  "timestamp": "2026-05-08T18:30:45Z",   // ISO timestamp
  "evasion_techniques": {
    "[technique_name]": {
      "consistency_rate": 0.98,           // 0.0-1.0 (higher = better)
      "effectiveness": 0.82,              // 0.0-1.0 (higher = better)
      "samples": 30,                      // Sessions tested
      "hashes": ["hash1", "hash2"],       // Sample data
      "issues": ["issue1", "issue2"]      // Identified problems
    }
  },
  "overall_evasion_effectiveness": 0.88,  // Weighted average
  "issues_found": ["..."]                 // All issues across techniques
}
```

### Findings Report Structure

The findings report contains:

1. **Header Information**
   - Test timestamp
   - Test duration
   - Total sessions

2. **Summary Table**
   - Consistency rates per technique
   - Effectiveness scores
   - Sample counts
   - Assessment status

3. **Overall Assessment**
   - Global evasion effectiveness score
   - Production readiness determination
   - Critical issues (if any)

4. **Detailed Findings**
   - Per-technique analysis
   - Performance metrics
   - Identified problems
   - Recommendations

5. **Test Methodology**
   - Session structure explanation
   - Fingerprint validation approach
   - Consistency metric calculation

6. **Security Implications**
   - Detection avoidance effectiveness
   - Recommended usage patterns
   - Known limitations

## Performance Expectations

### Execution Time

- **50 sessions**: 4-5 minutes
- **100 sessions**: 8-10 minutes
- **200 sessions**: 15-20 minutes

**Breakdown by Technique:**
```
Canvas (30 sessions):         105 seconds (3.5s/session)
WebGL (30 sessions):          96 seconds (3.2s/session)
Behavioral (25 sessions):     100 seconds (4.0s/session)
Coherence (20 sessions):      90 seconds (4.5s/session)
Tor (15 sessions):            75 seconds (5.0s/session)
Honeypot (10 sessions):       25 seconds (2.5s/session)
Rate Limit (1 session):       3 seconds (3.0s/session)
Total:                        494 seconds (8.2 minutes)
```

### Resource Usage

- **Memory**: 150-300 MB per 50 sessions
- **CPU**: 15-25% average
- **Network**: 2-5 MB per 50 sessions

## Success Criteria

### Minimum Requirements for Production

| Metric | Minimum | Target | Status |
|--------|---------|--------|--------|
| Overall Evasion | 85% | 88%+ | PASS if >= 85% |
| Canvas Consistency | 75% | 98%+ | PASS if >= 90% |
| WebGL Consistency | 85% | 99%+ | PASS if >= 95% |
| Behavioral Pattern | 80% | 95%+ | PASS if >= 90% |
| Session Coherence | 90% | 94%+ | PASS if >= 92% |
| Tor Reliability | 95% | 99%+ | PASS if >= 98% |
| Critical Issues | 0 | 0 | FAIL if > 0 |

### Issue Severity Levels

**CRITICAL** (Must Fix):
- Canvas fingerprint leakage
- Tor connection failures
- Session coherence breaks
- Honeypot field detection

**HIGH** (Should Fix):
- Consistency < 90% for any technique
- Effectiveness < 80% for any technique
- Memory leaks detected
- Rate limiting triggered

**MEDIUM** (Nice to Fix):
- Minor timing variations
- Profile selection imbalance
- Resource usage optimization
- Documentation updates

**LOW** (Monitor):
- Extended execution time
- Redundant code paths
- Minor cosmetic issues

## Troubleshooting

### Issue: Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:8765

Solution:
1. Start browser: npm start
2. Wait 5 seconds: sleep 5
3. Retry validator: node tests/stress/evasion-validator.js
```

### Issue: High Failure Rate

```
Error: Multiple timeouts (>20% failure rate)

Solution:
1. Increase SESSION_TIMEOUT_MS to 60000
2. Reduce concurrent sessions to 20
3. Check browser logs: cat logs/browser.log
4. Verify network latency: ping localhost
```

### Issue: Low Consistency Rate

```
Error: Consistency < 90%

Solution by Technique:
- Canvas: Update evasion/canvas-evasion.js
- WebGL: Verify GPU profile loading
- Behavioral: Check behavioral-ai.js patterns
- Session: Inspect cookie/storage handling
- Tor: Verify SOCKS5 configuration
```

### Issue: Memory Leak

```
Error: Memory increases from 150MB to >500MB

Solution:
1. Check session cleanup: await session.close()
2. Reduce NUM_SESSIONS to 10
3. Monitor with: node tests/stress/memory-monitor.js
4. Profile heap: node --inspect tests/stress/evasion-validator.js
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Evasion Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start browser
        run: npm start > /tmp/browser.log 2>&1 &
      
      - name: Wait for browser
        run: sleep 10
      
      - name: Run evasion validator
        run: node tests/stress/evasion-validator.js --sessions=50
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: evasion-validation-results
          path: tests/results/stress/
      
      - name: Check results
        run: |
          grep -q "Overall Evasion Effectiveness: 0.[89]" tests/results/stress/evasion-validator-findings.txt
          if [ $? -ne 0 ]; then echo "Evasion effectiveness below threshold"; exit 1; fi
```

### Docker Integration

```dockerfile
FROM node:14

WORKDIR /app

COPY . .
RUN npm install

# Start browser
CMD npm start & sleep 5 && node tests/stress/evasion-validator.js --sessions=50
```

### Cron Scheduling

```bash
# Daily validation at 2 AM
0 2 * * * cd /app && node tests/stress/evasion-validator.js --sessions=50 >> /var/log/evasion-validation.log 2>&1

# Weekly deep validation at Sunday 3 AM
0 3 * * 0 cd /app && node tests/stress/evasion-validator.js --sessions=100 >> /var/log/evasion-validation-deep.log 2>&1
```

## Advanced Features

### Custom Test Profiles

```javascript
// Extend EvasionValidator class
class CustomEvasionValidator extends EvasionValidator {
  async testCustomTechnique() {
    // Your custom test here
    const result = await this.testCustomImplementation();
    this.results.evasion_techniques.custom = result;
  }
  
  async runAllTests() {
    await super.runAllTests();
    await this.testCustomTechnique();
    this.calculateOverallEffectiveness();
    this.saveResults();
  }
}
```

### Parallel Session Execution

```javascript
// Run multiple validators in parallel
const validators = [new EvasionValidator(), new EvasionValidator()];
await Promise.all(validators.map(v => v.runAllTests()));
```

### Real-time Monitoring

```bash
# Watch results file during execution
watch -n 1 'cat tests/results/stress/evasion-validator-results.json | jq .overall_evasion_effectiveness'
```

## Related Files

**Core Evasion Modules:**
- `src/evasion/canvas-evasion.js` - Canvas fingerprinting
- `src/evasion/webgl-evasion.js` - WebGL fingerprinting
- `src/evasion/behavioral-simulator.js` - Mouse/typing simulation
- `src/evasion/device-fingerprinter.js` - Device profiles

**Integration Points:**
- `websocket/server.js` - WebSocket API
- `proxy/tor.js` - Tor integration
- `evasion/fingerprint-profile.js` - Profile management

**Test Files:**
- `tests/evasion/` - Unit tests for evasion modules
- `tests/bot-detection-validation.js` - Live site testing
- `tests/stress/` - Stress testing suite

## Support & Maintenance

### Regular Maintenance Schedule

- **Daily**: Monitor for new detection signatures
- **Weekly**: Run full validation suite (50 sessions)
- **Monthly**: Deep validation (100+ sessions)
- **Quarterly**: Update fingerprint profiles
- **Annually**: Comprehensive framework audit

### Monitoring & Alerts

```bash
# Check last validation results
tail -20 tests/results/stress/evasion-validator-findings.txt

# Extract effectiveness score
grep "Overall Evasion Effectiveness" tests/results/stress/evasion-validator-findings.txt

# Check for critical issues
grep "CRITICAL" tests/results/stress/evasion-validator-findings.txt
```

## Documentation

- **README.md** - Usage guide
- **INTEGRATION-GUIDE.md** - This file
- **evasion-validator-results-example.json** - Example output
- **evasion-validator-findings-example.txt** - Example findings

## License

Part of Basset Hound Browser project.
