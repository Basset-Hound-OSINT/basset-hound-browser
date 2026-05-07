# Basset Hound Browser MCP Testing - Experimentation Archive

This directory contains systematic testing of the Basset Hound Browser MCP server across multiple AI models.

---

## Contents

### 1. Master Report
**File:** `MCP-TESTING-MASTER-REPORT-2026-05-06.md`

Consolidated findings from all model testing:
- Comparison table across Opus 4.7, Sonnet 4.6, Haiku 4.5
- Success rates and performance metrics
- Aggregate findings and recommendations
- Status: IN PROGRESS (awaiting all agent results)

### 2. Test Prompts
**File:** `AGENT-TEST-PROMPTS-2026-05-06.md`

Exact prompts used to spawn each agent:
- Opus 4.7 prompt (comprehensive, detail-oriented)
- Sonnet 4.6 prompt (balanced, practical)
- Haiku 4.5 prompt (concise, speed-optimized)

Use these prompts to replicate the testing framework or modify for different scenarios.

### 3. Model-Specific Results

#### 3.1 Opus 4.7 - Full Capability
**Directory:** `mcp-testing-opus-4-7-2026-05-06/`

- `findings.md` - Detailed diagnostic findings
- `test-results.json` - Structured test results (when available)
- `screenshots/` - Captures from test execution (when available)

**Status:** ✅ COMPLETE - Infrastructure diagnostics provided

#### 3.2 Sonnet 4.6 - Balanced
**Directory:** `mcp-testing-sonnet-4-6-2026-05-06/`

- `findings.md` - Agent findings and observations
- `test-results.json` - Structured results
- `comparison-vs-opus.md` - Comparison analysis

**Status:** 🔄 PENDING - Agent still executing

#### 3.3 Haiku 4.5 - Fast
**Directory:** `mcp-testing-haiku-4-5-2026-05-06/`

- `findings.md` - Agent findings
- `test-results.json` - Results with focus on performance/cost
- `comparison-vs-opus-vs-sonnet.md` - Complete comparison

**Status:** 🔄 PENDING - Agent still executing

---

## Test Scenarios (10 Total)

All agents execute the same 10 core test scenarios:

### Scenario 1: Simple Navigation
- Navigate to example.com
- Navigate to example.org
- Navigate to example.net
- Verify page titles change

**Expected Tools:** `browser_navigate`, `browser_get_title`

### Scenario 2: Form Interaction
- Navigate to httpbin.org/forms/post
- Fill form fields
- Submit form
- Verify success

**Expected Tools:** `browser_navigate`, `browser_fill`, `browser_click`

### Scenario 3: Content Extraction
- Navigate to example.com
- Extract HTML
- Extract all links
- Count links

**Expected Tools:** `browser_navigate`, `browser_get_content`, `browser_extract_links`

### Scenario 4: Screenshot Capture
- Navigate to example.com
- Capture full-page screenshot
- Verify non-empty

**Expected Tools:** `browser_navigate`, `browser_screenshot`

### Scenario 5: Cookie Management
- Set test cookie
- Retrieve cookies
- Verify cookie exists
- Clear cookies

**Expected Tools:** `browser_set_cookies`, `browser_get_cookies`

### Scenario 6: Multiple Tabs
- Create new tab
- Navigate tab 1 to example.com
- Navigate tab 2 to example.org
- Switch tabs, close one

**Expected Tools:** `browser_create_tab`, `browser_navigate`, `browser_switch_tab`, `browser_close_tab`

### Scenario 7: JavaScript Execution
- Execute `return document.title`
- Execute `return window.location.href`
- Execute `return document.querySelectorAll('a').length`
- Verify results are correct types

**Expected Tools:** `browser_execute_script`

### Scenario 8: Proxy Configuration
- Get proxy status
- Test proxy (127.0.0.1:9050)
- Verify response

**Expected Tools:** `browser_get_proxy_status`, `browser_test_proxy`

### Scenario 9: User Agent Rotation
- Get UA status
- List UA categories
- Rotate UA
- Get new UA status

**Expected Tools:** `browser_get_user_agent_status`, `browser_rotate_user_agent`, `browser_get_user_agent_categories`

### Scenario 10: Tor Integration
- Get Tor mode
- Get Tor status
- Verify response fields

**Expected Tools:** `browser_get_tor_mode`, `browser_tor_get_status`

---

## How to Interpret Results

### Success Metrics
- **Scenarios Completed:** How many of 10 scenarios were executed
- **Successful:** How many completed successfully
- **Failed:** How many completed but failed
- **Success Rate:** Percentage successful of those attempted

### Timing Metrics
- **Average Time per Test:** Mean duration across all tests
- **Total Time:** Complete test suite duration
- **Slowest Scenario:** Which scenario took longest
- **Fastest Scenario:** Which scenario was quickest

### Quality Metrics
- **Tool Accuracy:** Did tools work as expected?
- **Error Patterns:** What types of errors occurred?
- **Recovery Rate:** How well did errors recover?
- **Consistency:** Did results repeat reliably?

---

## Model Comparison Framework

### Capability Levels
| Model | Capability | Speed | Cost | Best For |
|-------|-----------|-------|------|----------|
| Opus 4.7 | Highest | Slower | Higher | Complex logic, error recovery |
| Sonnet 4.6 | High | Medium | Medium | Production workloads |
| Haiku 4.5 | Good | Fastest | Lowest | High-volume tasks |

### What to Look For in Results

**Opus 4.7:**
- Handles complex scenarios better?
- Recovers from errors more effectively?
- Provides more detailed diagnostics?
- Worth the extra cost?

**Sonnet 4.6:**
- Best speed/capability balance?
- Reliable for production?
- Reasonably priced?
- Good developer experience?

**Haiku 4.5:**
- Handles simple tasks efficiently?
- Fastest execution time?
- Most cost-effective?
- Suitable for high-volume use?

---

## Using These Results for Integration

### For Secondary Projects (palletai, etc.)

1. **Review all three findings documents**
   - Understand each model's strengths/weaknesses
   - Note any compatibility issues

2. **Check the cost analysis**
   - Compare cost per request
   - Calculate ROI for your use case

3. **Review prompt engineering tips**
   - Adapt successful patterns for your domain
   - Avoid documented pitfalls

4. **Follow error handling strategies**
   - Implement recommended retry logic
   - Use suggested recovery patterns

5. **Make model selection**
   - Use the recommendation table
   - Consider your specific constraints
   - Start with Sonnet 4.6 if unsure

### For MCP Server Development

1. **Review critical issues found**
   - Address any functional problems
   - Improve error messages if needed

2. **Note performance bottlenecks**
   - Optimize slower operations
   - Consider async improvements

3. **Validate scope boundaries**
   - Confirm no intelligence tools leaked in
   - Verify browser automation focus

4. **Improve documentation**
   - Update based on user confusion
   - Clarify ambiguous tool names

---

## Methodology Notes

### Why Multiple Models?
- **Different capability levels** reveal different failure modes
- **Cost tradeoffs** matter for production systems
- **Speed variations** affect real-time applications
- **Reasoning quality** impacts error recovery

### Why These 10 Scenarios?
- **Core browser operations** (navigation, interaction, extraction)
- **Practical workflows** (forms, cookies, tabs)
- **Advanced features** (proxies, Tor, user agents)
- **Comprehensive coverage** of MCP tool categories

### Why This Order?
- **Simple first** (navigation) to establish baseline
- **Progressive complexity** (interaction → extraction → advanced)
- **Dependency ordering** (setup before advanced features)
- **Realistic workflow** matching typical OSINT patterns

---

## Future Testing

### Extending This Framework

To run additional tests:

1. **Use the same prompt structure** (Opus/Sonnet/Haiku variants)
2. **Follow the same JSON reporting format**
3. **Store results in dated subdirectories**
4. **Update MASTER-REPORT.md with new data**
5. **Document findings in individual folders**

### Adding New Test Scenarios

1. Define scenario clearly
2. Add to prompt for all three models
3. Use consistent tool names
4. Store results consistently
5. Update master report

### Comparing with Future Versions

This testing framework can be repeated:
- For new Claude models
- For new browser versions
- For modified MCP servers
- For different network conditions

Simply date the directories and compare results.

---

## Key Insights

### Browser Quality
- ✅ 166 tools well-designed
- ✅ Clear tool naming
- ✅ Comprehensive coverage
- ✅ No intelligence tools (correctly out-of-scope)

### MCP Integration
- ✅ Sound methodology
- ✅ Multi-model validation essential
- ✅ Cost/performance tradeoffs matter
- ✅ Infrastructure prerequisites critical

### Testing Framework
- ✅ Systematic approach works well
- ✅ JSON reporting enables analysis
- ✅ Agent-based testing catches issues
- ✅ Replicable and extensible

---

## Related Documentation

- **MASTER-IMPLEMENTATION-PLAN:** `/docs/archive/MASTER-IMPLEMENTATION-PLAN-2026-05-06.md`
- **Integration Guide:** `/docs/integration-performance-recommendations.md`
- **Scope Document:** `/docs/SCOPE.md` (MCP Testing section)
- **Session Summary:** `/docs/archive/TESTING-SESSION-SUMMARY-2026-05-06.md`

---

## Questions?

This testing framework is designed to be:
- **Transparent:** All prompts visible
- **Reproducible:** Same scenarios for all models
- **Systematic:** Clear methodology documented
- **Extensible:** Easy to add more tests

For questions about specific results, see the model-specific findings documents.

---

**Testing Framework:** Basset Hound Browser MCP Testing Suite v1.0  
**Created:** May 6, 2026  
**Status:** In Progress (Awaiting Sonnet and Haiku Results)
