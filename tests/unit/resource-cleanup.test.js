/**
 * Resource Cleanup Unit Tests
 *
 * Tests for safe file operations, resource management, and data streaming
 *
 * @module tests/unit/resource-cleanup
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  writeFileAsync,
  writeFileStream,
  batchWriteFiles,
  readFileAsync,
  deleteFileAsync,
  readFileChunks
} = require('../../src/export/safe-file-operations');

const { ResourceManager, getGlobalResourceManager } = require('../../src/export/resource-manager');

const {
  streamJsonArray,
  streamCsvRows,
  batchRecords,
  filterRecords,
  mapRecords,
  paginateRecords,
  chunkData,
  deduplicateRecords
} = require('../../src/export/data-streaming');

describe('Resource Cleanup - Safe File Operations', () => {
  const testDir = path.join(__dirname, '../../tmp/resource-cleanup-tests');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('writeFileAsync', () => {
    it('should write file asynchronously', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const data = 'Hello, World!';

      const result = await writeFileAsync(filePath, data);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.filePath, filePath);
      assert.ok(result.size > 0);
      assert.strictEqual(fs.readFileSync(filePath, 'utf8'), data);
    });

    it('should create directories if needed', async () => {
      const filePath = path.join(testDir, 'deep', 'nested', 'path', 'test.txt');
      const data = 'Nested content';

      const result = await writeFileAsync(filePath, data);

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));
    });

    it('should handle buffer data', async () => {
      const filePath = path.join(testDir, 'buffer.bin');
      const data = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);

      const result = await writeFileAsync(filePath, data);

      assert.strictEqual(result.success, true);
      const written = fs.readFileSync(filePath);
      assert.deepStrictEqual(written, data);
    });

    it('should handle large files', async () => {
      const filePath = path.join(testDir, 'large.txt');
      const data = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const result = await writeFileAsync(filePath, data);

      assert.strictEqual(result.success, true);
      assert.ok(result.size >= 10 * 1024 * 1024);
    });
  });

  describe('writeFileStream', () => {
    async function* simpleGenerator(items) {
      for (const item of items) {
        yield JSON.stringify(item) + '\n';
      }
    }

    it('should write file using stream', async () => {
      const filePath = path.join(testDir, 'stream.jsonl');
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      const result = await writeFileStream(
        filePath,
        simpleGenerator(items)
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.totalBytes > 0);
      assert.ok(fs.existsSync(filePath));
    });

    it('should track progress', async () => {
      const filePath = path.join(testDir, 'progress.jsonl');
      const items = Array(100).fill(null).map((_, i) => ({ id: i }));
      let lastProgress = 0;
      const progressUpdates = [];

      const result = await writeFileStream(
        filePath,
        simpleGenerator(items),
        {
          onProgress: (bytes) => {
            progressUpdates.push(bytes);
            lastProgress = bytes;
          }
        }
      );

      assert.strictEqual(result.success, true);
      assert.ok(progressUpdates.length > 0);
      assert.strictEqual(lastProgress, result.totalBytes);
    });
  });

  describe('batchWriteFiles', () => {
    it('should write multiple files', async () => {
      const files = [
        { path: path.join(testDir, 'file1.txt'), data: 'File 1' },
        { path: path.join(testDir, 'file2.txt'), data: 'File 2' },
        { path: path.join(testDir, 'file3.txt'), data: 'File 3' }
      ];

      const results = await batchWriteFiles(files);

      assert.strictEqual(results.length, 3);
      assert(results.every(r => !r.error));
      assert.ok(fs.existsSync(files[0].path));
      assert.ok(fs.existsSync(files[1].path));
      assert.ok(fs.existsSync(files[2].path));
    });

    it('should respect concurrency limit', async () => {
      const files = Array(10).fill(null).map((_, i) => ({
        path: path.join(testDir, `file${i}.txt`),
        data: `Content ${i}`
      }));

      const results = await batchWriteFiles(files, { maxConcurrent: 3 });

      assert.strictEqual(results.length, 10);
      assert(results.every(r => !r.error));
    });
  });

  describe('readFileAsync', () => {
    it('should read file content', async () => {
      const filePath = path.join(testDir, 'read.txt');
      const data = 'Test content';
      fs.writeFileSync(filePath, data);

      const content = await readFileAsync(filePath);

      assert.strictEqual(content, data);
    });

    it('should handle non-existent files', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      try {
        await readFileAsync(filePath);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to read'));
      }
    });
  });

  describe('deleteFileAsync', () => {
    it('should delete file', async () => {
      const filePath = path.join(testDir, 'delete.txt');
      fs.writeFileSync(filePath, 'content');

      const result = await deleteFileAsync(filePath);

      assert.strictEqual(result, true);
      assert.ok(!fs.existsSync(filePath));
    });

    it('should not error if file does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      const result = await deleteFileAsync(filePath);

      assert.strictEqual(result, true);
    });
  });

  describe('readFileChunks', () => {
    it('should read file in chunks', async () => {
      const filePath = path.join(testDir, 'chunks.txt');
      const data = 'x'.repeat(1000);
      fs.writeFileSync(filePath, data);

      const chunks = [];
      for await (const chunk of readFileChunks(filePath, 100)) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length > 1);
      assert.strictEqual(chunks.join(''), data);
    });
  });
});

describe('Resource Cleanup - Resource Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new ResourceManager({ maxMemory: 1024 * 1024 }); // 1MB
  });

  describe('register and release', () => {
    it('should register resource', () => {
      const resource = { data: 'test' };
      manager.register('test-1', resource);

      assert.strictEqual(manager.getResourceCount(), 1);
    });

    it('should release resource', () => {
      const resource = { data: 'test' };
      manager.register('test-1', resource);
      manager.release('test-1');

      assert.strictEqual(manager.getResourceCount(), 0);
    });

    it('should release all resources', () => {
      manager.register('r1', { data: 'test1' });
      manager.register('r2', { data: 'test2' });
      manager.register('r3', { data: 'test3' });

      manager.releaseAll();

      assert.strictEqual(manager.getResourceCount(), 0);
    });
  });

  describe('memory tracking', () => {
    it('should track memory usage', () => {
      const large = { data: 'x'.repeat(100000) };
      manager.register('large', large);

      const usage = manager.getMemoryUsage();

      assert.ok(usage.used > 0);
      assert.strictEqual(usage.max, 1024 * 1024);
      assert.ok(usage.percentage > 0);
    });

    it('should warn on high memory', () => {
      let warned = false;
      manager.onWarning = () => { warned = true; };

      const large = { data: 'x'.repeat(900000) };
      manager.register('large', large);
      manager.checkMemory();

      assert.strictEqual(warned, true);
    });

    it('should trigger cleanup on excess memory', () => {
      manager.register('r1', { data: 'x'.repeat(400000) });
      manager.register('r2', { data: 'x'.repeat(400000) });
      manager.register('r3', { data: 'x'.repeat(400000) });

      const beforeCount = manager.getResourceCount();
      const triggered = manager.checkMemory();

      assert.strictEqual(triggered, true);
      assert.ok(manager.getResourceCount() < beforeCount);
    });
  });

  describe('resource statistics', () => {
    it('should provide resource statistics', () => {
      manager.register('r1', { data: 'test1' });
      manager.register('r2', [1, 2, 3]);
      manager.register('r3', 'string');

      const stats = manager.getResourceStats();

      assert.strictEqual(stats.count, 3);
      assert.ok(stats.totalSize > 0);
      assert.ok(stats.largestResource);
      assert.ok(stats.oldestResource);
    });
  });
});

describe('Resource Cleanup - Data Streaming', () => {
  describe('streamJsonArray', () => {
    it('should stream JSON array', async () => {
      const array = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      const chunks = [];
      for await (const chunk of streamJsonArray(array)) {
        chunks.push(chunk);
      }

      const result = chunks.join('');
      assert.ok(result.includes('['));
      assert.ok(result.includes(']'));
      assert.ok(result.includes('Item 1'));
      assert.ok(result.includes('Item 2'));
    });
  });

  describe('streamCsvRows', () => {
    it('should stream CSV rows', async () => {
      const records = [
        { id: 1, name: 'Record 1' },
        { id: 2, name: 'Record 2' }
      ];
      const columns = ['id', 'name'];

      const rows = [];
      for await (const row of streamCsvRows(records, columns)) {
        rows.push(row);
      }

      assert.ok(rows[0].includes('id'));
      assert.ok(rows[0].includes('name'));
      assert.ok(rows[1].includes('1'));
    });

    it('should escape CSV fields', async () => {
      const records = [
        { id: 1, value: 'Contains, comma' },
        { id: 2, value: 'Contains "quotes"' }
      ];
      const columns = ['id', 'value'];

      const rows = [];
      for await (const row of streamCsvRows(records, columns)) {
        rows.push(row);
      }

      assert.ok(rows[1].includes('"Contains, comma"'));
      assert.ok(rows[2].includes('"Contains ""quotes"""'));
    });
  });

  describe('batchRecords', () => {
    it('should batch records', async () => {
      const records = Array(25).fill(null).map((_, i) => ({ id: i }));

      const batches = [];
      for await (const batch of batchRecords(records, 10)) {
        batches.push(batch);
      }

      assert.strictEqual(batches.length, 3);
      assert.strictEqual(batches[0].length, 10);
      assert.strictEqual(batches[2].length, 5);
    });
  });

  describe('filterRecords', () => {
    it('should filter records', async () => {
      const records = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: true }
      ];

      const filtered = [];
      for await (const record of filterRecords(records, r => r.active)) {
        filtered.push(record);
      }

      assert.strictEqual(filtered.length, 2);
      assert(filtered.every(r => r.active));
    });
  });

  describe('mapRecords', () => {
    it('should map records', async () => {
      const records = [
        { id: 1, value: 10 },
        { id: 2, value: 20 }
      ];

      const mapped = [];
      for await (const record of mapRecords(records, r => ({ ...r, value: r.value * 2 }))) {
        mapped.push(record);
      }

      assert.strictEqual(mapped[0].value, 20);
      assert.strictEqual(mapped[1].value, 40);
    });
  });

  describe('paginateRecords', () => {
    it('should paginate records', async () => {
      const records = Array(25).fill(null).map((_, i) => ({ id: i }));

      const pages = [];
      for await (const page of paginateRecords(records, 10)) {
        pages.push(page);
      }

      assert.strictEqual(pages.length, 3);
      assert.strictEqual(pages[0].data.length, 10);
      assert.strictEqual(pages[0].totalPages, 3);
      assert.strictEqual(pages[2].hasMore, false);
    });
  });

  describe('chunkData', () => {
    it('should chunk string data', async () => {
      const data = 'x'.repeat(1000);

      const chunks = [];
      for await (const chunk of chunkData(data, 100)) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length > 1);
      assert.strictEqual(chunks.join(''), data);
    });

    it('should chunk buffer data', async () => {
      const data = Buffer.from('x'.repeat(1000));

      const chunks = [];
      for await (const chunk of chunkData(data, 100)) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length > 1);
      assert.strictEqual(Buffer.concat(chunks).toString(), data.toString());
    });
  });

  describe('deduplicateRecords', () => {
    it('should deduplicate by field', async () => {
      const records = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 1, name: 'Item 1 Duplicate' }
      ];

      const unique = [];
      for await (const record of deduplicateRecords(records, 'id')) {
        unique.push(record);
      }

      assert.strictEqual(unique.length, 2);
    });

    it('should deduplicate by function', async () => {
      const records = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
        { email: 'user1@example.com' }
      ];

      const unique = [];
      for await (const record of deduplicateRecords(records, r => r.email.toLowerCase())) {
        unique.push(record);
      }

      assert.strictEqual(unique.length, 2);
    });
  });
});
