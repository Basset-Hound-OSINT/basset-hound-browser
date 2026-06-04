/**
 * Session Persistence Layer
 *
 * Provides high-level session management:
 * - Create, read, update, delete sessions
 * - Session validation and lifecycle management
 * - TTL enforcement
 * - Monitoring and statistics
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class SessionStore extends EventEmitter {
  constructor(redisManager, dbPool) {
    super();

    this.redisManager = redisManager;
    this.dbPool = dbPool;

    this.sessionStats = {
      created: 0,
      accessed: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
    };

    // Session schema validation
    this.schema = {
      session_id: 'string',
      user_id: 'string',
      client_ip: 'string',
      browser_fingerprint: 'string',
      created_at: 'number',
      last_accessed: 'number',
      activity_count: 'number',
      current_url: 'string',
      profile_id: 'string',
      is_authenticated: 'boolean',
      metadata: 'object',
      capture_state: 'object',
      monitoring_config: 'object',
    };
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return `sess_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Validate session data against schema
   */
  validateSession(session) {
    const errors = [];

    for (const [field, type] of Object.entries(this.schema)) {
      if (field === 'metadata' || field === 'capture_state' || field === 'monitoring_config') {
        // Optional object fields
        if (session[field] && typeof session[field] !== 'object') {
          errors.push(`${field} must be an object`);
        }
      } else if (['session_id', 'user_id', 'client_ip'].includes(field)) {
        // Required fields
        if (!session[field]) {
          errors.push(`${field} is required`);
        } else if (typeof session[field] !== type) {
          errors.push(`${field} must be ${type}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new session
   */
  async createSession(sessionData) {
    try {
      // Generate session ID if not provided
      if (!sessionData.session_id) {
        sessionData.session_id = this.generateSessionId();
      }

      // Set timestamps
      const now = Date.now();
      sessionData.created_at = sessionData.created_at || now;
      sessionData.last_accessed = sessionData.last_accessed || now;
      sessionData.activity_count = sessionData.activity_count || 0;

      // Validate
      const validation = this.validateSession(sessionData);
      if (!validation.isValid) {
        throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
      }

      // Store in Redis (hot cache)
      await this.redisManager.createSession(sessionData.session_id, sessionData);

      // Store in database (write-through consistency)
      if (this.dbPool) {
        await this.writeSessionToDb(sessionData);
      }

      this.sessionStats.created++;
      this.emit('session:created', {
        sessionId: sessionData.session_id,
        userId: sessionData.user_id,
        timestamp: now,
      });

      return sessionData;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId) {
    try {
      // Try Redis first (hot cache)
      let session = await this.redisManager.getSession(sessionId);

      if (!session && this.dbPool) {
        // Fall back to database
        session = await this.getSessionFromDb(sessionId);

        if (session) {
          // Restore to Redis cache
          await this.redisManager.createSession(sessionId, session);
        }
      }

      if (session) {
        // Update last_accessed
        session.last_accessed = Date.now();
        session.activity_count++;

        // Update both stores
        await this.redisManager.updateSession(sessionId, {
          last_accessed: session.last_accessed,
          activity_count: session.activity_count,
        });

        if (this.dbPool) {
          await this.updateSessionInDb(sessionId, {
            last_accessed: session.last_accessed,
            activity_count: session.activity_count,
          });
        }

        this.sessionStats.accessed++;
      }

      return session;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Update a session
   */
  async updateSession(sessionId, updates) {
    try {
      // Get current session
      let session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Merge updates
      const updated = { ...session, ...updates };
      updated.last_accessed = Date.now();

      // Validate updated session
      const validation = this.validateSession(updated);
      if (!validation.isValid) {
        throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
      }

      // Update Redis
      await this.redisManager.updateSession(sessionId, updates);

      // Update database
      if (this.dbPool) {
        await this.updateSessionInDb(sessionId, updates);
      }

      this.sessionStats.updated++;
      this.emit('session:updated', {
        sessionId,
        updates,
        timestamp: Date.now(),
      });

      return updated;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);

      // Delete from Redis
      await this.redisManager.deleteSession(sessionId);

      // Delete from database
      if (this.dbPool) {
        await this.deleteSessionFromDb(sessionId);
      }

      this.sessionStats.deleted++;
      this.emit('session:deleted', {
        sessionId,
        timestamp: Date.now(),
      });

      return true;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const sessions = await this.redisManager.getUserSessions(userId);
      return sessions;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Validate session integrity (check both stores are consistent)
   */
  async validateSessionIntegrity(sessionId) {
    try {
      const redisSession = await this.redisManager.getSession(sessionId);
      let dbSession = null;

      if (this.dbPool) {
        dbSession = await this.getSessionFromDb(sessionId);
      }

      const results = {
        sessionId,
        inRedis: !!redisSession,
        inDatabase: !!dbSession,
        consistent: true,
        issues: [],
      };

      if (redisSession && dbSession) {
        // Both exist - check consistency
        if (redisSession.activity_count !== dbSession.activity_count) {
          results.consistent = false;
          results.issues.push('activity_count mismatch');
        }
      } else if (redisSession && !dbSession && this.dbPool) {
        // In Redis but not in DB - Redis is newer
        results.consistent = false;
        results.issues.push('session exists in Redis but not in database');
      } else if (!redisSession && dbSession) {
        // In DB but not in Redis - likely expired from Redis
        results.consistent = true; // This is expected behavior
      }

      return results;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get session count
   */
  async getSessionCount() {
    try {
      return await this.redisManager.getSessionCount();
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Cleanup stale sessions
   */
  async cleanupStaleSessions() {
    try {
      const cleaned = await this.redisManager.cleanupStaleSessions();
      this.emit('sessions:cleaned', { count: cleaned });
      return cleaned;
    } catch (err) {
      this.sessionStats.errors++;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Database operations (if dbPool is available)
   */

  async writeSessionToDb(sessionData) {
    if (!this.dbPool) return;

    try {
      const query = `
        INSERT INTO sessions
        (session_id, user_id, client_ip, browser_fingerprint, created_at,
         last_accessed, expires_at, is_active, activity_count, metadata)
        VALUES ($1, $2, $3, $4, to_timestamp($5/1000),
                to_timestamp($6/1000), to_timestamp($7/1000), $8, $9, $10)
        ON CONFLICT (session_id) DO UPDATE SET
          last_accessed = to_timestamp($6/1000),
          activity_count = $9,
          metadata = $10
      `;

      const ttl = 86400000; // 24 hours in ms
      const expiresAt = Date.now() + ttl;

      await this.dbPool.query(query, [
        sessionData.session_id,
        sessionData.user_id,
        sessionData.client_ip,
        sessionData.browser_fingerprint || null,
        sessionData.created_at,
        sessionData.last_accessed,
        expiresAt,
        true,
        sessionData.activity_count,
        JSON.stringify(sessionData.metadata || {}),
      ]);
    } catch (err) {
      // Log but don't throw - cache is sufficient
      this.emit('db:error', err);
    }
  }

  async getSessionFromDb(sessionId) {
    if (!this.dbPool) return null;

    try {
      const query = `
        SELECT * FROM sessions WHERE session_id = $1 AND is_active = true
      `;

      const result = await this.dbPool.query(query, [sessionId]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        session_id: row.session_id,
        user_id: row.user_id,
        client_ip: row.client_ip,
        browser_fingerprint: row.browser_fingerprint,
        created_at: row.created_at.getTime(),
        last_accessed: row.last_accessed.getTime(),
        activity_count: row.activity_count,
        is_active: row.is_active,
        metadata: row.metadata,
      };
    } catch (err) {
      this.emit('db:error', err);
      return null;
    }
  }

  async updateSessionInDb(sessionId, updates) {
    if (!this.dbPool) return;

    try {
      const setClauses = [];
      const values = [sessionId];
      let paramIdx = 2;

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'last_accessed') {
          setClauses.push(`${key} = to_timestamp($${paramIdx}/1000)`);
          values.push(value);
        } else if (key === 'metadata') {
          setClauses.push(`${key} = $${paramIdx}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${key} = $${paramIdx}`);
          values.push(value);
        }
        paramIdx++;
      }

      if (setClauses.length === 0) return;

      const query = `
        UPDATE sessions SET ${setClauses.join(', ')}
        WHERE session_id = $1
      `;

      await this.dbPool.query(query, values);
    } catch (err) {
      this.emit('db:error', err);
    }
  }

  async deleteSessionFromDb(sessionId) {
    if (!this.dbPool) return;

    try {
      const query = `DELETE FROM sessions WHERE session_id = $1`;
      await this.dbPool.query(query, [sessionId]);
    } catch (err) {
      this.emit('db:error', err);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sessions: { ...this.sessionStats },
      timestamp: Date.now(),
    };
  }
}

module.exports = SessionStore;
