# Development Setup

Setup local development environment.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git
- Optional: Docker

## Install Dependencies

```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
npm install
```

## Start Development Server

```bash
# With hot reload and verbose logging
npm start:dev

# Or
npm run dev
```

Browser runs at `ws://localhost:8765`

## Development Tools

### Environment Variables

Create `.env`:

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=basset-hound:*
ELECTRON_ENABLE_LOGGING=true
```

### Debugging

Enable verbose logging:

```bash
DEBUG=basset-hound:* npm start:dev
```

View console output:

```bash
npm start:dev 2>&1 | tee debug.log
```

## Code Organization

- **Modules:** Each feature in own directory
- **Tests:** Colocated in `tests/` directory
- **Entry Point:** `src/main/main.js`

## Common Development Tasks

### Run Tests

```bash
npm test
npm run test:unit
npm run test:integration
```

### Build

```bash
npm run build:dev
npm run build:prod
npm run pack  # Unpacked for testing
```

### Linting

```bash
npm run lint
npm run format
```

## IDE Setup

### VS Code

Install extensions:
- ESLint
- Debugger for Chrome
- WebSocket Debugging

### Debugging in VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch App",
      "program": "${workspaceFolder}/src/main/main.js"
    }
  ]
}
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: description"

# Push and create PR
git push origin feature/my-feature
```

## See Also

- **[Architecture](ARCHITECTURE.md)** - System design
- **[Testing](TESTING.md)** - Test setup
- **[Contributing](CONTRIBUTING.md)** - Contribution guidelines
