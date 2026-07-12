# Frequently Asked Questions

Quick answers to common questions.

## Getting Started

**Q: How do I get started?**  
A: See [Getting Started](../getting-started/FIRST-COMMAND.md) for your first command in 5 minutes.

**Q: What are the system requirements?**  
A: Node.js 18+, npm 9+, and 5GB disk space. See [Installation](../getting-started/INSTALLATION.md).

**Q: Can I use Docker?**  
A: Yes! See [Docker Quick Start](../getting-started/DOCKER-QUICKSTART.md).

## Connection Issues

**Q: Can't connect to WebSocket?**  
A: See [Connection Issues](CONNECTION-ISSUES.md) troubleshooting guide.

**Q: What's the default WebSocket URL?**  
A: `ws://localhost:8765` by default.

**Q: Can I use WSS (secure WebSocket)?**  
A: Yes, see [TLS Setup](../deployment/TLS-SETUP.md).

## Commands & API

**Q: How many commands are available?**  
A: 140+ commands. See [Complete Reference](../api/COMPLETE-REFERENCE.md).

**Q: What if a command returns an error?**  
A: See [Error Codes](../api/ERROR-CODES.md) for meanings and solutions.

**Q: Can I send multiple commands at once?**  
A: Yes, batch them by sending multiple JSON objects.

## Bot Evasion

**Q: How do I avoid bot detection?**  
A: See [Bot Evasion Guide](../guides/BOT-EVASION.md) for techniques.

**Q: Still being detected?**  
A: See [Bot Detection Troubleshooting](BOT-DETECTION.md).

**Q: Do I need Tor?**  
A: Optional. Tor is useful for anonymity but not required.

## Performance

**Q: Why is it slow?**  
A: See [Performance Issues](PERFORMANCE.md) troubleshooting guide.

**Q: Can I improve throughput?**  
A: Yes, see [Performance Tuning](../deployment/PERFORMANCE-TUNING.md).

## Docker

**Q: Docker container won't start?**  
A: See [Docker Issues](DOCKER-ISSUES.md) guide.

**Q: How do I access logs in Docker?**  
A: `docker logs -f <container-name>`

## Development

**Q: How do I contribute?**  
A: See [Contributing](../development/CONTRIBUTING.md) guide.

**Q: Where's the code organized?**  
A: See [Directory Structure](../development/DIRECTORY-STRUCTURE.md).

**Q: How do I run tests?**  
A: `npm test` - see [Testing](../development/TESTING.md) for details.

## Deployment

**Q: Is it production-ready?**  
A: Yes, v12.8.0 is production-ready. See [Pre-Deployment Checklist](../deployment/PRE-DEPLOYMENT-CHECKLIST.md).

**Q: How do I deploy to production?**  
A: See [Docker Deployment](../deployment/DOCKER-DEPLOYMENT.md) guide.

## Security

**Q: Is it secure?**  
A: Yes, with proper configuration. See [Security Guide](../../SECURITY.md) and [Rate Limiting](../deployment/RATE-LIMITING-SECURITY.md).

**Q: Do I need authentication?**  
A: Optional. Development mode is open by default.

## Integration

**Q: How do I integrate with my app?**  
A: See [Integration Guide](../../INTEGRATION-GUIDE.md).

**Q: Are there client libraries?**  
A: Yes, Python and Node.js clients available. See `integrations/` directory.

## More Help

- Browse the [full wiki](../README.md)
- See [Troubleshooting Index](../troubleshooting/README.md)
- Check [API Documentation](../api/OVERVIEW.md)
- File an issue on GitHub
