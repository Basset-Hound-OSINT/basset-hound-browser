# Forensic Exports - Usage Examples & Code Patterns

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Language Examples:** JavaScript, Python, cURL  
**Status:** Production Ready

---

## Table of Contents

1. [Basic Examples](#basic-examples)
2. [JavaScript Examples](#javascript-examples)
3. [Python Examples](#python-examples)
4. [Advanced Workflows](#advanced-workflows)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Integration Examples](#integration-examples)

---

## Basic Examples

### Example 1: Connect and Capture Full Page

**Scenario:** Navigate to a website and capture everything (HTML, network, device info)

**JavaScript:**
```javascript
const WebSocket = require('ws');

async function captureFullPage(url) {
  const ws = new WebSocket('ws://localhost:8765');
  
  return new Promise((resolve, reject) => {
    ws.onopen = async () => {
      try {
        // Navigate to page
        await send(ws, {
          command: 'navigate',
          url: url,
          id: 'nav_1'
        });
        
        // Wait for page load
        await new Promise(r => setTimeout(r, 3000));
        
        // Capture HTML
        const htmlData = await send(ws, {
          command: 'export_raw_html',
          includeMetadata: true,
          id: 'html_1'
        });
        
        // Capture network
        const networkData = await send(ws, {
          command: 'export_network_log',
          id: 'net_1'
        });
        
        // Capture device
        const deviceData = await send(ws, {
          command: 'export_device_ids',
          id: 'device_1'
        });
        
        // Combine results
        const result = {
          url: url,
          timestamp: Date.now(),
          html: htmlData.data,
          network: networkData.data,
          device: deviceData.data
        };
        
        ws.close();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    ws.onerror = reject;
  });
}

// Helper to send command and wait for response
function send(ws, command) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      handler = null;
      reject(new Error(`Command timeout: ${command.command}`));
    }, 10000);
    
    let handler;
    handler = (event) => {
      const response = JSON.parse(event.data);
      if (response.id === command.id) {
        clearTimeout(timeout);
        ws.removeEventListener('message', handler);
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
      }
    };
    
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify(command));
  });
}

// Usage
captureFullPage('https://example.com')
  .then(result => {
    console.log('Capture complete!');
    console.log(`  HTML size: ${result.html.htmlLength} bytes`);
    console.log(`  Network requests: ${result.network.totalRequests}`);
    console.log(`  Device: ${result.device.deviceIdentifiers.userAgent.substring(0, 50)}...`);
  })
  .catch(error => console.error('Capture failed:', error));
```

---

## JavaScript Examples

### Example 2: Extract and Filter Network Requests

**Scenario:** Find all slow API requests (>500ms) and failed requests

```javascript
async function analyzeNetwork() {
  // Get slow requests
  const slowRequests = await send(ws, {
    command: 'export_network_log',
    minDuration: 500,
    resourceType: 'xhr',
    id: 'slow_1'
  });
  
  console.log(`Found ${slowRequests.data.filteredRequests} slow XHR requests:`);
  slowRequests.data.requests.forEach(req => {
    console.log(`  ${req.method} ${req.url}`);
    console.log(`    Duration: ${req.duration}ms`);
    console.log(`    Status: ${req.statusCode}`);
  });
  
  // Get error requests (4xx, 5xx)
  const errorRequests = await send(ws, {
    command: 'export_network_log',
    statusCode: '4[0-9]{2}|5[0-9]{2}',
    id: 'errors_1'
  });
  
  if (errorRequests.data.filteredRequests > 0) {
    console.log(`\nFound ${errorRequests.data.filteredRequests} error requests:`);
    errorRequests.data.requests.forEach(req => {
      console.log(`  ${req.statusCode} ${req.url}`);
    });
  }
  
  // Get statistics
  const allRequests = await send(ws, {
    command: 'export_network_log',
    id: 'all_1'
  });
  
  console.log(`\nNetwork Statistics:`);
  console.log(`  Total requests: ${allRequests.data.totalRequests}`);
  console.log(`  Total size: ${(allRequests.data.statistics.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total time: ${allRequests.data.statistics.totalDuration}ms`);
  
  // By resource type
  console.log(`\nBreakdown by type:`);
  for (const [type, stats] of Object.entries(allRequests.data.statistics.byResourceType)) {
    if (stats.count > 0) {
      const size = (stats.totalSize / 1024).toFixed(1);
      console.log(`  ${type}: ${stats.count} requests, ${size} KB, ${stats.totalDuration}ms`);
    }
  }
}
```

**Output:**
```
Found 2 slow XHR requests:
  GET https://api.example.com/data
    Duration: 1200ms
    Status: 200
  POST https://api.example.com/analytics
    Duration: 850ms
    Status: 201

Found 1 error requests:
  404 https://cdn.example.com/missing.js

Network Statistics:
  Total requests: 47
  Total size: 2.34 MB
  Total time: 3245ms

Breakdown by type:
  document: 1 requests, 14.6 KB, 450ms
  stylesheet: 3 requests, 24.4 KB, 120ms
  script: 12 requests, 244.1 KB, 1200ms
  xhr: 5 requests, 48.8 KB, 800ms
```

### Example 3: Verify Evasion Fingerprints

**Scenario:** Check if device fingerprinting is correctly spoofed

```javascript
async function verifyEvasionProfile() {
  const deviceData = await send(ws, {
    command: 'export_device_ids',
    includeFingerprints: true,
    includeProxy: true,
    id: 'device_check_1'
  });
  
  const device = deviceData.data;
  const checks = {
    passed: [],
    failed: []
  };
  
  // Check 1: Webdriver detection
  if (device.deviceIdentifiers.webdriver === false) {
    checks.passed.push('✓ Webdriver detection bypassed');
  } else {
    checks.failed.push('✗ Webdriver detection failed - navigator.webdriver is true');
  }
  
  // Check 2: Canvas fingerprint confidence
  if (device.fingerprint.canvas && device.fingerprint.canvas.confidence > 0.9) {
    checks.passed.push(`✓ Canvas fingerprint valid (${(device.fingerprint.canvas.confidence * 100).toFixed(0)}% confidence)`);
  } else {
    checks.failed.push('✗ Canvas fingerprint low confidence');
  }
  
  // Check 3: WebGL fingerprint
  if (device.fingerprint.webgl && device.fingerprint.webgl.renderer.includes('ANGLE')) {
    checks.passed.push(`✓ WebGL spoofed: ${device.fingerprint.webgl.renderer}`);
  } else {
    checks.failed.push('✗ WebGL fingerprint not properly spoofed');
  }
  
  // Check 4: WebRTC IP leak
  if (device.fingerprint.webrtc && device.fingerprint.webrtc.ipv4) {
    if (device.proxyInfo.enabled && device.proxyInfo.currentProxy) {
      checks.passed.push('✓ Proxy enabled (IP leak mitigated)');
    } else {
      checks.failed.push(`⚠ WebRTC IP detected: ${device.fingerprint.webrtc.ipv4} (no proxy)`);
    }
  }
  
  // Check 5: Timezone consistency
  if (device.deviceIdentifiers.timezone) {
    const tz = device.deviceIdentifiers.timezone;
    checks.passed.push(`✓ Timezone set: UTC${tz > 0 ? '+' : ''}${tz / 60}`);
  }
  
  // Check 6: User-Agent looks realistic
  if (device.deviceIdentifiers.userAgent.includes('Chrome') || 
      device.deviceIdentifiers.userAgent.includes('Firefox') ||
      device.deviceIdentifiers.userAgent.includes('Safari')) {
    checks.passed.push('✓ User-Agent looks realistic');
  } else {
    checks.failed.push('✗ User-Agent looks suspicious');
  }
  
  // Check 7: Memory and cores reasonable
  if (device.deviceIdentifiers.deviceMemory >= 4 && device.deviceIdentifiers.hardwareConcurrency >= 2) {
    checks.passed.push(`✓ Hardware specs reasonable (${device.deviceIdentifiers.deviceMemory}GB RAM, ${device.deviceIdentifiers.hardwareConcurrency} cores)`);
  } else {
    checks.failed.push('✗ Hardware specs look unrealistic');
  }
  
  // Print results
  console.log('=== Evasion Verification Results ===\n');
  
  if (checks.passed.length > 0) {
    console.log('PASSED:');
    checks.passed.forEach(check => console.log(`  ${check}`));
  }
  
  if (checks.failed.length > 0) {
    console.log('\nFAILED:');
    checks.failed.forEach(check => console.log(`  ${check}`));
  }
  
  const score = (checks.passed.length / (checks.passed.length + checks.failed.length) * 100).toFixed(0);
  console.log(`\nEvasion Score: ${score}% (${checks.passed.length}/${checks.passed.length + checks.failed.length} checks passed)`);
  
  return {
    passed: checks.passed.length,
    failed: checks.failed.length,
    score: parseInt(score)
  };
}
```

**Output:**
```
=== Evasion Verification Results ===

PASSED:
  ✓ Webdriver detection bypassed
  ✓ Canvas fingerprint valid (98% confidence)
  ✓ WebGL spoofed: ANGLE (Intel HD Graphics 630)
  ✓ Proxy enabled (IP leak mitigated)
  ✓ Timezone set: UTC-5
  ✓ User-Agent looks realistic
  ✓ Hardware specs reasonable (8GB RAM, 8 cores)

Evasion Score: 100% (7/7 checks passed)
```

### Example 4: Modify Elements for Testing

**Scenario:** Test form submission by modifying form fields

```javascript
async function testFormSubmission() {
  const form = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    terms: true
  };
  
  console.log('Testing form submission...\n');
  
  // Fill email field
  const emailResult = await send(ws, {
    command: 'fill',
    selector: 'input[name="email"]',
    value: form.email,
    id: 'fill_email'
  });
  
  if (emailResult.success) {
    console.log(`✓ Filled email field: ${form.email}`);
  } else {
    console.log(`✗ Failed to fill email: ${emailResult.error}`);
  }
  
  // Fill password field
  const passwordResult = await send(ws, {
    command: 'fill',
    selector: 'input[name="password"]',
    value: form.password,
    id: 'fill_password'
  });
  
  if (passwordResult.success) {
    console.log(`✓ Filled password field`);
  }
  
  // Check terms checkbox
  const checkResult = await send(ws, {
    command: 'click',
    selector: 'input[name="terms"]',
    id: 'click_terms'
  });
  
  if (checkResult.success) {
    console.log(`✓ Checked terms checkbox`);
  }
  
  // Mark submit button as test-ready
  const markResult = await send(ws, {
    command: 'modify_element',
    selector: 'button[type="submit"]',
    type: 'class',
    classOperation: 'add',
    className: 'test-ready',
    id: 'mark_submit'
  });
  
  if (markResult.success) {
    console.log(`✓ Marked submit button as test-ready`);
    console.log(`  Matched: ${markResult.data.matched}, Modified: ${markResult.data.modified}`);
  }
  
  // Hide error messages
  const hideResult = await send(ws, {
    command: 'modify_element',
    selector: '.error-message',
    type: 'css',
    cssProperties: {
      'display': 'none',
      'visibility': 'hidden'
    },
    allMatches: true,
    id: 'hide_errors'
  });
  
  if (hideResult.success && hideResult.data.modified > 0) {
    console.log(`✓ Hidden ${hideResult.data.modified} error message(s)`);
  }
  
  // Submit form
  const submitResult = await send(ws, {
    command: 'click',
    selector: 'button[type="submit"]',
    id: 'click_submit'
  });
  
  if (submitResult.success) {
    console.log(`✓ Clicked submit button`);
    console.log('\nForm submission test complete!');
  }
}
```

---

## Python Examples

### Example 5: Python SDK - Basic Usage

**Scenario:** Use Python SDK for browser automation with session persistence

```python
import asyncio
from basset_hound import BrowserClient

async def main():
    # Connect to browser
    async with BrowserClient('ws://localhost:8765') as client:
        
        # Navigate to website
        await client.navigate('https://example.com')
        print(f"Navigated to: {await client.get_url()}")
        
        # Create checkpoint before interaction
        checkpoint = await client.create_checkpoint('before-click')
        print(f"Checkpoint created: {checkpoint['id']}")
        
        # Export device info
        device_data = await client.export_device_ids()
        print(f"\nDevice Info:")
        print(f"  User Agent: {device_data['deviceIdentifiers']['userAgent'][:60]}...")
        print(f"  Platform: {device_data['deviceIdentifiers']['platform']}")
        print(f"  Hardware: {device_data['deviceIdentifiers']['hardwareConcurrency']} cores, {device_data['deviceIdentifiers']['deviceMemory']}GB")
        
        # Export network log
        network_data = await client.export_network_log()
        print(f"\nNetwork Statistics:")
        print(f"  Total requests: {network_data['totalRequests']}")
        print(f"  Total size: {network_data['statistics']['totalSize'] / 1024 / 1024:.2f} MB")
        print(f"  Total time: {network_data['statistics']['totalDuration']}ms")
        
        # Export HTML
        html_data = await client.export_raw_html(includeMetadata=True)
        print(f"\nPage Info:")
        print(f"  URL: {html_data['url']}")
        print(f"  Status: {html_data['statusCode']}")
        print(f"  Size: {html_data['htmlLength']} bytes")
        
        # Rollback to checkpoint
        await client.rollback_to_checkpoint(checkpoint['id'])
        print(f"\nRolled back to checkpoint: {checkpoint['id']}")

# Run
asyncio.run(main())
```

**Output:**
```
Navigated to: https://example.com
Checkpoint created: ckpt_abc123xyz

Device Info:
  User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/...
  Platform: Win32
  Hardware: 8 cores, 8GB

Network Statistics:
  Total requests: 47
  Total size: 2.34 MB
  Total time: 3245ms

Page Info:
  URL: https://example.com
  Status: 200
  Size: 15234 bytes

Rolled back to checkpoint: ckpt_abc123xyz
```

### Example 6: Python SDK - Batch Operations

**Scenario:** Execute multiple commands efficiently using batch operations

```python
import asyncio
from basset_hound import BrowserClient

async def batch_operations():
    async with BrowserClient('ws://localhost:8765') as client:
        # Navigate first
        await client.navigate('https://example.com')
        await asyncio.sleep(2)
        
        # Execute multiple commands in batch (more efficient)
        results = await client.batch_commands([
            {
                'command': 'export_raw_html',
                'params': {'includeMetadata': True},
                'id': 'html_1'
            },
            {
                'command': 'export_network_log',
                'params': {'minDuration': 100},
                'id': 'net_1'
            },
            {
                'command': 'export_device_ids',
                'params': {'includeFingerprints': True},
                'id': 'device_1'
            }
        ])
        
        # Process results
        for result in results:
            if result['success']:
                print(f"✓ {result['id']}: Success")
            else:
                print(f"✗ {result['id']}: {result['error']}")
        
        # Analyze combined results
        html = results[0]['data']
        network = results[1]['data']
        device = results[2]['data']
        
        print(f"\nPage: {html['url']}")
        print(f"HTML: {html['htmlLength']} bytes")
        print(f"Requests: {network['totalRequests']}")
        print(f"Device: {device['deviceIdentifiers']['userAgent'][:50]}...")

asyncio.run(batch_operations())
```

### Example 7: Python SDK - Error Handling

**Scenario:** Handle errors gracefully with recovery suggestions

```python
import asyncio
from basset_hound import (
    BrowserClient,
    BrowserClientError,
    CommandTimeoutError,
    ConnectionError as BHConnectionError
)

async def safe_forensic_capture():
    try:
        async with BrowserClient('ws://localhost:8765', timeout=10) as client:
            try:
                await client.navigate('https://example.com')
                await asyncio.sleep(3)
            except CommandTimeoutError:
                print("Navigation timed out - page might be slow to load")
                print("Retrying with longer timeout...")
                # Retry with longer timeout
                await client.navigate('https://example.com')
                await asyncio.sleep(5)
            
            try:
                # Try to export device data
                device_data = await client.export_device_ids()
                print("✓ Device data exported successfully")
            except BrowserClientError as e:
                if "No page loaded" in str(e):
                    print("Error: No page is currently loaded")
                    print("Fix: Call navigate() first")
                else:
                    print(f"Error: {e}")
            
            try:
                # Try to modify non-existent element
                result = await client.modify_element(
                    selector='.nonexistent-class',
                    type='text',
                    value='Test'
                )
            except BrowserClientError as e:
                if "matched 0 elements" in str(e):
                    print("\nError: Selector didn't match any elements")
                    print("Fix: Verify the CSS selector is correct")
                    
                    # Try getting page content to debug
                    content = await client.get_content()
                    print(f"Page has {len(content['html'])} bytes of HTML")
                    print("Review the HTML to find correct selector")
    
    except BHConnectionError as e:
        print(f"Connection failed: {e}")
        print("Make sure the browser server is running on port 8765")
        print("  Docker: docker run -p 8765:8765 basset-hound-browser")
        print("  Node.js: npm start")
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(safe_forensic_capture())
```

---

## Advanced Workflows

### Example 8: Multi-Site Forensic Analysis

**Scenario:** Analyze multiple websites for tracking and security

```javascript
const SITES = [
  'https://example.com',
  'https://example.org',
  'https://example.net'
];

const ANALYSIS = {
  results: [],
  stats: {
    totalRequests: 0,
    trackers: 0,
    slowRequests: 0,
    errorRequests: 0
  }
};

async function analyzeSites() {
  for (const site of SITES) {
    console.log(`\n=== Analyzing ${site} ===`);
    
    // Navigate
    await send(ws, {
      command: 'navigate',
      url: site,
      id: `nav_${site}`
    });
    
    await delay(3000);
    
    // Export network
    const networkData = await send(ws, {
      command: 'export_network_log',
      id: `net_${site}`
    });
    
    // Analyze
    const analysis = {
      url: site,
      totalRequests: networkData.data.totalRequests,
      trackers: detectTrackers(networkData.data.requests),
      slowRequests: networkData.data.requests.filter(r => r.duration > 1000).length,
      errorRequests: networkData.data.requests.filter(r => r.statusCode >= 400).length,
      totalSize: networkData.data.statistics.totalSize
    };
    
    ANALYSIS.results.push(analysis);
    ANALYSIS.stats.totalRequests += analysis.totalRequests;
    ANALYSIS.stats.trackers += analysis.trackers;
    ANALYSIS.stats.slowRequests += analysis.slowRequests;
    ANALYSIS.stats.errorRequests += analysis.errorRequests;
    
    // Print results
    console.log(`Requests: ${analysis.totalRequests}`);
    console.log(`Trackers: ${analysis.trackers}`);
    console.log(`Slow (>1s): ${analysis.slowRequests}`);
    console.log(`Errors: ${analysis.errorRequests}`);
    console.log(`Size: ${(analysis.totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
  
  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Sites analyzed: ${ANALYSIS.results.length}`);
  console.log(`Total requests: ${ANALYSIS.stats.totalRequests}`);
  console.log(`Total trackers: ${ANALYSIS.stats.trackers}`);
  console.log(`Total slow requests: ${ANALYSIS.stats.slowRequests}`);
  console.log(`Total errors: ${ANALYSIS.stats.errorRequests}`);
}

function detectTrackers(requests) {
  const trackerPatterns = [
    /google-analytics/i,
    /facebook\.com/i,
    /doubleclick\.net/i,
    /twitter\.com\/i/i,
    /segment\.com/i,
    /hotjar/i,
    /mixpanel/i,
    /intercom/i
  ];
  
  return requests.filter(req => {
    return trackerPatterns.some(pattern => pattern.test(req.url));
  }).length;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Example 9: Compliance Auditing Workflow

**Scenario:** Audit website compliance with data protection regulations

```javascript
async function complianceAudit(url) {
  console.log(`\nCompliance Audit for ${url}\n`);
  
  await send(ws, { command: 'navigate', url, id: 'nav_1' });
  await delay(3000);
  
  const audit = {
    url,
    timestamp: Date.now(),
    checks: {}
  };
  
  // Check 1: GDPR - Check for tracking requests
  const tracking = await send(ws, {
    command: 'export_network_log',
    id: 'tracking_1'
  });
  
  const trackedRequests = tracking.data.requests.filter(r => 
    /google|facebook|doubleclick|segment/i.test(r.url)
  );
  
  audit.checks.tracking = {
    found: trackedRequests.length > 0,
    count: trackedRequests.length,
    urls: trackedRequests.map(r => r.url)
  };
  
  // Check 2: HTTPS enforcement
  const protocol = tracking.data.requests.some(r => r.url.startsWith('http://'));
  audit.checks.httpsEnforced = !protocol;
  
  // Check 3: Capture HTML (check for privacy policy, cookie notice)
  const html = await send(ws, {
    command: 'export_raw_html',
    id: 'html_1'
  });
  
  audit.checks.privacyPolicy = /privacy.{0,50}policy/i.test(html.data.html);
  audit.checks.cookieNotice = /cookie.{0,50}consent|consent.{0,50}cookie/i.test(html.data.html);
  
  // Check 4: Device fingerprinting
  const device = await send(ws, {
    command: 'export_device_ids',
    id: 'device_1'
  });
  
  audit.checks.fingerprintingAttempted = 
    device.data.fingerprint.canvas ||
    device.data.fingerprint.webgl ||
    device.data.fingerprint.webrtc;
  
  // Check 5: Error tracking (Sentry, Rollbar, etc.)
  const errorTracking = tracking.data.requests.filter(r =>
    /sentry|rollbar|bugsnag|newrelic/i.test(r.url)
  );
  
  audit.checks.errorTracking = {
    found: errorTracking.length > 0,
    count: errorTracking.length
  };
  
  // Generate report
  console.log('COMPLIANCE CHECK RESULTS:\n');
  console.log(`✓ HTTPS Enforced: ${audit.checks.httpsEnforced ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Privacy Policy: ${audit.checks.privacyPolicy ? 'FOUND' : 'MISSING'}`);
  console.log(`✓ Cookie Notice: ${audit.checks.cookieNotice ? 'FOUND' : 'MISSING'}`);
  console.log(`✓ Tracking Found: ${audit.checks.tracking.count > 0 ? 'YES (' + audit.checks.tracking.count + ' requests)' : 'NONE'}`);
  console.log(`✓ Fingerprinting Attempted: ${audit.checks.fingerprintingAttempted ? 'YES' : 'NO'}`);
  console.log(`✓ Error Tracking: ${audit.checks.errorTracking.count > 0 ? 'YES (' + audit.checks.errorTracking.count + ' requests)' : 'NONE'}`);
  
  return audit;
}
```

---

## Error Handling Patterns

### Example 10: Retry Logic with Exponential Backoff

```javascript
async function sendWithRetry(ws, command, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await send(ws, command);
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`Attempt ${attempt} failed: ${error.message}`);
        console.log(`Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
      }
    }
  }
  
  throw new Error(`Command failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Usage
const result = await sendWithRetry(ws, {
  command: 'export_raw_html',
  id: 'html_1'
});
```

### Example 11: Connection Recovery

```javascript
async function withConnectionRecovery(fn) {
  let ws = null;
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      ws = new WebSocket('ws://localhost:8765');
      
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const result = await fn(ws);
      ws.close();
      return result;
    } catch (error) {
      retries++;
      console.log(`Connection attempt ${retries} failed: ${error.message}`);
      
      if (ws) {
        try { ws.close(); } catch (e) {}
      }
      
      if (retries < maxRetries) {
        await delay(2000 * retries);
      } else {
        throw new Error(`Failed to connect after ${maxRetries} attempts`);
      }
    }
  }
}

// Usage
withConnectionRecovery(async (ws) => {
  await send(ws, { command: 'navigate', url: 'https://example.com', id: 'nav_1' });
  return await send(ws, { command: 'export_raw_html', id: 'html_1' });
}).then(result => console.log('Success!'))
  .catch(error => console.error('Failed:', error));
```

---

## Integration Examples

### Example 12: Save Exports to Files

**JavaScript:**
```javascript
const fs = require('fs');

async function saveForensicData(url, outputDir = './forensics') {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const siteDir = `${outputDir}/${url.replace(/https?:\/\//, '').split('/')[0]}_${timestamp}`;
  fs.mkdirSync(siteDir, { recursive: true });
  
  // Navigate and export
  await send(ws, { command: 'navigate', url, id: 'nav_1' });
  await delay(3000);
  
  // Save HTML
  const htmlData = await send(ws, {
    command: 'export_raw_html',
    includeMetadata: true,
    id: 'html_1'
  });
  fs.writeFileSync(`${siteDir}/page.html`, htmlData.data.html);
  fs.writeFileSync(`${siteDir}/metadata.json`, JSON.stringify(htmlData.data, null, 2));
  
  // Save network log
  const networkData = await send(ws, {
    command: 'export_network_log',
    id: 'net_1'
  });
  fs.writeFileSync(`${siteDir}/network.json`, JSON.stringify(networkData.data, null, 2));
  
  // Save device info
  const deviceData = await send(ws, {
    command: 'export_device_ids',
    id: 'device_1'
  });
  fs.writeFileSync(`${siteDir}/device.json`, JSON.stringify(deviceData.data, null, 2));
  
  console.log(`✓ Forensic data saved to: ${siteDir}`);
  return siteDir;
}
```

### Example 13: Python - Save to CSV

```python
import asyncio
import csv
from datetime import datetime
from basset_hound import BrowserClient

async def export_network_to_csv(url):
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate(url)
        await asyncio.sleep(3)
        
        # Get network data
        network_data = await client.export_network_log()
        
        # Create filename
        domain = url.replace('https://', '').replace('http://', '').split('/')[0]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'network_{domain}_{timestamp}.csv'
        
        # Write to CSV
        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'URL', 'Method', 'Status', 'Type', 'Size (KB)', 'Duration (ms)'
            ])
            
            writer.writeheader()
            for req in network_data['requests']:
                writer.writerow({
                    'URL': req['url'],
                    'Method': req['method'],
                    'Status': req['statusCode'],
                    'Type': req['resourceType'],
                    'Size (KB)': round(req['contentLength'] / 1024, 2),
                    'Duration (ms)': req['duration']
                })
        
        print(f"Network log exported to: {filename}")

asyncio.run(export_network_to_csv('https://example.com'))
```

---

**Ready to integrate?** Check the [Troubleshooting Guide](./FORENSIC-EXPORTS-TROUBLESHOOTING.md) for common issues and solutions.
