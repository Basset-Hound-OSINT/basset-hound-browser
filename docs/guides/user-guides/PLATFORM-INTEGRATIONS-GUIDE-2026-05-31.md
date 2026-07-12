# Platform Integrations Guide
## Basset Hound Browser v12.1.0

**Document Date:** May 31, 2026  
**Version:** 1.0.0  
**Status:** Complete  
**Audience:** OSINT Investigators, Security Teams, System Administrators

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Platforms](#supported-platforms)
3. [Architecture](#architecture)
4. [Setup Guides](#setup-guides)
5. [WebSocket API Reference](#websocket-api-reference)
6. [Examples](#examples)
7. [Webhook System](#webhook-system)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Platform Integrations enable seamless export of OSINT findings to industry-standard threat intelligence platforms. Export findings to Shodan, Maltego, MISP, Censys, and STIX/TAXII for integration with your existing workflows.

### Key Features

- **5 Platform Exports:** Shodan, Maltego, MISP, Censys, STIX
- **Multiple Formats:** JSON, CSV, XML-based formats per platform
- **Webhook Notifications:** Real-time alerts on export completion
- **Zero Data Loss:** 100% data integrity in round-trip exports
- **<5 Minute Setup:** Minimal configuration per platform
- **Secure Credentials:** Encrypted API key storage

### Use Cases

1. **OSINT Investigations:** Export findings to Maltego for relationship mapping
2. **Incident Response:** Send indicators to MISP for rapid response coordination
3. **Threat Intelligence:** Correlate findings with Shodan/Censys data
4. **Compliance Reporting:** Generate standardized STIX/TAXII exports for stakeholders
5. **Automation:** Real-time webhook integration with security platforms

---

## Supported Platforms

### 1. Shodan
**Purpose:** Network intelligence and vulnerability research  
**Export Format:** JSON with IP/service/technology data  
**Use Case:** Find similar hosts, track infrastructure changes

**Key Data Exported:**
- IP addresses and ports
- Services and versions
- Technologies detected
- HTTP headers and banners
- Search queries for Shodan

### 2. Maltego
**Purpose:** Entity relationship mapping and OSINT investigation  
**Export Format:** CSV (standard import format) or STIX  
**Use Case:** Build relationship graphs, identify connected entities

**Key Data Exported:**
- URLs and domains
- IP addresses
- Email addresses
- Phone numbers
- Technologies and metadata
- Entity relationships

### 3. MISP
**Purpose:** Incident Response and threat sharing  
**Export Format:** MISP event format (JSON)  
**Use Case:** Share threats within organization, collaborate with partners

**Key Data Exported:**
- URLs, domains, IPs as IOCs
- Email addresses
- Hash values (if available)
- User agents and headers
- Events with threat classifications

### 4. Censys
**Purpose:** Certificate and IP address research  
**Export Format:** JSON or CSV with host/certificate/DNS data  
**Use Case:** Correlate certificate data, track certificate changes

**Key Data Exported:**
- IP records with services
- Domain records with DNS
- Certificate information
- HTTP headers
- Geolocation and ASN data

### 5. STIX/TAXII
**Purpose:** Standardized threat information sharing  
**Export Format:** STIX 2.1 bundles (JSON)  
**Use Case:** Share with ISACs, vendor integrations, compliance reporting

**Key Data Exported:**
- Indicators (URLs, domains, IPs, emails)
- Observables (observed-data objects)
- Relationships between objects
- Metadata and external references

---

## Architecture

### Component Structure

```
src/export/
├── platform-integrations-framework.js    # Base class for all platforms
├── webhook-manager.js                    # Webhook handling
└── platforms/
    ├── shodan-export.js                 # Shodan integration
    ├── maltego-export.js                # Maltego integration
    ├── misp-export.js                   # MISP integration
    ├── censys-export.js                 # Censys integration
    └── stix-export.js                   # STIX/TAXII integration
```

### Data Flow

```
Session Data
    ↓
Platform Exporter (Authentication)
    ↓
Format Conversion (JSON/CSV/STIX)
    ↓
Export Tracking
    ↓
Webhook Notification (if configured)
    ↓
Platform API (optional)
```

### Class Hierarchy

```
PlatformIntegration (Base Class)
├── ShodanExport
├── MaltegoExport
├── MISPExport
├── CensysExport
└── STIXExport

WebhookManager (Standalone)
```

---

## Setup Guides

### Shodan Setup

1. **Get API Key:**
   - Visit https://account.shodan.io/
   - API key is available on account page
   - Free account: 1 credit/month
   - Paid account: Unlimited credits

2. **Configure in Basset:**
   ```javascript
   const shodan = new ShodanExport({
     apiKey: 'YOUR_API_KEY',
     apiUrl: 'https://api.shodan.io'
   });
   
   await shodan.authenticate('YOUR_API_KEY');
   ```

3. **Export:**
   ```javascript
   const result = await shodan.export(sessionData, {
     tags: ['osint', 'investigation'],
     confidence: 1.0,
     saveQuery: true
   });
   ```

**Time to Setup:** 2-3 minutes

### Maltego Setup

1. **Get API Key (Optional):**
   - Community edition: No API key needed
   - Professional edition: API key from https://www.maltego.com/

2. **Configure in Basset:**
   ```javascript
   const maltego = new MaltegoExport({
     apiUrl: 'https://maltego.example.com/api' // Optional
   });
   ```

3. **Export (CSV format for import):**
   ```javascript
   const result = await maltego.export(sessionData, {
     format: 'csv', // or 'stix'
     includeRelationships: true
   });
   
   // Import CSV into Maltego Desktop
   // File → Import → Spreadsheet
   ```

**Time to Setup:** 1-2 minutes

### MISP Setup

1. **Get API Key:**
   - Login to MISP instance
   - Administration → My Profile
   - Copy API key
   - Test endpoint: `https://your-misp.example.com/api/version`

2. **Configure in Basset:**
   ```javascript
   const misp = new MISPExport({
     apiKey: 'YOUR_API_KEY',
     apiUrl: 'https://your-misp.example.com/api'
   });
   
   await misp.authenticate('YOUR_API_KEY');
   ```

3. **Export:**
   ```javascript
   const result = await misp.export(sessionData, {
     eventName: 'OSINT Investigation - example.com',
     threatLevel: 2, // 1-4
     analysis: 1,    // 0-2
     distribution: 0, // 0-3
     tags: ['osint', 'investigation']
   });
   ```

**Time to Setup:** 3-4 minutes

### Censys Setup

1. **Get API Key:**
   - Visit https://censys.io/
   - Create account
   - Get API ID and Secret from account settings
   - Free tier: 120 queries/day

2. **Configure in Basset:**
   ```javascript
   const censys = new CensysExport({
     apiKey: 'YOUR_API_ID',
     apiSecret: 'YOUR_API_SECRET',
     apiUrl: 'https://api.censys.io/v1'
   });
   
   await censys.authenticate('YOUR_API_ID', 'YOUR_API_SECRET');
   ```

3. **Export:**
   ```javascript
   const result = await censys.export(sessionData, {
     format: 'json' // or 'csv'
   });
   ```

**Time to Setup:** 3-4 minutes

### STIX/TAXII Setup

1. **No API Key Required:**
   - STIX export is self-contained
   - TAXII upload requires TAXII server

2. **Configure in Basset:**
   ```javascript
   const stix = new STIXExport({
     stixVersion: '2.1'
   });
   ```

3. **Export:**
   ```javascript
   const result = await stix.export(sessionData, {
     bundleId: 'bundle--' + uuid(),
     externalReferences: [
       {
         source_name: 'investigation-record',
         external_id: 'INV-2026-001'
       }
     ]
   });
   ```

**Time to Setup:** 1 minute

---

## WebSocket API Reference

### Command: `export_to_platform`

Export findings to a specific platform.

**Request:**
```javascript
{
  "action": "export_to_platform",
  "platform": "shodan",  // "shodan" | "maltego" | "misp" | "censys" | "stix"
  "data": {
    "url": "https://example.com",
    "domain": "example.com",
    "networkData": {
      "ip": "192.0.2.1",
      "port": 443,
      "hostname": "example.com"
    },
    "technologies": [
      {
        "name": "Apache",
        "category": "Server",
        "version": "2.4.41",
        "confidence": 0.95
      }
    ],
    "emails": ["admin@example.com"],
    "metadata": {
      "author": "John Doe"
    }
  },
  "options": {
    // Platform-specific options (see below)
  }
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "platform": "shodan",
  "format": "json",
  "data": {
    // Platform-specific data
  },
  "itemCount": 15,
  "timestamp": "2026-05-31T10:30:00.000Z"
}
```

**Response (Error):**
```javascript
{
  "success": false,
  "platform": "shodan",
  "error": "Shodan API key required. Authenticate first.",
  "timestamp": "2026-05-31T10:30:00.000Z"
}
```

### Platform-Specific Options

**Shodan:**
```javascript
{
  "tags": ["osint", "investigation"],       // Custom tags
  "confidence": 1.0,                         // 0.0-1.0
  "saveQuery": true                         // Save as Shodan search
}
```

**Maltego:**
```javascript
{
  "format": "csv",                          // "csv" | "stix"
  "includeRelationships": true              // Include entity relationships
}
```

**MISP:**
```javascript
{
  "eventName": "Investigation",             // Event title
  "threatLevel": 2,                         // 1-4 (red-green)
  "analysis": 1,                            // 0-2 (not/ongoing/complete)
  "distribution": 0,                        // 0-3 (scope)
  "tags": ["osint"]                        // Event tags
}
```

**Censys:**
```javascript
{
  "format": "json",                         // "json" | "csv"
  "confidence": 0.95                        // 0.0-1.0
}
```

**STIX:**
```javascript
{
  "bundleId": "bundle--uuid",               // Custom bundle ID
  "campaignName": "Operation X",            // Campaign name
  "externalReferences": [                   // References
    {
      "source_name": "investigation",
      "url": "https://internal.example.com/inv/123"
    }
  ]
}
```

### Command: `setup_webhook`

Register a webhook for export notifications.

**Request:**
```javascript
{
  "action": "setup_webhook",
  "webhookId": "shodan-webhook-1",
  "webhookUrl": "https://webhook.example.com/exports",
  "config": {
    "enabled": true,
    "maxRetries": 3,
    "retryDelay": 1000
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "webhookId": "shodan-webhook-1",
  "message": "Webhook registered successfully",
  "timestamp": "2026-05-31T10:30:00.000Z"
}
```

### Command: `list_webhooks`

List all registered webhooks.

**Request:**
```javascript
{
  "action": "list_webhooks"
}
```

**Response:**
```javascript
{
  "total": 2,
  "webhooks": [
    {
      "webhookId": "shodan-webhook-1",
      "url": "https://webhook.example.com/exports",
      "enabled": true,
      "createdAt": "2026-05-31T09:00:00.000Z",
      "lastSuccess": "2026-05-31T10:15:00.000Z",
      "lastError": null,
      "eventCount": 5
    }
  ]
}
```

### Command: `test_webhook`

Test webhook connectivity.

**Request:**
```javascript
{
  "action": "test_webhook",
  "webhookId": "shodan-webhook-1"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "webhookId": "shodan-webhook-1",
  "statusCode": 200,
  "message": "Webhook test successful"
}
```

### Webhook Payload Format

When a webhook is triggered:

```javascript
{
  "webhookId": "shodan-webhook-1",
  "eventType": "export.shodan",
  "timestamp": "2026-05-31T10:30:00.000Z",
  "data": {
    "platform": "shodan",
    "itemCount": 15,
    "format": "json"
  }
}
```

---

## Examples

### Example 1: Export to Maltego for Relationship Mapping

```javascript
// Setup
const maltego = new MaltegoExport();

// Session data from OSINT scan
const sessionData = {
  url: 'https://shop.example.com',
  domain: 'shop.example.com',
  networkData: {
    ip: '192.0.2.15',
    port: 443,
    hostname: 'shop.example.com'
  },
  technologies: [
    { name: 'Shopify', category: 'CMS', version: 'Plus', confidence: 0.99 },
    { name: 'Cloudflare', category: 'CDN', version: 'Free', confidence: 0.95 }
  ],
  emails: ['sales@example.com', 'support@example.com'],
  phones: ['+1-555-0123'],
  metadata: { author: 'Acme Inc' }
};

// Export as CSV
const result = await maltego.export(sessionData, { format: 'csv' });

// Save to file
await fs.writeFile('findings.csv', result.data.content);

// Import in Maltego Desktop:
// File → Import → Spreadsheet → Select 'findings.csv'
```

**Output Entities:** URL, Domain, IP, Emails, Phone, Technologies  
**Relationships:** Automatic linking via entity type

### Example 2: Export to MISP for Incident Response

```javascript
// Setup
const misp = new MISPExport({ apiKey: 'YOUR_KEY' });
await misp.authenticate('YOUR_KEY');

// Create MISP event from findings
const sessionData = {
  url: 'https://malware.example.net',
  domain: 'malware.example.net',
  networkData: {
    ip: '198.51.100.50',
    port: 443
  }
};

// Export with threat classification
const result = await misp.export(sessionData, {
  eventName: 'Malware C2 Discovery',
  threatLevel: 1, // High
  analysis: 0,    // Initial
  distribution: 1, // Internal
  tags: ['malware', 'c2', 'basset-hound']
});

// MISP now has event with URL/IP/Domain as IOCs
// Can be shared with partners or embedded in response procedures
```

**Use Case:** Rapid threat coordination, automated blocking rules

### Example 3: Webhook Integration with External System

```javascript
// Setup webhook for real-time notifications
const request = {
  "action": "setup_webhook",
  "webhookId": "slack-integration",
  "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
};

// When export completes, webhook payload sent to Slack:
// {
//   "webhookId": "slack-integration",
//   "eventType": "export.completed",
//   "data": {
//     "platform": "shodan",
//     "itemCount": 12
//   }
// }

// Slack webhook receiver transforms to Slack message:
// "Basset Hound exported 12 items to Shodan"
```

**Use Case:** Alert security team on export completion

### Example 4: Multi-Platform Export Workflow

```javascript
const sessionData = { /* OSINT findings */ };

// Export to multiple platforms simultaneously
const exports = await Promise.all([
  shodan.export(sessionData, { tags: ['osint'] }),
  maltego.export(sessionData, { format: 'csv' }),
  misp.export(sessionData, { eventName: 'Investigation' }),
  stix.export(sessionData)
]);

// All platforms updated with findings
// Maltego: Spreadsheet ready for import
// MISP: Event created with IOCs
// Shodan: Query saved for future searches
// STIX: Bundle ready for TAXII upload
```

**Use Case:** Comprehensive OSINT platform integration

---

## Webhook System

### Webhook Features

- **Real-time Notifications:** Instant alerts on export completion
- **Retry Logic:** Automatic retries with exponential backoff
- **Health Monitoring:** Track webhook status and success/failure rates
- **Selective Delivery:** Disable/enable webhooks without removal

### Webhook Lifecycle

```
1. Register webhook
   ↓
2. Export to platform
   ↓
3. Export completes
   ↓
4. Webhook notification triggered
   ↓
5. POST to webhook URL (with retries)
   ↓
6. Webhook logs success/failure
```

### Webhook Configuration

```javascript
{
  "enabled": true,          // Enable/disable without removal
  "maxRetries": 3,          // Retry count on failure
  "retryDelay": 1000,       // Initial retry delay (ms), exponential
  "timeout": 5000           // Request timeout (ms)
}
```

### Webhook Health Checks

```javascript
// Get webhook health
const health = webhookManager.getWebhookHealth('webhook-id');

// Returns:
{
  "webhookId": "webhook-id",
  "url": "https://webhook.example.com/events",
  "enabled": true,
  "status": "healthy",      // "healthy" | "failing" | "disabled"
  "lastSuccess": "2026-05-31T10:15:00.000Z",
  "lastError": null,
  "eventCount": 24
}
```

### Testing Webhooks

```javascript
// Send test event to webhook
const result = await webhookManager.testWebhook('webhook-id');

// Result indicates connectivity
{
  "success": true,
  "webhookId": "webhook-id",
  "statusCode": 200
}
```

---

## Troubleshooting

### Issue: "API key required" Error

**Cause:** Platform authentication not configured  
**Solution:**
```javascript
const exporter = new ShodanExport();
await exporter.authenticate('YOUR_API_KEY');
```

### Issue: Export Data Missing Fields

**Cause:** Session data incomplete  
**Solution:** Ensure session data includes required fields:
```javascript
const completeData = {
  url: sessionData.url,
  domain: sessionData.domain,
  networkData: sessionData.networkData,
  technologies: sessionData.technologies || [],
  emails: sessionData.emails || [],
  metadata: sessionData.metadata || {}
};
```

### Issue: Webhook Not Receiving Events

**Cause:** Webhook URL unreachable or misconfigured  
**Solution:**
```javascript
// Test webhook
const result = await webhookManager.testWebhook('webhook-id');

// Check health
const health = webhookManager.getWebhookHealth('webhook-id');
if (!health.success) {
  // Webhook not found
  webhookManager.registerWebhook('webhook-id', webhookUrl);
}
```

### Issue: Maltego CSV Import Fails

**Cause:** CSV format incompatible  
**Solution:**
1. Ensure CSV is properly quoted
2. Use UTF-8 encoding
3. Verify headers match: Type,Value,Description,Confidence,Tags

### Issue: MISP Event Not Appearing

**Cause:** Authentication failed or API version mismatch  
**Solution:**
```javascript
// Verify MISP connection
const testUrl = 'https://your-misp.example.com/api/version';
// Should return MISP version

// Use correct event options
{
  "eventName": "...",
  "threatLevel": 2,    // 1-4
  "analysis": 1,       // 0-2
  "distribution": 0    // 0-3
}
```

### Issue: Platform Export Quota Exceeded

**Cause:** API rate limits exceeded  
**Solution:**
- Check platform rate limits
- Shodan: 1 credit/request (check balance)
- Censys: 120 queries/day (free tier)
- MISP: Check server limits
- Retry with exponential backoff

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Webhook URL invalid" | URL format incorrect | Verify https:// prefix |
| "Platform not found" | Typo in platform name | Use: shodan, maltego, misp, censys, stix |
| "Authentication failed" | Wrong API key | Verify key in account settings |
| "Timeout exceeded" | Network or server slow | Increase timeout, retry |
| "Max retries exceeded" | Webhook unreachable | Check endpoint availability |

---

## Performance Considerations

### Export Speed
- **Shodan:** 100-500ms
- **Maltego:** 50-200ms
- **MISP:** 200-1000ms (depends on server)
- **Censys:** 50-300ms
- **STIX:** 100-400ms

### Data Size
- **Shodan:** 2-5 KB per export
- **Maltego:** 1-3 KB per entity
- **MISP:** 2-10 KB per event
- **Censys:** 1-4 KB per record
- **STIX:** 3-15 KB per bundle

### Concurrent Exports
- Supported: 10+ simultaneous exports
- Recommended: <100 concurrent for stability
- Webhook delivery: Asynchronous (non-blocking)

---

## Security Best Practices

1. **Store API Keys Securely:**
   - Use environment variables
   - Never commit to version control
   - Rotate periodically

2. **Webhook Security:**
   - Use HTTPS endpoints only
   - Validate webhook payloads
   - Implement request signing (if platform supports)

3. **Data Privacy:**
   - Review what data is exported
   - Ensure compliance with data protection
   - Use `sanitizeData()` for sensitive info

4. **Access Control:**
   - Limit who can setup webhooks
   - Log all exports
   - Monitor for unusual activity

---

## Related Documentation

- [API Reference](/docs/API-REFERENCE.md)
- [Webhook Configuration](../../features/WEBHOOKS.md)
- OSINT Workflows
- [Export Formats](EXPORT-FORMATS-GUIDE.md)

---

**Document Version:** 1.0.0  
**Last Updated:** May 31, 2026  
**Next Review:** June 30, 2026
