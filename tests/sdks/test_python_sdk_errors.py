"""
Test suite for Python SDK error handling
Tests connection errors, command errors, and state errors
Phase 2: Error handling coverage (10 tests)
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

from basset_hound import BrowserClient, CommandResponse


class TestConnectionErrors:
    """Test connection and timeout errors (4 tests)"""

    @pytest.mark.asyncio
    async def test_not_connected_error(self, client: BrowserClient):
        """Test error when not connected"""
        client._connected = False
        client.ws = None

        with pytest.raises(RuntimeError, match='Not connected'):
            await client.navigate('https://example.com')

    @pytest.mark.asyncio
    async def test_connection_timeout(self):
        """Test connection timeout"""
        client = BrowserClient('ws://localhost:8765', timeout=0.001)

        with patch('websockets.connect') as mock_connect:
            mock_connect.side_effect = asyncio.TimeoutError()
            with pytest.raises(TimeoutError):
                await client.connect()

    @pytest.mark.asyncio
    async def test_command_timeout_with_retry(self):
        """Test command timeout with automatic retry"""
        client = BrowserClient(timeout=0.001, max_retries=2)
        client._connected = True
        client.ws = AsyncMock()

        # Simulate timeout on send
        client.ws.send = AsyncMock(side_effect=asyncio.TimeoutError())

        with pytest.raises(TimeoutError):
            await client._send_command('navigate', url='https://example.com')

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up(self):
        """Test that disconnect properly cleans up"""
        client = BrowserClient()
        client._connected = True
        client.ws = AsyncMock()
        client._task = None  # No task to clean up

        result = await client.disconnect()
        assert result is True
        assert client._connected is False


class TestCommandErrors:
    """Test command execution errors (3 tests)"""

    @pytest.mark.asyncio
    async def test_command_error_response(self, client: BrowserClient, sample_responses: Dict):
        """Test handling command error response"""
        response_data = sample_responses['error']['invalid_selector']
        response_data['id'] = 'error-1'
        response_data['command'] = 'click'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.click('invalid.selector')
            assert response.success is False
            assert response.error == 'Element not found'
            assert response.recovery is not None

    @pytest.mark.asyncio
    async def test_rate_limit_error_recovery(self, client: BrowserClient, sample_responses: Dict):
        """Test rate limit error with recovery suggestions"""
        response_data = sample_responses['error']['rate_limited']
        response_data['id'] = 'error-3'
        response_data['command'] = 'navigate'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.navigate('https://example.com')
            assert response.success is False
            assert 'rate' in response.error.lower()
            assert response.recovery is not None
            assert 'rotate_proxy' in response.recovery.get('alternativeCommands', [])

    @pytest.mark.asyncio
    async def test_invalid_state_error(self, client: BrowserClient, sample_responses: Dict):
        """Test invalid state error"""
        response_data = sample_responses['error']['invalid_state']
        response_data['id'] = 'error-4'
        response_data['command'] = 'execute_script'

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            response = await client.execute_script('console.log("test")')
            assert response.success is False
            assert response.error == 'Invalid page state'


class TestSessionErrors:
    """Test session-related errors (3 tests)"""

    @pytest.mark.asyncio
    async def test_invalid_checkpoint_error(self, client: BrowserClient):
        """Test error for invalid checkpoint"""
        client._connected = True

        with pytest.raises(ValueError, match='Checkpoint not found'):
            await client.rollback_to_checkpoint('non-existent')

    @pytest.mark.asyncio
    async def test_checkpoint_creation_failure(self, client: BrowserClient):
        """Test checkpoint creation failure"""
        response_data = {
            'id': 'test-1',
            'command': 'create_checkpoint',
            'success': False,
            'error': 'Checkpoint limit exceeded'
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            with pytest.raises(RuntimeError, match='Checkpoint limit exceeded'):
                await client.create_checkpoint('test-checkpoint')

    @pytest.mark.asyncio
    async def test_rollback_failure(self, client: BrowserClient):
        """Test rollback failure"""
        client.checkpoints['cp-001'] = type('obj', (object,), {'id': 'cp-001'})()
        response_data = {
            'id': 'test-1',
            'command': 'rollback_to_checkpoint',
            'success': False,
            'error': 'Checkpoint corrupted'
        }

        with patch.object(client, '_send_command', return_value=CommandResponse.from_dict(response_data)):
            with pytest.raises(RuntimeError, match='Checkpoint corrupted'):
                await client.rollback_to_checkpoint('cp-001')


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
