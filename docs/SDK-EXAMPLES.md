# Basset Hound Browser SDK - Advanced Examples

## Table of Contents

1. [Web Scraping](#web-scraping)
2. [OSINT Investigation](#osint-investigation)
3. [Form Automation](#form-automation)
4. [Session Checkpointing](#session-checkpointing)
5. [Parallel Operations](#parallel-operations)
6. [Error Recovery](#error-recovery)
7. [Evasion Techniques](#evasion-techniques)
8. [Content Monitoring](#content-monitoring)
9. [Performance Optimization](#performance-optimization)

---

## Web Scraping

### Basic Web Scraping

```javascript
const { BrowserClient } = require('basset-hound-sdk');

async function scrapeWebsite(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();

    // Navigate to page
    await client.navigate(url, { waitTime: 2000 });

    // Extract data
    const title = await client.getTitle();
    const content = await client.getContent();
    const links = await client.extractLinks();
    const images = await client.extractImages();
    const metadata = await client.extractMetadata();

    return {
      url: url,
      title: title.data.title,
      description: metadata.data.description,
      htmlLength: content.data.html.length,
      linksCount: links.data.links.length,
      imagesCount: images.data.images.length,
      contentType: metadata.data.contentType
    };

  } catch (error) {
    console.error('Scraping error:', error.message);
    throw error;
  } finally {
    await client.disconnect();
  }
}

// Usage
scrapeWebsite('https://example.com').then(result => {
  console.log('Scrape result:', result);
});
```

### Scraping Multiple Pages

```javascript
async function scrapeMultiple(urls) {
  const results = [];

  for (const url of urls) {
    try {
      console.log(`Scraping: ${url}`);
      const result = await scrapeWebsite(url);
      results.push(result);
      // Polite delay between requests
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`Failed: ${url}`, error.message);
      results.push({ url, error: error.message });
    }
  }

  return results;
}

// Usage
const urls = [
  'https://example.com',
  'https://example.com/page1',
  'https://example.com/page2'
];

scrapeMultiple(urls).then(results => {
  console.table(results);
});
```

### Scraping with Data Extraction

```javascript
async function scrapeProductPage(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(url);

    // Wait for product data to load
    await client.waitForElement('.product-data', 5000);

    // Execute JavaScript to extract data
    const productData = await client.executeScript(`
      return {
        title: document.querySelector('h1').textContent,
        price: document.querySelector('.price').textContent,
        rating: document.querySelector('.rating').textContent,
        description: document.querySelector('.description').textContent,
        images: Array.from(document.querySelectorAll('.product-image'))
          .map(img => img.src)
      };
    `);

    return productData.data.result;

  } finally {
    await client.disconnect();
  }
}
```

---

## OSINT Investigation

### Multi-page OSINT Workflow

```javascript
async function osintInvestigation(seedUrl, maxDepth = 2) {
  const client = new BrowserClient('ws://localhost:8765', { debug: false });
  const visited = new Set();
  const results = [];

  try {
    await client.connect();

    // Apply evasion
    await client.applyFingerprint('chrome-100-windows');
    await client.rotateUserAgent();

    // Create initial checkpoint
    const checkpoint = await client.createCheckpoint('osint-initial');

    async function explore(url, depth = 0) {
      if (depth > maxDepth || visited.has(url)) return;
      visited.add(url);

      try {
        console.log(`Depth ${depth}: Analyzing ${url}`);

        // Navigate
        await client.navigate(url, { waitTime: 2000 });

        // Rollback to clean state for next request
        await client.rollbackToCheckpoint(checkpoint.checkpointId);

        // Extract data
        const metadata = await client.extractMetadata();
        const links = await client.extractLinks();
        const tech = await client.detectTechnology();

        results.push({
          url: url,
          depth: depth,
          title: metadata.data?.title,
          description: metadata.data?.description,
          technologies: tech.data?.technologies,
          linkCount: links.data?.links.length,
          timestamp: new Date().toISOString()
        });

        // Explore child links
        if (depth < maxDepth) {
          const childLinks = links.data?.links || [];
          for (const link of childLinks.slice(0, 3)) {
            // Only follow internal links for safety
            if (link.includes(new URL(seedUrl).hostname)) {
              await explore(link, depth + 1);
            }
          }
        }

      } catch (error) {
        console.error(`Error at ${url}:`, error.message);
      }
    }

    await explore(seedUrl);
    return results;

  } finally {
    await client.disconnect();
  }
}

// Usage
osintInvestigation('https://example.com', 2).then(results => {
  console.log('Investigation results:');
  console.table(results);
});
```

### Technology Stack Identification

```javascript
async function identifyTechStack(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(url);

    // Get all detection methods
    const [tech, cms, analytics, metadata] = await Promise.all([
      client.detectTechnology(),
      client.identifyCms(),
      client.identifyAnalytics(),
      client.extractMetadata()
    ]);

    return {
      url: url,
      frameworks: tech.data?.frameworks || [],
      libraries: tech.data?.libraries || [],
      cms: cms.data?.cms,
      cmsVersion: cms.data?.version,
      analyticsServices: analytics.data?.services || [],
      serverInfo: metadata.data?.server,
      poweredBy: metadata.data?.poweredBy
    };

  } finally {
    await client.disconnect();
  }
}
```

---

## Form Automation

### Filling and Submitting Forms

```javascript
async function submitForm(url, formData) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(url);

    // Wait for form to load
    await client.waitForElement('form', 5000);

    // Fill form fields
    for (const [fieldName, value] of Object.entries(formData)) {
      const selector = `input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`;
      
      if (fieldName.includes('password') || fieldName.includes('secret')) {
        // Type passwords for realism
        await client.typeText(value, { selector });
      } else {
        await client.fill(selector, value);
      }

      // Add human-like delay
      await new Promise(r => setTimeout(r, Math.random() * 500 + 200));
    }

    // Submit form
    const submitButton = await client.executeScript(`
      return document.querySelector('button[type="submit"]')?.innerText;
    `);

    await client.click('button[type="submit"]');

    // Wait for response
    await client.waitForElement('.success-message, .error-message, [data-response]', 10000);

    // Get response content
    const response = await client.getContent();
    return response.data.html;

  } finally {
    await client.disconnect();
  }
}

// Usage
const formData = {
  email: 'test@example.com',
  password: 'secure-password',
  name: 'Test User'
};

submitForm('https://example.com/login', formData).then(response => {
  console.log('Form submitted successfully');
});
```

### Multi-step Form with Validation

```javascript
async function multiStepFormFill(baseUrl, steps) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`Completing step ${i + 1} of ${steps.length}`);

      // Fill fields
      for (const [fieldName, value] of Object.entries(step.fields)) {
        await client.fill(`[name="${fieldName}"]`, value);
        await new Promise(r => setTimeout(r, 300));
      }

      // Click next button
      if (i < steps.length - 1) {
        await client.click(step.nextButton || 'button.next');
        await client.waitForElement(steps[i + 1].validateSelector, 5000);
      } else {
        // Final submit
        await client.click(step.submitButton || 'button[type="submit"]');
        await client.waitForElement(step.successSelector, 10000);
      }
    }

    return await client.getContent();

  } finally {
    await client.disconnect();
  }
}
```

---

## Session Checkpointing

### Save and Restore State

```javascript
async function checkpointExample() {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();

    // Navigate and set up initial state
    await client.navigate('https://example.com');
    await client.fill('input[name="search"]', 'test query');
    await client.click('button.search');
    await client.waitForElement('.results', 5000);

    // Save checkpoint after search
    const searchCheckpoint = await client.createCheckpoint(
      'after-search',
      'After performing search for "test query"'
    );

    // Continue browsing
    await client.click('.result:first-child');
    await client.waitForElement('article', 3000);

    // Save another checkpoint
    const detailCheckpoint = await client.createCheckpoint('on-detail-page');

    // Do some more work
    const content = await client.getContent();
    console.log('Current page:', content.data.html.substring(0, 200));

    // Rollback to search results
    console.log('Rolling back to search results...');
    await client.rollbackToCheckpoint(searchCheckpoint.checkpointId);
    const searchContent = await client.getContent();
    console.log('Back on search page');

    // Rollback to detail page
    console.log('Rolling back to detail page...');
    await client.rollbackToCheckpoint(detailCheckpoint.checkpointId);

    // List all checkpoints
    const checkpoints = await client.listCheckpoints();
    console.log('Available checkpoints:', checkpoints);

  } finally {
    await client.disconnect();
  }
}
```

### Branch and Explore

```javascript
async function exploreBranches(baseUrl) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(baseUrl);

    // Create checkpoint at start
    const start = await client.createCheckpoint('start');

    // Explore option A
    console.log('Exploring path A...');
    await client.click('a.option-a');
    const pathAContent = await client.getContent();
    const cpA = await client.createCheckpoint('path-a-explored');

    // Go back to start
    await client.rollbackToCheckpoint(start.checkpointId);

    // Explore option B
    console.log('Exploring path B...');
    await client.click('a.option-b');
    const pathBContent = await client.getContent();
    const cpB = await client.createCheckpoint('path-b-explored');

    // Go back to start again
    await client.rollbackToCheckpoint(start.checkpointId);

    // Explore option C
    console.log('Exploring path C...');
    await client.click('a.option-c');
    const pathCContent = await client.getContent();

    console.log('All paths explored');
    return {
      pathA: pathAContent.data.html.length,
      pathB: pathBContent.data.html.length,
      pathC: pathCContent.data.html.length
    };

  } finally {
    await client.disconnect();
  }
}
```

---

## Parallel Operations

### Using Connection Pool

```javascript
const { ConnectionPool } = require('basset-hound-sdk/connection-pool');

async function scrapeWithPool(urls) {
  const pool = new ConnectionPool('ws://localhost:8765', 5);
  await pool.connectAll();

  try {
    // Execute all scrapes in parallel
    const promises = urls.map(url =>
      pool.executeCommand('navigate', { url })
        .then(() => pool.executeCommand('get_title'))
        .then(response => ({
          url: url,
          title: response.data.title
        }))
    );

    const results = await Promise.all(promises);

    // Check pool stats
    const stats = pool.getStats();
    console.log('Pool stats:', stats);

    return results;

  } finally {
    await pool.closeAll();
  }
}

// Usage
const urls = [
  'https://example.com',
  'https://example.com/page1',
  'https://example.com/page2'
];

scrapeWithPool(urls).then(results => {
  console.table(results);
});
```

### Batch Multiple Operations

```javascript
async function batchExtraction(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(url);

    // Execute multiple commands in batch
    const results = await client.batch([
      { command: 'get_title' },
      { command: 'get_content' },
      { command: 'extract_links' },
      { command: 'extract_images' },
      { command: 'extract_metadata' },
      { command: 'detect_technology' },
      { command: 'screenshot' }
    ]);

    return {
      title: results[0].data.title,
      htmlSize: results[1].data.html.length,
      linkCount: results[2].data.links.length,
      imageCount: results[3].data.images.length,
      metadata: results[4].data,
      technologies: results[5].data.technologies,
      screenshotSize: results[6].data.size
    };

  } finally {
    await client.disconnect();
  }
}
```

---

## Error Recovery

### Retry with Exponential Backoff

```javascript
async function navigateWithBackoff(url, maxAttempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = new BrowserClient('ws://localhost:8765', {
      timeout: 30000,
      maxRetries: 2
    });

    try {
      await client.connect();
      const response = await client.navigate(url);

      if (response.success) {
        console.log(`Success on attempt ${attempt}`);
        return response;
      }

      lastError = new Error(response.error);

      // Check for recovery suggestions
      if (response.hasRecovery()) {
        console.log('Recovery suggestion:', response.recovery.suggestion);
      }

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
    } finally {
      await client.disconnect();
    }

    // Calculate backoff delay
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s...
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
```

### Graceful Degradation

```javascript
async function scrapeWithFallback(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    await client.navigate(url, { waitTime: 3000 });

    try {
      // Try to get full content extraction
      const data = await client.extractAll();
      return {
        method: 'full-extraction',
        data: data.data
      };
    } catch (detailedError) {
      console.log('Full extraction failed, trying minimal...');

      try {
        // Fallback to just getting HTML
        const content = await client.getContent();
        return {
          method: 'html-only',
          html: content.data.html
        };
      } catch (minimalError) {
        // Final fallback - just screenshot
        const screenshot = await client.screenshot();
        return {
          method: 'screenshot-only',
          screenshot: screenshot.data
        };
      }
    }

  } finally {
    await client.disconnect();
  }
}
```

---

## Evasion Techniques

### Comprehensive Evasion Setup

```javascript
async function navigateWithEvasion(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();

    // Apply multiple evasion layers
    console.log('Applying evasion techniques...');

    // 1. Fingerprint spoofing
    await client.applyFingerprint('chrome-120-windows');
    console.log('✓ Fingerprint applied');

    // 2. User agent rotation
    const ua = await client.rotateUserAgent();
    console.log('✓ User agent rotated:', ua.data.userAgent);

    // 3. Proxy rotation
    await client.setProxy('socks5://proxy1.example.com:1080', {
      username: 'user',
      password: 'pass'
    });
    console.log('✓ Proxy configured');

    // 4. Geographic spoofing
    await client.setGeoLock({
      country: 'US',
      region: 'CA',
      latitude: 37.7749,
      longitude: -122.4194
    });
    console.log('✓ Location spoofed');

    // Now navigate with all evasion active
    const response = await client.navigate(url, { waitTime: 3000 });
    return response.data;

  } finally {
    await client.disconnect();
  }
}
```

### Rotating Through Multiple Profiles

```javascript
const PROFILES = [
  'chrome-120-windows',
  'chrome-120-macos',
  'firefox-121-windows',
  'safari-17-macos'
];

let profileIndex = 0;

async function navigateWithRotatingProfiles(urls) {
  const results = [];

  for (const url of urls) {
    const client = new BrowserClient('ws://localhost:8765');

    try {
      await client.connect();

      // Apply rotating profile
      const profile = PROFILES[profileIndex % PROFILES.length];
      await client.applyFingerprint(profile);
      profileIndex++;

      // Rotate user agent
      await client.rotateUserAgent();

      // Navigate
      const response = await client.navigate(url);
      results.push({
        url: url,
        profile: profile,
        success: response.success
      });

      // Polite delay
      await new Promise(r => setTimeout(r, 2000));

    } finally {
      await client.disconnect();
    }
  }

  return results;
}
```

---

## Content Monitoring

### Track Content Changes

```javascript
async function monitorPageChanges(url, pollInterval = 60000) {
  const client = new BrowserClient('ws://localhost:8765');
  const snapshots = [];

  try {
    await client.connect();

    // Initial snapshot
    await client.navigate(url);
    const initialContent = await client.getContent();
    snapshots.push({
      timestamp: Date.now(),
      contentHash: hashContent(initialContent.data.html),
      hasChanged: false
    });

    // Polling loop
    while (true) {
      await new Promise(r => setTimeout(r, pollInterval));

      // Refresh and check
      await client.refresh();
      const newContent = await client.getContent();
      const newHash = hashContent(newContent.data.html);

      const hasChanged = newHash !== snapshots[snapshots.length - 1].contentHash;
      snapshots.push({
        timestamp: Date.now(),
        contentHash: newHash,
        hasChanged: hasChanged,
        notification: hasChanged ? 'CONTENT CHANGED!' : 'No change'
      });

      console.log(`[${new Date().toISOString()}] ${snapshots[snapshots.length - 1].notification}`);
    }

  } finally {
    await client.disconnect();
  }
}

function hashContent(html) {
  // Simple hash for demonstration
  return require('crypto').createHash('sha256').update(html).digest('hex');
}
```

---

## Performance Optimization

### Streaming Large Responses

```javascript
async function streamLargeData(url) {
  const client = new BrowserClient('ws://localhost:8765');
  let totalBytes = 0;

  try {
    await client.connect();
    await client.navigate(url);

    // Stream screenshot with chunk callback
    const response = await client.streamCommand(
      'screenshot',
      { format: 'png' },
      (chunk) => {
        totalBytes += chunk.length;
        console.log(`Received ${chunk.length} bytes, total: ${totalBytes}`);
      }
    );

    console.log(`Screenshot complete: ${response.data.size} bytes`);
    return response.data.buffer;

  } finally {
    await client.disconnect();
  }
}
```

### Concurrent Operations with Limits

```javascript
async function processUrlsWithLimit(urls, limit = 3) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();

    const operations = urls.map((url, index) => ({
      command: 'navigate',
      url: url
    }));

    // Execute with concurrency limit
    const results = await client.batchParallel(operations, limit);
    return results;

  } finally {
    await client.disconnect();
  }
}
```

---

**Examples Version:** 12.2.0  
**Last Updated:** June 2026
