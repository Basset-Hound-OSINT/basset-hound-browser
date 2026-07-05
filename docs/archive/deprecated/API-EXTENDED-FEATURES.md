# Extended Features API Reference

**v12.5.0 Phase 3 - 22 New WebSocket Commands**

**Date:** June 14, 2026

---

## Overview

This document provides complete API reference for 22 new WebSocket commands added in v12.5.0 Phase 3, organized by feature group.

### Command Structure

All commands follow this WebSocket message format:

```javascript
{
  "command": "command_name",
  "param1": "value1",
  "param2": { "nested": "value" },
  // ... additional parameters
}
```

Response format:

```javascript
{
  "success": true|false,
  "error": "error message if failed",
  // ... command-specific response fields
}
```

---

## Feature Group 1: Video Recording Enhancements

### 1. start_video_recording

Start a new video recording session with quality and codec options.

**Command:**
```javascript
{
  "command": "start_video_recording",
  "options": {
    "quality": "high" | "medium" | "low",
    "fps": 1-60,
    "codec": "h264" | "vp9" | "av1",
    "includeAudio": true | false,
    "format": "mp4" | "webm" | "mov",
    "filename": "optional-filename.mp4"
  }
}
```

**Parameters:**
- `quality` (enum): Video quality preset. Default: "high"
  - "high": Maximum quality, largest file size (~1MB/sec)
  - "medium": Balanced quality, medium file size (~0.6MB/sec)
  - "low": Low quality, smallest file size (~0.3MB/sec)
- `fps` (number): Frames per second. Range: 1-60. Default: 30
- `codec` (enum): Video codec. Default: "h264"
  - "h264": H.264/AVC (highest compatibility)
  - "vp9": VP9 (better compression)
  - "av1": AV1 (best compression, slower)
- `includeAudio` (boolean): Include audio stream. Default: false
- `format` (enum): Output format. Default: "mp4"
- `filename` (string): Output filename. Generated if omitted

**Response (Success):**
```javascript
{
  "success": true,
  "recordingId": "vid_1718372000000_abc123def",
  "started": true,
  "options": {
    "quality": "high",
    "fps": 30,
    "codec": "h264",
    "includeAudio": false,
    "format": "mp4",
    "filename": "recording-1718372000000.mp4"
  }
}
```

**Response (Error):**
```javascript
{
  "error": "Invalid quality: ultra" | "FPS must be between 1 and 60" | ...
}
```

**Examples:**

Basic recording (defaults):
```javascript
ws.send(JSON.stringify({
  "command": "start_video_recording"
}));
```

High-quality with audio:
```javascript
ws.send(JSON.stringify({
  "command": "start_video_recording",
  "options": {
    "quality": "high",
    "fps": 60,
    "codec": "h264",
    "includeAudio": true,
    "format": "mp4"
  }
}));
```

Low-bandwidth with VP9:
```javascript
ws.send(JSON.stringify({
  "command": "start_video_recording",
  "options": {
    "quality": "low",
    "fps": 15,
    "codec": "vp9",
    "format": "webm"
  }
}));
```

---

### 2. get_video_recording_status

Get current status and metadata of an active recording.

**Command:**
```javascript
{
  "command": "get_video_recording_status",
  "recordingId": "vid_1718372000000_abc123def"
}
```

**Parameters:**
- `recordingId` (string, required): Recording ID from start_video_recording

**Response (Success):**
```javascript
{
  "success": true,
  "recording": true,
  "paused": false,
  "recordingId": "vid_1718372000000_abc123def",
  "duration": 45000,        // milliseconds
  "frameCount": 1350,       // frames captured so far
  "fileSize": 45000000,     // bytes (~45MB)
  "fps": 30,
  "codec": "h264",
  "format": "mp4",
  "quality": "high",
  "includeAudio": false
}
```

**Response (Error):**
```javascript
{
  "error": "recordingId is required" | "Recording not found: vid_..."
}
```

---

### 3. stop_video_recording

Stop an active recording and finalize the video file.

**Command:**
```javascript
{
  "command": "stop_video_recording",
  "recordingId": "vid_1718372000000_abc123def"
}
```

**Parameters:**
- `recordingId` (string, required): Recording ID to stop

**Response (Success):**
```javascript
{
  "success": true,
  "recordingId": "vid_1718372000000_abc123def",
  "duration": 45000,          // total duration in ms
  "filename": "recording-1718372000000.mp4",
  "fileSize": 45000000,       // final file size in bytes
  "frameCount": 1350
}
```

**Notes:**
- Recording cannot be restarted after stopping
- Use pause/resume for temporary interruptions
- File is finalized and ready for access after this command

---

### 4. pause_video_recording

Pause an active recording (can be resumed).

**Command:**
```javascript
{
  "command": "pause_video_recording",
  "recordingId": "vid_1718372000000_abc123def"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "paused": true,
  "recordingId": "vid_1718372000000_abc123def"
}
```

**Notes:**
- Recording can be resumed with resume_video_recording
- Paused time is not recorded
- Useful for skipping unimportant sections

---

### 5. resume_video_recording

Resume a paused recording.

**Command:**
```javascript
{
  "command": "resume_video_recording",
  "recordingId": "vid_1718372000000_abc123def"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "recording": true,
  "recordingId": "vid_1718372000000_abc123def"
}
```

---

## Feature Group 2: Full-Page Screenshot

### 6. capture_full_page

Capture entire scrollable page content as a single image.

**Command:**
```javascript
{
  "command": "capture_full_page",
  "options": {
    "format": "png" | "jpeg" | "webp",
    "quality": 0.0-1.0,
    "delay": 500,
    "filename": "optional-filename.png"
  }
}
```

**Parameters:**
- `format` (enum): Image format. Default: "png"
  - "png": Lossless, larger file
  - "jpeg": Lossy, smaller file, quality setting respected
  - "webp": Modern format, good compression
- `quality` (number): Quality for jpeg/webp. Range: 0-1. Default: 0.95
- `delay` (number): Wait ms before capture (for animations). Default: 0
- `filename` (string): Output filename. Generated if omitted

**Response (Success):**
```javascript
{
  "success": true,
  "captureId": "cap_1718372000000_xyz789",
  "type": "full-page",
  "width": 1920,
  "height": 4800,
  "format": "png",
  "quality": 0.95,
  "filename": "fullpage-1718372000000.png",
  "fileSize": 2400000  // bytes
}
```

**Examples:**

PNG with high quality:
```javascript
ws.send(JSON.stringify({
  "command": "capture_full_page",
  "options": { "format": "png", "quality": 0.99 }
}));
```

JPEG with delay for animations:
```javascript
ws.send(JSON.stringify({
  "command": "capture_full_page",
  "options": {
    "format": "jpeg",
    "quality": 0.85,
    "delay": 1000
  }
}));
```

---

### 7. capture_with_scrollback

Capture page in multiple segments by scrolling.

**Command:**
```javascript
{
  "command": "capture_with_scrollback",
  "options": {
    "scrollSteps": 5,
    "format": "png" | "jpeg" | "webp",
    "quality": 0.95,
    "filename": "optional-prefix"
  }
}
```

**Parameters:**
- `scrollSteps` (number): Number of scroll positions to capture. Range: 1-20. Default: 5
- `format`, `quality`: Same as capture_full_page

**Response (Success):**
```javascript
{
  "success": true,
  "type": "scroll-captures",
  "scrollSteps": 5,
  "format": "png",
  "quality": 0.95,
  "images": [
    "scroll-capture-1718372000000-0.png",
    "scroll-capture-1718372000000-1.png",
    "scroll-capture-1718372000000-2.png",
    "scroll-capture-1718372000000-3.png",
    "scroll-capture-1718372000000-4.png"
  ],
  "fileCount": 5
}
```

**Use Case:**
- Pages that change dynamically as you scroll
- Capturing without scrolling (comparison)
- Full content verification across entire page

---

### 8. stitch_screenshots

Combine multiple screenshot images into a single image.

**Command:**
```javascript
{
  "command": "stitch_screenshots",
  "imageFiles": [
    "img1.png",
    "img2.png",
    "img3.png"
  ]
}
```

**Parameters:**
- `imageFiles` (array, required): List of image filenames to stitch. Minimum: 2

**Response (Success):**
```javascript
{
  "success": true,
  "stitchedId": "stitch_1718372000000_abc123",
  "filename": "stitched-stitch_1718372000000_abc123.png",
  "imageCount": 3,
  "estimatedHeight": 4800,
  "format": "png"
}
```

**Notes:**
- Images stitched vertically (top to bottom)
- Order matters: images stitched in order provided
- Use capture_with_scrollback output for automatic stitching

---

## Feature Group 3: Session Recording & Playback

### 9. start_session_recording

Begin recording all browser commands and interactions.

**Command:**
```javascript
{
  "command": "start_session_recording",
  "sessionName": "my-session",
  "captureScreenshots": true,
  "screenshotInterval": 5000
}
```

**Parameters:**
- `sessionName` (string): User-friendly session name. Default: "session_{timestamp}"
- `captureScreenshots` (boolean): Automatically capture screenshots. Default: false
- `screenshotInterval` (number): Interval between captures in ms. Default: 5000

**Response (Success):**
```javascript
{
  "success": true,
  "sessionId": "rec_1718372000000_abc123",
  "recordingStarted": true,
  "sessionName": "my-session",
  "options": {
    "captureScreenshots": true,
    "screenshotInterval": 5000
  }
}
```

**Notes:**
- Session recordings capture all WebSocket commands sent
- Each command logged with timestamp and parameters
- Response data also logged for replay
- Optional screenshot capture at specified intervals

---

### 10. get_session_recording

Retrieve recorded session data.

**Command:**
```javascript
{
  "command": "get_session_recording",
  "sessionId": "rec_1718372000000_abc123"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "sessionId": "rec_1718372000000_abc123",
  "name": "my-session",
  "startTime": 1718372000000,
  "endTime": null,  // null if still recording
  "duration": 0,
  "commandCount": 42,
  "screenshotCount": 8,
  "commands": [
    {
      "timestamp": 1718372000100,
      "command": "navigate",
      "url": "https://example.com",
      "params": { "timeout": 10000 }
    },
    {
      "timestamp": 1718372001200,
      "command": "click",
      "selector": ".button"
    },
    // ... more commands (showing first 10)
  ],
  "screenshots": [
    "screenshot-0.png",
    "screenshot-1.png",
    // ... (showing first 5)
  ]
}
```

---

### 11. replay_session

Re-execute all commands from a recorded session.

**Command:**
```javascript
{
  "command": "replay_session",
  "sessionId": "rec_1718372000000_abc123",
  "speed": 1.5
}
```

**Parameters:**
- `sessionId` (string, required): Session to replay
- `speed` (number): Playback speed multiplier. Range: 0.1-5. Default: 1.0
  - 0.5: Half speed (2x slower)
  - 1.0: Normal speed
  - 2.0: Double speed

**Response (Success):**
```javascript
{
  "success": true,
  "sessionId": "rec_1718372000000_abc123",
  "replaying": true,
  "speed": 1.5,
  "commandCount": 42,
  "eta": 28000  // estimated duration in ms
}
```

**Notes:**
- Replay executes commands sequentially
- Screenshots not replayed (timing preserved)
- Any command can fail during replay
- Use speed to accelerate/decelerate playback

---

### 12. compare_sessions

Find differences between two recorded sessions.

**Command:**
```javascript
{
  "command": "compare_sessions",
  "session1Id": "rec_1718372000000_abc123",
  "session2Id": "rec_1718372000000_xyz789",
  "compareType": "all" | "commands" | "screenshots" | "results"
}
```

**Parameters:**
- `session1Id` (string, required): First session
- `session2Id` (string, required): Second session
- `compareType` (enum): What to compare. Default: "all"
  - "commands": Compare command sequences
  - "screenshots": Compare captured screenshots
  - "results": Compare command results/responses
  - "all": Compare everything

**Response (Success):**
```javascript
{
  "success": true,
  "compareType": "all",
  "differenceCount": 3,
  "differences": [
    {
      "type": "command",
      "index": 5,
      "session1": {
        "command": "click",
        "selector": ".btn-primary"
      },
      "session2": {
        "command": "click",
        "selector": ".btn-secondary"
      },
      "diff": "selector changed"
    },
    {
      "type": "screenshot",
      "index": 3,
      "diff": "page layout changed significantly"
    },
    // ... more differences
  ]
}
```

**Use Cases:**
- A/B testing page changes
- Debugging behavioral differences
- Version comparison
- Regression detection

---

### 13. export_session_recording

Export recorded session to a file format.

**Command:**
```javascript
{
  "command": "export_session_recording",
  "sessionId": "rec_1718372000000_abc123",
  "format": "json" | "html-replay" | "video"
}
```

**Parameters:**
- `sessionId` (string, required): Session to export
- `format` (enum): Export format. Default: "json"
  - "json": Complete session data as JSON
  - "html-replay": Interactive HTML replay viewer
  - "video": Assembled video file with screenshots

**Response (Success):**
```javascript
{
  "success": true,
  "sessionId": "rec_1718372000000_abc123",
  "format": "json",
  "filename": "session-rec_1718372000000_abc123.json",
  "exportStarted": true
}
```

**File Formats:**

JSON Export:
```json
{
  "sessionId": "rec_...",
  "name": "my-session",
  "startTime": 1718372000000,
  "commands": [
    {"timestamp": 1718372000100, "command": "navigate", "url": "..."},
    ...
  ],
  "screenshots": ["screenshot-0.png", ...],
  "metadata": { "duration": 45000, "commandCount": 42 }
}
```

HTML Replay:
- Interactive webpage with timeline
- Click to jump to any command
- View screenshots at each point
- Re-execute individual commands

Video:
- MP4 file with screenshots and audio
- Timestamps preserved
- Fast-forward/slow-motion capable

---

## Feature Group 4: Advanced DOM Queries

### 14. find_elements_by_text

Find all elements matching specified text content.

**Command:**
```javascript
{
  "command": "find_elements_by_text",
  "text": "Submit",
  "partial": true,
  "caseSensitive": false
}
```

**Parameters:**
- `text` (string, required): Text to search for
- `partial` (boolean): Allow partial matches. Default: true
- `caseSensitive` (boolean): Case-sensitive search. Default: false

**Response (Success):**
```javascript
{
  "success": true,
  "text": "Submit",
  "partial": true,
  "caseSensitive": false,
  "found": true,
  "count": 3,
  "selectors": [
    ".button",
    "#submit-btn",
    "button[type='submit']"
  ]
}
```

**Examples:**

Exact match:
```javascript
{"command": "find_elements_by_text", "text": "Sign In", "partial": false}
```

Case-insensitive partial:
```javascript
{"command": "find_elements_by_text", "text": "sign", "partial": true, "caseSensitive": false}
```

---

### 15. get_element_properties

Extract specific properties from an element.

**Command:**
```javascript
{
  "command": "get_element_properties",
  "selector": ".button",
  "properties": ["id", "class", "value", "disabled", "href", "text"]
}
```

**Parameters:**
- `selector` (string, required): CSS selector to find element
- `properties` (array): Properties to extract. Available:
  - Basic: "id", "class", "value", "type", "name"
  - Content: "text", "innerText", "innerHTML"
  - Attributes: "disabled", "readonly", "required", "href", "src"
  - State: "checked", "selected", "placeholder", "ariaLabel"
  - Styling: "style", "computedStyle" (limited)

**Response (Success):**
```javascript
{
  "success": true,
  "selector": ".button",
  "element": {
    "id": "submit-btn",
    "class": "btn btn-primary",
    "value": "Submit Form",
    "disabled": false,
    "href": null,
    "text": "Submit Form"
  }
}
```

---

### 16. get_element_state

Get complete state information for an element.

**Command:**
```javascript
{
  "command": "get_element_state",
  "selector": "input[name='email']"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "selector": "input[name='email']",
  "element": {
    "visible": true,
    "enabled": true,
    "focusable": true,
    "value": "user@example.com",
    "placeholder": "Enter your email",
    "required": true,
    "readonly": false,
    "ariaLabel": "Email address",
    "type": "email",
    "maxLength": 255,
    "pattern": "^[^@]+@[^@]+$"
  }
}
```

**State Properties:**
- `visible`: Element is within viewport
- `enabled`: Element is not disabled
- `focusable`: Element can receive focus
- `value`: Current input value
- `placeholder`: Placeholder text
- `required`: Form field is required
- `readonly`: Field cannot be edited
- `ariaLabel`: Accessibility label
- `type`: Input type (text, email, password, etc.)
- `maxLength`: Maximum input length
- `pattern`: Input validation pattern

---

### 17. find_clickable_elements

Find all interactive/clickable elements on page.

**Command:**
```javascript
{
  "command": "find_clickable_elements",
  "visibleOnly": true
}
```

**Parameters:**
- `visibleOnly` (boolean): Only return visible elements. Default: true

**Response (Success):**
```javascript
{
  "success": true,
  "visibleOnly": true,
  "count": 42,
  "elements": [
    {
      "selector": "a.nav-link",
      "text": "Home",
      "visible": true,
      "type": "link"
    },
    {
      "selector": "button.submit",
      "text": "Submit",
      "visible": true,
      "type": "button"
    },
    {
      "selector": ".dropdown-menu > a",
      "text": "Profile",
      "visible": false,
      "type": "link"
    },
    {
      "selector": "input[type='checkbox']",
      "text": "",
      "visible": true,
      "type": "checkbox"
    },
    {
      "selector": "[role='button']",
      "text": "Action",
      "visible": true,
      "type": "button"
    }
  ]
}
```

**Detected Element Types:**
- Buttons (`<button>`, `[role="button"]`)
- Links (`<a>`)
- Form inputs (text, email, password, checkbox, radio, select)
- Custom clickables (`[onclick]`, `[role="button"]`)

---

### 18. get_form_fields

Extract all fields from a form with metadata.

**Command:**
```javascript
{
  "command": "get_form_fields",
  "formSelector": "#login-form"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "formSelector": "#login-form",
  "form": {
    "id": "login-form",
    "method": "POST",
    "action": "/login",
    "enctype": "application/x-www-form-urlencoded",
    "fields": [
      {
        "name": "username",
        "type": "email",
        "selector": "input[name='username']",
        "required": true,
        "placeholder": "Enter username",
        "value": "",
        "ariaLabel": "Username or email"
      },
      {
        "name": "password",
        "type": "password",
        "selector": "input[name='password']",
        "required": true,
        "placeholder": "Enter password",
        "value": "",
        "ariaLabel": "Password"
      },
      {
        "name": "remember",
        "type": "checkbox",
        "selector": "input[name='remember']",
        "required": false,
        "value": false,
        "label": "Remember me"
      },
      {
        "name": "submit",
        "type": "submit",
        "selector": "button[type='submit']",
        "value": "Sign In"
      }
    ],
    "fieldCount": 4
  }
}
```

---

### 19. analyze_page_structure

Get comprehensive page structure analysis.

**Command:**
```javascript
{
  "command": "analyze_page_structure"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "page": {
    "title": "Example Page Title",
    "url": "https://example.com/page",
    "headings": [
      {
        "level": 1,
        "text": "Main Heading",
        "count": 1
      },
      {
        "level": 2,
        "text": "Subheading 1",
        "count": 2
      },
      {
        "level": 3,
        "text": "Detail Heading",
        "count": 5
      }
    ],
    "forms": [
      {
        "id": "search-form",
        "method": "GET",
        "fields": 1
      },
      {
        "id": "login-form",
        "method": "POST",
        "fields": 3
      }
    ],
    "images": [
      {
        "src": "/img/banner.png",
        "alt": "Banner Image",
        "width": 1920,
        "height": 600
      },
      {
        "src": "/img/logo.png",
        "alt": "Logo",
        "width": 200,
        "height": 200
      }
    ],
    "links": [
      {
        "href": "https://example.com",
        "text": "Home",
        "internal": true
      },
      {
        "href": "https://google.com",
        "text": "Google",
        "internal": false
      }
    ],
    "sections": {
      "header": true,
      "nav": true,
      "main": true,
      "footer": true
    }
  }
}
```

**Use Cases:**
- Page structure validation
- Navigation mapping
- Sitemap generation
- SEO analysis
- Content inventory

---

### 20. find_text_regions

Find text blocks/regions by area dimensions.

**Command:**
```javascript
{
  "command": "find_text_regions",
  "minWidth": 300,
  "minHeight": 100,
  "maxArea": 1000000
}
```

**Parameters:**
- `minWidth` (number): Minimum region width in pixels. Default: 0
- `minHeight` (number): Minimum region height in pixels. Default: 0
- `maxArea` (number): Maximum region area in pixels. Default: Infinity

**Response (Success):**
```javascript
{
  "success": true,
  "filters": {
    "minWidth": 300,
    "minHeight": 100,
    "maxArea": 1000000
  },
  "regions": [
    {
      "selector": ".article",
      "text": "Article text content...",
      "area": 2400,
      "width": 800,
      "height": 3,
      "x": 100,
      "y": 200
    },
    {
      "selector": ".sidebar",
      "text": "Sidebar content...",
      "area": 300,
      "width": 300,
      "height": 1,
      "x": 900,
      "y": 200
    }
  ],
  "regionCount": 2
}
```

**Use Cases:**
- Finding main content areas
- Identifying sidebars and ads
- Text extraction by region
- Layout analysis

---

### 21. evaluate_css_selector

Test and validate a CSS selector.

**Command:**
```javascript
{
  "command": "evaluate_css_selector",
  "selector": "div.content > p:first-child"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "selector": "div.content > p:first-child",
  "valid": true,
  "matches": 1,
  "examples": [
    "<p>Lorem ipsum dolor sit amet...</p>"
  ]
}
```

**Response (Invalid Selector):**
```javascript
{
  "success": false,
  "selector": "div..invalid",
  "valid": false,
  "error": "Invalid CSS selector syntax"
}
```

**Use Cases:**
- Debugging selector issues
- Selector validation
- Selector optimization
- Selector documentation

---

### 22. xpath_query

Query elements using XPath expressions.

**Command:**
```javascript
{
  "command": "xpath_query",
  "xpath": "//button[contains(text(), 'Submit')]"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "xpath": "//button[contains(text(), 'Submit')]",
  "matches": 2,
  "elements": [
    {
      "tagName": "button",
      "text": "Submit",
      "class": "btn-primary",
      "id": "submit-btn"
    },
    {
      "tagName": "button",
      "text": "Submit Form",
      "class": "btn-secondary",
      "id": "form-submit"
    }
  ]
}
```

**Common XPath Patterns:**

```xpath
// Find by text
//button[contains(text(), 'Submit')]

// Find by attribute
//input[@name='email']

// Find by class
//div[@class='container']

// Find by position
//button[1]

// Find by multiple conditions
//input[@type='text'][@required='required']

// Find parent
//button/..

// Find siblings
//input[@name='email']/following-sibling::button
```

**Use Cases:**
- Complex element selection
- Text-based queries
- Attribute-based queries
- Navigating DOM structure

---

## Error Handling

All commands return error responses in this format:

```javascript
{
  "error": "Descriptive error message"
}
```

Common errors:

| Error | Cause | Solution |
|-------|-------|----------|
| "recordingId is required" | Missing required parameter | Provide recordingId |
| "Recording not found: vid_..." | ID doesn't exist | Check recording exists first |
| "Invalid quality: ultra" | Invalid enum value | Use valid enum: high/medium/low |
| "FPS must be between 1 and 60" | Out of bounds | Provide fps in range 1-60 |
| "selector parameter is required" | Missing selector | Provide CSS selector |

---

## Best Practices

### Video Recording
1. Always check recording status before stopping
2. Use quality "low" for long recordings to save space
3. Enable audio only when needed
4. Stop recording promptly to finalize file

### Screenshots
1. Use capture_full_page for complete content
2. Use capture_with_scrollback for dynamic pages
3. Set delay > 0 for pages with animations
4. Use PNG for lossless, JPEG for smaller files

### Session Recording
1. Start recording before automated sequence
2. Use meaningful session names
3. Export to JSON for analysis
4. Compare sessions to detect changes

### DOM Queries
1. Use find_elements_by_text for user-facing content
2. Validate selectors with evaluate_css_selector first
3. Use get_form_fields for form automation
4. Use analyze_page_structure for page understanding

---

## Conclusion

The 22 Extended Features commands provide powerful automation, recording, and analysis capabilities for browser automation at scale.

**For more information:**
- API Reference: This document
- Implementation: `/websocket/commands/extended-features-commands.js`
- Tests: `/tests/features/extended-features.test.js`
- Handoff: `/docs/handoffs/V12.5.0-PHASE-3-COMPLETE-2026-06-14.md`
