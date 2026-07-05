"""
Unit tests for Basset Hound Browser Python Client - HTML Sanitization

Tests the HTML sanitization functionality including:
- Removal of sensitive form fields (passwords, credit cards, etc.)
- Masking of input values
- Removal of dangerous attributes and event handlers
- Removal of script tags and inline JavaScript
- Preservation of HTML structure
- Form field analysis
"""

import pytest
from basset_hound.html_sanitizer import (
    HTMLSanitizer,
    SensitiveFieldRemover,
    FormFieldAnalyzer,
    FormFieldParser,
    sanitize_html_export
)


class TestSensitiveFieldRemover:
    """Test SensitiveFieldRemover functionality."""

    def test_remove_password_field(self):
        """Test removal of password input field."""
        html = '<form><input type="password" name="pwd" value="secret123"></form>'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert '<input type="password"' not in result
        assert 'secret123' not in result
        assert '<form>' in result
        assert '</form>' in result

    def test_remove_password_field_with_pattern_matching(self):
        """Test removal of fields with password-like names."""
        html = '<input type="text" name="user_password">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'user_password' not in result
        assert 'type="text"' not in result

    def test_remove_credit_card_field(self):
        """Test removal of credit card fields."""
        html = '<input type="text" name="credit_card" value="4111111111111111">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'credit_card' not in result
        assert '4111111111111111' not in result

    def test_remove_cvv_field(self):
        """Test removal of CVV fields."""
        html = '<input type="text" name="cvv" value="123">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'cvv' not in result
        assert 'type="text"' not in result

    def test_remove_hidden_fields(self):
        """Test removal of hidden input fields."""
        html = '<input type="hidden" name="token" value="abc123">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'hidden' not in result
        assert 'token' not in result

    def test_preserve_safe_fields(self):
        """Test that safe fields are preserved."""
        html = '<form><input type="text" name="username"><input type="email" name="email"></form>'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'username' in result
        assert 'email' in result
        assert 'type="text"' in result
        assert 'type="email"' in result

    def test_remove_field_values(self):
        """Test that input values are removed even for safe fields."""
        html = '<input type="text" name="username" value="john_doe">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        # Value should be removed (no values in output)
        assert 'value=' not in result

    def test_remove_event_handlers(self):
        """Test removal of event handler attributes."""
        html = '<input type="text" onclick="alert(\'clicked\')" name="test">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'onclick' not in result
        assert 'alert' not in result

    def test_remove_script_tags(self):
        """Test removal of script tags."""
        html = '<html><body><script>alert("xss")</script><p>Content</p></body></html>'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert '<script>' not in result.lower()
        assert 'alert' not in result
        assert '<p>Content</p>' in result

    def test_get_removed_fields_info(self):
        """Test that removed field information is captured."""
        html = '<input type="password" name="pwd" id="password_field">'
        remover = SensitiveFieldRemover()
        remover.feed(html)
        removed = remover.get_removed_fields()

        assert len(removed) > 0
        assert 'password' in list(removed.keys())[0] or 'pwd' in list(removed.keys())[0]

    def test_nested_forms(self):
        """Test handling of nested elements."""
        html = '''
        <form>
            <fieldset>
                <input type="text" name="username">
                <input type="password" name="password">
            </fieldset>
        </form>
        '''
        remover = SensitiveFieldRemover()
        remover.feed(html)
        result = remover.get_sanitized_html()

        assert 'username' in result
        assert 'password' not in result
        assert '<fieldset>' in result
        assert '</fieldset>' in result


class TestHTMLSanitizer:
    """Test main HTMLSanitizer class."""

    def test_sanitize_basic_html(self):
        """Test sanitization of basic HTML."""
        html = '<html><body><p>Test</p></body></html>'
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert result['html'] is not None
        assert '<p>Test</p>' in result['html']
        assert result['fields_removed'] == 0

    def test_sanitize_form_with_password(self):
        """Test sanitization of form with password field."""
        html = '''
        <form>
            <input type="text" name="username">
            <input type="password" name="password" value="secret">
            <input type="submit">
        </form>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'username' in result['html']
        assert 'password' not in result['html']
        assert 'secret' not in result['html']
        assert result['fields_removed'] > 0

    def test_sanitize_returns_report(self):
        """Test that sanitize_html returns a detailed report."""
        html = '''
        <input type="password" name="pwd">
        <input type="text" onclick="alert('xss')" name="test">
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'html' in result
        assert 'removed_fields' in result
        assert 'sanitization_report' in result
        assert 'original_size' in result
        assert 'sanitized_size' in result
        assert 'fields_removed' in result

    def test_sanitization_report_metrics(self):
        """Test sanitization report metrics."""
        html = '<html><body><input type="password" name="pwd" value="secret"></body></html>'
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        report = result['sanitization_report']
        assert report['total_sensitive_fields_removed'] > 0
        assert report['size_reduction_bytes'] > 0
        assert 'size_reduction_percent' in report

    def test_remove_script_tags_from_html(self):
        """Test removal of script tags."""
        html = '''
        <html>
        <head><script>alert('xss')</script></head>
        <body><p>Content</p></body>
        </html>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert '<script>' not in result['html'].lower()
        assert 'alert' not in result['html']
        assert '<p>Content</p>' in result['html']

    def test_remove_event_handlers(self):
        """Test removal of event handlers from HTML."""
        html = '''
        <div onclick="alert('xss')">
            <button onmouseover="doEvil()">Click</button>
        </div>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'onclick' not in result['html']
        assert 'onmouseover' not in result['html']
        assert 'alert' not in result['html']
        assert 'doEvil' not in result['html']

    def test_remove_javascript_protocol(self):
        """Test removal of javascript: protocol."""
        html = '<a href="javascript:alert(\'xss\')">Click</a>'
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'javascript:' not in result['html']
        assert '<a' in result['html']

    def test_empty_html(self):
        """Test handling of empty HTML."""
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html('')

        assert result['html'] == ''
        assert result['fields_removed'] == 0
        assert result['original_size'] == 0

    def test_none_html_handling(self):
        """Test handling of None HTML."""
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(None)

        assert result['html'] == ''
        assert result['fields_removed'] == 0

    def test_remove_meta_tags_option(self):
        """Test remove_meta_tags option."""
        html = '''
        <html>
        <head>
            <meta name="description" content="Page description">
            <meta name="author" content="John Doe">
            <title>Page</title>
        </head>
        <body>Content</body>
        </html>
        '''
        sanitizer = HTMLSanitizer(remove_meta_tags=True)
        result = sanitizer.sanitize_html(html)

        # Author meta tag should be removed
        assert 'John Doe' not in result['html']

    def test_size_reduction_tracking(self):
        """Test size reduction metrics."""
        html = '<input type="password" name="pwd" value="verylongsecretpassword123456789">'
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert result['original_size'] > result['sanitized_size']
        assert result['sanitization_report']['size_reduction_bytes'] > 0

    def test_preserve_html_structure(self):
        """Test that HTML structure is preserved."""
        html = '''
        <html>
            <head><title>Test</title></head>
            <body>
                <div class="container">
                    <p>Paragraph 1</p>
                    <p>Paragraph 2</p>
                </div>
            </body>
        </html>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert '<html>' in result['html']
        assert '<body>' in result['html']
        assert '<div' in result['html']
        assert 'Paragraph 1' in result['html']
        assert 'Paragraph 2' in result['html']


class TestFormFieldAnalyzer:
    """Test form field analysis functionality."""

    def test_analyze_simple_form(self):
        """Test analyzing a simple form."""
        html = '''
        <form id="login">
            <input type="text" name="username">
            <input type="password" name="password">
            <input type="submit">
        </form>
        '''
        analyzer = FormFieldAnalyzer()
        result = analyzer.analyze_html(html)

        assert result['total_forms'] == 1
        assert result['total_fields'] >= 2
        assert result['sensitive_count'] > 0


    def test_analyze_multiple_forms(self):
        """Test analyzing multiple forms."""
        html = '''
        <form id="form1">
            <input type="text" name="field1">
        </form>
        <form id="form2">
            <input type="text" name="field2">
        </form>
        '''
        analyzer = FormFieldAnalyzer()
        result = analyzer.analyze_html(html)

        assert result['total_forms'] == 2

    def test_extract_form_metadata(self):
        """Test extraction of form metadata."""
        html = '''
        <form method="POST" action="/login">
            <input type="text" name="user">
        </form>
        '''
        analyzer = FormFieldAnalyzer()
        result = analyzer.analyze_html(html)

        assert len(result['forms']) > 0
        form = result['forms'][0]
        assert form['method'] == 'POST'
        assert form['action'] == '/login'


class TestFormFieldParser:
    """Test FormFieldParser functionality."""

    def test_parse_form_with_fields(self):
        """Test parsing form with fields."""
        html = '''
        <form name="testform" action="/submit">
            <input type="text" name="username" id="user_input">
            <input type="email" name="email">
        </form>
        '''
        parser = FormFieldParser()
        parser.feed(html)

        assert len(parser.forms) == 1
        assert parser.forms[0]['name'] == 'testform'
        assert parser.forms[0]['action'] == '/submit'
        assert len(parser.fields) == 2

    def test_parse_required_fields(self):
        """Test parsing of required attribute."""
        html = '<form><input type="text" name="field1" required><input type="text" name="field2"></form>'
        parser = FormFieldParser()
        parser.feed(html)

        assert parser.fields[0]['required'] is True
        assert parser.fields[1]['required'] is False

    def test_parse_nested_form_elements(self):
        """Test parsing nested form elements."""
        html = '''
        <form>
            <fieldset>
                <input type="text" name="field1">
                <input type="text" name="field2">
            </fieldset>
        </form>
        '''
        parser = FormFieldParser()
        parser.feed(html)

        assert len(parser.fields) == 2
        assert all(f['form_id'] == 0 for f in parser.fields)


class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_sanitize_html_export_function(self):
        """Test the sanitize_html_export convenience function."""
        html = '<input type="password" name="pwd"><p>Text</p>'
        result = sanitize_html_export(html)

        assert 'password' not in result['html']
        assert '<p>Text</p>' in result['html']
        assert result['fields_removed'] > 0

    def test_sanitize_with_options(self):
        """Test sanitize_html_export with options."""
        html = '<html><head><style>body{}</style></head><body>Content</body></html>'
        result = sanitize_html_export(html, remove_style_tags=True)

        # Verify result structure
        assert 'html' in result
        assert result['html'] is not None


class TestRealWorldScenarios:
    """Test real-world HTML sanitization scenarios."""

    def test_banking_form_sanitization(self):
        """Test sanitization of a banking form."""
        html = '''
        <form method="POST" action="/login">
            <input type="text" name="account_number" value="123456789">
            <input type="password" name="password" value="mysecret">
            <input type="text" name="pin" value="1234">
            <input type="submit" value="Login">
        </form>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'account_number' not in result['html']
        assert 'password' not in result['html']
        assert 'pin' not in result['html']
        assert '123456789' not in result['html']
        assert 'mysecret' not in result['html']
        assert '1234' not in result['html']

    def test_ecommerce_checkout_sanitization(self):
        """Test sanitization of e-commerce checkout form."""
        html = '''
        <form id="checkout">
            <input type="text" name="first_name">
            <input type="text" name="last_name">
            <input type="text" name="credit_card_number">
            <input type="text" name="cvv">
            <input type="text" name="expiration_date">
            <input type="email" name="email">
            <input type="submit">
        </form>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'credit_card_number' not in result['html']
        assert 'cvv' not in result['html']
        assert 'first_name' in result['html']
        assert 'last_name' in result['html']
        assert 'email' in result['html']

    def test_login_form_with_xss_sanitization(self):
        """Test sanitization of login form with XSS attempts."""
        html = '''
        <form onsubmit="exfiltrate()">
            <input type="text" name="username" onchange="track()">
            <input type="password" name="password">
            <button onclick="javascript:alert('xss')">Login</button>
        </form>
        '''
        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        assert 'password' not in result['html']
        assert 'onsubmit' not in result['html']
        assert 'onchange' not in result['html']
        assert 'onclick' not in result['html']
        assert 'exfiltrate' not in result['html']
        assert 'track' not in result['html']
        assert 'javascript:' not in result['html']

    def test_large_html_document_sanitization(self):
        """Test sanitization of large HTML document."""
        # Create a large HTML document
        form_fields = '\n'.join([
            f'<input type="text" name="field_{i}" value="value_{i}">'
            for i in range(100)
        ])
        sensitive_fields = '\n'.join([
            f'<input type="password" name="password_{i}" value="secret_{i}">'
            for i in range(10)
        ])

        html = f'''
        <html>
            <head><title>Large Form</title></head>
            <body>
                <form>
                    {form_fields}
                    {sensitive_fields}
                </form>
            </body>
        </html>
        '''

        sanitizer = HTMLSanitizer()
        result = sanitizer.sanitize_html(html)

        # All password fields should be removed
        for i in range(10):
            assert f'password_{i}' not in result['html']
            assert f'secret_{i}' not in result['html']

        # Regular fields should be preserved
        for i in range(100):
            assert f'field_{i}' in result['html']

        assert result['fields_removed'] >= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
