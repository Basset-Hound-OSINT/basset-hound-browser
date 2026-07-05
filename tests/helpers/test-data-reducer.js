/**
 * Test Data Reducer
 * Provides factory functions for test data with controlled sizes
 * Helps prevent heap exhaustion by keeping test data small but comprehensive
 */

const memoryUtils = require('./memory-utils');

class TestDataFactory {
  /**
   * Create sample array with controlled size
   * @param {number} size - Array size (will be reduced if exceeds MAX_ARRAY_LENGTH)
   * @param {Function} generator - Item generator function
   * @returns {Array}
   */
  static createArray(size, generator) {
    const actualSize = Math.min(size, memoryUtils.CONFIG.MAX_ARRAY_LENGTH);
    const arr = [];

    for (let i = 0; i < actualSize; i++) {
      arr.push(generator ? generator(i) : i);
    }

    if (size > actualSize) {
      console.log(`⚠️  Array reduced from ${size} to ${actualSize} items`);
    }

    return arr;
  }

  /**
   * Create sample object with string fields
   * @param {number} fieldCount - Number of fields
   * @param {number} stringSize - Size of each string field
   * @returns {Object}
   */
  static createObject(fieldCount = 10, stringSize = 100) {
    const obj = {};
    const maxStringSize = Math.min(stringSize, memoryUtils.CONFIG.MAX_STRING_LENGTH);

    for (let i = 0; i < fieldCount; i++) {
      const fieldName = `field_${i}`;
      obj[fieldName] = this.createString(maxStringSize);
    }

    return obj;
  }

  /**
   * Create string of specified size
   * @param {number} size - String size in characters
   * @returns {string}
   */
  static createString(size) {
    const maxSize = Math.min(size, memoryUtils.CONFIG.MAX_STRING_LENGTH);
    return 'x'.repeat(maxSize);
  }

  /**
   * Create buffer of specified size
   * @param {number} size - Buffer size in bytes
   * @returns {Buffer}
   */
  static createBuffer(size) {
    const maxSize = Math.min(size, memoryUtils.CONFIG.MAX_BUFFER_SIZE);
    return Buffer.alloc(maxSize, 'test-data');
  }

  /**
   * Create batch test data
   * @param {number} batchSize - Number of items per batch
   * @returns {Array}
   */
  static createBatch(batchSize) {
    const actualSize = memoryUtils.reduceBatchSize(batchSize);
    return this.createArray(actualSize, (i) => ({
      id: i,
      timestamp: Date.now(),
      data: `batch-item-${i}`
    }));
  }

  /**
   * Create screenshot data (mock)
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Buffer}
   */
  static createScreenshot(width = 1920, height = 1080) {
    const maxWidth = Math.min(width, memoryUtils.CONFIG.MAX_SCREENSHOT_SIZE);
    const maxHeight = Math.min(height, memoryUtils.CONFIG.MAX_SCREENSHOT_SIZE);

    // Simulate PNG header + minimal data
    const minDataSize = maxWidth * maxHeight * 4; // RGBA
    const reducedSize = Math.min(minDataSize, memoryUtils.CONFIG.MAX_BUFFER_SIZE);

    return Buffer.alloc(reducedSize, 'screenshot-data');
  }

  /**
   * Create URL list for testing
   * @param {number} count - Number of URLs
   * @returns {Array<string>}
   */
  static createUrlList(count) {
    const actualCount = Math.min(count, memoryUtils.CONFIG.MAX_ARRAY_LENGTH);
    const urls = [];

    for (let i = 0; i < actualCount; i++) {
      urls.push(`https://example-${i}.test/path?id=${i}`);
    }

    return urls;
  }

  /**
   * Create form data
   * @param {number} fieldCount - Number of form fields
   * @returns {Object}
   */
  static createFormData(fieldCount = 20) {
    const form = {};

    for (let i = 0; i < fieldCount; i++) {
      form[`field_${i}`] = `value_${i}`;
    }

    return form;
  }

  /**
   * Create response mock
   * @param {number} dataSize - Size of response body
   * @returns {Object}
   */
  static createResponse(dataSize = 10000) {
    const maxSize = Math.min(dataSize, memoryUtils.CONFIG.MAX_STRING_LENGTH);

    return {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'content-length': maxSize.toString()
      },
      body: JSON.stringify({
        data: 'x'.repeat(maxSize),
        timestamp: Date.now()
      })
    };
  }

  /**
   * Create error data
   * @returns {Error}
   */
  static createError(message = 'Test error', cause = null) {
    const err = new Error(message.substring(0, 100)); // Limit message length
    err.cause = cause;
    return err;
  }

  /**
   * Create log entry array
   * @param {number} count - Number of log entries
   * @returns {Array}
   */
  static createLogEntries(count) {
    const actualCount = Math.min(count, memoryUtils.CONFIG.MAX_ARRAY_LENGTH);
    const logs = [];

    for (let i = 0; i < actualCount; i++) {
      logs.push({
        timestamp: Date.now(),
        level: 'info',
        message: `Log entry ${i}`,
        data: {}
      });
    }

    return logs;
  }
}

/**
 * Cleanup helper for test data
 */
class TestDataCleanup {
  static cleanup() {
    // Clear any large arrays/objects created during test
    memoryUtils.clearCaches();

    // Force GC
    if (global.gc) {
      global.gc();
    }
  }

  static createCleanupHook(test) {
    if (test && typeof test.afterEach === 'function') {
      test.afterEach(() => {
        this.cleanup();
      });
    }
  }
}

module.exports = {
  TestDataFactory,
  TestDataCleanup,

  // Convenience exports
  createArray: TestDataFactory.createArray.bind(TestDataFactory),
  createObject: TestDataFactory.createObject.bind(TestDataFactory),
  createString: TestDataFactory.createString.bind(TestDataFactory),
  createBuffer: TestDataFactory.createBuffer.bind(TestDataFactory),
  createBatch: TestDataFactory.createBatch.bind(TestDataFactory),
  createScreenshot: TestDataFactory.createScreenshot.bind(TestDataFactory),
  createUrlList: TestDataFactory.createUrlList.bind(TestDataFactory),
  createFormData: TestDataFactory.createFormData.bind(TestDataFactory),
  createResponse: TestDataFactory.createResponse.bind(TestDataFactory),
  createError: TestDataFactory.createError.bind(TestDataFactory),
  createLogEntries: TestDataFactory.createLogEntries.bind(TestDataFactory)
};
