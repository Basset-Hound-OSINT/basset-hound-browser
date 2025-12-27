/**
 * Basset Hound Browser Node.js Client
 *
 * A Node.js client library for controlling the Basset Hound Browser via WebSocket.
 */

const { BassetHoundClient } = require('./client');
const {
  BassetHoundError,
  ConnectionError,
  CommandError,
  TimeoutError
} = require('./errors');

module.exports = {
  BassetHoundClient,
  BassetHoundError,
  ConnectionError,
  CommandError,
  TimeoutError
};
