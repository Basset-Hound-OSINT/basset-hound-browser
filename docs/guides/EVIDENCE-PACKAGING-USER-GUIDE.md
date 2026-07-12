# Evidence Packaging & Chain of Custody - User Guide

**Version:** v12.0.0  
**For:** Investigators, Forensic Analysts, Legal Professionals  
**Compliance:** ISO/IEC 27037:2012, RFC 3161, NIST SP 800-86

## What Is Evidence Packaging?

Evidence Packaging captures digital evidence (screenshots, pages, network logs, etc.) with cryptographic hashing and maintains a complete "chain of custody" - an audit trail of who accessed what, when.

**Why It Matters:**
- In court, evidence must be proven authentic
- Chain of Custody proves no tampering occurred
- SHA-256 hashes detect any modifications
- RFC 3161 timestamps provide cryptographic proof

## When to Use It

### 1. Fraud Investigation
"I found fraudulent activity on a website. Capture proof for prosecution."

### 2. Evidence Preservation  
"I need to preserve a crime scene (website) before it's taken down."

### 3. Legal Proceedings
"This evidence will be used in court. Need forensic-grade capture."

### 4. Compliance Audit
"Verify evidence integrity for regulatory compliance."

## Step-by-Step Tutorials

### Tutorial 1: Capture and Chain Evidence (Basic)

**Goal:** Screenshot fraudulent website with proper evidence chain

**Steps:**

1. **Capture screenshot with annotation**
   ```javascript
   const captureMsg = {
     command: 'evidence_capture_screenshot',
     params: {
       sessionId: 'fraud_case_001',
       url: 'https://fraudsite.example.com',
       capturedBy: 'investigator_jane_smith',
       fullPage: true,
       annotate: {
         elements: [
           {
             selector: '.fake-checkout',
             label: 'Fake checkout form stealing CC numbers'
           }
         ]
       },
       metadata: {
         caseNumber: 'CASE-2026-0613-001',
         jurisdiction: 'US'
       }
     }
   };
   
   const result = await send(captureMsg);
   console.log('Evidence ID:', result.data.evidenceId);
   console.log('Hash:', result.data.contentHash);
   ```

2. **Note the evidence ID and hash**
   - Store: `ev_1686786225000_abc123`
   - Hash: `sha256:abc123def456...`

3. **Chain is automatically initialized**
   - First entry: "created" action
   - By: investigator_jane_smith
   - At: 2026-06-13T14:23:45Z

4. **Verify integrity later**
   ```javascript
   // To prove evidence wasn't modified:
   const compareHash = crypto.createHash('sha256')
     .update(evidenceData)
     .digest('hex');
   
   if (compareHash === 'sha256:abc123def456...') {
     console.log('✓ Evidence integrity verified');
   }
   ```

### Tutorial 2: Complete Forensic Workflow

**Goal:** Capture page, network activity, DOM, and cookies with full chain

**Steps:**

1. **Capture multiple evidence types**
   ```javascript
   const caseNumber = 'CASE-2026-0613-001';
   
   // Screenshot
   const screenshot = await send({
     command: 'evidence_capture_screenshot',
     params: {
       sessionId: `case_${caseNumber}`,
       url: 'https://fraudsite.example.com',
       capturedBy: 'inv_jane',
       fullPage: true,
       metadata: { caseNumber }
     }
   });
   
   // Page archive (MHTML - self-contained)
   const archive = await send({
     command: 'evidence_capture_page_archive',
     params: {
       sessionId: `case_${caseNumber}`,
       url: 'https://fraudsite.example.com',
       capturedBy: 'inv_jane',
       format: 'mhtml',  // Single file
       metadata: { caseNumber }
     }
   });
   
   // Network activity (HAR)
   const network = await send({
     command: 'evidence_capture_network_har',
     params: {
       sessionId: `case_${caseNumber}`,
       capturedBy: 'inv_jane',
       includeRequestBodies: true,
       includeResponseBodies: true,
       metadata: { caseNumber }
     }
   });
   
   // DOM snapshot
   const dom = await send({
     command: 'evidence_capture_dom_snapshot',
     params: {
       sessionId: `case_${caseNumber}`,
       url: 'https://fraudsite.example.com',
       capturedBy: 'inv_jane',
       metadata: { caseNumber }
     }
   });
   
   // Cookies
   const cookies = await send({
     command: 'evidence_capture_cookies',
     params: {
       sessionId: `case_${caseNumber}`,
       capturedBy: 'inv_jane',
       metadata: { caseNumber }
     }
   });
   ```

2. **All evidence automatically has chain initialized**

3. **Document analysis**
   ```javascript
   const evidenceIds = [
     screenshot.data.evidenceId,
     archive.data.evidenceId,
     network.data.evidenceId,
     dom.data.evidenceId,
     cookies.data.evidenceId
   ];
   
   const analysis = {
     caseNumber,
     capturedAt: new Date().toISOString(),
     evidence: evidenceIds,
     findings: {
       screenshot: 'Shows fake checkout form',
       network: 'POST requests to attacker.com',
       cookies: 'Contains credit card info in localStorage',
       archive: 'Complete page preserved for analysis'
     }
   };
   
   fs.writeFileSync(
     `analysis_${caseNumber}.json`,
     JSON.stringify(analysis, null, 2)
   );
   ```

### Tutorial 3: Chain of Custody for Court Proceedings

**Goal:** Build forensically sound chain for legal use

**Steps:**

1. **Capture evidence with proper metadata**
   ```javascript
   const investigator = 'Jane Smith';
   const badge = 'INV-2026-001';
   const caseNumber = 'CASE-2026-0613-001';
   
   const evidence = await send({
     command: 'evidence_capture_screenshot',
     params: {
       sessionId: caseNumber,
       url: suspiciousUrl,
       capturedBy: `${investigator} (${badge})`,
       metadata: {
         caseNumber,
         jurisdiction: 'US District Court, Northern District of California',
         reason: 'Credit card fraud investigation',
         date: new Date().toISOString()
       }
     }
   });
   
   const evidenceId = evidence.data.evidenceId;
   ```

2. **Record all access/analysis**
   ```javascript
   // Prosecutor reviews evidence
   await send({
     command: 'coc_record_access',
     params: {
       evidenceId,
       actor: 'Prosecutor Mary Johnson',
       purpose: 'trial_preparation',
       notes: 'Reviewed for trial presentation'
     }
   });
   
   // Defense attorney examines
   await send({
     command: 'coc_record_access',
     params: {
       evidenceId,
       actor: 'Defense Attorney John Doe',
       purpose: 'discovery_review',
       notes: 'Discovery phase - examined for authenticity'
     }
   });
   
   // Expert witness analyzes
   await send({
     command: 'coc_record_access',
     params: {
       evidenceId,
       actor: 'Expert Witness Dr. Smith, PhD Forensics',
       purpose: 'expert_analysis',
       notes: 'Analyzed for technical testimony'
     }
   });
   ```

3. **Seal evidence for preservation**
   ```javascript
   const seal = await send({
     command: 'coc_seal_evidence',
     params: {
       evidenceId,
       actor: investigator,
       requestRFC3161: true  // Get cryptographic timestamp
     }
   });
   
   console.log('Evidence sealed at:', seal.data.sealTimestamp);
   console.log('Seal hash:', seal.data.sealHash);
   console.log('RFC 3161 Token serial:', seal.data.rfc3161Token.serialNumber);
   ```

4. **Generate ISO 27037 compliance statement**
   ```javascript
   const compliance = await send({
     command: 'coc_generate_iso27037',
     params: { evidenceId }
   });
   
   const statement = compliance.data.statement;
   
   // Use in court filing
   const courtFiling = {
     caseName: 'United States v. Accused',
     caseNumber,
     courtFilingDate: new Date().toISOString(),
     evidence: evidenceId,
     iso27037Statement: statement,
     complianceChecks: compliance.data.complianceChecks,
     chainOfCustodyLength: compliance.data.requirements.totalActions
   };
   
   fs.writeFileSync(
     `court_filing_${caseNumber}.json`,
     JSON.stringify(courtFiling, null, 2)
   );
   ```

5. **Verify chain integrity before trial**
   ```javascript
   const verification = await send({
     command: 'coc_verify_chain',
     params: { evidenceId }
   });
   
   if (!verification.data.valid) {
     console.error('CHAIN COMPROMISED:');
     verification.data.issues.forEach(issue => {
       console.error('- ' + issue);
     });
   } else {
     console.log('✓ Chain integrity verified');
     console.log('✓ No chronological violations');
     console.log('✓ No post-seal modifications');
     console.log('✓ All actions documented');
   }
   ```

## Best Practices

### 1. Capture Complete Evidence Set

✅ **DO:**
```javascript
// Capture everything for forensic analysis
await Promise.all([
  evidence_capture_screenshot(),
  evidence_capture_page_archive(),
  evidence_capture_network_har(),
  evidence_capture_dom_snapshot(),
  evidence_capture_cookies(),
  evidence_capture_localStorage(),
  evidence_capture_console_log()
]);
```

❌ **DON'T:**
```javascript
// Just screenshot is incomplete
await evidence_capture_screenshot();
// Missing: network activity, cookies, DOM state, etc.
```

### 2. Proper Metadata for Court Use

✅ **DO:**
```javascript
metadata: {
  caseNumber: 'CASE-2026-0613-001',
  jurisdiction: 'US District Court',
  investigator: 'Jane Smith',
  badge: 'INV-2026-001',
  date: '2026-06-13',
  reason: 'Fraud investigation - unauthorized credit card use',
  notes: 'Website accessed from CA, suspect located in NY'
}
```

❌ **DON'T:**
```javascript
metadata: {
  notes: 'evidence'
  // Insufficient metadata for legal proceedings
}
```

### 3. Access Logging is Critical

✅ **DO:**
```javascript
// Every person who touches evidence
await coc_record_access({
  evidenceId,
  actor: 'Full Name, Title, Badge#',
  purpose: 'specific_reason',
  notes: 'detailed description'
});
```

### 4. Seal at Right Time

✅ **DO:**
```javascript
// After evidence is complete and reviewed, seal it
await coc_seal_evidence({
  evidenceId,
  actor: investigator,
  requestRFC3161: true  // For legal proceedings
});
```

❌ **DON'T:**
```javascript
// Don't seal too early - prevents legitimate analysis
// Don't seal without RFC 3161 - less credible in court
```

### 5. Verify Before Court

✅ **DO:**
```javascript
// Always verify chain before filing
const verification = await coc_verify_chain({ evidenceId });
if (!verification.data.valid) {
  throw new Error('Evidence chain compromised - DO NOT USE IN COURT');
}
```

## Common Scenarios

### Scenario 1: Website Will Be Taken Down

**Threat:** Site will disappear before trial

**Solution:**
```javascript
// Capture MHTML (self-contained single file)
const archive = await evidence_capture_page_archive({
  format: 'mhtml',
  includeNetworkLog: true
});

// Also capture as PDF for court viewing
const pdf = await evidence_capture_page_archive({
  format: 'pdf',
  includeNetworkLog: true
});

// Seal immediately
await coc_seal_evidence({
  evidenceId: archive.data.evidenceId,
  requestRFC3161: true
});
```

### Scenario 2: Multiple Investigators

**Scenario:** Team investigation, multiple people

**Solution:**
```javascript
// Lead investigator captures
const evidence = await evidence_capture_screenshot({
  capturedBy: 'Lead Investigator Jane Smith (INV-001)'
});

// Each team member records their access
await coc_record_access({
  evidenceId: evidence.data.evidenceId,
  actor: 'Tech Analyst Bob Jones (ANA-005)',
  purpose: 'technical_analysis',
  notes: 'Analyzed JavaScript for payment processing'
});

// Complete chain of custody tracked
```

### Scenario 3: Defense Challenge

**Threat:** Defense claims evidence tampered with

**Solution:**
```javascript
// Retrieve complete chain
const chain = await coc_get_chain({ evidenceId });

// Show in court
const courtProof = {
  evidenceId,
  captured: chain[0].timestamp,
  sealed: chain[chain.length-1].timestamp,
  rfc3161Token: sealedEvidence.rfc3161Token,  // TSA-signed
  chainLength: chain.length,
  allActions: chain.map(e => ({
    action: e.action,
    actor: e.actor,
    time: e.timestamp
  }))
};

// No modifications = chain never broken
console.log('Evidence never modified after capture');
```

---

## Quick Reference

### Evidence Types

| Type | Use | Size |
|------|-----|------|
| screenshot | Visual proof | 250-500KB |
| page_archive | Complete webpage | 500-2000KB |
| network_har | All requests/responses | 50-500KB |
| dom_snapshot | Page structure | 50-200KB |
| console_log | Errors/messages | 5-100KB |
| cookies | Stored data | 5-50KB |
| localStorage | Client storage | 10-100KB |

### Chain of Custody Actions

- **created** - Evidence captured
- **accessed** - Someone viewed/analyzed
- **modified** - Evidence was changed (rare, documented)
- **exported** - Sent to another party
- **sealed** - Immutable, locked for preservation

---

## Related Documentation

- [Evidence Packaging - Integration Guide](../archives/prune-2026-07-06/integration/EVIDENCE-PACKAGING-INTEGRATION-GUIDE.md)
- [Evidence Packaging - API Reference](../archive/deprecated/EVIDENCE-PACKAGING-API-REFERENCE.md)
- [Evidence Packaging - Architecture](../technical/EVIDENCE-PACKAGING-ARCHITECTURE.md)
