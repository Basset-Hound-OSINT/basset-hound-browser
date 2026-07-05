/**
 * Basset Hound Browser - Interaction Recorder (barrel)
 *
 * Phase 20: Page Interaction Recording for Forensic Playback and Test Automation
 *
 * Records all user interactions on a page for:
 * - Forensic investigation and replay
 * - Test automation script generation
 * - User behavior analysis
 * - Compliance documentation
 *
 * Features:
 * - Mouse movement tracking with throttling
 * - Click recording with element context
 * - Keyboard input with sensitive data masking
 * - Scroll position tracking
 * - Element interaction detection (fill, select, hover)
 * - Page navigation tracking
 * - Timeline management with checkpoints
 * - Export to multiple formats (JSON, Selenium, Puppeteer, Playwright)
 * - Playback verification
 * - Annotation support
 *
 * ---------------------------------------------------------------------------
 * Modularized 2026-07-04: this file is now a thin barrel. The implementation
 * was split (logic unchanged) into ./interaction-recorder/:
 *   - constants.js         INTERACTION_TYPES, RECORDING_STATE, SENSITIVE_PATTERNS
 *   - uuid.js              uuidv4 helper (optional `uuid` dep + fallback)
 *   - models.js            InteractionEvent, RecordingCheckpoint, InteractionRecording
 *   - script-exporters.js  Selenium / Puppeteer / Playwright code generators
 *   - interaction-recorder.js  InteractionRecorder class + convenience fns
 * The `module.exports` surface below is unchanged from the pre-split file.
 */

const {
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
} = require('./interaction-recorder/constants');
const {
  InteractionEvent,
  RecordingCheckpoint,
  InteractionRecording
} = require('./interaction-recorder/models');
const {
  InteractionRecorder,
  record,
  stop,
  getRecording,
  clear
} = require('./interaction-recorder/interaction-recorder');

module.exports = {
  InteractionRecorder,
  InteractionRecording,
  InteractionEvent,
  RecordingCheckpoint,
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS,
  // Convenience functions
  record,
  stop,
  getRecording,
  clear
};
