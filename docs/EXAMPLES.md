# Basset Hound Browser - Real-World Examples & Workflows

**Version:** 12.8.0  
**Last Updated:** June 21, 2026

## Table of Contents

1. [Basic Operations](#basic-operations)
2. [Web Scraping](#web-scraping)
3. [Forensic Evidence Capture](#forensic-evidence-capture)
4. [Network Forensics](#network-forensics)
5. [Session Management](#session-management)
6. [Advanced Evasion](#advanced-evasion)
7. [Batch Processing](#batch-processing)
8. [Error Handling & Recovery](#error-handling--recovery)

---

## Basic Operations

### Example 1: Simple Page Navigation and Screenshot

```javascript
const { BassetClient } = require('basset-hound-client');

async function captureWebpage() {
  const client = new BassetClient({ url: 'ws://localhost:8765' });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Navigate to website
    await client.navigate('https://example.com');
    console.log('✓ Navigated to https://example.com');
    
    // Get page metadata
    const { url } = await client.getUrl();
    const { title } = await client.getTitle();
    console.log(`✓ Page: ${title} (${url})`);
    
    // Take screenshot
    const screenshot = await client.screenshot({ fullPage: true });
    console.log(`✓ Screenshot captured (${screenshot.imageData.length} bytes)`);
    
    // Save screenshot
    const fs = require('fs');
    const base64 = screenshot.imageData.split(',')[1] || screenshot.imageData;
    fs.writeFileSync('screenshot.png', Buffer.from(base64, 'base64'));
    console.log('✓ Saved to screenshot.png');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await client.disconnect();
    console.log('✓ Disconnected');
  }
}

captureWebpage();
```

### Example 2: Extract Page Information

```python
import asyncio
from basset_hound import BassetClient

async def extract_page_info():
    client = BassetClient(url='ws://localhost:8765')
    
    try:
        await client.connect()
        print('✓ Connected')
        
        # Navigate
        await client.navigate(url='https://example.com')
        print('✓ Navigated')
        
        # Extract data
        title = await client.get_title()
        url = await client.get_url()
        content = await client.get_content(type='text')
        
        print(f'✓ Title: {title["title"]}')
        print(f'✓ URL: {url["url"]}')
        print(f'✓ Content length: {len(content["text"])} characters')
        
        # Count links
        link_count = await client.execute_script(
            'return document.querySelectorAll("a").length'
        )
        print(f'✓ Links found: {link_count}')
        
        # Get all links
        links = await client.execute_script("""
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            })).slice(0, 10)
        """)
        print(f'✓ First 10 links: {links}')
        
    finally:
        await client.disconnect()

asyncio.run(extract_page_info())
```

---

## Web Scraping

### Example 3: E-Commerce Product Scraping

```javascript
const { BassetClient } = require('basset-hound-client');

async function scrapeProducts() {
  const client = new BassetClient({ 
    url: 'ws://localhost:8765',
    timeout: 60000
  });
  
  const products = [];
  
  try {
    await client.connect();
    
    // Navigate to product listing
    await client.navigate('https://example-shop.com/products');
    await client.waitForSelector('div.product-card', { timeout: 10000 });
    console.log('✓ Products loaded');
    
    // Scroll to load more products
    let previousCount = 0;
    let scrolls = 0;
    
    while (scrolls < 5) {
      // Extract visible products
      const items = await client.executeScript(`
        return Array.from(document.querySelectorAll('.product-card')).map(card => ({
          title: card.querySelector('.title')?.textContent || '',
          price: card.querySelector('.price')?.textContent || '',
          rating: card.querySelector('.rating')?.textContent || '',
          url: card.querySelector('a')?.href || '',
          image: card.querySelector('img')?.src || ''
        }))
      `);
      
      console.log(`✓ Found ${items.length} products on current view`);
      
      // Check if we got new products
      if (items.length === previousCount) {
        console.log('✓ No more products to load');
        break;
      }
      
      products.push(...items);
      previousCount = items.length;
      
      // Scroll down
      await client.scroll({ x: 0, y: 1000 });
      await new Promise(r => setTimeout(r, 1000));  // Wait for load
      
      scrolls++;
      console.log(`✓ Scroll ${scrolls}/5 - Total items: ${products.length}`);
    }
    
    // Remove duplicates
    const uniqueProducts = Array.from(
      new Map(products.map(p => [p.url, p])).values()
    );
    
    console.log(`\n✓ Scraping complete: ${uniqueProducts.length} unique products`);
    console.log('\nFirst 5 products:');
    uniqueProducts.slice(0, 5).forEach((p, i) => {
      console.log(`${i+1}. ${p.title} - ${p.price} (${p.rating})`);
    });
    
    // Save to JSON
    const fs = require('fs');
    fs.writeFileSync('products.json', JSON.stringify(uniqueProducts, null, 2));
    console.log('\n✓ Saved to products.json');
    
  } finally {
    await client.disconnect();
  }
}

scrapeProducts();
```

### Example 4: JavaScript-Heavy Site Scraping

```javascript
// Scraping sites with dynamic content loading

async function scrapeDynamicSite() {
  const client = new BassetClient({ url: 'ws://localhost:8765' });
  
  try {
    await client.connect();
    
    // Navigate to site
    await client.navigate('https://spa-website.com/data');
    
    // Wait for JavaScript to render content
    await client.waitForSelector('[data-loaded=true]', { timeout: 15000 });
    console.log('✓ Content rendered');
    
    // Wait for specific API requests
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract rendered data
    const data = await client.executeScript(`
      // Wait for Vue/React/Angular to render
      return new Promise(resolve => {
        const checkRender = () => {
          const dataElement = document.querySelector('[data-loaded=true]');
          if (dataElement) {
            resolve({
              html: document.body.innerHTML,
              dataAttr: dataElement.getAttribute('data-content')
            });
          } else {
            setTimeout(checkRender, 100);
          }
        };
        checkRender();
      });
    `);
    
    console.log('✓ Dynamic data extracted');
    console.log(`✓ Data size: ${data.html.length} bytes`);
    
  } finally {
    await client.disconnect();
  }
}
```

---

## Forensic Evidence Capture

### Example 5: Complete Evidence Package Capture

```javascript
const fs = require('fs');
const path = require('path');
const { BassetClient } = require('basset-hound-client');

async function captureCompleteEvidence() {
  const client = new BassetClient({ url: 'ws://localhost:8765' });
  const evidenceDir = path.join(process.cwd(), 'evidence-package');
  
  // Create evidence directory
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  
  const evidence = {
    capturedAt: new Date().toISOString(),
    url: 'https://example.com',
    items: []
  };
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Start network forensics
    await client.startNetworkForensics({
      enableHashing: true,
      enableTimeline: true,
      maxDnsQueries: 1000,
      maxCertificates: 100
    });
    console.log('✓ Network forensics started');
    
    // Navigate
    await client.navigate('https://example.com');
    console.log('✓ Navigated');
    
    // Interact with page
    await client.waitForSelector('body');
    await client.scroll({ x: 0, y: 500 });
    await new Promise(r => setTimeout(r, 2000));
    
    // 1. Capture screenshot
    console.log('\nCapturing screenshots...');
    const screenshot = await client.screenshot({ fullPage: true });
    const screenshotPath = path.join(evidenceDir, 'page.png');
    const base64 = screenshot.imageData.split(',')[1] || screenshot.imageData;
    fs.writeFileSync(screenshotPath, Buffer.from(base64, 'base64'));
    
    const screenEvidence = await client.captureScreenshotEvidence({
      imageData: screenshot.imageData,
      url: evidence.url,
      fullPage: true
    });
    evidence.items.push({
      type: 'screenshot',
      evidenceId: screenEvidence.evidenceId,
      file: 'page.png',
      hash: screenEvidence.evidence.hash
    });
    console.log(`✓ Screenshot: ${screenEvidence.evidenceId}`);
    
    // 2. Capture DOM snapshot
    console.log('Capturing DOM...');
    const domHtml = await client.executeScript(
      'return document.documentElement.outerHTML'
    );
    const domPath = path.join(evidenceDir, 'dom.html');
    fs.writeFileSync(domPath, domHtml);
    
    const domEvidence = await client.captureDomEvidence({
      domString: domHtml,
      url: evidence.url,
      includeStyles: true
    });
    evidence.items.push({
      type: 'dom_snapshot',
      evidenceId: domEvidence.evidenceId,
      file: 'dom.html',
      hash: domEvidence.evidence.hash
    });
    console.log(`✓ DOM snapshot: ${domEvidence.evidenceId}`);
    
    // 3. Capture console logs
    console.log('Capturing console...');
    const consoleLogs = await client.executeScript(`
      return window.__consoleLogs || []
    `);
    const consoleEvidence = await client.captureConsoleEvidence({
      logs: consoleLogs,
      url: evidence.url
    });
    evidence.items.push({
      type: 'console',
      evidenceId: consoleEvidence.evidenceId,
      logCount: consoleLogs.length
    });
    console.log(`✓ Console logs: ${consoleEvidence.evidenceId}`);
    
    // 4. Capture cookies
    console.log('Capturing cookies...');
    const cookies = await client.getCookies();
    const cookiesPath = path.join(evidenceDir, 'cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    
    const cookiesEvidence = await client.execute('capture_cookies_evidence', {
      cookies,
      url: evidence.url
    });
    evidence.items.push({
      type: 'cookies',
      evidenceId: cookiesEvidence.evidenceId,
      count: cookies.length,
      file: 'cookies.json'
    });
    console.log(`✓ Cookies: ${cookiesEvidence.evidenceId}`);
    
    // 5. Stop network forensics
    console.log('\nCapturing network forensics...');
    const forensicsResult = await client.stopNetworkForensics();
    
    evidence.forensics = {
      dnsQueries: forensicsResult.itemsCaptured.dnsQueries,
      tlsCertificates: forensicsResult.itemsCaptured.tlsCertificates,
      httpHeaders: forensicsResult.itemsCaptured.httpHeaders,
      cookies: forensicsResult.itemsCaptured.cookies
    };
    console.log(`✓ DNS queries: ${forensicsResult.itemsCaptured.dnsQueries}`);
    console.log(`✓ TLS certificates: ${forensicsResult.itemsCaptured.tlsCertificates}`);
    console.log(`✓ HTTP headers: ${forensicsResult.itemsCaptured.httpHeaders}`);
    
    // Save evidence manifest
    const manifestPath = path.join(evidenceDir, 'evidence-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(evidence, null, 2));
    console.log(`\n✓ Evidence manifest saved to evidence-manifest.json`);
    
    // Print summary
    console.log('\n=== EVIDENCE PACKAGE SUMMARY ===');
    console.log(`Directory: ${evidenceDir}`);
    console.log(`Items captured: ${evidence.items.length}`);
    evidence.items.forEach(item => {
      console.log(`  - ${item.type}: ${item.evidenceId}`);
    });
    
  } finally {
    await client.disconnect();
  }
}

captureCompleteEvidence();
```

---

## Network Forensics

### Example 6: DNS and TLS Analysis

```javascript
async function analyzeNetworkForensics() {
  const client = new BassetClient({ url: 'ws://localhost:8765' });
  
  try {
    await client.connect();
    
    // Start capture
    await client.startNetworkForensics({
      enableHashing: true,
      enableTimeline: true
    });
    console.log('✓ Network forensics started');
    
    // Navigate (will trigger DNS lookups, TLS connections)
    await client.navigate('https://example.com');
    await client.waitForSelector('body');
    
    // Allow time for all requests
    await new Promise(r => setTimeout(r, 3000));
    
    // Get captured DNS queries
    console.log('\n=== DNS QUERIES ===');
    const dnsQueries = await client.execute('get_dns_queries');
    dnsQueries.queries.slice(0, 10).forEach(q => {
      console.log(`${q.hostname} (${q.type}): ${q.status} - ${q.responseTime}ms`);
    });
    console.log(`Total: ${dnsQueries.total} queries`);
    
    // Get TLS certificates
    console.log('\n=== TLS CERTIFICATES ===');
    const certs = await client.execute('get_tls_certificates');
    certs.certificates.forEach(cert => {
      console.log(`${cert.hostname}`);
      console.log(`  Subject: ${cert.subject}`);
      console.log(`  Issuer: ${cert.issuer}`);
      console.log(`  Valid: ${cert.notBefore} to ${cert.notAfter}`);
    });
    
    // Get HTTP headers
    console.log('\n=== HTTP HEADERS ===');
    const headers = await client.execute('get_http_headers', { limit: 5 });
    headers.headers.slice(0, 5).forEach(h => {
      console.log(`${h.url} (${h.statusCode})`);
      console.log(`  Request headers: ${h.requestHeaderCount}`);
      console.log(`  Response headers: ${h.responseHeaderCount}`);
    });
    
    // Stop forensics
    const result = await client.stopNetworkForensics();
    console.log(`\n✓ Forensics stopped (${result.duration}ms)`);
    
  } finally {
    await client.disconnect();
  }
}

analyzeNetworkForensics();
```

---

## Session Management

### Example 7: Multi-Session Management

```javascript
async function manageMultipleSessions() {
  const sessionClients = [];
  
  try {
    // Create 3 isolated sessions
    console.log('Creating 3 isolated sessions...');
    
    for (let i = 1; i <= 3; i++) {
      const client = new BassetClient({
        url: 'ws://localhost:8765',
        timeout: 30000
      });
      
      await client.connect();
      
      // Create isolated profile
      const profile = await client.createProfile(`session-${i}`);
      console.log(`✓ Session ${i}: ${profile.profileName}`);
      
      // Set different user agents
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) Firefox/89.0'
      ];
      
      await client.setUserAgent(userAgents[i - 1]);
      
      // Set different locations
      const locations = [
        { lat: 40.7128, lon: -74.0060, name: 'New York' },
        { lat: 34.0522, lon: -118.2437, name: 'Los Angeles' },
        { lat: 41.8781, lon: -87.6298, name: 'Chicago' }
      ];
      
      const loc = locations[i - 1];
      await client.setGeolocation(loc.lat, loc.lon, 100);
      console.log(`✓ Session ${i} location: ${loc.name}`);
      
      sessionClients.push({ id: i, client });
    }
    
    // Run concurrent navigation in all sessions
    console.log('\nNavigating all sessions to example.com...');
    const promises = sessionClients.map(({ id, client }) =>
      client.navigate('https://example.com')
        .then(() => console.log(`✓ Session ${id} navigated`))
    );
    
    await Promise.all(promises);
    
    // Verify session isolation - get different user agents
    console.log('\nVerifying session isolation...');
    for (const { id, client } of sessionClients) {
      const ua = await client.getContent({ type: 'text' });
      console.log(`✓ Session ${id} user agent: ${ua.text.substring(0, 50)}...`);
    }
    
    // Capture session state from each
    console.log('\nCapturing session states...');
    for (const { id, client } of sessionClients) {
      const cookies = await client.getCookies();
      const localStorage = await client.getLocalStorage();
      
      console.log(`✓ Session ${id}:`);
      console.log(`  Cookies: ${cookies.length}`);
      console.log(`  LocalStorage items: ${Object.keys(localStorage).length}`);
    }
    
  } finally {
    // Clean up all sessions
    console.log('\nCleaning up sessions...');
    for (const { id, client } of sessionClients) {
      await client.disconnect();
      console.log(`✓ Session ${id} closed`);
    }
  }
}

manageMultipleSessions();
```

---

## Advanced Evasion

### Example 8: Bot Detection Evasion

```javascript
async function evadeDetection() {
  const client = new BassetClient({ url: 'ws://localhost:8765' });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Setup evasion profile
    console.log('\nConfiguring evasion parameters...');
    
    // 1. Set realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    await client.setUserAgent(userAgent);
    console.log('✓ User agent set');
    
    // 2. Set geolocation (residential location)
    await client.setGeolocation(40.7128, -74.0060, 100);  // New York
    console.log('✓ Geolocation set (New York)');
    
    // 3. Set timezone
    await client.execute('set_timezone', { timezoneId: 'America/New_York' });
    console.log('✓ Timezone set');
    
    // 4. Set locale
    await client.setLocale('en-US');
    console.log('✓ Locale set');
    
    // 5. Set proxy (if available)
    try {
      await client.setProxy({
        proxyType: 'http',
        host: '127.0.0.1',
        port: 8080
      });
      console.log('✓ Proxy configured');
    } catch (e) {
      console.log('⚠ Proxy not available (optional)');
    }
    
    // 6. Configure headers
    await client.execute('set_headers', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    console.log('✓ Headers configured');
    
    // Navigate to detection test site
    console.log('\nNavigating to bot detection test site...');
    await client.navigate('https://httpbin.org/');
    
    // Get detection results
    const detectionResults = await client.executeScript(`
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        webdriver: navigator.webdriver,
        chromeRuntime: !!window.chrome && !!window.chrome.runtime,
        phantomJS: !!window.phantom,
        plugins: navigator.plugins.length
      }
    `);
    
    console.log('\n=== DETECTION EVASION RESULTS ===');
    console.log(`User Agent: ${detectionResults.userAgent.substring(0, 60)}...`);
    console.log(`Language: ${detectionResults.language}`);
    console.log(`Timezone: ${detectionResults.timezone}`);
    console.log(`Webdriver detected: ${detectionResults.webdriver}`);
    console.log(`Chrome runtime: ${detectionResults.chromeRuntime}`);
    console.log(`PhantomJS: ${detectionResults.phantomJS}`);
    console.log(`Plugins: ${detectionResults.plugins}`);
    
    // Take screenshot
    const screenshot = await client.screenshot();
    console.log(`\n✓ Screenshot captured (${screenshot.imageData.length} bytes)`);
    
  } finally {
    await client.disconnect();
  }
}

evadeDetection();
```

---

## Batch Processing

### Example 9: Process Multiple URLs with Rate Limiting

```javascript
async function batchProcessUrls() {
  const client = new BassetClient({ 
    url: 'ws://localhost:8765',
    token: process.env.BASSET_TOKEN  // Use auth for higher limits
  });
  
  const urls = [
    'https://example1.com',
    'https://example2.com',
    'https://example3.com',
    'https://example4.com',
    'https://example5.com'
  ];
  
  const results = [];
  const errors = [];
  
  try {
    await client.connect();
    console.log(`✓ Connected - Processing ${urls.length} URLs\n`);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const startTime = Date.now();
      
      try {
        // Check rate limit before proceeding
        const limits = await client.getRateLimitStatus();
        if (limits.remaining < 5) {
          const waitTime = limits.resetAt - Date.now();
          console.log(`⏳ Rate limit approaching, waiting ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
        }
        
        // Navigate
        await client.navigate(url, { waitUntil: 'networkidle2' });
        
        // Extract data
        const { title } = await client.getTitle();
        const screenshot = await client.screenshot();
        const content = await client.getContent({ type: 'text' });
        const linkCount = await client.executeScript(
          'return document.querySelectorAll("a").length'
        );
        
        const elapsed = Date.now() - startTime;
        
        const result = {
          url,
          status: 'success',
          title,
          contentLength: content.text.length,
          links: linkCount,
          screenshotSize: screenshot.imageData.length,
          elapsed: `${elapsed}ms`
        };
        
        results.push(result);
        console.log(`${i+1}/${urls.length} ✓ ${url}`);
        console.log(`  Title: ${title}`);
        console.log(`  Content: ${content.text.length} chars`);
        console.log(`  Links: ${linkCount}`);
        console.log(`  Time: ${elapsed}ms\n`);
        
      } catch (error) {
        const elapsed = Date.now() - startTime;
        
        errors.push({
          url,
          error: error.message,
          elapsed: `${elapsed}ms`
        });
        
        console.log(`${i+1}/${urls.length} ✗ ${url}`);
        console.log(`  Error: ${error.message}\n`);
      }
      
      // Add delay between requests to respect rate limits
      if (i < urls.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    // Print summary
    console.log('\n=== BATCH PROCESSING SUMMARY ===');
    console.log(`Total URLs: ${urls.length}`);
    console.log(`Successful: ${results.length}`);
    console.log(`Failed: ${errors.length}`);
    
    if (results.length > 0) {
      console.log('\nResults:');
      results.forEach(r => {
        console.log(`  ${r.url}: ${r.title} (${r.contentLength} chars, ${r.links} links)`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => {
        console.log(`  ${e.url}: ${e.error}`);
      });
    }
    
  } finally {
    await client.disconnect();
  }
}

batchProcessUrls();
```

---

## Error Handling & Recovery

### Example 10: Robust Error Handling with Retries

```javascript
async function robustWebScraping() {
  const client = new BassetClient({ 
    url: 'ws://localhost:8765',
    timeout: 30000,
    logLevel: 'debug'
  });
  
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 5000];  // ms
  
  /**
   * Execute command with automatic retry
   */
  async function executeWithRetry(command, params, attempt = 0) {
    try {
      console.log(`[Attempt ${attempt + 1}] ${command}`);
      return await client.execute(command, params);
      
    } catch (error) {
      // Handle rate limiting
      if (error.name === 'RateLimitError') {
        const waitTime = error.rateLimit.retryAfter || 10000;
        console.log(`⏳ Rate limited, waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
        return executeWithRetry(command, params, attempt + 1);
      }
      
      // Handle timeout with retry
      if (error.name === 'TimeoutError' && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Timeout, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return executeWithRetry(command, params, attempt + 1);
      }
      
      // Handle connection errors
      if (error.name === 'ConnectionError') {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`🔗 Connection error, reconnecting in ${delay}ms...`);
          await client.disconnect();
          await new Promise(r => setTimeout(r, delay));
          await client.connect();
          return executeWithRetry(command, params, attempt + 1);
        }
      }
      
      // Give up after retries
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
      }
      
      throw error;
    }
  }
  
  try {
    console.log('=== ROBUST WEB SCRAPING ===\n');
    
    // Connect with error handling
    let connectionAttempts = 0;
    while (connectionAttempts < 3) {
      try {
        await client.connect();
        console.log('✓ Connected\n');
        break;
      } catch (error) {
        connectionAttempts++;
        if (connectionAttempts >= 3) throw error;
        console.log(`Connection failed, retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Navigate with retry
    await executeWithRetry('navigate', {
      url: 'https://example.com',
      waitUntil: 'networkidle2'
    });
    console.log('✓ Navigated\n');
    
    // Extract data with fallbacks
    let title = 'Unknown';
    try {
      const titleResult = await executeWithRetry('get_title', {});
      title = titleResult.title;
    } catch (error) {
      console.log(`⚠ Failed to get title: ${error.message}`);
    }
    console.log(`✓ Title: ${title}\n`);
    
    // Take screenshot with size fallback
    let screenshot;
    try {
      screenshot = await executeWithRetry('screenshot', { fullPage: true });
    } catch (error) {
      console.log(`⚠ Full page screenshot failed, trying viewport...`);
      screenshot = await executeWithRetry('screenshot', {});
    }
    console.log(`✓ Screenshot: ${screenshot.imageData.length} bytes\n`);
    
    // Extract content with fallbacks
    let content;
    try {
      content = await executeWithRetry('get_content', { type: 'html' });
    } catch (error) {
      console.log(`⚠ HTML extraction failed, trying text...`);
      content = await executeWithRetry('get_content', { type: 'text' });
    }
    console.log(`✓ Content: ${content.text.length} chars\n`);
    
    console.log('=== SUCCESS ===');
    
  } catch (error) {
    console.error('\n✗ FATAL ERROR:');
    console.error(`  ${error.name}: ${error.message}`);
    console.error('\nRecovery steps:');
    console.error('  1. Check server is running');
    console.error('  2. Verify network connectivity');
    console.error('  3. Check rate limits');
    console.error('  4. Increase timeout values');
    
  } finally {
    try {
      await client.disconnect();
      console.log('\n✓ Disconnected');
    } catch (error) {
      console.error('Failed to disconnect:', error.message);
    }
  }
}

robustWebScraping();
```

---

## Performance Tips

### Optimize Memory Usage

```javascript
// Process large batches in chunks
async function processLargeDataset(urls) {
  const CHUNK_SIZE = 10;
  
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    
    console.log(`Processing batch ${i / CHUNK_SIZE + 1}...`);
    await Promise.all(chunk.map(url => processUrl(url)));
    
    // Force garbage collection between batches
    if (global.gc) {
      global.gc();
      console.log('Garbage collected');
    }
    
    // Add delay
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Run with: node --expose-gc script.js
```

### Use Connection Pooling

```javascript
class ClientPool {
  constructor(url, size = 5) {
    this.url = url;
    this.size = size;
    this.clients = [];
    this.available = [];
  }
  
  async initialize() {
    for (let i = 0; i < this.size; i++) {
      const client = new BassetClient({ url: this.url });
      await client.connect();
      this.clients.push(client);
      this.available.push(client);
    }
  }
  
  async acquire() {
    while (this.available.length === 0) {
      await new Promise(r => setTimeout(r, 100));
    }
    return this.available.pop();
  }
  
  release(client) {
    this.available.push(client);
  }
  
  async close() {
    await Promise.all(this.clients.map(c => c.disconnect()));
  }
}

// Usage
const pool = new ClientPool('ws://localhost:8765', 5);
await pool.initialize();
const client = await pool.acquire();
try {
  // Use client
} finally {
  pool.release(client);
}
await pool.close();
```

---

## Common Use Cases Summary

| Use Case | Key Commands | Workflow |
|----------|--------------|----------|
| **Basic browsing** | navigate, screenshot, getTitle | 1. Navigate 2. Screenshot 3. Extract |
| **Web scraping** | navigate, executeScript, getContent | 1. Navigate 2. Wait 3. Extract 4. Process |
| **Evidence capture** | captureScreenshot, captureDom, captureConsole | 1. Setup forensics 2. Navigate 3. Capture 4. Export |
| **Bot evasion** | setUserAgent, setGeolocation, setProxy | 1. Configure 2. Navigate 3. Verify |
| **Multi-session** | createProfile, setUserAgent, getCookies | 1. Create 2. Configure 3. Isolate |
| **Batch processing** | navigate (parallel), execute (queued) | 1. Queue 2. Rate limit 3. Retry |
| **Error recovery** | retry with exponential backoff | 1. Try 2. Catch 3. Backoff 4. Retry |

---

---

## Copy-Paste Ready Scenarios

These 5 scenarios are designed for external developers to copy-paste and use immediately with minimal modifications.

### Scenario 1: Web Scraping with Screenshots & Error Handling (50 lines)

```javascript
// scrape-with-errors.js - Navigate, extract, screenshot with retry logic
const { BassetClient } = require('basset-hound-client');

async function scrapeWithErrorHandling() {
  const client = new BassetClient({ url: 'ws://localhost:8765', timeout: 30000 });
  const MAX_RETRIES = 3;
  let data = {};
  
  try {
    await client.connect();
    
    // Navigate with retry
    let navigated = false;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await client.navigate('https://example.com');
        navigated = true;
        console.log('✓ Navigated successfully');
        break;
      } catch (err) {
        console.log(`⚠ Navigation attempt ${i+1} failed, retrying...`);
        if (i === MAX_RETRIES - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    
    if (!navigated) throw new Error('Failed to navigate after retries');
    
    // Extract HTML content
    const content = await client.getContent({ type: 'html' });
    data.htmlSize = content.html.length;
    console.log(`✓ HTML extracted: ${data.htmlSize} bytes`);
    
    // Extract text
    const text = await client.getContent({ type: 'text' });
    data.textSize = text.text.length;
    console.log(`✓ Text extracted: ${data.textSize} characters`);
    
    // Take screenshot with fallback
    let screenshot;
    try {
      screenshot = await client.screenshot({ fullPage: true });
      data.screenshot = 'full-page';
    } catch (err) {
      console.log('⚠ Full page failed, trying viewport...');
      screenshot = await client.screenshot();
      data.screenshot = 'viewport';
    }
    console.log(`✓ Screenshot captured (${screenshot.imageData.length} bytes) [${data.screenshot}]`);
    
    // Count elements
    const linkCount = await client.executeScript('return document.querySelectorAll("a").length');
    data.linkCount = linkCount;
    console.log(`✓ Links found: ${linkCount}`);
    
    // Save screenshot
    const fs = require('fs');
    const base64 = screenshot.imageData.split(',')[1] || screenshot.imageData;
    fs.writeFileSync('scrape-result.png', Buffer.from(base64, 'base64'));
    console.log('✓ Screenshot saved to scrape-result.png');
    
    return data;
    
  } catch (error) {
    console.error(`✗ Fatal error: ${error.message}`);
    throw error;
  } finally {
    await client.disconnect();
  }
}

scrapeWithErrorHandling().then(data => {
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(data, null, 2));
}).catch(err => process.exit(1));
```

**Usage:**
```bash
npm install basset-hound-client
node scrape-with-errors.js
```

**Key Features:**
- Retry logic for navigation failures
- Fallback for full-page → viewport screenshots
- Error messages with context
- Automatic screenshot saving

---

### Scenario 2: Multi-Step Form Submission with Validation (60 lines)

```javascript
// form-submission.js - Fill form, handle validation, submit
const { BassetClient } = require('basset-hound-client');

async function submitFormWithValidation() {
  const client = new BassetClient({ url: 'ws://localhost:8765', timeout: 30000 });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Step 1: Navigate to form
    await client.navigate('https://example.com/contact-form');
    console.log('✓ Navigated to form page');
    
    // Step 2: Take screenshot of initial form
    let screenshot = await client.screenshot();
    console.log('✓ Step 1 screenshot: Initial form');
    
    // Step 3: Fill form fields
    console.log('\nFilling form...');
    
    // Fill name field
    await client.fill('input[name="name"]', 'John Doe');
    console.log('  ✓ Name filled');
    
    // Fill email field
    await client.fill('input[name="email"]', 'john@example.com');
    console.log('  ✓ Email filled');
    
    // Fill message field
    await client.fill('textarea[name="message"]', 'This is a test message for the contact form.');
    console.log('  ✓ Message filled');
    
    // Take screenshot after filling
    screenshot = await client.screenshot();
    console.log('✓ Step 2 screenshot: Form filled');
    
    // Step 4: Check for validation errors before submit
    console.log('\nValidating form...');
    const validationErrors = await client.executeScript(`
      return Array.from(document.querySelectorAll('.error, .validation-error')).map(el => ({
        field: el.closest('[data-field]')?.getAttribute('data-field') || 'unknown',
        message: el.textContent
      }))
    `);
    
    if (validationErrors.length > 0) {
      console.log('⚠ Validation errors found:');
      validationErrors.forEach(err => {
        console.log(`  - ${err.field}: ${err.message}`);
      });
      throw new Error('Form validation failed - please fix errors manually');
    }
    console.log('✓ No validation errors');
    
    // Step 5: Submit form
    console.log('\nSubmitting form...');
    await client.click('button[type="submit"]');
    console.log('  ✓ Submit button clicked');
    
    // Wait for response (page reload or confirmation)
    await new Promise(r => setTimeout(r, 2000));
    console.log('  ✓ Form processed');
    
    // Step 6: Take screenshot of result
    screenshot = await client.screenshot();
    console.log('✓ Step 3 screenshot: Form submitted');
    
    // Step 7: Check success message
    const successMessage = await client.executeScript(`
      const successEl = document.querySelector('.success, .confirmation, [role="alert"]');
      return successEl ? successEl.textContent.trim() : null;
    `);
    
    if (successMessage) {
      console.log(`\n✓ Success message: "${successMessage}"`);
    } else {
      console.log('\n⚠ No success message found (may still have submitted)');
    }
    
    return { status: 'success', successMessage };
    
  } catch (error) {
    console.error(`\n✗ Form submission failed: ${error.message}`);
    throw error;
  } finally {
    await client.disconnect();
  }
}

submitFormWithValidation().then(result => {
  console.log('\n=== FORM SUBMISSION COMPLETE ===');
  console.log(JSON.stringify(result, null, 2));
}).catch(err => process.exit(1));
```

**Usage:**
```bash
node form-submission.js
```

**Key Features:**
- Screenshots at each step for documentation
- Form field filling with waits
- Pre-submission validation checking
- Success confirmation detection
- Error logging with field names

---

### Scenario 3: Session-Based Authentication & Content Extraction (70 lines)

```javascript
// authenticated-scraping.js - Login, extract, maintain session
const { BassetClient } = require('basset-hound-client');

async function authenticatedScraping() {
  const client = new BassetClient({ url: 'ws://localhost:8765', timeout: 30000 });
  let sessionData = { authenticated: false, cookies: [] };
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Step 1: Create isolated profile for this session
    const profile = await client.createProfile('auth-session-1');
    console.log(`✓ Created profile: ${profile.profileName}`);
    
    // Step 2: Navigate to login page
    await client.navigate('https://example.com/login');
    console.log('✓ Navigated to login page');
    
    // Step 3: Enter credentials
    console.log('\nAuthenticating...');
    await client.fill('input[name="username"]', 'testuser@example.com');
    console.log('  ✓ Username entered');
    
    await client.fill('input[name="password"]', 'MySecurePassword123');
    console.log('  ✓ Password entered');
    
    // Step 4: Submit login form
    await client.click('button[type="submit"]');
    console.log('  ✓ Login form submitted');
    
    // Step 5: Wait for authentication to complete
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if logged in by looking for dashboard elements
    const isLoggedIn = await client.executeScript(`
      return !!document.querySelector('[data-user-dashboard], .authenticated, .dashboard')
    `);
    
    if (!isLoggedIn) {
      throw new Error('Authentication failed - dashboard not found');
    }
    console.log('✓ Authentication successful');
    sessionData.authenticated = true;
    
    // Step 6: Extract and store session cookies
    const cookies = await client.getCookies();
    sessionData.cookies = cookies.map(c => ({ name: c.name, value: c.value }));
    sessionData.cookieCount = cookies.length;
    console.log(`✓ Session cookies captured: ${cookies.length}`);
    
    // Step 7: Navigate to protected content
    console.log('\nExtracting authenticated content...');
    await client.navigate('https://example.com/dashboard');
    console.log('  ✓ Dashboard page loaded');
    
    // Step 8: Extract user profile information
    const userProfile = await client.executeScript(`
      return {
        username: document.querySelector('[data-username]')?.textContent || 'unknown',
        email: document.querySelector('[data-email]')?.textContent || 'unknown',
        accountStatus: document.querySelector('[data-status]')?.textContent || 'unknown'
      }
    `);
    sessionData.userProfile = userProfile;
    console.log(`  ✓ User: ${userProfile.username} (${userProfile.email})`);
    console.log(`  ✓ Status: ${userProfile.accountStatus}`);
    
    // Step 9: Extract protected data
    const protectedContent = await client.getContent({ type: 'text' });
    sessionData.contentLength = protectedContent.text.length;
    console.log(`  ✓ Protected content extracted: ${protectedContent.text.length} chars`);
    
    // Step 10: Test session persistence
    console.log('\nTesting session persistence...');
    await client.navigate('https://example.com/settings');
    const isStillAuthed = await client.executeScript(`
      return !!document.querySelector('[data-authenticated]')
    `);
    sessionData.sessionPersistent = isStillAuthed;
    console.log(`✓ Session persists across navigation: ${isStillAuthed}`);
    
    // Step 11: Logout
    console.log('\nLogging out...');
    const logoutButton = await client.executeScript(`
      return !!document.querySelector('a[href="/logout"], button.logout')
    `);
    
    if (logoutButton) {
      await client.click('a[href="/logout"], button.logout');
      await new Promise(r => setTimeout(r, 1000));
      console.log('✓ Logged out successfully');
    }
    
    // Step 12: Verify session is cleared
    const clearedCookies = await client.getCookies();
    sessionData.finalCookieCount = clearedCookies.length;
    console.log(`✓ Cookies after logout: ${clearedCookies.length}`);
    
    return sessionData;
    
  } catch (error) {
    console.error(`\n✗ Authentication failed: ${error.message}`);
    throw error;
  } finally {
    await client.disconnect();
  }
}

authenticatedScraping().then(data => {
  console.log('\n=== SESSION DATA ===');
  console.log(JSON.stringify(data, null, 2));
}).catch(err => process.exit(1));
```

**Usage:**
```bash
node authenticated-scraping.js
```

**Key Features:**
- Profile isolation for session security
- Login/authentication flow
- Cookie management and persistence testing
- Protected content extraction
- Logout verification
- Session persistence validation

---

### Scenario 4: Batch Processing 100 URLs with Rate Limiting (80 lines)

```javascript
// batch-processing.js - Process 100 URLs with rate limiting and recovery
const { BassetClient } = require('basset-hound-client');

async function batchProcessWithRateLimiting() {
  const client = new BassetClient({ url: 'ws://localhost:8765', timeout: 30000 });
  
  // Generate test URLs (replace with your actual URLs)
  const generateUrls = (count) => {
    return Array.from({ length: count }, (_, i) => 
      `https://example.com/page/${i + 1}`
    );
  };
  
  const urls = generateUrls(100);  // Process 100 URLs
  const results = { success: [], failed: [], skipped: 0 };
  const rateLimitConfig = { delayBetweenRequests: 500, maxConcurrentChecks: 3 };
  
  try {
    await client.connect();
    console.log(`✓ Connected - Processing ${urls.length} URLs\n`);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const progress = `[${i + 1}/${urls.length}]`;
      
      try {
        // Check rate limit status before each request
        const rateLimitStatus = await client.getRateLimitStatus?.() || { remaining: Infinity };
        
        // If approaching limit, wait
        if (rateLimitStatus.remaining < 10) {
          const resetTime = rateLimitStatus.resetAt || Date.now() + 60000;
          const waitTime = Math.max(1000, resetTime - Date.now());
          console.log(`${progress} ⏳ Rate limit near, waiting ${(waitTime / 1000).toFixed(1)}s...`);
          await new Promise(r => setTimeout(r, waitTime));
        }
        
        // Navigate with timeout
        const startTime = Date.now();
        await Promise.race([
          client.navigate(url, { waitUntil: 'networkidle2' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Navigation timeout')), 10000)
          )
        ]);
        
        const elapsed = Date.now() - startTime;
        
        // Extract quick info
        const title = (await client.getTitle()).title;
        const httpResponse = await client.getHttpResponse?.() || { status: 200 };
        
        results.success.push({ url, title, status: httpResponse.status, elapsed });
        console.log(`${progress} ✓ ${url.substring(0, 40)}... (${title}) [${elapsed}ms]`);
        
      } catch (error) {
        // Handle different error types
        if (error.message.includes('Navigation timeout')) {
          results.skipped++;
          console.log(`${progress} ⏭ Skipped (timeout) - ${url}`);
        } else if (error.message.includes('RateLimitError')) {
          results.skipped++;
          console.log(`${progress} ⏭ Skipped (rate limit) - ${url}`);
        } else {
          results.failed.push({ url, error: error.message });
          console.log(`${progress} ✗ Failed - ${url.substring(0, 40)}... (${error.message})`);
        }
      }
      
      // Rate limiting delay between requests
      if (i < urls.length - 1) {
        await new Promise(r => setTimeout(r, rateLimitConfig.delayBetweenRequests));
      }
      
      // Progress check every 10 URLs
      if ((i + 1) % 10 === 0) {
        const avgTime = results.success.length > 0 
          ? (results.success.reduce((sum, r) => sum + r.elapsed, 0) / results.success.length).toFixed(0)
          : 0;
        const eta = (urls.length - i - 1) * (avgTime / 1000);
        console.log(`  → Progress: ${((i + 1) / urls.length * 100).toFixed(1)}% | ETA: ${eta.toFixed(0)}s\n`);
      }
    }
    
    // Print comprehensive summary
    console.log('\n=== BATCH PROCESSING SUMMARY ===');
    console.log(`Total URLs: ${urls.length}`);
    console.log(`Successful: ${results.success.length} (${(results.success.length/urls.length*100).toFixed(1)}%)`);
    console.log(`Failed: ${results.failed.length} (${(results.failed.length/urls.length*100).toFixed(1)}%)`);
    console.log(`Skipped: ${results.skipped} (${(results.skipped/urls.length*100).toFixed(1)}%)`);
    
    if (results.success.length > 0) {
      const avgElapsed = results.success.reduce((sum, r) => sum + r.elapsed, 0) / results.success.length;
      const totalTime = results.success.reduce((sum, r) => sum + r.elapsed, 0);
      console.log(`\nSuccess stats:`);
      console.log(`  Average response: ${avgElapsed.toFixed(0)}ms`);
      console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`  Throughput: ${(results.success.length / (totalTime / 1000)).toFixed(1)} pages/sec`);
    }
    
    if (results.failed.length > 0) {
      console.log(`\nFirst 5 failures:`);
      results.failed.slice(0, 5).forEach(f => {
        console.log(`  - ${f.url}: ${f.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error(`\n✗ Batch processing failed: ${error.message}`);
    throw error;
  } finally {
    await client.disconnect();
  }
}

batchProcessWithRateLimiting().then(results => {
  console.log('\n✓ Batch processing complete');
  process.exit(results.failed.length > 0 ? 1 : 0);
}).catch(err => process.exit(1));
```

**Usage:**
```bash
node batch-processing.js
```

**Key Features:**
- Process 100 URLs with configurable delays
- Built-in rate limit detection and handling
- Timeout protection per request
- Progress tracking with ETA calculation
- Comprehensive error categorization
- Throughput statistics
- Automatic retry-safe error recovery

---

### Scenario 5: Advanced Bot Evasion with Fingerprinting (90 lines)

```javascript
// advanced-evasion.js - Full evasion configuration, detection monitoring
const { BassetClient } = require('basset-hound-client');

async function advancedBotEvasion() {
  const client = new BassetClient({ url: 'ws://localhost:8765', timeout: 30000 });
  const evasionConfig = {
    detectionAttempts: [],
    evaded: true
  };
  
  try {
    await client.connect();
    console.log('✓ Connected\n');
    
    // Phase 1: Configure comprehensive evasion
    console.log('=== PHASE 1: EVASION CONFIGURATION ===\n');
    
    // 1a. Set realistic user agent (Chrome on Windows)
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await client.setUserAgent(chromeUA);
    console.log('✓ User agent: Chrome/120 on Windows 10');
    
    // 1b. Set geolocation (residential USA location)
    await client.setGeolocation(40.7128, -74.0060, 50);  // New York, 50m accuracy
    console.log('✓ Geolocation: New York, USA (40.7128, -74.0060)');
    
    // 1c. Set timezone
    await client.execute('set_timezone', { timezoneId: 'America/New_York' });
    console.log('✓ Timezone: America/New_York');
    
    // 1d. Set locale and language
    await client.setLocale('en-US');
    await client.execute('set_headers', {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('✓ Locale: en-US with realistic headers');
    
    // 1e. Spoof WebGL/Canvas if available
    try {
      await client.execute('spoof_webgl', { enabled: true });
      console.log('✓ WebGL fingerprinting spoofed');
    } catch (e) {
      console.log('⚠ WebGL spoofing unavailable (optional)');
    }
    
    // 1f. Enable behavioral simulation
    try {
      await client.execute('enable_behavioral_simulation', {
        mouseMovement: true,
        typingDelay: true,
        scrollBehavior: true
      });
      console.log('✓ Behavioral simulation enabled');
    } catch (e) {
      console.log('⚠ Behavioral simulation unavailable (optional)');
    }
    
    // 1g. Configure proxy (if testing with residential proxy)
    try {
      await client.setProxy({
        proxyType: 'http',
        host: '127.0.0.1',
        port: 8080
      });
      console.log('✓ Proxy configured (optional)');
    } catch (e) {
      console.log('⚠ Proxy not configured (optional)');
    }
    
    console.log('\n=== PHASE 2: DETECTION MONITORING ===\n');
    
    // Phase 2: Navigate to bot detection testing site
    console.log('Navigating to detection-resistant site...');
    await client.navigate('https://www.cloudflare.com/');  // Known bot detection
    console.log('✓ Page loaded\n');
    
    // Phase 3: Check for detection patterns
    console.log('=== PHASE 3: DETECTION PATTERN ANALYSIS ===\n');
    
    // 3a. Extract browser properties
    const browserProps = await client.executeScript(`
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        plugins: Array.from(navigator.plugins).map(p => p.name),
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        webdriver: navigator.webdriver
      }
    `);
    evasionConfig.browserProperties = browserProps;
    console.log(`✓ User Agent: ${browserProps.userAgent.substring(0, 60)}...`);
    console.log(`✓ Language: ${browserProps.language}`);
    console.log(`✓ Timezone: ${browserProps.timezone}`);
    console.log(`✓ Platform: ${browserProps.platform}`);
    console.log(`✓ Webdriver detected: ${browserProps.webdriver}`);
    
    if (browserProps.webdriver) {
      evasionConfig.detectionAttempts.push('webdriver property detected');
    }
    
    // 3b. Check for Chrome/Puppeteer indicators
    const chromeIndicators = await client.executeScript(`
      return {
        chromeRuntime: !!window.chrome && !!window.chrome.runtime,
        phantomJS: !!window.phantom,
        testingMode: window.__TESTING__ || window.__TEST__ || false,
        headless: window.navigator.userAgentData?.platform === 'Linux' && !navigator.plugins.length
      }
    `);
    evasionConfig.chromeIndicators = chromeIndicators;
    console.log(`✓ Chrome runtime: ${chromeIndicators.chromeRuntime}`);
    console.log(`✓ Phantom.js: ${chromeIndicators.phantomJS}`);
    console.log(`✓ Headless signals: ${chromeIndicators.headless}`);
    
    if (chromeIndicators.chromeRuntime || chromeIndicators.headless) {
      evasionConfig.detectionAttempts.push('chrome automation indicators detected');
    }
    
    // 3c. Check for canvas/WebGL fingerprinting attempts
    const canvasFingerprints = await client.executeScript(`
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('test', 2, 2);
      return canvas.toDataURL().substring(0, 50);
    `);
    console.log(`✓ Canvas fingerprinting possible`);
    
    // 3d. Monitor network requests for blocking
    const requestDetails = await client.executeScript(`
      return {
        requestCount: window.__networkStats?.requestCount || 'unknown',
        blockedCount: window.__networkStats?.blockedCount || 0
      }
    `);
    console.log(`✓ Requests processed: ${requestDetails.requestCount}`);
    console.log(`✓ Requests blocked: ${requestDetails.blockedCount}`);
    
    // Phase 4: Take evidence screenshot
    console.log('\n=== PHASE 4: EVIDENCE CAPTURE ===\n');
    const screenshot = await client.screenshot({ fullPage: false });
    const fs = require('fs');
    const base64 = screenshot.imageData.split(',')[1] || screenshot.imageData;
    fs.writeFileSync('evasion-test-result.png', Buffer.from(base64, 'base64'));
    console.log('✓ Screenshot saved: evasion-test-result.png');
    
    // Phase 5: Final detection assessment
    console.log('\n=== PHASE 5: DETECTION ASSESSMENT ===\n');
    
    // Check HTTP response code for bot blocks
    const httpStatus = await client.executeScript('return window.__httpStatus__ || 200');
    console.log(`✓ HTTP Status: ${httpStatus}`);
    
    if (httpStatus === 403 || httpStatus === 429) {
      evasionConfig.evaded = false;
      evasionConfig.detectionAttempts.push(`Blocked with HTTP ${httpStatus}`);
    }
    
    // Check for challenge pages (Cloudflare, etc)
    const hasChallenge = await client.executeScript(`
      return !!(document.querySelector('[class*="challenge"]') ||
                document.querySelector('[data-cf-challenge]') ||
                document.title.includes('Challenge'))
    `);
    
    if (hasChallenge) {
      evasionConfig.evaded = false;
      evasionConfig.detectionAttempts.push('Challenge/block page detected');
    }
    
    console.log(`Evasion Status: ${evasionConfig.evaded ? '✓ SUCCESSFUL' : '✗ DETECTED'}`);
    
    if (evasionConfig.detectionAttempts.length === 0) {
      console.log('✓ No detection patterns identified');
    } else {
      console.log(`\nDetection patterns found (${evasionConfig.detectionAttempts.length}):`);
      evasionConfig.detectionAttempts.forEach(attempt => {
        console.log(`  ⚠ ${attempt}`);
      });
    }
    
    return evasionConfig;
    
  } catch (error) {
    console.error(`\n✗ Evasion test failed: ${error.message}`);
    throw error;
  } finally {
    await client.disconnect();
  }
}

advancedBotEvasion().then(config => {
  console.log('\n=== EVASION CONFIGURATION SUMMARY ===');
  console.log(JSON.stringify(config, null, 2));
  process.exit(config.evaded ? 0 : 1);
}).catch(err => process.exit(1));
```

**Usage:**
```bash
node advanced-evasion.js
```

**Key Features:**
- Comprehensive fingerprint configuration (UA, geolocation, timezone, locale)
- Behavioral simulation for human-like interaction
- WebGL/Canvas spoofing
- Detection pattern monitoring
- Bot detection signature checking
- Challenge page detection
- HTTP status monitoring
- Evidence screenshot capture
- Detailed evasion assessment report

---

## See Also

- `/QUICK-START-GUIDE.md` - Getting started
- `/docs/api/API-REFERENCE-AUTHORITATIVE.md` - Complete API reference
- `/sdk-stubs/` - Client templates for Python, JavaScript, Go
- `/clients/nodejs/examples/` - More Node.js examples
- `/clients/python/examples.py` - More Python examples
