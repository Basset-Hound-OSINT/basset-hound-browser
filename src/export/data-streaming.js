/**
 * Data Streaming Utilities for Export Operations
 *
 * Provides generator-based streaming for efficient memory usage:
 * - Stream JSON arrays without loading into memory
 * - Stream CSV rows on demand
 * - Batch processing with generators
 * - Large dataset handling
 *
 * @module src/export/data-streaming
 */

/**
 * Generator for streaming JSON array
 * Yields objects one at a time instead of loading entire array
 *
 * @param {Array} array - Array to stream
 * @yields {string} JSON-formatted objects
 */
async function* streamJsonArray(array) {
  if (!Array.isArray(array)) {
    throw new Error('Input must be an array');
  }

  yield '[\n';

  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    const json = JSON.stringify(item);

    if (i === 0) {
      yield `  ${json}`;
    } else {
      yield `,\n  ${json}`;
    }

    // Yield control periodically to prevent blocking
    if (i % 1000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  yield '\n]';
}

/**
 * Generator for streaming CSV rows
 *
 * @param {Array<Object>} records - Records to stream
 * @param {Array<string>} columns - Column names
 * @param {Object} options - Stream options
 * @yields {string} CSV lines
 */
async function* streamCsvRows(records, columns, options = {}) {
  const { delimiter = ',', includeHeaders = true } = options;

  if (includeHeaders) {
    const escapedColumns = columns.map(col => escapeCsvField(col));
    yield escapedColumns.join(delimiter) + '\n';
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const values = columns.map(col => {
      const value = record[col] || '';
      return escapeCsvField(String(value));
    });

    yield values.join(delimiter) + '\n';

    // Yield control periodically
    if (i % 1000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

/**
 * Generator for batching records
 *
 * @param {Array} records - Records to batch
 * @param {number} batchSize - Size of each batch
 * @yields {Array} Batches of records
 */
async function* batchRecords(records, batchSize = 1000) {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));
    yield batch;

    // Yield control
    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Generator for filtering records
 *
 * @param {Array} records - Records to filter
 * @param {Function} predicate - Filter function
 * @yields {Object} Filtered records
 */
async function* filterRecords(records, predicate) {
  for (const record of records) {
    if (predicate(record)) {
      yield record;
    }

    // Yield control periodically
    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Generator for mapping records
 *
 * @param {Array|AsyncIterable} records - Records to map
 * @param {Function} mapper - Mapping function
 * @yields {*} Mapped records
 */
async function* mapRecords(records, mapper) {
  const isAsync = records[Symbol.asyncIterator] !== undefined;

  if (isAsync) {
    for await (const record of records) {
      yield mapper(record);
      await new Promise(resolve => setImmediate(resolve));
    }
  } else {
    for (const record of records) {
      yield mapper(record);
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

/**
 * Generator for paginating records
 *
 * @param {Array} records - Records to paginate
 * @param {number} pageSize - Page size
 * @yields {{data: Array, page: number, totalPages: number}} Pages
 */
async function* paginateRecords(records, pageSize = 100) {
  const totalPages = Math.ceil(records.length / pageSize);

  for (let page = 0; page < totalPages; page++) {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, records.length);
    const data = records.slice(start, end);

    yield {
      data,
      page,
      pageSize,
      totalPages,
      hasMore: end < records.length
    };

    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Generator for chunking data
 *
 * @param {string|Buffer} data - Data to chunk
 * @param {number} chunkSize - Size of each chunk in bytes
 * @yields {string|Buffer} Data chunks
 */
async function* chunkData(data, chunkSize = 64 * 1024) {
  const isBuffer = Buffer.isBuffer(data);

  for (let i = 0; i < data.length; i += chunkSize) {
    if (isBuffer) {
      yield data.subarray(i, Math.min(i + chunkSize, data.length));
    } else {
      yield data.substring(i, Math.min(i + chunkSize, data.length));
    }

    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Generator for deduplicating records based on key field
 *
 * @param {Array} records - Records to deduplicate
 * @param {string|Function} keyExtractor - Field name or function to extract key
 * @yields {Object} Unique records
 */
async function* deduplicateRecords(records, keyExtractor) {
  const seen = new Set();
  const isFunction = typeof keyExtractor === 'function';

  for (const record of records) {
    const key = isFunction ? keyExtractor(record) : record[keyExtractor];

    if (!seen.has(key)) {
      seen.add(key);
      yield record;
    }

    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Escape field for CSV output
 *
 * @param {string} field - Field to escape
 * @returns {string} Escaped field
 * @private
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }

  const str = String(field);

  // Quote field if it contains delimiter, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Compose multiple generators into pipeline
 *
 * @param {Array<Function>} generators - Generator functions
 * @param {*} initialData - Initial data
 * @returns {AsyncGenerator} Composed generator
 */
async function* pipeGenerators(generators, initialData) {
  let data = initialData;

  for (const gen of generators) {
    data = gen(data);
  }

  for await (const item of data) {
    yield item;
  }
}

module.exports = {
  streamJsonArray,
  streamCsvRows,
  batchRecords,
  filterRecords,
  mapRecords,
  paginateRecords,
  chunkData,
  deduplicateRecords,
  pipeGenerators
};
