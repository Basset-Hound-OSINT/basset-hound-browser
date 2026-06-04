/**
 * Database Migrations Manager
 *
 * Handles schema creation, versioning, and automatic execution
 */

const EventEmitter = require('events');

class Migrations extends EventEmitter {
  constructor(dbPool) {
    super();
    this.dbPool = dbPool;
    this.migrations = [];
    this.applied = [];
  }

  /**
   * Register a migration
   */
  registerMigration(name, upSql, downSql = '') {
    this.migrations.push({
      name,
      upSql,
      downSql,
      timestamp: Date.now(),
    });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get already applied migrations
      this.applied = await this.getAppliedMigrations();

      // Run pending migrations
      for (const migration of this.migrations) {
        if (!this.applied.includes(migration.name)) {
          await this.runMigration(migration);
        }
      }

      this.emit('migrations:complete', { count: this.migrations.length });
      return true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(migration) {
    try {
      console.log(`Applying migration: ${migration.name}`);

      // Execute migration
      const statements = migration.upSql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.dbPool.query(statement);
        }
      }

      // Record in migrations table
      const query = `
        INSERT INTO migrations (name, applied_at)
        VALUES ($1, CURRENT_TIMESTAMP)
      `;
      await this.dbPool.query(query, [migration.name]);

      this.applied.push(migration.name);
      this.emit('migration:applied', { name: migration.name });

      console.log(`✓ Migration applied: ${migration.name}`);
    } catch (err) {
      console.error(`✗ Migration failed: ${migration.name}`, err.message);
      this.emit('migration:failed', { name: migration.name, error: err });
      throw err;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await this.dbPool.query(query);
    } catch (err) {
      // Table might already exist
      this.emit('debug', { message: 'Migrations table already exists' });
    }
  }

  /**
   * Get list of already applied migrations
   */
  async getAppliedMigrations() {
    try {
      const query = `SELECT name FROM migrations ORDER BY applied_at`;
      const result = await this.dbPool.query(query);
      return result.rows.map(row => row.name);
    } catch (err) {
      return [];
    }
  }

  /**
   * Initialize default schema
   */
  initializeDefaultMigrations() {
    // Migration: Create sessions table
    this.registerMigration('001_create_sessions_table', `
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        client_ip INET NOT NULL,
        user_agent TEXT,
        browser_fingerprint VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        activity_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        CONSTRAINT sessions_user_id_idx USING BTREE (user_id),
        CONSTRAINT sessions_expires_idx USING BTREE (expires_at),
        CONSTRAINT sessions_user_active_idx USING BTREE (user_id, is_active)
      )
    `);

    // Migration: Create monitoring_tasks table
    this.registerMigration('002_create_monitoring_tasks_table', `
      CREATE TABLE IF NOT EXISTS monitoring_tasks (
        task_id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        target_url TEXT NOT NULL,
        check_interval_seconds INTEGER DEFAULT 300,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total_checks INTEGER DEFAULT 0,
        changes_detected INTEGER DEFAULT 0,
        last_check_at TIMESTAMP,
        config JSONB DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS monitoring_tasks_user_idx ON monitoring_tasks (user_id, status);
      CREATE INDEX IF NOT EXISTS monitoring_tasks_status_idx ON monitoring_tasks (status, last_check_at);
    `);

    // Migration: Create changes_detected table
    this.registerMigration('003_create_changes_detected_table', `
      CREATE TABLE IF NOT EXISTS changes_detected (
        change_id VARCHAR(100) PRIMARY KEY,
        task_id VARCHAR(100) NOT NULL REFERENCES monitoring_tasks(task_id),
        change_type VARCHAR(50),
        severity VARCHAR(20),
        old_hash VARCHAR(64),
        new_hash VARCHAR(64),
        diff_summary TEXT,
        detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        screenshot_url TEXT,
        evidence JSONB DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS changes_task_idx ON changes_detected (task_id, detected_at);
      CREATE INDEX IF NOT EXISTS changes_severity_idx ON changes_detected (severity, detected_at);
    `);

    // Migration: Create alerts table
    this.registerMigration('004_create_alerts_table', `
      CREATE TABLE IF NOT EXISTS alerts (
        alert_id VARCHAR(100) PRIMARY KEY,
        task_id VARCHAR(100) NOT NULL REFERENCES monitoring_tasks(task_id),
        alert_type VARCHAR(50),
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        severity VARCHAR(20),
        triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        notification_sent BOOLEAN DEFAULT false,
        notification_channels JSONB
      );
      CREATE INDEX IF NOT EXISTS alerts_task_idx ON alerts (task_id, triggered_at);
      CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts (status, severity);
    `);

    // Migration: Create forensic_evidence table
    this.registerMigration('005_create_forensic_evidence_table', `
      CREATE TABLE IF NOT EXISTS forensic_evidence (
        evidence_id VARCHAR(100) PRIMARY KEY,
        change_id VARCHAR(100) REFERENCES changes_detected(change_id),
        content_type VARCHAR(50),
        content_url TEXT,
        content_hash VARCHAR(64),
        metadata JSONB,
        captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS forensic_change_idx ON forensic_evidence (change_id);
    `);

    // Migration: Create audit_log table
    this.registerMigration('006_create_audit_log_table', `
      CREATE TABLE IF NOT EXISTS audit_log (
        log_id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        action VARCHAR(100),
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_log (user_id, created_at);
    `);
  }
}

module.exports = Migrations;
