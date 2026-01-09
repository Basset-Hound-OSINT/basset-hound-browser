/**
 * WebSocket Commands for Evidence Chain of Custody
 *
 * Phase 29: Evidence Chain of Custody
 *
 * Provides forensic-grade evidence collection with RFC 3161 timestamping,
 * SHA-256 hashing, tamper-proof audit trails, and SWGDE-compliant reporting.
 *
 * Standards Compliance:
 * - RFC 3161: Time-Stamp Protocol (TSP)
 * - ISO 27037: Digital evidence identification and preservation
 * - SWGDE: Requirements for Report Writing in Digital Forensics
 * - NIST IR 8387: Digital Evidence Preservation
 *
 * @module websocket/commands/evidence-chain-commands
 */

const { EvidenceManager, EVIDENCE_TYPES, CUSTODY_EVENTS } = require('../../evidence/evidence-manager');

// Global evidence manager instance
let evidenceManager = null;

/**
 * Register evidence chain of custody WebSocket commands
 */
function registerEvidenceChainCommands(server, mainWindow) {
  /**
   * Initialize evidence manager
   *
   * Command: init_evidence_chain
   * Params: {
   *   basePath?: string,
   *   autoVerify?: boolean,
   *   autoSeal?: boolean,
   *   timestampServer?: string,
   *   enableBlockchain?: boolean
   * }
   * Response: { initialized: true, config: {} }
   */
  server.registerCommand('init_evidence_chain', async (params) => {
    try {
      if (evidenceManager) {
        return { success: false, error: 'Evidence manager already initialized' };
      }

      evidenceManager = new EvidenceManager({
        basePath: params.basePath,
        autoVerify: params.autoVerify,
        autoSeal: params.autoSeal,
        timestampServer: params.timestampServer,
        enableBlockchain: params.enableBlockchain
      });

      // Setup event forwarding
      evidenceManager.on('investigation-created', (data) => {
        server.broadcast('evidence_chain_event', { type: 'investigation-created', ...data });
      });

      evidenceManager.on('evidence-collected', (data) => {
        server.broadcast('evidence_chain_event', { type: 'evidence-collected', evidenceId: data.id, type_: data.type });
      });

      evidenceManager.on('evidence-sealed', (data) => {
        server.broadcast('evidence_chain_event', { type: 'evidence-sealed', evidenceId: data.evidenceId });
      });

      evidenceManager.on('verification-failed', (data) => {
        server.broadcast('evidence_chain_event', { type: 'verification-failed', evidenceId: data.evidenceId });
      });

      evidenceManager.on('package-created', (data) => {
        server.broadcast('evidence_chain_event', { type: 'package-created', packageId: data.id });
      });

      evidenceManager.on('package-sealed', (data) => {
        server.broadcast('evidence_chain_event', { type: 'package-sealed', packageId: data.id });
      });

      evidenceManager.on('audit-entry', (data) => {
        server.broadcast('evidence_chain_event', { type: 'audit-entry', action: data.action, timestamp: data.timestamp });
      });

      return {
        success: true,
        initialized: true,
        config: evidenceManager.config,
        basePath: evidenceManager.basePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Create new investigation
   *
   * Command: create_investigation
   * Params: {
   *   name: string,
   *   description?: string,
   *   investigator?: string,
   *   caseId?: string,
   *   metadata?: {}
   * }
   * Response: { investigation: {} }
   */
  server.registerCommand('create_investigation', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized. Call init_evidence_chain first.');
      }

      if (!params.name) {
        throw new Error('name is required');
      }

      const investigation = evidenceManager.createInvestigation({
        name: params.name,
        description: params.description,
        investigator: params.investigator,
        caseId: params.caseId,
        metadata: params.metadata
      });

      return {
        success: true,
        investigation: investigation
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Collect evidence with full chain of custody
   *
   * Command: collect_evidence_chain
   * Params: {
   *   type: string,
   *   data: any,
   *   metadata?: {},
   *   actor?: string,
   *   tags?: string[],
   *   caseId?: string,
   *   investigationId?: string
   * }
   * Response: { evidence: {} }
   */
  server.registerCommand('collect_evidence_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.type || !params.data) {
        throw new Error('type and data are required');
      }

      const item = await evidenceManager.collectEvidence({
        type: params.type,
        data: params.data,
        metadata: params.metadata,
        actor: params.actor,
        tags: params.tags,
        caseId: params.caseId,
        investigationId: params.investigationId
      });

      return {
        success: true,
        evidence: item.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Verify evidence integrity
   *
   * Command: verify_evidence_chain
   * Params: { evidenceId: string }
   * Response: { verified: boolean, evidence: {} }
   */
  server.registerCommand('verify_evidence_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.evidenceId) {
        throw new Error('evidenceId is required');
      }

      const verified = evidenceManager.verifyEvidence(params.evidenceId);
      const item = evidenceManager.getEvidence(params.evidenceId);

      return {
        success: true,
        verified: verified,
        evidence: item ? item.toJSON() : null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Seal evidence (make immutable)
   *
   * Command: seal_evidence_chain
   * Params: { evidenceId: string, actor?: string }
   * Response: { evidence: {} }
   */
  server.registerCommand('seal_evidence_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.evidenceId) {
        throw new Error('evidenceId is required');
      }

      const item = evidenceManager.sealEvidence(params.evidenceId, params.actor);

      return {
        success: true,
        evidence: item.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Create evidence package
   *
   * Command: create_evidence_package
   * Params: {
   *   name: string,
   *   description?: string,
   *   caseId?: string,
   *   investigationId?: string,
   *   metadata?: {},
   *   actor?: string
   * }
   * Response: { package: {} }
   */
  server.registerCommand('create_evidence_package', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.name) {
        throw new Error('name is required');
      }

      const pkg = evidenceManager.createPackage({
        name: params.name,
        description: params.description,
        caseId: params.caseId,
        investigationId: params.investigationId,
        metadata: params.metadata,
        actor: params.actor
      });

      return {
        success: true,
        package: pkg.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Add evidence to package
   *
   * Command: add_to_evidence_package
   * Params: { packageId: string, evidenceId: string }
   * Response: { package: {} }
   */
  server.registerCommand('add_to_evidence_package', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.packageId || !params.evidenceId) {
        throw new Error('packageId and evidenceId are required');
      }

      const pkg = evidenceManager.addToPackage(params.packageId, params.evidenceId);

      return {
        success: true,
        package: pkg.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Seal evidence package
   *
   * Command: seal_evidence_package
   * Params: { packageId: string, actor?: string }
   * Response: { package: {} }
   */
  server.registerCommand('seal_evidence_package', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.packageId) {
        throw new Error('packageId is required');
      }

      const pkg = evidenceManager.sealPackage(params.packageId, params.actor);

      return {
        success: true,
        package: pkg.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Export evidence package
   *
   * Command: export_evidence_package
   * Params: {
   *   packageId: string,
   *   format?: 'json' | 'swgde-report',
   *   includeAudit?: boolean,
   *   persist?: boolean,
   *   actor?: string
   * }
   * Response: { exportData: any, filePath?: string }
   */
  server.registerCommand('export_evidence_package', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.packageId) {
        throw new Error('packageId is required');
      }

      const exportData = await evidenceManager.exportPackage(params.packageId, {
        format: params.format || 'json',
        includeAudit: params.includeAudit !== false,
        persist: params.persist !== false,
        actor: params.actor
      });

      return {
        success: true,
        exportData: exportData,
        format: params.format || 'json'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get evidence by ID
   *
   * Command: get_evidence_chain
   * Params: { evidenceId: string }
   * Response: { evidence: {} }
   */
  server.registerCommand('get_evidence_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!params.evidenceId) {
        throw new Error('evidenceId is required');
      }

      const item = evidenceManager.getEvidence(params.evidenceId);

      if (!item) {
        throw new Error(`Evidence not found: ${params.evidenceId}`);
      }

      return {
        success: true,
        evidence: item.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * List all evidence
   *
   * Command: list_evidence_chain
   * Params: {
   *   type?: string,
   *   investigationId?: string,
   *   caseId?: string,
   *   sealed?: boolean,
   *   verified?: boolean
   * }
   * Response: { evidence: [], count: number }
   */
  server.registerCommand('list_evidence_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      const filters = {
        type: params.type,
        investigationId: params.investigationId,
        caseId: params.caseId,
        sealed: params.sealed,
        verified: params.verified
      };

      const items = evidenceManager.listEvidence(filters);

      return {
        success: true,
        evidence: items.map(item => item.toJSON()),
        count: items.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get evidence chain statistics
   *
   * Command: get_evidence_chain_stats
   * Response: { stats: {} }
   */
  server.registerCommand('get_evidence_chain_stats', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      const stats = evidenceManager.getStatistics();

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get chain of custody audit log
   *
   * Command: get_chain_audit_log
   * Params: {
   *   investigationId?: string,
   *   actor?: string,
   *   action?: string
   * }
   * Response: { auditLog: [], count: number }
   */
  server.registerCommand('get_chain_audit_log', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      const filters = {
        investigationId: params.investigationId,
        actor: params.actor,
        action: params.action
      };

      const log = evidenceManager.getAuditLog(filters);

      return {
        success: true,
        auditLog: log,
        count: log.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Export audit log
   *
   * Command: export_chain_audit_log
   * Params: {
   *   investigationId?: string,
   *   actor?: string,
   *   action?: string
   * }
   * Response: { filename: string, path: string, entries: number }
   */
  server.registerCommand('export_chain_audit_log', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      const filters = {
        investigationId: params.investigationId,
        actor: params.actor,
        action: params.action
      };

      const result = await evidenceManager.exportAuditLog({ filters });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Collect screenshot with chain of custody
   *
   * Command: collect_screenshot_chain
   * Params: {
   *   investigationId?: string,
   *   caseId?: string,
   *   actor?: string,
   *   tags?: string[],
   *   metadata?: {}
   * }
   * Response: { evidence: {} }
   */
  server.registerCommand('collect_screenshot_chain', async (params) => {
    try {
      if (!evidenceManager) {
        throw new Error('Evidence manager not initialized');
      }

      if (!mainWindow || !mainWindow.webContents) {
        throw new Error('Main window not available');
      }

      // Capture screenshot
      const image = await mainWindow.webContents.capturePage();
      const screenshotData = image.toDataURL();

      // Get page metadata
      const url = mainWindow.webContents.getURL();
      const title = mainWindow.webContents.getTitle();

      // Collect as evidence
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: {
          screenshot: screenshotData,
          url: url,
          title: title,
          timestamp: Date.now(),
          size: image.getSize()
        },
        metadata: {
          ...params.metadata,
          url: url,
          title: title,
          capturedAt: new Date().toISOString()
        },
        actor: params.actor,
        tags: params.tags,
        caseId: params.caseId,
        investigationId: params.investigationId
      });

      return {
        success: true,
        evidence: item.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerEvidenceChainCommands };
