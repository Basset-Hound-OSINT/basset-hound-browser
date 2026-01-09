/**
 * Evidence Collection WebSocket Commands
 *
 * Phase 18: WebSocket API for evidence collection workflow
 *
 * Provides commands for:
 * - Evidence package management
 * - Screenshot/archive capture
 * - Chain of custody documentation
 * - Court-ready export
 */

const {
  Evidence,
  EvidencePackage,
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
  evidenceCollector.on('packageCreated', (summary) => {
    console.log(`[Evidence] Package created: ${summary.id}`);
  });

  evidenceCollector.on('evidenceCaptured', (summary) => {
    console.log(`[Evidence] Evidence captured: ${summary.id} (${summary.type})`);
  });

  evidenceCollector.on('packageSealed', (data) => {
    console.log(`[Evidence] Package sealed: ${data.packageId} (hash: ${data.hash.substring(0, 16)}...)`);
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
  // PACKAGE MANAGEMENT COMMANDS
  // ==========================================

  /**
   * Create new evidence package
   *
   * Command: create_evidence_package
   * Params:
   *   - name: string
   *   - description: string (optional)
   *   - investigationId: string (optional)
   *   - caseNumber: string (optional)
   *   - tags: string[] (optional)
   */
  commandHandlers.create_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.createPackage({
        name: params.name || 'Evidence Package',
        description: params.description,
        investigationId: params.investigationId,
        caseNumber: params.caseNumber,
        tags: params.tags,
        createdBy: params.createdBy || 'user',
      });

      return {
        success: true,
        packageId: pkg.id,
        package: pkg.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get evidence package by ID
   *
   * Command: get_evidence_package
   * Params:
   *   - packageId: string
   */
  commandHandlers.get_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.getPackage(params.packageId);

      if (!pkg) {
        return {
          success: false,
          error: `Package ${params.packageId} not found`,
        };
      }

      return {
        success: true,
        package: pkg.getSummary(),
        evidenceIds: Array.from(pkg.evidence.keys()),
        annotations: pkg.annotations,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * List all evidence packages
   *
   * Command: list_evidence_packages
   */
  commandHandlers.list_evidence_packages = async () => {
    try {
      const collector = getEvidenceCollector();
      const packages = collector.listPackages();

      return {
        success: true,
        packages,
        count: packages.length,
        activePackageId: collector.activePackageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Set active evidence package
   *
   * Command: set_active_evidence_package
   * Params:
   *   - packageId: string
   */
  commandHandlers.set_active_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.setActivePackage(params.packageId);

      return {
        success: true,
        packageId: params.packageId,
        package: pkg.getSummary(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Add annotation to package
   *
   * Command: add_package_annotation
   * Params:
   *   - packageId: string (optional, uses active)
   *   - text: string
   *   - author: string
   *   - evidenceIds: string[] (optional)
   */
  commandHandlers.add_package_annotation = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const packageId = params.packageId || collector.activePackageId;

      if (!packageId) {
        return {
          success: false,
          error: 'No package specified and no active package',
        };
      }

      const pkg = collector.getPackage(packageId);
      if (!pkg) {
        return {
          success: false,
          error: `Package ${packageId} not found`,
        };
      }

      pkg.addAnnotation(params.text, params.author || 'user', params.evidenceIds || []);

      return {
        success: true,
        packageId,
        annotationCount: pkg.annotations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Seal evidence package
   *
   * Command: seal_evidence_package
   * Params:
   *   - packageId: string (optional, uses active)
   *   - sealedBy: string
   */
  commandHandlers.seal_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const packageId = params.packageId || collector.activePackageId;

      if (!packageId) {
        return {
          success: false,
          error: 'No package specified and no active package',
        };
      }

      if (packageId === collector.activePackageId) {
        const hash = collector.sealActivePackage(params.sealedBy || 'user');
        return {
          success: true,
          packageId,
          packageHash: hash,
          sealed: true,
        };
      }

      const pkg = collector.getPackage(packageId);
      if (!pkg) {
        return {
          success: false,
          error: `Package ${packageId} not found`,
        };
      }

      const hash = pkg.seal(params.sealedBy || 'user');
      return {
        success: true,
        packageId,
        packageHash: hash,
        sealed: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Verify package integrity
   *
   * Command: verify_evidence_package
   * Params:
   *   - packageId: string
   */
  commandHandlers.verify_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.getPackage(params.packageId);

      if (!pkg) {
        return {
          success: false,
          error: `Package ${params.packageId} not found`,
        };
      }

      const verification = pkg.verifyPackage();
      return {
        success: true,
        packageId: params.packageId,
        verification,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

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
  // EVIDENCE RETRIEVAL COMMANDS
  // ==========================================

  /**
   * Get evidence by ID
   *
   * Command: get_evidence
   * Params:
   *   - packageId: string
   *   - evidenceId: string
   */
  commandHandlers.get_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.getPackage(params.packageId);

      if (!pkg) {
        return {
          success: false,
          error: `Package ${params.packageId} not found`,
        };
      }

      const evidence = pkg.getEvidence(params.evidenceId);
      if (!evidence) {
        return {
          success: false,
          error: `Evidence ${params.evidenceId} not found in package`,
        };
      }

      return {
        success: true,
        evidence: evidence.toJSON(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get evidence summary (without data)
   *
   * Command: get_evidence_summary
   * Params:
   *   - packageId: string
   *   - evidenceId: string
   */
  commandHandlers.get_evidence_summary = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.getPackage(params.packageId);

      if (!pkg) {
        return {
          success: false,
          error: `Package ${params.packageId} not found`,
        };
      }

      const evidence = pkg.getEvidence(params.evidenceId);
      if (!evidence) {
        return {
          success: false,
          error: `Evidence ${params.evidenceId} not found in package`,
        };
      }

      return {
        success: true,
        summary: evidence.getSummary(),
        custodyChain: evidence.custodyChain,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Verify evidence integrity
   *
   * Command: verify_evidence
   * Params:
   *   - packageId: string
   *   - evidenceId: string
   */
  commandHandlers.verify_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const pkg = collector.getPackage(params.packageId);

      if (!pkg) {
        return {
          success: false,
          error: `Package ${params.packageId} not found`,
        };
      }

      const evidence = pkg.getEvidence(params.evidenceId);
      if (!evidence) {
        return {
          success: false,
          error: `Evidence ${params.evidenceId} not found in package`,
        };
      }

      return {
        success: true,
        evidenceId: params.evidenceId,
        integrityValid: evidence.verifyIntegrity(),
        contentHash: evidence.contentHash,
        hashAlgorithm: evidence.hashAlgorithm,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // EXPORT COMMANDS
  // ==========================================

  /**
   * Export package for court
   *
   * Command: export_for_court
   * Params:
   *   - packageId: string
   */
  commandHandlers.export_for_court = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const exportData = collector.exportPackage(params.packageId, 'court');

      return {
        success: true,
        packageId: params.packageId,
        export: exportData,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Export package as JSON
   *
   * Command: export_evidence_package
   * Params:
   *   - packageId: string
   */
  commandHandlers.export_evidence_package = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const exportData = collector.exportPackage(params.packageId, 'json');

      return {
        success: true,
        packageId: params.packageId,
        export: exportData,
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
   * Get evidence collector statistics
   *
   * Command: get_evidence_stats
   */
  commandHandlers.get_evidence_stats = async () => {
    try {
      const collector = getEvidenceCollector();
      return {
        success: true,
        stats: collector.getStats(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

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

  console.log('[Evidence] 22 evidence commands registered');
}

module.exports = {
  registerEvidenceCommands,
  initializeEvidenceCollector,
  getEvidenceCollector,
};
