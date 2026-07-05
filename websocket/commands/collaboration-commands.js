/**
 * WebSocket Commands for Real-Time Collaboration API (v12.9.0 Feature 2)
 *
 * Implements WebSocket command handlers for:
 * - Session locking (lock_session, unlock_session, renew_lock)
 * - Event streaming (subscribe_events, unsubscribe_events, get_event_history)
 * - Message queuing (queue_command, peek_queue, dequeue_command)
 * - Lock status and queue management
 *
 * @module websocket/commands/collaboration-commands
 */

const {
  SessionLockManager,
  EventStreamManager,
  MessageQueueManager,
  ConflictDetector,
  CollaborationCoordinator
} = require('../../src/v12-9-0/collaboration-api');

// Global collaboration instances
let collaborationManager = null;

/**
 * Register all collaboration WebSocket commands
 * @param {Object} server - WebSocket server instance
 * @param {Object} options - Configuration options
 */
function registerCollaborationCommands(server, options = {}) {
  const commandHandlers = server.commandHandlers || server;

  // Initialize collaboration manager
  if (!collaborationManager) {
    collaborationManager = new CollaborationCoordinator({
      lockTimeout: options.lockTimeout || 30000,
      maxBufferSize: options.maxBufferSize || 1000,
      maxQueueSize: options.maxQueueSize || 5000,
      logger: options.logger || console
    });
  }

  // ===== SESSION LOCKING COMMANDS =====

  /**
   * Acquire exclusive lock on session
   *
   * Command: lock_session
   * Params: {
   *   sessionId: string,
   *   clientId: string,
   *   timeout?: number,
   *   priority?: number,
   *   metadata?: object
   * }
   * Response: {
   *   success: true,
   *   lockId: string,
   *   sessionId: string,
   *   acquiredAt: number,
   *   expiresAt: number
   * }
   */
  commandHandlers.lock_session = async (params) => {
    try {
      if (!params.sessionId || !params.clientId) {
        throw new Error('sessionId and clientId are required');
      }

      const result = await collaborationManager.lockManager.acquireLock(
        params.sessionId,
        params.clientId,
        {
          timeout: params.timeout,
          priority: params.priority,
          metadata: params.metadata
        }
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Release lock on session
   *
   * Command: unlock_session
   * Params: {
   *   lockId: string,
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   releasedAt: number,
   *   nextWaiter?: string
   * }
   */
  commandHandlers.unlock_session = async (params) => {
    try {
      if (!params.lockId || !params.sessionId) {
        throw new Error('lockId and sessionId are required');
      }

      const result = collaborationManager.lockManager.releaseLock(
        params.lockId,
        params.sessionId
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Renew existing lock
   *
   * Command: renew_lock
   * Params: {
   *   lockId: string,
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   expiresAt: number
   * }
   */
  commandHandlers.renew_lock = async (params) => {
    try {
      if (!params.lockId || !params.sessionId) {
        throw new Error('lockId and sessionId are required');
      }

      const result = collaborationManager.lockManager.renewLock(
        params.lockId,
        params.sessionId
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get lock status for session
   *
   * Command: get_lock_status
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   locked: boolean,
   *   lockId?: string,
   *   clientId?: string,
   *   remainingMs?: number
   * }
   */
  commandHandlers.get_lock_status = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const status = collaborationManager.lockManager.getLockStatus(params.sessionId);

      return {
        success: true,
        ...status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get all active locks
   *
   * Command: get_all_locks
   * Response: {
   *   success: true,
   *   locks: Array,
   *   count: number
   * }
   */
  commandHandlers.get_all_locks = async (params) => {
    try {
      const locks = collaborationManager.lockManager.getAllLocks();

      return {
        success: true,
        locks,
        count: locks.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Cleanup expired locks
   *
   * Command: cleanup_expired_locks
   * Response: {
   *   success: true,
   *   cleaned: number,
   *   remaining: number
   * }
   */
  commandHandlers.cleanup_expired_locks = async (params) => {
    try {
      const result = collaborationManager.lockManager.cleanupExpiredLocks();

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ===== EVENT STREAMING COMMANDS =====

  /**
   * Subscribe to session events
   *
   * Command: subscribe_events
   * Params: {
   *   sessionId: string,
   *   subscriberId: string,
   *   eventTypes?: Array<string>,
   *   filters?: object
   * }
   * Response: {
   *   success: true,
   *   subscriptionId: string,
   *   subscribedAt: number
   * }
   */
  commandHandlers.subscribe_events = async (params) => {
    try {
      if (!params.sessionId || !params.subscriberId) {
        throw new Error('sessionId and subscriberId are required');
      }

      const result = collaborationManager.eventManager.subscribe(
        params.sessionId,
        params.subscriberId,
        {
          eventTypes: params.eventTypes,
          filters: params.filters
        }
      );

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Unsubscribe from session events
   *
   * Command: unsubscribe_events
   * Params: {
   *   subscriptionId: string
   * }
   * Response: {
   *   success: true,
   *   sessionId: string,
   *   subscriberId: string
   * }
   */
  commandHandlers.unsubscribe_events = async (params) => {
    try {
      if (!params.subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      const result = collaborationManager.eventManager.unsubscribe(params.subscriptionId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get event history for session
   *
   * Command: get_event_history
   * Params: {
   *   sessionId: string,
   *   eventType?: string,
   *   since?: number,
   *   limit?: number
   * }
   * Response: {
   *   success: true,
   *   events: Array,
   *   count: number
   * }
   */
  commandHandlers.get_event_history = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const events = collaborationManager.eventManager.getEventHistory(
        params.sessionId,
        {
          eventType: params.eventType,
          since: params.since,
          limit: params.limit
        }
      );

      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get subscription info
   *
   * Command: get_subscription_info
   * Params: {
   *   subscriptionId: string
   * }
   * Response: {
   *   success: true,
   *   subscription: object
   * }
   */
  commandHandlers.get_subscription_info = async (params) => {
    try {
      if (!params.subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      const subscription = collaborationManager.eventManager.getSubscriptionInfo(
        params.subscriptionId
      );

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      return {
        success: true,
        subscription
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get all subscriptions for session
   *
   * Command: get_session_subscriptions
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   subscriptions: Array,
   *   count: number
   * }
   */
  commandHandlers.get_session_subscriptions = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const subscriptions = collaborationManager.eventManager.getSessionSubscriptions(
        params.sessionId
      );

      return {
        success: true,
        subscriptions,
        count: subscriptions.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Broadcast event to session subscribers
   *
   * Command: broadcast_event
   * Params: {
   *   sessionId: string,
   *   eventType: string,
   *   data?: object
   * }
   * Response: {
   *   success: true,
   *   eventId: string,
   *   broadcasted: number
   * }
   */
  commandHandlers.broadcast_event = async (params) => {
    try {
      if (!params.sessionId || !params.eventType) {
        throw new Error('sessionId and eventType are required');
      }

      const result = collaborationManager.eventManager.broadcastEvent(
        params.sessionId,
        params.eventType,
        params.data
      );

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ===== MESSAGE QUEUE COMMANDS =====

  /**
   * Queue command for session
   *
   * Command: queue_command
   * Params: {
   *   sessionId: string,
   *   clientId: string,
   *   command: object,
   *   priority?: number,
   *   timeout?: number,
   *   maxRetries?: number,
   *   detectConflicts?: boolean,
   *   resolveConflicts?: string
   * }
   * Response: {
   *   success: true,
   *   queuedId: string,
   *   position: number,
   *   estimatedWaitMs: number,
   *   queueSize: number
   * }
   */
  commandHandlers.queue_command = async (params) => {
    try {
      if (!params.sessionId || !params.clientId || !params.command) {
        throw new Error('sessionId, clientId, and command are required');
      }

      const result = collaborationManager.queueManager.queueCommand(
        params.sessionId,
        params.clientId,
        params.command,
        {
          priority: params.priority,
          timeout: params.timeout,
          maxRetries: params.maxRetries,
          detectConflicts: params.detectConflicts !== false,
          resolveConflicts: params.resolveConflicts,
          metadata: params.metadata
        }
      );

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Peek at next command in queue
   *
   * Command: peek_queue
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   command?: object,
   *   queueSize: number
   * }
   */
  commandHandlers.peek_queue = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const command = collaborationManager.queueManager.peekQueue(params.sessionId);

      return {
        success: true,
        command,
        queueSize: command ? 0 : 0 // Will be populated correctly
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Dequeue command from session
   *
   * Command: dequeue_command
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   command?: object,
   *   queueSize: number
   * }
   */
  commandHandlers.dequeue_command = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const command = collaborationManager.queueManager.dequeueCommand(params.sessionId);
      const status = collaborationManager.queueManager.getQueueStatus(params.sessionId);

      return {
        success: true,
        command,
        queueSize: status.size
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Remove command from queue
   *
   * Command: remove_queued_command
   * Params: {
   *   sessionId: string,
   *   queuedId: string
   * }
   * Response: {
   *   success: true,
   *   position: number
   * }
   */
  commandHandlers.remove_queued_command = async (params) => {
    try {
      if (!params.sessionId || !params.queuedId) {
        throw new Error('sessionId and queuedId are required');
      }

      const result = collaborationManager.queueManager.removeCommand(
        params.sessionId,
        params.queuedId
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get queue status for session
   *
   * Command: get_queue_status
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   sessionId: string,
   *   size: number,
   *   maxSize: number,
   *   commands: Array
   * }
   */
  commandHandlers.get_queue_status = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const status = collaborationManager.queueManager.getQueueStatus(params.sessionId);

      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clear queue for session
   *
   * Command: clear_queue
   * Params: {
   *   sessionId: string
   * }
   * Response: {
   *   success: true,
   *   cleared: number
   * }
   */
  commandHandlers.clear_queue = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const result = collaborationManager.queueManager.clearQueue(params.sessionId);

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get queue statistics
   *
   * Command: get_queue_statistics
   * Response: {
   *   success: true,
   *   activeSessions: number,
   *   totalCommands: number,
   *   maxQueueSize: number,
   *   avgQueueSize: number
   * }
   */
  commandHandlers.get_queue_statistics = async (params) => {
    try {
      const stats = collaborationManager.queueManager.getStatistics();

      return { success: true, ...stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ===== COLLABORATION STATUS COMMANDS =====

  /**
   * Get comprehensive collaboration status
   *
   * Command: get_collaboration_status
   * Params: {
   *   sessionId?: string
   * }
   * Response: {
   *   success: true,
   *   timestamp: number,
   *   locks: object | Array,
   *   subscriptions: number | Array,
   *   queue: object,
   *   stats: object
   * }
   */
  commandHandlers.get_collaboration_status = async (params) => {
    try {
      const status = collaborationManager.getCollaborationStatus(params.sessionId);

      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Detect conflicts between commands
   *
   * Command: detect_conflicts
   * Params: {
   *   command: object,
   *   queuedCommands?: Array<object>
   * }
   * Response: {
   *   success: true,
   *   conflicts: Array,
   *   hasConflicts: boolean
   * }
   */
  commandHandlers.detect_conflicts = async (params) => {
    try {
      if (!params.command) {
        throw new Error('command is required');
      }

      const conflicts = collaborationManager.queueManager.conflictDetector.detectConflicts(
        params.command,
        params.queuedCommands || []
      );

      return {
        success: true,
        conflicts,
        hasConflicts: conflicts.length > 0
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    lockManager: collaborationManager.lockManager,
    eventManager: collaborationManager.eventManager,
    queueManager: collaborationManager.queueManager,
    collaborationManager
  };
}

module.exports = { registerCollaborationCommands };
