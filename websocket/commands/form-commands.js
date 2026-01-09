/**
 * WebSocket Commands for Smart Form Filling
 *
 * @module websocket/commands/form-commands
 */

const { SmartFormFiller, FIELD_TYPES } = require('../../forms/smart-form-filler');

// Global form filler instance
let formFiller = null;

/**
 * Register form-related WebSocket commands
 */
function registerFormCommands(server, mainWindow) {
  /**
   * Analyze all forms on the current page
   *
   * Command: analyze_forms
   * Response: { forms: Form[] }
   */
  server.registerCommand('analyze_forms', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      const forms = await formFiller.analyzeForms();

      return {
        success: true,
        forms: forms.map(form => ({
          selector: form.selector,
          action: form.action,
          method: form.method,
          fieldCount: form.fields.length,
          fillableFieldCount: form.getFillableFields().length,
          requiredFieldCount: form.getRequiredFields().length,
          hasSubmitButton: form.submitButton !== null,
          isMultiStep: form.isMultiStep,
          currentStep: form.currentStep,
          totalSteps: form.totalSteps,
          hasCaptcha: form.hasCaptcha,
          hasHoneypots: form.hasHoneypots,
          fields: form.fields.map(f => ({
            selector: f.selector,
            name: f.name,
            id: f.id,
            type: f.type,
            detectedType: f.detectedType,
            label: f.label,
            placeholder: f.placeholder,
            required: f.required,
            visible: f.visible,
            isHoneypot: f.isHoneypot(),
            isCaptcha: f.isCaptcha(),
            options: f.options
          }))
        })),
        stats: formFiller.getStats()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Analyze a specific form
   *
   * Command: analyze_form
   * Params: { selector: string }
   * Response: { form: Form }
   */
  server.registerCommand('analyze_form', async (params) => {
    try {
      if (!params.selector) {
        throw new Error('selector is required');
      }

      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      const forms = await formFiller.analyzeForms();
      const form = forms.find(f => f.selector === params.selector);

      if (!form) {
        throw new Error(`Form not found: ${params.selector}`);
      }

      return {
        success: true,
        form: {
          selector: form.selector,
          action: form.action,
          method: form.method,
          fieldCount: form.fields.length,
          fillableFieldCount: form.getFillableFields().length,
          requiredFieldCount: form.getRequiredFields().length,
          hasSubmitButton: form.submitButton !== null,
          submitButton: form.submitButton,
          isMultiStep: form.isMultiStep,
          currentStep: form.currentStep,
          totalSteps: form.totalSteps,
          hasCaptcha: form.hasCaptcha,
          hasHoneypots: form.hasHoneypots,
          fields: form.fields.map(f => ({
            selector: f.selector,
            name: f.name,
            id: f.id,
            type: f.type,
            detectedType: f.detectedType,
            label: f.label,
            placeholder: f.placeholder,
            required: f.required,
            pattern: f.pattern,
            minLength: f.minLength,
            maxLength: f.maxLength,
            autocomplete: f.autocomplete,
            visible: f.visible,
            isHoneypot: f.isHoneypot(),
            isCaptcha: f.isCaptcha(),
            options: f.options
          }))
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Fill a form with provided data
   *
   * Command: fill_form
   * Params: {
   *   selector: string,
   *   data: { [fieldName]: value },
   *   options?: { submit?, validate?, skipHoneypots?, skipCaptchas?, humanLike? }
   * }
   * Response: { filled: [], skipped: [], failed: [], validationErrors?: [], submitted?: boolean }
   */
  server.registerCommand('fill_form', async (params) => {
    try {
      if (!params.selector) {
        throw new Error('selector is required');
      }
      if (!params.data || typeof params.data !== 'object') {
        throw new Error('data must be an object');
      }

      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      const result = await formFiller.fillForm(
        params.selector,
        params.data,
        params.options || {}
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Fill form with smart value generation
   *
   * Command: fill_form_smart
   * Params: {
   *   selector: string,
   *   profile?: { firstName?, lastName?, email?, phone?, ...},
   *   options?: { submit?, validate?, skipHoneypots?, skipCaptchas?, humanLike? }
   * }
   * Response: { filled: [], skipped: [], failed: [], validationErrors?: [], submitted?: boolean }
   */
  server.registerCommand('fill_form_smart', async (params) => {
    try {
      if (!params.selector) {
        throw new Error('selector is required');
      }

      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      // Get form analysis
      const forms = await formFiller.analyzeForms();
      const form = forms.find(f => f.selector === params.selector);

      if (!form) {
        throw new Error(`Form not found: ${params.selector}`);
      }

      // Generate values based on detected field types
      const data = {};
      const profile = params.profile || {};

      for (const field of form.getFillableFields()) {
        let value = null;

        switch (field.detectedType) {
          case FIELD_TYPES.FIRST_NAME:
            value = profile.firstName || 'John';
            break;
          case FIELD_TYPES.LAST_NAME:
            value = profile.lastName || 'Doe';
            break;
          case FIELD_TYPES.FULL_NAME:
            value = `${profile.firstName || 'John'} ${profile.lastName || 'Doe'}`;
            break;
          case FIELD_TYPES.EMAIL:
            value = profile.email || 'john.doe@example.com';
            break;
          case FIELD_TYPES.TEL:
            value = profile.phone || '555-123-4567';
            break;
          case FIELD_TYPES.ADDRESS:
            value = profile.address || '123 Main St';
            break;
          case FIELD_TYPES.CITY:
            value = profile.city || 'New York';
            break;
          case FIELD_TYPES.STATE:
            value = profile.state || 'NY';
            break;
          case FIELD_TYPES.ZIP:
            value = profile.zip || '10001';
            break;
          case FIELD_TYPES.COUNTRY:
            value = profile.country || 'United States';
            break;
          case FIELD_TYPES.PASSWORD:
            value = profile.password || 'Test123!@#';
            break;
          case FIELD_TYPES.DATE_OF_BIRTH:
            value = profile.dateOfBirth || '1990-01-01';
            break;
          case FIELD_TYPES.SELECT:
            // Pick first non-empty option
            if (field.options && field.options.length > 0) {
              const validOptions = field.options.filter(opt => opt.value && opt.value !== '');
              if (validOptions.length > 0) {
                value = validOptions[0].value;
              }
            }
            break;
          case FIELD_TYPES.CHECKBOX:
            value = true;
            break;
          case FIELD_TYPES.RADIO:
            if (field.options && field.options.length > 0) {
              value = field.options[0].value;
            }
            break;
          default:
            // Use profile data if available
            if (field.name && profile[field.name]) {
              value = profile[field.name];
            } else if (field.type === 'text') {
              value = 'Test Value';
            }
        }

        if (value !== null) {
          data[field.name || field.id] = value;
        }
      }

      const result = await formFiller.fillForm(
        params.selector,
        data,
        params.options || {}
      );

      return {
        success: true,
        ...result,
        generatedData: data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get form field types
   *
   * Command: get_field_types
   * Response: { fieldTypes: string[] }
   */
  server.registerCommand('get_field_types', async (params) => {
    return {
      success: true,
      fieldTypes: Object.values(FIELD_TYPES)
    };
  });

  /**
   * Configure form filler options
   *
   * Command: configure_form_filler
   * Params: { respectHoneypots?, skipCaptchas?, humanLikeSpeed?, detectValidation?, maxRetries? }
   * Response: { config: {} }
   */
  server.registerCommand('configure_form_filler', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents, params);
      } else {
        formFiller.options = { ...formFiller.options, ...params };
      }

      return {
        success: true,
        config: formFiller.options
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get form filler statistics
   *
   * Command: get_form_filler_stats
   * Response: { stats: {} }
   */
  server.registerCommand('get_form_filler_stats', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      return {
        success: true,
        stats: formFiller.getStats()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Reset form filler statistics
   *
   * Command: reset_form_filler_stats
   * Response: { success: true }
   */
  server.registerCommand('reset_form_filler_stats', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      formFiller.resetStats();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Detect honeypot fields on the page
   *
   * Command: detect_honeypots
   * Response: { honeypots: [] }
   */
  server.registerCommand('detect_honeypots', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      const forms = await formFiller.analyzeForms();
      const honeypots = [];

      for (const form of forms) {
        const formHoneypots = form.fields.filter(f => f.isHoneypot());
        if (formHoneypots.length > 0) {
          honeypots.push({
            formSelector: form.selector,
            fields: formHoneypots.map(f => ({
              selector: f.selector,
              name: f.name,
              id: f.id,
              reason: !f.visible ? 'hidden' : 'suspicious_name'
            }))
          });
        }
      }

      return {
        success: true,
        honeypots: honeypots,
        totalCount: honeypots.reduce((sum, h) => sum + h.fields.length, 0)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Detect CAPTCHAs on the page
   *
   * Command: detect_captchas
   * Response: { captchas: [] }
   */
  server.registerCommand('detect_captchas', async (params) => {
    try {
      if (!formFiller) {
        formFiller = new SmartFormFiller(mainWindow.webContents);
      }

      const forms = await formFiller.analyzeForms();
      const captchas = [];

      for (const form of forms) {
        if (form.hasCaptcha) {
          const captchaFields = form.fields.filter(f => f.isCaptcha());
          captchas.push({
            formSelector: form.selector,
            fields: captchaFields.map(f => ({
              selector: f.selector,
              name: f.name,
              type: f.type
            }))
          });
        }
      }

      return {
        success: true,
        captchas: captchas,
        totalCount: captchas.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerFormCommands };
