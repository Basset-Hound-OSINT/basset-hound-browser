# Evasion Roadmap to 95%+: Phased Implementation Plan

**Date:** May 11, 2026  
**Project:** Basset Hound Browser v11.4.0+  
**Current Evasion:** 85.5%  
**Target:** 95%+  
**Timeline:** 2.5-3.2 weeks (94-127 hours)

---

## EXECUTIVE SUMMARY

Achieving 95%+ evasion requires addressing 4 critical layers:

1. **TLS/Network Layer** (Foundation) - Validate + optimize JA4, HTTP/2, TCP
2. **Browser Fingerprinting** (High-Value) - AudioContext, fonts, storage quota
3. **Behavioral/Coherence** (Protection) - Session consistency, cross-layer validation
4. **New Detection Services** (Testing) - Kasada, Arkose, emerging systems

### Success Criteria by Phase
```
Phase 1 (Critical): 85.5% → 92-95%  (+6-9.5%)
  ↳ Validation of TLS/HTTP/2 + minor improvements
  ↳ Risk mitigation (fix unprotected vectors)
  
Phase 2 (Advanced): 92-95% → 95-98%  (+0-6%)
  ↳ AudioContext, fonts, geographic coherence improvements
  ↳ Diminishing returns begin
  
Phase 3 (Testing): 95%+ (per detection service)
  ↳ Kasada: 85-90% (PoW native advantage)
  ↳ Arkose: 70-80% (without vision solver), 80-85% (with solver)
  ↳ New services: Baseline establishment
```

---

## PHASE 1: CRITICAL PATH (18-26 hours, +6-9.5%)

### 1.1 Post-Quantum TLS Validation (4-6 hours)

**Objective:** Verify Basset Hound includes X25519MLKEM768 key share

**Why Critical:**
- 57.4% of connections now include PQ key share
- Missing it = 100% bot detection before HTTP
- 0ms latency (TLS layer)
- Binary check (either present or not)

**Tasks:**

```bash
# Task 1: Determine Electron version
cat /home/devel/basset-hound-browser/package.json | grep electron
```

**Expected:** Electron 26+ likely includes post-quantum support

```bash
# Task 2: Capture ClientHello from Basset Hound
# Start Basset Hound with tcpdump capture
tcpdump -i lo -w basset-hound-tls.pcap 'tcp port 8765'

# Make a request through Basset Hound
# Stop capture (Ctrl+C)

# Task 3: Analyze ClientHello
# Open in Wireshark, expand TLS → ClientHello → supported_groups
# Look for: x25519mlkem768 (NEW)
# Should also see: x25519 (traditional ECDHE)
```

**Success Criteria:**
- ✅ X25519MLKEM768 present in ClientHello
- ✅ Position in key_share consistent with Chrome
- ✅ Matches claimed Chrome version in User-Agent

**Expected Outcome:** Likely already protected (+0-1%)

**If PQ key share missing:** Requires Electron upgrade (2-4 hour project)

---

### 1.2 JA4+ TLS Fingerprinting Analysis (8-12 hours)

**Objective:** Validate Basset Hound TLS signature matches Chrome profiles

**Why Critical:**
- JA4+ achieves 98.6% classification accuracy
- Mismatch with User-Agent = immediate bot flag
- No JavaScript involved; pure TLS layer
- High stakes: affects all requests

**Tasks:**

**Task 1: Capture JA4 Signature**
```bash
# Install JA4 analysis tool
# Option A: ja4-fingerprint npm module
npm install ja4-fingerprint

# Option B: Extract manually from pcap
tshark -r basset-hound-tls.pcap -Y tls.handshake.type==1 \
  -T fields -e tls.handshake.client_hello.supported_groups \
  -e tls.handshake.client_hello.ciphers

# Task 2: Generate JA4 signature
# Capture:
#  - TLS version (1.3)
#  - Cipher suite list + order
#  - Extension list + order
#  - Elliptic curves
#  - Signature algorithms

# Expected Electron JA4 format:
# t13d1516h2_[cipher_hash]_[ext_hash]
```

**Task 2: Compare to Known Chrome Profiles**
```javascript
// Expected Chrome 131 JA4 (from detection literature)
const expectedChrome131 = {
  tlsVersion: 'TLS 1.3',
  cipherCount: 15,
  extensionCount: 16,
  cipherHash: '8daaf6152771',
  extensionHash: 'e5627efa2ab1'
};

// Captured from Basset Hound
const bassetHoundJA4 = {
  tlsVersion: 'TLS 1.3',
  cipherCount: 15,
  extensionCount: 16,
  cipherHash: '8daaf6152771',  // Should match
  extensionHash: 'e5627efa2ab1'  // Should match
};

// Validation
function validateJA4Match() {
  if (bassetHoundJA4.cipherHash === expectedChrome131.cipherHash &&
      bassetHoundJA4.extensionHash === expectedChrome131.extensionHash) {
    console.log('✅ JA4 matches Chrome profile');
    return true;
  } else {
    console.log('❌ JA4 mismatch - bot detection likely');
    return false;
  }
}
```

**Task 3: Audit User-Agent Consistency**
```javascript
// Verify no mismatch between:
// 1. User-Agent header (e.g., "Chrome 131")
// 2. TLS ClientHello capabilities
// 3. HTTP/2 SETTINGS

// If User-Agent claims Chrome 131 but TLS shows different version/ciphers
// → BotFlag
```

**Success Criteria:**
- ✅ JA4 signature matches Chrome profile
- ✅ No TLS/User-Agent mismatch
- ✅ JA4S (server response) correlates correctly

**Expected Outcome:** Likely protected if Electron matches Chrome version (+1-2%)

**If JA4 mismatch found:**
- Update User-Agent to match Electron's Chromium version
- Document Electron→Chrome version mapping
- Consider User-Agent rotation per profile

---

### 1.3 HTTP/2 SETTINGS Validation (6-8 hours)

**Objective:** Validate HTTP/2 SETTINGS match Chrome profiles

**Why Critical:**
- 80-90% detection accuracy
- Covert (happens at TCP level, before HTTP data)
- Cross-validates with TLS fingerprinting
- Mismatch = bot signal

**Tasks:**

**Task 1: Capture HTTP/2 SETTINGS**
```bash
# Wireshark filter for HTTP/2 SETTINGS
# Analyze captured pcap file
tshark -r basset-hound-tls.pcap -Y 'http2.settings' \
  -T fields -e http2.settings.identifier -e http2.settings.value
```

**Task 2: Extract SETTINGS Values**
```javascript
// Expected Chrome 131 SETTINGS (from literature)
const expectedChrome131Settings = {
  HEADER_TABLE_SIZE: 4096,
  ENABLE_PUSH: 0,
  MAX_CONCURRENT_STREAMS: 1000,
  INITIAL_WINDOW_SIZE: 65535,
  MAX_FRAME_SIZE: 16384,
  MAX_HEADER_LIST_SIZE: 8192,
  ENABLE_CONNECT_PROTOCOL: 1
};

// Captured from Basset Hound
const bassetHoundSettings = {
  HEADER_TABLE_SIZE: 4096,
  ENABLE_PUSH: 0,
  MAX_CONCURRENT_STREAMS: 100,  // Might differ
  INITIAL_WINDOW_SIZE: 65535,
  MAX_FRAME_SIZE: 16384,
  MAX_HEADER_LIST_SIZE: 8192,
  ENABLE_CONNECT_PROTOCOL: 1
};

// Analysis: MAX_CONCURRENT_STREAMS differs (100 vs 1000)
// This could be a detection signal
```

**Task 3: Profile Electron's HTTP/2 Implementation**
```bash
# Check websocket/server.js for HTTP/2 configuration
grep -n "http2\|H2\|h2" /home/devel/basset-hound-browser/websocket/server.js

# Check if HTTP/2 SETTINGS are customizable
grep -A10 "createSecureServer\|createServer" /home/devel/basset-hound-browser/websocket/server.js
```

**Task 4: Compare and Decide**
- If SETTINGS match Chrome: ✅ No action needed
- If SETTINGS differ slightly: ⚠️ Profile-based spoofing (optional)
- If SETTINGS significantly differ: ❌ Implement spoofing

**Success Criteria:**
- ✅ HTTP/2 SETTINGS align with claimed Chrome version
- ✅ No TLS/HTTP/2 mismatch
- ✅ SETTINGS remain constant across session

**Expected Outcome:** 
- If OK: No improvement needed (already protected)
- If spoofed: +2-3% improvement

---

### 1.4 Cross-Layer Coherence Audit (4-6 hours)

**Objective:** Validate all 7 detection layers are coherent

**Why Critical:**
- Modern systems (PerimeterX) require ALL layers coherent
- Breaking any layer = 10-20% evasion reduction
- Foundation for advanced techniques

**Audit Checklist:**

```
Layer 1: TLS
  ✓ JA4 signature matches User-Agent claims
  ✓ X25519MLKEM768 present (or absent for older browsers)
  ✓ TLS version 1.3 (modern)
  
Layer 2: HTTP/2
  ✓ SETTINGS match claimed browser
  ✓ Stream prioritization natural (real browser)
  ✓ Header order consistent
  
Layer 3: TCP/IP
  ✓ TTL matches OS (128=Windows, 64=macOS/Linux)
  ✓ Window size realistic
  ✓ MSS aligns with network (not containerized)
  
Layer 4: Browser APIs
  ✓ window.chrome present (Chrome indicator)
  ✓ navigator.vendor = "Google Inc." (Chrome)
  ✓ WebGL/Canvas work authentically
  
Layer 5: Behavioral
  ✓ Mouse/click/scroll patterns natural
  ✓ Timing variance realistic
  ✓ No bot-like consistency
  
Layer 6: Session
  ✓ Cookies grow (never shrink)
  ✓ Session IDs persistent
  ✓ Headers consistent across requests
  
Layer 7: Device
  ✓ Storage quota realistic
  ✓ Performance timing variable
  ✓ Device profile coherent
```

**Implementation:**
```javascript
// Create validation framework
class CohesionValidator {
  validateAllLayers() {
    const results = {
      tls: this.validateTLS(),
      http2: this.validateHTTP2(),
      tcp: this.validateTCP(),
      browser: this.validateBrowserAPIs(),
      behavioral: this.validateBehavioral(),
      session: this.validateSession(),
      device: this.validateDevice()
    };
    
    const coherenceScore = this.calculateCohesion(results);
    // Score < 50 = likely to be detected
    // Score 50-80 = moderate protection
    // Score 80+ = strong protection
    
    return { results, score: coherenceScore };
  }
}
```

**Expected Outcome:** Identify weak points (+0-1% immediate, enables Phase 2)

---

## PHASE 2: ADVANCED TECHNIQUES (32-43 hours, +5-8%)

### 2.1 AudioContext Evasion Improvement (10-15 hours, +5-8%)

**Target:** 75% → 85%+ evasion

**Approach:** Hardware-level audio simulation + frequency response profiling

**Implementation:**

```javascript
// File: src/evasion/audio-context-evasion-v2.js

class ImprovedAudioContextEvasion {
  constructor(deviceProfile = 'windows10-laptop') {
    this.profile = deviceProfile;
    this.audioStack = this._initializeAudioStack();
  }
  
  _initializeAudioStack() {
    const profiles = {
      'windows10-laptop': {
        sampleRate: 48000,
        maxChannels: 32,
        harmonicDistortion: 0.002,
        frequencyResponse: this._buildFrequencyResponse(),
        latency: 20, // 20ms
        devices: ['Realtek ALC1200', 'Intel HD Audio']
      },
      'macos-m3': {
        sampleRate: 44100,
        maxChannels: 64,
        harmonicDistortion: 0.0015,
        frequencyResponse: this._buildAppleResponse(),
        latency: 10,
        devices: ['Apple M3 Audio Engine']
      }
    };
    return profiles[this.profile] || profiles['windows10-laptop'];
  }
  
  _buildFrequencyResponse() {
    // Realistic audio hardware frequency response curve
    return {
      20: -6,      // Bass rolloff
      100: -2,
      500: 0,      // Neutral
      2000: 2,     // Presence peak
      5000: 3,     // Presence peak
      10000: 1,
      20000: -8    // Treble rolloff
    };
  }
  
  inject() {
    this._interceptOscillator();
    this._interceptAnalyser();
    this._interceptDynamicsCompressor();
    this._interceptAudioBuffer();
  }
  
  _interceptOscillator() {
    const originalCreateOscillator = AudioContext.prototype.createOscillator;
    const self = this;
    
    AudioContext.prototype.createOscillator = function() {
      const osc = originalCreateOscillator.call(this);
      
      // Inject subtle hardware imperfections
      const originalStart = osc.start;
      osc.start = function(time) {
        // Add realistic frequency wobble (±2Hz)
        const wobble = (Math.random() - 0.5) * 4;
        osc.frequency.setValueAtTime(
          osc.frequency.value + wobble,
          time
        );
        
        // Add phase noise (±0.1 radians)
        if (osc.phase !== undefined) {
          osc.phase += (Math.random() - 0.5) * 0.2;
        }
        
        return originalStart.call(this, time);
      };
      
      return osc;
    };
  }
  
  _interceptAnalyser() {
    const originalGetByteFrequencyData = 
      AnalyserNode.prototype.getByteFrequencyData;
    const self = this;
    
    AnalyserNode.prototype.getByteFrequencyData = function(array) {
      originalGetByteFrequencyData.call(this, array);
      
      // Apply hardware-specific frequency response
      array.forEach((value, index) => {
        const freq = (index / array.length) * 
          (self.audioStack.sampleRate / 2);
        
        // Get frequency response modifier
        const modifier = self._getFrequencyResponseModifier(freq);
        
        // Add noise + hardware response
        const noise = (Math.random() - 0.5) * 5;
        array[index] = Math.max(0, 
          Math.min(255, value * modifier + noise)
        );
      });
      
      return array;
    };
  }
  
  _getFrequencyResponseModifier(freq) {
    const response = this.audioStack.frequencyResponse;
    
    // Linear interpolation between known points
    const keys = Object.keys(response)
      .map(Number)
      .sort((a, b) => a - b);
    
    let lower = keys[0];
    let upper = keys[keys.length - 1];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (freq >= keys[i] && freq <= keys[i + 1]) {
        lower = keys[i];
        upper = keys[i + 1];
        break;
      }
    }
    
    if (lower === upper) {
      return (1 + response[lower] / 100);
    }
    
    const ratio = (freq - lower) / (upper - lower);
    const lowerDb = response[lower];
    const upperDb = response[upper];
    const interpolatedDb = lowerDb + (upperDb - lowerDb) * ratio;
    
    return Math.pow(10, interpolatedDb / 20); // dB to linear
  }
  
  _interceptDynamicsCompressor() {
    // Add realistic dynamics compression response
    const DynamicsCompressor = window.DynamicsCompressorNode;
    if (!DynamicsCompressor) return;
    
    const originalGetReduction = 
      DynamicsCompressor.prototype.reduction;
    
    Object.defineProperty(DynamicsCompressor.prototype, 'reduction', {
      get: function() {
        // Return realistic values that show compression
        const reduction = originalGetReduction.call(this);
        return reduction + (Math.random() - 0.5) * 0.1;
      }
    });
  }
  
  _interceptAudioBuffer() {
    // Simulate realistic audio buffer processing
    const originalCreateBuffer = AudioContext.prototype.createBuffer;
    
    AudioContext.prototype.createBuffer = function(
      numOfChannels, length, sampleRate
    ) {
      const buffer = originalCreateBuffer.call(
        this, numOfChannels, length, sampleRate
      );
      
      // Add subtle noise to buffer data
      for (let ch = 0; ch < numOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] += (Math.random() - 0.5) * 0.0001;
        }
      }
      
      return buffer;
    };
  }
}

// Usage
const audioEvasion = new ImprovedAudioContextEvasion('windows10-laptop');
audioEvasion.inject();
```

**Expected Improvement:** +5-8 points (75% → 80-83%)

**Testing:**
```bash
# Test against bot.sannysoft, CreepJS
node tests/evasion/audio-context-validation.js
```

**Completion Criteria:**
- ✅ Audio fingerprinting tests pass (80%+)
- ✅ Frequency response matches profile
- ✅ No detection system flags AudioContext

---

### 2.2 Font Enumeration Enhancement (12-16 hours, +4-6%)

**Target:** 78% → 84%+ evasion

**Approach:** Correlated font sets per OS + realistic missing fonts

**Implementation:**

```javascript
// File: src/evasion/font-enumeration-v2.js

class EnhancedFontEnumerationEvasion {
  constructor(osProfile = 'windows11') {
    this.osProfile = osProfile;
    this.fontDatabase = this._buildComprehensiveFontDatabase();
    this.fontMetrics = this._generateFontMetrics();
  }
  
  _buildComprehensiveFontDatabase() {
    return {
      'windows11': {
        system: [
          'Segoe UI Variable',
          'Segoe UI',
          'Tahoma',
          'Verdana',
          'Consolas'
        ],
        office: [
          'Aptos',      // NEW in Windows 11
          'Cambria',
          'Calibri',
          'Courier New'
        ],
        adobe: [],       // Windows 11 doesn't typically have Adobe
        browsers: [
          'Arial',
          'Georgia',
          'Comic Sans MS',
          'Impact'
        ],
        cjk: [
          'Yu Gothic',  // Japanese
          'SimSun',     // Chinese
          'Malgun Gothic' // Korean
        ],
        missing: [
          'San Francisco',      // macOS only
          'Helvetica Neue',     // macOS only
          'Ubuntu',             // Linux only
          'DejaVu Sans'         // Linux only
        ]
      },
      'macos12': {
        system: [
          'San Francisco',
          'Helvetica Neue',
          'Menlo',
          'Monaco'
        ],
        apple: [
          'Garamond',
          'Palatino',
          'Optima',
          'Georgia',
          'Times New Roman'
        ],
        office: [
          'Calibri',
          'Cambria',
          'Consolas'
        ],
        cjk: [
          'Hiragino Sans',  // Japanese
          'STHeiti',        // Chinese
          'Apple Gothic'    // Korean
        ],
        missing: [
          'Segoe UI',
          'Tahoma',
          'Ubuntu'
        ]
      },
      'ubuntu20': {
        system: [
          'Ubuntu',
          'DejaVu Sans',
          'Liberation Sans',
          'Noto Sans'
        ],
        monospace: [
          'DejaVu Sans Mono',
          'Liberation Mono',
          'Ubuntu Mono'
        ],
        cjk: [
          'Noto Sans CJK JP',
          'Noto Sans CJK SC',
          'Noto Sans CJK KR'
        ],
        missing: [
          'San Francisco',
          'Segoe UI',
          'Helvetica Neue',
          'Calibri'
        ]
      }
    };
  }
  
  _generateFontMetrics() {
    // Create realistic font width measurements
    const testString = 'mmmmmmmmmmlli';
    const metrics = {};
    
    // Simulate various font widths
    // (normally measured via DOM in real evasion)
    const baseWidths = {
      'Arial': 69.4,
      'Courier New': 102.3,
      'Georgia': 71.2,
      'Times New Roman': 73.5,
      'Comic Sans MS': 85.1,
      'Verdana': 62.3,
      'Ubuntu': 74.2
    };
    
    // Add variance to simulate real measurements
    for (const [font, width] of Object.entries(baseWidths)) {
      metrics[font] = width + (Math.random() - 0.5) * 0.2;
    }
    
    return metrics;
  }
  
  inject() {
    this._interceptFontCheck();
    this._interceptFontEnumeration();
    this._interceptCanvasFontMetrics();
  }
  
  _interceptFontCheck() {
    // Override font availability check
    const self = this;
    
    // document.fonts.check() implementation
    if (document.fonts && typeof document.fonts.check === 'function') {
      const originalCheck = document.fonts.check.bind(document.fonts);
      
      document.fonts.check = function(fontString, text) {
        const fontName = self._parseFontName(fontString);
        
        // Check if font is in our profile
        return self._fontExistsInProfile(fontName);
      };
    }
  }
  
  _interceptFontEnumeration() {
    // Make document.fonts enumerable
    const self = this;
    
    if (document.fonts) {
      // Create custom iterator
      const fonts = this._getAllFontsForProfile();
      
      const handler = {
        get: (target, prop) => {
          if (prop === Symbol.iterator) {
            return function* () {
              for (const font of fonts) {
                yield font;
              }
            };
          }
          
          if (prop === 'length') {
            return fonts.length;
          }
          
          if (typeof prop === 'number') {
            return fonts[prop];
          }
          
          return target[prop];
        }
      };
      
      // Replace document.fonts if possible
      try {
        const proxy = new Proxy(document.fonts, handler);
        Object.defineProperty(document, 'fonts', {
          value: proxy,
          writable: false
        });
      } catch (e) {
        // Fallback: inject fonts into existing object
        for (const font of fonts) {
          document.fonts[font] = true;
        }
      }
    }
  }
  
  _interceptCanvasFontMetrics() {
    // Override canvas font measurement to match profile
    const self = this;
    const originalMeasureText = 
      CanvasRenderingContext2D.prototype.measureText;
    
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      const result = originalMeasureText.call(this, text);
      
      // Get current font
      const font = this.font;
      const fontName = self._parseFontName(font);
      
      // Inject profile-specific metrics
      if (self.fontMetrics[fontName]) {
        const ratio = self.fontMetrics[fontName] / 70; // Normalize
        const originalWidth = result.width;
        
        return {
          ...result,
          width: originalWidth * ratio,
          actualBoundingBoxLeft: result.actualBoundingBoxLeft * ratio,
          actualBoundingBoxRight: result.actualBoundingBoxRight * ratio
        };
      }
      
      return result;
    };
  }
  
  _fontExistsInProfile(fontName) {
    const database = this.fontDatabase[this.osProfile];
    
    for (const category in database) {
      if (database[category].includes(fontName)) {
        return true;
      }
    }
    
    return false;
  }
  
  _getAllFontsForProfile() {
    const database = this.fontDatabase[this.osProfile];
    const fonts = [];
    
    for (const category in database) {
      if (category !== 'missing') {
        fonts.push(...database[category]);
      }
    }
    
    return fonts;
  }
  
  _parseFontName(fontString) {
    // Extract font family from CSS font property
    // "bold 12px Arial" → "Arial"
    const match = fontString.match(/(\w+(?:\s+\w+)*)\s*$/);
    return match ? match[1] : fontString;
  }
}

// Usage
const fontEvasion = new EnhancedFontEnumerationEvasion('windows11');
fontEvasion.inject();
```

**Expected Improvement:** +4-6 points (78% → 82-84%)

**Testing:**
```bash
# Test font enumeration against bot.sannysoft
node tests/evasion/font-enumeration-validation.js
```

---

### 2.3 Geographic & Timezone Coherence (10-12 hours, +3-5%)

**Target:** Baseline → 80%+ evasion (new module)

**Implementation:**

```javascript
// File: src/evasion/geographic-coherence.js

class GeographicCoherenceEvasion {
  constructor(geoProfile = { country: 'US', timezone: 'America/New_York' }) {
    this.profile = geoProfile;
    this.coherenceMap = this._buildCoherenceMap();
    this.timezoneOffsets = this._buildTimezoneOffsets();
  }
  
  _buildCoherenceMap() {
    return {
      'US': {
        validTimezones: [
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Los_Angeles',
          'America/Anchorage',
          'Pacific/Honolulu'
        ],
        languages: ['en-US', 'es-US', 'fr-US'],
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'h:mm A',
        currencyCode: 'USD',
        numberFormat: { decimal: '.', thousands: ',' }
      },
      'GB': {
        validTimezones: ['Europe/London'],
        languages: ['en-GB'],
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        currencyCode: 'GBP',
        numberFormat: { decimal: '.', thousands: ',' }
      },
      'DE': {
        validTimezones: ['Europe/Berlin'],
        languages: ['de-DE', 'en-DE'],
        dateFormat: 'DD.MM.YYYY',
        timeFormat: 'HH:mm',
        currencyCode: 'EUR',
        numberFormat: { decimal: ',', thousands: '.' }
      },
      'JP': {
        validTimezones: ['Asia/Tokyo'],
        languages: ['ja-JP', 'en-JP'],
        dateFormat: 'YYYY/MM/DD',
        timeFormat: 'HH:mm',
        currencyCode: 'JPY',
        numberFormat: { decimal: '.', thousands: ',' }
      },
      'CN': {
        validTimezones: ['Asia/Shanghai'],
        languages: ['zh-CN', 'en-CN'],
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        currencyCode: 'CNY',
        numberFormat: { decimal: '.', thousands: ',' }
      }
    };
  }
  
  _buildTimezoneOffsets() {
    return {
      'America/New_York': -300,      // UTC-5 (EST)
      'America/Chicago': -360,        // UTC-6
      'America/Denver': -420,         // UTC-7
      'America/Los_Angeles': -480,    // UTC-8
      'Europe/London': 0,             // UTC+0
      'Europe/Berlin': 60,            // UTC+1
      'Asia/Tokyo': 540,              // UTC+9
      'Asia/Shanghai': 480            // UTC+8
      // ... more timezones
    };
  }
  
  inject() {
    this._interceptIntlAPI();
    this._interceptTimeZoneAPI();
    this._interceptDateFormatting();
    this._validateCoherence();
  }
  
  _interceptIntlAPI() {
    const self = this;
    
    // Override Intl.DateTimeFormat
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    
    Intl.DateTimeFormat = class DateTimeFormat extends OriginalDateTimeFormat {
      constructor(locales, options) {
        const coherentLocale = self._getCoherentLocale();
        super(coherentLocale, options);
      }
      
      format(date) {
        const result = super.format(date);
        // Validate format matches profile
        return result;
      }
    };
    
    // Copy static methods
    Object.setPrototypeOf(
      Intl.DateTimeFormat,
      OriginalDateTimeFormat
    );
  }
  
  _interceptTimeZoneAPI() {
    const self = this;
    
    // Override Date.prototype methods for timezone
    const originalToLocaleString = Date.prototype.toLocaleString;
    
    Date.prototype.toLocaleString = function(locales, options) {
      // Use coherent timezone
      const coherentOptions = {
        ...options,
        timeZone: self.profile.timezone
      };
      
      return originalToLocaleString.call(
        this,
        self._getCoherentLocale(),
        coherentOptions
      );
    };
    
    // Similar for toLocaleTimeString, toLocaleDateString
    const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    Date.prototype.toLocaleTimeString = function(locales, options) {
      const coherentOptions = {
        ...options,
        timeZone: self.profile.timezone
      };
      
      return originalToLocaleTimeString.call(
        this,
        self._getCoherentLocale(),
        coherentOptions
      );
    };
  }
  
  _interceptDateFormatting() {
    // Ensure all date formatting is coherent
    const profile = this.coherenceMap[this.profile.country];
    if (!profile) return;
    
    // Hook into any custom date formatting libraries
    // (moment.js, date-fns, etc.)
  }
  
  _validateCoherence() {
    const profile = this.coherenceMap[this.profile.country];
    if (!profile) {
      console.warn(`Country ${this.profile.country} not in coherence map`);
      return;
    }
    
    // Validate timezone is valid for country
    if (!profile.validTimezones.includes(this.profile.timezone)) {
      console.warn(
        `Timezone ${this.profile.timezone} not valid for ${this.profile.country}`
      );
    }
  }
  
  _getCoherentLocale() {
    const profile = this.coherenceMap[this.profile.country];
    return profile ? profile.languages[0] : 'en-US';
  }
}

// Usage
const geoEvasion = new GeographicCoherenceEvasion({
  country: 'US',
  timezone: 'America/New_York'
});
geoEvasion.inject();
```

**Expected Improvement:** +3-5 points (new baseline → 70-80%)

---

## PHASE 3: DETECTION SERVICE TESTING (44-58 hours)

### 3.1 Kasada PoW Testing (16-20 hours)

**Objective:** Benchmark Basset Hound against Kasada detection

**Why Important:**
- Emerging major player in bot detection
- Uses PoW instead of CAPTCHAs
- Real browser has natural advantage
- Basset Hound likely 85-90% effective

**Approach:**

```bash
# Task 1: Identify Kasada-protected sites
# Search for sites using Kasada
curl -s "https://example-kasada-protected-site.com" | grep -i kasada

# Task 2: Set up test harness
# Create test script to measure evasion rate

# Task 3: Run 100+ test iterations
# Measure:
#  - PoW challenge success rate
#  - Average solve time
#  - CPU utilization
#  - Success percentage

# Task 4: Document findings
# Expected: 85-90% evasion (real browser advantage)
```

**Expected Outcome:** 85-90% evasion (PoW advantage natural to real browser)

---

### 3.2 Arkose Labs 3D Challenge (20-24 hours)

**Objective:** Evaluate Basset Hound against Arkose 3D challenges

**Options:**

**Option A: Manual Testing (8-12 hours)**
- Navigate to Arkose-protected sites
- Manually solve 50+ challenges
- Document success rate
- Expected: 70-80% (human-passable challenges)

**Option B: Vision-Based Solver (16-20 hours, optional)**
- Implement image recognition for challenge elements
- Integrate with Tesseract.js or vision API
- Automate challenge solving
- Expected: 75-85% (with solver)

**Implementation (Vision Solver):**

```javascript
// File: src/evasion/arkose-challenge-solver.js

class ArkoseChallengeEvasion {
  constructor() {
    this.visionAPI = null;
    this.initializeTesseract();
  }
  
  async initializeTesseract() {
    const Tesseract = require('tesseract.js');
    this.visionAPI = Tesseract.createWorker();
    await this.visionAPI.load();
    await this.visionAPI.loadLanguage('eng');
    await this.visionAPI.initialize('eng');
  }
  
  async solveVisualChallenge(canvasElement, challengeType) {
    // Capture canvas as image
    const imageData = this._captureCanvasAsImage(canvasElement);
    
    if (challengeType === 'matchkey') {
      return await this._solveMatchKey(imageData);
    } else if (challengeType === '3drotation') {
      return await this._solve3DRotation(imageData);
    }
  }
  
  async _solveMatchKey(imageData) {
    // Analyze image to find matching elements
    const { data } = await this.visionAPI.recognize(imageData);
    
    // Extract element positions
    const elements = this._extractElements(data);
    
    // Find matches
    const matches = this._findMatchingPairs(elements);
    
    // Generate click sequence
    return this._generateClickSequence(matches);
  }
  
  _extractElements(visionData) {
    // Parse vision API results to extract challenge elements
    // Return array of element positions and characteristics
    return [];
  }
  
  _findMatchingPairs(elements) {
    // Use image similarity to find matching elements
    return [];
  }
  
  _generateClickSequence(matches) {
    // Create realistic click sequence with timing
    const sequence = [];
    
    for (const match of matches) {
      sequence.push({
        x: match.x,
        y: match.y,
        delay: 100 + Math.random() * 400, // Human-like timing
        type: 'click'
      });
      
      // Add think-time between clicks
      sequence.push({
        delay: 500 + Math.random() * 1000,
        type: 'wait'
      });
    }
    
    return sequence;
  }
  
  _captureCanvasAsImage(canvasElement) {
    return canvasElement.toDataURL('image/png');
  }
}

// Usage
const arkoseSolver = new ArkoseChallengeEvasion();
// ... integrate with WebSocket commands
```

**Expected Outcome:**
- Without solver: 70-80% (human-passable challenges)
- With solver: 75-85% (automated solving)

---

### 3.3 Emerging Detection Services Monitoring (8-10 hours)

**Objective:** Establish baseline against new detection systems

**Services to Monitor:**

1. **Sensible Machines**
   - Status: Emerging stealth detection
   - Approach: Behavioral ML + real-time anomaly detection
   - Risk: Unknown
   - Action: Monitor adoption; test if >5% market penetration

2. **New Cloudflare AI Models (2026+)**
   - Status: Advanced ML with cross-layer correlation
   - Approach: GNN-based analysis
   - Risk: Likely 5-10% improvement over v2.0
   - Action: Test against latest Cloudflare endpoints

3. **DataDome 2026 Ensemble**
   - Status: Continued evolution (85K+ customer models)
   - Approach: Improved ensemble + cross-customer signals
   - Risk: Unchanged baseline (50-70%)
   - Action: Focus on behavioral authenticity

4. **Perforce/Telerik Progress WAF**
   - Status: WAF-integrated bot detection
   - Approach: Signature + behavioral
   - Risk: Mid-market adoption
   - Action: Test if customers deploy this

**Testing Framework:**

```bash
# Automated testing against multiple services
for detection_service in cloudflare datadome perimeterx kasada arkose
do
  echo "Testing against $detection_service..."
  node tests/evasion/$detection_service-test.js
done
```

---

## PHASE COMPLETION CRITERIA

### Phase 1 Success (Critical Path)
- [ ] Post-Quantum TLS verified or upgraded
- [ ] JA4+ signature matches Chrome profile
- [ ] HTTP/2 SETTINGS validated or optimized
- [ ] Cross-layer coherence audit complete
- [ ] **Expected:** 85.5% → 92-95%

### Phase 2 Success (Advanced)
- [ ] AudioContext evasion improved to 85%+
- [ ] Font enumeration improved to 84%+
- [ ] Geographic coherence module implemented
- [ ] All 3 modules tested + validated
- [ ] **Expected:** 92-95% → 95-98%

### Phase 3 Success (Testing)
- [ ] Kasada testing completed (85-90% baseline)
- [ ] Arkose Labs evaluated (70-80% baseline)
- [ ] New detection services monitored
- [ ] Comprehensive detection service matrix updated
- [ ] **Expected:** Detection service-specific baselines

---

## TIMELINE SUMMARY

### Week 1: Critical Path (Phase 1)
- **Mon-Tue:** Post-Quantum TLS & JA4+ validation (8-10 hours)
- **Wed-Thu:** HTTP/2 SETTINGS & coherence audit (10-14 hours)
- **Fri:** Documentation & minor optimizations (2-4 hours)
- **Result:** 92-95% evasion

### Week 2: Advanced Techniques (Phase 2)
- **Mon-Tue:** AudioContext evasion improvement (10-15 hours)
- **Wed:** Font enumeration enhancement (12-16 hours)
- **Thu-Fri:** Geographic coherence module (10-12 hours)
- **Result:** 95-98% evasion

### Week 3: Testing & Refinement (Phase 3)
- **Mon-Tue:** Kasada evaluation (16-20 hours)
- **Wed-Thu:** Arkose Labs testing (20-24 hours, optional)
- **Fri:** Documentation & service matrix update
- **Result:** Service-specific baselines, recommendations

---

## RISK MITIGATION

### Risk 1: Timeline Overruns
**Mitigation:**
- Prioritize Phase 1 critical path
- Defer optional items (vision solver, advanced techniques)
- Use skeleton implementation if full implementation not ready

### Risk 2: Detection System Evolution
**Mitigation:**
- Focus on foundational improvements (TLS/HTTP/2 coherence)
- Avoid signature-based evasion (fragile)
- Prioritize browser authenticity (durable)

### Risk 3: Diminishing Returns
**Mitigation:**
- Track improvement by component
- Focus efforts on high-ROI items first
- Accept 95%+ as realistic ceiling

### Risk 4: Regression in Current Evasion
**Mitigation:**
- Maintain test suites for existing evasion
- Run full test suite before each commit
- Validate improvements with A/B testing

---

## SUCCESS METRICS

### Primary Metrics
- **Overall Evasion:** 85.5% → 95%+ (target)
- **Cloudflare:** 85% → 92%+ (known bottleneck)
- **DataDome:** 50% → 60%+ (difficult baseline)
- **PerimeterX:** 60% → 75%+ (session-dependent)

### Secondary Metrics
- **Extended Session Sustainability:** 100+ requests before detection
- **Detection Service Coverage:** 4+ major systems tested
- **Emerging Vector Protection:** Storage quota, performance API covered

### Testing Standards
- **Test Pass Rate:** 95%+ (existing test suite)
- **New Evasion Tests:** 50+ new tests per phase
- **Detection Service Tests:** 100+ iterations per service

---

## DELIVERABLES

### Phase 1 Deliverables
1. TLS validation report (2-3 pages)
2. HTTP/2 analysis + optimization guidelines (3-4 pages)
3. Coherence audit checklist + status
4. Implementation recommendations (2-3 pages)

### Phase 2 Deliverables
1. AudioContext v2.0 module (300+ lines)
2. Font enumeration v2.0 module (350+ lines)
3. Geographic coherence module (250+ lines)
4. Test suite for all 3 modules (200+ lines)
5. Performance analysis & improvements (2-3 pages)

### Phase 3 Deliverables
1. Kasada testing report (3-4 pages)
2. Arkose Labs evaluation (3-4 pages, if vision solver implemented)
3. Emerging services analysis (2-3 pages)
4. Updated detection service matrix (1-2 pages)
5. Final evasion roadmap recommendations (2-3 pages)

---

**Document Status:** Complete roadmap ready for implementation  
**Last Updated:** May 11, 2026  
**Next Step:** Begin Phase 1 (Critical Path) immediately
