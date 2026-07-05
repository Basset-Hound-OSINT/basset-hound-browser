/**
 * Basset Hound Browser - Session Recording Manager
 * Minimal stub for deployment compatibility
 */

const RECORDING_STATE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused'
};

class SessionRecordingManager {
  constructor(options = {}) {
    this.state = RECORDING_STATE.IDLE;
  }

  startRecording(params) {
    this.state = RECORDING_STATE.RECORDING;
    return { success: true, state: RECORDING_STATE.RECORDING };
  }

  stopRecording(params) {
    this.state = RECORDING_STATE.IDLE;
    return { success: true, state: RECORDING_STATE.IDLE };
  }

  pauseRecording() {
    this.state = RECORDING_STATE.PAUSED;
    return { success: true, state: RECORDING_STATE.PAUSED };
  }

  resumeRecording() {
    this.state = RECORDING_STATE.RECORDING;
    return { success: true, state: RECORDING_STATE.RECORDING };
  }

  getRecordingStatus() {
    return { state: this.state, recording: this.state === RECORDING_STATE.RECORDING };
  }
}

module.exports = { SessionRecordingManager, RECORDING_STATE };
