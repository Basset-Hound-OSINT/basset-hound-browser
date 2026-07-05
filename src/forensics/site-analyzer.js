/**
 * Basset Hound Browser - Deep Site Analysis
 * Technology detection, security analysis, form discovery
 */

const crypto = require('crypto');

class SiteAnalyzer {
  constructor() {
    this.techPatterns = {
      framework: {
        react: /react|nextjs|preact/i,
        vue: /vue|vuex|nuxt/i,
        angular: /angular|angularjs/i,
        ember: /ember|ember\.js/i,
        svelte: /svelte/i,
        backbone: /backbone|marionette/i
      },
      cms: {
        wordpress: /wordpress|wp-content|wp-includes/i,
        drupal: /drupal|drupalize/i,
        joomla: /joomla|component\/com_/i,
        shopify: /cdn\.shopify\.com|myshopify\.com/i,
        wix: /wix\.com|staticix\.com/i,
        squarespace: /squarespace\.com/i
      },
      server: {
        apache: /apache|mod_/i,
        nginx: /nginx/i,
        iis: /microsoft-iis/i,
        cloudflare: /cloudflare/i,
        aws: /amazon|aws|amazon cloudfront/i
      },
      languages: {
        php: /php/i,
        python: /python|django|flask/i,
        node: /node\.js|express/i,
        java: /java|spring|tomcat/i,
        dotnet: /\.net|asp\.net|iis/i,
        ruby: /ruby|rails/i
      },
      analytics: {
        google: /google-analytics|ua-|ga\.js/i,
        facebook: /facebook\.com\/tr|fbq\(/i,
        mixpanel: /mixpanel|mp_/i,
        hotjar: /hotjar|hj\.tracking/i,
        segment: /segment\.com|analytics\.js/i
      }
    };
  }

  /**
   * Analyze complete website
   * @param {Object} webContents - Electron web contents
   * @param {string} url - Current URL
   * @returns {Promise} Complete analysis report
   */
  async analyzeSite(webContents, url) {
    try {
      const analysis = {
        url,
        timestamp: new Date().toISOString(),
        technologies: await this.detectTechnologies(webContents),
        security: await this.analyzeSecurityHeaders(webContents),
        apis: await this.discoverAPIs(webContents),
        forms: await this.detectForms(webContents),
        scripts: await this.analyzeScripts(webContents),
        external_resources: await this.findExternalResources(webContents),
        hidden_fields: await this.findHiddenFields(webContents),
        score: null
      };

      // Calculate security score
      analysis.score = this.calculateSecurityScore(analysis.security);

      return analysis;
    } catch (err) {
      throw new Error(`Site analysis failed: ${err.message}`);
    }
  }

  /**
   * Detect technologies used on site
   */
  async detectTechnologies(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const techs = {
            frameworks: [],
            cms: [],
            servers: [],
            languages: [],
            analytics: [],
            libraries: [],
            other: []
          };

          // Check scripts and links
          document.querySelectorAll('script, link').forEach(el => {
            const src = el.src || el.href || '';
            const text = el.textContent || '';

            // Framework detection
            if (/react|nextjs|preact/.test(src + text)) techs.frameworks.push('React');
            if (/vue|vuex|nuxt/.test(src + text)) techs.frameworks.push('Vue');
            if (/angular/.test(src + text)) techs.frameworks.push('Angular');

            // CMS detection
            if (/wordpress|wp-content/.test(src)) techs.cms.push('WordPress');
            if (/drupal/.test(src)) techs.cms.push('Drupal');

            // Analytics
            if (/google-analytics|ga\.js|ua-[0-9]/.test(src)) techs.analytics.push('Google Analytics');
            if (/facebook\.com\/tr|fbq/.test(text)) techs.analytics.push('Facebook Pixel');

            // Libraries
            if (/jquery/.test(src)) techs.libraries.push('jQuery');
            if (/bootstrap/.test(src)) techs.libraries.push('Bootstrap');
          });

          // Check meta tags and headers
          const xPoweredBy = document.querySelector('meta[name="x-powered-by"]')?.content;
          if (xPoweredBy) techs.servers.push(xPoweredBy);

          // Remove duplicates and sort
          Object.keys(techs).forEach(key => {
            techs[key] = [...new Set(techs[key])].sort();
          });

          return techs;
        })()
      `, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Analyze security headers
   */
  async analyzeSecurityHeaders(webContents) {
    return new Promise((resolve) => {
      // This would be captured from response headers
      // For now, analyze what's available in the page
      webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
      });

      resolve({
        content_security_policy: null,
        x_frame_options: null,
        x_content_type_options: null,
        strict_transport_security: null,
        x_xss_protection: null,
        referrer_policy: null
      });
    });
  }

  /**
   * Discover API endpoints
   */
  async discoverAPIs(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const apis = {
            rest_endpoints: [],
            graphql: false,
            websocket: false,
            post_endpoints: []
          };

          // Monitor network requests
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && /api|json|graphql/.test(url)) {
              apis.rest_endpoints.push(url);
            }
            return originalFetch.apply(this, args);
          };

          // Check for GraphQL
          if (document.body.innerHTML.includes('graphql')) {
            apis.graphql = true;
          }

          // Check for WebSocket
          if (window.WebSocket) {
            apis.websocket = true;
          }

          // Look for form endpoints
          document.querySelectorAll('form').forEach(form => {
            if (form.action && !form.action.includes('javascript')) {
              apis.post_endpoints.push({
                action: form.action,
                method: form.method || 'GET',
                fields: Array.from(form.querySelectorAll('input')).map(i => i.name)
              });
            }
          });

          return apis;
        })()
      `, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Detect forms on page
   */
  async detectForms(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const forms = [];

          document.querySelectorAll('form').forEach((form, idx) => {
            const formData = {
              index: idx,
              id: form.id,
              name: form.name,
              method: form.method || 'GET',
              action: form.action,
              fields: [],
              hidden_fields: []
            };

            // Collect form fields
            form.querySelectorAll('input, textarea, select').forEach(field => {
              const fieldInfo = {
                name: field.name,
                type: field.type,
                required: field.required,
                value: field.value
              };

              if (field.type === 'hidden') {
                formData.hidden_fields.push(fieldInfo);
              } else {
                formData.fields.push(fieldInfo);
              }
            });

            forms.push(formData);
          });

          return forms;
        })()
      `, (result) => {
        resolve(result || []);
      });
    });
  }

  /**
   * Analyze script sources
   */
  async analyzeScripts(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const scripts = {
            inline_count: 0,
            external_count: 0,
            urls: [],
            sizes: []
          };

          document.querySelectorAll('script').forEach(script => {
            if (script.src) {
              scripts.external_count++;
              scripts.urls.push(script.src);
            } else {
              scripts.inline_count++;
              scripts.sizes.push(script.textContent.length);
            }
          });

          return scripts;
        })()
      `, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Find external resources
   */
  async findExternalResources(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const resources = {
            images: 0,
            stylesheets: 0,
            scripts: 0,
            fonts: 0,
            iframes: 0,
            total_size: 0
          };

          // Count resources
          resources.images = document.querySelectorAll('img').length;
          resources.stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;
          resources.scripts = document.querySelectorAll('script[src]').length;
          resources.fonts = document.querySelectorAll('link[rel*="font"]').length;
          resources.iframes = document.querySelectorAll('iframe').length;

          return resources;
        })()
      `, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Find hidden form fields
   */
  async findHiddenFields(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const hiddenFields = [];

          document.querySelectorAll('input[type="hidden"]').forEach(field => {
            hiddenFields.push({
              name: field.name,
              value: field.value,
              form: field.form?.name || 'unknown'
            });
          });

          return hiddenFields;
        })()
      `, (result) => {
        resolve(result || []);
      });
    });
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore(security) {
    let score = 100;

    if (!security.content_security_policy) {
      score -= 10;
    }
    if (!security.x_frame_options) {
      score -= 5;
    }
    if (!security.x_content_type_options) {
      score -= 5;
    }
    if (!security.strict_transport_security) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Generate analysis report
   */
  generateReport(analysis) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Site Analysis Report</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          h2 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
          .score { font-size: 24px; font-weight: bold; color: ${analysis.score >= 70 ? '#4CAF50' : '#FF9800'}; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .tech-tag { display: inline-block; background: #e8f5e9; padding: 3px 8px; margin: 2px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Website Analysis Report</h1>
        <p><strong>URL:</strong> ${analysis.url}</p>
        <p><strong>Analyzed:</strong> ${analysis.timestamp}</p>

        <h2>Security Score: <span class="score">${analysis.score}/100</span></h2>

        <h2>Technologies</h2>
        ${Object.entries(analysis.technologies).map(([type, items]) => `
          <h3>${type}</h3>
          <p>
            ${Array.isArray(items) && items.length > 0
    ? items.map(item => `<span class="tech-tag">${item}</span>`).join('')
    : 'None detected'}
          </p>
        `).join('')}

        <h2>Forms Detected: ${analysis.forms.length}</h2>
        ${analysis.forms.length > 0 ? `
          <table>
            <tr><th>Action</th><th>Method</th><th>Fields</th></tr>
            ${analysis.forms.map(f => `
              <tr>
                <td>${f.action || 'N/A'}</td>
                <td>${f.method}</td>
                <td>${f.fields.length + f.hidden_fields.length}</td>
              </tr>
            `).join('')}
          </table>
        ` : '<p>No forms found</p>'}

        <h2>Hidden Fields: ${analysis.hidden_fields ? analysis.hidden_fields.length : 0}</h2>
      </body>
      </html>
    `;

    return html;
  }
}

module.exports = new SiteAnalyzer();
