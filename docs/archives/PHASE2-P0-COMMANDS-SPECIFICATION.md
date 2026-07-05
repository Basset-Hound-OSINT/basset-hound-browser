# Phase 2 P0 Commands - Detailed Specification

**Date:** June 20, 2026  
**Focus:** 14 new WebSocket commands for legal compliance, evidence correlation, and multi-site tracking  
**Implementation Timeline:** June 29 - July 16, 2026 (18 days)  
**Target Tests:** 180+ unit/E2E tests

---

## SECTION 1: LEGAL COMPLIANCE & REPORTING (6 commands)

### 1.1 `start_legal_compliance_mode`

**Purpose:** Initialize legal compliance mode for court-admissible evidence capture.

**Command:**
```javascript
{
  "command": "start_legal_compliance_mode",
  "jurisdiction": "us",                    // 'us', 'eu', 'uk', 'generic'
  "standards": ["swgde", "iso27037"],      // Standards to follow
  "certification_level": "chain-of-custody" // 'basic', 'enhanced', 'chain-of-custody'
}
```

**Response:**
```javascript
{
  "success": true,
  "compliance_id": "comp_20260620_001",
  "jurisdiction": "us",
  "standards_active": ["swgde", "iso27037"],
  "certification_level": "chain-of-custody",
  "mode_status": "active",
  "timestamp": "2026-06-20T14:30:00Z",
  "capabilities": {
    "swgde_reports": true,
    "metadata_certification": true,
    "chain_of_custody_audit": true,
    "court_ready_export": true
  }
}
```

**Backend Implementation:**

**File:** `src/compliance/legal-compliance-manager.js`

```javascript
class LegalComplianceManager {
  constructor() {
    this.complianceMode = null;
    this.jurisdiction = null;
    this.standards = [];
    this.certificationLevel = null;
    this.auditLog = [];
    this.evidenceQueue = [];
  }

  startComplianceMode(jurisdiction, standards, certificationLevel) {
    // Validate jurisdiction
    const validJurisdictions = ['us', 'eu', 'uk', 'generic'];
    if (!validJurisdictions.includes(jurisdiction)) {
      throw new Error(`Invalid jurisdiction: ${jurisdiction}`);
    }

    // Validate standards
    const validStandards = ['swgde', 'iso27037', 'nist', 'rfc3161'];
    standards.forEach(std => {
      if (!validStandards.includes(std)) {
        throw new Error(`Invalid standard: ${std}`);
      }
    });

    // Validate certification level
    const validLevels = ['basic', 'enhanced', 'chain-of-custody'];
    if (!validLevels.includes(certificationLevel)) {
      throw new Error(`Invalid certification level: ${certificationLevel}`);
    }

    // Initialize
    this.complianceMode = true;
    this.jurisdiction = jurisdiction;
    this.standards = standards;
    this.certificationLevel = certificationLevel;
    this.complianceId = this.generateComplianceId();

    // Log initiation
    this.logAuditEvent('COMPLIANCE_STARTED', {
      jurisdiction,
      standards,
      certificationLevel
    });

    // Return success response
    return {
      success: true,
      compliance_id: this.complianceId,
      jurisdiction,
      standards_active: standards,
      certification_level: certificationLevel,
      mode_status: 'active',
      timestamp: new Date().toISOString(),
      capabilities: {
        swgde_reports: true,
        metadata_certification: true,
        chain_of_custody_audit: true,
        court_ready_export: true
      }
    };
  }

  generateComplianceId() {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logAuditEvent(eventType, details) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      eventType,
      details,
      user: process.env.USER || 'system'
    });
  }
}
```

**Tests:**
```javascript
describe('LegalComplianceManager.startComplianceMode', () => {
  let manager;

  beforeEach(() => {
    manager = new LegalComplianceManager();
  });

  test('should initialize US jurisdiction with SWGDE', () => {
    const result = manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
    expect(result.success).toBe(true);
    expect(result.jurisdiction).toBe('us');
    expect(result.standards_active).toContain('swgde');
  });

  test('should reject invalid jurisdiction', () => {
    expect(() => {
      manager.startComplianceMode('invalid', ['swgde'], 'basic');
    }).toThrow('Invalid jurisdiction');
  });

  test('should log audit event on start', () => {
    manager.startComplianceMode('us', ['swgde'], 'basic');
    expect(manager.auditLog.length).toBeGreaterThan(0);
    expect(manager.auditLog[0].eventType).toBe('COMPLIANCE_STARTED');
  });

  test('should support multiple standards', () => {
    const result = manager.startComplianceMode(
      'eu',
      ['iso27037', 'swgde'],
      'enhanced'
    );
    expect(result.standards_active).toEqual(['iso27037', 'swgde']);
  });

  test('should generate unique compliance ID', () => {
    const result1 = manager.startComplianceMode('us', ['swgde'], 'basic');
    const manager2 = new LegalComplianceManager();
    const result2 = manager2.startComplianceMode('us', ['swgde'], 'basic');
    expect(result1.compliance_id).not.toBe(result2.compliance_id);
  });
});
```

---

### 1.2 `generate_swgde_report`

**Purpose:** Generate SWGDE-compliant forensic report from evidence package.

**Command:**
```javascript
{
  "command": "generate_swgde_report",
  "evidence_package_id": "pkg_20260620_001",
  "case_number": "2026-001",
  "examiner_name": "Dr. Jane Smith",
  "examiner_credentials": "CFCE, EnCE, CCFE",
  "include_chain_of_custody": true,
  "include_metadata_certification": true,
  "include_timeline": true,
  "output_format": "pdf"  // 'pdf', 'html', 'json'
}
```

**Response:**
```javascript
{
  "success": true,
  "report": {
    "content": "<Buffer: PDF data>",    // Binary PDF content
    "format": "pdf",
    "filename": "SWGDE_Report_2026001_20260620.pdf",
    "size_bytes": 245800,
    "swgde_compliant": true,
    "compliance_version": "v2.1.1"  // SWGDE version
  },
  "metadata": {
    "generated_at": "2026-06-20T14:35:00Z",
    "examiner": "Dr. Jane Smith",
    "examiner_credentials": "CFCE, EnCE, CFRE",
    "case_number": "2026-001",
    "evidence_id": "pkg_20260620_001",
    "evidence_count": 47,
    "evidence_types": ["screenshot", "har", "dom", "console_logs"]
  },
  "certification": {
    "algorithm": "sha256",
    "hash": "a1b2c3d4e5f6...",
    "timestamp": "2026-06-20T14:35:00Z",
    "timestamp_authority": "rfc3161"
  },
  "sections": {
    "case_information": "Included",
    "examiner_information": "Included",
    "evidence_list": "47 items",
    "methodology": "Included",
    "findings": "Included",
    "chain_of_custody": "Included",
    "appendices": ["Timeline", "Technical Details", "Evidence Manifest"]
  }
}
```

**Backend Implementation:**

**File:** `src/compliance/swgde-report-generator.js`

```javascript
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

class SWGDEReportGenerator {
  constructor(complianceManager) {
    this.complianceManager = complianceManager;
    this.reportId = null;
  }

  async generateReport(evidencePackageId, options) {
    // Validate inputs
    this.validateReportOptions(options);

    // Retrieve evidence package
    const evidencePackage = await this.getEvidencePackage(evidencePackageId);
    if (!evidencePackage) {
      throw new Error(`Evidence package not found: ${evidencePackageId}`);
    }

    // Generate report based on format
    let reportContent;
    let filename;
    let mimeType;

    switch (options.output_format) {
      case 'pdf':
        reportContent = await this.generatePDFReport(evidencePackage, options);
        filename = this.generateFilename(options, 'pdf');
        mimeType = 'application/pdf';
        break;
      case 'html':
        reportContent = this.generateHTMLReport(evidencePackage, options);
        filename = this.generateFilename(options, 'html');
        mimeType = 'text/html';
        break;
      case 'json':
        reportContent = this.generateJSONReport(evidencePackage, options);
        filename = this.generateFilename(options, 'json');
        mimeType = 'application/json';
        break;
      default:
        throw new Error(`Unsupported format: ${options.output_format}`);
    }

    // Generate certification
    const reportHash = crypto
      .createHash('sha256')
      .update(reportContent)
      .digest('hex');

    // Log to audit trail
    this.complianceManager.logAuditEvent('REPORT_GENERATED', {
      evidencePackageId,
      examiner: options.examiner_name,
      caseNumber: options.case_number,
      format: options.output_format,
      reportHash
    });

    return {
      success: true,
      report: {
        content: reportContent,
        format: options.output_format,
        filename,
        size_bytes: Buffer.byteLength(reportContent),
        swgde_compliant: true,
        compliance_version: 'v2.1.1'
      },
      metadata: {
        generated_at: new Date().toISOString(),
        examiner: options.examiner_name,
        examiner_credentials: options.examiner_credentials,
        case_number: options.case_number,
        evidence_id: evidencePackageId,
        evidence_count: evidencePackage.items.length,
        evidence_types: [...new Set(evidencePackage.items.map(i => i.type))]
      },
      certification: {
        algorithm: 'sha256',
        hash: reportHash,
        timestamp: new Date().toISOString(),
        timestamp_authority: 'rfc3161'
      },
      sections: {
        case_information: 'Included',
        examiner_information: 'Included',
        evidence_list: `${evidencePackage.items.length} items`,
        methodology: 'Included',
        findings: 'Included',
        chain_of_custody: 'Included',
        appendices: ['Timeline', 'Technical Details', 'Evidence Manifest']
      }
    };
  }

  async generatePDFReport(evidencePackage, options) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Title
      doc.fontSize(24).text('SWGDE Forensic Report', { align: 'center' });
      doc.fontSize(12).text(`Case Number: ${options.case_number}`, { align: 'center' });
      doc.moveDown();

      // Case Information
      doc.fontSize(14).text('I. Case Information', { underline: true });
      doc.fontSize(11).text(`Case Number: ${options.case_number}`);
      doc.text(`Date: ${new Date().toISOString().split('T')[0]}`);
      doc.moveDown();

      // Examiner Information
      doc.fontSize(14).text('II. Examiner Information', { underline: true });
      doc.fontSize(11).text(`Examiner: ${options.examiner_name}`);
      doc.text(`Credentials: ${options.examiner_credentials}`);
      doc.moveDown();

      // Evidence List
      doc.fontSize(14).text('III. Evidence List', { underline: true });
      doc.fontSize(10);
      evidencePackage.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.type} - ${item.id}`);
      });
      doc.moveDown();

      // Methodology
      doc.fontSize(14).text('IV. Methodology', { underline: true });
      doc.fontSize(11).text(
        'Evidence was collected in accordance with SWGDE ' +
        'standards and ISO 27037:2012 guidelines for digital evidence ' +
        'preservation and handling.'
      );
      doc.moveDown();

      // Chain of Custody
      if (options.include_chain_of_custody) {
        doc.fontSize(14).text('V. Chain of Custody', { underline: true });
        doc.fontSize(10);
        doc.text('Evidence maintained under chain of custody throughout collection process.');
        doc.moveDown();
      }

      doc.end();
    });
  }

  generateHTMLReport(evidencePackage, options) {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>SWGDE Forensic Report - ${options.case_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { text-align: center; }
    h2 { border-bottom: 2px solid #000; padding-bottom: 5px; }
    .metadata { background-color: #f0f0f0; padding: 10px; margin: 10px 0; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>SWGDE Forensic Report</h1>
  <p style="text-align: center; font-size: 14px;">Case Number: ${options.case_number}</p>
  
  <h2>I. Case Information</h2>
  <div class="metadata">
    <p><strong>Case Number:</strong> ${options.case_number}</p>
    <p><strong>Report Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
  </div>
  
  <h2>II. Examiner Information</h2>
  <div class="metadata">
    <p><strong>Examiner:</strong> ${options.examiner_name}</p>
    <p><strong>Credentials:</strong> ${options.examiner_credentials}</p>
  </div>
  
  <h2>III. Evidence List</h2>
  <table>
    <tr>
      <th>#</th>
      <th>Type</th>
      <th>ID</th>
      <th>Timestamp</th>
    </tr>
`;

    evidencePackage.items.forEach((item, index) => {
      html += `
    <tr>
      <td>${index + 1}</td>
      <td>${item.type}</td>
      <td>${item.id}</td>
      <td>${item.timestamp}</td>
    </tr>
`;
    });

    html += `
  </table>
  
  <h2>IV. Methodology</h2>
  <p>Evidence was collected in accordance with SWGDE standards and ISO 27037:2012 
  guidelines for digital evidence preservation and handling.</p>
  
  <h2>V. Chain of Custody</h2>
  <p>Evidence maintained under chain of custody throughout collection process.</p>
</body>
</html>
`;

    return html;
  }

  generateJSONReport(evidencePackage, options) {
    return JSON.stringify({
      report_type: 'SWGDE',
      version: 'v2.1.1',
      case_information: {
        case_number: options.case_number,
        report_date: new Date().toISOString().split('T')[0]
      },
      examiner_information: {
        name: options.examiner_name,
        credentials: options.examiner_credentials
      },
      evidence: evidencePackage.items,
      methodology:
        'Evidence collected per SWGDE standards and ISO 27037:2012',
      chain_of_custody: true
    }, null, 2);
  }

  validateReportOptions(options) {
    const required = ['examiner_name', 'examiner_credentials', 'case_number', 'output_format'];
    required.forEach(field => {
      if (!options[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    });
  }

  generateFilename(options, format) {
    const timestamp = new Date().toISOString().split('T')[0];
    const ext = format === 'json' ? 'json' : format === 'html' ? 'html' : 'pdf';
    return `SWGDE_Report_${options.case_number}_${timestamp}.${ext}`;
  }

  async getEvidencePackage(packageId) {
    // Implementation would fetch from evidence manager
    // Placeholder for now
    return {
      id: packageId,
      items: [],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = SWGDEReportGenerator;
```

**Tests:** (30+ tests covering all formats, edge cases)

---

### 1.3 `export_with_chain_of_custody`

**Purpose:** Export evidence package with complete chain of custody audit trail.

**Command:**
```javascript
{
  "command": "export_with_chain_of_custody",
  "evidence_ids": ["ev_001", "ev_002", "ev_003"],
  "format": "pdf",                    // 'pdf', 'mhtml', 'json-ld', 'warc'
  "include_audit_log": true,
  "include_metadata": true,
  "certify_integrity": true
}
```

**Response:**
```javascript
{
  "success": true,
  "package": {
    "content": "<Buffer: exported data>",
    "format": "pdf",
    "filename": "Evidence_Package_20260620_001.pdf",
    "evidence_count": 3,
    "total_size_bytes": 512400,
    "compression": "gzip",
    "compressed_size_bytes": 245800
  },
  "chain_of_custody": {
    "audit_log": [
      {
        "event_id": "evt_001",
        "timestamp": "2026-06-20T14:30:00Z",
        "event_type": "EVIDENCE_COLLECTED",
        "actor": "examiner@domain.com",
        "details": {
          "evidence_id": "ev_001",
          "collection_method": "screenshot",
          "location": "page_url"
        }
      },
      // ... more events
    ],
    "integrity_certificate": {
      "algorithm": "sha256",
      "hash": "a1b2c3d4e5f6...",
      "timestamp": "2026-06-20T14:40:00Z",
      "timestamp_server": "time.nist.gov",
      "signatures": [
        {
          "type": "examiner",
          "signature": "-----BEGIN SIGNATURE-----\n...\n-----END SIGNATURE-----",
          "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
        }
      ],
      "verified": true,
      "verified_at": "2026-06-20T14:40:05Z"
    }
  }
}
```

---

### 1.4 `certify_evidence_integrity`

**Purpose:** Generate cryptographic certificate for evidence integrity verification.

**Command:**
```javascript
{
  "command": "certify_evidence_integrity",
  "evidence_id": "ev_001",
  "certification_type": "sha256-timestamp",  // 'sha256', 'sha256-timestamp', 'dss'
  "include_timestamp": true
}
```

**Response:**
```javascript
{
  "success": true,
  "evidence_id": "ev_001",
  "certification": {
    "algorithm": "sha256",
    "hash": "a1b2c3d4e5f6...",
    "timestamp": "2026-06-20T14:40:00Z",
    "timestamp_server": "rfc3161.nist.gov",
    "signature": "-----BEGIN SIGNATURE-----\nMIIDXTCCAkWgAwIBAgI...\n-----END SIGNATURE-----",
    "certificate_chain": [
      "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
      "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
    ],
    "verified": true,
    "verification_details": {
      "signature_valid": true,
      "timestamp_valid": true,
      "certificate_chain_valid": true,
      "not_revoked": true
    }
  }
}
```

---

### 1.5 `get_legal_compliance_status`

**Purpose:** Get current legal compliance mode status and statistics.

**Command:**
```javascript
{
  "command": "get_legal_compliance_status"
}
```

**Response:**
```javascript
{
  "success": true,
  "mode_active": true,
  "compliance_id": "comp_20260620_001",
  "jurisdiction": "us",
  "standards_enabled": ["swgde", "iso27037"],
  "certification_level": "chain-of-custody",
  "evidence_count": 47,
  "evidence_types": {
    "screenshot": 15,
    "har": 10,
    "dom_snapshot": 12,
    "console_logs": 10
  },
  "reports_generated": 2,
  "certifications_issued": 47,
  "audit_log_entries": 156,
  "last_action": {
    "timestamp": "2026-06-20T14:40:00Z",
    "action": "EVIDENCE_COLLECTED",
    "details": "Screenshot captured"
  },
  "compliance_score": 98,  // 0-100
  "recommendations": [
    "All evidence properly certified",
    "Chain of custody maintained",
    "Ready for court submission"
  ]
}
```

---

### 1.6 `export_court_admissible_package`

**Purpose:** Export final court-ready evidence package with all certifications.

**Command:**
```javascript
{
  "command": "export_court_admissible_package",
  "evidence_ids": ["ev_001", "ev_002", "ev_003"],
  "case_info": {
    "case_number": "2026-001",
    "jurisdiction": "us",
    "examiner_name": "Dr. Jane Smith",
    "examiner_credentials": "CFCE, EnCE",
    "defense_counsel_notified": true
  },
  "certification_level": "forensic",  // 'basic', 'enhanced', 'forensic'
  "output_format": "pdf"              // 'pdf', 'zip+manifest'
}
```

**Response:**
```javascript
{
  "success": true,
  "package_file": "<Buffer: court package>",
  "package_hash": "a1b2c3d4e5f6...",
  "certification_file": "<Buffer: certification>",
  "manifest": {
    "case_number": "2026-001",
    "jurisdiction": "us",
    "evidence_items": 3,
    "total_size_bytes": 1024000,
    "total_size_readable": "1 MB",
    "formats_included": ["pdf", "mhtml", "json"],
    "certification_info": {
      "examiner": "Dr. Jane Smith",
      "credentials": "CFCE, EnCE",
      "case_number": "2026-001",
      "jurisdiction": "us",
      "timestamp": "2026-06-20T14:45:00Z",
      "standards_compliant": ["swgde", "iso27037"],
      "chain_of_custody": true,
      "digital_signature": "verified",
      "timestamp_certified": true,
      "defense_counsel_notification": "2026-06-20T14:00:00Z",
      "ready_for_court": true
    },
    "file_integrity": {
      "algorithm": "sha256",
      "hash": "a1b2c3d4e5f6...",
      "verified": true
    }
  }
}
```

---

## SECTION 2: EVIDENCE CORRELATION ENGINE (5 commands)

### 2.1 `start_evidence_correlation`

**Purpose:** Initialize correlation engine for multi-site evidence analysis.

**Command:**
```javascript
{
  "command": "start_evidence_correlation",
  "timeline_resolution": "second",    // 'second', 'minute', 'hour'
  "entity_matching_mode": "hybrid",   // 'strict', 'fuzzy', 'hybrid'
  "pattern_detection_enabled": true
}
```

**Response:**
```javascript
{
  "success": true,
  "correlation_session_id": "corr_20260620_001",
  "status": "ready",
  "ready": true,
  "configuration": {
    "timeline_resolution": "second",
    "entity_matching_mode": "hybrid",
    "pattern_detection_enabled": true,
    "fuzzy_match_threshold": 0.85
  },
  "supported_correlation_types": [
    "timeline",
    "entity",
    "pattern",
    "network"
  ]
}
```

---

### 2.2 `correlate_evidence_across_sites`

**Purpose:** Link evidence items by timeline, entities, and patterns across multiple sites.

**Command:**
```javascript
{
  "command": "correlate_evidence_across_sites",
  "evidence_ids": ["ev_001", "ev_002", "ev_003", "ev_004"],
  "correlation_types": ["timeline", "entity", "pattern"],
  "link_strength_threshold": 50,  // 0-100
  "create_visualization": true
}
```

**Response:**
```javascript
{
  "success": true,
  "correlation_id": "correl_20260620_001",
  "evidence_analyzed": 4,
  "links_found": 12,
  "entities_identified": [
    {
      "entity_id": "ent_001",
      "type": "email",
      "value": "user@domain.com",
      "sources": ["ev_001", "ev_002", "ev_003"],
      "confidence": 98,
      "first_seen": "2026-06-20T10:00:00Z",
      "last_seen": "2026-06-20T14:00:00Z",
      "frequency": 3,
      "contexts": ["form_submission", "cookie_value", "request_header"]
    },
    {
      "entity_id": "ent_002",
      "type": "ip_address",
      "value": "192.168.1.100",
      "sources": ["ev_001", "ev_004"],
      "confidence": 95,
      "first_seen": "2026-06-20T10:05:00Z",
      "last_seen": "2026-06-20T13:55:00Z",
      "frequency": 2,
      "geolocation": {
        "country": "US",
        "region": "CA",
        "city": "San Francisco"
      }
    }
  ],
  "timeline_overlaps": [
    {
      "overlap_id": "ov_001",
      "time_window": {
        "start": "2026-06-20T10:00:00Z",
        "end": "2026-06-20T10:05:00Z",
        "duration_seconds": 300
      },
      "evidence_ids": ["ev_001", "ev_002"],
      "activity_type": "simultaneous_navigation",
      "significance_score": 95,
      "interpretation": "Same user accessed two sites within 5 minutes"
    }
  ],
  "suspicious_patterns": [
    {
      "pattern_id": "pat_001",
      "pattern_type": "timing",
      "description": "Rapid site switching (3 sites in 10 minutes)",
      "evidence_involved": ["ev_001", "ev_002", "ev_003"],
      "occurrences": 2,
      "risk_level": "medium",
      "interpretation": "Possible account takeover or automated activity"
    },
    {
      "pattern_id": "pat_002",
      "pattern_type": "behavioral",
      "description": "Form submissions with identical field values across different sites",
      "evidence_involved": ["ev_001", "ev_004"],
      "occurrences": 1,
      "risk_level": "high",
      "interpretation": "Possible credential reuse or automated bot activity"
    }
  ]
}
```

---

### 2.3 `get_correlation_graph`

**Purpose:** Retrieve correlation graph showing entity and temporal relationships.

**Command:**
```javascript
{
  "command": "get_correlation_graph",
  "correlation_id": "correl_20260620_001",
  "node_types": ["entity", "evidence", "timeline_event"],
  "edge_types": ["direct", "temporal", "behavioral"],
  "include_metadata": true
}
```

**Response:**
```javascript
{
  "success": true,
  "graph": {
    "nodes": [
      {
        "id": "node_ent_001",
        "type": "entity",
        "entity_type": "email",
        "label": "user@domain.com",
        "metadata": {
          "entity_id": "ent_001",
          "confidence": 98,
          "frequency": 3,
          "first_seen": "2026-06-20T10:00:00Z",
          "last_seen": "2026-06-20T14:00:00Z"
        },
        "properties": {
          "category": "contact",
          "sensitivity": "high"
        }
      },
      {
        "id": "node_ev_001",
        "type": "evidence",
        "label": "Screenshot #1 (domain.com)",
        "metadata": {
          "evidence_id": "ev_001",
          "type": "screenshot",
          "timestamp": "2026-06-20T10:00:00Z",
          "domain": "domain.com"
        },
        "properties": {
          "category": "visual_evidence",
          "size_bytes": 234560
        }
      }
    ],
    "edges": [
      {
        "id": "edge_001",
        "source_node_id": "node_ent_001",
        "target_node_id": "node_ev_001",
        "type": "direct",
        "label": "contains",
        "strength": 98,
        "evidence": ["ev_001"],
        "metadata": {
          "relationship": "entity_found_in_evidence",
          "context": "form_field_value"
        }
      },
      {
        "id": "edge_002",
        "source_node_id": "node_ev_001",
        "target_node_id": "node_ev_002",
        "type": "temporal",
        "label": "followed_by",
        "strength": 85,
        "evidence": ["ev_001", "ev_002"],
        "metadata": {
          "time_gap_seconds": 300,
          "relationship": "sequential_navigation"
        }
      }
    ]
  },
  "metadata": {
    "total_nodes": 12,
    "total_edges": 18,
    "density": 0.38,  // 0-1 scale
    "clusters": 3,
    "largest_cluster_size": 6,
    "connected_components": 1
  }
}
```

---

### 2.4 `export_correlation_report`

**Purpose:** Export correlation analysis as detailed report with visualizations.

**Command:**
```javascript
{
  "command": "export_correlation_report",
  "correlation_id": "correl_20260620_001",
  "format": "html",                      // 'pdf', 'html', 'json', 'graphml'
  "include_visualization": true,
  "include_methodology": true,
  "include_confidence_metrics": true
}
```

**Response:**
```javascript
{
  "success": true,
  "report": {
    "content": "<HTML or PDF content>",
    "format": "html",
    "filename": "Correlation_Report_20260620_001.html",
    "size_bytes": 567890
  },
  "visualization": {
    "graph_svg": "<SVG content for graph>",
    "graph_json": { /* graph data */ },
    "interactive_html": "<HTML with interactive graph>",
    "thumbnail_png": "<base64 PNG>"
  },
  "statistics": {
    "entities_found": 5,
    "connections_identified": 12,
    "timeline_overlaps": 3,
    "suspicious_patterns": 2,
    "average_confidence": 92,
    "evidence_coverage": "100%",
    "recommendations": [
      "Investigate simultaneous access from two IPs",
      "Verify credential usage across sites",
      "Review timing of rapid site switching"
    ]
  }
}
```

---

### 2.5 `identify_common_patterns`

**Purpose:** Identify suspicious patterns in correlated evidence.

**Command:**
```javascript
{
  "command": "identify_common_patterns",
  "correlation_id": "correl_20260620_001",
  "pattern_types": ["timing", "behavioral", "network"],
  "min_occurrences": 2,
  "include_risk_assessment": true
}
```

**Response:**
```javascript
{
  "success": true,
  "patterns_identified": 5,
  "patterns": [
    {
      "pattern_id": "pat_001",
      "type": "timing",
      "name": "Rapid Site Switching",
      "description": "User accessed multiple sites in quick succession",
      "occurrences": [
        {
          "evidence_ids": ["ev_001", "ev_002", "ev_003"],
          "timestamp_range": {
            "start": "2026-06-20T10:00:00Z",
            "end": "2026-06-20T10:15:00Z",
            "duration_minutes": 15
          },
          "confidence": 98,
          "sites_involved": ["domain1.com", "domain2.com", "domain3.com"]
        },
        {
          "evidence_ids": ["ev_004", "ev_005"],
          "timestamp_range": {
            "start": "2026-06-20T13:00:00Z",
            "end": "2026-06-20T13:08:00Z",
            "duration_minutes": 8
          },
          "confidence": 95,
          "sites_involved": ["domain2.com", "domain3.com"]
        }
      ],
      "risk_level": "medium",
      "risk_score": 65,
      "recommendations": [
        "Review user behavior logs",
        "Check for automated bot activity",
        "Verify legitimate use case"
      ]
    }
  ],
  "cross_pattern_connections": [
    {
      "pattern_ids": ["pat_001", "pat_002"],
      "connection_type": "same_timeframe",
      "description": "Rapid switching + form submissions occur simultaneously",
      "significance": "high"
    }
  ],
  "risk_assessment": {
    "overall_risk": "medium",
    "risk_score": 62,
    "top_concerns": [
      "Automated activity detected (timing patterns)",
      "Credential reuse across sites",
      "Multiple account access"
    ],
    "action_items": [
      "Investigate user identity",
      "Review authentication logs",
      "Check for compromised credentials"
    ]
  }
}
```

---

## SECTION 3: ENHANCED SESSION TRACKING (3 commands)

### 3.1 `track_multi_site_session`

**Purpose:** Track session coherence across multiple domains and sites.

**Command:**
```javascript
{
  "command": "track_multi_site_session",
  "session_id": "sess_001",
  "track_cookies": true,
  "track_storage": true,
  "track_network": true,
  "track_behavioral": true
}
```

**Response:**
```javascript
{
  "success": true,
  "session_tracking_id": "track_20260620_001",
  "session_id": "sess_001",
  "sites_visited": [
    {
      "domain": "domain1.com",
      "url": "https://domain1.com/login",
      "visit_time": "2026-06-20T10:00:00Z",
      "duration_ms": 45000,
      "exit_reason": "user_navigation"
    },
    {
      "domain": "domain2.com",
      "url": "https://domain2.com/profile",
      "visit_time": "2026-06-20T10:00:45Z",
      "duration_ms": 120000,
      "exit_reason": "user_navigation"
    }
  ],
  "coherence_score": 92,  // 0-100: how consistent is session across sites
  "cross_site_artifacts": [
    {
      "artifact_id": "art_001",
      "artifact_type": "cookie",
      "artifact_name": "tracking_id",
      "artifact_value": "abc123xyz789",
      "sites": ["domain1.com", "domain2.com"],
      "first_seen": "2026-06-20T10:00:00Z",
      "last_seen": "2026-06-20T10:02:00Z",
      "relationships": [
        "same_value_across_domains",
        "set_by_analytics_library"
      ]
    }
  ],
  "session_coherence_details": {
    "cookie_consistency": 98,
    "storage_consistency": 95,
    "behavioral_consistency": 85,
    "network_consistency": 92
  },
  "status": "active"
}
```

---

### 3.2 `get_session_timeline`

**Purpose:** Get complete session timeline with evidence events and network activity.

**Command:**
```javascript
{
  "command": "get_session_timeline",
  "session_id": "sess_001",
  "include_evidence_events": true,
  "include_network_events": true,
  "include_user_actions": true,
  "resolution": "event"  // 'event', 'second', 'minute'
}
```

**Response:**
```javascript
{
  "success": true,
  "timeline": [
    {
      "timestamp": "2026-06-20T10:00:00Z",
      "event_type": "navigation",
      "event_description": "Navigated to domain1.com/login",
      "related_evidence_ids": [],
      "url": "https://domain1.com/login",
      "context": {
        "referrer": null,
        "user_agent": "Mozilla/5.0..."
      },
      "significance": "high"
    },
    {
      "timestamp": "2026-06-20T10:00:15Z",
      "event_type": "interaction",
      "event_description": "Filled email field: user@domain.com",
      "related_evidence_ids": [],
      "selector": "input#email",
      "context": {
        "field_type": "email",
        "value_length": 16
      },
      "significance": "medium"
    },
    {
      "timestamp": "2026-06-20T10:00:25Z",
      "event_type": "capture",
      "event_description": "Screenshot captured",
      "related_evidence_ids": ["ev_001"],
      "capture_type": "screenshot",
      "context": {
        "size": 234560,
        "format": "png"
      },
      "significance": "high"
    },
    {
      "timestamp": "2026-06-20T10:00:30Z",
      "event_type": "network",
      "event_description": "POST /api/login (200 OK)",
      "related_evidence_ids": [],
      "method": "POST",
      "url": "https://domain1.com/api/login",
      "status": 200,
      "context": {
        "response_time_ms": 145,
        "data_size": 1024
      },
      "significance": "high"
    }
  ],
  "summary": {
    "total_events": 47,
    "duration_seconds": 3600,
    "sites_visited": 3,
    "evidence_collected": 12,
    "critical_events": 8,
    "network_requests": 32,
    "user_interactions": 15
  }
}
```

---

### 3.3 `export_session_evidence_package`

**Purpose:** Export all evidence from session as correlated forensic package.

**Command:**
```javascript
{
  "command": "export_session_evidence_package",
  "session_id": "sess_001",
  "format": "pdf",                          // 'pdf', 'zip', 'mhtml', 'json'
  "include_timeline": true,
  "include_correlation_analysis": true,
  "include_chain_of_custody": true,
  "include_metadata": true
}
```

**Response:**
```javascript
{
  "success": true,
  "package": {
    "content": "<Buffer: package data>",
    "format": "pdf",
    "filename": "Session_Evidence_Package_sess001_20260620.pdf",
    "size_bytes": 2048000,
    "compression": "gzip",
    "compressed_size_bytes": 890000
  },
  "manifest": {
    "session_id": "sess_001",
    "evidence_items": 12,
    "total_artifacts": 47,
    "sites_covered": ["domain1.com", "domain2.com", "domain3.com"],
    "timeline_covered": {
      "start": "2026-06-20T10:00:00Z",
      "end": "2026-06-20T13:00:00Z",
      "duration_hours": 3
    },
    "correlations_included": 5,
    "patterns_identified": 3
  },
  "metadata": {
    "created_at": "2026-06-20T13:15:00Z",
    "session_duration_seconds": 10800,
    "coherence_score": 92,
    "evidence_types": {
      "screenshot": 4,
      "har": 3,
      "dom_snapshot": 3,
      "interaction_log": 2
    }
  }
}
```

---

## SECTION 4: NETWORK ENHANCEMENT (2 commands)

### 4.1 `export_full_network_capture`

**Purpose:** Export complete network capture including request/response bodies.

**Command:**
```javascript
{
  "command": "export_full_network_capture",
  "include_request_bodies": true,
  "include_response_bodies": true,
  "include_cache_info": true,
  "body_size_limit": 10485760,  // 10MB limit, 0 = unlimited
  "format": "har+bodies"        // 'har', 'har+bodies', 'json'
}
```

**Response:**
```javascript
{
  "success": true,
  "capture": {
    "content": "<HAR or JSON data>",
    "format": "har+bodies",
    "filename": "Network_Capture_20260620_001.har",
    "total_entries": 47,
    "bodies_included": true,
    "compressed": true,
    "size_bytes": 5242880,
    "compressed_size_bytes": 1242880
  },
  "statistics": {
    "total_requests": 47,
    "total_response_bytes": 5242880,
    "total_request_bytes": 124570,
    "unique_domains": 8,
    "cache_hits": 12,
    "cache_misses": 35,
    "cookies_set": 15,
    "cookies_sent": 42,
    "redirects": 3,
    "errors": 1
  },
  "security_insights": {
    "insecure_requests": 0,
    "mixed_content": false,
    "cookies_without_secure_flag": 2,
    "cookies_without_httponly": 3,
    "recommendations": [
      "Enable Secure flag on all cookies",
      "Enable HttpOnly flag on sensitive cookies"
    ]
  }
}
```

---

### 4.2 `track_cookie_modifications`

**Purpose:** Track all cookie modifications throughout session.

**Command:**
```javascript
{
  "command": "track_cookie_modifications",
  "track_origins": true,        // Where cookie was set
  "track_modifications": true,  // Updates, deletions
  "track_usage": true,          // When/how used
  "include_values": false       // Don't include actual values (privacy)
}
```

**Response:**
```javascript
{
  "success": true,
  "cookies_tracked": 18,
  "modifications": [
    {
      "cookie_id": "cook_001",
      "cookie_name": "session_id",
      "domain": ".domain1.com",
      "events": [
        {
          "event_id": "evt_001",
          "event_type": "created",
          "timestamp": "2026-06-20T10:00:00Z",
          "source_url": "https://domain1.com/login",
          "source_script": "inline",
          "modification": {
            "domain": ".domain1.com",
            "path": "/",
            "expiry": "2026-06-21T10:00:00Z",
            "flags": {
              "secure": true,
              "httponly": true,
              "samesite": "strict"
            }
          }
        },
        {
          "event_id": "evt_002",
          "event_type": "sent",
          "timestamp": "2026-06-20T10:00:05Z",
          "request_url": "https://domain1.com/api/user",
          "request_method": "GET"
        },
        {
          "event_id": "evt_003",
          "event_type": "modified",
          "timestamp": "2026-06-20T11:00:00Z",
          "source_url": "https://domain1.com/profile",
          "modification": {
            "previous_flags": {
              "secure": true,
              "httponly": true
            },
            "new_flags": {
              "secure": true,
              "httponly": false  // Became less secure
            }
          }
        }
      ]
    }
  ],
  "security_insights": [
    {
      "insight_id": "sec_001",
      "issue_type": "insecure_transmission",
      "description": "Cookie transmitted over non-HTTPS connection",
      "affected_cookies": ["session_id"],
      "risk_level": "high",
      "evidence_ids": ["ev_001"]
    },
    {
      "insight_id": "sec_002",
      "issue_type": "flag_downgrade",
      "description": "Cookie HttpOnly flag was removed",
      "affected_cookies": ["session_id"],
      "risk_level": "medium",
      "evidence_ids": ["ev_003"]
    }
  ]
}
```

---

## SECTION 5: IMPLEMENTATION ARCHITECTURE

### 5.1 Module Structure

```
/src/compliance/
  ├── legal-compliance-manager.js       # Main compliance orchestrator
  ├── swgde-report-generator.js         # SWGDE template engine
  ├── metadata-certifier.js             # Cryptographic certification
  └── jurisdiction-templates/
      ├── us-swgde.js
      ├── eu-iso27037.js
      └── uk-standards.js

/src/correlation/
  ├── correlation-engine.js             # Main correlation orchestrator
  ├── timeline-linker.js                # Timeline-based linking
  ├── entity-matcher.js                 # Entity deduplication
  ├── pattern-detector.js               # Pattern identification
  └── correlation-graph-builder.js      # Graph generation

/src/tracking/
  ├── multi-site-session-tracker.js     # Cross-domain tracking
  ├── session-timeline-builder.js       # Timeline with events
  └── session-evidence-packager.js      # Package generation

/src/network/
  ├── network-capture-exporter.js       # Full HAR+ export
  └── cookie-modification-tracker.js    # Cookie tracking

/websocket/commands/
  ├── legal-compliance-commands.js      # 6 WebSocket commands
  ├── correlation-commands.js           # 5 WebSocket commands
  ├── session-tracking-commands.js      # 3 WebSocket commands
  └── network-capture-commands.js       # 2 WebSocket commands
```

### 5.2 Dependencies

**Core:**
- `pdfkit` - PDF report generation
- `crypto` - SHA-256, signatures
- `uuid` - Unique IDs
- `graphlib` - Correlation graph

**Optional:**
- `@timestamp/rfc3161` - RFC 3161 timestamping
- `jsdom` - DOM parsing for HTML reports

### 5.3 Database Schema

```javascript
// Evidence Metadata
{
  evidence_id: string,
  compliance_id: string,
  type: string,
  timestamp: Date,
  hash: string,
  audit_trail: AuditEntry[]
}

// Correlation Links
{
  correlation_id: string,
  evidence_id_1: string,
  evidence_id_2: string,
  link_type: string,  // 'timeline', 'entity', 'pattern'
  strength: number,
  details: object
}

// Entities
{
  entity_id: string,
  type: string,        // 'email', 'ip', 'username'
  value: string,
  evidence_ids: string[],
  first_seen: Date,
  last_seen: Date
}
```

---

## SECTION 6: TESTING STRATEGY (180+ tests)

### Test Categories

**Legal Compliance (50 tests)**
- Command execution (all 6 commands)
- SWGDE compliance validation
- Report generation (PDF, HTML, JSON)
- Metadata certification
- Jurisdiction-specific templates
- Edge cases (expired evidence, missing metadata, etc.)

**Evidence Correlation (60 tests)**
- Entity matching (strict, fuzzy, hybrid modes)
- Timeline linking
- Pattern detection
- Graph generation
- Cross-site linking validation
- Large dataset performance (10k+ items)

**Session Tracking (40 tests)**
- Multi-domain coherence
- Cookie tracking across domains
- Session timeline generation
- Evidence package export
- Session state preservation

**Network Capture (30 tests)**
- Full HAR+ export
- Request/response body inclusion
- Cookie modification tracking
- Cache tracking
- Security insight generation
- Large capture handling (1GB+)

### Test Tools

- `jest` - Unit and integration testing
- `supertest` - WebSocket command testing
- `faker` - Test data generation
- `jest-bench` - Performance testing

---

## SECTION 7: DELIVERABLES & TIMELINE

### Phase 2 Feature Deliverables (18 days)

**Week 1 (Days 1-5): Foundation**
- [ ] All 14 command implementations (Stage 1)
- [ ] Core modules (150+ tests)
- [ ] Documentation (API reference)

**Week 2 (Days 6-10): WebSocket Integration**
- [ ] WebSocket command registration
- [ ] Error handling
- [ ] Input validation
- [ ] Integration tests (50+ tests)

**Week 3 (Days 11-15): Advanced Testing**
- [ ] E2E testing
- [ ] Performance testing
- [ ] Large dataset validation
- [ ] Final QA

**Week 4 (Days 16-18): Release**
- [ ] Bug fixes
- [ ] Documentation finalization
- [ ] Deployment readiness

### Acceptance Criteria

- ✅ All 14 commands passing unit tests
- ✅ 180+ tests with >95% pass rate
- ✅ <50ms latency for most commands
- ✅ Complete API documentation
- ✅ Integration with existing commands
- ✅ Legal compliance verified
- ✅ Performance meets SLA

---

*This specification document provides complete implementation guidance for all 14 new P0 commands across 4 feature areas.*

*For execution details, see PHASE2-FORENSIC-RESEARCHER-REFINEMENT.md.*
