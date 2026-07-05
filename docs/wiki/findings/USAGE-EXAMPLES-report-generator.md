# Report Generator Usage Examples

**Document:** Practical Usage Patterns and Examples  
**Date:** 2026-06-22  
**Version:** 2.0.0  

---

## Quick Start

### Basic Report Generation

```javascript
const { ReportGenerator } = require('./reporting');

// Create generator
const gen = new ReportGenerator({
  reportDir: './reports',
  companyName: 'My Investigation Team',
  toolVersion: '2.0.0'
});

// Generate HTML report
const result = await gen.generateReport(evidencePackage, {
  title: 'Website Investigation Report',
  format: 'html',
  includeScreenshots: true,
  includeNetworkCapture: true
});

console.log(`Report saved: ${result.path}`);
console.log(`Format: ${result.format}`);
console.log(`Word count: ${result.metrics.wordCount}`);
```

---

## Module Import Patterns

### Pattern 1: Import All from Main Index

```javascript
// Recommended for simple cases
const reporting = require('./reporting');

const gen = new reporting.ReportGenerator();
const { filterSensitiveData } = reporting;
```

**Pros:**
- Single import statement
- Discover available exports in IDE
- Backward compatible

**Cons:**
- Slightly slower (imports all modules)

---

### Pattern 2: Direct Module Imports

```javascript
// Recommended for production code
const { ReportGenerator } = require('./reporting/generator-core');
const { HTMLFormatter, JSONFormatter } = require('./reporting/formatters');
const { filterSensitiveData, validateEvidence } = require('./reporting/utilities');

// Only imports what's needed
const gen = new ReportGenerator();
const formatter = new HTMLFormatter();
```

**Pros:**
- Explicit dependencies
- Faster module loading
- Clear what each part does

**Cons:**
- Multiple import statements
- Requires knowledge of module structure

---

### Pattern 3: Selective Re-exports

```javascript
// Recommended for libraries/frameworks
const { ReportGenerator, ...allExports } = require('./reporting');

// Export custom subset
module.exports = {
  ReportGenerator,
  generateReport: async (evidence, options) => {
    const gen = new ReportGenerator();
    return gen.generateReport(evidence, options);
  }
};
```

---

## Common Use Cases

### Use Case 1: HTML Report for Management Review

```javascript
const { ReportGenerator } = require('./reporting');

async function generateManagementReport(evidence) {
  const gen = new ReportGenerator({
    companyName: 'Security Team',
    reportDir: './reports/management'
  });

  const result = await gen.generateReport(evidence, {
    title: 'Security Investigation Summary',
    format: 'html',
    includeScreenshots: true,
    includeNetworkCapture: true,
    includeRecommendations: true,
    
    // Hide sensitive details
    sensitiveDataFilter: ['email', 'phone', 'credit_card']
  });

  return result.path; // Ready to email or archive
}
```

---

### Use Case 2: JSON for Machine Processing

```javascript
const { ReportGenerator } = require('./reporting');

async function generateStructuredReport(evidence) {
  const gen = new ReportGenerator();

  const result = await gen.generateReport(evidence, {
    title: 'Forensic Investigation Data',
    format: 'json'
  });

  // Read and parse JSON
  const fs = require('fs');
  const reportData = JSON.parse(fs.readFileSync(result.path, 'utf8'));

  // Process programmatically
  const riskLevel = reportData.executiveSummary.riskAssessment.level;
  const evidenceCount = reportData.sections.evidence.items.length;

  return {
    riskLevel,
    evidenceCount,
    filePath: result.path
  };
}
```

---

### Use Case 3: Markdown for Documentation

```javascript
const { ReportGenerator } = require('./reporting');

async function generateDocumentationReport(evidence) {
  const gen = new ReportGenerator({
    reportDir: './docs/investigations'
  });

  const result = await gen.generateReport(evidence, {
    title: 'Investigation Documentation',
    format: 'markdown',
    includeTimeline: true,
    includeRecommendations: true
  });

  // Can be embedded in wikis, markdown parsers, etc.
  return result.path;
}
```

---

### Use Case 4: CSV for Spreadsheet Analysis

```javascript
const { ReportGenerator } = require('./reporting');

async function generateSpreadsheetReport(evidence) {
  const gen = new ReportGenerator();

  const result = await gen.generateReport(evidence, {
    title: 'Evidence Summary',
    format: 'csv'
  });

  // Import into Excel, Google Sheets, etc.
  return result.path;
}
```

---

## Utility Function Examples

### Filtering Sensitive Data

```javascript
const { filterSensitiveData } = require('./reporting/utilities');

// Example 1: Filter from string
const text = 'Call John at 555-123-4567 or jane@example.com';
const filtered = filterSensitiveData(text, ['phone', 'email']);
// Result: "Call John at [REDACTED] or [REDACTED]"

// Example 2: Filter from objects
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-123-4567',
  ssn: '123-45-6789'
};

const safeData = filterSensitiveData(userData, [
  'email',
  'phone',
  'ssn'
]);
// Result: {
//   name: 'John Doe',
//   email: '[REDACTED]',
//   phone: '[REDACTED]',
//   ssn: '[REDACTED]'
// }

// Example 3: Filter nested structures
const complexData = {
  users: [
    { name: 'Alice', email: 'alice@example.com', id: 1 },
    { name: 'Bob', email: 'bob@example.com', id: 2 }
  ],
  contacts: {
    support: 'support@example.com',
    admin: 'admin@example.com'
  }
};

const filtered = filterSensitiveData(complexData, ['email']);
// All emails replaced with [REDACTED] recursively
```

---

### Validating Evidence

```javascript
const { validateEvidence } = require('./reporting/utilities');

// Example 1: Valid evidence
const validEvidence = {
  metadata: { investigator: 'Alice' },
  findings: [],
  technologies: [],
  content: { text: 'Sample content' }
};

const result = validateEvidence(validEvidence);
// Result: { isValid: true, errors: [] }

// Example 2: Invalid evidence
const invalidEvidence = {
  metadata: null,  // Error!
  findings: 'not-an-array'  // Error!
};

const result = validateEvidence(invalidEvidence);
// Result: {
//   isValid: false,
//   errors: [
//     'metadata must be an object',
//     'findings must be an array'
//   ]
// }
```

---

### Calculating Report Metrics

```javascript
const { calculateMetrics } = require('./reporting/utilities');

const reportData = {
  title: 'Investigation Report',
  sections: {
    summary: 'This is a detailed investigation of the incident...',
    findings: [
      { type: 'vulnerability', severity: 'high' },
      { type: 'misconfiguration', severity: 'medium' }
    ]
  }
};

const metrics = calculateMetrics(reportData);
// Result: {
//   wordCount: 15,
//   itemCount: 2,
//   sectionCount: 2
// }
```

---

### Assessing Risk Level

```javascript
const { assessRisk } = require('./reporting/utilities');

const evidence = {
  findings: [
    { type: 'vulnerability', severity: 'critical', count: 2 },
    { type: 'vulnerability', severity: 'high', count: 5 },
    { type: 'misconfiguration', severity: 'medium', count: 3 }
  ],
  technologies: [
    { name: 'outdated-framework', isVulnerable: true }
  ]
};

const riskAssessment = assessRisk(evidence);
// Result: {
//   level: 'HIGH',        // CRITICAL, HIGH, MEDIUM, LOW
//   score: 78,            // 0-100
//   factors: {
//     criticalFindings: 2,
//     highFindings: 5,
//     vulnerableComponents: 1
//   }
// }
```

---

### Extracting Unique Domains

```javascript
const { extractUniqueDomains } = require('./reporting/utilities');

const urls = [
  'https://example.com/page1',
  'https://example.com/page2',
  'https://other.com/resource',
  'https://sub.example.com/api',
  'http://example.com/app'
];

const domains = extractUniqueDomains(urls);
// Result: ['example.com', 'sub.example.com', 'other.com']
```

---

### Grouping Data by Category

```javascript
const { groupByCategory } = require('./reporting/utilities');

const findings = [
  { type: 'vulnerability', severity: 'critical' },
  { type: 'misconfiguration', severity: 'high' },
  { type: 'vulnerability', severity: 'high' },
  { type: 'missingheader', severity: 'medium' },
  { type: 'vulnerability', severity: 'medium' }
];

const grouped = groupByCategory(findings, 'type');
// Result: {
//   vulnerability: [{...}, {...}, {...}],
//   misconfiguration: [{...}],
//   missingheader: [{...}]
// }
```

---

### Formatting Timestamps

```javascript
const { formatTimestamp } = require('./reporting/utilities');

const timestamp = 1687968000000; // Some date in milliseconds

// Locale-specific format
formatTimestamp(timestamp, 'locale');
// Result: "6/28/2023, 2:00:00 PM"

// ISO format
formatTimestamp(timestamp, 'iso');
// Result: "2023-06-28T14:00:00.000Z"

// Custom date-only format
formatTimestamp(timestamp, 'date');
// Result: "2023-06-28"
```

---

### Escaping HTML

```javascript
const { escapeHtml } = require('./reporting/utilities');

const dangerous = '<script>alert("XSS")</script>';
const safe = escapeHtml(dangerous);
// Result: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"

// Safe to use in HTML context
const html = `<p>${safe}</p>`;
// Renders as plain text, not executable
```

---

### Formatting Bytes

```javascript
const { formatBytes } = require('./reporting/utilities');

formatBytes(1024);              // "1.0 KB"
formatBytes(1536000);           // "1.5 MB"
formatBytes(1073741824);        // "1.0 GB"
formatBytes(1099511627776);     // "1.0 TB"
formatBytes(512);               // "512 B"
```

---

## Advanced Patterns

### Pattern 1: Custom Report Class

```javascript
const { ReportGenerator } = require('./reporting/generator-core');
const { filterSensitiveData, validateEvidence } = require('./reporting/utilities');

class CustomReportGenerator extends ReportGenerator {
  async generateSecureReport(evidence, options = {}) {
    // Validate first
    const validation = validateEvidence(evidence);
    if (!validation.isValid) {
      throw new Error(`Invalid evidence: ${validation.errors.join(', ')}`);
    }

    // Always filter sensitive data
    const filteredEvidence = filterSensitiveData(evidence, [
      'email',
      'phone',
      'credit_card',
      'ssn'
    ]);

    // Generate with enforced options
    return this.generateReport(filteredEvidence, {
      ...options,
      sensitiveDataFilter: ['api_key'] // Additional filtering
    });
  }
}

// Usage
const generator = new CustomReportGenerator();
const report = await generator.generateSecureReport(evidence);
```

---

### Pattern 2: Batch Report Generation

```javascript
const { ReportGenerator } = require('./reporting');

async function generateBatchReports(evidenceList, options = {}) {
  const gen = new ReportGenerator(options);
  const results = [];

  for (const evidence of evidenceList) {
    try {
      const result = await gen.generateReport(evidence, {
        format: 'html',
        title: evidence.metadata?.title || 'Untitled Report'
      });

      results.push({
        success: true,
        path: result.path,
        metrics: result.metrics
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Usage
const evidence1 = { /* ... */ };
const evidence2 = { /* ... */ };
const results = await generateBatchReports([evidence1, evidence2]);
```

---

### Pattern 3: Multi-Format Export

```javascript
const { ReportGenerator } = require('./reporting');

async function generateAllFormats(evidence, baseFilename) {
  const gen = new ReportGenerator();
  const formats = ['html', 'json', 'markdown', 'csv'];
  const results = {};

  for (const format of formats) {
    const result = await gen.generateReport(evidence, {
      format,
      title: evidence.metadata?.title || 'Report'
    });

    results[format] = result.path;
  }

  return results;
}

// Usage
const allFormats = await generateAllFormats(evidence, 'investigation');
console.log('HTML Report:', allFormats.html);
console.log('JSON Data:', allFormats.json);
console.log('Markdown:', allFormats.markdown);
console.log('CSV:', allFormats.csv);
```

---

### Pattern 4: Report Verification

```javascript
const { ReportGenerator } = require('./reporting');
const { hashReport } = require('./reporting/utilities');
const fs = require('fs');

async function generateVerifiableReport(evidence) {
  const gen = new ReportGenerator();

  // Generate report
  const result = await gen.generateReport(evidence, {
    format: 'json'
  });

  // Read report
  const reportContent = fs.readFileSync(result.path, 'utf8');
  const reportData = JSON.parse(reportContent);

  // Calculate hash
  const hash = hashReport(reportData);

  // Save hash alongside report
  fs.writeFileSync(
    result.path + '.sha256',
    hash,
    'utf8'
  );

  return {
    reportPath: result.path,
    hashPath: result.path + '.sha256',
    hash: hash,
    metrics: result.metrics
  };
}

// Usage
const verified = await generateVerifiableReport(evidence);
console.log('Report saved with hash:', verified.hash);
```

---

## Error Handling

### Basic Error Handling

```javascript
const { ReportGenerator } = require('./reporting');

async function safeGenerateReport(evidence) {
  const gen = new ReportGenerator();

  try {
    const result = await gen.generateReport(evidence, {
      format: 'html'
    });
    return { success: true, data: result };
  } catch (error) {
    if (error.message.includes('Unsupported format')) {
      return { success: false, error: 'Invalid report format' };
    } else if (error.message.includes('Evidence package')) {
      return { success: false, error: 'Missing or invalid evidence' };
    } else {
      return { success: false, error: error.message };
    }
  }
}
```

---

### Validation Before Generation

```javascript
const { validateEvidence } = require('./reporting/utilities');
const { ReportGenerator } = require('./reporting');

async function generateWithValidation(evidence, options = {}) {
  // Validate evidence structure
  const validation = validateEvidence(evidence);

  if (!validation.isValid) {
    throw new Error(
      `Evidence validation failed:\n${validation.errors.join('\n')}`
    );
  }

  // Proceed with generation
  const gen = new ReportGenerator();
  return gen.generateReport(evidence, options);
}
```

---

## Performance Considerations

### Handling Large Evidence Packages

```javascript
const { ReportGenerator, filterSensitiveData } = require('./reporting');

async function generateLargeReport(evidence, options = {}) {
  const gen = new ReportGenerator({
    // Create reports in temp directory
    reportDir: require('os').tmpdir() + '/reports'
  });

  // Filter before generating (reduces memory)
  const filtered = filterSensitiveData(evidence, [
    'email',
    'phone',
    'credit_card'
  ]);

  // Use JSON format (usually smaller than HTML)
  const result = await gen.generateReport(filtered, {
    format: 'json',
    ...options
  });

  return result;
}
```

---

### Measuring Performance

```javascript
const { ReportGenerator } = require('./reporting');

async function measureReportGeneration(evidence) {
  const gen = new ReportGenerator();

  const startTime = Date.now();

  const result = await gen.generateReport(evidence, {
    format: 'html'
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  return {
    path: result.path,
    durationMs: duration,
    durationSec: (duration / 1000).toFixed(2),
    metrics: result.metrics,
    throughput: (result.metrics.wordCount / duration * 1000).toFixed(0) + ' words/sec'
  };
}
```

---

## Summary

### Key Takeaways

| Task | Use This | Example |
|------|----------|---------|
| Basic report | `ReportGenerator.generateReport()` | HTML, JSON exports |
| Data privacy | `filterSensitiveData()` | Remove emails, SSNs |
| Data validation | `validateEvidence()` | Check structure |
| Analysis | `assessRisk()`, `calculateMetrics()` | Risk scoring |
| Utilities | Individual functions | Domain extraction, formatting |

### Recommended Patterns

1. **For Simple Cases:** Use main index import
2. **For Production:** Use direct module imports
3. **For Libraries:** Create wrapper functions
4. **For Batch Operations:** Use async loops
5. **For Safety:** Always validate input first

### Testing Tips

- Test utilities independently
- Mock formatters for core tests
- Verify file I/O separately
- Use temporary directories for integration tests
- Check sensitive data filtering thoroughly
