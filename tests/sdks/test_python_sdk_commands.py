"""
Test suite for Python SDK command execution
Tests navigation, interaction, extraction, session, and fingerprinting commands
Phase 2: Comprehensive command coverage (30+ tests)
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

from basset_hound import BrowserClient, CommandResponse


class TestNavigationCommands:
    """Test navigation commands (5 tests)"""

    @pytest.mark.asyncio
    async def test_navigate_basic(self, client: BrowserClient, sample_responses: Dict):
        """Test basic navigation"""
        response_data = sample_responses['navigation']['navigate']
        response_data['id'] = 'test-1'
        response_data['command'] = 'navigate'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.navigate('https://example.com')
            assert response.success is True
            assert response.data['url'] == 'https://example.com'

    @pytest.mark.asyncio
    async def test_navigate_with_wait(self, client: BrowserClient, sample_responses: Dict):
        """Test navigation with wait time"""
        response_data = sample_responses['navigation']['navigate']
        response_data['id'] = 'test-1'
        response_data['command'] = 'navigate'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)) as mock_send:
            response = await client.navigate('https://example.com', wait_time=5000)
            assert response.success is True
            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args[1]
            assert call_kwargs['wait_time'] == 5000

    @pytest.mark.asyncio
    async def test_go_back(self, client: BrowserClient, sample_responses: Dict):
        """Test back navigation"""
        response_data = sample_responses['navigation']['go_back']
        response_data['id'] = 'test-2'
        response_data['command'] = 'go_back'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.go_back()
            assert response.success is True
            assert response.data['url'] == 'https://previous.com'

    @pytest.mark.asyncio
    async def test_get_url(self, client: BrowserClient, sample_responses: Dict):
        """Test getting current URL"""
        response_data = sample_responses['navigation']['get_url']
        response_data['id'] = 'test-3'
        response_data['command'] = 'get_url'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.get_url()
            assert response.success is True
            assert response.data['url'] == 'https://example.com'

    @pytest.mark.asyncio
    async def test_get_title(self, client: BrowserClient, sample_responses: Dict):
        """Test getting page title"""
        response_data = sample_responses['navigation']['get_title']
        response_data['id'] = 'test-4'
        response_data['command'] = 'get_title'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.get_title()
            assert response.success is True
            assert response.data['title'] == 'Example Domain'


class TestInteractionCommands:
    """Test interaction commands (6 tests)"""

    @pytest.mark.asyncio
    async def test_click_element(self, client: BrowserClient, sample_responses: Dict):
        """Test clicking an element"""
        response_data = sample_responses['interaction']['click']
        response_data['id'] = 'test-5'
        response_data['command'] = 'click'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)) as mock_send:
            response = await client.click('button.submit', humanize=True)
            assert response.success is True
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_fill_form_field(self, client: BrowserClient, sample_responses: Dict):
        """Test filling a form field"""
        response_data = sample_responses['interaction']['fill']
        response_data['id'] = 'test-6'
        response_data['command'] = 'fill'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)) as mock_send:
            response = await client.fill('#email', 'test@example.com')
            assert response.success is True
            call_kwargs = mock_send.call_args[1]
            assert call_kwargs['value'] == 'test@example.com'

    @pytest.mark.asyncio
    async def test_type_text(self, client: BrowserClient, sample_responses: Dict):
        """Test typing text"""
        response_data = sample_responses['interaction']['type_text']
        response_data['id'] = 'test-7'
        response_data['command'] = 'type_text'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.type_text('Hello World', humanize=True)
            assert response.success is True

    @pytest.mark.asyncio
    async def test_scroll_page(self, client: BrowserClient, sample_responses: Dict):
        """Test page scrolling"""
        response_data = sample_responses['interaction']['scroll']
        response_data['id'] = 'test-8'
        response_data['command'] = 'scroll'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.scroll(y=500)
            assert response.success is True

    @pytest.mark.asyncio
    async def test_hover_element(self, client: BrowserClient, sample_responses: Dict):
        """Test hovering over element"""
        response_data = sample_responses['interaction']['hover']
        response_data['id'] = 'test-9'
        response_data['command'] = 'hover'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.hover('a.dropdown-toggle')
            assert response.success is True

    @pytest.mark.asyncio
    async def test_wait_for_element(self, client: BrowserClient, sample_responses: Dict):
        """Test waiting for element"""
        response_data = {'id': 'test-26', 'command': 'wait_for_element', 'success': True,
                        'data': {'found': True, 'time': 1234}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.wait_for_element('div.content', timeout=10000)
            assert response.success is True


class TestContentExtractionCommands:
    """Test content extraction commands (6 tests)"""

    @pytest.mark.asyncio
    async def test_get_content(self, client: BrowserClient, sample_responses: Dict):
        """Test getting page content"""
        response_data = sample_responses['extraction']['get_content']
        response_data['id'] = 'test-10'
        response_data['command'] = 'get_content'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.get_content()
            assert response.success is True
            assert 'html' in response.data
            assert 'text' in response.data
            assert 'links' in response.data

    @pytest.mark.asyncio
    async def test_extract_links(self, client: BrowserClient, sample_responses: Dict):
        """Test extracting links"""
        response_data = sample_responses['extraction']['extract_links']
        response_data['id'] = 'test-11'
        response_data['command'] = 'extract_links'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.extract_links()
            assert response.success is True
            assert len(response.data['internal']) > 0

    @pytest.mark.asyncio
    async def test_extract_images(self, client: BrowserClient, sample_responses: Dict):
        """Test extracting images"""
        response_data = sample_responses['extraction']['extract_images']
        response_data['id'] = 'test-12'
        response_data['command'] = 'extract_images'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.extract_images()
            assert response.success is True
            assert len(response.data['images']) > 0

    @pytest.mark.asyncio
    async def test_extract_metadata(self, client: BrowserClient, sample_responses: Dict):
        """Test extracting metadata"""
        response_data = sample_responses['extraction']['extract_metadata']
        response_data['id'] = 'test-13'
        response_data['command'] = 'extract_metadata'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.extract_metadata()
            assert response.success is True
            assert 'meta' in response.data

    @pytest.mark.asyncio
    async def test_extract_forms(self, client: BrowserClient, sample_responses: Dict):
        """Test extracting forms"""
        response_data = sample_responses['extraction']['extract_forms']
        response_data['id'] = 'test-14'
        response_data['command'] = 'extract_forms'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.extract_forms()
            assert response.success is True
            assert 'forms' in response.data

    @pytest.mark.asyncio
    async def test_detect_technology(self, client: BrowserClient, sample_responses: Dict):
        """Test technology detection"""
        response_data = sample_responses['extraction']['detect_technology']
        response_data['id'] = 'test-15'
        response_data['command'] = 'detect_technology'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.detect_technology()
            assert response.success is True
            assert 'frameworks' in response.data


class TestScreenshotCommands:
    """Test screenshot commands (4 tests)"""

    @pytest.mark.asyncio
    async def test_screenshot(self, client: BrowserClient, sample_responses: Dict):
        """Test taking screenshot"""
        response_data = sample_responses['screenshot']['screenshot']
        response_data['id'] = 'test-16'
        response_data['command'] = 'screenshot'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.screenshot(format='png', quality=90)
            assert response.success is True
            assert 'image' in response.data

    @pytest.mark.asyncio
    async def test_screenshot_full_page(self, client: BrowserClient, sample_responses: Dict):
        """Test full page screenshot"""
        response_data = sample_responses['screenshot']['screenshot_full_page']
        response_data['id'] = 'test-17'
        response_data['command'] = 'screenshot_full_page'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.screenshot_full_page()
            assert response.success is True
            assert 'image' in response.data

    @pytest.mark.asyncio
    async def test_screenshot_element(self, client: BrowserClient, sample_responses: Dict):
        """Test element screenshot"""
        response_data = sample_responses['screenshot']['screenshot_element']
        response_data['id'] = 'test-18'
        response_data['command'] = 'screenshot_element'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.screenshot_element('button.submit')
            assert response.success is True
            assert response.data['selector'] == 'button.submit'

    @pytest.mark.asyncio
    async def test_screenshot_forensic(self, client: BrowserClient, sample_responses: Dict):
        """Test forensic screenshot"""
        response_data = {'id': 'test-25', 'command': 'screenshot_forensic', 'success': True,
                        'data': {'image': 'data:image/png;base64,...', 'hash': 'abc123', 'signature': 'xyz789'}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.screenshot_forensic(include_hash=True, include_signature=True)
            assert response.success is True
            assert 'hash' in response.data


class TestSessionCommands:
    """Test session persistence commands (6 tests)"""

    @pytest.mark.asyncio
    async def test_create_checkpoint(self, client: BrowserClient, sample_responses: Dict):
        """Test creating checkpoint"""
        response_data = sample_responses['session']['create_checkpoint']
        response_data['id'] = 'test-19'
        response_data['command'] = 'create_checkpoint'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.create_checkpoint('test-checkpoint')
            assert result['checkpointId'] == 'cp-001'
            assert client.current_checkpoint == 'cp-001'

    @pytest.mark.asyncio
    async def test_rollback_to_checkpoint(self, client: BrowserClient, sample_responses: Dict):
        """Test rollback to checkpoint"""
        client.checkpoints['cp-001'] = type('obj', (object,), {'id': 'cp-001'})()

        response_data = sample_responses['session']['rollback_to_checkpoint']
        response_data['id'] = 'test-20'
        response_data['command'] = 'rollback_to_checkpoint'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.rollback_to_checkpoint('cp-001')
            assert result['checkpointId'] == 'cp-001'
            assert client.current_checkpoint == 'cp-001'

    @pytest.mark.asyncio
    async def test_list_checkpoints(self, client: BrowserClient, sample_responses: Dict):
        """Test listing checkpoints"""
        response_data = sample_responses['session']['list_checkpoints']
        response_data['id'] = 'test-21'
        response_data['command'] = 'list_checkpoints'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            checkpoints = await client.list_checkpoints()
            assert len(checkpoints) == 2
            assert checkpoints[0]['id'] == 'cp-001'

    @pytest.mark.asyncio
    async def test_delete_checkpoint(self, client: BrowserClient):
        """Test deleting checkpoint"""
        client.checkpoints['cp-001'] = type('obj', (object,), {'id': 'cp-001'})()

        response_data = {'id': 'test-23', 'command': 'delete_checkpoint', 'success': True, 'data': {}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.delete_checkpoint('cp-001')
            assert result is True
            assert 'cp-001' not in client.checkpoints

    @pytest.mark.asyncio
    async def test_branch_session(self, client: BrowserClient, sample_responses: Dict):
        """Test session branching"""
        response_data = sample_responses['session']['branch_session']
        response_data['id'] = 'test-22'
        response_data['command'] = 'branch_session'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.branch_session('cp-001', 'experiment-a')
            assert result['branchId'] == 'branch-001'

    @pytest.mark.asyncio
    async def test_resume_session(self, client: BrowserClient):
        """Test resuming session"""
        response_data = {'id': 'test-24', 'command': 'resume_session', 'success': True,
                        'data': {'sessionId': 'session-001', 'checkpointId': 'cp-001', 'resumedAt': 1234567891}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.resume_session('cp-001')
            assert result['sessionId'] == 'session-001'


class TestFingerprintingCommands:
    """Test evasion and fingerprinting commands (3 tests)"""

    @pytest.mark.asyncio
    async def test_apply_fingerprint(self, client: BrowserClient):
        """Test applying device fingerprint"""
        response_data = {'id': 'test-27', 'command': 'apply_fingerprint', 'success': True,
                        'data': {'profile': 'chrome-windows-10', 'applied': True}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.apply_fingerprint('chrome-windows-10')
            assert response.success is True

    @pytest.mark.asyncio
    async def test_rotate_user_agent(self, client: BrowserClient):
        """Test rotating user agent"""
        response_data = {'id': 'test-28', 'command': 'rotate_user_agent', 'success': True,
                        'data': {'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.rotate_user_agent()
            assert response.success is True

    @pytest.mark.asyncio
    async def test_set_proxy(self, client: BrowserClient):
        """Test setting proxy"""
        response_data = {'id': 'test-29', 'command': 'set_proxy', 'success': True,
                        'data': {'proxyUrl': 'http://proxy.example.com:8080', 'active': True}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.set_proxy('http://proxy.example.com:8080', username='user', password='pass')
            assert response.success is True


class TestMonitoringCommands:
    """Test monitoring and analytics commands (3 tests)"""

    @pytest.mark.asyncio
    async def test_start_monitoring(self, client: BrowserClient):
        """Test starting monitoring"""
        response_data = {'id': 'test-30', 'command': 'start_monitoring', 'success': True,
                        'data': {'monitoring': True, 'threshold': 10}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.start_monitoring(threshold=10)
            assert response.success is True

    @pytest.mark.asyncio
    async def test_stop_monitoring(self, client: BrowserClient):
        """Test stopping monitoring"""
        response_data = {'id': 'test-31', 'command': 'stop_monitoring', 'success': True,
                        'data': {'monitoring': False}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.stop_monitoring()
            assert response.success is True

    @pytest.mark.asyncio
    async def test_check_page_changes(self, client: BrowserClient):
        """Test checking page changes"""
        response_data = {'id': 'test-32', 'command': 'check_page_changes', 'success': True,
                        'data': {'changed': False, 'changeCount': 0}}

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.check_page_changes()
            assert response.success is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
