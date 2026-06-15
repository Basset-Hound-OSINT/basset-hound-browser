/**
 * Basset Hound Browser - TLS Cipher Suite Rotation Module
 * Advanced cipher suite rotation and manipulation for JA3/JA4 evasion
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Key Features:
 * - Chrome-like cipher suite rotation
 * - Realistic cipher ordering based on browser preferences
 * - Per-session cipher tracking
 * - JA3/JA4 coherence validation
 * - Multiple rotation strategies (realistic, aggressive, conservative)
 * - Detection Methods Evaded:
 *   - JA3/JA4 fingerprinting
 *   - TLS 1.2/1.3 ClientHello analysis
 *   - Cipher suite frequency analysis
 *   - Browser signature matching
 */

class TLSCipherRotation {
  constructor(profile = 'chrome131-windows') {
    this.profile = profile;
    this.baselineCiphers = this._loadProfileCiphers(profile);
    this.rotationIndex = 0;
    this.sessionCipherMap = new Map(); // Track per-session ciphers
    this.cipherPriorities = this._buildCipherPriorities();
  }

  /**
   * Load baseline ciphers for a given profile
   * Chrome 131, Firefox 121, Safari 17 profiles supported
   */
  _loadProfileCiphers(profile) {
    const profileCiphers = {
      'chrome131-windows': [
        0x1301, // TLS_AES_128_GCM_SHA256
        0x1302, // TLS_AES_256_GCM_SHA384
        0x1303, // TLS_CHACHA20_POLY1305_SHA256
        0xc02c, // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        0xc030, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        0x009f, // TLS_DHE_RSA_WITH_AES_256_GCM_SHA384
        0xccaa, // TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
        0xcca9, // TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
        0xc02b, // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        0xc02f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        0x009e, // TLS_DHE_RSA_WITH_AES_128_GCM_SHA256
        0xc024, // TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA
        0xc028, // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
        0x006b, // TLS_DHE_RSA_WITH_AES_256_CBC_SHA256
        0xc023, // TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA
      ],
      'firefox121-windows': [
        0x1301, // TLS_AES_128_GCM_SHA256
        0x1302, // TLS_AES_256_GCM_SHA384
        0x1303, // TLS_CHACHA20_POLY1305_SHA256
        0xc02c, // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        0xc030, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        0xccaa, // TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
        0xcca9, // TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
        0xc02b, // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        0xc02f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        0x009e, // TLS_DHE_RSA_WITH_AES_128_GCM_SHA256
        0xc023, // TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA
        0xc027, // TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA
      ],
      'safari17-macos': [
        0x1301, // TLS_AES_128_GCM_SHA256
        0x1302, // TLS_AES_256_GCM_SHA384
        0x1303, // TLS_CHACHA20_POLY1305_SHA256
        0xc02c, // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        0xc030, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        0xc02b, // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        0xc02f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        0xc024, // TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA
        0xc028, // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
      ]
    };

    return profileCiphers[profile] || profileCiphers['chrome131-windows'];
  }

  /**
   * Build cipher priority mapping for realistic ordering
   */
  _buildCipherPriorities() {
    return {
      // TLS 1.3 ciphers (highest priority)
      0x1301: 100, // TLS_AES_128_GCM_SHA256
      0x1302: 110, // TLS_AES_256_GCM_SHA384 (stronger)
      0x1303: 95,  // TLS_CHACHA20_POLY1305_SHA256

      // ECDHE with ECDSA (high priority)
      0xc02c: 85,  // ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
      0xc02b: 84,  // ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
      0xccaa: 90,  // ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256

      // ECDHE with RSA (medium-high priority)
      0xc030: 75,  // ECDHE_RSA_WITH_AES_256_GCM_SHA384
      0xc02f: 74,  // ECDHE_RSA_WITH_AES_128_GCM_SHA256
      0xcca9: 88,  // ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256

      // DHE (lower priority)
      0x009f: 60,  // DHE_RSA_WITH_AES_256_GCM_SHA384
      0x009e: 59,  // DHE_RSA_WITH_AES_128_GCM_SHA256

      // Legacy ciphers (low priority)
      0xc024: 40,  // ECDHE_ECDSA_WITH_AES_256_CBC_SHA
      0xc023: 39,  // ECDHE_ECDSA_WITH_AES_128_CBC_SHA
      0xc028: 35,  // ECDHE_RSA_WITH_AES_256_CBC_SHA
      0xc027: 34,  // ECDHE_RSA_WITH_AES_128_CBC_SHA
      0x006b: 30   // DHE_RSA_WITH_AES_256_CBC_SHA256
    };
  }

  /**
   * Get cipher suite for a session with optional rotation
   */
  getCipherSuite(sessionId, rotationStrategy = 'realistic') {
    // Check if session already has assigned ciphers
    if (this.sessionCipherMap.has(sessionId)) {
      return this.sessionCipherMap.get(sessionId);
    }

    // Select and order ciphers based on strategy
    const ciphers = this._selectCiphers(rotationStrategy);
    const ordered = this._orderCiphersRealistically(ciphers, rotationStrategy);
    const validated = this._validateAgainstJA4(ordered);

    // Store for session
    this.sessionCipherMap.set(sessionId, {
      ciphers: ordered,
      count: ordered.length,
      strategy: rotationStrategy,
      timestamp: Date.now(),
      ja4Compatible: validated.compatible,
      coherenceScore: validated.score
    });

    return this.sessionCipherMap.get(sessionId);
  }

  /**
   * Select ciphers based on rotation strategy
   */
  _selectCiphers(strategy) {
    if (strategy === 'conservative') {
      return this.baselineCiphers.slice(); // Use all baseline ciphers
    }

    if (strategy === 'realistic') {
      // 85% match with baseline, 15% variation
      const baseLength = Math.ceil(this.baselineCiphers.length * 0.85);
      const selected = this.baselineCiphers.slice(0, baseLength);

      // Add 1-2 cipher variations
      if (Math.random() < 0.5 && selected.length < 15) {
        const altCiphers = [0xc024, 0xc028, 0x006b]; // Alternative ciphers
        const alt = altCiphers[Math.floor(Math.random() * altCiphers.length)];
        if (!selected.includes(alt)) {
          selected.push(alt);
        }
      }

      return selected;
    }

    if (strategy === 'aggressive') {
      // 70% match with baseline, 30% variation
      const baseLength = Math.ceil(this.baselineCiphers.length * 0.7);
      const selected = this.baselineCiphers.slice(0, baseLength);

      // Add 2-3 cipher variations
      const altCiphers = [0xc024, 0xc028, 0x006b, 0xc023, 0xc027];
      const variations = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < variations; i++) {
        const alt = altCiphers[Math.floor(Math.random() * altCiphers.length)];
        if (!selected.includes(alt)) {
          selected.push(alt);
        }
      }

      return selected;
    }

    return this.baselineCiphers.slice();
  }

  /**
   * Order ciphers realistically based on browser preferences
   */
  _orderCiphersRealistically(ciphers, strategy) {
    // Chrome prioritizes: AES-GCM > ChaCha20 > AES-CBC
    // Within each category: prefer stronger variants

    const ordered = ciphers.sort((a, b) => {
      const priorityA = this._getCipherPriority(a);
      const priorityB = this._getCipherPriority(b);

      // If same priority, random secondary ordering (10% variation)
      if (priorityA === priorityB && Math.random() < 0.10) {
        return Math.random() - 0.5;
      }

      return priorityB - priorityA;
    });

    // Apply strategy-specific variance
    if (strategy === 'realistic' && Math.random() < 0.15) {
      // 15% chance to reorder non-critical ciphers
      const swapCount = Math.floor(Math.random() * 2) + 1; // 1-2 swaps
      for (let i = 0; i < swapCount; i++) {
        const idx1 = Math.floor(Math.random() * (ordered.length - 2)) + 2; // Skip first 2
        const idx2 = Math.floor(Math.random() * (ordered.length - 2)) + 2;
        [ordered[idx1], ordered[idx2]] = [ordered[idx2], ordered[idx1]];
      }
    }

    return ordered;
  }

  /**
   * Get priority for a specific cipher
   */
  _getCipherPriority(cipherCode) {
    return this.cipherPriorities[cipherCode] || 20;
  }

  /**
   * Validate cipher suite against JA4 fingerprinting
   */
  _validateAgainstJA4(ciphers) {
    // Check that:
    // 1. TLS 1.3 ciphers are prioritized
    // 2. Cipher suite ordering is reasonable
    // 3. No unsupported ciphers

    const tls13Ciphers = [0x1301, 0x1302, 0x1303];
    const hasTLS13 = ciphers.some(c => tls13Ciphers.includes(c));

    // Score: 0-100 (higher = more JA4 compatible)
    let score = 80;

    if (!hasTLS13) {
      score -= 20; // JA4 prefers TLS 1.3
    }

    // Check ordering constraint: stronger ciphers come first
    for (let i = 0; i < ciphers.length - 1; i++) {
      const currentPriority = this._getCipherPriority(ciphers[i]);
      const nextPriority = this._getCipherPriority(ciphers[i + 1]);

      if (currentPriority < nextPriority) {
        score -= 5; // Penalty for out-of-order
      }
    }

    return {
      compatible: score > 70,
      score: Math.max(0, score),
      hasTLS13,
      cipherCount: ciphers.length
    };
  }

  /**
   * Get cipher name from hex code
   */
  getCipherName(cipherCode) {
    const names = {
      0x1301: 'TLS_AES_128_GCM_SHA256',
      0x1302: 'TLS_AES_256_GCM_SHA384',
      0x1303: 'TLS_CHACHA20_POLY1305_SHA256',
      0xc02c: 'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
      0xc030: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
      0xccaa: 'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
      0xcca9: 'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
      0xc02b: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
      0xc02f: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
      0x009f: 'TLS_DHE_RSA_WITH_AES_256_GCM_SHA384',
      0x009e: 'TLS_DHE_RSA_WITH_AES_128_GCM_SHA256',
      0xc024: 'TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA',
      0xc028: 'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA',
      0x006b: 'TLS_DHE_RSA_WITH_AES_256_CBC_SHA256',
      0xc023: 'TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA',
      0xc027: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA'
    };

    return names[cipherCode] || `UNKNOWN_0x${cipherCode.toString(16).toUpperCase()}`;
  }

  /**
   * Generate cipher suite statistics
   */
  getCipherStatistics() {
    return {
      totalSessions: this.sessionCipherMap.size,
      baselineCipherCount: this.baselineCiphers.length,
      profileName: this.profile,
      rotationIndex: this.rotationIndex,
      sessionDetails: Array.from(this.sessionCipherMap.entries()).map(([sessionId, data]) => ({
        sessionId: sessionId.substring(0, 8) + '...', // Truncate for privacy
        cipherCount: data.count,
        strategy: data.strategy,
        coherenceScore: data.coherenceScore
      }))
    };
  }

  /**
   * Clear session cipher cache
   */
  clearSessionCache() {
    this.sessionCipherMap.clear();
  }
}

module.exports = TLSCipherRotation;
