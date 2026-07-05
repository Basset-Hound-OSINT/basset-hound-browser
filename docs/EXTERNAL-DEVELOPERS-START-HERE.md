> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# External Developers: Start Here

**Version:** 1.0  
**Date:** June 13, 2026  
**Target Audience:** External developers, integration partners, third-party builders  

## Quick Navigation

### I want to...

**🚀 Get started quickly**
→ Go to [Installation & Quickstart](#installation--quickstart) (5 minutes)

**📚 Learn the API**
→ Go to [API Documentation](#api-documentation) section

**💻 Write code**
→ Pick your language: [JavaScript](#javascript-sdk) | [Python](#python-sdk) | [Go](#go-sdk)

**🔗 Integrate with my system**
→ Go to [Integration Guides](#integration-guides)

**🐛 Troubleshoot issues**
→ Go to [Help & Troubleshooting](#help--troubleshooting)

---

## Installation & Quickstart

### Docker Installation (Recommended)

```bash
# Pull image
docker pull basset-hound-browser:v12.1.0

# Run container
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound-browser:v12.1.0

# Verify running
curl http://localhost:8765/status
```

### Local Installation (Development)

```bash
git clone https://github.com/basset-hound/browser.git
cd browser
npm install
npm run dev
```

### Verify Installation

```bash
# Test connection
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: '1',
    command: 'ping'
  }));
});
ws.on('message', (msg) => {
  console.log('Response:', msg);
  ws.close();
});
"
```

---

## API Documentation

### Complete References

**Main API Reference**
- **File:** `/docs/API-REFERENCE-COMPLETE.md`
- **Coverage:** 164 WebSocket commands, all categories
- **Best for:** Command lookup, parameter details
- **Length:** 3,100+ lines

**Quick Reference**
- **File:** `/docs/API-REFERENCE.md`
- **Coverage:** Essential commands with examples
- **Best for:** Quick lookup, examples
- **Length:** 500+ lines

**REST API Reference**
- **File:** `/docs/REST-API-REFERENCE.md`
- **Coverage:** HTTP/HTTPS endpoints (alternative to WebSocket)
- **Best for:** HTTP clients, simpler integrations
- **Length:** 1,600+ lines

**OpenAPI Specification**
- **File:** `/docs/api/openapi.yaml`
- **Format:** OpenAPI 3.0
- **Best for:** API documentation tools, code generation

### API by Category

| Category | Commands | Reference |
|----------|----------|-----------|
| **Navigation** | `navigate`, `go_back`, `reload`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Navigation |
| **Content Extraction** | `get_content`, `get_text`, `get_links`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Content |
| **Screenshots** | `screenshot`, `screenshot_element`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Screenshots |
| **Input/Interaction** | `click`, `fill`, `type`, `submit`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Input |
| **Storage** | `get_cookies`, `set_cookie`, `get_storage`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Storage |
| **Proxy/Network** | `set_proxy`, `get_network_logs`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Network |
| **Sessions** | `start_session`, `list_sessions`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Sessions |
| **Bot Evasion** | `set_user_agent`, `spoof_fingerprint`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Evasion |
| **Recording** | `start_recording`, `get_recording`, etc. | `/docs/API-REFERENCE-COMPLETE.md` § Recording |

---

## SDK Documentation

### JavaScript SDK

**Best for:** Node.js, Electron, browser environments

**Documentation:**
- **Complete Guide:** `/docs/guides/JS-SDK-COMPLETE.md`
- **Package:** `npm install basset-hound-browser`

**Quick Start:**
```javascript
const { BassetHoundClient } = require('basset-hound-browser');

const client = new BassetHoundClient({
  host: 'localhost',
  port: 8765
});

// Connect
await client.connect();

// Navigate
await client.send({
  command: 'navigate',
  url: 'https://example.com'
});

// Get content
const content = await client.send({
  command: 'get_content'
});

console.log(content);
```

**Also covers:**
- Error handling
- Connection management
- Command-specific options
- Real-world examples

### Python SDK

**Best for:** Python applications, data science, automation

**Documentation:**
- **Complete Guide:** `/docs/guides/PYTHON-SDK-COMPLETE.md`
- **Additional Patterns:** `/docs/integration/PYTHON-SDK-GUIDE.md`
- **Package:** `pip install basset-hound-browser`

**Quick Start:**
```python
from basset_hound import BassetHoundClient

client = BassetHoundClient('localhost:8765')

# Navigate
client.send({
    'command': 'navigate',
    'url': 'https://example.com'
})

# Get content
content = client.send({
    'command': 'get_content'
})

print(content)
```

**Also covers:**
- Async patterns
- Context managers
- Error handling
- Integration examples

### Go SDK

**Best for:** High-performance Go applications, concurrent operations

**Status:** Documentation planned for v12.2.0  
**Location:** `/docs/guides/GO-SDK-COMPLETE.md` (coming soon)

**In the meantime:** Use direct WebSocket connection
```go
import "github.com/gorilla/websocket"

conn, _, _ := websocket.DefaultDialer.Dial("ws://localhost:8765", nil)
conn.WriteJSON(map[string]interface{}{
    "id":      "1",
    "command": "navigate",
    "url":     "https://example.com",
})
```

---

## Integration Guides

### By Use Case

| Use Case | Guide | Time | Complexity |
|----------|-------|------|-----------|
| **Basic automation** | [Custom Integration Guide](#) | 1h | Easy |
| **Data extraction** | [Evidence Packaging Guide](#) | 2h | Medium |
| **Technology detection** | [Fingerprinting Guide](#) | 2h | Medium |
| **Behavioral analysis** | [Coherence Scoring Guide](#) | 3h | Hard |
| **Slack notifications** | [Slack Integration](#) | 1h | Easy |
| **Multi-target operations** | [Orchestration Guide](#) | 4h | Hard |
| **Monitoring & alerting** | [Monitoring Guide](#) | 3h | Medium |

### Featured Guides

**Custom Integration Guide**
- **File:** `/docs/guides/CUSTOM-INTEGRATION-GUIDE.md`
- **What:** How to integrate with your system
- **Topics:** Authentication, error handling, best practices

**External System Integration**
- **File:** `/docs/guides/INTEGRATION-GUIDE-EXTERNAL-SYSTEMS.md`
- **What:** Connecting to palletai, webhooks, external agents
- **Topics:** Webhook setup, agent communication, orchestration

**Slack Integration**
- **File:** `/docs/guides/SLACK-COMPLETE-INTEGRATION.md`
- **What:** Send screenshots and alerts to Slack
- **Topics:** Webhook setup, message formatting, event handling

**Monitoring & Performance**
- **File:** `/docs/guides/MONITORING-AND-PERFORMANCE-INTEGRATION-GUIDE.md`
- **What:** Monitor your browser instance, optimize performance
- **Topics:** Metrics, alerts, tuning, scaling

**Session Coherence Validation** (Advanced)
- **File:** `/docs/integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md`
- **What:** Validate bot evasion effectiveness
- **Topics:** 5-layer validation, scoring, configuration

**Evidence Packaging** (Forensic)
- **File:** `/docs/integration/EVIDENCE-PACKAGING-INTEGRATION-GUIDE.md`
- **What:** Package and export captured data
- **Topics:** Export formats, chain of custody, data integrity

---

## Common Patterns

### Pattern 1: Simple Navigation & Extraction

```javascript
const client = new BassetHoundClient('localhost:8765');
await client.connect();

// Navigate to page
await client.send({
  command: 'navigate',
  url: 'https://example.com'
});

// Extract data
const html = await client.send({
  command: 'get_content'
});

const links = await client.send({
  command: 'get_links'
});

const screenshot = await client.send({
  command: 'screenshot'
});

console.log('HTML:', html);
console.log('Links:', links);
console.log('Screenshot saved');
```

### Pattern 2: Form Interaction

```javascript
// Fill and submit form
await client.send({
  command: 'fill',
  selector: '#email',
  text: 'user@example.com'
});

await client.send({
  command: 'fill',
  selector: '#password',
  text: 'password123'
});

await client.send({
  command: 'click',
  selector: 'button[type=submit]'
});

// Wait for navigation
await client.send({
  command: 'wait_for_element',
  selector: '.dashboard',
  timeout: 5000
});
```

### Pattern 3: Multiple Targets (Parallel)

```javascript
const targets = [
  'https://site1.com',
  'https://site2.com',
  'https://site3.com'
];

// Create sessions for each target
const sessions = await Promise.all(
  targets.map(async (url) => {
    const session = await client.send({
      command: 'start_session'
    });
    
    await client.send({
      command: 'navigate',
      sessionId: session.id,
      url
    });
    
    return {
      sessionId: session.id,
      url,
      content: await client.send({
        command: 'get_content',
        sessionId: session.id
      })
    };
  })
);

console.log('Extracted from all targets:', sessions);
```

### Pattern 4: Error Handling & Retry

```javascript
async function navigateWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await client.send({
        command: 'navigate',
        url,
        timeout: 10000
      });
      return result;
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
}

const result = await navigateWithRetry('https://example.com');
```

### Pattern 5: Webhook Integration

```javascript
const express = require('express');
const app = express();

// Register webhook with browser
await client.send({
  command: 'register_webhook',
  events: ['screenshot_captured', 'navigation_complete'],
  url: 'https://your-server.com/webhook'
});

// Handle incoming events
app.post('/webhook', (req, res) => {
  const { event, sessionId, data } = req.body;
  
  if (event === 'screenshot_captured') {
    console.log('Screenshot ready:', data.url);
    // Process screenshot
  } else if (event === 'navigation_complete') {
    console.log('Navigation done:', data.url);
    // Continue workflow
  }
  
  res.json({ status: 'received' });
});

app.listen(3000);
```

---

## Help & Troubleshooting

### Common Issues

**Q: Connection refused (port 8765)**
- **Solution:** Make sure browser is running: `docker ps | grep basset`
- **Check:** `curl http://localhost:8765/status`

**Q: Navigation timeout**
- **Solution:** Some sites take longer. Increase timeout:
  ```javascript
  await client.send({
    command: 'navigate',
    url: 'https://example.com',
    timeout: 30000  // 30 seconds
  });
  ```

**Q: Screenshots not working**
- **Solution:** Check that Xvfb is running (if headless)
  ```bash
  ps aux | grep Xvfb
  ```

**Q: High memory usage**
- **Solution:** Close unused sessions:
  ```javascript
  const sessions = await client.send({
    command: 'list_sessions'
  });
  
  for (const session of sessions) {
    await client.send({
      command: 'close_session',
      sessionId: session.id
    });
  }
  ```

**Q: Bot detection/blocking**
- **Solution:** Use evasion features:
  ```javascript
  await client.send({
    command: 'configure_behavior',
    simulationMode: 'advanced',
    vectors: {
      fingerprinting: true,
      timing: true,
      userBehavior: true
    }
  });
  ```

### Documentation

**Basic Troubleshooting:**
- **File:** `/docs/guides/TROUBLESHOOTING.md`
- **Coverage:** Most common issues, 50+ solutions

**Advanced Troubleshooting:**
- **File:** `/docs/guides/TROUBLESHOOTING-ADVANCED.md`
- **Coverage:** Complex scenarios, debugging

**FAQ:**
- **File:** `/docs/guides/FAQ-COMPLETE.md`
- **Coverage:** 50+ questions with answers

### Getting Help

1. **Check FAQ first:** `/docs/guides/FAQ-COMPLETE.md`
2. **Search troubleshooting:** `/docs/guides/TROUBLESHOOTING.md`
3. **Check logs:**
   ```bash
   docker logs basset-hound-browser | tail -100
   ```
4. **Run diagnostics:**
   ```bash
   docker exec basset-hound-browser npm run diagnose
   ```
5. **Contact support:** See project repository

---

## Advanced Topics

### Bot Evasion

**Learn about fingerprint spoofing, behavior simulation, and detection avoidance**

- **Guide:** `/docs/guides/TROUBLESHOOTING-ADVANCED.md` → Evasion section
- **Reference:** `/docs/API-REFERENCE-COMPLETE.md` → Bot Evasion section (30+ commands)

### Performance Optimization

**Optimize for your specific workload**

- **Quick Tips:** `/docs/guides/MONITORING-AND-PERFORMANCE-INTEGRATION-GUIDE.md` → Performance section
- **Deep Dive:** `/docs/advanced/PERFORMANCE-TUNING-COMPLETE-GUIDE.md`

### Session Coherence & Validation

**Advanced feature: Validate bot evasion effectiveness**

- **User Guide:** `/docs/guides/SESSION-COHERENCE-VALIDATION-USER-GUIDE.md`
- **Integration Guide:** `/docs/integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md`
- **API Reference:** `/docs/api/SESSION-COHERENCE-VALIDATION-API-REFERENCE.md`

### Monitoring & Analytics

**Monitor your browser instances in production**

- **Setup Guide:** `/docs/guides/MONITORING-AND-PERFORMANCE-INTEGRATION-GUIDE.md`
- **Metrics Reference:** `/docs/monitoring/MONITORING-METRICS.md`
- **Operations Guide:** `/docs/operations/PRODUCTION-MONITORING-SETUP.md`

---

## Version Information

**Current Version:** v12.1.0 (Production)

**Version Timeline:**
- v12.0.0 - Production release (May 11, 2026)
- v12.1.0 - Performance & coherence (May 25, 2026) ← **YOU ARE HERE**
- v12.2.0 - Advanced features (August 15, 2026, planned)

**Upgrading?**
- **From v12.0.0 → v12.1.0:** See `/docs/deployment/MIGRATION-GUIDE-v12.0.0-to-v12.1.0.md`
- **From v11.x → v12.0.0:** See `/docs/deployment/MIGRATION-GUIDE-v11.3.0-to-v12.0.0.md`

---

## Sample Projects

### Example 1: Web Scraper

```javascript
const { BassetHoundClient } = require('basset-hound-browser');

async function scrapeProduct(productUrl) {
  const client = new BassetHoundClient();
  await client.connect();
  
  await client.send({
    command: 'navigate',
    url: productUrl
  });
  
  const product = await client.send({
    command: 'execute_script',
    script: `
      ({
        title: document.querySelector('h1').textContent,
        price: document.querySelector('.price').textContent,
        reviews: document.querySelector('.reviews').textContent,
        image: document.querySelector('img').src
      })
    `
  });
  
  return product;
}

// Usage
scrapeProduct('https://example.com/product/123')
  .then(product => console.log(product));
```

### Example 2: Automated Testing

```javascript
async function testLoginFlow() {
  const client = new BassetHoundClient();
  await client.connect();
  
  // Navigate to login
  await client.send({
    command: 'navigate',
    url: 'https://app.example.com/login'
  });
  
  // Fill form
  await client.send({
    command: 'fill',
    selector: '#email',
    text: 'test@example.com'
  });
  
  // Take screenshot before login
  let screenshot = await client.send({
    command: 'screenshot'
  });
  console.log('Before login:', screenshot);
  
  // Submit
  await client.send({
    command: 'click',
    selector: 'button[type=submit]'
  });
  
  // Wait for dashboard
  await client.send({
    command: 'wait_for_element',
    selector: '.dashboard',
    timeout: 5000
  });
  
  // Take screenshot after login
  screenshot = await client.send({
    command: 'screenshot'
  });
  console.log('After login:', screenshot);
}

testLoginFlow();
```

---

## Next Steps

**I'm ready to start coding!**

1. Pick your language: [JavaScript](#javascript-sdk) | [Python](#python-sdk)
2. Read the complete SDK guide
3. Check out the [common patterns](#common-patterns)
4. Build your first integration
5. Read the [troubleshooting guide](#help--troubleshooting) if you hit issues

**I need to integrate with my system**

1. Review your use case in [integration guides](#integration-guides)
2. Follow the specific guide for your scenario
3. Read [custom integration guide](#) for your system type
4. Check monitoring section if you need observability

**I'm having issues**

1. Check [common issues](#common-issues)
2. Read troubleshooting guide for your symptom
3. Run diagnostics
4. Check logs

---

## Key Resources (One-Click)

| Resource | Link |
|----------|------|
| **API Reference** | `/docs/API-REFERENCE-COMPLETE.md` |
| **JavaScript SDK** | `/docs/guides/JS-SDK-COMPLETE.md` |
| **Python SDK** | `/docs/guides/PYTHON-SDK-COMPLETE.md` |
| **Integration Guide** | `/docs/guides/CUSTOM-INTEGRATION-GUIDE.md` |
| **Troubleshooting** | `/docs/guides/TROUBLESHOOTING.md` |
| **FAQ** | `/docs/guides/FAQ-COMPLETE.md` |
| **REST API** | `/docs/REST-API-REFERENCE.md` |
| **Monitoring** | `/docs/guides/MONITORING-AND-PERFORMANCE-INTEGRATION-GUIDE.md` |

---

**Last Updated:** June 13, 2026  
**Status:** ✅ Current for v12.1.0  
**Feedback:** Welcome - please report issues and suggest improvements
