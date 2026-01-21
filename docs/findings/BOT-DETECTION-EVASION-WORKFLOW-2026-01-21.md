# Bot Detection Evasion Workflow: AI Agents & Human Operators

**Date:** January 21, 2026
**Status:** Research Complete
**Applies to:** basset-hound-browser v11.0.0

## Executive Summary

This document explains how bot detection evasion works in browser automation, specifically how AI agents and human operators use the basset-hound-browser API to evade detection while performing OSINT investigations.

## The Core Question

> "Would a user have to interact with an API to control actions inside of the browser, that way an AI agent could interface with the API or a human operator can interface with the API of the basset hound browser to mitigate bot detection?"

**Answer: Yes, that's exactly how it works.**

The browser provides evasion *capabilities*, but the *strategy* for using those capabilities comes from the operator (human or AI agent) via the WebSocket/MCP API.

---

## How Bot Detection Evasion Works

### Three Layers of Evasion

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATOR LAYER                           │
│         (Human or AI Agent via WebSocket/MCP API)           │
│                                                             │
│  Decisions:                                                 │
│  - When to use which fingerprint profile                    │
│  - How long to wait between actions                         │
│  - When to rotate proxies/user agents                       │
│  - Whether to abort if detection suspected                  │
│  - Human takeover for CAPTCHAs                              │
└─────────────────────────────────────────────────────────────┘
                              │
                         WebSocket API
                         or MCP Protocol
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BASSET HOUND BROWSER (This Tool)               │
│                                                             │
│  Capabilities (Active via API commands):                    │
│  - Fingerprint spoofing (navigator, canvas, WebGL, audio)   │
│  - Human-like mouse movement (Fitts's Law, Bezier curves)   │
│  - Realistic typing (variable speed, typos, pauses)         │
│  - Honeypot detection                                       │
│  - Rate limiting                                            │
│  - Session consistency                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TARGET WEBSITE                           │
│                                                             │
│  Detection Systems:                                         │
│  - Cloudflare, DataDome, PerimeterX, Akamai                │
│  - JavaScript fingerprinting probes                         │
│  - Behavioral analysis (mouse, typing patterns)             │
│  - TLS fingerprinting                                       │
│  - IP reputation                                            │
└─────────────────────────────────────────────────────────────┘
```

### What the Browser Does Automatically

When the browser starts, it automatically applies baseline evasion:

1. **Navigator property spoofing** - `navigator.webdriver = undefined`
2. **Plugin emulation** - Fake Chrome PDF Plugin, etc.
3. **Automation trace removal** - Delete Selenium/Puppeteer markers
4. **Chrome object emulation** - Fake `window.chrome` object
5. **Canvas/WebGL/Audio noise** - Randomize fingerprints

### What the Operator Controls via API

The operator (human or AI agent) controls *how* evasion is applied:

| API Command | What It Does | When to Use |
|-------------|--------------|-------------|
| `create_fingerprint_profile` | Create consistent browser fingerprint | Start of investigation |
| `set_active_fingerprint` | Apply a specific fingerprint | When switching identities |
| `generate_mouse_path` | Create human-like mouse path | Before click actions |
| `generate_typing_events` | Create realistic typing | Before form filling |
| `check_honeypot` | Detect hidden trap fields | Before form submission |
| `is_rate_limited` | Check if throttled | Before requests |
| `set_geolocation` | Spoof GPS location | When impersonating locale |

---

## Workflow Examples

### Example 1: AI Agent Investigation

```python
# palletai agent controlling basset-hound-browser via MCP

async def investigate_profile(url: str):
    # 1. Create a consistent fingerprint for this investigation
    await browser.create_fingerprint_profile({
        "name": "investigation_001",
        "platform": "windows",
        "region": "us-west"
    })

    # 2. Apply the fingerprint
    await browser.set_active_fingerprint("investigation_001")

    # 3. Navigate with human-like delay
    await browser.navigate(url)
    await asyncio.sleep(random.uniform(2, 4))  # Agent decides timing

    # 4. Check page state (respecting timing requirements)
    state = await browser.get_page_state()

    # 5. If there's a form, check for honeypots first
    if state.forms:
        honeypots = await browser.check_honeypot(state.forms[0].selector)
        safe_fields = [f for f in state.forms[0].fields if f not in honeypots]

    # 6. Fill form with human-like typing
    for field in safe_fields:
        typing_events = await browser.generate_typing_events({
            "text": field.value,
            "wpm": random.randint(40, 60)  # Variable typing speed
        })
        await browser.fill(field.selector, field.value)
        await asyncio.sleep(random.uniform(0.5, 1.5))

    # 7. Move mouse naturally before clicking
    mouse_path = await browser.generate_mouse_path({
        "start": {"x": 100, "y": 100},
        "end": {"x": 500, "y": 300}  # Submit button location
    })
    await browser.click("#submit")

    # 8. Collect evidence with chain of custody
    await browser.collect_evidence_chain({
        "type": "screenshot",
        "description": "Form submission result"
    })
```

### Example 2: Human Operator via CLI

```bash
# Human operator using websocket CLI client

# Connect to browser
wscat -c ws://localhost:8765

# Create fingerprint profile for stealth
> {"id":1, "command":"create_fingerprint_profile", "name":"osint_session", "platform":"macos"}

# Navigate to target
> {"id":2, "command":"navigate", "url":"https://target-site.com"}

# Wait for page load (human decides timing)
# ... wait 3 seconds ...

# Get page state
> {"id":3, "command":"get_page_state"}

# Human reviews response, decides what to click
# Human can see the page and make decisions

# Fill form with human-like behavior
> {"id":4, "command":"fill", "selector":"#username", "value":"investigator"}

# Take screenshot as evidence
> {"id":5, "command":"screenshot"}
```

### Example 3: CAPTCHA Handoff (Human-in-the-Loop)

```python
async def handle_captcha(browser, context):
    """
    When AI agent encounters CAPTCHA, hand off to human operator.
    """
    # 1. Detect CAPTCHA presence
    state = await browser.get_page_state()

    if "captcha" in state.html.lower() or "challenge" in state.html.lower():
        # 2. Take screenshot for human review
        screenshot = await browser.screenshot()

        # 3. Notify human operator (via external system)
        await notify_operator({
            "type": "captcha_detected",
            "url": state.url,
            "screenshot": screenshot,
            "session_id": context.session_id
        })

        # 4. Wait for human to solve (human uses same WebSocket API)
        # Human connects to ws://localhost:8765 and solves CAPTCHA manually

        # 5. Human signals completion via API or external system
        await wait_for_human_completion(context.session_id)

        # 6. AI agent resumes automation
        return await browser.get_page_state()
```

---

## Key Evasion Capabilities in basset-hound-browser

### Phase 17: Bot Detection Evasion (Implemented)

| Feature | API Commands | How It Helps |
|---------|--------------|--------------|
| **Fingerprint Profiles** | `create_fingerprint_profile`, `apply_fingerprint` | Consistent identity across session |
| **Behavioral AI** | `generate_mouse_path`, `generate_typing_events` | Human-like interaction patterns |
| **Honeypot Detection** | `check_honeypot`, `filter_honeypots` | Avoid trap fields |
| **Rate Limiting** | `is_rate_limited`, `record_rate_limit` | Adaptive delays |
| **WebGL Spoofing** | Automatic | Fake GPU fingerprint |
| **Canvas Noise** | Automatic | Randomize canvas fingerprint |

### Available WebSocket Commands for Evasion

```javascript
// Fingerprint management (8 commands)
create_fingerprint_profile, create_regional_fingerprint, get_fingerprint_profile,
list_fingerprint_profiles, set_active_fingerprint, get_active_fingerprint,
apply_fingerprint, delete_fingerprint_profile

// Behavioral AI (6 commands)
create_behavioral_profile, generate_mouse_path, generate_scroll_behavior,
generate_typing_events, get_behavioral_profile, list_behavioral_sessions

// Detection avoidance (7 commands)
check_honeypot, filter_honeypots, get_rate_limit_state, record_request_success,
record_rate_limit, is_rate_limited, reset_rate_limit, list_rate_limit_adapters
```

---

## What Detection Systems Look For

### Fingerprinting Signals

| Signal | What They Check | How basset-hound Evades |
|--------|-----------------|-------------------------|
| `navigator.webdriver` | Automation flag | Set to `undefined` |
| Canvas fingerprint | Unique hash | Inject noise |
| WebGL renderer | GPU string | Spoof vendor/renderer |
| Audio context | Frequency data | Add noise |
| Plugins array | Empty = suspicious | Mock Chrome plugins |
| Screen resolution | Common sizes | Use realistic configs |
| Timezone | Match IP location | Spoofable via API |

### Behavioral Signals

| Signal | What They Check | How basset-hound Evades |
|--------|-----------------|-------------------------|
| Mouse movement | Straight lines = bot | Bezier curves + jitter |
| Typing speed | Constant = bot | Variable speed + typos |
| Scroll behavior | Instant jumps = bot | Smooth, variable scrolling |
| Click location | Always center = bot | Random within element |
| Response time | Instant = bot | Human-like delays |

### Network Signals (Requires External Solution)

| Signal | What They Check | Solution |
|--------|-----------------|----------|
| IP reputation | Datacenter IPs | Use residential proxies |
| TLS fingerprint | Python/Node patterns | Use TLS proxy or curl_cffi |
| Request rate | Too fast = bot | Rate limiting via API |

---

## Integration Architecture with palletai

```
┌─────────────────────────────────────────────────────────────┐
│                        palletai                              │
│                   (AI Agent Framework)                       │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  OSINT Agent │ │Investigation │ │  Evidence    │        │
│  │  (decides    │ │   Manager    │ │   Manager    │        │
│  │  actions)    │ │              │ │              │        │
│  └──────┬───────┘ └──────────────┘ └──────────────┘        │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ MCP Protocol (or WebSocket)
          │ - Sends: navigate, click, fill, screenshot, etc.
          │ - Receives: page state, evidence, errors
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              BASSET HOUND BROWSER                           │
│                                                              │
│  Automatic:                  API-Controlled:                 │
│  - Fingerprint injection    - Which fingerprint to use      │
│  - Canvas noise             - When to navigate              │
│  - WebGL spoofing           - How long to wait              │
│  - Automation removal       - What to click/fill            │
│                             - When to take evidence          │
│                             - Rate limiting decisions        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
                 ┌───────────┐
                 │ Web Pages │
                 └───────────┘
```

---

## Testing Bot Detection Evasion

### Online Test Sites

1. **bot.sannysoft.com** - Basic automation detection
2. **browserleaks.com** - Fingerprint analysis
3. **abrahamjuliot.github.io/creepjs** - Advanced fingerprinting
4. **fingerprintjs.com/demo** - Commercial fingerprinting

### Self-Test via API

```javascript
// Connect to browser WebSocket
// Navigate to test site
{"id": 1, "command": "navigate", "url": "https://bot.sannysoft.com"}

// Wait for page load
// After 3 seconds...

// Execute detection test script
{"id": 2, "command": "execute_script", "script": `
  JSON.stringify({
    webdriver: navigator.webdriver,
    plugins: navigator.plugins.length,
    languages: navigator.languages,
    chrome: !!window.chrome,
    canvas: (() => {
      const c = document.createElement('canvas');
      return c.toDataURL().substring(0, 50);
    })()
  })
`}
```

---

## Known Limitations

1. **TLS Fingerprinting** - Electron has distinctive TLS handshake. Use TLS proxy for high-security targets.

2. **IP Reputation** - Datacenter IPs are flagged. Use residential proxies via basset-hound-networking.

3. **CAPTCHAs** - AI cannot solve all CAPTCHAs. Requires human-in-the-loop or solving service.

4. **Advanced Behavioral ML** - Some systems use ML to detect automation patterns. Increase randomization.

5. **Electron Detection** - Some sites specifically detect Electron. User agent may not fully mask this.

---

## Sources

- [Castle Blog: Anti-Detect Frameworks Evolution](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/)
- [O-mega: Top 10 Browser AI Agents 2026](https://o-mega.ai/articles/top-10-browser-use-agents-full-review-2026)
- [ZenRows: Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection)
- [AWS: AI Agent Browser Automation](https://aws.amazon.com/blogs/machine-learning/ai-agent-driven-browser-automation-for-enterprise-workflow-management/)
- [Bright Data: Puppeteer Real Browser](https://brightdata.com/blog/web-data/puppeteer-real-browser)
- [ScraperAPI: Bot Detection Bypass 2025](https://www.scraperapi.com/web-scraping/how-to-bypass-bot-detection/)

---

## Conclusion

Bot detection evasion in basset-hound-browser works through a collaborative model:

1. **Browser provides capabilities** - Fingerprint spoofing, human-like behavior simulation, honeypot detection
2. **Operator makes decisions** - Which profile to use, when to act, how long to wait
3. **API enables control** - Both humans and AI agents use the same WebSocket/MCP API

This architecture allows:
- **AI agents** to automate investigation workflows with built-in evasion
- **Human operators** to take over when needed (CAPTCHAs, complex decisions)
- **Flexibility** to adapt evasion strategy based on target site

The browser is a *tool* - it doesn't decide strategy, it executes commands with appropriate evasion applied.
