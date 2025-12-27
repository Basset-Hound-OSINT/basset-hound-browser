/**
 * Form Filling Test Scenarios
 *
 * Tests form automation flows between extension and browser.
 */

const assert = require('assert');
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
  async setup() {
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
  },

  async teardown() {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  },

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

/**
 * Test Suite: Form Detection
 */
async function testFormDetection() {
  console.log('\n--- Test: Form Detection ---');

  const response = await extension.sendCommand('detect_forms', {});

  assert(response.success, 'Form detection should succeed');
  assert(response.result.forms.length === 2, 'Should detect 2 forms');

  const loginForm = response.result.forms.find(f => f.id === 'login-form');
  assert(loginForm, 'Should find login form');
  assert(loginForm.fields.length === 3, 'Login form should have 3 fields');
  console.log('  Detected login form with fields');

  const contactForm = response.result.forms.find(f => f.id === 'contact-form');
  assert(contactForm, 'Should find contact form');
  console.log('  Detected contact form');

  console.log('PASSED: Form Detection');
  return true;
}

/**
 * Test Suite: Basic Form Filling
 */
async function testBasicFormFilling() {
  console.log('\n--- Test: Basic Form Filling ---');

  const fields = {
    '#username': 'testuser',
    '#password': 'testpass123',
    '#email': 'test@example.com'
  };

  const response = await extension.sendCommand('fill_form', { fields, submit: false });

  assert(response.success, 'Form filling should succeed');
  assert(response.result.filled.length === 3, 'All fields should be filled');
  assert(!response.result.submitted, 'Form should not be submitted');
  console.log('  Filled 3 fields successfully');

  // Verify fields were tracked
  assert(formState.filledFields.length >= 3, 'Fields should be tracked');
  console.log('  Field fills tracked in state');

  console.log('PASSED: Basic Form Filling');
  return true;
}

/**
 * Test Suite: Form Fill with Submit
 */
async function testFormFillWithSubmit() {
  console.log('\n--- Test: Form Fill with Submit ---');

  const initialSubmissions = formState.submissions.length;

  const fields = {
    '#login-username': 'admin',
    '#login-password': 'admin123'
  };

  const response = await extension.sendCommand('fill_form', { fields, submit: true });

  assert(response.success, 'Form filling should succeed');
  assert(response.result.submitted, 'Form should be submitted');
  console.log('  Form filled and submitted');

  assert(formState.submissions.length > initialSubmissions, 'Submission should be recorded');
  console.log('  Submission recorded in state');

  console.log('PASSED: Form Fill with Submit');
  return true;
}

/**
 * Test Suite: Auto-Fill with Template Data
 */
async function testAutoFillWithTemplate() {
  console.log('\n--- Test: Auto-Fill with Template Data ---');

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

  assert(response.success, 'Auto-fill should succeed');
  assert(response.result.filledCount === Object.keys(templateData).length, 'All template fields should be filled');
  console.log(`  Auto-filled ${response.result.filledCount} fields`);

  console.log('PASSED: Auto-Fill with Template Data');
  return true;
}

/**
 * Test Suite: Select Dropdown Filling
 */
async function testSelectFilling() {
  console.log('\n--- Test: Select Dropdown Filling ---');

  // Fill by value
  const byValue = await extension.sendCommand('fill_select', {
    selector: '#country',
    value: 'US'
  });
  assert(byValue.success, 'Select by value should succeed');
  assert(byValue.result.selectedValue === 'US', 'Value should match');
  console.log('  Selected by value');

  // Fill by text
  const byText = await extension.sendCommand('fill_select', {
    selector: '#state',
    value: 'California',
    options: { byText: true }
  });
  assert(byText.success, 'Select by text should succeed');
  console.log('  Selected by text');

  console.log('PASSED: Select Dropdown Filling');
  return true;
}

/**
 * Test Suite: Checkbox and Radio Filling
 */
async function testCheckboxRadioFilling() {
  console.log('\n--- Test: Checkbox and Radio Filling ---');

  // Check a checkbox
  const checkResponse = await extension.sendCommand('fill_checkbox', {
    selector: '#terms-agree',
    checked: true
  });
  assert(checkResponse.success, 'Checkbox fill should succeed');
  assert(checkResponse.result.checked === true, 'Checkbox should be checked');
  console.log('  Checked checkbox');

  // Uncheck a checkbox
  const uncheckResponse = await extension.sendCommand('fill_checkbox', {
    selector: '#newsletter',
    checked: false
  });
  assert(uncheckResponse.success, 'Checkbox uncheck should succeed');
  console.log('  Unchecked checkbox');

  // Select a radio option
  const radioResponse = await extension.sendCommand('fill_radio', {
    name: 'payment-method',
    value: 'credit-card'
  });
  assert(radioResponse.success, 'Radio fill should succeed');
  assert(radioResponse.result.selectedValue === 'credit-card', 'Radio value should match');
  console.log('  Selected radio option');

  console.log('PASSED: Checkbox and Radio Filling');
  return true;
}

/**
 * Test Suite: Date Input Filling
 */
async function testDateFilling() {
  console.log('\n--- Test: Date Input Filling ---');

  const date = '2024-01-15';
  const response = await extension.sendCommand('fill_date', {
    selector: '#birthdate',
    date
  });

  assert(response.success, 'Date fill should succeed');
  assert(response.result.date === date, 'Date should match');
  console.log('  Filled date input');

  // Verify date was tracked
  const dateField = formState.filledFields.find(f => f.type === 'date');
  assert(dateField, 'Date field should be tracked');
  assert(dateField.date === date, 'Tracked date should match');
  console.log('  Date fill tracked in state');

  console.log('PASSED: Date Input Filling');
  return true;
}

/**
 * Test Suite: Form Submission
 */
async function testFormSubmission() {
  console.log('\n--- Test: Form Submission ---');

  const initialSubmissions = formState.submissions.length;

  // Submit by clicking button
  const clickSubmit = await extension.sendCommand('submit_form', {
    formSelector: '#login-form',
    options: { clickSubmit: true, waitForNavigation: true }
  });
  assert(clickSubmit.success, 'Click submit should succeed');
  assert(clickSubmit.result.submitted, 'Form should be submitted');
  console.log('  Submitted by clicking button');

  // Submit programmatically
  const programSubmit = await extension.sendCommand('submit_form', {
    formSelector: '#contact-form',
    options: { clickSubmit: false }
  });
  assert(programSubmit.success, 'Programmatic submit should succeed');
  console.log('  Submitted programmatically');

  assert(formState.submissions.length === initialSubmissions + 2, 'Both submissions should be tracked');

  console.log('PASSED: Form Submission');
  return true;
}

/**
 * Test Suite: Form Validation
 */
async function testFormValidation() {
  console.log('\n--- Test: Form Validation ---');

  // Check validation with no errors
  const validResponse = await extension.sendCommand('get_form_validation', {
    formSelector: '#login-form'
  });
  assert(validResponse.success, 'Get validation should succeed');
  assert(validResponse.result.isValid, 'Form should be valid');
  console.log('  Form validation passed');

  // Add validation errors and check again
  formState.validationErrors.push({
    field: 'email',
    message: 'Invalid email format'
  });

  const invalidResponse = await extension.sendCommand('get_form_validation', {
    formSelector: '#contact-form'
  });
  assert(invalidResponse.success, 'Get validation should succeed');
  assert(!invalidResponse.result.isValid, 'Form should be invalid');
  assert(invalidResponse.result.errors.length > 0, 'Should have errors');
  console.log('  Form validation detected errors');

  // Reset for other tests
  formState.validationErrors = [];

  console.log('PASSED: Form Validation');
  return true;
}

/**
 * Test Suite: Multi-Step Form Navigation
 */
async function testMultiStepFormNavigation() {
  console.log('\n--- Test: Multi-Step Form Navigation ---');

  // Get multi-step info
  const infoResponse = await extension.sendCommand('get_multi_step_info', {
    formSelector: '#multi-step-form'
  });
  assert(infoResponse.success, 'Get multi-step info should succeed');
  assert(infoResponse.result.isMultiStep, 'Should be multi-step form');
  assert(infoResponse.result.totalSteps === 3, 'Should have 3 steps');
  console.log('  Detected multi-step form with 3 steps');

  // Navigate next
  const nextResponse = await extension.sendCommand('navigate_multi_step', {
    formSelector: '#multi-step-form',
    direction: 'next'
  });
  assert(nextResponse.success, 'Navigate next should succeed');
  assert(nextResponse.result.currentStep === 2, 'Should be on step 2');
  console.log('  Navigated to next step');

  // Navigate previous
  const prevResponse = await extension.sendCommand('navigate_multi_step', {
    formSelector: '#multi-step-form',
    direction: 'prev'
  });
  assert(prevResponse.success, 'Navigate prev should succeed');
  console.log('  Navigated to previous step');

  console.log('PASSED: Multi-Step Form Navigation');
  return true;
}

/**
 * Test Suite: Complete Form Flow
 */
async function testCompleteFormFlow() {
  console.log('\n--- Test: Complete Form Flow ---');

  // 1. Detect forms
  const detectResponse = await extension.sendCommand('detect_forms', {});
  assert(detectResponse.success, 'Detect forms should succeed');
  console.log('  Step 1: Detected forms');

  // 2. Auto-fill form
  const fillResponse = await extension.sendCommand('auto_fill_form', {
    formSelector: '#login-form',
    data: {
      username: 'flowtest',
      password: 'flowpass123'
    }
  });
  assert(fillResponse.success, 'Auto-fill should succeed');
  console.log('  Step 2: Auto-filled form');

  // 3. Check validation
  const validateResponse = await extension.sendCommand('get_form_validation', {
    formSelector: '#login-form'
  });
  assert(validateResponse.success, 'Validation should succeed');
  console.log('  Step 3: Validated form');

  // 4. Submit form
  const submitResponse = await extension.sendCommand('submit_form', {
    formSelector: '#login-form',
    options: { clickSubmit: true }
  });
  assert(submitResponse.success, 'Submit should succeed');
  console.log('  Step 4: Submitted form');

  console.log('PASSED: Complete Form Flow');
  return true;
}

/**
 * Run all form filling tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Form Filling Test Scenarios');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Form Detection', fn: testFormDetection },
    { name: 'Basic Form Filling', fn: testBasicFormFilling },
    { name: 'Form Fill with Submit', fn: testFormFillWithSubmit },
    { name: 'Auto-Fill with Template Data', fn: testAutoFillWithTemplate },
    { name: 'Select Dropdown Filling', fn: testSelectFilling },
    { name: 'Checkbox and Radio Filling', fn: testCheckboxRadioFilling },
    { name: 'Date Input Filling', fn: testDateFilling },
    { name: 'Form Submission', fn: testFormSubmission },
    { name: 'Form Validation', fn: testFormValidation },
    { name: 'Multi-Step Form Navigation', fn: testMultiStepFormNavigation },
    { name: 'Complete Form Flow', fn: testCompleteFormFlow }
  ];

  try {
    await testUtils.setup();

    for (const test of tests) {
      try {
        await test.fn();
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
        console.log(`FAILED: ${test.name} - ${error.message}`);
      }
    }
  } finally {
    await testUtils.teardown();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Form Filling Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results.failed === 0;
}

// Export for external use
module.exports = { runTests, testUtils };

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}
