/**
 * Interaction Recording WebSocket Commands
 *
 * Phase 20: WebSocket API for interaction recording and playback
 *
 * Provides commands for:
 * - Starting/stopping interaction recording
 * - Pausing/resuming recording
 * - Creating checkpoints and annotations
 * - Exporting recordings to test scripts (Selenium, Puppeteer, Playwright)
 * - Timeline management
 * - Recording statistics
 * - Playback and verification
 */

const {
  InteractionRecorder,
  INTERACTION_TYPES,
  RECORDING_STATE
} = require('../../recording/interaction-recorder');

/**
 * Global interaction recorder instance
 */
let interactionRecorder = null;

/**
 * Active recordings storage (in-memory)
 */
const recordings = new Map();

/**
 * Initialize interaction recorder
 */
function initializeInteractionRecorder(options = {}) {
  if (!interactionRecorder) {
    interactionRecorder = new InteractionRecorder(options);

    // Set up event handlers
    interactionRecorder.on('recordingStarted', (data) => {
      console.log(`[InteractionRecorder] Recording started: ${data.id}`);
    });

    interactionRecorder.on('recordingStopped', (data) => {
      console.log(`[InteractionRecorder] Recording stopped: ${data.id} (${data.eventCount} events)`);
      // Store completed recording
      if (interactionRecorder.currentRecording) {
        recordings.set(data.id, interactionRecorder.currentRecording);
      }
    });

    interactionRecorder.on('checkpointCreated', (checkpoint) => {
      console.log(`[InteractionRecorder] Checkpoint created: ${checkpoint.name}`);
    });

    interactionRecorder.on('maxEventsReached', (data) => {
      console.warn(`[InteractionRecorder] Max events reached: ${data.maxEvents}`);
    });
  }

  return interactionRecorder;
}

/**
 * Get interaction recorder instance
 */
function getInteractionRecorder() {
  if (!interactionRecorder) {
    initializeInteractionRecorder();
  }
  return interactionRecorder;
}

/**
 * Register interaction recording commands
 */
function registerRecordingCommands(commandHandlers) {
  // Initialize recorder
  if (!interactionRecorder) {
    initializeInteractionRecorder();
  }

  /**
   * Start interaction recording
   *
   * Command: start_interaction_recording
   * Params:
   *   - name: string (optional)
   *   - description: string (optional)
   *   - startUrl: string (optional)
   *   - recordMouseMovements: boolean (optional, default: true)
   *   - recordScrolls: boolean (optional, default: true)
   *   - recordKeyboard: boolean (optional, default: true)
   *   - maskSensitiveData: boolean (optional, default: true)
   *   - recordElementContext: boolean (optional, default: true)
   *   - autoCheckpointInterval: number (optional, ms, 0 = disabled)
   *   - tags: array (optional)
   */
  commandHandlers.start_interaction_recording = async (params) => {
    try {
      const recorder = getInteractionRecorder();

      const result = recorder.startRecording({
        name: params.name,
        description: params.description,
        startUrl: params.startUrl,
        metadata: params.metadata,
        tags: params.tags
      });

      return {
        success: true,
        recordingId: result.recording.id,
        recording: result.recording,
        state: recorder.state
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Stop interaction recording
   *
   * Command: stop_interaction_recording
   * Params: none
   */
  commandHandlers.stop_interaction_recording = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const result = recorder.stopRecording();

      return {
        success: true,
        recording: result.recording,
        recordingId: result.recording.id,
        eventCount: result.recording.events.length,
        duration: result.recording.duration,
        stats: result.recording.stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Pause interaction recording
   *
   * Command: pause_interaction_recording
   * Params: none
   */
  commandHandlers.pause_interaction_recording = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const result = recorder.pauseRecording();

      return {
        success: true,
        state: result.state,
        recordingId: recorder.currentRecording?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Resume interaction recording
   *
   * Command: resume_interaction_recording
   * Params: none
   */
  commandHandlers.resume_interaction_recording = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const result = recorder.resumeRecording();

      return {
        success: true,
        state: result.state,
        recordingId: recorder.currentRecording?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get interaction timeline
   *
   * Command: get_interaction_timeline
   * Params:
   *   - startTime: number (optional, relative ms)
   *   - endTime: number (optional, relative ms)
   *   - type: string (optional, filter by event type)
   *   - offset: number (optional, pagination)
   *   - limit: number (optional, pagination, default: 100)
   */
  commandHandlers.get_interaction_timeline = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const result = recorder.getTimeline({
        startTime: params.startTime,
        endTime: params.endTime,
        type: params.type,
        offset: params.offset,
        limit: params.limit
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Export recording as script
   *
   * Command: export_recording_as_script
   * Params:
   *   - format: 'selenium' | 'puppeteer' | 'playwright' | 'json' (required)
   *   - includeHeader: boolean (optional, default: true)
   *   - includeSetup: boolean (optional, default: true)
   *   - includeWaits: boolean (optional, default: true)
   *   - pretty: boolean (optional, for JSON format)
   */
  commandHandlers.export_recording_as_script = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const format = (params.format || 'json').toLowerCase();

      let result;

      switch (format) {
        case 'selenium':
          result = recorder.exportAsSelenium({
            includeHeader: params.includeHeader,
            includeSetup: params.includeSetup,
            includeWaits: params.includeWaits
          });
          break;

        case 'puppeteer':
          result = recorder.exportAsPuppeteer({
            includeHeader: params.includeHeader,
            includeSetup: params.includeSetup,
            includeWaits: params.includeWaits
          });
          break;

        case 'playwright':
          result = recorder.exportAsPlaywright({
            includeHeader: params.includeHeader,
            includeSetup: params.includeSetup,
            includeWaits: params.includeWaits
          });
          break;

        case 'json':
        default:
          result = recorder.exportAsJSON({
            pretty: params.pretty
          });
          break;
      }

      return {
        success: true,
        ...result,
        recordingId: recorder.currentRecording?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Replay recording (verification mode)
   *
   * Command: replay_recording
   * Params:
   *   - recordingId: string (optional, uses current if not provided)
   *   - speed: number (optional, playback speed multiplier, default: 1.0)
   *   - skipMouseMovements: boolean (optional, default: true)
   *   - skipScrolls: boolean (optional, default: false)
   *   - startFrom: number (optional, event index to start from)
   *   - endAt: number (optional, event index to end at)
   */
  commandHandlers.replay_recording = async (params) => {
    try {
      // Note: This is a simplified replay command that returns the event sequence
      // Full replay would require integration with the replay engine
      const recorder = getInteractionRecorder();

      if (!recorder.currentRecording) {
        return {
          success: false,
          error: 'No recording available for replay'
        };
      }

      const recording = recorder.currentRecording;
      let events = recording.events;

      // Filter events based on options
      if (params.skipMouseMovements) {
        events = events.filter(e => e.type !== INTERACTION_TYPES.MOUSE_MOVE);
      }

      if (params.skipScrolls) {
        events = events.filter(e => e.type !== INTERACTION_TYPES.SCROLL);
      }

      // Apply range
      if (params.startFrom !== undefined || params.endAt !== undefined) {
        const start = params.startFrom || 0;
        const end = params.endAt !== undefined ? params.endAt : events.length;
        events = events.slice(start, end);
      }

      return {
        success: true,
        recordingId: recording.id,
        events: events.map(e => e.toJSON()),
        totalEvents: events.length,
        speed: params.speed || 1.0,
        message: 'Replay sequence prepared. Use with replay engine for execution.'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get recording statistics
   *
   * Command: get_recording_stats
   * Params: none
   */
  commandHandlers.get_recording_stats = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const result = recorder.getStats();

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Annotate recording
   *
   * Command: annotate_recording
   * Params:
   *   - text: string (required)
   *   - category: string (optional, e.g., 'note', 'issue', 'highlight')
   *   - relativeTime: number (optional, for retrospective annotation)
   *   - metadata: object (optional)
   */
  commandHandlers.annotate_recording = async (params) => {
    try {
      const recorder = getInteractionRecorder();

      if (!params.text) {
        return {
          success: false,
          error: 'Annotation text is required'
        };
      }

      const result = recorder.addAnnotation({
        text: params.text,
        category: params.category,
        relativeTime: params.relativeTime,
        metadata: params.metadata
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Create recording checkpoint
   *
   * Command: create_recording_checkpoint
   * Params:
   *   - name: string (optional)
   *   - description: string (optional)
   *   - capturePageState: boolean (optional)
   *   - captureScreenshot: boolean (optional)
   */
  commandHandlers.create_recording_checkpoint = async (params) => {
    try {
      const recorder = getInteractionRecorder();

      const result = recorder.createCheckpoint({
        name: params.name,
        description: params.description,
        pageState: params.pageState,
        screenshot: params.screenshot
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get recording status
   *
   * Command: get_recording_status
   * Params: none
   */
  commandHandlers.get_recording_status = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      const status = recorder.getStatus();

      return {
        success: true,
        ...status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record mouse movement (called from browser)
   *
   * Command: record_mouse_move
   * Params:
   *   - x, y: coordinates
   *   - clientX, clientY, pageX, pageY, screenX, screenY
   *   - element: object (optional)
   */
  commandHandlers.record_mouse_move = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      recorder.recordMouseMove(params);

      return {
        success: true,
        recorded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record mouse click (called from browser)
   *
   * Command: record_mouse_click
   */
  commandHandlers.record_mouse_click = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      recorder.recordClick(params);

      return {
        success: true,
        recorded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record keyboard input (called from browser)
   *
   * Command: record_keyboard_input
   */
  commandHandlers.record_keyboard_input = async (params) => {
    try {
      const recorder = getInteractionRecorder();

      switch (params.eventType) {
        case 'keydown':
          recorder.recordKeyDown(params);
          break;
        case 'keyup':
          recorder.recordKeyUp(params);
          break;
        case 'input':
          recorder.recordInput(params);
          break;
        default:
          return {
            success: false,
            error: `Unknown keyboard event type: ${params.eventType}`
          };
      }

      return {
        success: true,
        recorded: true,
        masked: recorder.shouldMaskInput(params)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record scroll (called from browser)
   *
   * Command: record_scroll
   */
  commandHandlers.record_scroll = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      recorder.recordScroll(params);

      return {
        success: true,
        recorded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record navigation (called from browser)
   *
   * Command: record_navigation
   */
  commandHandlers.record_navigation = async (params) => {
    try {
      const recorder = getInteractionRecorder();
      recorder.recordNavigation(params);

      return {
        success: true,
        recorded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record element interaction (called from browser)
   *
   * Command: record_element_interaction
   */
  commandHandlers.record_element_interaction = async (params) => {
    try {
      const recorder = getInteractionRecorder();

      switch (params.interactionType) {
        case 'focus':
          recorder.recordFocus(params);
          break;
        case 'blur':
          recorder.recordBlur(params);
          break;
        case 'hover':
          recorder.recordHover(params);
          break;
        case 'select':
          recorder.recordSelect(params);
          break;
        case 'change':
          recorder.recordChange(params);
          break;
        default:
          return {
            success: false,
            error: `Unknown interaction type: ${params.interactionType}`
          };
      }

      return {
        success: true,
        recorded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List all recordings
   *
   * Command: list_interaction_recordings
   * Params:
   *   - offset: number (optional)
   *   - limit: number (optional)
   */
  commandHandlers.list_interaction_recordings = async (params) => {
    try {
      const recordingList = Array.from(recordings.values()).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        startUrl: r.startUrl,
        duration: r.duration,
        eventCount: r.events.length,
        checkpointCount: r.checkpoints.length,
        startTime: r.startTime,
        endTime: r.endTime,
        stats: r.stats,
        tags: r.tags
      }));

      const offset = params.offset || 0;
      const limit = params.limit || 50;
      const total = recordingList.length;
      const paginatedList = recordingList.slice(offset, offset + limit);

      return {
        success: true,
        recordings: paginatedList,
        total: total,
        offset: offset,
        limit: limit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get recording by ID
   *
   * Command: get_interaction_recording
   * Params:
   *   - recordingId: string (required)
   */
  commandHandlers.get_interaction_recording = async (params) => {
    try {
      if (!params.recordingId) {
        return {
          success: false,
          error: 'Recording ID is required'
        };
      }

      const recording = recordings.get(params.recordingId);
      if (!recording) {
        return {
          success: false,
          error: 'Recording not found'
        };
      }

      return {
        success: true,
        recording: recording.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Delete recording
   *
   * Command: delete_interaction_recording
   * Params:
   *   - recordingId: string (required)
   */
  commandHandlers.delete_interaction_recording = async (params) => {
    try {
      if (!params.recordingId) {
        return {
          success: false,
          error: 'Recording ID is required'
        };
      }

      const deleted = recordings.delete(params.recordingId);
      if (!deleted) {
        return {
          success: false,
          error: 'Recording not found'
        };
      }

      return {
        success: true,
        recordingId: params.recordingId,
        message: 'Recording deleted'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  console.log('[InteractionRecorder] 20 recording commands registered');
}

module.exports = {
  registerRecordingCommands,
  initializeInteractionRecorder,
  getInteractionRecorder
};
