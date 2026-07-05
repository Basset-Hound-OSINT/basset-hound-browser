# Pre-Deployment Checklist

Validate system before production deployment.

## System Requirements

- [ ] Node.js 18.x or higher installed
- [ ] npm 9.x or higher installed
- [ ] Docker installed (for container deployment)
- [ ] Sufficient disk space (5 GB minimum)
- [ ] Port 8765 available (or configured alternate)
- [ ] Network connectivity tested

## Dependencies

- [ ] All npm packages installed: `npm install`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Optional: Tor installed (for Tor features)
- [ ] Optional: Docker available

## Configuration

- [ ] Environment variables set correctly
- [ ] WebSocket port configured
- [ ] Log level appropriate for environment
- [ ] Rate limiting enabled (production)
- [ ] Security headers configured (if applicable)

## Testing

- [ ] Unit tests pass: `npm test`
- [ ] Integration tests pass
- [ ] WebSocket connection works
- [ ] Sample commands execute successfully
- [ ] Error handling verified

## Security

- [ ] No exposed secrets in config
- [ ] No debug mode enabled in production
- [ ] Firewall rules configured
- [ ] SSL/TLS ready (if using WSS)
- [ ] CORS configured appropriately

## Performance

- [ ] Memory usage acceptable
- [ ] CPU usage under load acceptable
- [ ] Latency measurements taken
- [ ] Load testing completed

## Documentation

- [ ] Deployment guide reviewed
- [ ] Runbooks created
- [ ] Alerts configured
- [ ] Monitoring setup complete

## Deployment

- [ ] Staging validation complete
- [ ] Rollback plan documented
- [ ] Deployment window scheduled
- [ ] Team notified

## Post-Deployment

- [ ] Health checks passing
- [ ] Logs monitoring active
- [ ] Alerts tested
- [ ] Performance baseline established

## See Also

- **[Docker Deployment](DOCKER-DEPLOYMENT.md)** - Deploy with Docker
- **[TLS Setup](TLS-SETUP.md)** - Secure WebSocket setup
- **[Monitoring](MONITORING.md)** - Health checks and metrics
- **[Integration Guide](../../INTEGRATION-GUIDE.md)** - Complete deployment guide
