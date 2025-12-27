# Basset Hound Browser Documentation

## Overview

Basset Hound Browser is a custom Electron-based automation browser designed for OSINT investigations, web scraping, and AI-driven browser automation. It provides a controlled environment for running browser automation with extension support.

## Documentation Index

| Document | Description |
|----------|-------------|
| [roadmap.md](roadmap.md) | Development roadmap with phases and milestones |
| [browser-automation-comparison.md](browser-automation-comparison.md) | Comparison with Chrome extension approach |

## Quick Start

```bash
# Install dependencies
cd ~/basset-hound-browser
npm install

# Run the browser
npm start

# Development with auto-reload
npm run watch
```

## Architecture

```
basset-hound-browser/
├── src/
│   ├── main/
│   │   ├── main.js         # Electron main process
│   │   └── preload.js      # IPC bridge
│   └── renderer/
│       ├── index.html      # Browser UI
│       ├── index_main.js   # Tab/UI logic
│       └── index_styles.css
├── extensions/
│   └── autofill/           # Chrome extension (git submodule)
├── docs/                   # Documentation
└── package.json
```

## Key Features

- **Multi-tab browsing** with Chrome-like tab management
- **Chrome extension support** - loads extensions from `/extensions` directory
- **Form submission handling** - intercepts `target="_blank"` forms
- **Window state persistence** - remembers window position and size
- **Security** - context isolation, CSP headers, sandboxing

## Integration with OSINT Ecosystem

- **autofill-extension**: Bundled as git submodule for browser automation
- **basset-hound**: Entity/relationship storage (planned)
- **palletAI**: AI agent orchestration (planned)
- **osint-resources**: Tool knowledge base (planned)

## Related Projects

- [autofill-extension](../../autofill-extension/) - Chrome extension for browser automation
- [basset-hound](../../basset-hound/) - OSINT entity management
- [osint-resources](../../osint-resources/) - OSINT tool documentation

---

*See [roadmap.md](roadmap.md) for development plans.*
