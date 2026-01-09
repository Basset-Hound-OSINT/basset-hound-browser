/**
 * Evidence Collection WebSocket Commands
 *
 * Phase 18: WebSocket API for evidence collection workflow (Simplified)
 *
 * Provides commands for:
 * - Individual evidence capture (screenshot, archive, HAR, DOM, console, cookies, storage)
 * - SHA-256 hash generation
 * - Chain of custody documentation
 *
 * Removed:
 * - Evidence package management
 * - Package sealing and court export
 * - Investigation organization
 */

const {
  Evidence,
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS,
} = require('../../evidence/evidence-collector');

/**
 * Evidence collector instance (initialized when commands are registered)
 */
let evidenceCollector = null;

/**
 * Initialize evidence collector
 *
 * @param {Object} config - Configuration options
 */
function initializeEvidenceCollector(config = {}) {
  evidenceCollector = new EvidenceCollector(config);

  // Set up event handlers
  evidenceCollector.on('evidenceCaptured', (summary) => {
    console.log(`[Evidence] Evidence captured: ${summary.id} (${summary.type})`);
  });

  return evidenceCollector;
}

/**
 * Get the evidence collector instance
 */
function getEvidenceCollector() {
  if (!evidenceCollector) {
    initializeEvidenceCollector();
  }
  return evidenceCollector;
}

/**
 * Register evidence commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 * @param {Function} captureFunction - Function to capture page content
 */
function registerEvidenceCommands(commandHandlers, captureFunction) {
  // Initialize collector if not already done
  if (!evidenceCollector) {
    initializeEvidenceCollector();
  }

  // ==========================================
  // EVIDENCE CAPTURE COMMANDS
  // ==========================================

  /**
   * Capture screenshot evidence
   *
   * Command: capture_screenshot_evidence
   * Params:
   *   - imageData: string (base64) or buffer
   *   - url: string
   *   - title: string (optional)
   *   - fullPage: boolean (optional)
   *   - annotations: array (optional)
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_screenshot_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureScreenshot(params.imageData, {
        url: params.url,
        title: params.title,
        viewport: params.viewport,
        fullPage: params.fullPage,
        annotations: params.annotations,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture page archive evidence
   *
   * Command: capture_page_archive_evidence
   * Params:
   *   - content: string (HTML/MHTML content)
   *   - format: 'mhtml' | 'html' | 'warc' | 'pdf'
   *   - url: string
   *   - title: string (optional)
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_page_archive_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.capturePageArchive(
        params.content,
        params.format || ARCHIVE_FORMATS.MHTML,
        {
          url: params.url,
          title: params.title,
          capturedBy: params.capturedBy,
        }
      );

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture network HAR evidence
   *
   * Command: capture_har_evidence
   * Params:
   *   - harData: object (HAR format)
   *   - url: string
   *   - duration: number (optional)
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_har_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureNetworkHAR(params.harData, {
        url: params.url,
        duration: params.duration,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture DOM snapshot evidence
   *
   * Command: capture_dom_evidence
   * Params:
   *   - domContent: string
   *   - url: string
   *   - nodeCount: number (optional)
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_dom_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureDOMSnapshot(params.domContent, {
        url: params.url,
        nodeCount: params.nodeCount,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture console log evidence
   *
   * Command: capture_console_evidence
   * Params:
   *   - logs: array
   *   - url: string
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_console_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureConsoleLogs(params.logs, {
        url: params.url,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture cookies evidence
   *
   * Command: capture_cookies_evidence
   * Params:
   *   - cookies: array
   *   - url: string
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_cookies_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureCookies(params.cookies, {
        url: params.url,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Capture localStorage evidence
   *
   * Command: capture_storage_evidence
   * Params:
   *   - storageData: object
   *   - url: string
   *   - capturedBy: string (optional)
   */
  commandHandlers.capture_storage_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureLocalStorage(params.storageData, {
        url: params.url,
        capturedBy: params.capturedBy,
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // UTILITY COMMANDS
  // ==========================================

  /**
   * Get available evidence types
   *
   * Command: get_evidence_types
   */
  commandHandlers.get_evidence_types = async () => {
    return {
      success: true,
      types: EVIDENCE_TYPES,
      archiveFormats: ARCHIVE_FORMATS,
    };
  };

  console.log('[Evidence] 8 evidence commands registered');
}

module.exports = {
  registerEvidenceCommands,
  initializeEvidenceCollector,
  getEvidenceCollector,
};
