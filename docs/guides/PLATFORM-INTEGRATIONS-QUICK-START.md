# Platform Integrations - Quick Start Guide

**Last Updated:** May 31, 2026  
**Version:** 1.0.0

## 5-Minute Setup

### 1. Shodan (2 minutes)

```javascript
// Get API key from https://account.shodan.io/
const ShodanExport = require('./src/export/platforms/shodan-export');
const shodan = new ShodanExport({ apiKey: 'YOUR_API_KEY' });

// Export findings
const result = await shodan.export(sessionData, {
  tags: ['osint'],
  saveQuery: true
});
```

### 2. Maltego (1 minute)

```javascript
// No API key needed for community edition
const MaltegoExport = require('./src/export/platforms/maltego-export');
const maltego = new MaltegoExport();

// Export as CSV for import
const result = await maltego.export(sessionData, { format: 'csv' });

// Then: File → Import → Spreadsheet in Maltego Desktop
```

### 3. MISP (3 minutes)

```javascript
// Get API key from MISP admin panel
const MISPExport = require('./src/export/platforms/misp-export');
const misp = new MISPExport({ apiKey: 'YOUR_API_KEY' });

// Create event with findings
const result = await misp.export(sessionData, {
  eventName: 'OSINT Investigation',
  threatLevel: 2
});
```

### 4. Censys (3 minutes)

```javascript
// Get API ID/Secret from https://censys.io/
const CensysExport = require('./src/export/platforms/censys-export');
const censys = new CensysExport({ 
  apiKey: 'API_ID',
  apiSecret: 'API_SECRET'
});

const result = await censys.export(sessionData);
```

### 5. STIX (1 minute)

```javascript
// No API key needed
const STIXExport = require('./src/export/platforms/stix-export');
const stix = new STIXExport();

// Generate STIX bundle for sharing
const result = await stix.export(sessionData);
```

## WebSocket API Quick Start

### Export to Platform

```javascript
{
  "action": "export_to_platform",
  "platform": "shodan",
  "data": {
    "url": "https://example.com",
    "domain": "example.com",
    "networkData": { "ip": "192.0.2.1" },
    "technologies": [
      { "name": "Apache", "confidence": 0.95 }
    ]
  }
}
```

### Setup Webhook

```javascript
{
  "action": "setup_webhook",
  "webhookId": "alert-slack",
  "webhookUrl": "https://hooks.slack.com/..."
}
```

## File Structure

```
src/export/
├── platform-integrations-framework.js    # Base class
├── webhook-manager.js                    # Webhook system
└── platforms/
    ├── shodan-export.js
    ├── maltego-export.js
    ├── misp-export.js
    ├── censys-export.js
    └── stix-export.js

tests/
├── unit/platform-integrations.test.js    # 35+ tests
└── integration/platform-exports-api.test.js # 8+ tests

docs/
├── PLATFORM-INTEGRATIONS-GUIDE-2026-05-31.md  # Full guide
└── PLATFORM-INTEGRATIONS-QUICK-START.md       # This file
```

## Key Features

✅ **5 Platforms:** Shodan, Maltego, MISP, Censys, STIX  
✅ **Multiple Formats:** JSON, CSV, STIX bundles  
✅ **Webhooks:** Real-time export notifications  
✅ **Retry Logic:** Automatic retry with exponential backoff  
✅ **Health Checks:** Monitor webhook connectivity  
✅ **Zero Data Loss:** 100% data integrity  

## Testing

```bash
# Run unit tests
npm test tests/unit/platform-integrations.test.js

# Run integration tests
npm test tests/integration/platform-exports-api.test.js
```

## Common Tasks

### Export to Multiple Platforms

```javascript
const results = await Promise.all([
  shodan.export(data),
  maltego.export(data),
  misp.export(data),
  stix.export(data)
]);
```

### Monitor Webhook Health

```javascript
const health = webhookManager.getWebhookHealth('webhook-id');
console.log(health.status); // "healthy", "failing", "disabled"
```

### Track Export History

```javascript
const exports = await exporter.listExports();
console.log(exports.exports.length); // Number of exports
```

## Next Steps

1. Read **PLATFORM-INTEGRATIONS-GUIDE-2026-05-31.md** for details
2. Setup platform API keys (2-3 min each)
3. Test exports with sample data
4. Configure webhooks for notifications
5. Integrate with your workflow

---

**Questions?** See troubleshooting section in full guide.
