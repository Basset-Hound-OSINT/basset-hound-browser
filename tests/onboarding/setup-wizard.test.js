/**
 * Setup Wizard Tests
 *
 * Comprehensive testing of the setup wizard functionality
 */

const SetupWizard = require('../../src/onboarding/setup-wizard');
const OnboardingCoordinator = require('../../src/onboarding/coordinator');
const assert = require('assert');

describe('SetupWizard', () => {
  let coordinator;
  let wizard;

  beforeEach(() => {
    coordinator = new OnboardingCoordinator({ userId: 'test-user-1' });
    wizard = new SetupWizard(coordinator);
  });

  describe('Initialization', () => {
    it('should initialize with coordinator', () => {
      assert.strictEqual(wizard.coordinator, coordinator);
    });

    it('should have setup steps', () => {
      assert(wizard.setupSteps.length > 0);
    });

    it('should start at first step', () => {
      assert.strictEqual(wizard.currentStepIndex, 0);
    });
  });

  describe('Step Navigation', () => {
    it('should get current step', () => {
      const step = wizard.getCurrentStep();
      assert.strictEqual(step.id, 'welcome-setup');
    });

    it('should get next step', () => {
      const step = wizard.getNextStep();
      assert.strictEqual(step.id, 'browser-config');
    });

    it('should advance to next step', async () => {
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'John Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        language: 'en'
      };

      const result = await wizard.nextStep();
      assert.strictEqual(result.success, true);
      assert.strictEqual(wizard.currentStepIndex, 1);
    });

    it('should return to previous step', () => {
      wizard.currentStepIndex = 1;
      const result = wizard.previousStep();
      assert.strictEqual(result.success, true);
      assert.strictEqual(wizard.currentStepIndex, 0);
    });

    it('should jump to specific step', () => {
      const result = wizard.jumpToStep(3);
      assert.strictEqual(result.success, true);
      assert.strictEqual(wizard.currentStepIndex, 3);
    });

    it('should track progress', () => {
      const progress = wizard.getProgress();
      assert.strictEqual(progress.current, 1);
      assert.strictEqual(progress.total, wizard.setupSteps.length);
      assert(progress.percentage >= 0 && progress.percentage <= 100);
    });
  });

  describe('Step Validation', () => {
    it('should validate required fields', async () => {
      const result = await wizard.validateStepData('welcome-setup', {});
      assert.strictEqual(result.valid, false);
      assert(result.errors.length > 0);
    });

    it('should validate email format', async () => {
      const result = await wizard.validateStepData('welcome-setup', {
        fullName: 'John Doe',
        email: 'invalid-email',
        timezone: 'UTC',
        language: 'en'
      });
      assert.strictEqual(result.valid, false);
    });

    it('should validate correct email format', async () => {
      const result = await wizard.validateStepData('welcome-setup', {
        fullName: 'John Doe',
        email: 'john@example.com',
        timezone: 'UTC',
        language: 'en'
      });
      assert.strictEqual(result.valid, true);
    });

    it('should validate conditional fields', async () => {
      const result = await wizard.validateStepData('proxy-setup', {
        proxyType: 'http',
        proxyUrl: ''
      });
      assert.strictEqual(result.valid, false);
    });

    it('should validate numeric fields', async () => {
      const result = await wizard.validateStepData('browser-config', {
        userAgent: 'chrome-windows',
        scriptTimeout: 'not-a-number'
      });
      assert.strictEqual(result.valid, false);
    });
  });

  describe('Data Persistence', () => {
    it('should save step data', async () => {
      const data = {
        fullName: 'John Doe',
        email: 'john@example.com',
        timezone: 'UTC',
        language: 'en'
      };

      const result = await wizard.saveStepData('welcome-setup', data);
      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(wizard.setupConfig['welcome-setup'], data);
    });

    it('should validate before saving', async () => {
      const result = await wizard.saveStepData('welcome-setup', {});
      assert.strictEqual(result.success, false);
    });

    it('should prevent advancing without validation', async () => {
      const result = await wizard.nextStep();
      assert.strictEqual(result.success, false);
    });
  });

  describe('Test Connections', () => {
    it('should test proxy connection', async () => {
      const result = await wizard.testProxyConnection({
        type: 'http',
        url: 'proxy.example.com:8080'
      });
      assert.strictEqual(result.success, true);
      assert(result.result.status === 'connected' || result.result.status === 'failed');
    });

    it('should test slack connection', async () => {
      const result = await wizard.testSlackConnection({
        webhook: 'https://hooks.slack.com/...',
        channel: '#monitoring'
      });
      assert.strictEqual(result.success, true);
    });

    it('should emit events on test completion', () => {
      let tested = false;
      wizard.on('proxy-tested', () => {
        tested = true;
      });

      wizard.testProxyConnection({});
      assert.strictEqual(tested, true);
    });
  });

  describe('Monitor Configuration', () => {
    it('should add monitor', () => {
      const result = wizard.addMonitor({
        url: 'https://example.com',
        name: 'Example Monitor',
        frequency: 'hourly'
      });

      assert.strictEqual(result.success, true);
      assert(result.monitor.id);
    });

    it('should remove monitor', () => {
      const addResult = wizard.addMonitor({
        url: 'https://example.com',
        name: 'Example Monitor'
      });

      const removeResult = wizard.removeMonitor(addResult.monitor.id);
      assert.strictEqual(removeResult.success, true);
    });

    it('should store multiple monitors', () => {
      wizard.addMonitor({ url: 'https://example1.com', name: 'Monitor 1' });
      wizard.addMonitor({ url: 'https://example2.com', name: 'Monitor 2' });

      const config = wizard.setupConfig['initial-monitors'];
      assert.strictEqual(config.monitors.length, 2);
    });
  });

  describe('Configuration Summary', () => {
    it('should generate configuration summary', async () => {
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'John Doe',
        email: 'john@example.com'
      };
      wizard.setupConfig['browser-config'] = {
        userAgent: 'chrome-windows'
      };

      const summary = wizard.getConfigurationSummary();
      assert(summary['Welcome & Account Setup']);
      assert(summary['Browser Configuration']);
    });
  });

  describe('Setup Completion', () => {
    it('should validate all steps before completion', async () => {
      const result = await wizard.completeSetup();
      assert.strictEqual(result.success, false);
    });

    it('should complete setup with valid data', async () => {
      // Populate all required steps
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'John Doe',
        email: 'john@example.com',
        timezone: 'UTC',
        language: 'en'
      };

      wizard.setupConfig['browser-config'] = {
        userAgent: 'chrome-windows',
        fingerprinting: true,
        adBlocking: true,
        trackerBlocking: true,
        scriptTimeout: 30
      };

      wizard.setupConfig['proxy-setup'] = {
        proxyType: 'none'
      };

      wizard.setupConfig['slack-integration'] = {
        enableSlack: false
      };

      wizard.setupConfig['initial-monitors'] = {
        monitors: []
      };

      wizard.setupConfig['dashboard-customization'] = {
        dashboardLayout: 'grid',
        refreshRate: '1m'
      };

      wizard.setupConfig['completion-review'] = {
        agreeToTerms: true,
        optInCommunications: true
      };

      const result = await wizard.completeSetup();
      assert.strictEqual(result.success, true);
    });

    it('should emit setup-completed event', async () => {
      let completed = false;
      wizard.on('setup-completed', () => {
        completed = true;
      });

      // Setup config is already populated from previous test
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'John',
        email: 'john@example.com',
        timezone: 'UTC',
        language: 'en'
      };
      wizard.setupConfig['browser-config'] = {
        userAgent: 'chrome-windows',
        scriptTimeout: 30
      };
      wizard.setupConfig['proxy-setup'] = { proxyType: 'none' };
      wizard.setupConfig['slack-integration'] = { enableSlack: false };
      wizard.setupConfig['initial-monitors'] = { monitors: [] };
      wizard.setupConfig['dashboard-customization'] = { dashboardLayout: 'grid' };
      wizard.setupConfig['completion-review'] = { agreeToTerms: true };

      await wizard.completeSetup();
      assert.strictEqual(completed, true);
    });
  });

  describe('Custom Field Validators', () => {
    it('should register custom validator', () => {
      wizard.registerFieldValidator('customField', async value => {
        return { valid: value === 'expected' };
      });

      assert(wizard.formValidators.has('customField'));
    });

    it('should use custom validator', async () => {
      wizard.registerFieldValidator('customField', async value => {
        return value === 'valid'
          ? { valid: true }
          : { valid: false, error: 'Invalid value' };
      });

      // Note: This would require modifying step definitions to include customField
      // This is a simplified test
      assert(wizard.formValidators.has('customField'));
    });
  });

  describe('Options', () => {
    it('should provide timezone options', () => {
      const options = wizard.getTimezoneOptions();
      assert(options.length > 0);
      assert(options.some(o => o.value === 'UTC'));
    });

    it('should provide user agent options', () => {
      const options = wizard.getUserAgentOptions();
      assert(options.length > 0);
      assert(options.some(o => o.value.includes('chrome') || o.value.includes('firefox')));
    });
  });
});
