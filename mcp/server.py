"""
Basset Hound Browser — MCP (Model Context Protocol) server.

A THIN, deterministic pass-through adapter that lets LLM agents (Claude,
palletai, etc.) drive the browser. Every MCP tool maps 1:1 to a single,
PROVEN-WORKING WebSocket command and simply forwards the call over the
browser's flat-JSON WS API, correlating the reply by request id.

SCOPE (docs/architecture/SCOPE.md — HARD BLACKLIST):
    This adapter contains NO models, NO AI/LLM/embeddings, NO agent spawning,
    NO orchestration, and makes NO intelligence decisions. It is a dumb wire
    between an MCP client and the browser's WebSocket control surface. All
    reasoning lives in the *external* agent that calls these tools.

Design:
    - Only the commands classified "Proven-Working" in
      docs/planning/PROJECT-STATUS-MATRIX.md are exposed:
        navigate, get_url, get_content, get_page_state, execute_script,
        screenshot, scroll, wait_for_element, click, fill, type_text,
        set_cookie, get_all_cookies, extract_links, extract_forms,
        extract_images, get_cookies
      (the four extract_*/get_cookies tools were fixed + live-verified in
      docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md).
    - Transport to the browser: ws://127.0.0.1:8765 (auth off by default),
      flat JSON {command, id, ...params}; the reply echoes {id, command,
      success, ...fields}. See mcp/README.md.
    - MCP transport to the agent: stdio (default) or SSE/HTTP.

This mirrors the documented `mcp/server.py` FastMCP convention and the RAG
app's FastMCP reference pattern (docs/rag-app/app/mcp_server.py).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import uuid
from typing import Any, Optional

import websockets
from fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration (environment-driven; mirrors config/env.js BASSET_* mappings)
# ---------------------------------------------------------------------------

_WS_HOST = os.environ.get("BASSET_WS_HOST", "127.0.0.1")
_WS_PORT = os.environ.get("BASSET_WS_PORT", os.environ.get("BASSET_PORT", "8765"))
_WS_URL = os.environ.get("BASSET_WS_URL", f"ws://{_WS_HOST}:{_WS_PORT}")

# Per-command read timeout (seconds). Navigation/waits can be slow; keep it
# comfortably above the browser-side adaptive timeouts.
_READ_TIMEOUT = float(os.environ.get("BASSET_MCP_TIMEOUT", "90"))

_SERVER_NAME = "basset-hound-browser"
_SERVER_INSTRUCTIONS = (
    "Deterministic control/capture adapter for the Basset Hound Browser. "
    "Each tool forwards one proven WebSocket command to a running browser "
    "instance and returns the raw response. No intelligence, no models — the "
    "calling agent decides what to do with the captured data."
)


def _build_mcp(host: Optional[str] = None, port: Optional[int] = None) -> FastMCP:
    """Construct FastMCP, tolerating constructor drift across releases.

    fastmcp renamed ``description=`` to ``instructions=`` in 2.x. Try the
    richest signature first and degrade gracefully (same hardening the RAG
    app uses) so an out-of-pin upgrade does not crash at import time.
    """
    settings: dict[str, Any] = {}
    if host is not None:
        settings["host"] = host
    if port is not None:
        settings["port"] = port
    for kwargs in (
        {"name": _SERVER_NAME, "instructions": _SERVER_INSTRUCTIONS, **settings},
        {"name": _SERVER_NAME, **settings},
        {"name": _SERVER_NAME},
    ):
        try:
            return FastMCP(**kwargs)
        except TypeError:
            continue
    return FastMCP()


mcp = _build_mcp()


# ---------------------------------------------------------------------------
# WebSocket bridge — single serialized connection to the browser
# ---------------------------------------------------------------------------


class _BrowserBridge:
    """Thin WS client: one connection, one command in flight at a time.

    The browser drives a single page, so serializing commands (a navigate
    must finish before the next click) is the correct semantic anyway. A lock
    guarantees request/response frames never interleave, which makes id
    correlation trivial and race-free.
    """

    def __init__(self, url: str, read_timeout: float) -> None:
        self._url = url
        self._read_timeout = read_timeout
        self._ws: Optional[Any] = None
        self._lock = asyncio.Lock()

    async def _ensure_connected(self) -> Any:
        ws = self._ws
        if ws is not None and getattr(ws, "closed", False) is False:
            return ws
        # (re)connect
        self._ws = await websockets.connect(
            self._url,
            max_size=None,          # allow large payloads (full HTML, base64 screenshots)
            ping_interval=20,
            ping_timeout=20,
            open_timeout=15,
        )
        return self._ws

    async def call(self, command: str, params: dict[str, Any]) -> dict[str, Any]:
        """Send {command, id, ...params}; return the parsed reply dict.

        Never raises for expected transport failures — returns a structured
        ``{"success": False, "error": ..., "mcp_bridge_error": True}`` so the
        agent gets a clean, actionable message instead of a stack trace.
        """
        request_id = uuid.uuid4().hex
        message = {"command": command, "id": request_id}
        for key, value in params.items():
            if value is not None:
                message[key] = value
        payload = json.dumps(message)

        async with self._lock:
            try:
                ws = await self._ensure_connected()
                await ws.send(payload)
                return await self._await_reply(request_id, command)
            except (websockets.ConnectionClosed, ConnectionResetError, OSError):
                # Stale socket — reconnect once and retry a single time.
                self._ws = None
                try:
                    ws = await self._ensure_connected()
                    await ws.send(payload)
                    return await self._await_reply(request_id, command)
                except Exception as exc:  # noqa: BLE001 - report, don't crash
                    return self._bridge_error(command, exc)
            except Exception as exc:  # noqa: BLE001 - report, don't crash
                return self._bridge_error(command, exc)

    async def _await_reply(self, request_id: str, command: str) -> dict[str, Any]:
        """Read frames until the one matching this request is found.

        Correlation rule (robust to the browser's error path): a frame is ours
        if its ``id`` equals our request id, OR — for ErrorFormatter param
        validation errors, which return ``id: null`` — if it carries no id but
        names our command. Since only one command is in flight under the lock,
        any other frame is unexpected and skipped.
        """
        ws = self._ws
        assert ws is not None
        deadline = asyncio.get_event_loop().time() + self._read_timeout
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                return self._bridge_error(
                    command,
                    TimeoutError(
                        f"No reply within {self._read_timeout:.0f}s "
                        f"(is the browser busy or unresponsive?)"
                    ),
                )
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                continue
            try:
                frame = json.loads(raw)
            except (ValueError, TypeError):
                continue  # non-JSON frame — ignore
            if not isinstance(frame, dict):
                continue
            frame_id = frame.get("id")
            if frame_id == request_id:
                return self._clean(frame)
            if frame_id in (None, "null") and frame.get("command") == command:
                # id:null validation-error reply for our in-flight command
                return self._clean(frame)
            # Unexpected/stray frame while we hold the lock — skip it.

    @staticmethod
    def _clean(frame: dict[str, Any]) -> dict[str, Any]:
        """Strip the internal correlation id; return everything else verbatim."""
        frame.pop("id", None)
        return frame

    @staticmethod
    def _bridge_error(command: str, exc: Exception) -> dict[str, Any]:
        return {
            "success": False,
            "command": command,
            "error": f"MCP bridge could not reach the browser: {exc}",
            "mcp_bridge_error": True,
            "ws_url": _WS_URL,
            "hint": (
                "Ensure the browser is running and its WebSocket API is "
                f"listening at {_WS_URL} (set BASSET_WS_URL / BASSET_WS_PORT "
                "to point elsewhere)."
            ),
        }

    async def aclose(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            finally:
                self._ws = None


_bridge = _BrowserBridge(_WS_URL, _READ_TIMEOUT)


# ---------------------------------------------------------------------------
# MCP Tools — each maps 1:1 to a proven WS command
# ---------------------------------------------------------------------------


@mcp.tool()
async def navigate(url: str, timeout: int = 10000) -> dict[str, Any]:
    """Navigate the browser to a URL and wait for load.

    Args:
        url: Absolute http(s) URL to load (e.g. "https://example.com").
        timeout: Navigation timeout in milliseconds (default 10000).

    Returns the final ``url``, ``tabId`` and ``timestamp`` on success.
    """
    return await _bridge.call("navigate", {"url": url, "timeout": timeout})


@mcp.tool()
async def get_url() -> dict[str, Any]:
    """Return the current page URL (field: ``url``)."""
    return await _bridge.call("get_url", {})


@mcp.tool()
async def get_content() -> dict[str, Any]:
    """Get the current page's full HTML.

    Returns the raw HTML in ``content`` (plus ``statusCode`` and ``headers``).
    No filtering or analysis is applied — raw capture only.
    """
    return await _bridge.call("get_content", {})


@mcp.tool()
async def get_page_state() -> dict[str, Any]:
    """Get structured page state (forms, links, buttons, etc.) as captured by
    the renderer. Raw data for the agent to interpret."""
    return await _bridge.call("get_page_state", {})


@mcp.tool()
async def execute_script(script: str) -> dict[str, Any]:
    """Execute arbitrary JavaScript in the page context and return its result.

    Args:
        script: JavaScript source to evaluate in the active page/webview.

    The evaluated value is returned in ``result``.
    """
    return await _bridge.call("execute_script", {"script": script})


@mcp.tool()
async def screenshot(format: str = "png") -> dict[str, Any]:
    """Capture a screenshot of the current page.

    Args:
        format: Image format hint ("png" default). NOTE: the browser currently
            returns a PNG data URL regardless of this hint.

    The base64 image (data URL) is returned in ``data`` (this command nests its
    payload under ``data`` rather than a flat field).
    """
    return await _bridge.call("screenshot", {"format": format})


@mcp.tool()
async def scroll(
    x: Optional[int] = None,
    y: Optional[int] = None,
    selector: Optional[str] = None,
) -> dict[str, Any]:
    """Scroll the page (or an element).

    Args:
        x: Horizontal scroll offset in pixels (optional).
        y: Vertical scroll offset in pixels (optional).
        selector: CSS selector of a scroll container to scroll within (optional).
    """
    return await _bridge.call("scroll", {"x": x, "y": y, "selector": selector})


@mcp.tool()
async def wait_for_element(selector: str, timeout: int = 10000) -> dict[str, Any]:
    """Wait until an element matching ``selector`` appears.

    Args:
        selector: CSS selector to wait for.
        timeout: Maximum wait time in milliseconds (default 10000).
    """
    return await _bridge.call(
        "wait_for_element", {"selector": selector, "timeout": timeout}
    )


@mcp.tool()
async def click(selector: str, humanize: bool = True) -> dict[str, Any]:
    """Click the element matching ``selector``.

    Args:
        selector: CSS selector of the element to click.
        humanize: Use humanized (delayed) interaction timing (default True).
    """
    return await _bridge.call("click", {"selector": selector, "humanize": humanize})


@mcp.tool()
async def fill(selector: str, value: str, humanize: bool = True) -> dict[str, Any]:
    """Fill an input/textarea with ``value``.

    Args:
        selector: CSS selector of the input element.
        value: Text to set as the field's value (empty string is allowed).
        humanize: Use humanized interaction timing (default True).
    """
    return await _bridge.call(
        "fill", {"selector": selector, "value": value, "humanize": humanize}
    )


@mcp.tool()
async def type_text(
    text: str,
    selector: Optional[str] = None,
    min_delay: int = 30,
    max_delay: int = 150,
    clear_first: bool = False,
    layout: str = "en-US",
    mistake_rate: float = 0.02,
) -> dict[str, Any]:
    """Type text character-by-character with humanized keystroke timing.

    Args:
        text: The text to type.
        selector: Optional CSS selector to focus before typing.
        min_delay: Minimum inter-keystroke delay in ms (default 30).
        max_delay: Maximum inter-keystroke delay in ms (default 150).
        clear_first: Clear the field before typing (default False).
        layout: Keyboard layout for realistic typos/keys (default "en-US").
        mistake_rate: Fraction of keystrokes that simulate typos (default 0.02).
    """
    return await _bridge.call(
        "type_text",
        {
            "text": text,
            "selector": selector,
            "minDelay": min_delay,
            "maxDelay": max_delay,
            "clearFirst": clear_first,
            "layout": layout,
            "mistakeRate": mistake_rate,
        },
    )


@mcp.tool()
async def set_cookie(
    name: str,
    value: str,
    url: str,
    domain: Optional[str] = None,
    path: Optional[str] = None,
    secure: Optional[bool] = None,
    http_only: Optional[bool] = None,
    same_site: Optional[str] = None,
    expiration_date: Optional[float] = None,
) -> dict[str, Any]:
    """Set a single cookie on the browser session.

    ``url`` and ``name`` are required by the browser's cookie manager.

    Args:
        name: Cookie name.
        value: Cookie value.
        url: URL the cookie is associated with (e.g. "https://example.com").
        domain: Cookie domain (optional).
        path: Cookie path (optional; browser defaults to "/").
        secure: Secure flag (optional).
        http_only: HttpOnly flag (optional).
        same_site: "Strict" | "Lax" | "None" (optional).
        expiration_date: Unix timestamp (seconds) for expiry (optional; session
            cookie if omitted).
    """
    cookie: dict[str, Any] = {"name": name, "value": value, "url": url}
    if domain is not None:
        cookie["domain"] = domain
    if path is not None:
        cookie["path"] = path
    if secure is not None:
        cookie["secure"] = secure
    if http_only is not None:
        cookie["httpOnly"] = http_only
    if same_site is not None:
        cookie["sameSite"] = same_site
    if expiration_date is not None:
        cookie["expirationDate"] = expiration_date
    return await _bridge.call("set_cookie", {"cookie": cookie})


@mcp.tool()
async def get_all_cookies(filter: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Get all cookies from the browser session.

    Args:
        filter: Optional Electron cookie filter object (e.g. {"url": "..."},
            {"domain": "..."}); omit for all cookies.

    Returns the cookie array in ``cookies`` and its length in ``count``.
    """
    return await _bridge.call("get_all_cookies", {"filter": filter or {}})


@mcp.tool()
async def get_cookies(url: str) -> dict[str, Any]:
    """Get the cookies that apply to a single URL (host/path/secure filtered).

    Unlike ``get_all_cookies`` (whole jar), this returns only the cookies the
    browser would send to ``url`` — the browser's cookie manager filters by the
    URL using Electron's native filter with an RFC 6265 fallback.

    Args:
        url: Absolute URL to filter cookies for (e.g.
            "https://en.wikipedia.org/wiki/Web_scraping"). Required by the
            browser; an empty/missing URL returns ``{"success": false}``.

    Returns the matching cookie array in ``cookies``.
    """
    return await _bridge.call("get_cookies", {"url": url})


@mcp.tool()
async def extract_links(
    base_url: Optional[str] = None,
    html: Optional[str] = None,
) -> dict[str, Any]:
    """Extract every ``<a href>`` link from the current page's live DOM.

    With no arguments the browser reads the active ``<webview>`` page (the
    normal case: navigate first, then extract). Pass ``html`` to parse a
    supplied document instead.

    Args:
        base_url: Base URL used to classify links as internal vs. external and
            to resolve relative hrefs (optional; defaults to the page's own URL
            when reading the live page).
        html: Raw HTML to parse instead of the live page (optional).

    Returns ``all`` (flat list of link objects: ``href``, ``text``, ``title``,
    ``rel``, ``target``, ``download``), ``count``, and ``data`` categorized into
    ``internal`` / ``external`` / ``mailto`` / ``tel`` / ``anchor`` /
    ``javascript`` / ``other``.
    """
    return await _bridge.call("extract_links", {"baseUrl": base_url, "html": html})


@mcp.tool()
async def extract_forms(html: Optional[str] = None) -> dict[str, Any]:
    """Extract every ``<form>`` (with its fields and buttons) from the page.

    With no arguments the browser reads the active ``<webview>`` page; pass
    ``html`` to parse a supplied document instead.

    Args:
        html: Raw HTML to parse instead of the live page (optional).

    Returns ``data`` (array of form objects with ``action``, ``method``,
    ``enctype``, ``fields``, ``buttons`` …), ``count`` (forms) and
    ``fieldCount`` (total input fields across all forms).
    """
    return await _bridge.call("extract_forms", {"html": html})


@mcp.tool()
async def extract_images(
    base_url: Optional[str] = None,
    html: Optional[str] = None,
) -> dict[str, Any]:
    """Extract every ``<img>`` from the current page's live DOM.

    With no arguments the browser reads the active ``<webview>`` page; pass
    ``html`` to parse a supplied document instead.

    Args:
        base_url: Base URL used to resolve relative image ``src`` values
            (optional; defaults to the page's own URL when reading the live
            page).
        html: Raw HTML to parse instead of the live page (optional).

    Returns ``data`` (array of image objects: ``src``, ``alt``, ``title`` …) and
    ``count``.
    """
    return await _bridge.call("extract_images", {"baseUrl": base_url, "html": html})


@mcp.tool()
async def forensic_capture(
    url: str,
    output_dir: Optional[str] = None,
    settle_ms: int = 1500,
    wait_for_selector: Optional[str] = None,
    screenshot: bool = True,
    network: bool = True,
    storage: bool = True,
    extras: bool = True,
    warc: bool = False,
) -> dict[str, Any]:
    """Capture a single URL into a sealed, SHA-256-hashed forensic evidence bundle.

    One server-side macro (not a per-artifact loop the agent must orchestrate): it
    starts network capture *before* navigating, loads ``url``, settles, then
    captures the rendered HTML, a screenshot, cookies, per-origin storage, page
    state / technologies / links / images / forms, and a network HAR — writing
    them all to a manifested, tamper-sealed bundle **directory on the browser
    host's disk**. Challenge / CAPTCHA / bot-wall pages are DETECTED and flagged
    (``challenge_suspected``), never bypassed and never sealed as clean. Raw
    artifacts plus integrity hashes only — no scoring, classification, entity
    extraction, or model calls.

    Args:
        url: Absolute http(s) URL to capture (e.g. "https://example.com").
        output_dir: Directory ON THE BROWSER HOST to write the bundle under. It
            must resolve inside the browser's allowed write set — ``<cwd>/captures
            |exports|data|tmp|downloads``, the OS temp dir, or any path in
            ``BASSET_ALLOWED_WRITE_DIRS`` — or the capture is rejected by the
            PathValidator before any file is written. Defaults to
            ``<BASSET_CAPTURE_DIR|cwd>/captures``.
        settle_ms: Milliseconds to wait after load before capturing (default 1500).
        wait_for_selector: Optional CSS selector to wait for before settling.
        screenshot: Include a PNG screenshot artifact (default True). Headless
            runs may yield no pixels — a note artifact + warning is recorded then.
        network: Start network capture and emit ``network.har`` / ``network.json``
            (default True).
        storage: Capture per-origin local/session/IndexedDB storage (default True).
        extras: Capture page state, technologies, links, images, forms (default
            True).
        warc: Also emit a ``network.warc`` artifact (default False).

    Returns (on success): ``bundle_dir`` (on-disk path containing ``manifest.json``
    and every artifact), ``final_url`` (post-redirect), ``status_code``,
    ``captured_at``, ``challenge_suspected``, ``manifest`` (per-file ``name`` /
    ``sha256`` / ``bytes`` / ``mime`` / ``source_command`` plus the
    ``bundle_sha256`` tamper seal), and ``warnings`` (non-fatal caveats). Only
    this small index is returned over the wire — the heavy bytes stay on disk.
    On rejection/failure: ``success: false`` with ``error`` (and ``bundle_dir``
    may be null).
    """
    options = {
        "settle_ms": settle_ms,
        "wait_for_selector": wait_for_selector,
        "screenshot": screenshot,
        "network": network,
        "storage": storage,
        "extras": extras,
        "warc": warc,
    }
    return await _bridge.call(
        "forensic_capture",
        {"url": url, "output_dir": output_dir, "options": options},
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Basset Hound Browser MCP server (thin WS pass-through)."
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default=os.environ.get("BASSET_MCP_TRANSPORT", "stdio"),
        help="MCP transport (default: stdio).",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("BASSET_MCP_HOST", "127.0.0.1"),
        help="Bind host for the sse transport (default: 127.0.0.1).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("BASSET_MCP_PORT", "8899")),
        help="Bind port for the sse transport (default: 8899).",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    if args.transport == "sse":
        # Tools are already registered on the module-level `mcp`; just point its
        # HTTP/SSE listener at the requested host/port (do NOT rebuild — that
        # would drop the registered tools).
        try:
            mcp.settings.host = args.host
            mcp.settings.port = args.port
        except Exception:  # noqa: BLE001 - settings shape may drift across releases
            pass
        mcp.run(transport="sse")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
