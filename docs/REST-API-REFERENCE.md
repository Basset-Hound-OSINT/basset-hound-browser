# Basset Hound Browser - REST API Reference

**Version**: 12.2.0 (Enterprise Ready)
**Protocol**: HTTP/HTTPS
**Default Port**: 8766
**Last Updated**: June 3, 2026
**Status**: Comprehensive REST API for alternative integration patterns

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Authentication](#authentication)
3. [HTTP Methods & Status Codes](#http-methods--status-codes)
4. [Request/Response Format](#requestresponse-format)
5. [Navigation Endpoints](#navigation-endpoints)
6. [Content Endpoints](#content-endpoints)
7. [Screenshot Endpoints](#screenshot-endpoints)
8. [Input & Interaction Endpoints](#input--interaction-endpoints)
9. [Storage & Cookie Endpoints](#storage--cookie-endpoints)
10. [Proxy & Network Endpoints](#proxy--network-endpoints)
11. [Session Endpoints](#session-endpoints)
12. [Evasion & Fingerprinting Endpoints](#evasion--fingerprinting-endpoints)
13. [Recording Endpoints](#recording-endpoints)
14. [Window & Tab Endpoints](#window--tab-endpoints)
15. [Performance Endpoints](#performance-endpoints)
16. [Error Handling](#error-handling)
17. [Examples](#examples)

---

## Overview & Architecture

The REST API provides HTTP-based access to browser automation commands alongside the WebSocket API.

### Base URL

```
http://localhost:8766/api/v1
https://localhost:8766/api/v1  # With SSL/TLS
```

### API Versioning

- Current version: `v1`
- Future versions: `v2`, `v3`, etc.
- Versions available at `/api/v{version}/`

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **Binary**: `application/octet-stream` (for files/screenshots)

---

## Authentication

### Bearer Token

Include token in Authorization header:

```
Authorization: Bearer YOUR_TOKEN
X-API-Key: YOUR_API_KEY (alternative)
```

### Query Parameter

```
GET /api/v1/status?token=YOUR_TOKEN
```

### Cookie-Based

```
Cookie: sessionId=YOUR_SESSION_ID
```

### Authentication Response

```json
{
  "authenticated": true,
  "sessionId": "sess_abc123",
  "expiresAt": "2026-06-04T12:00:00Z",
  "permissions": ["read", "write", "execute"]
}
```

---

## HTTP Methods & Status Codes

### Request Methods

| Method | Purpose |
|--------|---------|
| `GET` | Retrieve data (no side effects) |
| `POST` | Create/execute (creates state changes) |
| `PUT` | Replace resource |
| `PATCH` | Partial update |
| `DELETE` | Remove resource |

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 204 | No Content | Success, no content |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Authentication failed |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |
| 503 | Service Unavailable | Service down |

---

## Request/Response Format

### Standard Response Envelope

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "result": "..."
  },
  "meta": {
    "timestamp": "2026-06-03T10:30:00Z",
    "requestId": "req_abc123",
    "duration": 245
  }
}
```

### Error Response Envelope

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "error": {
    "message": "Human-readable error message",
    "type": "ValidationError",
    "details": {
      "field": "url",
      "issue": "Invalid URL format"
    }
  },
  "meta": {
    "timestamp": "2026-06-03T10:30:00Z",
    "requestId": "req_abc123",
    "duration": 125
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 250,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Navigation Endpoints

### POST /api/v1/navigate

Navigate to URL.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/navigate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "timeout": 30000
  }'
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to navigate to |
| `timeout` | number | No | Timeout in milliseconds (default: 30000) |
| `waitUntil` | string | No | "load", "domcontentloaded", "networkidle" |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "tabId": "tab_123",
    "title": "Example Domain",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "code": "INVALID_URL",
  "error": {
    "message": "Invalid URL format",
    "details": {
      "provided": "not-a-url",
      "expected": "Valid HTTP/HTTPS URL"
    }
  }
}
```

### GET /api/v1/navigate/current

Get current page URL.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/navigate/current \
  -H "Authorization: Bearer TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "tabId": "tab_123",
    "title": "Example Domain"
  }
}
```

### POST /api/v1/navigate/reload

Reload current page.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/navigate/reload \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/navigate/back

Navigate back.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/navigate/back \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/navigate/forward

Navigate forward.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/navigate/forward \
  -H "Authorization: Bearer TOKEN"
```

---

## Content Endpoints

### GET /api/v1/content

Get page HTML content.

**Request:**
```bash
curl -X GET 'http://localhost:8766/api/v1/content?includeMetadata=true' \
  -H "Authorization: Bearer TOKEN"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeMetadata` | boolean | false | Include page metadata |
| `sanitize` | boolean | false | Sanitize HTML content |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html>...",
    "size": 45320,
    "metadata": {
      "title": "Example Domain",
      "description": "Example description"
    }
  }
}
```

### GET /api/v1/content/text

Get page text content.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/content/text \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Example Domain\n\nThis domain is for use in examples...",
    "wordCount": 245
  }
}
```

### GET /api/v1/content/links

Extract all links.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/content/links \
  -H "Authorization: Bearer TOKEN"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeInternal` | boolean | true | Include internal links |
| `includeExternal` | boolean | true | Include external links |

**Response:**
```json
{
  "success": true,
  "data": {
    "links": [
      {
        "href": "https://example.com/page1",
        "text": "Page 1",
        "title": "Go to Page 1",
        "isExternal": false
      }
    ],
    "total": 42
  }
}
```

### GET /api/v1/content/images

Extract all images.

**Request:**
```bash
curl -X GET 'http://localhost:8766/api/v1/content/images?includeDataUrl=false' \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Image description",
        "width": 640,
        "height": 480,
        "title": "Image title"
      }
    ],
    "total": 15
  }
}
```

### GET /api/v1/content/forms

Extract all forms.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/content/forms \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "id": "search-form",
        "name": "search",
        "method": "GET",
        "action": "https://example.com/search",
        "enctype": "application/x-www-form-urlencoded",
        "fields": [
          {
            "name": "q",
            "type": "text",
            "value": "",
            "required": true
          }
        ]
      }
    ],
    "total": 3
  }
}
```

### GET /api/v1/content/metadata

Extract page metadata.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/content/metadata \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Example Domain",
    "description": "Example description",
    "keywords": "example, domain",
    "canonical": "https://example.com",
    "lang": "en",
    "ogData": {
      "title": "Example",
      "description": "...",
      "image": "https://example.com/og.jpg"
    }
  }
}
```

### GET /api/v1/content/technologies

Detect technologies.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/content/technologies \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "technologies": [
      {
        "name": "React",
        "category": "JavaScript Framework",
        "version": "18.2.0",
        "confidence": 95,
        "icon": "https://..."
      }
    ],
    "total": 8
  }
}
```

---

## Screenshot Endpoints

### POST /api/v1/screenshot

Capture full page screenshot.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/screenshot \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "png",
    "quality": 90,
    "fullPage": true
  }'
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | "png" | "png", "jpeg", "webp" |
| `quality` | number | 90 | 0-100 (JPEG only) |
| `fullPage` | boolean | true | Capture full page or viewport |
| `annotate` | object | null | Annotations to add |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "screenshot": "base64-encoded-image",
    "format": "png",
    "width": 1920,
    "height": 1080,
    "size": 245320,
    "mimeType": "image/png",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

**Response (Binary, Accept: image/png):**
```
[Binary PNG data]
```

### POST /api/v1/screenshot/viewport

Capture viewport-only screenshot.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/screenshot/viewport \
  -H "Authorization: Bearer TOKEN" \
  -d '{"format": "png"}'
```

### POST /api/v1/screenshot/element

Capture element screenshot.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/screenshot/element \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "selector": "#main-content",
    "format": "png"
  }'
```

### POST /api/v1/screenshot/area

Capture area by coordinates.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/screenshot/area \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "x": 100,
    "y": 100,
    "width": 800,
    "height": 600,
    "format": "png"
  }'
```

### POST /api/v1/screenshot/annotate

Add annotations to screenshot.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/screenshot/annotate \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "screenshot": "base64-image",
    "annotations": [
      {
        "type": "box",
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 200,
        "color": "red",
        "label": "Important"
      }
    ]
  }'
```

---

## Input & Interaction Endpoints

### POST /api/v1/interact/click

Click element.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/click \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "selector": "button.submit",
    "button": "left",
    "clickCount": 1
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "clicked": true,
    "element": {
      "tagName": "button",
      "id": "submit",
      "class": "btn btn-primary"
    }
  }
}
```

### POST /api/v1/interact/fill

Fill form field.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/fill \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "selector": "input[name=\"email\"]",
    "value": "user@example.com"
  }'
```

### POST /api/v1/interact/type

Type text.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/type \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "text": "Hello World",
    "delay": 50
  }'
```

### POST /api/v1/interact/key

Press key.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/key \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "key": "Enter"
  }'
```

### POST /api/v1/interact/scroll

Scroll page.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/scroll \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "x": 0,
    "y": 1000,
    "smooth": true
  }'
```

### POST /api/v1/interact/mouse

Mouse action.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/mouse \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "action": "move",
    "x": 500,
    "y": 300
  }'
```

**Mouse Actions:**
- `move`: Move to position
- `click`: Click at position
- `doubleClick`: Double-click
- `rightClick`: Right-click
- `drag`: Drag from one position to another

### POST /api/v1/interact/wait

Wait for element.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/interact/wait \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "selector": ".result",
    "timeout": 10000,
    "visible": true
  }'
```

---

## Storage & Cookie Endpoints

### GET /api/v1/storage/cookies

Get cookies.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/storage/cookies \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cookies": [
      {
        "name": "session_id",
        "value": "abc123xyz",
        "domain": ".example.com",
        "path": "/",
        "secure": true,
        "httpOnly": true,
        "sameSite": "Strict",
        "expires": "2026-06-04T12:00:00Z"
      }
    ],
    "total": 5
  }
}
```

### POST /api/v1/storage/cookies

Set cookie.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/storage/cookies \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "session_id",
    "value": "abc123xyz",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "Strict",
    "expiresIn": 3600000
  }'
```

### DELETE /api/v1/storage/cookies/:name

Delete cookie.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/storage/cookies/session_id \
  -H "Authorization: Bearer TOKEN"
```

### DELETE /api/v1/storage/cookies

Clear all cookies.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/storage/cookies \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/storage/local-storage

Get localStorage.

**Request:**
```bash
curl -X GET 'http://localhost:8766/api/v1/storage/local-storage?key=user_theme' \
  -H "Authorization: Bearer TOKEN"
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Specific key (optional) |

### POST /api/v1/storage/local-storage

Set localStorage.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/storage/local-storage \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "key": "user_theme",
    "value": "dark"
  }'
```

### DELETE /api/v1/storage/local-storage/:key

Delete localStorage item.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/storage/local-storage/user_theme \
  -H "Authorization: Bearer TOKEN"
```

### DELETE /api/v1/storage/local-storage

Clear localStorage.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/storage/local-storage \
  -H "Authorization: Bearer TOKEN"
```

---

## Proxy & Network Endpoints

### POST /api/v1/proxy/set

Set proxy.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/proxy/set \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "host": "proxy.example.com",
    "port": 8080,
    "type": "http",
    "auth": {
      "username": "user",
      "password": "pass"
    },
    "bypassRules": ["localhost", "127.0.0.1"]
  }'
```

### GET /api/v1/proxy/status

Get proxy status.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/proxy/status \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "proxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "type": "http",
      "active": true
    },
    "exitIp": "203.0.113.45",
    "exitCountry": "US",
    "lastChange": "2026-06-03T10:30:00Z"
  }
}
```

### POST /api/v1/proxy/test

Test proxy.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/proxy/test \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "host": "proxy.example.com",
    "port": 8080,
    "testUrl": "https://httpbin.org/ip"
  }'
```

### POST /api/v1/proxy/rotate

Rotate proxy.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/proxy/rotate \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/proxy/clear

Clear proxy.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/proxy/clear \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/network/logs

Get network logs.

**Request:**
```bash
curl -X GET 'http://localhost:8766/api/v1/network/logs?filter=xhr&limit=50' \
  -H "Authorization: Bearer TOKEN"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filter` | string | "all" | Request type filter |
| `limit` | number | 100 | Max results |
| `offset` | number | 0 | Pagination offset |

### POST /api/v1/network/throttle

Set network throttling.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/network/throttle \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "downloadSpeed": 1000000,
    "uploadSpeed": 500000,
    "latency": 100
  }'
```

---

## Session Endpoints

### POST /api/v1/sessions

Create session.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/sessions \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "research_session_1",
    "isolated": true
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "sessionId": "sess_abc123",
    "name": "research_session_1",
    "created": "2026-06-03T10:30:00Z"
  }
}
```

### GET /api/v1/sessions

List sessions.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/sessions \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/sessions/:sessionId

Get session details.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/sessions/sess_abc123 \
  -H "Authorization: Bearer TOKEN"
```

### DELETE /api/v1/sessions/:sessionId

Delete session.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/sessions/sess_abc123 \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/sessions/:sessionId/checkpoint

Create checkpoint.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/sessions/sess_abc123/checkpoint \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "checkpoint_1"
  }'
```

### POST /api/v1/sessions/:sessionId/rollback/:checkpointId

Rollback to checkpoint.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/sessions/sess_abc123/rollback/ckpt_123 \
  -H "Authorization: Bearer TOKEN"
```

---

## Evasion & Fingerprinting Endpoints

### POST /api/v1/evasion/user-agent

Set user agent.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/evasion/user-agent \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }'
```

### GET /api/v1/evasion/user-agent

Get current user agent.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/evasion/user-agent \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/evasion/user-agent/rotate

Start user agent rotation.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/evasion/user-agent/rotate \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "category": "desktop",
    "interval": 300000
  }'
```

### POST /api/v1/evasion/geolocation

Set geolocation.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/evasion/geolocation \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 100
  }'
```

### POST /api/v1/evasion/fingerprint

Randomize fingerprint.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/evasion/fingerprint \
  -H "Authorization: Bearer TOKEN"
```

---

## Recording Endpoints

### POST /api/v1/recording/start

Start recording.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/recording/start \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "recording_1",
    "captureScreenshots": true,
    "captureNetwork": true
  }'
```

### POST /api/v1/recording/stop

Stop recording.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/recording/stop \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/recording/status

Get recording status.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/recording/status \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/recordings

List recordings.

**Request:**
```bash
curl -X GET 'http://localhost:8766/api/v1/recordings?limit=20&offset=0' \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/recordings/:recordingId

Get recording details.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/recordings/rec_123 \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/recordings/:recordingId/replay

Start replay.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/recordings/rec_123/replay \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "speed": 1.0
  }'
```

### DELETE /api/v1/recordings/:recordingId

Delete recording.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/recordings/rec_123 \
  -H "Authorization: Bearer TOKEN"
```

---

## Window & Tab Endpoints

### POST /api/v1/tabs

Create tab.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/tabs \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "url": "about:blank"
  }'
```

### GET /api/v1/tabs

List tabs.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/tabs \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/tabs/active

Get active tab.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/tabs/active \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/tabs/:tabId

Switch to tab.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/tabs/tab_123 \
  -H "Authorization: Bearer TOKEN"
```

### DELETE /api/v1/tabs/:tabId

Close tab.

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/tabs/tab_123 \
  -H "Authorization: Bearer TOKEN"
```

---

## Performance Endpoints

### GET /api/v1/performance

Get performance metrics.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/performance \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "navigation": {
      "navigationStart": 1623847380000,
      "domInteractive": 1623847381200,
      "domComplete": 1623847382100,
      "loadEventEnd": 1623847382500
    },
    "timing": {
      "pageLoadTime": 2500,
      "domReadyTime": 1200,
      "firstPaint": 850,
      "firstContentfulPaint": 1050
    }
  }
}
```

### GET /api/v1/performance/memory

Get memory stats.

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/performance/memory \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/v1/performance/gc

Force garbage collection.

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/performance/gc \
  -H "Authorization: Bearer TOKEN"
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "error": {
    "message": "Human-readable error message",
    "type": "ErrorType",
    "details": {
      "field": "value",
      "issue": "description"
    }
  },
  "meta": {
    "timestamp": "2026-06-03T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_PARAMETER` | 400 | Invalid request parameter |
| `VALIDATION_ERROR` | 400 | Validation failed |
| `UNAUTHORIZED` | 401 | Authentication failed |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `TIMEOUT` | 408 | Request timeout |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Examples

### Complete Python Example

```python
import requests
import json

class BassetHoundClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def navigate(self, url):
        response = requests.post(
            f'{self.base_url}/navigate',
            json={'url': url},
            headers=self.headers
        )
        return response.json()

    def get_cookies(self):
        response = requests.get(
            f'{self.base_url}/storage/cookies',
            headers=self.headers
        )
        return response.json()

    def screenshot(self, format='png'):
        response = requests.post(
            f'{self.base_url}/screenshot',
            json={'format': format},
            headers=self.headers
        )
        return response.json()

    def click(self, selector):
        response = requests.post(
            f'{self.base_url}/interact/click',
            json={'selector': selector},
            headers=self.headers
        )
        return response.json()

# Usage
client = BassetHoundClient('http://localhost:8766/api/v1', 'your-token')

# Navigate
client.navigate('https://example.com')

# Click element
client.click('button.submit')

# Get cookies
cookies = client.get_cookies()

# Take screenshot
screenshot = client.screenshot()
```

### Complete cURL Workflow

```bash
#!/bin/bash

API="http://localhost:8766/api/v1"
TOKEN="your-token"

# Navigate
curl -X POST "$API/navigate" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://example.com"}'

# Wait for page
sleep 3

# Click button
curl -X POST "$API/interact/click" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"selector":"button.submit"}'

# Get screenshot
curl -X POST "$API/screenshot" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"png"}' \
  --output screenshot.png

# Export cookies
curl -X GET "$API/storage/cookies" \
  -H "Authorization: Bearer $TOKEN" \
  > cookies.json
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

class BassetHoundClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async navigate(url) {
    const response = await this.client.post('/navigate', { url });
    return response.data;
  }

  async getCookies() {
    const response = await this.client.get('/storage/cookies');
    return response.data;
  }

  async screenshot() {
    const response = await this.client.post('/screenshot', {
      format: 'png'
    });
    return response.data;
  }

  async click(selector) {
    const response = await this.client.post('/interact/click', {
      selector
    });
    return response.data;
  }
}

// Usage
(async () => {
  const client = new BassetHoundClient(
    'http://localhost:8766/api/v1',
    'your-token'
  );

  // Navigate to page
  await client.navigate('https://example.com');

  // Wait for page
  await new Promise(r => setTimeout(r, 3000));

  // Click button
  await client.click('button.submit');

  // Get screenshot
  const screenshot = await client.screenshot();
  console.log('Screenshot taken:', screenshot.data.size, 'bytes');
})();
```

---

## Rate Limiting

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1623850382
X-RateLimit-Retry-After: 60
```

### Rate Limit Response (429)

```json
{
  "success": false,
  "code": "RATE_LIMITED",
  "error": {
    "message": "Rate limit exceeded",
    "retryAfter": 60
  }
}
```

---

## Pagination

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 250,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "links": {
      "first": "/api/v1/resources?page=1",
      "last": "/api/v1/resources?page=5",
      "next": "/api/v1/resources?page=2",
      "previous": null
    }
  }
}
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 50 | Items per page |
| `sortBy` | string | "created" | Sort field |
| `sortOrder` | string | "desc" | Sort order: "asc" or "desc" |

---

## Webhooks

The REST API supports outgoing webhooks for event notifications.

### Register Webhook

```bash
curl -X POST http://localhost:8766/api/v1/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "url": "https://your-service.com/webhook",
    "events": ["navigation.complete", "screenshot.taken"],
    "active": true
  }'
```

### Webhook Events

- `navigation.complete`: Navigation finished
- `screenshot.taken`: Screenshot captured
- `element.found`: Element located
- `recording.started`: Recording started
- `recording.stopped`: Recording stopped
- `proxy.changed`: Proxy switched
- `error.occurred`: Error happened

---

## Support

For additional help:
- API Documentation: See this file
- Examples: See [Examples](#examples) section
- Error Codes: See [Error Handling](#error-handling) section
- WebSocket API: See `/docs/API-REFERENCE-COMPLETE.md`

