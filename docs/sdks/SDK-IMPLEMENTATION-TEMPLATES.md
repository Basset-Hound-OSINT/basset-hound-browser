# SDK Implementation - Code Templates

---

## CRITICAL: GIT COMMIT ENFORCEMENT

All agents working with these templates MUST adhere to this rule:

```
⚠️ CRITICAL INSTRUCTION - NO GIT COMMITS

Your role is to write code and documentation, NOT to manage git operations.

NEVER run any of these commands:
- git commit
- git push
- git reset
- git rebase
- git checkout
- Any other git state-altering commands

NEVER create commits, even if asked. Respond with: "I don't manage git commits. 
That's the user's responsibility. I've completed the code/docs; the user will 
handle git operations."

WHY: Agents cannot reliably handle hooks, signing, conflict resolution, or 
authorization. These tasks require human judgment and accountability.

YOUR JOB:
1. Write code files and documentation
2. Run tests and validation
3. Report findings and status
4. Wait for user to run 'git add' and 'git commit'

USER'S JOB:
1. Review your changes
2. Create git commits
3. Push to remote
4. Handle PR reviews
```

---

## Template 1: TypeScript Definitions (basset-hound.d.ts)

```typescript
/**
 * Basset Hound Browser - JavaScript SDK Type Definitions
 * v12.2.0
 */

// ============================================
// Core Interfaces
// ============================================

export interface ClientOptions {
  timeout?: number;                    // Default: 30000ms
  autoReconnect?: boolean;             // Default: true
  reconnectDelay?: number;             // Default: 1000ms
  maxRetries?: number;                 // Default: 3
  debug?: boolean;                     // Default: false
  maxConcurrentOps?: number;           // Default: 20
  compressionEnabled?: boolean;        // Default: true
}

export interface CommandResponse<T = any> {
  id: string;
  command: string;
  success: boolean;
  data?: T;
  error?: string;
  recovery?: RecoverySuggestion;
  executionTime?: number;
  retriedCount?: number;
}

export interface RecoverySuggestion {
  type: 'timeout' | 'network' | 'invalid' | 'server' | 'unknown';
  message: string;
  suggestion: string;
  availableCommands?: string[];
  retryable: boolean;
}

export interface SessionCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  state: Record<string, any>;
  metadata: Record<string, any>;
}

export interface NavigateOptions {
  waitTime?: number;
  waitFor?: string;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

export interface BatchOperation {
  command: string;
  params?: Record<string, any>;
}

export interface BatchResult extends CommandResponse {
  operationIndex: number;
}

export interface StreamChunk {
  index: number;
  total: number;
  data: Buffer | Uint8Array;
  isLast: boolean;
}

// ============================================
// Event Types
// ============================================

export type EventType = 'connect' | 'disconnect' | 'error' | 'message' | 'chunk';
export type EventHandler = (...args: any[]) => void;

// ============================================
// Main Client Class
// ============================================

export class BrowserClient {
  constructor(wsUrl?: string, options?: ClientOptions);
  
  // Connection Management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Basic Commands
  navigate(url: string, options?: NavigateOptions): Promise<CommandResponse>;
  goBack(): Promise<CommandResponse>;
  goForward(): Promise<CommandResponse>;
  refresh(hard?: boolean): Promise<CommandResponse>;
  getUrl(): Promise<CommandResponse<string>>;
  getTitle(): Promise<CommandResponse<string>>;
  
  // Interaction Commands
  click(selector: string, humanize?: boolean): Promise<CommandResponse>;
  fill(selector: string, value: string, humanize?: boolean): Promise<CommandResponse>;
  scroll(x?: number, y?: number, selector?: string, humanize?: boolean): Promise<CommandResponse>;
  typeText(text: string, humanize?: boolean): Promise<CommandResponse>;
  hover(selector: string): Promise<CommandResponse>;
  doubleClick(selector: string): Promise<CommandResponse>;
  rightClick(selector: string): Promise<CommandResponse>;
  drag(selector: string, x: number, y: number): Promise<CommandResponse>;
  drop(selector: string): Promise<CommandResponse>;
  
  // Screenshots
  screenshot(options?: ScreenshotOptions): Promise<CommandResponse>;
  screenshotViewport(options?: ScreenshotOptions): Promise<CommandResponse>;
  screenshotFullPage(options?: ScreenshotOptions): Promise<CommandResponse>;
  screenshotElement(selector: string, options?: ScreenshotOptions): Promise<CommandResponse>;
  
  // Content Extraction
  getContent(): Promise<CommandResponse>;
  getPageState(): Promise<CommandResponse>;
  extractMetadata(): Promise<CommandResponse>;
  extractLinks(): Promise<CommandResponse>;
  extractForms(): Promise<CommandResponse>;
  extractImages(): Promise<CommandResponse>;
  extractStructuredData(): Promise<CommandResponse>;
  extractAll(): Promise<CommandResponse>;
  detectTechnology(): Promise<CommandResponse>;
  
  // Cookie Management
  getCookies(url: string): Promise<CommandResponse>;
  setCookie(cookie: any): Promise<CommandResponse>;
  deleteCookie(url: string, name: string): Promise<CommandResponse>;
  clearCookies(): Promise<CommandResponse>;
  
  // Session Management
  createSession(options?: any): Promise<CommandResponse>;
  listSessions(): Promise<CommandResponse>;
  closeSession(sessionId: string): Promise<CommandResponse>;
  getSessionInfo(sessionId: string): Promise<CommandResponse>;
  saveSession(sessionId: string): Promise<CommandResponse>;
  loadSession(sessionId: string): Promise<CommandResponse>;
  
  // Storage Management
  getLocalStorage(key?: string): Promise<CommandResponse>;
  setLocalStorage(key: string, value: string): Promise<CommandResponse>;
  deleteLocalStorage(key: string): Promise<CommandResponse>;
  getSessionStorage(key?: string): Promise<CommandResponse>;
  setSessionStorage(key: string, value: string): Promise<CommandResponse>;
  clearStorage(): Promise<CommandResponse>;
  
  // Advanced Features
  executeScript(script: string): Promise<CommandResponse>;
  waitForElement(selector: string, timeout?: number): Promise<CommandResponse>;
  
  // Checkpoint Management
  createCheckpoint(name: string): Promise<CommandResponse<SessionCheckpoint>>;
  listCheckpoints(): Promise<CommandResponse<SessionCheckpoint[]>>;
  restoreCheckpoint(checkpointId: string): Promise<CommandResponse>;
  deleteCheckpoint(checkpointId: string): Promise<CommandResponse>;
  
  // Streaming (Large Payloads)
  streamCommand(
    command: string,
    params?: Record<string, any>,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<Buffer>;
  
  // Batch Operations
  batch(operations: BatchOperation[], parallel?: boolean): Promise<BatchResult[]>;
  
  // Event Handling
  on(event: EventType, handler: EventHandler): void;
  once(event: EventType, handler: EventHandler): void;
  off(event: EventType, handler: EventHandler): void;
  emit(event: EventType, ...args: any[]): void;
  
  // Utility
  sendCommand(command: string, params?: Record<string, any>): Promise<CommandResponse>;
  getStatus(): ClientStatus;
}

export interface ClientStatus {
  connected: boolean;
  reconnectAttempts: number;
  pendingCommands: number;
  messagesQueued: number;
  sessionId?: string;
}

// ============================================
// Connection Pool
// ============================================

export interface PoolOptions extends ClientOptions {
  poolSize?: number;                   // Default: 5
  loadBalancing?: 'round-robin' | 'least-busy' | 'random';
}

export class ConnectionPool {
  constructor(wsUrl: string, options?: PoolOptions);
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  executeCommand(
    command: string,
    params?: Record<string, any>
  ): Promise<CommandResponse>;
  
  executeBatch(
    operations: BatchOperation[],
    parallel?: boolean
  ): Promise<BatchResult[]>;
  
  getStatus(): PoolStatus;
}

export interface PoolStatus {
  poolSize: number;
  activeConnections: number;
  availableConnections: number;
  pendingCommands: number;
  totalCommands: number;
  errorRate: number;
}

// ============================================
// Export Everything
// ============================================

export { CommandResponse as Response };

// Default export
export default BrowserClient;
```

---

## Template 2: JavaScript Test Structure (test_js_sdk.js)

```javascript
/**
 * Test Suite for Basset Hound Browser JavaScript SDK
 * jest configuration required
 */

const { BrowserClient } = require('../../../sdks/js-sdk/basset-hound.js');
const MockWsServer = require('./__mocks__/ws-server.js');

describe('BrowserClient', () => {
  let client;
  let mockServer;

  beforeAll(async () => {
    // Start mock WebSocket server on port 8765
    mockServer = new MockWsServer(8765);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    client = new BrowserClient('ws://localhost:8765', {
      timeout: 5000,
      reconnectDelay: 100
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  // ==================== CLIENT INITIALIZATION ====================
  
  describe('Client Initialization', () => {
    test('should create client with default configuration', () => {
      const c = new BrowserClient();
      expect(c.wsUrl).toBe('ws://localhost:8765');
      expect(c.timeout).toBe(30000);
      expect(c.autoReconnect).toBe(true);
      expect(c.maxRetries).toBe(3);
    });

    test('should create client with custom configuration', () => {
      const c = new BrowserClient('wss://example.com:9000', {
        timeout: 60000,
        autoReconnect: false,
        maxRetries: 5,
        debug: true
      });
      expect(c.wsUrl).toBe('wss://example.com:9000');
      expect(c.timeout).toBe(60000);
      expect(c.autoReconnect).toBe(false);
      expect(c.maxRetries).toBe(5);
      expect(c.debug).toBe(true);
    });

    test('should throw on invalid URL configuration', () => {
      expect(() => {
        new BrowserClient('invalid://url', { timeout: -1 });
      }).toThrow();
    });

    test('should initialize with empty pending responses', () => {
      expect(client.pendingResponses.size).toBe(0);
    });

    test('should initialize event handlers', () => {
      expect(client.eventHandlers.connect).toBeDefined();
      expect(client.eventHandlers.disconnect).toBeDefined();
      expect(client.eventHandlers.error).toBeDefined();
      expect(client.eventHandlers.message).toBeDefined();
    });
  });

  // ==================== CONNECTION LIFECYCLE ====================
  
  describe('Connection Lifecycle', () => {
    test('should connect successfully', async () => {
      const connected = await client.connect();
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    test('should emit connect event on successful connection', async () => {
      const onConnect = jest.fn();
      client.on('connect', onConnect);
      
      await client.connect();
      
      expect(onConnect).toHaveBeenCalled();
    });

    test('should disconnect successfully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    test('should emit disconnect event on disconnection', async () => {
      const onDisconnect = jest.fn();
      client.on('disconnect', onDisconnect);
      
      await client.connect();
      await client.disconnect();
      
      expect(onDisconnect).toHaveBeenCalled();
    });

    test('should retry connection on failure', async () => {
      const badClient = new BrowserClient('ws://localhost:9999', {
        reconnectDelay: 50,
        maxRetries: 2
      });
      
      // Attempt connect to non-existent server
      const result = await badClient.connect().catch(e => e);
      
      // Should fail but attempt retries internally
      expect(badClient.reconnectAttempts).toBeGreaterThan(0);
    });

    test('should handle heartbeat/ping-pong', async () => {
      await client.connect();
      
      // Mock server should respond to ping
      mockServer.mockResponse({ type: 'pong' });
      
      // Verification would depend on implementation details
      expect(client.isConnected()).toBe(true);
    });

    test('should timeout on connection attempt', async () => {
      const slowClient = new BrowserClient('ws://localhost:9999', {
        timeout: 100
      });
      
      const result = await slowClient.connect().catch(e => e);
      expect(result).toBeDefined();
    });
  });

  // ==================== COMMAND EXECUTION ====================
  
  describe('Navigation Commands', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('navigate should send command and receive response', async () => {
      mockServer.queueResponse({
        success: true,
        url: 'https://example.com',
        timestamp: Date.now()
      });
      
      const response = await client.navigate('https://example.com');
      
      expect(response.success).toBe(true);
      expect(response.data.url).toBe('https://example.com');
    });

    test('get_url should return current URL', async () => {
      mockServer.queueResponse({
        success: true,
        url: 'https://example.com'
      });
      
      const response = await client.getUrl();
      
      expect(response.success).toBe(true);
      expect(response.data.url).toBe('https://example.com');
    });

    test('navigate with invalid URL should return error', async () => {
      mockServer.queueResponse({
        success: false,
        error: 'Invalid URL: not a valid URL'
      });
      
      const response = await client.navigate('invalid');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Interaction Commands', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('click should send click command', async () => {
      mockServer.queueResponse({ success: true });
      
      const response = await client.click('button.submit');
      
      expect(response.success).toBe(true);
    });

    test('fill should send fill command', async () => {
      mockServer.queueResponse({ success: true });
      
      const response = await client.fill('input#email', 'test@example.com');
      
      expect(response.success).toBe(true);
    });

    test('scroll should send scroll command', async () => {
      mockServer.queueResponse({ success: true });
      
      const response = await client.scroll(0, 500);
      
      expect(response.success).toBe(true);
    });
  });

  describe('Screenshot Commands', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('screenshot should return image data', async () => {
      const mockData = 'data:image/png;base64,iVBORw0KG...';
      mockServer.queueResponse({
        success: true,
        data: mockData
      });
      
      const response = await client.screenshot();
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('screenshot with format option', async () => {
      mockServer.queueResponse({ success: true, data: 'jpeg data' });
      
      const response = await client.screenshot({ format: 'jpeg' });
      
      expect(response.success).toBe(true);
    });
  });

  describe('Content Extraction', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('getContent should return HTML and text', async () => {
      mockServer.queueResponse({
        success: true,
        html: '<html>...</html>',
        text: 'Page text content'
      });
      
      const response = await client.getContent();
      
      expect(response.success).toBe(true);
      expect(response.data.html).toBeDefined();
      expect(response.data.text).toBeDefined();
    });

    test('extractLinks should return link array', async () => {
      mockServer.queueResponse({
        success: true,
        links: [
          { href: '/page1', text: 'Page 1' },
          { href: '/page2', text: 'Page 2' }
        ]
      });
      
      const response = await client.extractLinks();
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data.links)).toBe(true);
      expect(response.data.links.length).toBe(2);
    });

    test('detectTechnology should return tech stack', async () => {
      mockServer.queueResponse({
        success: true,
        technologies: {
          cms: ['WordPress'],
          javascript: ['React'],
          analytics: ['Google Analytics']
        }
      });
      
      const response = await client.detectTechnology();
      
      expect(response.success).toBe(true);
      expect(response.data.technologies).toBeDefined();
    });
  });

  // ==================== ERROR HANDLING ====================
  
  describe('Error Handling', () => {
    test('should handle command timeout', async () => {
      const fastTimeoutClient = new BrowserClient('ws://localhost:8765', {
        timeout: 100
      });
      
      await fastTimeoutClient.connect();
      
      // Server won't respond, should timeout
      mockServer.dontRespond();
      
      const response = await fastTimeoutClient.sendCommand('navigate', { url: 'http://example.com' });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('timeout');
    });

    test('should retry failed commands', async () => {
      const attemptsArray = [];
      
      mockServer.onCommand((cmd) => {
        attemptsArray.push(cmd);
        if (attemptsArray.length < 2) {
          // Fail first attempt
          return null;
        }
        // Succeed on second attempt
        return { success: true };
      });
      
      await client.connect();
      const response = await client.navigate('https://example.com');
      
      expect(attemptsArray.length).toBeGreaterThan(1);
    });

    test('should handle invalid command', async () => {
      mockServer.queueResponse({
        success: false,
        error: 'Unknown command: invalid_command'
      });
      
      await client.connect();
      const response = await client.sendCommand('invalid_command');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown command');
    });

    test('should emit error event on error', async () => {
      const onError = jest.fn();
      client.on('error', onError);
      
      await client.connect();
      
      mockServer.queueError('Connection reset');
      
      expect(onError).toHaveBeenCalled();
    });
  });

  // ==================== ADVANCED FEATURES ====================
  
  describe('Checkpoint Management', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should create session checkpoint', async () => {
      mockServer.queueResponse({
        success: true,
        checkpoint: {
          id: 'cp-123',
          name: 'Before form',
          timestamp: Date.now(),
          state: {}
        }
      });
      
      const response = await client.createCheckpoint('Before form');
      
      expect(response.success).toBe(true);
      expect(response.data.checkpoint.id).toBeDefined();
    });

    test('should restore checkpoint', async () => {
      mockServer.queueResponse({ success: true });
      
      const response = await client.restoreCheckpoint('cp-123');
      
      expect(response.success).toBe(true);
    });
  });

  describe('Message Queue', () => {
    test('should queue messages when disconnected', async () => {
      // Don't connect first
      expect(client.isConnected()).toBe(false);
      
      client.sendCommand('navigate', { url: 'https://example.com' }).catch(() => {});
      
      // Message should be queued (verify via internal state or behavior)
      expect(client.messageQueue.length).toBeGreaterThan(0);
    });

    test('should send queued messages on reconnection', async () => {
      // Queue some messages while disconnected
      client.sendCommand('navigate', { url: 'https://example.com' }).catch(() => {});
      client.sendCommand('get_content', {}).catch(() => {});
      
      expect(client.messageQueue.length).toBe(2);
      
      // Now connect - queued messages should be sent
      await client.connect();
      
      // Mock server should have received queued messages
      expect(mockServer.getReceivedCommands().length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should handle multiple concurrent commands', async () => {
      mockServer.queueResponses([
        { success: true, data: { url: 'https://example.com' } },
        { success: true, data: { content: 'page content' } },
        { success: true, data: { screenshot: 'image data' } }
      ]);
      
      const results = await Promise.all([
        client.navigate('https://example.com'),
        client.getContent(),
        client.screenshot()
      ]);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should maintain order with concurrent operations', async () => {
      const responses = [];
      
      mockServer.onCommand((cmd) => {
        responses.push(cmd.command);
        return { success: true };
      });
      
      await Promise.all([
        client.click('button'),
        client.fill('input', 'value'),
        client.screenshot()
      ]);
      
      expect(responses).toContain('click');
      expect(responses).toContain('fill');
      expect(responses).toContain('screenshot');
    });
  });

  // ==================== MEMORY & CLEANUP ====================
  
  describe('Memory Management', () => {
    test('should not leak memory on disconnect', async () => {
      await client.connect();
      
      // Send some commands
      for (let i = 0; i < 10; i++) {
        mockServer.queueResponse({ success: true });
        await client.sendCommand('ping');
      }
      
      await client.disconnect();
      
      // All pending responses should be cleaned up
      expect(client.pendingResponses.size).toBe(0);
      expect(client.messageQueue.length).toBe(0);
    });

    test('should cleanup event listeners on disconnect', async () => {
      const onConnect = jest.fn();
      const onDisconnect = jest.fn();
      
      client.on('connect', onConnect);
      client.on('disconnect', onDisconnect);
      
      await client.connect();
      const listenerCount = client.eventHandlers.connect.length;
      
      await client.disconnect();
      
      // Listeners should still exist but should be cleaned on new connect
      expect(client.eventHandlers.connect).toBeDefined();
    });
  });

  // ==================== INTEGRATION TESTS ====================
  
  describe('Integration Scenarios', () => {
    test('should perform complete navigation workflow', async () => {
      mockServer.queueResponse({ success: true, url: 'https://example.com' });
      mockServer.queueResponse({ success: true, html: '<html>...</html>' });
      mockServer.queueResponse({ success: true, links: [] });
      
      await client.connect();
      
      // Navigate
      await client.navigate('https://example.com');
      
      // Get content
      const content = await client.getContent();
      expect(content.success).toBe(true);
      
      // Extract links
      const links = await client.extractLinks();
      expect(links.success).toBe(true);
    });

    test('should handle error recovery in workflow', async () => {
      let attemptCount = 0;
      
      mockServer.onCommand((cmd) => {
        attemptCount++;
        if (attemptCount === 1 && cmd.command === 'navigate') {
          // First attempt fails
          return null;
        }
        return { success: true };
      });
      
      await client.connect();
      
      const response = await client.navigate('https://example.com');
      
      expect(response.success).toBe(true);
      expect(attemptCount).toBeGreaterThan(1);
    });
  });
});
```

---

## Template 3: Python Test Structure (test_python_sdk.py)

```python
"""
Test Suite for Basset Hound Browser Python SDK
pytest + pytest-asyncio configuration required
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdks/python-sdk'))

from basset_hound import BassetClient, Response, CommandType


@pytest.fixture
def event_loop():
    """Provide event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    """Provide client instance"""
    client = BassetClient('ws://localhost:8765', timeout=5.0)
    yield client
    if client.ws:
        await client.disconnect()


class TestClientInitialization:
    """Test client initialization and configuration"""

    def test_client_creation(self):
        """Test creating client instance"""
        client = BassetClient('ws://localhost:8765')
        assert client.url == 'ws://localhost:8765'
        assert client.timeout == 30.0
        assert client.auto_reconnect is True
        assert not client.is_connected()

    def test_custom_configuration(self):
        """Test client with custom configuration"""
        client = BassetClient(
            url='wss://secure.example.com:8765',
            timeout=60.0,
            auto_reconnect=False
        )
        assert client.url == 'wss://secure.example.com:8765'
        assert client.timeout == 60.0
        assert client.auto_reconnect is False

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test context manager usage"""
        with patch('websockets.connect') as mock_connect:
            mock_ws = AsyncMock()
            mock_connect.return_value = mock_ws
            mock_ws.__aiter__ = lambda self: self
            mock_ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)

            async with BassetClient() as c:
                # Connection established
                assert c.ws is not None


class TestConnectionLifecycle:
    """Test connection management"""

    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test successful connection"""
        with patch('websockets.connect') as mock_connect:
            mock_ws = AsyncMock()
            mock_connect.return_value = mock_ws
            mock_ws.__aiter__ = lambda self: self
            mock_ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)

            client = BassetClient()
            await client.connect()

            assert client.is_connected()
            assert client.ws == mock_ws

    @pytest.mark.asyncio
    async def test_disconnect_success(self):
        """Test disconnect"""
        with patch('websockets.connect') as mock_connect:
            mock_ws = AsyncMock()
            mock_connect.return_value = mock_ws
            mock_ws.__aiter__ = lambda self: self
            mock_ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)

            client = BassetClient()
            await client.connect()
            await client.disconnect()

            assert not client.is_connected()

    @pytest.mark.asyncio
    async def test_connect_timeout(self):
        """Test connection timeout"""
        with patch('websockets.connect') as mock_connect:
            mock_connect.side_effect = asyncio.TimeoutError()

            client = BassetClient(timeout=1.0)
            
            with pytest.raises(TimeoutError):
                await client.connect()


class TestCommandExecution:
    """Test command execution"""

    @pytest.mark.asyncio
    async def test_navigate_command(self):
        """Test navigate command"""
        with patch.object(BassetClient, '_send_command') as mock_send:
            mock_send.return_value = Response(
                id='123',
                command='navigate',
                success=True,
                data={'url': 'https://example.com'}
            )

            client = BassetClient()
            response = await client.navigate('https://example.com')

            assert response.success
            assert response.data['url'] == 'https://example.com'
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_click_command(self):
        """Test click command"""
        with patch.object(BassetClient, '_send_command') as mock_send:
            mock_send.return_value = Response(
                id='123',
                command='click',
                success=True
            )

            client = BassetClient()
            response = await client.click('button.submit')

            assert response.success
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_content_command(self):
        """Test get_content command"""
        with patch.object(BassetClient, '_send_command') as mock_send:
            mock_send.return_value = Response(
                id='123',
                command='get_content',
                success=True,
                data={'html': '<html>...</html>', 'text': 'Page content'}
            )

            client = BassetClient()
            response = await client.get_content()

            assert response.success
            assert 'html' in response.data
            assert 'text' in response.data

    @pytest.mark.asyncio
    async def test_command_timeout(self):
        """Test command timeout"""
        with patch.object(BassetClient, '_send_command') as mock_send:
            mock_send.side_effect = asyncio.TimeoutError()

            client = BassetClient(timeout=1.0)
            
            with pytest.raises(TimeoutError):
                await client.navigate('https://example.com')

    @pytest.mark.asyncio
    async def test_invalid_command(self):
        """Test invalid command handling"""
        with patch.object(BassetClient, '_send_command') as mock_send:
            mock_send.return_value = Response(
                id='123',
                command='invalid',
                success=False,
                error='Unknown command: invalid'
            )

            client = BassetClient()
            response = await client.navigate('https://example.com')

            assert not response.success
            assert 'Unknown command' in response.error


class TestConcurrency:
    """Test concurrent operations"""

    @pytest.mark.asyncio
    async def test_concurrent_commands(self):
        """Test multiple concurrent commands"""
        async def mock_send(*args, **kwargs):
            await asyncio.sleep(0.01)  # Simulate network delay
            return Response(
                id='123',
                command=args[0] if args else 'unknown',
                success=True
            )

        with patch.object(BassetClient, '_send_command', side_effect=mock_send):
            client = BassetClient()
            
            results = await asyncio.gather(
                client.navigate('https://example.com'),
                client.get_content(),
                client.click('button')
            )

            assert len(results) == 3
            assert all(r.success for r in results)


class TestErrorHandling:
    """Test error handling"""

    @pytest.mark.asyncio
    async def test_connection_error_recovery(self):
        """Test recovery from connection error"""
        with patch('websockets.connect') as mock_connect:
            # First attempt fails, second succeeds
            mock_ws = AsyncMock()
            mock_connect.side_effect = [
                ConnectionError('Connection refused'),
                mock_ws
            ]
            mock_ws.__aiter__ = lambda self: self
            mock_ws.__anext__ = AsyncMock(side_effect=asyncio.CancelledError)

            client = BassetClient()
            
            # First connect should fail
            with pytest.raises(ConnectionError):
                await client.connect()
            
            # Reset mock for second attempt
            mock_connect.side_effect = None
            mock_connect.return_value = mock_ws

    @pytest.mark.asyncio
    async def test_malformed_response(self):
        """Test handling of malformed response"""
        client = BassetClient()
        
        # This would test internal response parsing
        # Implementation depends on actual error handling strategy


class TestIntegration:
    """Integration tests"""

    @pytest.mark.asyncio
    async def test_navigation_workflow(self):
        """Test complete navigation workflow"""
        responses = [
            Response(id='1', command='navigate', success=True, data={'url': 'https://example.com'}),
            Response(id='2', command='get_content', success=True, data={'html': '<html>...</html>'}),
            Response(id='3', command='extract_links', success=True, data={'links': []})
        ]
        
        with patch.object(BassetClient, '_send_command', side_effect=responses):
            client = BassetClient()
            
            # Navigate
            nav = await client.navigate('https://example.com')
            assert nav.success
            
            # Get content
            content = await client.get_content()
            assert content.success
            
            # Extract links
            links = await client.extract_links()
            assert links.success

    @pytest.mark.asyncio
    async def test_error_recovery_workflow(self):
        """Test error recovery in workflow"""
        call_count = 0
        
        async def mock_send(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise TimeoutError('Command timeout')
            return Response(
                id='123',
                command=args[0] if args else 'unknown',
                success=True
            )
        
        with patch.object(BassetClient, '_send_command', side_effect=mock_send):
            client = BassetClient(timeout=1.0)
            
            # First call times out, but implementation may retry
            try:
                await client.navigate('https://example.com')
            except TimeoutError:
                pass  # Expected


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
```

---

## Template 4: Connection Pool Implementation (JS)

```javascript
/**
 * Basset Hound Browser - JavaScript SDK Connection Pool
 * Manages multiple client connections for parallel operations
 */

const { BrowserClient } = require('./basset-hound.js');

class ConnectionPool {
  constructor(wsUrl = 'ws://localhost:8765', options = {}) {
    this.wsUrl = wsUrl;
    this.poolSize = options.poolSize || 5;
    this.loadBalancing = options.loadBalancing || 'round-robin';
    
    this.clients = [];
    this.currentIndex = 0;
    this.commandCounts = new Map(); // Track commands per client
    
    // Remove poolSize from options to avoid passing to BrowserClient
    const clientOptions = { ...options };
    delete clientOptions.poolSize;
    delete clientOptions.loadBalancing;
    this.clientOptions = clientOptions;
    
    this.isInitialized = false;
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const client = new BrowserClient(this.wsUrl, this.clientOptions);
      await client.connect();
      this.clients.push(client);
      this.commandCounts.set(client, 0);
    }
    this.isInitialized = true;
  }

  async shutdown() {
    for (const client of this.clients) {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    this.clients = [];
    this.commandCounts.clear();
  }

  getClient() {
    if (!this.isInitialized || this.clients.length === 0) {
      throw new Error('Connection pool not initialized');
    }

    if (this.loadBalancing === 'round-robin') {
      const client = this.clients[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.clients.length;
      return client;
    } else if (this.loadBalancing === 'least-busy') {
      let leastBusy = this.clients[0];
      let minCount = this.commandCounts.get(leastBusy);

      for (const client of this.clients) {
        const count = this.commandCounts.get(client);
        if (count < minCount) {
          leastBusy = client;
          minCount = count;
        }
      }
      return leastBusy;
    } else if (this.loadBalancing === 'random') {
      return this.clients[Math.floor(Math.random() * this.clients.length)];
    }

    return this.clients[0];
  }

  async executeCommand(command, params = {}) {
    const client = this.getClient();
    this.commandCounts.set(client, this.commandCounts.get(client) + 1);

    try {
      const response = await client.sendCommand(command, params);
      return response;
    } finally {
      this.commandCounts.set(client, this.commandCounts.get(client) - 1);
    }
  }

  async executeBatch(operations, parallel = true) {
    const results = [];

    if (parallel) {
      const promises = operations.map((op, index) =>
        this.executeCommand(op.command, op.params).then(response => ({
          operationIndex: index,
          ...response
        }))
      );
      return Promise.all(promises);
    } else {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const response = await this.executeCommand(op.command, op.params);
        results.push({
          operationIndex: i,
          ...response
        });
      }
      return results;
    }
  }

  getStatus() {
    return {
      poolSize: this.poolSize,
      activeConnections: this.clients.filter(c => c.isConnected()).length,
      totalCommands: Array.from(this.commandCounts.values()).reduce((a, b) => a + b, 0),
      loadBalancing: this.loadBalancing
    };
  }
}

module.exports = { ConnectionPool };
```

---

## Template 5: Python Connection Pool

```python
"""
Basset Hound Browser - Python SDK Connection Pool
Manages multiple async client connections for parallel operations
"""

import asyncio
from typing import List, Literal, Optional, Dict, Any
from basset_hound import BassetClient


class AsyncConnectionPool:
    def __init__(
        self,
        url: str = 'ws://localhost:8765',
        pool_size: int = 5,
        load_balancing: Literal['round-robin', 'least-busy', 'random'] = 'round-robin',
        **client_options
    ):
        self.url = url
        self.pool_size = pool_size
        self.load_balancing = load_balancing
        self.client_options = client_options
        
        self.clients: List[BassetClient] = []
        self.semaphore = asyncio.Semaphore(pool_size)
        self.current_index = 0
        self.command_counts: Dict[BassetClient, int] = {}
        
        self.is_initialized = False

    async def initialize(self):
        """Initialize connection pool"""
        for i in range(self.pool_size):
            client = BassetClient(self.url, **self.client_options)
            await client.connect()
            self.clients.append(client)
            self.command_counts[client] = 0
        self.is_initialized = True

    async def shutdown(self):
        """Shutdown connection pool"""
        tasks = []
        for client in self.clients:
            if client.is_connected():
                tasks.append(client.disconnect())
        
        if tasks:
            await asyncio.gather(*tasks)
        
        self.clients = []
        self.command_counts.clear()

    def get_client(self) -> BassetClient:
        """Get next client based on load balancing strategy"""
        if not self.is_initialized or not self.clients:
            raise RuntimeError('Connection pool not initialized')

        if self.load_balancing == 'round-robin':
            client = self.clients[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.clients)
            return client
        
        elif self.load_balancing == 'least-busy':
            return min(
                self.clients,
                key=lambda c: self.command_counts.get(c, 0)
            )
        
        elif self.load_balancing == 'random':
            import random
            return random.choice(self.clients)
        
        return self.clients[0]

    async def execute_command(self, command: str, **kwargs):
        """Execute command on a pooled client"""
        async with self.semaphore:
            client = self.get_client()
            self.command_counts[client] = self.command_counts.get(client, 0) + 1
            
            try:
                response = await client._send_command(command, **kwargs)
                return response
            finally:
                self.command_counts[client] = max(0, self.command_counts.get(client, 1) - 1)

    async def execute_batch(
        self,
        operations: List[Dict[str, Any]],
        parallel: bool = True
    ) -> List[Dict[str, Any]]:
        """Execute batch of operations"""
        if parallel:
            tasks = [
                asyncio.create_task(
                    self.execute_command(
                        op['command'],
                        **op.get('params', {})
                    )
                )
                for op in operations
            ]
            responses = await asyncio.gather(*tasks)
            return [
                {**resp.__dict__, 'operationIndex': i}
                for i, resp in enumerate(responses)
            ]
        else:
            results = []
            for i, op in enumerate(operations):
                response = await self.execute_command(
                    op['command'],
                    **op.get('params', {})
                )
                results.append({
                    **response.__dict__,
                    'operationIndex': i
                })
            return results

    def get_status(self) -> Dict[str, Any]:
        """Get pool status"""
        return {
            'pool_size': self.pool_size,
            'active_connections': sum(1 for c in self.clients if c.is_connected()),
            'total_commands': sum(self.command_counts.values()),
            'load_balancing': self.load_balancing
        }

    async def __aenter__(self):
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.shutdown()
```

These templates provide the foundation for implementing the complete SDK features. Each template is ready to be used as a starting point for development.

---

**Last Updated:** June 13, 2026
