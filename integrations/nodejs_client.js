/**
 * Basset Hound Browser - Node.js Client Library
 * Version: 1.0.0
 * Protocol: WebSocket (JSON)
 * Default Host: localhost:8765
 *
 * Usage:
 *   const { BassetHoundClient } = require('./nodejs_client');
 *
 *   const browser = new BassetHoundClient();
 *   await browser.connect();
 *   await browser.navigate("https://example.com");
 *   const content = await browser.getContent();
 *   console.log(content.text);
 *   await browser.disconnect();
 */

const WebSocket = require('ws');

class BassetHoundClientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BassetHoundClientError';
  }
}

class BassetHoundConnectionError extends BassetHoundClientError {
  constructor(message) {
    super(message);
    this.name = 'BassetHoundConnectionError';
  }
}

class BassetHoundTimeoutError extends BassetHoundClientError {
  constructor(message) {
    super(message);
    this.name = 'BassetHoundTimeoutError';
  }
}

class BassetHoundClient {
  /**
   * Initialize Basset Hound client
   * @param {string} host - WebSocket host (default: localhost)
   * @param {number} port - WebSocket port (default: 8765)
   * @param {number} timeout - Command timeout in ms (default: 30000)
   * @param {boolean} autoReconnect - Auto-reconnect on connection loss (default: true)
   */
  constructor(host = 'localhost', port = 8765, timeout = 30000, autoReconnect = true) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.autoReconnect = autoReconnect;
    this.ws = null;
    this.commandId = 0;
    this.connected = false;
    this.pendingRequests = new Map();
  }

  get url() {
    return `ws://${this.host}:${this.port}`;
  }

  get isConnected() {
    return this.connected;
  }

  /**
   * Establish WebSocket connection
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.connected = true;
          console.log(`Connected to browser at ${this.url}`);
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const response = JSON.parse(data);
            const { id } = response;

            if (this.pendingRequests.has(id)) {
              const { resolve: resolveRequest } = this.pendingRequests.get(id);
              this.pendingRequests.delete(id);
              clearTimeout(this.pendingRequests.get(`timeout_${id}`));
              resolveRequest(response);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        });

        this.ws.on('error', (err) => {
          this.connected = false;
          reject(new BassetHoundConnectionError(`Failed to connect to ${this.url}: ${err.message}`));
        });

        this.ws.on('close', () => {
          this.connected = false;
          console.log('Disconnected from browser');
        });
      } catch (err) {
        reject(new BassetHoundConnectionError(`Failed to connect to ${this.url}: ${err.message}`));
      }
    });
  }

  /**
   * Close WebSocket connection
   */
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
      console.log('Disconnected from browser');
    }
  }

  /**
   * Send command to browser and get response
   * @param {string} command - Command name
   * @param {object} params - Command parameters
   * @returns {Promise<object>} Response with success and data
   */
  async sendCommand(command, params = {}) {
    if (!this.connected) {
      if (this.autoReconnect) {
        await this.connect();
      } else {
        throw new BassetHoundConnectionError('Not connected to browser');
      }
    }

    this.commandId += 1;
    const id = String(this.commandId);
    const request = {
      id,
      command,
      ...params
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.pendingRequests.delete(`timeout_${id}`);
        reject(new BassetHoundTimeoutError(`Command '${command}' timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject });
      this.pendingRequests.set(`timeout_${id}`, timeoutId);

      try {
        this.ws.send(JSON.stringify(request));
      } catch (err) {
        this.connected = false;
        this.pendingRequests.delete(id);
        this.pendingRequests.delete(`timeout_${id}`);
        clearTimeout(timeoutId);
        reject(new BassetHoundClientError(`Command failed: ${err.message}`));
      }
    });
  }

  // ========== Navigation Commands ==========

  async navigate(url, waitUntil = 'load') {
    return this.sendCommand('navigate', { url, wait_until: waitUntil });
  }

  async getUrl() {
    const response = await this.sendCommand('get_url');
    return response.data?.url || '';
  }

  async getTitle() {
    const response = await this.sendCommand('get_title');
    return response.data?.title || '';
  }

  async goBack() {
    return this.sendCommand('go_back');
  }

  async goForward() {
    return this.sendCommand('go_forward');
  }

  async reload(force = false) {
    return this.sendCommand('reload', { force });
  }

  // ========== Interaction Commands ==========

  async click(selector) {
    return this.sendCommand('click', { selector });
  }

  async fill(selector, text) {
    return this.sendCommand('fill', { selector, text });
  }

  async type(selector, text) {
    return this.sendCommand('type', { selector, text });
  }

  async scroll(x = 0, y = 500) {
    return this.sendCommand('scroll', { x, y });
  }

  async waitForElement(selector, timeout = 10000) {
    return this.sendCommand('wait_for_element', { selector, timeout });
  }

  // ========== Content Extraction ==========

  async getContent() {
    const response = await this.sendCommand('get_content');
    return response.data || {};
  }

  async getPageState() {
    const response = await this.sendCommand('get_page_state');
    return response.data || {};
  }

  async extractLinks() {
    const response = await this.sendCommand('extract_links');
    return response.data?.links || [];
  }

  async extractForms() {
    const response = await this.sendCommand('extract_forms');
    return response.data?.forms || [];
  }

  // ========== Screenshots ==========

  async screenshot() {
    const response = await this.sendCommand('screenshot');
    return response.data;
  }

  // ========== JavaScript Execution ==========

  async executeScript(script) {
    const response = await this.sendCommand('execute_script', { script });
    return response.data;
  }

  // ========== Cookie Management ==========

  async getCookies(url = null) {
    const params = url ? { url } : {};
    const response = await this.sendCommand('get_cookies', params);
    return response.data?.cookies || [];
  }

  async setCookies(cookies) {
    return this.sendCommand('set_cookies', { cookies });
  }

  async clearCookies() {
    return this.sendCommand('clear_cookies');
  }

  // ========== Proxy Management ==========

  async setProxy(host, port, proxyType = 'http') {
    return this.sendCommand('set_proxy', { host, port, type: proxyType });
  }

  async getProxyStatus() {
    const response = await this.sendCommand('get_proxy_status');
    return response.data || {};
  }

  async clearProxy() {
    return this.sendCommand('clear_proxy');
  }

  // ========== User Agent Management ==========

  async getUserAgentStatus() {
    const response = await this.sendCommand('get_user_agent_status');
    return response.data || {};
  }

  async setUserAgent(userAgent) {
    return this.sendCommand('set_user_agent', { userAgent });
  }

  async rotateUserAgent() {
    return this.sendCommand('rotate_user_agent');
  }

  // ========== Tor Integration ==========

  async getTorMode() {
    const response = await this.sendCommand('get_tor_mode');
    return response.data?.mode || 'off';
  }

  async setTorMode(mode) {
    return this.sendCommand('set_tor_mode', { mode });
  }

  async torNewIdentity() {
    return this.sendCommand('tor_new_identity');
  }

  // ========== Health Check ==========

  async ping() {
    try {
      const response = await this.sendCommand('ping');
      return response.success || false;
    } catch (err) {
      return false;
    }
  }
}

// Convenience functions

/**
 * Quick helper to navigate and get content
 */
async function quickNavigate(url, host = 'localhost', port = 8765) {
  const browser = new BassetHoundClient(host, port);
  try {
    await browser.connect();
    await browser.navigate(url);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
    const content = await browser.getContent();
    return content.text || '';
  } finally {
    await browser.disconnect();
  }
}

/**
 * Quick helper to navigate and take screenshot
 */
async function quickScreenshot(url, host = 'localhost', port = 8765) {
  const browser = new BassetHoundClient(host, port);
  try {
    await browser.connect();
    await browser.navigate(url);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
    return await browser.screenshot();
  } finally {
    await browser.disconnect();
  }
}

module.exports = {
  BassetHoundClient,
  BassetHoundClientError,
  BassetHoundConnectionError,
  BassetHoundTimeoutError,
  quickNavigate,
  quickScreenshot
};

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const url = args[0];

    (async () => {
      const browser = new BassetHoundClient();
      try {
        console.log(`Navigating to ${url}...`);
        await browser.connect();
        await browser.navigate(url);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const title = await browser.getTitle();
        console.log(`Title: ${title}`);

        const links = await browser.extractLinks();
        console.log(`Found ${links.length} links`);
      } catch (err) {
        console.error('Error:', err.message);
      } finally {
        await browser.disconnect();
      }
    })();
  } else {
    console.log('Node.js Client Library for Basset Hound Browser');
    console.log('Usage: node nodejs_client.js <url>');
  }
}
