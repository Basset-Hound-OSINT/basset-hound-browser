/**
 * Basset Hound Browser - Content Extraction Manager (assembler)
 * Assembles the ExtractionManager class with the re-exported metadata parsers,
 * preserving the historical public surface of `extraction/manager.js`.
 *
 * @module extraction/manager/index
 */

const {
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser
} = require('../parsers');
const { ExtractionManager } = require('./extraction-manager');

// Export the manager and parsers
module.exports = {
  ExtractionManager,
  // Re-export parsers for direct access if needed
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser
};
