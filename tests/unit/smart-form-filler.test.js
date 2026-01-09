/**
 * Tests for Smart Form Filler
 */

const { SmartFormFiller, Form, FormField, FIELD_TYPES, FIELD_DETECTION_PATTERNS } = require('../../forms/smart-form-filler');

// Mock webContents
const createMockWebContents = () => {
  const webContents = {
    executeJavaScript: jest.fn(),
  };

  return webContents;
};

describe('Smart Form Filler', () => {
  let webContents;
  let formFiller;

  beforeEach(() => {
    webContents = createMockWebContents();
    formFiller = new SmartFormFiller(webContents);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // FormField Tests
  // ==========================================

  describe('FormField', () => {
    test('should create form field with defaults', () => {
      const field = new FormField({
        selector: '#email',
        name: 'email',
        type: 'email'
      });

      expect(field.selector).toBe('#email');
      expect(field.name).toBe('email');
      expect(field.type).toBe('email');
      expect(field.required).toBe(false);
      expect(field.visible).toBe(true);
    });

    test('should detect honeypot by detectedType', () => {
      const field = new FormField({
        selector: '#trap',
        name: 'honeypot',
        detectedType: FIELD_TYPES.HONEYPOT
      });

      expect(field.isHoneypot()).toBe(true);
    });

    test('should detect honeypot by visibility', () => {
      const field = new FormField({
        selector: '#hidden',
        name: 'field',
        visible: false
      });

      expect(field.isHoneypot()).toBe(true);
    });

    test('should detect honeypot by name pattern', () => {
      const field = new FormField({
        selector: '#trap',
        name: 'h_pot_field'
      });

      expect(field.isHoneypot()).toBe(true);
    });

    test('should detect CAPTCHA', () => {
      const field = new FormField({
        selector: '#captcha',
        detectedType: FIELD_TYPES.CAPTCHA
      });

      expect(field.isCaptcha()).toBe(true);
    });

    test('should not detect false positives', () => {
      const field = new FormField({
        selector: '#email',
        name: 'email',
        visible: true
      });

      expect(field.isHoneypot()).toBe(false);
      expect(field.isCaptcha()).toBe(false);
    });
  });

  // ==========================================
  // Form Tests
  // ==========================================

  describe('Form', () => {
    test('should create form with fields', () => {
      const form = new Form({
        selector: '#contact-form',
        action: '/submit',
        method: 'POST',
        fields: [
          { selector: '#name', name: 'name', type: 'text' },
          { selector: '#email', name: 'email', type: 'email' }
        ]
      });

      expect(form.selector).toBe('#contact-form');
      expect(form.action).toBe('/submit');
      expect(form.method).toBe('POST');
      expect(form.fields.length).toBe(2);
      expect(form.fields[0]).toBeInstanceOf(FormField);
    });

    test('should filter fillable fields', () => {
      const form = new Form({
        selector: '#form',
        fields: [
          { selector: '#name', name: 'name', visible: true },
          { selector: '#honeypot', name: 'honeypot', visible: false },
          { selector: '#captcha', name: 'captcha', detectedType: FIELD_TYPES.CAPTCHA }
        ]
      });

      const fillable = form.getFillableFields();
      expect(fillable.length).toBe(1);
      expect(fillable[0].name).toBe('name');
    });

    test('should get required fields', () => {
      const form = new Form({
        selector: '#form',
        fields: [
          { selector: '#name', name: 'name', required: true },
          { selector: '#email', name: 'email', required: false },
          { selector: '#phone', name: 'phone', required: true }
        ]
      });

      const required = form.getRequiredFields();
      expect(required.length).toBe(2);
      expect(required.map(f => f.name)).toEqual(['name', 'phone']);
    });

    test('should get fields by type', () => {
      const form = new Form({
        selector: '#form',
        fields: [
          { selector: '#email', name: 'email', detectedType: FIELD_TYPES.EMAIL },
          { selector: '#name', name: 'name', detectedType: FIELD_TYPES.FULL_NAME },
          { selector: '#email2', name: 'email2', detectedType: FIELD_TYPES.EMAIL }
        ]
      });

      const emailFields = form.getFieldsByType(FIELD_TYPES.EMAIL);
      expect(emailFields.length).toBe(2);
    });

    test('should detect multi-step forms', () => {
      const form = new Form({
        selector: '#form',
        isMultiStep: true,
        currentStep: 2,
        totalSteps: 5,
        fields: []
      });

      expect(form.isMultiStep).toBe(true);
      expect(form.currentStep).toBe(2);
      expect(form.totalSteps).toBe(5);
    });

    test('should detect CAPTCHAs and honeypots', () => {
      const form = new Form({
        selector: '#form',
        hasCaptcha: true,
        hasHoneypots: true,
        fields: []
      });

      expect(form.hasCaptcha).toBe(true);
      expect(form.hasHoneypots).toBe(true);
    });
  });

  // ==========================================
  // Field Type Detection Tests
  // ==========================================

  describe('Field Type Detection', () => {
    test('should detect email field from type', () => {
      const fieldData = { type: 'email', name: 'contact' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.EMAIL);
    });

    test('should detect tel field from type', () => {
      const fieldData = { type: 'tel', name: 'contact' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.TEL);
    });

    test('should detect password field from type', () => {
      const fieldData = { type: 'password', name: 'secret' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.PASSWORD);
    });

    test('should detect email from autocomplete', () => {
      const fieldData = { type: 'text', name: 'user', autocomplete: 'email' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.EMAIL);
    });

    test('should detect first name from autocomplete', () => {
      const fieldData = { type: 'text', name: 'user', autocomplete: 'given-name' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.FIRST_NAME);
    });

    test('should detect email from name pattern', () => {
      const fieldData = { type: 'text', name: 'user_email', id: '', placeholder: '', label: '' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.EMAIL);
    });

    test('should detect first name from label', () => {
      const fieldData = { type: 'text', name: '', id: '', placeholder: '', label: 'First Name' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.FIRST_NAME);
    });

    test('should detect phone from placeholder', () => {
      const fieldData = { type: 'text', name: '', id: '', placeholder: 'Enter phone number', label: '' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.TEL);
    });

    test('should detect CAPTCHA from name', () => {
      const fieldData = { type: 'text', name: 'g-recaptcha-response', id: '', placeholder: '', label: '' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.CAPTCHA);
    });

    test('should detect honeypot from name', () => {
      const fieldData = { type: 'text', name: 'honeypot_field', id: '', placeholder: '', label: '' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.HONEYPOT);
    });

    test('should return UNKNOWN for unrecognized fields', () => {
      const fieldData = { type: 'text', name: 'xyz123', id: '', placeholder: '', label: '' };
      const detectedType = formFiller._detectFieldType(fieldData);
      expect(detectedType).toBe(FIELD_TYPES.UNKNOWN);
    });
  });

  // ==========================================
  // Form Analysis Tests
  // ==========================================

  describe('analyzeForms', () => {
    test('should analyze all forms on page', async () => {
      const mockForms = [
        {
          selector: '#form1',
          action: '/submit',
          method: 'POST',
          fields: [
            { selector: '#name', name: 'name', type: 'text', visible: true },
            { selector: '#email', name: 'email', type: 'email', visible: true }
          ],
          submitButton: { selector: 'button[type="submit"]', text: 'Submit' }
        }
      ];

      webContents.executeJavaScript.mockResolvedValue(mockForms);

      const forms = await formFiller.analyzeForms();

      expect(forms.length).toBe(1);
      expect(forms[0]).toBeInstanceOf(Form);
      expect(forms[0].selector).toBe('#form1');
      expect(forms[0].fields.length).toBe(2);
      expect(formFiller.stats.formsAnalyzed).toBe(1);
      expect(formFiller.stats.fieldsAnalyzed).toBe(2);
    });

    test('should detect honeypots during analysis', async () => {
      const mockForms = [{
        selector: '#form',
        fields: [
          { selector: '#name', name: 'name', type: 'text', visible: true },
          { selector: '#trap', name: 'h_pot', type: 'text', visible: false }
        ]
      }];

      webContents.executeJavaScript.mockResolvedValue(mockForms);

      const forms = await formFiller.analyzeForms();

      expect(forms[0].hasHoneypots).toBe(true);
      expect(formFiller.stats.honeypotsDetected).toBeGreaterThan(0);
    });

    test('should detect CAPTCHAs during analysis', async () => {
      const mockForms = [{
        selector: '#form',
        hasCaptcha: true,
        fields: []
      }];

      webContents.executeJavaScript.mockResolvedValue(mockForms);

      const forms = await formFiller.analyzeForms();

      expect(forms[0].hasCaptcha).toBe(true);
      expect(formFiller.stats.captchasDetected).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Form Filling Tests
  // ==========================================

  describe('fillForm', () => {
    beforeEach(() => {
      // Mock form analysis
      const mockForms = [{
        selector: '#contact-form',
        action: '/submit',
        method: 'POST',
        fields: [
          { selector: '#name', name: 'name', type: 'text', visible: true, label: 'Name', required: true },
          { selector: '#email', name: 'email', type: 'email', visible: true, label: 'Email', required: true },
          { selector: '#honeypot', name: 'h_pot', type: 'text', visible: false, label: '' }
        ],
        submitButton: { selector: 'button', text: 'Submit' }
      }];

      webContents.executeJavaScript
        .mockResolvedValueOnce(mockForms) // analyzeForms call
        .mockResolvedValue(true); // field filling calls
    });

    test('should fill form with provided data', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const result = await formFiller.fillForm('#contact-form', data);

      expect(result.success).toBe(true);
      expect(result.filled.length).toBe(2);
      expect(result.skipped.length).toBe(0);
      expect(result.failed.length).toBe(0);
      expect(formFiller.stats.fieldsFilled).toBe(2);
    });

    test('should skip honeypot fields', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        h_pot: 'trap value' // Should be skipped
      };

      const result = await formFiller.fillForm('#contact-form', data);

      expect(result.filled.length).toBe(2);
      // Honeypot should not be in filled list
      expect(result.filled.find(f => f.field === 'h_pot')).toBeUndefined();
    });

    test('should skip fields with no data', async () => {
      const data = {
        name: 'John Doe'
        // email is missing
      };

      const result = await formFiller.fillForm('#contact-form', data);

      expect(result.filled.length).toBe(1);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].reason).toBe('No data provided');
    });

    test('should throw error for non-existent form', async () => {
      webContents.executeJavaScript.mockResolvedValueOnce([]);

      await expect(
        formFiller.fillForm('#non-existent', {})
      ).rejects.toThrow('Form not found');
    });

    test('should throw error for CAPTCHA when skipCaptchas is true', async () => {
      const mockFormsWithCaptcha = [{
        selector: '#form',
        hasCaptcha: true,
        fields: []
      }];

      webContents.executeJavaScript.mockResolvedValueOnce(mockFormsWithCaptcha);

      await expect(
        formFiller.fillForm('#form', {}, { skipCaptchas: true })
      ).rejects.toThrow('CAPTCHA detected');
    });

    test('should not submit by default', async () => {
      const data = { name: 'John', email: 'john@example.com' };
      const result = await formFiller.fillForm('#contact-form', data);

      expect(result.submitted).toBeUndefined();
    });

    test('should submit when requested', async () => {
      const data = { name: 'John', email: 'john@example.com' };
      const result = await formFiller.fillForm('#contact-form', data, { submit: true });

      expect(result.submitted).toBe(true);
    });
  });

  // ==========================================
  // Value Finding Tests
  // ==========================================

  describe('_findValueForField', () => {
    test('should find value by exact name match', () => {
      const field = new FormField({ name: 'user_email', detectedType: FIELD_TYPES.EMAIL });
      const data = { user_email: 'test@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBe('test@example.com');
    });

    test('should find value by exact id match', () => {
      const field = new FormField({ id: 'email_field', detectedType: FIELD_TYPES.EMAIL });
      const data = { email_field: 'test@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBe('test@example.com');
    });

    test('should find value by detected type', () => {
      const field = new FormField({ name: 'user_email_address', detectedType: FIELD_TYPES.EMAIL });
      const data = { email: 'test@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBe('test@example.com');
    });

    test('should find value by alias', () => {
      const field = new FormField({ name: 'contact', detectedType: FIELD_TYPES.EMAIL });
      const data = { email_address: 'test@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBe('test@example.com');
    });

    test('should return null if no value found', () => {
      const field = new FormField({ name: 'unknown_field', detectedType: FIELD_TYPES.UNKNOWN });
      const data = { email: 'test@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBeNull();
    });

    test('should prioritize exact name match over aliases', () => {
      const field = new FormField({ name: 'email', detectedType: FIELD_TYPES.EMAIL });
      const data = { email: 'exact@example.com', email_address: 'alias@example.com' };

      const value = formFiller._findValueForField(field, data);
      expect(value).toBe('exact@example.com');
    });
  });

  // ==========================================
  // Statistics Tests
  // ==========================================

  describe('Statistics', () => {
    test('should track form analysis stats', async () => {
      const mockForms = [
        { selector: '#form1', fields: [{ name: 'field1', type: 'text' }] },
        { selector: '#form2', fields: [{ name: 'field2', type: 'text' }, { name: 'field3', type: 'text' }] }
      ];

      webContents.executeJavaScript.mockResolvedValue(mockForms);

      await formFiller.analyzeForms();

      const stats = formFiller.getStats();
      expect(stats.formsAnalyzed).toBe(2);
      expect(stats.fieldsAnalyzed).toBe(3);
    });

    test('should track form filling stats', async () => {
      const mockForms = [{
        selector: '#form',
        fields: [
          { selector: '#name', name: 'name', type: 'text', visible: true }
        ]
      }];

      webContents.executeJavaScript
        .mockResolvedValueOnce(mockForms)
        .mockResolvedValue(true);

      await formFiller.fillForm('#form', { name: 'John' });

      const stats = formFiller.getStats();
      expect(stats.formsFilled).toBe(1);
      expect(stats.fieldsFilled).toBe(1);
    });

    test('should reset stats', () => {
      formFiller.stats.formsAnalyzed = 5;
      formFiller.stats.formsFilled = 3;

      formFiller.resetStats();

      const stats = formFiller.getStats();
      expect(stats.formsAnalyzed).toBe(0);
      expect(stats.formsFilled).toBe(0);
    });
  });

  // ==========================================
  // Configuration Tests
  // ==========================================

  describe('Configuration', () => {
    test('should use default options', () => {
      expect(formFiller.options.respectHoneypots).toBe(true);
      expect(formFiller.options.skipCaptchas).toBe(true);
      expect(formFiller.options.humanLikeSpeed).toBe(true);
      expect(formFiller.options.detectValidation).toBe(true);
      expect(formFiller.options.maxRetries).toBe(3);
    });

    test('should accept custom options', () => {
      const customFiller = new SmartFormFiller(webContents, {
        respectHoneypots: false,
        humanLikeSpeed: false,
        maxRetries: 5
      });

      expect(customFiller.options.respectHoneypots).toBe(false);
      expect(customFiller.options.humanLikeSpeed).toBe(false);
      expect(customFiller.options.maxRetries).toBe(5);
    });
  });

  // ==========================================
  // Field Patterns Tests
  // ==========================================

  describe('Field Detection Patterns', () => {
    test('should have pattern for all common field types', () => {
      const commonTypes = [
        FIELD_TYPES.FIRST_NAME,
        FIELD_TYPES.LAST_NAME,
        FIELD_TYPES.EMAIL,
        FIELD_TYPES.PASSWORD,
        FIELD_TYPES.TEL,
        FIELD_TYPES.ADDRESS,
        FIELD_TYPES.CITY,
        FIELD_TYPES.STATE,
        FIELD_TYPES.ZIP,
        FIELD_TYPES.COUNTRY,
        FIELD_TYPES.CAPTCHA,
        FIELD_TYPES.HONEYPOT
      ];

      commonTypes.forEach(type => {
        expect(FIELD_DETECTION_PATTERNS[type]).toBeDefined();
        expect(FIELD_DETECTION_PATTERNS[type]).toBeInstanceOf(RegExp);
      });
    });

    test('patterns should be case insensitive', () => {
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.EMAIL].test('EMAIL')).toBe(true);
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.EMAIL].test('Email')).toBe(true);
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.EMAIL].test('email')).toBe(true);
    });

    test('patterns should match variations', () => {
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.FIRST_NAME].test('first-name')).toBe(true);
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.FIRST_NAME].test('first_name')).toBe(true);
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.FIRST_NAME].test('first name')).toBe(true);
      expect(FIELD_DETECTION_PATTERNS[FIELD_TYPES.FIRST_NAME].test('firstname')).toBe(true);
    });
  });

  // ==========================================
  // Events Tests
  // ==========================================

  describe('Events', () => {
    test('should emit events', (done) => {
      const mockForms = [{
        selector: '#form',
        fields: []
      }];

      webContents.executeJavaScript.mockResolvedValue(mockForms);

      // SmartFormFiller doesn't emit analysis events in current implementation
      // This test is for future event support
      expect(formFiller).toBeInstanceOf(require('events').EventEmitter);
      done();
    });
  });
});
