"""
Basset Hound Browser MCP Server

Phase 15: MCP Server for AI Agent Integration

This module provides an MCP server that exposes browser automation
capabilities to AI agents via the Model Context Protocol.

Example usage:
    # Start MCP server
    from mcp.server import main
    main()

    # Or import components
    from mcp.server import BrowserConnection, mcp
"""

from .server import (
    BrowserConnection,
    get_browser,
    mcp,
    main,
    DEFAULT_WS_HOST,
    DEFAULT_WS_PORT,
    DEFAULT_WS_TIMEOUT,
)

__version__ = "1.0.0"
__all__ = [
    "BrowserConnection",
    "get_browser",
    "mcp",
    "main",
    "DEFAULT_WS_HOST",
    "DEFAULT_WS_PORT",
    "DEFAULT_WS_TIMEOUT",
]
