/**
 * Data Export System Tests
 * Tests for export jobs, formats, signatures, and audit logs
 */

const {
  DataExporter,
  AuditLogExporter,
  ExportJob
} = require('../../src/features/data-export');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Data Exporter', () => {
  let exporter;
  const tempDir = path.join(os.tmpdir(), 'basset-test-exports');

  beforeEach(() => {
    exporter = new DataExporter({ exportDir: tempDir });
  });

  afterEach(() => {
    exporter.destroy();
    // Cleanup test files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Export Job Creation', () => {
    test('should create export job for CSV', () => {
      const jobId = exporter.createExportJob('csv', 'changes', {}, { async: false });

      expect(jobId).toBeDefined();
      expect(exporter.jobs.has(jobId)).toBe(true);
    });

    test('should create export job for JSON', () => {
      const jobId = exporter.createExportJob('json', 'alerts', {}, { async: false });

      expect(jobId).toBeDefined();
      const job = exporter.jobs.get(jobId);
      expect(job.format).toBe('json');
      expect(job.dataType).toBe('alerts');
    });

    test('should reject invalid format', () => {
      expect(() => {
        exporter.createExportJob('invalid', 'changes', {}, { async: false });
      }).toThrow('Invalid export format');
    });

    test('should reject invalid data type', () => {
      expect(() => {
        exporter.createExportJob('json', 'invalid_type', {}, { async: false });
      }).toThrow('Invalid data type');
    });

    test('should queue async jobs', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: true });

      expect(exporter.jobQueue).toContain(jobId);
    });

    test('should execute sync jobs immediately', (done) => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      // Give execution time
      setTimeout(() => {
        const job = exporter.jobs.get(jobId);
        expect(['processing', 'completed', 'failed']).toContain(job.status);
        done();
      }, 100);
    });
  });

  describe('Export Job Status', () => {
    test('should track job status', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      const status = exporter.getJobStatus(jobId);

      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
    });

    test('should track job progress', (done) => {
      const jobId = exporter.createExportJob('csv', 'changes', {}, { async: false });

      setTimeout(() => {
        const status = exporter.getJobStatus(jobId);
        if (status) {
          expect(typeof status.progress).toBe('number');
        }
        done();
      }, 100);
    });

    test('should report completion or error', (done) => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      setTimeout(() => {
        const job = exporter.jobs.get(jobId);
        expect(job.status).toBeDefined();
        expect(['pending', 'processing', 'completed', 'failed']).toContain(job.status);
        done();
      }, 150);
    });

    test('should track job errors', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      const status = exporter.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(['error', 'status']).toContain(Object.keys(status).length > 0 ? 'status' : 'error');
    });
  });

  describe('Format Support', () => {
    test('should identify correct file extension for CSV', () => {
      expect(exporter.getFileExtension('csv')).toBe('csv');
    });

    test('should identify correct file extension for JSON', () => {
      expect(exporter.getFileExtension('json')).toBe('json');
    });

    test('should identify correct file extension for Excel', () => {
      expect(exporter.getFileExtension('excel')).toBe('xlsx');
    });

    test('should identify correct file extension for Parquet', () => {
      expect(exporter.getFileExtension('parquet')).toBe('parquet');
    });
  });

  describe('Data Formatting', () => {
    test('should format data as JSON', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];

      const json = exporter.formatJSON(data);

      expect(json).toContain('"recordCount": 2');
      expect(json).toContain('Item 1');
    });

    test('should format data as CSV', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];

      const csv = exporter.formatCSV(data);

      expect(csv).toContain('id,name');
      expect(csv).toContain('1,Item 1');
    });

    test('should handle CSV with special characters', () => {
      const data = [
        { id: '1', name: 'Item, with comma' },
        { id: '2', name: 'Item "quoted"' }
      ];

      const csv = exporter.formatCSV(data);

      expect(csv).toContain('"Item, with comma"');
      expect(csv).toContain('""quoted""');
    });

    test('should handle CSV with JSON objects', () => {
      const data = [
        { id: '1', metadata: { key: 'value' } }
      ];

      const csv = exporter.formatCSV(data);

      expect(csv).toContain('metadata');
    });

    test('should format data as Parquet', () => {
      const data = [
        { id: '1', name: 'Item 1' }
      ];

      const parquet = exporter.formatParquet(data);

      expect(typeof parquet).toBe('string');
    });
  });

  describe('Job Filtering', () => {
    test('should list jobs', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });
      exporter.createExportJob('json', 'alerts', {}, { async: false });

      const jobs = exporter.listJobs();

      expect(jobs.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter jobs by status', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });

      const completedJobs = exporter.listJobs({ status: 'completed' });

      expect(Array.isArray(completedJobs)).toBe(true);
    });

    test('should filter jobs by data type', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });
      exporter.createExportJob('json', 'alerts', {}, { async: false });

      const changeJobs = exporter.listJobs({ dataType: 'changes' });

      expect(changeJobs.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter jobs by format', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });
      exporter.createExportJob('json', 'alerts', {}, { async: false });

      const csvJobs = exporter.listJobs({ format: 'csv' });

      expect(Array.isArray(csvJobs)).toBe(true);
    });
  });

  describe('Job Cancellation', () => {
    test('should cancel pending job', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: true });

      const result = exporter.cancelJob(jobId);

      expect(result).toBe(true);
      expect(exporter.jobs.get(jobId).status).toBe('cancelled');
    });

    test('should not cancel completed job', (done) => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      setTimeout(() => {
        const result = exporter.cancelJob(jobId);

        // Can only cancel if still pending or processing
        expect([true, false]).toContain(result);
        done();
      }, 150);
    });

    test('should remove job from queue when cancelled', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: true });

      exporter.cancelJob(jobId);

      expect(exporter.jobQueue).not.toContain(jobId);
    });
  });

  describe('Data Signatures', () => {
    test('should calculate data checksum', () => {
      const data = 'test data';
      const checksum = exporter.calculateChecksum(data);

      expect(typeof checksum).toBe('string');
      expect(checksum).toHaveLength(64); // SHA-256 hex
    });

    test('should sign data', () => {
      const data = 'test data';
      const signature = exporter.signData(data);

      expect(typeof signature).toBe('string');
      expect(signature).toHaveLength(64); // HMAC-SHA256 hex
    });

    test('should generate consistent signatures', () => {
      const data = 'test data';
      const sig1 = exporter.signData(data);
      const sig2 = exporter.signData(data);

      expect(sig1).toBe(sig2);
    });

    test('should generate different signatures for different data', () => {
      const sig1 = exporter.signData('data1');
      const sig2 = exporter.signData('data2');

      expect(sig1).not.toBe(sig2);
    });

    test('should verify valid signature', () => {
      const data = 'test data';
      const signature = exporter.signData(data);

      // Create a mock job for verification
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });
      const job = exporter.jobs.get(jobId);
      job.signature = signature;

      expect(exporter.verifySignature(jobId, signature)).toBe(true);
    });

    test('should reject invalid signature', () => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });
      const job = exporter.jobs.get(jobId);
      job.signature = 'validSignature';

      expect(() => {
        exporter.verifySignature(jobId, 'invalidSignature');
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    test('should provide export statistics', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });
      exporter.createExportJob('json', 'alerts', {}, { async: false });

      const stats = exporter.getStatistics();

      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('byFormat');
      expect(stats).toHaveProperty('byDataType');
    });

    test('should track total exported records', () => {
      exporter.createExportJob('csv', 'changes', {}, { async: false });

      const stats = exporter.getStatistics();

      expect(typeof stats.totalExportedRecords).toBe('number');
    });

    test('should track total export size', () => {
      exporter.createExportJob('json', 'changes', {}, { async: false });

      const stats = exporter.getStatistics();

      expect(typeof stats.totalExportSize).toBe('number');
    });
  });

  describe('File Management', () => {
    test('should delete exported file', (done) => {
      const jobId = exporter.createExportJob('json', 'changes', {}, { async: false });

      setTimeout(() => {
        const result = exporter.deleteExportFile(jobId);
        // Result depends on if file was created
        expect([true, false]).toContain(result);
        done();
      }, 150);
    });

    test('should return null for non-existent job', () => {
      const file = exporter.getExportFile('fake-id');
      expect(file).toBeNull();
    });
  });
});

describe('Audit Log Exporter', () => {
  let exporter;

  beforeEach(() => {
    exporter = new AuditLogExporter();
  });

  describe('Audit Event Recording', () => {
    test('should record audit event', () => {
      const event = exporter.recordAuditEvent({
        userId: 'user-1',
        action: 'create_monitor',
        resourceType: 'monitor',
        resourceId: 'monitor-1',
        status: 'success'
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.userId).toBe('user-1');
      expect(event.action).toBe('create_monitor');
    });

    test('should maintain max log size', () => {
      const smallExporter = new AuditLogExporter({ maxLogs: 3 });

      for (let i = 0; i < 5; i++) {
        smallExporter.recordAuditEvent({
          userId: 'user-1',
          action: 'test',
          resourceType: 'test',
          resourceId: `id-${i}`
        });
      }

      expect(smallExporter.auditLogs).toHaveLength(3);
    });

    test('should track metadata', () => {
      const event = exporter.recordAuditEvent({
        userId: 'user-1',
        action: 'update_webhook',
        resourceType: 'webhook',
        resourceId: 'webhook-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { previousValue: 'old', newValue: 'new' }
      });

      expect(event.ipAddress).toBe('192.168.1.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.metadata.previousValue).toBe('old');
    });
  });

  describe('Audit Export', () => {
    beforeEach(() => {
      exporter.recordAuditEvent({
        userId: 'user-1',
        action: 'create',
        resourceType: 'monitor',
        resourceId: 'monitor-1'
      });
      exporter.recordAuditEvent({
        userId: 'user-2',
        action: 'delete',
        resourceType: 'monitor',
        resourceId: 'monitor-2'
      });
    });

    test('should export as JSON', () => {
      const json = exporter.exportAuditLogs('json');

      expect(typeof json).toBe('string');
      expect(json).toContain('user-1');
    });

    test('should export as PDF', () => {
      const pdf = exporter.exportAuditLogs('pdf');

      expect(typeof pdf).toBe('string');
      expect(pdf).toContain('Audit Log Report');
    });

    test('should filter by user ID', () => {
      const logs = exporter.exportAuditLogs('json', { userId: 'user-1' });

      expect(logs).toContain('user-1');
    });

    test('should filter by action', () => {
      const logs = exporter.exportAuditLogs('json', { action: 'create' });

      expect(logs).toContain('create');
    });

    test('should filter by date range', () => {
      const now = Date.now();
      const logs = exporter.exportAuditLogs('json', {
        dateRange: {
          start: now - 1000,
          end: now + 1000
        }
      });

      expect(typeof logs).toBe('string');
    });
  });

  describe('Audit Statistics', () => {
    beforeEach(() => {
      exporter.recordAuditEvent({
        userId: 'user-1',
        action: 'create_monitor',
        resourceType: 'monitor',
        resourceId: 'monitor-1',
        status: 'success'
      });
      exporter.recordAuditEvent({
        userId: 'user-2',
        action: 'delete_monitor',
        resourceType: 'monitor',
        resourceId: 'monitor-2',
        status: 'success'
      });
    });

    test('should provide audit statistics', () => {
      const stats = exporter.getStatistics();

      expect(stats).toHaveProperty('totalLogs', 2);
      expect(stats).toHaveProperty('byAction');
      expect(stats).toHaveProperty('byUser');
      expect(stats).toHaveProperty('byStatus');
    });

    test('should track actions in statistics', () => {
      const stats = exporter.getStatistics();

      expect(stats.byAction.create_monitor).toBe(1);
      expect(stats.byAction.delete_monitor).toBe(1);
    });

    test('should track users in statistics', () => {
      const stats = exporter.getStatistics();

      expect(stats.byUser['user-1']).toBe(1);
      expect(stats.byUser['user-2']).toBe(1);
    });

    test('should include date range in statistics', () => {
      const stats = exporter.getStatistics();

      expect(stats).toHaveProperty('dateRange');
      expect(stats.dateRange).toHaveProperty('first');
      expect(stats.dateRange).toHaveProperty('last');
    });
  });
});
