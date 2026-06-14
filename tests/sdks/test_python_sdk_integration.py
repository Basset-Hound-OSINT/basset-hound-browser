"""
Test suite for Python SDK integration scenarios
Tests full workflows and real-world usage patterns
Phase 2: Integration coverage (5 tests)
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from typing import Dict, Any

from basset_hound import BrowserClient, CommandResponse, SessionContext


class TestIntegrationWorkflows:
    """Test complete workflow scenarios (5 tests)"""

    @pytest.mark.asyncio
    async def test_full_scraping_workflow(self, client: BrowserClient, sample_responses: Dict):
        """Test complete web scraping workflow"""
        # 1. Navigate to page
        nav_response = CommandResponse.from_dict(sample_responses['navigation']['navigate'])
        nav_response.id = '1'

        # 2. Wait for content
        wait_response = CommandResponse.from_dict({
            'id': '2',
            'command': 'wait_for_element',
            'success': True,
            'data': {'found': True}
        })

        # 3. Extract content
        content_response = CommandResponse.from_dict(sample_responses['extraction']['get_content'])
        content_response.id = '3'

        # 4. Extract links
        links_response = CommandResponse.from_dict(sample_responses['extraction']['extract_links'])
        links_response.id = '4'

        # 5. Take screenshot
        screenshot_response = CommandResponse.from_dict(sample_responses['screenshot']['screenshot'])
        screenshot_response.id = '5'

        responses = [nav_response, wait_response, content_response, links_response, screenshot_response]

        with patch.object(client, '_send_command', side_effect=responses):
            # Execute workflow
            await client.navigate('https://example.com')
            await client.wait_for_element('div.content')
            content = await client.get_content()
            links = await client.extract_links()
            screenshot = await client.screenshot()

            assert content.success is True
            assert links.success is True
            assert screenshot.success is True
            assert len(links.data['internal']) > 0

    @pytest.mark.asyncio
    async def test_form_filling_workflow(self, client: BrowserClient, sample_responses: Dict):
        """Test form filling and submission workflow"""
        responses = [
            CommandResponse.from_dict(sample_responses['navigation']['navigate']),
            CommandResponse.from_dict(sample_responses['interaction']['fill']),
            CommandResponse.from_dict(sample_responses['interaction']['fill']),
            CommandResponse.from_dict(sample_responses['interaction']['click']),
            CommandResponse.from_dict(sample_responses['navigation']['navigate'])
        ]

        for i, resp in enumerate(responses):
            resp.id = str(i + 1)

        with patch.object(client, '_send_command', side_effect=responses):
            # Navigate to login page
            await client.navigate('https://example.com/login')

            # Fill email field
            await client.fill('input[type="email"]', 'test@example.com')

            # Fill password field
            await client.fill('input[type="password"]', 'password123')

            # Click submit button
            await client.click('button[type="submit"]')

            # Wait for redirect
            await client.navigate('https://example.com/dashboard')

    @pytest.mark.asyncio
    async def test_session_checkpoint_workflow(self, client: BrowserClient, sample_responses: Dict):
        """Test session checkpoint and rollback workflow"""
        # Navigation
        nav_response = CommandResponse.from_dict(sample_responses['navigation']['navigate'])
        nav_response.id = '1'

        # Create checkpoint
        cp_response = CommandResponse.from_dict(sample_responses['session']['create_checkpoint'])
        cp_response.id = '2'

        # Click element (might fail)
        click_response = CommandResponse.from_dict(sample_responses['interaction']['click'])
        click_response.id = '3'

        # Rollback
        rollback_response = CommandResponse.from_dict(sample_responses['session']['rollback_to_checkpoint'])
        rollback_response.id = '4'

        responses = [nav_response, cp_response, click_response, rollback_response]

        with patch.object(client, '_send_command', side_effect=responses):
            # Navigate
            await client.navigate('https://example.com')

            # Create checkpoint
            checkpoint = await client.create_checkpoint('before-interaction')
            cp_id = checkpoint['checkpointId']

            # Attempt interaction
            await client.click('button.test')

            # Rollback if needed
            await client.rollback_to_checkpoint(cp_id)

            assert client.current_checkpoint == cp_id

    @pytest.mark.asyncio
    async def test_concurrent_extraction_workflow(self, client: BrowserClient, sample_responses: Dict):
        """Test concurrent parallel extraction"""
        responses = [
            CommandResponse.from_dict(sample_responses['extraction']['get_content']),
            CommandResponse.from_dict(sample_responses['extraction']['extract_links']),
            CommandResponse.from_dict(sample_responses['extraction']['extract_images']),
            CommandResponse.from_dict(sample_responses['extraction']['extract_forms']),
            CommandResponse.from_dict(sample_responses['extraction']['detect_technology'])
        ]

        for i, resp in enumerate(responses):
            resp.id = str(i + 1)

        with patch.object(client, '_send_command', side_effect=responses):
            # Extract all in parallel
            tasks = [
                client.get_content(),
                client.extract_links(),
                client.extract_images(),
                client.extract_forms(),
                client.detect_technology()
            ]

            results = await asyncio.gather(*tasks)

            assert len(results) == 5
            assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_evasion_and_navigation_workflow(self, client: BrowserClient, sample_responses: Dict):
        """Test evasion setup followed by navigation"""
        responses = [
            CommandResponse.from_dict({
                'id': '1',
                'command': 'apply_fingerprint',
                'success': True,
                'data': {'profile': 'chrome-windows-10', 'applied': True}
            }),
            CommandResponse.from_dict({
                'id': '2',
                'command': 'set_proxy',
                'success': True,
                'data': {'proxyUrl': 'http://proxy:8080', 'active': True}
            }),
            CommandResponse.from_dict({
                'id': '3',
                'command': 'rotate_user_agent',
                'success': True,
                'data': {'userAgent': 'Mozilla/5.0...'}
            }),
            CommandResponse.from_dict(sample_responses['navigation']['navigate']),
            CommandResponse.from_dict(sample_responses['extraction']['get_content'])
        ]

        with patch.object(client, '_send_command', side_effect=responses):
            # Apply evasion
            await client.apply_fingerprint('chrome-windows-10')
            await client.set_proxy('http://proxy:8080')
            await client.rotate_user_agent()

            # Navigate and extract
            await client.navigate('https://example.com')
            content = await client.get_content()

            assert content.success is True


class TestContextManagers:
    """Test context manager patterns (bonus test)"""

    @pytest.mark.asyncio
    async def test_session_context_manager(self, client: BrowserClient, sample_responses: Dict):
        """Test SessionContext manager"""
        cp_response = CommandResponse.from_dict(sample_responses['session']['create_checkpoint'])
        cp_response.id = '1'
        cp_response.data['checkpointId'] = 'cp-test'

        with patch.object(client, '_send_command', return_value=cp_response):
            async with SessionContext(client, 'test-context') as ctx:
                assert ctx.checkpoint_id is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
