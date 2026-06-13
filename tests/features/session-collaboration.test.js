/**
 * Tests for Session Collaboration Feature (Wave 16 Phase 6)
 * Tests real-time multi-user session sharing, CRDT conflict resolution,
 * live cursor tracking, and collaborative annotations.
 */

const {
  SessionCollaborationManager,
  CollaborativeSession,
  CollaborativeDocument
} = require('../../src/features/session-collaboration');

describe('Session Collaboration Feature - Wave 16 Phase 6', () => {
  let manager;
  const sessionId = 'collab-session-001';
  const userId1 = 'user-001';
  const userId2 = 'user-002';
  const userId3 = 'user-003';

  beforeEach(() => {
    manager = new SessionCollaborationManager({
      maxConcurrentUsers: 10,
      maxAnnotations: 100
    });
  });

  // ==========================================
  // SESSION CREATION & MANAGEMENT
  // ==========================================

  describe('Session Creation', () => {
    test('should create a new collaborative session', () => {
      const result = manager.createSession(sessionId, userId1);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.accessCode).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    test('should reject duplicate session creation', () => {
      manager.createSession(sessionId, userId1);
      const duplicate = manager.createSession(sessionId, userId2);

      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toBe('session-already-exists');
    });

    test('should generate unique access codes', () => {
      const result1 = manager.createSession('session-1', userId1);
      const result2 = manager.createSession('session-2', userId2);

      expect(result1.accessCode).not.toBe(result2.accessCode);
    });
  });

  // ==========================================
  // USER PARTICIPATION
  // ==========================================

  describe('User Participation', () => {
    beforeEach(() => {
      manager.createSession(sessionId, userId1);
    });

    test('should allow users to join session', () => {
      const result = manager.joinSession(sessionId, userId2, 'editor');

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.participantCount).toBe(2);
    });

    test('should assign correct roles to participants', () => {
      manager.joinSession(sessionId, userId2, 'viewer');
      manager.joinSession(sessionId, userId3, 'admin');

      const session = manager.sessions.get(sessionId);
      expect(session.participants.get(userId2)).toBe('viewer');
      expect(session.participants.get(userId3)).toBe('admin');
    });

    test('should prevent users from joining non-existent session', () => {
      const result = manager.joinSession('non-existent', userId2, 'viewer');

      expect(result.success).toBe(false);
      expect(result.error).toBe('session-not-found');
    });

    test('should enforce max concurrent users', () => {
      const smallManager = new SessionCollaborationManager({ maxConcurrentUsers: 2 });
      smallManager.createSession(sessionId, userId1);
      smallManager.joinSession(sessionId, userId2, 'viewer');

      const result = smallManager.joinSession(sessionId, userId3, 'viewer');
      expect(result.success).toBe(false);
      expect(result.error).toBe('session-full');
    });

    test('should get active participants with cursor positions', () => {
      manager.joinSession(sessionId, userId2, 'editor');
      manager.joinSession(sessionId, userId3, 'viewer');

      manager.updateCursor(sessionId, userId1, 100, 200);
      manager.updateCursor(sessionId, userId2, 300, 400);

      const result = manager.getActiveParticipants(sessionId);

      expect(result.success).toBe(true);
      expect(result.participants.length).toBe(3);
      expect(result.participants[0].cursor.x).toBe(100);
      expect(result.participants[0].cursor.y).toBe(200);
    });
  });

  // ==========================================
  // LIVE CURSOR TRACKING
  // ==========================================

  describe('Live Cursor Tracking', () => {
    beforeEach(() => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'editor');
    });

    test('should track cursor position updates', () => {
      const result = manager.updateCursor(sessionId, userId1, 150, 250);

      expect(result.success).toBe(true);

      const participants = manager.getActiveParticipants(sessionId);
      const user1Cursor = participants.participants.find(p => p.userId === userId1);

      expect(user1Cursor.cursor.x).toBe(150);
      expect(user1Cursor.cursor.y).toBe(250);
    });

    test('should handle cursor updates from multiple users', () => {
      manager.updateCursor(sessionId, userId1, 100, 100);
      manager.updateCursor(sessionId, userId2, 200, 200);

      const participants = manager.getActiveParticipants(sessionId);

      expect(participants.participants.length).toBe(2);
      expect(participants.participants.some(p => p.cursor.x === 100)).toBe(true);
      expect(participants.participants.some(p => p.cursor.x === 200)).toBe(true);
    });

    test('should reject cursor updates from non-existent user', () => {
      const result = manager.updateCursor(sessionId, 'non-existent', 100, 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('user-not-found');
    });
  });

  // ==========================================
  // COLLABORATIVE ANNOTATIONS
  // ==========================================

  describe('Collaborative Annotations', () => {
    beforeEach(() => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'editor');
    });

    test('should add annotation to evidence', () => {
      const result = manager.addAnnotation(sessionId, userId2, 'evidence-001', {
        content: 'Suspicious activity detected',
        type: 'comment',
        position: { x: 100, y: 200 }
      });

      expect(result.success).toBe(true);
      expect(result.annotationId).toBeDefined();
      expect(result.annotation.content).toBe('Suspicious activity detected');
      expect(result.annotation.type).toBe('comment');
    });

    test('should deny annotation creation to viewers', () => {
      manager.joinSession(sessionId, userId3, 'viewer');

      const result = manager.addAnnotation(sessionId, userId3, 'evidence-001', {
        content: 'Cannot add',
        type: 'comment'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission-denied');
    });

    test('should allow threaded replies to annotations', () => {
      const annotation = manager.addAnnotation(sessionId, userId2, 'evidence-001', {
        content: 'Initial observation',
        type: 'comment'
      });

      const reply = manager.replyToAnnotation(sessionId, userId1, annotation.annotationId, {
        content: 'Good point, needs verification'
      });

      expect(reply.success).toBe(true);
      expect(reply.replyId).toBeDefined();
      expect(reply.reply.content).toBe('Good point, needs verification');
    });

    test('should track multiple annotation types', () => {
      manager.addAnnotation(sessionId, userId2, 'evidence-001', {
        content: 'Comment text',
        type: 'comment'
      });

      manager.addAnnotation(sessionId, userId2, 'evidence-001', {
        content: 'Highlight text',
        type: 'highlight',
        color: '#FF0000'
      });

      manager.addAnnotation(sessionId, userId2, 'evidence-001', {
        content: 'Flag for review',
        type: 'flag'
      });

      const session = manager.sessions.get(sessionId);
      const annotations = Array.from(session.annotations.values());

      expect(annotations.filter(a => a.type === 'comment').length).toBe(1);
      expect(annotations.filter(a => a.type === 'highlight').length).toBe(1);
      expect(annotations.filter(a => a.type === 'flag').length).toBe(1);
    });

    test('should enforce annotation limit', () => {
      const smallManager = new SessionCollaborationManager({ maxAnnotations: 2 });
      smallManager.createSession(sessionId, userId1);
      smallManager.joinSession(sessionId, userId2, 'editor');

      smallManager.addAnnotation(sessionId, userId2, 'ev-1', { content: 'Note 1' });
      smallManager.addAnnotation(sessionId, userId2, 'ev-2', { content: 'Note 2' });

      const result = smallManager.addAnnotation(sessionId, userId2, 'ev-3', { content: 'Note 3' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('annotation-limit-reached');
    });
  });

  // ==========================================
  // COLLABORATIVE FINDINGS
  // ==========================================

  describe('Collaborative Findings', () => {
    beforeEach(() => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'editor');
    });

    test('should add collaborative finding', () => {
      const result = manager.addFinding(sessionId, userId2, {
        title: 'Suspicious Login',
        description: 'Multiple failed login attempts detected',
        tags: ['security', 'alert'],
        severity: 'high',
        evidence: ['ev-001', 'ev-002']
      });

      expect(result.success).toBe(true);
      expect(result.finding.title).toBe('Suspicious Login');
      expect(result.finding.contributors).toContain(userId2);
    });

    test('should deny finding creation to viewers', () => {
      manager.joinSession(sessionId, userId3, 'viewer');

      const result = manager.addFinding(sessionId, userId3, {
        title: 'Finding',
        description: 'Cannot add'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission-denied');
    });

    test('should retrieve all findings for session', () => {
      manager.addFinding(sessionId, userId2, {
        title: 'Finding 1',
        description: 'First finding'
      });

      manager.addFinding(sessionId, userId1, {
        title: 'Finding 2',
        description: 'Second finding'
      });

      const result = manager.getFindings(sessionId);

      expect(result.success).toBe(true);
      expect(result.findings.length).toBe(2);
      expect(result.total).toBe(2);
    });

    test('should update findings and track contributors', () => {
      const finding = manager.addFinding(sessionId, userId2, {
        title: 'Original Title',
        description: 'Original description'
      });

      const updated = manager.updateFinding(sessionId, userId1, finding.findingId, {
        title: 'Updated Title',
        status: 'investigating'
      });

      expect(updated.success).toBe(true);
      expect(updated.finding.title).toBe('Updated Title');
      expect(updated.finding.contributors).toContain(userId1);
      expect(updated.finding.contributors).toContain(userId2);
    });

    test('should track revision history', () => {
      const finding = manager.addFinding(sessionId, userId2, {
        title: 'Original',
        description: 'Description'
      });

      manager.updateFinding(sessionId, userId1, finding.findingId, { title: 'Updated' });
      manager.updateFinding(sessionId, userId2, finding.findingId, { status: 'closed' });

      const history = manager.getRevisionHistory(sessionId, finding.findingId);

      expect(history.success).toBe(true);
      expect(history.totalRevisions).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  describe('Session Management', () => {
    test('should leave session and remove user', () => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'editor');

      const result = manager.leaveSession(sessionId, userId2);

      expect(result.success).toBe(true);
      expect(result.participantCount).toBe(1);
    });

    test('should close session when all users leave', () => {
      manager.createSession(sessionId, userId1);

      manager.leaveSession(sessionId, userId1);

      expect(manager.sessions.has(sessionId)).toBe(false);
    });

    test('should get session statistics', () => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'editor');
      manager.addAnnotation(sessionId, userId2, 'ev-1', { content: 'Note' });
      manager.addFinding(sessionId, userId2, { title: 'Finding' });

      const result = manager.getSessionStats(sessionId);

      expect(result.success).toBe(true);
      expect(result.stats.participants).toBe(2);
      expect(result.stats.annotations).toBe(1);
      expect(result.stats.findings).toBe(1);
    });
  });

  // ==========================================
  // CRDT CONFLICT RESOLUTION
  // ==========================================

  describe('CRDT Collaborative Document', () => {
    let doc;

    beforeEach(() => {
      doc = new CollaborativeDocument('doc-001');
    });

    test('should handle last-write-wins conflicts', () => {
      const set1 = doc.set('key1', 'value1', 'client-1');
      const set2 = doc.set('key1', 'value2', 'client-2');

      const final = doc.get('key1');

      expect(set1.success).toBe(true);
      expect(set2.success).toBe(true);
      expect(final.value).toBe('value2');
    });

    test('should reject stale writes', () => {
      doc.set('key1', 'value1', 'client-1');

      // Simulate stale write with older timestamp
      doc.entries.get('key1').timestamp = Date.now() + 1000;
      const staleWrite = doc.set('key1', 'stale-value', 'client-2');

      // The stale write should fail because the first write has a later timestamp
      expect(staleWrite.success).toBe(false);
    });

    test('should track deletions with tombstones', () => {
      doc.set('key1', 'value1', 'client-1');
      const deletion = doc.delete('key1', 'client-2');

      expect(deletion.success).toBe(true);
      expect(doc.tombstones.has('key1')).toBe(true);
    });

    test('should provide conflict log', () => {
      doc.set('key1', 'value1', 'client-1');
      doc.set('key2', 'value2', 'client-2');
      doc.set('key3', 'value3', 'client-1');

      const log = doc.getConflictLog();

      expect(log.length).toBe(3);
      expect(log[0].value).toBe('value1');
    });
  });

  // ==========================================
  // EVENT EMISSIONS
  // ==========================================

  describe('Event Emissions', () => {
    test('should emit session creation event', (done) => {
      manager.on('session:created', ({ sessionId, initiatorId }) => {
        expect(sessionId).toBe('event-session');
        expect(initiatorId).toBe(userId1);
        done();
      });

      manager.createSession('event-session', userId1);
    });

    test('should emit user joined event', (done) => {
      manager.createSession(sessionId, userId1);

      manager.on('user:joined', ({ sessionId, userId, participantCount }) => {
        expect(userId).toBe(userId2);
        expect(participantCount).toBe(2);
        done();
      });

      manager.joinSession(sessionId, userId2, 'editor');
    });

    test('should emit cursor updated event', (done) => {
      manager.createSession(sessionId, userId1);

      manager.on('cursor:updated', ({ sessionId, userId, cursor }) => {
        expect(cursor.x).toBe(100);
        expect(cursor.y).toBe(200);
        done();
      });

      manager.updateCursor(sessionId, userId1, 100, 200);
    });
  });

  // ==========================================
  // PERMISSION ENFORCEMENT
  // ==========================================

  describe('Permission Enforcement', () => {
    beforeEach(() => {
      manager.createSession(sessionId, userId1);
      manager.joinSession(sessionId, userId2, 'viewer');
      manager.joinSession(sessionId, userId3, 'editor');
    });

    test('should enforce role-based permissions', () => {
      const session = manager.sessions.get(sessionId);

      expect(session.canUserEdit(userId1)).toBe(true); // admin
      expect(session.canUserEdit(userId2)).toBe(false); // viewer
      expect(session.canUserEdit(userId3)).toBe(true); // editor
    });

    test('should prevent viewers from making changes', () => {
      const annotResult = manager.addAnnotation(sessionId, userId2, 'ev-1', {
        content: 'Cannot annotate'
      });

      expect(annotResult.success).toBe(false);
      expect(annotResult.error).toBe('permission-denied');
    });

    test('should allow admins full permissions', () => {
      const annotat = manager.addAnnotation(sessionId, userId1, 'ev-1', {
        content: 'Admin can annotate'
      });

      expect(annotat.success).toBe(true);
    });
  });
});
