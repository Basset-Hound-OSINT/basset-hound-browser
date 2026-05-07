# Basset Hound Browser - palletai Integration Guide

**Version:** 11.1.0  
**Target Platform:** palletai Agent Orchestration  
**Integration Type:** WebSocket API + MCP Server  
**Date:** 2026-05-06

---

## Quick Start

### 1. Install Client Library

```bash
npm install basset-hound-client
# or
pip install basset-hound-python
```

### 2. Connect to Browser

**Node.js:**
```javascript
const { BassetHoundClient } = require('basset-hound-client');

const browser = new BassetHoundClient({
  host: 'localhost',
  port: 8765,
  commandTimeout: 30000
});

await browser.connect();
console.log('Connected to Basset Hound Browser');
```

**Python:**
```python
from basset_hound import BassetHoundClient

browser = BassetHoundClient(host='localhost', port=8765)
browser.connect()
print('Connected to Basset Hound Browser')
```

### 3. Execute Your First Command

```javascript
// Navigate to a website
await browser.navigate({ url: 'https://example.com' });

// Wait for page to load
await new Promise(resolve => setTimeout(resolve, 2000));

// Get page content
const content = await browser.get_content();
console.log('Page title:', content.title);
```

---

## Core Operations Reference

### Navigation

```javascript
// Basic navigation
await browser.navigate({ url: 'https://example.com' });

// Wait for specific element to appear
await browser.wait_for_element('h1', { timeout: 5000 });

// Get current URL (useful for verifying redirects)
const url = await browser.get_url();
console.log('Current URL:', url);
```

### Content Extraction

```javascript
// Get full page HTML and text
const content = await browser.get_content();
console.log('HTML:', content.html);
console.log('Text:', content.text);

// Get page structure (forms, links, metadata)
const pageState = await browser.get_page_state();
console.log('Forms:', pageState.forms);
console.log('Links:', pageState.links);

// Get cookies
const cookies = await browser.get_all_cookies();
for (const cookie of cookies) {
  console.log(`${cookie.name}=${cookie.value}`);
}
```

### Form Interaction

```javascript
// Fill form fields with humanized delays
await browser.fill(
  'input[type="email"]',
  'user@example.com',
  { humanize: true }
);

// Fill password field
await browser.fill(
  'input[type="password"]',
  'SecurePassword123',
  { humanize: true }
);

// Submit form with humanized movement
await browser.click(
  'button[type="submit"]',
  { humanize: true }
);

// Wait for post-submit redirect
await new Promise(resolve => setTimeout(resolve, 2000));

// Verify successful login
const newUrl = await browser.get_url();
const isLoggedIn = !newUrl.includes('/login');
```

### JavaScript Execution

```javascript
// Extract dynamic data with JavaScript
const links = await browser.execute_script({
  script: `
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: a.textContent }));
  `
});

console.log('Found links:', links);

// Async JavaScript execution
const result = await browser.execute_script({
  script: `
    return new Promise((resolve) => {
      // Simulate async operation
      setTimeout(() => {
        resolve({
          timestamp: Date.now(),
          elementCount: document.querySelectorAll('*').length
        });
      }, 100);
    });
  `,
  timeout: 5000
});

console.log('Async result:', result);
```

### Screenshots

```javascript
// Capture viewport
const screenshot = await browser.screenshot_viewport();
// screenshot.data contains base64-encoded image

// Save to file (Node.js)
const fs = require('fs');
const buffer = Buffer.from(screenshot.data, 'base64');
fs.writeFileSync('page.png', buffer);

// Capture full page
const fullPage = await browser.screenshot_full_page();

// Capture specific element
const element = await browser.screenshot_element('main');
```

### Evasion Features

```javascript
// Rotate user agent
await browser.set_user_agent({
  category: 'browser'  // or 'mobile', 'crawler', 'desktop'
});

// Get current user agent
const status = await browser.get_user_agent_status();
console.log('Current UA:', status.userAgent);

// Check proxy status
const proxyStatus = await browser.get_proxy_status();
console.log('Proxy enabled:', proxyStatus.enabled);

// Rotate proxy (if configured)
await browser.rotate_proxy();

// Check Tor status
try {
  const torStatus = await browser.get_tor_status();
  console.log('Tor enabled:', torStatus.enabled);
} catch (error) {
  console.log('Tor not available');
}
```

---

## Real-World Workflow Examples

### Example 1: Web Scraping with Error Handling

```javascript
class WebScraper {
  constructor(browser) {
    this.browser = browser;
  }

  async scrapeWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.scrape(url);
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async scrape(url) {
    // Navigate
    await this.browser.navigate({ url });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract all data in parallel
    const [content, pageState, screenshot] = await Promise.all([
      this.browser.get_content(),
      this.browser.get_page_state(),
      this.browser.screenshot_viewport()
    ]);

    return {
      url,
      title: content.title || 'No title',
      textLength: content.text.length,
      formCount: pageState.forms?.length || 0,
      linkCount: pageState.links?.length || 0,
      screenshot: screenshot.data
    };
  }
}

// Usage
const scraper = new WebScraper(browser);
const result = await scraper.scrapeWithRetry('https://example.com');
console.log('Scraped:', result);
```

### Example 2: Authentication Workflow

```javascript
class AuthenticatedBrowser {
  constructor(browser, credentials) {
    this.browser = browser;
    this.credentials = credentials;
  }

  async login() {
    // Navigate to login page
    await this.browser.navigate({
      url: this.credentials.loginUrl
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill credentials with humanized delays
    await this.browser.fill(
      this.credentials.usernameSelector,
      this.credentials.username,
      { humanize: true }
    );

    await new Promise(resolve => setTimeout(resolve, 300));

    await this.browser.fill(
      this.credentials.passwordSelector,
      this.credentials.password,
      { humanize: true }
    );

    // Submit with humanized click
    await this.browser.click(
      this.credentials.submitSelector,
      { humanize: true }
    );

    // Wait for redirect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify login
    const url = await this.browser.get_url();
    if (url.includes('login')) {
      throw new Error('Login failed - still on login page');
    }

    console.log('Login successful');
    return true;
  }

  async getAuthenticatedContent(url) {
    // Access authenticated resource
    await this.browser.navigate({ url });
    await new Promise(resolve => setTimeout(resolve, 2000));

    return await this.browser.get_content();
  }
}

// Usage
const auth = new AuthenticatedBrowser(browser, {
  loginUrl: 'https://example.com/login',
  usernameSelector: 'input[name="email"]',
  passwordSelector: 'input[name="password"]',
  submitSelector: 'button[type="submit"]',
  username: 'user@example.com',
  password: 'SecurePassword123'
});

await auth.login();
const protectedContent = await auth.getAuthenticatedContent(
  'https://example.com/dashboard'
);
```

### Example 3: Reconnaissance with Evasion

```javascript
class StealthReconaissance {
  constructor(browser) {
    this.browser = browser;
    this.results = [];
  }

  async investigate(targets) {
    for (const target of targets) {
      try {
        // Randomize evasion strategy
        if (Math.random() > 0.5) {
          await this.browser.set_user_agent({ category: 'browser' });
        }

        if (Math.random() > 0.7) {
          try {
            await this.browser.rotate_proxy();
          } catch (error) {
            console.log('Proxy rotation unavailable, continuing');
          }
        }

        // Small random delay (human behavior)
        const delay = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Reconnaissance
        const data = await this.investigateTarget(target);
        this.results.push({
          target,
          ...data,
          timestamp: new Date().toISOString()
        });

        console.log(`Investigated: ${target}`);
      } catch (error) {
        console.error(`Failed to investigate ${target}:`, error.message);
        this.results.push({
          target,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return this.results;
  }

  async investigateTarget(url) {
    await this.browser.navigate({ url });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract all available information
    const [content, pageState] = await Promise.all([
      this.browser.get_content(),
      this.browser.get_page_state()
    ]);

    // Detect technologies
    const technologies = await this.detectTechnologies();

    return {
      title: content.title,
      description: content.description,
      forms: pageState.forms?.length || 0,
      inputs: pageState.forms?.reduce((sum, f) => sum + f.inputs?.length || 0, 0) || 0,
      technologies
    };
  }

  async detectTechnologies() {
    return await this.browser.execute_script({
      script: `
        return {
          hasJQuery: typeof jQuery !== 'undefined',
          hasReact: typeof React !== 'undefined',
          hasVue: typeof Vue !== 'undefined',
          hasAngular: typeof angular !== 'undefined',
          hasBootstrap: document.querySelector('[class*="bootstrap"]') !== null,
          frameworks: []
        };
      `
    });
  }
}

// Usage
const recon = new StealthReconaissance(browser);
const targets = [
  'https://example.com',
  'https://other-site.com',
  'https://target-site.net'
];

const results = await recon.investigate(targets);
console.log('Investigation complete:', results);
```

### Example 4: Parallel Multi-Site Investigation

```javascript
class ParallelInvestigator {
  constructor(browserPool) {
    this.browsers = browserPool;
    this.currentIndex = 0;
  }

  getNextBrowser() {
    const browser = this.browsers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.browsers.length;
    return browser;
  }

  async investigateSites(urls) {
    const investigations = urls.map(url => {
      const browser = this.getNextBrowser();
      return this.investigateUrl(browser, url);
    });

    return await Promise.allSettled(investigations);
  }

  async investigateUrl(browser, url) {
    try {
      await browser.navigate({ url });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const content = await browser.get_content();
      const pageState = await browser.get_page_state();

      return {
        url,
        status: 'success',
        title: content.title,
        forms: pageState.forms?.length || 0
      };
    } catch (error) {
      return {
        url,
        status: 'error',
        error: error.message
      };
    }
  }
}

// Usage - Create pool of 5 browsers
const browsers = await Promise.all(
  Array.from({ length: 5 }, async () => {
    const b = new BassetHoundClient();
    await b.connect();
    return b;
  })
);

const investigator = new ParallelInvestigator(browsers);

const urls = [
  'https://example.com',
  'https://example.org',
  'https://example.net',
  // ... more URLs
];

const results = await investigator.investigateSites(urls);
console.log('Results:', results);

// Cleanup
await Promise.all(browsers.map(b => b.disconnect()));
```

---

## Integration with palletai Agents

### Using as an MCP Tool

Basset Hound Browser exposes 166 MCP tools that can be used directly by Claude AI agents:

```javascript
// Claude can use these tools automatically
const tools = [
  'navigate',          // Navigate to URL
  'get_content',       // Extract page content
  'execute_script',    // Run JavaScript
  'click',             // Click element
  'fill',              // Fill form field
  'screenshot_viewport' // Take screenshot
  // ... 160+ more tools
];

// Example: Agent can call directly
// "Navigate to example.com and extract the main heading"
// MCP will automatically:
// 1. Call navigate with URL
// 2. Wait for page load
// 3. Execute script to find h1
// 4. Return the text
```

### Wrapping for palletai Workflow

```javascript
class BassetHoundPalletaiAdapter {
  constructor(browser) {
    this.browser = browser;
  }

  // Exported as palletai skill
  async performOSINT(targetUrl) {
    return {
      url: targetUrl,
      metadata: await this.extractMetadata(),
      content: await this.extractContent(),
      forms: await this.extractForms(),
      technologies: await this.detectTechnologies()
    };
  }

  async extractMetadata() {
    const content = await this.browser.get_content();
    return {
      title: content.title,
      description: content.description,
      language: content.language,
      charset: content.charset
    };
  }

  async extractContent() {
    const state = await this.browser.get_page_state();
    return {
      headings: state.headings,
      paragraphs: state.paragraphs,
      links: state.links,
      formCount: state.forms?.length || 0
    };
  }

  async extractForms() {
    return await this.browser.execute_script({
      script: `
        return Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input')).map(inp => ({
            name: inp.name,
            type: inp.type,
            required: inp.required
          }))
        }));
      `
    });
  }

  async detectTechnologies() {
    return await this.browser.execute_script({
      script: `
        const techs = {
          frameworks: [],
          libraries: [],
          servers: []
        };
        
        // Detect common frameworks
        if (typeof React !== 'undefined') techs.frameworks.push('React');
        if (typeof Vue !== 'undefined') techs.frameworks.push('Vue');
        if (typeof angular !== 'undefined') techs.frameworks.push('Angular');
        
        return techs;
      `
    });
  }
}

// Exported as a palletai skill that agents can call
module.exports = {
  name: 'basset-hound-osint',
  description: 'Perform OSINT reconnaissance on target websites',
  execute: async (context, params) => {
    const { targetUrl } = params;
    const adapter = new BassetHoundPalletaiAdapter(context.browser);
    return await adapter.performOSINT(targetUrl);
  }
};
```

---

## Error Handling Best Practices

### Retry Logic

```javascript
async function withRetry(fn, maxAttempts = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        
        console.log(`Retrying in ${delay.toFixed(0)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage
const content = await withRetry(
  () => browser.navigate({ url: 'https://example.com' })
);
```

### Graceful Degradation

```javascript
async function extractDataGracefully(browser, url) {
  const results = {};
  
  try {
    await browser.navigate({ url });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('Navigation failed:', error.message);
    return { error: 'Could not navigate to target', status: 'failed' };
  }

  // Try to extract each data type, continue on failure
  try {
    results.content = await browser.get_content();
  } catch (error) {
    console.warn('Failed to get content:', error.message);
    results.content = null;
  }

  try {
    results.pageState = await browser.get_page_state();
  } catch (error) {
    console.warn('Failed to get page state:', error.message);
    results.pageState = null;
  }

  try {
    results.screenshot = await browser.screenshot_viewport();
  } catch (error) {
    console.warn('Failed to get screenshot:', error.message);
    results.screenshot = null;
  }

  // Return whatever we could extract
  return {
    url,
    status: 'partial',
    ...results
  };
}
```

### Feature Detection

```javascript
async function checkAvailableFeatures(browser) {
  const features = {
    navigation: true,  // Always available
    forms: true,        // Always available
    advanced: {}
  };

  // Test advanced features
  try {
    await browser.get_network_logs();
    features.advanced.networkLogs = true;
  } catch {
    features.advanced.networkLogs = false;
  }

  try {
    await browser.get_console_logs();
    features.advanced.consoleLogs = true;
  } catch {
    features.advanced.consoleLogs = false;
  }

  try {
    await browser.get_memory_stats();
    features.advanced.memoryStats = true;
  } catch {
    features.advanced.memoryStats = false;
  }

  return features;
}

// Usage
const features = await checkAvailableFeatures(browser);
if (features.advanced.networkLogs) {
  const logs = await browser.get_network_logs();
  // Process network logs
}
```

---

## Testing Your Integration

### Simple Test Suite

```javascript
async function testIntegration() {
  const tests = {
    passed: 0,
    failed: 0,
    results: []
  };

  // Test 1: Connection
  try {
    await browser.connect();
    tests.passed++;
    console.log('✓ Connection test passed');
  } catch (error) {
    tests.failed++;
    tests.results.push({ test: 'Connection', error: error.message });
  }

  // Test 2: Navigation
  try {
    await browser.navigate({ url: 'https://example.com' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    tests.passed++;
    console.log('✓ Navigation test passed');
  } catch (error) {
    tests.failed++;
    tests.results.push({ test: 'Navigation', error: error.message });
  }

  // Test 3: Content Extraction
  try {
    const content = await browser.get_content();
    if (!content.html || content.html.length === 0) {
      throw new Error('No content returned');
    }
    tests.passed++;
    console.log('✓ Content extraction test passed');
  } catch (error) {
    tests.failed++;
    tests.results.push({ test: 'Content Extraction', error: error.message });
  }

  // Test 4: Form Detection
  try {
    const state = await browser.get_page_state();
    if (!state.forms) {
      throw new Error('Form detection unavailable');
    }
    tests.passed++;
    console.log('✓ Form detection test passed');
  } catch (error) {
    tests.failed++;
    tests.results.push({ test: 'Form Detection', error: error.message });
  }

  // Test 5: JavaScript Execution
  try {
    const result = await browser.execute_script({
      script: 'return document.title;'
    });
    tests.passed++;
    console.log('✓ JavaScript execution test passed');
  } catch (error) {
    tests.failed++;
    tests.results.push({ test: 'JavaScript Execution', error: error.message });
  }

  console.log(`\nTest Results: ${tests.passed} passed, ${tests.failed} failed`);
  return tests;
}
```

---

## Troubleshooting

### Connection Issues

```javascript
// Problem: Can't connect to browser
// Solution 1: Verify browser is running
// Solution 2: Check port number (default 8765)
// Solution 3: Try with longer timeout

const browser = new BassetHoundClient({
  host: 'localhost',
  port: 8765,
  connectionTimeout: 20000  // Increase timeout
});

await browser.connect();
```

### Timeout Issues

```javascript
// Problem: Commands timing out
// Solution 1: Increase command timeout
// Solution 2: Wait longer after navigation
// Solution 3: Use wait_for_element for dynamic content

await browser.navigate({ url });
await new Promise(resolve => setTimeout(resolve, 3000));  // Wait 3s instead of 2s

const content = await browser.get_content({}, 45000);  // 45s timeout instead of 30s
```

### Form Not Found

```javascript
// Problem: Selector doesn't match any elements
// Solution 1: Use browser dev tools to find correct selector
// Solution 2: Wait for element to appear
// Solution 3: Execute script to find element

// Option A: Wait for form to appear
await browser.wait_for_element('form', { timeout: 5000 });

// Option B: Find correct selector via script
const formSelectors = await browser.execute_script({
  script: `
    const forms = document.querySelectorAll('form');
    return Array.from(forms).map((f, i) => ({
      index: i,
      id: f.id,
      name: f.name,
      action: f.action
    }));
  `
});
console.log('Available forms:', formSelectors);
```

---

## Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor(browser) {
    this.browser = browser;
    this.metrics = [];
  }

  async trackOperation(name, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.metrics.push({
        name,
        duration,
        status: 'success',
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.metrics.push({
        name,
        duration,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  getReport() {
    const succeeded = this.metrics.filter(m => m.status === 'success');
    const failed = this.metrics.filter(m => m.status === 'error');
    
    return {
      total: this.metrics.length,
      succeeded: succeeded.length,
      failed: failed.length,
      averageTime: succeeded.length > 0
        ? succeeded.reduce((sum, m) => sum + m.duration, 0) / succeeded.length
        : 0,
      metrics: this.metrics
    };
  }
}

// Usage
const monitor = new PerformanceMonitor(browser);

const result = await monitor.trackOperation('navigation', () =>
  browser.navigate({ url: 'https://example.com' })
);

const report = monitor.getReport();
console.log('Performance Report:', report);
```

---

## Next Steps

1. **Start with simple navigation tests** - Ensure basic connectivity
2. **Implement authentication workflows** - Test your specific login requirements
3. **Add evasion strategies** - Rotate user agents and proxies if needed
4. **Scale to multiple instances** - Use browser pools for higher throughput
5. **Monitor performance** - Track metrics and optimize based on results
6. **Integrate with palletai** - Use the MCP server or client library

## Support Resources

- **API Reference:** `/docs/API-REFERENCE.md`
- **Scope & Architecture:** `/docs/SCOPE.md`
- **Roadmap:** `/docs/ROADMAP.md`
- **GitHub Issues:** Report bugs and request features
- **Discord Community:** Get help from other users

---

**Last Updated:** 2026-05-06  
**Status:** Production Ready  
**Version:** 11.1.0
