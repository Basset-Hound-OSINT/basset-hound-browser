/**
 * Investigation Report Generator
 *
 * Main entry point for report generation.
 * Re-exports from specialized modules for backward compatibility.
 *
 * @module reporting/report-generator
 * @version 2.0.0
 */

// Re-export main generator from core module
const { ReportGenerator } = require('./generator-core');

// Re-export all formatters for backward compatibility
const {
  HTMLFormatter,
  JSONFormatter,
  MarkdownFormatter,
  CSVFormatter
} = require('./formatters');

// Re-export utilities for external use
const utils = require('./utilities');

module.exports = {
  // Main generator class
  ReportGenerator,

  // Formatter classes
  HTMLFormatter,
  JSONFormatter,
  MarkdownFormatter,
  CSVFormatter,

  // Utility functions (for direct import if needed)
  ...utils
};
