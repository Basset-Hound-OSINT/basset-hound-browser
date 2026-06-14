/**
 * Basset Hound Browser - TypeScript Type Definitions v12.2.0
 * Complete type definitions for the JavaScript SDK
 */

/**
 * Configuration options for BrowserClient
 */
export interface BrowserClientOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Delay between reconnect attempts in milliseconds (default: 1000) */
  reconnectDelay?: number;
  /** Maximum number of retries for commands (default: 3) */
  maxRetries?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Represents the result of a command execution
 */
export interface CommandResponseData {
  id: string;
  command: string;
  success: boolean;
  data?: any;
  error?: string | null;
  recovery?: RecoverySuggestion | null;
  executionTime?: number;
}

/**
 * Recovery suggestion provided in error responses
 */
export interface RecoverySuggestion {
  suggestion: string;
  alternativeCommands?: string[];
}

/**
 * Options for navigation commands
 */
export interface NavigationOptions {
  /** Wait time in milliseconds before returning */
  waitTime?: number;
  /** CSS selector to wait for before returning */
  waitFor?: string | null;
}

/**
 * Options for interaction commands (click, fill, etc.)
 */
export interface InteractionOptions {
  /** Humanize interaction with realistic delays (default: true) */
  humanize?: boolean;
}

/**
 * Options for screenshot commands
 */
export interface ScreenshotOptions {
  /** Image format: 'png' or 'jpeg' (default: 'png') */
  format?: 'png' | 'jpeg';
  /** JPEG quality 0-100 (default: 90) */
  quality?: number;
}

/**
 * Options for forensic screenshot
 */
export interface ForensicScreenshotOptions extends ScreenshotOptions {
  /** Include hash of screenshot (default: true) */
  includeHash?: boolean;
  /** Include digital signature (default: true) */
  includeSignature?: boolean;
}

/**
 * Options for content extraction
 */
export interface ExtractionOptions {
  /** Include lazy-loaded images (default: true) */
  includeLazy?: boolean;
  /** Include external links (default: true) */
  includeExternal?: boolean;
}

/**
 * Cookie options for setCookie command
 */
export interface CookieOptions {
  [key: string]: any;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Credentials for proxy authentication
 */
export interface ProxyCredentials {
  username?: string;
  password?: string;
}

/**
 * Session information
 */
export interface SessionInfo {
  connected: boolean;
  sessionId: string | null;
  currentCheckpoint: string | null;
  checkpointCount: number;
}

/**
 * Monitor configuration
 */
export interface MonitorConfig {
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  alerts?: Record<string, any>;
}

/**
 * Geo-lock configuration
 */
export interface GeoLockConfig {
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Recovery options for session resumption
 */
export interface RecoveryOptions {
  [key: string]: any;
}

/**
 * Checkpoint details
 */
export interface CheckpointDetails {
  checkpointId: string;
  timestamp: number;
  label?: string;
  description?: string;
  url?: string;
  state?: Record<string, any>;
}

/**
 * Command batch operation
 */
export interface BatchCommand {
  command: string;
  [key: string]: any;
}

/**
 * Batch command result
 */
export interface BatchResult {
  command: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

/**
 * Monitor alert configuration
 */
export interface MonitorAlertConfig {
  enabled?: boolean;
  types?: string[];
  threshold?: number;
}

/**
 * Event handler for client events
 */
export type EventHandler = (data?: any) => void;

/**
 * Event names that can be listened to
 */
export type EventName = 'connect' | 'disconnect' | 'error' | 'message';

/**
 * Command response wrapper class
 */
export class CommandResponse {
  id: string;
  command: string;
  success: boolean;
  data: any;
  error: string | null;
  recovery: RecoverySuggestion | null;
  executionTime: number;

  constructor(data?: Partial<CommandResponseData>);
  static fromJSON(data: CommandResponseData): CommandResponse;
  isSuccess(): boolean;
  isError(): boolean;
  hasRecovery(): boolean;
}

/**
 * Session checkpoint for saving and restoring browser state
 */
export class SessionCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  state: Record<string, any>;
  metadata: Record<string, any>;

  constructor(
    id: string,
    name: string,
    timestamp: number,
    state?: Record<string, any>
  );
  toJSON(): CheckpointDetails;
}

/**
 * Main Basset Hound Browser Client
 */
export class BrowserClient {
  wsUrl: string;
  timeout: number;
  autoReconnect: boolean;
  reconnectDelay: number;
  maxRetries: number;
  debug: boolean;
  connected: boolean;
  sessionId: string | null;

  constructor(wsUrl?: string, options?: BrowserClientOptions);

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<boolean>;

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>;

  /**
   * Send a command to the server
   * @param command Command name
   * @param kwargs Command parameters
   * @param retryCount Internal retry counter
   */
  sendCommand(
    command: string,
    kwargs?: Record<string, any>,
    retryCount?: number
  ): Promise<CommandResponse>;

  // ==========================================
  // NAVIGATION COMMANDS
  // ==========================================

  /**
   * Navigate to a URL
   * @param url Target URL
   * @param options Navigation options (waitTime, waitFor)
   */
  navigate(url: string, options?: NavigationOptions): Promise<CommandResponse>;

  /**
   * Go back to previous page
   */
  goBack(): Promise<CommandResponse>;

  /**
   * Go forward to next page
   */
  goForward(): Promise<CommandResponse>;

  /**
   * Refresh the current page
   * @param hard Force refresh without cache (default: false)
   */
  refresh(hard?: boolean): Promise<CommandResponse>;

  /**
   * Get the current URL
   */
  getUrl(): Promise<CommandResponse>;

  /**
   * Get the page title
   */
  getTitle(): Promise<CommandResponse>;

  // ==========================================
  // INTERACTION COMMANDS
  // ==========================================

  /**
   * Click an element
   * @param selector CSS selector
   * @param options Interaction options
   */
  click(selector: string, options?: InteractionOptions): Promise<CommandResponse>;

  /**
   * Fill a form field
   * @param selector CSS selector
   * @param value Value to fill
   * @param options Interaction options
   */
  fill(
    selector: string,
    value: string,
    options?: InteractionOptions
  ): Promise<CommandResponse>;

  /**
   * Type text into the page
   * @param text Text to type
   * @param options Options including selector and humanize flag
   */
  typeText(
    text: string,
    options?: { selector?: string; humanize?: boolean }
  ): Promise<CommandResponse>;

  /**
   * Scroll the page
   * @param options Scroll options (x, y, selector)
   */
  scroll(options?: {
    x?: number | null;
    y?: number | null;
    selector?: string | null;
    humanize?: boolean;
  }): Promise<CommandResponse>;

  /**
   * Hover over an element
   * @param selector CSS selector
   */
  hover(selector: string): Promise<CommandResponse>;

  /**
   * Wait for element to appear
   * @param selector CSS selector to wait for
   * @param timeout Wait timeout in milliseconds (default: 10000)
   */
  waitForElement(selector: string, timeout?: number): Promise<CommandResponse>;

  /**
   * Execute arbitrary JavaScript
   * @param script JavaScript code to execute
   */
  executeScript(script: string): Promise<CommandResponse>;

  // ==========================================
  // CONTENT EXTRACTION COMMANDS
  // ==========================================

  /**
   * Get the page content as HTML
   */
  getContent(): Promise<CommandResponse>;

  /**
   * Get the current page state
   */
  getPageState(): Promise<CommandResponse>;

  /**
   * Extract all links from the page
   * @param options Extraction options
   */
  extractLinks(options?: ExtractionOptions): Promise<CommandResponse>;

  /**
   * Extract all forms from the page
   */
  extractForms(): Promise<CommandResponse>;

  /**
   * Extract all images from the page
   * @param options Extraction options
   */
  extractImages(options?: ExtractionOptions): Promise<CommandResponse>;

  /**
   * Extract page metadata (title, description, og tags, etc.)
   */
  extractMetadata(): Promise<CommandResponse>;

  /**
   * Extract all content at once
   */
  extractAll(): Promise<CommandResponse>;

  /**
   * Detect technologies used on the page (frameworks, analytics, etc.)
   */
  detectTechnology(): Promise<CommandResponse>;

  /**
   * Identify CMS platform
   * @param html Optional HTML content to analyze
   */
  identifyCms(html?: string): Promise<CommandResponse>;

  /**
   * Identify analytics tools on the page
   * @param html Optional HTML content to analyze
   */
  identifyAnalytics(html?: string): Promise<CommandResponse>;

  // ==========================================
  // SCREENSHOT COMMANDS
  // ==========================================

  /**
   * Take a screenshot of the page
   * @param options Screenshot options (format, quality)
   */
  screenshot(options?: ScreenshotOptions): Promise<CommandResponse>;

  /**
   * Take a screenshot of the viewport only
   * @param options Screenshot options
   */
  screenshotViewport(options?: ScreenshotOptions): Promise<CommandResponse>;

  /**
   * Take a screenshot of the full page (scrollable)
   * @param options Screenshot options
   */
  screenshotFullPage(options?: ScreenshotOptions): Promise<CommandResponse>;

  /**
   * Take a screenshot of a specific element
   * @param selector CSS selector of element
   * @param options Screenshot options
   */
  screenshotElement(
    selector: string,
    options?: ScreenshotOptions
  ): Promise<CommandResponse>;

  /**
   * Take a forensic screenshot with hash and signature
   * @param options Forensic screenshot options
   */
  screenshotForensic(
    options?: ForensicScreenshotOptions
  ): Promise<CommandResponse>;

  // ==========================================
  // COOKIE & STORAGE COMMANDS
  // ==========================================

  /**
   * Get cookies for a URL
   * @param url URL to get cookies for
   */
  getCookies(url: string): Promise<CommandResponse>;

  /**
   * Set a cookie
   * @param name Cookie name
   * @param value Cookie value
   * @param options Cookie options (domain, path, expires, etc.)
   */
  setCookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): Promise<CommandResponse>;

  /**
   * Delete a cookie
   * @param name Cookie name
   */
  deleteCookie(name: string): Promise<CommandResponse>;

  /**
   * Get all local storage items
   */
  getLocalStorage(): Promise<CommandResponse>;

  /**
   * Get all session storage items
   */
  getSessionStorage(): Promise<CommandResponse>;

  // ==========================================
  // CHECKPOINT & SESSION MANAGEMENT
  // ==========================================

  /**
   * Create a checkpoint of the current session state
   * @param checkpointName Name for the checkpoint
   * @param description Optional description
   */
  createCheckpoint(
    checkpointName: string,
    description?: string | null
  ): Promise<CheckpointDetails>;

  /**
   * Rollback to a saved checkpoint
   * @param checkpointId Checkpoint ID to rollback to
   */
  rollbackToCheckpoint(checkpointId: string): Promise<any>;

  /**
   * List all checkpoints
   */
  listCheckpoints(): Promise<CheckpointDetails[]>;

  /**
   * Delete a checkpoint
   * @param checkpointId Checkpoint ID to delete
   */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  /**
   * Branch the session from a checkpoint
   * @param checkpointId Checkpoint to branch from
   * @param branchName Optional branch name
   */
  branchSession(checkpointId: string, branchName?: string | null): Promise<any>;

  /**
   * Resume a session from a checkpoint
   * @param checkpointId Checkpoint ID to resume from
   * @param recoveryOptions Recovery options
   */
  resumeSession(
    checkpointId: string,
    recoveryOptions?: RecoveryOptions
  ): Promise<any>;

  /**
   * Create a session checkpoint (Wave 14)
   * @param label Checkpoint label
   * @param description Checkpoint description
   */
  createSessionCheckpoint(label?: string, description?: string): Promise<CommandResponse>;

  /**
   * Get checkpoint details
   * @param checkpointId Checkpoint ID
   */
  getCheckpointDetails(checkpointId: string): Promise<CommandResponse>;

  /**
   * Delete a session checkpoint (Wave 14)
   * @param checkpointId Checkpoint ID
   */
  deleteSessionCheckpoint(checkpointId: string): Promise<CommandResponse>;

  /**
   * Branch session (Wave 14)
   * @param label Branch label
   */
  branchSessionWave14(label?: string): Promise<CommandResponse>;

  /**
   * List all branches
   */
  listBranches(): Promise<CommandResponse>;

  /**
   * Merge current branch
   */
  mergeBranch(): Promise<CommandResponse>;

  /**
   * Detect session failures
   */
  detectFailure(): Promise<CommandResponse>;

  /**
   * Get recovery strategies for a failure type
   * @param failureType Optional failure type
   */
  getRecoveryStrategies(failureType?: string | null): Promise<CommandResponse>;

  /**
   * Resume session (Wave 14)
   * @param checkpointId Checkpoint to resume from
   */
  resumeSessionWave14(checkpointId: string): Promise<CommandResponse>;

  /**
   * Export a checkpoint
   * @param checkpointId Checkpoint ID
   * @param format Export format (default: 'json')
   */
  exportCheckpoint(
    checkpointId: string,
    format?: string
  ): Promise<CommandResponse>;

  // ==========================================
  // EVASION & BOT DETECTION BYPASS
  // ==========================================

  /**
   * Apply a fingerprint profile
   * @param profileName Name of the profile to apply
   * @param options Additional fingerprint options
   */
  applyFingerprint(
    profileName: string,
    options?: Record<string, any>
  ): Promise<CommandResponse>;

  /**
   * Rotate the user agent
   */
  rotateUserAgent(): Promise<CommandResponse>;

  /**
   * Set a proxy for connections
   * @param proxyUrl Proxy URL (http/https/socks)
   * @param credentials Optional proxy credentials
   */
  setProxy(
    proxyUrl: string,
    credentials?: ProxyCredentials | null
  ): Promise<CommandResponse>;

  /**
   * Enable Tor connection
   */
  enableTor(): Promise<CommandResponse>;

  /**
   * Disable Tor connection
   */
  disableTor(): Promise<CommandResponse>;

  /**
   * Get proxy reputation score
   * @param proxyAddress Proxy address to check
   * @param sessionId Optional session ID
   */
  getProxyReputation(
    proxyAddress: string,
    sessionId?: string | null
  ): Promise<CommandResponse>;

  /**
   * Set geographic lock/spoofing
   * @param config Geo-lock configuration
   */
  setGeoLock(config?: GeoLockConfig): Promise<CommandResponse>;

  /**
   * Get proxy analytics
   * @param sessionId Optional session ID
   * @param aggregate Aggregate results (default: false)
   */
  getProxyAnalytics(
    sessionId?: string | null,
    aggregate?: boolean
  ): Promise<CommandResponse>;

  // ==========================================
  // BATCH OPERATIONS
  // ==========================================

  /**
   * Execute multiple commands in sequence
   * @param commands Array of command objects
   */
  batchCommands(commands: BatchCommand[]): Promise<CommandResponse[]>;

  // ==========================================
  // MONITORING & ANALYTICS
  // ==========================================

  /**
   * Start monitoring page changes
   * @param threshold Detection threshold
   */
  startMonitoring(threshold?: number): Promise<CommandResponse>;

  /**
   * Stop monitoring page changes
   */
  stopMonitoring(): Promise<CommandResponse>;

  /**
   * Check for page changes since last check
   */
  checkPageChanges(): Promise<CommandResponse>;

  /**
   * Add a monitor for a URL
   * @param url URL to monitor
   * @param name Monitor name
   * @param frequency Monitoring frequency (default: 'daily')
   * @param alerts Alert configuration
   */
  addMonitor(
    url: string,
    name: string,
    frequency?: string,
    alerts?: Record<string, any>
  ): Promise<CommandResponse>;

  /**
   * Remove a monitor
   * @param monitorId Monitor ID
   */
  removeMonitor(monitorId: string): Promise<CommandResponse>;

  /**
   * Update a monitor
   * @param monitorId Monitor ID
   * @param updates Monitor updates
   */
  updateMonitor(
    monitorId: string,
    updates: Record<string, any>
  ): Promise<CommandResponse>;

  /**
   * Get monitor details
   * @param monitorId Monitor ID
   */
  getMonitor(monitorId: string): Promise<CommandResponse>;

  /**
   * List all monitors
   * @param filter Filter options
   */
  listMonitors(filter?: Record<string, any>): Promise<CommandResponse>;

  /**
   * Pause a monitor
   * @param monitorId Monitor ID
   */
  pauseMonitor(monitorId: string): Promise<CommandResponse>;

  /**
   * Resume a monitor
   * @param monitorId Monitor ID
   */
  resumeMonitor(monitorId: string): Promise<CommandResponse>;

  /**
   * Manually check a monitor
   * @param monitorId Monitor ID
   */
  checkMonitor(monitorId: string): Promise<CommandResponse>;

  /**
   * Get monitor change history
   * @param monitorId Monitor ID
   */
  getMonitorChanges(monitorId: string): Promise<CommandResponse>;

  /**
   * Get monitor snapshots
   * @param monitorId Monitor ID
   */
  getMonitorSnapshots(monitorId: string): Promise<CommandResponse>;

  /**
   * Get monitor statistics
   * @param monitorId Monitor ID
   */
  getMonitorStats(monitorId: string): Promise<CommandResponse>;

  /**
   * Start the monitoring service
   */
  startMonitoringService(): Promise<CommandResponse>;

  /**
   * Stop the monitoring service
   */
  stopMonitoringService(): Promise<CommandResponse>;

  /**
   * Pause the monitoring service
   */
  pauseMonitoringService(): Promise<CommandResponse>;

  /**
   * Resume the monitoring service
   */
  resumeMonitoringService(): Promise<CommandResponse>;

  /**
   * Get monitoring service status
   */
  getMonitoringServiceStatus(): Promise<CommandResponse>;

  /**
   * Get monitoring service statistics
   */
  getMonitoringServiceStats(): Promise<CommandResponse>;

  /**
   * Configure monitor alerts
   * @param monitorId Monitor ID
   * @param alerts Alert configuration
   */
  configureMonitorAlerts(
    monitorId: string,
    alerts: MonitorAlertConfig
  ): Promise<CommandResponse>;

  /**
   * Run a monitor check immediately
   * @param monitorId Monitor ID
   */
  runMonitorCheck(monitorId: string): Promise<CommandResponse>;

  /**
   * Export all monitors
   */
  exportMonitors(): Promise<CommandResponse>;

  /**
   * Import monitors
   * @param data Monitor data to import
   * @param merge Merge with existing monitors (default: false)
   */
  importMonitors(data: any, merge?: boolean): Promise<CommandResponse>;

  /**
   * Cleanup old monitoring data
   * @param daysOld Delete data older than this many days (default: 30)
   */
  cleanupMonitoringData(daysOld?: number): Promise<CommandResponse>;

  /**
   * Clear all monitors
   */
  clearAllMonitors(): Promise<CommandResponse>;

  // ==========================================
  // UTILITY & HEALTH METHODS
  // ==========================================

  /**
   * Check if client is connected
   */
  isConnected(): boolean;

  /**
   * Get session information
   */
  getSessionInfo(): SessionInfo;

  /**
   * Health check - ping the server
   */
  healthCheck(): Promise<boolean>;

  // ==========================================
  // EVENT HANDLING
  // ==========================================

  /**
   * Listen to client events
   * @param event Event name (connect, disconnect, error, message)
   * @param handler Event handler function
   */
  on(event: EventName, handler: EventHandler): void;

  /**
   * Stop listening to client events
   * @param event Event name
   * @param handler Event handler function
   */
  off(event: EventName, handler: EventHandler): void;

  // ==========================================
  // ADVANCED STREAMING & BATCH (v12.2.0+)
  // ==========================================

  /**
   * Stream a command response for large payloads
   * @param command Command name
   * @param kwargs Command parameters
   * @param onChunk Callback for each chunk
   */
  streamCommand(
    command: string,
    kwargs?: Record<string, any>,
    onChunk?: (chunk: Buffer) => void
  ): Promise<Buffer>;

  /**
   * Execute multiple commands atomically
   * @param operations Array of command operations
   */
  batch(operations: BatchCommand[]): Promise<BatchResult[]>;
}

/**
 * Connection pool for managing multiple client connections
 */
export class ConnectionPool {
  maxConnections: number;
  clients: BrowserClient[];
  activeConnections: Set<BrowserClient>;

  constructor(wsUrl?: string, maxConnections?: number, options?: BrowserClientOptions);

  /**
   * Connect all clients in the pool
   */
  connectAll(): Promise<void>;

  /**
   * Get the least busy client
   */
  getLeastBusyClient(): BrowserClient;

  /**
   * Execute a command using a pooled client
   * @param command Command name
   * @param kwargs Command parameters
   */
  executeCommand(
    command: string,
    kwargs?: Record<string, any>
  ): Promise<CommandResponse>;

  /**
   * Close all connections
   */
  closeAll(): Promise<void>;

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    active: number;
    idle: number;
  };
}

// Re-export for CommonJS/ESM compatibility
export default BrowserClient;
