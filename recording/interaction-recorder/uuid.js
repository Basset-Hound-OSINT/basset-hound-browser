/**
 * Basset Hound Browser - Interaction Recorder UUID helper
 *
 * Extracted verbatim from recording/interaction-recorder.js
 * (modularization 2026-07-04). Resolves the optional `uuid` dependency,
 * falling back to a local RFC-4122-ish generator when it is unavailable.
 */

let uuidv4;
try {
  const uuid = require('uuid');
  uuidv4 = uuid.v4;
} catch (e) {
  uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

module.exports = { uuidv4 };
