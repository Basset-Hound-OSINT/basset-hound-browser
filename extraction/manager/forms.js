/**
 * Basset Hound Browser - Form Extractor
 * Extracts forms and their input/textarea/select/button fields from HTML.
 * Pure function delegated from ExtractionManager; receives the manager instance as `self`
 * for shared helpers (extractAttribute, hasAttribute, decodeHtmlEntities).
 *
 * @module extraction/manager/forms
 */

/**
 * Extract all forms and their fields from HTML
 * @param {string} html - HTML content
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Object} Extracted form data
 */
function extractForms(html, self) {
  const result = {
    success: true,
    data: [],
    count: 0,
    fieldCount: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.formExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Find all form tags
    const formRegex = /<form\s+[^>]*>([\s\S]*?)<\/form>/gi;
    let formMatch;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const fullTag = formMatch[0];
      const formStartTag = fullTag.match(/<form\s+[^>]*>/i)[0];
      const formContent = formMatch[1];

      const form = {
        action: self.extractAttribute(formStartTag, 'action') || '',
        method: (self.extractAttribute(formStartTag, 'method') || 'get').toUpperCase(),
        enctype: self.extractAttribute(formStartTag, 'enctype') || 'application/x-www-form-urlencoded',
        name: self.extractAttribute(formStartTag, 'name'),
        id: self.extractAttribute(formStartTag, 'id'),
        target: self.extractAttribute(formStartTag, 'target'),
        autocomplete: self.extractAttribute(formStartTag, 'autocomplete'),
        novalidate: self.hasAttribute(formStartTag, 'novalidate'),
        fields: [],
        buttons: []
      };

      // Extract input fields
      const inputRegex = /<input\s+[^>]*>/gi;
      let inputMatch;

      while ((inputMatch = inputRegex.exec(formContent)) !== null) {
        const inputTag = inputMatch[0];
        const field = {
          tag: 'input',
          type: self.extractAttribute(inputTag, 'type') || 'text',
          name: self.extractAttribute(inputTag, 'name'),
          id: self.extractAttribute(inputTag, 'id'),
          value: self.extractAttribute(inputTag, 'value'),
          placeholder: self.extractAttribute(inputTag, 'placeholder'),
          required: self.hasAttribute(inputTag, 'required'),
          disabled: self.hasAttribute(inputTag, 'disabled'),
          readonly: self.hasAttribute(inputTag, 'readonly'),
          pattern: self.extractAttribute(inputTag, 'pattern'),
          min: self.extractAttribute(inputTag, 'min'),
          max: self.extractAttribute(inputTag, 'max'),
          minlength: self.extractAttribute(inputTag, 'minlength'),
          maxlength: self.extractAttribute(inputTag, 'maxlength'),
          autocomplete: self.extractAttribute(inputTag, 'autocomplete')
        };

        // Handle specific input types
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = self.hasAttribute(inputTag, 'checked');
        }

        if (field.type === 'submit' || field.type === 'reset' || field.type === 'button') {
          form.buttons.push(field);
        } else {
          form.fields.push(field);
          result.fieldCount++;
        }
      }

      // Extract textarea fields
      const textareaRegex = /<textarea\s+[^>]*>([\s\S]*?)<\/textarea>/gi;
      let textareaMatch;

      while ((textareaMatch = textareaRegex.exec(formContent)) !== null) {
        const textareaTag = textareaMatch[0];
        const field = {
          tag: 'textarea',
          type: 'textarea',
          name: self.extractAttribute(textareaTag, 'name'),
          id: self.extractAttribute(textareaTag, 'id'),
          value: self.decodeHtmlEntities(textareaMatch[1]),
          placeholder: self.extractAttribute(textareaTag, 'placeholder'),
          required: self.hasAttribute(textareaTag, 'required'),
          disabled: self.hasAttribute(textareaTag, 'disabled'),
          readonly: self.hasAttribute(textareaTag, 'readonly'),
          rows: self.extractAttribute(textareaTag, 'rows'),
          cols: self.extractAttribute(textareaTag, 'cols'),
          maxlength: self.extractAttribute(textareaTag, 'maxlength')
        };

        form.fields.push(field);
        result.fieldCount++;
      }

      // Extract select fields
      const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/gi;
      let selectMatch;

      while ((selectMatch = selectRegex.exec(formContent)) !== null) {
        const selectTag = selectMatch[0];
        const selectStartTag = selectTag.match(/<select\s+[^>]*>/i)[0];
        const selectContent = selectMatch[1];

        const field = {
          tag: 'select',
          type: 'select',
          name: self.extractAttribute(selectStartTag, 'name'),
          id: self.extractAttribute(selectStartTag, 'id'),
          required: self.hasAttribute(selectStartTag, 'required'),
          disabled: self.hasAttribute(selectStartTag, 'disabled'),
          multiple: self.hasAttribute(selectStartTag, 'multiple'),
          options: []
        };

        // Extract options
        const optionRegex = /<option\s*[^>]*>([^<]*)<\/option>/gi;
        let optionMatch;

        while ((optionMatch = optionRegex.exec(selectContent)) !== null) {
          const optionTag = optionMatch[0];
          field.options.push({
            value: self.extractAttribute(optionTag, 'value'),
            text: self.decodeHtmlEntities(optionMatch[1].trim()),
            selected: self.hasAttribute(optionTag, 'selected'),
            disabled: self.hasAttribute(optionTag, 'disabled')
          });
        }

        form.fields.push(field);
        result.fieldCount++;
      }

      // Extract button elements
      const buttonRegex = /<button\s+[^>]*>([\s\S]*?)<\/button>/gi;
      let buttonMatch;

      while ((buttonMatch = buttonRegex.exec(formContent)) !== null) {
        const buttonTag = buttonMatch[0];
        const button = {
          tag: 'button',
          type: self.extractAttribute(buttonTag, 'type') || 'submit',
          name: self.extractAttribute(buttonTag, 'name'),
          id: self.extractAttribute(buttonTag, 'id'),
          value: self.extractAttribute(buttonTag, 'value'),
          text: self.decodeHtmlEntities(buttonMatch[1].replace(/<[^>]+>/g, '').trim()),
          disabled: self.hasAttribute(buttonTag, 'disabled')
        };

        form.buttons.push(button);
      }

      result.data.push(form);
      result.count++;
    }

    // Summary
    result.summary = {
      formCount: result.count,
      totalFields: result.fieldCount,
      methods: {
        get: result.data.filter(f => f.method === 'GET').length,
        post: result.data.filter(f => f.method === 'POST').length,
        other: result.data.filter(f => !['GET', 'POST'].includes(f.method)).length
      }
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

module.exports = { extractForms };
