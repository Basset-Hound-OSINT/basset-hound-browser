/**
 * Tests for FormDetector module
 * @file tests/unit/extraction-form-detector.test.js
 */

const { FormDetector } = require('../../extraction/form-detector');

describe('FormDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FormDetector();
  });

  describe('detectForms()', () => {
    test('detects form elements', () => {
      const html = `
        <html>
          <body>
            <form id="login-form" method="post" action="/login">
              <input type="text" name="username">
              <input type="password" name="password">
              <button type="submit">Login</button>
            </form>
          </body>
        </html>
      `;

      const forms = detector.detectForms(html);
      expect(forms).toHaveLength(1);
      expect(forms[0].id).toBe('login-form');
      expect(forms[0].method).toBe('POST');
      expect(forms[0].action).toBe('/login');
    });

    test('extracts form fields', () => {
      const html = `
        <form>
          <input type="text" name="name" required>
          <input type="email" name="email">
          <textarea name="message"></textarea>
          <select name="country">
            <option value="us">USA</option>
            <option value="uk">UK</option>
          </select>
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].fieldCount).toBe(4);
      expect(forms[0].fields).toHaveLength(4);
    });

    test('infers field types', () => {
      const html = `
        <form>
          <input type="text" name="username">
          <input type="password" name="pass">
          <input type="email" name="email">
          <input type="number" name="age">
          <input type="checkbox" name="agree">
          <input type="radio" name="choice">
          <input type="file" name="attachment">
        </form>
      `;

      const forms = detector.detectForms(html);
      const fields = forms[0].fields;

      expect(fields.find(f => f.name === 'username').type).toBe('text');
      expect(fields.find(f => f.name === 'pass').type).toBe('password');
      expect(fields.find(f => f.name === 'email').type).toBe('email');
      expect(fields.find(f => f.name === 'age').type).toBe('number');
      expect(fields.find(f => f.name === 'agree').type).toBe('checkbox');
      expect(fields.find(f => f.name === 'choice').type).toBe('radio');
      expect(fields.find(f => f.name === 'attachment').type).toBe('file');
    });

    test('detects required and disabled fields', () => {
      const html = `
        <form>
          <input type="text" name="required-field" required>
          <input type="text" name="disabled-field" disabled>
          <input type="text" name="readonly-field" readonly>
        </form>
      `;

      const forms = detector.detectForms(html);
      const fields = forms[0].fields;

      expect(fields.find(f => f.name === 'required-field').required).toBe(true);
      expect(fields.find(f => f.name === 'disabled-field').disabled).toBe(true);
      expect(fields.find(f => f.name === 'readonly-field').readonly).toBe(true);
    });

    test('extracts select options', () => {
      const html = `
        <form>
          <select name="country">
            <option value="us" selected>United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
          </select>
        </form>
      `;

      const forms = detector.detectForms(html);
      const selectField = forms[0].fields.find(f => f.type === 'select');

      expect(selectField.options).toHaveLength(3);
      expect(selectField.options[0].value).toBe('us');
      expect(selectField.options[0].selected).toBe(true);
    });

    test('detects file upload forms', () => {
      const html = `
        <form enctype="multipart/form-data">
          <input type="file" name="document">
          <input type="submit">
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].hasFileInput).toBe(true);
      expect(forms[0].enctype).toBe('multipart/form-data');
    });

    test('detects password forms', () => {
      const html = `
        <form>
          <input type="email" name="email">
          <input type="password" name="password">
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].hasPassword).toBe(true);
    });

    test('detects multi-step forms', () => {
      const html = `
        <form>
          <fieldset>
            <legend>Step 1</legend>
            <input type="text" name="field1">
          </fieldset>
          <fieldset>
            <legend>Step 2</legend>
            <input type="text" name="field2">
          </fieldset>
          <button value="next">Next</button>
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].multiStep).toBe(true);
    });

    test('detects CSRF tokens', () => {
      const html = `
        <form>
          <input type="hidden" name="csrf_token" value="abc123xyz">
          <input type="text" name="username">
          <button type="submit">Submit</button>
        </form>
      `;

      const forms = detector.detectForms(html, { detectCSRF: true });
      expect(forms[0]).toHaveProperty('csrfField');
      expect(forms[0].csrfField.name).toBe('csrf_token');
      expect(forms[0].csrfField.value).toBe('abc123xyz');
    });

    test('ignores hidden fields by default option', () => {
      const html = `
        <form>
          <input type="hidden" name="hidden-field" value="secret">
          <input type="text" name="visible-field">
        </form>
      `;

      const visibleForms = detector.detectForms(html, { includeHidden: false });
      expect(visibleForms[0].fields).toHaveLength(1);
      expect(visibleForms[0].fields[0].name).toBe('visible-field');
    });

    test('includes hidden fields when requested', () => {
      const html = `
        <form>
          <input type="hidden" name="token">
          <input type="text" name="username">
        </form>
      `;

      const forms = detector.detectForms(html, { includeHidden: true });
      expect(forms[0].fieldCount).toBe(2);
    });

    test('returns empty array for invalid HTML', () => {
      expect(detector.detectForms(null)).toEqual([]);
      expect(detector.detectForms(undefined)).toEqual([]);
      expect(detector.detectForms(123)).toEqual([]);
    });

    test('updates statistics', () => {
      const html = `
        <form>
          <input type="text" name="field1">
          <input type="text" name="field2">
          <input type="hidden" name="csrf">
        </form>
      `;

      detector.detectForms(html);
      const stats = detector.getStats();

      expect(stats.totalFormsDetected).toBe(1);
      expect(stats.totalFieldsDetected).toBeGreaterThanOrEqual(2);
    });

    test('extracts submit buttons', () => {
      const html = `
        <form>
          <input type="text" name="username">
          <button type="submit">Sign In</button>
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].submitButton).toBeDefined();
      expect(forms[0].submitButton.text).toBe('Sign In');
    });

    test('extracts reset buttons', () => {
      const html = `
        <form>
          <input type="text" name="username">
          <button type="reset">Clear</button>
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms[0].resetButton).toBeDefined();
      expect(forms[0].resetButton.text).toBe('Clear');
    });

    test('handles textarea fields', () => {
      const html = `
        <form>
          <textarea name="message" rows="5" cols="40"></textarea>
        </form>
      `;

      const forms = detector.detectForms(html);
      const textarea = forms[0].fields.find(f => f.type === 'textarea');
      expect(textarea).toBeDefined();
      expect(textarea.rows).toBe('5');
      expect(textarea.cols).toBe('40');
    });

    test('handles multiple forms', () => {
      const html = `
        <form id="form1">
          <input type="text">
        </form>
        <form id="form2">
          <input type="email">
        </form>
      `;

      const forms = detector.detectForms(html);
      expect(forms).toHaveLength(2);
    });
  });

  describe('statistics', () => {
    test('resetStats() clears statistics', () => {
      const html = `<form><input type="text"></form>`;
      detector.detectForms(html);
      expect(detector.getStats().totalFormsDetected).toBeGreaterThan(0);

      detector.resetStats();
      expect(detector.getStats().totalFormsDetected).toBe(0);
    });

    test('getStats() returns current statistics', () => {
      const stats = detector.getStats();
      expect(stats).toHaveProperty('totalFormsDetected');
      expect(stats).toHaveProperty('totalFieldsDetected');
      expect(stats).toHaveProperty('multiStepFormsDetected');
      expect(stats).toHaveProperty('formsWithCSRF');
    });
  });

  describe('error handling', () => {
    test('handles malformed HTML', () => {
      const html = `<form><input type="text"<body>`;
      const forms = detector.detectForms(html);
      expect(Array.isArray(forms)).toBe(true);
    });

    test('handles empty HTML', () => {
      expect(detector.detectForms('')).toEqual([]);
    });
  });
});
