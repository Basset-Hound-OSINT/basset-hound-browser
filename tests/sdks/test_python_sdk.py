"""
Tests for Python SDK v12.2.0
Tests async/await interface, session management, and command execution
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add SDK to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdks/python-sdk'))

from basset_hound import (
    BrowserClient,
    SessionCheckpoint,
    CommandResponse,
    SessionContext
)


@pytest.fixture
def event_loop():
    """Provide event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    """Provide client instance"""
    client = BrowserClient('ws://localhost:8765', timeout=5.0)
    yield client
    # Cleanup
    if client.is_connected():
        await client.disconnect()


class TestClientInitialization:
    """Test client initialization and connection"""

    def test_client_creation(self):
        """Test creating client instance"""
        client = BrowserClient('ws://localhost:8765')
        assert client.ws_url == 'ws://localhost:8765'
        assert client.timeout == 30.0
        assert client.auto_reconnect is True
        assert not client.is_connected()

    def test_custom_configuration(self):
        """Test client with custom configuration"""
        client = BrowserClient(
            ws_url='wss://secure.example.com:8765',
            timeout=60.0,
            auto_reconnect=False,
            max_retries=5
        )
        assert client.ws_url == 'wss://secure.example.com:8765'
        assert client.timeout == 60.0
        assert client.auto_reconnect is False
        assert client.max_retries == 5

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test context manager usage"""
        async def mock_connect(*args, **kwargs):
            mock_ws = AsyncMock()
            mock_ws.__aiter__ = lambda self: self
            mock_ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)
            return mock_ws

        with patch('websockets.connect', side_effect=mock_connect):
            client = BrowserClient()
            try:
                async with client as c:
                    assert c.is_connected()
            except asyncio.CancelledError:
                pass  # Expected from mock


class TestCommandResponse:
    """Test CommandResponse wrapper"""

    def test_response_creation(self):
        """Test creating response"""
        data = {
            'id': '123',
            'command': 'navigate',
            'success': True,
            'data': {'url': 'https://example.com'}
        }
        response = CommandResponse.from_dict(data)

        assert response.id == '123'
        assert response.command == 'navigate'
        assert response.success is True
        assert response.data == {'url': 'https://example.com'}

    def test_response_error(self):
        """Test error response"""
        data = {
            'id': '123',
            'command': 'navigate',
            'success': False,
            'error': 'Connection failed'
        }
        response = CommandResponse.from_dict(data)

        assert response.success is False
        assert response.error == 'Connection failed'

    def test_response_with_recovery(self):
        """Test response with recovery suggestions"""
        data = {
            'id': '123',
            'command': 'navigate',
            'success': False,
            'error': 'Rate limited',
            'recovery': {
                'suggestion': 'Wait 60 seconds',
                'alternativeCommands': ['rotate_proxy', 'rotate_user_agent']
            }
        }
        response = CommandResponse.from_dict(data)

        assert response.recovery is not None
        assert response.recovery['suggestion'] == 'Wait 60 seconds'


class TestSessionCheckpoint:
    """Test session checkpoint management"""

    def test_checkpoint_creation(self):
        """Test creating checkpoint"""
        checkpoint = SessionCheckpoint(
            id='cp-001',
            name='test-checkpoint',
            timestamp=1234567890,
            url='https://example.com',
            cookies={'token': 'abc123'}
        )

        assert checkpoint.id == 'cp-001'
        assert checkpoint.name == 'test-checkpoint'
        assert checkpoint.url == 'https://example.com'
        assert checkpoint.cookies['token'] == 'abc123'

    def test_checkpoint_to_dict(self):
        """Test checkpoint serialization"""
        checkpoint = SessionCheckpoint(
            id='cp-001',
            name='test',
            timestamp=1234567890
        )
        data = checkpoint.to_dict()

        assert data['id'] == 'cp-001'
        assert data['name'] == 'test'
        assert 'localStorage' in data


class TestNavigationCommands:
    """Test navigation commands"""

    @pytest.mark.asyncio
    async def test_navigate(self):
        """Test navigate command"""
        client = BrowserClient()
        client._connected = True
        client.ws = AsyncMock()

        # Mock response
        response_data = {
            'id': '123',
            'command': 'navigate',
            'success': True,
            'data': {'url': 'https://example.com'}
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.navigate('https://example.com')
            assert response.success is True

    @pytest.mark.asyncio
    async def test_get_url(self):
        """Test get_url command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'get_url',
            'success': True,
            'data': {'url': 'https://example.com'}
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.get_url()
            assert response.success is True
            assert response.data['url'] == 'https://example.com'


class TestInteractionCommands:
    """Test interaction commands"""

    @pytest.mark.asyncio
    async def test_click(self):
        """Test click command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'click',
            'success': True,
            'data': {'clicked': True}
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.click('#button', humanize=True)
            assert response.success is True

    @pytest.mark.asyncio
    async def test_fill(self):
        """Test fill command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'fill',
            'success': True
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.fill('#input', 'test value')
            assert response.success is True

    @pytest.mark.asyncio
    async def test_scroll(self):
        """Test scroll command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'scroll',
            'success': True
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.scroll(y=500)
            assert response.success is True


class TestContentExtraction:
    """Test content extraction commands"""

    @pytest.mark.asyncio
    async def test_get_content(self):
        """Test get_content command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'get_content',
            'success': True,
            'data': {
                'html': '<html>...</html>',
                'text': 'Page content',
                'links': ['https://example.com/link1']
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.get_content()
            assert response.success is True
            assert 'html' in response.data
            assert 'links' in response.data

    @pytest.mark.asyncio
    async def test_extract_links(self):
        """Test extract_links command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'extract_links',
            'success': True,
            'data': {
                'internal': ['https://example.com/page1'],
                'external': ['https://external.com']
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.extract_links()
            assert response.success is True
            assert len(response.data['internal']) > 0

    @pytest.mark.asyncio
    async def test_detect_technology(self):
        """Test detect_technology command"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'detect_technology',
            'success': True,
            'data': {
                'frameworks': [{'name': 'React', 'version': '18.0.0'}],
                'cms': [],
                'servers': [{'name': 'nginx'}]
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.detect_technology()
            assert response.success is True
            assert len(response.data['frameworks']) > 0


class TestSessionPersistence:
    """Test session persistence commands (v12.2.0)"""

    @pytest.mark.asyncio
    async def test_create_checkpoint(self):
        """Test creating checkpoint"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'create_checkpoint',
            'success': True,
            'data': {
                'checkpointId': 'cp-001',
                'checkpointName': 'test-checkpoint',
                'timestamp': 1234567890,
                'requestCount': 42
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.create_checkpoint('test-checkpoint')
            assert result['checkpointId'] == 'cp-001'
            assert client.current_checkpoint == 'cp-001'

    @pytest.mark.asyncio
    async def test_rollback_to_checkpoint(self):
        """Test rollback to checkpoint"""
        client = BrowserClient()
        client._connected = True
        client.checkpoints['cp-001'] = SessionCheckpoint('cp-001', 'test', 1234567890)

        response_data = {
            'id': '123',
            'command': 'rollback_to_checkpoint',
            'success': True,
            'data': {
                'checkpointId': 'cp-001',
                'restoredAt': 1234567891
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.rollback_to_checkpoint('cp-001')
            assert result['checkpointId'] == 'cp-001'
            assert client.current_checkpoint == 'cp-001'

    @pytest.mark.asyncio
    async def test_list_checkpoints(self):
        """Test listing checkpoints"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'list_checkpoints',
            'success': True,
            'data': {
                'checkpoints': [
                    {'id': 'cp-001', 'name': 'checkpoint-1'},
                    {'id': 'cp-002', 'name': 'checkpoint-2'}
                ]
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            checkpoints = await client.list_checkpoints()
            assert len(checkpoints) == 2

    @pytest.mark.asyncio
    async def test_branch_session(self):
        """Test session branching"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'branch_session',
            'success': True,
            'data': {
                'branchId': 'branch-001',
                'branchName': 'experiment-a',
                'parentSessionId': 'session-001'
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.branch_session('cp-001', 'experiment-a')
            assert result['branchId'] == 'branch-001'

    @pytest.mark.asyncio
    async def test_resume_session(self):
        """Test resuming session"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'resume_session',
            'success': True,
            'data': {
                'sessionId': 'session-001',
                'checkpointId': 'cp-001',
                'resumedAt': 1234567891
            }
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            result = await client.resume_session('cp-001')
            assert result['sessionId'] == 'session-001'


class TestBatchOperations:
    """Test batch command execution"""

    @pytest.mark.asyncio
    async def test_batch_commands(self):
        """Test batch command execution"""
        client = BrowserClient()
        client._connected = True

        response1 = CommandResponse.from_dict({
            'id': '1',
            'command': 'navigate',
            'success': True
        })
        response2 = CommandResponse.from_dict({
            'id': '2',
            'command': 'get_content',
            'success': True
        })

        with patch.object(client, '_send_command', side_effect=[response1, response2]):
            results = await client.batch_commands([
                {'command': 'navigate', 'url': 'https://example.com'},
                {'command': 'get_content'}
            ])

            assert len(results) == 2
            assert results[0].success is True
            assert results[1].success is True


class TestUtilityMethods:
    """Test utility methods"""

    def test_get_session_info(self):
        """Test getting session info"""
        client = BrowserClient()
        info = client.get_session_info()

        assert 'connected' in info
        assert 'session_id' in info
        assert 'current_checkpoint' in info

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check"""
        client = BrowserClient()
        client._connected = True

        response_data = {
            'id': '123',
            'command': 'ping',
            'success': True
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            health = await client.health_check()
            assert health is True


class TestErrorHandling:
    """Test error handling and recovery"""

    @pytest.mark.asyncio
    async def test_not_connected_error(self):
        """Test error when not connected"""
        client = BrowserClient()

        with pytest.raises(RuntimeError, match='Not connected'):
            await client.navigate('https://example.com')

    @pytest.mark.asyncio
    async def test_invalid_checkpoint_error(self):
        """Test error for invalid checkpoint"""
        client = BrowserClient()
        client._connected = True

        with pytest.raises(ValueError, match='Checkpoint not found'):
            await client.rollback_to_checkpoint('non-existent')


class TestIntegrationScenarios:
    """Test real-world scenarios"""

    @pytest.mark.asyncio
    async def test_navigation_with_checkpoint(self):
        """Test navigation followed by checkpoint creation"""
        client = BrowserClient()
        client._connected = True

        nav_response = CommandResponse.from_dict({
            'id': '1',
            'command': 'navigate',
            'success': True,
            'data': {'url': 'https://example.com'}
        })

        cp_response = CommandResponse.from_dict({
            'id': '2',
            'command': 'create_checkpoint',
            'success': True,
            'data': {
                'checkpointId': 'cp-001',
                'checkpointName': 'after-nav',
                'timestamp': 1234567890
            }
        })

        with patch.object(client, '_send_command', side_effect=[nav_response, cp_response]):
            # Navigate
            nav = await client.navigate('https://example.com')
            assert nav.success is True

            # Create checkpoint
            cp = await client.create_checkpoint('after-nav')
            assert cp['checkpointId'] == 'cp-001'

    @pytest.mark.asyncio
    async def test_ab_testing_workflow(self):
        """Test A/B testing workflow with branching"""
        client = BrowserClient()
        client._connected = True

        cp_response = CommandResponse.from_dict({
            'id': '1',
            'command': 'create_checkpoint',
            'success': True,
            'data': {'checkpointId': 'cp-base'}
        })

        branch_response = CommandResponse.from_dict({
            'id': '2',
            'command': 'branch_session',
            'success': True,
            'data': {'branchId': 'branch-a'}
        })

        with patch.object(client, '_send_command', side_effect=[cp_response, branch_response]):
            # Create baseline checkpoint
            baseline = await client.create_checkpoint('baseline')
            assert baseline['checkpointId'] == 'cp-base'

            # Branch for experiment
            branch = await client.branch_session('cp-base', 'experiment-a')
            assert branch['branchId'] == 'branch-a'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
