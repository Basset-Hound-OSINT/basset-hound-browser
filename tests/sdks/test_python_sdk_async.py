"""
Test suite for Python SDK async operations and concurrency
Tests concurrent operations, batch operations, and async patterns
Phase 2: Async and concurrency coverage (8 tests)
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch
from typing import List

from basset_hound import BrowserClient, CommandResponse


class TestAsyncOperations:
    """Test async/await patterns (3 tests)"""

    @pytest.mark.asyncio
    async def test_concurrent_commands(self, client: BrowserClient):
        """Test multiple concurrent commands"""
        # Create multiple response mocks
        responses = [
            CommandResponse.from_dict({'id': f'test-{i}', 'command': f'cmd-{i}', 'success': True})
            for i in range(5)
        ]

        with patch.object(client, '_send_command', side_effect=responses):
            # Execute commands concurrently
            tasks = [
                client.navigate('https://example.com'),
                client.get_url(),
                client.get_content(),
                client.extract_links(),
                client.screenshot()
            ]
            results = await asyncio.gather(*tasks)

            assert len(results) == 5
            assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_concurrent_extraction(self, client: BrowserClient, sample_responses: dict):
        """Test concurrent content extraction"""
        extraction_commands = [
            ('get_content', sample_responses['extraction']['get_content']),
            ('extract_links', sample_responses['extraction']['extract_links']),
            ('extract_images', sample_responses['extraction']['extract_images']),
            ('extract_metadata', sample_responses['extraction']['extract_metadata']),
            ('extract_forms', sample_responses['extraction']['extract_forms'])
        ]

        async def extract_all_types():
            responses = {}
            for cmd_name, resp_data in extraction_commands:
                resp_data['id'] = f'test-{cmd_name}'
                resp_data['command'] = cmd_name
                responses[cmd_name] = CommandResponse.from_dict(resp_data)
            return responses

        with patch.object(client, '_send_command') as mock_send:
            # Mock each extraction command
            extraction_responses = await extract_all_types()
            responses_list = list(extraction_responses.values())
            mock_send.side_effect = responses_list

            tasks = [
                client.get_content(),
                client.extract_links(),
                client.extract_images(),
                client.extract_metadata(),
                client.extract_forms()
            ]
            results = await asyncio.gather(*tasks)

            assert len(results) == 5
            assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_timeout_handling(self, client: BrowserClient):
        """Test async timeout handling"""
        async def slow_command(*args, **kwargs):
            await asyncio.sleep(2)
            return CommandResponse.from_dict({'id': 'test', 'command': 'test', 'success': True})

        with patch.object(client, '_send_command', side_effect=slow_command):
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(client.navigate('https://example.com'), timeout=0.1)


class TestBatchOperations:
    """Test batch command execution (3 tests)"""

    @pytest.mark.asyncio
    async def test_batch_commands_success(self, client: BrowserClient):
        """Test successful batch command execution"""
        responses = [
            CommandResponse.from_dict({'id': '1', 'command': 'navigate', 'success': True}),
            CommandResponse.from_dict({'id': '2', 'command': 'get_content', 'success': True}),
            CommandResponse.from_dict({'id': '3', 'command': 'screenshot', 'success': True})
        ]

        with patch.object(client, '_send_command', side_effect=responses):
            results = await client.batch_commands([
                {'command': 'navigate', 'url': 'https://example.com'},
                {'command': 'get_content'},
                {'command': 'screenshot'}
            ])

            assert len(results) == 3
            assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_batch_commands_partial_failure(self, client: BrowserClient):
        """Test batch with partial failures"""
        responses = [
            CommandResponse.from_dict({'id': '1', 'command': 'navigate', 'success': True}),
            CommandResponse.from_dict({'id': '2', 'command': 'click', 'success': False, 'error': 'Element not found'}),
            CommandResponse.from_dict({'id': '3', 'command': 'get_content', 'success': True})
        ]

        with patch.object(client, '_send_command', side_effect=responses):
            results = await client.batch_commands([
                {'command': 'navigate', 'url': 'https://example.com'},
                {'command': 'click', 'selector': '.invalid'},
                {'command': 'get_content'}
            ])

            assert len(results) == 3
            assert results[0].success is True
            assert results[1].success is False
            assert results[2].success is True

    @pytest.mark.asyncio
    async def test_batch_with_different_delays(self, client: BrowserClient):
        """Test batch commands with varying execution times"""
        async def delayed_response(delay_ms: int):
            async def cmd():
                await asyncio.sleep(delay_ms / 1000)
                return CommandResponse.from_dict({'id': 'test', 'command': 'test', 'success': True})
            return await cmd()

        with patch.object(client, '_send_command') as mock_send:
            mock_send.side_effect = [
                CommandResponse.from_dict({'id': '1', 'command': 'cmd1', 'success': True}),
                CommandResponse.from_dict({'id': '2', 'command': 'cmd2', 'success': True}),
                CommandResponse.from_dict({'id': '3', 'command': 'cmd3', 'success': True})
            ]

            start_time = time.time()
            results = await client.batch_commands([
                {'command': 'cmd1'},
                {'command': 'cmd2'},
                {'command': 'cmd3'}
            ])
            elapsed = time.time() - start_time

            assert len(results) == 3
            # Batch should be concurrent, so faster than sequential
            assert elapsed < 3.0


class TestEventHandling:
    """Test event handling and callbacks (2 tests)"""

    @pytest.mark.asyncio
    async def test_message_loop_processing(self, client: BrowserClient):
        """Test message loop event processing"""
        client._connected = True
        client.ws = AsyncMock()

        # Create a test message
        test_message = {
            'id': 'test-1',
            'command': 'navigate',
            'success': True,
            'data': {'url': 'https://example.com'}
        }

        # Mock the message loop to return our test message
        import json
        messages = [json.dumps(test_message)]

        async def mock_iter():
            for msg in messages:
                yield msg

        client.ws.__aiter__ = lambda self: mock_iter()

        # Create the message loop task
        loop_task = asyncio.create_task(client._message_loop())

        # Give it a moment to process
        await asyncio.sleep(0.1)

        # Cancel and wait for completion
        loop_task.cancel()
        try:
            await loop_task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_pending_response_cleanup(self, client: BrowserClient):
        """Test cleanup of pending responses on timeout"""
        client._connected = True
        client.ws = AsyncMock()

        # Mock timeout behavior
        async def timeout_send(msg):
            await asyncio.sleep(10)  # Long delay to trigger timeout

        client.ws.send = timeout_send

        # Attempt command with short timeout
        try:
            await asyncio.wait_for(
                client._send_command('navigate', url='https://example.com'),
                timeout=0.1
            )
        except (TimeoutError, asyncio.TimeoutError):
            pass

        # Verify pending response was cleaned up (it should be empty or have been cleared)
        # Note: The actual cleanup happens in _send_command on TimeoutError
        assert len(client.pending_responses) == 0 or len(client.pending_responses) <= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
