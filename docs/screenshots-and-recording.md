# Screenshot and Recording API Documentation

This document describes the enhanced screenshot and screen recording capabilities available in the Basset Hound Browser.

## Table of Contents

1. [Screenshot Features](#screenshot-features)
   - [Viewport Screenshot](#viewport-screenshot)
   - [Full Page Screenshot](#full-page-screenshot)
   - [Element Screenshot](#element-screenshot)
   - [Area Screenshot](#area-screenshot)
   - [Screenshot Annotations](#screenshot-annotations)
2. [Screen Recording](#screen-recording)
   - [Start Recording](#start-recording)
   - [Stop Recording](#stop-recording)
   - [Pause/Resume Recording](#pauseresume-recording)
   - [Recording Status](#recording-status)
3. [WebSocket Commands](#websocket-commands)
4. [Examples](#examples)

---

## Screenshot Features

### Supported Formats

| Format | Extension | MIME Type | Default Quality |
|--------|-----------|-----------|-----------------|
| PNG | .png | image/png | 1.0 |
| JPEG | .jpg | image/jpeg | 0.92 |
| WebP | .webp | image/webp | 0.92 |

### Viewport Screenshot

Captures the currently visible area of the page.

**WebSocket Command:** `screenshot_viewport`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | 'png' | Output format (png, jpeg, webp) |
| quality | number | 1.0 | Quality setting (0.0-1.0, for JPEG/WebP) |
| savePath | string | null | Optional file path to save the screenshot |

**Response:**
```json
{
  "success": true,
  "data": "data:image/png;base64,...",
  "format": "png",
  "savedTo": "/path/to/file.png"
}
```

### Full Page Screenshot

Captures the entire scrollable page by scrolling and stitching multiple viewport captures.

**WebSocket Command:** `screenshot_full_page`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | 'png' | Output format |
| quality | number | 1.0 | Quality setting |
| scrollDelay | number | 100 | Delay (ms) between scroll captures |
| maxHeight | number | 32000 | Maximum capture height in pixels |
| savePath | string | null | Optional file path to save |

**Response:**
```json
{
  "success": true,
  "data": "data:image/png;base64,...",
  "screenshots": [
    { "data": "...", "y": 0, "height": 800 },
    { "data": "...", "y": 800, "height": 800 }
  ],
  "totalHeight": 1600,
  "viewportHeight": 800,
  "format": "png"
}
```

### Element Screenshot

Captures a specific DOM element by CSS selector.

**WebSocket Command:** `screenshot_element`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| selector | string | required | CSS selector for the element |
| format | string | 'png' | Output format |
| quality | number | 1.0 | Quality setting |
| padding | number | 0 | Extra padding around element (px) |
| savePath | string | null | Optional file path to save |

**Response:**
```json
{
  "success": true,
  "data": "data:image/png;base64,...",
  "bounds": {
    "x": 100,
    "y": 200,
    "width": 300,
    "height": 150
  },
  "format": "png"
}
```

### Area Screenshot

Captures a specific rectangular area defined by coordinates.

**WebSocket Command:** `screenshot_area`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| x | number | required | X coordinate of top-left corner |
| y | number | required | Y coordinate of top-left corner |
| width | number | required | Width of capture area |
| height | number | required | Height of capture area |
| format | string | 'png' | Output format |
| quality | number | 1.0 | Quality setting |
| savePath | string | null | Optional file path to save |

**Response:**
```json
{
  "success": true,
  "data": "data:image/png;base64,...",
  "area": { "x": 100, "y": 100, "width": 400, "height": 300 },
  "format": "png"
}
```

### Screenshot Annotations

Add annotations to an existing screenshot image.

**WebSocket Command:** `annotate_screenshot`

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| imageData | string | Base64 encoded image data |
| annotations | array | Array of annotation objects |

#### Annotation Types

##### Text Annotation
```json
{
  "type": "text",
  "text": "Hello World",
  "x": 100,
  "y": 50,
  "fontSize": 16,
  "fontFamily": "Arial",
  "color": "#FF0000",
  "backgroundColor": "#FFFFFF",
  "padding": 4
}
```

##### Rectangle
```json
{
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 150,
  "strokeColor": "#FF0000",
  "strokeWidth": 2,
  "fillColor": null,
  "opacity": 1
}
```

##### Circle
```json
{
  "type": "circle",
  "x": 200,
  "y": 200,
  "radius": 50,
  "strokeColor": "#FF0000",
  "strokeWidth": 2,
  "fillColor": null,
  "opacity": 1
}
```

##### Arrow
```json
{
  "type": "arrow",
  "startX": 100,
  "startY": 100,
  "endX": 200,
  "endY": 200,
  "color": "#FF0000",
  "strokeWidth": 2,
  "headSize": 10
}
```

##### Highlight
```json
{
  "type": "highlight",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 50,
  "color": "#FFFF00",
  "opacity": 0.3
}
```

##### Blur
```json
{
  "type": "blur",
  "x": 100,
  "y": 100,
  "width": 150,
  "height": 100,
  "intensity": 10
}
```

##### Line
```json
{
  "type": "line",
  "startX": 0,
  "startY": 0,
  "endX": 100,
  "endY": 100,
  "color": "#FF0000",
  "strokeWidth": 2,
  "dashed": false
}
```

---

## Screen Recording

### Quality Presets

| Preset | Resolution | Frame Rate | Bitrate |
|--------|------------|------------|---------|
| low | 1280x720 | 15 fps | 1 Mbps |
| medium | 1920x1080 | 24 fps | 2.5 Mbps |
| high | 1920x1080 | 30 fps | 5 Mbps |
| ultra | 2560x1440 | 60 fps | 8 Mbps |

### Start Recording

Begin recording the browser session.

**WebSocket Command:** `start_recording`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | 'webm' | Output format (webm, mp4) |
| quality | string | 'medium' | Quality preset |
| includeAudio | boolean | false | Include audio in recording |
| filename | string | null | Optional output filename |

**Response:**
```json
{
  "success": true,
  "recordingId": "recording-1234567890-abc123",
  "startTime": 1703520000000
}
```

### Stop Recording

Stop the current recording and retrieve the video data.

**WebSocket Command:** `stop_recording`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| savePath | string | null | File path to save the recording |
| returnData | boolean | true | Include video data in response |

**Response:**
```json
{
  "success": true,
  "duration": 15000,
  "frameCount": 450,
  "recordingId": "recording-1234567890-abc123",
  "data": {
    "firstFrame": "data:image/png;base64,...",
    "lastFrame": "data:image/png;base64,...",
    "frames": [...]
  },
  "savedTo": "/path/to/recording.webm"
}
```

### Pause/Resume Recording

Temporarily pause and resume the recording.

**WebSocket Commands:** `pause_recording`, `resume_recording`

**Response:**
```json
{
  "success": true
}
```

### Recording Status

Get the current recording status.

**WebSocket Command:** `recording_status`

**Response:**
```json
{
  "success": true,
  "state": "recording",
  "recordingId": "recording-1234567890-abc123",
  "duration": 5000,
  "pausedFor": 0
}
```

**Possible States:**
- `idle` - No recording in progress
- `recording` - Actively recording
- `paused` - Recording is paused
- `stopping` - Recording is being finalized

### Recording Sources

Get available recording sources (screens/windows).

**WebSocket Command:** `recording_sources`

**Response:**
```json
{
  "success": true,
  "sources": [
    {
      "id": "screen:0:0",
      "name": "Entire Screen",
      "thumbnail": "data:image/png;base64,...",
      "displayId": "0"
    }
  ]
}
```

### Recording Formats

Get supported recording formats and quality presets.

**WebSocket Command:** `recording_formats`

**Response:**
```json
{
  "success": true,
  "formats": ["webm", "mp4"],
  "qualityPresets": {
    "low": { "videoBitsPerSecond": 1000000, "width": 1280, "height": 720, "frameRate": 15 },
    "medium": { "videoBitsPerSecond": 2500000, "width": 1920, "height": 1080, "frameRate": 24 },
    "high": { "videoBitsPerSecond": 5000000, "width": 1920, "height": 1080, "frameRate": 30 },
    "ultra": { "videoBitsPerSecond": 8000000, "width": 2560, "height": 1440, "frameRate": 60 }
  }
}
```

---

## WebSocket Commands Summary

### Screenshot Commands
| Command | Description |
|---------|-------------|
| `screenshot` | Basic viewport screenshot (legacy) |
| `screenshot_viewport` | Enhanced viewport screenshot |
| `screenshot_full_page` | Full page scroll-and-stitch capture |
| `screenshot_element` | Capture specific element |
| `screenshot_area` | Capture specific coordinates |
| `annotate_screenshot` | Add annotations to screenshot |
| `screenshot_formats` | Get supported formats |

### Recording Commands
| Command | Description |
|---------|-------------|
| `start_recording` | Begin screen recording |
| `stop_recording` | End and save recording |
| `pause_recording` | Pause active recording |
| `resume_recording` | Resume paused recording |
| `recording_status` | Get current recording state |
| `recording_sources` | List available capture sources |
| `recording_formats` | Get formats and quality presets |

---

## Examples

### Python Example: Take Full Page Screenshot

```python
import asyncio
import websockets
import json
import base64

async def take_full_page_screenshot():
    async with websockets.connect('ws://localhost:8765') as ws:
        # Request full page screenshot
        await ws.send(json.dumps({
            'command': 'screenshot_full_page',
            'format': 'png',
            'scrollDelay': 150,
            'maxHeight': 10000
        }))

        response = json.loads(await ws.recv())

        if response['success']:
            # If single viewport, save directly
            if response['data']:
                image_data = response['data'].split(',')[1]
                with open('full_page.png', 'wb') as f:
                    f.write(base64.b64decode(image_data))
            else:
                # Multiple screenshots need stitching
                print(f"Captured {len(response['screenshots'])} viewport images")
                print(f"Total height: {response['totalHeight']}px")

asyncio.run(take_full_page_screenshot())
```

### Python Example: Annotate Screenshot

```python
import asyncio
import websockets
import json

async def annotate_screenshot():
    async with websockets.connect('ws://localhost:8765') as ws:
        # First, take a screenshot
        await ws.send(json.dumps({'command': 'screenshot_viewport'}))
        screenshot = json.loads(await ws.recv())

        if screenshot['success']:
            # Add annotations
            await ws.send(json.dumps({
                'command': 'annotate_screenshot',
                'imageData': screenshot['data'],
                'annotations': [
                    {
                        'type': 'rectangle',
                        'x': 100, 'y': 100,
                        'width': 200, 'height': 100,
                        'strokeColor': '#FF0000',
                        'strokeWidth': 3
                    },
                    {
                        'type': 'text',
                        'text': 'Important area',
                        'x': 100, 'y': 90,
                        'fontSize': 14,
                        'color': '#FF0000'
                    },
                    {
                        'type': 'blur',
                        'x': 400, 'y': 200,
                        'width': 150, 'height': 50,
                        'intensity': 15
                    }
                ]
            }))

            annotated = json.loads(await ws.recv())
            print('Annotated screenshot ready' if annotated['success'] else annotated['error'])

asyncio.run(annotate_screenshot())
```

### Python Example: Record Browser Session

```python
import asyncio
import websockets
import json
import base64

async def record_session():
    async with websockets.connect('ws://localhost:8765') as ws:
        # Start recording
        await ws.send(json.dumps({
            'command': 'start_recording',
            'format': 'webm',
            'quality': 'medium'
        }))

        start_response = json.loads(await ws.recv())

        if start_response['success']:
            print(f"Recording started: {start_response['recordingId']}")

            # Perform some actions...
            await ws.send(json.dumps({
                'command': 'navigate',
                'url': 'https://example.com'
            }))
            await ws.recv()

            # Wait for page to load
            await asyncio.sleep(3)

            # Stop recording
            await ws.send(json.dumps({
                'command': 'stop_recording',
                'savePath': '/tmp/recording.webm'
            }))

            stop_response = json.loads(await ws.recv())

            if stop_response['success']:
                print(f"Recording saved: {stop_response['duration']}ms")
                print(f"Frames captured: {stop_response['frameCount']}")

asyncio.run(record_session())
```

### JavaScript Example: Element Screenshot

```javascript
const WebSocket = require('ws');

async function captureElement() {
  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', () => {
    // Capture a specific element
    ws.send(JSON.stringify({
      command: 'screenshot_element',
      selector: '#main-content',
      format: 'png',
      padding: 10
    }));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);
    if (response.success) {
      console.log('Element captured');
      console.log('Bounds:', response.bounds);
      // response.data contains base64 image
    }
    ws.close();
  });
}

captureElement();
```

---

## File Locations

- **Screenshot Manager:** `/basset-hound-browser/screenshots/manager.js`
- **Recording Manager:** `/basset-hound-browser/recording/manager.js`
- **WebSocket Server:** `/basset-hound-browser/websocket/server.js`
- **IPC Handlers:** `/basset-hound-browser/main.js`
- **Renderer Integration:** `/basset-hound-browser/renderer/renderer.js`

## Notes

1. **Full Page Screenshots**: For very long pages, screenshots are returned as an array of viewport captures. Client-side stitching may be required.

2. **Recording Format**: The current implementation captures frames as individual images. For true video encoding, additional post-processing with tools like FFmpeg may be needed.

3. **Performance**: Full page screenshots and recordings can be resource-intensive. Use appropriate scroll delays and quality settings for optimal performance.

4. **Annotations**: Blur effect uses pixelation for privacy protection. Higher intensity values create stronger blur effects.
