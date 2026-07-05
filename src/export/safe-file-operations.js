/**
 * Safe File Operations Module
 *
 * Provides resource-safe file operations with proper cleanup:
 * - Async file writes with cleanup
 * - Stream-based operations for large data
 * - File handle tracking and closure
 * - Memory-efficient batch writing
 *
 * @module src/export/safe-file-operations
 */

const fs = require('fs');
const path = require('path');
const { promises: fsPromises } = require('fs');

/**
 * Write data to file safely with guaranteed cleanup
 *
 * @param {string} filePath - Target file path
 * @param {string|Buffer} data - Data to write
 * @param {Object} options - Write options
 * @param {string} options.encoding - File encoding (default: 'utf8')
 * @param {boolean} options.ensureDir - Create directories if missing (default: true)
 * @returns {Promise<{success: boolean, filePath: string, size: number}>}
 */
async function writeFileAsync(filePath, data, options = {}) {
  const {
    encoding = 'utf8',
    ensureDir = true
  } = options;

  try {
    // Ensure directory exists
    if (ensureDir) {
      const dir = path.dirname(filePath);
      await fsPromises.mkdir(dir, { recursive: true });
    }

    // Write file
    await fsPromises.writeFile(filePath, data, encoding);

    // Get file size
    const stats = await fsPromises.stat(filePath);

    return {
      success: true,
      filePath,
      size: stats.size
    };
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * Write large data using streams for memory efficiency
 *
 * @param {string} filePath - Target file path
 * @param {Generator|AsyncIterable} dataGenerator - Data generator/stream
 * @param {Object} options - Stream options
 * @param {number} options.highWaterMark - Stream buffer size (default: 64KB)
 * @param {Function} options.onProgress - Progress callback (bytesWritten)
 * @returns {Promise<{success: boolean, filePath: string, totalBytes: number}>}
 */
async function writeFileStream(filePath, dataGenerator, options = {}) {
  const {
    highWaterMark = 64 * 1024,
    onProgress = null
  } = options;

  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath, {
      highWaterMark,
      encoding: 'utf8'
    });

    let totalBytes = 0;

    stream.on('drain', () => {
      // Data flushed, ready for more
    });

    stream.on('error', (error) => {
      stream.destroy();
      // Clean up partial file
      fs.unlink(filePath, () => {});
      reject(new Error(`Stream write error: ${error.message}`));
    });

    (async () => {
      try {
        for await (const chunk of dataGenerator) {
          if (!stream.write(chunk)) {
            // Backpressure: wait for drain
            await new Promise(resolve => stream.once('drain', resolve));
          }
          totalBytes += Buffer.byteLength(chunk, 'utf8');
          if (onProgress) onProgress(totalBytes);
        }

        stream.end();

        stream.on('finish', () => {
          resolve({
            success: true,
            filePath,
            totalBytes
          });
        });
      } catch (error) {
        stream.destroy();
        fs.unlink(filePath, () => {});
        reject(error);
      }
    })();
  });
}

/**
 * Batch write multiple files with resource pooling
 *
 * @param {Array<{path: string, data: string|Buffer}>} files - Files to write
 * @param {Object} options - Options
 * @param {number} options.maxConcurrent - Max concurrent writes (default: 5)
 * @returns {Promise<Array>} Results array
 */
async function batchWriteFiles(files, options = {}) {
  const { maxConcurrent = 5 } = options;

  const results = [];
  const queue = [...files];

  // Process queue with concurrency limit
  const workers = Array(Math.min(maxConcurrent, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;

      try {
        const result = await writeFileAsync(file.path, file.data);
        results.push({ ...file, result });
      } catch (error) {
        results.push({ ...file, error: error.message });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Read file with automatic cleanup
 *
 * @param {string} filePath - File path
 * @param {Object} options - Read options
 * @param {string} options.encoding - File encoding (default: 'utf8')
 * @returns {Promise<string|Buffer>}
 */
async function readFileAsync(filePath, options = {}) {
  const { encoding = 'utf8' } = options;

  try {
    return await fsPromises.readFile(filePath, encoding);
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Delete file safely
 *
 * @param {string} filePath - File path
 * @returns {Promise<boolean>}
 */
async function deleteFileAsync(filePath) {
  try {
    await fsPromises.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // File doesn't exist, not an error
    }
    throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
  }
}

/**
 * Get file statistics
 *
 * @param {string} filePath - File path
 * @returns {Promise<fs.Stats>}
 */
async function getFileStats(filePath) {
  try {
    return await fsPromises.stat(filePath);
  } catch (error) {
    throw new Error(`Failed to stat file ${filePath}: ${error.message}`);
  }
}

/**
 * Generator for reading file in chunks
 *
 * @param {string} filePath - File path
 * @param {number} chunkSize - Chunk size in bytes
 * @yields {string} File chunks
 */
async function* readFileChunks(filePath, chunkSize = 64 * 1024) {
  try {
    const fileHandle = await fsPromises.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(chunkSize);
      let bytesRead;

      while ((bytesRead = (await fileHandle.read(buffer, 0, chunkSize)).bytesRead) > 0) {
        yield buffer.subarray(0, bytesRead).toString('utf8');
      }
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    throw new Error(`Failed to read file chunks from ${filePath}: ${error.message}`);
  }
}

module.exports = {
  writeFileAsync,
  writeFileStream,
  batchWriteFiles,
  readFileAsync,
  deleteFileAsync,
  getFileStats,
  readFileChunks
};
