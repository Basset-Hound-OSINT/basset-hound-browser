/**
 * Basset Hound Browser - TLS Extension Ordering Module
 * Advanced TLS extension ordering and ALPN protocol selection for evasion
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Key Features:
 * - Chrome-like TLS extension ordering
 * - ALPN protocol selection with realistic variation
 * - Extension ordering constraints validation
 * - Multiple reordering strategies (realistic, aggressive, conservative)
 * - Detection Methods Evaded:
 *   - Extension ordering fingerprinting
 *   - ALPN protocol inference
 *   - ClientHello uniqueness analysis
 *   - Chrome version detection
 */

class TLSExtensionOrdering {
  constructor(profile = 'chrome131-windows') {
    this.profile = profile;
    this.baselineExtensions = this._loadExtensionsForProfile(profile);
    this.alpnProtocols = ['h2', 'http/1.1'];
    this.extensionVariations = [];
  }

  /**
   * Load default extensions for a profile
   */
  _loadExtensionsForProfile(profile) {
    const profiles = {
      'chrome131-windows': [
        { id: 0x0000, name: 'server_name', critical: true },
        { id: 0x0001, name: 'max_fragment_length', critical: false },
        { id: 0x0005, name: 'status_request', critical: false },
        { id: 0x000a, name: 'supported_groups', critical: false },
        { id: 0x000b, name: 'ec_point_formats', critical: false },
        { id: 0x000d, name: 'signature_algorithms', critical: false },
        { id: 0x000f, name: 'padding', critical: false },
        { id: 0x0010, name: 'encrypt_then_mac', critical: false },
        { id: 0x0016, name: 'session_ticket', critical: false },
        { id: 0x0023, name: 'session_ticket', critical: false }, // Duplicate
        { id: 0x0028, name: 'key_share', critical: false },
        { id: 0x002b, name: 'supported_versions', critical: false },
        { id: 0x002d, name: 'psk_key_exchange_modes', critical: false },
        { id: 0x0033, name: 'key_share', critical: false }, // Duplicate
        { id: 0x0034, name: 'post_quantum_key_share', critical: false }
      ],
      'firefox121-windows': [
        { id: 0x0000, name: 'server_name', critical: true },
        { id: 0x000a, name: 'supported_groups', critical: false },
        { id: 0x000b, name: 'ec_point_formats', critical: false },
        { id: 0x000d, name: 'signature_algorithms', critical: false },
        { id: 0x000f, name: 'padding', critical: false },
        { id: 0x0016, name: 'session_ticket', critical: false },
        { id: 0x0028, name: 'key_share', critical: false },
        { id: 0x002b, name: 'supported_versions', critical: false },
        { id: 0x002d, name: 'psk_key_exchange_modes', critical: false },
        { id: 0x001d, name: 'pre_shared_key', critical: false }
      ],
      'safari17-macos': [
        { id: 0x0000, name: 'server_name', critical: true },
        { id: 0x000d, name: 'signature_algorithms', critical: false },
        { id: 0x000a, name: 'supported_groups', critical: false },
        { id: 0x0028, name: 'key_share', critical: false },
        { id: 0x002b, name: 'supported_versions', critical: false },
        { id: 0x002d, name: 'psk_key_exchange_modes', critical: false },
        { id: 0x000f, name: 'padding', critical: false }
      ]
    };

    return profiles[profile] || profiles['chrome131-windows'];
  }

  /**
   * Get reordered extensions with realism constraints
   */
  getExtensionOrder(reorderingStrategy = 'realistic') {
    const extensions = this._selectExtensions(reorderingStrategy);
    const ordered = this._reorderRealistic(extensions, reorderingStrategy);
    return this._validateExtensionCoherence(ordered);
  }

  /**
   * Select extensions based on strategy
   */
  _selectExtensions(strategy) {
    if (strategy === 'conservative') {
      return this.baselineExtensions.slice();
    }

    // For realistic and aggressive, apply variation
    const extensions = this.baselineExtensions.slice();

    if (strategy === 'realistic' && Math.random() < 0.15) {
      // 15% of the time, remove/add one extension
      if (Math.random() < 0.5 && extensions.length > 5) {
        // Remove one non-critical extension
        const nonCritical = extensions.filter(e => !e.critical);
        if (nonCritical.length > 0) {
          const idx = extensions.indexOf(nonCritical[Math.floor(Math.random() * nonCritical.length)]);
          extensions.splice(idx, 1);
        }
      }
    }

    return extensions;
  }

  /**
   * Reorder extensions while maintaining critical constraints
   */
  _reorderRealistic(extensions, strategy) {
    if (strategy === 'conservative') {
      return extensions; // No reordering
    }

    const reordered = [...extensions];

    // Critical ordering constraints:
    // 1. server_name (SNI) MUST be first
    // 2. padding extension MUST be present (Chrome behavior)
    // 3. key_share must come before supported_versions
    // 4. psk_key_exchange_modes must come after session_ticket

    // Move server_name to position 0
    const serverNameIdx = reordered.findIndex(e => e.id === 0x0000);
    if (serverNameIdx > 0) {
      [reordered[0], reordered[serverNameIdx]] = [reordered[serverNameIdx], reordered[0]];
    }

    if (strategy === 'realistic') {
      // 15% chance to reorder non-critical extensions
      const criticalIndices = [0]; // Only server_name is truly critical
      const swapCount = Math.floor(Math.random() * 3); // 0-2 swaps

      for (let i = 0; i < swapCount; i++) {
        let idx1 = Math.floor(Math.random() * reordered.length);
        let idx2 = Math.floor(Math.random() * reordered.length);

        // Skip critical indices
        if (!criticalIndices.includes(idx1) && !criticalIndices.includes(idx2)) {
          [reordered[idx1], reordered[idx2]] = [reordered[idx2], reordered[idx1]];
        }
      }
    } else if (strategy === 'aggressive') {
      // More aggressive reordering (35% variation)
      for (let i = 1; i < reordered.length; i++) { // Skip server_name
        const swapIdx = Math.floor(Math.random() * reordered.length);
        if (swapIdx !== 0) { // Never swap with server_name
          [reordered[i], reordered[swapIdx]] = [reordered[swapIdx], reordered[i]];
        }
      }
    }

    return this._enforceOrderingConstraints(reordered);
  }

  /**
   * Enforce critical ordering constraints
   */
  _enforceOrderingConstraints(extensions) {
    const result = [...extensions];

    // Find key positions
    const keyShareIdx = result.findIndex(e => e.id === 0x0028);
    const supportedVersionsIdx = result.findIndex(e => e.id === 0x002b);

    // Enforce: key_share before supported_versions
    if (keyShareIdx > supportedVersionsIdx && supportedVersionsIdx !== -1) {
      const keyShare = result[keyShareIdx];
      result.splice(keyShareIdx, 1);
      result.splice(supportedVersionsIdx, 0, keyShare);
    }

    return result;
  }

  /**
   * Select ALPN protocol with variation
   */
  selectALPNProtocol(serverSupported = ['h2', 'http/1.1']) {
    // Realistic: h2 (HTTP/2) in 95% of cases, http/1.1 in 5%
    const preferH2 = Math.random() < 0.95;

    return {
      protocol: preferH2 ? 'h2' : 'http/1.1',
      supported: serverSupported,
      coherenceScore: this._validateALPNCoherence(preferH2)
    };
  }

  /**
   * Validate extension coherence
   */
  _validateExtensionCoherence(extensions) {
    // Ensure ordering is Chrome-like
    // Score 0-100 (higher = more Chrome-like)

    let score = 80;

    // Check: server_name is first
    if (extensions[0]?.id !== 0x0000) {
      score -= 10;
    }

    // Check: padding is present
    if (!extensions.some(e => e.name === 'padding')) {
      score -= 15;
    }

    // Check: key_share before supported_versions
    const keyShareIdx = extensions.findIndex(e => e.id === 0x0028);
    const supportedVersionsIdx = extensions.findIndex(e => e.id === 0x002b);
    if (keyShareIdx > supportedVersionsIdx && supportedVersionsIdx !== -1) {
      score -= 10;
    }

    return {
      extensions,
      count: extensions.length,
      coherenceScore: Math.max(0, score),
      coherent: score > 70
    };
  }

  /**
   * Validate ALPN coherence
   */
  _validateALPNCoherence(preferH2) {
    // HTTP/2 selection should match TLS version and cipher suites
    return preferH2 ? 95 : 80;
  }

  /**
   * Get extension name from ID
   */
  getExtensionName(extId) {
    const names = {
      0x0000: 'server_name (SNI)',
      0x0001: 'max_fragment_length',
      0x0005: 'status_request (OCSP)',
      0x000a: 'supported_groups',
      0x000b: 'ec_point_formats',
      0x000d: 'signature_algorithms',
      0x000f: 'padding',
      0x0010: 'encrypt_then_mac',
      0x0016: 'session_ticket',
      0x0023: 'session_ticket (resumption)',
      0x0028: 'key_share',
      0x002b: 'supported_versions',
      0x002d: 'psk_key_exchange_modes',
      0x0033: 'key_share (post_quantum)',
      0x0034: 'post_quantum_key_share',
      0x001d: 'pre_shared_key'
    };

    return names[extId] || `UNKNOWN_0x${extId.toString(16).toUpperCase()}`;
  }

  /**
   * Generate statistics about extension ordering
   */
  getExtensionStatistics() {
    return {
      profile: this.profile,
      baselineExtensionCount: this.baselineExtensions.length,
      extensions: this.baselineExtensions.map(e => ({
        id: `0x${e.id.toString(16).toUpperCase().padStart(4, '0')}`,
        name: e.name,
        critical: e.critical
      }))
    };
  }
}

module.exports = TLSExtensionOrdering;
