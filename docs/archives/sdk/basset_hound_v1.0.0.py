"""
Basset Hound Browser - Python SDK
Provides Python developers with seamless integration for OSINT automation

Version: 1.0.0
Created: May 31, 2026

Usage:
    from basset_hound import BassetClient

    async with BassetClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        content = await client.get_content()
        print(content)
"""

import asyncio
import json
import logging
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass
from enum import Enum
import websockets
from websockets.client import WebSocketClientProtocol
import uuid

logger = logging.getLogger(__name__)


class CommandType(Enum):
    """WebSocket command types"""
    NAVIGATE = "navigate"
    GET_CONTENT = "get_content"
    GET_PAGE_STATE = "get_page_state"
    CLICK = "click"
    FILL = "fill"
    SCROLL = "scroll"
    SCREENSHOT = "screenshot"
    EXTRACT_ALL = "extract_all"
    EXECUTE_SCRIPT = "execute_script"
    GET_COOKIES = "get_cookies"
    SET_COOKIE = "set_cookie"
    CREATE_SESSION = "create_session"
    CREATE_FINGERPRINT_PROFILE = "create_fingerprint_profile"
    APPLY_FINGERPRINT = "apply_fingerprint"
    CREATE_BEHAVIORAL_PROFILE = "create_behavioral_profile"
    GENERATE_MOUSE_PATH = "generate_mouse_path"
    INIT_EVIDENCE_CHAIN = "init_evidence_chain"
    COLLECT_SCREENSHOT_CHAIN = "collect_screenshot_chain"
    DETECT_TECHNOLOGY = "detect_technology"


@dataclass
class Response:
    """Standard response wrapper"""
    id: str
    command: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    recovery: Optional[Dict[str, Any]] = None

    @classmethod
    def from_json(cls, data: Dict):
        return cls(**data)


class BassetClient:
    """
    Main client for Basset Hound Browser
    Provides async/await interface for all WebSocket operations
    """

    def __init__(
        self,
        url: str = "ws://localhost:8765",
        timeout: float = 30.0,
        auto_reconnect: bool = True
    ):
        self.url = url
        self.timeout = timeout
        self.auto_reconnect = auto_reconnect
        self.ws: Optional[WebSocketClientProtocol] = None
        self.pending_responses: Dict[str, asyncio.Future] = {}
        self._task: Optional[asyncio.Task] = None

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()

    async def connect(self):
        """Establish WebSocket connection"""
        try:
            self.ws = await asyncio.wait_for(
                websockets.connect(self.url),
                timeout=self.timeout
            )
            self._task = asyncio.create_task(self._message_loop())
            logger.info(f"Connected to {self.url}")
        except asyncio.TimeoutError:
            raise TimeoutError(f"Failed to connect to {self.url} within {self.timeout}s")

    async def disconnect(self):
        """Close WebSocket connection"""
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self.ws:
            await self.ws.close()
            logger.info("Disconnected")

    async def _message_loop(self):
        """Background task for receiving messages"""
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    response_id = data.get('id')

                    if response_id and response_id in self.pending_responses:
                        future = self.pending_responses.pop(response_id)
                        if not future.done():
                            future.set_result(Response.from_json(data))
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Message loop error: {e}")

    async def _send_command(
        self,
        command: str,
        **kwargs
    ) -> Response:
        """Send command and await response"""
        if not self.ws:
            raise RuntimeError("Not connected. Call connect() first.")

        request_id = str(uuid.uuid4())
        message = {
            "id": request_id,
            "command": command,
            **kwargs
        }

        # Set up future for response
        future: asyncio.Future = asyncio.Future()
        self.pending_responses[request_id] = future

        try:
            await asyncio.wait_for(
                self.ws.send(json.dumps(message)),
                timeout=self.timeout
            )

            response = await asyncio.wait_for(future, timeout=self.timeout)
            return response
        except asyncio.TimeoutError:
            self.pending_responses.pop(request_id, None)
            raise TimeoutError(f"Command {command} timed out")

    # Navigation Commands

    async def navigate(self, url: str) -> Response:
        """Navigate to URL"""
        return await self._send_command("navigate", url=url)

    async def get_url(self) -> Response:
        """Get current URL"""
        return await self._send_command("get_url")

    async def get_page_state(self) -> Response:
        """Get page title, URL, forms, links"""
        return await self._send_command("get_page_state")

    async def get_content(self) -> Response:
        """Get HTML and text content"""
        return await self._send_command("get_content")

    async def wait_for_element(self, selector: str, timeout: int = 10000) -> Response:
        """Wait for element to appear"""
        return await self._send_command(
            "wait_for_element",
            selector=selector,
            timeout=timeout
        )

    async def execute_script(self, script: str) -> Response:
        """Execute JavaScript"""
        return await self._send_command("execute_script", script=script)

    # Interaction Commands

    async def click(self, selector: str, humanize: bool = True) -> Response:
        """Click element"""
        return await self._send_command("click", selector=selector, humanize=humanize)

    async def fill(self, selector: str, value: str, humanize: bool = True) -> Response:
        """Fill form field"""
        return await self._send_command(
            "fill",
            selector=selector,
            value=value,
            humanize=humanize
        )

    async def scroll(
        self,
        x: Optional[int] = None,
        y: Optional[int] = None,
        selector: Optional[str] = None,
        humanize: bool = True
    ) -> Response:
        """Scroll page"""
        kwargs = {"humanize": humanize}
        if x is not None:
            kwargs["x"] = x
        if y is not None:
            kwargs["y"] = y
        if selector:
            kwargs["selector"] = selector

        return await self._send_command("scroll", **kwargs)

    async def type_text(self, text: str, selector: Optional[str] = None) -> Response:
        """Type text with human timing"""
        return await self._send_command(
            "type_text",
            text=text,
            selector=selector
        )

    # Content Extraction Commands

    async def extract_metadata(self) -> Response:
        """Extract meta tags and Open Graph data"""
        return await self._send_command("extract_metadata")

    async def extract_links(self, include_external: bool = True) -> Response:
        """Extract all links"""
        return await self._send_command("extract_links", includeExternal=include_external)

    async def extract_forms(self) -> Response:
        """Extract form data"""
        return await self._send_command("extract_forms")

    async def extract_images(self, include_lazy: bool = True) -> Response:
        """Extract images"""
        return await self._send_command("extract_images", includeLazy=include_lazy)

    async def extract_structured_data(self) -> Response:
        """Extract JSON-LD and microdata"""
        return await self._send_command("extract_structured_data")

    async def extract_all(self) -> Response:
        """Extract all content types"""
        return await self._send_command("extract_all")

    async def detect_technology(self) -> Response:
        """Detect technologies (CMS, frameworks, analytics)"""
        return await self._send_command("detect_technology")

    # Screenshot Commands

    async def screenshot(self, format: str = "png") -> Response:
        """Capture screenshot"""
        return await self._send_command("screenshot", format=format)

    async def screenshot_viewport(self, format: str = "png") -> Response:
        """Capture visible viewport"""
        return await self._send_command("screenshot_viewport", format=format)

    async def screenshot_full_page(self, format: str = "png") -> Response:
        """Capture entire page"""
        return await self._send_command("screenshot_full_page", format=format)

    async def screenshot_element(self, selector: str, format: str = "png") -> Response:
        """Capture specific element"""
        return await self._send_command(
            "screenshot_element",
            selector=selector,
            format=format
        )

    # Cookie Management

    async def get_cookies(self, url: str) -> Response:
        """Get cookies for URL"""
        return await self._send_command("get_cookies", url=url)

    async def set_cookie(self, cookie: Dict[str, Any]) -> Response:
        """Set a cookie"""
        return await self._send_command("set_cookie", cookie=cookie)

    async def delete_cookie(self, url: str, name: str) -> Response:
        """Delete specific cookie"""
        return await self._send_command("delete_cookie", url=url, name=name)

    async def clear_all_cookies(self, domain: Optional[str] = None) -> Response:
        """Clear all cookies"""
        return await self._send_command("clear_all_cookies", domain=domain)

    # Session Management

    async def create_session(self, name: Optional[str] = None) -> Response:
        """Create new session"""
        return await self._send_command("create_session", name=name)

    async def list_sessions(self) -> Response:
        """List all sessions"""
        return await self._send_command("list_sessions")

    async def get_session_info(self, session_id: str) -> Response:
        """Get session details"""
        return await self._send_command("get_session_info", sessionId=session_id)

    async def delete_session(self, session_id: str) -> Response:
        """Delete session"""
        return await self._send_command("delete_session", sessionId=session_id)

    # Evasion Commands

    async def create_fingerprint_profile(
        self,
        id: str,
        platform: str = "windows",
        timezone: str = "America/New_York",
        tier: str = "high"
    ) -> Response:
        """Create device fingerprint profile"""
        return await self._send_command(
            "create_fingerprint_profile",
            id=id,
            platform=platform,
            timezone=timezone,
            tier=tier
        )

    async def apply_fingerprint(self, profile_id: str) -> Response:
        """Apply fingerprint profile"""
        return await self._send_command("apply_fingerprint", profileId=profile_id)

    async def get_fingerprint_options(self) -> Response:
        """Get available fingerprint options"""
        return await self._send_command("get_fingerprint_options")

    async def create_behavioral_profile(
        self,
        session_id: str,
        speed_multiplier: float = 1.0,
        accuracy_level: float = 0.95
    ) -> Response:
        """Create behavioral profile"""
        return await self._send_command(
            "create_behavioral_profile",
            sessionId=session_id,
            speedMultiplier=speed_multiplier,
            accuracyLevel=accuracy_level
        )

    async def generate_mouse_path(
        self,
        session_id: str,
        start: Dict[str, int],
        end: Dict[str, int]
    ) -> Response:
        """Generate human-like mouse path"""
        return await self._send_command(
            "generate_mouse_path",
            sessionId=session_id,
            start=start,
            end=end
        )

    async def generate_typing_events(
        self,
        session_id: str,
        text: str
    ) -> Response:
        """Generate human-like typing events"""
        return await self._send_command(
            "generate_typing_events",
            sessionId=session_id,
            text=text
        )

    # Evidence Chain Commands

    async def init_evidence_chain(self, base_path: str) -> Response:
        """Initialize evidence chain"""
        return await self._send_command("init_evidence_chain", basePath=base_path)

    async def create_investigation(
        self,
        name: str,
        description: Optional[str] = None,
        investigator: Optional[str] = None
    ) -> Response:
        """Create new investigation"""
        return await self._send_command(
            "create_investigation",
            name=name,
            description=description,
            investigator=investigator
        )

    async def collect_screenshot_chain(
        self,
        investigation_id: str,
        actor: str,
        tags: Optional[List[str]] = None
    ) -> Response:
        """Collect screenshot with chain of custody"""
        return await self._send_command(
            "collect_screenshot_chain",
            investigationId=investigation_id,
            actor=actor,
            tags=tags or []
        )

    # Utility Commands

    async def ping(self) -> Response:
        """Check connection"""
        return await self._send_command("ping")

    async def status(self) -> Response:
        """Get browser status"""
        return await self._send_command("status")


class BassetAgent:
    """
    Higher-level wrapper for building OSINT agents
    Combines multiple commands into common patterns
    """

    def __init__(self, client: BassetClient):
        self.client = client

    async def investigate_site(self, url: str) -> Dict[str, Any]:
        """
        Full site investigation:
        1. Navigate to URL
        2. Extract all content
        3. Detect technologies
        4. Take screenshot
        """
        await self.client.navigate(url)
        await asyncio.sleep(2)  # Wait for page load

        results = {
            "url": url,
            "content": None,
            "metadata": None,
            "technologies": None,
            "screenshot": None
        }

        # Extract all content
        content_resp = await self.client.extract_all()
        if content_resp.success:
            results["content"] = content_resp.data

        # Detect technologies
        tech_resp = await self.client.detect_technology()
        if tech_resp.success:
            results["technologies"] = tech_resp.data

        # Screenshot
        screenshot_resp = await self.client.screenshot_full_page()
        if screenshot_resp.success:
            results["screenshot"] = screenshot_resp.data

        return results

    async def monitor_competitor(
        self,
        url: str,
        check_interval: int = 3600
    ) -> None:
        """
        Monitor competitor site for changes
        Check every N seconds
        """
        last_content = None

        while True:
            response = await self.client.navigate(url)
            if not response.success:
                logger.error(f"Failed to navigate to {url}")
                await asyncio.sleep(check_interval)
                continue

            await asyncio.sleep(2)

            content_resp = await self.client.get_content()
            current_content = content_resp.data.get('text') if content_resp.success else None

            if last_content and current_content != last_content:
                logger.info(f"Change detected on {url}")
                # TODO: Send alert

            last_content = current_content
            await asyncio.sleep(check_interval)

    async def extract_search_results(
        self,
        query: str,
        search_engine: str = "google"
    ) -> List[Dict[str, Any]]:
        """
        Search and extract results
        """
        search_url = f"https://www.google.com/search?q={query}"

        await self.client.navigate(search_url)
        await asyncio.sleep(2)

        links = await self.client.extract_links()

        return links.data if links.success else []


# ===========================
# Wave 14: Tech Detection
# ===========================

    async def identify_cms(self, html: Optional[str] = None) -> Response:
        """
        Identify CMS technologies on current page

        Args:
            html: Optional HTML content (uses current page if not provided)

        Returns:
            Response with identified CMS technologies
        """
        params = {}
        if html:
            params['html'] = html
        return await self._send_command('identify_cms', params)

    async def identify_analytics(self, html: Optional[str] = None) -> Response:
        """
        Identify analytics and tracking technologies on current page

        Args:
            html: Optional HTML content (uses current page if not provided)

        Returns:
            Response with identified analytics technologies
        """
        params = {}
        if html:
            params['html'] = html
        return await self._send_command('identify_analytics', params)


# ===========================
# Wave 14: Competitor Monitoring
# ===========================

    async def add_monitor(self, url: str, name: str, frequency: str = 'daily',
                         alerts: Optional[Dict] = None) -> Response:
        """Add a website to monitor"""
        return await self._send_command('add_monitor', {
            'url': url,
            'name': name,
            'frequency': frequency,
            'alerts': alerts or {}
        })

    async def remove_monitor(self, monitor_id: str) -> Response:
        """Remove a monitored website"""
        return await self._send_command('remove_monitor', {'monitor_id': monitor_id})

    async def update_monitor(self, monitor_id: str, updates: Dict) -> Response:
        """Update monitor configuration"""
        return await self._send_command('update_monitor', {
            'monitor_id': monitor_id,
            **updates
        })

    async def get_monitor(self, monitor_id: str) -> Response:
        """Get monitor details"""
        return await self._send_command('get_monitor', {'monitor_id': monitor_id})

    async def list_monitors(self, filter_: Optional[Dict] = None) -> Response:
        """List all monitors"""
        return await self._send_command('list_monitors', filter_ or {})

    async def pause_monitor(self, monitor_id: str) -> Response:
        """Pause monitoring"""
        return await self._send_command('pause_monitor', {'monitor_id': monitor_id})

    async def resume_monitor(self, monitor_id: str) -> Response:
        """Resume monitoring"""
        return await self._send_command('resume_monitor', {'monitor_id': monitor_id})

    async def check_monitor(self, monitor_id: str) -> Response:
        """Run check on monitor"""
        return await self._send_command('check_monitor', {'monitor_id': monitor_id})

    async def get_monitor_changes(self, monitor_id: str) -> Response:
        """Get change history"""
        return await self._send_command('get_monitor_changes', {'monitor_id': monitor_id})

    async def get_monitor_snapshots(self, monitor_id: str) -> Response:
        """Get page snapshots"""
        return await self._send_command('get_monitor_snapshots', {'monitor_id': monitor_id})

    async def get_monitor_stats(self, monitor_id: str) -> Response:
        """Get monitor statistics"""
        return await self._send_command('get_monitor_stats', {'monitor_id': monitor_id})

    async def start_monitoring_service(self) -> Response:
        """Start the monitoring service"""
        return await self._send_command('start_monitoring_service', {})

    async def stop_monitoring_service(self) -> Response:
        """Stop the monitoring service"""
        return await self._send_command('stop_monitoring_service', {})

    async def pause_monitoring_service(self) -> Response:
        """Pause the monitoring service"""
        return await self._send_command('pause_monitoring_service', {})

    async def resume_monitoring_service(self) -> Response:
        """Resume the monitoring service"""
        return await self._send_command('resume_monitoring_service', {})

    async def get_monitoring_service_status(self) -> Response:
        """Get service status"""
        return await self._send_command('get_monitoring_service_status', {})

    async def get_monitoring_service_stats(self) -> Response:
        """Get service statistics"""
        return await self._send_command('get_monitoring_service_stats', {})

    async def configure_monitor_alerts(self, monitor_id: str, alerts: Dict) -> Response:
        """Configure alerts for a monitor"""
        return await self._send_command('configure_monitor_alerts', {
            'monitor_id': monitor_id,
            'alerts': alerts
        })

    async def run_monitor_check(self, monitor_id: str) -> Response:
        """Run manual check"""
        return await self._send_command('run_monitor_check', {'monitor_id': monitor_id})

    async def export_monitors(self) -> Response:
        """Export all monitors"""
        return await self._send_command('export_monitors', {})

    async def import_monitors(self, data: Dict, merge: bool = False) -> Response:
        """Import monitors"""
        return await self._send_command('import_monitors', {
            'data': data,
            'merge': merge
        })

    async def cleanup_monitoring_data(self, days_old: int = 30) -> Response:
        """Cleanup old monitoring data"""
        return await self._send_command('cleanup_monitoring_data', {'days_old': days_old})

    async def clear_all_monitors(self) -> Response:
        """Clear all monitors"""
        return await self._send_command('clear_all_monitors', {})


# ===========================
# Wave 14: Proxy Intelligence
# ===========================

    async def get_proxy_reputation(self, proxy_address: str, session_id: Optional[str] = None) -> Response:
        """Get proxy reputation and health score"""
        return await self._send_command('get_proxy_reputation', {
            'proxy_address': proxy_address,
            'session_id': session_id
        })

    async def set_geo_lock(self, country: Optional[str] = None, region: Optional[str] = None,
                          latitude: Optional[float] = None, longitude: Optional[float] = None) -> Response:
        """Set geographic lock for consistency"""
        return await self._send_command('set_geo_lock', {
            'country': country,
            'region': region,
            'latitude': latitude,
            'longitude': longitude
        })

    async def get_proxy_analytics(self, session_id: Optional[str] = None, aggregate: bool = False) -> Response:
        """Get proxy analytics and performance metrics"""
        return await self._send_command('get_proxy_analytics', {
            'session_id': session_id,
            'aggregate': aggregate
        })


# ===========================
# Wave 14: Session Checkpoints & Branching
# ===========================

    async def create_session_checkpoint(self, label: str = '', description: str = '') -> Response:
        """Create a checkpoint of current session state"""
        return await self._send_command('create_session_checkpoint', {
            'label': label,
            'description': description
        })

    async def rollback_to_checkpoint(self, checkpoint_id: str) -> Response:
        """Rollback to a specific checkpoint"""
        return await self._send_command('rollback_to_checkpoint', {
            'checkpoint_id': checkpoint_id
        })

    async def list_checkpoints(self) -> Response:
        """List all available checkpoints"""
        return await self._send_command('list_checkpoints', {})

    async def get_checkpoint_details(self, checkpoint_id: str) -> Response:
        """Get checkpoint details"""
        return await self._send_command('get_checkpoint_details', {
            'checkpoint_id': checkpoint_id
        })

    async def delete_checkpoint(self, checkpoint_id: str) -> Response:
        """Delete a checkpoint"""
        return await self._send_command('delete_checkpoint', {
            'checkpoint_id': checkpoint_id
        })

    async def branch_session(self, label: str = '') -> Response:
        """Create a session branch"""
        return await self._send_command('branch_session', {'label': label})

    async def list_branches(self) -> Response:
        """List active branches"""
        return await self._send_command('list_branches', {})

    async def merge_branch(self) -> Response:
        """Merge current branch"""
        return await self._send_command('merge_branch', {})

    async def detect_failure(self) -> Response:
        """Detect failures in session"""
        return await self._send_command('detect_failure', {})

    async def get_recovery_strategies(self, failure_type: Optional[str] = None) -> Response:
        """Get recovery strategies"""
        return await self._send_command('get_recovery_strategies', {
            'failure_type': failure_type
        })

    async def resume_session(self, checkpoint_id: str) -> Response:
        """Resume session from checkpoint"""
        return await self._send_command('resume_session', {
            'checkpoint_id': checkpoint_id
        })

    async def export_checkpoint(self, checkpoint_id: str, format_: str = 'json') -> Response:
        """Export checkpoint"""
        return await self._send_command('export_checkpoint', {
            'checkpoint_id': checkpoint_id,
            'format': format_
        })


# Example usage
async def example_basic_navigation():
    """Example: Basic navigation and content extraction"""
    async with BassetClient('ws://localhost:8765') as client:
        # Navigate
        await client.navigate('https://example.com')
        await asyncio.sleep(2)

        # Extract content
        content = await client.get_content()
        if content.success:
            print(f"Content: {content.data}")
        else:
            print(f"Error: {content.error}")


async def example_evasion():
    """Example: Bot evasion with fingerprinting"""
    async with BassetClient('ws://localhost:8765') as client:
        # Create session with fingerprint
        session = await client.create_session()
        fingerprint = await client.create_fingerprint_profile(
            "fp-1",
            platform="windows",
            tier="high"
        )
        await client.apply_fingerprint("fp-1")

        # Navigate with evasion active
        await client.navigate('https://example.com')
        screenshot = await client.screenshot_full_page()

        print(f"Screenshot captured: {screenshot.success}")


async def example_osint_investigation():
    """Example: Full OSINT investigation"""
    async with BassetClient('ws://localhost:8765') as client:
        agent = BassetAgent(client)
        results = await agent.investigate_site('https://example.com')

        print(f"URL: {results['url']}")
        print(f"Technologies: {results.get('technologies')}")


if __name__ == "__main__":
    # Run example
    asyncio.run(example_basic_navigation())
