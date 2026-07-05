"""
Unit tests for Basset Hound Browser Python Client - Forensic Exports

Tests the forensic export functionality including:
- Raw HTML export
- Network log export
- Device ID export
- DOM manipulation
- Form interaction
"""

import json
import pytest
from typing import Dict, Any
from unittest.mock import Mock, patch, MagicMock

from basset_hound import (
    BassetHoundClient,
    BassetHoundClientWithForensics,
    ForensicExportMixin,
    CommandError,
    TimeoutError,
    ConnectionError
)


class TestForensicExportMixin:
    """Test ForensicExportMixin methods."""

    def test_export_raw_html_basic(self):
        """Test basic HTML export."""
        client = BassetHoundClientWithForensics()

        # Mock the send_command method
        expected_response = {
            'html': '<html><body>Test</body></html>',
            'headers': {'Content-Type': 'text/html'},
            'statusCode': 200,
            'mimeType': 'text/html',
            'url': 'https://example.com'
        }

        with patch.object(client, 'send_command', return_value=expected_response):
            result = client.export_raw_html()

            assert result['statusCode'] == 200
            assert 'html' in result
            assert 'headers' in result
            assert '<html>' in result['html']

    def test_export_raw_html_with_url(self):
        """Test HTML export with URL parameter."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'html': '<html></html>',
            'headers': {},
            'statusCode': 200,
            'mimeType': 'text/html',
            'url': 'https://custom.com'
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.export_raw_html(url='https://custom.com')

            # Verify send_command was called with url parameter
            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert call_args[0][0] == 'export_raw_html'
            assert call_args[0][1]['url'] == 'https://custom.com'

    def test_export_raw_html_with_timeout(self):
        """Test HTML export with custom timeout."""
        client = BassetHoundClientWithForensics()

        expected_response = {'html': '<html></html>', 'headers': {}, 'statusCode': 200, 'mimeType': 'text/html', 'url': 'https://example.com'}

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.export_raw_html(timeout=60.0)

            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert call_args[1]['timeout'] == 60.0

    def test_export_network_log(self):
        """Test network log export."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'requests': [
                {
                    'url': 'https://example.com',
                    'method': 'GET',
                    'headers': {},
                    'statusCode': 200,
                    'responseHeaders': {},
                    'responseTime': 250,
                    'resourceType': 'document'
                },
                {
                    'url': 'https://example.com/style.css',
                    'method': 'GET',
                    'headers': {},
                    'statusCode': 200,
                    'responseHeaders': {},
                    'responseTime': 150,
                    'resourceType': 'stylesheet'
                }
            ],
            'statistics': {
                'totalRequests': 2,
                'totalSize': 50000,
                'totalTime': 400
            }
        }

        with patch.object(client, 'send_command', return_value=expected_response):
            result = client.export_network_log()

            assert len(result['requests']) == 2
            assert result['statistics']['totalRequests'] == 2
            assert result['requests'][0]['method'] == 'GET'

    def test_export_device_ids(self):
        """Test device ID export."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'userAgent': 'Mozilla/5.0 (X11; Linux x86_64)',
            'platform': 'Linux',
            'viewport': {
                'width': 1920,
                'height': 1080
            },
            'fingerprints': {
                'canvas': 'abcd1234',
                'webgl': 'efgh5678',
                'fonts': ['Arial', 'Verdana'],
                'plugins': []
            },
            'hardwareInfo': {
                'cores': 8,
                'memory': 16000,
                'deviceType': 'desktop'
            },
            'identifiers': ['id1', 'id2', 'id3']
        }

        with patch.object(client, 'send_command', return_value=expected_response):
            result = client.export_device_ids()

            assert result['userAgent'].startswith('Mozilla')
            assert result['viewport']['width'] == 1920
            assert len(result['fingerprints']['fonts']) > 0
            assert len(result['identifiers']) == 3

    def test_modify_element_setText(self):
        """Test modifying element text."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'div',
            'previousValue': 'Old Text',
            'newValue': 'New Text'
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.modify_element('#title', 'setText', 'New Text')

            assert result['success'] is True
            assert result['newValue'] == 'New Text'

            # Verify correct parameters
            call_args = mock_send.call_args
            assert call_args[0][0] == 'modify_element'
            assert call_args[0][1]['selector'] == '#title'
            assert call_args[0][1]['action'] == 'setText'
            assert call_args[0][1]['value'] == 'New Text'

    def test_modify_element_addClass(self):
        """Test adding CSS class to element."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'button',
            'previousValue': None,
            'newValue': 'highlight'
        }

        with patch.object(client, 'send_command', return_value=expected_response):
            result = client.modify_element('.btn', 'addClass', 'highlight')

            assert result['success'] is True

    def test_modify_element_setAttribute(self):
        """Test setting element attribute."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'img',
            'previousValue': 'old-value',
            'newValue': 'new-value'
        }

        with patch.object(client, 'send_command', return_value=expected_response):
            result = client.modify_element('img#logo', 'setAttribute', 'alt=Logo')

            assert result['success'] is True

    def test_click_element(self):
        """Test clicking an element."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'button',
            'elementText': 'Submit'
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.click_element('button#submit')

            assert result['success'] is True
            assert result['elementTag'] == 'button'

            # Verify correct parameters
            call_args = mock_send.call_args
            assert call_args[0][1]['selector'] == 'button#submit'

    def test_fill_input(self):
        """Test filling an input field."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'input',
            'inputValue': 'john_doe',
            'textLength': 8
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.fill_input('input#username', 'john_doe')

            assert result['success'] is True
            assert result['inputValue'] == 'john_doe'

            # Verify correct parameters
            call_args = mock_send.call_args
            assert call_args[0][1]['selector'] == 'input#username'
            assert call_args[0][1]['text'] == 'john_doe'
            assert call_args[0][1]['delay'] == 50  # Default delay

    def test_fill_input_with_delay(self):
        """Test filling input with custom delay."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'input',
            'inputValue': 'password',
            'textLength': 8
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.fill_input('input#password', 'password', delay=100)

            call_args = mock_send.call_args
            assert call_args[0][1]['delay'] == 100

    def test_wait_for_selector(self):
        """Test waiting for selector."""
        client = BassetHoundClientWithForensics()

        expected_response = {
            'success': True,
            'elementTag': 'div',
            'waitTime': 1250
        }

        with patch.object(client, 'send_command', return_value=expected_response) as mock_send:
            result = client.wait_for_selector('.content', timeout=5000)

            assert result['success'] is True
            assert result['waitTime'] == 1250

            # Verify timeout conversion (ms to seconds)
            call_args = mock_send.call_args
            assert call_args[0][1]['timeout'] == 5000

    def test_error_handling_timeout(self):
        """Test timeout error handling."""
        client = BassetHoundClientWithForensics()

        with patch.object(client, 'send_command', side_effect=TimeoutError("Command timed out", timeout=30.0)):
            with pytest.raises(TimeoutError) as exc_info:
                client.export_raw_html()

            assert exc_info.value.timeout == 30.0

    def test_error_handling_command_error(self):
        """Test command error handling."""
        client = BassetHoundClientWithForensics()

        error_details = {'error': 'Element not found'}
        with patch.object(client, 'send_command', side_effect=CommandError("Export failed", details=error_details)):
            with pytest.raises(CommandError) as exc_info:
                client.export_raw_html()

            assert exc_info.value.details == error_details

    def test_error_handling_connection_error(self):
        """Test connection error handling."""
        client = BassetHoundClientWithForensics()

        with patch.object(client, 'send_command', side_effect=ConnectionError("Not connected")):
            with pytest.raises(ConnectionError):
                client.export_raw_html()


class TestClientVariants:
    """Test different client class variants."""

    def test_base_client_has_basic_methods(self):
        """Test that base client has basic navigation methods."""
        client = BassetHoundClient()

        # Check base methods exist
        assert hasattr(client, 'navigate')
        assert hasattr(client, 'get_url')
        assert hasattr(client, 'get_title')
        assert hasattr(client, 'screenshot')

    def test_forensics_client_has_export_methods(self):
        """Test that forensics client has export methods."""
        client = BassetHoundClientWithForensics()

        # Check forensic methods exist
        assert hasattr(client, 'export_raw_html')
        assert hasattr(client, 'export_network_log')
        assert hasattr(client, 'export_device_ids')
        assert hasattr(client, 'modify_element')
        assert hasattr(client, 'click_element')
        assert hasattr(client, 'fill_input')
        assert hasattr(client, 'wait_for_selector')

    def test_forensics_client_has_base_methods(self):
        """Test that forensics client inherits base methods."""
        client = BassetHoundClientWithForensics()

        # Should have both base and forensic methods
        assert hasattr(client, 'navigate')
        assert hasattr(client, 'export_raw_html')


class TestIntegration:
    """Integration tests for typical workflows."""

    def test_forensic_analysis_workflow(self):
        """Test complete forensic analysis workflow."""
        client = BassetHoundClientWithForensics()

        # Mock all responses
        responses = {
            'export_raw_html': {
                'html': '<html></html>',
                'headers': {},
                'statusCode': 200,
                'mimeType': 'text/html',
                'url': 'https://example.com'
            },
            'export_network_log': {
                'requests': [{'url': 'https://example.com', 'method': 'GET', 'statusCode': 200}],
                'statistics': {}
            },
            'export_device_ids': {
                'userAgent': 'Mozilla/5.0',
                'platform': 'Linux',
                'viewport': {'width': 1920, 'height': 1080},
                'fingerprints': {'canvas': 'abc123', 'webgl': 'def456'},
                'hardwareInfo': {'cores': 8},
                'identifiers': ['id1']
            }
        }

        with patch.object(client, 'send_command') as mock_send:
            def send_command_side_effect(command, params=None, timeout=None):
                return responses.get(command, {})

            mock_send.side_effect = send_command_side_effect

            # Run analysis workflow
            html = client.export_raw_html()
            assert html['statusCode'] == 200

            network = client.export_network_log()
            assert len(network['requests']) == 1

            device = client.export_device_ids()
            assert device['platform'] == 'Linux'

    def test_form_interaction_workflow(self):
        """Test form filling and submission workflow."""
        client = BassetHoundClientWithForensics()

        responses = {
            'wait_for_element': {'success': True, 'elementTag': 'input', 'waitTime': 500},
            'type_text': {'success': True, 'elementTag': 'input', 'inputValue': 'test', 'textLength': 4},
            'click': {'success': True, 'elementTag': 'button', 'elementText': 'Submit'},
        }

        with patch.object(client, 'send_command') as mock_send:
            def send_command_side_effect(command, params=None, timeout=None):
                return responses.get(command, {})

            mock_send.side_effect = send_command_side_effect

            # Wait for form
            result = client.wait_for_selector('input#username')
            assert result['success'] is True

            # Fill form
            result = client.fill_input('input#username', 'testuser')
            assert result['success'] is True

            # Submit form
            result = client.click_element('button#submit')
            assert result['success'] is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
