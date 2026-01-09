/**
 * Smart Form Filler - Enhanced form automation with intelligent field detection
 *
 * This module provides advanced form filling capabilities including:
 * - Automatic field type detection
 * - Intelligent value generation
 * - Multi-step form handling
 * - Form validation detection
 * - Human-like filling patterns
 * - CAPTCHA detection (not solving)
 *
 * @module forms/smart-form-filler
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Field types that can be automatically detected and filled
 */
const FIELD_TYPES = {
  // Text fields
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  TEL: 'tel',
  URL: 'url',
  SEARCH: 'search',

  // Name fields
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  FULL_NAME: 'full_name',

  // Contact fields
  PHONE: 'phone',
  ADDRESS: 'address',
  CITY: 'city',
  STATE: 'state',
  ZIP: 'zip',
  COUNTRY: 'country',

  // Date fields
  DATE: 'date',
  DATE_OF_BIRTH: 'date_of_birth',

  // Other fields
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  TEXTAREA: 'textarea',
  FILE: 'file',

  // Security
  CAPTCHA: 'captcha',
  HONEYPOT: 'honeypot',

  // Unknown
  UNKNOWN: 'unknown'
};

/**
 * Patterns for detecting field types from name, id, placeholder, label
 */
const FIELD_DETECTION_PATTERNS = {
  [FIELD_TYPES.FIRST_NAME]: /first[-_\s]?name|fname|given[-_\s]?name|forename/i,
  [FIELD_TYPES.LAST_NAME]: /last[-_\s]?name|lname|sur[-_\s]?name|family[-_\s]?name/i,
  [FIELD_TYPES.FULL_NAME]: /^name$|full[-_\s]?name|your[-_\s]?name/i,
  [FIELD_TYPES.EMAIL]: /e?mail/i,
  [FIELD_TYPES.PASSWORD]: /pass(word)?|pwd/i,
  [FIELD_TYPES.TEL]: /phone|tel(ephone)?|mobile|cell/i,
  [FIELD_TYPES.ADDRESS]: /address|street|addr/i,
  [FIELD_TYPES.CITY]: /city|town/i,
  [FIELD_TYPES.STATE]: /state|province|region/i,
  [FIELD_TYPES.ZIP]: /zip|postal[-_\s]?code|postcode/i,
  [FIELD_TYPES.COUNTRY]: /country|nation/i,
  [FIELD_TYPES.DATE_OF_BIRTH]: /birth|dob|age/i,
  [FIELD_TYPES.CAPTCHA]: /captcha|recaptcha|hcaptcha|security[-_\s]?code/i,
  [FIELD_TYPES.HONEYPOT]: /honeypot|h_pot|trap|bot[-_]?check/i,
  [FIELD_TYPES.SEARCH]: /search|query/i,
  [FIELD_TYPES.URL]: /url|website|site/i,
  [FIELD_TYPES.NUMBER]: /number|amount|quantity|qty/i
};

/**
 * Form field representation
 */
class FormField {
  constructor(data) {
    this.selector = data.selector;
    this.name = data.name || '';
    this.id = data.id || '';
    this.type = data.type || 'text';
    this.detectedType = data.detectedType || FIELD_TYPES.UNKNOWN;
    this.value = data.value || '';
    this.placeholder = data.placeholder || '';
    this.label = data.label || '';
    this.required = data.required || false;
    this.pattern = data.pattern || null;
    this.minLength = data.minLength || null;
    this.maxLength = data.maxLength || null;
    this.options = data.options || []; // For select/radio
    this.visible = data.visible !== false;
    this.autocomplete = data.autocomplete || null;
  }

  /**
   * Check if this field is likely a honeypot
   */
  isHoneypot() {
    if (this.detectedType === FIELD_TYPES.HONEYPOT) return true;
    if (!this.visible) return true;
    if (this.name && FIELD_DETECTION_PATTERNS[FIELD_TYPES.HONEYPOT].test(this.name)) return true;
    return false;
  }

  /**
   * Check if this field is a CAPTCHA
   */
  isCaptcha() {
    return this.detectedType === FIELD_TYPES.CAPTCHA;
  }
}

/**
 * Represents a web form with all its fields
 */
class Form {
  constructor(data) {
    this.selector = data.selector;
    this.action = data.action || '';
    this.method = data.method || 'GET';
    this.fields = (data.fields || []).map(f => new FormField(f));
    this.submitButton = data.submitButton || null;
    this.isMultiStep = data.isMultiStep || false;
    this.currentStep = data.currentStep || 1;
    this.totalSteps = data.totalSteps || 1;
    this.hasCaptcha = data.hasCaptcha || false;
    this.hasHoneypots = data.hasHoneypots || false;
  }

  /**
   * Get all fields that should be filled (not honeypots)
   */
  getFillableFields() {
    return this.fields.filter(f => !f.isHoneypot() && !f.isCaptcha());
  }

  /**
   * Get required fields
   */
  getRequiredFields() {
    return this.getFillableFields().filter(f => f.required);
  }

  /**
   * Get fields by detected type
   */
  getFieldsByType(type) {
    return this.getFillableFields().filter(f => f.detectedType === type);
  }
}

/**
 * Smart Form Filler - Intelligent form automation
 */
class SmartFormFiller extends EventEmitter {
  constructor(webContents, options = {}) {
    super();
    this.webContents = webContents;
    this.options = {
      respectHoneypots: true,
      skipCaptchas: true,
      humanLikeSpeed: true,
      detectValidation: true,
      maxRetries: 3,
      ...options
    };

    this.stats = {
      formsAnalyzed: 0,
      formsFilled: 0,
      fieldsAnalyzed: 0,
      fieldsFilled: 0,
      honeypotsDetected: 0,
      captchasDetected: 0,
      validationErrors: 0
    };
  }

  /**
   * Analyze all forms on the page
   */
  async analyzeForms() {
    const script = `
      (() => {
        const forms = Array.from(document.querySelectorAll('form'));

        return forms.map((form, formIndex) => {
          const formSelector = form.id ? \`#\${form.id}\` :
                              form.className ? \`form.\${form.className.split(' ')[0]}\` :
                              \`form:nth-of-type(\${formIndex + 1})\`;

          // Extract all form fields
          const fields = [];
          const inputs = form.querySelectorAll('input, textarea, select');

          inputs.forEach((input, index) => {
            const computedStyle = window.getComputedStyle(input);
            const rect = input.getBoundingClientRect();

            // Get associated label
            let label = '';
            if (input.id) {
              const labelEl = document.querySelector(\`label[for="\${input.id}"]\`);
              if (labelEl) label = labelEl.textContent.trim();
            }
            if (!label) {
              const parentLabel = input.closest('label');
              if (parentLabel) label = parentLabel.textContent.trim();
            }

            // Check visibility
            const visible = computedStyle.display !== 'none' &&
                          computedStyle.visibility !== 'hidden' &&
                          computedStyle.opacity !== '0' &&
                          rect.width > 0 && rect.height > 0 &&
                          rect.top > -1000 && rect.left > -1000;

            // Extract options for select/radio
            let options = [];
            if (input.tagName === 'SELECT') {
              options = Array.from(input.options).map(opt => ({
                value: opt.value,
                text: opt.text
              }));
            } else if (input.type === 'radio') {
              const name = input.name;
              const radios = form.querySelectorAll(\`input[type="radio"][name="\${name}"]\`);
              options = Array.from(radios).map(r => ({
                value: r.value,
                label: r.nextElementSibling?.textContent || r.value
              }));
            }

            fields.push({
              selector: input.id ? \`#\${input.id}\` :
                       input.name ? \`[name="\${input.name}"]\` :
                       \`\${input.tagName.toLowerCase()}:nth-of-type(\${index + 1})\`,
              name: input.name || '',
              id: input.id || '',
              type: input.type || input.tagName.toLowerCase(),
              value: input.value || '',
              placeholder: input.placeholder || '',
              label: label,
              required: input.required,
              pattern: input.pattern || null,
              minLength: input.minLength > 0 ? input.minLength : null,
              maxLength: input.maxLength > 0 ? input.maxLength : null,
              autocomplete: input.autocomplete || null,
              visible: visible,
              options: options
            });
          });

          // Find submit button
          let submitButton = null;
          const buttons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
          if (buttons.length > 0) {
            const btn = buttons[0];
            submitButton = {
              selector: btn.id ? \`#\${btn.id}\` :
                       btn.className ? \`.\${btn.className.split(' ')[0]}\` :
                       'button[type="submit"]',
              text: btn.textContent || btn.value || 'Submit'
            };
          }

          // Check for multi-step indicators
          const stepIndicators = form.querySelectorAll('[class*="step"], [class*="progress"]');
          const isMultiStep = stepIndicators.length > 0;

          // Check for CAPTCHAs
          const hasCaptcha = form.querySelector('[class*="captcha"], [class*="recaptcha"]') !== null;

          return {
            selector: formSelector,
            action: form.action || '',
            method: form.method || 'GET',
            fields: fields,
            submitButton: submitButton,
            isMultiStep: isMultiStep,
            hasCaptcha: hasCaptcha
          };
        });
      })();
    `;

    const forms = await this.webContents.executeJavaScript(script);
    this.stats.formsAnalyzed += forms.length;
    this.stats.fieldsAnalyzed += forms.reduce((sum, f) => sum + f.fields.length, 0);

    // Detect field types and honeypots
    const analyzedForms = forms.map(formData => {
      formData.fields = formData.fields.map(fieldData => {
        fieldData.detectedType = this._detectFieldType(fieldData);
        return fieldData;
      });

      // Count honeypots and CAPTCHAs
      const form = new Form(formData);
      if (form.fields.some(f => f.isHoneypot())) {
        formData.hasHoneypots = true;
        this.stats.honeypotsDetected++;
      }
      if (form.hasCaptcha || form.fields.some(f => f.isCaptcha())) {
        formData.hasCaptcha = true;
        this.stats.captchasDetected++;
      }

      return form;
    });

    return analyzedForms;
  }

  /**
   * Detect field type from field metadata
   */
  _detectFieldType(field) {
    // Check HTML5 type first
    if (field.type === 'email') return FIELD_TYPES.EMAIL;
    if (field.type === 'tel') return FIELD_TYPES.TEL;
    if (field.type === 'url') return FIELD_TYPES.URL;
    if (field.type === 'date') return FIELD_TYPES.DATE;
    if (field.type === 'number') return FIELD_TYPES.NUMBER;
    if (field.type === 'search') return FIELD_TYPES.SEARCH;
    if (field.type === 'password') return FIELD_TYPES.PASSWORD;
    if (field.type === 'select') return FIELD_TYPES.SELECT;
    if (field.type === 'checkbox') return FIELD_TYPES.CHECKBOX;
    if (field.type === 'radio') return FIELD_TYPES.RADIO;
    if (field.type === 'textarea') return FIELD_TYPES.TEXTAREA;
    if (field.type === 'file') return FIELD_TYPES.FILE;

    // Check autocomplete attribute
    if (field.autocomplete) {
      if (field.autocomplete.includes('email')) return FIELD_TYPES.EMAIL;
      if (field.autocomplete.includes('tel')) return FIELD_TYPES.TEL;
      if (field.autocomplete.includes('given-name')) return FIELD_TYPES.FIRST_NAME;
      if (field.autocomplete.includes('family-name')) return FIELD_TYPES.LAST_NAME;
      if (field.autocomplete.includes('name') && !field.autocomplete.includes('-name')) return FIELD_TYPES.FULL_NAME;
      if (field.autocomplete.includes('address')) return FIELD_TYPES.ADDRESS;
      if (field.autocomplete.includes('postal-code')) return FIELD_TYPES.ZIP;
      if (field.autocomplete.includes('country')) return FIELD_TYPES.COUNTRY;
      if (field.autocomplete.includes('bday')) return FIELD_TYPES.DATE_OF_BIRTH;
    }

    // Check name, id, placeholder, label against patterns
    const searchText = `${field.name} ${field.id} ${field.placeholder} ${field.label}`.toLowerCase();

    for (const [type, pattern] of Object.entries(FIELD_DETECTION_PATTERNS)) {
      if (pattern.test(searchText)) {
        return type;
      }
    }

    return FIELD_TYPES.UNKNOWN;
  }

  /**
   * Fill a form with provided data
   *
   * @param {string} formSelector - CSS selector for form
   * @param {Object} data - Field values to fill
   * @param {Object} options - Fill options
   */
  async fillForm(formSelector, data, options = {}) {
    const opts = {
      submit: false,
      validate: true,
      skipHoneypots: this.options.respectHoneypots,
      skipCaptchas: this.options.skipCaptchas,
      humanLike: this.options.humanLikeSpeed,
      ...options
    };

    // Analyze the specific form
    const forms = await this.analyzeForms();
    const form = forms.find(f => f.selector === formSelector);

    if (!form) {
      throw new Error(`Form not found: ${formSelector}`);
    }

    // Check for blockers
    if (form.hasCaptcha && opts.skipCaptchas) {
      this.emit('captcha-detected', { form: formSelector });
      throw new Error('CAPTCHA detected - cannot proceed');
    }

    const fillableFields = form.getFillableFields();
    const results = {
      filled: [],
      skipped: [],
      failed: []
    };

    // Fill each field
    for (const field of fillableFields) {
      try {
        // Skip if no data provided for this field
        const value = this._findValueForField(field, data);
        if (value === null || value === undefined) {
          results.skipped.push({ field: field.name || field.id, reason: 'No data provided' });
          continue;
        }

        // Fill the field
        await this._fillField(field, value, opts);
        results.filled.push({ field: field.name || field.id, type: field.detectedType });
        this.stats.fieldsFilled++;

        // Human-like delay between fields
        if (opts.humanLike) {
          await this._humanDelay(100, 500);
        }
      } catch (error) {
        results.failed.push({
          field: field.name || field.id,
          error: error.message
        });
      }
    }

    // Validate if requested
    if (opts.validate) {
      const validationErrors = await this._detectValidationErrors(formSelector);
      if (validationErrors.length > 0) {
        this.stats.validationErrors += validationErrors.length;
        results.validationErrors = validationErrors;
      }
    }

    // Submit if requested
    if (opts.submit && (!opts.validate || !results.validationErrors)) {
      await this._submitForm(form, opts.humanLike);
      results.submitted = true;
    }

    this.stats.formsFilled++;
    return results;
  }

  /**
   * Find value for field from provided data
   */
  _findValueForField(field, data) {
    // Try exact name/id match first
    if (field.name && data[field.name] !== undefined) return data[field.name];
    if (field.id && data[field.id] !== undefined) return data[field.id];

    // Try detected type
    if (data[field.detectedType] !== undefined) return data[field.detectedType];

    // Try common aliases
    const aliases = {
      [FIELD_TYPES.EMAIL]: ['email', 'email_address', 'user_email'],
      [FIELD_TYPES.FIRST_NAME]: ['first_name', 'firstName', 'fname', 'given_name'],
      [FIELD_TYPES.LAST_NAME]: ['last_name', 'lastName', 'lname', 'surname'],
      [FIELD_TYPES.FULL_NAME]: ['name', 'full_name', 'fullName'],
      [FIELD_TYPES.PHONE]: ['phone', 'telephone', 'phone_number', 'mobile'],
      [FIELD_TYPES.PASSWORD]: ['password', 'passwd', 'pwd']
    };

    if (aliases[field.detectedType]) {
      for (const alias of aliases[field.detectedType]) {
        if (data[alias] !== undefined) return data[alias];
      }
    }

    return null;
  }

  /**
   * Fill a single field
   */
  async _fillField(field, value, options) {
    const script = `
      (() => {
        const element = document.querySelector('${field.selector}');
        if (!element) throw new Error('Element not found');

        if (element.tagName === 'SELECT') {
          element.value = '${value}';
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.type === 'checkbox') {
          element.checked = ${Boolean(value)};
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.type === 'radio') {
          element.checked = true;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.focus();
          element.value = '${String(value).replace(/'/g, "\\'")}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.blur();
        }

        return true;
      })();
    `;

    await this.webContents.executeJavaScript(script);
  }

  /**
   * Detect validation errors on the form
   */
  async _detectValidationErrors(formSelector) {
    const script = `
      (() => {
        const form = document.querySelector('${formSelector}');
        if (!form) return [];

        const errors = [];

        // Check HTML5 validation
        const invalidFields = form.querySelectorAll(':invalid');
        invalidFields.forEach(field => {
          errors.push({
            field: field.name || field.id,
            message: field.validationMessage || 'Invalid value'
          });
        });

        // Check for visible error messages
        const errorElements = form.querySelectorAll('[class*="error"], [class*="invalid"]');
        errorElements.forEach(el => {
          if (el.offsetHeight > 0 && el.textContent.trim()) {
            errors.push({
              field: 'unknown',
              message: el.textContent.trim()
            });
          }
        });

        return errors;
      })();
    `;

    return await this.webContents.executeJavaScript(script);
  }

  /**
   * Submit the form
   */
  async _submitForm(form, humanLike) {
    if (!form.submitButton) {
      throw new Error('No submit button found');
    }

    if (humanLike) {
      await this._humanDelay(500, 1500);
    }

    const script = `
      (() => {
        const button = document.querySelector('${form.submitButton.selector}');
        if (!button) throw new Error('Submit button not found');
        button.click();
        return true;
      })();
    `;

    await this.webContents.executeJavaScript(script);
  }

  /**
   * Human-like delay
   */
  async _humanDelay(min, max) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      formsAnalyzed: 0,
      formsFilled: 0,
      fieldsAnalyzed: 0,
      fieldsFilled: 0,
      honeypotsDetected: 0,
      captchasDetected: 0,
      validationErrors: 0
    };
  }
}

module.exports = {
  SmartFormFiller,
  Form,
  FormField,
  FIELD_TYPES,
  FIELD_DETECTION_PATTERNS
};
