/**
 * Basset Hound Browser - Metadata & Forensic Capture
 * EXIF extraction, PDF metadata, file hashing, chain of custody
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class MetadataExtractor {
  constructor() {
    this.extractionDir = path.join(require('os').homedir(), 'tmp', '.basset-hound', 'metadata');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.extractionDir)) {
      fs.mkdirSync(this.extractionDir, { recursive: true });
    }
  }

  /**
   * Extract all metadata from a file
   * @param {Buffer|string} fileData - File buffer or path
   * @param {string} fileType - File type (image, pdf, document, etc.)
   * @returns {Promise} Complete metadata analysis
   */
  async extractMetadata(fileData, fileType = 'image') {
    try {
      let buffer;
      let filepath = null;

      if (typeof fileData === 'string') {
        filepath = fileData;
        buffer = fs.readFileSync(filepath);
      } else {
        buffer = fileData;
      }

      const metadata = {
        file: {
          size: buffer.length,
          hash: this.generateHashes(buffer),
          timestamp: new Date().toISOString()
        },
        extracted: {}
      };

      switch (fileType.toLowerCase()) {
      case 'image':
        metadata.extracted = await this.extractImageMetadata(buffer, filepath);
        break;
      case 'pdf':
        metadata.extracted = await this.extractPDFMetadata(buffer, filepath);
        break;
      case 'document':
        metadata.extracted = await this.extractDocumentMetadata(buffer);
        break;
      default:
        metadata.extracted = await this.extractGenericMetadata(buffer);
      }

      metadata.chain_of_custody = {
        extracted_at: new Date().toISOString(),
        extractor_version: '1.0.0',
        analysis_type: fileType
      };

      return metadata;
    } catch (err) {
      throw new Error(`Metadata extraction failed: ${err.message}`);
    }
  }

  /**
   * Extract EXIF data from image
   */
  async extractImageMetadata(buffer, filepath) {
    const metadata = {
      type: 'image',
      exif: {},
      basic: {}
    };

    try {
      // Basic image analysis from buffer
      const magicBytes = buffer.slice(0, 8);

      if (this.isPNG(magicBytes)) {
        metadata.format = 'PNG';
        metadata.basic = this.parsePNGBasicInfo(buffer);
      } else if (this.isJPEG(magicBytes)) {
        metadata.format = 'JPEG';
        metadata.basic = this.parseJPEGBasicInfo(buffer);
        metadata.exif = this.extractJPEGEXIF(buffer);
      } else if (this.isGIF(magicBytes)) {
        metadata.format = 'GIF';
        metadata.basic = this.parseGIFBasicInfo(buffer);
      } else if (this.isWebP(magicBytes)) {
        metadata.format = 'WebP';
        metadata.basic = this.parseWebPBasicInfo(buffer);
      }

      // EXIF timestamp parsing
      if (metadata.exif.DateTime) {
        metadata.timeline = this.parseEXIFTimestamp(metadata.exif.DateTime);
      }

      // Location extraction from EXIF
      if (metadata.exif.GPSLatitude && metadata.exif.GPSLongitude) {
        metadata.location = {
          latitude: metadata.exif.GPSLatitude,
          longitude: metadata.exif.GPSLongitude,
          altitude: metadata.exif.GPSAltitude || null
        };
      }

      // Camera information
      if (metadata.exif.Model || metadata.exif.Make) {
        metadata.camera = {
          make: metadata.exif.Make || 'Unknown',
          model: metadata.exif.Model || 'Unknown',
          iso: metadata.exif.ISOSpeedRatings || null,
          aperture: metadata.exif.FNumber || null,
          shutter_speed: metadata.exif.ExposureTime || null,
          focal_length: metadata.exif.FocalLength || null
        };
      }

    } catch (err) {
      metadata.error = err.message;
    }

    return metadata;
  }

  /**
   * Extract PDF metadata
   */
  async extractPDFMetadata(buffer, filepath) {
    const metadata = {
      type: 'pdf',
      document: {},
      properties: {},
      security: {}
    };

    try {
      // Parse PDF header and basic info
      const pdfStr = buffer.toString('binary', 0, Math.min(5000, buffer.length));

      // Extract metadata stream
      const metaMatch = pdfStr.match(/<<\s*\/Producer\s*\(([^)]+)\)|\/Creator\s*\(([^)]+)\)|\/Title\s*\(([^)]+)\)|\/Author\s*\(([^)]+)\)/g);

      if (metaMatch) {
        metaMatch.forEach(match => {
          if (match.includes('/Producer')) {
            metadata.document.producer = match.match(/\(([^)]+)\)/)?.[1] || 'Unknown';
          }
          if (match.includes('/Creator')) {
            metadata.document.creator = match.match(/\(([^)]+)\)/)?.[1] || 'Unknown';
          }
          if (match.includes('/Title')) {
            metadata.document.title = match.match(/\(([^)]+)\)/)?.[1] || 'Unknown';
          }
          if (match.includes('/Author')) {
            metadata.document.author = match.match(/\(([^)]+)\)/)?.[1] || 'Unknown';
          }
        });
      }

      // Extract creation and modification dates
      const creationMatch = pdfStr.match(/\/CreationDate\s*\(([^)]+)\)/);
      const modifyMatch = pdfStr.match(/\/ModDate\s*\(([^)]+)\)/);

      if (creationMatch) {
        metadata.timeline = {
          created: this.parsePDFDate(creationMatch[1]),
          created_raw: creationMatch[1]
        };
      }

      if (modifyMatch) {
        metadata.timeline = metadata.timeline || {};
        metadata.timeline.modified = this.parsePDFDate(modifyMatch[1]);
        metadata.timeline.modified_raw = modifyMatch[1];
      }

      // Security check
      metadata.security.encrypted = pdfStr.includes('/Encrypt');
      metadata.security.compressed = pdfStr.includes('/FlateDecode');

      // Page count estimation
      const pageMatch = pdfStr.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s*(\d+)/);
      if (pageMatch) {
        metadata.document.page_count = parseInt(pageMatch[1]);
      }

    } catch (err) {
      metadata.error = err.message;
    }

    return metadata;
  }

  /**
   * Extract generic document metadata
   */
  async extractDocumentMetadata(buffer) {
    const metadata = {
      type: 'document',
      properties: {}
    };

    try {
      // Check for Office document signatures
      if (this.isOfficeDocument(buffer)) {
        metadata.format = 'Office Document (DOCX/XLSX/PPTX)';
        metadata.properties = this.parseOfficeMetadata(buffer);
      } else if (this.isRTF(buffer)) {
        metadata.format = 'RTF';
        metadata.properties = this.parseRTFMetadata(buffer);
      }

    } catch (err) {
      metadata.error = err.message;
    }

    return metadata;
  }

  /**
   * Extract generic metadata
   */
  async extractGenericMetadata(buffer) {
    return {
      type: 'generic',
      size: buffer.length,
      encoding: this.detectEncoding(buffer)
    };
  }

  /**
   * Generate multiple hash types for chain of custody
   * Note: MD5 removed due to cryptographic vulnerability (CWE-327)
   */
  generateHashes(buffer) {
    const hashes = {};

    // SHA-256 (primary for forensic verification and security)
    const sha256 = crypto.createHash('sha256');
    sha256.update(buffer);
    hashes.sha256 = sha256.digest('hex');

    return hashes;
  }

  /**
   * File format detection helpers
   */
  isPNG(magicBytes) {
    return magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
  }

  isJPEG(magicBytes) {
    return magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
  }

  isGIF(magicBytes) {
    return magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
  }

  isWebP(magicBytes) {
    return magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 && magicBytes[8] === 0x57;
  }

  isOfficeDocument(buffer) {
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  isRTF(buffer) {
    return buffer.toString('ascii', 0, 5) === '{\\rtf';
  }

  /**
   * Parse PNG basic info
   */
  parsePNGBasicInfo(buffer) {
    const info = {};

    // PNG IHDR chunk at offset 8
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const bitDepth = buffer[24];
      const colorType = buffer[25];

      info.width = width;
      info.height = height;
      info.bit_depth = bitDepth;
      info.color_type = this.getColorType(colorType);
    }

    return info;
  }

  /**
   * Parse JPEG basic info
   */
  parseJPEGBasicInfo(buffer) {
    const info = {};
    let offset = 2;

    while (offset < buffer.length - 8) {
      const marker = buffer.readUInt16BE(offset);

      if ((marker & 0xFF00) === 0xFF00) {
        const length = buffer.readUInt16BE(offset + 2);

        // SOF marker (Start of Frame)
        if ((marker >= 0xFFC0 && marker <= 0xFFC3) || (marker >= 0xFFC5 && marker <= 0xFFC7) || (marker >= 0xFFC9 && marker <= 0xFFCB) || (marker >= 0xFFCD && marker <= 0xFFCF)) {
          info.height = buffer.readUInt16BE(offset + 5);
          info.width = buffer.readUInt16BE(offset + 7);
          info.components = buffer[offset + 9];
          break;
        }

        offset += length + 2;
      } else {
        offset++;
      }
    }

    return info;
  }

  /**
   * Parse GIF basic info
   */
  parseGIFBasicInfo(buffer) {
    const info = {};

    if (buffer.length >= 10) {
      info.width = buffer.readUInt16LE(6);
      info.height = buffer.readUInt16LE(8);
      info.version = buffer.toString('ascii', 3, 6);
    }

    return info;
  }

  /**
   * Parse WebP basic info
   */
  parseWebPBasicInfo(buffer) {
    const info = {};
    // WebP format parsing would require more detailed chunk analysis
    info.format = 'WebP';
    return info;
  }

  /**
   * Extract EXIF data from JPEG
   */
  extractJPEGEXIF(buffer) {
    const exif = {};

    try {
      // Look for APP1 marker (0xFFE1) which contains EXIF data
      let offset = 2;

      while (offset < buffer.length - 8) {
        const marker = buffer.readUInt16BE(offset);

        if (marker === 0xFFE1) {
          const length = buffer.readUInt16BE(offset + 2);
          const exifData = buffer.slice(offset + 4, offset + length + 2);

          // Check for EXIF header
          if (exifData.toString('ascii', 0, 4) === 'Exif') {
            // Parse TIFF header at offset 6
            const littleEndian = exifData[6] === 0x49;
            exif._littleEndian = littleEndian;

            // Parse IFD (Image File Directory)
            const ifdOffset = littleEndian ? exifData.readUInt32LE(10) : exifData.readUInt32BE(10);
            exif._raw_offset = ifdOffset;
          }

          break;
        }

        if ((marker & 0xFF00) === 0xFF00) {
          const length = buffer.readUInt16BE(offset + 2);
          offset += length + 2;
        } else {
          offset++;
        }
      }
    } catch (err) {
      // Silent fail for EXIF parsing
    }

    return exif;
  }

  /**
   * Parse EXIF timestamp
   */
  parseEXIFTimestamp(dateString) {
    // EXIF format: "2024:05:06 14:30:45"
    try {
      const match = dateString.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
        return {
          date: date.toISOString(),
          year: parseInt(match[1]),
          month: parseInt(match[2]),
          day: parseInt(match[3]),
          hour: parseInt(match[4]),
          minute: parseInt(match[5]),
          second: parseInt(match[6])
        };
      }
    } catch (err) {
      // Silent fail
    }

    return null;
  }

  /**
   * Parse PDF date format
   */
  parsePDFDate(dateString) {
    // PDF format: "D:20240506143045Z" or "D:20240506143045-05'00'"
    try {
      const match = dateString.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
        return date.toISOString();
      }
    } catch (err) {
      // Silent fail
    }

    return dateString;
  }

  /**
   * Parse Office document metadata
   */
  parseOfficeMetadata(buffer) {
    // Office documents are ZIP files, would need unzip to parse core.xml
    return {
      format: 'Office (DOCX/XLSX/PPTX)',
      note: 'Full metadata extraction requires ZIP parsing'
    };
  }

  /**
   * Parse RTF metadata
   */
  parseRTFMetadata(buffer) {
    const rtfStr = buffer.toString('ascii', 0, Math.min(2000, buffer.length));
    const metadata = {};

    const authorMatch = rtfStr.match(/\\author\s+([^}\\]+)/);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    const titleMatch = rtfStr.match(/\\title\s+([^}\\]+)/);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    const subjectMatch = rtfStr.match(/\\subject\s+([^}\\]+)/);
    if (subjectMatch) {
      metadata.subject = subjectMatch[1].trim();
    }

    return metadata;
  }

  /**
   * Detect text encoding
   */
  detectEncoding(buffer) {
    // Check for BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8';
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'UTF-16LE';
    }
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'UTF-16BE';
    }

    return 'Unknown';
  }

  /**
   * Get PNG color type name
   */
  getColorType(type) {
    const types = {
      0: 'Grayscale',
      2: 'RGB',
      3: 'Indexed Color',
      4: 'Grayscale + Alpha',
      6: 'RGBA'
    };
    return types[type] || 'Unknown';
  }

  /**
   * Build forensic timeline from metadata
   */
  buildForensicTimeline(metadata) {
    const events = [];

    if (metadata.timeline) {
      if (metadata.timeline.created) {
        events.push({
          timestamp: metadata.timeline.created,
          event: 'File Created',
          source: 'Metadata'
        });
      }

      if (metadata.timeline.modified) {
        events.push({
          timestamp: metadata.timeline.modified,
          event: 'File Modified',
          source: 'Metadata'
        });
      }
    }

    if (metadata.file && metadata.file.timestamp) {
      events.push({
        timestamp: metadata.file.timestamp,
        event: 'Metadata Extracted',
        source: 'System'
      });
    }

    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Generate forensic report
   */
  generateReport(metadata) {
    const timeline = this.buildForensicTimeline(metadata);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Metadata Forensic Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
          .hash-table { font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 3px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .timeline { background: #f0f0f0; padding: 10px; border-left: 4px solid #4CAF50; }
          .property { margin: 8px 0; }
          .label { font-weight: bold; color: #333; }
        </style>
      </head>
      <body>
        <h1>Metadata Forensic Report</h1>

        <h2>File Information</h2>
        <div class="property">
          <span class="label">Size:</span> ${metadata.file.size} bytes
        </div>
        <div class="property">
          <span class="label">Extraction Time:</span> ${metadata.file.timestamp}
        </div>

        <h2>Cryptographic Hash (Chain of Custody)</h2>
        <div class="hash-table">
          <div><strong>SHA-256:</strong> ${metadata.file.hash.sha256}</div>
        </div>

        ${metadata.extracted.camera ? `
          <h2>Camera Information</h2>
          <table>
            <tr><td class="label">Make:</td><td>${metadata.extracted.camera.make}</td></tr>
            <tr><td class="label">Model:</td><td>${metadata.extracted.camera.model}</td></tr>
            <tr><td class="label">ISO:</td><td>${metadata.extracted.camera.iso || 'N/A'}</td></tr>
            <tr><td class="label">Aperture:</td><td>${metadata.extracted.camera.aperture || 'N/A'}</td></tr>
            <tr><td class="label">Shutter Speed:</td><td>${metadata.extracted.camera.shutter_speed || 'N/A'}</td></tr>
            <tr><td class="label">Focal Length:</td><td>${metadata.extracted.camera.focal_length || 'N/A'}</td></tr>
          </table>
        ` : ''}

        ${metadata.extracted.location ? `
          <h2>Location (GPS)</h2>
          <div class="property">
            <span class="label">Latitude:</span> ${metadata.extracted.location.latitude}
          </div>
          <div class="property">
            <span class="label">Longitude:</span> ${metadata.extracted.location.longitude}
          </div>
          <div class="property">
            <span class="label">Altitude:</span> ${metadata.extracted.location.altitude || 'N/A'}
          </div>
        ` : ''}

        ${timeline.length > 0 ? `
          <h2>Forensic Timeline</h2>
          <table>
            <tr><th>Timestamp</th><th>Event</th><th>Source</th></tr>
            ${timeline.map(e => `
              <tr>
                <td>${e.timestamp}</td>
                <td>${e.event}</td>
                <td>${e.source}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}

        <h2>Chain of Custody</h2>
        <div class="timeline">
          <p><strong>Extracted:</strong> ${metadata.chain_of_custody.extracted_at}</p>
          <p><strong>Extractor Version:</strong> ${metadata.chain_of_custody.extractor_version}</p>
          <p><strong>Analysis Type:</strong> ${metadata.chain_of_custody.analysis_type}</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Save metadata to file
   */
  saveMetadata(metadata, basename = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = basename ? `metadata-${basename}-${timestamp}.json` : `metadata-${timestamp}.json`;
      const filepath = path.join(this.extractionDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));

      return {
        success: true,
        filename,
        filepath,
        metadata
      };
    } catch (err) {
      throw new Error(`Save metadata failed: ${err.message}`);
    }
  }
}

module.exports = MetadataExtractor;
