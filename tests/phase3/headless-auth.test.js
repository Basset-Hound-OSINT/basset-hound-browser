/**
 * Headless Authentication Tests
 * Tests for Advanced Authentication/Headless Flow - Feature 1
 */

const { HeadlessAuthenticationManager } = require('../../src/authentication/headless-auth');

// Mock browser object
const createMockBrowser = () => ({
  navigate: async (url) => ({ success: true, url }),
  click: async (selector) => ({ success: true, selector }),
  elementExists: async (selector) => true,
  querySelector: async (selector) => ({ textContent: 'test' }),
  evaluate: async (script) => true,
  getCookies: async () => [{ name: 'session', value: 'abc123' }],
  getUrl: async () => 'https://example.com/dashboard',
  keydown: async (key) => ({ success: true }),
  keypress: async (key) => ({ success: true })
});

describe('HeadlessAuthenticationManager', () => {
  let authManager;
  let mockBrowser;

  beforeEach(() => {
    mockBrowser = createMockBrowser();
    authManager = new HeadlessAuthenticationManager(mockBrowser);
  });

  describe('Flow Registration', () => {
    test('should register a new auth flow', () => {
      const flow = {
        type: 'login-form',
        steps: [
          { id: 'nav', type: 'navigate', url: 'https://example.com/login' },
          { id: 'login', type: 'fill_login_form', usernameSelector: '#user', passwordSelector: '#pass' }
        ]
      };

      const result = authManager.registerAuthFlow('login_basic', flow);
      expect(result.success).toBe(true);
      expect(result.flowId).toBe('login_basic');
    });

    test('should require flow type', () => {
      const flow = {
        steps: [{ type: 'navigate' }]
      };

      expect(() => {
        authManager.registerAuthFlow('test', flow);
      }).toThrow();
    });

    test('should require steps array', () => {
      const flow = {
        type: 'login-form'
      };

      expect(() => {
        authManager.registerAuthFlow('test', flow);
      }).toThrow();
    });

    test('should list all registered flows', () => {
      authManager.registerAuthFlow('flow1', {
        type: 'oauth',
        steps: [{ type: 'navigate', url: 'https://oauth.example.com' }]
      });

      authManager.registerAuthFlow('flow2', {
        type: 'login-form',
        steps: [{ type: 'fill_login_form' }]
      });

      const flows = authManager.listAuthFlows();
      expect(flows.length).toBe(2);
      expect(flows[0].name).toBe('flow1');
      expect(flows[1].name).toBe('flow2');
    });
  });

  describe('Authentication Flow Execution', () => {
    beforeEach(() => {
      authManager.registerAuthFlow('simple_login', {
        type: 'login-form',
        steps: [
          {
            id: 'navigate',
            type: 'navigate',
            url: 'https://example.com/login',
            waitFor: { type: 'selector', value: '#login-form' }
          },
          {
            id: 'fill_form',
            type: 'fill_login_form',
            usernameSelector: '#username',
            passwordSelector: '#password',
            submitSelector: '#submit',
            username: '${username}',
            password: '${password}'
          }
        ]
      });
    });

    test('should execute auth flow successfully', async () => {
      const result = await authManager.executeAuthFlow('simple_login', {
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.results.length).toBeGreaterThan(0);
    });

    test('should handle variable substitution', async () => {
      const context = {
        username: 'john.doe@example.com',
        password: 'SecurePass123!'
      };

      const result = await authManager.executeAuthFlow('simple_login', context);
      expect(result.success).toBe(true);
      expect(result.results[1].result.fieldsFilled).toBeGreaterThan(0);
    });

    test('should fail when flow not found', async () => {
      try {
        await authManager.executeAuthFlow('nonexistent_flow', {});
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });

    test('should track execution duration', async () => {
      const result = await authManager.executeAuthFlow('simple_login', {
        username: 'test',
        password: 'test'
      });

      expect(result.duration).toBeGreaterThan(0);
    });

    test('should track step results', async () => {
      const result = await authManager.executeAuthFlow('simple_login', {
        username: 'test',
        password: 'test'
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].stepIndex).toBe(0);
      expect(result.results[1].stepIndex).toBe(1);
    });
  });

  describe('Login Form Filling', () => {
    test('should fill username and password fields', async () => {
      const step = {
        type: 'fill_login_form',
        usernameSelector: '#user',
        passwordSelector: '#pass',
        username: 'testuser',
        password: 'testpass',
        submitSelector: '#submit'
      };

      const result = await authManager.stepFillLoginForm(step, {});
      expect(result.success).toBe(true);
      expect(result.fieldsFilled).toBeGreaterThanOrEqual(2);
    });

    test('should handle additional fields', async () => {
      const step = {
        type: 'fill_login_form',
        usernameSelector: '#user',
        passwordSelector: '#pass',
        additionalFields: [
          { name: 'email', selector: '#email', value: '${email}' }
        ],
        submitSelector: '#submit',
        username: 'test',
        password: 'test'
      };

      const result = await authManager.stepFillLoginForm(step, { email: 'test@example.com' });
      expect(result.success).toBe(true);
      expect(result.fieldsFilled).toBe(3);
    });

    test('should support different typing variance', async () => {
      const step = {
        type: 'fill_login_form',
        usernameSelector: '#user',
        passwordSelector: '#pass',
        username: 'testuser',
        password: 'testpass',
        typingVariance: 'slow'
      };

      const result = await authManager.stepFillLoginForm(step, {});
      expect(result.success).toBe(true);
    });
  });

  describe('MFA Handling', () => {
    test('should handle MFA step with code', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_mfa',
        mfaPromptSelector: '.mfa-prompt',
        mfaInputSelector: '#mfa-code',
        mfaSubmitSelector: '#submit-mfa',
        mfaCode: '${mfaCode}'
      };

      const result = await authManager.stepHandleMFA(step, { mfaCode: '123456' });
      expect(result.success).toBe(true);
      expect(result.mfaHandled).toBe(true);
    });

    test('should succeed with MFA code provided', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_mfa',
        mfaPromptSelector: '.mfa-prompt',
        mfaInputSelector: '#mfa-code',
        mfaSubmitSelector: '#submit-mfa',
        mfaCode: '123456'
      };

      const result = await authManager.stepHandleMFA(step, {});
      expect(result.success).toBe(true);
      expect(result.mfaHandled).toBe(true);
    });
  });

  describe('CAPTCHA Handling', () => {
    test('should detect when CAPTCHA is not present', async () => {
      mockBrowser.elementExists = async () => false;

      const step = {
        type: 'handle_captcha',
        captchaSelector: '[data-captcha]'
      };

      const result = await authManager.stepHandleCaptcha(step, {});
      expect(result.captchaPresent).toBe(false);
    });

    test('should handle reCAPTCHA v2', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_captcha',
        captchaType: 'recaptcha_v2',
        captchaSelector: '[data-captcha]'
      };

      const result = await authManager.stepHandleCaptcha(step, {});
      expect(result.captchaResolved).toBe(true);
    });

    test('should handle hCaptcha', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_captcha',
        captchaType: 'hcaptcha',
        captchaSelector: '[data-captcha]'
      };

      const result = await authManager.stepHandleCaptcha(step, {});
      expect(result.captchaResolved).toBe(true);
    });

    test('should pause for manual solving of image puzzle', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_captcha',
        captchaType: 'image_puzzle'
      };

      const result = await authManager.stepHandleCaptcha(step, {});
      expect(result.action).toBe('pause_for_manual_solving');
    });
  });

  describe('Success Detection', () => {
    test('should detect successful authentication', async () => {
      const step = {
        type: 'detect_success',
        successIndicators: [
          { type: 'selector', value: '.dashboard' }
        ]
      };

      const result = await authManager.stepDetectSuccess(step, {});
      expect(result.success).toBe(true);
      expect(result.detected).toBe(true);
    });

    test('should try multiple success indicators', async () => {
      mockBrowser.elementExists = async (selector) => {
        return selector === '.profile-page';
      };

      const step = {
        type: 'detect_success',
        successIndicators: [
          { type: 'selector', value: '.dashboard' },
          { type: 'selector', value: '.profile-page' },
          { type: 'selector', value: '[data-authenticated]' }
        ]
      };

      const result = await authManager.stepDetectSuccess(step, {});
      expect(result.detected).toBe(true);
    });
  });

  describe('Session Management', () => {
    test('should verify and cache sessions', async () => {
      const step = {
        type: 'verify_session'
      };

      const result = await authManager.stepVerifySession(step, {});
      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    test('should retrieve cached session', async () => {
      const step = {
        type: 'verify_session'
      };

      const result = await authManager.stepVerifySession(step, {});
      const sessionId = result.sessionId;

      const retrieved = authManager.getSession(sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.valid).toBe(true);
    });

    test('should clear expired sessions', () => {
      authManager.registerAuthFlow('test', {
        type: 'login-form',
        steps: [{ type: 'navigate', url: 'https://example.com' }]
      });

      const result = authManager.clearExpiredSessions(0);
      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should detect and handle errors', async () => {
      mockBrowser.elementExists = async () => true;

      const step = {
        type: 'handle_error',
        errorSelector: '.error-message',
        recoveryAction: 'retry'
      };

      const result = await authManager.stepHandleError(step, {});
      expect(result.errorDetected).toBe(true);
      expect(result.action).toBe('retry');
    });

    test('should support form clearing on error', async () => {
      mockBrowser.elementExists = async () => true;
      mockBrowser.querySelector = async () => ({
        textContent: 'Invalid credentials'
      });

      const step = {
        type: 'handle_error',
        errorSelector: '.error-message',
        usernameSelector: '#user',
        recoveryAction: 'clear_form'
      };

      const result = await authManager.stepHandleError(step, {});
      expect(result.action).toBe('form_cleared');
    });
  });

  describe('Custom Scripts', () => {
    test('should execute custom JavaScript', async () => {
      const step = {
        type: 'custom_script',
        script: 'return window.location.href;'
      };

      const result = await authManager.stepCustomScript(step, {});
      expect(result.success).toBe(true);
      expect(result.scriptExecuted).toBe(true);
    });

    test('should support variable substitution in scripts', async () => {
      const step = {
        type: 'custom_script',
        script: 'return "${value}" === "test";'
      };

      const result = await authManager.stepCustomScript(step, { value: 'test' });
      expect(result.success).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed steps with backoff', async () => {
      let attempts = 0;

      mockBrowser.navigate = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary error');
        }
        return { success: true };
      };

      const step = {
        type: 'navigate',
        url: 'https://example.com',
        retryable: true
      };

      const result = await authManager.retryAuthStep(step, {}, 0, new Error('Test'));
      expect(result.success).toBe(true);
    });
  });

  describe('Redirection Handling', () => {
    test('should detect URL redirect', async () => {
      let urlChanges = false;
      mockBrowser.getUrl = async () => {
        if (urlChanges) {
          return 'https://example.com/dashboard';
        }
        urlChanges = true;
        return 'https://example.com/login';
      };

      const step = {
        type: 'wait_for_redirect'
      };

      const result = await authManager.stepWaitForRedirect(step, {});
      expect(result.success).toBe(true);
      expect(result.redirected).toBe(true);
    });
  });

  describe('Complex Workflows', () => {
    test('should execute multi-step OAuth flow', async () => {
      authManager.registerAuthFlow('oauth_flow', {
        type: 'oauth',
        steps: [
          { id: 'nav', type: 'navigate', url: 'https://oauth.example.com/authorize' },
          { id: 'consent', type: 'fill_login_form', usernameSelector: '#user', passwordSelector: '#pass', username: '${username}', password: '${password}' },
          { id: 'approve', type: 'detect_success', successIndicators: [{ type: 'selector', value: '.approval-complete' }] }
        ]
      });

      const result = await authManager.executeAuthFlow('oauth_flow', {
        username: 'oauth_user',
        password: 'oauth_pass'
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3);
    });
  });

  describe('Performance', () => {
    test('should complete auth flow within reasonable time', async () => {
      authManager.registerAuthFlow('perf_test', {
        type: 'login-form',
        steps: [
          { id: 'nav', type: 'navigate', url: 'https://example.com/login' },
          { id: 'login', type: 'fill_login_form', usernameSelector: '#user', passwordSelector: '#pass', username: 'test', password: 'test' }
        ]
      });

      const start = Date.now();
      await authManager.executeAuthFlow('perf_test', {});
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing selectors gracefully', async () => {
      const step = {
        type: 'fill_login_form',
        username: 'test',
        password: 'test'
        // No selectors provided
      };

      const result = await authManager.stepFillLoginForm(step, {});
      expect(result.success).toBe(true);
      expect(result.fieldsFilled).toBe(0);
    });

    test('should handle empty context variables', async () => {
      authManager.registerAuthFlow('edge_case_flow', {
        type: 'login-form',
        steps: [
          { id: 'nav', type: 'navigate', url: 'https://example.com/login' },
          { id: 'login', type: 'fill_login_form', usernameSelector: '#user', passwordSelector: '#pass', username: '${username}', password: '${password}' }
        ]
      });

      const result = await authManager.executeAuthFlow('edge_case_flow', {
        username: undefined,
        password: undefined
      });

      expect(result.success).toBe(true); // Should still execute even with empty vars
    });

    test('should generate unique execution IDs', () => {
      const ids = new Set();

      for (let i = 0; i < 10; i++) {
        const id = authManager.generateExecutionId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(10);
    });
  });
});
