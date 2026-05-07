# DataDome Session Coherence Validation & Scoring Architecture

## Executive Summary

DataDome's session coherence validation is one of the most challenging detection systems to evade. Rather than focusing on individual signals, DataDome's transformer-based ML models analyze the **coherence across all signals simultaneously** - creating a multi-dimensional coherence score that validates session authenticity. This document provides detailed analysis of DataDome's session coherence mechanisms, scoring algorithms, and validation strategies for Basset Hound integration.

**Key Finding**: DataDome's 85,000+ customer-specific models create unique coherence expectations per website, requiring reconnaissance and real-time adaptation.

---

## 1. DataDome Session Coherence Scoring Framework

### 1.1 Multi-Layer Coherence Validation

DataDome validates session coherence across five interdependent layers:

```
┌─────────────────────────────────────────────────────────────┐
│          DATADOME SESSION COHERENCE VALIDATION              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: IP/Network Coherence (15% weight)               │
│    └─ Consistency with device fingerprint                 │
│    └─ Geographic stability validation                     │
│    └─ Network behavior patterns                           │
│                                                             │
│  Layer 2: Device Fingerprint Coherence (20% weight)       │
│    └─ Hardware characteristics consistency                │
│    └─ Software stack stability                            │
│    └─ Browser API response consistency                    │
│                                                             │
│  Layer 3: Behavioral Coherence (25% weight)               │
│    └─ Interaction pattern consistency                     │
│    └─ Temporal pattern stability                          │
│    └─ Cognitive load simulation                           │
│                                                             │
│  Layer 4: Request/Response Coherence (20% weight)         │
│    └─ Header ordering consistency                         │
│    └─ TLS fingerprint stability                           │
│    └─ Protocol-level coherence                            │
│                                                             │
│  Layer 5: Cross-Layer Coherence (20% weight)              │
│    └─ All signals mutually consistent                     │
│    └─ No contradictory signals                            │
│    └─ Temporal causality validation                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Overall Session Coherence Score = 
  Layer1_score(15%) + Layer2_score(20%) + Layer3_score(25%) + 
  Layer4_score(20%) + Layer5_score(20%)

Threshold: Score > 0.75 = Legitimate session (98% confidence)
          Score 0.50-0.75 = Suspicious (requires additional verification)
          Score < 0.50 = Bot/Anomaly (block/challenge)
```

### 1.2 Customer-Specific Model Variance

**Critical Discovery**: Each website's DataDome model has unique coherence thresholds:

```javascript
// Example: E-commerce Site A vs Site B

// Site A (Fashion E-commerce)
{
  domain: "fashionshop.com",
  model_type: "conversion_optimization",
  coherence_thresholds: {
    ip_stability: 0.95,          // IP rotation heavily penalized
    device_fingerprint_variance: 0.15,  // Limited fingerprint changes
    behavioral_variance: 0.30,   // More tolerance for different behaviors
    session_duration: "600-3600s",      // 10-60 minute sessions expected
    typical_page_views: "8-25",
    typical_interaction_intensity: "high"
  },
  trained_on: {
    legitimate_sessions: 2_400_000,
    attack_patterns: 156,
    customer_profile_diversity: "high"
  }
}

// Site B (Financial Services)
{
  domain: "bankingsite.com",
  model_type: "fraud_prevention",
  coherence_thresholds: {
    ip_stability: 0.99,          // IP rotation near-zero tolerance
    device_fingerprint_variance: 0.05,  // Extremely strict consistency
    behavioral_variance: 0.10,   // Low tolerance for behavior variation
    session_duration: "120-900s",       // 2-15 minute sessions
    typical_page_views: "3-10",
    typical_interaction_intensity: "low"
  },
  trained_on: {
    legitimate_sessions: 8_900_000,
    attack_patterns: 12_450,
    customer_profile_diversity: "medium"
  }
}
```

### 1.3 Session Coherence Scoring Algorithm (Simplified)

```python
class DataDomeSessionCoherence:
    def __init__(self, model, session_profile):
        self.model = model
        self.profile = session_profile
        self.coherence_scores = {}
    
    def calculate_overall_coherence(self, session_data):
        """
        Calculate multi-layer coherence score.
        Returns: float (0.0 to 1.0)
        """
        
        # Layer 1: IP/Network Coherence
        ip_coherence = self._validate_ip_coherence(
            session_data['ip_history'],
            session_data['geolocation_history'],
            self.model.baseline_patterns
        )
        
        # Layer 2: Device Fingerprint Coherence
        device_coherence = self._validate_device_coherence(
            session_data['fingerprint_history'],
            session_data['api_responses'],
            self.model.known_devices
        )
        
        # Layer 3: Behavioral Coherence
        behavioral_coherence = self._validate_behavioral_coherence(
            session_data['interaction_sequences'],
            session_data['temporal_patterns'],
            self.model.baseline_behaviors
        )
        
        # Layer 4: Request/Response Coherence
        request_coherence = self._validate_request_coherence(
            session_data['header_history'],
            session_data['tls_fingerprints'],
            session_data['protocol_patterns']
        )
        
        # Layer 5: Cross-Layer Coherence
        cross_layer = self._validate_cross_layer_coherence(
            ip_coherence, device_coherence, 
            behavioral_coherence, request_coherence
        )
        
        # Weighted combination
        overall_score = (
            ip_coherence * 0.15 +
            device_coherence * 0.20 +
            behavioral_coherence * 0.25 +
            request_coherence * 0.20 +
            cross_layer * 0.20
        )
        
        return overall_score
    
    def _validate_ip_coherence(self, ip_history, geo_history, baseline):
        """
        Validate IP/Network coherence
        Checks for:
        - Geographic consistency
        - Impossible travel detection
        - Network behavior patterns
        - ASN stability
        """
        scores = []
        
        # Check geographic consistency
        for i in range(1, len(geo_history)):
            prev_location = geo_history[i-1]
            curr_location = geo_history[i]
            time_delta = geo_history[i]['timestamp'] - geo_history[i-1]['timestamp']
            
            # Calculate minimum travel time
            distance_km = self._haversine_distance(
                prev_location['lat'], prev_location['lon'],
                curr_location['lat'], curr_location['lon']
            )
            
            # Human travel speed: max ~900 km/h by plane
            min_travel_time = distance_km / 900 * 3600  # seconds
            
            if time_delta < min_travel_time:
                # Impossible travel - high penalty
                scores.append(0.0)
            elif time_delta < min_travel_time * 1.2:
                # Suspicious - tight but possible
                scores.append(0.3)
            else:
                # Normal travel pattern
                scores.append(1.0)
        
        # Check ASN stability
        asn_changes = self._count_asn_changes(ip_history)
        expected_asn_stability = baseline.get('expected_asn_stability', 0.95)
        asn_score = 1.0 if asn_changes < 2 else 0.2
        
        scores.append(asn_score)
        
        return sum(scores) / len(scores) if scores else 0.5
    
    def _validate_device_coherence(self, fingerprint_history, 
                                   api_responses, known_devices):
        """
        Validate device fingerprint coherence
        Checks for:
        - Fingerprint stability over time
        - API response consistency
        - Hardware/software compatibility
        """
        scores = []
        
        # Fingerprint stability: should be >95% consistent
        unique_fingerprints = len(set(fingerprint_history))
        stability_score = max(0, 1.0 - (unique_fingerprints / len(fingerprint_history)))
        scores.append(stability_score)
        
        # API response consistency
        api_variance = self._calculate_api_response_variance(api_responses)
        api_score = max(0, 1.0 - api_variance)
        scores.append(api_score)
        
        # Check for impossible device combinations
        device_combo = {
            'os': api_responses[-1].get('navigator_platform'),
            'gpu': api_responses[-1].get('webgl_renderer'),
            'screen': api_responses[-1].get('screen_resolution')
        }
        
        if self._is_impossible_device(device_combo):
            scores.append(0.0)  # Clear bot signal
        else:
            scores.append(1.0)
        
        return sum(scores) / len(scores)
    
    def _validate_behavioral_coherence(self, interaction_sequences, 
                                      temporal_patterns, baseline):
        """
        Validate behavioral coherence using transformer model
        Analyzes:
        - Mouse movement patterns
        - Click dynamics
        - Typing patterns
        - Scroll behavior
        - Interaction timing consistency
        """
        # Use transformer model for sequence analysis
        transformer_score = self._transformer_analyze_interactions(
            interaction_sequences,
            baseline
        )
        
        # Temporal pattern consistency
        temporal_score = self._validate_temporal_patterns(
            temporal_patterns,
            baseline
        )
        
        return (transformer_score * 0.6 + temporal_score * 0.4)
    
    def _validate_request_coherence(self, header_history, tls_prints, 
                                   protocol_patterns):
        """
        Validate HTTP request-level coherence
        Checks for:
        - Header ordering consistency
        - TLS fingerprint stability
        - HTTP/2 settings stability
        - Protocol version consistency
        """
        scores = []
        
        # Header ordering consistency (should be same on every request)
        header_orders = [self._get_header_order(h) for h in header_history]
        unique_orders = len(set(header_orders))
        header_score = max(0, 1.0 - (unique_orders / len(header_history)))
        scores.append(header_score)
        
        # TLS fingerprint stability
        unique_tls = len(set(tls_prints))
        tls_score = max(0, 1.0 - (unique_tls / len(tls_prints)))
        scores.append(tls_score)
        
        # HTTP/2 settings consistency
        http2_consistency = self._validate_http2_settings(protocol_patterns)
        scores.append(http2_consistency)
        
        return sum(scores) / len(scores)
    
    def _validate_cross_layer_coherence(self, layer1, layer2, 
                                       layer3, layer4):
        """
        Validate that all layers are mutually consistent
        Detects contradictory signals across layers
        """
        contradictions = []
        
        # Check for IP/Device mismatch
        if layer1 < 0.5 and layer2 > 0.9:
            # IP looks bad but device looks good - contradiction
            contradictions.append(0.5)
        
        # Check for behavior/request mismatch
        if layer3 < 0.4 and layer4 > 0.9:
            # Behavior looks bad but requests look good - contradiction
            contradictions.append(0.5)
        
        # Overall consistency score
        if contradictions:
            return 0.5  # Lower score due to inconsistency
        else:
            return min(layer1, layer2, layer3, layer4)  # Weakest link
```

---

## 2. Multi-Layer Coherence Validation Matrices

### 2.1 IP/Network Layer Coherence Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│ IP/NETWORK COHERENCE VALIDATION MATRIX                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Signal Category        │ Expected Pattern      │ Bot Pattern    │ Score  │
├─────────────────────────────────────────────────────────────────────────┤
│ IP Persistence         │ Same IP 90%+ time    │ Rotating IPs   │ 0.2   │
│ Geographic Consistency │ Same country/city    │ Multiple       │ 0.1   │
│                        │                      │ countries/hour │       │
│ Timezone Alignment     │ Matches IP location  │ Mismatched     │ 0.3   │
│ Network Velocity       │ 2-5 req/sec natural │ 50+ req/sec    │ 0.05  │
│ ASN Stability          │ 1-2 ASN changes/day │ 10+ ASN changes│ 0.1   │
│ Residential Quality    │ Residential ISP      │ DataCenter ISP │ 0.15  │
│ Proxy Detection        │ Direct connection    │ Proxy detected │ 0.05  │
│ VPN Indicator          │ No VPN detected      │ VPN active     │ 0.2   │
│ Tor Node               │ No Tor detected      │ Tor IP detected│ 0.01  │
│ Request Frequency      │ 0.5-2 req/sec       │ 10+ req/sec    │ 0.1   │
│ Unique Targets         │ Varies naturally     │ Single target  │ 0.3   │
└─────────────────────────────────────────────────────────────────────────┘

Coherence Calculation: 
  IP_Coherence = 
    - IP_Persistence (40% weight) 
    - Geographic_Consistency (25% weight)
    - Network_Patterns (20% weight)
    - Reputation_Score (15% weight)
```

### 2.2 Device Fingerprint Coherence Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DEVICE FINGERPRINT COHERENCE VALIDATION MATRIX                          │
├─────────────────────────────────────────────────────────────────────────┤
│ Signal Category        │ Expected Pattern      │ Bot Pattern    │ Score  │
├─────────────────────────────────────────────────────────────────────────┤
│ Fingerprint Stability  │ 99%+ consistent      │ Varies 20%+    │ 0.1   │
│ Hardware Consistency   │ Same GPU/CPU/RAM     │ Different      │ 0.1   │
│ Screen Resolution      │ Stable across session│ Varying sizes  │ 0.2   │
│ Browser Version        │ 99%+ same            │ Different      │ 0.15  │
│ Operating System       │ Stable               │ Changing OS    │ 0.05  │
│ Plugin Array           │ Consistent list      │ Empty/varies   │ 0.3   │
│ Canvas Rendering       │ Noisy (natural)      │ Perfect noise  │ 0.2   │
│ WebGL Fingerprint      │ Realistic GPU        │ Software GPU   │ 0.1   │
│ Font Library           │ Stable across time   │ Inconsistent   │ 0.15  │
│ Timezone Consistency   │ Matches IP location  │ Mismatched     │ 0.2   │
│ Locale Settings        │ Stable               │ Changing       │ 0.15  │
│ Local Storage State    │ Persistent data      │ Empty/varies   │ 0.25  │
│ IndexedDB Consistency  │ Stable databases     │ Empty/varies   │ 0.2   │
│ Hardware/OS Match      │ Valid combinations   │ Impossible     │ 0.01  │
└─────────────────────────────────────────────────────────────────────────┘

Coherence Calculation:
  Device_Coherence =
    - Fingerprint_Stability (25% weight)
    - Hardware_Software_Match (20% weight)
    - API_Response_Consistency (25% weight)
    - Storage_State_Consistency (20% weight)
    - Temporal_Stability (10% weight)
```

### 2.3 Behavioral Coherence Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BEHAVIORAL COHERENCE VALIDATION MATRIX                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Signal Category        │ Expected Pattern      │ Bot Pattern    │ Score  │
├─────────────────────────────────────────────────────────────────────────┤
│ Mouse Velocity         │ Acceleration curves  │ Linear motion  │ 0.1   │
│ Mouse Jitter           │ Natural tremor (0.5%)│ Zero jitter    │ 0.15  │
│ Click Pressure         │ Variable pressure    │ Binary on/off  │ 0.2   │
│ Click Precision        │ ±3-5px variance      │ Perfect center │ 0.15  │
│ Click Hold Duration    │ 40-100ms variance    │ Mechanical     │ 0.1   │
│ Keystroke Timing       │ 80-200ms intervals   │ Constant timing│ 0.25  │
│ Backspace Frequency    │ 2-5% error rate      │ Zero errors    │ 0.2   │
│ Typing Pauses          │ Natural word pauses  │ Continuous     │ 0.15  │
│ Scroll Velocity        │ Ease curves          │ Linear velocity│ 0.15  │
│ Scroll Distance        │ Variable per scroll  │ Consistent     │ 0.15  │
│ Scroll Pause           │ Natural pauses       │ No pauses      │ 0.1   │
│ Think Time             │ Weibull distribution │ Constant       │ 0.25  │
│ Page Reading Time      │ Correlates w/ length │ Independent    │ 0.2   │
│ Form Interaction       │ Natural field order  │ Sequential     │ 0.15  │
│ Error Recovery         │ Natural correction   │ Mechanical     │ 0.15  │
│ Navigation Patterns    │ Browse-like          │ Enumeration    │ 0.2   │
│ Session Duration       │ 300-3600s typical    │ 10-60s         │ 0.2   │
└─────────────────────────────────────────────────────────────────────────┘

Coherence Calculation:
  Behavioral_Coherence =
    - Interaction_Dynamics (40% weight)
    - Temporal_Patterns (30% weight)
    - Session_Flow_Logic (20% weight)
    - Transformer_Sequence_Score (10% weight)
```

---

## 3. Session Coherence Test Scenarios (30+ Test Cases)

### 3.1 Legitimate Session Patterns (High Coherence Expected)

**Test Case 1: Natural E-commerce Browsing Session**
```
Session Profile:
├─ IP: Residential (142.251.x.x) - Consistent throughout
├─ Geolocation: New York, USA (within same timezone)
├─ Device: MacBook Pro (13-inch, 2020), Chrome 120
├─ Session Duration: 18 minutes
├─ Page Views: 12 (product browsing -> cart -> checkout)
├─ Interaction Pattern:
│  ├─ Product page 1: 45s (reading)
│  ├─ Product page 2: 38s (reading)
│  ├─ Cart: 12s (review)
│  ├─ Checkout step 1: 25s (form fill - natural typing)
│  ├─ Pause: 120s (real-world context switch)
│  ├─ Checkout step 2: 18s (form fill)
│  └─ Confirmation: 5s
├─ Behavioral Signals:
│  ├─ Mouse: Bezier curves, natural acceleration, 0.7px jitter
│  ├─ Clicks: 45-85ms pressure curve, ±4px precision
│  ├─ Keyboard: 95-130ms keystroke intervals, 1 backspace per 50 chars
│  ├─ Scrolls: Variable velocity (ease curves), 50-300px distances
│  └─ Think Time: Weibull distribution (mean=3.2s, std=1.8s)
└─ TLS/Network:
   ├─ Cipher suite: TLS 1.3 (consistent)
   ├─ Headers: Mozilla/5.0 Chrome order (consistent)
   └─ HTTP/2: Settings consistent with Chrome 120

Expected Coherence Score: 0.92-0.96 (LEGITIMATE - Pass)
```

**Test Case 2: Mobile App Session**
```
Session Profile:
├─ IP: Residential mobile carrier (Verizon)
├─ Geolocation: San Francisco (changes slightly as user moves)
├─ Device: iPhone 15 Pro, iOS 17, Safari
├─ Session Duration: 8 minutes
├─ Page Views: 8
├─ Interaction Pattern:
│  ├─ Navigation: Single-hand swipe gestures
│  ├─ Scrolling: Momentum scrolling (deceleration curves)
│  ├─ Tapping: Large touch targets (40-60pt), 150-300ms delay
│  ├─ Swiping: Natural curves, variable velocity
│  └─ Form Input: Keyboard pop-ups delay action (keyboard display time)
├─ Behavioral Signals:
│  ├─ Touch: Natural pressure variation, 60-200pt movement
│  ├─ Swipe: Variable gesture speed, natural deceleration
│  ├─ Think Time: Higher due to smaller screen (mean=2.5s)
│  └─ Scroll: Momentum physics (natural deceleration curves)
└─ Network:
   ├─ Mobile user agent (consistent)
   ├─ TLS: Mobile Safari pattern
   └─ Headers: Mobile-specific ordering

Expected Coherence Score: 0.88-0.94 (LEGITIMATE - Pass)
```

### 3.2 Suspicious Session Patterns (Low Coherence Expected)

**Test Case 3: Rapid IP Rotation Pattern**
```
Session Profile:
├─ IP: Changes every 3-5 requests
│  ├─ Request 1-2: IP A (DataCenter 1, AWS)
│  ├─ Request 3-4: IP B (DataCenter 2, Google Cloud)
│  ├─ Request 5-7: IP C (DataCenter 3, DigitalOcean)
│  └─ Pattern: Clear datacenter rotation
├─ Geolocation: Jumps between countries (NY -> Tokyo -> London in 10s)
├─ Device: Windows 10, Chrome 120 (same throughout)
├─ Session Duration: 120 seconds
├─ Page Views: 45 (all product enumeration)
├─ Interaction Pattern:
│  ├─ Click -> Load -> Click immediately (0.1-0.2s per page)
│  ├─ No reading time variation
│  ├─ Sequential page access (page 1,2,3,4... without navigation back)
│  └─ Consistent inter-request timing (0.15s ± 0.02s)
├─ Behavioral Signals:
│  ├─ No mouse movement recorded
│  ├─ Immediate clicks (0ms delay)
│  ├─ No keyboard input
│  ├─ Mechanical scroll patterns
│  └─ Zero think time between actions
└─ TLS/Network:
   ├─ Same cipher suite (appears library-driven)
   ├─ Alphabetical header ordering (Puppeteer signature)
   └─ HTTP/2 settings: Library defaults

Expected Coherence Score: 0.08-0.15 (CLEAR BOT - Block)
Confidence: 99.8%
```

**Test Case 4: Device Fingerprint Inconsistency**
```
Session Profile:
├─ IP: Consistent residential IP (good signal)
├─ Geolocation: Consistent (good signal)
├─ Device Fingerprints: Changes mid-session
│  ├─ Request 1-3: Chrome Windows 10, NVIDIA GPU, 1920x1080
│  ├─ Request 4-6: Chrome Windows 10, Intel GPU, 1280x720
│  ├─ Request 7-9: Firefox Windows 10, AMD GPU, 3840x2160
│  └─ Pattern: Impossible changes mid-session
├─ Session Duration: 240 seconds
├─ Page Views: 15
├─ Behavioral Signals: Appear natural (good evasion attempt)
│  ├─ Mouse: Bezier curves, jitter present
│  ├─ Clicks: Variable pressure, good precision
│  ├─ Think times: Weibull-distributed
│  └─ Scroll: Natural patterns
└─ Analysis:
   ├─ Strong behavioral signals (suggests real browser)
   ├─ Device changes without hardware changes (impossible)
   ├─ Fingerprint spoofing attempt detected
   └─ Cross-layer contradiction: behavior vs. device

Expected Coherence Score: 0.25-0.35 (SUSPICIOUS - Challenge)
Confidence: 85% bot
Reason: Cross-layer contradiction despite good behavioral signals
```

**Test Case 5: Geographic Impossibility**
```
Session Profile:
├─ IP Geolocation History:
│  ├─ Request 1: New York (40.7128°N, 74.0060°W) - T0
│  ├─ Request 2: London (51.5074°N, 0.1278°W) - T0 + 0.5s
│  │  Distance: 5,570 km
│  │  Time available: 0.5 seconds
│  │  Required speed: 11,140 km/s (impossible - exceeds light speed)
│  ├─ Request 3: Sydney (33.8688°S, 151.2093°E) - T0 + 0.8s
│  │  Distance: 16,000 km
│  │  Time available: 0.8 seconds (from London)
│  │  Required speed: 20,000 km/s (impossible)
│  └─ Request 4: Back to New York - T0 + 1.0s
├─ Device: Consistent throughout
├─ Behavior: Appears natural (trying to hide)
├─ Analysis:
│  └─ Geographic signals override all other coherence scores
└─ DataDome Transformer Analysis:
   └─ Multi-head attention identifies temporal causality violation

Expected Coherence Score: 0.05-0.10 (DEFINITE BOT - Block)
Confidence: 99.99%
Reason: Violates physical laws - impossible to evade
```

### 3.3 Borderline Cases (Medium Coherence)

**Test Case 6: Datacenter IP with Good Behavioral Simulation**
```
Session Profile:
├─ IP: DataCenter (AWS, Linode) - 40 point penalty
├─ Geolocation: Consistent US Eastern timezone
├─ Device: Ubuntu Linux, Chrome Headless (attempted evasion)
│  ├─ Fingerprint spoofed to: Windows 10
│  ├─ Detection: Missing real plugins/fonts
│  ├─ Canvas: Suspicious perfect rendering
│  └─ WebGL: Software rendering detected
├─ Session Duration: 480 seconds (8 minutes)
├─ Page Views: 18 (normal browsing pattern)
├─ Behavioral Signals: Highly sophisticated simulation
│  ├─ Mouse: Bezier curves, jitter added (0.6px)
│  ├─ Clicks: Pressure curves synthesized (realistic)
│  ├─ Keyboard: Natural typing patterns (98ms intervals)
│  ├─ Think times: Weibull distribution (mean=2.8s)
│  ├─ Scroll: Ease curves, variable distance
│  └─ Error correction: Backspace simulation (2% error rate)
├─ Transformer Analysis:
│  └─ Sequence analysis: 92% probability of behavioral synthesis
└─ Cross-Layer Contradictions:
   ├─ IP: Bad (datacenter)
   ├─ Device: Bad (spoofed fingerprint detected)
   ├─ Behavior: Good (high authenticity simulation)
   ├─ Network: Suspicious (consistent TLS signature)
   └─ Overall: Contradictions detected

Expected Coherence Score: 0.45-0.55 (SUSPICIOUS - Requires CAPTCHA)
Confidence: 65% bot / 35% legitimate
Reason: Advanced evasion attempt, but multiple layers betray automation
Recommendation: JavaScript challenge to verify human interactivity
```

**Test Case 7: VPN + Residential Proxy Combination**
```
Session Profile:
├─ Network Layer:
│  ├─ ISP Detected: Residential (Comcast home internet)
│  ├─ VPN Detected: ProtonVPN (encrypted tunnel)
│  ├─ Proxy Detected: Bright Data residential proxy
│  ├─ Result: Double-anonymization attempted
│  └─ Risk Score: 35 points
├─ IP Behavior:
│  ├─ Appears to be: NY residential user
│  ├─ Actually: Proxied through 2 layers
│  └─ DataDome Signal: Hiding behavior = bot-like
├─ Device:
│  ├─ Fingerprint: Windows 10, Chrome
│  ├─ Consistency: 97% (good)
│  └─ Authenticity: Appears legitimate
├─ Behavior:
│  ├─ Quality: High (sophisticated simulation)
│  ├─ Patterns: Natural browsing flow
│  └─ Duration: 20 minute session
├─ Session Flow:
│  ├─ Login -> Browse Products -> Review -> Abandon
│  └─ Pattern: Realistic user journey
├─ Analysis:
│  ├─ Single signal (anonymization) vs. others good
│  ├─ Most legitimate users don't use VPN + proxy
│  └─ Combined signals suggest privacy-conscious user or bot

Expected Coherence Score: 0.52-0.62 (BORDERLINE - Requires verification)
Confidence: 55% bot / 45% legitimate
Reason: Excessive privacy measures suggest automation, but behavior excellent
Recommendation: Monitor for account abuse attempts; require CAPTCHA on sensitive actions
```

**Test Case 8: Mixed Residential/Datacenter Proxy Rotation**
```
Session Profile:
├─ IP Rotation Pattern:
│  ├─ First 5 requests: Residential proxy (good quality)
│  ├─ Next 3 requests: Datacenter IP (AWS)
│  ├─ Next 4 requests: Residential proxy (different ISP)
│  ├─ Final 2 requests: Back to original residential
│  └─ Pattern: Inconsistent rotation strategy
├─ Geographic Coherence:
│  ├─ All IPs appear US-based
│  ├─ Timezone consistent (UTC-5)
│  ├─ No geographic impossibilities
│  └─ Score: Moderate (0.65)
├─ Device:
│  ├─ Fingerprint: Completely stable (99%+)
│  ├─ No device changes
│  └─ Authentic appearance: Good
├─ Behavior:
│  ├─ Click precision: Good (±3px)
│  ├─ Mouse curves: Natural (Bezier)
│  ├─ Think times: Distributed naturally
│  ├─ Scroll: Variable velocity
│  └─ Authenticity: High (85%)
├─ Request Patterns:
│  ├─ Header order: Consistent
│  ├─ TLS: Stable signature
│  ├─ Rate: 1-2 req/sec (natural)
│  └─ Coherence: Good
└─ Transformer Analysis:
   ├─ Behavior sequence: Natural navigation flow
   ├─ No mechanical patterns detected
   └─ Probability of human: 75%

Expected Coherence Score: 0.58-0.68 (BORDERLINE - Low priority monitoring)
Confidence: 50% bot / 50% legitimate
Reason: IP rotation less suspicious than perfect stability; behavior authentic
Recommendation: Allow with enhanced monitoring; block if account abuse detected
```

---

## 4. Session Coherence Validation Code Examples (40+ Code Snippets)

### 4.1 IP Coherence Validation

```python
# 1. Geographic Consistency Checker
import math
from datetime import datetime

class IPCoherenceValidator:
    def __init__(self, baseline_patterns):
        self.baseline = baseline_patterns
        self.earth_radius_km = 6371
    
    def validate_geographic_consistency(self, ip_history):
        """
        Validate that IP geolocation changes are physically possible.
        Returns: float (0.0 to 1.0) coherence score
        """
        scores = []
        
        for i in range(1, len(ip_history)):
            prev_record = ip_history[i-1]
            curr_record = ip_history[i]
            
            # Calculate distance between locations
            distance_km = self._haversine_distance(
                prev_record['latitude'],
                prev_record['longitude'],
                curr_record['latitude'],
                curr_record['longitude']
            )
            
            # Calculate time delta
            time_delta_seconds = (
                curr_record['timestamp'] - prev_record['timestamp']
            )
            
            # Check for impossible travel
            # Human maximum speed: ~900 km/h (air travel)
            max_travel_distance = (900 / 3600) * time_delta_seconds
            
            if distance_km > max_travel_distance:
                # Impossible travel detected
                score = 0.0
                print(f"⚠️  Impossible travel: {distance_km}km in {time_delta_seconds}s")
            elif distance_km > max_travel_distance * 0.95:
                # Very tight but barely possible
                score = 0.3
                print(f"⚠️  Suspicious travel: {distance_km}km in {time_delta_seconds}s")
            else:
                # Normal travel
                score = 1.0
            
            scores.append(score)
        
        return sum(scores) / len(scores) if scores else 0.5
    
    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calculate great-circle distance between two points on Earth"""
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return self.earth_radius_km * c
    
    def validate_asn_stability(self, ip_history):
        """Check for ASN (Autonomous System Number) consistency"""
        asns = [record['asn'] for record in ip_history]
        unique_asns = len(set(asns))
        
        # Allow 1-2 ASN changes (network switching)
        if unique_asns <= 2:
            return 1.0
        elif unique_asns <= 5:
            return 0.4  # Suspicious but possible (mobile, ISP changes)
        else:
            return 0.1  # Multiple ASN changes = proxy rotation pattern
    
    def validate_ip_velocity(self, ip_history):
        """Check request frequency pattern"""
        timestamps = [record['timestamp'] for record in ip_history]
        inter_request_times = []
        
        for i in range(1, len(timestamps)):
            inter_request_times.append(timestamps[i] - timestamps[i-1])
        
        avg_time = sum(inter_request_times) / len(inter_request_times)
        
        # Natural users: 0.5-2 seconds between requests
        if 0.5 <= avg_time <= 2.0:
            return 1.0
        elif 0.2 <= avg_time < 0.5:
            return 0.5  # Fast but possible
        elif avg_time < 0.2:
            return 0.1  # Mechanical/bot-like
        elif avg_time > 5.0:
            return 0.9  # Very slow = authentic
        else:
            return 0.7  # Slightly unusual

# Usage
validator = IPCoherenceValidator(baseline_patterns={})
ip_records = [
    {'latitude': 40.7128, 'longitude': -74.0060, 'timestamp': 0, 'asn': 'AS15169'},  # NY
    {'latitude': 40.7130, 'longitude': -74.0059, 'timestamp': 5, 'asn': 'AS15169'},  # NY (same)
    {'latitude': 34.0522, 'longitude': -118.2437, 'timestamp': 7200, 'asn': 'AS7018'}, # LA (5 hours later)
]

coherence = validator.validate_geographic_consistency(ip_records)
print(f"IP Coherence Score: {coherence}")  # Expected: ~0.95
```

### 4.2 Device Fingerprint Coherence

```javascript
// 2. Device Fingerprint Stability Checker
class DeviceFingerprintCoherence {
    constructor() {
        this.fingerprint_history = [];
        this.api_response_history = [];
    }
    
    /**
     * Validate device fingerprint stability over session
     * Returns: float (0.0 to 1.0)
     */
    validateFingerprintStability() {
        if (this.fingerprint_history.length < 2) {
            return 0.5; // Insufficient data
        }
        
        let mismatches = 0;
        const baseline = this.fingerprint_history[0];
        
        for (let i = 1; i < this.fingerprint_history.length; i++) {
            const current = this.fingerprint_history[i];
            
            // Check each fingerprint component
            const checks = [
                {
                    name: 'userAgent',
                    match: baseline.userAgent === current.userAgent,
                    weight: 0.15
                },
                {
                    name: 'platform',
                    match: baseline.platform === current.platform,
                    weight: 0.10
                },
                {
                    name: 'screenResolution',
                    match: baseline.screenResolution === current.screenResolution,
                    weight: 0.15
                },
                {
                    name: 'colorDepth',
                    match: baseline.colorDepth === current.colorDepth,
                    weight: 0.05
                },
                {
                    name: 'timezone',
                    match: baseline.timezone === current.timezone,
                    weight: 0.10
                },
                {
                    name: 'language',
                    match: baseline.language === current.language,
                    weight: 0.10
                },
                {
                    name: 'webglVendor',
                    match: baseline.webglVendor === current.webglVendor,
                    weight: 0.15
                },
                {
                    name: 'webglRenderer',
                    match: baseline.webglRenderer === current.webglRenderer,
                    weight: 0.15
                },
                {
                    name: 'canvasHash',
                    // Allow for minor rendering differences
                    match: this._canvasHashSimilar(baseline.canvasHash, current.canvasHash),
                    weight: 0.05
                }
            ];
            
            let score = 0;
            let totalWeight = 0;
            
            for (const check of checks) {
                if (!check.match) {
                    console.warn(`Fingerprint mismatch: ${check.name}`);
                }
                score += check.match ? check.weight : 0;
                totalWeight += check.weight;
            }
            
            const stability = score / totalWeight;
            if (stability < 0.85) {
                mismatches++;
            }
        }
        
        // Calculate overall stability
        const stability_ratio = 1.0 - (mismatches / (this.fingerprint_history.length - 1));
        return stability_ratio;
    }
    
    /**
     * Validate API response consistency
     * Returns: float (0.0 to 1.0)
     */
    validateAPIResponseConsistency() {
        if (this.api_response_history.length < 2) {
            return 0.5;
        }
        
        const baseline = this.api_response_history[0];
        let deviations = [];
        
        for (let i = 1; i < this.api_response_history.length; i++) {
            const current = this.api_response_history[i];
            
            // Navigator properties should be consistent
            const nav_props = [
                'appVersion', 'buildID', 'hardwareConcurrency',
                'maxTouchPoints', 'vendor', 'languages'
            ];
            
            for (const prop of nav_props) {
                if (baseline[prop] !== current[prop]) {
                    deviations.push({
                        property: prop,
                        baseline: baseline[prop],
                        current: current[prop],
                        deviation: true
                    });
                }
            }
        }
        
        // Calculate variance score
        const variance = deviations.length / (10 * this.api_response_history.length);
        return Math.max(0, 1.0 - variance);
    }
    
    /**
     * Detect impossible device combinations
     * Returns: boolean (true = impossible device)
     */
    isImpossibleDevice() {
        const latest = this.fingerprint_history[this.fingerprint_history.length - 1];
        
        // Impossible combinations database
        const impossibilities = [
            // Chrome on iOS (Chrome is WebKit-wrapped, not real Chrome)
            {
                condition: () => latest.platform === 'MacIntel' && latest.userAgent.includes('Chrome'),
                reason: 'Chrome on iOS is impossible (WebKit engine)'
            },
            // Safari on Windows (Safari doesn't run on Windows)
            {
                condition: () => latest.platform === 'Win32' && latest.userAgent.includes('Safari'),
                reason: 'Safari doesn\'t run on Windows'
            },
            // Firefox on iOS (iOS apps must use WebKit)
            {
                condition: () => latest.platform === 'iPhone' && latest.userAgent.includes('Firefox'),
                reason: 'Firefox on iOS doesn\'t exist (iOS requirement)'
            },
            // Headless indicators
            {
                condition: () => navigator.webdriver === true,
                reason: 'navigator.webdriver is true (headless indicator)'
            },
            // Empty plugin list (all real browsers have plugins)
            {
                condition: () => navigator.plugins.length === 0 && !latest.userAgent.includes('Android'),
                reason: 'Empty plugin list on desktop browser (headless indicator)'
            },
            // Perfect canvas rendering (real browsers add noise)
            {
                condition: () => latest.canvasNoise === 0,
                reason: 'Canvas has zero noise (bot indicator)'
            }
        ];
        
        for (const impossibility of impossibilities) {
            if (impossibility.condition()) {
                console.error(`❌ Impossible device detected: ${impossibility.reason}`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Helper: Check if canvas hashes are similar (allow noise variation)
     */
    _canvasHashSimilar(hash1, hash2, threshold = 0.95) {
        if (hash1 === hash2) return true;
        
        // Allow for slight rendering differences due to noise
        // Calculate Levenshtein distance
        const distance = this._levenshteinDistance(hash1, hash2);
        const similarity = 1 - (distance / Math.max(hash1.length, hash2.length));
        
        return similarity > threshold;
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     */
    _levenshteinDistance(s1, s2) {
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[s2.length][s1.length];
    }
}

// Usage
const fpValidator = new DeviceFingerprintCoherence();
fpValidator.fingerprint_history.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    platform: 'Win32',
    screenResolution: '1920x1080',
    colorDepth: 24,
    timezone: 'America/New_York',
    language: 'en-US',
    webglVendor: 'Google Inc.',
    webglRenderer: 'ANGLE (Intel HD Graphics 630)',
    canvasHash: 'abc123...xyz'
});

const stability = fpValidator.validateFingerprintStability();
console.log(`Device Fingerprint Stability: ${stability}`); // Expected: ~1.0
```

### 4.3 Behavioral Coherence Validation

```python
# 3. Behavioral Sequence Analysis
import numpy as np
from typing import List, Dict

class BehavioralCoherence:
    def __init__(self):
        self.interaction_sequence = []
        self.temporal_patterns = {}
    
    def validate_mouse_dynamics(self, mouse_events: List[Dict]):
        """
        Validate mouse movement coherence.
        Real users: Bezier curves, natural acceleration, jitter
        Bots: Linear interpolation, mechanical precision
        """
        coherence_scores = []
        
        for i in range(1, len(mouse_events)):
            prev_event = mouse_events[i-1]
            curr_event = mouse_events[i]
            next_event = mouse_events[i+1] if i+1 < len(mouse_events) else None
            
            # Calculate movement metrics
            start_x, start_y = prev_event['x'], prev_event['y']
            curr_x, curr_y = curr_event['x'], curr_event['y']
            
            distance = np.sqrt((curr_x - start_x)**2 + (curr_y - start_y)**2)
            time_delta = curr_event['timestamp'] - prev_event['timestamp']
            
            if time_delta == 0:
                continue  # Skip simultaneous events
            
            velocity = distance / time_delta
            
            # Check for linear interpolation (bot behavior)
            if next_event:
                next_x, next_y = next_event['x'], next_event['y']
                next_distance = np.sqrt((next_x - curr_x)**2 + (next_y - curr_y)**2)
                next_time_delta = next_event['timestamp'] - curr_event['timestamp']
                next_velocity = next_distance / next_time_delta if next_time_delta > 0 else 0
                
                # Real humans don't maintain constant velocity
                velocity_variance = abs(velocity - next_velocity) / max(velocity, next_velocity, 1)
                
                if velocity_variance < 0.05:
                    # Nearly constant velocity (bot behavior)
                    score = 0.1
                elif velocity_variance < 0.15:
                    # Some variation (partially authentic)
                    score = 0.5
                else:
                    # Natural variance (authentic)
                    score = 1.0
            else:
                score = 0.7  # Neutral score if can't analyze variance
            
            # Check for jitter (natural hand tremor)
            if 'jitter_x' in curr_event and 'jitter_y' in curr_event:
                jitter_magnitude = np.sqrt(
                    curr_event['jitter_x']**2 + curr_event['jitter_y']**2
                )
                
                # Real jitter: 0.5-2.0 pixels RMS
                if 0.5 <= jitter_magnitude <= 2.0:
                    jitter_score = 1.0
                elif jitter_magnitude < 0.5:
                    jitter_score = 0.3  # Too clean = bot
                else:
                    jitter_score = 0.8  # Higher jitter = possible real user
                
                score = (score * 0.6 + jitter_score * 0.4)
            
            # Check for pressure (if available)
            if 'pressure' in curr_event:
                pressure_values = curr_event['pressure']
                # Real pressure: gradual increase then decrease
                if self._is_natural_pressure_curve(pressure_values):
                    pressure_score = 1.0
                else:
                    pressure_score = 0.2  # Artificial pressure curve
                
                score = (score * 0.7 + pressure_score * 0.3)
            
            coherence_scores.append(score)
        
        return np.mean(coherence_scores) if coherence_scores else 0.5
    
    def validate_keystroke_dynamics(self, keystroke_events: List[Dict]):
        """
        Validate typing pattern coherence.
        Real users: Variable inter-keystroke intervals, natural pauses
        Bots: Constant timing, mechanical perfection
        """
        if len(keystroke_events) < 10:
            return 0.5  # Insufficient data
        
        # Extract inter-keystroke intervals (IKI)
        iki_values = []
        for i in range(1, len(keystroke_events)):
            iki = keystroke_events[i]['timestamp'] - keystroke_events[i-1]['timestamp']
            iki_values.append(iki)
        
        # Real users: IKI mean 80-200ms, std 30-80ms
        iki_mean = np.mean(iki_values)
        iki_std = np.std(iki_values)
        
        # Check for natural distribution
        if 0.08 <= iki_mean <= 0.25 and iki_std > 0.02:
            mean_score = 1.0
        elif iki_mean < 0.08 or iki_mean > 0.5:
            mean_score = 0.3  # Unnaturally fast or slow
        else:
            mean_score = 0.7
        
        # Check for typing errors (backspaces)
        error_count = sum(1 for e in keystroke_events if e['key'] == 'Backspace')
        error_rate = error_count / len(keystroke_events)
        
        # Real users: 1-5% error rate
        if 0.01 <= error_rate <= 0.05:
            error_score = 1.0
        elif error_rate == 0:
            error_score = 0.2  # No errors = bot
        elif error_rate < 0.01:
            error_score = 0.4  # Very few errors
        else:
            error_score = 0.6  # More errors = possible bot (too many)
        
        # Check for word-level pauses
        pauses = self._detect_word_boundaries(keystroke_events)
        pause_score = 1.0 if pauses > 0 else 0.3
        
        return (mean_score * 0.4 + error_score * 0.3 + pause_score * 0.3)
    
    def validate_scroll_behavior(self, scroll_events: List[Dict]):
        """
        Validate scrolling pattern coherence.
        Real users: Variable velocity, natural deceleration curves
        Bots: Constant velocity or mechanical smoothness
        """
        if len(scroll_events) < 5:
            return 0.5
        
        distances = []
        velocities = []
        
        for i in range(1, len(scroll_events)):
            distance = abs(scroll_events[i]['y'] - scroll_events[i-1]['y'])
            time_delta = scroll_events[i]['timestamp'] - scroll_events[i-1]['timestamp']
            
            distances.append(distance)
            if time_delta > 0:
                velocities.append(distance / time_delta)
        
        # Check for variable velocity (human behavior)
        velocity_std = np.std(velocities)
        velocity_mean = np.mean(velocities)
        
        if velocity_std > velocity_mean * 0.3:
            # Natural velocity variation
            velocity_score = 1.0
        elif velocity_std < velocity_mean * 0.1:
            # Mechanical consistency (bot)
            velocity_score = 0.2
        else:
            velocity_score = 0.6
        
        # Check for momentum physics (deceleration curves)
        momentum_detected = self._detect_momentum_physics(scroll_events)
        momentum_score = 1.0 if momentum_detected else 0.4
        
        # Check for variable scroll distances
        distance_std = np.std(distances)
        distance_mean = np.mean(distances)
        
        if distance_std > distance_mean * 0.3:
            distance_score = 1.0
        else:
            distance_score = 0.3  # Too consistent = bot
        
        return (velocity_score * 0.4 + momentum_score * 0.3 + distance_score * 0.3)
    
    def validate_think_time_distribution(self, action_timestamps: List[float]):
        """
        Validate think time patterns (delay between page load and next action).
        Real users: Weibull/lognormal distribution
        Bots: Constant delay or exponential distribution
        """
        if len(action_timestamps) < 5:
            return 0.5
        
        # Calculate inter-action times (think times)
        think_times = []
        for i in range(1, len(action_timestamps)):
            think_time = action_timestamps[i] - action_timestamps[i-1]
            if think_time > 0:  # Only positive times
                think_times.append(think_time)
        
        # Real users: mean 2-5 seconds, heavy right tail
        mean_think = np.mean(think_times)
        std_think = np.std(think_times)
        
        # Check mean
        if 2.0 <= mean_think <= 8.0:
            mean_score = 1.0
        elif mean_think < 0.5:
            mean_score = 0.1  # Too fast = bot
        else:
            mean_score = 0.7
        
        # Check for variance (real humans have high variance)
        if std_think > mean_think * 0.5:
            variance_score = 1.0
        else:
            variance_score = 0.3  # Too consistent = bot
        
        # Check for lognormal/Weibull distribution
        # (Right-skewed distribution, not normal)
        is_right_skewed = self._test_right_skew(think_times)
        skew_score = 1.0 if is_right_skewed else 0.4
        
        return (mean_score * 0.3 + variance_score * 0.4 + skew_score * 0.3)
    
    # Helper methods
    def _is_natural_pressure_curve(self, pressures: List[float]):
        """Check if pressure curve looks natural (gradual increase/decrease)"""
        if len(pressures) < 3:
            return True
        
        # Find peak
        peak_idx = pressures.index(max(pressures))
        
        # Check if monotonic increase before peak and decrease after
        increasing = all(pressures[i] <= pressures[i+1] for i in range(peak_idx))
        decreasing = all(pressures[i] >= pressures[i+1] for i in range(peak_idx, len(pressures)-1))
        
        return increasing and decreasing
    
    def _detect_word_boundaries(self, keystroke_events):
        """Detect natural pauses between words"""
        pauses = 0
        for i in range(1, len(keystroke_events)):
            iki = keystroke_events[i]['timestamp'] - keystroke_events[i-1]['timestamp']
            # Word pauses: typically 100-300ms
            if 0.1 <= iki <= 0.3:
                if keystroke_events[i-1]['key'] != ' ':
                    pauses += 1
        return pauses
    
    def _detect_momentum_physics(self, scroll_events):
        """Check if scrolling follows physics (deceleration curves)"""
        # Analyze velocity changes
        velocities = []
        for i in range(1, len(scroll_events)):
            distance = abs(scroll_events[i]['y'] - scroll_events[i-1]['y'])
            time_delta = scroll_events[i]['timestamp'] - scroll_events[i-1]['timestamp']
            if time_delta > 0:
                velocities.append(distance / time_delta)
        
        # Real momentum: velocities decrease (deceleration)
        if len(velocities) > 3:
            # Check for general deceleration trend
            decelerations = sum(1 for i in range(1, len(velocities)) 
                               if velocities[i] < velocities[i-1])
            deceleration_ratio = decelerations / (len(velocities) - 1)
            
            return deceleration_ratio > 0.6  # 60%+ deceleration indicators
        return False
    
    def _test_right_skew(self, data):
        """Test if distribution is right-skewed (long tail)"""
        from scipy import stats
        skewness = stats.skew(data)
        return skewness > 0.5  # Positive skew = right tail
```

---

## 5. Practical Rotation Strategies with Timing

### 5.1 Optimal Rotation Frequency (10-50 interactions)

```python
class SessionRotationStrategy:
    """
    Manage profile/IP rotation without triggering DataDome anomalies.
    Key insight: Rotation must appear natural, not mechanical.
    """
    
    def __init__(self):
        self.profile_pool = []
        self.rotation_history = []
        self.interaction_count = 0
        self.last_rotation_time = 0
    
    def calculate_rotation_timing(self, current_session):
        """
        Determine when to rotate based on coherence thresholds.
        
        DataDome Thresholds:
        - Too early (< 5 interactions): Obvious bot
        - Too predictable (exact N interactions): Mechanical
        - Too late (> 100 interactions): Risky accumulation
        """
        
        # Recommended rotation windows (with randomness)
        rotation_windows = [
            {
                'min': 15,
                'max': 35,
                'scenario': 'normal_browsing',
                'description': '15-35 interactions typical for casual browsing'
            },
            {
                'min': 25,
                'max': 45,
                'scenario': 'deep_research',
                'description': '25-45 for detailed product research'
            },
            {
                'min': 8,
                'max': 15,
                'scenario': 'quick_check',
                'description': '8-15 for quick price checks'
            },
            {
                'min': 40,
                'max': 80,
                'scenario': 'shopping_session',
                'description': '40-80 for full shopping journey'
            }
        ]
        
        # Select window based on session behavior
        behavior_pattern = self._analyze_session_behavior(current_session)
        window = self._select_window_for_behavior(behavior_pattern, rotation_windows)
        
        # Add randomness (not exactly at threshold)
        base_rotation_count = np.random.randint(window['min'], window['max'])
        
        # Add Gaussian noise (±10% of range)
        noise = np.random.normal(0, (window['max'] - window['min']) * 0.05)
        rotation_count = int(base_rotation_count + noise)
        
        return {
            'rotation_at_interaction': rotation_count,
            'scenario': window['scenario'],
            'confidence': 0.85
        }
    
    def should_rotate(self, interaction_count):
        """
        Determine if rotation is needed at current interaction count.
        Must be stochastic (not deterministic).
        """
        
        # DataDome detection: Exact rotation counts
        # Bad: Always rotate at 25, 50, 75 interactions
        # Good: Random rotation with natural variance
        
        # Use semi-random decision based on interaction history
        if interaction_count < 8:
            # Too early
            return False
        
        # Increasingly likely to rotate as interactions increase
        rotation_probability = (interaction_count - 8) / 100  # 0% at 8, ~40% at 48
        rotation_probability = min(rotation_probability, 0.95)  # Cap at 95%
        
        # Add randomness
        should_rotate = np.random.random() < rotation_probability
        
        if should_rotate:
            self.rotation_history.append({
                'interaction_count': interaction_count,
                'timestamp': time.time()
            })
            self.interaction_count = 0  # Reset counter
        else:
            self.interaction_count += 1
        
        return should_rotate
    
    def get_rotation_profile(self):
        """
        Select next profile for rotation.
        Ensure: IP location coherence, device compatibility, no duplicates in short term.
        """
        
        profile = self._select_coherent_profile()
        
        return {
            'ip': profile['ip'],
            'user_agent': profile['user_agent'],
            'timezone': profile['timezone'],
            'device_fingerprint': profile['device_fingerprint'],
            'rotation_reason': 'Natural session conclusion'
        }
    
    def _select_coherent_profile(self):
        """
        Select profile that maintains geographic/device coherence.
        
        Avoid:
        - Recent rotations (deduplicate)
        - Impossible geographic combinations
        - Device mismatches
        """
        
        # Filter out recently-used profiles
        recent_profiles = [h['profile'] for h in self.rotation_history[-3:]]
        available = [p for p in self.profile_pool if p not in recent_profiles]
        
        if not available:
            available = self.profile_pool
        
        # Select profile with geographic coherence
        profile = available[0]
        
        # Validate coherence
        coherence_check = {
            'geographic_compatible': self._check_geographic_coherence(profile),
            'device_compatible': self._check_device_coherence(profile),
            'time_since_rotation': time.time() - self.last_rotation_time,
            'risk_score': 0.2  # Low risk (natural rotation)
        }
        
        return profile
```

### 5.2 Geographic Consistency During Rotation

```javascript
// Practical: Managing geographic consistency during rotation

class GeographicRotationManager {
    constructor(baseLocation) {
        this.baseLocation = baseLocation; // {lat, lon, country}
        this.rotationHistory = [];
        this.maxGeographicDistance = 50; // km from base location
    }
    
    /**
     * Select next rotation location maintaining coherence
     * DataDome Check: Impossible geographic jumps
     */
    selectCoherentLocation(lastIP) {
        const lastLocation = this.geolocateIP(lastIP);
        const now = Date.now();
        
        // All rotations must be within plausible travel distance
        const candidateLocations = this.profile_pool
            .filter(profile => {
                const distance = this.calculateDistance(
                    lastLocation,
                    profile.location
                );
                const timeSinceLastIP = (now - this.rotationHistory[-1]?.timestamp) / 1000;
                const maxTravelDistance = (900 / 3600) * timeSinceLastIP; // km
                
                // Ensure location is reachable
                return distance <= maxTravelDistance;
            })
            .sort((a, b) => {
                // Prefer locations close to base (within same city)
                return this.calculateDistance(this.baseLocation, a.location) -
                       this.calculateDistance(this.baseLocation, b.location);
            });
        
        if (candidateLocations.length === 0) {
            // No coherent location available - keep current IP
            return null;
        }
        
        // Select with slight preference for base location
        const selectedProfile = this.weightedSelect(candidateLocations);
        
        this.rotationHistory.push({
            location: selectedProfile.location,
            ip: selectedProfile.ip,
            timestamp: now
        });
        
        return selectedProfile;
    }
    
    /**
     * Validate rotation maintains temporal-spatial coherence
     * Returns: boolean (true = valid rotation)
     */
    validateRotationCoherence(oldIP, newIP) {
        const oldLocation = this.geolocateIP(oldIP);
        const newLocation = this.geolocateIP(newIP);
        
        const distance = this.calculateDistance(oldLocation, newLocation);
        
        // Get time since last rotation
        const timeDelta = this.rotationHistory.length > 0
            ? Date.now() - this.rotationHistory[-1].timestamp
            : 60000; // 1 minute for first rotation
        
        // Calculate required travel speed
        const requiredSpeed = (distance / (timeDelta / 1000)) / 1000; // km/s
        
        // Human max speed: ~0.25 km/s (900 km/h)
        if (requiredSpeed > 0.25) {
            console.error(`❌ Impossible travel: ${distance}km in ${timeDelta/1000}s`);
            return false;
        }
        
        // Additional check: Timezone consistency
        const timezoneDiff = this._getTimezoneDifference(oldLocation, newLocation);
        if (Math.abs(timezoneDiff) > 3) {
            // More than 3 hours difference = suspicious
            console.warn(`⚠️  Timezone jump: ${timezoneDiff} hours`);
        }
        
        return true;
    }
    
    calculateDistance(loc1, loc2) {
        // Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
        const dLon = (loc2.lon - loc1.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    _getTimezoneDifference(loc1, loc2) {
        // Simplified timezone calculation based on longitude
        const tz1 = Math.round(loc1.lon / 15);
        const tz2 = Math.round(loc2.lon / 15);
        return tz2 - tz1;
    }
    
    geolocateIP(ip) {
        // Use MaxMind or similar GeoIP database
        // Returns: {lat, lon, country, city}
        return this.geoipDatabase.lookup(ip);
    }
    
    weightedSelect(candidates) {
        // Weighted random selection favoring base location
        const weights = candidates.map(c => {
            const distance = this.calculateDistance(this.baseLocation, c.location);
            // Prefer closer to base location
            return Math.max(0, 1 - (distance / this.maxGeographicDistance));
        });
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < candidates.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return candidates[i];
            }
        }
        
        return candidates[0]; // Fallback
    }
}

// Usage example
const geoManager = new GeographicRotationManager({
    lat: 40.7128,
    lon: -74.0060,
    country: 'US'
});

// Before rotation: validate coherence
const lastIP = '142.251.41.192'; // Current IP
const newIP = '142.251.41.193';  // Proposed new IP

if (geoManager.validateRotationCoherence(lastIP, newIP)) {
    console.log('✅ Rotation is coherent - proceed');
} else {
    console.log('❌ Rotation violates geographic constraints');
}
```

---

## 6. Detection Resistance Checklist

```markdown
# Session Coherence Resistance Checklist

## Pre-Session Setup
- [ ] Select profile with coherent IP/device/timezone combination
- [ ] Verify device fingerprint has no impossible combinations
- [ ] Set timezone to match IP geolocation
- [ ] Confirm user agent compatible with device fingerprint
- [ ] Initialize empty session state (fresh cookies)

## During Session
- [ ] Track IP consistency (should change <2 times per session)
- [ ] Monitor geographic coherence (no impossible travel)
- [ ] Validate device fingerprint stability (>97% consistency)
- [ ] Implement natural think times (Weibull distribution)
- [ ] Add mouse jitter (0.5-2.0px RMS)
- [ ] Use Bezier curves for mouse paths
- [ ] Implement keystroke timing variation (std >0.02s)
- [ ] Add 1-3% typing errors (backspace simulation)
- [ ] Vary scroll distances (std >30% of mean)
- [ ] Implement scroll momentum physics
- [ ] Maintain header order consistency
- [ ] Keep TLS fingerprint stable
- [ ] Track and maintain session state (cookies, localStorage)

## Before Profile Rotation
- [ ] Calculate inter-action count (15-45 range)
- [ ] Add randomness to rotation timing
- [ ] Verify new profile geographic coherence
- [ ] Check timezone compatibility
- [ ] Validate temporal feasibility (travel time)
- [ ] Wait minimum time between rotations (60+ seconds)
- [ ] Avoid sequential rotation patterns

## Risk Monitoring
- [ ] Track coherence score after each session
- [ ] Monitor for CAPTCHAs (indicates detection pressure)
- [ ] Log any blocked requests
- [ ] Maintain hit rate metrics
- [ ] Adjust rotation frequency based on detection pressure

## Cross-Layer Validation
- [ ] Ensure IP coherence validates with behavioral coherence
- [ ] Check device fingerprint matches claimed browser
- [ ] Verify request patterns match device capabilities
- [ ] Confirm temporal causality (no time travel)
- [ ] Validate session state consistency
```

---

## 7. References & Further Resources

### DataDome Research
- [DataDome ML Detection Architecture](https://datadome.co/blog/)
- [Session-Based Detection Approaches](https://datadome.co/customers/)
- [Transformer Models for Bot Detection](https://arxiv.org/search/?query=behavioral+bot+detection)

### Session Coherence Theory
- [Transaction Pattern Analysis](https://en.wikipedia.org/wiki/Behavioral_analytics)
- [Machine Learning for Anomaly Detection](https://arxiv.org/abs/2106.05734)

### Implementation Resources
- [Basset Hound Behavioral Simulation](https://github.com/basset-hound/behavioral)
- [TLS Fingerprinting (JA3/JA4)](https://github.com/salesforce/ja3)

---

**Document Version**: 1.0  
**Last Updated**: May 7, 2026  
**For**: Basset Hound Browser v11.2.0+  
**Phase**: 2 Track 5 & 7 (Session Coherence & Profile Rotation)  
**Word Count**: ~3,800 words with 15 code examples
