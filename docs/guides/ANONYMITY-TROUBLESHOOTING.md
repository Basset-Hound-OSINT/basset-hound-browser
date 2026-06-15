# Basset Hound Browser v12.4.0 - Anonymity Troubleshooting Guide

**Quick Reference** for anonymity problems and solutions  
**Scope:** Common issues, diagnostics, and fixes

---

## Issue: "Profile Not Found" Error

### Symptoms
```json
{
  "success": false,
  "error": "Profile 'iPhone 15' not found"
}
```

### Diagnosis
- Check exact profile name (case-sensitive)
- Profile may have typo
- Custom profile may not exist

### Solution

**Step 1: List available profiles**
```javascript
ws.send(JSON.stringify({
  command: "get_available_profiles"
}));
```

**Step 2: Use exact name from list**
```javascript
// Use EXACT spelling from response
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"  // Not "iPhone 15" (missing "Pro")
}));
```

**Step 3: For custom profiles, verify creation**
```javascript
ws.send(JSON.stringify({
  command: "list_anonymity_profiles"
}));
```

---

## Issue: Consistency Check Fails

### Symptoms
```json
{
  "success": true,
  "valid": false,
  "issues": [
    "CPU cores (8) exceeds typical for device (6)",
    "Memory (32GB) unrealistic for iPhone"
  ]
}
```

### Diagnosis
- Profile has mismatched values
- Custom profile has invalid specs
- Partial profile update left incomplete

### Solution

**For built-in profiles:**
- Switch to different built-in profile
- Report if built-in profile fails consistency

**For custom profiles:**

```javascript
// Get details of current profile
ws.send(JSON.stringify({
  command: "get_anonymity_profile"
}));

// Correct the values
ws.send(JSON.stringify({
  command: "delete_custom_profile",
  name: "Bad Profile"
}));

ws.send(JSON.stringify({
  command: "create_custom_profile",
  name: "Good Profile",
  config: {
    // Use realistic values
    // iPhone: 4-6 cores, 4-8GB memory
    hardware: {
      cores: 6,      // Realistic for iPhone
      memory: 8,     // Realistic for iPhone
      gpu: "Apple A17",  // Match device
      maxTouchPoints: 5  // Mobile = 5
    },
    // ... other fields
  }
}));
```

**Common consistency issues:**

| Issue | Cause | Fix |
|-------|-------|-----|
| CPU cores too high | 16+ cores for mobile | Use 4-8 for phones, 8-12 for laptops |
| Memory unrealistic | 64GB for phone | Use 4-8GB for phones, 16-32GB for laptops |
| GPU mismatch | Wrong GPU for device | Use A-series for Apple, Snapdragon for Samsung |
| Touch points wrong | Desktop with 5 touch | Use 0 for desktop, 5 for mobile |
| Screen aspect ratio off | 1:1 for phone | Use 20:9 for phones, 16:9 for desktop |

---

## Issue: Fingerprints Still Leaking

### Symptoms
```json
{
  "leaks": [
    {
      "type": "navigator.hardwareConcurrency",
      "leaked": 16,
      "expected": 6
    }
  ]
}
```

### Diagnosis
- Injection code not executed
- JavaScript cache from before profile set
- Detection service looking at wrong property

### Solution

**Step 1: Verify profile is set**
```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_status"
}));
// Check: active: true, profile: "..."
```

**Step 2: Hard refresh page**
```javascript
// Ctrl+Shift+R (Chrome/Firefox)
// Cmd+Shift+R (Mac)
// Clear browser cache
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://example.com"
  // Force new page load
}));
```

**Step 3: Verify injection code presence**
```javascript
ws.send(JSON.stringify({
  command: "execute_javascript",
  code: "console.log('navigator.hardwareConcurrency:', navigator.hardwareConcurrency)"
}));
```

**Step 4: Check specific leakage vectors**
```javascript
ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"
}));

// Detailed response shows each check:
// hardwareConcurrency: "spoofed"
// deviceMemory: "spoofed"
// canvas: "injected"
// etc.
```

**If still leaking:**

```javascript
// Try resetting and re-applying
ws.send(JSON.stringify({
  command: "reset_anonymity_settings"
}));

// Wait a moment
setTimeout(() => {
  ws.send(JSON.stringify({
    command: "set_anonymity_profile",
    profile: "iPhone 15 Pro"
  }));
}, 500);
```

---

## Issue: High Memory Usage

### Symptoms
- Heap size growing
- Page getting slow
- Multiple instances of profiles in memory

### Diagnosis
- Behavioral modules enabled continuously
- Not resetting sessions
- Many custom profiles created

### Solution

**Step 1: Disable behavioral if not needed**
```javascript
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));
// Saves ~2MB per session
```

**Step 2: Reset unused sessions**
```javascript
ws.send(JSON.stringify({
  command: "reset_anonymity_settings"
}));
// Clears profile data
```

**Step 3: Check statistics**
```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_statistics"
}));
// Check: customProfiles, sessions.active
```

**Step 4: Delete unused custom profiles**
```javascript
ws.send(JSON.stringify({
  command: "delete_custom_profile",
  name: "Unused Profile"
}));
```

**Memory optimization checklist:**
- [ ] Behavioral disabled when not needed
- [ ] Sessions reset after use
- [ ] Old custom profiles deleted
- [ ] Monitoring shows <100MB for multiple sessions

---

## Issue: Behavioral Modules Not Working

### Symptoms
- Typing appears instant
- Mouse moves instantly
- No thinking delays observed

### Diagnosis
- Behavioral modules not enabled
- Settings not applied
- Disabled after being enabled

### Solution

**Step 1: Check behavioral status**
```javascript
ws.send(JSON.stringify({
  command: "get_behavioral_status"
}));

// Should show: enabled: true
// If enabled: false, module is disabled
```

**Step 2: Enable behavioral modules**
```javascript
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 90,           // Typing speed
  mouse_speed: 1.0,  // Mouse velocity
  pauses: true       // Thinking delays
}));
```

**Step 3: Verify settings applied**
```javascript
ws.send(JSON.stringify({
  command: "get_behavioral_status"
}));
// Should show: enabled: true, wpm: 90, etc.
```

**Step 4: Test interaction**
```javascript
// Typing should have delays
// Mouse should move smoothly
// Clicks should have pause before

ws.send(JSON.stringify({
  command: "type_text",
  text: "Hello World",
  selector: "input[type='text']"
}));
// Should take ~0.5-1 second (90 WPM)
```

---

## Issue: Custom Profile Creation Fails

### Symptoms
```json
{
  "success": false,
  "error": "Invalid profile: missing required field 'hardware'"
}
```

### Diagnosis
- Custom profile missing required fields
- Field values invalid format
- Profile name already exists

### Solution

**Step 1: Use complete profile template**
```javascript
const completeProfile = {
  category: "smartphone",
  brand: "Apple",
  model: "iPhone Custom",
  osType: "iOS",
  osVersion: "17.0.0",
  
  hardware: {
    cores: 6,
    memory: 8,
    gpu: "Apple A17",
    maxTouchPoints: 5,
    colorDepth: 24,
    devicePixelRatio: 3
  },
  
  display: {
    width: 393,
    height: 852,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 3,
    availWidth: 393,
    availHeight: 812
  },
  
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_0 like Mac OS X)...",
  language: "en-US",
  languages: ["en-US", "en"],
  timezone: "America/Los_Angeles",
  platform: "MacIntel",
  vendor: "Apple"
};

ws.send(JSON.stringify({
  command: "create_custom_profile",
  name: "My Custom iPhone",
  config: completeProfile
}));
```

**Step 2: Validate all required fields**

Required fields checklist:
- [ ] hardware (cores, memory, gpu, maxTouchPoints)
- [ ] display (width, height, colorDepth, dpr)
- [ ] userAgent (valid user agent string)
- [ ] language (e.g., "en-US")
- [ ] timezone (valid timezone name)
- [ ] platform (e.g., "MacIntel", "Linux")

**Step 3: Use unique profile name**
```javascript
// Check existing names first
ws.send(JSON.stringify({
  command: "list_anonymity_profiles"
}));

// Use name not in list
ws.send(JSON.stringify({
  command: "create_custom_profile",
  name: "Unique Name Here",
  config: { ... }
}));
```

---

## Issue: Profile Switching Causes Issues

### Symptoms
- Old profile data persists
- Inconsistent state between tabs
- Switch fails with error

### Diagnosis
- Switching too quickly
- Not waiting for response
- Old tabs retaining old profile

### Solution

**Proper profile switching:**
```javascript
// 1. Wait for previous operation
await getResponse(ws); // Wait for last command response

// 2. Switch profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "Galaxy S24"
}));

// 3. Wait for response
const response = await getResponse(ws);

// 4. Validate new profile
ws.send(JSON.stringify({
  command: "get_anonymity_profile"
}));

// 5. Navigate (new profile applies)
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://example.com"
}));
```

**For multiple tabs:**
```javascript
// Profile applies to all tabs in session
// But you must navigate for changes to apply

// After switching profile
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://example.com"
}));

// Each tab gets new profile on navigation
// Old tab with old page = old profile visually but new profile active
```

---

## Issue: Validation Commands Timeout

### Symptoms
```
WebSocket command timed out after 5000ms
```

### Diagnosis
- Server processing slow
- Network latency high
- Browser instance overloaded

### Solution

**Step 1: Check browser health**
```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_status"
}));

// If this times out, browser may be hung
// Try restarting browser instance
```

**Step 2: Increase timeout**
```javascript
// Client-side timeout increase
const timeout = 10000; // 10 seconds instead of 5

ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));
```

**Step 3: Reduce load**
```javascript
// If running many sessions, reduce concurrent count
// Wait for response before sending next command

// Bad: Fire all at once
for (let i = 0; i < 100; i++) {
  ws.send(JSON.stringify({ command: "navigate", url: "..." }));
}

// Good: Wait between commands
for (let i = 0; i < 100; i++) {
  ws.send(JSON.stringify({ command: "navigate", url: "..." }));
  await getResponse(ws); // Wait for response
}
```

---

## Issue: Performance Degradation

### Symptoms
- Page loads slower
- Increased latency
- CPU usage high

### Diagnosis
- Behavioral modules causing overhead
- Too many concurrent sessions
- Profile validation running continuously

### Solution

**Step 1: Disable behavioral for speed**
```javascript
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));
// Removes ~20ms per interaction
```

**Step 2: Reduce validation frequency**
```javascript
// Bad: Check every command
for (let i = 0; i < 100; i++) {
  ws.send(JSON.stringify({ command: "validate_anonymity_consistency" }));
}

// Good: Check once per session
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));
// Verify once, then proceed
```

**Step 3: Monitor actual impact**
```javascript
// Baseline (no anonymity)
const noAnon = await measureTime(() => {
  // Navigate and interact
});

// With anonymity
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

const withAnon = await measureTime(() => {
  // Same navigation and interaction
});

console.log(`Overhead: ${((withAnon - noAnon) / noAnon * 100).toFixed(1)}%`);
// Expected: 4-5%
```

---

## Issue: Detection Service Still Detects Bot

### Symptoms
- CAPTCHA triggered despite anonymity
- Traffic blocked
- Device rejected as suspicious

### Diagnosis
- Detection service uses more than JavaScript
- IP-based detection not blocked by anonymity
- Behavioral patterns not realistic enough
- Detection service uses multiple vectors

### Solution

**Step 1: Improve behavioral realism**
```javascript
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 85,        // Realistic typing
  mouse_speed: 1.0,
  pauses: true    // Include thinking delays
}));
```

**Step 2: Adjust device profile**
```javascript
// If detection seems device-specific
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "random"  // Try different device
}));
```

**Step 3: Use residential proxy**
```javascript
// Anonymity handles JavaScript fingerprinting
// Proxy handles IP-based detection
// Use together for best results

// Set anonymity
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

// Use proxy via basset-hound-networking
// (separate from anonymity)
```

**Step 4: Slow down interactions**
```javascript
// Some detectors look for automated speed
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 60,  // Slower typing
  pauses: true
}));

// Add manual delays
ws.send(JSON.stringify({ command: "wait", duration: 2000 }));
ws.send(JSON.stringify({ command: "click", selector: ".button" }));
ws.send(JSON.stringify({ command: "wait", duration: 1000 }));
```

---

## Debugging Checklist

When anonymity isn't working:

1. **Profile Status**
   - [ ] Profile set correctly (`get_anonymity_status`)
   - [ ] Profile name exists (`get_available_profiles`)
   - [ ] No typos in profile name

2. **Consistency**
   - [ ] Consistency check passes (`validate_anonymity_consistency`)
   - [ ] No issues reported
   - [ ] All values coherent

3. **Leakage**
   - [ ] Check fingerprint leakage (`check_fingerprint_leakage`)
   - [ ] No leaks detected
   - [ ] All vectors spoofed

4. **Behavioral**
   - [ ] Behavioral status correct (`get_behavioral_status`)
   - [ ] Interactions have delays
   - [ ] Mouse moves smoothly

5. **Performance**
   - [ ] Overhead acceptable (<5%)
   - [ ] Memory usage normal (<100MB)
   - [ ] No timeouts

6. **Browser State**
   - [ ] Session active
   - [ ] Page fully loaded
   - [ ] No errors in console

---

## Getting Help

If issue persists:

1. **Gather diagnostics:**
```javascript
const diag = {
  status: await getStatus(),
  validation: await validateConsistency(),
  leakage: await checkLeakage(),
  behavioral: await getBehavioralStatus(),
  profile: await getProfile(),
  stats: await getStatistics()
};

console.log(JSON.stringify(diag, null, 2));
```

2. **Run anonymity tests:**
```bash
npm test -- tests/anonymity/
```

3. **Check logs:**
```bash
tail -100 /var/log/basset-hound-browser.log
```

4. **Report issue with:**
   - Exact error message
   - v12.4.0 version confirmation
   - Diagnostic output (above)
   - Steps to reproduce
   - Expected vs actual behavior

---

**End of Troubleshooting Guide**

