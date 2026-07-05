"""
HTML Sanitization Module for Basset Hound Browser

Provides secure sanitization of HTML content exported from web pages.
Removes sensitive form fields, masks input values, and cleans dangerous attributes
to prevent information leakage during forensic analysis and data export.

Key features:
- Remove password fields and sensitive input types
- Mask input values to hide user data
- Clean dangerous HTML attributes and event handlers
- Remove sensitive meta tags and scripts
- Preserve document structure for analysis
"""

import re
from typing import Dict, List, Optional, Set, Tuple
from html.parser import HTMLParser
import logging

logger = logging.getLogger(__name__)


class SensitiveFieldRemover(HTMLParser):
    """
    HTMLParser subclass that removes sensitive form fields from HTML.

    Removes:
    - password inputs
    - credit card fields
    - social security number fields
    - authentication tokens
    - Other sensitive input types
    """

    # Input types that should be completely removed
    SENSITIVE_INPUT_TYPES = {
        'password', 'hidden', 'file', 'submit', 'reset',
        'button', 'image', 'search'  # search can contain sensitive queries
    }

    # Input names/IDs that indicate sensitive data
    SENSITIVE_PATTERNS = {
        r'(?i)(password|pwd|pass)',
        r'(?i)(credit_?card|cc_?number|card_?number)',
        r'(?i)(cvv|cvc|security_?code)',
        r'(?i)(ssn|social_?security)',
        r'(?i)(pin|security_?pin)',
        r'(?i)(token|auth_?token|api_?key)',
        r'(?i)(secret|private_?key)',
        r'(?i)(session|sessionid)',
        r'(?i)(account_?number|account_?id|acct)',
        r'(?i)(routing_?number)',
        r'(?i)(bank_?account)',
    }

    # Attributes that should be removed from all elements
    DANGEROUS_ATTRIBUTES = {
        'onload', 'onerror', 'onmouseover', 'onmouseout',
        'onclick', 'ondblclick', 'onchange', 'onfocus',
        'onblur', 'onsubmit', 'onkeydown', 'onkeyup',
        'onmousemove', 'onmouseenter', 'onmouseleave',
    }

    # Tags that should be removed entirely
    DANGEROUS_TAGS = {
        'script', 'style', 'iframe', 'object', 'embed',
        'applet', 'meta'  # Some meta tags can contain sensitive info
    }

    def __init__(self):
        super().__init__()
        self.output = []
        self.skip_content = False
        self.tag_stack = []
        self.form_field_mapping = {}  # Track removed fields for logging

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        """Handle opening tags - remove dangerous tags and sanitize attributes."""
        tag_lower = tag.lower()

        # Skip dangerous tags entirely
        if tag_lower in self.DANGEROUS_TAGS:
            self.skip_content = True
            self.tag_stack.append(tag_lower)
            return

        # Process form input fields
        if tag_lower == 'input':
            if not self._should_remove_input(attrs):
                attrs = self._sanitize_input_attrs(attrs)
            else:
                # Log removed field
                field_info = self._get_field_info(attrs)
                self.form_field_mapping[field_info['id']] = field_info
                return  # Skip this input entirely

        # Sanitize all tags
        attrs = self._sanitize_attrs(attrs)

        # Rebuild tag with sanitized attributes
        attr_str = ' '.join([f'{k}="{v}"' if v else k for k, v in attrs])
        if attr_str:
            self.output.append(f'<{tag} {attr_str}>')
        else:
            self.output.append(f'<{tag}>')

        self.tag_stack.append(tag_lower)

    def handle_endtag(self, tag: str) -> None:
        """Handle closing tags."""
        tag_lower = tag.lower()

        # Handle skip content for dangerous tags
        if self.tag_stack and self.tag_stack[-1] == tag_lower:
            self.tag_stack.pop()
            if tag_lower in self.DANGEROUS_TAGS:
                self.skip_content = False
                return

        if not self.skip_content and tag_lower not in self.DANGEROUS_TAGS:
            self.output.append(f'</{tag}>')

    def handle_data(self, data: str) -> None:
        """Handle text data."""
        if not self.skip_content:
            # Remove any potentially sensitive data patterns
            cleaned_data = self._clean_data(data)
            if cleaned_data.strip():
                self.output.append(cleaned_data)

    def _should_remove_input(self, attrs: List[Tuple[str, Optional[str]]]) -> bool:
        """Check if an input field should be completely removed."""
        attrs_dict = dict(attrs)

        # Check input type
        input_type = attrs_dict.get('type', 'text').lower()
        if input_type in self.SENSITIVE_INPUT_TYPES:
            return True

        # Check name and id against sensitive patterns
        name = attrs_dict.get('name', '')
        field_id = attrs_dict.get('id', '')

        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, name) or re.search(pattern, field_id):
                return True

        return False

    def _sanitize_input_attrs(self, attrs: List[Tuple[str, Optional[str]]]) -> List[Tuple[str, Optional[str]]]:
        """Sanitize input field attributes - mask values and remove dangerous attrs."""
        sanitized = []

        for key, value in attrs:
            # Remove value attribute (hide user input)
            if key.lower() == 'value':
                continue

            # Remove dangerous attributes
            if key.lower() in self.DANGEROUS_ATTRIBUTES:
                continue

            # Keep safe attributes
            sanitized.append((key, value))

        return sanitized

    def _sanitize_attrs(self, attrs: List[Tuple[str, Optional[str]]]) -> List[Tuple[str, Optional[str]]]:
        """Remove dangerous attributes from all tags."""
        return [
            (k, v) for k, v in attrs
            if k.lower() not in self.DANGEROUS_ATTRIBUTES
        ]

    def _clean_data(self, data: str) -> str:
        """Clean text data to remove sensitive patterns."""
        # This is a simple implementation - in production, you might
        # use more sophisticated detection
        return data

    def _get_field_info(self, attrs: List[Tuple[str, Optional[str]]]) -> Dict[str, str]:
        """Extract information about a removed field."""
        attrs_dict = dict(attrs)
        return {
            'id': attrs_dict.get('id', attrs_dict.get('name', 'unknown')),
            'name': attrs_dict.get('name', ''),
            'type': attrs_dict.get('type', 'text'),
        }

    def get_sanitized_html(self) -> str:
        """Return the sanitized HTML."""
        return ''.join(self.output)

    def get_removed_fields(self) -> Dict[str, Dict[str, str]]:
        """Return information about removed fields."""
        return self.form_field_mapping


class HTMLSanitizer:
    """
    Main HTML sanitization class for Basset Hound Browser.

    Provides comprehensive sanitization of exported HTML to remove:
    - Sensitive form fields (passwords, credit cards, etc.)
    - Event handler attributes
    - Dangerous scripts and iframes
    - Sensitive meta tags
    - Input field values

    Example:
        >>> sanitizer = HTMLSanitizer()
        >>> result = sanitizer.sanitize_html(raw_html)
        >>> clean_html = result['html']
        >>> removed_fields = result['removed_fields']
    """

    def __init__(self, remove_style_tags: bool = False, remove_meta_tags: bool = False):
        """
        Initialize the HTML sanitizer.

        Args:
            remove_style_tags: Whether to remove <style> tags (default: False)
            remove_meta_tags: Whether to remove <meta> tags (default: False)
        """
        self.remove_style_tags = remove_style_tags
        self.remove_meta_tags = remove_meta_tags

    def sanitize_html(self, html: str) -> Dict[str, any]:
        """
        Sanitize HTML content and remove sensitive data.

        Args:
            html: Raw HTML string to sanitize

        Returns:
            Dictionary containing:
                - html: Sanitized HTML content
                - removed_fields: List of removed form fields
                - sanitization_report: Detailed report of changes made
                - original_size: Original HTML size in bytes
                - sanitized_size: Sanitized HTML size in bytes
                - fields_removed: Number of sensitive fields removed

        Example:
            >>> result = sanitizer.sanitize_html('<html>...</html>')
            >>> print(f"Removed {result['fields_removed']} fields")
        """
        if not html:
            return {
                'html': '',
                'removed_fields': [],
                'sanitization_report': 'Empty HTML provided',
                'original_size': 0,
                'sanitized_size': 0,
                'fields_removed': 0
            }

        original_size = len(html.encode('utf-8'))

        try:
            # Remove sensitive input fields
            remover = SensitiveFieldRemover()
            remover.feed(html)
            sanitized_html = remover.get_sanitized_html()
            removed_fields = remover.get_removed_fields()

            # Additional sanitization passes
            sanitized_html = self._remove_sensitive_attributes(sanitized_html)
            sanitized_html = self._remove_dangerous_scripts(sanitized_html)
            sanitized_html = self._clean_meta_tags(sanitized_html) if self.remove_meta_tags else sanitized_html

            sanitized_size = len(sanitized_html.encode('utf-8'))

            report = {
                'total_sensitive_fields_removed': len(removed_fields),
                'size_reduction_bytes': original_size - sanitized_size,
                'size_reduction_percent': round(
                    ((original_size - sanitized_size) / original_size * 100) if original_size > 0 else 0,
                    2
                ),
                'dangerous_attributes_removed': self._count_dangerous_attributes(html),
                'script_tags_removed': self._count_script_tags(html),
            }

            logger.info(f"HTML sanitization complete: {len(removed_fields)} fields removed")

            return {
                'html': sanitized_html,
                'removed_fields': list(removed_fields.values()),
                'sanitization_report': report,
                'original_size': original_size,
                'sanitized_size': sanitized_size,
                'fields_removed': len(removed_fields)
            }

        except Exception as e:
            logger.error(f"Error during HTML sanitization: {str(e)}")
            raise

    def _remove_sensitive_attributes(self, html: str) -> str:
        """Remove sensitive attributes from HTML."""
        # Remove common tracking attributes
        html = re.sub(r'\s*data-track[^=]*="[^"]*"', '', html, flags=re.IGNORECASE)
        html = re.sub(r'\s*data-pixel-[^=]*="[^"]*"', '', html, flags=re.IGNORECASE)
        html = re.sub(r'\s*data-user[^=]*="[^"]*"', '', html, flags=re.IGNORECASE)

        # Remove event handlers
        for event in ['onclick', 'onload', 'onerror', 'onchange', 'onsubmit',
                      'onmouseover', 'onmouseout', 'onfocus', 'onblur']:
            html = re.sub(rf'\s*{event}\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)

        return html

    def _remove_dangerous_scripts(self, html: str) -> str:
        """Remove script tags and inline scripts."""
        # Remove script tags and their content
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)

        # Remove javascript: protocol
        html = re.sub(r'javascript:', '', html, flags=re.IGNORECASE)

        # Remove data: protocol in href (can contain scripts)
        html = re.sub(r'href="data:[^"]*"', 'href="#"', html, flags=re.IGNORECASE)

        return html

    def _clean_meta_tags(self, html: str) -> str:
        """Remove or clean meta tags."""
        # Remove potentially sensitive meta tags
        dangerous_meta_patterns = [
            r'<meta\s+name=["\'](?:author|creator|owner)["\']',
            r'<meta\s+name=["\'](?:keywords)["\']',  # Can reveal interests
            r'<meta\s+property=["\']og:',  # Open Graph can be tracked
        ]

        for pattern in dangerous_meta_patterns:
            html = re.sub(pattern + r'[^>]*>', '', html, flags=re.IGNORECASE)

        return html

    def _count_dangerous_attributes(self, html: str) -> int:
        """Count how many dangerous attributes were in the original HTML."""
        count = 0
        dangerous_attrs = ['onclick', 'onload', 'onerror', 'onchange', 'onsubmit']
        for attr in dangerous_attrs:
            count += len(re.findall(rf'\s{attr}\s*=', html, flags=re.IGNORECASE))
        return count

    def _count_script_tags(self, html: str) -> int:
        """Count script tags in HTML."""
        return len(re.findall(r'<script[^>]*>', html, flags=re.IGNORECASE))


class FormFieldAnalyzer:
    """
    Analyze form fields in HTML to identify sensitive data.

    Provides detailed analysis of form structure, field types,
    and potential security issues.
    """

    def __init__(self):
        self.form_fields = []
        self.forms = []

    def analyze_html(self, html: str) -> Dict[str, any]:
        """
        Analyze HTML for form fields and potential sensitive data.

        Args:
            html: HTML string to analyze

        Returns:
            Dictionary containing:
                - forms: List of forms found
                - fields: List of form fields
                - sensitive_fields: List of potentially sensitive fields
                - total_forms: Number of forms
                - total_fields: Number of fields
        """
        parser = FormFieldParser()
        parser.feed(html)

        sensitive_fields = [
            f for f in parser.fields
            if self._is_sensitive_field(f)
        ]

        return {
            'forms': parser.forms,
            'fields': parser.fields,
            'sensitive_fields': sensitive_fields,
            'total_forms': len(parser.forms),
            'total_fields': len(parser.fields),
            'sensitive_count': len(sensitive_fields)
        }

    def _is_sensitive_field(self, field: Dict[str, str]) -> bool:
        """Check if a field appears to contain sensitive data."""
        patterns = SensitiveFieldRemover.SENSITIVE_PATTERNS

        name = field.get('name', '')
        field_id = field.get('id', '')
        field_type = field.get('type', '')

        # Password fields are always sensitive
        if field_type.lower() == 'password':
            return True

        # Check name and id against patterns
        for pattern in patterns:
            if re.search(pattern, name) or re.search(pattern, field_id):
                return True

        return False


class FormFieldParser(HTMLParser):
    """Parse HTML to extract form and field information."""

    def __init__(self):
        super().__init__()
        self.forms = []
        self.fields = []
        self.current_form = None
        self.current_form_id = 0

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        """Handle opening tags."""
        tag_lower = tag.lower()
        attrs_dict = dict(attrs)

        if tag_lower == 'form':
            form = {
                'id': self.current_form_id,
                'name': attrs_dict.get('name', ''),
                'action': attrs_dict.get('action', ''),
                'method': attrs_dict.get('method', 'GET'),
                'fields': []
            }
            self.forms.append(form)
            self.current_form = form
            self.current_form_id += 1

        elif tag_lower == 'input' and self.current_form:
            field = {
                'name': attrs_dict.get('name', ''),
                'type': attrs_dict.get('type', 'text'),
                'id': attrs_dict.get('id', ''),
                'required': 'required' in attrs_dict,
                'form_id': self.current_form['id']
            }
            self.fields.append(field)
            self.current_form['fields'].append(field)

    def handle_endtag(self, tag: str) -> None:
        """Handle closing tags."""
        if tag.lower() == 'form':
            self.current_form = None


def sanitize_html_export(
    html: str,
    remove_style_tags: bool = False,
    remove_meta_tags: bool = False
) -> Dict[str, any]:
    """
    Convenience function to sanitize HTML with default settings.

    Args:
        html: Raw HTML string to sanitize
        remove_style_tags: Whether to remove <style> tags
        remove_meta_tags: Whether to remove <meta> tags

    Returns:
        Dictionary with sanitization results
    """
    sanitizer = HTMLSanitizer(
        remove_style_tags=remove_style_tags,
        remove_meta_tags=remove_meta_tags
    )
    return sanitizer.sanitize_html(html)
