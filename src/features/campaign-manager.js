/**
 * Basset Hound Browser - Campaign Manager
 * Coordinate multiple parallel sessions for complex OSINT investigations
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Multi-session campaign coordination
 * - Parallel and sequential operation execution
 * - Shared context across sessions
 * - Results aggregation and analysis
 * - Campaign state tracking
 * - Event-driven architecture
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Campaign metadata and state
 */
class Campaign extends EventEmitter {
  constructor(options = {}) {
    super();

    this.id = crypto.randomBytes(12).toString('hex');
    this.name = options.name || `Campaign-${this.id.slice(0, 8)}`;
    this.description = options.description || '';
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.status = 'created'; // created, running, paused, completed, failed
    this.priority = options.priority || 'normal'; // low, normal, high, critical

    // Session management
    this.sessions = new Map(); // sessionId -> sessionState
    this.sessionSequence = options.sessionSequence || []; // ordered list of sessionIds
    this.maxParallelSessions = options.maxParallelSessions || 5;
    this.activeSessions = new Set();

    // Shared context (data passed between sessions)
    this.sharedContext = options.sharedContext || {};
    this.contextLocks = new Map(); // key -> lock info

    // Results aggregation
    this.results = new Map(); // sessionId -> sessionResults
    this.aggregatedResults = {};
    this.findings = [];

    // Dependencies (e.g., session A must complete before B starts)
    this.dependencies = options.dependencies || {}; // sessionId -> [dependentSessionIds]

    // Configuration
    this.config = {
      timeoutPerSession: options.timeoutPerSession || 300000, // 5min
      retryOnFailure: options.retryOnFailure !== false,
      maxRetries: options.maxRetries || 3,
      aggregationStrategy: options.aggregationStrategy || 'merge',
      errorHandling: options.errorHandling || 'continue' // continue or abort
    };

    // Metadata
    this.metadata = options.metadata || {};
  }

  /**
   * Add session to campaign
   */
  addSession(sessionId, sessionConfig = {}) {
    const sessionState = {
      id: sessionId,
      campaignId: this.id,
      config: sessionConfig,
      status: 'pending', // pending, running, completed, failed, retrying
      startTime: null,
      endTime: null,
      duration: 0,
      error: null,
      results: null,
      retryCount: 0,
      dependencies: sessionConfig.dependencies || []
    };

    this.sessions.set(sessionId, sessionState);
    this.updatedAt = Date.now();

    this.emit('session:added', { campaignId: this.id, sessionId });
    return sessionState;
  }

  /**
   * Check if all dependencies for a session are met
   */
  areDependenciesMet(sessionId) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState || !sessionState.dependencies.length) {
      return true;
    }

    return sessionState.dependencies.every(depId => {
      const depState = this.sessions.get(depId);
      return depState && depState.status === 'completed';
    });
  }

  /**
   * Get next session to run (respects parallel limit and dependencies)
   */
  getNextSession() {
    if (this.activeSessions.size >= this.maxParallelSessions) {
      return null;
    }

    // Find next pending session with met dependencies
    for (const [sessionId, sessionState] of this.sessions.entries()) {
      if (sessionState.status === 'pending' && !this.activeSessions.has(sessionId)) {
        if (this.areDependenciesMet(sessionId)) {
          return sessionId;
        }
      }
    }

    return null;
  }

  /**
   * Mark session as started
   */
  startSession(sessionId) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    sessionState.status = 'running';
    sessionState.startTime = Date.now();
    this.activeSessions.add(sessionId);
    this.status = 'running';
    this.updatedAt = Date.now();

    this.emit('session:started', { campaignId: this.id, sessionId });
  }

  /**
   * Mark session as completed
   */
  completeSession(sessionId, results) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    sessionState.status = 'completed';
    sessionState.endTime = Date.now();
    sessionState.duration = sessionState.endTime - sessionState.startTime;
    sessionState.results = results;
    this.activeSessions.delete(sessionId);
    this.results.set(sessionId, results);
    this.updatedAt = Date.now();

    this.emit('session:completed', {
      campaignId: this.id,
      sessionId,
      duration: sessionState.duration,
      results
    });

    // Aggregate results
    this._aggregateResults();
  }

  /**
   * Mark session as failed
   */
  failSession(sessionId, error) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    sessionState.status = 'failed';
    sessionState.endTime = Date.now();
    sessionState.duration = sessionState.endTime - sessionState.startTime;
    sessionState.error = error;
    this.activeSessions.delete(sessionId);
    this.updatedAt = Date.now();

    this.emit('session:failed', {
      campaignId: this.id,
      sessionId,
      error: error.message || error,
      duration: sessionState.duration
    });

    // Handle error based on config
    if (
      this.config.errorHandling === 'abort' ||
      (this.config.retryOnFailure && sessionState.retryCount >= this.config.maxRetries)
    ) {
      this.status = 'failed';
    }
  }

  /**
   * Retry failed session
   */
  retrySession(sessionId) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState || sessionState.status !== 'failed') {
      throw new Error(`Cannot retry non-failed session: ${sessionId}`);
    }

    if (sessionState.retryCount >= this.config.maxRetries) {
      throw new Error(`Max retries exceeded for session: ${sessionId}`);
    }

    sessionState.retryCount++;
    sessionState.status = 'retrying';
    sessionState.error = null;
    sessionState.startTime = null;
    sessionState.endTime = null;
    this.updatedAt = Date.now();

    this.emit('session:retrying', {
      campaignId: this.id,
      sessionId,
      attempt: sessionState.retryCount + 1
    });

    return sessionState;
  }

  /**
   * Aggregate results from completed sessions
   * @private
   */
  _aggregateResults() {
    const completedSessions = Array.from(this.sessions.values()).filter(
      s => s.status === 'completed' && s.results
    );

    if (completedSessions.length === 0) {
      return;
    }

    // Simple merge strategy by default
    this.aggregatedResults = {
      totalSessions: this.sessions.size,
      completedSessions: completedSessions.length,
      findings: [],
      dataPoints: {},
      correlations: [],
      timeline: []
    };

    // Merge all findings
    for (const session of completedSessions) {
      if (session.results.findings) {
        this.aggregatedResults.findings.push(...session.results.findings);
      }

      if (session.results.data) {
        Object.assign(this.aggregatedResults.dataPoints, session.results.data);
      }

      if (session.results.timeline) {
        this.aggregatedResults.timeline.push(...session.results.timeline);
      }
    }

    // Sort timeline
    this.aggregatedResults.timeline.sort((a, b) => a.timestamp - b.timestamp);

    // Identify correlations
    this._identifyCorrelations();

    this.emit('results:aggregated', {
      campaignId: this.id,
      aggregatedResults: this.aggregatedResults
    });
  }

  /**
   * Identify correlations between session results
   * @private
   */
  _identifyCorrelations() {
    // Basic correlation detection (can be enhanced)
    const urlMap = new Map();

    for (const [sessionId, results] of this.results.entries()) {
      if (results.urls) {
        for (const url of results.urls) {
          if (!urlMap.has(url)) {
            urlMap.set(url, []);
          }
          urlMap.get(url).push(sessionId);
        }
      }
    }

    // Find URLs visited by multiple sessions
    for (const [url, sessions] of urlMap.entries()) {
      if (sessions.length > 1) {
        this.aggregatedResults.correlations.push({
          type: 'shared_url',
          value: url,
          sessions: sessions,
          count: sessions.length
        });
      }
    }
  }

  /**
   * Lock a shared context key (for exclusive access)
   */
  lockContextKey(key, sessionId, timeout = 30000) {
    if (this.contextLocks.has(key)) {
      const lockInfo = this.contextLocks.get(key);
      if (lockInfo.sessionId !== sessionId && lockInfo.expiresAt > Date.now()) {
        throw new Error(`Context key "${key}" is locked by session ${lockInfo.sessionId}`);
      }
    }

    this.contextLocks.set(key, {
      sessionId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + timeout
    });

    this.emit('context:locked', { campaignId: this.id, key, sessionId });
  }

  /**
   * Unlock a shared context key
   */
  unlockContextKey(key, sessionId) {
    const lockInfo = this.contextLocks.get(key);
    if (lockInfo && lockInfo.sessionId !== sessionId) {
      throw new Error(`Session ${sessionId} cannot unlock key "${key}" (held by ${lockInfo.sessionId})`);
    }

    this.contextLocks.delete(key);
    this.emit('context:unlocked', { campaignId: this.id, key, sessionId });
  }

  /**
   * Update shared context
   */
  updateContext(key, value, sessionId = null) {
    if (this.contextLocks.has(key)) {
      const lockInfo = this.contextLocks.get(key);
      if (lockInfo.sessionId !== sessionId) {
        throw new Error(`Cannot update locked context key "${key}"`);
      }
    }

    this.sharedContext[key] = value;
    this.updatedAt = Date.now();

    this.emit('context:updated', { campaignId: this.id, key, sessionId });
  }

  /**
   * Get campaign status snapshot
   */
  getStatus() {
    const sessionStatuses = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retrying: 0
    };

    for (const session of this.sessions.values()) {
      sessionStatuses[session.status]++;
    }

    return {
      campaignId: this.id,
      name: this.name,
      status: this.status,
      progress: {
        total: this.sessions.size,
        completed: sessionStatuses.completed,
        failed: sessionStatuses.failed,
        active: this.activeSessions.size,
        percentage: this.sessions.size > 0
          ? (sessionStatuses.completed / this.sessions.size * 100).toFixed(2)
          : 0
      },
      sessionStatuses,
      duration: this.updatedAt - this.createdAt,
      startTime: this.createdAt,
      updatedTime: this.updatedAt
    };
  }
}

/**
 * Campaign manager
 */
class CampaignManager {
  constructor(options = {}) {
    this.storageDir = options.storageDir || '/tmp/basset-sessions/campaigns';
    this.campaigns = new Map(); // campaignId -> Campaign
    this.ensureStorageDir();
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
   * Create a new campaign
   */
  createCampaign(options = {}) {
    const campaign = new Campaign(options);
    this.campaigns.set(campaign.id, campaign);
    this._saveCampaign(campaign);
    return campaign;
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId) {
    return this.campaigns.get(campaignId);
  }

  /**
   * List all campaigns with optional filter
   */
  listCampaigns(filter = {}) {
    let campaigns = Array.from(this.campaigns.values());

    if (filter.status) {
      campaigns = campaigns.filter(c => c.status === filter.status);
    }

    if (filter.name) {
      campaigns = campaigns.filter(c => c.name.includes(filter.name));
    }

    if (filter.createdSince) {
      campaigns = campaigns.filter(c => c.createdAt >= filter.createdSince);
    }

    return campaigns.map(c => c.getStatus());
  }

  /**
   * Update campaign
   */
  updateCampaign(campaignId, updates = {}) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    Object.assign(campaign, updates);
    campaign.updatedAt = Date.now();
    this._saveCampaign(campaign);

    return campaign;
  }

  /**
   * Delete campaign
   */
  deleteCampaign(campaignId) {
    if (!this.campaigns.has(campaignId)) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    this.campaigns.delete(campaignId);

    const filePath = path.join(this.storageDir, `${campaignId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Save campaign to disk
   * @private
   */
  _saveCampaign(campaign) {
    const data = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      config: campaign.config,
      sessions: Array.from(campaign.sessions.values()),
      sharedContext: campaign.sharedContext,
      results: Array.from(campaign.results.entries()),
      aggregatedResults: campaign.aggregatedResults
    };

    const filePath = path.join(this.storageDir, `${campaign.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load campaign from disk
   */
  loadCampaign(campaignId) {
    const filePath = path.join(this.storageDir, `${campaignId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const campaign = new Campaign(data);

      // Restore session state
      campaign.sessions = new Map(data.sessions.map(s => [s.id, s]));
      campaign.results = new Map(data.results);
      campaign.aggregatedResults = data.aggregatedResults;

      this.campaigns.set(campaignId, campaign);
      return campaign;
    } catch (error) {
      console.error(`Failed to load campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Export campaign results
   */
  exportResults(campaignId, format = 'json') {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const exportData = {
      campaign: campaign.getStatus(),
      sessions: Array.from(campaign.sessions.values()).map(s => ({
        id: s.id,
        status: s.status,
        duration: s.duration,
        results: campaign.results.get(s.id)
      })),
      aggregatedResults: campaign.aggregatedResults
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this._exportToCsv(exportData);
    }

    return exportData;
  }

  /**
   * Export results to CSV
   * @private
   */
  _exportToCsv(data) {
    const rows = [];
    rows.push('campaign_id,session_id,status,duration,findings');

    for (const session of data.sessions) {
      const findings = session.results?.findings?.length || 0;
      rows.push(
        `${data.campaign.campaignId},${session.id},${session.status},${session.duration},${findings}`
      );
    }

    return rows.join('\n');
  }

  /**
   * Get campaign statistics
   */
  getStatistics(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const completedSessions = Array.from(campaign.sessions.values())
      .filter(s => s.status === 'completed');
    const failedSessions = Array.from(campaign.sessions.values())
      .filter(s => s.status === 'failed');

    const totalDuration = Array.from(campaign.sessions.values())
      .reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      campaignId,
      totalSessions: campaign.sessions.size,
      completedSessions: completedSessions.length,
      failedSessions: failedSessions.length,
      successRate: completedSessions.length / campaign.sessions.size * 100,
      totalDuration,
      averageDuration: totalDuration / campaign.sessions.size,
      findings: campaign.aggregatedResults.findings?.length || 0,
      dataPoints: Object.keys(campaign.aggregatedResults.dataPoints || {}).length
    };
  }
}

module.exports = { Campaign, CampaignManager };
