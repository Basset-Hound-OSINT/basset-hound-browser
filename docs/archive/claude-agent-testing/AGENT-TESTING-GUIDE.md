# Basset Hound Browser - Claude Agent Testing Guide
**Date:** May 8, 2026  
**Purpose:** Systematic validation of browser automation via MCP with multi-model AI agents  
**Version:** 1.0

---

## Overview

This guide explains how to spawn Claude AI agents to test the Basset Hound Browser's MCP (Model Context Protocol) server. The browser provides 166 MCP tools that AI agents can use to automate web tasks. This document explains the testing methodology and how to validate the integration across different Claude models.

---

## Why Test with AI Agents?

1. **Real-world usage** - Tests actual MCP integration, not just API calls
2. **Multi-model validation** - Ensures compatibility across Opus 4.7, Sonnet 4.6, Haiku 4.5
3. **Complex workflows** - Tests multi-step reasoning and error recovery
4. **Performance profiling** - Measures latency and capability across models
5. **Integration readiness** - Validates that external agents (palletai) can use the browser

---

## Setup

### Prerequisites

1. **Basset Hound Browser running** on port 8765
   ```bash
   docker run -d -p 8765:8765 basset-hound:latest
   ```

2. **MCP Server running** (Python server or JavaScript adapter)
   ```bash
   python -m basset_hound_browser.mcp.server
   ```

3. **Claude Code environment** with access to spawn agents

### MCP Configuration

For Claude Desktop or Claude Code integration:

```json
{
  "mcpServers": {
    "basset-hound-browser": {
      "command": "python",
      "args": ["-m", "basset_hound_browser.mcp.server"],
      "env": {
        "BASSET_WS_URL": "ws://localhost:8765"
      }
    }
  }
}
```

---

## Test Scenarios

Each agent tests the same 10 core scenarios to provide comparative data:

### Scenario 1: Simple Navigation
**Goal:** Navigate to multiple URLs and verify page loads

**Test Steps:**
1. Navigate to https://example.com
2. Get page state (URL, title, content)
3. Navigate to https://httpbin.org/html
4. Navigate to https://google.com
5. Verify all navigation succeeded

**Success Criteria:**
- All URLs load successfully
- Page titles are correct
- Content extracted properly

### Scenario 2: Form Interaction
**Goal:** Fill and submit a form

**Test Steps:**
1. Navigate to https://httpbin.org/forms/post
2. Analyze form structure
3. Fill email field
4. Fill name field
5. Click submit button

**Success Criteria:**
- Form fields identified correctly
- Values entered without errors
- Submit action completed

### Scenario 3: Content Extraction
**Goal:** Extract various types of content from a page

**Test Steps:**
1. Navigate to https://example.com
2. Extract all links
3. Extract all images
4. Extract all text
5. Extract metadata (meta tags, title)

**Success Criteria:**
- Links extracted with href and text
- Images extracted with URLs
- Text extraction complete
- Metadata properly parsed

### Scenario 4: Screenshot Capture
**Goal:** Capture page screenshots with various options

**Test Steps:**
1. Navigate to https://example.com
2. Capture full page screenshot
3. Capture element screenshot (take screenshot of header)
4. Verify image data saved
5. Check screenshot metadata (size, hash)

**Success Criteria:**
- Screenshots generated successfully
- Image data valid and retrievable
- Metadata includes hash/timestamp

### Scenario 5: Cookie Management
**Goal:** Manage cookies across multiple pages

**Test Steps:**
1. Navigate to https://httpbin.org/cookies/set?test=value
2. Get all cookies
3. Create a cookie jar
4. Save cookies to jar
5. Clear cookies
6. Load cookies from jar
7. Verify cookies restored

**Success Criteria:**
- Cookies set and retrieved
- Cookie jar operations successful
- Cookies persisted across operations

### Scenario 6: Multiple Tabs
**Goal:** Create, switch, and manage multiple browser tabs

**Test Steps:**
1. Create tab 1 (navigate to example.com)
2. Create tab 2 (navigate to google.com)
3. Create tab 3 (navigate to github.com)
4. Switch to tab 1, get page state
5. Switch to tab 2, get page state
6. Close tab 2
7. List remaining tabs

**Success Criteria:**
- Tabs created successfully
- Switch operations work
- Page state independent per tab
- Close operations successful

### Scenario 7: JavaScript Execution
**Goal:** Execute JavaScript in page context and get results

**Test Steps:**
1. Navigate to https://example.com
2. Execute script: `document.title`
3. Execute script: `document.querySelectorAll('a').length`
4. Execute script: `navigator.userAgent`
5. Execute script: `screen.width + 'x' + screen.height`

**Success Criteria:**
- JavaScript executes without errors
- Results returned correctly
- All script types (property access, DOM queries, etc.) work

### Scenario 8: Proxy Configuration
**Goal:** Test proxy setup and connectivity

**Test Steps:**
1. Get current proxy settings
2. Set SOCKS5 proxy (optional, if available)
3. Test connection with proxy
4. Clear proxy settings
5. Verify direct connection restored

**Success Criteria:**
- Proxy settings applied
- Connectivity maintained
- Settings can be cleared

### Scenario 9: User Agent Rotation
**Goal:** Get and rotate user agents

**Test Steps:**
1. Get current user agent
2. Get list of available user agents
3. Set random user agent
4. Navigate to https://httpbin.org/user-agent
5. Verify user agent changed
6. Rotate to another user agent

**Success Criteria:**
- User agent retrievable
- Rotation works
- New user agent applied to requests

### Scenario 10: Tor Integration
**Goal:** Test Tor mode and status

**Test Steps:**
1. Get Tor status
2. Get Tor mode (should be OFF/ON/AUTO)
3. Set Tor mode to AUTO
4. Get Tor mode (verify change)
5. Check Tor connectivity status

**Success Criteria:**
- Tor status retrievable
- Mode can be set
- Status reflects changes

---

## Test Execution

### Running Tests with a Single Agent

```javascript
// Test template for Claude agents
const runTests = async (testScenarios) => {
  const results = {
    timestamp: new Date().toISOString(),
    scenarios: [],
    total_tests: 0,
    passed_tests: 0,
    failed_tests: 0,
    avg_latency_ms: 0,
    issues: []
  };

  for (const scenario of testScenarios) {
    try {
      // Execute scenario steps
      const start = Date.now();
      const result = await scenario.execute();
      const latency = Date.now() - start;

      results.scenarios.push({
        name: scenario.name,
        success: result.success,
        latency_ms: latency,
        notes: result.notes,
        errors: result.errors || []
      });

      if (result.success) {
        results.passed_tests++;
      } else {
        results.failed_tests++;
        results.issues.push(`${scenario.name}: ${result.error}`);
      }
      results.total_tests++;
    } catch (error) {
      results.failed_tests++;
      results.total_tests++;
      results.issues.push(`${scenario.name}: ${error.message}`);
    }
  }

  return results;
};
```

### Comparing Across Models

After testing with Opus, Sonnet, and Haiku, compare:

| Metric | Opus 4.7 | Sonnet 4.6 | Haiku 4.5 |
|--------|----------|-----------|----------|
| Pass Rate | ? | ? | ? |
| Avg Latency (ms) | ? | ? | ? |
| Complex Scenarios | ? | ? | ? |
| Error Recovery | ? | ? | ? |
| Cost per Test | ? | ? | ? |

---

## Result Interpretation

### Success Criteria
- ✅ **Excellent:** 90%+ pass rate, <100ms avg latency
- ⚠️ **Good:** 80%+ pass rate, <200ms avg latency
- ❌ **Poor:** <80% pass rate or >500ms latency

### Common Issues

**Issue: "MCP server not connected"**
- Solution: Verify MCP server is running and reachable

**Issue: "WebSocket connection failed"**
- Solution: Check if browser is running on port 8765

**Issue: "Command timeout"**
- Solution: Check browser CPU/memory, increase timeout

**Issue: "Fingerprint inconsistency"**
- Solution: Verify fingerprint profiles are being created correctly

---

## Performance Benchmarking

### Metrics to Track

```json
{
  "performance": {
    "navigation_latency_ms": {
      "p50": 150,
      "p95": 400,
      "p99": 800
    },
    "screenshot_latency_ms": {
      "p50": 200,
      "p95": 500,
      "p99": 1000
    },
    "command_processing_ms": {
      "p50": 10,
      "p95": 50,
      "p99": 100
    }
  },
  "throughput": {
    "commands_per_second": 50,
    "pages_per_minute": 30
  }
}
```

---

## Best Practices

### 1. Test Isolation
- Each scenario runs independently
- Clean state between tests
- No cross-test dependencies

### 2. Error Handling
- Test both success and failure paths
- Document expected errors
- Measure recovery time

### 3. Performance
- Measure latency for each operation
- Track memory usage
- Monitor CPU utilization

### 4. Repeatability
- Use same test data across models
- Run tests multiple times
- Compare results statistically

### 5. Documentation
- Record all results in JSON
- Capture screenshots for visual validation
- Document any deviations from expected behavior

---

## Spawning Claude Agents

### Opus 4.7 (Full Capability)
Use for comprehensive testing, complex reasoning, error analysis

### Sonnet 4.6 (Balanced)
Use for real-world usage patterns, integration testing

### Haiku 4.5 (Fast)
Use for quick validation, simple scenarios

---

## Integration with External Systems

### For palletai Integration
1. Test that browser MCP is accessible from palletai
2. Validate that agent orchestration can call all 166 tools
3. Test multi-step workflows with browser as tool
4. Measure end-to-end latency

### For Claude Desktop
1. Add MCP server to Claude Desktop config
2. Test browser commands in Claude's native UI
3. Validate that Claude can reason about browser state
4. Test complex multi-step investigations

---

## Troubleshooting

### Browser Not Responding
```bash
# Check if browser is running
curl -i http://localhost:8765

# Check WebSocket connectivity
wscat -c ws://localhost:8765
```

### MCP Server Issues
```bash
# Check if MCP server is running
lsof -i :8765

# Test MCP connection directly
python -c "from basset_hound_browser.mcp.client import create_client; client = create_client(); print(client.list_resources())"
```

### Agent Testing Failures
1. Check browser logs for errors
2. Verify MCP server is configured correctly
3. Check network connectivity
4. Test with simple scenario first

---

## Recommended Reading

- `docs/API-REFERENCE.md` - Complete list of 164 WebSocket commands
- `docs/SCOPE.md` - Browser capabilities and boundaries
- `docs/ROADMAP.md` - Architecture and phase history
- Integration test results from this session

---

## Contact & Support

For issues with agent testing:
1. Check browser logs: `docker logs basset-hound`
2. Review MCP server logs
3. Test WebSocket connectivity directly
4. Document issue and contact development team

---

*This guide is maintained as part of the Basset Hound Browser integration testing suite. Last updated May 8, 2026.*
