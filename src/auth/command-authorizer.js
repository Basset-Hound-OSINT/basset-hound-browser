/**
 * Command-Level Authorization Framework
 *
 * Implements role-based access control for WebSocket commands.
 * All 164 commands are mapped to permission levels (0-3):
 * - Level 0: Public (no authentication required)
 * - Level 1: Basic (authenticated users)
 * - Level 2: Admin (sensitive data access)
 * - Level 3: SuperAdmin (code execution)
 */

const crypto = require('crypto');

class CommandAuthorizer {
  /**
   * Define command access control matrix
   * Maps all 164+ WebSocket commands to required permission levels
   */
  static COMMAND_PERMISSIONS = {
    // ========================================
    // LEVEL 0: Public Commands (no auth)
    // ========================================
    'ping': { level: 0, description: 'Health check' },
    'status': { level: 0, description: 'Server status' },
    'version': { level: 0, description: 'API version' },

    // ========================================
    // LEVEL 1: Basic Commands (authenticated)
    // ========================================

    // Navigation
    'navigate': { level: 1, description: 'Navigate to URL' },
    'go_back': { level: 1, description: 'Go back in history' },
    'go_forward': { level: 1, description: 'Go forward in history' },
    'refresh': { level: 1, description: 'Refresh page' },
    'stop_loading': { level: 1, description: 'Stop page loading' },

    // Interaction
    'click': { level: 1, description: 'Click element' },
    'double_click': { level: 1, description: 'Double click element' },
    'right_click': { level: 1, description: 'Right click element' },
    'scroll': { level: 1, description: 'Scroll page' },
    'scroll_element': { level: 1, description: 'Scroll element' },
    'hover': { level: 1, description: 'Hover over element' },
    'type_text': { level: 1, description: 'Type text' },
    'press_key': { level: 1, description: 'Press keyboard key' },
    'fill_form': { level: 1, description: 'Fill form fields' },
    'clear_input': { level: 1, description: 'Clear input field' },
    'submit_form': { level: 1, description: 'Submit form' },
    'focus_element': { level: 1, description: 'Focus element' },
    'blur_element': { level: 1, description: 'Blur element' },
    'drag_and_drop': { level: 1, description: 'Drag and drop' },
    'wait_for_selector': { level: 1, description: 'Wait for selector' },
    'wait_for_navigation': { level: 1, description: 'Wait for navigation' },
    'wait_for_load': { level: 1, description: 'Wait for page load' },

    // Screenshots
    'screenshot': { level: 1, description: 'Take screenshot' },
    'screenshot_viewport': { level: 1, description: 'Screenshot viewport' },
    'screenshot_full_page': { level: 1, description: 'Full page screenshot' },
    'screenshot_element': { level: 1, description: 'Screenshot element' },
    'screenshot_clip': { level: 1, description: 'Screenshot clip region' },
    'screenshot_annotate': { level: 1, description: 'Annotated screenshot' },

    // Basic state
    'get_url': { level: 1, description: 'Get current URL' },
    'get_title': { level: 1, description: 'Get page title' },
    'get_page_state': { level: 1, description: 'Get page state' },
    'get_viewport': { level: 1, description: 'Get viewport size' },
    'set_viewport': { level: 1, description: 'Set viewport size' },
    'get_device_pixel_ratio': { level: 1, description: 'Get pixel ratio' },
    'is_element_visible': { level: 1, description: 'Check element visibility' },
    'get_element_dimensions': { level: 1, description: 'Get element dimensions' },
    'get_element_position': { level: 1, description: 'Get element position' },
    'wait_for_timeout': { level: 1, description: 'Wait for timeout' },

    // Window management
    'new_tab': { level: 1, description: 'Create new tab' },
    'close_tab': { level: 1, description: 'Close tab' },
    'get_active_tab': { level: 1, description: 'Get active tab' },
    'switch_tab': { level: 1, description: 'Switch tab' },
    'list_tabs': { level: 1, description: 'List all tabs' },
    'get_tab_info': { level: 1, description: 'Get tab info' },
    'get_all_tabs': { level: 1, description: 'Get all tabs info' },

    // Window control
    'new_window': { level: 1, description: 'Open new window' },
    'close_window': { level: 1, description: 'Close window' },
    'minimize_window': { level: 1, description: 'Minimize window' },
    'maximize_window': { level: 1, description: 'Maximize window' },
    'restore_window': { level: 1, description: 'Restore window' },
    'set_window_position': { level: 1, description: 'Set window position' },
    'set_window_size': { level: 1, description: 'Set window size' },
    'get_window_info': { level: 1, description: 'Get window info' },
    'list_windows': { level: 1, description: 'List windows' },

    // Session/profile management
    'create_session': { level: 1, description: 'Create session' },
    'activate_session': { level: 1, description: 'Activate session' },
    'list_sessions': { level: 1, description: 'List sessions' },
    'get_session_info': { level: 1, description: 'Get session info' },
    'delete_session': { level: 1, description: 'Delete session' },
    'clone_session': { level: 1, description: 'Clone session' },
    'create_profile': { level: 1, description: 'Create profile' },
    'set_profile': { level: 1, description: 'Set profile' },
    'list_profiles': { level: 1, description: 'List profiles' },
    'get_profile': { level: 1, description: 'Get profile' },
    'delete_profile': { level: 1, description: 'Delete profile' },
    'get_profile_names': { level: 1, description: 'Get profile names' },

    // Proxy management
    'set_proxy': { level: 1, description: 'Set proxy' },
    'get_proxy_status': { level: 1, description: 'Get proxy status' },
    'clear_proxy': { level: 1, description: 'Clear proxy' },
    'get_proxy_list': { level: 1, description: 'Get proxy list' },
    'rotate_proxy': { level: 1, description: 'Rotate proxy' },
    'add_proxy': { level: 1, description: 'Add proxy' },
    'remove_proxy': { level: 1, description: 'Remove proxy' },

    // User agent management
    'set_user_agent': { level: 1, description: 'Set user agent' },
    'get_user_agent_status': { level: 1, description: 'Get user agent status' },
    'get_user_agent': { level: 1, description: 'Get user agent' },
    'random_user_agent': { level: 1, description: 'Random user agent' },
    'set_user_agent_category': { level: 1, description: 'Set UA category' },

    // Header management
    'set_header': { level: 1, description: 'Set HTTP header' },
    'get_headers': { level: 1, description: 'Get headers' },
    'remove_header': { level: 1, description: 'Remove header' },
    'clear_headers': { level: 1, description: 'Clear headers' },

    // Request interception
    'set_block_rules': { level: 1, description: 'Set block rules' },
    'get_block_rules': { level: 1, description: 'Get block rules' },
    'add_block_rule': { level: 1, description: 'Add block rule' },
    'remove_block_rule': { level: 1, description: 'Remove block rule' },
    'set_request_interception': { level: 1, description: 'Enable request interception' },
    'handle_interception_request': { level: 1, description: 'Handle intercepted request' },
    'abort_request': { level: 1, description: 'Abort request' },

    // History management
    'get_history': { level: 1, description: 'Get browse history' },
    'clear_history': { level: 1, description: 'Clear history' },
    'clear_recent_history': { level: 1, description: 'Clear recent history' },

    // Downloads
    'get_downloads': { level: 1, description: 'Get downloads' },
    'clear_downloads': { level: 1, description: 'Clear downloads' },

    // Evasion
    'set_emulate_device': { level: 1, description: 'Emulate device' },
    'set_geolocation': { level: 1, description: 'Set geolocation' },
    'set_timezone': { level: 1, description: 'Set timezone' },
    'set_locale': { level: 1, description: 'Set locale' },
    'set_color_scheme': { level: 1, description: 'Set color scheme' },
    'set_platform': { level: 1, description: 'Set platform' },
    'set_reduced_motion': { level: 1, description: 'Set reduced motion' },
    'set_forced_colors': { level: 1, description: 'Set forced colors' },
    'set_prefers_contrast': { level: 1, description: 'Set contrast preference' },

    // Fingerprinting
    'set_fingerprint': { level: 1, description: 'Set fingerprint' },
    'get_fingerprint_status': { level: 1, description: 'Get fingerprint status' },
    'spoof_webgl': { level: 1, description: 'Spoof WebGL' },
    'spoof_canvas': { level: 1, description: 'Spoof canvas' },
    'spoof_audio': { level: 1, description: 'Spoof audio' },
    'spoof_fonts': { level: 1, description: 'Spoof fonts' },
    'spoof_webrtc': { level: 1, description: 'Spoof WebRTC' },

    // Headless detection evasion
    'set_headless_mode': { level: 1, description: 'Set headless mode' },
    'get_headless_status': { level: 1, description: 'Get headless status' },

    // Memory and performance
    'get_memory_stats': { level: 1, description: 'Get memory stats' },
    'get_storage_stats': { level: 1, description: 'Get storage stats' },
    'get_performance_metrics': { level: 1, description: 'Get performance metrics' },
    'clear_memory': { level: 1, description: 'Clear memory' },
    'get_process_info': { level: 1, description: 'Get process info' },

    // DevTools and console
    'get_console_logs': { level: 1, description: 'Get console logs' },
    'clear_console': { level: 1, description: 'Clear console' },
    'get_devtools_status': { level: 1, description: 'Get DevTools status' },
    'get_console_status': { level: 1, description: 'Get console status' },
    'toggle_devtools': { level: 1, description: 'Toggle DevTools' },
    'toggle_console': { level: 1, description: 'Toggle console' },

    // Network monitoring
    'get_network_logs': { level: 1, description: 'Get network logs' },
    'get_network_intercepted': { level: 1, description: 'Get intercepted requests' },
    'clear_network_logs': { level: 1, description: 'Clear network logs' },
    'get_request_data': { level: 1, description: 'Get request data' },
    'get_response_data': { level: 1, description: 'Get response data' },

    // JavaScript execution (basic - no custom code execution)
    'get_page_title': { level: 1, description: 'Get page title' },
    'get_page_url': { level: 1, description: 'Get page URL' },
    'get_page_meta': { level: 1, description: 'Get page metadata' },
    'get_page_links': { level: 1, description: 'Get page links' },
    'get_page_forms': { level: 1, description: 'Get page forms' },
    'get_page_images': { level: 1, description: 'Get page images' },

    // Scripts
    'list_scripts': { level: 1, description: 'List scripts' },
    'get_script': { level: 1, description: 'Get script' },
    'get_blocking_stats': { level: 1, description: 'Get blocking stats' },
    'get_script_execution_log': { level: 1, description: 'Get script log' },

    // Technology detection
    'detect_technologies': { level: 1, description: 'Detect technologies' },
    'get_technology_status': { level: 1, description: 'Get tech status' },

    // Plugins
    'list_plugins': { level: 1, description: 'List plugins' },
    'enable_plugin': { level: 1, description: 'Enable plugin' },
    'disable_plugin': { level: 1, description: 'Disable plugin' },
    'get_plugin_status': { level: 1, description: 'Get plugin status' },
    'get_plugin_config': { level: 1, description: 'Get plugin config' },

    // ========================================
    // LEVEL 2: Admin Commands (sensitive data)
    // ========================================

    // Content extraction
    'extract_html': { level: 2, description: 'Extract page HTML' },
    'extract_text': { level: 2, description: 'Extract page text' },
    'extract_markdown': { level: 2, description: 'Extract page markdown' },
    'extract_structured_data': { level: 2, description: 'Extract structured data' },
    'extract_metadata': { level: 2, description: 'Extract metadata' },
    'get_dom_tree': { level: 2, description: 'Get DOM tree' },
    'get_page_html': { level: 2, description: 'Get full HTML' },
    'get_page_content': { level: 2, description: 'Get page content' },
    'get_text_content': { level: 2, description: 'Get text content' },
    'get_inner_html': { level: 2, description: 'Get element HTML' },
    'get_element_text': { level: 2, description: 'Get element text' },

    // Cookies and storage
    'get_cookies': { level: 2, description: 'Get cookies' },
    'get_all_cookies': { level: 2, description: 'Get all cookies' },
    'get_cookie': { level: 2, description: 'Get specific cookie' },
    'set_cookie': { level: 2, description: 'Set cookie' },
    'delete_cookie': { level: 2, description: 'Delete cookie' },
    'clear_cookies': { level: 2, description: 'Clear cookies' },
    'get_local_storage': { level: 2, description: 'Get local storage' },
    'set_local_storage': { level: 2, description: 'Set local storage' },
    'delete_local_storage': { level: 2, description: 'Delete storage' },
    'clear_local_storage': { level: 2, description: 'Clear storage' },
    'get_session_storage': { level: 2, description: 'Get session storage' },
    'set_session_storage': { level: 2, description: 'Set session storage' },
    'delete_session_storage': { level: 2, description: 'Delete session storage' },
    'clear_session_storage': { level: 2, description: 'Clear session storage' },

    // HTTP request inspection
    'get_request_headers': { level: 2, description: 'Get request headers' },
    'get_request_body': { level: 2, description: 'Get request body' },
    'get_response_headers': { level: 2, description: 'Get response headers' },
    'get_response_body': { level: 2, description: 'Get response body' },
    'get_all_requests': { level: 2, description: 'Get all requests' },
    'get_all_responses': { level: 2, description: 'Get all responses' },

    // Form data extraction
    'get_form_data': { level: 2, description: 'Get form data' },
    'get_form_fields': { level: 2, description: 'Get form fields' },
    'get_input_values': { level: 2, description: 'Get input values' },
    'get_textarea_values': { level: 2, description: 'Get textarea values' },
    'get_select_values': { level: 2, description: 'Get select values' },
    'get_form_validation': { level: 2, description: 'Get form validation' },

    // Forensics and analysis
    'export_session': { level: 2, description: 'Export session' },
    'export_evidence': { level: 2, description: 'Export evidence' },
    'analyze_page': { level: 2, description: 'Analyze page' },
    'generate_forensic_report': { level: 2, description: 'Generate report' },
    'get_forensic_data': { level: 2, description: 'Get forensic data' },
    'capture_forensic_evidence': { level: 2, description: 'Capture evidence' },
    'get_metadata_report': { level: 2, description: 'Get metadata report' },
    'get_network_analysis': { level: 2, description: 'Get network analysis' },
    'analyze_technologies': { level: 2, description: 'Analyze technologies' },
    'get_change_detection': { level: 2, description: 'Get change detection' },
    'detect_changes': { level: 2, description: 'Detect changes' },
    'compare_screenshots': { level: 2, description: 'Compare screenshots' },
    'get_dom_diff': { level: 2, description: 'Get DOM diff' },

    // Recording and replay
    'start_recording': { level: 2, description: 'Start recording' },
    'stop_recording': { level: 2, description: 'Stop recording' },
    'get_recording_status': { level: 2, description: 'Get recording status' },
    'list_recordings': { level: 2, description: 'List recordings' },
    'replay_session': { level: 2, description: 'Replay session' },
    'start_replay': { level: 2, description: 'Start replay' },
    'stop_replay': { level: 2, description: 'Stop replay' },
    'get_replay_status': { level: 2, description: 'Get replay status' },
    'get_session_recording': { level: 2, description: 'Get session recording' },
    'export_recording': { level: 2, description: 'Export recording' },
    'import_recording': { level: 2, description: 'Import recording' },

    // Advanced evasion settings (read-only)
    'get_evasion_config': { level: 2, description: 'Get evasion config' },
    'get_fingerprint_details': { level: 2, description: 'Get fingerprint details' },
    'get_behavioral_config': { level: 2, description: 'Get behavioral config' },

    // ========================================
    // LEVEL 3: SuperAdmin Commands (code execution)
    // ========================================

    // Custom code execution
    'execute_javascript': { level: 3, description: 'Execute JavaScript' },
    'execute_custom_script': { level: 3, description: 'Execute custom script' },
    'evaluate_expression': { level: 3, description: 'Evaluate expression' },
    'call_function': { level: 3, description: 'Call function' },
    'set_javascript_function': { level: 3, description: 'Set JS function' },
    'get_javascript_result': { level: 3, description: 'Get JS result' },

    // Advanced evasion configuration (write access)
    'set_evasion_config': { level: 3, description: 'Set evasion config' },
    'configure_fingerprint': { level: 3, description: 'Configure fingerprint' },
    'set_behavioral_config': { level: 3, description: 'Set behavioral config' },
    'register_custom_fingerprint': { level: 3, description: 'Register fingerprint' },

    // Recording script execution (write access)
    'create_recording': { level: 3, description: 'Create recording' },
    'save_recording': { level: 3, description: 'Save recording' },
    'delete_recording': { level: 3, description: 'Delete recording' },
    'modify_recording': { level: 3, description: 'Modify recording' },

    // Plugin management (write access)
    'install_plugin': { level: 3, description: 'Install plugin' },
    'uninstall_plugin': { level: 3, description: 'Uninstall plugin' },
    'configure_plugin': { level: 3, description: 'Configure plugin' },
    'reload_plugins': { level: 3, description: 'Reload plugins' },
    'set_plugin_config': { level: 3, description: 'Set plugin config' },

    // System administration
    'shutdown': { level: 3, description: 'Shutdown' },
    'restart': { level: 3, description: 'Restart' },
    'update_browser': { level: 3, description: 'Update browser' },
    'execute_system_command': { level: 3, description: 'Execute system command' },
    'set_system_config': { level: 3, description: 'Set system config' },
    'get_system_config': { level: 3, description: 'Get system config' }
  };

  /**
   * Constructor
   */
  constructor() {
    // Map to store client IDs -> permission level
    this.clientPermissions = new Map();
    // Map to store client IDs -> token hash
    this.clientTokens = new Map();
    // Audit log for authorization attempts
    this.auditLog = [];
  }

  /**
   * Set client permission level
   * @param {string} clientId - Unique client identifier
   * @param {number} level - Permission level (0-3)
   * @throws {Error} If level is invalid
   */
  setClientLevel(clientId, level) {
    if (!Number.isInteger(level) || level < 0 || level > 3) {
      throw new Error(`Invalid permission level: ${level}. Must be 0-3.`);
    }
    this.clientPermissions.set(clientId, level);
  }

  /**
   * Get client permission level
   * @param {string} clientId - Client identifier
   * @returns {number} Permission level (defaults to 0 if not set)
   */
  getClientLevel(clientId) {
    return this.clientPermissions.get(clientId) || 0;
  }

  /**
   * Check if client can execute command
   * @param {string} clientId - Client identifier
   * @param {string} command - Command name
   * @returns {Object} { allowed: boolean, error?: string, reason?: string }
   */
  canExecute(clientId, command) {
    const required = CommandAuthorizer.COMMAND_PERMISSIONS[command];

    if (!required) {
      return {
        allowed: false,
        error: `Unknown command: ${command}`,
        code: 'UNKNOWN_COMMAND'
      };
    }

    const clientLevel = this.getClientLevel(clientId);

    if (clientLevel < required.level) {
      this.logAuthAttempt(clientId, command, false, `Insufficient permissions (required: ${required.level}, have: ${clientLevel})`);
      return {
        allowed: false,
        error: `Permission denied for command '${command}'`,
        code: 'PERMISSION_DENIED',
        required: required.level,
        current: clientLevel
      };
    }

    this.logAuthAttempt(clientId, command, true);
    return { allowed: true };
  }

  /**
   * Get command description and required level
   * @param {string} command - Command name
   * @returns {Object} { description: string, level: number } or null
   */
  getCommandInfo(command) {
    return CommandAuthorizer.COMMAND_PERMISSIONS[command] || null;
  }

  /**
   * Get all commands at or below a permission level
   * @param {number} maxLevel - Maximum permission level
   * @returns {Object} Map of commands to info
   */
  getCommandsForLevel(maxLevel) {
    const commands = {};
    for (const [cmd, info] of Object.entries(CommandAuthorizer.COMMAND_PERMISSIONS)) {
      if (info.level <= maxLevel) {
        commands[cmd] = info;
      }
    }
    return commands;
  }

  /**
   * Register client authentication token (for audit logging)
   * @param {string} clientId - Client identifier
   * @param {string} token - Authentication token (will be hashed)
   */
  registerClientToken(clientId, token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    this.clientTokens.set(clientId, hash);
  }

  /**
   * Log authorization attempt for audit trail
   * @private
   */
  logAuthAttempt(clientId, command, allowed, reason = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      clientId: clientId,
      command: command,
      allowed: allowed,
      reason: reason,
      level: this.getClientLevel(clientId)
    };

    this.auditLog.push(entry);

    // Keep only last 1000 entries to prevent memory leak
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Get authorization audit log
   * @param {Object} options - Filter options
   * @returns {Array} Audit log entries
   */
  getAuditLog(options = {}) {
    let log = this.auditLog;

    if (options.clientId) {
      log = log.filter(entry => entry.clientId === options.clientId);
    }

    if (options.command) {
      log = log.filter(entry => entry.command === options.command);
    }

    if (options.allowed !== undefined) {
      log = log.filter(entry => entry.allowed === options.allowed);
    }

    if (options.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog = [];
  }

  /**
   * Get authorization statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalCommands: Object.keys(CommandAuthorizer.COMMAND_PERMISSIONS).length,
      commandsByLevel: {
        level0: Object.values(CommandAuthorizer.COMMAND_PERMISSIONS).filter(c => c.level === 0).length,
        level1: Object.values(CommandAuthorizer.COMMAND_PERMISSIONS).filter(c => c.level === 1).length,
        level2: Object.values(CommandAuthorizer.COMMAND_PERMISSIONS).filter(c => c.level === 2).length,
        level3: Object.values(CommandAuthorizer.COMMAND_PERMISSIONS).filter(c => c.level === 3).length
      },
      totalClients: this.clientPermissions.size,
      auditLogSize: this.auditLog.length
    };
  }
}

module.exports = { CommandAuthorizer };
