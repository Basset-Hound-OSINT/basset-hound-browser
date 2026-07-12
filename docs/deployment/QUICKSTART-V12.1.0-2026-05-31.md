# Basset Hound Browser v12.1.0 - Quickstart Guide

**Version:** 12.1.0  
**Release Date:** June 15, 2026  
**Setup Time:** 5 minutes per feature  
**Status:** Production Ready  

---

## Overview

This guide shows how to get started with v12.1.0's 4 new features in 5 minutes each.

**4 New Features:**
1. ✅ Technology Detection - Identify web technologies
2. ✅ Forensic Evidence Export - Court-ready evidence
3. ✅ Platform Integrations - Connect to OSINT tools
4. ✅ Advanced JavaScript - Custom data extraction

---

## Feature 1: Technology Detection (5 Minutes)

### Step 1: Start the Browser

```bash
npm start
# or
docker run -p 8765:8765 basset-hound
```

### Step 2: Connect WebSocket Client

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected to Basset Hound');
});
```

### Step 3: Navigate to Website

```javascript
ws.send(JSON.stringify({
  id: 1,
  command: 'navigate',
  url: 'https://wordpress.org'
}));
```

### Step 4: Detect Technologies

```javascript
setTimeout(() => {
  ws.send(JSON.stringify({
    id: 2,
    command: 'detect_technologies',
    includeVersions: true,
    confidence_threshold: 75
  }));
}, 3000);  // Wait 3 seconds for page load
```

### Step 5: Process Results

```javascript
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  
  if (msg.id === 2 && msg.success) {
    console.log('Detected Technologies:');
    msg.data.technologies.forEach(tech => {
      console.log(`- ${tech.name} ${tech.version} (${tech.confidence}%)`);
    });
  }
});
```

### Expected Output

```
Detected Technologies:
- WordPress 6.2 (95%)
- PHP 7.4 (85%)
- Apache 2.4.41 (100%)
```

### Next Steps

- See [Technology Detection Complete Guide](../reference/V12.1.0-FEATURES-INDEX-2026-05-31.md#technology-detection-module)
- Export findings to Shodan/Maltego using Platform Integrations
- Automate scanning with JavaScript loop

---

## Feature 2: Forensic Evidence Export (5 Minutes)

### Step 1: Initialize Evidence System

```javascript
ws.send(JSON.stringify({
  id: 1,
  command: 'init_evidence_chain',
  basePath: '/evidence/case-2026',
  autoVerify: true,
  autoSeal: true
}));
```

### Step 2: Create Investigation

```javascript
ws.send(JSON.stringify({
  id: 2,
  command: 'create_investigation',
  name: 'Website Analysis - Case ABC',
  description: 'Investigation of suspicious website',
  investigator: 'John Doe'
}));
```

### Step 3: Navigate and Investigate

```javascript
ws.send(JSON.stringify({
  id: 3,
  command: 'navigate',
  url: 'https://example.com'
}));

// Take screenshot for evidence
setTimeout(() => {
  ws.send(JSON.stringify({
    id: 4,
    command: 'collect_screenshot_chain',
    investigationId: 'inv_abc123',  // From step 2 response
    actor: 'john.doe@agency.gov',
    tags: ['homepage', 'evidence']
  }));
}, 2000);
```

### Step 4: Export Evidence

```javascript
ws.send(JSON.stringify({
  id: 5,
  command: 'export_forensic_evidence',
  investigationId: 'inv_abc123',
  format: 'zip',
  includeReport: true,
  includeChainOfCustody: true,
  signature: 'john.doe@agency.gov'
}));
```

### Step 5: Download Package

```javascript
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  
  if (msg.id === 5 && msg.success) {
    console.log('Evidence exported:');
    console.log(`- File: ${msg.data.filename}`);
    console.log(`- Size: ${msg.data.size} bytes`);
    console.log(`- Hash: ${msg.data.hash}`);
    console.log('- Ready for court submission');
  }
});
```

### What's Included

```
evidence-2026-12345.zip
├── investigation-metadata.json
├── chain-of-custody.csv
├── forensic-report.html
├── screenshots/
├── network-logs/
├── dom-states/
└── metadata/
```

### Next Steps

- See [Forensic Export Complete Guide](../reference/V12.1.0-FEATURES-INDEX-2026-05-31.md#forensic-evidence-export)
- Review legal admissibility checklist
- Integrate with law enforcement workflows

---

## Feature 3: Platform Integrations (5 Minutes)

### Step 1: Get API Keys

**Shodan:**
1. Visit https://shodan.io
2. Sign up or login
3. Copy API key from account page

**Maltego:**
1. Visit https://maltego.com
2. Download Maltego Desktop
3. Setup account

**MISP (Optional):**
1. Setup MISP instance or use public instance
2. Get API key from settings

### Step 2: Configure Integration

```javascript
// Configure Shodan
ws.send(JSON.stringify({
  id: 1,
  command: 'configure_platform_integration',
  platform: 'shodan',
  credentials: {
    apiKey: 'YOUR_SHODAN_API_KEY'
  }
}));

// Configure Maltego
ws.send(JSON.stringify({
  id: 2,
  command: 'configure_platform_integration',
  platform: 'maltego',
  credentials: {
    username: 'your_maltego_username'
  }
}));
```

### Step 3: Run Investigation

```javascript
// Navigate and analyze
ws.send(JSON.stringify({
  id: 3,
  command: 'navigate',
  url: 'https://example.com'
}));

// Wait and detect technologies
setTimeout(() => {
  ws.send(JSON.stringify({
    id: 4,
    command: 'detect_technologies'
  }));
}, 3000);
```

### Step 4: Export to Platform

```javascript
ws.send(JSON.stringify({
  id: 5,
  command: 'export_to_platform',
  platform: 'shodan',
  findings: {
    url: 'https://example.com',
    ip: '93.184.216.34',
    technologies: [/* detected tech */]
  },
  tags: ['investigation-2026']
}));
```

### Step 5: Verify in Platform

1. **Shodan:** Login, search for IP/domain
2. **Maltego:** Import CSV export, run transforms
3. **MISP:** View indicators in event

### Next Steps

- See [Platform Integrations Complete Guide](../reference/V12.1.0-FEATURES-INDEX-2026-05-31.md#platform-integrations)
- Setup webhooks for real-time alerting
- Automate multi-platform exports

---

## Feature 4: Advanced JavaScript Execution (5 Minutes)

### Step 1: Navigate to SPA

```javascript
ws.send(JSON.stringify({
  id: 1,
  command: 'navigate',
  url: 'https://react-app.example.com'
}));
```

### Step 2A: Quick Script Execution

```javascript
setTimeout(() => {
  ws.send(JSON.stringify({
    id: 2,
    command: 'execute_script',
    script: `
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 500)
      };
    `,
    timeout: 5000
  }));
}, 2000);
```

### Step 2B: Template-Based Extraction

```javascript
// For React apps
setTimeout(() => {
  ws.send(JSON.stringify({
    id: 2,
    command: 'execute_script_template',
    template: 'react-state-extractor',
    options: {
      componentName: 'App'
    }
  }));
}, 2000);

// For Vue apps
ws.send(JSON.stringify({
  id: 2,
  command: 'execute_script_template',
  template: 'vue-store-extractor'
}));

// For complex DOM
ws.send(JSON.stringify({
  id: 2,
  command: 'execute_script_template',
  template: 'spa-dom-snapshot'
}));
```

### Step 3: Process Results

```javascript
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  
  if (msg.id === 2 && msg.success) {
    console.log('Script Results:', msg.data.result);
    console.log('Console Output:', msg.data.console);
    if (msg.data.errors.length > 0) {
      console.error('Errors:', msg.data.errors);
    }
  }
});
```

### Available Templates

```
1. react-state-extractor       - React component state
2. vue-store-extractor         - Vue store state
3. angular-controller-extractor - Angular controllers
4. spa-dom-snapshot            - Full DOM snapshot
5. form-data-extractor         - All form fields
6. link-extractor              - All links
7. image-extractor             - All images
8. script-analyzer             - All scripts
9. cookie-extractor            - All cookies
10. localStorage-dumper        - localStorage contents
```

### Next Steps

- See [Advanced JavaScript Complete Guide](../reference/V12.1.0-FEATURES-INDEX-2026-05-31.md#advanced-javascript-execution)
- Create custom templates for your apps
- Deploy custom payloads safely

---

## Common Workflows

### Workflow 1: Complete OSINT Investigation

```javascript
// All 4 features working together

// 1. Initialize forensics
init_evidence_chain();
create_investigation();

// 2. Navigate
navigate('https://target.com');

// 3. Detect tech
detect_technologies();

// 4. Extract custom data
execute_script_template('react-state-extractor');

// 5. Collect evidence
collect_screenshot_chain();

// 6. Export findings
export_forensic_evidence();
export_to_platform('shodan');
export_to_platform('maltego');
```

### Workflow 2: Automated Tech Scanning

```javascript
// Scan list of URLs for technologies

const targets = [
  'https://site1.com',
  'https://site2.com',
  'https://site3.com'
];

for (const url of targets) {
  ws.send(JSON.stringify({
    id: Math.random(),
    command: 'navigate',
    url: url
  }));
  
  setTimeout(() => {
    ws.send(JSON.stringify({
      id: Math.random(),
      command: 'detect_technologies'
    }));
  }, 3000);
}

// Export all results to Shodan
```

### Workflow 3: Legal Investigation

```javascript
// Step-by-step forensic investigation

// 1. Setup
init_evidence_chain();
const inv = create_investigation({
  name: 'Legal Case XYZ',
  investigator: 'Attorney Smith'
});

// 2. Navigate to evidence source
navigate('https://slanderous-site.com');

// 3. Capture evidence
collect_screenshot_chain(inv);
execute_script('extract all text');
collect_evidence_chain('network');

// 4. Generate report and export
export_forensic_evidence(inv);

// 5. Review admissibility checklist
// ✓ Chain of custody
// ✓ Timestamps
// ✓ Investigator documented
// ✓ Digital signature
// ✓ No modifications
```

---

## Troubleshooting

### "Command failed" Error

**Problem:** Command returns error
**Solution:** Check timing - wait for page load before running commands

```javascript
// ❌ Wrong - runs too fast
navigate('https://example.com');
detect_technologies();  // Page not loaded yet

// ✅ Correct - wait for page load
navigate('https://example.com');
setTimeout(() => {
  detect_technologies();  // Now page is loaded
}, 3000);
```

### Technology Detection Returns Empty

**Problem:** No technologies detected
**Solution:** Ensure page fully loaded, try different confidence threshold

```javascript
// ✅ Better approach
detect_technologies({
  includeVersions: true,
  confidence_threshold: 50  // Lower threshold to catch more
});
```

### Forensic Export Fails

**Problem:** Export command fails
**Solution:** Ensure investigation was created and evidence collected

```javascript
// ✅ Correct order
create_investigation();          // First create
collect_evidence_chain(...);    // Then collect
export_forensic_evidence(...);  // Then export
```

### Script Execution Timeout

**Problem:** execute_script times out
**Solution:** Increase timeout or simplify script

```javascript
// ✅ With longer timeout
execute_script({
  script: complexLogic,
  timeout: 10000  // 10 seconds
});
```

---

## Next Steps

1. **Try all 4 features** - Follow the 5-minute guides above
2. **Read complete guides** - See V12.1.0-FEATURES-INDEX for deep dives
3. **Check QA reports** - See V12.1.0-QA-INDEX for feature status
4. **Deploy to production** - See deployment guide

---

## Related Documentation

- [Full Features Index](../reference/V12.1.0-FEATURES-INDEX-2026-05-31.md) - Complete guides
- [API Reference](API-REFERENCE.md) - All commands
- [Sprint Plan](../planning/V12.1.0-SPRINT-PLAN-2026-05-31.md) - Development timeline
- [QA Reports](V12.1.0-QA-INDEX-2026-05-31.md) - Test results
- [Deployment Plan](../archives/prune-2026-07-06/deployment/V12.1.0-DEPLOYMENT-PLAN.md) - How to deploy

---

**Document Version:** 1.0  
**Last Updated:** May 31, 2026  
**Status:** Ready for v12.1.0 Release  
