/**
 * Evidence Packaging WebSocket Commands
 *
 * Phase 19: WebSocket API for evidence packaging & chain of custody
 *
 * Provides commands for:
 * - `create_evidence_package` - Bundle evidence
 * - `add_to_package` - Add artifacts to package
 * - `generate_manifest` - Create forensic manifest
 * - `export_package` - Export in specified format
 * - `verify_package_integrity` - Validate package hashes
 * - `seal_package` - Make package immutable
 * - `list_packages` - List all packages
 * - `get_package` - Get package details
 */

const { EvidencePackage, PackageBuilder } = require('../../../../evidence/package-builder');
const { ForensicManifest } = require('../../../../evidence/manifest-generator');
const { ChainOfCustodyManager } = require('../../../../evidence/chain-of-custody');

/**
 * Package builder instance (initialized when commands are registered)
 */
let packageBuilder = null;
let custodyManager = null;

/**
 * Initialize package builder
 *
 * @param {Object} config - Configuration options
 */
function initializePackageBuilder(config = {}) {
  custodyManager = new ChainOfCustodyManager(config);
  packageBuilder = new PackageBuilder({ custodyManager });

  console.log('[EvidencePackaging] Package builder initialized');
  return packageBuilder;
}

/**
 * Get the package builder instance
 */
function getPackageBuilder() {
  if (!packageBuilder) {
    initializePackageBuilder();
  }
  return packageBuilder;
}

/**
 * Register evidence packaging commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 */
function registerEvidencePackagingCommands(commandHandlers) {
  // Initialize builder if not already done
  if (!packageBuilder) {
    initializePackageBuilder();
  }

  // ==========================================
  // MANIFEST COMMANDS
  // ==========================================

  /**
   * Create evidence manifest
   *
   * Command: create_evidence_manifest
   * Params:
   *   - sessionId: string (optional)
   *   - url: string (optional)
   *   - capturedBy: string (optional)
   *   - metadata: object (optional)
   *
   * Response:
   *   - manifestId: string
   *   - manifest: object with summary
   */
  commandHandlers.create_evidence_manifest = async (params) => {
    try {
      const builder = getPackageBuilder();
      const manifest = builder.createManifest({
        sessionId: params.sessionId,
        url: params.url,
        capturedBy: params.capturedBy || 'system',
        metadata: params.metadata
      });

      return {
        success: true,
        manifestId: manifest.id,
        manifest: manifest.getSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Add evidence to manifest
   *
   * Command: add_to_manifest
   * Params:
   *   - manifestId: string
   *   - evidenceId: string
   *   - type: string (screenshot, archive, har, dom, etc.)
   *   - data: string or object (evidence data)
   *   - metadata: object (optional)
   *
   * Response:
   *   - success: boolean
   *   - entry: manifest entry summary
   */
  commandHandlers.add_to_manifest = async (params) => {
    try {
      // Validate required parameters
      if (!params.manifestId || typeof params.manifestId !== 'string') {
        throw new Error('Invalid manifestId: must be a non-empty string');
      }
      if (!params.evidenceId || typeof params.evidenceId !== 'string') {
        throw new Error('Invalid evidenceId: must be a non-empty string');
      }
      if (!params.type || typeof params.type !== 'string') {
        throw new Error('Invalid type: must be a non-empty string');
      }
      if (params.data === undefined || params.data === null) {
        throw new Error('Evidence data is required');
      }

      const builder = getPackageBuilder();
      const manifest = builder.getManifest(params.manifestId);

      if (!manifest) {
        throw new Error(`Manifest not found: ${params.manifestId}`);
      }

      const entry = manifest.addEvidence(
        params.evidenceId,
        params.type,
        params.data,
        {
          url: params.url || '',
          size: params.size || 0,
          ...(params.metadata || {})
        }
      );

      return {
        success: true,
        entry: entry.toJSON(),
        manifestSize: manifest.getSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'INVALID_EVIDENCE'
      };
    }
  };

  /**
   * Get manifest details
   *
   * Command: get_manifest
   * Params:
   *   - manifestId: string
   *
   * Response:
   *   - manifest: complete manifest object
   */
  commandHandlers.get_manifest = async (params) => {
    try {
      const builder = getPackageBuilder();
      const manifest = builder.getManifest(params.manifestId);

      if (!manifest) {
        throw new Error(`Manifest not found: ${params.manifestId}`);
      }

      return {
        success: true,
        manifest: manifest.exportAsJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List all manifests
   *
   * Command: list_manifests
   * Params: (none)
   *
   * Response:
   *   - manifests: array of manifest summaries
   */
  commandHandlers.list_manifests = async () => {
    try {
      const builder = getPackageBuilder();
      return {
        success: true,
        manifests: builder.listManifests(),
        count: builder.manifests.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // PACKAGE COMMANDS
  // ==========================================

  /**
   * Create evidence package from manifest
   *
   * Command: create_evidence_package
   * Params:
   *   - manifestId: string
   *   - capturedBy: string (optional)
   *   - autoSeal: boolean (optional, default false)
   *
   * Response:
   *   - packageId: string
   *   - package: package summary
   */
  commandHandlers.create_evidence_package = async (params) => {
    try {
      const builder = getPackageBuilder();
      const manifest = builder.getManifest(params.manifestId);

      if (!manifest) {
        throw new Error(`Manifest not found: ${params.manifestId}`);
      }

      const pkg = builder.createPackage(manifest, {
        capturedBy: params.capturedBy || 'system',
        autoSeal: params.autoSeal || false
      });

      return {
        success: true,
        packageId: pkg.packageId,
        package: pkg.getStatistics()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Build complete package from evidence items
   *
   * Command: build_evidence_package
   * Params:
   *   - evidenceItems: array of {id, type, data, metadata}
   *   - sessionId: string (optional)
   *   - url: string (optional)
   *   - capturedBy: string (optional)
   *   - autoSeal: boolean (optional, default false)
   *
   * Response:
   *   - packageId: string
   *   - manifestId: string
   *   - package: package summary
   *   - sealed: boolean
   */
  commandHandlers.build_evidence_package = async (params) => {
    try {
      const builder = getPackageBuilder();
      const pkg = builder.buildPackage(params.evidenceItems || [], {
        sessionId: params.sessionId,
        url: params.url,
        capturedBy: params.capturedBy || 'system',
        autoSeal: params.autoSeal || false
      });

      return {
        success: true,
        packageId: pkg.packageId,
        manifestId: pkg.manifest.id,
        package: pkg.getStatistics(),
        sealed: pkg.sealed
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Seal package (make immutable)
   *
   * Command: seal_evidence_package
   * Params:
   *   - packageId: string
   *   - sealedBy: string (optional)
   *   - requestRFC3161: boolean (optional, default false)
   *   - rfc3161Authority: string (optional)
   *
   * Response:
   *   - success: boolean
   *   - sealData: object with seal details
   *   - timestampToken: RFC 3161 timestamp
   *   - rfc3161Requested: boolean
   */
  commandHandlers.seal_evidence_package = async (params) => {
    try {
      // Validate packageId
      if (!params.packageId || typeof params.packageId !== 'string') {
        throw new Error('Invalid packageId: must be a non-empty string');
      }

      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      if (pkg.sealed) {
        throw new Error('Package is already sealed');
      }

      const startTime = Date.now();
      const result = pkg.seal({
        sealedBy: params.sealedBy || 'system'
      });
      const sealDuration = Date.now() - startTime;

      const response = {
        success: result.success,
        sealData: result.sealData,
        timestampToken: result.timestampToken,
        sealPerformance: {
          durationMs: sealDuration,
          performanceOk: sealDuration < 100
        },
        rfc3161Requested: false
      };

      // Optional RFC 3161 timestamp request
      if (params.requestRFC3161 === true) {
        try {
          const rfc3161Token = pkg.requestRFC3161Timestamp({
            authority: params.rfc3161Authority || 'freetsa.org'
          });
          response.rfc3161Token = rfc3161Token;
          response.rfc3161Requested = true;
          response.rfc3161Status = 'requested';
        } catch (rfc3161Error) {
          response.rfc3161Status = 'error';
          response.rfc3161Error = rfc3161Error.message;
        }
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'SEAL_FAILED'
      };
    }
  };

  /**
   * Export package in specified format
   *
   * Command: export_evidence_package
   * Params:
   *   - packageId: string
   *   - format: 'court' | 'analysis' | 'json' | 'xml'
   *   - destination: string (optional)
   *
   * Response:
   *   - success: boolean
   *   - format: export format
   *   - data: exported data (string or object)
   *   - exportTime: timestamp
   */
  commandHandlers.export_evidence_package = async (params) => {
    try {
      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      const format = params.format || 'json';
      let data;

      if (format === 'court') {
        data = pkg.exportForCourt();
      } else if (format === 'analysis') {
        data = pkg.exportForAnalysis();
      } else if (format === 'json') {
        data = pkg.toJSON();
      } else if (format === 'xml') {
        data = pkg.toXML();
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      pkg.recordExport(format, params.destination || 'external');

      return {
        success: true,
        packageId: pkg.packageId,
        format,
        data,
        exportTime: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Verify package integrity
   *
   * Command: verify_evidence_package
   * Params:
   *   - packageId: string
   *
   * Response:
   *   - success: boolean
   *   - valid: boolean
   *   - issues: array of problems found
   *   - details: verification details
   */
  commandHandlers.verify_evidence_package = async (params) => {
    try {
      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      const verification = pkg.verify();

      return {
        success: true,
        packageId: pkg.packageId,
        valid: verification.valid,
        issues: verification.issues,
        details: verification.details
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get package details
   *
   * Command: get_evidence_package
   * Params:
   *   - packageId: string
   *
   * Response:
   *   - package: complete package data
   */
  commandHandlers.get_evidence_package = async (params) => {
    try {
      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      return {
        success: true,
        package: pkg.exportForCourt()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List all packages
   *
   * Command: list_evidence_packages
   * Params: (none)
   *
   * Response:
   *   - packages: array of package summaries
   */
  commandHandlers.list_evidence_packages = async () => {
    try {
      const builder = getPackageBuilder();
      return {
        success: true,
        packages: builder.listPackages(),
        count: builder.packages.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // CHAIN OF CUSTODY COMMANDS
  // ==========================================

  /**
   * Get chain of custody for evidence
   *
   * Command: get_custody_chain
   * Params:
   *   - evidenceId: string
   *
   * Response:
   *   - chain: array of custody entries
   *   - verification: chain integrity status
   */
  commandHandlers.get_custody_chain = async (params) => {
    try {
      if (!custodyManager) {
        throw new Error('Custody manager not initialized');
      }

      const chain = custodyManager.getChain(params.evidenceId);
      const verification = custodyManager.verifyChainIntegrity(params.evidenceId);

      return {
        success: true,
        evidenceId: params.evidenceId,
        chain,
        verification
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Generate custody report
   *
   * Command: generate_custody_report
   * Params:
   *   - evidenceId: string
   *   - format: 'json' | 'text' | 'html'
   *
   * Response:
   *   - report: formatted report
   */
  commandHandlers.generate_custody_report = async (params) => {
    try {
      if (!custodyManager) {
        throw new Error('Custody manager not initialized');
      }

      const format = params.format || 'json';
      const report = custodyManager.generateReport(params.evidenceId, format);

      return {
        success: true,
        evidenceId: params.evidenceId,
        format,
        report
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // UTILITY COMMANDS
  // ==========================================

  /**
   * Get packaging system statistics
   *
   * Command: get_packaging_stats
   * Params: (none)
   *
   * Response:
   *   - stats: system statistics
   */
  commandHandlers.get_packaging_stats = async () => {
    try {
      const builder = getPackageBuilder();
      return {
        success: true,
        stats: {
          builder: builder.getStatistics(),
          custody: custodyManager?.getStatistics() || {}
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Request RFC 3161 timestamp for sealed package
   *
   * Command: request_rfc3161_timestamp
   * Params:
   *   - packageId: string
   *   - authority: string (optional, default 'freetsa.org')
   *
   * Response:
   *   - success: boolean
   *   - timestampToken: RFC 3161 token
   *   - authority: which authority was used
   */
  commandHandlers.request_rfc3161_timestamp = async (params) => {
    try {
      if (!params.packageId || typeof params.packageId !== 'string') {
        throw new Error('Invalid packageId: must be a non-empty string');
      }

      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      if (!pkg.sealed) {
        throw new Error('Package must be sealed before requesting RFC 3161 timestamp');
      }

      const token = pkg.requestRFC3161Timestamp({
        authority: params.authority || 'freetsa.org'
      });

      return {
        success: true,
        packageId: pkg.packageId,
        timestampToken: token,
        authority: params.authority || 'freetsa.org',
        requestedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'TIMESTAMP_REQUEST_FAILED'
      };
    }
  };

  /**
   * Generate compliance report across all packages
   *
   * Command: generate_compliance_report
   * Params: (none)
   *
   * Response:
   *   - report: comprehensive compliance status
   */
  commandHandlers.generate_compliance_report = async () => {
    try {
      const builder = getPackageBuilder();
      const report = builder.generateComplianceReport();

      return {
        success: true,
        report
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Export package as ZIP
   *
   * Command: export_evidence_package_zip
   * Params:
   *   - packageId: string
   *   - destination: string (optional)
   *
   * Response:
   *   - success: boolean
   *   - zipInfo: ZIP export details
   */
  commandHandlers.export_evidence_package_zip = async (params) => {
    try {
      if (!params.packageId || typeof params.packageId !== 'string') {
        throw new Error('Invalid packageId: must be a non-empty string');
      }

      const builder = getPackageBuilder();
      const pkg = builder.getPackage(params.packageId);

      if (!pkg) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      const startTime = Date.now();
      const zipInfo = await pkg.exportAsZip({
        destination: params.destination || 'default'
      });
      const exportDuration = Date.now() - startTime;

      pkg.recordExport('zip', params.destination || 'external');

      return {
        success: zipInfo.success,
        packageId: pkg.packageId,
        zipInfo,
        exportDuration,
        exportPerformanceOk: exportDuration < 500
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'ZIP_EXPORT_FAILED'
      };
    }
  };

  /**
   * Get manifest timestamp readiness
   *
   * Command: check_timestamp_readiness
   * Params:
   *   - manifestId: string
   *
   * Response:
   *   - ready: boolean
   *   - requirements: array of missing items
   */
  commandHandlers.check_timestamp_readiness = async (params) => {
    try {
      if (!params.manifestId || typeof params.manifestId !== 'string') {
        throw new Error('Invalid manifestId: must be a non-empty string');
      }

      const builder = getPackageBuilder();
      const manifest = builder.getManifest(params.manifestId);

      if (!manifest) {
        throw new Error(`Manifest not found: ${params.manifestId}`);
      }

      const readiness = manifest.verifyTimestampReadiness();

      return {
        success: true,
        manifestId: params.manifestId,
        readiness
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  console.log('[EvidencePackaging] 19 evidence packaging commands registered');
}

module.exports = {
  registerEvidencePackagingCommands,
  initializePackageBuilder,
  getPackageBuilder
};
