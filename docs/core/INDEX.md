# Core Architecture Index

**Last Updated:** May 11, 2026  
**Version:** 11.3.0

---

## Overview

This directory contains core architecture documentation and technical specifications for Basset Hound Browser.

---

## Core Documentation

### Architectural Boundaries
- See `/docs/SCOPE.md` for:
  - System boundaries
  - Component responsibilities
  - Architectural decisions
  - Design principles

### API Reference
- See `/docs/API-REFERENCE.md` for:
  - 164 WebSocket commands
  - Request/response formats
  - Error handling
  - Protocol specification

### Deployment
- See `/docs/DEPLOYMENT.md` for:
  - Docker deployment
  - Configuration options
  - Environment setup
  - Troubleshooting

---

## Component Architecture

### Electron Main Process
- Window management
- Process lifecycle
- IPC communication
- Resource management

### WebSocket Server
- 164 command handlers
- JSON message protocol
- Connection management
- Error handling

### Feature Modules
- **Evasion:** Bot detection bypass
- **Forensics:** Evidence collection
- **Recording:** Session recording
- **Proxy:** Network proxy management
- **Session:** Profile isolation
- **Analysis:** Technology detection

---

## Data Flow

### Navigation Flow
```
Command → Parser → Handler → Browser → Target
              ↓
         Error Handling
```

### Extraction Flow
```
Command → DOM Query → Processing → Extraction → Response
                        ↓
                  Error Handling
```

### Recording Flow
```
Frame Capture → Encoding → WebM Output → Storage
```

---

## Communication Protocols

### WebSocket Protocol
- Connection establishment
- Message format (JSON)
- Binary frame support
- Compression options

### IPC Communication
- Main ↔ Renderer process
- Secure message passing
- Context isolation

### External APIs
- Proxy service integration
- OSINT data sources
- Authentication services

---

## Security Architecture

### Sandboxing
- Context isolation
- IPC validation
- Credential protection
- Rate limiting

### Encryption
- TLS for all connections
- Certificate validation
- Encrypted storage
- Secret management

### Access Control
- Command authorization
- Resource limits
- Rate limiting
- Audit logging

---

## Performance Architecture

### Resource Management
- Connection pooling
- Memory management
- Garbage collection tuning
- Cache optimization

### Optimization
- Request batching
- Screenshot compression
- Data streaming
- Parallel operations

### Scaling
- Concurrent connections
- Load distribution
- Resource allocation
- Performance monitoring

---

## Module Dependencies

### Critical Dependencies
- `ws` - WebSocket server
- `electron` - GUI framework
- `electron-builder` - Packaging

### Optional Dependencies
- `tor-service` - Tor integration
- `tesseract.js` - OCR
- `puppeteer` - Chromium control

---

## Configuration Architecture

### Configuration Files
- `config.yaml` - Main configuration
- `.env` - Environment variables
- `docker-compose.yml` - Docker setup
- Module-specific configs

### Configuration Hierarchy
1. Default values (hardcoded)
2. Configuration file
3. Environment variables
4. Runtime overrides

---

## Error Handling

### Error Categories
- Connection errors
- Command errors
- Browser errors
- Resource errors
- Timeout errors

### Recovery Strategies
- Automatic reconnection
- Message retry
- Fallback options
- Graceful degradation

---

## State Management

### Session State
- Profile isolation
- Cookie management
- Storage management
- State persistence

### Application State
- Connection state
- Running commands
- Resource allocation
- Error state

---

## Testing Architecture

### Test Organization
- Unit tests (components)
- Integration tests (modules)
- E2E tests (workflows)
- Performance tests (load)

### Test Infrastructure
- Mock servers
- Test utilities
- Fixture data
- Assertion libraries

---

## Deployment Architecture

### Docker Containers
- Single container deployment
- Multi-container orchestration
- Network management
- Volume management

### Service Architecture
- Stateless design
- Health checks
- Graceful shutdown
- Logging integration

---

## Monitoring Architecture

### Metrics Collection
- Prometheus integration
- Custom metrics
- Performance monitoring
- Health checks

### Alerting
- Alert rules
- Notification channels
- Escalation policies
- SLA tracking

---

## Integration Architecture

### External System Integration
- WebSocket API
- MCP (Model Context Protocol)
- REST APIs
- File-based integration

### Data Integration
- OSINT sources
- Proxy services
- Authentication services
- Storage systems

---

## Version Control

### Branch Strategy
- `main` - Production ready
- `develop` - Development
- `feature/*` - Feature branches
- `hotfix/*` - Emergency fixes

### Release Process
- Version bumping
- Changelog updates
- Tag creation
- Release notes

---

## Documentation Standards

### Code Documentation
- JSDoc comments
- README files
- Implementation guides
- Example code

### API Documentation
- Command reference
- Parameter specifications
- Response formats
- Error codes

---

## References

- `/docs/SCOPE.md` - Architectural boundaries
- `/docs/API-REFERENCE.md` - API documentation
- `/src/INDEX.md` - Source code organization
- `/docs/DEPLOYMENT.md` - Deployment guide

---

**Status:** ✅ Production Ready  
**Last Updated:** May 11, 2026  
**Version:** 11.3.0  
**Maintained By:** Architecture Team
