/**
 * RabbitMQ Queue Manager
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Features:
 * - Connection pooling with failover
 * - Queue declaration and management
 * - Message publishing with routing
 * - Dead-letter queue handling
 * - Message acknowledgment and retry
 *
 * Queues:
 * - monitoring:tasks - Scheduled monitoring checks
 * - alerts:send - Alert notifications
 * - webhooks:dispatch - Webhook deliveries
 * - forensics:analyze - Forensic analysis jobs
 * - reports:generate - Report generation
 * - cleanup:expired - Session cleanup
 * - backups:create - Database backups
 * - dlq - Dead-letter queue
 */

const EventEmitter = require('events');

class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      brokers: options.brokers || [
        { host: 'localhost', port: 5672, username: 'guest', password: 'guest' }
      ],
      poolSize: options.poolSize || 10,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      messageTimeout: options.messageTimeout || 60000,
      prefetch: options.prefetch || 10,
      durable: options.durable !== false,
      autoAck: options.autoAck === true,
      useConnectionPool: options.useConnectionPool !== false,
      ...options
    };

    // Connection state
    this.connections = [];
    this.currentConnectionIndex = 0;
    this.isConnected = false;
    this.connectionPool = [];
    this.availableConnections = [];

    // Queue registry
    this.queues = new Map();
    this.exchanges = new Map();

    // Message tracking
    this.messageTracking = new Map();
    this.messageCallbacks = new Map();

    // Metrics
    this.metrics = {
      messagesPublished: 0,
      messagesConsumed: 0,
      messagesFailed: 0,
      messagesRetried: 0,
      messagesDeadLettered: 0,
      averageLatency: 0,
      latencySamples: [],
      connectionFailures: 0,
      currentQueueDepth: new Map()
    };

    // Queue configurations
    this.queueConfigs = {
      'monitoring:tasks': {
        durable: true,
        ttl: 3600000, // 1 hour
        maxLength: 100000,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 100000,
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': 'dlq'
        }
      },
      'alerts:send': {
        durable: true,
        ttl: 1800000, // 30 minutes
        maxLength: 50000,
        arguments: {
          'x-message-ttl': 1800000,
          'x-max-length': 50000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'webhooks:dispatch': {
        durable: true,
        ttl: 3600000, // 1 hour
        maxLength: 100000,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 100000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'forensics:analyze': {
        durable: true,
        ttl: 7200000, // 2 hours
        maxLength: 50000,
        arguments: {
          'x-message-ttl': 7200000,
          'x-max-length': 50000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'reports:generate': {
        durable: true,
        ttl: 86400000, // 1 day
        maxLength: 10000,
        arguments: {
          'x-message-ttl': 86400000,
          'x-max-length': 10000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'cleanup:expired': {
        durable: true,
        ttl: 3600000,
        maxLength: 50000,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 50000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'backups:create': {
        durable: true,
        ttl: 86400000,
        maxLength: 1000,
        arguments: {
          'x-message-ttl': 86400000,
          'x-max-length': 1000,
          'x-dead-letter-exchange': 'dlx'
        }
      },
      'dlq': {
        durable: true,
        ttl: 604800000, // 7 days
        maxLength: 100000,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 100000
        }
      }
    };
  }

  /**
   * Connect to message broker
   */
  async connect() {
    try {
      // Simulating connection pool initialization
      // In production, this would use amqplib or similar
      for (let i = 0; i < this.options.poolSize; i++) {
        const connIndex = i % this.options.brokers.length;
        const broker = this.options.brokers[connIndex];
        const connection = {
          id: i,
          broker,
          connected: true,
          lastHeartbeat: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        };
        this.connectionPool.push(connection);
        this.availableConnections.push(connection);
      }

      this.isConnected = true;
      this.emit('connected');
      console.log(`[QueueManager] Connected with pool size: ${this.options.poolSize}`);

      // Start connection health check
      this._startHealthCheck();

      return true;
    } catch (error) {
      console.error('[QueueManager] Connection failed:', error.message);
      this.metrics.connectionFailures++;
      throw error;
    }
  }

  /**
   * Health check for connections
   * @private
   */
  _startHealthCheck() {
    setInterval(() => {
      const now = Date.now();
      for (const conn of this.connectionPool) {
        const timeSinceHeartbeat = now - conn.lastHeartbeat;
        if (timeSinceHeartbeat > 30000) { // 30 seconds timeout
          conn.connected = false;
          this.metrics.connectionFailures++;
          this.emit('connection:lost', { connectionId: conn.id });
          // Attempt reconnection
          this._reconnectConnection(conn);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Reconnect a failed connection
   * @private
   */
  async _reconnectConnection(conn) {
    try {
      // Simulate reconnection
      conn.connected = true;
      conn.lastHeartbeat = Date.now();
      this.availableConnections.push(conn);
      this.emit('connection:restored', { connectionId: conn.id });
    } catch (error) {
      console.error(`[QueueManager] Reconnection failed for connection ${conn.id}:`, error.message);
    }
  }

  /**
   * Get available connection from pool
   * @private
   */
  _getConnection() {
    if (this.availableConnections.length === 0) {
      // All connections busy, return the least used one
      let leastUsed = this.connectionPool[0];
      for (const conn of this.connectionPool) {
        if (conn.messagesSent < leastUsed.messagesSent) {
          leastUsed = conn;
        }
      }
      return leastUsed;
    }

    const conn = this.availableConnections.shift();
    return conn;
  }

  /**
   * Release connection back to pool
   * @private
   */
  _releaseConnection(conn) {
    if (conn.connected && this.availableConnections.length < this.options.poolSize) {
      this.availableConnections.push(conn);
    }
  }

  /**
   * Declare queue
   */
  async declareQueue(queueName, options = {}) {
    try {
      const config = this.queueConfigs[queueName] || {};
      const queueConfig = {
        ...config,
        ...options,
        declared: true,
        declaredAt: Date.now()
      };

      this.queues.set(queueName, queueConfig);

      // Initialize queue depth tracking
      if (!this.metrics.currentQueueDepth.has(queueName)) {
        this.metrics.currentQueueDepth.set(queueName, 0);
      }

      console.log(`[QueueManager] Queue declared: ${queueName}`);
      this.emit('queue:declared', { queueName, config: queueConfig });

      return queueConfig;
    } catch (error) {
      console.error(`[QueueManager] Failed to declare queue ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Declare exchange
   */
  async declareExchange(exchangeName, type = 'topic', options = {}) {
    try {
      const exchangeConfig = {
        name: exchangeName,
        type,
        durable: options.durable !== false,
        autoDelete: options.autoDelete === true,
        ...options,
        declared: true,
        declaredAt: Date.now()
      };

      this.exchanges.set(exchangeName, exchangeConfig);

      console.log(`[QueueManager] Exchange declared: ${exchangeName} (${type})`);
      this.emit('exchange:declared', { exchangeName, type });

      return exchangeConfig;
    } catch (error) {
      console.error(`[QueueManager] Failed to declare exchange ${exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Publish message to queue
   */
  async publishMessage(queueName, message, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Queue manager not connected');
      }

      const messageId = options.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const publishedAt = Date.now();

      // Create message wrapper
      const wrappedMessage = {
        message_id: messageId,
        type: message.type || 'MESSAGE',
        payload: message.payload || message,
        retry_count: 0,
        published_at: publishedAt,
        scheduled_at: options.scheduledAt || publishedAt,
        expires_at: options.expiresAt || (publishedAt + (this.queueConfigs[queueName]?.ttl || 3600000)),
        priority: options.priority || 'normal',
        contentType: options.contentType || 'application/json'
      };

      // Get connection from pool
      const conn = this._getConnection();

      // Simulate message publication
      const queueDepth = (this.metrics.currentQueueDepth.get(queueName) || 0) + 1;
      this.metrics.currentQueueDepth.set(queueName, queueDepth);

      // Track message
      this.messageTracking.set(messageId, {
        queueName,
        message: wrappedMessage,
        status: 'published',
        publishedAt,
        ackTime: null,
        nackTime: null,
        failureCount: 0
      });

      // Store callback if provided
      if (options.onAck || options.onNack) {
        this.messageCallbacks.set(messageId, {
          onAck: options.onAck,
          onNack: options.onNack
        });
      }

      this.metrics.messagesPublished++;
      conn.messagesSent++;

      this.emit('message:published', {
        messageId,
        queueName,
        queueDepth,
        messageSize: JSON.stringify(wrappedMessage).length
      });

      console.log(`[QueueManager] Message published to ${queueName}: ${messageId} (depth: ${queueDepth})`);

      // Release connection
      this._releaseConnection(conn);

      return {
        messageId,
        queueName,
        status: 'published',
        queueDepth,
        timestamp: publishedAt
      };
    } catch (error) {
      console.error(`[QueueManager] Failed to publish message to ${queueName}:`, error.message);
      this.metrics.messagesFailed++;
      throw error;
    }
  }

  /**
   * Consume messages from queue
   */
  async consumeMessages(queueName, handler, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Queue manager not connected');
      }

      const consumerOptions = {
        prefetch: options.prefetch || this.options.prefetch,
        noAck: options.noAck || false,
        timeout: options.timeout || this.options.messageTimeout,
        batchSize: options.batchSize || 1,
        ...options
      };

      // Get connection from pool
      const conn = this._getConnection();

      // Simulate consumer setup
      const consumerId = `consumer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Simulate message consumption
      const simulateConsumption = async () => {
        while (this.isConnected) {
          const queueDepth = this.metrics.currentQueueDepth.get(queueName) || 0;

          if (queueDepth === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }

          // Get messages from queue (simulated)
          const messagesToProcess = [];
          for (let i = 0; i < Math.min(consumerOptions.batchSize, queueDepth); i++) {
            for (const [msgId, tracking] of this.messageTracking.entries()) {
              if (tracking.queueName === queueName && tracking.status === 'published') {
                messagesToProcess.push({ messageId: msgId, message: tracking.message });
                tracking.status = 'processing';
                break;
              }
            }
          }

          // Process messages
          for (const { messageId, message } of messagesToProcess) {
            try {
              const startTime = Date.now();

              // Call handler
              const result = await handler(message, {
                ack: () => this._ackMessage(messageId, queueName),
                nack: () => this._nackMessage(messageId, queueName, consumerOptions)
              });

              const latency = Date.now() - startTime;
              this._updateLatencyMetrics(latency);

              // Auto-acknowledge if enabled
              if (consumerOptions.noAck) {
                this._ackMessage(messageId, queueName);
              }

              this.metrics.messagesConsumed++;
              conn.messagesReceived++;

              this.emit('message:processed', {
                messageId,
                queueName,
                latency,
                result
              });

            } catch (error) {
              console.error(`[QueueManager] Handler error for ${messageId}:`, error.message);
              this.metrics.messagesFailed++;

              // Auto-nack on error
              if (!consumerOptions.noAck) {
                await this._nackMessage(messageId, queueName, consumerOptions);
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      // Start consumption in background
      simulateConsumption().catch(error => {
        console.error(`[QueueManager] Consumer error for ${queueName}:`, error.message);
      });

      this.emit('consumer:started', { consumerId, queueName });

      // Release connection
      this._releaseConnection(conn);

      return consumerId;
    } catch (error) {
      console.error(`[QueueManager] Failed to setup consumer for ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Acknowledge message
   * @private
   */
  _ackMessage(messageId, queueName) {
    const tracking = this.messageTracking.get(messageId);
    if (tracking) {
      tracking.status = 'acked';
      tracking.ackTime = Date.now();

      // Update queue depth
      const currentDepth = Math.max(0, (this.metrics.currentQueueDepth.get(queueName) || 1) - 1);
      this.metrics.currentQueueDepth.set(queueName, currentDepth);

      // Call ack callback
      const callbacks = this.messageCallbacks.get(messageId);
      if (callbacks?.onAck) {
        callbacks.onAck();
      }

      this.emit('message:acked', { messageId, queueName });
    }
  }

  /**
   * Negative acknowledge message (nack)
   * @private
   */
  async _nackMessage(messageId, queueName, options = {}) {
    const tracking = this.messageTracking.get(messageId);
    if (tracking) {
      tracking.failureCount++;

      if (tracking.failureCount < this.options.maxRetries) {
        // Retry with exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, tracking.failureCount - 1);
        tracking.status = 'retrying';
        tracking.nextRetryAt = Date.now() + delay;

        this.metrics.messagesRetried++;

        // Re-publish after delay
        setTimeout(async () => {
          if (tracking.status === 'retrying') {
            tracking.status = 'published';
            this.metrics.messagesPublished++;
          }
        }, delay);

        this.emit('message:retrying', { messageId, queueName, attempt: tracking.failureCount, delay });
      } else {
        // Send to DLQ
        tracking.status = 'deadlettered';
        tracking.nackTime = Date.now();

        // Update queue depth
        const currentDepth = Math.max(0, (this.metrics.currentQueueDepth.get(queueName) || 1) - 1);
        this.metrics.currentQueueDepth.set(queueName, currentDepth);

        this.metrics.messagesDeadLettered++;
        this.metrics.currentQueueDepth.set('dlq', (this.metrics.currentQueueDepth.get('dlq') || 0) + 1);

        // Call nack callback
        const callbacks = this.messageCallbacks.get(messageId);
        if (callbacks?.onNack) {
          callbacks.onNack();
        }

        this.emit('message:deadlettered', { messageId, queueName, reason: 'max_retries_exceeded' });
      }
    }
  }

  /**
   * Update latency metrics
   * @private
   */
  _updateLatencyMetrics(latency) {
    this.metrics.latencySamples.push(latency);

    // Keep only last 1000 samples
    if (this.metrics.latencySamples.length > 1000) {
      this.metrics.latencySamples.shift();
    }

    // Calculate average
    const sum = this.metrics.latencySamples.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.metrics.latencySamples.length;
  }

  /**
   * Get queue status
   */
  getQueueStatus(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const queueDepth = this.metrics.currentQueueDepth.get(queueName) || 0;

    return {
      queueName,
      depth: queueDepth,
      config: queue,
      status: queueDepth === 0 ? 'idle' : 'active'
    };
  }

  /**
   * Get all queue statuses
   */
  getAllQueueStatuses() {
    const statuses = {};
    for (const [queueName] of this.queues) {
      statuses[queueName] = this.getQueueStatus(queueName);
    }
    return statuses;
  }

  /**
   * Purge queue
   */
  async purgeQueue(queueName) {
    try {
      // Remove all messages for this queue
      let purgedCount = 0;
      for (const [msgId, tracking] of this.messageTracking.entries()) {
        if (tracking.queueName === queueName && tracking.status !== 'acked') {
          this.messageTracking.delete(msgId);
          this.messageCallbacks.delete(msgId);
          purgedCount++;
        }
      }

      this.metrics.currentQueueDepth.set(queueName, 0);

      this.emit('queue:purged', { queueName, purgedCount });
      console.log(`[QueueManager] Queue purged: ${queueName} (${purgedCount} messages)`);

      return { queueName, purgedCount };
    } catch (error) {
      console.error(`[QueueManager] Failed to purge queue ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get connection pool status
   */
  getConnectionPoolStatus() {
    return {
      total: this.connectionPool.length,
      available: this.availableConnections.length,
      inUse: this.connectionPool.length - this.availableConnections.length,
      connections: this.connectionPool.map(conn => ({
        id: conn.id,
        connected: conn.connected,
        broker: `${conn.broker.host}:${conn.broker.port}`,
        messagesSent: conn.messagesSent,
        messagesReceived: conn.messagesReceived
      }))
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      messagesPublished: this.metrics.messagesPublished,
      messagesConsumed: this.metrics.messagesConsumed,
      messagesFailed: this.metrics.messagesFailed,
      messagesRetried: this.metrics.messagesRetried,
      messagesDeadLettered: this.metrics.messagesDeadLettered,
      averageLatency: this.metrics.averageLatency.toFixed(2),
      connectionFailures: this.metrics.connectionFailures,
      queueDepths: Object.fromEntries(this.metrics.currentQueueDepth),
      connectionPool: this.getConnectionPoolStatus()
    };
  }

  /**
   * Disconnect from broker
   */
  async disconnect() {
    try {
      this.isConnected = false;
      this.connectionPool = [];
      this.availableConnections = [];
      this.messageTracking.clear();
      this.messageCallbacks.clear();
      this.emit('disconnected');
      console.log('[QueueManager] Disconnected');
      return true;
    } catch (error) {
      console.error('[QueueManager] Disconnect error:', error.message);
      throw error;
    }
  }
}

module.exports = QueueManager;
