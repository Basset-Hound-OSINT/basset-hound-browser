/**
 * Basset Hound Browser - WebRTC IP Redaction Module
 * Prevents IP address leakage in device fingerprints and WebRTC data
 *
 * Features:
 * - Extract and redact IP addresses from WebRTC candidates
 * - Mask IPs while preserving network topology information
 * - Privacy mode option for complete IP removal
 * - IPv4 and IPv6 support
 * - Consistent masking within a session
 *
 * Version: 1.0.0
 * Created: June 20, 2026
 */

/**
 * IP Redaction Manager - Masks IP addresses in device fingerprints
 */
class IPRedactionManager {
  constructor(options = {}) {
    // Configuration
    this.enabled = options.enabled !== false;
    this.privacyMode = options.privacyMode || 'mask'; // 'mask', 'remove', 'obfuscate'
    this.consistentMasking = options.consistentMasking !== false;
    this.preserveNetworkInfo = options.preserveNetworkInfo !== false;

    // IP mapping for consistent masking within a session
    this.ipMappings = new Map();
    this.nextMaskId = 1;

    // Regex patterns for IP detection
    this.ipv4Pattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    this.ipv6Pattern = /(?:^|[^\da-fA-F])(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}(?:[^\da-fA-F]|$)/g;

    // Logging
    this.logger = options.logger || null;
  }

  /**
   * Redact IPs from WebRTC fingerprint data
   * @param {Object} fingerprintData - Device fingerprint object
   * @returns {Object} Redacted fingerprint data
   */
  redactFingerprint(fingerprintData) {
    if (!this.enabled || !fingerprintData) {
      return fingerprintData;
    }

    const redacted = JSON.parse(JSON.stringify(fingerprintData));

    // Redact WebRTC data
    if (redacted.webrtc) {
      redacted.webrtc = this.redactWebRTC(redacted.webrtc);
    }

    // Redact any IP addresses in other fields
    if (redacted.ipv4) {
      redacted.ipv4 = this.redactIPv4(redacted.ipv4);
    }
    if (redacted.ipv6) {
      redacted.ipv6 = this.redactIPv6(redacted.ipv6);
    }

    this._log('debug', `Fingerprint redacted: ${Object.keys(redacted).join(', ')}`);
    return redacted;
  }

  /**
   * Redact WebRTC-specific data
   * @param {Object} webrtcData - WebRTC data object
   * @returns {Object} Redacted WebRTC data
   */
  redactWebRTC(webrtcData) {
    if (!webrtcData) {
      return webrtcData;
    }

    const redacted = { ...webrtcData };

    // Redact IP addresses in WebRTC data
    if (redacted.ipv4) {
      redacted.ipv4 = this.redactIPv4(redacted.ipv4);
    }
    if (redacted.ipv6) {
      redacted.ipv6 = this.redactIPv6(redacted.ipv6);
    }

    // Redact raw candidates if present
    if (redacted.candidates && Array.isArray(redacted.candidates)) {
      redacted.candidates = redacted.candidates.map(candidate =>
        this.redactCandidate(candidate)
      );
    }

    // Redact from ICE candidates
    if (redacted.iceGatheringState) {
      redacted.iceGatheringState = this.redactIPsInString(redacted.iceGatheringState);
    }

    return redacted;
  }

  /**
   * Redact a single WebRTC candidate string
   * @param {string} candidate - ICE candidate line
   * @returns {string} Redacted candidate
   */
  redactCandidate(candidate) {
    if (typeof candidate !== 'string') {
      return candidate;
    }

    let redacted = candidate;

    // Extract IP from candidate (ICE candidate format)
    const ipMatch = candidate.match(/candidate:.*\s([\d.]+|[:\da-f]+)\s/i);
    if (ipMatch) {
      const ip = ipMatch[1];
      const maskedIp = this._getMaskedIP(ip);
      redacted = candidate.replace(ip, maskedIp);

      this._log('debug', `Redacted candidate IP: ${ip} -> ${maskedIp}`);
    }

    return redacted;
  }

  /**
   * Redact IPv4 address
   * @param {string} ipv4 - IPv4 address
   * @returns {string} Redacted IPv4 address
   */
  redactIPv4(ipv4) {
    if (!ipv4) {
      return ipv4;
    }

    if (this.privacyMode === 'remove') {
      return null;
    }

    return this.redactIPsInString(ipv4);
  }

  /**
   * Redact IPv6 address
   * @param {string} ipv6 - IPv6 address
   * @returns {string} Redacted IPv6 address
   */
  redactIPv6(ipv6) {
    if (!ipv6) {
      return ipv6;
    }

    if (this.privacyMode === 'remove') {
      return null;
    }

    return this.redactIPsInString(ipv6);
  }

  /**
   * Redact all IPs in a string
   * @param {string} str - String containing potential IPs
   * @returns {string} String with IPs redacted
   */
  redactIPsInString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    let result = str;

    // Redact IPv4
    result = result.replace(this.ipv4Pattern, (match) => {
      return this._getMaskedIP(match);
    });

    // Redact IPv6 (simplified pattern)
    result = result.replace(/[0-9a-fA-F:]+(?::[0-9a-fA-F]+)+/g, (match) => {
      if (this._isValidIPv6(match)) {
        return this._getMaskedIPv6(match);
      }
      return match;
    });

    return result;
  }

  /**
   * Get masked IP for an original IP (consistent masking)
   * @param {string} originalIP - Original IP address
   * @returns {string} Masked IP address
   * @private
   */
  _getMaskedIP(originalIP) {
    if (!originalIP) {
      return originalIP;
    }

    // Handle private IP addresses specially
    if (this._isPrivateIP(originalIP)) {
      return this._maskPrivateIP(originalIP);
    }

    // For public IPs, use consistent mapping if enabled
    if (this.consistentMasking && this.ipMappings.has(originalIP)) {
      return this.ipMappings.get(originalIP);
    }

    let maskedIP;
    if (this.privacyMode === 'obfuscate') {
      maskedIP = this._obfuscateIP(originalIP);
    } else {
      maskedIP = this._maskPublicIP(originalIP);
    }

    if (this.consistentMasking) {
      this.ipMappings.set(originalIP, maskedIP);
    }

    return maskedIP;
  }

  /**
   * Get masked IPv6 address
   * @param {string} originalIP - Original IPv6 address
   * @returns {string} Masked IPv6
   * @private
   */
  _getMaskedIPv6(originalIP) {
    if (this.privacyMode === 'remove') {
      return '::1';
    }

    if (this.consistentMasking && this.ipMappings.has(originalIP)) {
      return this.ipMappings.get(originalIP);
    }

    // Replace groups with anonymized pattern
    let masked;
    if (this.privacyMode === 'obfuscate') {
      masked = originalIP.replace(/[0-9a-f]/g, () => {
        return Math.floor(Math.random() * 16).toString(16);
      });
    } else {
      masked = '2001:db8::' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
    }

    if (this.consistentMasking) {
      this.ipMappings.set(originalIP, masked);
    }

    return masked;
  }

  /**
   * Mask a private IP address
   * @param {string} ip - Private IP
   * @returns {string} Masked private IP
   * @private
   */
  _maskPrivateIP(ip) {
    if (this.privacyMode === 'remove') {
      return '192.168.0.0';
    }

    if (this.privacyMode === 'obfuscate') {
      return this._obfuscateIP(ip);
    }

    // Preserve first octet, mask rest for private IPs
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.0.0.${Math.floor(Math.random() * 256)}`;
    }
    return ip;
  }

  /**
   * Mask a public IP address
   * @param {string} ip - Public IP
   * @returns {string} Masked public IP
   * @private
   */
  _maskPublicIP(ip) {
    if (this.privacyMode === 'remove') {
      return '0.0.0.0';
    }

    // Preserve first two octets, randomize last two
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    }
    return ip;
  }

  /**
   * Obfuscate an IP address
   * @param {string} ip - IP address
   * @returns {string} Obfuscated IP
   * @private
   */
  _obfuscateIP(ip) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // Randomize all octets
      return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
    }
    return ip;
  }

  /**
   * Check if IP is private/local
   * @param {string} ip - IP address
   * @returns {boolean}
   * @private
   */
  _isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Validate IPv6 address
   * @param {string} ip - IPv6 address
   * @returns {boolean}
   * @private
   */
  _isValidIPv6(ip) {
    // Simple IPv6 validation
    return /^[0-9a-f:]+$/.test(ip) && ip.includes(':');
  }

  /**
   * Reset IP mapping (useful for new sessions)
   */
  resetMapping() {
    this.ipMappings.clear();
    this.nextMaskId = 1;
    this._log('debug', 'IP mapping reset');
  }

  /**
   * Get redaction statistics
   * @returns {Object}
   */
  getStats() {
    return {
      enabled: this.enabled,
      privacyMode: this.privacyMode,
      consistentMasking: this.consistentMasking,
      mappedIPCount: this.ipMappings.size,
      preserveNetworkInfo: this.preserveNetworkInfo
    };
  }

  /**
   * Internal logging
   * @private
   */
  _log(level, message) {
    if (this.logger) {
      this.logger[level](`[IP Redaction] ${message}`);
    }
  }
}

module.exports = { IPRedactionManager };
