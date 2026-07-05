/**
 * Basset Hound Browser - Screen Recording Manager
 * Minimal stub for deployment compatibility
 * Full implementation in src/recording module
 */

const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPING: 'stopping'
};

class RecordingManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.state = RecordingState.IDLE;
  }

  start() {
    return { success: true, state: RecordingState.RECORDING };
  }

  stop() {
    return { success: true, state: RecordingState.IDLE };
  }

  pause() {
    return { success: true, state: RecordingState.PAUSED };
  }

  resume() {
    return { success: true, state: RecordingState.RECORDING };
  }

  getState() {
    return this.state;
  }
}

module.exports = { RecordingManager, RecordingState };
