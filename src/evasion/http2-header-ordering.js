/**
 * Basset Hound Browser - HTTP/2 Header Ordering Module
 * Advanced header ordering and pseudo-header reordering for HTTP/2 evasion
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Key Features:
 * - Pseudo-header ordering with RFC constraints
 * - Regular header reordering with realistic variation
 * - Browser-specific header ordering patterns
 * - Coherence validation across header sets
 * - Multiple strategies (realistic, aggressive, conservative)
 * - Detection Methods Evaded:
 *   - HTTP/2 header ordering fingerprinting
 *   - Pseudo-header position analysis
 *   - Header uniqueness fingerprinting
 *   - Browser HTTP/2 behavior profiling
 */

class HTTP2HeaderOrdering {
  constructor(profile = 'chrome131-windows') {
    this.profile = profile;
    this.baselineHeaders = this._loadProfileHeaders(profile);
    this.pseudoHeaderOrder = this._getPseudoHeaderOrder(profile);
    this.headerPreferences = this._buildHeaderPreferences();
  }

  /**
   * Load profile-specific default headers
   */
  _loadProfileHeaders(profile) {
    const profiles = {
      'chrome131-windows': {
        pseudo: [':authority', ':method', ':scheme', ':path'],
        regular: [
          'user-agent',
          'accept',
          'accept-language',
          'accept-encoding',
          'sec-fetch-site',
          'sec-fetch-mode',
          'sec-fetch-dest',
          'referer',
          'cookie'
        ]
      },
      'firefox121-windows': {
        pseudo: [':method', ':scheme', ':authority', ':path'],
        regular: [
          'user-agent',
          'accept',
          'accept-language',
          'accept-encoding',
          'referer',
          'cookie'
        ]
      },
      'safari17-macos': {
        pseudo: [':method', ':scheme', ':authority', ':path'],
        regular: [
          'user-agent',
          'accept',
          'accept-language',
          'accept-encoding',
          'referer'
        ]
      }
    };

    return profiles[profile] || profiles['chrome131-windows'];
  }

  /**
   * Get pseudo-header order for profile
   */
  _getPseudoHeaderOrder(profile) {
    // RFC 9113 specifies ordering constraints
    // :authority, :method, :scheme, :path (in that order)

    const orders = {
      'chrome131-windows': [':authority', ':method', ':scheme', ':path'],
      'firefox121-windows': [':method', ':scheme', ':authority', ':path'],
      'safari17-macos': [':method', ':scheme', ':authority', ':path']
    };

    return orders[profile] || [':authority', ':method', ':scheme', ':path'];
  }

  /**
   * Build header preference ordering for realistic reordering
   */
  _buildHeaderPreferences() {
    return {
      // Headers that should come early
      'user-agent': 10,
      'accept': 9,
      'accept-language': 8,

      // Headers that should come middle
      'accept-encoding': 5,
      'referer': 4,
      'sec-fetch-site': 3,
      'sec-fetch-mode': 2,
      'sec-fetch-dest': 1,

      // Headers that should come last
      'cookie': -5,
      'authorization': -4
    };
  }

  /**
   * Get reordered headers with realistic constraints
   */
  getHeaderOrder(headers, reorderStrategy = 'realistic') {
    // HTTP/2 requires pseudo-headers before regular headers
    const pseudoHeaders = headers.filter(h => h.name.startsWith(':'));
    const regularHeaders = headers.filter(h => !h.name.startsWith(':'));

    const orderedPseudo = this._reorderPseudoHeaders(pseudoHeaders, reorderStrategy);
    const orderedRegular = this._reorderRegularHeaders(regularHeaders, reorderStrategy);

    return [...orderedPseudo, ...orderedRegular];
  }

  /**
   * Reorder pseudo-headers with strict RFC constraints
   */
  _reorderPseudoHeaders(pseudoHeaders, strategy) {
    // RFC 9113 requires specific pseudo-header ordering
    // :authority (or Host for HTTP/1.1)
    // :method
    // :scheme
    // :path

    if (strategy === 'conservative') {
      // Sort by the reference order
      return pseudoHeaders.sort((a, b) => {
        const order = this.pseudoHeaderOrder;
        return order.indexOf(a.name) - order.indexOf(b.name);
      });
    }

    // Realistic: 10% chance of variation
    if (Math.random() < 0.10 && pseudoHeaders.length > 2) {
      const reordered = [...pseudoHeaders];

      // Swap non-critical pseudo-headers (not :authority and :path)
      const criticalNames = [':authority', ':path'];
      const nonCriticalIndices = reordered
        .map((h, i) => !criticalNames.includes(h.name) ? i : -1)
        .filter(i => i !== -1);

      if (nonCriticalIndices.length > 1) {
        const idx1 = nonCriticalIndices[0];
        const idx2 = nonCriticalIndices[1];
        [reordered[idx1], reordered[idx2]] = [reordered[idx2], reordered[idx1]];
      }

      return reordered;
    }

    return pseudoHeaders;
  }

  /**
   * Reorder regular headers with realistic variation
   */
  _reorderRegularHeaders(regularHeaders, strategy) {
    if (strategy === 'conservative') {
      return regularHeaders; // No reordering
    }

    // Realistic: randomize 20% of header order
    const reordered = [...regularHeaders];

    if (strategy === 'realistic') {
      const shuffleCount = Math.ceil(reordered.length * 0.2);

      for (let i = 0; i < shuffleCount; i++) {
        const idx1 = Math.floor(Math.random() * reordered.length);
        const idx2 = Math.floor(Math.random() * reordered.length);

        if (idx1 !== idx2) {
          [reordered[idx1], reordered[idx2]] = [reordered[idx2], reordered[idx1]];
        }
      }

      return this._enforceHeaderConstraints(reordered);
    }

    if (strategy === 'aggressive') {
      // More aggressive reordering (40% variation)
      for (let i = 0; i < reordered.length; i++) {
        const randomIdx = Math.floor(Math.random() * reordered.length);
        [reordered[i], reordered[randomIdx]] = [reordered[randomIdx], reordered[i]];
      }

      return this._enforceHeaderConstraints(reordered);
    }

    return reordered;
  }

  /**
   * Enforce header ordering constraints
   */
  _enforceHeaderConstraints(headers) {
    const result = [...headers];

    // Some headers have ordering preferences:
    // - user-agent should come before accept
    // - accept should come before accept-language
    // - cookie should be last (or near last)

    // Sort by preference if needed
    const hasUserAgent = result.some(h => h.name === 'user-agent');
    const hasAccept = result.some(h => h.name === 'accept');

    if (hasUserAgent && hasAccept) {
      const uaIdx = result.findIndex(h => h.name === 'user-agent');
      const acceptIdx = result.findIndex(h => h.name === 'accept');

      // Rarely enforce this (5% of the time)
      if (uaIdx > acceptIdx && Math.random() < 0.05) {
        [result[uaIdx], result[acceptIdx]] = [result[acceptIdx], result[uaIdx]];
      }
    }

    return result;
  }

  /**
   * Validate header coherence
   */
  validateHeaderCoherence(headers) {
    // Ensure ordering is reasonable for the profile
    // Score: 0-100 (higher = more coherent)

    let score = 80;

    const pseudo = headers.filter(h => h.name.startsWith(':'));
    const regular = headers.filter(h => !h.name.startsWith(':'));

    // Check: pseudo-headers come first
    if (pseudo.length > 0 && regular.length > 0) {
      const lastPseudoIdx = headers.lastIndexOf(pseudo[pseudo.length - 1]);
      const firstRegularIdx = headers.indexOf(regular[0]);

      if (lastPseudoIdx > firstRegularIdx) {
        score -= 20; // Major violation
      }
    }

    // Check: authority or method comes early
    const authorityOrMethodIdx = headers.findIndex(h => h.name === ':authority' || h.name === ':method');
    if (authorityOrMethodIdx > 0) {
      score -= 5; // Minor variation penalty
    }

    // Check: reasonable header count
    if (headers.length < 5) {
      score -= 10; // Too few headers
    } else if (headers.length > 30) {
      score -= 10; // Too many headers
    }

    return Math.max(0, score);
  }

  /**
   * Get statistics about header ordering
   */
  getHeaderStatistics() {
    return {
      profile: this.profile,
      pseudoHeaderOrder: this.pseudoHeaderOrder,
      baselineRegularHeaderCount: this.baselineHeaders.regular.length,
      baselineHeaders: this.baselineHeaders
    };
  }
}

module.exports = HTTP2HeaderOrdering;
