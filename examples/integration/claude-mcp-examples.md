> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. **These examples do not work:** no MCP server exists on disk (`browser_mcp/server.py` is absent), so the setup commands below will fail. A browser-facing MCP server is a planned step, not a delivered feature. Until then, drive the browser directly over the WebSocket API (`ws://127.0.0.1:8765`).

# Claude MCP Integration Examples

**Version**: 1.0.0  
**Date**: 2026-05-11

Complete examples of using Basset Hound Browser with Claude AI via the MCP server.

## Setup

### 1. Start MCP Server

```bash
cd /path/to/basset-hound-browser
python -m fastmcp run browser_mcp/server.py
```

Or use the standalone server:

```bash
python browser_mcp/server.py
```

### 2. Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "basset-hound-browser": {
      "command": "python",
      "args": ["browser_mcp/server.py"],
      "cwd": "/path/to/basset-hound-browser",
      "env": {
        "WS_HOST": "localhost",
        "WS_PORT": "8765"
      }
    }
  }
}
```

Restart Claude Desktop after configuration.

## Example Use Cases

### Example 1: Website Analysis

**Prompt to Claude:**

```
Visit https://example.com and tell me:
1. The page title
2. How many links are on the page
3. If there are any forms
4. A screenshot of the page
```

**Claude's Response:**

Claude will automatically:
1. Call `navigate(url="https://example.com")`
2. Call `get_page_state()` to get the title
3. Call `extract_links()` to count links
4. Call `extract_forms()` to find forms
5. Call `screenshot()` for the visual

Result:
```
I've analyzed example.com. Here's what I found:

1. **Page Title**: "Example Domain"
2. **Links**: Found 2 links on the page
3. **Forms**: No forms detected
4. **Screenshot**: [Shows screenshot of the page]

The page is simple and appears to be a demonstration page.
```

### Example 2: Content Extraction

**Prompt to Claude:**

```
Navigate to https://httpbin.org/html and extract all the text content.
Then tell me what the page is about.
```

**What Claude Does:**

```
I'll navigate to that page and extract the content for you.
<uses tool: navigate(url="https://httpbin.org/html")>
<uses tool: get_content()>

Here's what I found on the page:

[Extracted text content from the page]

This appears to be a test page from httpbin.org showing HTML content...
```

### Example 3: Form Analysis

**Prompt to Claude:**

```
Visit a website with forms (you can use https://httpbin.org/forms/post)
and analyze the form structure. What fields does it have?
```

**Claude's Workflow:**

1. Navigate to the URL
2. Extract forms with `extract_forms()`
3. Analyze and describe the form structure

### Example 4: Multi-Page Analysis

**Prompt to Claude:**

```
Compare the layouts of these two pages:
1. https://example.com
2. https://example.org

Take screenshots of both and describe the differences.
```

**Claude's Process:**

```
<uses tool: navigate(url="https://example.com")>
<uses tool: screenshot()>
[Analyzes first page]

<uses tool: navigate(url="https://example.org")>
<uses tool: screenshot()>
[Analyzes second page]

Comparing the layouts:
- Page 1 has [description]
- Page 2 has [description]
- Key differences: [analysis]
```

### Example 5: JavaScript Execution

**Prompt to Claude:**

```
Navigate to https://example.com and tell me what JavaScript libraries
are being used on the page (React, Vue, jQuery, etc.)
```

**Claude's Approach:**

Claude will:
1. Navigate to the page
2. Execute JavaScript to detect libraries
3. Report findings

```
<uses tool: navigate(url="https://example.com")>
<uses tool: execute_script(script="return [window.React ? 'React' : null, window.Vue ? 'Vue' : null, ...].filter(Boolean)")>

The page is using: [List of detected libraries]
```

### Example 6: Cookie Management

**Prompt to Claude:**

```
Navigate to https://example.com and check what cookies are set.
What tracking cookies do you find?
```

**Claude's Workflow:**

```
<uses tool: navigate(url="https://example.com")>
<uses tool: get_cookies(url="https://example.com")>

I found these cookies:
- [Cookie analysis]
- Tracking cookies detected: [List]
```

### Example 7: Proxy Testing

**Prompt to Claude:**

```
Set up a proxy and navigate to https://httpbin.org/get
Tell me if the proxy is working.
```

**Claude's Actions:**

```
<uses tool: set_proxy(host="proxy.example.com", port=8080, type="http")>
<uses tool: navigate(url="https://httpbin.org/get")>
<uses tool: get_content()>

The proxy is working. The response shows [details].
```

### Example 8: User Agent Rotation

**Prompt to Claude:**

```
Rotate the user agent and take a screenshot of https://example.com
showing the request headers received.
```

**Claude's Process:**

```
<uses tool: rotate_user_agent()>
<uses tool: navigate(url="https://httpbin.org/user-agent")>
<uses tool: get_content()>
<uses tool: screenshot()>

New user agent: [Shows current UA]
Server received this user agent: [Shows what server saw]
```

### Example 9: Tor Integration

**Prompt to Claude:**

```
Enable Tor and navigate to https://check.torproject.org
Is the connection going through Tor?
```

**Claude's Workflow:**

```
<uses tool: set_tor_mode(mode="on")>
<uses tool: navigate(url="https://check.torproject.org")>
<uses tool: get_content()>

Tor Status: [Analysis of whether Tor is active]
```

### Example 10: Data Gathering Workflow

**Prompt to Claude:**

```
I need to analyze competitor websites. For each URL below:
1. Navigate and get the page title
2. Extract all links
3. Take a screenshot
4. Identify any forms

URLs:
- https://competitor1.com
- https://competitor2.com

Create a comparison report.
```

**Claude's Comprehensive Analysis:**

Claude will systematically go through each URL, gather data, and create a detailed comparison report.

---

## Advanced Patterns

### Pattern 1: Conditional Logic

**Prompt:**

```
Visit https://example.com. If there's a search form, tell me about it.
If not, tell me what forms are present.
```

**Claude's Response:**

Claude uses the tool responses to determine what to do next.

### Pattern 2: Data Extraction Pipeline

**Prompt:**

```
Extract all links from https://example.com and tell me:
- How many links are internal vs external
- The most common domain for external links
- Any suspicious or malformed links
```

**Claude's Approach:**

Claude extracts links, parses URLs, categorizes them, and provides analysis.

### Pattern 3: Evasion Strategies

**Prompt:**

```
I need to visit a site that blocks robots. Apply evasion techniques:
1. Rotate the user agent
2. Set a residential proxy (if available)
3. Add realistic delays
4. Then navigate to [URL] and tell me what you found
```

**Claude's Process:**

Claude applies each evasion technique before navigating.

### Pattern 4: Error Recovery

**Prompt:**

```
Try to navigate to https://example.com. If it fails or the page
doesn't load properly, try again with a different user agent.
Keep trying until you get a response.
```

**Claude's Behavior:**

Claude automatically retries with different strategies.

### Pattern 5: Data Validation

**Prompt:**

```
Navigate to https://example.com/api and verify:
1. The page loads (HTTP 200)
2. Returns valid content
3. Takes a screenshot as proof

If anything fails, tell me what went wrong.
```

**Claude's Response:**

Claude checks each condition and reports results.

---

## Tips for Using with Claude

### 1. Be Specific About Goals

Good: "Extract all product links from this e-commerce site"  
Bad: "Look at this website"

### 2. Ask for Structured Data

Claude will format responses as:
- Tables
- Lists
- JSON
- Comparison matrices

### 3. Combine Tools

Claude can chain commands:
```
1. Navigate to page A
2. Extract links
3. For each link, navigate and get title
4. Create a sitemap
```

### 4. Request Explanations

Claude will explain findings:
- Why certain patterns matter
- Security implications
- Performance observations
- Best practices

### 5. Use Screenshots for Validation

Ask Claude to take screenshots to verify actions succeeded.

---

## Limitations to Know

1. **Timing**: JavaScript-heavy sites need adequate load delays
2. **Authentication**: Multiple-factor auth may require manual steps
3. **Rate Limiting**: High-frequency requests may be blocked
4. **JavaScript**: Some content requires JavaScript execution
5. **Dynamic Content**: AJAX-loaded content may not be captured

---

## Troubleshooting

### "Tool not found"

Make sure:
- MCP server is running (`python browser_mcp/server.py`)
- Claude Desktop is configured correctly
- Claude has been restarted

### "Connection timeout"

Check:
- Basset Hound is running on port 8765
- No firewall blocking the connection
- Browser process hasn't crashed

### "Navigation failed"

Try:
- Rotating user agent first
- Adding a delay before requesting content
- Checking if the URL is valid

### "Screenshot is blank"

Reason: Page may not have rendered  
Solution: Add more delay time in your prompt

---

## Best Practices

1. **Always wait after navigate**: "Navigate and then wait a moment before extracting"
2. **Use error handling**: "If X fails, try Y instead"
3. **Request structured output**: "Format results as JSON"
4. **Validate results**: "Take a screenshot to verify"
5. **Save outputs**: "Save the results to a file" (Claude can help orchestrate)

---

## Integration with External Systems

Claude can now serve as the orchestrator:

```
Claude (via MCP) → Basset Hound Browser → External System

Example:
- Claude queries Basset Hound for website data
- Parses and enriches the data
- Stores in external database
- Generates reports
```

This enables:
- Automated OSINT pipelines
- Competitive intelligence gathering
- Website monitoring
- Data collection at scale
- Forensic analysis workflows

---

## Example Complete Workflow

**End-to-end OSINT workflow with Claude:**

```
User: Perform OSINT on example.com. I need:
1. Basic site info (title, description)
2. Technology stack
3. Links to related properties
4. Screenshot
5. Forms for social engineering assessment
6. Results as JSON

Claude: I'll perform a complete OSINT analysis of example.com.

[Claude runs this sequence:]
1. Rotates user agent (evasion)
2. Navigates to example.com
3. Extracts page state (title, description)
4. Runs JavaScript analysis (tech stack)
5. Extracts all links
6. Takes screenshot
7. Extracts forms
8. Compiles JSON report

[Returns comprehensive JSON report with all findings]
```

---

## Next Steps

1. **Start MCP Server**: `python browser_mcp/server.py`
2. **Configure Claude**: Update claude_desktop_config.json
3. **Restart Claude**: Fully close and reopen Claude Desktop
4. **Try Examples**: Use the prompts above
5. **Build Workflows**: Create custom prompts for your needs
6. **Combine Tools**: Integrate with other systems via Claude

---

For more information, see:
- `/docs/INTEGRATION-GUIDE-EXTERNAL-SYSTEMS.md` - Full integration guide
- `/browser_mcp/server.py` - MCP server implementation
- `/docs/API-REFERENCE.md` - Complete API reference
