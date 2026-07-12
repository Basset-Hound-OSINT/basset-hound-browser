# Troubleshooting Guide - /docs/wiki/troubleshooting/

Problem-solving resources, common issue resolutions, and support documentation.

## Files

- `CONNECTION-ISSUES.md` - WebSocket connection failures and diagnostic steps
- `BOT-DETECTION.md` - Bot detection evasion problems and solutions
- `DOCKER-ISSUES.md` - Docker container issues and troubleshooting
- `PERFORMANCE.md` - Performance degradation diagnosis and optimization
- `FAQ.md` - Frequently asked questions and common concerns

## Quick Diagnostics

**Connection Problems:**
- Check WebSocket port (8765) availability
- Verify network connectivity and firewall rules
- Validate authentication tokens and session state
- Review server logs for connection errors

**Performance Issues:**
- Monitor memory usage and session count
- Check compression ratios and latency metrics
- Verify CPU utilization under load
- Review garbage collection behavior

**Docker Issues:**
- Inspect container logs and network configuration
- Verify environment variables and volume mounts
- Check resource limits and availability
- Review container health status

**Bot Detection:**
- Review evasion module configuration
- Verify fingerprinting and proxy settings
- Check user agent rotation and behavior simulation
- Monitor detection service responses

## Resolution Time Estimates

- Connection failures: 5-10 minutes
- Performance problems: 10-20 minutes
- Docker issues: 10-15 minutes
- Bot detection problems: 15-30 minutes

---
**Total Files:** 5 | **Purpose:** Troubleshooting & Support | **Updated:** 2026-06-22
