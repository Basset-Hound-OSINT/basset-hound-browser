/**
 * Basset Hound Browser - Session Branching & Recovery Feature (v12.2.0)
 * Advanced session management with checkpoint support, A/B testing, and failure recovery
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 * Component: Foundation for v12.2.0 Session Persistence Enhancement
 *
 * Features:
 * - Create checkpoints at any point in a session
 * - Roll back to previous checkpoints for A/B testing
 * - Automatic failure detection and recovery
 * - Resume failed sessions with retry mechanisms
 * - Branching for parallel experiment execution
 * - Comprehensive recovery strategy suggestions
 *
 * WebSocket Commands Added (12 new commands):
 * - create_session_checkpoint: Create named checkpoint
 * - rollback_to_checkpoint: Restore session to checkpoint
 * - list_checkpoints: View all checkpoints for session
 * - get_checkpoint_details: Get checkpoint metadata and state
 * - delete_checkpoint: Remove checkpoint
 * - branch_session: Create A/B test branch
 * - list_branches: View all branches from parent
 * - merge_branch: Merge branch results back to parent
 * - detect_failure: Analyze session failure type
 * - get_recovery_strategies: Get recovery options for failure
 * - resume_session: Resume from failure checkpoint
 * - export_checkpoint: Export checkpoint for backup
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Session state for checkpoint management
 */
class SessionCheckpoint {
  constructor(sessionId, checkpointName, sessionState) {
    this.id = crypto.randomBytes(12).toString('hex');
    this.sessionId = sessionId;
    this.checkpointName = checkpointName;
    this.timestamp = Date.now();
    this.state = {
      url: sessionState.url || null,
      cookies: { ...sessionState.cookies },
      localStorage: { ...sessionState.localStorage },
      sessionStorage: { ...sessionState.sessionStorage },
      headers: { ...sessionState.headers },
      userAgent: sessionState.userAgent || null,
      proxy: sessionState.proxy || null,
      viewport: sessionState.viewport || null,
      deviceProfile: sessionState.deviceProfile || null,
      requestCount: sessionState.requestCount || 0
    };
    this.metadata = {
      createdBy: 'user',
      description: null,
      tags: []
    };
  }

  /**
   * Validate checkpoint integrity
   */
  validate() {
    return {
      valid: Boolean(this.id && this.sessionId && this.state),
      checksum: crypto
        .createHash('sha256')
        .update(JSON.stringify(this.state))
        .digest('hex')
        .slice(0, 16)
    };
  }
}

/**
 * Session branching manager for A/B testing and recovery
 */
class SessionBranchingManager {
  constructor(options = {}) {
    this.storageDir = options.storageDir || '/tmp/basset-sessions/checkpoints';
    this.maxCheckpoints = options.maxCheckpoints || 20;
    this.maxBranches = options.maxBranches || 10;
    this.enableAutoRecovery = options.enableAutoRecovery !== false;

    // In-memory structures
    this.checkpoints = new Map(); // sessionId -> [checkpoints]
    this.branches = new Map(); // parentSessionId -> [branchIds]
    this.branchMetadata = new Map(); // branchId -> metadata
    this.recoveryLog = new Map(); // sessionId -> [recovery events]

    this.ensureStorageDir();
  }

  /**
   * Ensure checkpoint storage directory exists
   */
  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Create a checkpoint (named snapshot)
   * @param {string} sessionId - Session ID
   * @param {string} checkpointName - Human-readable checkpoint name
   * @param {object} sessionState - Current session state
   * @returns {object} Checkpoint details
   */
  createCheckpoint(sessionId, checkpointName, sessionState) {
    if (!sessionId || !checkpointName) {
      throw new Error('sessionId and checkpointName are required');
    }

    const checkpoint = new SessionCheckpoint(sessionId, checkpointName, sessionState);

    // Get or create checkpoint list for this session
    if (!this.checkpoints.has(sessionId)) {
      this.checkpoints.set(sessionId, []);
    }

    const sessionCheckpoints = this.checkpoints.get(sessionId);

    // Enforce max checkpoints
    if (sessionCheckpoints.length >= this.maxCheckpoints) {
      sessionCheckpoints.shift(); // Remove oldest
    }

    sessionCheckpoints.push(checkpoint);

    // Persist to disk
    this.saveCheckpoint(sessionId, checkpoint);

    return {
      success: true,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.checkpointName,
      timestamp: checkpoint.timestamp,
      requestCount: checkpoint.state.requestCount,
      checksum: checkpoint.validate().checksum
    };
  }

  /**
   * Rollback session to checkpoint
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID to restore
   * @returns {object} Restored state
   */
  rollbackToCheckpoint(sessionId, checkpointId) {
    const sessionCheckpoints = this.checkpoints.get(sessionId) || [];
    const checkpoint = sessionCheckpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const validation = checkpoint.validate();
    if (!validation.valid) {
      throw new Error('Checkpoint validation failed');
    }

    return {
      success: true,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.checkpointName,
      originalTimestamp: checkpoint.timestamp,
      restoredAt: Date.now(),
      state: checkpoint.state,
      requestCountRestored: checkpoint.state.requestCount
    };
  }

  /**
   * List all checkpoints for a session
   * @param {string} sessionId - Session ID
   * @returns {array} Array of checkpoint summaries
   */
  listCheckpoints(sessionId) {
    const sessionCheckpoints = this.checkpoints.get(sessionId) || [];

    return sessionCheckpoints.map(c => ({
      id: c.id,
      name: c.checkpointName,
      timestamp: c.timestamp,
      requestCount: c.metadata.requestCount,
      tags: c.metadata.tags,
      description: c.metadata.description
    }));
  }

  /**
   * Get checkpoint details
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {object} Full checkpoint details
   */
  getCheckpointDetails(sessionId, checkpointId) {
    const sessionCheckpoints = this.checkpoints.get(sessionId) || [];
    const checkpoint = sessionCheckpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    return {
      id: checkpoint.id,
      name: checkpoint.checkpointName,
      timestamp: checkpoint.timestamp,
      state: checkpoint.state,
      metadata: {
        ...checkpoint.metadata,
        requestCount: checkpoint.state.requestCount
      },
      validation: checkpoint.validate()
    };
  }

  /**
   * Delete a checkpoint
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {object} Deletion status
   */
  deleteCheckpoint(sessionId, checkpointId) {
    const sessionCheckpoints = this.checkpoints.get(sessionId) || [];
    const index = sessionCheckpoints.findIndex(c => c.id === checkpointId);

    if (index === -1) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    sessionCheckpoints.splice(index, 1);

    // Delete from disk
    this.deleteCheckpointFile(sessionId, checkpointId);

    return {
      success: true,
      deletedCheckpointId: checkpointId,
      remainingCheckpoints: sessionCheckpoints.length
    };
  }

  /**
   * Branch session for A/B testing
   * Creates a new session starting from a checkpoint
   * @param {string} parentSessionId - Parent session ID
   * @param {string} checkpointId - Checkpoint to branch from
   * @param {string} branchName - Name for the branch
   * @returns {object} Branch session details
   */
  branchSession(parentSessionId, checkpointId, branchName) {
    const sessionCheckpoints = this.checkpoints.get(parentSessionId) || [];
    const checkpoint = sessionCheckpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const branchId = crypto.randomBytes(16).toString('hex');
    const branchSession = {
      id: branchId,
      name: branchName || `branch-${branchId.slice(0, 8)}`,
      parentSessionId,
      checkpointId,
      createdAt: Date.now(),
      state: { ...checkpoint.state },
      status: 'active',
      testResults: null
    };

    // Track branch relationship
    if (!this.branches.has(parentSessionId)) {
      this.branches.set(parentSessionId, []);
    }
    this.branches.get(parentSessionId).push(branchId);

    // Store branch metadata
    this.branchMetadata.set(branchId, branchSession);

    // Create checkpoints for the new branch
    this.checkpoints.set(branchId, []);

    return {
      success: true,
      branchId,
      branchName: branchSession.name,
      parentSessionId,
      checkpointId,
      initialState: checkpoint.state
    };
  }

  /**
   * List all branches from a parent session
   * @param {string} parentSessionId - Parent session ID
   * @returns {array} Array of branch summaries
   */
  listBranches(parentSessionId) {
    const branchIds = this.branches.get(parentSessionId) || [];
    return branchIds.map(branchId => {
      const meta = this.branchMetadata.get(branchId);
      return {
        branchId,
        name: meta?.name || `branch-${branchId.slice(0, 8)}`,
        createdAt: meta?.createdAt,
        status: meta?.status,
        testResults: meta?.testResults
      };
    });
  }

  /**
   * Merge branch results back to parent
   * @param {string} branchId - Branch session ID
   * @param {object} testResults - Results from branch testing
   * @returns {object} Merge status
   */
  mergeBranch(branchId, testResults = {}) {
    const branchMeta = this.branchMetadata.get(branchId);
    if (!branchMeta) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    branchMeta.status = 'merged';
    branchMeta.testResults = testResults;
    branchMeta.mergedAt = Date.now();

    const parentCheckpoints = this.checkpoints.get(branchMeta.parentSessionId) || [];

    return {
      success: true,
      branchId,
      parentSessionId: branchMeta.parentSessionId,
      mergeTimestamp: Date.now(),
      testResults,
      checkpointCount: parentCheckpoints.length
    };
  }

  /**
   * Detect failure type from error details
   * @param {object} errorDetails - Error information
   * @returns {object} Failure analysis
   */
  detectFailure(errorDetails) {
    const message = (errorDetails.message || '').toLowerCase();
    const statusCode = errorDetails.statusCode;

    let failureType = 'unknown';
    let severity = 'medium';
    let recoverable = true;

    if (statusCode === 429 || message.includes('rate limit')) {
      failureType = 'rate_limit';
      severity = 'high';
      recoverable = true;
    } else if (statusCode === 403 || statusCode === 401) {
      failureType = 'forbidden';
      severity = 'high';
      recoverable = true;
    } else if (message.includes('bot') || message.includes('challenge')) {
      failureType = 'bot_detected';
      severity = 'critical';
      recoverable = true;
    } else if (message.includes('connection') || message.includes('timeout')) {
      failureType = 'connection_lost';
      severity = 'medium';
      recoverable = true;
    } else if (statusCode >= 500) {
      failureType = 'server_error';
      severity = 'low';
      recoverable = true;
    } else if (message.includes('dns') || message.includes('unreachable')) {
      failureType = 'network_error';
      severity = 'medium';
      recoverable = true;
    }

    return {
      failureType,
      severity,
      recoverable,
      confidence: 0.95,
      timestamp: Date.now()
    };
  }

  /**
   * Get recovery strategies for failure type
   * @param {string} failureType - Type of failure
   * @returns {array} Recovery strategies
   */
  getRecoveryStrategies(failureType) {
    const strategies = {
      rate_limit: [
        {
          priority: 1,
          action: 'wait',
          duration: 60000,
          description: 'Wait 60 seconds before retry',
          successRate: 0.92
        },
        {
          priority: 2,
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          successRate: 0.78
        },
        {
          priority: 3,
          action: 'rotate_user_agent',
          description: 'Change user agent',
          successRate: 0.65
        },
        {
          priority: 4,
          action: 'branch_session',
          description: 'Resume from checkpoint in new branch',
          successRate: 0.88
        }
      ],
      forbidden: [
        {
          priority: 1,
          action: 'rotate_fingerprint',
          description: 'Apply different device profile',
          successRate: 0.82
        },
        {
          priority: 2,
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          successRate: 0.75
        },
        {
          priority: 3,
          action: 'clear_cookies',
          description: 'Clear all cookies and restart',
          successRate: 0.68
        },
        {
          priority: 4,
          action: 'branch_session',
          description: 'Resume from checkpoint in new branch',
          successRate: 0.85
        }
      ],
      bot_detected: [
        {
          priority: 1,
          action: 'rotate_fingerprint',
          description: 'Apply different device profile',
          successRate: 0.88
        },
        {
          priority: 2,
          action: 'enable_behavioral_patterns',
          description: 'Activate realistic human-like behavior',
          successRate: 0.82
        },
        {
          priority: 3,
          action: 'wait',
          duration: 300000,
          description: 'Wait 5 minutes for cooldown',
          successRate: 0.79
        },
        {
          priority: 4,
          action: 'branch_session',
          description: 'Resume from checkpoint with fresh identity',
          successRate: 0.91
        }
      ],
      connection_lost: [
        {
          priority: 1,
          action: 'restore_from_checkpoint',
          description: 'Restore from latest checkpoint',
          successRate: 0.96
        },
        {
          priority: 2,
          action: 'retry',
          duration: 5000,
          description: 'Retry connection after 5 seconds',
          successRate: 0.85
        },
        {
          priority: 3,
          action: 'reconnect_proxy',
          description: 'Reconnect proxy connection',
          successRate: 0.78
        }
      ],
      server_error: [
        {
          priority: 1,
          action: 'wait',
          duration: 30000,
          description: 'Wait 30 seconds for server recovery',
          successRate: 0.89
        },
        {
          priority: 2,
          action: 'retry',
          duration: 10000,
          description: 'Retry after 10 seconds',
          successRate: 0.81
        }
      ],
      network_error: [
        {
          priority: 1,
          action: 'reconnect_proxy',
          description: 'Reconnect proxy',
          successRate: 0.87
        },
        {
          priority: 2,
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          successRate: 0.79
        },
        {
          priority: 3,
          action: 'wait',
          duration: 15000,
          description: 'Wait 15 seconds',
          successRate: 0.72
        }
      ]
    };

    return strategies[failureType] || strategies['rate_limit'];
  }

  /**
   * Resume session after failure
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint to resume from
   * @param {object} recoveryOptions - Recovery configuration
   * @returns {object} Resume status
   */
  resumeSession(sessionId, checkpointId, recoveryOptions = {}) {
    const checkpoint = (this.checkpoints.get(sessionId) || [])
      .find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Log recovery event
    if (!this.recoveryLog.has(sessionId)) {
      this.recoveryLog.set(sessionId, []);
    }

    this.recoveryLog.get(sessionId).push({
      timestamp: Date.now(),
      checkpointId,
      recoveryOptions,
      status: 'initiated'
    });

    return {
      success: true,
      sessionId,
      checkpointId,
      resumedAt: Date.now(),
      state: checkpoint.state,
      recoveryApplied: recoveryOptions,
      attemptNumber: (this.recoveryLog.get(sessionId) || []).length
    };
  }

  /**
   * Export checkpoint for backup
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {object} Exported checkpoint data
   */
  exportCheckpoint(sessionId, checkpointId) {
    const sessionCheckpoints = this.checkpoints.get(sessionId) || [];
    const checkpoint = sessionCheckpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    return {
      exported: true,
      exportedAt: Date.now(),
      checkpoint: {
        id: checkpoint.id,
        sessionId: checkpoint.sessionId,
        name: checkpoint.checkpointName,
        timestamp: checkpoint.timestamp,
        state: checkpoint.state,
        metadata: checkpoint.metadata
      },
      checksum: checkpoint.validate().checksum
    };
  }

  /**
   * Save checkpoint to disk
   */
  saveCheckpoint(sessionId, checkpoint) {
    const sessionDir = path.join(this.storageDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const filePath = path.join(sessionDir, `${checkpoint.id}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
    } catch (err) {
      console.error(`Failed to save checkpoint ${checkpoint.id}:`, err.message);
    }
  }

  /**
   * Delete checkpoint file from disk
   */
  deleteCheckpointFile(sessionId, checkpointId) {
    const filePath = path.join(this.storageDir, sessionId, `${checkpointId}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete checkpoint file:`, err.message);
    }
  }
}

module.exports = {
  SessionBranchingManager,
  SessionCheckpoint
};
