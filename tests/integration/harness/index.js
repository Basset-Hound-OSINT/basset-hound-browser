/**
 * Integration Test Harness
 *
 * Exports all test harness components for use in integration tests.
 */

const { TestServer } = require('./test-server');
const { MockExtension } = require('./mock-extension');
const { MockBrowser } = require('./mock-browser');

module.exports = {
  TestServer,
  MockExtension,
  MockBrowser
};
