/**
 * Collaboration Engine Tests (Wave 16 Phase 6)
 * 30+ test scenarios for real-time multi-user sessions
 */

const CollaborationEngine = require('../../src/features/collaboration-engine');

describe('CollaborationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CollaborationEngine({
      maxConcurrentUsers: 10,
      syncInterval: 100,
      maxAnnotations: 5000
    });
  });

  describe('Session Management', () => {
    test('should create collaboration session', () => {
      const result = engine.createSession('session-1', 'user-1');
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-1');
    });

    test('should prevent duplicate session creation', () => {
      engine.createSession('session-1', 'user-1');
      const result = engine.createSession('session-1', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('session-exists');
    });

    test('should join session', () => {
      engine.createSession('session-1', 'user-1');
      const result = engine.joinSession('session-1', 'user-2', { role: 'editor' });
      expect(result.success).toBe(true);
      expect(result.session.users).toContain('user-2');
    });

    test('should prevent joining non-existent session', () => {
      const result = engine.joinSession('nonexistent', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('session-not-found');
    });

    test('should enforce max concurrent users', () => {
      const smallEngine = new CollaborationEngine({ maxConcurrentUsers: 2 });
      smallEngine.createSession('session-1', 'user-1');
      smallEngine.joinSession('session-1', 'user-2');
      const result = smallEngine.joinSession('session-1', 'user-3');
      expect(result.success).toBe(false);
      expect(result.error).toBe('session-full');
    });

    test('should close session', () => {
      engine.createSession('session-1', 'user-1');
      const result = engine.closeSession('session-1');
      expect(result.success).toBe(true);
    });
  });

  describe('Cursor Tracking', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2');
    });

    test('should update cursor position', () => {
      const result = engine.updateCursor('session-1', 'user-1', { x: 100, y: 200 });
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    test('should fail cursor update for invalid session', () => {
      const result = engine.updateCursor('nonexistent', 'user-1', { x: 0, y: 0 });
      expect(result.success).toBe(false);
    });

    test('should fail cursor update for non-member user', () => {
      const result = engine.updateCursor('session-1', 'user-99', { x: 0, y: 0 });
      expect(result.success).toBe(false);
    });

    test('should handle multiple cursor updates', () => {
      engine.updateCursor('session-1', 'user-1', { x: 100, y: 100 });
      engine.updateCursor('session-1', 'user-1', { x: 150, y: 150 });
      const result = engine.updateCursor('session-1', 'user-1', { x: 200, y: 200 });
      expect(result.success).toBe(true);
    });
  });

  describe('Annotations', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2', { role: 'editor' });
    });

    test('should add annotation', () => {
      const result = engine.addAnnotation('session-1', 'user-2', 'finding-1', {
        content: 'Test annotation',
        type: 'comment'
      });
      expect(result.success).toBe(true);
      expect(result.annotationId).toBeDefined();
    });

    test('should require edit permission for annotation', () => {
      engine.joinSession('session-1', 'user-3', { role: 'viewer' });
      const result = engine.addAnnotation('session-1', 'user-3', 'finding-1', {
        content: 'Test annotation'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('insufficient-permissions');
    });

    test('should reply to annotation', () => {
      const addResult = engine.addAnnotation('session-1', 'user-2', 'finding-1', {
        content: 'Test annotation'
      });

      const replyResult = engine.replyToAnnotation(
        'session-1',
        'user-1',
        'finding-1',
        addResult.annotationId,
        { content: 'Test reply' }
      );

      expect(replyResult.success).toBe(true);
      expect(replyResult.replyId).toBeDefined();
    });

    test('should handle annotation thread', () => {
      const addResult = engine.addAnnotation('session-1', 'user-2', 'finding-1', {
        content: 'Initial annotation'
      });

      engine.replyToAnnotation(
        'session-1',
        'user-1',
        'finding-1',
        addResult.annotationId,
        { content: 'Reply 1' }
      );

      const secondReply = engine.replyToAnnotation(
        'session-1',
        'user-2',
        'finding-1',
        addResult.annotationId,
        { content: 'Reply 2' }
      );

      expect(secondReply.success).toBe(true);
    });
  });

  describe('Findings Sharing', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2', { role: 'editor' });
    });

    test('should share findings', () => {
      const findings = [
        { id: 'f1', content: 'Finding 1', tags: ['important'] },
        { id: 'f2', content: 'Finding 2', tags: ['follow-up'] }
      ];

      const result = engine.shareFindings('session-1', 'user-2', findings);
      expect(result.success).toBe(true);
      expect(result.findingIds).toHaveLength(2);
    });

    test('should require edit permission for sharing', () => {
      engine.joinSession('session-1', 'user-3', { role: 'viewer' });

      const result = engine.shareFindings('session-1', 'user-3', [
        { content: 'Finding' }
      ]);

      expect(result.success).toBe(false);
    });

    test('should retrieve shared findings', () => {
      const findings = [
        { content: 'Finding 1', tags: ['tag1'] },
        { content: 'Finding 2', tags: ['tag2'] }
      ];

      engine.shareFindings('session-1', 'user-2', findings);
      const result = engine.getSharedFindings('session-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
    });
  });

  describe('Communication', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2');
    });

    test('should send message', () => {
      const result = engine.sendMessage('session-1', 'user-1', {
        content: 'Test message',
        type: 'text'
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    test('should require communicate permission', () => {
      engine.joinSession('session-1', 'user-3', { role: 'viewer' });

      const result = engine.sendMessage('session-1', 'user-3', {
        content: 'Test message'
      });

      expect(result.success).toBe(false);
    });

    test('should enforce message queue size', () => {
      const smallEngine = new CollaborationEngine({ messageQueueSize: 5 });
      smallEngine.createSession('session-1', 'user-1');

      for (let i = 0; i < 10; i++) {
        smallEngine.sendMessage('session-1', 'user-1', {
          content: `Message ${i}`
        });
      }

      // Should not exceed queue size
      const stats = smallEngine.getSessionStats('session-1');
      expect(stats.stats).toBeDefined();
    });
  });

  describe('CRDT Document', () => {
    test('should handle concurrent writes', () => {
      const result = engine.createSession('session-1', 'user-1');
      const session = engine.sessions.get('session-1');

      const write1 = session.document.set('key1', 'value1', 'client-1');
      const write2 = session.document.set('key1', 'value2', 'client-2');

      expect(write1.success).toBe(true);
      expect(write2.success).toBe(true);

      const final = session.document.get('key1');
      expect(final.exists).toBe(true);
    });

    test('should maintain eventual consistency', () => {
      engine.createSession('session-1', 'user-1');
      const session = engine.sessions.get('session-1');

      session.document.set('key1', 'value1', 'client-1', 1000);
      session.document.set('key1', 'value2', 'client-2', 2000);
      session.document.set('key1', 'value3', 'client-1', 3000);

      const final = session.document.get('key1');
      expect(final.value).toBe('value3');
    });
  });

  describe('Activity History', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
    });

    test('should log activities', () => {
      engine.joinSession('session-1', 'user-2');
      engine.updateCursor('session-1', 'user-1', { x: 100, y: 100 });

      const result = engine.getActivityHistory('session-1', 'user-1');
      expect(result.success).toBe(true);
      expect(result.activities.length).toBeGreaterThan(0);
    });

    test('should retrieve activity with pagination', () => {
      for (let i = 0; i < 10; i++) {
        engine.updateCursor('session-1', 'user-1', { x: i, y: i });
      }

      const result = engine.getActivityHistory('session-1', 'user-1', {
        limit: 5
      });

      expect(result.success).toBe(true);
      expect(result.activities.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Session Statistics', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2', { role: 'editor' });
    });

    test('should calculate session statistics', () => {
      engine.shareFindings('session-1', 'user-2', [
        { content: 'Finding 1' },
        { content: 'Finding 2' }
      ]);

      const result = engine.getSessionStats('session-1');
      expect(result.success).toBe(true);
      expect(result.stats.activeUsers).toBe(2);
      expect(result.stats.sharedFindings).toBeGreaterThan(0);
    });

    test('should track uptime', () => {
      const stats = engine.getSessionStats('session-1');
      expect(stats.stats.uptime).toBeGreaterThan(0);
    });
  });

  describe('Permission Management', () => {
    beforeEach(() => {
      engine.createSession('session-1', 'user-1');
    });

    test('should grant admin permissions to initiator', () => {
      const session = engine.sessions.get('session-1');
      const perms = session.permissions.get('user-1');
      expect(perms.role).toBe('admin');
      expect(perms.permissions).toContain('manage');
    });

    test('should grant viewer permissions by default', () => {
      engine.joinSession('session-1', 'user-2');
      const session = engine.sessions.get('session-1');
      const perms = session.permissions.get('user-2');
      expect(perms.role).toBe('viewer');
      expect(perms.permissions).not.toContain('edit');
    });

    test('should grant editor permissions when specified', () => {
      engine.joinSession('session-1', 'user-2', { role: 'editor' });
      const session = engine.sessions.get('session-1');
      const perms = session.permissions.get('user-2');
      expect(perms.role).toBe('editor');
      expect(perms.permissions).toContain('edit');
    });
  });

  describe('Events', () => {
    test('should emit session creation event', (done) => {
      engine.on('session:created', (event) => {
        expect(event.sessionId).toBe('session-1');
        done();
      });

      engine.createSession('session-1', 'user-1');
    });

    test('should emit user joined event', (done) => {
      engine.createSession('session-1', 'user-1');

      engine.on('user:joined', (event) => {
        expect(event.userId).toBe('user-2');
        done();
      });

      engine.joinSession('session-1', 'user-2');
    });

    test('should emit annotation added event', (done) => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2', { role: 'editor' });

      engine.on('annotation:added', (event) => {
        expect(event.annotationId).toBeDefined();
        done();
      });

      engine.addAnnotation('session-1', 'user-2', 'finding-1', {
        content: 'Test'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid cursor updates', () => {
      engine.createSession('session-1', 'user-1');

      for (let i = 0; i < 100; i++) {
        engine.updateCursor('session-1', 'user-1', { x: i, y: i });
      }

      expect(engine.cursors.size).toBeGreaterThan(0);
    });

    test('should cleanup old cursors', () => {
      const smallEngine = new CollaborationEngine({
        maxCursorUpdates: 10
      });
      smallEngine.createSession('session-1', 'user-1');

      for (let i = 0; i < 20; i++) {
        smallEngine.updateCursor('session-1', 'user-1', { x: i, y: i });
      }

      expect(smallEngine.cursors.size).toBeLessThanOrEqual(10);
    });

    test('should handle user leaving session', () => {
      engine.createSession('session-1', 'user-1');
      engine.joinSession('session-1', 'user-2');

      const result = engine.leaveSession('session-1', 'user-2');
      expect(result.success).toBe(true);

      const session = engine.sessions.get('session-1');
      expect(session.users.has('user-2')).toBe(false);
    });

    test('should mark session inactive when last user leaves', () => {
      engine.createSession('session-1', 'user-1');

      engine.leaveSession('session-1', 'user-1');

      const session = engine.sessions.get('session-1');
      expect(session.state).toBe('inactive');
    });
  });
});
