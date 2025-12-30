/**
 * Test Server - WebSocket Server for Integration Testing
 *
 * Provides a configurable WebSocket server that can simulate the Basset Hound
 * browser's WebSocket interface for testing extension-browser communication.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Test Server for integration testing
 */
class TestServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.port = options.port || 8765;
    this.path = options.path || '/';
    this.wss = null;
    this.clients = new Map();
    this.messageLog = [];
    this.commandHandlers = new Map();
    this.pendingResponses = new Map();
    this.messageIdCounter = 1;
    this.isRunning = false;

    // Configuration
    this.config = {
      logMessages: options.logMessages !== false,
      maxLogSize: options.maxLogSize || 1000,
      responseTimeout: options.responseTimeout || 30000,
      ...options
    };

    // Default command handlers
    this.setupDefaultHandlers();
  }

  /**
   * Setup default command handlers
   */
  setupDefaultHandlers() {
    // Ping handler
    this.commandHandlers.set('ping', async () => ({
      success: true,
      message: 'pong',
      timestamp: Date.now()
    }));

    // Status handler
    this.commandHandlers.set('status', async () => ({
      success: true,
      status: {
        ready: true,
        clients: this.clients.size,
        port: this.port,
        uptime: process.uptime()
      }
    }));

    // Echo handler for testing
    this.commandHandlers.set('echo', async (params) => ({
      success: true,
      echo: params
    }));
  }

  /**
   * Start the WebSocket server
   * @returns {Promise} Resolves when server is listening
   */
  start() {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        resolve(this);
        return;
      }

      try {
        this.wss = new WebSocket.Server({
          port: this.port,
          path: this.path
        });

        this.wss.on('listening', () => {
          this.isRunning = true;
          console.log(`[TestServer] Listening on ws://localhost:${this.port}${this.path}`);
          this.emit('listening');
          resolve(this);
        });

        this.wss.on('connection', (ws, req) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('error', (error) => {
          console.error('[TestServer] Server error:', error);
          this.emit('error', error);
          if (!this.isRunning) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise} Resolves when server is closed
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      this.clients.forEach((info, ws) => {
        ws.close(1000, 'Server shutting down');
      });
      this.clients.clear();

      this.wss.close(() => {
        this.isRunning = false;
        console.log('[TestServer] Server stopped');
        this.emit('closed');
        resolve();
      });
    });
  }

  /**
   * Handle new client connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request
   */
  handleConnection(ws, req) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const clientInfo = {
      id: clientId,
      connectedAt: new Date(),
      address: req.socket.remoteAddress,
      messageCount: 0,
      type: 'unknown' // Will be set based on identification
    };

    this.clients.set(ws, clientInfo);
    ws.clientId = clientId;

    console.log(`[TestServer] Client connected: ${clientId}`);
    this.emit('connection', { clientId, clientInfo, ws });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'status',
      message: 'connected',
      clientId
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        clientInfo.messageCount++;
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error('[TestServer] Message parse error:', error);
        this.sendToClient(ws, {
          success: false,
          error: 'Invalid JSON message'
        });
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[TestServer] Client disconnected: ${clientId} (code: ${code})`);
      this.clients.delete(ws);
      this.emit('disconnection', { clientId, code, reason: reason.toString() });
    });

    ws.on('error', (error) => {
      console.error(`[TestServer] Client error (${clientId}):`, error);
      this.emit('clientError', { clientId, error });
    });
  }

  /**
   * Handle incoming message from client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Parsed message
   */
  async handleMessage(ws, message) {
    const clientInfo = this.clients.get(ws);

    // Log message
    if (this.config.logMessages) {
      this.logMessage('received', message, clientInfo?.id);
    }

    this.emit('message', { message, clientId: clientInfo?.id });

    // Handle heartbeat
    if (message.type === 'heartbeat') {
      this.emit('heartbeat', { clientId: clientInfo?.id, timestamp: message.timestamp });
      return;
    }

    // Handle status updates from clients
    if (message.type === 'status') {
      this.emit('clientStatus', { clientId: clientInfo?.id, status: message.status });
      return;
    }

    // Handle command responses (when we send commands to extension)
    if (message.command_id && this.pendingResponses.has(message.command_id)) {
      const { resolve } = this.pendingResponses.get(message.command_id);
      this.pendingResponses.delete(message.command_id);
      resolve(message);
      return;
    }

    // Handle commands from clients (browser sends commands)
    if (message.command) {
      const response = await this.processCommand(message);
      this.sendToClient(ws, {
        id: message.id,
        command: message.command,
        ...response
      });
      return;
    }

    // Unknown message format
    this.emit('unknownMessage', { message, clientId: clientInfo?.id });
  }

  /**
   * Process a command and return response
   * @param {Object} command - Command object
   * @returns {Object} Response
   */
  async processCommand(command) {
    const { command: type, ...params } = command;
    const handler = this.commandHandlers.get(type);

    if (!handler) {
      return { success: false, error: `Unknown command: ${type}` };
    }

    try {
      const handlerResult = await handler(params);
      // Return the handler result directly - don't wrap in 'result' property
      // This maintains compatibility with the expected response format
      return handlerResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Register a command handler
   * @param {string} command - Command name
   * @param {Function} handler - Handler function (params) => response
   */
  registerHandler(command, handler) {
    this.commandHandlers.set(command, handler);
  }

  /**
   * Remove a command handler
   * @param {string} command - Command name
   */
  unregisterHandler(command) {
    this.commandHandlers.delete(command);
  }

  /**
   * Send message to a specific client
   * @param {WebSocket} ws - Client WebSocket
   * @param {Object} message - Message to send
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      const data = JSON.stringify(message);
      ws.send(data);

      if (this.config.logMessages) {
        const clientInfo = this.clients.get(ws);
        this.logMessage('sent', message, clientInfo?.id);
      }
    }
  }

  /**
   * Send command to a client and wait for response
   * @param {WebSocket} ws - Client WebSocket
   * @param {string} type - Command type
   * @param {Object} params - Command parameters
   * @param {number} timeout - Response timeout
   * @returns {Promise<Object>} Response
   */
  sendCommand(ws, type, params = {}, timeout = this.config.responseTimeout) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Client not connected'));
        return;
      }

      const commandId = `cmd-${Date.now()}-${this.messageIdCounter++}`;

      const command = {
        command_id: commandId,
        type,
        params
      };

      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(commandId);
        reject(new Error(`Command timeout: ${type}`));
      }, timeout);

      this.pendingResponses.set(commandId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });

      this.sendToClient(ws, command);
    });
  }

  /**
   * Broadcast message to all clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    this.clients.forEach((info, ws) => {
      this.sendToClient(ws, message);
    });
  }

  /**
   * Broadcast command to all clients and wait for all responses
   * @param {string} type - Command type
   * @param {Object} params - Command parameters
   * @returns {Promise<Array>} Array of responses
   */
  async broadcastCommand(type, params = {}) {
    const promises = [];

    this.clients.forEach((info, ws) => {
      promises.push(this.sendCommand(ws, type, params));
    });

    return Promise.all(promises);
  }

  /**
   * Get a connected client by type or first available
   * @param {string} type - Client type (optional)
   * @returns {WebSocket|null} Client WebSocket
   */
  getClient(type = null) {
    for (const [ws, info] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        if (!type || info.type === type) {
          return ws;
        }
      }
    }
    return null;
  }

  /**
   * Get all connected clients
   * @returns {Array} Array of client info objects
   */
  getClients() {
    const clients = [];
    this.clients.forEach((info, ws) => {
      clients.push({
        ...info,
        readyState: ws.readyState
      });
    });
    return clients;
  }

  /**
   * Wait for a client to connect
   * @param {number} timeout - Connection timeout
   * @returns {Promise<WebSocket>} Connected client
   */
  waitForClient(timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already connected
      const existing = this.getClient();
      if (existing) {
        resolve(existing);
        return;
      }

      const timeoutId = setTimeout(() => {
        this.removeListener('connection', onConnect);
        reject(new Error('Client connection timeout'));
      }, timeout);

      const onConnect = ({ ws }) => {
        clearTimeout(timeoutId);
        resolve(ws);
      };

      this.once('connection', onConnect);
    });
  }

  /**
   * Log a message
   * @param {string} direction - 'sent' or 'received'
   * @param {Object} message - Message object
   * @param {string} clientId - Client ID
   */
  logMessage(direction, message, clientId) {
    const logEntry = {
      direction,
      clientId,
      message,
      timestamp: Date.now()
    };

    this.messageLog.push(logEntry);

    // Trim log if too large
    while (this.messageLog.length > this.config.maxLogSize) {
      this.messageLog.shift();
    }
  }

  /**
   * Get message log
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered message log
   */
  getMessageLog(filter = {}) {
    let log = [...this.messageLog];

    if (filter.direction) {
      log = log.filter(entry => entry.direction === filter.direction);
    }

    if (filter.clientId) {
      log = log.filter(entry => entry.clientId === filter.clientId);
    }

    if (filter.command) {
      log = log.filter(entry =>
        entry.message.command === filter.command ||
        entry.message.type === filter.command
      );
    }

    if (filter.limit) {
      log = log.slice(-filter.limit);
    }

    return log;
  }

  /**
   * Clear message log
   */
  clearMessageLog() {
    this.messageLog = [];
  }

  /**
   * Get server status
   * @returns {Object} Server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      path: this.path,
      clients: this.getClients(),
      clientCount: this.clients.size,
      messageLogSize: this.messageLog.length,
      pendingResponses: this.pendingResponses.size
    };
  }
}

module.exports = { TestServer };
