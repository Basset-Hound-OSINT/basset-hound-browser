/**
 * WebSocket Client Service
 * Handles all WebSocket communication with the Basset Hound Browser backend
 * Includes auto-reconnect, message queuing, and event handling
 */

class WebSocketClient {
  constructor(url = 'ws://localhost:8765') {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.messageHandlers = new Map();
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.requestIdCounter = 0;
    this.pendingRequests = new Map();
    this.heartbeatInterval = null;
    this.messageTimeout = 30000;
  }

  /**
   * Connect to WebSocket server with auto-reconnect
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Message parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect().catch(() => {}), delay);
    } else {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('max-reconnect-attempts');
    }
  }

  /**
   * Send a command to the WebSocket server
   */
  send(command, params = {}) {
    const message = {
      command,
      params,
      timestamp: Date.now(),
      requestId: `req_${++this.requestIdCounter}`,
    };

    if (!this.isConnected) {
      this.messageQueue.push(message);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new Error(`Request timeout: ${command}`));
      }, this.messageTimeout);

      this.pendingRequests.set(message.requestId, {
        resolve,
        reject,
        timeoutHandle,
        command,
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingRequests.delete(message.requestId);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    const { requestId, command, data, error, type } = message;

    // Handle response to a pending request
    if (requestId && this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId);
      clearTimeout(request.timeoutHandle);
      this.pendingRequests.delete(requestId);

      if (error) {
        request.reject(new Error(error));
      } else {
        request.resolve(data);
      }
      return;
    }

    // Handle server broadcasts
    if (type === 'broadcast' && command) {
      this.emit(`broadcast:${command}`, data);
    }

    // Handle specific message handlers
    if (this.messageHandlers.has(command)) {
      const handlers = this.messageHandlers.get(command);
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          console.error('[WebSocket] Heartbeat error:', error);
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Subscribe to a specific command's broadcasts
   */
  subscribe(command, handler) {
    if (!this.messageHandlers.has(command)) {
      this.messageHandlers.set(command, []);
    }
    this.messageHandlers.get(command).push(handler);

    return () => {
      const handlers = this.messageHandlers.get(command);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit events
   */
  emit(eventName, data) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName).forEach((listener) => listener(data));
    }
  }

  /**
   * Add event listener
   */
  on(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(listener);

    return () => {
      const listeners = this.eventListeners.get(eventName);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Singleton instance
let instance;

export function getWebSocketClient(url = 'ws://localhost:8765') {
  if (!instance) {
    instance = new WebSocketClient(url);
  }
  return instance;
}

export default WebSocketClient;
