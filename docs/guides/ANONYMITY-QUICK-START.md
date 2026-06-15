# Basset Hound Browser v12.4.0 - Anonymity Quick Start

**Time to anonymity:** 5 minutes  
**Difficulty:** Beginner  
**Required:** WebSocket client library (any language)

---

## Step 1: Connect to Browser (1 minute)

```javascript
// Node.js
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected to Basset Hound Browser');
  // Ready to send commands
});

ws.on('message', (data) => {
  console.log('Response:', JSON.parse(data));
});
```

```python
# Python
import asyncio
import websockets
import json

async def connect():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        # Ready to send commands
        pass
```

---

## Step 2: Enable Anonymity Profile (2 minutes)

```javascript
// Send command to set iPhone 15 Pro profile
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "iPhone 15 Pro"
}));

// Response:
// {
//   success: true,
//   sessionId: "anon_abc123...",
//   profile: "iPhone 15 Pro",
//   device: {
//     cores: 6,
//     memory: 8,
//     gpu: "Apple A17 Pro",
//     maxTouchPoints: 5
//   }
// }
```

**That's it!** Browser now:
- ✅ Reports as iPhone 15 Pro to websites
- ✅ Has consistent spoofed hardware specs
- ✅ Avoids fingerprinting detection

---

## Step 3: Start Browsing (2 minutes)

```javascript
// Navigate to a website
ws.send(JSON.stringify({
  command: "navigate",
  url: "https://example.com"
}));

// Interact normally - anonymity is automatic
ws.send(JSON.stringify({
  command: "click",
  selector: ".button"
}));

ws.send(JSON.stringify({
  command: "fill",
  selector: "input[name='email']",
  value: "test@example.com"
}));
```

The browser appears as iPhone 15 Pro to all websites and JavaScript.

---

## Available Profiles (Choose Your Device)

```javascript
// Get list of available profiles
ws.send(JSON.stringify({
  command: "get_available_profiles"
}));

// Response includes profiles like:
// - iPhone 15 Pro, iPhone 15, iPhone 14, iPhone 13
// - Galaxy S24, Galaxy S23, Galaxy S21
// - Pixel 8 Pro, Pixel 7
// - MacBook Pro 16", MacBook Air M2
// - Windows Desktop, Surface Laptop
// ... and more
```

**Popular profiles:**
- **Mobile:** "iPhone 15 Pro", "Galaxy S24", "Pixel 8"
- **Tablet:** "iPad Pro 12.9"
- **Laptop:** "MacBook Pro 16", "Surface Laptop 6"
- **Desktop:** "Dell XPS 13", "Windows Desktop"

### Use Random Profile

```javascript
// Let browser choose a random device
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "random"
}));
```

### Filter by Device Type

```javascript
// Get random mobile device
ws.send(JSON.stringify({
  command: "get_random_profile",
  device_type: "mobile"
}));

// Options: "mobile", "desktop", "tablet"
```

---

## Verify Anonymity Works

```javascript
// Check if fingerprinting detection is blocked
ws.send(JSON.stringify({
  command: "check_fingerprint_leakage",
  check_type: "all"
}));

// Response:
// {
//   success: true,
//   leaks: [],  // Empty = no fingerprints detected!
//   device_consistent: true,
//   checks: {
//     hardwareConcurrency: "spoofed",
//     deviceMemory: "spoofed",
//     canvas: "injected",
//     webgl: "spoofed",
//     performance: "spoofed"
//   }
// }

// If leaks array is empty → Anonymity working!
```

---

## Enable Behavioral Realism (Optional)

```javascript
// Make interactions appear human-like
ws.send(JSON.stringify({
  command: "enable_behavioral_modules",
  wpm: 85  // Typing speed: 60-120 words per minute
}));

// Now interactions use:
// - Realistic mouse movements (not instant)
// - Variable typing speed (not robotic)
// - Natural timing delays
// - Human-like click patterns
```

---

## Switch Profiles Mid-Session

```javascript
// Change to Android device
ws.send(JSON.stringify({
  command: "set_anonymity_profile",
  profile: "Galaxy S24"
}));

// Browser now appears as Galaxy S24
// Previous profile data cleared
// New profile applies to next page load
```

---

## Get Anonymity Status

```javascript
ws.send(JSON.stringify({
  command: "get_anonymity_status"
}));

// Response shows current device, spoofing status, etc.
```

---

## Troubleshooting

### "Profile not found" error

```javascript
// Check available profiles
ws.send(JSON.stringify({
  command: "get_available_profiles"
}));

// Use exact name from response
```

### Fingerprints still leaking

```javascript
// Verify consistency
ws.send(JSON.stringify({
  command: "validate_anonymity_consistency"
}));

// Response shows if all values aligned
```

### Performance issues

```javascript
// Anonymity overhead is ~4% - if slower, disable behavioral
ws.send(JSON.stringify({
  command: "disable_behavioral_modules"
}));
```

---

## One-Liner Examples

### Set iPhone + Validate
```javascript
ws.send(JSON.stringify({ command: "set_anonymity_profile", profile: "iPhone 15 Pro" }));
ws.send(JSON.stringify({ command: "check_fingerprint_leakage", check_type: "all" }));
```

### Random Device + Behavior
```javascript
ws.send(JSON.stringify({ command: "set_anonymity_profile", profile: "random" }));
ws.send(JSON.stringify({ command: "enable_behavioral_modules", wpm: 90 }));
```

### Navigate Anonymous
```javascript
ws.send(JSON.stringify({ command: "set_anonymity_profile", profile: "Galaxy S24" }));
ws.send(JSON.stringify({ command: "navigate", url: "https://example.com" }));
```

---

## Next Steps

- **Advanced Features:** See ANONYMITY-USER-GUIDE.md
- **Troubleshooting:** See ANONYMITY-TROUBLESHOOTING.md
- **API Reference:** See docs/API-REFERENCE.md
- **Test Coverage:** Run `npm test -- tests/anonymity/`

---

**That's all you need to get started!**
Enable anonymity in 2 commands, browse anonymously.

