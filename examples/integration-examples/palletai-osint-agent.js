/**
 * Basset Hound Browser - palletai OSINT Agent Example
 * Version: 1.0.0
 * Date: 2026-05-11
 *
 * Complete example of how to integrate Basset Hound with palletai agents
 * for distributed OSINT operations.
 *
 * Usage:
 *   node palletai-osint-agent.js <target-url>
 *   node palletai-osint-agent.js https://example.com --verbose
 */

const BassetHoundClient = require('../../integrations/nodejs_client.js');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  browserHost: process.env.BROWSER_HOST || 'localhost',
  browserPort: parseInt(process.env.BROWSER_PORT || '8765'),
  commandTimeout: 30000,
  pageLoadDelay: 2000,
  verbose: process.argv.includes('--verbose'),
  outputDir: path.join(__dirname, 'osint-output'),
  maxPagesToAnalyze: 10
};

// ============================================================================
// OSINT INTELLIGENCE COLLECTOR
// ============================================================================

class OSINTAgent {
  constructor(options = {}) {
    this.options = { ...CONFIG, ...options };
    this.browser = new BassetHoundClient(
      this.options.browserHost,
      this.options.browserPort,
      this.options.commandTimeout
    );
    this.results = {
      target: null,
      timestamp: new Date().toISOString(),
      metadata: {},
      pages: [],
      links: [],
      forms: [],
      technologies: [],
      screenshots: [],
      errors: []
    };
  }

  log(message, level = 'INFO') {
    if (this.options.verbose || level !== 'DEBUG') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  }

  async initialize() {
    this.log('Connecting to Basset Hound Browser...');
    try {
      await this.browser.connect();
      this.log('Successfully connected to browser');
    } catch (err) {
      throw new Error(`Failed to connect to browser: ${err.message}`);
    }
  }

  async cleanup() {
    this.log('Cleaning up resources...');
    try {
      await this.browser.disconnect();
      this.log('Disconnected from browser');
    } catch (err) {
      this.log(`Cleanup error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Perform full website reconnaissance
   */
  async performReconnaissance(targetUrl) {
    this.results.target = targetUrl;
    this.log(`Starting reconnaissance on ${targetUrl}`);

    try {
      // Step 1: Apply evasion techniques
      await this.applyEvasionProfile();

      // Step 2: Navigate to target
      await this.navigateToTarget(targetUrl);

      // Step 3: Extract basic metadata
      await this.extractMetadata();

      // Step 4: Analyze page content
      await this.analyzePageContent();

      // Step 5: Extract forms (for social engineering assessment)
      await this.extractForms();

      // Step 6: Map internal links (limited depth)
      await this.mapInternalLinks();

      // Step 7: Capture forensic evidence
      await this.captureScreenshots();

      // Step 8: Detect technologies
      await this.detectTechnologies();

      this.log('Reconnaissance complete');
      return this.results;
    } catch (err) {
      this.log(`Reconnaissance failed: ${err.message}`, 'ERROR');
      this.results.errors.push({
        step: 'reconnaissance',
        error: err.message,
        timestamp: new Date().toISOString()
      });
      throw err;
    }
  }

  /**
   * Step 1: Apply evasion profile
   */
  async applyEvasionProfile() {
    this.log('Applying evasion profile...');

    try {
      // Rotate user agent
      const uaResponse = await this.browser.rotateUserAgent();
      if (uaResponse.success) {
        this.log('User agent rotated');
      }

      // Could also set proxy here
      // await this.browser.setProxy('proxy.example.com', 8080);

      this.results.metadata.evasionApplied = true;
    } catch (err) {
      this.log(`Evasion error: ${err.message}`, 'WARN');
      this.results.metadata.evasionApplied = false;
    }
  }

  /**
   * Step 2: Navigate to target
   */
  async navigateToTarget(url) {
    this.log(`Navigating to ${url}...`);

    const response = await this.browser.navigate(url);
    if (!response.success) {
      throw new Error(`Navigation failed: ${response.error}`);
    }

    // Wait for page to fully load
    await new Promise(r => setTimeout(r, this.options.pageLoadDelay));

    const currentUrl = await this.browser.getUrl();
    this.results.metadata.navigatedUrl = currentUrl;
    this.log(`Successfully navigated to ${currentUrl}`);
  }

  /**
   * Step 3: Extract metadata
   */
  async extractMetadata() {
    this.log('Extracting page metadata...');

    try {
      // Get page title and URL
      const pageState = await this.browser.getPageState();

      this.results.metadata.title = pageState.data?.title || 'N/A';
      this.results.metadata.url = pageState.data?.url || 'N/A';

      // Execute JavaScript to extract meta tags
      const metaTags = await this.browser.executeScript(`
        const meta = {};
        document.querySelectorAll('meta').forEach(tag => {
          const name = tag.getAttribute('name') || tag.getAttribute('property');
          const content = tag.getAttribute('content');
          if (name && content) {
            meta[name] = content;
          }
        });
        return meta;
      `);

      this.results.metadata.metaTags = metaTags || {};

      this.log(`Extracted metadata: ${this.results.metadata.title}`);
    } catch (err) {
      this.log(`Metadata extraction error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Step 4: Analyze page content
   */
  async analyzePageContent() {
    this.log('Analyzing page content...');

    try {
      const content = await this.browser.getContent();

      this.results.metadata.contentLength = content.data?.html?.length || 0;
      this.results.metadata.textLength = content.data?.text?.length || 0;

      // Store snippet of text
      const text = content.data?.text || '';
      this.results.metadata.textSnippet = text.substring(0, 500);

      this.log(`Content analysis: ${this.results.metadata.contentLength} bytes`);
    } catch (err) {
      this.log(`Content analysis error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Step 5: Extract forms
   */
  async extractForms() {
    this.log('Extracting forms...');

    try {
      const response = await this.browser.extractForms();
      const forms = response.data?.forms || [];

      this.results.forms = forms.map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        fieldsCount: form.fields?.length || 0,
        fields: form.fields?.map(f => ({
          name: f.name,
          type: f.type,
          required: f.required
        })) || []
      }));

      this.log(`Found ${this.results.forms.length} forms`);
    } catch (err) {
      this.log(`Form extraction error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Step 6: Map internal links
   */
  async mapInternalLinks() {
    this.log('Mapping internal links...');

    try {
      const response = await this.browser.extractLinks();
      const links = response.data?.links || [];

      // Classify links
      const targetDomain = new URL(this.results.target).hostname;

      const internal = [];
      const external = [];

      for (const link of links) {
        try {
          const linkUrl = new URL(link.url);
          if (linkUrl.hostname === targetDomain) {
            internal.push(link.url);
          } else {
            external.push({
              url: link.url,
              domain: linkUrl.hostname,
              text: link.text
            });
          }
        } catch (err) {
          // Skip invalid URLs
        }
      }

      this.results.metadata.internalLinksCount = internal.length;
      this.results.metadata.externalLinksCount = external.length;
      this.results.links = {
        internal: internal.slice(0, 20), // Limit to 20
        external: external.slice(0, 10)
      };

      this.log(`Found ${internal.length} internal, ${external.length} external links`);
    } catch (err) {
      this.log(`Link extraction error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Step 7: Capture screenshots
   */
  async captureScreenshots() {
    this.log('Capturing screenshots...');

    try {
      // Full page screenshot
      const screenshot = await this.browser.screenshot();

      if (screenshot) {
        this.results.screenshots.push({
          type: 'full-page',
          timestamp: new Date().toISOString(),
          dataLength: screenshot.length,
          // Store reference, not actual data (to keep results JSON reasonable)
          storageKey: `screenshot-${Date.now()}.png`
        });

        // Optionally save screenshot to disk
        if (this.options.outputDir) {
          const filename = path.join(this.options.outputDir, `screenshot-${Date.now()}.png`);
          const buffer = Buffer.from(screenshot, 'base64');
          fs.writeFileSync(filename, buffer);
          this.log(`Screenshot saved to ${filename}`);
        }
      }
    } catch (err) {
      this.log(`Screenshot capture error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Step 8: Detect technologies (via JavaScript analysis)
   */
  async detectTechnologies() {
    this.log('Detecting technologies...');

    try {
      const techs = await this.browser.executeScript(`
        const technologies = [];

        // Detect common frameworks/libraries
        if (window.React) technologies.push('React');
        if (window.Vue) technologies.push('Vue.js');
        if (window.Angular) technologies.push('Angular');
        if (window.jQuery) technologies.push('jQuery');

        // Detect analytics
        if (window.ga || window._gat) technologies.push('Google Analytics');
        if (window._paq) technologies.push('Matomo');

        // Detect jQuery version
        if (window.jQuery) {
          technologies.push(\`jQuery \${jQuery.fn.jquery}\`);
        }

        return technologies;
      `);

      this.results.technologies = techs || [];
      this.log(`Detected technologies: ${this.results.technologies.join(', ')}`);
    } catch (err) {
      this.log(`Technology detection error: ${err.message}`, 'WARN');
    }
  }

  /**
   * Get reconnaissance results
   */
  getResults() {
    return this.results;
  }

  /**
   * Save results to file
   */
  saveResults() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    const filename = path.join(
      this.options.outputDir,
      `recon-${Date.now()}.json`
    );

    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    this.log(`Results saved to ${filename}`);

    return filename;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.log('Usage: node palletai-osint-agent.js <target-url>');
    console.log('Example: node palletai-osint-agent.js https://example.com');
    process.exit(1);
  }

  const agent = new OSINTAgent();

  try {
    // Initialize
    await agent.initialize();

    // Perform reconnaissance
    const results = await agent.performReconnaissance(targetUrl);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('RECONNAISSANCE RESULTS');
    console.log('='.repeat(80));
    console.log(JSON.stringify(results, null, 2));

    // Save results
    agent.saveResults();

    console.log('\nReconnaissance completed successfully');
  } catch (err) {
    console.error('Agent error:', err.message);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = OSINTAgent;
