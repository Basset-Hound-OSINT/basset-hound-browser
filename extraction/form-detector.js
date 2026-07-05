/**
 * Form Detector - Detect and extract forms from HTML
 * Responsibilities:
 * - Identify form elements
 * - Extract form fields (input, select, textarea)
 * - Infer field types and attributes
 * - Validate form structure
 *
 * @module extraction/form-detector
 */

const cheerio = require('cheerio');

/**
 * FormDetector class
 * Handles all form detection and extraction operations
 *
 * @class FormDetector
 */
class FormDetector {
  constructor() {
    this.stats = {
      totalFormsDetected: 0,
      totalFieldsDetected: 0,
      multiStepFormsDetected: 0,
      formsWithCSRF: 0
    };
  }

  /**
   * Detect and extract all forms
   * Identifies <form> elements and their metadata
   *
   * @param {string} html - HTML content
   * @param {Object} options - Detection options
   * @param {boolean} options.includeHidden - Include hidden fields
   * @param {boolean} options.detectCSRF - Detect CSRF tokens
   * @returns {Array<Object>} Array of form objects
   *
   * @example
   * const detector = new FormDetector();
   * const forms = detector.detectForms(html);
   * // Returns: [{ id, name, method, action, fields, multiStep, ... }, ...]
   */
  detectForms(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return [];
    }

    const { includeHidden = true, detectCSRF = true } = options;

    try {
      const $ = cheerio.load(html);
      const forms = [];

      $('form').each((index, formElement) => {
        const formData = this.extractFormData(formElement, $, {
          includeHidden,
          detectCSRF
        });
        if (formData) {
          forms.push(formData);
        }
      });

      this.stats.totalFormsDetected += forms.length;
      return forms;
    } catch (error) {
      console.error('[FormDetector] Error detecting forms:', error.message);
      return [];
    }
  }

  /**
   * Extract fields from a form element
   *
   * @param {Element} formElement - Form DOM element
   * @param {Object} $ - Cheerio instance
   * @param {Object} options - Extraction options
   * @returns {Array<Object>} Array of field objects
   *
   * @private
   */
  extractFormFields(formElement, $, options = {}) {
    const { includeHidden = true } = options;
    const $form = $(formElement);
    const fields = [];

    // Extract input elements
    $form.find('input').each((index, inputElement) => {
      const field = this.extractFieldData(inputElement, $);
      if (field && (includeHidden || field.type !== 'hidden')) {
        fields.push(field);
      }
    });

    // Extract select elements
    $form.find('select').each((index, selectElement) => {
      const field = this.extractSelectFieldData(selectElement, $);
      if (field) {
        fields.push(field);
      }
    });

    // Extract textarea elements
    $form.find('textarea').each((index, textareaElement) => {
      const field = this.extractTextareaFieldData(textareaElement, $);
      if (field) {
        fields.push(field);
      }
    });

    this.stats.totalFieldsDetected += fields.length;
    return fields;
  }

  /**
   * Extract data from an input element
   *
   * @param {Element} inputElement - Input DOM element
   * @param {Object} $ - Cheerio instance
   * @returns {Object} Field data object
   *
   * @private
   */
  extractFieldData(inputElement, $) {
    const $input = $(inputElement);
    const type = $input.attr('type') || 'text';

    return {
      type: this.normalizeFieldType(type),
      name: $input.attr('name') || '',
      value: $input.attr('value') || '',
      placeholder: $input.attr('placeholder') || null,
      required: $input.prop('required') || false,
      disabled: $input.prop('disabled') || false,
      readonly: $input.prop('readonly') || false,
      pattern: $input.attr('pattern') || null,
      min: $input.attr('min') || null,
      max: $input.attr('max') || null,
      step: $input.attr('step') || null,
      autocomplete: $input.attr('autocomplete') || null,
      title: $input.attr('title') || null,
      id: $input.attr('id') || null,
      class: $input.attr('class') || null,
      checked: $input.prop('checked') || false,
      defaultValue: $input.attr('value') || ''
    };
  }

  /**
   * Extract data from a select element
   *
   * @param {Element} selectElement - Select DOM element
   * @param {Object} $ - Cheerio instance
   * @returns {Object} Select field data object
   *
   * @private
   */
  extractSelectFieldData(selectElement, $) {
    const $select = $(selectElement);
    const options = [];

    $select.find('option').each((index, optionElement) => {
      const $option = $(optionElement);
      options.push({
        value: $option.attr('value') || $option.text(),
        text: $option.text(),
        selected: $option.prop('selected') || false,
        disabled: $option.prop('disabled') || false
      });
    });

    return {
      type: 'select',
      name: $select.attr('name') || '',
      value: $select.val() || '',
      multiple: $select.prop('multiple') || false,
      required: $select.prop('required') || false,
      disabled: $select.prop('disabled') || false,
      id: $select.attr('id') || null,
      class: $select.attr('class') || null,
      options
    };
  }

  /**
   * Extract data from a textarea element
   *
   * @param {Element} textareaElement - Textarea DOM element
   * @param {Object} $ - Cheerio instance
   * @returns {Object} Textarea field data object
   *
   * @private
   */
  extractTextareaFieldData(textareaElement, $) {
    const $textarea = $(textareaElement);

    return {
      type: 'textarea',
      name: $textarea.attr('name') || '',
      value: $textarea.text() || '',
      placeholder: $textarea.attr('placeholder') || null,
      required: $textarea.prop('required') || false,
      disabled: $textarea.prop('disabled') || false,
      readonly: $textarea.prop('readonly') || false,
      rows: $textarea.attr('rows') || null,
      cols: $textarea.attr('cols') || null,
      autocomplete: $textarea.attr('autocomplete') || null,
      id: $textarea.attr('id') || null,
      class: $textarea.attr('class') || null
    };
  }

  /**
   * Extract complete form data
   *
   * @param {Element} formElement - Form DOM element
   * @param {Object} $ - Cheerio instance
   * @param {Object} options - Extraction options
   * @returns {Object} Complete form data object
   *
   * @private
   */
  extractFormData(formElement, $, options = {}) {
    const $form = $(formElement);
    const fields = this.extractFormFields(formElement, $, options);

    const formData = {
      id: $form.attr('id') || null,
      name: $form.attr('name') || null,
      method: ($form.attr('method') || 'GET').toUpperCase(),
      action: $form.attr('action') || '',
      enctype: $form.attr('enctype') || 'application/x-www-form-urlencoded',
      novalidate: $form.attr('novalidate') !== undefined,
      fields,
      fieldCount: fields.length,
      multiStep: this.isMultiStepForm($form),
      hasFileInput: fields.some(f => f.type === 'file'),
      hasPassword: fields.some(f => f.type === 'password'),
      submitButton: this.extractSubmitButton($form),
      resetButton: this.extractResetButton($form),
      class: $form.attr('class') || null
    };

    // Detect CSRF token if requested
    if (options.detectCSRF) {
      const csrfField = this.detectCSRFToken($form, fields);
      if (csrfField) {
        formData.csrfField = csrfField;
        this.stats.formsWithCSRF++;
      }
    }

    // Detect multi-step indicator
    if (formData.multiStep) {
      this.stats.multiStepFormsDetected++;
    }

    return formData;
  }

  /**
   * Infer field type from input type attribute
   *
   * @param {string} inputType - HTML input type
   * @returns {string} Normalized field type
   *
   * @private
   */
  normalizeFieldType(inputType) {
    const typeMap = {
      'text': 'text',
      'password': 'password',
      'email': 'email',
      'number': 'number',
      'tel': 'tel',
      'url': 'url',
      'search': 'search',
      'date': 'date',
      'datetime': 'datetime',
      'datetime-local': 'datetime-local',
      'month': 'month',
      'time': 'time',
      'week': 'week',
      'color': 'color',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'range': 'range',
      'file': 'file',
      'hidden': 'hidden',
      'submit': 'submit',
      'reset': 'reset',
      'button': 'button'
    };

    return typeMap[inputType.toLowerCase()] || 'text';
  }

  /**
   * Check if form requires multi-step submission
   *
   * @param {Object} $form - Cheerio form element
   * @returns {boolean} True if form appears to be multi-step
   *
   * @private
   */
  isMultiStepForm($form) {
    // Check for step indicators
    const hasStepIndicator = $form.find('[class*="step"], [class*="wizard"], [class*="page"]').length > 0;

    // Check for multiple fieldsets with legend
    const fieldsetCount = $form.find('fieldset').length;

    // Check for navigation buttons (prev/next)
    const hasNavButtons = $form.find('[value*="next"], [value*="prev"], [value*="back"]').length > 0;

    // Check for progress bar
    const hasProgressBar = $form.find('[class*="progress"], [class*="progress-bar"]').length > 0;

    return hasStepIndicator || fieldsetCount > 1 || hasNavButtons || hasProgressBar;
  }

  /**
   * Detect CSRF token field
   *
   * @param {Object} $form - Cheerio form element
   * @param {Array<Object>} fields - Form fields
   * @returns {Object|null} CSRF field or null
   *
   * @private
   */
  detectCSRFToken($form, fields) {
    // Common CSRF token field names
    const csrfNames = [
      'csrf', '_csrf', 'csrf_token', '_csrf_token',
      'token', '_token', '__token__',
      'authenticity_token', '_authenticity_token',
      'nonce', '_nonce', '__nonce__',
      'xsrf-token', 'x-csrf-token'
    ];

    for (const field of fields) {
      const name = (field.name || '').toLowerCase();
      if (csrfNames.some(csrfName => name.includes(csrfName))) {
        return {
          name: field.name,
          value: field.value,
          type: field.type
        };
      }
    }

    // Also check for meta tags
    const metaToken = $form.closest('form').parent().find('meta[name="csrf-token"], meta[name="_csrf"], meta[name="token"]');
    if (metaToken.length > 0) {
      return {
        source: 'meta',
        name: metaToken.attr('name'),
        value: metaToken.attr('content')
      };
    }

    return null;
  }

  /**
   * Extract submit button data
   *
   * @param {Object} $form - Cheerio form element
   * @returns {Object|null} Submit button data or null
   *
   * @private
   */
  extractSubmitButton($form) {
    const $submit = $form.find('button[type="submit"], input[type="submit"]').first();
    if ($submit.length > 0) {
      return {
        text: $submit.text() || $submit.val() || 'Submit',
        name: $submit.attr('name') || null,
        value: $submit.attr('value') || null,
        class: $submit.attr('class') || null
      };
    }
    return null;
  }

  /**
   * Extract reset button data
   *
   * @param {Object} $form - Cheerio form element
   * @returns {Object|null} Reset button data or null
   *
   * @private
   */
  extractResetButton($form) {
    const $reset = $form.find('button[type="reset"], input[type="reset"]').first();
    if ($reset.length > 0) {
      return {
        text: $reset.text() || $reset.val() || 'Reset',
        name: $reset.attr('name') || null,
        value: $reset.attr('value') || null
      };
    }
    return null;
  }

  /**
   * Get detector statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalFormsDetected: 0,
      totalFieldsDetected: 0,
      multiStepFormsDetected: 0,
      formsWithCSRF: 0
    };
  }
}

module.exports = { FormDetector };
