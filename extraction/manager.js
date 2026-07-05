/**
 * Basset Hound Browser - Content Extraction Manager (barrel)
 * Orchestrates comprehensive content extraction capabilities for HTML pages
 * Delegates specialized extraction tasks to focused processor modules.
 *
 * This file is a thin barrel: the implementation lives in `extraction/manager/`.
 * The public export surface (ExtractionManager + re-exported parsers) is unchanged.
 *
 * @module extraction/manager
 */

module.exports = require('./manager/index.js');
