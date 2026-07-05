# Phase 3 Features - Quick Implementation Guide

## Import & Setup

### Feature 1: Headless Authentication
```javascript
const { HeadlessAuthenticationManager } = require('./src/authentication/headless-auth');

const authManager = new HeadlessAuthenticationManager(browser);
```

### Feature 2: Session Coherence
```javascript
const { SessionCoherence } = require('./src/evasion/session-coherence');

const coherence = new SessionCoherence();
```

### Feature 3: Device Fingerprinting
```javascript
const { DynamicFingerprintProfile } = require('./src/evasion/fingerprint-profiles');

const profile = new DynamicFingerprintProfile();
```

---

## Feature 1: Headless Authentication - Common Patterns

### Basic Login Flow
```javascript
authManager.registerAuthFlow('basic_login', {
  type: 'login-form',
  steps: [
    {
      id: 'navigate',
      type: 'navigate',
      url: 'https://example.com/login',
      waitFor: { type: 'selector', value: '#login-form' }
    },
    {
      id: 'fill_form',
      type: 'fill_login_form',
      usernameSelector: '#email',
      passwordSelector: '#password',
      submitSelector: '#login-button',
      username: '${email}',
      password: '${password}'
    },
    {
      id: 'detect_success',
      type: 'detect_success',
      successIndicators: [{ type: 'selector', value: '.dashboard' }]
    }
  ]
});

const result = await authManager.executeAuthFlow('basic_login', {
  email: 'user@example.com',
  password: 'password123'
});
```

### OAuth Flow
```javascript
authManager.registerAuthFlow('oauth_github', {
  type: 'oauth',
  steps: [
    {
      id: 'navigate',
      type: 'navigate',
      url: 'https://github.com/login/oauth/authorize?client_id=...'
    },
    {
      id: 'login',
      type: 'fill_login_form',
      usernameSelector: '#login_field',
      passwordSelector: '#password',
      submitSelector: '[value="Sign in"]',
      username: '${username}',
      password: '${password}'
    },
    {
      id: 'approve',
      type: 'click',
      selector: '#authorize'
    },
    {
      id: 'success',
      type: 'wait_for_redirect',
      expectedUrl: 'your_redirect_uri'
    }
  ]
});
```

### MFA Handling
```javascript
authManager.registerAuthFlow('login_with_mfa', {
  type: 'login-form',
  steps: [
    { /* basic login steps */ },
    {
      id: 'mfa',
      type: 'handle_mfa',
      mfaPromptSelector: '.mfa-prompt',
      mfaInputSelector: '#mfa-code-input',
      mfaSubmitSelector: '#verify-mfa',
      mfaCode: '${mfaCode}',
      timeout: 15000
    },
    { /* success detection */ }
  ]
});

// Execute with MFA code
const result = await authManager.executeAuthFlow('login_with_mfa', {
  username: 'user',
  password: 'pass',
  mfaCode: '123456'
});
```

---

## Feature 2: Session Coherence - Monitoring Pattern

### Setup & Recording
```javascript
// Initialize session with baseline
coherence.initializeSession('session_1', {
  os: 'Windows 10',
  browser: 'Chrome',
  fingerprint: { canvas: 'baseline', webgl: 'baseline' },
  behavior: { typingSpeed: 50, mouseSpeed: 'medium' }
});

// Record each interaction
coherence.recordInteraction('session_1', {
  type: 'click',
  fingerprint: { canvas: 'baseline', webgl: 'baseline' },
  behavior: { typingSpeed: 48 },
  network: { userAgent: 'Mozilla/5.0...' },
  device: { os: 'Windows 10' }
});
```

### Violation Detection
```javascript
// After each interaction, check coherence
const result = coherence.recordInteraction('session_1', {
  type: 'type',
  behavior: { typingSpeed: 200 }  // 4x faster - violation!
});

if (result.violations > 0) {
  console.log('⚠️ Coherence violations detected');
  const report = coherence.getCoherenceReport('session_1');
  console.log(report.layers);  // { temporal: {...}, behavioral: {...}, ... }
}
```

### Recovery
```javascript
// Attempt automatic recovery
if (result.requiresRecovery) {
  const recovery = coherence.attemptRecovery('session_1');
  console.log(recovery.actions);
  // [
  //   { type: 'normalize_behavior', target: 'typing_speed' },
  //   { type: 'add_request_delay', duration: 250 }
  // ]
}
```

### Layer-Specific Monitoring
```javascript
// Monitor individual layers
const report = coherence.getCoherenceReport('session_1');

// Temporal: fingerprint evolution
if (report.layers.temporal.violations > 0) {
  console.log('Fingerprint changed too much');
}

// Behavioral: typing/mouse consistency
if (report.layers.behavioral.violations > 0) {
  console.log('Behavior inconsistent with baseline');
}

// Network: request patterns
if (report.layers.network.violations > 0) {
  console.log('Request timing looks robotic');
}

// Device: hardware impossibilities
if (report.layers.device.violations > 0) {
  console.log('Device specs are impossible');
}

// Timeline: chronological order
if (report.layers.timeline.violations > 0) {
  console.log('Interaction timing suspicious');
}
```

---

## Feature 3: Device Fingerprinting - Evolution Pattern

### Single Profile Usage
```javascript
// Create and get fingerprint
const profile = new DynamicFingerprintProfile();
let fp = profile.getFingerprint();

// Apply fingerprint to browser
await browser.applyFingerprint(fp);

// Evolve with each interaction
for (let i = 0; i < 50; i++) {
  profile.evolveFingerprint();
  // Apply updated fingerprint periodically
  if (i % 10 === 0) {
    fp = profile.getFingerprint();
    await browser.applyFingerprint(fp);
  }
}
```

### Profile Lifecycle
```javascript
// Check age
const age = profile.getAge();
console.log(age);
// { ageInteractions: 50, status: 'healthy', nextRotationAt: 100 }

// Automatic retirement
for (let i = 0; i < 51; i++) {
  profile.evolveFingerprint();
}

const result = profile.retire();
console.log(result.newProfile);  // Completely new profile

// Continue with new profile
fp = profile.getFingerprint();
await browser.applyFingerprint(fp);
```

### Coherence Verification
```javascript
// Verify profile is coherent
const coherence = profile.analyzeCoherence();
console.log(coherence.overall_coherence);  // 0.98

// Device should be realistic
const osCheck = profile.checkOSBrowserCoherence(profile.baseProfile);
console.log(osCheck.valid);  // true

const screenCheck = profile.checkScreenCoherence(profile.baseProfile);
console.log(screenCheck.coherent);  // true
```

### Multi-Site Investigation
```javascript
// Site A
const profile1 = new DynamicFingerprintProfile();
let fp1 = profile1.getFingerprint();
await browser.applyFingerprint(fp1);
// ... investigate site A

// Site B
const profile2 = new DynamicFingerprintProfile();
let fp2 = profile2.getFingerprint();
await browser.applyFingerprint(fp2);
// ... investigate site B

// Site C (rotate back)
for (let i = 0; i < 100; i++) {
  profile1.evolveFingerprint();
}
profile1.retire();
let fp3 = profile1.getFingerprint();
await browser.applyFingerprint(fp3);
// ... investigate site C (new fingerprint, same logical session)
```

---

## Integration with WebSocket API

### Add to WebSocket Commands
```javascript
// In websocket/server.js
const { HeadlessAuthenticationManager } = require('../src/authentication/headless-auth');
const { SessionCoherence } = require('../src/evasion/session-coherence');
const { DynamicFingerprintProfile } = require('../src/evasion/fingerprint-profiles');

const authManager = new HeadlessAuthenticationManager(browserInstance);
const coherence = new SessionCoherence();
const profileManager = new Map();  // sessionId -> profile

// Register flow command
{
  command: 'register_auth_flow',
  handler: (data) => {
    return authManager.registerAuthFlow(data.name, data.config);
  }
}

// Execute flow command
{
  command: 'execute_auth_flow',
  handler: async (data) => {
    return await authManager.executeAuthFlow(data.name, data.context);
  }
}

// Record interaction command
{
  command: 'record_coherence_interaction',
  handler: (data) => {
    return coherence.recordInteraction(data.sessionId, data.interaction);
  }
}

// Get coherence report command
{
  command: 'get_coherence_report',
  handler: (data) => {
    return coherence.getCoherenceReport(data.sessionId);
  }
}
```

---

## Error Handling Examples

### Auth Flow Errors
```javascript
const result = await authManager.executeAuthFlow('login_flow', context);

if (!result.success) {
  switch (result.status) {
    case 'failed':
      // Step failed after retries
      console.error(`Failed at step: ${result.stepsFailed}`);
      break;
    case 'timeout':
      // Waiting exceeded max time
      console.error('Flow timeout');
      break;
  }
}
```

### Coherence Violations
```javascript
const result = coherence.recordInteraction(sessionId, interaction);

if (result.requiresRecovery) {
  const recovery = coherence.attemptRecovery(sessionId);
  
  for (const action of recovery.actions) {
    if (action.type === 'restart_session') {
      // Device combo impossible - start fresh session
      coherence.deleteSession(sessionId);
      coherence.initializeSession(newSessionId, {...});
    } else if (action.type === 'add_request_delay') {
      // Add delay before next request
      await new Promise(r => setTimeout(r, action.duration));
    }
  }
}
```

---

## Performance Tips

### Feature 1: Authentication
- Use human-like delays (already included)
- Avoid rapid click sequences
- Allow time for page loads
- Cache session tokens when possible

### Feature 2: Session Coherence
- Record interactions continuously
- Check violations after sensitive operations
- Use recovery immediately when detected
- Clean up old sessions regularly

### Feature 3: Device Fingerprinting
- Evolve fingerprint every 10-20 interactions
- Retire after 100 interactions
- Use same profile for <30 minute sessions
- Verify coherence before critical operations

---

## Testing Pattern

```javascript
describe('Integration Test', () => {
  let authManager, coherence, profile, browser;

  beforeEach(() => {
    browser = createMockBrowser();
    authManager = new HeadlessAuthenticationManager(browser);
    coherence = new SessionCoherence();
    profile = new DynamicFingerprintProfile();
  });

  test('should authenticate and maintain coherence', async () => {
    // 1. Setup coherence
    coherence.initializeSession('test_session', {
      fingerprint: profile.getFingerprint(),
      behavior: { typingSpeed: 50 }
    });

    // 2. Execute auth
    const result = await authManager.executeAuthFlow('test_flow', context);
    expect(result.success).toBe(true);

    // 3. Record with coherence
    const coherenceResult = coherence.recordInteraction('test_session', {
      type: 'login',
      fingerprint: profile.getFingerprint(),
      behavior: { typingSpeed: 48 }
    });
    
    expect(coherenceResult.violations).toBe(0);

    // 4. Verify profile quality
    const profileCoherence = profile.analyzeCoherence();
    expect(profileCoherence.overall_coherence).toBeGreaterThan(0.9);
  });
});
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Auth flow times out | Page load slow | Increase `timeout` in wait steps |
| MFA fails | Code expired | Sync time with auth provider |
| Session coherence violations | Too many changes | Use more conservative profiles |
| Fingerprint detected | Profile stale | Rotate profile more frequently |
| Network violations | requests too fast | Add randomized delays |

---

## Resources

- Full API: See `PHASE-3-IMPLEMENTATION-SUMMARY.md`
- Test Examples: `tests/phase3/*.test.js`
- Configuration: `docs/PHASE-3-SPECIFICATION.md`
- Architecture: `docs/PHASE-3-TECHNICAL-PLAN.md`
