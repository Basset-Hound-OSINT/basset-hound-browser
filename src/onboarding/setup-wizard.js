/**
 * Setup Wizard
 *
 * Guided step-by-step setup process for new users, covering account setup,
 * browser configuration, proxy setup, integrations, and dashboard customization.
 */

const EventEmitter = require('events');

class SetupWizard extends EventEmitter {
  constructor(coordinator, options = {}) {
    super();
    this.coordinator = coordinator;
    this.currentStepIndex = 0;
    this.setupConfig = {};
    this.testResults = {};
    this.formValidators = new Map();
    this.setupSteps = this.initializeSteps();
  }

  /**
   * Initialize setup wizard steps
   */
  initializeSteps() {
    return [
      {
        id: 'welcome-setup',
        name: 'Welcome & Account Setup',
        description: 'Create your account and configure basic settings',
        category: 'setup',
        fields: [
          {
            name: 'fullName',
            type: 'text',
            label: 'Full Name',
            required: true,
            placeholder: 'John Doe'
          },
          {
            name: 'companyName',
            type: 'text',
            label: 'Company Name',
            required: false,
            placeholder: 'Your Company'
          },
          {
            name: 'email',
            type: 'email',
            label: 'Email Address',
            required: true,
            placeholder: 'user@company.com'
          },
          {
            name: 'timezone',
            type: 'select',
            label: 'Timezone',
            required: true,
            options: this.getTimezoneOptions()
          },
          {
            name: 'language',
            type: 'select',
            label: 'Language',
            required: true,
            options: [
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
              { value: 'de', label: 'German' }
            ]
          }
        ],
        help: 'Set up your basic user profile and preferences'
      },
      {
        id: 'browser-config',
        name: 'Browser Configuration',
        description: 'Configure browser settings and preferences',
        category: 'configuration',
        fields: [
          {
            name: 'userAgent',
            type: 'select',
            label: 'User Agent Profile',
            required: true,
            options: this.getUserAgentOptions()
          },
          {
            name: 'fingerprinting',
            type: 'checkbox',
            label: 'Enable Fingerprint Spoofing',
            default: true
          },
          {
            name: 'adBlocking',
            type: 'checkbox',
            label: 'Enable Ad Blocking',
            default: true
          },
          {
            name: 'trackerBlocking',
            type: 'checkbox',
            label: 'Block Trackers',
            default: true
          },
          {
            name: 'scriptTimeout',
            type: 'number',
            label: 'Script Timeout (seconds)',
            default: 30,
            min: 5,
            max: 300
          }
        ],
        help: 'Customize browser behavior and evasion settings'
      },
      {
        id: 'proxy-setup',
        name: 'Proxy Setup & Testing',
        description: 'Configure and test proxy connections',
        category: 'network',
        fields: [
          {
            name: 'proxyType',
            type: 'select',
            label: 'Proxy Type',
            required: true,
            options: [
              { value: 'none', label: 'No Proxy' },
              { value: 'http', label: 'HTTP Proxy' },
              { value: 'socks5', label: 'SOCKS5' },
              { value: 'tor', label: 'Tor' },
              { value: 'residential', label: 'Residential Proxy Pool' }
            ]
          },
          {
            name: 'proxyUrl',
            type: 'text',
            label: 'Proxy URL',
            conditional: ['proxyType', 'http', 'socks5'],
            placeholder: 'proxy.example.com:8080'
          },
          {
            name: 'proxyAuth',
            type: 'checkbox',
            label: 'Proxy Requires Authentication',
            conditional: ['proxyType', 'http', 'socks5']
          },
          {
            name: 'testProxy',
            type: 'button',
            label: 'Test Connection',
            action: 'testProxyConnection'
          }
        ],
        help: 'Set up network proxies for privacy and access control'
      },
      {
        id: 'slack-integration',
        name: 'Slack Integration',
        description: 'Connect your Slack workspace for notifications',
        category: 'integration',
        fields: [
          {
            name: 'enableSlack',
            type: 'checkbox',
            label: 'Enable Slack Integration',
            default: false
          },
          {
            name: 'slackWebhook',
            type: 'text',
            label: 'Slack Webhook URL',
            required: true,
            conditional: ['enableSlack', true],
            placeholder: 'https://hooks.slack.com/services/...'
          },
          {
            name: 'slackChannel',
            type: 'text',
            label: 'Default Channel',
            conditional: ['enableSlack', true],
            placeholder: '#monitoring'
          },
          {
            name: 'notificationSettings',
            type: 'multi-checkbox',
            label: 'Notification Types',
            conditional: ['enableSlack', true],
            options: [
              { value: 'alerts', label: 'Price Alerts' },
              { value: 'changes', label: 'Website Changes' },
              { value: 'errors', label: 'System Errors' },
              { value: 'daily', label: 'Daily Digest' }
            ]
          },
          {
            name: 'testSlack',
            type: 'button',
            label: 'Send Test Message',
            action: 'testSlackConnection',
            conditional: ['enableSlack', true]
          }
        ],
        help: 'Set up Slack notifications for your monitors'
      },
      {
        id: 'initial-monitors',
        name: 'Create Initial Monitors',
        description: 'Set up your first monitoring campaigns',
        category: 'monitoring',
        fields: [
          {
            name: 'addMonitors',
            type: 'button',
            label: 'Add Monitor',
            action: 'addMonitor'
          },
          {
            name: 'monitorList',
            type: 'list',
            label: 'Configured Monitors',
            items: []
          },
          {
            name: 'monitoringFrequency',
            type: 'select',
            label: 'Default Check Frequency',
            required: true,
            options: [
              { value: 'hourly', label: 'Every Hour' },
              { value: '4-hourly', label: 'Every 4 Hours' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' }
            ]
          }
        ],
        help: 'Create monitors to track competitors and websites'
      },
      {
        id: 'dashboard-customization',
        name: 'Dashboard Customization',
        description: 'Customize your monitoring dashboard',
        category: 'ui',
        fields: [
          {
            name: 'dashboardLayout',
            type: 'select',
            label: 'Dashboard Layout',
            required: true,
            options: [
              { value: 'grid', label: 'Grid View' },
              { value: 'list', label: 'List View' },
              { value: 'custom', label: 'Custom' }
            ]
          },
          {
            name: 'widgetSelection',
            type: 'multi-checkbox',
            label: 'Dashboard Widgets',
            options: [
              { value: 'summary', label: 'Summary Widget' },
              { value: 'alerts', label: 'Recent Alerts' },
              { value: 'trends', label: 'Trends Chart' },
              { value: 'performance', label: 'Performance Metrics' },
              { value: 'recent', label: 'Recent Changes' }
            ]
          },
          {
            name: 'refreshRate',
            type: 'select',
            label: 'Auto-refresh Rate',
            options: [
              { value: 'manual', label: 'Manual Only' },
              { value: '30s', label: 'Every 30 seconds' },
              { value: '1m', label: 'Every 1 minute' },
              { value: '5m', label: 'Every 5 minutes' }
            ]
          },
          {
            name: 'theme',
            type: 'select',
            label: 'Theme',
            options: [
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'Auto (system)' }
            ]
          }
        ],
        help: 'Personalize your dashboard experience'
      },
      {
        id: 'completion-review',
        name: 'Completion & Review',
        description: 'Review your setup and complete onboarding',
        category: 'completion',
        fields: [
          {
            name: 'reviewSummary',
            type: 'static',
            label: 'Setup Summary',
            display: 'summary'
          },
          {
            name: 'agreeToTerms',
            type: 'checkbox',
            label: 'I agree to the Terms of Service',
            required: true
          },
          {
            name: 'optInCommunications',
            type: 'checkbox',
            label: 'Opt-in to product updates and tips',
            default: true
          },
          {
            name: 'completeSetup',
            type: 'button',
            label: 'Complete Setup',
            action: 'completeSetup'
          }
        ],
        help: 'Review and finalize your setup'
      }
    ];
  }

  /**
   * Register wizard steps with coordinator
   */
  async registerWithCoordinator() {
    for (const step of this.setupSteps) {
      this.coordinator.registerStep(step.id, {
        name: step.name,
        description: step.description,
        category: step.category,
        skippable: false,
        estimatedTime: 10,
        resources: [{ type: 'guide', title: step.help }],
        validation: (results) => this.validateStepData(step.id, results)
      });
    }
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    return this.setupSteps[this.currentStepIndex];
  }

  /**
   * Get next step
   */
  getNextStep() {
    if (this.currentStepIndex < this.setupSteps.length - 1) {
      return this.setupSteps[this.currentStepIndex + 1];
    }
    return null;
  }

  /**
   * Get previous step
   */
  getPreviousStep() {
    if (this.currentStepIndex > 0) {
      return this.setupSteps[this.currentStepIndex - 1];
    }
    return null;
  }

  /**
   * Get progress
   */
  getProgress() {
    return {
      current: this.currentStepIndex + 1,
      total: this.setupSteps.length,
      percentage: Math.round(((this.currentStepIndex + 1) / this.setupSteps.length) * 100),
      stepName: this.getCurrentStep().name
    };
  }

  /**
   * Move to next step
   */
  async nextStep() {
    const currentStep = this.getCurrentStep();

    // Validate current step before advancing
    const validation = await this.validateStepData(currentStep.id, this.setupConfig[currentStep.id] || {});
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    if (this.currentStepIndex < this.setupSteps.length - 1) {
      this.currentStepIndex++;
      this.emit('step-changed', { step: this.getCurrentStep(), progress: this.getProgress() });
      return { success: true, step: this.getCurrentStep() };
    }

    return { success: false, reason: 'No more steps' };
  }

  /**
   * Move to previous step
   */
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.emit('step-changed', { step: this.getCurrentStep(), progress: this.getProgress() });
      return { success: true, step: this.getCurrentStep() };
    }
    return { success: false, reason: 'Already on first step' };
  }

  /**
   * Jump to specific step
   */
  jumpToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.setupSteps.length) {
      this.currentStepIndex = stepIndex;
      this.emit('step-changed', { step: this.getCurrentStep(), progress: this.getProgress() });
      return { success: true, step: this.getCurrentStep() };
    }
    return { success: false, reason: 'Invalid step index' };
  }

  /**
   * Save step data
   */
  async saveStepData(stepId, data) {
    const step = this.setupSteps.find(s => s.id === stepId);
    if (!step) {
      return { success: false, reason: 'Step not found' };
    }

    const validation = await this.validateStepData(stepId, data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.setupConfig[stepId] = data;
    this.emit('step-data-saved', { stepId, data });
    return { success: true };
  }

  /**
   * Validate step data
   */
  async validateStepData(stepId, data) {
    const step = this.setupSteps.find(s => s.id === stepId);
    if (!step) {
      return { valid: false, errors: ['Step not found'] };
    }

    const errors = [];

    for (const field of step.fields) {
      if (field.type === 'button' || field.type === 'static') continue;

      // Check conditional visibility
      if (field.conditional) {
        const [condField, condValue] = field.conditional;
        if (data[condField] !== condValue) {
          continue; // Field not visible, skip validation
        }
      }

      // Check required fields
      if (field.required && !data[field.name]) {
        errors.push(`${field.label} is required`);
      }

      // Type-specific validation
      if (field.type === 'email' && data[field.name]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[field.name])) {
          errors.push(`${field.label} must be a valid email`);
        }
      }

      if (field.type === 'number' && data[field.name]) {
        const num = parseFloat(data[field.name]);
        if (isNaN(num)) {
          errors.push(`${field.label} must be a number`);
        } else if (field.min && num < field.min) {
          errors.push(`${field.label} must be at least ${field.min}`);
        } else if (field.max && num > field.max) {
          errors.push(`${field.label} must be at most ${field.max}`);
        }
      }

      // Custom validators
      if (this.formValidators.has(field.name)) {
        const customValidator = this.formValidators.get(field.name);
        const result = await customValidator(data[field.name]);
        if (!result.valid) {
          errors.push(result.error);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Register custom field validator
   */
  registerFieldValidator(fieldName, validatorFn) {
    this.formValidators.set(fieldName, validatorFn);
    return this;
  }

  /**
   * Test proxy connection
   */
  async testProxyConnection(proxyConfig) {
    try {
      // Simulate proxy test
      const testUrl = 'https://api.ipify.org?format=json';
      const timeout = 10000;

      this.testResults['proxy'] = {
        status: 'connected',
        ip: '192.0.2.1',
        location: 'Unknown',
        latency: 45,
        timestamp: new Date().toISOString()
      };

      this.emit('proxy-tested', this.testResults['proxy']);
      return { success: true, result: this.testResults['proxy'] };
    } catch (error) {
      this.testResults['proxy'] = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      return { success: false, error: error.message };
    }
  }

  /**
   * Test Slack connection
   */
  async testSlackConnection(slackConfig) {
    try {
      // Simulate Slack test message
      const message = {
        text: `Setup Wizard Test: Connected at ${new Date().toISOString()}`,
        channel: slackConfig.channel || '#monitoring'
      };

      this.testResults['slack'] = {
        status: 'success',
        message: 'Test message sent',
        timestamp: new Date().toISOString()
      };

      this.emit('slack-tested', this.testResults['slack']);
      return { success: true, result: this.testResults['slack'] };
    } catch (error) {
      this.testResults['slack'] = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      return { success: false, error: error.message };
    }
  }

  /**
   * Add monitor configuration
   */
  addMonitor(monitorConfig) {
    if (!this.setupConfig['initial-monitors']) {
      this.setupConfig['initial-monitors'] = { monitors: [] };
    }

    const monitors = this.setupConfig['initial-monitors'].monitors || [];
    monitors.push({
      id: `monitor-${Date.now()}`,
      ...monitorConfig,
      createdAt: new Date().toISOString()
    });

    this.setupConfig['initial-monitors'].monitors = monitors;
    this.emit('monitor-added', monitorConfig);
    return { success: true, monitor: monitors[monitors.length - 1] };
  }

  /**
   * Remove monitor configuration
   */
  removeMonitor(monitorId) {
    if (this.setupConfig['initial-monitors']) {
      const monitors = this.setupConfig['initial-monitors'].monitors || [];
      const index = monitors.findIndex(m => m.id === monitorId);
      if (index >= 0) {
        monitors.splice(index, 1);
        this.emit('monitor-removed', { monitorId });
        return { success: true };
      }
    }
    return { success: false, reason: 'Monitor not found' };
  }

  /**
   * Get setup configuration summary
   */
  getConfigurationSummary() {
    const summary = {};

    for (const [stepId, config] of Object.entries(this.setupConfig)) {
      const step = this.setupSteps.find(s => s.id === stepId);
      if (step) {
        summary[step.name] = config;
      }
    }

    return summary;
  }

  /**
   * Complete setup wizard
   */
  async completeSetup() {
    // Validate all steps
    const allValid = await Promise.all(
      this.setupSteps.map(step => this.validateStepData(step.id, this.setupConfig[step.id] || {}))
    );

    if (allValid.some(v => !v.valid)) {
      return {
        success: false,
        reason: 'Some steps have validation errors'
      };
    }

    const completionData = {
      setupConfig: this.setupConfig,
      summary: this.getConfigurationSummary(),
      testResults: this.testResults,
      completedAt: new Date().toISOString()
    };

    this.emit('setup-completed', completionData);
    return { success: true, data: completionData };
  }

  /**
   * Get timezone options
   */
  getTimezoneOptions() {
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time' },
      { value: 'America/Chicago', label: 'Central Time' },
      { value: 'America/Denver', label: 'Mountain Time' },
      { value: 'America/Los_Angeles', label: 'Pacific Time' },
      { value: 'Europe/London', label: 'GMT' },
      { value: 'Europe/Paris', label: 'CET' },
      { value: 'Asia/Tokyo', label: 'JST' },
      { value: 'Asia/Shanghai', label: 'CST' },
      { value: 'Australia/Sydney', label: 'AEST' }
    ];
  }

  /**
   * Get user agent options
   */
  getUserAgentOptions() {
    return [
      { value: 'chrome-windows', label: 'Chrome on Windows' },
      { value: 'chrome-macos', label: 'Chrome on macOS' },
      { value: 'firefox-windows', label: 'Firefox on Windows' },
      { value: 'safari-macos', label: 'Safari on macOS' },
      { value: 'mobile-ios', label: 'Mobile iOS' },
      { value: 'mobile-android', label: 'Mobile Android' },
      { value: 'random', label: 'Random Rotation' }
    ];
  }
}

module.exports = SetupWizard;
