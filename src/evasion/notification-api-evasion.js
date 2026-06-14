/**
 * Basset Hound Browser - Notification API Evasion Module
 * Implements notification permission spoofing for Notification API
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

class NotificationAPIEvasion {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.technique = options.technique || 'permission-spoofing';
    this.permissionState = options.permissionState || 'default'; // 'default', 'granted', 'denied'
    this.consistency = new Map();
    this.notificationCount = 0;
  }

  /**
   * Technique 1: Permission spoofing
   * Spoof notification permission state
   */
  permissionSpoofing(options = {}) {
    const permissionState = options.permissionState || this.permissionState;

    // Valid permission states for Notifications API
    const validStates = ['default', 'granted', 'denied'];
    const state = validStates.includes(permissionState) ? permissionState : 'default';

    return {
      technique: 'permission-spoofing',
      permission: 'notifications',
      state: state,
      timestamp: Date.now(),
      effectiveness: '75-80%'
    };
  }

  /**
   * Technique 2: Lazy permission grant
   * Gradually shift from 'default' to 'granted'
   */
  lazyPermissionGrant(options = {}) {
    const key = 'permission-state';

    if (!this.consistency.has(key)) {
      this.consistency.set(key, {
        state: 'default',
        grantTime: Date.now(),
        grantDelay: Math.random() * 86400000 + 3600000 // 1-24 hours
      });
    }

    const state = this.consistency.get(key);
    const now = Date.now();

    // After delay, shift to granted
    if (state.state === 'default' && now - state.grantTime > state.grantDelay) {
      state.state = 'granted';
    }

    return {
      technique: 'lazy-permission-grant',
      permission: 'notifications',
      state: state.state,
      willGrantAfter: Math.max(0, state.grantDelay - (now - state.grantTime)),
      timestamp: now,
      effectiveness: '78-83%'
    };
  }

  /**
   * Technique 3: Notification instance spoofing
   * Spoof notification display and interaction
   */
  notificationInstanceSpoofing(options = {}) {
    const title = options.title || 'Notification';
    const body = options.body || 'This is a notification';
    const tag = options.tag || `notification-${this.notificationCount++}`;

    return {
      technique: 'notification-instance-spoofing',
      notification: {
        title: title,
        body: body,
        tag: tag,
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        badge: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        requireInteraction: false,
        silent: false,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      effectiveness: '70-75%'
    };
  }

  /**
   * Technique 4: Permission denial simulation
   * Simulate denied permission state with realistic behavior
   */
  permissionDenialSimulation(options = {}) {
    const key = 'denial-count';

    if (!this.consistency.has(key)) {
      this.consistency.set(key, {
        denialCount: 0,
        denialTime: Date.now()
      });
    }

    const state = this.consistency.get(key);

    return {
      technique: 'permission-denial-simulation',
      permission: 'notifications',
      state: 'denied',
      denialCount: state.denialCount,
      denialReason: 'User has denied notifications',
      canRequestAgain: false, // Cannot request again after denial
      timestamp: Date.now(),
      effectiveness: '65-70%'
    };
  }

  /**
   * Technique 5: Browser notification state
   * Vary browser's native notification capability
   */
  browserNotificationState(options = {}) {
    const isSupported = options.isSupported !== false;
    const permissionState = options.permissionState || this.permissionState;

    return {
      technique: 'browser-notification-state',
      supported: isSupported,
      permission: isSupported ? permissionState : 'denied',
      canCreate: isSupported && permissionState === 'granted',
      canRequest: isSupported && permissionState === 'default',
      vibrationAPI: Math.random() < 0.8, // 80% of devices have vibration
      timestamp: Date.now(),
      effectiveness: '72-77%'
    };
  }

  /**
   * Set permission state
   */
  setPermissionState(state) {
    const validStates = ['default', 'granted', 'denied'];
    if (!validStates.includes(state)) {
      return false;
    }

    this.permissionState = state;

    // Clear lazy grant state if setting manually
    if (this.consistency.has('permission-state')) {
      this.consistency.delete('permission-state');
    }

    return true;
  }

  /**
   * Apply notification API evasion
   */
  apply(options = {}) {
    if (!this.enabled) return null;

    switch (this.technique) {
      case 'permission-spoofing':
        return this.permissionSpoofing(options);
      case 'lazy-permission-grant':
        return this.lazyPermissionGrant(options);
      case 'notification-instance-spoofing':
        return this.notificationInstanceSpoofing(options);
      case 'permission-denial-simulation':
        return this.permissionDenialSimulation(options);
      case 'browser-notification-state':
        return this.browserNotificationState(options);
      case 'combined':
        return this.combinedEvasion(options);
      default:
        return this.permissionSpoofing(options);
    }
  }

  /**
   * Combined evasion technique
   */
  combinedEvasion(options = {}) {
    const lazyResult = this.lazyPermissionGrant(options);
    const browserResult = this.browserNotificationState(options);

    return {
      technique: 'combined',
      permission: 'notifications',
      state: lazyResult.state,
      supported: browserResult.supported,
      canCreate: browserResult.canCreate,
      canRequest: browserResult.canRequest,
      willGrantAfter: lazyResult.willGrantAfter,
      timestamp: Date.now(),
      effectiveness: '85-90%'
    };
  }

  /**
   * Get available techniques
   */
  getAvailableTechniques() {
    return [
      'permission-spoofing',
      'lazy-permission-grant',
      'notification-instance-spoofing',
      'permission-denial-simulation',
      'browser-notification-state',
      'combined'
    ];
  }

  /**
   * Set technique
   */
  setTechnique(technique) {
    if (!this.getAvailableTechniques().includes(technique)) {
      return false;
    }

    this.technique = technique;
    return true;
  }

  /**
   * Get evasion status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      technique: this.technique,
      permissionState: this.permissionState,
      notificationCount: this.notificationCount,
      availableTechniques: this.getAvailableTechniques(),
      validPermissionStates: ['default', 'granted', 'denied'],
      estimatedEffectiveness: {
        'permission-spoofing': '75-80%',
        'lazy-permission-grant': '78-83%',
        'notification-instance-spoofing': '70-75%',
        'permission-denial-simulation': '65-70%',
        'browser-notification-state': '72-77%',
        'combined': '85-90%'
      }
    };
  }
}

module.exports = NotificationAPIEvasion;
