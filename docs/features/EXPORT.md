# Data Export System

## Overview

Export monitoring data in multiple formats (CSV, JSON, Excel, Parquet) with optional compression, digital signatures, and compliance support for audit logs.

## Data Exporter

### Basic Usage

```javascript
const { DataExporter, AuditLogExporter } = require('./src/features/data-export');

const exporter = new DataExporter({
  exportDir: '/tmp/basset-exports',
  maxConcurrentExports: 3,
  compressionEnabled: true
});

// Create export job
const jobId = exporter.createExportJob(
  'csv',                           // Format
  'changes',                       // Data type
  { monitorId: 'monitor-1' },     // Filters
  { async: true, destination: 'local' }
);

// Check status
const status = exporter.getJobStatus(jobId);
console.log(`Progress: ${status.progress}%`);

// Get file when complete
const file = exporter.getExportFile(jobId);
console.log(`Exported to: ${file.path}`);
```

### API Reference

#### Constructor

```javascript
const exporter = new DataExporter({
  exportDir: string,                    // Where to store exports
  s3Config: object,                     // Optional S3 config
  maxConcurrentExports: number,         // Default: 3
  compressionEnabled: boolean,          // Default: true
  signingKey: string                    // HMAC key for signatures
});
```

#### createExportJob(format, dataType, filters, options)

Create an export job.

```javascript
const jobId = exporter.createExportJob(
  'csv',                   // 'csv' | 'json' | 'excel' | 'parquet'
  'changes',               // 'changes' | 'alerts' | 'monitors' | 'campaigns' | 'audit_logs'
  {
    monitorId: 'mon-1',
    dateRange: {
      start: Date.now() - 30*24*60*60*1000,
      end: Date.now()
    },
    limit: 10000
  },
  {
    async: true,           // Process in background
    destination: 'local'   // 'local' or 's3'
  }
);
```

**Filters vary by data type:**

```javascript
// For changes/alerts
{
  monitorId: 'specific-monitor',
  dateRange: { start, end },
  changeType: 'added',
  severity: 'high'
}

// Common
{
  limit: 10000
}
```

#### getJobStatus(jobId)

Get job status and progress.

```javascript
const status = exporter.getJobStatus(jobId);
// {
//   id: 'job-id',
//   status: 'pending' | 'processing' | 'completed' | 'failed',
//   progress: 0-100,
//   totalRecords: 5000,
//   processedRecords: 2500,
//   createdAt: timestamp,
//   completedAt: timestamp,
//   fileSize: bytes,
//   error: 'error message or null'
// }
```

#### getExportFile(jobId)

Get completed export file info.

```javascript
const file = exporter.getExportFile(jobId);
// {
//   path: '/tmp/basset-exports/changes-job-id.csv',
//   size: 1048576,
//   checksum: 'sha256-hex',
//   signature: 'hmac-hex'
// }
```

#### listJobs(filters)

List export jobs.

```javascript
const jobs = exporter.listJobs({
  status: 'completed',     // Optional
  dataType: 'changes',     // Optional
  format: 'csv'            // Optional
});
```

#### cancelJob(jobId)

Cancel pending or processing job.

```javascript
const cancelled = exporter.cancelJob(jobId);  // true or false
```

#### deleteExportFile(jobId)

Delete exported file.

```javascript
exporter.deleteExportFile(jobId);
```

#### getStatistics()

Get export statistics.

```javascript
const stats = exporter.getStatistics();
// {
//   totalJobs: 50,
//   byStatus: { completed: 40, failed: 5, processing: 2, pending: 3 },
//   byFormat: { csv: 20, json: 15, excel: 10, parquet: 5 },
//   byDataType: { changes: 25, alerts: 15, monitors: 10 },
//   totalExportedRecords: 125000,
//   totalExportSize: 52428800  // bytes
// }
```

## Supported Formats

### CSV

- Comma-separated values
- Quotes around values with commas
- Header row with field names
- Handles nested JSON objects
- Best for: Spreadsheet imports, data analysis

### JSON

- Pretty-printed with indentation
- Includes export metadata (exportedAt, recordCount)
- Handles all data types
- Best for: APIs, JavaScript tools, validation

### Excel

- XLSX format (Excel 2007+)
- Single sheet with data
- Headers row
- Best for: Business users, pivot tables

### Parquet

- Apache Parquet columnar format
- Highly compressed
- Schema support
- Best for: Big data, analytical systems

## Signatures and Checksums

### Digital Signatures

All exports are signed with HMAC-SHA256 for authenticity verification:

```javascript
// Get signature when exporting
const file = exporter.getExportFile(jobId);

// Verify signature
const verified = exporter.verifySignature(jobId, file.signature);

// In verification endpoint:
const crypto = require('crypto');

function verifyExport(content, signature, signingKey) {
  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(content)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Checksums

SHA-256 checksums for integrity verification:

```javascript
const file = exporter.getExportFile(jobId);
console.log('Checksum:', file.checksum);

// Verify
const crypto = require('crypto');
const fileContent = fs.readFileSync(file.path);
const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
console.log('Match:', hash === file.checksum);
```

## Audit Log Exporter

### Basic Usage

```javascript
const { AuditLogExporter } = require('./src/features/data-export');

const audit = new AuditLogExporter({
  maxLogs: 100000
});

// Record events
audit.recordAuditEvent({
  userId: 'user-123',
  action: 'create_monitor',
  resourceType: 'monitor',
  resourceId: 'mon-456',
  changes: { name: 'Monitor Name', url: 'https://...' },
  status: 'success',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: { source: 'api' }
});

// Export audit logs
const json = audit.exportAuditLogs('json', {
  userId: 'user-123',
  action: 'create_monitor',
  dateRange: { start, end }
});

const pdf = audit.exportAuditLogs('pdf', {
  dateRange: { start, end }
});

// Statistics
const stats = audit.getStatistics({
  dateRange: { start, end }
});
```

### API Reference

#### recordAuditEvent(event)

Record an audit event.

```javascript
const event = audit.recordAuditEvent({
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: object,
  status: 'success' | 'failure',
  ipAddress: string,
  userAgent: string,
  metadata: object
});
```

#### exportAuditLogs(format, filters)

Export audit logs.

```javascript
const data = audit.exportAuditLogs('json', {
  userId: 'user-123',           // Optional
  action: 'create_monitor',     // Optional
  dateRange: { start, end }     // Optional
});
```

Formats: `'json'` or `'pdf'`

#### getStatistics(filters)

Get audit log statistics.

```javascript
const stats = audit.getStatistics({
  dateRange: { start, end }
});
// {
//   totalLogs: 5000,
//   byAction: { create_monitor: 100, delete_monitor: 50, ... },
//   byUser: { 'user-1': 200, 'user-2': 150, ... },
//   byStatus: { success: 4800, failure: 200 },
//   dateRange: { first: timestamp, last: timestamp }
// }
```

## Examples

### Export All Changes from Last 30 Days

```javascript
const jobId = exporter.createExportJob(
  'csv',
  'changes',
  {
    dateRange: {
      start: Date.now() - 30 * 24 * 60 * 60 * 1000,
      end: Date.now()
    }
  },
  { async: true }
);

// Wait for completion
const pollInterval = setInterval(() => {
  const status = exporter.getJobStatus(jobId);
  if (status.status === 'completed') {
    clearInterval(pollInterval);
    const file = exporter.getExportFile(jobId);
    console.log(`Export ready: ${file.path}`);
  }
}, 1000);
```

### Compliance Export with Audit Trail

```javascript
const audit = new AuditLogExporter();

// Record compliance event
audit.recordAuditEvent({
  userId: 'compliance-bot',
  action: 'compliance_export',
  resourceType: 'export',
  resourceId: jobId,
  status: 'success',
  metadata: {
    reason: 'SOC2 audit',
    approver: 'compliance@company.com'
  }
});

// Export audit logs
const pdf = audit.exportAuditLogs('pdf', {
  action: 'compliance_export',
  dateRange: {
    start: Date.now() - 90 * 24 * 60 * 60 * 1000,
    end: Date.now()
  }
});
```

### Verify Export Integrity

```javascript
const file = exporter.getExportFile(jobId);

// Read file
const fs = require('fs');
const content = fs.readFileSync(file.path);

// Verify checksum
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(content).digest('hex');
if (hash !== file.checksum) {
  throw new Error('Checksum mismatch - file corrupted');
}

// Verify signature
if (!exporter.verifySignature(jobId, file.signature)) {
  throw new Error('Signature verification failed');
}

console.log('Export verified successfully');
```

## Performance

- **Throughput**: 10,000+ records/second per job
- **Formats**: CSV fastest, Parquet most compressed
- **Concurrent Jobs**: Limited by `maxConcurrentExports`
- **Compression**: 70-90% reduction on large exports
- **Memory**: Streaming to avoid loading entire dataset

## Troubleshooting

### Export Stuck at 0%

1. Check `maxConcurrentExports` limit
2. Verify export directory is writable
3. Check system disk space
4. Monitor system resources (CPU, memory)

### File Corrupted or Missing

1. Verify checksum: `file.checksum`
2. Check signature with `verifySignature()`
3. Ensure export completed (`status === 'completed'`)
4. Check file permissions on disk

### Large Exports Slow

1. Use Parquet format (better compression)
2. Reduce date range or add filters
3. Increase `maxConcurrentExports` if system resources available
4. Stream results instead of loading full file

## Testing

```bash
npm test -- tests/features/export.test.js
```

49 tests covering:
- Export job creation and tracking
- Format support (CSV, JSON, Excel, Parquet)
- Signature generation and verification
- Audit log recording and export
- Statistics and monitoring
- File management

## See Also

- [Webhooks Documentation](./WEBHOOKS.md)
- [Streams Documentation](./STREAMS.md)
- Reports Documentation
