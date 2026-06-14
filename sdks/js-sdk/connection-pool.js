/**
 * Basset Hound Browser - Connection Pool
 * Manages multiple client connections for high-performance operations
 * v12.2.0
 */

const { BrowserClient } = require('./basset-hound.js');

/**
 * Connection Pool - Manages multiple BrowserClient instances
 * Provides load balancing and connection reuse
 */
class ConnectionPool {
  /**
   * Initialize connection pool
   * @param {string} wsUrl WebSocket URL
   * @param {number} maxConnections Max number of connections (default: 5)
   * @param {object} options BrowserClient options
   */
  constructor(wsUrl = 'ws://localhost:8765', maxConnections = 5, options = {}) {
    this.wsUrl = wsUrl;
    this.maxConnections = maxConnections;
    this.options = options;
    this.clients = [];
    this.activeConnections = new Set();
    this.requestQueue = [];
    this.isInitialized = false;
  }

  /**
   * Initialize and connect all clients in the pool
   * @returns {Promise<void>}
   */
  async connectAll() {
    if (this.isInitialized) {
      return;
    }

    // Create clients
    for (let i = 0; i < this.maxConnections; i++) {
      const client = new BrowserClient(this.wsUrl, this.options);
      this.clients.push(client);
    }

    // Connect all clients in parallel
    const connections = this.clients.map(client => client.connect());
    await Promise.all(connections);
    this.isInitialized = true;
  }

  /**
   * Get the least busy client (one with fewest pending operations)
   * @returns {BrowserClient}
   */
  getLeastBusyClient() {
    if (!this.clients.length) {
      throw new Error('No clients available. Call connectAll() first.');
    }

    // Find client with fewest pending responses
    let leastBusyClient = this.clients[0];
    let minPending = this.clients[0].pendingResponses.size;

    for (let i = 1; i < this.clients.length; i++) {
      const pendingCount = this.clients[i].pendingResponses.size;
      if (pendingCount < minPending) {
        minPending = pendingCount;
        leastBusyClient = this.clients[i];
      }
    }

    return leastBusyClient;
  }

  /**
   * Get a round-robin client
   * @returns {BrowserClient}
   */
  getRoundRobinClient() {
    if (!this.clients.length) {
      throw new Error('No clients available. Call connectAll() first.');
    }

    if (!this.roundRobinIndex) {
      this.roundRobinIndex = 0;
    }

    const client = this.clients[this.roundRobinIndex];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.clients.length;
    return client;
  }

  /**
   * Execute a command using the least busy client
   * @param {string} command Command name
   * @param {object} kwargs Command parameters
   * @param {string} strategy 'least-busy' or 'round-robin' (default: 'least-busy')
   * @returns {Promise<CommandResponse>}
   */
  async executeCommand(command, kwargs = {}, strategy = 'least-busy') {
    if (!this.isInitialized) {
      throw new Error('Pool not initialized. Call connectAll() first.');
    }

    let client;
    if (strategy === 'round-robin') {
      client = this.getRoundRobinClient();
    } else {
      client = this.getLeastBusyClient();
    }

    return client.sendCommand(command, kwargs);
  }

  /**
   * Execute batch of commands across pool
   * Distributes work among available clients
   * @param {Array} operations Array of {command, ...params}
   * @returns {Promise<Array>} Array of CommandResponse objects
   */
  async executeBatch(operations) {
    if (!this.isInitialized) {
      throw new Error('Pool not initialized. Call connectAll() first.');
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('executeBatch() requires non-empty array of operations');
    }

    // Distribute operations across clients
    const results = new Array(operations.length);
    const operationsByClient = new Map();

    // Assign operations to least busy clients
    for (let i = 0; i < operations.length; i++) {
      const client = this.getLeastBusyClient();
      if (!operationsByClient.has(client)) {
        operationsByClient.set(client, []);
      }
      operationsByClient.get(client).push({ index: i, operation: operations[i] });
    }

    // Execute operations in parallel on their assigned clients
    const promises = [];
    for (const [client, ops] of operationsByClient.entries()) {
      for (const { index, operation } of ops) {
        const { command, ...params } = operation;
        const promise = client.sendCommand(command, params)
          .then(response => {
            results[index] = response;
          })
          .catch(error => {
            results[index] = {
              success: false,
              error: error.message,
              command: operation.command
            };
          });
        promises.push(promise);
      }
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Execute command with retry across pool
   * If a client fails, try with another client
   * @param {string} command Command name
   * @param {object} kwargs Command parameters
   * @param {number} maxRetries Max retry attempts (default: 2)
   * @returns {Promise<CommandResponse>}
   */
  async executeWithRetry(command, kwargs = {}, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = this.getLeastBusyClient();
        return await client.sendCommand(command, kwargs);
      } catch (error) {
        lastError = error;
        // Try next client on retry
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Execute command with timeout
   * @param {string} command Command name
   * @param {object} kwargs Command parameters
   * @param {number} timeoutMs Timeout in milliseconds
   * @returns {Promise<CommandResponse>}
   */
  async executeWithTimeout(command, kwargs = {}, timeoutMs = 30000) {
    return Promise.race([
      this.executeCommand(command, kwargs),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Close all connections in the pool
   * @returns {Promise<void>}
   */
  async closeAll() {
    const disconnects = this.clients.map(client => client.disconnect());
    await Promise.all(disconnects);
    this.clients = [];
    this.isInitialized = false;
  }

  /**
   * Get pool statistics
   * @returns {object} Pool stats
   */
  getStats() {
    const total = this.clients.length;
    let active = 0;
    let totalPending = 0;

    for (const client of this.clients) {
      if (client.isConnected()) {
        active++;
      }
      totalPending += client.pendingResponses.size;
    }

    return {
      total,
      active,
      idle: total - active,
      totalPending,
      avgPendingPerClient: total > 0 ? totalPending / total : 0
    };
  }

  /**
   * Get detailed stats for each client
   * @returns {Array} Array of client stats
   */
  getDetailedStats() {
    return this.clients.map((client, index) => ({
      clientId: index,
      connected: client.isConnected(),
      pendingRequests: client.pendingResponses.size,
      messageQueueLength: client.messageQueue.length,
      checkpoints: client.checkpoints.size,
      sessionId: client.sessionId
    }));
  }

  /**
   * Health check all clients
   * @returns {Promise<object>} Health status of each client
   */
  async healthCheckAll() {
    const results = {};

    for (let i = 0; i < this.clients.length; i++) {
      try {
        results[`client_${i}`] = await this.clients[i].healthCheck();
      } catch (error) {
        results[`client_${i}`] = false;
      }
    }

    return results;
  }

  /**
   * Reconnect a specific client
   * @param {number} clientIndex Index of client to reconnect
   * @returns {Promise<void>}
   */
  async reconnectClient(clientIndex) {
    if (clientIndex < 0 || clientIndex >= this.clients.length) {
      throw new Error(`Invalid client index: ${clientIndex}`);
    }

    const client = this.clients[clientIndex];
    await client.disconnect();
    await client.connect();
  }

  /**
   * Reconnect all disconnected clients
   * @returns {Promise<void>}
   */
  async reconnectAll() {
    const reconnects = this.clients.map(client => {
      if (!client.isConnected()) {
        return client.connect();
      }
      return Promise.resolve();
    });
    await Promise.all(reconnects);
  }

  /**
   * Wait for all pending operations to complete
   * @param {number} timeoutMs Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForAll(timeoutMs = 30000) {
    const startTime = Date.now();

    while (true) {
      const hasPending = this.clients.some(c => c.pendingResponses.size > 0);
      if (!hasPending) {
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`waitForAll() timed out after ${timeoutMs}ms`);
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  /**
   * Create a connection pool with pre-configured defaults
   * @param {object} options Configuration options
   * @returns {ConnectionPool}
   */
  static create(options = {}) {
    const {
      wsUrl = 'ws://localhost:8765',
      maxConnections = 5,
      timeout = 30000,
      autoReconnect = true,
      debug = false
    } = options;

    const pool = new ConnectionPool(wsUrl, maxConnections, {
      timeout,
      autoReconnect,
      debug
    });

    return pool;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConnectionPool };
}

if (typeof exports !== 'undefined') {
  exports.ConnectionPool = ConnectionPool;
}
