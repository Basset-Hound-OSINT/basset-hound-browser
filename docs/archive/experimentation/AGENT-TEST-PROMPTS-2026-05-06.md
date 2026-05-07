# Basset Hound Browser - Agent MCP Testing Prompts
**Date:** May 6, 2026  
**Version:** 1.0  

## Overview

This document contains the exact prompts used to spawn AI agents for testing the Basset Hound Browser MCP server. Each agent executes 10 core test scenarios and reports findings.

---

## Test Scenarios (10 Total)

1. **Simple Navigation** - Visit 3 URLs and verify page titles
2. **Form Interaction** - Fill and submit a test form
3. **Content Extraction** - Get page HTML, text, and links
4. **Screenshot Capture** - Full page screenshot
5. **Cookie Management** - Get, set, clear cookies
6. **Multiple Tabs** - Create, switch, close tabs
7. **JavaScript Execution** - Run custom JavaScript
8. **Proxy Configuration** - Set and test proxy
9. **User Agent Rotation** - Get and rotate user agents
10. **Tor Integration** - Check Tor mode and status

---

## OPUS 4.7 - Full Capability Agent

**Model:** claude-opus-4-7  
**Capability Level:** Full - advanced reasoning, complex tasks, maximum capability

### Prompt

```
You are testing the Basset Hound Browser MCP (Model Context Protocol) server.
Your role is to systematically execute 10 test scenarios via the MCP interface 
and report findings including success rates, timing, and observations.

BROWSER INFO:
- MCP Server: Basset Hound Browser v11.0.0
- WebSocket: ws://localhost:8765
- Available tools: 166 browser automation tools
- Focus: Browser automation, evasion, data extraction, forensics

YOUR TASK:
Execute the following 10 test scenarios in sequence. For each scenario:
1. Document the exact tool/method you use
2. Record success/failure status
3. Note timing if available
4. Capture any errors or unexpected behavior
5. Rate difficulty (easy/medium/hard)

TEST SCENARIOS:
1. Simple Navigation
   - Navigate to https://example.com
   - Navigate to https://example.org  
   - Navigate to https://example.net
   - Verify page titles are different
   
2. Form Interaction
   - Navigate to https://httpbin.org/forms/post
   - Fill the form fields (find selectors first)
   - Submit the form
   - Verify success page

3. Content Extraction
   - Navigate to https://example.com
   - Extract all page HTML
   - Extract all links from page
   - Count total links

4. Screenshot Capture
   - Navigate to https://example.com
   - Capture full page screenshot
   - Verify screenshot is not empty

5. Cookie Management
   - Set a test cookie for example.com
   - Retrieve all cookies
   - Verify test cookie exists
   - Clear cookies

6. Multiple Tabs
   - Create a new tab
   - Navigate first tab to https://example.com
   - Navigate second tab to https://example.org
   - Switch between tabs
   - Close one tab

7. JavaScript Execution
   - Execute: return document.title
   - Execute: return window.location.href
   - Execute: return document.querySelectorAll('a').length
   - Verify results are strings/numbers

8. Proxy Configuration
   - Get current proxy status
   - Test proxy connection (127.0.0.1:9050 for Tor)
   - Verify response is valid

9. User Agent Rotation
   - Get current user agent status
   - List available UA categories
   - Try to rotate user agent
   - Get new user agent status

10. Tor Integration
    - Get Tor mode (OFF/ON/AUTO)
    - Get Tor status
    - Verify response contains expected fields

REPORTING REQUIREMENTS:
After completing all tests, provide a JSON report with:
{
  "agent": "Opus 4.7",
  "timestamp": "ISO-8601",
  "total_scenarios": 10,
  "completed": <number>,
  "successful": <number>,
  "failed": <number>,
  "success_rate": "<percentage>",
  "average_time_per_test": "<seconds>",
  "scenarios": [
    {
      "number": 1,
      "name": "Simple Navigation",
      "status": "passed|failed|error",
      "duration_seconds": <number>,
      "difficulty": "easy|medium|hard",
      "tools_used": ["tool1", "tool2"],
      "notes": "Any observations"
    },
    ... (10 scenarios total)
  ],
  "findings": {
    "major_issues": [],
    "minor_issues": [],
    "observations": [],
    "recommendations": []
  },
  "model_specific_notes": "Any model-specific observations"
}

Be thorough, systematic, and note any issues or unexpected behaviors.
Good luck!
```

---

## SONNET 4.6 - Balanced Agent

**Model:** claude-sonnet-4-6  
**Capability Level:** Balanced - strong reasoning, good speed-capability tradeoff

### Prompt

```
You are an AI agent testing the Basset Hound Browser MCP server.
Your goal: Execute 10 core test scenarios and report results.

CONTEXT:
- Browser: Basset Hound Browser v11.0.0
- Interface: Model Context Protocol (MCP)
- Goal: Validate browser automation via MCP
- Focus: Practical testing, clear reporting

EXECUTE THESE 10 TESTS:
1. Simple Navigation - Visit 3 URLs
2. Form Interaction - Fill and submit form
3. Content Extraction - Get HTML, links
4. Screenshot Capture - Full page screenshot
5. Cookie Management - Get/set/clear cookies
6. Multiple Tabs - Create, switch, close
7. JavaScript Execution - Run JS in page
8. Proxy Configuration - Set and test proxy
9. User Agent Rotation - Get and rotate UAs
10. Tor Integration - Get Tor mode/status

FOR EACH TEST:
- Use the appropriate MCP tool(s)
- Record: success/failure, duration, any errors
- Rate difficulty (easy/medium/hard)
- Note what tools you used

REPORT FORMAT (JSON):
{
  "agent": "Sonnet 4.6",
  "timestamp": "<ISO-8601>",
  "total_scenarios": 10,
  "completed": <number>,
  "successful": <number>,
  "failed": <number>,
  "success_rate": "<percentage>",
  "scenarios": [
    {
      "number": 1,
      "name": "<test name>",
      "status": "passed|failed|error",
      "duration_seconds": <number>,
      "difficulty": "easy|medium|hard",
      "tools_used": ["tool1", ...],
      "notes": "<observations>"
    },
    ... 10 total
  ],
  "summary": {
    "issues": [],
    "recommendations": []
  }
}

Be systematic and thorough. Test each scenario and report results clearly.
```

---

## HAIKU 4.5 - Fast/Lightweight Agent

**Model:** claude-haiku-4-5-20251001  
**Capability Level:** Fast - optimized for speed, good for practical tasks

### Prompt

```
Test Basset Hound Browser MCP. Execute 10 scenarios, report results.

TESTS:
1. Navigate 3 URLs (example.com, .org, .net)
2. Fill form at httpbin.org/forms/post and submit
3. Extract HTML and links from example.com
4. Take screenshot
5. Set, get, clear cookies
6. Create 2 tabs, switch, close
7. Run 3 JavaScript snippets
8. Get and test proxy status
9. Get UA status and categories
10. Get Tor mode and status

FOR EACH:
- Use MCP tool
- Record: pass/fail, time, errors
- Difficulty: easy/medium/hard
- Tools used

REPORT (JSON):
{
  "agent": "Haiku 4.5",
  "timestamp": "<ISO>",
  "total": 10,
  "completed": <n>,
  "successful": <n>,
  "failed": <n>,
  "success_rate": "<percent>%",
  "scenarios": [
    {
      "num": 1,
      "name": "test",
      "status": "pass/fail/error",
      "seconds": <n>,
      "difficulty": "easy/med/hard",
      "tools": ["tool1"],
      "notes": ""
    },
    ... 10 total
  ],
  "issues": [],
  "recommendations": []
}

Go fast, be clear.
```

---

## Execution Notes

- All three agents receive the same test scenarios
- Each agent reports in JSON format
- Results stored in dated directories:
  - `docs/archive/experimentation/mcp-testing-opus-4-7-2026-05-06/`
  - `docs/archive/experimentation/mcp-testing-sonnet-4-6-2026-05-06/`
  - `docs/archive/experimentation/mcp-testing-haiku-4-5-2026-05-06/`
- Agents run in parallel
- Total execution time: 30-60 minutes (estimated)

---

**Generated:** May 6, 2026  
**Test Framework:** Basset Hound Browser MCP Testing Suite v1.0
