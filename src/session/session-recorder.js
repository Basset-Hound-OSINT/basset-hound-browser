/**
 * Basset Hound Browser - Session Recording Harness
 * Records complete investigation sessions with timeline
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionRecorderHarness {
  constructor() {
    this.sessions = new Map();
    this.sessionDir = path.join(require('os').homedir(), '.basset-hound', 'sessions');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Start new session recording
   * @param {string} sessionName - Session identifier
   * @returns {Object} Session metadata
   */
  startSession(sessionName) {
    const sessionId = sessionName || `session-${Date.now()}`;

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already active`);
    }

    const session = {
      id: sessionId,
      startTime: Date.now(),
      commands: [],
      screenshots: [],
      events: [],
      metadata: {
        browser_version: '11.1.0',
        start_timestamp: new Date().toISOString()
      }
    };

    this.sessions.set(sessionId, session);

    return {
      success: true,
      sessionId,
      startTime: session.startTime
    };
  }

  /**
   * Record command execution
   * @param {string} sessionId - Session ID
   * @param {Object} command - Command details
   */
  recordCommand(sessionId, command) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const commandRecord = {
      timestamp: Date.now(),
      index: session.commands.length,
      command: command.command,
      parameters: command.parameters || {},
      response: command.response || null,
      duration: command.duration || 0,
      status: command.status || 'success'
    };

    session.commands.push(commandRecord);
    session.events.push({
      type: 'command',
      timestamp: commandRecord.timestamp,
      data: commandRecord
    });

    return { success: true, commandIndex: commandRecord.index };
  }

  /**
   * Record screenshot taken during session
   * @param {string} sessionId - Session ID
   * @param {string} screenshotPath - Path to screenshot file
   * @param {Object} context - Context information
   */
  recordScreenshot(sessionId, screenshotPath, context = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const screenshotRecord = {
      timestamp: Date.now(),
      index: session.screenshots.length,
      path: screenshotPath,
      context: {
        url: context.url,
        action: context.action,
        note: context.note,
        ...context
      }
    };

    session.screenshots.push(screenshotRecord);
    session.events.push({
      type: 'screenshot',
      timestamp: screenshotRecord.timestamp,
      data: screenshotRecord
    });

    return { success: true, screenshotIndex: screenshotRecord.index };
  }

  /**
   * Record custom event
   * @param {string} sessionId - Session ID
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   */
  recordEvent(sessionId, eventType, eventData = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: eventData
    };

    session.events.push(event);

    return { success: true, eventIndex: session.events.length - 1 };
  }

  /**
   * Get session timeline
   * @param {string} sessionId - Session ID
   * @returns {Array} Chronological event timeline
   */
  getSessionTimeline(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Sort events by timestamp
    const timeline = [...session.events].sort((a, b) => a.timestamp - b.timestamp);

    return timeline.map((event, index) => ({
      index,
      timestamp: new Date(event.timestamp).toISOString(),
      relativeTime: event.timestamp - session.startTime,
      type: event.type,
      summary: this.getEventSummary(event)
    }));
  }

  /**
   * Get human-readable event summary
   */
  getEventSummary(event) {
    switch (event.type) {
      case 'command':
        return `${event.data.command}(${Object.keys(event.data.parameters).join(', ')})`;
      case 'screenshot':
        return `Screenshot: ${event.data.context.action || 'captured'}`;
      default:
        return JSON.stringify(event.data);
    }
  }

  /**
   * End session and save to file
   * @param {string} sessionId - Session ID
   * @returns {Object} Saved session info
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const duration = Date.now() - session.startTime;

    session.metadata.end_timestamp = new Date().toISOString();
    session.metadata.duration_seconds = Math.round(duration / 1000);
    session.metadata.commands_executed = session.commands.length;
    session.metadata.screenshots_taken = session.screenshots.length;
    session.metadata.total_events = session.events.length;

    // Save to JSON file
    const filename = `${session.id}-${Date.now()}.json`;
    const filepath = path.join(this.sessionDir, filename);
    const sessionData = {
      metadata: session.metadata,
      commands: session.commands,
      screenshots: session.screenshots,
      timeline: session.events.map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        summary: this.getEventSummary(e)
      }))
    };

    fs.writeFileSync(filepath, JSON.stringify(sessionData, null, 2));

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(sessionData));
    const sha256 = hash.digest('hex');

    // Save hash for verification
    const hashFile = filepath.replace('.json', '.sha256');
    fs.writeFileSync(hashFile, sha256);

    this.sessions.delete(sessionId);

    return {
      success: true,
      sessionId,
      filename,
      filepath,
      duration: duration,
      durationSeconds: session.metadata.duration_seconds,
      commandsExecuted: session.commands.length,
      screenshotsTaken: session.screenshots.length,
      sha256
    };
  }

  /**
   * Export session for replay
   * @param {string} sessionId - Session ID
   * @returns {Object} Replay-ready session export
   */
  exportSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const timeline = [...session.events].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = session.startTime;

    const replayData = {
      metadata: session.metadata,
      replay_sequence: timeline.map(event => {
        const relativeTime = event.timestamp - startTime;

        return {
          wait_ms: relativeTime,
          type: event.type,
          command: event.data.command,
          parameters: event.data.parameters,
          screenshot_path: event.type === 'screenshot' ? event.data.path : null
        };
      })
    };

    return {
      success: true,
      replayData,
      totalSteps: replayData.replay_sequence.length,
      totalDuration: replayData.replay_sequence[replayData.replay_sequence.length - 1]?.wait_ms || 0
    };
  }

  /**
   * Replay session from export
   * @param {Object} replayData - Exported session data
   * @param {Function} commandExecutor - Function to execute commands
   * @returns {Promise} Replay complete
   */
  async replaySession(replayData, commandExecutor) {
    const steps = replayData.replay_sequence;
    const results = [];

    for (const step of steps) {
      // Wait for relative time
      if (step.wait_ms > 0) {
        await new Promise(resolve => setTimeout(resolve, step.wait_ms));
      }

      try {
        if (step.type === 'command') {
          const result = await commandExecutor(step.command, step.parameters);
          results.push({
            success: true,
            command: step.command,
            result
          });
        } else if (step.type === 'screenshot') {
          // Screenshot would be handled by external system
          results.push({
            type: 'screenshot',
            path: step.screenshot_path
          });
        }
      } catch (err) {
        results.push({
          success: false,
          command: step.command,
          error: err.message
        });
      }
    }

    return {
      success: true,
      stepsExecuted: results.length,
      results
    };
  }

  /**
   * List all saved sessions
   * @returns {Array} Session list with metadata
   */
  listSessions() {
    try {
      const files = fs.readdirSync(this.sessionDir);
      const sessions = [];

      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.sessionDir, file);
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

          sessions.push({
            filename: file,
            filepath,
            metadata: data.metadata,
            commandsCount: data.commands ? data.commands.length : 0,
            screenshotsCount: data.screenshots ? data.screenshots.length : 0
          });
        }
      });

      return sessions;
    } catch (err) {
      console.error('List sessions error:', err);
      return [];
    }
  }

  /**
   * Load session from file
   * @param {string} filename - Session filename
   * @returns {Object} Session data
   */
  loadSession(filename) {
    try {
      const filepath = path.join(this.sessionDir, filename);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      return {
        success: true,
        data,
        commands: data.commands,
        screenshots: data.screenshots,
        timeline: data.timeline
      };
    } catch (err) {
      throw new Error(`Load session failed: ${err.message}`);
    }
  }

  /**
   * Delete session file
   * @param {string} filename - Session filename
   */
  deleteSession(filename) {
    try {
      const filepath = path.join(this.sessionDir, filename);
      const hashFile = filepath.replace('.json', '.sha256');

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      if (fs.existsSync(hashFile)) {
        fs.unlinkSync(hashFile);
      }

      return { success: true, deleted: filename };
    } catch (err) {
      throw new Error(`Delete session failed: ${err.message}`);
    }
  }

  /**
   * Generate session report
   * @param {string} sessionId - Session ID
   * @returns {string} HTML report
   */
  generateReport(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const duration = Date.now() - session.startTime;
    const timeline = this.getSessionTimeline(sessionId);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Session Report - ${session.id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .summary { background-color: #f0f0f0; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Session Report</h1>
        <div class="summary">
          <p><strong>Session ID:</strong> ${session.id}</p>
          <p><strong>Duration:</strong> ${Math.round(duration / 1000)} seconds</p>
          <p><strong>Commands:</strong> ${session.commands.length}</p>
          <p><strong>Screenshots:</strong> ${session.screenshots.length}</p>
          <p><strong>Total Events:</strong> ${session.events.length}</p>
        </div>

        <h2>Timeline</h2>
        <table>
          <tr><th>Time</th><th>Relative</th><th>Type</th><th>Details</th></tr>
          ${timeline.map(e => `
            <tr>
              <td>${e.timestamp}</td>
              <td>${Math.round(e.relativeTime / 1000)}s</td>
              <td>${e.type}</td>
              <td>${e.summary}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;

    return html;
  }
}

module.exports = new SessionRecorderHarness();
