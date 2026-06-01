/**
 * WebSocket Commands for Session Persistence Week 2
 * Exposes failure recovery, session history, and campaign management
 *
 * @module websocket/commands/session-persistence-week2-commands
 * @version 1.0.0
 * @created June 1, 2026
 */

const { FailureRecoveryManager } = require('../../src/sessions/failure-recovery');
const { SessionHistoryManager } = require('../../src/sessions/session-history');
const { CampaignManager } = require('../../src/features/campaign-manager');

// Global managers
let failureRecoveryManager = null;
let sessionHistoryManager = null;
let campaignManager = null;

/**
 * Register session persistence Week 2 commands
 */
function registerSessionPersistenceWeek2Commands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  // Initialize managers
  if (!failureRecoveryManager) {
    failureRecoveryManager = new FailureRecoveryManager();
  }
  if (!sessionHistoryManager) {
    sessionHistoryManager = new SessionHistoryManager();
  }
  if (!campaignManager) {
    campaignManager = new CampaignManager();
  }

  // ============================================================
  // FAILURE RECOVERY COMMANDS
  // ============================================================

  /**
   * Detect failure type from error response
   *
   * Command: detect_failure_type
   * Params: { sessionId: string, statusCode: number, headers?: {}, body?: string }
   * Response: { detection: object }
   */
  commandHandlers.detect_failure_type = async (params) => {
    try {
      if (!params.sessionId || params.statusCode === undefined) {
        throw new Error('sessionId and statusCode are required');
      }

      const detection = failureRecoveryManager.detectFailureType(
        params.sessionId,
        params.statusCode,
        params.headers || {},
        params.body || ''
      );

      return {
        success: true,
        detection
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Handle failure and get recovery strategy
   *
   * Command: handle_failure
   * Params: { sessionId: string, failureType: string, details?: {}, lastCheckpoint?: string }
   * Response: { recovery: object }
   */
  commandHandlers.handle_failure = async (params) => {
    try {
      if (!params.sessionId || !params.failureType) {
        throw new Error('sessionId and failureType are required');
      }

      const recovery = failureRecoveryManager.handleFailure(
        params.sessionId,
        params.failureType,
        params.details || {},
        params.lastCheckpoint || null
      );

      return {
        success: true,
        recovery
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Check if retry is allowed (respects backoff)
   *
   * Command: can_retry_session
   * Params: { sessionId: string }
   * Response: { canRetry: boolean, timeUntilRetry: number }
   */
  commandHandlers.can_retry_session = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const canRetry = failureRecoveryManager.canRetry(params.sessionId);
      const timeUntilRetry = failureRecoveryManager.getTimeUntilRetry(params.sessionId);

      return {
        success: true,
        canRetry,
        timeUntilRetry
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Record successful recovery
   *
   * Command: record_recovery_success
   * Params: { sessionId: string }
   * Response: { success: boolean }
   */
  commandHandlers.record_recovery_success = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      failureRecoveryManager.recordRecoverySuccess(params.sessionId);

      return {
        success: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get recovery metrics for session
   *
   * Command: get_recovery_metrics
   * Params: { sessionId: string }
   * Response: { metrics: object }
   */
  commandHandlers.get_recovery_metrics = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const metrics = failureRecoveryManager.getRecoveryMetrics(params.sessionId);

      return {
        success: true,
        metrics
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get recovery log for session
   *
   * Command: get_recovery_log
   * Params: { sessionId: string, filter?: { type?: string, failureType?: string, since?: number } }
   * Response: { log: array }
   */
  commandHandlers.get_recovery_log = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const log = failureRecoveryManager.getRecoveryLog(
        params.sessionId,
        params.filter || {}
      );

      return {
        success: true,
        log
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export recovery data
   *
   * Command: export_recovery_data
   * Params: { sessionId: string, format?: 'json' | 'csv' }
   * Response: { data: string }
   */
  commandHandlers.export_recovery_data = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const data = failureRecoveryManager.exportRecoveryData(
        params.sessionId,
        params.format || 'json'
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // SESSION HISTORY COMMANDS
  // ============================================================

  /**
   * Record operation in session history
   *
   * Command: record_operation
   * Params: { sessionId: string, operation: { type: string, status?: string, url?: string, duration?: number, resultSize?: number, error?: any, metadata?: {} } }
   * Response: { operationId: string }
   */
  commandHandlers.record_operation = async (params) => {
    try {
      if (!params.sessionId || !params.operation) {
        throw new Error('sessionId and operation are required');
      }

      const operationId = sessionHistoryManager.recordOperation(
        params.sessionId,
        params.operation
      );

      return {
        success: true,
        operationId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Record session event
   *
   * Command: record_session_event
   * Params: { sessionId: string, eventType: string, details?: {} }
   * Response: { eventId: string }
   */
  commandHandlers.record_session_event = async (params) => {
    try {
      if (!params.sessionId || !params.eventType) {
        throw new Error('sessionId and eventType are required');
      }

      const eventId = sessionHistoryManager.recordEvent(
        params.sessionId,
        params.eventType,
        params.details || {}
      );

      return {
        success: true,
        eventId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Query operations in session history
   *
   * Command: query_session_operations
   * Params: { sessionId: string, filters?: { operationType?: string, status?: string, since?: number, until?: number, url?: string, limit?: number } }
   * Response: { operations: array }
   */
  commandHandlers.query_session_operations = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const operations = sessionHistoryManager.queryOperations(
        params.sessionId,
        params.filters || {}
      );

      return {
        success: true,
        operations,
        count: operations.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get session history summary
   *
   * Command: get_session_history_summary
   * Params: { sessionId: string }
   * Response: { summary: object }
   */
  commandHandlers.get_session_history_summary = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const summary = sessionHistoryManager.getSummary(params.sessionId);

      return {
        success: true,
        summary
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get session history statistics
   *
   * Command: get_session_statistics
   * Params: { sessionId: string, timeRangeMs?: number }
   * Response: { statistics: object }
   */
  commandHandlers.get_session_statistics = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const stats = sessionHistoryManager.getStatistics(
        params.sessionId,
        params.timeRangeMs
      );

      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export session history to JSON
   *
   * Command: export_session_history_json
   * Params: { sessionId: string, filters?: {} }
   * Response: { data: string }
   */
  commandHandlers.export_session_history_json = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const data = sessionHistoryManager.exportToJson(
        params.sessionId,
        params.filters || {}
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export session history to CSV
   *
   * Command: export_session_history_csv
   * Params: { sessionId: string, filters?: {} }
   * Response: { data: string }
   */
  commandHandlers.export_session_history_csv = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const data = sessionHistoryManager.exportToCsv(
        params.sessionId,
        params.filters || {}
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export session history to forensic format
   *
   * Command: export_session_forensic
   * Params: { sessionId: string, investigatorId?: string }
   * Response: { data: string }
   */
  commandHandlers.export_session_forensic = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const data = sessionHistoryManager.exportForensic(
        params.sessionId,
        params.investigatorId || 'unknown'
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // CAMPAIGN MANAGEMENT COMMANDS
  // ============================================================

  /**
   * Create new campaign
   *
   * Command: create_campaign
   * Params: { name?: string, description?: string, maxParallelSessions?: number, metadata?: {} }
   * Response: { campaign: object }
   */
  commandHandlers.create_campaign = async (params) => {
    try {
      const campaign = campaignManager.createCampaign({
        name: params.name,
        description: params.description,
        maxParallelSessions: params.maxParallelSessions || 5,
        metadata: params.metadata || {}
      });

      return {
        success: true,
        campaign: campaign.getStatus()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get campaign status
   *
   * Command: get_campaign_status
   * Params: { campaignId: string }
   * Response: { campaign: object }
   */
  commandHandlers.get_campaign_status = async (params) => {
    try {
      if (!params.campaignId) {
        throw new Error('campaignId is required');
      }

      const campaign = campaignManager.getCampaign(params.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${params.campaignId}`);
      }

      return {
        success: true,
        campaign: campaign.getStatus()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Add session to campaign
   *
   * Command: add_campaign_session
   * Params: { campaignId: string, sessionId: string, sessionConfig?: {} }
   * Response: { sessionState: object }
   */
  commandHandlers.add_campaign_session = async (params) => {
    try {
      if (!params.campaignId || !params.sessionId) {
        throw new Error('campaignId and sessionId are required');
      }

      const campaign = campaignManager.getCampaign(params.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${params.campaignId}`);
      }

      const sessionState = campaign.addSession(params.sessionId, params.sessionConfig || {});

      return {
        success: true,
        sessionState
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Mark campaign session as completed
   *
   * Command: complete_campaign_session
   * Params: { campaignId: string, sessionId: string, results?: {} }
   * Response: { success: boolean }
   */
  commandHandlers.complete_campaign_session = async (params) => {
    try {
      if (!params.campaignId || !params.sessionId) {
        throw new Error('campaignId and sessionId are required');
      }

      const campaign = campaignManager.getCampaign(params.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${params.campaignId}`);
      }

      campaign.completeSession(params.sessionId, params.results || {});

      return {
        success: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Mark campaign session as failed
   *
   * Command: fail_campaign_session
   * Params: { campaignId: string, sessionId: string, error?: string }
   * Response: { success: boolean }
   */
  commandHandlers.fail_campaign_session = async (params) => {
    try {
      if (!params.campaignId || !params.sessionId) {
        throw new Error('campaignId and sessionId are required');
      }

      const campaign = campaignManager.getCampaign(params.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${params.campaignId}`);
      }

      const error = new Error(params.error || 'Session failed');
      campaign.failSession(params.sessionId, error);

      return {
        success: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Update shared context in campaign
   *
   * Command: update_campaign_context
   * Params: { campaignId: string, key: string, value: any, sessionId?: string }
   * Response: { success: boolean }
   */
  commandHandlers.update_campaign_context = async (params) => {
    try {
      if (!params.campaignId || !params.key) {
        throw new Error('campaignId and key are required');
      }

      const campaign = campaignManager.getCampaign(params.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${params.campaignId}`);
      }

      campaign.updateContext(params.key, params.value, params.sessionId);

      return {
        success: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get campaign statistics
   *
   * Command: get_campaign_statistics
   * Params: { campaignId: string }
   * Response: { statistics: object }
   */
  commandHandlers.get_campaign_statistics = async (params) => {
    try {
      if (!params.campaignId) {
        throw new Error('campaignId is required');
      }

      const stats = campaignManager.getStatistics(params.campaignId);

      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export campaign results
   *
   * Command: export_campaign_results
   * Params: { campaignId: string, format?: 'json' | 'csv' }
   * Response: { data: string }
   */
  commandHandlers.export_campaign_results = async (params) => {
    try {
      if (!params.campaignId) {
        throw new Error('campaignId is required');
      }

      const data = campaignManager.exportResults(
        params.campaignId,
        params.format || 'json'
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List campaigns
   *
   * Command: list_campaigns
   * Params: { filter?: { status?: string, name?: string, createdSince?: number } }
   * Response: { campaigns: array }
   */
  commandHandlers.list_campaigns = async (params) => {
    try {
      const campaigns = campaignManager.listCampaigns(params.filter || {});

      return {
        success: true,
        campaigns,
        count: campaigns.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = { registerSessionPersistenceWeek2Commands };
