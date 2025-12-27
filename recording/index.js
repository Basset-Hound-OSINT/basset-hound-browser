/**
 * Basset Hound Browser - Recording Module Index
 * Exports all recording-related classes and functions
 */

const { Action, ActionSerializer, ACTION_TYPES } = require('./action');
const { SessionRecordingManager, SessionRecording, RECORDING_STATE } = require('./session-recorder');
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require('./replay');
const RecordingStorage = require('./storage');

// Re-export screen recording (video) manager for backwards compatibility
const { RecordingManager: ScreenRecordingManager, RECORDING_FORMATS, QUALITY_PRESETS, RecordingState: ScreenRecordingState } = require('./manager');

module.exports = {
  // Action recording
  Action,
  ActionSerializer,
  ACTION_TYPES,

  // Session recording
  SessionRecordingManager,
  SessionRecording,
  RECORDING_STATE,

  // Replay
  ReplayEngine,
  REPLAY_STATE,
  ERROR_MODE,

  // Storage
  RecordingStorage,

  // Screen recording (video)
  ScreenRecordingManager,
  RECORDING_FORMATS,
  QUALITY_PRESETS,
  ScreenRecordingState
};
