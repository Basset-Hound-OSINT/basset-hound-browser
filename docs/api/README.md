# Basset Hound Browser API Documentation

This directory contains the OpenAPI specification for the Basset Hound Browser WebSocket API.

## Files

- `openapi.yaml` - OpenAPI 3.0 specification
- `index.html` - Interactive Swagger UI documentation

## Viewing the Documentation

### Local Server

Start a simple HTTP server in this directory:

```bash
# Python 3
python -m http.server 8000

# Node.js (with npx)
npx serve .
```

Then open `http://localhost:8000` in your browser.

### From Project Root

If you have the browser running with WebSocket server, you can access the API documentation directly through the browser's built-in documentation server (if enabled).

## WebSocket API Notes

Unlike typical REST APIs, this is a **WebSocket-based API**. The "paths" in the OpenAPI spec represent WebSocket commands, not HTTP endpoints.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected to Basset Hound Browser');
};
```

### Sending Commands

```javascript
// Send a command
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'navigate',
  url: 'https://example.com'
}));
```

### Receiving Responses

```javascript
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};
```

## Using with Client Libraries

Instead of using the WebSocket API directly, consider using the official client libraries:

### Python

```bash
pip install basset-hound-client
```

```python
from basset_hound import BassetHoundClient

with BassetHoundClient() as client:
    client.navigate("https://example.com")
    print(client.get_title())
```

### Node.js

```bash
npm install basset-hound-client
```

```javascript
const { BassetHoundClient } = require('basset-hound-client');

const client = new BassetHoundClient();
await client.connect();
await client.navigate('https://example.com');
console.log(await client.getTitle());
await client.disconnect();
```

### CLI

```bash
npm install -g basset-hound-cli

basset-hound navigate https://example.com
basset-hound title
```

## Generating Client Code

You can use the OpenAPI spec to generate client code in various languages:

```bash
# Using OpenAPI Generator
openapi-generator generate -i openapi.yaml -g python -o ./python-client
openapi-generator generate -i openapi.yaml -g typescript-node -o ./ts-client
openapi-generator generate -i openapi.yaml -g go -o ./go-client
```

Note: Since this is a WebSocket API, generated REST clients won't work directly. Use them as a reference for the command structures.

## API Versioning

The API version follows the browser version. Current version: **4.0.0**

Major version changes may include breaking changes to the API.
