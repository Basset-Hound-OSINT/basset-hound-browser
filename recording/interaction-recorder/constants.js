/**
 * Basset Hound Browser - Interaction Recorder Constants
 *
 * Extracted verbatim from recording/interaction-recorder.js
 * (modularization 2026-07-04). Interaction types, recording states,
 * and sensitive-data masking patterns.
 */

/**
 * Interaction types
 */
const INTERACTION_TYPES = {
  MOUSE_MOVE: 'mouse_move',
  MOUSE_CLICK: 'mouse_click',
  MOUSE_DOWN: 'mouse_down',
  MOUSE_UP: 'mouse_up',
  MOUSE_WHEEL: 'mouse_wheel',
  KEY_DOWN: 'key_down',
  KEY_UP: 'key_up',
  KEY_PRESS: 'key_press',
  INPUT: 'input',
  CHANGE: 'change',
  FOCUS: 'focus',
  BLUR: 'blur',
  SCROLL: 'scroll',
  HOVER: 'hover',
  SELECT: 'select',
  NAVIGATION: 'navigation',
  LOAD: 'load',
  RESIZE: 'resize',
  VISIBILITY_CHANGE: 'visibility_change',
  CHECKPOINT: 'checkpoint',
  ANNOTATION: 'annotation'
};

/**
 * Recording state
 */
const RECORDING_STATE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPED: 'stopped'
};

/**
 * Sensitive data patterns for masking
 */
const SENSITIVE_PATTERNS = {
  PASSWORD: /password|passwd|pwd/i,
  EMAIL: /email|e-mail/i,
  PHONE: /phone|tel|mobile/i,
  SSN: /ssn|social.?security/i,
  CREDIT_CARD: /card|ccn|creditcard/i,
  CVV: /cvv|cvc|security.?code/i,
  PIN: /pin|pincode/i,
  TOKEN: /token|auth|bearer/i,
  API_KEY: /api.?key|apikey/i,
  SECRET: /secret|private/i
};

module.exports = {
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
};
