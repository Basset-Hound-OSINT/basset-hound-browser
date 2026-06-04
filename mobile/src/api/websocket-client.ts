/**
 * WebSocket Client Service for Mobile
 * Adapted for React Native with background reconnection and offline support
 */

import NetInfo from '@react-native-community/netinfo';

interface Message {
  command: string;
  params: Record<string, unknown>;
  timestamp: number;
  requestId: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
  command: string;
}

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageQueue: Message[] = [];
  private messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private eventListeners: Map<string, ((data: unknown) => void)[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 3000;
  private requestIdCounter: number = 0;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private heartbeatInterval: NodeJS.Timer | null = null;
  private messageTimeout: number = 30000;
  private networkUnsubscribe: (() => void) | null = null;

  constructor(url: string = 'ws://localhost:8765') {
    this.url = url;
    this.setupNetworkListener();
  }

  /**
   * Setup network listener for iOS/Android
   */
  private setupNetworkListener() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isConnected) {
        console.log('[WebSocket] Network reconnected, attempting to connect');
        this.connect().catch(() => {
          // Retry handled by attemptReconnect
        });
      } else if (!state.isConnected && this.isConnected) {
        console.log('[WebSocket] Network disconnected');
        this.disconnect();
      }
    });
  }

  /**
   * Connect to WebSocket server with auto-reconnect
   */
  connect(): Promise<void> {
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
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(
        `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      setTimeout(() => {
        this.connect().catch(() => {
          // Retry handled recursively
        });
      }, delay);
    } else {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('max-reconnect-attempts');
    }
  }

  /**
   * Send a command to the WebSocket server
   */
  send(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const message: Message = {
      command,
      params,
      timestamp: Date.now(),
      requestId: `req_${++this.requestIdCounter}`,
    };

    if (!this.isConnected) {
      console.log('[WebSocket] Not connected, queuing message:', command);
      this.messageQueue.push(message);
      return Promise.resolve(null);
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
        if (this.ws) {
          this.ws.send(JSON.stringify(message));
        }
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
  private handleMessage(message: Record<string, unknown>) {
    const { requestId, command, data, error, type } = message;

    // Handle response to a pending request
    if (requestId && this.pendingRequests.has(requestId as string)) {
      const request = this.pendingRequests.get(requestId as string)!;
      clearTimeout(request.timeoutHandle);
      this.pendingRequests.delete(requestId as string);

      if (error) {
        request.reject(new Error(error as string));
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
    if (this.messageHandlers.has(command as string)) {
      const handlers = this.messageHandlers.get(command as string)!;
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.ws) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
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
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Subscribe to a specific command's broadcasts
   */
  subscribe(command: string, handler: (data: unknown) => void): () => void {
    if (!this.messageHandlers.has(command)) {
      this.messageHandlers.set(command, []);
    }
    this.messageHandlers.get(command)!.push(handler);

    return () => {
      const handlers = this.messageHandlers.get(command);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit events
   */
  private emit(eventName: string, data?: unknown) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName)!.forEach((listener) => listener(data));
    }
  }

  /**
   * Add event listener
   */
  on(eventName: string, listener: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName)!.push(listener);

    return () => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
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
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
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
let instance: WebSocketClient;

export function getWebSocketClient(url: string = 'ws://localhost:8765'): WebSocketClient {
  if (!instance) {
    instance = new WebSocketClient(url);
  }
  return instance;
}
