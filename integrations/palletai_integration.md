# Basset Hound Browser + palletai Integration Guide

**Version:** 1.0.0  
**Date:** May 6, 2026  
**Status:** Production Ready

---

## Overview

Basset Hound Browser integrates seamlessly with **palletai** agents to provide sophisticated browser automation capabilities for OSINT, reconnaissance, and data collection workflows.

This guide explains how to:
1. Set up the MCP server for palletai environment
2. Configure palletai agents to use Basset Hound tools
3. Build multi-step workflows combining palletai intelligence with browser capabilities
4. Optimize performance for agent-based orchestration

---

## Architecture

### Integration Points

```
palletai Agent
    ↓
MCP Client (palletai environment)
    ↓
Basset Hound MCP Server (FastMCP, Python)
    ↓
WebSocket Protocol
    ↓
Browser Runtime (Electron)
    ↓
Real Browser Engine
```

### Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **palletai Agent** | Orchestration logic, decision-making, workflow coordination |
| **MCP Server** | Tool interface, request routing, error handling |
| **Browser Runtime** | Page navigation, DOM interaction, content extraction |

---

## Setup Instructions

### 1. Prerequisites

**Required:**
- Basset Hound Browser running (port 8765 WebSocket)
- Python 3.8+ with FastMCP 2.0
- palletai environment configured
- Node.js 18+ (for browser runtime)

**Optional:**
- Docker for containerized deployment
- Tor browser instance (for advanced evasion)
- Custom fingerprint profiles

### 2. MCP Server Registration with palletai

**Option A: Direct MCP Configuration**

Add to your palletai configuration:

```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "python",
      "args": ["-m", "browser_mcp.server"],
      "cwd": "/path/to/basset-hound-browser",
      "env": {
        "BASSET_HOUND_HOST": "localhost",
        "BASSET_HOUND_PORT": "8765",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

**Option B: Docker Integration**

```bash
# Start Basset Hound Browser in Docker
docker-compose up basset-hound-browser

# Register MCP server (points to Docker container)
{
  "mcpServers": {
    "basset-hound": {
      "command": "python",
      "args": ["-m", "browser_mcp.server"],
      "env": {
        "BASSET_HOUND_HOST": "basset-hound-browser",  # Docker service name
        "BASSET_HOUND_PORT": "8765"
      }
    }
  }
}
```

### 3. Verify MCP Tools Are Available

Once registered, verify all 166 tools are discoverable:

```bash
# List available tools
palletai mcp list

# Should show: basset-hound (166 tools)
# Tools like: browser_navigate, browser_click, browser_extract_links, etc.
```

---

## Tool Categories

All 166 tools are organized into 15 categories:

### Navigation (6 tools)
- `browser_navigate` - Navigate to URL
- `browser_get_url` - Get current URL
- `browser_get_title` - Get page title
- `browser_go_back` - Navigate back
- `browser_go_forward` - Navigate forward
- `browser_reload` - Reload page

### Interaction (7 tools)
- `browser_click` - Click element
- `browser_fill` - Fill input
- `browser_type` - Type text
- `browser_scroll` - Scroll page
- `browser_hover` - Hover element
- `browser_wait_for_element` - Wait for element
- `browser_focus` - Focus element

### Extraction (5 tools)
- `browser_get_content` - Get page HTML/text
- `browser_get_page_state` - Get structured page data
- `browser_extract_links` - Extract all links
- `browser_extract_forms` - Extract all forms
- `browser_extract_images` - Extract image metadata

### Screenshots (4 tools)
- `browser_screenshot` - Full page screenshot
- `browser_screenshot_element` - Element screenshot
- `browser_screenshot_selector` - Selector screenshot
- `browser_screenshot_viewport` - Viewport screenshot

### JavaScript (2 tools)
- `browser_execute_script` - Execute JS
- `browser_evaluate_script` - Evaluate JS expression

### Cookies (3 tools)
- `browser_get_cookies` - Get cookies
- `browser_set_cookies` - Set cookies
- `browser_clear_cookies` - Clear cookies

### Proxy (3 tools)
- `browser_set_proxy` - Configure proxy
- `browser_get_proxy_status` - Get proxy info
- `browser_clear_proxy` - Clear proxy

### User Agent (4 tools)
- `browser_get_user_agent_status` - Get current UA
- `browser_set_user_agent` - Set specific UA
- `browser_rotate_user_agent` - Rotate to next UA
- `browser_list_user_agents` - List available UAs

### Tor (3 tools)
- `browser_get_tor_mode` - Get Tor status
- `browser_set_tor_mode` - Set Tor mode (off/on/auto)
- `browser_tor_new_identity` - Request new Tor identity

### Fingerprinting (15 tools)
- `browser_create_fingerprint_profile` - Create profile
- `browser_apply_fingerprint` - Apply profile
- `browser_get_fingerprint` - Get current fingerprint
- `browser_update_fingerprint` - Update profile
- [+ 11 more for detailed fingerprint customization]

### Multi-Page (8 tools)
- `browser_init_multi_page` - Enable multi-page mode
- `browser_create_page` - Create new page
- `browser_navigate_page` - Navigate page
- `browser_list_pages` - List all pages
- `browser_close_page` - Close page
- `browser_switch_page` - Switch active page
- `browser_get_page_info` - Get page info
- `browser_destroy_page` - Destroy page

### Request Interception (12 tools)
- `browser_enable_request_interception` - Enable interception
- `browser_disable_request_interception` - Disable
- `browser_add_block_rule` - Block URLs
- `browser_remove_block_rule` - Remove block
- [+ 8 more for header modification, ad blocking, etc.]

### Advanced (25+ tools)
- DevTools integration
- Performance profiling
- Network monitoring
- Advanced event listeners
- [+ Many more specialized tools]

---

## Common Integration Patterns

### Pattern 1: Simple Reconnaissance

```python
# In palletai agent
async def simple_recon(target_url: str):
    """Basic target reconnaissance"""
    
    # Navigate to target
    await mcp.call("browser_navigate", {"url": target_url})
    
    # Extract content
    links = await mcp.call("browser_extract_links", {})
    forms = await mcp.call("browser_extract_forms", {})
    
    # Get page state
    page_state = await mcp.call("browser_get_page_state", {})
    
    # Analyze and report
    return {
        "target": target_url,
        "links_found": len(links),
        "forms_found": len(forms),
        "page_structure": page_state
    }
```

### Pattern 2: Multi-Step Workflow

```python
# In palletai agent
async def multi_step_workflow(target: str, credentials: dict):
    """Login, navigate, extract data"""
    
    # Step 1: Navigate to login page
    await mcp.call("browser_navigate", {"url": target})
    await asyncio.sleep(2)  # Wait for page load
    
    # Step 2: Fill login form
    await mcp.call("browser_fill", {
        "selector": "input[name='username']",
        "text": credentials["username"]
    })
    await mcp.call("browser_fill", {
        "selector": "input[name='password']",
        "text": credentials["password"]
    })
    
    # Step 3: Submit form
    await mcp.call("browser_click", {"selector": "button[type='submit']"})
    await asyncio.sleep(3)  # Wait for login
    
    # Step 4: Extract authenticated content
    content = await mcp.call("browser_get_content", {})
    links = await mcp.call("browser_extract_links", {})
    
    return {
        "authenticated": True,
        "content_length": len(content.get("html", "")),
        "links": links
    }
```

### Pattern 3: Bot Evasion

```python
# In palletai agent
async def evasion_workflow(target: str):
    """Use evasion techniques for sensitive targets"""
    
    # Step 1: Set fingerprint profile
    await mcp.call("browser_create_fingerprint_profile", {
        "name": "chrome_linux",
        "platform": "Linux",
        "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    })
    
    # Step 2: Apply fingerprint
    await mcp.call("browser_apply_fingerprint", {"profile_name": "chrome_linux"})
    
    # Step 3: Enable Tor (optional, for maximum evasion)
    await mcp.call("browser_set_tor_mode", {"mode": "on"})
    
    # Step 4: Navigate with evasion
    await mcp.call("browser_navigate", {"url": target})
    await asyncio.sleep(2)
    
    # Step 5: Extract data
    content = await mcp.call("browser_get_content", {})
    
    # Step 6: Cleanup
    await mcp.call("browser_set_tor_mode", {"mode": "off"})
    
    return {"data": content}
```

### Pattern 4: Parallel Multi-Page

```python
# In palletai agent
async def parallel_multi_page_workflow(urls: list):
    """Process multiple pages in parallel"""
    
    # Enable multi-page mode
    await mcp.call("browser_init_multi_page", {})
    
    # Create pages for each URL
    page_ids = []
    for url in urls:
        page = await mcp.call("browser_create_page", {})
        page_id = page["data"]["id"]
        page_ids.append(page_id)
        
        # Navigate page in background
        await mcp.call("browser_navigate_page", {
            "page_id": page_id,
            "url": url
        })
    
    # Wait for all pages to load
    await asyncio.sleep(2)
    
    # Extract from all pages
    results = []
    for page_id in page_ids:
        content = await mcp.call("browser_get_content", {"page_id": page_id})
        results.append(content)
    
    # Cleanup
    for page_id in page_ids:
        await mcp.call("browser_destroy_page", {"page_id": page_id})
    
    return results
```

---

## Performance Optimization

### Timing Recommendations

| Operation | Wait Time | Notes |
|-----------|-----------|-------|
| Page load | 2-4 seconds | Depends on page complexity |
| Form fill | 0.5-1 second | Between fields |
| JavaScript execution | 1-2 seconds | For DOM changes |
| Screenshot | 0.5 seconds | After navigation |
| Tor switch | 3-5 seconds | Let Tor establish circuit |

### Concurrency Guidelines

**Safe Concurrency Limits:**
- Single page: 1 concurrent operation (sequential recommended)
- Multi-page mode: Up to 5 pages in parallel
- Multiple workflows: 2-3 concurrent agent workflows

**Avoid:**
- More than 10 concurrent MCP calls
- Rapid navigation without wait delays
- Excessive proxy rotation (rate limiting)
- Concurrent Tor mode switches

### Memory Management

```python
# Good: Cleanup pages
await mcp.call("browser_destroy_page", {"page_id": page_id})

# Good: Clear cookies between sessions
await mcp.call("browser_clear_cookies", {})

# Good: Reset proxy
await mcp.call("browser_clear_proxy", {})

# Avoid: Accumulating pages without cleanup
```

---

## Error Handling

### Common Errors and Remedies

```python
# Timeout error
try:
    await mcp.call("browser_navigate", {"url": url})
except TimeoutError:
    # Increase wait time or check network
    await asyncio.sleep(5)
    # Retry with explicit wait
    await mcp.call("browser_navigate", {
        "url": url,
        "wait_until": "networkidle"
    })

# Connection error
try:
    await mcp.call("browser_navigate", {"url": url})
except ConnectionError:
    # Check if browser is running
    # Restart browser: npm start or docker-compose up
    pass

# JavaScript execution error
try:
    result = await mcp.call("browser_execute_script", {"script": js_code})
except Exception as e:
    # Script error - check syntax
    print(f"Script error: {e}")
```

---

## Advanced Techniques

### Chaining Multiple Tools

```python
async def advanced_chain(target: str):
    """Chain multiple tools into sophisticated workflow"""
    
    # Navigate with specific wait condition
    nav = await mcp.call("browser_navigate", {
        "url": target,
        "wait_until": "networkidle2"
    })
    
    # Wait for dynamic content
    await mcp.call("browser_wait_for_element", {
        "selector": ".content-loaded",
        "timeout": 10000
    })
    
    # Execute dynamic extraction
    data = await mcp.call("browser_execute_script", {
        "script": "return document.querySelectorAll('[data-id]') |> map(e => ({id: e.dataset.id, text: e.innerText}))"
    })
    
    # Capture evidence
    screenshot = await mcp.call("browser_screenshot", {})
    
    # Extract metadata
    page_state = await mcp.call("browser_get_page_state", {})
    
    return {
        "dynamic_data": data,
        "page_structure": page_state,
        "evidence": screenshot
    }
```

### Conditional Logic

```python
async def conditional_workflow(target: str):
    """Use page analysis to drive decisions"""
    
    await mcp.call("browser_navigate", {"url": target})
    page_state = await mcp.call("browser_get_page_state", {})
    
    # Check for login form
    forms = page_state.get("forms", [])
    if any(f.get("type") == "login" for f in forms):
        # Authenticated extraction needed
        await perform_login()
    else:
        # Public content extraction
        await extract_public_content()
    
    return {"analysis_result": ...}
```

---

## Monitoring and Logging

### Integration Logging

```python
import logging

logger = logging.getLogger("basset-hound-integration")

async def logged_workflow(url: str):
    """Workflow with comprehensive logging"""
    
    try:
        logger.info(f"Starting reconnaissance for {url}")
        
        # Log tool usage
        logger.debug("Calling browser_navigate")
        nav_result = await mcp.call("browser_navigate", {"url": url})
        logger.debug(f"Navigation result: {nav_result.get('success')}")
        
        # Log performance
        import time
        start = time.time()
        links = await mcp.call("browser_extract_links", {})
        elapsed = time.time() - start
        logger.info(f"Link extraction took {elapsed:.2f}s, found {len(links)} links")
        
    except Exception as e:
        logger.error(f"Workflow failed: {e}", exc_info=True)
        raise
```

---

## Testing Integration

### Unit Test Example

```python
import pytest

@pytest.mark.asyncio
async def test_basset_hound_integration():
    """Test Basset Hound MCP integration"""
    
    # Test tool availability
    tools = await mcp.list_tools()
    assert len(tools) == 166
    assert any(t["name"] == "browser_navigate" for t in tools)
    
    # Test basic operation
    result = await mcp.call("browser_ping", {})
    assert result["success"] is True
    
    # Test navigation
    result = await mcp.call("browser_navigate", {
        "url": "https://example.com"
    })
    assert result["success"] is True
```

---

## Troubleshooting

### MCP Server Won't Start

**Problem:** "ModuleNotFoundError: No module named 'browser_mcp'"

**Solution:**
```bash
# Ensure you're in the correct directory
cd /path/to/basset-hound-browser

# Install dependencies
pip install -r browser_mcp/requirements.txt

# Verify FastMCP is installed
pip list | grep fastmcp
```

### Browser Not Responding

**Problem:** "Connection refused" errors

**Solution:**
```bash
# Start the browser
npm start

# OR with Docker
docker-compose up basset-hound-browser

# Verify it's listening
lsof -i :8765
```

### Performance Issues

**Problem:** Slow tool execution

**Solution:**
1. Check page load times (may be external)
2. Reduce concurrent operations
3. Use `wait_until: "domcontentloaded"` instead of "load"
4. Profile with performance tools

---

## Best Practices

✅ **Do:**
- Use appropriate wait times after navigation
- Implement error handling and retry logic
- Monitor token usage in palletai
- Clean up pages/cookies between workflows
- Log all reconnaissance steps for audit

❌ **Don't:**
- Make rapid concurrent calls (>10 at once)
- Skip wait times for page load
- Leave pages/cookies accumulating
- Ignore timeout errors
- Use evasion techniques inappropriately

---

## Support & Resources

**Documentation:**
- [Basset Hound API Reference](/docs/API-REFERENCE.md)
- [Integration Performance Guide](/docs/integration-performance-recommendations.md)
- [SCOPE.md - Architecture Overview](/docs/SCOPE.md)

**Client Libraries:**
- Python: `/integrations/python_client.py`
- Node.js: `/integrations/nodejs_client.js`

**Examples:**
- `/integrations/sample_osint_workflow.py`

---

**Version:** 1.0.0  
**Last Updated:** May 6, 2026  
**Status:** Production Ready  
**Compatibility:** palletai 1.0+, FastMCP 2.0+
