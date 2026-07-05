/**
 * Basset Hound Browser - JavaScript SDK v12.2.0
 * Full-featured async JavaScript SDK for browser automation and OSINT
 *
 * Installation:
 *   npm install basset-hound-sdk
 *
 * Usage (Node.js):
 *   const { BrowserClient } = require('basset-hound-sdk');
 *   const client = new BrowserClient('ws://localhost:8765');
 *   await client.connect();
 *   await client.navigate('https://example.com');
 *
 * Usage (Browser/ESM):
 *   import { BrowserClient } from 'basset-hound-sdk/esm';
 *   const client = new BrowserClient('wss://browser.example.com:8765');
 */

const WebSocket = typeof require !== 'undefined' ? require('ws') : global.WebSocket;

/**
 * Represents a session checkpoint
 */
class SessionCheckpoint {
  constructor(id, name, timestamp, state = {}) {
    this.id = id;
    this.name = name;
    this.timestamp = timestamp;
    this.state = state;
    this.metadata = {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      state: this.state,
      metadata: this.metadata
    };
  }
}

/**
 * Command response wrapper
 */
class CommandResponse {
  constructor(data = {}) {
    this.id = data.id || '';
    this.command = data.command || '';
    this.success = data.success || false;
    this.data = data.data || null;
    this.error = data.error || null;
    this.recovery = data.recovery || null;
    this.executionTime = data.executionTime || 0;
  }

  static fromJSON(data) {
    return new CommandResponse(data);
  }

  isSuccess() {
    return this.success === true;
  }

  isError() {
    return this.success === false;
  }

  hasRecovery() {
    return this.recovery !== null;
  }
}

/**
 * Main Basset Hound Browser Client
 */
class BrowserClient {
  /**
   * Initialize client
   *
   * @param {string} wsUrl - WebSocket URL (default: ws://localhost:8765)
   * @param {object} options - Configuration options
   * @param {number} options.timeout - Request timeout in ms (default: 30000)
   * @param {boolean} options.autoReconnect - Auto-reconnect (default: true)
   * @param {number} options.reconnectDelay - Reconnect delay in ms (default: 1000)
   * @param {number} options.maxRetries - Max command retries (default: 3)
   * @param {boolean} options.debug - Enable debug logging (default: false)
   */
  constructor(
    wsUrl = 'ws://localhost:8765',
    options = {}
  ) {
    this.wsUrl = wsUrl;
    this.timeout = options.timeout || 30000;
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxRetries = options.maxRetries || 3;
    this.debug = options.debug || false;

    this.ws = null;
    this.connected = false;
    this.pendingResponses = new Map();
    this.messageQueue = [];
    this.reconnectAttempts = 0;

    // Session management
    this.sessionId = null;
    this.checkpoints = new Map();
    this.currentCheckpoint = null;

    // Event handlers
    this.eventHandlers = {
      connect: [],
      disconnect: [],
      error: [],
      message: []
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.log('Connecting to ' + this.wsUrl);

        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.log('Connected to server');
          this._emit('connect');

          // Process queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(message);
          }

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._handleMessage(data);
            this._emit('message', data);
          } catch (e) {
            this.error('Failed to parse message: ' + e.message);
          }
        };

        this.ws.onerror = (error) => {
          this.error('WebSocket error: ' + error.message);
          this._emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.log('Disconnected from server');
          this._emit('disconnect');

          if (this.autoReconnect && this.reconnectAttempts < 5) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Disconnect from server
   */
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }

  /**
   * Send command to server
   */
  async sendCommand(command, kwargs = {}, retryCount = 0) {
    const startTime = Date.now();

    if (!this.connected) {
      if (this.autoReconnect && retryCount < this.maxRetries) {
        await this.connect();
        return this.sendCommand(command, kwargs, retryCount + 1);
      }
      throw new Error('Not connected. Call connect() first.');
    }

    const requestId = this._generateId();
    const message = {
      id: requestId,
      command: command,
      ...kwargs
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        if (retryCount < this.maxRetries) {
          this.log(`Command ${command} timed out, retrying...`);
          this.sendCommand(command, kwargs, retryCount + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Command ${command} timed out after ${this.maxRetries} retries`));
        }
      }, this.timeout);

      // Store response handler
      this.pendingResponses.set(requestId, {
        resolve: (data) => {
          clearTimeout(timeoutId);
          const response = CommandResponse.fromJSON(data);
          response.executionTime = Date.now() - startTime;
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send message
      const jsonMessage = JSON.stringify(message);
      if (this.connected) {
        this.ws.send(jsonMessage);
      } else {
        this.messageQueue.push(jsonMessage);
      }
    });
  }

  /**
   * Handle incoming message
   */
  _handleMessage(data) {
    const responseId = data.id;
    if (responseId && this.pendingResponses.has(responseId)) {
      const handler = this.pendingResponses.get(responseId);
      this.pendingResponses.delete(responseId);
      handler.resolve(data);
    }
  }

  // ==========================================
  // NAVIGATION COMMANDS
  // ==========================================

  async navigate(url, options = {}) {
    return this.sendCommand('navigate', {
      url,
      wait_time: options.waitTime || 0,
      wait_for: options.waitFor || null
    });
  }

  async goBack() {
    return this.sendCommand('go_back');
  }

  async goForward() {
    return this.sendCommand('go_forward');
  }

  async refresh(hard = false) {
    return this.sendCommand('refresh', { hard });
  }

  async getUrl() {
    return this.sendCommand('get_url');
  }

  async getTitle() {
    return this.sendCommand('get_title');
  }

  // ==========================================
  // INTERACTION COMMANDS
  // ==========================================

  async click(selector, options = {}) {
    return this.sendCommand('click', {
      selector,
      humanize: options.humanize !== false
    });
  }

  async fill(selector, value, options = {}) {
    return this.sendCommand('fill', {
      selector,
      value,
      humanize: options.humanize !== false
    });
  }

  async typeText(text, options = {}) {
    return this.sendCommand('type_text', {
      text,
      selector: options.selector || null,
      humanize: options.humanize !== false
    });
  }

  async scroll(options = {}) {
    return this.sendCommand('scroll', {
      x: options.x || null,
      y: options.y || null,
      selector: options.selector || null,
      humanize: options.humanize !== false
    });
  }

  async hover(selector) {
    return this.sendCommand('hover', { selector });
  }

  async waitForElement(selector, timeout = 10000) {
    return this.sendCommand('wait_for_element', {
      selector,
      timeout
    });
  }

  async executeScript(script) {
    return this.sendCommand('execute_script', { script });
  }

  // ==========================================
  // CONTENT EXTRACTION COMMANDS
  // ==========================================

  async getContent() {
    return this.sendCommand('get_content');
  }

  async getPageState() {
    return this.sendCommand('get_page_state');
  }

  async extractLinks(options = {}) {
    return this.sendCommand('extract_links', {
      include_external: options.includeExternal !== false
    });
  }

  async extractForms() {
    return this.sendCommand('extract_forms');
  }

  async extractImages(options = {}) {
    return this.sendCommand('extract_images', {
      include_lazy: options.includeLazy !== false
    });
  }

  async extractMetadata() {
    return this.sendCommand('extract_metadata');
  }

  async extractAll() {
    return this.sendCommand('extract_all');
  }

  async detectTechnology() {
    return this.sendCommand('detect_technology');
  }

  // ==========================================
  // SCREENSHOT COMMANDS
  // ==========================================

  async screenshot(options = {}) {
    return this.sendCommand('screenshot', {
      format: options.format || 'png',
      quality: options.quality || 90
    });
  }

  async screenshotViewport(options = {}) {
    return this.sendCommand('screenshot_viewport', {
      format: options.format || 'png'
    });
  }

  async screenshotFullPage(options = {}) {
    return this.sendCommand('screenshot_full_page', {
      format: options.format || 'png'
    });
  }

  async screenshotElement(selector, options = {}) {
    return this.sendCommand('screenshot_element', {
      selector,
      format: options.format || 'png'
    });
  }

  async screenshotForensic(options = {}) {
    return this.sendCommand('screenshot_forensic', {
      include_hash: options.includeHash !== false,
      include_signature: options.includeSignature !== false
    });
  }

  // ==========================================
  // COOKIE & STORAGE COMMANDS
  // ==========================================

  async getCookies(url) {
    return this.sendCommand('get_cookies', { url });
  }

  async setCookie(name, value, options = {}) {
    return this.sendCommand('set_cookie', {
      name,
      value,
      ...options
    });
  }

  async deleteCookie(name) {
    return this.sendCommand('delete_cookie', { name });
  }

  async getLocalStorage() {
    return this.sendCommand('get_local_storage');
  }

  async getSessionStorage() {
    return this.sendCommand('get_session_storage');
  }

  // ==========================================
  // SESSION PERSISTENCE COMMANDS (v12.2.0)
  // ==========================================

  async createCheckpoint(checkpointName, description = null) {
    const result = await this.sendCommand('create_checkpoint', {
      checkpoint_name: checkpointName,
      description
    });

    if (result.isSuccess()) {
      const checkpoint = new SessionCheckpoint(
        result.data.checkpointId,
        checkpointName,
        result.data.timestamp
      );
      this.checkpoints.set(checkpoint.id, checkpoint);
      this.currentCheckpoint = checkpoint.id;
      return result.data;
    }

    throw new Error('Failed to create checkpoint: ' + result.error);
  }

  async rollbackToCheckpoint(checkpointId) {
    if (!this.checkpoints.has(checkpointId)) {
      throw new Error('Checkpoint not found: ' + checkpointId);
    }

    const result = await this.sendCommand('rollback_to_checkpoint', {
      checkpoint_id: checkpointId
    });

    if (result.isSuccess()) {
      this.currentCheckpoint = checkpointId;
      return result.data;
    }

    throw new Error('Failed to rollback: ' + result.error);
  }

  async listCheckpoints() {
    const result = await this.sendCommand('list_checkpoints');
    if (result.isSuccess()) {
      return result.data.checkpoints || [];
    }
    throw new Error('Failed to list checkpoints: ' + result.error);
  }

  async deleteCheckpoint(checkpointId) {
    const result = await this.sendCommand('delete_checkpoint', {
      checkpoint_id: checkpointId
    });

    if (result.isSuccess()) {
      this.checkpoints.delete(checkpointId);
      if (this.currentCheckpoint === checkpointId) {
        this.currentCheckpoint = null;
      }
      return true;
    }

    throw new Error('Failed to delete checkpoint: ' + result.error);
  }

  async branchSession(checkpointId, branchName = null) {
    const result = await this.sendCommand('branch_session', {
      checkpoint_id: checkpointId,
      branch_name: branchName
    });

    if (result.isSuccess()) {
      return result.data;
    }

    throw new Error('Failed to branch session: ' + result.error);
  }

  async resumeSession(checkpointId, recoveryOptions = {}) {
    const result = await this.sendCommand('resume_session', {
      checkpoint_id: checkpointId,
      recovery_options: recoveryOptions
    });

    if (result.isSuccess()) {
      return result.data;
    }

    throw new Error('Failed to resume session: ' + result.error);
  }

  // ==========================================
  // EVASION COMMANDS
  // ==========================================

  async applyFingerprint(profileName, options = {}) {
    return this.sendCommand('apply_fingerprint', {
      profile_name: profileName,
      ...options
    });
  }

  async rotateUserAgent() {
    return this.sendCommand('rotate_user_agent');
  }

  async setProxy(proxyUrl, credentials = null) {
    return this.sendCommand('set_proxy', {
      proxy_url: proxyUrl,
      username: credentials?.username || null,
      password: credentials?.password || null
    });
  }

  async enableTor() {
    return this.sendCommand('enable_tor');
  }

  async disableTor() {
    return this.sendCommand('disable_tor');
  }

  // ==========================================
  // BATCH OPERATIONS
  // ==========================================

  async batchCommands(commands) {
    const promises = commands.map(cmd => {
      const { command, ...kwargs } = cmd;
      return this.sendCommand(command, kwargs);
    });

    return Promise.all(promises);
  }

  // ==========================================
  // MONITORING & ANALYTICS
  // ==========================================

  async startMonitoring(threshold = 10) {
    return this.sendCommand('start_monitoring', { threshold });
  }

  async stopMonitoring() {
    return this.sendCommand('stop_monitoring');
  }

  async checkPageChanges() {
    return this.sendCommand('check_page_changes');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  async healthCheck() {
    try {
      const result = await this.sendCommand('ping');
      return result.isSuccess();
    } catch {
      return false;
    }
  }

  isConnected() {
    return this.connected;
  }

  getSessionInfo() {
    return {
      connected: this.connected,
      sessionId: this.sessionId,
      currentCheckpoint: this.currentCheckpoint,
      checkpointCount: this.checkpoints.size
    };
  }

  // ==========================================
  // Wave 14: Tech Detection Commands
  // ==========================================

  async identifyCms(html = null) {
    const params = {};
    if (html) {
      params.html = html;
    }
    return this.sendCommand('identify_cms', params);
  }

  async identifyAnalytics(html = null) {
    const params = {};
    if (html) {
      params.html = html;
    }
    return this.sendCommand('identify_analytics', params);
  }

  // ==========================================
  // Wave 14: Competitor Monitoring Commands
  // ==========================================

  async addMonitor(url, name, frequency = 'daily', alerts = {}) {
    return this.sendCommand('add_monitor', { url, name, frequency, alerts });
  }

  async removeMonitor(monitorId) {
    return this.sendCommand('remove_monitor', { monitor_id: monitorId });
  }

  async updateMonitor(monitorId, updates) {
    return this.sendCommand('update_monitor', { monitor_id: monitorId, ...updates });
  }

  async getMonitor(monitorId) {
    return this.sendCommand('get_monitor', { monitor_id: monitorId });
  }

  async listMonitors(filter = {}) {
    return this.sendCommand('list_monitors', filter);
  }

  async pauseMonitor(monitorId) {
    return this.sendCommand('pause_monitor', { monitor_id: monitorId });
  }

  async resumeMonitor(monitorId) {
    return this.sendCommand('resume_monitor', { monitor_id: monitorId });
  }

  async checkMonitor(monitorId) {
    return this.sendCommand('check_monitor', { monitor_id: monitorId });
  }

  async getMonitorChanges(monitorId) {
    return this.sendCommand('get_monitor_changes', { monitor_id: monitorId });
  }

  async getMonitorSnapshots(monitorId) {
    return this.sendCommand('get_monitor_snapshots', { monitor_id: monitorId });
  }

  async getMonitorStats(monitorId) {
    return this.sendCommand('get_monitor_stats', { monitor_id: monitorId });
  }

  async startMonitoringService() {
    return this.sendCommand('start_monitoring_service', {});
  }

  async stopMonitoringService() {
    return this.sendCommand('stop_monitoring_service', {});
  }

  async pauseMonitoringService() {
    return this.sendCommand('pause_monitoring_service', {});
  }

  async resumeMonitoringService() {
    return this.sendCommand('resume_monitoring_service', {});
  }

  async getMonitoringServiceStatus() {
    return this.sendCommand('get_monitoring_service_status', {});
  }

  async getMonitoringServiceStats() {
    return this.sendCommand('get_monitoring_service_stats', {});
  }

  async configureMonitorAlerts(monitorId, alerts) {
    return this.sendCommand('configure_monitor_alerts', { monitor_id: monitorId, alerts });
  }

  async runMonitorCheck(monitorId) {
    return this.sendCommand('run_monitor_check', { monitor_id: monitorId });
  }

  async exportMonitors() {
    return this.sendCommand('export_monitors', {});
  }

  async importMonitors(data, merge = false) {
    return this.sendCommand('import_monitors', { data, merge });
  }

  async cleanupMonitoringData(daysOld = 30) {
    return this.sendCommand('cleanup_monitoring_data', { days_old: daysOld });
  }

  async clearAllMonitors() {
    return this.sendCommand('clear_all_monitors', {});
  }

  // ==========================================
  // Wave 14: Proxy Intelligence Commands
  // ==========================================

  async getProxyReputation(proxyAddress, sessionId = null) {
    return this.sendCommand('get_proxy_reputation', { proxy_address: proxyAddress, session_id: sessionId });
  }

  async setGeoLock(country = null, region = null, latitude = null, longitude = null) {
    return this.sendCommand('set_geo_lock', { country, region, latitude, longitude });
  }

  async getProxyAnalytics(sessionId = null, aggregate = false) {
    return this.sendCommand('get_proxy_analytics', { session_id: sessionId, aggregate });
  }

  // ==========================================
  // Wave 14: Session Checkpoint & Branching Commands
  // ==========================================

  async createSessionCheckpoint(label = '', description = '') {
    return this.sendCommand('create_session_checkpoint', { label, description });
  }

  async rollbackToCheckpoint(checkpointId) {
    return this.sendCommand('rollback_to_checkpoint', { checkpoint_id: checkpointId });
  }

  async listCheckpointsWave14() {
    // Note: Using different name to avoid conflict with existing listCheckpoints
    return this.sendCommand('list_checkpoints', {});
  }

  async getCheckpointDetails(checkpointId) {
    return this.sendCommand('get_checkpoint_details', { checkpoint_id: checkpointId });
  }

  async deleteSessionCheckpoint(checkpointId) {
    return this.sendCommand('delete_checkpoint', { checkpoint_id: checkpointId });
  }

  async branchSessionWave14(label = '') {
    // Note: Using different name to avoid conflict with existing branchSession
    return this.sendCommand('branch_session', { label });
  }

  async listBranches() {
    return this.sendCommand('list_branches', {});
  }

  async mergeBranch() {
    return this.sendCommand('merge_branch', {});
  }

  async detectFailure() {
    return this.sendCommand('detect_failure', {});
  }

  async getRecoveryStrategies(failureType = null) {
    return this.sendCommand('get_recovery_strategies', { failure_type: failureType });
  }

  async resumeSessionWave14(checkpointId) {
    // Note: Using different name to avoid conflict with existing resumeSession
    return this.sendCommand('resume_session', { checkpoint_id: checkpointId });
  }

  async exportCheckpoint(checkpointId, format = 'json') {
    return this.sendCommand('export_checkpoint', { checkpoint_id: checkpointId, format });
  }

  // ==========================================
  // STREAMING & BATCH OPERATIONS (v12.2.0+)
  // ==========================================

  /**
   * Stream a command response for large payloads
   * Useful for large screenshots, video frames, or bulk data
   * @param {string} command Command name
   * @param {object} kwargs Command parameters
   * @param {Function} onChunk Callback function for each chunk
   * @returns {Promise<Buffer>} Combined buffer of all chunks
   */
  async streamCommand(command, kwargs = {}, onChunk = null) {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    const requestId = this._generateId();
    const message = {
      id: requestId,
      command: command,
      stream: true,
      ...kwargs
    };

    return new Promise((resolve, reject) => {
      const chunks = [];
      const startTime = Date.now();
      const maxChunkSize = 64 * 1024; // 64KB chunks

      // Set up streaming timeout
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        reject(new Error(`Stream ${command} timed out`));
      }, this.timeout * 2); // Double timeout for streaming

      // Store stream handler
      this.pendingResponses.set(requestId, {
        isStream: true,
        resolve: (data) => {
          clearTimeout(timeoutId);
          const combined = Buffer.concat(chunks);
          const response = CommandResponse.fromJSON({
            id: requestId,
            command: command,
            success: true,
            data: { buffer: combined, size: combined.length },
            executionTime: Date.now() - startTime
          });
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        onChunk: (chunk) => {
          chunks.push(chunk);
          if (onChunk && typeof onChunk === 'function') {
            onChunk(chunk);
          }
        }
      });

      // Send message
      const jsonMessage = JSON.stringify(message);
      if (this.connected) {
        this.ws.send(jsonMessage);
      } else {
        this.messageQueue.push(jsonMessage);
      }
    });
  }

  /**
   * Execute multiple commands atomically
   * All commands succeed or all fail with rollback
   * @param {Array} operations Array of {command, ...params} objects
   * @returns {Promise<Array>} Array of CommandResponse objects
   */
  async batch(operations) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('batch() requires non-empty array of operations');
    }

    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    const startTime = Date.now();
    const batchId = this._generateId();
    const results = [];

    try {
      // Execute all commands in sequence or parallel (configurable)
      // For now, execute sequentially to maintain state
      for (const operation of operations) {
        const { command, ...params } = operation;
        const response = await this.sendCommand(command, params);
        results.push(response);

        // If any command fails, mark batch as failed
        if (!response.success) {
          throw new Error(`Batch command failed: ${command} - ${response.error}`);
        }
      }

      return results;
    } catch (error) {
      // On error, could implement rollback here
      this.log(`Batch operation failed after ${results.length} commands: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute multiple commands in parallel with concurrency limit
   * @param {Array} operations Array of {command, ...params} objects
   * @param {number} concurrency Maximum parallel operations (default: 5)
   * @returns {Promise<Array>} Array of CommandResponse objects
   */
  async batchParallel(operations, concurrency = 5) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('batchParallel() requires non-empty array of operations');
    }

    const results = new Array(operations.length);
    let index = 0;

    const execute = async () => {
      while (index < operations.length) {
        const currentIndex = index++;
        const operation = operations[currentIndex];
        const { command, ...params } = operation;
        try {
          results[currentIndex] = await this.sendCommand(command, params);
        } catch (error) {
          results[currentIndex] = new CommandResponse({
            id: '',
            command: command,
            success: false,
            error: error.message
          });
        }
      }
    };

    // Create workers up to concurrency limit
    const workers = Array(Math.min(concurrency, operations.length))
      .fill(null)
      .map(() => execute());

    await Promise.all(workers);
    return results;
  }

  // ==========================================
  // EVENT HANDLING
  // ==========================================

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  // ==========================================
  // LOGGING & DEBUGGING
  // ==========================================

  log(message) {
    if (this.debug) {
      console.log('[BrowserClient] ' + message);
    }
  }

  error(message) {
    console.error('[BrowserClient] ' + message);
  }

  _generateId() {
    return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BrowserClient, CommandResponse, SessionCheckpoint };
}

// ESM export
if (typeof exports !== 'undefined') {
  exports.BrowserClient = BrowserClient;
  exports.CommandResponse = CommandResponse;
  exports.SessionCheckpoint = SessionCheckpoint;
}

// Example usage
/*
async function example() {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    console.log('Connected');

    // Navigate to a website
    const nav = await client.navigate('https://example.com', { waitTime: 3000 });
    console.log('Navigation:', nav.success);

    // Create checkpoint
    const cp = await client.createCheckpoint('after-nav');
    console.log('Checkpoint:', cp.checkpointId);

    // Extract content
    const content = await client.getContent();
    console.log('Content extracted:', content.success);

    // Detect technology
    const tech = await client.detectTechnology();
    console.log('Technology:', tech.data);

    // Rollback to checkpoint
    await client.rollbackToCheckpoint(cp.checkpointId);
    console.log('Rolled back to checkpoint');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.disconnect();
  }
}

example();
*/
