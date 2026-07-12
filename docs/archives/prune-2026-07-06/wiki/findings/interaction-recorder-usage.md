# Interaction Recorder - Quick Reference Guide

## Quick Start

### Basic Recording (Simple API)
```javascript
const { record, stop, getRecording, clear } = require('./recording/interaction-recorder');

// Start recording
record({ name: 'User Workflow', startUrl: 'https://example.com' });

// ... user interactions happen ...

// Get current recording
const data = getRecording();
console.log(data.recording.stats);

// Stop and get final recording
const result = stop();
console.log(result.recording);

// Clear recorder
clear();
```

### Advanced Recording (Class-based API)
```javascript
const { InteractionRecorder } = require('./recording/interaction-recorder');

const recorder = new InteractionRecorder({
  recordMouseMovements: true,
  mouseMoveThrottle: 100,
  recordScrolls: true,
  recordKeyboard: true,
  maskSensitiveData: true,
  maxEvents: 10000
});

// Start recording
recorder.startRecording({
  name: 'Login Flow',
  description: 'User login and dashboard navigation',
  startUrl: 'https://example.com/login'
});

// Record events
recorder.recordClick({
  x: 100,
  y: 200,
  element: { selector: '#login-btn', tagName: 'BUTTON' }
});

recorder.recordInput({
  value: 'user@example.com',
  element: { name: 'email', type: 'email' }
});

// Create checkpoint
recorder.createCheckpoint({
  name: 'Login Complete',
  description: 'User successfully logged in'
});

// Listen for events
recorder.on('eventRecorded', (event) => {
  console.log(`Event: ${event.type}`);
});

// Stop recording
const result = recorder.stopRecording();
console.log(`Recording ${result.recording.id} has ${result.recording.events.length} events`);

// Export to different formats
const jsonExport = recorder.exportAsJSON({ pretty: true });
const seleniumExport = recorder.exportAsSelenium();
const puppeteerExport = recorder.exportAsPuppeteer();
const playwrightExport = recorder.exportAsPlaywright();

// Cleanup
recorder.cleanup();
```

## Recording Events

### Mouse Events
```javascript
// Mouse move (throttled)
recorder.recordMouseMove({
  x: 100, y: 200,
  clientX: 100, clientY: 200,
  pageX: 100, pageY: 200,
  screenX: 100, screenY: 200
});

// Mouse click
recorder.recordClick({
  x: 100, y: 200,
  clientX: 100, clientY: 200,
  button: 'left',
  detail: 1,
  ctrlKey: false, shiftKey: false, altKey: false, metaKey: false
});

// Mouse down/up
recorder.recordMouseDown({ x: 100, y: 200, button: 'left' });
recorder.recordMouseUp({ x: 100, y: 200, button: 'left' });

// Mouse wheel
recorder.recordWheel({
  deltaX: 0, deltaY: 100, deltaZ: 0,
  deltaMode: 0
});

// Hover
recorder.recordHover({ x: 100, y: 200 });
```

### Keyboard Events
```javascript
// Key down
recorder.recordKeyDown({
  key: 'Enter',
  code: 'Enter',
  keyCode: 13,
  repeat: false
});

// Key up
recorder.recordKeyUp({
  key: 'Enter',
  code: 'Enter',
  keyCode: 13
});

// Input (text typed)
recorder.recordInput({
  value: 'Hello World',
  inputType: 'insertText',
  data: 'o'
});

// Change (form field value change)
recorder.recordChange({
  value: 'selected-option',
  checked: true
});

// Focus
recorder.recordFocus({});

// Blur
recorder.recordBlur({});
```

### Page Events
```javascript
// Navigation
recorder.recordNavigation({
  url: 'https://example.com/page',
  type: 'navigate' // or 'back', 'forward', 'reload'
});

// Page load
recorder.recordLoad({
  url: 'https://example.com',
  loadTime: 1234,
  readyState: 'complete'
});

// Window resize
recorder.recordResize({
  width: 1920, height: 1080,
  innerWidth: 1920, innerHeight: 1080,
  outerWidth: 1920, outerHeight: 1080
});

// Visibility change
recorder.recordVisibilityChange({
  hidden: false,
  visibilityState: 'visible'
});

// Scroll (throttled)
recorder.recordScroll({
  scrollX: 0, scrollY: 500,
  scrollLeft: 0, scrollTop: 500,
  scrollWidth: 1024, scrollHeight: 5000
});

// Select
recorder.recordSelect({
  value: 'option1',
  selectedIndex: 0,
  options: ['option1', 'option2']
});
```

## Configuration Options

```javascript
const recorder = new InteractionRecorder({
  // Mouse tracking
  recordMouseMovements: true,      // Track mouse position
  mouseMoveThrottle: 100,          // Milliseconds between events
  
  // Scroll tracking
  recordScrolls: true,             // Track scroll position
  scrollThrottle: 100,             // Milliseconds between events
  
  // Keyboard tracking
  recordKeyboard: true,            // Track keyboard input
  
  // Data protection
  maskSensitiveData: true,         // Mask passwords, emails, etc
  
  // Element tracking
  recordElementContext: true,      // Capture element selectors
  
  // Screenshots
  captureScreenshots: false,       // Store screenshot data
  screenshotOnCheckpoint: true,    // Screenshot at checkpoints
  
  // Limits
  maxEvents: 10000,                // Max events before stopping
  
  // Auto checkpoints
  autoCheckpointInterval: 0        // Auto-checkpoint interval (0=disabled)
});
```

## Querying Recordings

```javascript
// Get status
const status = recorder.getStatus();
console.log(status.state); // 'recording', 'paused', 'stopped', 'idle'

// Get timeline
const timeline = recorder.getTimeline({
  startTime: 0,
  endTime: 5000,
  type: 'mouse_click', // Filter by type
  offset: 0,
  limit: 100
});

// Get statistics
const stats = recorder.getStats();
console.log(stats.stats.totalEvents);
console.log(stats.stats.eventsPerSecond);

// Get events by type
const clicks = recorder.currentRecording.getEventsByType('mouse_click');

// Get events in time range
const events = recorder.currentRecording.getEventsInRange(0, 5000);
```

## Checkpoints & Annotations

```javascript
// Create checkpoint
const checkpoint = recorder.createCheckpoint({
  name: 'Login Complete',
  description: 'User successfully logged in',
  pageState: { /* ... */ },
  screenshot: null // Can include screenshot data
});

// Add annotation
const annotation = recorder.addAnnotation({
  text: 'User encountered login error',
  category: 'error', // or 'note', 'warning', 'success'
  metadata: { /* ... */ }
});
```

## Exports

### JSON Export
```javascript
const result = recorder.exportAsJSON({ pretty: true });
console.log(result.format); // 'json'
console.log(result.data);   // Stringified JSON
console.log(result.size);   // Bytes
console.log(result.filename); // 'Recording_XXXXX.json'
```

### Selenium Export
```javascript
const result = recorder.exportAsSelenium({
  includeHeader: true,
  includeSetup: true,
  includeWaits: true
});
// Returns Python Selenium script
```

### Puppeteer Export
```javascript
const result = recorder.exportAsPuppeteer({
  includeHeader: true,
  includeSetup: true,
  includeWaits: true
});
// Returns Node.js Puppeteer script
```

### Playwright Export
```javascript
const result = recorder.exportAsPlaywright({
  includeHeader: true,
  includeSetup: true,
  includeWaits: true
});
// Returns Node.js Playwright script
```

## Event Listener Patterns

```javascript
recorder.on('recordingStarted', (data) => {
  console.log(`Recording ${data.id} started at ${data.startTime}`);
});

recorder.on('eventRecorded', (event) => {
  console.log(`${event.type} at ${event.relativeTime}ms`);
});

recorder.on('checkpointCreated', (checkpoint) => {
  console.log(`Checkpoint: ${checkpoint.name}`);
});

recorder.on('annotationAdded', (annotation) => {
  console.log(`Note: ${annotation.text}`);
});

recorder.on('recordingPaused', (data) => {
  console.log(`Recording paused at ${data.pauseTime}`);
});

recorder.on('recordingResumed', (data) => {
  console.log(`Recording resumed. Total pause: ${data.totalPauseDuration}ms`);
});

recorder.on('recordingStopped', (data) => {
  console.log(`Recording stopped. Duration: ${data.duration}ms, Events: ${data.eventCount}`);
});

recorder.on('maxEventsReached', (data) => {
  console.log(`Max events reached: ${data.currentEvents}/${data.maxEvents}`);
});
```

## Sensitive Data Masking

Automatically masks these patterns:
- PASSWORD: password, passwd, pwd fields
- EMAIL: email, e-mail fields
- PHONE: phone, tel, mobile fields
- SSN: ssn, social.?security fields
- CREDIT_CARD: card, ccn, creditcard fields
- CVV: cvv, cvc, security.?code fields
- PIN: pin, pincode fields
- TOKEN: token, auth, bearer fields
- API_KEY: api.?key, apikey fields
- SECRET: secret, private fields

To disable masking:
```javascript
const recorder = new InteractionRecorder({ maskSensitiveData: false });
```

## Classes & Types

### InteractionEvent
```javascript
{
  id: string,                    // UUID
  type: string,                  // INTERACTION_TYPES enum
  timestamp: number,             // Unix timestamp
  relativeTime: number,          // Milliseconds from start
  timeDelta: number,             // Milliseconds since last event
  data: object,                  // Event-specific data
  element: object | null,        // Element context
  pageUrl: string,               // Current page URL
  pageTitle: string,             // Current page title
  viewport: object | null,       // Viewport dimensions
  metadata: object,              // Custom metadata
  masked: boolean                // Sensitive data masked
}
```

### InteractionRecording
```javascript
{
  id: string,                    // UUID
  name: string,                  // Recording name
  description: string,           // Recording description
  startUrl: string,              // Initial URL
  startTime: number,             // Start timestamp
  endTime: number | null,        // End timestamp
  duration: number,              // Total duration in ms
  events: InteractionEvent[],    // All recorded events
  checkpoints: RecordingCheckpoint[], // Timeline checkpoints
  annotations: object[],         // User annotations
  options: object,               // Recording options
  stats: object,                 // Statistics
  metadata: object,              // Custom metadata
  tags: string[],                // Tags/categories
  hash: string                   // SHA256 integrity hash
}
```

### RecordingCheckpoint
```javascript
{
  id: string,                    // UUID
  name: string,                  // Checkpoint name
  description: string,           // Description
  timestamp: number,             // Absolute timestamp
  relativeTime: number,          // Time from start
  eventIndex: number,            // Index in events array
  pageState: object | null,      // Page state snapshot
  screenshot: string | null      // Screenshot data (base64)
}
```

## Common Patterns

### Record Login Flow
```javascript
const recorder = new InteractionRecorder({ maskSensitiveData: true });
recorder.startRecording({ name: 'Login Flow', startUrl: 'https://app.com/login' });

// User fills email
recorder.recordInput({ value: '***', element: { name: 'email' }, masked: true });
recorder.recordClick({ element: { selector: '#password-field' } });

// User fills password (automatically masked)
recorder.recordInput({ value: '***', element: { name: 'password', type: 'password' }, masked: true });

// User clicks login
recorder.recordClick({ element: { selector: '#login-btn' } });

// Create checkpoint
recorder.createCheckpoint({ name: 'Login Complete' });

const result = recorder.stopRecording();
console.log(`Successfully recorded login flow with ${result.recording.events.length} events`);
```

### Generate Test Script
```javascript
const recorder = new InteractionRecorder();
recorder.startRecording({ name: 'Test', startUrl: 'https://example.com' });

// ... record interactions ...

recorder.stopRecording();

// Export to Playwright
const { data } = recorder.exportAsPlaywright();
fs.writeFileSync('test-script.js', data);
console.log('Test script generated: test-script.js');
```

## Performance Tips

1. **Disable mouse tracking** if not needed:
   ```javascript
   new InteractionRecorder({ recordMouseMovements: false })
   ```

2. **Adjust throttle timings**:
   ```javascript
   new InteractionRecorder({ 
     mouseMoveThrottle: 200,  // More aggressive throttling
     scrollThrottle: 200 
   })
   ```

3. **Set max events limit**:
   ```javascript
   new InteractionRecorder({ maxEvents: 5000 })
   ```

4. **Disable element context** if not needed:
   ```javascript
   new InteractionRecorder({ recordElementContext: false })
   ```

5. **Disable screenshots**:
   ```javascript
   new InteractionRecorder({ captureScreenshots: false })
   ```

## Troubleshooting

**No events recorded:**
- Check if recording state is 'recording'
- Verify event methods are called with correct parameters
- Check if max events limit was reached

**Events being masked unexpectedly:**
- Verify field name/id/class patterns
- Check maskSensitiveData option (should be true)
- Review SENSITIVE_PATTERNS in module

**Large file size:**
- Reduce max events limit
- Disable mouse movement tracking
- Increase throttle timings
- Disable element context

**Performance issues:**
- Reduce event volume (increase throttle)
- Disable unused event types
- Reduce max events
- Use pagination for large recordings
