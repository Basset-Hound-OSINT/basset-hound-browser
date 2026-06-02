/**
 * Service Layer Index
 * Exports all core services with clean business logic separation
 *
 * Services provide pure business logic without infrastructure concerns.
 * They should not depend on WebSocket, filesystem, or network I/O directly.
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

const TechDetectionService = require('./tech-detection-service');
const SessionManagementService = require('./session-management-service');
const CompetitorMonitoringService = require('./competitor-monitoring-service');
const ProxyIntelligenceService = require('./proxy-intelligence-service');

module.exports = {
  TechDetectionService,
  SessionManagementService,
  CompetitorMonitoringService,
  ProxyIntelligenceService
};
