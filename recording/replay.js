/**
 * Basset Hound Browser - Replay Engine
 * Minimal stub for deployment compatibility
 */

const REPLAY_STATE = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped'
};

const ERROR_MODE = {
  IGNORE: 'ignore',
  WARN: 'warn',
  FAIL: 'fail'
};

class ReplayEngine {
  constructor(options = {}) {
    this.state = REPLAY_STATE.IDLE;
    this.errorMode = options.errorMode || ERROR_MODE.WARN;
  }

  play(recordingFile) {
    this.state = REPLAY_STATE.PLAYING;
    return { success: true, state: REPLAY_STATE.PLAYING };
  }

  pause() {
    this.state = REPLAY_STATE.PAUSED;
    return { success: true, state: REPLAY_STATE.PAUSED };
  }

  resume() {
    this.state = REPLAY_STATE.PLAYING;
    return { success: true, state: REPLAY_STATE.PLAYING };
  }

  stop() {
    this.state = REPLAY_STATE.STOPPED;
    return { success: true, state: REPLAY_STATE.STOPPED };
  }

  getState() {
    return this.state;
  }
}

module.exports = { ReplayEngine, REPLAY_STATE, ERROR_MODE };
