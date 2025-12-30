/**
 * Form Filling Test Scenarios
 *
 * Tests form automation flows between extension and browser.
 */

const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8769;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Form state tracking
const formState = {
  detectedForms: [],
  filledFields: [],
  validationErrors: [],
  submissions: []
};

/**
 * Test utilities
 */
const testUtils = {
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Setup form-related handlers
 */
function setupFormHandlers() {
  // Detect forms on page
  server.registerHandler('detect_forms', async (params) => {
    // Return mock detected forms
    const forms = [
      {
        id: 'login-form',
        action: '/api/login',
        method: 'POST',
        fields: [
          { name: 'username', type: 'text', required: true },
          { name: 'password', type: 'password', required: true },
          { name: 'remember', type: 'checkbox', required: false }
        ]
      },
      {
        id: 'contact-form',
        action: '/api/contact',
        method: 'POST',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          { name: 'message', type: 'textarea', required: true }
        ]
      }
    ];

    formState.detectedForms = forms;
    return { success: true, forms };
  });

  // Fill form fields
  server.registerHandler('fill_form', async (params) => {
    const { fields, submit } = params;
    const filled = [];

    for (const [selector, value] of Object.entries(fields)) {
      filled.push({ selector, value, filledAt: Date.now() });
      formState.filledFields.push({ selector, value });
    }

    if (submit) {
      formState.submissions.push({
        fields: { ...fields },
        submittedAt: Date.now()
      });
    }

    return { success: true, filled: Object.keys(fields), submitted: submit };
  });

  // Auto-fill form
  server.registerHandler('auto_fill_form', async (params) => {
    const { formSelector, data, options = {} } = params;
    const filled = [];

    for (const [key, value] of Object.entries(data)) {
      filled.push({ key, value });
      formState.filledFields.push({ selector: `[name="${key}"]`, value });
    }

    return {
      success: true,
      formSelector,
      filledCount: filled.length,
      filled
    };
  });

  // Submit form
  server.registerHandler('submit_form', async (params) => {
    const { formSelector, options = {} } = params;

    formState.submissions.push({
      formSelector,
      submittedAt: Date.now(),
      method: options.clickSubmit ? 'click' : 'submit'
    });

    return {
      success: true,
      formSelector,
      submitted: true,
      navigationOccurred: options.waitForNavigation !== false
    };
  });

  // Get form validation
  server.registerHandler('get_form_validation', async (params) => {
    const { formSelector } = params;

    // Return mock validation status
    return {
      success: true,
      formSelector,
      isValid: formState.validationErrors.length === 0,
      errors: formState.validationErrors
    };
  });

  // Fill select
  server.registerHandler('fill_select', async (params) => {
    const { selector, value, options = {} } = params;
    formState.filledFields.push({ selector, value, type: 'select' });
    return { success: true, selector, selectedValue: value };
  });

  // Fill checkbox
  server.registerHandler('fill_checkbox', async (params) => {
    const { selector, checked } = params;
    formState.filledFields.push({ selector, checked, type: 'checkbox' });
    return { success: true, selector, checked };
  });

  // Fill radio
  server.registerHandler('fill_radio', async (params) => {
    const { name, value } = params;
    formState.filledFields.push({ name, value, type: 'radio' });
    return { success: true, name, selectedValue: value };
  });

  // Fill date
  server.registerHandler('fill_date', async (params) => {
    const { selector, date } = params;
    formState.filledFields.push({ selector, date, type: 'date' });
    return { success: true, selector, date };
  });

  // Navigate multi-step form
  server.registerHandler('navigate_multi_step', async (params) => {
    const { formSelector, direction } = params;
    return {
      success: true,
      formSelector,
      direction,
      currentStep: direction === 'next' ? 2 : 0,
      totalSteps: 3
    };
  });

  // Get multi-step info
  server.registerHandler('get_multi_step_info', async (params) => {
    return {
      success: true,
      isMultiStep: true,
      currentStep: 1,
      totalSteps: 3,
      stepLabels: ['Personal Info', 'Contact', 'Confirmation']
    };
  });
}

describe('Form Filling Test Scenarios', () => {
  beforeAll(async () => {
    // Reset form state
    formState.detectedForms = [];
    formState.filledFields = [];
    formState.validationErrors = [];
    formState.submissions = [];

    server = new TestServer({ port: TEST_PORT });
    setupFormHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  });

  afterAll(async () => {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  });

  beforeEach(() => {
    // Reset form state between tests
    formState.detectedForms = [];
    formState.filledFields = [];
    formState.validationErrors = [];
    formState.submissions = [];
  });

  describe('Form Detection', () => {
    test('should detect forms on page', async () => {
      const response = await extension.sendCommand('detect_forms', {});

      expect(response.success).toBe(true);
      expect(response.result.forms.length).toBe(2);
    });

    test('should find login form with fields', async () => {
      const response = await extension.sendCommand('detect_forms', {});

      const loginForm = response.result.forms.find(f => f.id === 'login-form');
      expect(loginForm).toBeTruthy();
      expect(loginForm.fields.length).toBe(3);
    });

    test('should find contact form', async () => {
      const response = await extension.sendCommand('detect_forms', {});

      const contactForm = response.result.forms.find(f => f.id === 'contact-form');
      expect(contactForm).toBeTruthy();
    });
  });

  describe('Basic Form Filling', () => {
    test('should fill form fields', async () => {
      const fields = {
        '#username': 'testuser',
        '#password': 'testpass123',
        '#email': 'test@example.com'
      };

      const response = await extension.sendCommand('fill_form', { fields, submit: false });

      expect(response.success).toBe(true);
      expect(response.result.filled.length).toBe(3);
      expect(response.result.submitted).toBe(false);
    });

    test('should track filled fields in state', async () => {
      const fields = {
        '#username': 'testuser',
        '#password': 'testpass123',
        '#email': 'test@example.com'
      };

      await extension.sendCommand('fill_form', { fields, submit: false });
      expect(formState.filledFields.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Form Fill with Submit', () => {
    test('should fill and submit form', async () => {
      const initialSubmissions = formState.submissions.length;

      const fields = {
        '#login-username': 'admin',
        '#login-password': 'admin123'
      };

      const response = await extension.sendCommand('fill_form', { fields, submit: true });

      expect(response.success).toBe(true);
      expect(response.result.submitted).toBe(true);
    });

    test('should record submission in state', async () => {
      const initialSubmissions = formState.submissions.length;

      const fields = {
        '#login-username': 'admin',
        '#login-password': 'admin123'
      };

      await extension.sendCommand('fill_form', { fields, submit: true });
      expect(formState.submissions.length).toBeGreaterThan(initialSubmissions);
    });
  });

  describe('Auto-Fill with Template Data', () => {
    test('should auto-fill form with template data', async () => {
      const templateData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      };

      const response = await extension.sendCommand('auto_fill_form', {
        formSelector: '#registration-form',
        data: templateData,
        options: { humanLike: true }
      });

      expect(response.success).toBe(true);
      expect(response.result.filledCount).toBe(Object.keys(templateData).length);
    });
  });

  describe('Select Dropdown Filling', () => {
    test('should fill select by value', async () => {
      const byValue = await extension.sendCommand('fill_select', {
        selector: '#country',
        value: 'US'
      });
      expect(byValue.success).toBe(true);
      expect(byValue.result.selectedValue).toBe('US');
    });

    test('should fill select by text', async () => {
      const byText = await extension.sendCommand('fill_select', {
        selector: '#state',
        value: 'California',
        options: { byText: true }
      });
      expect(byText.success).toBe(true);
    });
  });

  describe('Checkbox and Radio Filling', () => {
    test('should check a checkbox', async () => {
      const checkResponse = await extension.sendCommand('fill_checkbox', {
        selector: '#terms-agree',
        checked: true
      });
      expect(checkResponse.success).toBe(true);
      expect(checkResponse.result.checked).toBe(true);
    });

    test('should uncheck a checkbox', async () => {
      const uncheckResponse = await extension.sendCommand('fill_checkbox', {
        selector: '#newsletter',
        checked: false
      });
      expect(uncheckResponse.success).toBe(true);
    });

    test('should select a radio option', async () => {
      const radioResponse = await extension.sendCommand('fill_radio', {
        name: 'payment-method',
        value: 'credit-card'
      });
      expect(radioResponse.success).toBe(true);
      expect(radioResponse.result.selectedValue).toBe('credit-card');
    });
  });

  describe('Date Input Filling', () => {
    test('should fill date input', async () => {
      const date = '2024-01-15';
      const response = await extension.sendCommand('fill_date', {
        selector: '#birthdate',
        date
      });

      expect(response.success).toBe(true);
      expect(response.result.date).toBe(date);
    });

    test('should track date field in state', async () => {
      const date = '2024-01-15';
      await extension.sendCommand('fill_date', {
        selector: '#birthdate',
        date
      });

      const dateField = formState.filledFields.find(f => f.type === 'date');
      expect(dateField).toBeTruthy();
      expect(dateField.date).toBe(date);
    });
  });

  describe('Form Submission', () => {
    test('should submit by clicking button', async () => {
      const initialSubmissions = formState.submissions.length;

      const clickSubmit = await extension.sendCommand('submit_form', {
        formSelector: '#login-form',
        options: { clickSubmit: true, waitForNavigation: true }
      });
      expect(clickSubmit.success).toBe(true);
      expect(clickSubmit.result.submitted).toBe(true);
    });

    test('should submit programmatically', async () => {
      const programSubmit = await extension.sendCommand('submit_form', {
        formSelector: '#contact-form',
        options: { clickSubmit: false }
      });
      expect(programSubmit.success).toBe(true);
    });

    test('should track both submissions', async () => {
      const initialSubmissions = formState.submissions.length;

      await extension.sendCommand('submit_form', {
        formSelector: '#login-form',
        options: { clickSubmit: true }
      });
      await extension.sendCommand('submit_form', {
        formSelector: '#contact-form',
        options: { clickSubmit: false }
      });

      expect(formState.submissions.length).toBe(initialSubmissions + 2);
    });
  });

  describe('Form Validation', () => {
    test('should report valid form', async () => {
      const validResponse = await extension.sendCommand('get_form_validation', {
        formSelector: '#login-form'
      });
      expect(validResponse.success).toBe(true);
      expect(validResponse.result.isValid).toBe(true);
    });

    test('should detect validation errors', async () => {
      // Add validation errors
      formState.validationErrors.push({
        field: 'email',
        message: 'Invalid email format'
      });

      const invalidResponse = await extension.sendCommand('get_form_validation', {
        formSelector: '#contact-form'
      });
      expect(invalidResponse.success).toBe(true);
      expect(invalidResponse.result.isValid).toBe(false);
      expect(invalidResponse.result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Step Form Navigation', () => {
    test('should detect multi-step form', async () => {
      const infoResponse = await extension.sendCommand('get_multi_step_info', {
        formSelector: '#multi-step-form'
      });
      expect(infoResponse.success).toBe(true);
      expect(infoResponse.result.isMultiStep).toBe(true);
      expect(infoResponse.result.totalSteps).toBe(3);
    });

    test('should navigate to next step', async () => {
      const nextResponse = await extension.sendCommand('navigate_multi_step', {
        formSelector: '#multi-step-form',
        direction: 'next'
      });
      expect(nextResponse.success).toBe(true);
      expect(nextResponse.result.currentStep).toBe(2);
    });

    test('should navigate to previous step', async () => {
      const prevResponse = await extension.sendCommand('navigate_multi_step', {
        formSelector: '#multi-step-form',
        direction: 'prev'
      });
      expect(prevResponse.success).toBe(true);
    });
  });

  describe('Complete Form Flow', () => {
    test('should complete full form workflow', async () => {
      // Reset validation errors
      formState.validationErrors = [];

      // 1. Detect forms
      const detectResponse = await extension.sendCommand('detect_forms', {});
      expect(detectResponse.success).toBe(true);

      // 2. Auto-fill form
      const fillResponse = await extension.sendCommand('auto_fill_form', {
        formSelector: '#login-form',
        data: {
          username: 'flowtest',
          password: 'flowpass123'
        }
      });
      expect(fillResponse.success).toBe(true);

      // 3. Check validation
      const validateResponse = await extension.sendCommand('get_form_validation', {
        formSelector: '#login-form'
      });
      expect(validateResponse.success).toBe(true);

      // 4. Submit form
      const submitResponse = await extension.sendCommand('submit_form', {
        formSelector: '#login-form',
        options: { clickSubmit: true }
      });
      expect(submitResponse.success).toBe(true);
    });
  });
});

// Export for external use
module.exports = { testUtils };
