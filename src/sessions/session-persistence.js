/**
 * Basset Hound Browser - Session Persistence & Recovery Module
 * Saves and restores session state, enables A/B testing through branching
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 *
 * Features:
 * - Automatic session snapshots every 50 requests
 * - Recovery from failures (rate limits, blocks, connection drops)
 * - A/B testing via session branching
 * - Persistent session list with metadata
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionPersistence {
  constructor(options = {}) {
    this.storageDir = options.storageDir || '/tmp/basset-sessions';
    this.snapshotInterval = options.snapshotInterval || 50; // requests
    this.maxSnapshots = options.maxSnapshots || 10; // keep last 10
    this.autoRecovery = options.autoRecovery !== false;

    // Ensure storage directory exists
    this.ensureStorageDir();

    this.sessions = new Map(); // sessionId -> {metadata, snapshots}
    this.sessionSnapshots = new Map(); // sessionId -> [snapshots]
    this.sessionBranches = new Map(); // parentSessionId -> [childSessionIds]
    this.loadSessions();
  }

  /**
   * Ensure storage directory exists
   */
  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Create a new session with persistence enabled
   */
  createSession(sessionData = {}) {
    const sessionId = crypto.randomBytes(16).toString('hex');

    const session = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      requestCount: 0,
      snapshotCount: 0,
      status: 'active', // active, paused, recovered, failed
      failureInfo: null,
      parentSessionId: null,
      metadata: sessionData.metadata || {},
      deviceProfile: sessionData.deviceProfile || null,
      proxyConfig: sessionData.proxyConfig || null,
      cookies: sessionData.cookies || {},
      localStorage: sessionData.localStorage || {},
      sessionStorage: sessionData.sessionStorage || {},
      headers: sessionData.headers || {}
    };

    this.sessions.set(sessionId, session);
    this.sessionSnapshots.set(sessionId, []);

    // Save to disk
    this.saveSession(sessionId, session);

    return session;
  }

  /**
   * Record a request (increments counter for automatic snapshots)
   */
  recordRequest(sessionId, requestData = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.requestCount++;
    session.updatedAt = Date.now();

    // Auto-snapshot every N requests
    if (session.requestCount % this.snapshotInterval === 0) {
      this.takeSnapshot(sessionId, {
        type: 'automatic',
        triggerRequest: session.requestCount,
        requestData
      });
    }

    return {
      sessionId,
      requestCount: session.requestCount,
      shouldSnapshot: session.requestCount % this.snapshotInterval === 0
    };
  }

  /**
   * Take a manual snapshot of current session state
   */
  takeSnapshot(sessionId, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const snapshot = {
      id: crypto.randomBytes(8).toString('hex'),
      sessionId,
      timestamp: Date.now(),
      requestCount: session.requestCount,
      state: {
        cookies: { ...session.cookies },
        localStorage: { ...session.localStorage },
        sessionStorage: { ...session.sessionStorage },
        headers: { ...session.headers }
      },
      metadata: metadata || {}
    };

    // Get snapshots array
    let snapshots = this.sessionSnapshots.get(sessionId) || [];
    snapshots.push(snapshot);

    // Keep only last N snapshots
    if (snapshots.length > this.maxSnapshots) {
      snapshots = snapshots.slice(-this.maxSnapshots);
    }

    this.sessionSnapshots.set(sessionId, snapshots);
    session.snapshotCount++;
    session.updatedAt = Date.now();

    // Save snapshot to disk
    this.saveSnapshot(sessionId, snapshot);

    return snapshot;
  }

  /**
   * Recover session from snapshot (restore state)
   */
  restoreFromSnapshot(sessionId, snapshotId = null) {
    const snapshots = this.sessionSnapshots.get(sessionId) || [];

    if (snapshots.length === 0) {
      throw new Error(`No snapshots available for session: ${sessionId}`);
    }

    // Use latest snapshot if snapshotId not provided
    const snapshot = snapshotId
      ? snapshots.find(s => s.id === snapshotId)
      : snapshots[snapshots.length - 1];

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Restore state
    session.cookies = { ...snapshot.state.cookies };
    session.localStorage = { ...snapshot.state.localStorage };
    session.sessionStorage = { ...snapshot.state.sessionStorage };
    session.headers = { ...snapshot.state.headers };
    session.requestCount = snapshot.requestCount;
    session.status = 'recovered';
    session.updatedAt = Date.now();

    return {
      sessionId,
      snapshotId: snapshot.id,
      restoredRequestCount: snapshot.requestCount,
      state: snapshot.state
    };
  }

  /**
   * Record failure and prepare recovery strategy
   */
  recordFailure(sessionId, failureType, details = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Take snapshot before failure for recovery
    const snapshot = this.takeSnapshot(sessionId, {
      type: 'failure_checkpoint',
      failureType,
      failureDetails: details,
      requestCount: session.requestCount
    });

    session.failureInfo = {
      type: failureType, // 'rate_limit', 'forbidden', 'bot_blocked', 'connection_lost'
      timestamp: Date.now(),
      details,
      lastHealthySnapshot: snapshot.id
    };

    session.status = 'failed';

    return {
      sessionId,
      failureType,
      checkpointSnapshot: snapshot.id,
      recoveryStrategies: this.getRecoveryStrategies(failureType)
    };
  }

  /**
   * Get recovery strategies for a failure type
   */
  getRecoveryStrategies(failureType) {
    const strategies = {
      'rate_limit': [
        { action: 'wait', duration: 60000, description: 'Wait 60 seconds' },
        { action: 'rotate_proxy', description: 'Switch to different proxy' },
        { action: 'rotate_user_agent', description: 'Change user agent' },
        { action: 'rotate_fingerprint', description: 'Apply different device profile' }
      ],
      'forbidden': [
        { action: 'rotate_user_agent', description: 'Change user agent' },
        { action: 'rotate_fingerprint', description: 'Apply different device profile' },
        { action: 'rotate_proxy', description: 'Switch to different proxy' },
        { action: 'branch_session', description: 'Try with fresh session branch' }
      ],
      'bot_blocked': [
        { action: 'rotate_fingerprint', description: 'Apply different device profile' },
        { action: 'enable_behavioral_patterns', description: 'Activate realistic behavior' },
        { action: 'wait', duration: 300000, description: 'Wait 5 minutes' },
        { action: 'branch_session', description: 'Try with fresh session branch' }
      ],
      'connection_lost': [
        { action: 'restore_from_snapshot', description: 'Restore from last snapshot' },
        { action: 'retry', duration: 5000, description: 'Retry after 5 seconds' }
      ]
    };

    return strategies[failureType] || strategies['rate_limit'];
  }

  /**
   * Branch session for A/B testing
   * Creates a new session from current snapshot
   */
  branchSession(sessionId, branchName = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const snapshots = this.sessionSnapshots.get(sessionId) || [];
    if (snapshots.length === 0) {
      throw new Error(`Cannot branch session without snapshots: ${sessionId}`);
    }

    // Get latest snapshot to branch from
    const latestSnapshot = snapshots[snapshots.length - 1];

    // Create new branch session
    const branchId = crypto.randomBytes(16).toString('hex');
    const branchSession = {
      id: branchId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      requestCount: latestSnapshot.requestCount,
      snapshotCount: 0,
      status: 'active',
      failureInfo: null,
      parentSessionId: sessionId,
      branchName: branchName || `branch-${branchId.slice(0, 8)}`,
      metadata: {
        ...session.metadata,
        branchSourceSnapshot: latestSnapshot.id,
        branchReason: 'A/B testing'
      },
      deviceProfile: session.deviceProfile,
      proxyConfig: session.proxyConfig,
      cookies: { ...latestSnapshot.state.cookies },
      localStorage: { ...latestSnapshot.state.localStorage },
      sessionStorage: { ...latestSnapshot.state.sessionStorage },
      headers: { ...latestSnapshot.state.headers }
    };

    this.sessions.set(branchId, branchSession);
    this.sessionSnapshots.set(branchId, []);

    // Track parent-child relationship
    if (!this.sessionBranches.has(sessionId)) {
      this.sessionBranches.set(sessionId, []);
    }
    this.sessionBranches.get(sessionId).push(branchId);

    // Save to disk
    this.saveSession(branchId, branchSession);

    return branchSession;
  }

  /**
   * Merge branch results back to parent (combine learnings)
   */
  mergeBranch(branchSessionId, mergeData = {}) {
    const branchSession = this.sessions.get(branchSessionId);
    if (!branchSession || !branchSession.parentSessionId) {
      throw new Error(`Invalid branch session: ${branchSessionId}`);
    }

    const parentSession = this.sessions.get(branchSession.parentSessionId);
    if (!parentSession) {
      throw new Error(`Parent session not found: ${branchSession.parentSessionId}`);
    }

    // Merge metadata and learnings
    const mergeResult = {
      branchSessionId,
      parentSessionId: branchSession.parentSessionId,
      mergeData: mergeData || {},
      branchResults: {
        requestCount: branchSession.requestCount,
        status: branchSession.status,
        snapshotCount: branchSession.snapshotCount
      }
    };

    // Update parent metadata
    parentSession.metadata.branches = parentSession.metadata.branches || [];
    parentSession.metadata.branches.push(mergeResult);

    // Save merge result
    this.saveSession(branchSession.parentSessionId, parentSession);

    return mergeResult;
  }

  /**
   * List all sessions
   */
  listSessions(filter = {}) {
    const sessions = Array.from(this.sessions.values());

    if (filter.status) {
      return sessions.filter(s => s.status === filter.status);
    }

    if (filter.parentSessionId) {
      return sessions.filter(s => s.parentSessionId === filter.parentSessionId);
    }

    if (filter.onlyActive) {
      return sessions.filter(s => s.status === 'active');
    }

    return sessions.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      requestCount: s.requestCount,
      status: s.status,
      snapshotCount: s.snapshotCount,
      parentSessionId: s.parentSessionId,
      branchName: s.branchName
    }));
  }

  /**
   * Get session details with snapshots
   */
  getSessionDetails(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const snapshots = this.sessionSnapshots.get(sessionId) || [];

    return {
      session: {
        ...session,
        // Don't expose sensitive state in summary
        cookies: undefined,
        localStorage: undefined,
        sessionStorage: undefined,
        headers: undefined
      },
      snapshots: snapshots.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        requestCount: s.requestCount,
        type: s.metadata.type
      })),
      branches: this.sessionBranches.get(sessionId) || []
    };
  }

  /**
   * Save session to disk
   */
  saveSession(sessionId, session) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (err) {
      console.error(`Failed to save session ${sessionId}:`, err.message);
    }
  }

  /**
   * Save snapshot to disk
   */
  saveSnapshot(sessionId, snapshot) {
    const snapshotDir = path.join(this.storageDir, sessionId);
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const filePath = path.join(snapshotDir, `${snapshot.id}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    } catch (err) {
      console.error(`Failed to save snapshot ${snapshot.id}:`, err.message);
    }
  }

  /**
   * Load sessions from disk
   */
  loadSessions() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        return;
      }

      const files = fs.readdirSync(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          const filePath = path.join(this.storageDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const sessionId = file.replace('.json', '');
          this.sessions.set(sessionId, data);

          // Load snapshots for this session
          const snapshotDir = path.join(this.storageDir, sessionId);
          if (fs.existsSync(snapshotDir)) {
            const snapshots = [];
            const snapshotFiles = fs.readdirSync(snapshotDir);
            for (const snapshotFile of snapshotFiles) {
              if (snapshotFile.endsWith('.json')) {
                const snapshotPath = path.join(snapshotDir, snapshotFile);
                const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
                snapshots.push(snapshot);
              }
            }
            // Sort by timestamp
            snapshots.sort((a, b) => a.timestamp - b.timestamp);
            this.sessionSnapshots.set(sessionId, snapshots);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err.message);
    }
  }

  /**
   * Delete session and cleanup files
   */
  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this.sessionSnapshots.delete(sessionId);

    try {
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }

      const snapshotDir = path.join(this.storageDir, sessionId);
      if (fs.existsSync(snapshotDir)) {
        const files = fs.readdirSync(snapshotDir);
        for (const file of files) {
          fs.unlinkSync(path.join(snapshotDir, file));
        }
        fs.rmdirSync(snapshotDir);
      }
    } catch (err) {
      console.error(`Failed to delete session files for ${sessionId}:`, err.message);
    }

    return { sessionId, deleted: true };
  }

  /**
   * Export session for backup/sharing
   */
  exportSession(sessionId, includeSnapshots = true) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const export_data = {
      session,
      snapshots: includeSnapshots ? (this.sessionSnapshots.get(sessionId) || []) : [],
      exportedAt: Date.now()
    };

    return export_data;
  }

  /**
   * Import session from backup
   */
  importSession(exportData) {
    const sessionId = exportData.session.id;

    // Import session
    this.sessions.set(sessionId, exportData.session);

    // Import snapshots
    if (exportData.snapshots && exportData.snapshots.length > 0) {
      this.sessionSnapshots.set(sessionId, exportData.snapshots);
    } else {
      this.sessionSnapshots.set(sessionId, []);
    }

    // Save to disk
    this.saveSession(sessionId, exportData.session);
    const snapshots = this.sessionSnapshots.get(sessionId) || [];
    for (const snapshot of snapshots) {
      this.saveSnapshot(sessionId, snapshot);
    }

    return {
      sessionId,
      imported: true,
      snapshotCount: snapshots.length
    };
  }

  /**
   * Get statistics for a session
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const snapshots = this.sessionSnapshots.get(sessionId) || [];
    const branches = this.sessionBranches.get(sessionId) || [];

    return {
      sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      duration: session.updatedAt - session.createdAt,
      requestCount: session.requestCount,
      snapshotCount: snapshots.length,
      branchCount: branches.length,
      status: session.status,
      failureInfo: session.failureInfo,
      avgRequestsPerSnapshot: snapshots.length > 0
        ? Math.round(session.requestCount / snapshots.length)
        : 0
    };
  }
}

module.exports = SessionPersistence;
