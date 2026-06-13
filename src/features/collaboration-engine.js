/**
 * Real-Time Collaboration Engine (Wave 16 Phase 6)
 * Multi-user session sharing with CRDT-based conflict resolution,
 * live cursor tracking, and collaborative annotations.
 *
 * Features:
 * - Multi-user session sharing with CRDT
 * - Live cursor tracking and annotations
 * - Shared findings database
 * - Team communication layer
 * - Conflict resolution
 * - Comprehensive audit trails
 *
 * @author Wave 16 Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * CRDT-based collaborative document structure
 * Uses Last-Write-Wins (LWW) for conflict-free eventual consistency
 */
class CRDTDocument {
  constructor(docId) {
    this.docId = docId;
    this.entries = new Map();
    this.tombstones = new Set();
    this.vector = new Map();
    this.clock = 0;
  }

  set(key, value, clientId, timestamp = null) {
    const ts = timestamp || Date.now() + (++this.clock);
    const entry = { value, timestamp: ts, clientId };

    if (!this.entries.has(key) || ts > this.entries.get(key).timestamp) {
      this.entries.set(key, entry);
      this.tombstones.delete(key);
      this._updateVector(clientId);
      return { success: true, version: ts };
    }

    return { success: false, reason: 'stale-write', version: this.entries.get(key).timestamp };
  }

  delete(key, clientId, timestamp = null) {
    const ts = timestamp || Date.now() + (++this.clock);

    if (this.entries.has(key) && ts > this.entries.get(key).timestamp) {
      this.entries.delete(key);
      this.tombstones.add(key);
      this._updateVector(clientId);
      return { success: true, version: ts };
    }

    return { success: false, reason: 'stale-delete' };
  }

  get(key) {
    if (this.entries.has(key)) {
      return { value: this.entries.get(key).value, exists: true };
    }
    return { value: null, exists: false };
  }

  getAll() {
    const result = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.value;
    }
    return result;
  }

  _updateVector(clientId) {
    const count = (this.vector.get(clientId) || 0) + 1;
    this.vector.set(clientId, count);
  }

  getMetadata() {
    return {
      docId: this.docId,
      entryCount: this.entries.size,
      tombstoneCount: this.tombstones.size,
      vectorClock: Object.fromEntries(this.vector)
    };
  }
}

/**
 * Real-Time Collaboration Engine
 * Manages multi-user sessions with cursor tracking, annotations, and shared findings
 */
class CollaborationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.users = new Map();
    this.cursors = new Map();
    this.annotations = new Map();
    this.findings = new Map();
    this.communications = new Map();

    this.maxConcurrentUsers = options.maxConcurrentUsers || 10;
    this.syncInterval = options.syncInterval || 100;
    this.maxAnnotations = options.maxAnnotations || 5000;
    this.maxCursorUpdates = options.maxCursorUpdates || 10000;
    this.retentionDays = options.retentionDays || 30;
    this.messageQueueSize = options.messageQueueSize || 1000;
  }

  /**
   * Create a collaboration session
   */
  createSession(sessionId, initiatorId, options = {}) {
    if (this.sessions.has(sessionId)) {
      return { success: false, error: 'session-exists' };
    }

    const session = {
      id: sessionId,
      initiator: initiatorId,
      created: Date.now(),
      users: new Set([initiatorId]),
      document: new CRDTDocument(`doc-${sessionId}`),
      permissions: new Map(),
      activities: [],
      state: 'active',
      config: {
        maxConcurrentUsers: options.maxConcurrentUsers || this.maxConcurrentUsers,
        syncInterval: options.syncInterval || this.syncInterval,
        encrypted: options.encrypted || false
      }
    };

    this.sessions.set(sessionId, session);
    this._initializePermissions(sessionId, initiatorId, 'admin');
    this.emit('session:created', { sessionId, initiatorId, timestamp: Date.now() });

    return { success: true, sessionId, document: session.document.getMetadata() };
  }

  /**
   * Join a collaboration session
   */
  joinSession(sessionId, userId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (session.users.size >= session.config.maxConcurrentUsers) {
      return { success: false, error: 'session-full' };
    }

    session.users.add(userId);
    this._initializePermissions(sessionId, userId, options.role || 'viewer');

    const userSession = {
      userId,
      sessionId,
      joined: Date.now(),
      lastActivity: Date.now(),
      cursorPosition: { x: 0, y: 0 },
      isActive: true
    };

    this.users.set(`${sessionId}:${userId}`, userSession);
    this._logActivity(sessionId, 'user-joined', { userId, timestamp: Date.now() });
    this.emit('user:joined', { sessionId, userId, timestamp: Date.now() });

    return {
      success: true,
      session: {
        id: sessionId,
        users: Array.from(session.users),
        document: session.document.getMetadata(),
        permissions: this._getPermissions(sessionId, userId)
      }
    };
  }

  /**
   * Update cursor position for real-time tracking
   */
  updateCursor(sessionId, userId, position, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (!session.users.has(userId)) {
      return { success: false, error: 'user-not-in-session' };
    }

    const cursorKey = `${sessionId}:${userId}`;
    const timestamp = Date.now();
    const cursorData = {
      userId,
      position,
      timestamp,
      metadata,
      sessionId
    };

    this.cursors.set(cursorKey, cursorData);

    // Cleanup old cursors to prevent memory bloat
    if (this.cursors.size > this.maxCursorUpdates) {
      this._cleanupOldCursors();
    }

    this.emit('cursor:updated', cursorData);

    return { success: true, timestamp };
  }

  /**
   * Add annotation to shared findings
   */
  addAnnotation(sessionId, userId, findingId, annotation) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (!this._hasPermission(sessionId, userId, 'edit')) {
      return { success: false, error: 'insufficient-permissions' };
    }

    const annotationId = crypto.randomUUID();
    const annotationData = {
      id: annotationId,
      findingId,
      userId,
      content: annotation.content,
      type: annotation.type || 'comment',
      created: Date.now(),
      modified: Date.now(),
      resolved: false,
      replies: []
    };

    const annotationKey = `${sessionId}:${findingId}`;
    if (!this.annotations.has(annotationKey)) {
      this.annotations.set(annotationKey, []);
    }

    this.annotations.get(annotationKey).push(annotationData);

    if (this.annotations.size > this.maxAnnotations) {
      this._cleanupOldAnnotations();
    }

    this.emit('annotation:added', {
      sessionId,
      annotationId,
      findingId,
      userId,
      timestamp: Date.now()
    });

    return { success: true, annotationId };
  }

  /**
   * Reply to annotation
   */
  replyToAnnotation(sessionId, userId, findingId, annotationId, reply) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (!this._hasPermission(sessionId, userId, 'comment')) {
      return { success: false, error: 'insufficient-permissions' };
    }

    const annotationKey = `${sessionId}:${findingId}`;
    const annotations = this.annotations.get(annotationKey);
    if (!annotations) {
      return { success: false, error: 'finding-not-found' };
    }

    const annotation = annotations.find(a => a.id === annotationId);
    if (!annotation) {
      return { success: false, error: 'annotation-not-found' };
    }

    const replyData = {
      id: crypto.randomUUID(),
      userId,
      content: reply.content,
      created: Date.now(),
      mentions: reply.mentions || []
    };

    annotation.replies.push(replyData);
    annotation.modified = Date.now();

    this.emit('annotation:replied', {
      sessionId,
      annotationId,
      findingId,
      replyId: replyData.id,
      userId,
      timestamp: Date.now()
    });

    return { success: true, replyId: replyData.id };
  }

  /**
   * Share finding with team
   */
  shareFindings(sessionId, userId, findings) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (!this._hasPermission(sessionId, userId, 'share')) {
      return { success: false, error: 'insufficient-permissions' };
    }

    const findingIds = [];
    for (const finding of findings) {
      const findingId = crypto.randomUUID();
      const findingData = {
        id: findingId,
        userId,
        content: finding,
        created: Date.now(),
        updated: Date.now(),
        likes: new Set(),
        tags: finding.tags || [],
        status: 'shared'
      };

      this.findings.set(`${sessionId}:${findingId}`, findingData);
      findingIds.push(findingId);

      this._logActivity(sessionId, 'finding-shared', {
        findingId,
        userId,
        timestamp: Date.now()
      });
    }

    this.emit('findings:shared', {
      sessionId,
      userId,
      findingIds,
      timestamp: Date.now()
    });

    return { success: true, findingIds };
  }

  /**
   * Send message in session communication
   */
  sendMessage(sessionId, userId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (!this._hasPermission(sessionId, userId, 'communicate')) {
      return { success: false, error: 'insufficient-permissions' };
    }

    const messageId = crypto.randomUUID();
    const messageData = {
      id: messageId,
      userId,
      content: message.content,
      type: message.type || 'text',
      created: Date.now(),
      edited: false,
      reactions: new Map(),
      thread: message.threadId || null
    };

    const commKey = sessionId;
    if (!this.communications.has(commKey)) {
      this.communications.set(commKey, []);
    }

    const messages = this.communications.get(commKey);
    messages.push(messageData);

    // Enforce message queue size limit
    if (messages.length > this.messageQueueSize) {
      messages.shift();
    }

    this.emit('message:sent', {
      sessionId,
      messageId,
      userId,
      timestamp: Date.now()
    });

    return { success: true, messageId };
  }

  /**
   * Get shared findings for a session
   */
  getSharedFindings(sessionId, userId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const findings = [];
    for (const [key, finding] of this.findings) {
      if (key.startsWith(`${sessionId}:`)) {
        findings.push({
          id: finding.id,
          userId: finding.userId,
          content: finding.content,
          created: finding.created,
          updated: finding.updated,
          likes: finding.likes.size,
          tags: finding.tags,
          status: finding.status,
          annotations: this.annotations.get(`${sessionId}:${finding.id}`) || []
        });
      }
    }

    return {
      success: true,
      findings: findings.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100))
    };
  }

  /**
   * Get session activity history
   */
  getActivityHistory(sessionId, userId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const activities = session.activities.slice(-limit);

    return {
      success: true,
      activities,
      total: session.activities.length,
      hasMore: session.activities.length > limit
    };
  }

  /**
   * Resolve conflict in CRDT
   */
  resolveConflict(sessionId, docKey, resolution) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    // Apply resolution strategy
    if (resolution.strategy === 'client-wins') {
      session.document.set(docKey, resolution.value, resolution.clientId);
    } else if (resolution.strategy === 'server-wins') {
      // Keep current value
    } else if (resolution.strategy === 'merge') {
      // Custom merge function
      if (resolution.mergeFn && typeof resolution.mergeFn === 'function') {
        const current = session.document.get(docKey);
        const merged = resolution.mergeFn(current.value, resolution.value);
        session.document.set(docKey, merged, resolution.clientId);
      }
    }

    this.emit('conflict:resolved', {
      sessionId,
      docKey,
      resolution,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Leave session
   */
  leaveSession(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    session.users.delete(userId);
    this.users.delete(`${sessionId}:${userId}`);
    this.cursors.delete(`${sessionId}:${userId}`);

    this._logActivity(sessionId, 'user-left', { userId, timestamp: Date.now() });
    this.emit('user:left', { sessionId, userId, timestamp: Date.now() });

    if (session.users.size === 0) {
      session.state = 'inactive';
    }

    return { success: true };
  }

  /**
   * Helper: Initialize permissions for user in session
   */
  _initializePermissions(sessionId, userId, role) {
    const key = `${sessionId}:${userId}`;
    const permissions = {
      'viewer': ['view', 'read', 'share'],
      'editor': ['view', 'read', 'edit', 'comment', 'share'],
      'admin': ['view', 'read', 'edit', 'comment', 'manage', 'delete', 'communicate', 'share']
    };

    this.sessions.get(sessionId).permissions.set(userId, {
      role,
      permissions: permissions[role] || permissions.viewer,
      grantedAt: Date.now()
    });
  }

  /**
   * Helper: Check if user has permission
   */
  _hasPermission(sessionId, userId, action) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const perms = session.permissions.get(userId);
    if (!perms) return false;

    return perms.permissions.includes(action);
  }

  /**
   * Helper: Get user permissions
   */
  _getPermissions(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return session.permissions.get(userId);
  }

  /**
   * Helper: Log activity
   */
  _logActivity(sessionId, type, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.activities.push({
        type,
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Helper: Cleanup old cursors
   */
  _cleanupOldCursors() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [key, cursor] of this.cursors) {
      if (now - cursor.timestamp > timeout) {
        this.cursors.delete(key);
      }
    }
  }

  /**
   * Helper: Cleanup old annotations
   */
  _cleanupOldAnnotations() {
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const [key, annotations] of this.annotations) {
      const filtered = annotations.filter(a => now - a.created < retentionMs);
      if (filtered.length === 0) {
        this.annotations.delete(key);
      } else {
        this.annotations.set(key, filtered);
      }
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const sharedFindings = Array.from(this.findings.keys()).filter(k => k.startsWith(`${sessionId}:`)).length;
    const uptime = Math.max(1, Date.now() - session.created);

    return {
      success: true,
      stats: {
        sessionId,
        activeUsers: session.users.size,
        totalActivities: session.activities.length,
        sharedFindings,
        totalAnnotations: Array.from(this.annotations.values()).flat().length,
        uptime,
        createdAt: session.created
      }
    };
  }

  /**
   * Close session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    session.state = 'closed';
    this.emit('session:closed', { sessionId, timestamp: Date.now() });

    return { success: true };
  }
}

module.exports = CollaborationEngine;
