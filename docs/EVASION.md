# Basset Hound Browser - Bot Detection Evasion Techniques

Comprehensive documentation of all bot detection evasion techniques implemented in the Basset Hound Browser.

## Table of Contents

- [Overview](#overview)
- [Detection Methods](#detection-methods)
- [Evasion Techniques](#evasion-techniques)
  - [Navigator Property Spoofing](#navigator-property-spoofing)
  - [WebGL Fingerprint Evasion](#webgl-fingerprint-evasion)
  - [Canvas Fingerprint Evasion](#canvas-fingerprint-evasion)
  - [Audio Fingerprint Evasion](#audio-fingerprint-evasion)
  - [Timezone Spoofing](#timezone-spoofing)
  - [Screen Property Spoofing](#screen-property-spoofing)
  - [Chrome Object Emulation](#chrome-object-emulation)
  - [Automation Trace Removal](#automation-trace-removal)
  - [Request Header Modification](#request-header-modification)
  - [Human Behavior Simulation](#human-behavior-simulation)
- [Configuration](#configuration)
- [Detection Testing](#detection-testing)
- [Limitations](#limitations)
- [Best Practices](#best-practices)

## Overview

Bot detection systems use various techniques to identify automated browsers:

1. **Browser Fingerprinting** - Unique browser characteristics
2. **Behavior Analysis** - Unnatural interaction patterns
3. **JavaScript Probes** - Checking for automation indicators
4. **Request Analysis** - HTTP header patterns
5. **Timing Analysis** - Inhuman response times

Basset Hound Browser implements countermeasures for each category.

## Detection Methods

### What Bot Detectors Look For

| Category | Detection Method | Risk Level |
|----------|------------------|------------|
| Navigator | `navigator.webdriver` property | High |
| Navigator | Empty or unusual plugins array | Medium |
| Navigator | Inconsistent languages/platform | Medium |
| WebGL | Specific renderer strings | Medium |
| Canvas | Deterministic fingerprints | High |
| Audio | Deterministic frequency data | Medium |
| Timing | Instant responses | High |
| Behavior | Linear mouse movements | Medium |
| Behavior | Consistent typing speed | Medium |
| Headers | Missing or unusual headers | Medium |
| JavaScript | Automation-specific properties | High |

### Popular Detection Services

- **Cloudflare Bot Management**
- **PerimeterX**
- **Akamai Bot Manager**
- **reCAPTCHA / hCaptcha**
- **DataDome**
- **Imperva**
- **Fingerprint.js**
- **CreepJS**

## Evasion Techniques

### Navigator Property Spoofing

#### navigator.webdriver

The most common detection method checks if `navigator.webdriver` is true.

**Evasion Implementation:**

```javascript
// Override navigator.webdriver to undefined
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});

// Also delete from prototype
delete Object.getPrototypeOf(navigator).webdriver;
```

**Location:** `evasion/fingerprint.js`, `preload.js`

---

#### navigator.plugins

Automation browsers often have empty or minimal plugin arrays.

**Evasion Implementation:**

```javascript
const mockPlugins = {
  0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
  1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
  2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
  length: 3,
  item: function(index) { return this[index]; },
  namedItem: function(name) { /* ... */ },
  refresh: function() {}
};

Object.defineProperty(navigator, 'plugins', {
  get: () => mockPlugins,
  configurable: true
});
```

**Spoofed Plugins:**
- Chrome PDF Plugin
- Chrome PDF Viewer
- Native Client

---

#### navigator.mimeTypes

Similar to plugins, mimeTypes should reflect a real browser.

**Evasion Implementation:**

```javascript
const mockMimeTypes = {
  0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
  1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
  length: 2,
  item: function(index) { return this[index]; },
  namedItem: function(name) { /* ... */ }
};

Object.defineProperty(navigator, 'mimeTypes', {
  get: () => mockMimeTypes,
  configurable: true
});
```

---

#### navigator.languages & navigator.language

Should reflect realistic language preferences.

**Evasion Implementation:**

```javascript
// Random selection from common configurations
const languageConfigs = [
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['en-US', 'en', 'es'],
  ['en-US']
];

const languages = languageConfigs[Math.floor(Math.random() * languageConfigs.length)];

Object.defineProperty(navigator, 'languages', {
  get: () => languages,
  configurable: true
});

Object.defineProperty(navigator, 'language', {
  get: () => languages[0],
  configurable: true
});
```

---

#### navigator.platform

Should match the user agent's claimed OS.

**Evasion Implementation:**

```javascript
const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
const platform = platforms[Math.floor(Math.random() * platforms.length)];

Object.defineProperty(navigator, 'platform', {
  get: () => platform,
  configurable: true
});
```

---

#### navigator.hardwareConcurrency

CPU core count should appear realistic.

**Evasion Implementation:**

```javascript
// Random realistic core counts
const coreCounts = [4, 8, 12, 16];
const cores = coreCounts[Math.floor(Math.random() * coreCounts.length)];

Object.defineProperty(navigator, 'hardwareConcurrency', {
  get: () => cores,
  configurable: true
});
```

---

#### navigator.deviceMemory

RAM should appear realistic.

**Evasion Implementation:**

```javascript
// Random realistic memory amounts (GB)
const memoryAmounts = [4, 8, 16, 32];
const memory = memoryAmounts[Math.floor(Math.random() * memoryAmounts.length)];

Object.defineProperty(navigator, 'deviceMemory', {
  get: () => memory,
  configurable: true
});
```

---

### WebGL Fingerprint Evasion

WebGL renderer and vendor strings are highly identifying.

**Detected Properties:**
- `UNMASKED_VENDOR_WEBGL` (parameter 37445)
- `UNMASKED_RENDERER_WEBGL` (parameter 37446)

**Evasion Implementation:**

```javascript
const webglVendors = [
  'Google Inc. (NVIDIA)',
  'Google Inc. (AMD)',
  'Google Inc. (Intel)'
];

const webglRenderers = [
  'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)'
];

const getParameterProxyHandler = {
  apply: function(target, thisArg, args) {
    const param = args[0];
    const result = Reflect.apply(target, thisArg, args);

    // UNMASKED_VENDOR_WEBGL
    if (param === 37445) {
      return selectedVendor;
    }
    // UNMASKED_RENDERER_WEBGL
    if (param === 37446) {
      return selectedRenderer;
    }

    return result;
  }
};

// Proxy both WebGL contexts
WebGLRenderingContext.prototype.getParameter =
  new Proxy(originalGetParameter, getParameterProxyHandler);
WebGL2RenderingContext.prototype.getParameter =
  new Proxy(originalGetParameter2, getParameterProxyHandler);
```

**Location:** `evasion/fingerprint.js`

---

### Canvas Fingerprint Evasion

Canvas fingerprinting creates unique images that identify browsers.

**Evasion Implementation:**

```javascript
// Add noise to toDataURL
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type) {
  if (type === 'image/png' || type === undefined) {
    const context = this.getContext('2d');
    if (context) {
      const imageData = context.getImageData(0, 0, this.width, this.height);
      // Add subtle noise to pixel data
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] ^= randomNoiseValue; // XOR with small random value
      }
      context.putImageData(imageData, 0, 0);
    }
  }
  return originalToDataURL.apply(this, arguments);
};

// Same for toBlob
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
  // Similar noise injection
  // ...
  return originalToBlob.apply(this, arguments);
};
```

**Noise Level:** XOR with random value 0-4 per pixel channel

**Location:** `evasion/fingerprint.js`

---

### Audio Fingerprint Evasion

AudioContext fingerprinting uses audio processing characteristics.

**Evasion Implementation:**

```javascript
const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
AudioContext.prototype.createAnalyser = function() {
  const analyser = originalCreateAnalyser.apply(this, arguments);
  const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);

  analyser.getFloatFrequencyData = function(array) {
    originalGetFloatFrequencyData(array);
    // Add noise to frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] += (Math.random() - 0.5) * 0.1;
    }
  };

  return analyser;
};
```

**Noise Level:** +/- 0.05 per frequency bin

**Location:** `evasion/fingerprint.js`

---

### Timezone Spoofing

Timezone can reveal geographic location inconsistent with VPN/proxy.

**Evasion Implementation:**

```javascript
const timezones = [
  { offset: -480, name: 'America/Los_Angeles' },
  { offset: -420, name: 'America/Denver' },
  { offset: -360, name: 'America/Chicago' },
  { offset: -300, name: 'America/New_York' },
  { offset: 0, name: 'Europe/London' },
  { offset: 60, name: 'Europe/Paris' },
  { offset: 120, name: 'Europe/Helsinki' }
];

const selectedTimezone = timezones[Math.floor(Math.random() * timezones.length)];

// Override Date.getTimezoneOffset()
Date.prototype.getTimezoneOffset = function() {
  return selectedTimezone.offset;
};

// Override Intl.DateTimeFormat
const originalDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function(locale, options) {
  const format = new originalDateTimeFormat(locale, options);
  const originalResolvedOptions = format.resolvedOptions.bind(format);
  format.resolvedOptions = function() {
    const resolved = originalResolvedOptions();
    resolved.timeZone = selectedTimezone.name;
    return resolved;
  };
  return format;
};
```

**Location:** `evasion/fingerprint.js`

---

### Screen Property Spoofing

Screen dimensions can identify device types.

**Evasion Implementation:**

```javascript
const screenConfigs = [
  { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 },
  { width: 1366, height: 768, availWidth: 1366, availHeight: 728, colorDepth: 24 },
  { width: 1536, height: 864, availWidth: 1536, availHeight: 824, colorDepth: 24 },
  { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 30 },
  { width: 1440, height: 900, availWidth: 1440, availHeight: 860, colorDepth: 24 }
];

const screen = screenConfigs[Math.floor(Math.random() * screenConfigs.length)];

Object.defineProperty(screen, 'width', { get: () => screen.width });
Object.defineProperty(screen, 'height', { get: () => screen.height });
Object.defineProperty(screen, 'availWidth', { get: () => screen.availWidth });
Object.defineProperty(screen, 'availHeight', { get: () => screen.availHeight });
Object.defineProperty(screen, 'colorDepth', { get: () => screen.colorDepth });
Object.defineProperty(screen, 'pixelDepth', { get: () => screen.colorDepth });
```

**Location:** `evasion/fingerprint.js`

---

### Chrome Object Emulation

Automation browsers may lack the `chrome` global object.

**Evasion Implementation:**

```javascript
window.chrome = {
  runtime: {
    connect: function() {},
    sendMessage: function() {},
    onMessage: { addListener: function() {} }
  },
  loadTimes: function() {
    return {
      requestTime: Date.now() / 1000,
      startLoadTime: Date.now() / 1000,
      commitLoadTime: Date.now() / 1000,
      finishDocumentLoadTime: Date.now() / 1000,
      finishLoadTime: Date.now() / 1000,
      firstPaintTime: Date.now() / 1000,
      firstPaintAfterLoadTime: 0,
      navigationType: 'Other'
    };
  },
  csi: function() {
    return {
      onloadT: Date.now(),
      pageT: Date.now() - performance.timing.navigationStart,
      startE: performance.timing.navigationStart,
      tran: 15
    };
  },
  app: {
    isInstalled: false,
    InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
    RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run' }
  }
};
```

**Location:** `evasion/fingerprint.js`

---

### Automation Trace Removal

Remove properties that indicate automation tools.

**Evasion Implementation:**

```javascript
const automationProps = [
  // Phantom
  '_phantom', 'callPhantom',
  // Nightmare
  '__nightmare',
  // Selenium
  '_selenium', 'callSelenium', '_Selenium_IDE_Recorder',
  '__webdriver_script_fn', '__driver_evaluate', '__webdriver_evaluate',
  '__selenium_evaluate', '__fxdriver_evaluate',
  '__driver_unwrapped', '__webdriver_unwrapped',
  '__selenium_unwrapped', '__fxdriver_unwrapped',
  // Generic
  'bot', 'headless'
];

automationProps.forEach(prop => {
  try { delete window[prop]; } catch(e) {}
  try { delete document[prop]; } catch(e) {}
});
```

**Location:** `evasion/fingerprint.js`, `preload.js`

---

### Permissions Override

Permissions API can reveal automation.

**Evasion Implementation:**

```javascript
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = function(parameters) {
  if (parameters.name === 'notifications') {
    return Promise.resolve({ state: Notification.permission });
  }
  return originalQuery.call(this, parameters);
};
```

**Location:** `evasion/fingerprint.js`, `preload.js`

---

### iframe contentWindow Protection

Ensure iframes don't leak automation detection.

**Evasion Implementation:**

```javascript
const originalContentWindow = Object.getOwnPropertyDescriptor(
  HTMLIFrameElement.prototype, 'contentWindow'
);

Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
  get: function() {
    const window = originalContentWindow.get.call(this);
    if (window) {
      try {
        Object.defineProperty(window.navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
      } catch(e) {}
    }
    return window;
  }
});
```

**Location:** `evasion/fingerprint.js`

---

### Request Header Modification

HTTP headers can reveal automation.

**Evasion Implementation (main.js):**

```javascript
session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
  // Set realistic headers
  details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
  details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
  details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

  // Remove automation indicators
  delete details.requestHeaders['Sec-Ch-Ua-Platform'];

  callback({ requestHeaders: details.requestHeaders });
});

// Strip CSP to allow script injection
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ['']
    }
  });
});
```

**Electron Command Line:**

```javascript
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');
```

**Location:** `main.js`

---

### Human Behavior Simulation

Realistic interaction timing and patterns.

#### Random Delays

```javascript
// Uniform random delay
function humanDelay(min = 50, max = 200) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Gaussian (normal) distribution delay
function normalDelay(mean = 100, stdDev = 30) {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const delay = Math.max(10, Math.floor(mean + z * stdDev));
  return new Promise(resolve => setTimeout(resolve, delay));
}
```

**Location:** `evasion/humanize.js`

---

#### Realistic Typing

```javascript
async function humanType(text, options = {}) {
  const {
    minDelay = 30,
    maxDelay = 150,
    mistakeRate = 0.02,      // 2% chance of typo
    pauseChance = 0.05,      // 5% chance of pause
    pauseDuration = { min: 200, max: 500 }
  } = options;

  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Occasional pauses (thinking)
    if (Math.random() < pauseChance) {
      await humanDelay(pauseDuration.min, pauseDuration.max);
    }

    // Occasional mistakes with correction
    if (Math.random() < mistakeRate && result.length > 0) {
      // Type wrong character
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomOffset);
      result += wrongChar;
      await humanDelay(minDelay, maxDelay);

      // Pause before correcting
      await humanDelay(100, 300);

      // Delete wrong character
      result = result.slice(0, -1);
    }

    // Type correct character
    result += char;

    // Variable delay based on character type
    let delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    // Speed up for common letter pairs (th, he, in, etc.)
    if (isCommonPair(text[i-1], char)) {
      delay *= 0.7;
    }

    // Slow down for punctuation
    if (['.', ',', '!', '?', ';', ':'].includes(char)) {
      delay *= 1.5;
    }

    // Slow down after spaces (word boundaries)
    if (char === ' ') {
      delay *= 1.2;
    }

    await new Promise(r => setTimeout(r, delay));
  }

  return result;
}
```

**Location:** `evasion/humanize.js`

---

#### Natural Mouse Movement

Uses cubic Bezier curves for smooth, natural-looking paths.

```javascript
function generateMousePath(start, end, steps = 20) {
  const points = [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Random deviation for natural curve
  const deviation = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3;

  // Control points for cubic Bezier
  const cp1 = {
    x: start.x + dx * 0.25 + randomDeviation(deviation),
    y: start.y + dy * 0.25 + randomDeviation(deviation)
  };

  const cp2 = {
    x: start.x + dx * 0.75 + randomDeviation(deviation),
    y: start.y + dy * 0.75 + randomDeviation(deviation)
  };

  // Generate points along Bezier curve
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = cubicBezier(start, cp1, cp2, end, t);

    // Add slight jitter
    points.push({
      x: Math.round(point.x + randomJitter(2)),
      y: Math.round(point.y + randomJitter(2))
    });
  }

  return points;
}

// Occasionally overshoot target and correct
async function humanMouseMove(start, end, options = {}) {
  let path = generateMousePath(start, end);

  if (options.overshoot && Math.random() < 0.2) {
    // 20% chance to overshoot
    const overshootDist = 5 + Math.random() * 15;
    // Add overshoot point, then correction path
    // ...
  }

  return path;
}
```

**Location:** `evasion/humanize.js`

---

#### Human-like Clicking

Realistic click event sequence with timing.

```javascript
function getClickScript(selector) {
  const timing = {
    mousedownDelay: Math.floor(Math.random() * 50) + 10,
    mouseupDelay: Math.floor(Math.random() * 100) + 50,
    clickDelay: Math.floor(Math.random() * 30) + 5
  };

  return `
    (async function() {
      const element = document.querySelector('${selector}');
      if (!element) return { success: false };

      const rect = element.getBoundingClientRect();
      // Click at random position within element (not center)
      const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
      const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

      // Mousedown
      element.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
      await delay(${timing.mousedownDelay});

      // Mouseup
      element.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
      await delay(${timing.clickDelay});

      // Click
      element.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));

      return { success: true };
    })();
  `;
}
```

**Location:** `evasion/humanize.js`

---

#### Natural Scrolling

```javascript
function getScrollScript(options = {}) {
  const { y = 300, jitter = true } = options;

  return `
    (async function() {
      const targetY = ${y} + (Math.random() - 0.5) * 50;  // +/- 25px jitter
      const steps = 10 + Math.floor(Math.random() * 10);  // 10-20 steps
      const stepSize = targetY / steps;

      for (let i = 0; i < steps; i++) {
        const scrollY = stepSize * (1 + (Math.random() - 0.5) * 0.3);  // +/- 15% variation
        window.scrollBy({ top: scrollY, behavior: 'auto' });
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));  // 20-50ms per step
      }
    })();
  `;
}
```

**Location:** `evasion/humanize.js`

---

## Configuration

### Fingerprint Configuration (fingerprint.js)

```javascript
// Viewport sizes to choose from
const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  // ... add more as needed
];

// User agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  // ... keep updated with latest browser versions
];
```

### Humanization Configuration (humanize.js)

```javascript
// Typing configuration
const typingOptions = {
  minDelay: 30,        // Minimum ms between keystrokes
  maxDelay: 150,       // Maximum ms between keystrokes
  mistakeRate: 0.02,   // Probability of making a typo
  pauseChance: 0.05,   // Probability of pausing mid-type
};

// Mouse movement configuration
const mouseOptions = {
  steps: 20,           // Points in movement path
  minDelay: 5,         // Minimum ms between points
  maxDelay: 15,        // Maximum ms between points
  overshoot: true,     // Enable overshooting
};
```

---

## Detection Testing

### Online Testing Tools

1. **bot.sannysoft.com**
   - Comprehensive automation detection
   - Tests for webdriver, plugins, languages, etc.

2. **browserleaks.com**
   - Canvas fingerprint testing
   - WebGL fingerprint testing
   - Audio fingerprint testing

3. **abrahamjuliot.github.io/creepjs/**
   - Advanced fingerprinting detection
   - Tests many evasion techniques

4. **fingerprintjs.com/demo**
   - Commercial fingerprinting demo
   - High-quality detection

### Self-Testing Script

Run this in the browser console to check evasion:

```javascript
(function() {
  const tests = {
    'navigator.webdriver': navigator.webdriver,
    'navigator.plugins.length': navigator.plugins.length,
    'navigator.languages': JSON.stringify(navigator.languages),
    'navigator.platform': navigator.platform,
    'window.chrome': !!window.chrome,
    'Notification.permission': Notification.permission,
  };

  console.table(tests);

  // Canvas test
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillText('test', 10, 10);
  console.log('Canvas fingerprint:', canvas.toDataURL().slice(0, 50) + '...');
})();
```

---

## Limitations

### Known Limitations

1. **Some detection cannot be fully evaded**
   - Advanced behavioral analysis
   - IP reputation
   - TLS fingerprinting
   - JavaScript engine quirks

2. **Session consistency**
   - Fingerprint changes between sessions
   - May trigger re-verification

3. **Complex CAPTCHAs**
   - reCAPTCHA v3 scoring
   - hCaptcha challenges
   - Requires manual intervention or solving services

4. **Electron Detection**
   - Some sites specifically detect Electron
   - User agent may not fully mask this

### What May Still Be Detected

| Method | Detection Possibility | Mitigation |
|--------|----------------------|------------|
| TLS Fingerprint | High | Use proxy with TLS modification |
| IP Reputation | Medium | Use residential proxies |
| Behavioral ML | Medium | Increase randomization |
| Electron-specific | Low-Medium | Custom user agent |
| JavaScript timing | Low | Already mitigated |

---

## Best Practices

### 1. Session Consistency

Keep fingerprint consistent within a session:

```javascript
// Generate config once at startup
const config = getFingerprintConfig();
// Use same config for all pages
```

### 2. Add Random Delays

```python
import random
import asyncio

async def action_with_delay(action):
    await action()
    await asyncio.sleep(random.uniform(1, 3))
```

### 3. Simulate Real Browsing

Add "noise" actions between important operations:

```python
async def realistic_browse():
    await navigate(url)
    await random_scroll()
    await random_mouse_move()
    await asyncio.sleep(random.uniform(2, 5))
    await click(selector)
```

### 4. Rotate User Agents

Change user agent between sessions:

```javascript
const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
mainWindow.webContents.setUserAgent(userAgent);
```

### 5. Use Proxies

For sensitive operations, use rotating residential proxies to avoid IP-based detection.

### 6. Monitor Detection

Regularly test against detection services to ensure evasion remains effective as detection evolves.

### 7. Keep Dependencies Updated

Update user agents and detection countermeasures as browsers and detection methods evolve.
