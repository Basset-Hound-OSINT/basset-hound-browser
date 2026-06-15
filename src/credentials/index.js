/**
 * Credentials Module
 * Exports all credential-related modules
 */

const TOTPGenerator = require('./totp-generator');
const HOTPGenerator = require('./hotp-generator');

module.exports = {
  TOTPGenerator,
  HOTPGenerator
};
