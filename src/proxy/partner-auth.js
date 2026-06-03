/**
 * Proxy Partner Authentication Module
 * Handles authentication for multiple proxy vendor partnerships
 *
 * Supported Auth Types:
 * - API Key (Oxylabs, Bright Data)
 * - OAuth2 (Zyte, Apify)
 * - Basic Auth + Special Headers
 * - IP Whitelist Verification
 *
 * Features:
 * - Token caching (15-minute TTL)
 * - Credential rotation
 * - Rate limit tracking
 * - Webhook verification
 */

const crypto = require('crypto');

class PartnerAuth {
  constructor(options = {}) {
    this.tokenCache = new Map();
    this.credentialRotation = new Map();
    this.rateLimitTracking = new Map();
    this.webhookSecrets = new Map();

    this.config = {
      tokenCacheTTL: options.tokenCacheTTL || 15 * 60 * 1000, // 15 minutes
      rateLimitWindow: options.rateLimitWindow || 60 * 1000,    // 1 minute
      maxAttemptsPerWindow: options.maxAttemptsPerWindow || 100,
      credentialRotationInterval: options.credentialRotationInterval || 3600000, // 1 hour
      webhookVerifyTimeout: options.webhookVerifyTimeout || 5000
    };

    this.credentials = new Map();
    this.authMethods = new Map();

    this._initializeAuthMethods();
    this._startCredentialRotation();
  }

  /**
   * Initialize authentication methods
   */
  _initializeAuthMethods() {
    this.authMethods.set('api_key', this._handleApiKeyAuth.bind(this));
    this.authMethods.set('oauth2', this._handleOAuth2Auth.bind(this));
    this.authMethods.set('basic_auth', this._handleBasicAuth.bind(this));
    this.authMethods.set('ip_whitelist', this._handleIpWhitelistAuth.bind(this));
    this.authMethods.set('header_token', this._handleHeaderTokenAuth.bind(this));
  }

  /**
   * Register credentials for a partner
   * @param {string} partnerId - Partner identifier
   * @param {object} credentials - Partner credentials
   * @param {string} authType - Authentication type
   */
  registerCredentials(partnerId, credentials, authType) {
    if (!partnerId || !credentials || !authType) {
      throw new Error('partnerId, credentials, and authType are required');
    }

    if (!this.authMethods.has(authType)) {
      throw new Error(`Unsupported auth type: ${authType}`);
    }

    this.credentials.set(partnerId, {
      credentials,
      authType,
      registeredAt: Date.now(),
      usageCount: 0,
      lastUsed: null,
      rotationIndex: 0
    });

    // Initialize rate limit tracking
    this.rateLimitTracking.set(partnerId, {
      attempts: [],
      blocked: false,
      unblockTime: null
    });

    return {
      success: true,
      partnerId,
      authType,
      message: `Credentials registered for ${partnerId}`
    };
  }

  /**
   * Authenticate with a partner
   * @param {string} partnerId - Partner identifier
   * @param {object} options - Authentication options
   */
  async authenticate(partnerId, options = {}) {
    try {
      const credentialSet = this.credentials.get(partnerId);
      if (!credentialSet) {
        throw new Error(`No credentials registered for ${partnerId}`);
      }

      // Check rate limiting
      if (this._isRateLimited(partnerId)) {
        throw new Error(`Rate limited for ${partnerId}`);
      }

      // Check cache first
      const cachedToken = this._getCachedToken(partnerId);
      if (cachedToken && !options.forceRefresh) {
        return {
          success: true,
          token: cachedToken,
          source: 'cache',
          partnerId
        };
      }

      // Get auth handler
      const authHandler = this.authMethods.get(credentialSet.authType);
      if (!authHandler) {
        throw new Error(`Auth handler not found for ${credentialSet.authType}`);
      }

      // Perform authentication
      const result = await authHandler(credentialSet, options);

      // Cache token if successful
      if (result.token) {
        this._cacheToken(partnerId, result.token);
      }

      // Update metrics
      credentialSet.usageCount++;
      credentialSet.lastUsed = Date.now();
      this._recordAuthAttempt(partnerId, true);

      return {
        success: true,
        token: result.token,
        source: 'fresh',
        expiresIn: result.expiresIn,
        partnerId
      };
    } catch (error) {
      this._recordAuthAttempt(partnerId, false);
      return {
        success: false,
        error: error.message,
        partnerId
      };
    }
  }

  /**
   * Handle API Key authentication
   */
  async _handleApiKeyAuth(credentialSet, options) {
    const { credentials } = credentialSet;

    if (!credentials.apiKey) {
      throw new Error('API key is required for api_key auth');
    }

    // Generate token from API key (could be hash-based or direct)
    const token = credentials.apiKey;

    return {
      token,
      expiresIn: this.config.tokenCacheTTL,
      type: 'api_key'
    };
  }

  /**
   * Handle OAuth2 authentication
   */
  async _handleOAuth2Auth(credentialSet, options) {
    const { credentials } = credentialSet;

    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('clientId and clientSecret are required for oauth2');
    }

    // Simulate OAuth2 token fetch
    const timestamp = Date.now();
    const tokenData = `${credentials.clientId}:${credentials.clientSecret}:${timestamp}`;
    const token = crypto.createHash('sha256').update(tokenData).digest('hex');

    return {
      token,
      expiresIn: credentials.expiresIn || 3600000, // 1 hour default
      type: 'oauth2',
      refreshToken: credentials.refreshToken
    };
  }

  /**
   * Handle Basic authentication
   */
  async _handleBasicAuth(credentialSet, options) {
    const { credentials } = credentialSet;

    if (!credentials.username || !credentials.password) {
      throw new Error('username and password are required for basic_auth');
    }

    const basicAuth = Buffer.from(
      `${credentials.username}:${credentials.password}`
    ).toString('base64');

    const headers = {
      'Authorization': `Basic ${basicAuth}`
    };

    // Add special headers if provided
    if (credentials.specialHeaders) {
      Object.assign(headers, credentials.specialHeaders);
    }

    return {
      token: basicAuth,
      expiresIn: this.config.tokenCacheTTL,
      type: 'basic_auth',
      headers
    };
  }

  /**
   * Handle IP Whitelist verification
   */
  async _handleIpWhitelistAuth(credentialSet, options) {
    const { credentials } = credentialSet;

    if (!credentials.clientIp) {
      throw new Error('clientIp is required for ip_whitelist');
    }

    // In real scenario, would verify against partner's IP whitelist
    // For now, generate verification token
    const token = crypto.createHash('sha256')
      .update(credentials.clientIp)
      .digest('hex');

    return {
      token,
      expiresIn: this.config.tokenCacheTTL,
      type: 'ip_whitelist',
      verifiedIp: credentials.clientIp
    };
  }

  /**
   * Handle Header Token authentication
   */
  async _handleHeaderTokenAuth(credentialSet, options) {
    const { credentials } = credentialSet;

    if (!credentials.headerName || !credentials.headerValue) {
      throw new Error('headerName and headerValue are required');
    }

    const token = credentials.headerValue;

    return {
      token,
      expiresIn: this.config.tokenCacheTTL,
      type: 'header_token',
      headerName: credentials.headerName
    };
  }

  /**
   * Verify webhook from partner
   * @param {string} partnerId - Partner identifier
   * @param {string} signature - Webhook signature
   * @param {object} payload - Webhook payload
   */
  verifyWebhook(partnerId, signature, payload) {
    try {
      const secret = this.webhookSecrets.get(partnerId);
      if (!secret) {
        throw new Error(`No webhook secret for ${partnerId}`);
      }

      // Compute HMAC
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      return {
        success: isValid,
        partnerId,
        verified: isValid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        partnerId,
        verified: false
      };
    }
  }

  /**
   * Register webhook secret for partner
   */
  registerWebhookSecret(partnerId, secret) {
    this.webhookSecrets.set(partnerId, secret);
    return {
      success: true,
      message: `Webhook secret registered for ${partnerId}`
    };
  }

  /**
   * Rotate credentials for a partner
   */
  rotateCredentials(partnerId, newCredentials) {
    const credentialSet = this.credentials.get(partnerId);
    if (!credentialSet) {
      throw new Error(`No credentials for ${partnerId}`);
    }

    // Store old credentials
    if (!this.credentialRotation.has(partnerId)) {
      this.credentialRotation.set(partnerId, []);
    }

    const history = this.credentialRotation.get(partnerId);
    history.push({
      credentials: credentialSet.credentials,
      rotatedAt: Date.now(),
      rotationIndex: credentialSet.rotationIndex
    });

    // Keep only last 5 rotations
    if (history.length > 5) {
      history.shift();
    }

    // Update credentials
    credentialSet.credentials = newCredentials;
    credentialSet.rotationIndex++;
    credentialSet.lastRotated = Date.now();

    // Clear cache to force re-authentication
    this.tokenCache.delete(partnerId);

    return {
      success: true,
      partnerId,
      rotationIndex: credentialSet.rotationIndex
    };
  }

  /**
   * Get rate limit status for partner
   */
  getRateLimitStatus(partnerId) {
    const tracking = this.rateLimitTracking.get(partnerId);
    if (!tracking) {
      return {
        partnerId,
        isLimited: false,
        attempts: 0
      };
    }

    // Clean old attempts outside window
    const now = Date.now();
    tracking.attempts = tracking.attempts.filter(
      t => now - t < this.config.rateLimitWindow
    );

    return {
      partnerId,
      isLimited: tracking.blocked,
      attempts: tracking.attempts.length,
      maxAttempts: this.config.maxAttemptsPerWindow,
      unblockTime: tracking.unblockTime
    };
  }

  /**
   * Get credentials status
   */
  getCredentialsStatus(partnerId) {
    const credentialSet = this.credentials.get(partnerId);
    if (!credentialSet) {
      return null;
    }

    return {
      partnerId,
      authType: credentialSet.authType,
      registeredAt: credentialSet.registeredAt,
      usageCount: credentialSet.usageCount,
      lastUsed: credentialSet.lastUsed,
      rotationIndex: credentialSet.rotationIndex,
      hasCachedToken: this.tokenCache.has(partnerId)
    };
  }

  /**
   * Clear all cached tokens
   */
  clearTokenCache(partnerId) {
    if (partnerId) {
      this.tokenCache.delete(partnerId);
    } else {
      this.tokenCache.clear();
    }
    return { success: true };
  }

  // Private helper methods

  /**
   * Check if partner is rate limited
   */
  _isRateLimited(partnerId) {
    const tracking = this.rateLimitTracking.get(partnerId);
    if (!tracking) {
      return false;
    }

    if (tracking.blocked && tracking.unblockTime && Date.now() < tracking.unblockTime) {
      return true;
    }

    // Unblock if time has passed
    if (tracking.unblockTime && Date.now() >= tracking.unblockTime) {
      tracking.blocked = false;
      tracking.unblockTime = null;
      tracking.attempts = [];
    }

    return false;
  }

  /**
   * Record authentication attempt
   */
  _recordAuthAttempt(partnerId, success) {
    const tracking = this.rateLimitTracking.get(partnerId);
    if (!tracking) {
      return;
    }

    if (!success) {
      tracking.attempts.push(Date.now());

      if (tracking.attempts.length >= this.config.maxAttemptsPerWindow) {
        tracking.blocked = true;
        tracking.unblockTime = Date.now() + this.config.rateLimitWindow;
      }
    }
  }

  /**
   * Get cached token
   */
  _getCachedToken(partnerId) {
    const cached = this.tokenCache.get(partnerId);
    if (cached && Date.now() - cached.cachedAt < this.config.tokenCacheTTL) {
      return cached.token;
    }
    this.tokenCache.delete(partnerId);
    return null;
  }

  /**
   * Cache token
   */
  _cacheToken(partnerId, token) {
    this.tokenCache.set(partnerId, {
      token,
      cachedAt: Date.now()
    });
  }

  /**
   * Start credential rotation timer
   */
  _startCredentialRotation() {
    this.rotationTimer = setInterval(() => {
      // Placeholder for automatic credential rotation
      // Can be extended to automatically refresh long-lived credentials
    }, this.config.credentialRotationInterval);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    this.tokenCache.clear();
    this.credentials.clear();
    this.rateLimitTracking.clear();
    this.webhookSecrets.clear();
  }
}

module.exports = { PartnerAuth };
