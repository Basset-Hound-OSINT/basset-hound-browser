# Report Generator Architecture

**Document:** Architecture and Design Patterns  
**Date:** 2026-06-22  
**Version:** 2.0.0  

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│  External Consumers (CLI, API, MCP Agents)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │  report-generator.js  │ ← Public API (re-exports)
         │   (37 lines)          │
         └───────────┬───────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    ┌────────────────────────────────────────┐
    │ generator-core.js        formatters.js │
    │ - Orchestration          - HTMLFormatter
    │ - Report building        - JSONFormatter
    │ - Lifecycle mgmt         - MarkdownFormatter
    │ - Validation             - CSVFormatter
    │ (729 lines)              (875 lines)
    └────────────────┬─────────────────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │   utilities.js        │
         │ - Data filtering      │
         │ - Text processing     │
         │ - Metrics & analysis  │
         │ (410 lines)           │
         └───────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │ Node.js Built-ins      │
        │ fs, path, crypto, os   │
        └────────────────────────┘
```

---

## Module Interaction Flow

### Report Generation Workflow

```
1. CREATE REPORT GENERATOR
   ┌─────────────────────────────┐
   │ new ReportGenerator(options) │ ← generator-core.js
   │  - Initialize formatters    │
   │  - Ensure directories       │
   │  - Register handlers        │
   └─────────────────────────────┘

2. VALIDATE INPUT
   ┌─────────────────────────────┐
   │ validateEvidence()          │ ← utilities.js
   │ - Check structure           │
   │ - Verify required fields    │
   │ - Return errors/status      │
   └─────────────────────────────┘

3. BUILD REPORT STRUCTURE
   ┌──────────────────────────────────────┐
   │ _buildReportStructure()              │ ← generator-core.js
   │  ├─ _buildExecutiveSummary()        │
   │  ├─ _buildInvestigation()           │
   │  ├─ _buildScreenshots()             │
   │  ├─ _buildNetworkAnalysis()         │
   │  ├─ _buildTechnologies()            │
   │  ├─ _buildTimeline()                │
   │  ├─ _buildEvidence()                │
   │  └─ _buildRecommendations()         │
   └──────────────────────────────────────┘

4. FILTER SENSITIVE DATA (if requested)
   ┌─────────────────────────────┐
   │ filterSensitiveData()       │ ← utilities.js
   │ - Pattern matching          │
   │ - Recursive redaction       │
   │ - Return filtered copy      │
   └─────────────────────────────┘

5. FORMAT REPORT
   ┌──────────────────────────────────────┐
   │ formatter.format(report)             │ ← formatters.js
   │  ├─ HTMLFormatter._getStyles()      │
   │  ├─ HTMLFormatter._renderHeader()   │
   │  ├─ HTMLFormatter._renderSections() │
   │  └─ Return formatted string         │
   └──────────────────────────────────────┘

6. CALCULATE METRICS
   ┌─────────────────────────────┐
   │ calculateMetrics()          │ ← utilities.js
   │ - Count words               │
   │ - Count items               │
   │ - Return summary stats      │
   └─────────────────────────────┘

7. HASH REPORT (for integrity)
   ┌─────────────────────────────┐
   │ hashReport()                │ ← utilities.js
   │ - SHA256 digest             │
   │ - Return hex string         │
   └─────────────────────────────┘

8. SAVE TO DISK
   ┌─────────────────────────────┐
   │ saveReport()                │ ← generator-core.js
   │ - Write file                │
   │ - Ensure directory          │
   │ - Return metadata           │
   └─────────────────────────────┘

9. RETURN RESULT
   ┌──────────────────────────────┐
   │ Promise<{                    │
   │   path,                      │
   │   format,                    │
   │   metrics,                   │
   │   integrity,                 │
   │   generationTime             │
   │ }>                           │
   └──────────────────────────────┘
```

---

## Module Details

### generator-core.js - Orchestration Engine

**Class: ReportGenerator**

```javascript
class ReportGenerator {
  // INITIALIZATION
  constructor(options)
    ├─ Defaults: reportDir, companyName, toolVersion
    ├─ Creates formatters Map
    ├─ Calls _registerFormatters()
    └─ Calls _ensureDirectory()

  // PRIMARY ENTRY POINT
  async generateReport(evidence, options)
    ├─ Validates inputs
    ├─ Builds report structure
    ├─ Filters sensitive data (optional)
    ├─ Applies templating
    ├─ Validates result
    ├─ Delegates formatting
    ├─ Calculates metrics
    ├─ Hashes report
    └─ Returns {path, format, metrics, ...}

  // REPORT BUILDING (Private)
  _buildReportStructure(evidence, options)
    ├─ _buildExecutiveSummary()
    ├─ _buildInvestigation()
    ├─ _buildScreenshots()
    ├─ _buildNetworkAnalysis()
    ├─ _buildTechnologies()
    ├─ _buildTimeline()
    ├─ _buildEvidence()
    └─ _buildRecommendations()

  // FILTERING & PROCESSING (Private)
  _filterSensitiveData(reportData, filters)
    └─ Delegates to utilities.filterSensitiveData()

  // PERSISTENCE
  async saveReport(reportData, filename, format)
    ├─ Ensures directory exists
    ├─ Writes formatted output
    ├─ Updates metadata
    └─ Returns save result

  // HELPERS (Private)
  _registerFormatters()
    ├─ Maps format → Formatter instance
    └─ Supports: html, json, markdown, csv

  _ensureDirectory()
    └─ Creates reportDir recursively
}
```

**Key Characteristics:**
- **Single Responsibility:** Report orchestration only
- **Dependency Injection:** Formatters registered, not hardcoded
- **Error Handling:** Try-catch with logging
- **Async/Await:** All file I/O non-blocking

---

### formatters.js - Format Renderers

**Classes: HTMLFormatter, JSONFormatter, MarkdownFormatter, CSVFormatter**

#### HTMLFormatter (300+ lines)

```javascript
class HTMLFormatter {
  async format(report, options)
    ├─ Builds DOCTYPE/head/styles
    ├─ Delegates section rendering
    └─ Returns complete HTML string

  _getStyles()
    └─ 200+ lines of CSS for layout, colors, print media

  Rendering Methods (one per section):
    ├─ _renderHeader(report)
    ├─ _renderExecutiveSummary(report)
    ├─ _renderInvestigation(report)
    ├─ _renderTechnologies(technologies)
    ├─ _renderScreenshots(screenshots)
    ├─ _renderNetwork(networkForensics)
    ├─ _renderContent(contentAnalysis)
    ├─ _renderTimeline(timeline)
    ├─ _renderEvidence(evidence)
    ├─ _renderRecommendations(recommendations)
    ├─ _renderChainOfCustody(chainOfCustody)
    ├─ _renderCompliance(compliance)
    └─ _renderFooter(report)

  Utility Methods:
    ├─ _escapeHtml(text) ← HTML entity encoding
    ├─ _renderTable(data) ← HTML tables
    ├─ _renderList(items) ← HTML lists
    └─ _renderRiskBadge(level) ← Styled risk indicators
}
```

#### JSONFormatter (150+ lines)

```javascript
class JSONFormatter {
  async format(report, options)
    ├─ Check options.minimal flag
    └─ Return JSON (minimal or detailed)

  _buildMinimalJson(report)
    └─ Only: id, title, generatedAt, sections summary

  _buildDetailedJson(report)
    └─ Complete: all fields, forensic data, metadata
}
```

#### MarkdownFormatter (200+ lines)

```javascript
class MarkdownFormatter {
  async format(report, options)
    ├─ Headers (# ## ###)
    ├─ Sections with markdown formatting
    └─ Return markdown string

  _renderHeading(level, text)
    └─ Returns # or ## or ### prefix

  _renderTable(data)
    └─ Pipe-delimited table format

  _renderCodeBlock(code)
    └─ Triple-backtick fenced code

  _renderList(items)
    └─ Bullet or numbered list
}
```

#### CSVFormatter (100+ lines)

```javascript
class CSVFormatter {
  async format(report, options)
    ├─ Tabulates sections
    ├─ Headers: "Key", "Value"
    └─ Return CSV rows

  _escapeCsv(text)
    └─ Quotes + comma handling
}
```

**Formatter Selection:**
```javascript
// In generator-core.js
const formatter = this.formatters.get(format); // 'html' | 'json' | 'markdown' | 'csv'
const output = await formatter.format(reportData, options);
```

---

### utilities.js - Helper Functions

**Function Categories:**

#### 1. Data Filtering (45 lines)
```javascript
function filterSensitiveData(data, filters)
  ├─ Accepts: string | Object | Array
  ├─ Patterns: email, phone, credit_card, ssn, api_key
  ├─ Recursively walks structure
  └─ Returns: redacted copy

const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  api_key: /[a-zA-Z0-9]{32,}/g
}
```

#### 2. Metrics & Analysis (80 lines)
```javascript
function calculateMetrics(reportData)
  └─ Returns: {wordCount, itemCount, sectionCount}

function estimatePageCount(content, format)
  └─ Returns: estimated page count

function getSectionStatus(reportData)
  └─ Returns: {complete, missing, empty}

function assessRisk(evidence)
  └─ Calculates risk score (0-100)

function validateEvidence(evidence)
  └─ Returns: {isValid, errors[]}
```

#### 3. Cryptography (15 lines)
```javascript
function hashReport(report)
  └─ SHA256 digest of stringified report
```

#### 4. Text Processing (80 lines)
```javascript
function escapeHtml(text)
  └─ &lt; &gt; &amp; &quot; conversion

function escapeCsv(text)
  └─ Quotes around fields with commas/quotes

function formatBytes(bytes)
  └─ "1.5 MB" from 1536000

function truncateText(text, length, suffix)
  └─ Shortens with ellipsis handling

function formatTimestamp(timestamp, format)
  └─ Multiple format options (locale, ISO, etc.)
```

#### 5. Data Transformation (70 lines)
```javascript
function extractUniqueDomains(urls)
  └─ Set of unique domains from URL array

function groupByCategory(items, categoryKey)
  └─ Object: {category → items[]}

function countByProperty(items, propertyKey)
  └─ Object: {value → count}

function sortByMultiple(items, keys)
  └─ Multi-key sorting
```

**Utility Complexity:**
- Average function: 30-50 lines
- Total exports: 18 functions + 1 constant object
- Reusability: Medium-to-High across modules

---

## Data Flow Diagrams

### Evidence → Report Generation Path

```
Evidence Package
├─ metadata {investigator, caseNumber, ...}
├─ content {html, text, ...}
├─ screenshots [{url, data, timestamp, ...}]
├─ networkForensics {har, requests, ...}
├─ technologies [{name, version, ...}]
└─ findings [{type, severity, details, ...}]
       ↓
[Report Building]
├─ Executive Summary (overview, risk assessment)
├─ Investigation Details (methodology, scope)
├─ Forensic Data (technologies, network, screenshots)
├─ Content Analysis (text extraction, link analysis)
├─ Timeline (event sequence)
├─ Evidence Items (collected artifacts)
└─ Recommendations (remediation, follow-up)
       ↓
[Report Object]
{
  id, title, generatedAt,
  metadata {}, executiveSummary {},
  sections { evidence, timeline, technologies, ... },
  chainOfCustody {}, compliance {}
}
       ↓
[Format Selection]
├─ HTML → Full visual report with styling
├─ JSON → Machine-readable structured data
├─ Markdown → Document-compatible text
└─ CSV → Spreadsheet-friendly tabular
       ↓
[Output String]
[Save to Disk]
↓
[Metadata Return]
{
  path, format, metrics,
  integrity (SHA256),
  generationTime
}
```

---

## Module Communication Patterns

### Pattern 1: Dependency Injection

**In generator-core.js:**
```javascript
class ReportGenerator {
  constructor(options = {}) {
    this.formatters = new Map();
    this._registerFormatters(); // Populates map
  }

  _registerFormatters() {
    this.formatters.set('html', new HTMLFormatter(...));
    this.formatters.set('json', new JSONFormatter());
    // ...
  }
}
```

**Benefits:**
- ✅ Formatters decoupled from core
- ✅ Easy to swap/mock for testing
- ✅ Can extend with new formatters without modifying core

---

### Pattern 2: Utility Delegation

**In generator-core.js:**
```javascript
// Core delegates to utilities
this._filterSensitiveData(reportData, filters) {
  if (options.sensitiveDataFilter && options.sensitiveDataFilter.length > 0) {
    return filterSensitiveData(reportData, options.sensitiveDataFilter);
  }
}
```

**Benefits:**
- ✅ Separation of concerns
- ✅ Utilities testable independently
- ✅ Shared utility reuse

---

### Pattern 3: Re-export Layer

**In report-generator.js:**
```javascript
// Public API aggregates all modules
module.exports = {
  ReportGenerator,                // from generator-core
  HTMLFormatter, JSONFormatter,   // from formatters
  ...utils                        // from utilities
};
```

**Benefits:**
- ✅ Single import point
- ✅ Backward compatible
- ✅ Clear public interface

---

## Sequence Diagram: Minimal Flow

```
External Code
  │
  ├─→ require('./reporting')
  │    Returns: {ReportGenerator, ...formatters, ...utils}
  │
  ├─→ new ReportGenerator(options)
  │    • generator-core.js initialized
  │    • Formatters registered (HTML, JSON, MD, CSV)
  │    • Report directory ensured
  │
  ├─→ generateReport(evidence, {format: 'html'})
  │    • Validates evidence
  │    • Calls utilities.validateEvidence()
  │    • Builds structure (_buildReportStructure)
  │    • Optionally filters with utilities.filterSensitiveData()
  │    • Gets formatter: this.formatters.get('html')
  │    • Calls formatter.format(reportData)
  │    • HTMLFormatter renders all sections
  │    • Calls utilities.calculateMetrics(reportData)
  │    • Calls utilities.hashReport(reportData)
  │    • Calls saveReport(reportData, filename, 'html')
  │    • fs.writeFileSync() writes HTML file
  │
  └─→ Returns {path, format, metrics, integrity, generationTime}
```

---

## Scalability Considerations

### Current Approach (v2.0.0)

**Strengths:**
- ✅ Modular & testable
- ✅ Easy to add new formatters
- ✅ Utilities reusable across projects
- ✅ Low coupling

**Potential Bottlenecks:**
- Large reports built entirely in memory
- No streaming for very large evidence packages
- Formatters don't support incremental rendering

### Future Optimization (v2.1.0+)

```
Potential improvements:
├─ Stream large reports to disk (formatters support .write())
├─ Lazy-load formatters on demand
├─ Cache compiled templates
├─ Parallel section building (Promise.all)
├─ Compress output (gzip on save)
└─ Incremental report generation
```

---

## Testing Architecture

### Unit Testing Pattern

```javascript
// Test utilities independently
const { filterSensitiveData } = require('./utilities');
test('filterSensitiveData redacts emails', () => {
  const data = 'Contact: john@example.com';
  const result = filterSensitiveData(data, ['email']);
  expect(result).toContain('[REDACTED]');
});

// Test formatters independently
const { HTMLFormatter } = require('./formatters');
test('HTMLFormatter escapes HTML', () => {
  const formatter = new HTMLFormatter();
  const result = formatter._escapeHtml('<script>');
  expect(result).toBe('&lt;script&gt;');
});

// Test core without formatters
const { ReportGenerator } = require('./generator-core');
test('ReportGenerator validates evidence', async () => {
  const gen = new ReportGenerator();
  await expect(gen.generateReport(null)).rejects.toThrow();
});
```

### Integration Testing Pattern

```javascript
// Test full flow
test('Full report generation flow', async () => {
  const gen = new ReportGenerator({
    reportDir: '/tmp/test-reports'
  });

  const evidence = {...};
  const result = await gen.generateReport(evidence, {
    format: 'html',
    sensitiveDataFilter: ['email']
  });

  expect(result.path).toBeDefined();
  expect(fs.existsSync(result.path)).toBe(true);
  expect(result.format).toBe('html');
});
```

---

## Summary

The refactored architecture provides:

✅ **Clear Separation of Concerns**
- Core orchestration isolated in generator-core.js
- Formatters independent and pluggable
- Utilities reusable across codebase

✅ **Maintainability**
- Single responsibility per module
- Reduced cognitive load per file
- Clear dependency flow

✅ **Extensibility**
- Easy to add new formatters
- Utilities can extend without modifying core
- Plugin-style architecture

✅ **Testability**
- Each module independently testable
- Mock-friendly patterns
- No circular dependencies

✅ **Backward Compatibility**
- All original exports preserved
- Existing code works unchanged
- Progressive migration path
