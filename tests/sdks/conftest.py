"""
Pytest configuration and fixtures for Python SDK tests
Provides mock WebSocket server, client fixtures, and sample response data
"""

import pytest
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock
import sys
import os
from pathlib import Path

# Add SDK to path
sdk_path = Path(__file__).parent.parent.parent / "sdks" / "python-sdk"
sys.path.insert(0, str(sdk_path))

from basset_hound import BrowserClient, CommandResponse, SessionCheckpoint

logger = logging.getLogger(__name__)


@pytest.fixture(scope="session")
def event_loop_policy():
    """Set event loop policy for tests"""
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    return asyncio.get_event_loop_policy()


@pytest.fixture
def event_loop(event_loop_policy):
    """Create an event loop for each test"""
    loop = event_loop_policy.new_event_loop()
    yield loop
    # Clean up any remaining tasks
    pending = asyncio.all_tasks(loop)
    for task in pending:
        task.cancel()
    loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
    loop.close()


class MockWebSocketServer:
    """Mock WebSocket server for testing"""

    def __init__(self) -> None:
        self.messages: List[Dict[str, Any]] = []
        self.responses: Dict[str, Dict[str, Any]] = {}
        self.call_count: int = 0
        self._handlers: Dict[str, callable] = {}

    def register_handler(self, command: str, handler: callable) -> None:
        """Register a response handler for a command"""
        self._handlers[command] = handler

    def set_response(self, request_id: str, response: Dict[str, Any]) -> None:
        """Set a predefined response for a request ID"""
        self.responses[request_id] = response

    async def send(self, message: str) -> None:
        """Mock send - records message"""
        self.messages.append(json.loads(message))
        self.call_count += 1

    async def recv(self) -> str:
        """Mock recv - returns queued response"""
        # This would be overridden in actual tests with AsyncMock
        pass

    async def close(self) -> None:
        """Mock close"""
        pass

    async def __aiter__(self):
        """Allow async iteration"""
        return self

    async def __anext__(self):
        """Block on no more messages"""
        raise asyncio.CancelledError()


@pytest.fixture
def mock_ws_server() -> MockWebSocketServer:
    """Provide mock WebSocket server"""
    return MockWebSocketServer()


@pytest.fixture
def client(event_loop: asyncio.AbstractEventLoop) -> BrowserClient:
    """Provide a client instance with mock WebSocket"""
    client = BrowserClient('ws://localhost:8765', timeout=5.0)
    client._connected = True
    client.ws = AsyncMock()
    client.ws.__aiter__ = lambda self: self
    client.ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)

    yield client

    # Cleanup
    if client.is_connected():
        try:
            event_loop.run_until_complete(client.disconnect())
        except Exception:
            pass


@pytest.fixture
def sample_responses() -> Dict[str, Any]:
    """Provide sample API responses"""
    return {
        'navigation': {
            'navigate': {
                'id': 'test-1',
                'command': 'navigate',
                'success': True,
                'data': {
                    'url': 'https://example.com',
                    'title': 'Example Domain'
                }
            },
            'go_back': {
                'id': 'test-2',
                'command': 'go_back',
                'success': True,
                'data': {'url': 'https://previous.com'}
            },
            'get_url': {
                'id': 'test-3',
                'command': 'get_url',
                'success': True,
                'data': {'url': 'https://example.com'}
            },
            'get_title': {
                'id': 'test-4',
                'command': 'get_title',
                'success': True,
                'data': {'title': 'Example Domain'}
            }
        },
        'interaction': {
            'click': {
                'id': 'test-5',
                'command': 'click',
                'success': True,
                'data': {'clicked': True, 'selector': 'button.submit'}
            },
            'fill': {
                'id': 'test-6',
                'command': 'fill',
                'success': True,
                'data': {'filled': True, 'value': 'test value'}
            },
            'type_text': {
                'id': 'test-7',
                'command': 'type_text',
                'success': True,
                'data': {'typed': True, 'characters': 10}
            },
            'scroll': {
                'id': 'test-8',
                'command': 'scroll',
                'success': True,
                'data': {'scrolled': True, 'x': 0, 'y': 500}
            },
            'hover': {
                'id': 'test-9',
                'command': 'hover',
                'success': True,
                'data': {'hovered': True}
            }
        },
        'extraction': {
            'get_content': {
                'id': 'test-10',
                'command': 'get_content',
                'success': True,
                'data': {
                    'html': '<html><body>Test</body></html>',
                    'text': 'Test content',
                    'links': ['https://example.com/link1', 'https://example.com/link2']
                }
            },
            'extract_links': {
                'id': 'test-11',
                'command': 'extract_links',
                'success': True,
                'data': {
                    'internal': ['https://example.com/page1', 'https://example.com/page2'],
                    'external': ['https://external.com']
                }
            },
            'extract_images': {
                'id': 'test-12',
                'command': 'extract_images',
                'success': True,
                'data': {
                    'images': [
                        {'src': 'img1.png', 'alt': 'Image 1'},
                        {'src': 'img2.jpg', 'alt': 'Image 2'}
                    ]
                }
            },
            'extract_metadata': {
                'id': 'test-13',
                'command': 'extract_metadata',
                'success': True,
                'data': {
                    'meta': [
                        {'name': 'description', 'content': 'Example description'},
                        {'property': 'og:title', 'content': 'Example Title'}
                    ]
                }
            },
            'extract_forms': {
                'id': 'test-14',
                'command': 'extract_forms',
                'success': True,
                'data': {
                    'forms': [
                        {
                            'id': 'form1',
                            'action': '/submit',
                            'method': 'post',
                            'fields': [
                                {'name': 'email', 'type': 'email'},
                                {'name': 'password', 'type': 'password'}
                            ]
                        }
                    ]
                }
            },
            'detect_technology': {
                'id': 'test-15',
                'command': 'detect_technology',
                'success': True,
                'data': {
                    'frameworks': [{'name': 'React', 'version': '18.0.0'}],
                    'cms': [],
                    'servers': [{'name': 'nginx'}],
                    'languages': [{'name': 'JavaScript'}]
                }
            }
        },
        'screenshot': {
            'screenshot': {
                'id': 'test-16',
                'command': 'screenshot',
                'success': True,
                'data': {
                    'image': 'data:image/png;base64,iVBORw0KGgoAAAANS...',
                    'format': 'png',
                    'size': 1024
                }
            },
            'screenshot_full_page': {
                'id': 'test-17',
                'command': 'screenshot_full_page',
                'success': True,
                'data': {
                    'image': 'data:image/png;base64,iVBORw0KGgoAAAANS...',
                    'height': 2000
                }
            },
            'screenshot_element': {
                'id': 'test-18',
                'command': 'screenshot_element',
                'success': True,
                'data': {
                    'image': 'data:image/png;base64,iVBORw0KGgoAAAANS...',
                    'selector': 'button.submit'
                }
            }
        },
        'session': {
            'create_checkpoint': {
                'id': 'test-19',
                'command': 'create_checkpoint',
                'success': True,
                'data': {
                    'checkpointId': 'cp-001',
                    'checkpointName': 'test-checkpoint',
                    'timestamp': 1234567890,
                    'requestCount': 42
                }
            },
            'rollback_to_checkpoint': {
                'id': 'test-20',
                'command': 'rollback_to_checkpoint',
                'success': True,
                'data': {
                    'checkpointId': 'cp-001',
                    'restoredAt': 1234567891
                }
            },
            'list_checkpoints': {
                'id': 'test-21',
                'command': 'list_checkpoints',
                'success': True,
                'data': {
                    'checkpoints': [
                        {'id': 'cp-001', 'name': 'checkpoint-1', 'timestamp': 1234567890},
                        {'id': 'cp-002', 'name': 'checkpoint-2', 'timestamp': 1234567891}
                    ]
                }
            },
            'branch_session': {
                'id': 'test-22',
                'command': 'branch_session',
                'success': True,
                'data': {
                    'branchId': 'branch-001',
                    'branchName': 'experiment-a',
                    'parentSessionId': 'session-001'
                }
            }
        },
        'error': {
            'connection_error': {
                'id': 'error-1',
                'command': 'navigate',
                'success': False,
                'error': 'Connection timeout',
                'recovery': {
                    'suggestion': 'Reconnect and retry',
                    'alternativeCommands': ['ping', 'get_url']
                }
            },
            'invalid_selector': {
                'id': 'error-2',
                'command': 'click',
                'success': False,
                'error': 'Element not found',
                'recovery': {
                    'suggestion': 'Verify selector',
                    'alternativeCommands': ['wait_for_element']
                }
            },
            'rate_limited': {
                'id': 'error-3',
                'command': 'navigate',
                'success': False,
                'error': 'Rate limited',
                'recovery': {
                    'suggestion': 'Wait 60 seconds',
                    'alternativeCommands': ['rotate_proxy', 'rotate_user_agent']
                }
            },
            'invalid_state': {
                'id': 'error-4',
                'command': 'execute_script',
                'success': False,
                'error': 'Invalid page state',
                'recovery': {
                    'suggestion': 'Navigate to a page first',
                    'alternativeCommands': ['navigate', 'refresh']
                }
            }
        }
    }


@pytest.fixture
def sample_responses_file(tmp_path: Path) -> Path:
    """Create a sample responses JSON file"""
    responses = {
        'navigation': {
            'navigate': {'success': True, 'url': 'https://example.com'},
            'get_url': {'success': True, 'url': 'https://example.com'}
        },
        'interaction': {
            'click': {'success': True},
            'fill': {'success': True}
        },
        'extraction': {
            'get_content': {'success': True, 'text': 'Page content'},
            'extract_links': {'success': True, 'links': ['https://example.com/link1']}
        }
    }

    file_path = tmp_path / "sample-responses.json"
    with open(file_path, 'w') as f:
        json.dump(responses, f)

    return file_path


@pytest.fixture
def configure_logging():
    """Configure logging for tests"""
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)
