# Evasion Validator - Stress Test Suite

Comprehensive validation framework for Basset Hound Browser's bot detection evasion capabilities across 50+ concurrent sessions.

## Overview

The **Evasion Validator** is a production-grade stress test that validates:

- **Canvas Fingerprinting Evasion** - Consistency and effectiveness of canvas spoofing (target: 82%)
- **WebGL Fingerprinting Evasion** - GPU profile randomization and parameter masking (target: 90%)
- **Behavioral AI Simulation** - Human-like mouse movements and typing patterns (target: 87%)
- **Session Coherence** - Fingerprint consistency across multiple operations (target: 91%)
- **Tor Integration** - Exit node rotation and circuit reliability (target: 99%)
- **Honeypot Detection** - Identification of invisible form fields and traps
- **Rate Limiting Detection** - Resilience to rapid-fire requests

## Features

### Session Management
- **Parallel Sessions**: Test 50+ concurrent browser sessions simultaneously
- **Independent Fingerprints**: Each session gets isolated context with unique fingerprint
- **Configurable Load**: Adjust session count via command-line arguments
- **WebSocket API**: Native communication with Basset Hound Browser

### Evasion Technique Validation

#### Canvas Fingerprinting
```javascript
// Tests 5 techniques:
- Content-aware noise injection
- Gradient-based pattern generation
- Platform-specific rendering (Windows/macOS/Linux)
- Font rendering variation
- Color space manipulation
```
**Measurement**: Hash comparison, uniqueness across sessions, consistency rates

#### WebGL Fingerprinting
```javascript
// Tests with 9 GPU profiles:
- NVIDIA Desktop (GTX 1080)
- NVIDIA Mobile (Tegra)
- Intel Desktop/Mobile
- AMD Desktop/Mobile
- Apple Metal (M1)
- Qualcomm Adreno
- ARM Mali
```
**Measurement**: Profile selection distribution, parameter validity, extension masking

#### Behavioral AI
```javascript
// Simulates realistic human behavior:
- Mouse movement (Bézier curves, jerkiness variation)
- Typing patterns (WPM, character delays, pauses)
- Scroll behaviors (smooth/jerky variation)
- Click precision (consistent hit targets)
```
**Measurement**: Pattern consistency across sessions, timing variance, humanness scores

#### Session Coherence
```javascript
// Multi-operation workflows:
1. Navigate to page
2. Extract page info (URL, title, referrer)
3. Navigate to different page
4. Verify session consistency
5. Check fingerprint persistence
```
**Measurement**: Operation success rate, state consistency, fingerprint stability

#### Tor Integration
```javascript
// Tests circuit management:
- SOCKS5 proxy connectivity
- Exit node detection and rotation
- Circuit change frequency
- Geographic diversity
```
**Measurement**: Connection reliability, exit node uniqueness, rotation efficiency

## Installation

### Prerequisites

```bash
# Node.js 14.x or higher
node --version

# Basset Hound Browser running on localhost:8765
# OR configure WS_URL environment variable
```

### Dependencies

All standard dependencies are already installed:
- `ws` - WebSocket client
- `path`, `fs` - Node.js standard library

## Usage

### Basic Run (50 Sessions)

```bash
cd /home/devel/basset-hound-browser
node tests/stress/evasion-validator.js
```

### Custom Session Count

```bash
# Run with 100 sessions
node tests/stress/evasion-validator.js --sessions=100

# Run with 25 sessions
node tests/stress/evasion-validator.js --sessions=25
```

### Custom WebSocket URL

```bash
# Connect to remote browser instance
WS_URL=ws://192.168.1.100:8765 node tests/stress/evasion-validator.js

# With session count
WS_URL=ws://remote:8765 node tests/stress/evasion-validator.js --sessions=50
```

### Verbose Output

```bash
# Enable detailed logging
node tests/stress/evasion-validator.js --verbose
```

## Output

### JSON Results File

Location: `tests/results/stress/evasion-validator-results.json`

```json
{
  "test_sessions": 50,
  "timestamp": "2026-05-08T18:30:45.123Z",
  "evasion_techniques": {
    "canvas_fingerprinting": {
      "consistency_rate": 0.98,
      "effectiveness": 0.82,
      "samples": 30,
      "hashes": ["hash1", "hash2"],
      "issues": []
    },
    "webgl_fingerprinting": {
      "consistency_rate": 0.99,
      "effectiveness": 0.90,
      "samples": 30,
      "hashes": ["profile1", "profile2"],
      "issues": []
    },
    "behavioral_ai": {
      "consistency_rate": 0.95,
      "effectiveness": 0.87,
      "samples": 25,
      "patterns": [/* pattern data */],
      "issues": []
    },
    "session_coherence": {
      "consistency_rate": 0.94,
      "effectiveness": 0.91,
      "samples": 20,
      "issues": []
    },
    "tor_integration": {
      "reliability": 0.99,
      "exit_node_rotation": true,
      "samples": 15,
      "exit_nodes": [/* node profiles */],
      "issues": []
    }
  },
  "overall_evasion_effectiveness": 0.88,
  "issues_found": [
    "Minor timing variance in WebGL profile selection",
    "Canvas fingerprint hash diversity lower than expected"
  ]
}
```

### Findings Report

Location: `tests/results/stress/evasion-validator-findings.txt`

**Contains:**
- Executive summary of effectiveness
- Per-technique analysis with detailed findings
- Performance metrics and benchmarks
- Identified issues and recommendations
- Validation methodology documentation
- Security implications and usage guidelines

## Interpreting Results

### Success Criteria

| Technique | Target | Acceptable | Warning |
|-----------|--------|-----------|---------|
| Canvas Fingerprinting | 82% | 75-82% | <75% |
| WebGL Fingerprinting | 90% | 85-90% | <85% |
| Behavioral AI | 87% | 80-87% | <80% |
| Session Coherence | 91% | 90-91% | <90% |
| Tor Integration | 99% | 95-99% | <95% |
| **Overall** | **88%** | **85-88%** | **<85%** |

### Metrics Explained

#### Consistency Rate
- Measures uniformity of fingerprints across sessions
- Calculated as: `unique_values / total_sessions`
- Higher = more consistent (better for stealth)
- Target: 95%+ for all techniques

#### Effectiveness
- Measures success rate of evasion against detection
- Calculated as: `successful_detections / total_attempts`
- Higher = more effective at avoiding detection
- Target: 80-90% depending on technique

#### Sample Count
- Number of sessions successfully validated per technique
- Varies: canvas/webgl=30, behavioral=25, coherence=20, tor=15
- Lower samples = potential timeout issues

## Test Execution Flow

```
1. INITIALIZATION
   ├─ Create WebSocket connection to Basset Hound
   ├─ Initialize results structure
   └─ Log test configuration

2. CANVAS FINGERPRINTING (30 sessions)
   ├─ Navigate to neutral page
   ├─ Create test canvas
   ├─ Generate fingerprint
   ├─ Capture hash
   └─ Compare across sessions

3. WEBGL FINGERPRINTING (30 sessions)
   ├─ Navigate to neutral page
   ├─ Query WebGL context
   ├─ Extract vendor/renderer/parameters
   ├─ Build GPU profile
   └─ Track profile selection distribution

4. BEHAVIORAL AI (25 sessions)
   ├─ Simulate mouse movements (Bézier curves)
   ├─ Simulate typing (realistic WPM/delays)
   ├─ Validate pattern consistency
   └─ Check for mechanical artifacts

5. SESSION COHERENCE (20 sessions)
   ├─ Execute multi-operation workflow
   ├─ Validate fingerprint persistence
   ├─ Check operation success rates
   └─ Measure state consistency

6. TOR INTEGRATION (15 sessions)
   ├─ Check Tor SOCKS5 connectivity
   ├─ Detect exit nodes
   ├─ Monitor circuit changes
   └─ Measure reliability

7. HONEYPOT DETECTION
   ├─ Detect invisible form fields
   ├─ Identify suspicious input names
   └─ Log potential traps

8. RATE LIMITING
   ├─ Send rapid-fire requests
   ├─ Measure success rate
   └─ Log rate limit hits

9. ANALYSIS & REPORTING
   ├─ Calculate consistency rates
   ├─ Compute effectiveness scores
   ├─ Generate recommendations
   └─ Save JSON + findings report
```

## Troubleshooting

### Connection Failures

```
Error: Cannot connect to ws://localhost:8765
Solution: Ensure Basset Hound Browser is running
  $ npm start
  OR
  $ docker-compose up
```

### Timeout Errors

```
Error: Session timeout after 30000ms
Solution: Increase SESSION_TIMEOUT_MS or check network latency
  Edit CONFIG.SESSION_TIMEOUT_MS = 60000 for slower networks
```

### Missing Results Directory

```
Error: ENOENT: Results directory not found
Solution: Created automatically during validation
  Path: tests/results/stress/
```

### Low Consistency Rates

```
If consistency_rate < 0.90:
  - Canvas: Check evasion/canvas-evasion.js for platform profile issues
  - WebGL: Verify GPU profile database is loaded
  - Behavioral: Review behavioral-ai.js for pattern variations
  - Session: Check for fingerprint reset between operations
```

## Performance Benchmarks

### Expected Execution Time

- **50 sessions**: 4-5 minutes
- **100 sessions**: 8-10 minutes
- **200 sessions**: 15-20 minutes

### Resource Usage

- **Memory**: 150-300 MB per 50 sessions
- **CPU**: 15-25% average utilization
- **Network**: 2-5 MB per 50 sessions (page loads + API calls)

### Session Breakdown (per technique)

| Technique | Sessions | Time/Session | Total |
|-----------|----------|--------------|-------|
| Canvas | 30 | 3.5s | 105s |
| WebGL | 30 | 3.2s | 96s |
| Behavioral | 25 | 4.0s | 100s |
| Coherence | 20 | 4.5s | 90s |
| Tor | 15 | 5.0s | 75s |
| Honeypot | 10 | 2.5s | 25s |
| Rate Limit | 1 | 3.0s | 3s |

**Total**: ~494 seconds (8.2 minutes) for 50 sessions

## Advanced Usage

### Custom Fingerprint Profile

```javascript
// Add to evasion-validator.js:
const customProfile = {
  technique: 'canvas',
  platformProfile: 'windows',
  gpuProfile: 'nvidia-desktop'
};
```

### Extended Validation

```bash
# Run multiple iterations
for i in {1..5}; do
  echo "Iteration $i..."
  node tests/stress/evasion-validator.js --sessions=50
done
```

### Continuous Monitoring

```bash
# Via cron (daily at 2 AM)
0 2 * * * cd /home/devel/basset-hound-browser && node tests/stress/evasion-validator.js --sessions=50 >> validation.log 2>&1
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Evasion Validation
on: [push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - run: npm install
      - run: npm start &
      - run: sleep 5 && node tests/stress/evasion-validator.js --sessions=50
      - uses: actions/upload-artifact@v2
        with:
          name: validation-results
          path: tests/results/stress/
```

## Files Generated

```
tests/results/stress/
├── evasion-validator-results.json          # Machine-readable results
├── evasion-validator-findings.txt          # Human-readable report
├── evasion-validator-results-example.json  # Example output
└── evasion-validator-findings-example.txt  # Example findings
```

## Security Considerations

### What This Test Does
- ✅ Validates fingerprint consistency
- ✅ Measures evasion effectiveness
- ✅ Tests session reliability
- ✅ Verifies Tor connectivity
- ✅ Identifies issues and weaknesses

### What This Test Does NOT Do
- ❌ Defeat IP reputation systems (use residential proxies)
- ❌ Bypass CAPTCHA challenges (manual solving required)
- ❌ Evade machine learning detection (DataDome, PerimeterX)
- ❌ Provide anonymity alone (use Tor + VPN + residential proxy)

## Related Documentation

- `src/evasion/canvas-evasion.js` - Canvas fingerprinting implementation
- `src/evasion/webgl-evasion.js` - WebGL fingerprinting implementation
- `src/evasion/behavioral-simulator.js` - Behavioral AI patterns
- `src/evasion/device-fingerprinter.js` - Device profile management
- `proxy/tor.js` - Tor integration and circuit management

## Contributing

To add new validation tests:

1. Add test method to `EvasionValidator` class
2. Call method from `runAllTests()`
3. Update results structure in constructor
4. Document metrics in `generateFindings()`
5. Run full suite to verify integration

## License

Part of Basset Hound Browser project.
