/**
 * Advanced Session Collaboration Feature (Wave 16 Phase 6)
 * Enables real-time multi-user session sharing with CRDT-based conflict resolution,
 * live cursor tracking, and collaborative comment/annotation system.
 *
 * Capabilities:
 * - Real-time session control sharing (multiple users in one session)
 * - Collaborative findings database (shared notes, bookmarks)
 * - Real-time annotation overlay (mark evidence on screenshots)
 * - Team permission management (viewer, editor, admin)
 * - Conversation threading on evidence items
 * - Revision history with attribution
 *
 * @author Wave 16 Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * CRDT-based collaborative data structure using Last-Write-Wins (LWW) strategy
 * Ensures eventual consistency across all clients without central coordination
 */
class CollaborativeDocument {
  constructor(docId) {
    this.docId = docId;
    this.entries = new Map(); // key -> { value, timestamp, clientId }
    this.tombstones = new Set(); // Deleted entries
    this.clock = 0;
  }

  set(key, value, clientId) {
    const timestamp = Date.now() + (++this.clock);
    const entry = { value, timestamp, clientId };

    if (!this.entries.has(key) || timestamp > this.entries.get(key).timestamp) {
      this.entries.set(key, entry);
      this.tombstones.delete(key);
      return { success: true, version: timestamp };
    }

    return { success: false, reason: 'stale-write', version: this.entries.get(key).timestamp };
  }

  delete(key, clientId) {
    const timestamp = Date.now() + (++this.clock);

    if (this.entries.has(key) && timestamp > this.entries.get(key).timestamp) {
      this.entries.delete(key);
      this.tombstones.add(key);
      return { success: true, version: timestamp };
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

  getConflictLog() {
    return Array.from(this.entries.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}

/**
 * Session Collaboration Manager
 * Coordinates multi-user session access with real-time synchronization
 */
class SessionCollaborationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map(); // sessionId -> CollaborativeSession
    this.users = new Map(); // userId -> UserSession
    this.maxConcurrentUsers = options.maxConcurrentUsers || 10;
    this.syncInterval = options.syncInterval || 100; // ms
    this.maxAnnotations = options.maxAnnotations || 1000;
    this.retentionDays = options.retentionDays || 30;
  }

  /**
   * Create or join a collaborative session
   */
  createSession(sessionId, initiatorId, options = {}) {
    if (this.sessions.has(sessionId)) {
      return { success: false, error: 'session-already-exists' };
    }

    const session = new CollaborativeSession(sessionId, initiatorId, options);
    this.sessions.set(sessionId, session);

    this.emit('session:created', { sessionId, initiatorId, timestamp: Date.now() });

    return {
      success: true,
      sessionId,
      accessCode: session.generateAccessCode(),
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Join a collaborative session
   */
  joinSession(sessionId, userId, userRole = 'viewer') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    if (session.participants.size >= this.maxConcurrentUsers) {
      return { success: false, error: 'session-full' };
    }

    const joinResult = session.addParticipant(userId, userRole);
    if (!joinResult.success) {
      return joinResult;
    }

    const userSession = {
      sessionId,
      userId,
      role: userRole,
      joinedAt: Date.now(),
      cursor: { x: 0, y: 0 },
      selections: [],
      activeAnnotations: new Map()
    };

    this.users.set(`${sessionId}:${userId}`, userSession);

    this.emit('user:joined', {
      sessionId,
      userId,
      userRole,
      participantCount: session.participants.size,
      timestamp: Date.now()
    });

    return {
      success: true,
      sessionId,
      participantCount: session.participants.size,
      permissions: session.getRolePermissions(userRole)
    };
  }

  /**
   * Update user cursor position (for live tracking)
   */
  updateCursor(sessionId, userId, x, y) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    // Check if user is in session
    if (!session.participants.has(userId)) {
      return { success: false, error: 'user-not-found' };
    }

    const userKey = `${sessionId}:${userId}`;
    let userSession = this.users.get(userKey);

    if (!userSession) {
      // Create user session if it doesn't exist
      userSession = {
        sessionId,
        userId,
        role: session.participants.get(userId),
        joinedAt: Date.now(),
        cursor: { x: 0, y: 0 },
        selections: [],
        activeAnnotations: new Map()
      };
      this.users.set(userKey, userSession);
    }

    userSession.cursor = { x, y, timestamp: Date.now() };

    this.emit('cursor:updated', {
      sessionId,
      userId,
      cursor: { x, y }
    });

    return { success: true };
  }

  /**
   * Get active participants and their cursors
   */
  getActiveParticipants(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const participants = [];
    for (const [userId, role] of session.participants) {
      const userKey = `${sessionId}:${userId}`;
      let userSession = this.users.get(userKey);

      // Create default user session if not exists
      if (!userSession) {
        userSession = {
          sessionId,
          userId,
          role,
          joinedAt: Date.now(),
          cursor: { x: 0, y: 0 },
          selections: [],
          activeAnnotations: new Map()
        };
        this.users.set(userKey, userSession);
      }

      participants.push({
        userId,
        role,
        cursor: userSession.cursor,
        joinedAt: new Date(userSession.joinedAt).toISOString(),
        activeAnnotations: userSession.activeAnnotations.size
      });
    }

    return {
      success: true,
      sessionId,
      participants,
      totalParticipants: participants.length
    };
  }

  /**
   * Add collaborative annotation to evidence
   */
  addAnnotation(sessionId, userId, evidenceId, annotation) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const canEdit = session.canUserEdit(userId);
    if (!canEdit) {
      return { success: false, error: 'permission-denied' };
    }

    if (session.annotations.size >= this.maxAnnotations) {
      return { success: false, error: 'annotation-limit-reached' };
    }

    const annotationId = crypto.randomBytes(8).toString('hex');
    const annotationData = {
      id: annotationId,
      evidenceId,
      userId,
      content: annotation.content,
      type: annotation.type || 'comment', // comment, highlight, flag, etc.
      position: annotation.position || { x: 0, y: 0 },
      color: annotation.color || '#FFD700',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      replies: []
    };

    session.annotations.set(annotationId, annotationData);

    const userKey = `${sessionId}:${userId}`;
    const userSession = this.users.get(userKey);
    if (userSession) {
      userSession.activeAnnotations.set(annotationId, annotationData);
    }

    this.emit('annotation:added', {
      sessionId,
      annotationId,
      evidenceId,
      userId,
      timestamp: Date.now()
    });

    return {
      success: true,
      annotationId,
      annotation: annotationData
    };
  }

  /**
   * Add reply to annotation (threaded comments)
   */
  replyToAnnotation(sessionId, userId, annotationId, reply) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const annotation = session.annotations.get(annotationId);
    if (!annotation) {
      return { success: false, error: 'annotation-not-found' };
    }

    const replyData = {
      id: crypto.randomBytes(8).toString('hex'),
      userId,
      content: reply.content,
      createdAt: Date.now(),
      reactions: {}
    };

    annotation.replies.push(replyData);
    annotation.updatedAt = Date.now();

    this.emit('annotation:replied', {
      sessionId,
      annotationId,
      replyId: replyData.id,
      userId,
      timestamp: Date.now()
    });

    return {
      success: true,
      replyId: replyData.id,
      reply: replyData
    };
  }

  /**
   * Add collaborative finding
   */
  addFinding(sessionId, userId, finding) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const canEdit = session.canUserEdit(userId);
    if (!canEdit) {
      return { success: false, error: 'permission-denied' };
    }

    const findingId = crypto.randomBytes(8).toString('hex');
    const findingData = {
      id: findingId,
      title: finding.title,
      description: finding.description,
      tags: finding.tags || [],
      severity: finding.severity || 'medium',
      evidence: finding.evidence || [],
      contributors: [userId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'open'
    };

    session.findings.set(findingId, findingData);
    session.collaborativeDoc.set(`finding:${findingId}`, findingData, userId);

    // Initialize revision history
    if (!session.revisionHistory.has(findingId)) {
      session.revisionHistory.set(findingId, []);
    }
    session.revisionHistory.get(findingId).push({
      timestamp: Date.now(),
      userId,
      action: 'created',
      data: JSON.parse(JSON.stringify(findingData))
    });

    this.emit('finding:added', {
      sessionId,
      findingId,
      userId,
      timestamp: Date.now()
    });

    return {
      success: true,
      findingId,
      finding: findingData
    };
  }

  /**
   * Get all findings for a session
   */
  getFindings(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const findings = Array.from(session.findings.values());
    return {
      success: true,
      sessionId,
      findings,
      total: findings.length
    };
  }

  /**
   * Update collaborative finding
   */
  updateFinding(sessionId, userId, findingId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const finding = session.findings.get(findingId);
    if (!finding) {
      return { success: false, error: 'finding-not-found' };
    }

    const canEdit = session.canUserEdit(userId);
    if (!canEdit) {
      return { success: false, error: 'permission-denied' };
    }

    // Store previous state for revision history
    const previousData = JSON.parse(JSON.stringify(finding));

    Object.assign(finding, updates, { updatedAt: Date.now() });
    if (!finding.contributors.includes(userId)) {
      finding.contributors.push(userId);
    }

    session.collaborativeDoc.set(`finding:${findingId}`, finding, userId);

    // Track revision
    if (!session.revisionHistory.has(findingId)) {
      session.revisionHistory.set(findingId, []);
    }
    session.revisionHistory.get(findingId).push({
      timestamp: Date.now(),
      userId,
      action: 'updated',
      changes: updates,
      data: JSON.parse(JSON.stringify(finding))
    });

    this.emit('finding:updated', {
      sessionId,
      findingId,
      userId,
      timestamp: Date.now()
    });

    return {
      success: true,
      finding
    };
  }

  /**
   * Get revision history for a finding
   */
  getRevisionHistory(sessionId, findingId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    const history = session.revisionHistory.get(findingId) || [];
    return {
      success: true,
      findingId,
      revisions: history,
      totalRevisions: history.length
    };
  }

  /**
   * Leave a collaborative session
   */
  leaveSession(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    session.removeParticipant(userId);
    this.users.delete(`${sessionId}:${userId}`);

    this.emit('user:left', {
      sessionId,
      userId,
      participantCount: session.participants.size,
      timestamp: Date.now()
    });

    if (session.participants.size === 0) {
      this.sessions.delete(sessionId);
      this.emit('session:closed', { sessionId, timestamp: Date.now() });
    }

    return {
      success: true,
      sessionId,
      participantCount: session.participants.size
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'session-not-found' };
    }

    return {
      success: true,
      sessionId,
      stats: {
        participants: session.participants.size,
        annotations: session.annotations.size,
        findings: session.findings.size,
        createdAt: new Date(session.createdAt).toISOString(),
        uptime: Date.now() - session.createdAt,
        accessCode: session.accessCode
      }
    };
  }
}

/**
 * Individual Collaborative Session
 */
class CollaborativeSession {
  constructor(sessionId, initiatorId, options = {}) {
    this.sessionId = sessionId;
    this.initiatorId = initiatorId;
    this.participants = new Map(); // userId -> role
    this.annotations = new Map(); // annotationId -> annotationData
    this.findings = new Map(); // findingId -> findingData
    this.collaborativeDoc = new CollaborativeDocument(sessionId);
    this.revisionHistory = new Map(); // findingId -> revisions[]
    this.createdAt = Date.now();
    this.accessCode = this.generateAccessCode();
    this.rolePermissions = {
      viewer: { read: true, write: false, admin: false },
      editor: { read: true, write: true, admin: false },
      admin: { read: true, write: true, admin: true }
    };

    this.addParticipant(initiatorId, 'admin');
  }

  generateAccessCode() {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  addParticipant(userId, role) {
    if (!this.rolePermissions[role]) {
      return { success: false, error: 'invalid-role' };
    }

    if (this.participants.has(userId)) {
      return { success: false, error: 'user-already-in-session' };
    }

    this.participants.set(userId, role);
    return { success: true, role };
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
    return { success: true };
  }

  getRolePermissions(role) {
    return this.rolePermissions[role] || this.rolePermissions.viewer;
  }

  canUserEdit(userId) {
    const role = this.participants.get(userId);
    const permissions = this.getRolePermissions(role);
    return permissions.write;
  }

  canUserAdmin(userId) {
    const role = this.participants.get(userId);
    const permissions = this.getRolePermissions(role);
    return permissions.admin;
  }
}

module.exports = {
  SessionCollaborationManager,
  CollaborativeSession,
  CollaborativeDocument
};
