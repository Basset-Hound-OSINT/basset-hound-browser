# Basset Hound Browser v12.4.0 - Complete Anonymity User Guide

**Target Audience:** Integration engineers, automation developers, security researchers  
**Scope:** Complete anonymity system usage, integration patterns, advanced configuration  
**Duration:** 30-60 minutes to read and understand  

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Profile System](#profile-system)
4. [WebSocket Commands](#websocket-commands)
5. [Integration Patterns](#integration-patterns)
6. [Advanced Usage](#advanced-usage)
7. [Performance Tuning](#performance-tuning)
8. [Monitoring & Debugging](#monitoring--debugging)
9. [Best Practices](#best-practices)

---

## Architecture Overview

### Three-Layer Anonymity Stack

```
Layer 1: Hardware Fingerprint Spoofing
├─ Spoof navigator.hardwareConcurrency (CPU cores)
├─ Spoof navigator.deviceMemory (RAM)
├─ Spoof WebGL vendor/renderer
├─ Spoof screen dimensions
└─ All others...

Layer 2: Fake Data Generators
├─ Consistent per-profile user agent
├─ Device-appropriate screen specs
├─ GPU/CPU matching device class
├─ Timezone-aligned language settings
└─ Battery characteristics

Layer 3: Behavioral Anonymization
├─ Mouse movement patterns
├─ Keyboard typing patterns
├─ Timing randomization
└─ Interaction patterns

INTEGRATION: Anonymity Profile Manager
└─ Single interface combining all 3 layers
```

### Session Architecture

```
Browser Session
├─ Session ID (persistent for lifetime)
├─ Active Profile (one per session)
├─ Hardware State (per profile)
├─ Behavioral State (enabled/disabled)
└─ Consistency Checks (8-point validation)
```

---

## Core Concepts

### What is Anonymity?

**In Basset Hound v12.4.0, anonymity means:**

1. **Hardware Spoofing** - Browser reports false hardware that doesn't match real system
2. **Data Consistency** - All spoofed values are coherent (e.g., GPU matches claimed specs)
3. **Behavioral Realism** - Interactions appear human-like, not automated
4. **Session Persistence** - Spoofed identity maintained throughout session
5. **Detection Prevention** - Blocks JavaScript fingerprinting scripts

### What Anonymity Does NOT Do

❌ **IP Masking** - Use Tor or proxy integration for IP anonymity  
❌ **Cookie Blocking** - Use profile configuration  
❌ **Cross-Device Tracking** - Beyond browser scope  
❌ **ML Pattern Learning** - Patterns are deterministic (v12.5.0+)  
❌ **WebRTC IP Leak** - Blocked via Electron preferences  

---

## Profile System

### Built-in Device Profiles

#### Mobile Phones

```javascript
// iPhone Series
"iPhone 15 Pro"    // 6 cores, 8GB, A17 Pro
"iPhone 15"        // 6 cores, 6GB, A16
"iPhone 14"        // 6 cores, 6GB, A15
"iPhone 13"        // 4 cores, 4GB, A15

// Samsung Galaxy
"Galaxy S24"       // 8 cores, 8GB, Snapdragon
"Galaxy S23"       // 8 cores, 8GB, Snapdragon
"Galaxy S21 Ultra" // 8 cores, 12GB, Snapdragon

// Google Pixel
"Pixel 8"          // 8 cores, 8GB, Tensor G3
"Pixel 7 Pro"      // 8 cores, 12GB, Tensor
"Pixel 6"          // 8 cores, 8GB, Tensor
```

#### Tablets

```javascript
"iPad Pro 12.9"    // 8 cores, 16GB, M2
"iPad Air"         // 6 cores, 8GB, A14
"Galaxy Tab S9"    // 8 cores, 8GB, Snapdragon
```

#### Laptops

```javascript
// Apple
"MacBook Pro 16"   // M3 Max, 12 cores, 36GB
"MacBook Pro 14"   // M3, 8 cores, 24GB
"MacBook Air M2"   // 8 cores, 16GB

// Microsoft
"Surface Laptop 6" // 12 cores, 24GB
"Surface Laptop 5" // 12 cores, 16GB

// Others
"Dell XPS 13"      // 8 cores, 16GB
"HP Pavilion"      // 8 cores, 16GB
```

#### Desktops

```javascript
"Windows Desktop"  // 16 cores, 32GB
"Linux Desktop"    // 8 cores, 16GB
```

### Profile Structure

Each profile contains:

```javascript
{
  "category": "smartphone",
  "brand": "Apple",
  "model": "iPhone 15 Pro",
  "year": 2023,
  "osType": "iOS",
  "osVersion": "17.4.1",
  
  // Hardware specs
  "hardware": {
    "cores": 6,
    "memory": 8,         // GB
    "gpu": "Apple A17 Pro",
    "maxTouchPoints": 5,
    "colorDepth": 24,
    "devicePixelRatio": 3
  },
  
  // Display specs
  "display": {
    "width": 393,
    "height": 852,
    "colorDepth": 24,
    "pixelDepth": 24,
    "devicePixelRatio": 3,
    "availWidth": 393,
    "availHeight": 812
  },
  
  // Browser/OS info
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X)...",
  "language": "en-US",
  "languages": ["en-US", "en"],
  "timezone": "America/Los_Angeles",
  "platform": "MacIntel",
  "vendor": "Apple"
}
```

### Profile Consistency Rules

**Profiles validate against these rules:**

1. **Hardware-Display Match**
   - Mobile: DPI 1-3x, portrait aspect ratio
   - Tablet: 4:3 or 16:10 aspect ratio
   - Desktop: 16:9 or 16:10 aspect ratio

2. **CPU-Memory Realism**
   - Budget phones: 4-6 cores, 4-6GB RAM
   - Flagship phones: 6-8 cores, 8-12GB RAM
   - Laptops: 8-16 cores, 16-32GB RAM
   - Desktops: 16+ cores, 32GB+ RAM

3. **GPU-Device Matching**
   - Apple devices: A-series chips
   - Samsung: Snapdragon or Exynos
   - Google: Tensor series
   - Intel/AMD: x86 GPUs

4. **UserAgent-OS Version**
   - iOS versions match actual iPhone models
   - Android versions match actual devices
   - macOS versions current for year

5. **Timezone-Language**
   - Language aligns with timezone region
   - Multiple languages realistic for region

---

## WebSocket Commands

### Profile Management

#### set_anonymity_profile

**Set active anonymity profile for session**

```javascript
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"  // Exact profile name
}));

// Response:
{
  success: true,
  sessionId: "anon_abc123...",
  profile: "iPhone 15 Pro",
  device: { cores: 6, memory: 8, gpu: "Apple A17 Pro", ... },
  hardwareSpoof: { ... },
  fakeData: { ... },
  behaviors: { ... }
}
```

**Profile can be:**
- Exact name: "iPhone 15 Pro"
- "random" - Picks random profile
- Custom profile name if created

**After calling:**
- Hardware spoofing activated
- Fake data generators configured
- All subsequent pages use this profile
- Profile persists until reset or changed

---

#### get_anonymity_profile

**Get currently active profile**

```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_profile"
}));

// Response:
{
  success: true,
  profile: "iPhone 15 Pro",  // null if not set
  active: true,
  device: { ... }
}
```

---

#### list_anonymity_profiles

**List all available profiles with optional filtering**

```javascript
ws.send(JSON.stringify({
  command: "list_anonymity_profiles",
  device_type: "mobile"  // Optional: "mobile", "desktop", "tablet"
}));

// Response:
{
  success: true,
  profiles: [
    "iPhone 15 Pro",
    "iPhone 15",
    "Galaxy S24",
    ...
  ],
  count: 42,
  categories: {
    mobile: 15,
    desktop: 12,
    tablet: 8,
    ...
  }
}
```

---

#### get_available_profiles

**Get complete profile list**

```javascript
ws.send(JSON.stringify({
  command: "get_available_profiles"
}));

// Response includes all built-in + custom profiles
```

---

#### get_random_profile

**Get random profile of specific type**

```javascript
ws.send(JSON.stringify({
  command: "get_random_profile",
  device_type: "mobile"  // "mobile", "desktop", "tablet"
}));

// Executes injection script automatically
```

---

### Custom Profiles

#### create_custom_profile

**Create custom device profile**

```javascript
ws.send(JSON.stringify({
  command: "create_custom_profile",
  name: "My iPhone",
  config: {
    // Must include all required fields
    hardware: { cores: 6, memory: 8, gpu: "A17", maxTouchPoints: 5 },
    display: { width: 393, height: 852, dpr: 3, colorDepth: 24 },
    userAgent: "Mozilla/5.0...",
    language: "en-US",
    timezone: "America/Los_Angeles",
    platform: "MacIntel",
    // ... more fields
  }
}));

// Response:
{
  success: true,
  profile: "My iPhone",
  validated: true
}
```

**Validation rules:**
- All required fields must be present
- Values must be realistic for device type
- UserAgent must match OS version
- Language must match timezone region

---

#### delete_custom_profile

**Delete custom profile (cannot delete built-in)**

```javascript
ws.send(JSON.stringify({
  command: "delete_custom_profile",
  name: "My iPhone"
}));

// Response:
{
  success: true,
  deleted: "My iPhone"
}
```

---

#### export_profile

**Export profile as JSON for reuse**

```javascript
ws.send(JSON.stringify({
  command: "export_profile",
  name: "iPhone 15 Pro"
}));

// Response:
{
  success: true,
  json: "{\"hardware\": {...}, ...}"  // Full profile JSON
}
```

---

#### import_profile

**Import previously exported profile**

```javascript
ws.send(JSON.stringify({
  command: "import_profile",
  json: "{\"hardware\": {...}, ...}",
  name: "My Imported Profile"  // Optional: custom name
}));

// Response:
{
  success: true,
  profile: "My Imported Profile"
}
```

---

### Behavioral Modules

#### enable_behavioral_modules

**Enable human-like interaction patterns**

```javascript
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 90,           // Typing speed: 60-120 words/minute
  mouse_speed: 1.0,  // Mouse velocity multiplier: 0.5-2.0
  pauses: true       // Add realistic think times
}));

// Enables:
// - Mouse movement curves
// - Keyboard typing patterns
// - Timing randomization
// - Interaction patterns
```

**Parameters:**
- `wpm` (60-120): Words per minute typing speed
  - 60 = Slow, careful typing
  - 90 = Normal, realistic typing
  - 120 = Fast, experienced user
- `mouse_speed` (0.5-2.0): Relative mouse velocity
  - 0.5 = Slow, careful mouse movement
  - 1.0 = Normal speed
  - 2.0 = Fast, confident movement
- `pauses` (true/false): Include realistic think times

---

#### disable_behavioral_modules

**Disable behavioral patterns (instant interactions)**

```javascript
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));

// Disables all timing patterns
// Interactions become instant again
```

---

#### get_behavioral_status

**Check behavioral module status**

```javascript
ws.send(JSON.stringify({
  command: "get_behavioral_status"
}));

// Response:
{
  success: true,
  enabled: true,
  wpm: 90,
  mouseSpeed: 1.0,
  modules: {
    mouseMovement: true,
    keyboardTyping: true,
    timingRandomization: true,
    interactionPatterns: true
  }
}
```

---

### Validation & Status

#### get_anonymity_status

**Get current anonymity state**

```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_status"
}));

// Response:
{
  success: true,
  active: true,
  profile: "iPhone 15 Pro",
  sessionId: "anon_abc123...",
  device: { ... },
  protection: {
    hardware: true,
    data: true,
    behavioral: true
  }
}
```

---

#### validate_anonymity_consistency

**Verify all spoofed values are coherent**

```javascript
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));

// Response:
{
  success: true,
  valid: true,
  issues: [],  // Empty = all good
  checks: {
    hardwareRealism: { passed: true },
    dataCoherence: { passed: true },
    behavioralPattern: { passed: true },
    // 8 validation checks total
  }
}
```

**Validates:**
1. Hardware values realistic for device class
2. Display dimensions match device specs
3. GPU specs consistent with hardware
4. UserAgent matches OS version
5. Language matches timezone
6. All values consistent across checks
7. No data leakage detected
8. Session state isolated

---

#### check_fingerprint_leakage

**Test for JavaScript fingerprinting leakage**

```javascript
ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"  // "canvas", "webgl", "font", "performance", "all"
}));

// Response:
{
  success: true,
  leaks: [],  // Empty = no leaks!
  device_consistent: true,
  checks: {
    hardwareConcurrency: "spoofed",
    deviceMemory: "spoofed",
    canvas: "injected",
    webgl: "spoofed",
    performance: "spoofed",
    fonts: "spoofed",
    audio: "spoofed"
  }
}
```

**Check types:**
- `"canvas"` - Canvas fingerprinting only
- `"webgl"` - WebGL detection
- `"font"` - Font enumeration
- `"performance"` - Performance API
- `"all"` - All checks (default)

---

#### get_protection_status

**Get anonymity protection level summary**

```javascript
ws.send(JSON.stringify({
  command: "get_protection_status"
}));

// Response:
{
  success: true,
  anonymityActive: true,
  protectionLevel: "full",  // "none", "partial", "full"
  sessionId: "anon_abc123...",
  modules: {
    hardwareSpoof: true,
    fakeData: true,
    behavioral: true
  },
  evasionRate: 0.87  // 87% evasion estimate
}
```

---

### Reset & Statistics

#### reset_anonymity_settings

**Clear anonymity for tab/session**

```javascript
ws.send(JSON.stringify({
  command: "reset_anonymity_settings"
}));

// Response:
{
  success: true,
  reset: true
}

// After reset:
// - Profile cleared
// - Hardware spoofing disabled
// - Behavioral modules disabled
// - Session isolation maintained
```

---

#### get_anonymity_statistics

**Get usage statistics**

```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_statistics"
}));

// Response:
{
  success: true,
  totalProfiles: 42,
  profilesUsed: 3,
  customProfiles: 1,
  deviceTypes: {
    mobile: 15,
    desktop: 12,
    tablet: 8
  },
  vendors: {
    Apple: 8,
    Samsung: 6,
    Google: 4,
    Microsoft: 3
  },
  sessions: {
    active: 2,
    total: 15
  }
}
```

---

## Integration Patterns

### Pattern 1: Simple Anonymity

**For basic anonymity with single device:**

```javascript
// 1. Set profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

// 2. Use normally
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://example.com"
}));

// Repeat steps 2 for all browsing
```

---

### Pattern 2: Multi-Device Testing

**Test same website with different devices:**

```javascript
const devices = [
  "iPhone 15 Pro",
  "Galaxy S24",
  "MacBook Pro 16",
  "Windows Desktop"
];

for (const device of devices) {
  // Set device
  ws.send(JSON.stringify({
    command: "set_anonymity_profile",
    profile: device
  }));
  
  // Wait for response
  // Navigate and test
  
  // Validate
  ws.send(JSON.stringify({
    command: "check_fingerprint_leakage",
    check_type: "all"
  }));
}
```

---

### Pattern 3: Random Device Rotation

**Use random device for each session:**

```javascript
// At session start
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "random"
}));

// Enable behavioral for realism
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 90
}));

// Browse with random device identity
```

---

### Pattern 4: Behavioral Realism

**When detection evasion is critical:**

```javascript
// Set profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

// Enable behavioral modules
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 85,
  mouse_speed: 1.0,
  pauses: true
}));

// Validate
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));

// Now behave like human
ws.send(JSON.stringify({
  command: "wait",
  duration: 2000  // Think time
}));

ws.send(JSON.stringify({
  command: "click",
  selector: ".button"
}));
```

---

### Pattern 5: Custom Profile Engineering

**For specific device profiles:**

```javascript
// Create custom profile
ws.send(JSON.stringify({
  command: "create_custom_profile",
  name: "Custom Mobile",
  config: {
    hardware: {
      cores: 8,
      memory: 12,
      gpu: "Custom GPU",
      maxTouchPoints: 5
    },
    display: {
      width: 480,
      height: 800,
      dpr: 2,
      colorDepth: 24
    },
    userAgent: "Custom UA...",
    timezone: "America/New_York",
    language: "en-US"
  }
}));

// Use custom profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "Custom Mobile"
}));

// Validate
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));
```

---

## Advanced Usage

### A/B Testing with Anonymity

```javascript
// Control: Real system
const control = async (url) => {
  const browser = new BrowserClient('ws://localhost:8765', 'control');
  await browser.navigate(url);
  return await browser.getHtml();
};

// Treatment: iPhone 15 Pro
const treatment = async (url) => {
  const browser = new BrowserClient('ws://localhost:8765', 'treatment');
  await browser.command('set_anonymity_profile', { profile: "iPhone 15 Pro" });
  await browser.navigate(url);
  return await browser.getHtml();
};

// Compare results
const controlResult = await control('https://example.com');
const treatmentResult = await treatment('https://example.com');

console.log('Pages match:', controlResult === treatmentResult);
```

### Detecting Fingerprinting Attempts

```javascript
// Enable JavaScript interception
ws.send(JSON.stringify({
  command: "set_request_interception",
  enabled: true
}));

// Set profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

// Navigate and monitor
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://fingerprinting-test.local"
}));

// Check for leakage
ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"
}));
```

### Performance Benchmarking

```javascript
// Without anonymity
const baseline = await measurePerformance(() => {
  // Navigate and interact
});

// With anonymity
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

const withAnonymity = await measurePerformance(() => {
  // Navigate and interact
});

console.log(`Overhead: ${((withAnonymity - baseline) / baseline * 100).toFixed(2)}%`);
// Expected: ~4% overhead
```

---

## Performance Tuning

### Reduce Overhead

```javascript
// Disable behavioral if not needed
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));

// Use simpler profiles (less overhead)
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "Windows Desktop"  // Fewer device checks
}));
```

### Optimize Typing Speed

```javascript
// Fast typing (less overhead)
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 120  // Faster = less thinking time
}));

// Slow typing (more realistic)
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 60   // Slower = more thinking time
}));
```

### Memory Management

```javascript
// Reset unused sessions
ws.send(JSON.stringify({
  command: "reset_anonymity_settings"
}));

// This clears profile data and frees memory
// Profile can be reapplied if needed
```

---

## Monitoring & Debugging

### Enable Debug Logging

```javascript
// Via environment variable
process.env.DEBUG = 'basset:anonymity:*';

// Or in console
ws.send(JSON.stringify({
  command: "execute_javascript",
  code: "window.DEBUG_ANONYMITY = true;"
}));
```

### Monitor Consistency

```javascript
// Regular consistency checks
setInterval(() => {
  ws.send(JSON.stringify({
    command: "validate_anonymity_consistency"
  }));
}, 5000);  // Every 5 seconds

// Parse response and alert on issues
```

### Fingerprint Leak Testing

```javascript
// Comprehensive leak detection
const checkAllVectors = async () => {
  const vectors = [
    "canvas",
    "webgl",
    "font",
    "performance",
    "audio",
    "navigator",
    "storage"
  ];
  
  for (const vector of vectors) {
    const result = await browser.command('check_fingerprint_leakage', {
      check_type: vector
    });
    
    if (result.leaks.length > 0) {
      console.error(`Leakage detected: ${vector}`);
      console.error(result.leaks);
    }
  }
};
```

---

## Best Practices

### 1. Always Validate After Profile Change

```javascript
// Bad: Set profile and navigate immediately
ws.send(JSON.stringify({ command: "set_anonymity_profile", profile: "iPhone 15" }));
ws.send(JSON.stringify({ command: "navigate", url: "https://example.com" }));

// Good: Set, validate, then navigate
ws.send(JSON.stringify({ command: "set_anonymity_profile", profile: "iPhone 15" }));
// Wait for response...
ws.send(JSON.stringify({ command: "validate_anonymity_consistency" }));
// Verify valid: true...
ws.send(JSON.stringify({ command: "navigate", url: "https://example.com" }));
```

### 2. Use Realistic Typing Speeds

```javascript
// Realistic range: 60-120 WPM
// Too slow (30 WPM): Suspicious
// Too fast (200+ WPM): Impossible
// Optimal (80-100 WPM): Most believable

ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 90  // 90 WPM = realistic office worker
}));
```

### 3. Match Profile to Use Case

```javascript
// Mobile investigation: "iPhone 15 Pro"
// Desktop research: "MacBook Pro 16"
// Budget browsing: "Galaxy A54"
// Generic: "random"

// Don't use high-end profile for low-engagement sites (suspicious)
// Don't use old profile year for current year (inconsistent)
```

### 4. Enable Behavioral Only When Needed

```javascript
// High detection risk: Enable behavioral
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 85
}));

// Low risk, speed important: Disable behavioral
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));
```

### 5. Isolate Sessions

```javascript
// Each logical session should have own anonymity state
// Don't share profiles between unrelated activities

const sessionA = new BrowserClient('ws://localhost:8765', 'session-a');
const sessionB = new BrowserClient('ws://localhost:8765', 'session-b');

// sessionA can use iPhone
// sessionB can use Android
// No cross-contamination
```

### 6. Monitor Performance

```javascript
// Baseline without anonymity
// Anonymity with behavioral disabled
// Anonymity with behavioral enabled

// Choose right balance for your use case
// Typical: <5% overhead is acceptable
```

### 7. Test Against Real Detectors

```javascript
// Use provided check_fingerprint_leakage command
// Test against known fingerprinting sites
// Adjust profile/behavioral settings based on results

ws.send(JSON.stringify({
  command: "navigate",
  url: "https://fingerprinting-test-site.local"
}));

ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"
}));
```

---

## Troubleshooting Common Issues

### "Profile not found"

**Cause:** Misspelled or non-existent profile name  
**Solution:** List available profiles first

```javascript
ws.send(JSON.stringify({
  command: "get_available_profiles"
}));
```

---

### "Consistency check failed"

**Cause:** Profile values don't match together  
**Solution:** Use built-in profile or validate custom profile

```javascript
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));
// Check 'issues' array for specific problems
```

---

### Fingerprints still leaking

**Cause:** Injection not applied or JavaScript cache  
**Solution:** 

1. Verify profile set correctly
2. Hard refresh page (Ctrl+Shift+R)
3. Check injection code presence

```javascript
ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"
}));
```

---

### High memory usage

**Cause:** Behavioral modules or many profiles  
**Solution:**

1. Disable behavioral if not needed
2. Reset unused sessions
3. Monitor statistics

```javascript
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));

ws.send(JSON.stringify({
  command: "reset_anonymity_settings"
}));
```

---

**End of User Guide**

