/**
 * Basset Hound Browser - Advanced Headless Authentication Module
 * Handles complex authentication flows in headless mode with human-like behavior
 *
 * Version: 1.0.0
 * Created: May 11, 2026
 */

const { humanDelay, humanType, humanMouseMove } = require('../../evasion/humanize');

class HeadlessAuthenticationManager {
  constructor(browser) {
    this.browser = browser;
    this.sessionCache = new Map();
    this.authFlows = new Map();
    this.retryPolicy = {
      maxRetries: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2
    };
  }

  /**
   * Register an authentication flow for reuse
   */
  registerAuthFlow(name, config) {
    if (!config.type) {
      throw new Error('Auth flow must have a type (oauth, login-form, captcha-aware, etc)');
    }
    if (!config.steps || !Array.isArray(config.steps)) {
      throw new Error('Auth flow must have steps array');
    }

    this.authFlows.set(name, {
      ...config,
      createdAt: Date.now(),
      usageCount: 0
    });

    return { success: true, flowId: name };
  }

  /**
   * Execute an authentication flow with human-like behavior
   */
  async executeAuthFlow(flowName, context = {}) {
    const flow = this.authFlows.get(flowName);
    if (!flow) {
      throw new Error(`Auth flow not found: ${flowName}`);
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    const results = [];

    try {
      flow.usageCount++;

      for (let stepIdx = 0; stepIdx < flow.steps.length; stepIdx++) {
        const step = flow.steps[stepIdx];

        try {
          const result = await this.executeAuthStep(step, context, stepIdx);
          results.push({
            stepIndex: stepIdx,
            stepId: step.id,
            status: 'success',
            result,
            duration: result.duration
          });

          // Update context with step results
          context[`step_${stepIdx}_result`] = result;
        } catch (error) {
          // Check if step is retryable
          if (step.retryable !== false && results.length > 0) {
            const retryResult = await this.retryAuthStep(step, context, stepIdx, error);
            if (retryResult.success) {
              results.push({
                stepIndex: stepIdx,
                stepId: step.id,
                status: 'success_after_retry',
                result: retryResult,
                duration: retryResult.duration
              });
              context[`step_${stepIdx}_result`] = retryResult;
              continue;
            }
          }

          // Step failed
          throw error;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        executionId,
        flowName,
        status: 'completed',
        duration,
        stepCount: flow.steps.length,
        results,
        sessionData: context.sessionData || null
      };
    } catch (error) {
      return {
        success: false,
        executionId,
        flowName,
        status: 'failed',
        error: error.message,
        stepsFailed: results.length,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a single authentication step
   */
  async executeAuthStep(step, context, stepIndex) {
    const stepStartTime = Date.now();

    switch (step.type) {
    case 'navigate':
      return await this.stepNavigate(step, context);

    case 'fill_login_form':
      return await this.stepFillLoginForm(step, context);

    case 'handle_mfa':
      return await this.stepHandleMFA(step, context);

    case 'handle_captcha':
      return await this.stepHandleCaptcha(step, context);

    case 'detect_success':
      return await this.stepDetectSuccess(step, context);

    case 'wait_for_redirect':
      return await this.stepWaitForRedirect(step, context);

    case 'verify_session':
      return await this.stepVerifySession(step, context);

    case 'handle_error':
      return await this.stepHandleError(step, context);

    case 'custom_script':
      return await this.stepCustomScript(step, context);

    default:
      throw new Error(`Unknown auth step type: ${step.type}`);
    }
  }

  /**
   * Navigate to a URL with humanized behavior
   */
  async stepNavigate(step, context) {
    const startTime = Date.now();

    // Substitute variables in URL
    const url = this.substituteVariables(step.url, context);

    // Add human-like delay before navigation
    await humanDelay(500, 2000);

    // Navigate
    await this.browser.navigate(url);

    // Wait for page load
    if (step.waitFor) {
      await this.waitForCondition(step.waitFor, step.timeout || 10000);
    }

    return {
      url,
      success: true,
      duration: Date.now() - startTime
    };
  }

  /**
   * Fill login form with human-like typing
   */
  async stepFillLoginForm(step, context) {
    const startTime = Date.now();
    const results = [];

    // Get credentials (from context or step config)
    const username = this.substituteVariables(step.username, context);
    const password = this.substituteVariables(step.password, context);

    // Find and fill username field
    if (step.usernameSelector) {
      await humanDelay(300, 800);
      await this.browser.click(step.usernameSelector);
      await humanDelay(200, 600);
      await humanType(username, {
        variance: step.typingVariance || 'natural',
        selectorContext: step.usernameSelector
      });
      results.push({ field: 'username', filled: true });
    }

    // Find and fill password field
    if (step.passwordSelector) {
      await humanDelay(400, 1000);
      await this.browser.click(step.passwordSelector);
      await humanDelay(200, 600);
      await humanType(password, {
        variance: step.typingVariance || 'natural',
        selectorContext: step.passwordSelector
      });
      results.push({ field: 'password', filled: true });
    }

    // Handle any additional fields (email, OTP, etc)
    if (step.additionalFields) {
      for (const field of step.additionalFields) {
        const value = this.substituteVariables(field.value, context);
        await humanDelay(300, 700);
        await this.browser.click(field.selector);
        await humanDelay(200, 500);
        await humanType(value, { variance: 'natural' });
        results.push({ field: field.name, filled: true });
      }
    }

    // Click submit button with human delay
    if (step.submitSelector) {
      await humanDelay(500, 2000);
      await this.browser.click(step.submitSelector);
    }

    return {
      success: true,
      fieldsFilled: results.length,
      fields: results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle Multi-Factor Authentication
   */
  async stepHandleMFA(step, context) {
    const startTime = Date.now();

    // Wait for MFA prompt
    await this.waitForCondition(
      { type: 'selector', value: step.mfaPromptSelector },
      step.timeout || 15000
    );

    const mfaCode = this.substituteVariables(step.mfaCode, context);

    if (!mfaCode) {
      throw new Error('MFA code required but not provided in context');
    }

    // Fill MFA code with slower typing (MFA codes are more critical)
    if (step.mfaInputSelector) {
      await humanDelay(400, 1000);
      await this.browser.click(step.mfaInputSelector);
      await humanDelay(300, 800);
      await humanType(mfaCode, { variance: 'slow' });
      await humanDelay(500, 1500);
    }

    // Submit MFA
    if (step.mfaSubmitSelector) {
      await this.browser.click(step.mfaSubmitSelector);
    }

    return {
      success: true,
      mfaHandled: true,
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle CAPTCHA challenges
   */
  async stepHandleCaptcha(step, context) {
    const startTime = Date.now();

    // Check if CAPTCHA is present
    const captchaPresent = await this.browser.elementExists(step.captchaSelector || '[data-captcha]');

    if (!captchaPresent) {
      return {
        success: true,
        captchaPresent: false,
        duration: Date.now() - startTime
      };
    }

    // Strategy depends on CAPTCHA type
    switch (step.captchaType) {
    case 'recaptcha_v2':
      return await this.handleRecaptchaV2(step, context);

    case 'recaptcha_v3':
      return await this.handleRecaptchaV3(step, context);

    case 'hcaptcha':
      return await this.handleHCaptcha(step, context);

    case 'image_puzzle':
      return await this.handleImagePuzzle(step, context);

    case 'email_verification':
      return await this.handleEmailVerification(step, context);

    default:
      // Pause and wait for manual intervention
      return {
        success: false,
        captchaPresent: true,
        captchaType: step.captchaType || 'unknown',
        action: 'manual_intervention_required',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Handle reCAPTCHA v2
   */
  async handleRecaptchaV2(step, context) {
    const startTime = Date.now();

    // Check if CAPTCHA is solved (sometimes automatically or via service)
    await this.waitForCondition(
      {
        type: 'custom_script',
        script: `() => {
          const token = document.querySelector('[name="g-recaptcha-response"]');
          return token && token.value;
        }`
      },
      step.timeout || 30000
    );

    return {
      success: true,
      captchaResolved: true,
      method: 'recaptcha_v2_token',
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle reCAPTCHA v3
   */
  async handleRecaptchaV3(step, context) {
    // reCAPTCHA v3 is handled passively (score-based, no user interaction)
    // Just wait for the challenge token to be generated
    await this.waitForCondition(
      {
        type: 'custom_script',
        script: `() => window.grecaptchaResponseToken !== undefined`
      },
      step.timeout || 10000
    );

    return {
      success: true,
      captchaResolved: true,
      method: 'recaptcha_v3_passive',
      duration: Date.now() - Date.now()
    };
  }

  /**
   * Handle hCaptcha
   */
  async handleHCaptcha(step, context) {
    const startTime = Date.now();

    await this.waitForCondition(
      {
        type: 'custom_script',
        script: `() => {
          const token = document.querySelector('[name="h-captcha-response"]');
          return token && token.value;
        }`
      },
      step.timeout || 30000
    );

    return {
      success: true,
      captchaResolved: true,
      method: 'hcaptcha_token',
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle image puzzle CAPTCHA
   */
  async handleImagePuzzle(step, context) {
    // This would typically require external solving service
    // For now, pause and wait
    return {
      success: false,
      captchaPresent: true,
      captchaType: 'image_puzzle',
      action: 'pause_for_manual_solving',
      message: 'Image puzzle requires manual or external service intervention'
    };
  }

  /**
   * Handle email verification
   */
  async handleEmailVerification(step, context) {
    // Pause and wait for email to be verified
    return {
      success: false,
      captchaPresent: true,
      captchaType: 'email_verification',
      action: 'pause_for_email_verification',
      message: 'Email verification required - awaiting user confirmation'
    };
  }

  /**
   * Detect successful authentication
   */
  async stepDetectSuccess(step, context) {
    const startTime = Date.now();

    // Check multiple success indicators
    const successIndicators = step.successIndicators || [
      { type: 'selector', value: '.dashboard' },
      { type: 'selector', value: '[data-authenticated="true"]' }
    ];

    for (const indicator of successIndicators) {
      try {
        await this.waitForCondition(indicator, step.timeout || 10000);
        return {
          success: true,
          detected: true,
          indicator,
          duration: Date.now() - startTime
        };
      } catch (e) {
        // This indicator didn't match, try next
      }
    }

    throw new Error('Authentication success not detected');
  }

  /**
   * Wait for authentication redirect
   */
  async stepWaitForRedirect(step, context) {
    const startTime = Date.now();

    const initialUrl = await this.browser.getUrl();
    const maxWaitTime = step.timeout || 15000;
    const checkInterval = 500;

    let elapsed = 0;
    while (elapsed < maxWaitTime) {
      const currentUrl = await this.browser.getUrl();

      // Check if URL matches expected pattern
      if (step.expectedUrl) {
        if (currentUrl.includes(step.expectedUrl)) {
          return {
            success: true,
            redirected: true,
            from: initialUrl,
            to: currentUrl,
            duration: Date.now() - startTime
          };
        }
      }

      // Check if URL changed from initial
      if (currentUrl !== initialUrl) {
        return {
          success: true,
          redirected: true,
          from: initialUrl,
          to: currentUrl,
          duration: Date.now() - startTime
        };
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    throw new Error(`Redirect not detected after ${maxWaitTime}ms`);
  }

  /**
   * Verify session was created
   */
  async stepVerifySession(step, context) {
    const startTime = Date.now();

    const sessionValid = await this.validateSession(step.sessionValidationScript || null);

    if (!sessionValid) {
      throw new Error('Session validation failed');
    }

    // Cache the session
    const sessionId = this.generateSessionId();
    this.sessionCache.set(sessionId, {
      createdAt: Date.now(),
      context,
      valid: true
    });

    context.sessionData = {
      sessionId,
      validated: true,
      timestamp: Date.now()
    };

    return {
      success: true,
      sessionId,
      validated: true,
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle authentication errors
   */
  async stepHandleError(step, context) {
    const startTime = Date.now();

    // Check if error condition exists
    const errorPresent = await this.browser.elementExists(step.errorSelector);

    if (!errorPresent) {
      return {
        success: true,
        errorDetected: false,
        duration: Date.now() - startTime
      };
    }

    // Get error message
    const errorElement = await this.browser.querySelector(step.errorSelector);
    const errorMessage = errorElement ? await errorElement.textContent : 'Unknown error';

    // Execute error recovery action
    if (step.recoveryAction === 'retry') {
      context.retryCount = (context.retryCount || 0) + 1;
      return {
        success: true,
        errorDetected: true,
        errorMessage,
        action: 'retry',
        duration: Date.now() - startTime
      };
    }

    if (step.recoveryAction === 'clear_form') {
      // Clear form fields
      if (step.usernameSelector) {
        await this.browser.click(step.usernameSelector);
        await this.browser.keydown('ctrl+a');
        await this.browser.keypress('delete');
      }

      return {
        success: true,
        errorDetected: true,
        errorMessage,
        action: 'form_cleared',
        duration: Date.now() - startTime
      };
    }

    throw new Error(`Authentication error: ${errorMessage}`);
  }

  /**
   * Execute custom JavaScript during auth flow
   */
  async stepCustomScript(step, context) {
    const startTime = Date.now();

    const script = this.substituteVariables(step.script, context);
    const result = await this.browser.evaluate(script);

    return {
      success: true,
      scriptExecuted: true,
      result,
      duration: Date.now() - startTime
    };
  }

  /**
   * Retry a failed authentication step with exponential backoff
   */
  async retryAuthStep(step, context, stepIndex, originalError) {
    let lastError = originalError;

    for (let attempt = 0; attempt < this.retryPolicy.maxRetries; attempt++) {
      const delayMs = this.retryPolicy.baseDelayMs *
        Math.pow(this.retryPolicy.backoffMultiplier, attempt);

      await new Promise(resolve => setTimeout(resolve, delayMs));

      try {
        return await this.executeAuthStep(step, context, stepIndex);
      } catch (error) {
        lastError = error;
      }
    }

    return {
      success: false,
      error: lastError.message,
      attemptsExhausted: true
    };
  }

  /**
   * Validate a session is still active
   */
  async validateSession(validationScript = null) {
    try {
      if (validationScript) {
        return await this.browser.evaluate(validationScript);
      }

      // Default validation: check for auth token/cookie
      const cookies = await this.browser.getCookies();
      return cookies && cookies.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for a condition
   */
  async waitForCondition(condition, timeout = 10000) {
    const startTime = Date.now();

    if (condition.type === 'selector') {
      return await this.waitForSelector(condition.value, timeout);
    }

    if (condition.type === 'custom_script') {
      return await this.waitForCustomCondition(condition.script, timeout);
    }

    throw new Error(`Unknown condition type: ${condition.type}`);
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector, timeout) {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < timeout) {
      const exists = await this.browser.elementExists(selector);
      if (exists) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Selector not found after ${timeout}ms: ${selector}`);
  }

  /**
   * Wait for a custom JavaScript condition
   */
  async waitForCustomCondition(script, timeout) {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.browser.evaluate(script);
        if (result) {
          return true;
        }
      } catch (error) {
        // Script error, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Custom condition not met after ${timeout}ms`);
  }

  /**
   * Substitute variables in strings
   */
  substituteVariables(str, context) {
    if (typeof str !== 'string') {
      return str;
    }

    return str.replace(/\$\{(\w+)\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }

  /**
   * Get cached session
   */
  getSession(sessionId) {
    return this.sessionCache.get(sessionId) || null;
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();

    for (const [sessionId, session] of this.sessionCache) {
      if (now - session.createdAt > maxAgeMs) {
        this.sessionCache.delete(sessionId);
      }
    }

    return {
      success: true,
      remaining: this.sessionCache.size
    };
  }

  /**
   * List all registered auth flows
   */
  listAuthFlows() {
    const flows = [];

    for (const [name, config] of this.authFlows) {
      flows.push({
        name,
        type: config.type,
        stepCount: config.steps.length,
        usageCount: config.usageCount,
        createdAt: config.createdAt
      });
    }

    return flows;
  }

  /**
   * Generate execution ID
   */
  generateExecutionId() {
    return `auth_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = {
  HeadlessAuthenticationManager
};
