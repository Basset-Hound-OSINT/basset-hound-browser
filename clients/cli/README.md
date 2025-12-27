# Basset Hound Browser CLI

Command-line interface for Basset Hound Browser automation.

## Installation

```bash
npm install -g basset-hound-cli
```

Or run directly with npx:

```bash
npx basset-hound-cli navigate https://example.com
```

## Global Options

```bash
-H, --host <host>    WebSocket host (default: localhost)
-p, --port <port>    WebSocket port (default: 8765)
-f, --format <fmt>   Output format: json, table, plain (default: plain)
-t, --timeout <ms>   Command timeout in ms (default: 30000)
-q, --quiet          Suppress non-essential output
-V, --version        Output version number
-h, --help           Display help
```

## Commands

### Connection

```bash
# Test connection
basset-hound connect

# Get browser status
basset-hound status
```

### Navigation

```bash
# Navigate to URL
basset-hound navigate https://example.com
basset-hound go https://example.com

# Wait conditions
basset-hound navigate https://example.com --wait networkidle

# Navigation history
basset-hound back
basset-hound forward
basset-hound reload
basset-hound reload --no-cache

# Get current URL and title
basset-hound url
basset-hound title
```

### Input

```bash
# Click element
basset-hound click "#submit-button"
basset-hound click ".menu-item"

# Type text
basset-hound type "#search" "query text"
basset-hound type "#input" "slow typing" --delay 100

# Scroll
basset-hound scroll -y 500
basset-hound scroll -x 100 -y 200
basset-hound scroll -y 300 --selector "#container"
```

### Content Extraction

```bash
# Extract all content
basset-hound extract

# Extract specific content types
basset-hound extract metadata
basset-hound extract links
basset-hound extract forms
basset-hound extract images
basset-hound extract scripts
basset-hound extract structured

# Options
basset-hound extract links --no-external
basset-hound extract images --no-lazy
```

### Technology Detection

```bash
# Detect technologies on page
basset-hound detect

# Technology info
basset-hound tech-info React
basset-hound tech-categories
basset-hound tech-search "javascript framework"
```

### Network Analysis

```bash
# Start/stop capture
basset-hound network start
basset-hound network stop

# Get requests
basset-hound network requests
basset-hound network reqs --type xhr
basset-hound network reqs --domain api.example.com

# Shortcuts
basset-hound requests
basset-hound requests --type fetch

# Statistics
basset-hound network stats

# Export capture
basset-hound network export --format-export har
basset-hound network export --format-export json

# Clear capture
basset-hound network clear

# Analysis
basset-hound slow-requests --threshold 2000
basset-hound failed-requests
basset-hound security-headers
```

### Screenshots

```bash
# Save screenshot
basset-hound screenshot
basset-hound screenshot page.png
basset-hound ss output.png

# Full page
basset-hound screenshot --full

# JPEG format
basset-hound screenshot page.jpg --jpeg --quality 90

# Base64 output
basset-hound screenshot-base64
basset-hound screenshot-base64 --full
```

### Cookies

```bash
# Get cookies
basset-hound cookies
basset-hound cookies --url https://example.com
```

### JavaScript Execution

```bash
# Execute script
basset-hound exec "return document.title"
basset-hound exec "document.body.style.background = 'red'"
```

### Fingerprint & Evasion

```bash
# Set user agent
basset-hound user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."

# Set viewport
basset-hound viewport 1920 1080

# Get/randomize fingerprint
basset-hound fingerprint
basset-hound randomize
```

## Output Formats

### Plain (default)

```bash
basset-hound status
# url: https://example.com
# title: Example Domain
# tabs: 1
```

### JSON

```bash
basset-hound status --format json
# {"url":"https://example.com","title":"Example Domain","tabs":1}
```

### Table

```bash
basset-hound status --format table
# ┌─────┬────────────────────┐
# │ url │ https://example.com│
# ├─────┼────────────────────┤
# │title│ Example Domain     │
# └─────┴────────────────────┘
```

## Examples

### Basic Navigation

```bash
basset-hound navigate https://example.com
basset-hound title
basset-hound screenshot example.png
```

### Content Extraction Workflow

```bash
basset-hound navigate https://example.com
basset-hound extract metadata --format json > metadata.json
basset-hound extract links --format json > links.json
basset-hound detect --format json > technologies.json
```

### Network Analysis Workflow

```bash
# Start capture before navigation
basset-hound network start

# Navigate and interact
basset-hound navigate https://api-heavy-site.com
basset-hound click "#load-data"

# Analyze
basset-hound network stats
basset-hound slow-requests
basset-hound failed-requests

# Export and cleanup
basset-hound network export --format-export har > capture.har
basset-hound network stop
basset-hound network clear
```

### Scripting Example

```bash
#!/bin/bash

URL="https://example.com"

# Navigate
basset-hound navigate "$URL" --quiet

# Get data as JSON
TITLE=$(basset-hound title)
TECH=$(basset-hound detect --format json)

echo "Page: $TITLE"
echo "Technologies: $TECH"

# Screenshot
basset-hound screenshot "${URL//[^a-zA-Z0-9]/_}.png" --full
```

## Configuration

You can also set defaults via environment variables:

```bash
export BASSET_HOST=192.168.1.100
export BASSET_PORT=9000
export BASSET_FORMAT=json

basset-hound status  # Uses env vars
```

## License

MIT License
