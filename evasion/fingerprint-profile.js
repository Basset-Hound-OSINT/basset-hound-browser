/**
 * Fingerprint Profile System
 *
 * Phase 17: Profile-based consistent fingerprints
 *
 * Creates internally consistent browser fingerprint profiles where all elements
 * (UA, platform, WebGL, screen, timezone) match each other realistically.
 *
 * This file is a thin barrel re-exporting the modularized implementation from
 * ./fingerprint-profile/. The public interface (module.exports shape) is
 * byte-for-byte identical to the pre-split monolith.
 */

const {
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
  COMMON_DECOY_FONTS
} = require('./fingerprint-profile/configs');

const { FingerprintProfile } = require('./fingerprint-profile/fingerprint-profile');
const { FingerprintProfileManager } = require('./fingerprint-profile/profile-manager');

module.exports = {
  FingerprintProfile,
  FingerprintProfileManager,
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
  COMMON_DECOY_FONTS
};
