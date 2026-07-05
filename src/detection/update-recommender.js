/**
 * Update Recommendation Engine
 *
 * Provides intelligent recommendations for updating detected technologies.
 *
 * Features:
 * - Latest version detection
 * - Security-only update paths
 * - Feature release recommendations
 * - Compatibility analysis
 * - Downtime estimation
 * - Migration guidance
 *
 * @module update-recommender
 */

const { createLogger } = require('../../logging');

class UpdateRecommender {
  constructor(options = {}) {
    this.logger = createLogger('UpdateRecommender');
    this.versionDatabase = this._initializeVersionDatabase();
    this.compatibilityDatabase = this._initializeCompatibilityDatabase();
  }

  /**
   * Get update recommendation for a technology
   * @param {string} techName - Technology name
   * @param {string} currentVersion - Current installed version
   * @param {string} environmentType - Environment (production, staging, development)
   * @returns {object} Update recommendation
   */
  getRecommendation(techName, currentVersion, environmentType = 'production') {
    if (!techName || !currentVersion) {
      return {
        success: false,
        error: 'Technology name and version required'
      };
    }

    try {
      const versionInfo = this.versionDatabase[techName];

      // If no version info available, create a generic recommendation
      if (!versionInfo) {
        return {
          success: true,
          technology: techName,
          currentVersion: currentVersion,
          environment: environmentType,
          recommendations: [
            {
              type: 'generic',
              description: 'Check for updates',
              available: true,
              priority: 'LOW',
              recommendation: 'Check the official project repository or website for the latest version',
              estimatedTime: 'Varies'
            }
          ],
          estimatedDowntime: '30 minutes',
          backupRequired: this._backupRequired(techName),
          testingRequired: this._testingRequired(environmentType),
          rollbackPossible: false,
          message: 'Version database does not contain information for this technology'
        };
      }

      const latest = versionInfo.latest;
      const stable = versionInfo.stable;
      const lts = versionInfo.lts;

      const recommendation = {
        success: true,
        technology: techName,
        currentVersion: currentVersion,
        environment: environmentType,
        recommendations: [],
        estimatedDowntime: this._estimateDowntime(techName, currentVersion, stable?.version),
        backupRequired: this._backupRequired(techName),
        testingRequired: this._testingRequired(environmentType),
        rollbackPossible: this._rollbackPossible(techName, stable?.version)
      };

      // Generate different recommendation paths
      recommendation.recommendations.push(
        this._createSecurityPath(techName, currentVersion, versionInfo),
        this._createStablePath(techName, currentVersion, versionInfo),
        this._createLTSPath(techName, currentVersion, versionInfo)
      );

      // Add compatibility information
      recommendation.compatibility = this._checkCompatibility(
        techName,
        currentVersion,
        stable?.version
      );

      // Add breaking changes if major version upgrade
      recommendation.breakingChanges = this._getBreakingChanges(
        techName,
        currentVersion,
        stable?.version
      );

      return recommendation;
    } catch (error) {
      this.logger.error('recommendation_failed', {
        tech: techName,
        version: currentVersion,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create security update path
   * @private
   */
  _createSecurityPath(techName, currentVersion, versionInfo) {
    const patches = versionInfo.patches
      .filter(p => this._isVersionGreater(p.version, currentVersion))
      .sort((a, b) => this._compareVersions(b.version, a.version))
      .slice(0, 3);

    if (patches.length === 0) {
      return {
        type: 'security',
        description: 'Security patches',
        available: false,
        reason: 'No security patches available'
      };
    }

    return {
      type: 'security',
      description: 'Security patches and bug fixes',
      available: true,
      target: patches[0].version,
      priority: 'CRITICAL',
      patches: patches,
      estimatedTime: '1-2 hours',
      risk: 'LOW',
      recommendation: `Update to ${patches[0].version} immediately for critical security fixes`,
      changesSummary: patches[0].changes || 'Security fixes and patches'
    };
  }

  /**
   * Create stable release path
   * @private
   */
  _createStablePath(techName, currentVersion, versionInfo) {
    const stable = versionInfo.stable;

    if (!stable || !this._isVersionGreater(stable.version, currentVersion)) {
      return {
        type: 'stable',
        description: 'Latest stable release',
        available: false,
        reason: 'Already on latest stable version'
      };
    }

    const changes = stable.changes || 'New features and improvements';
    const isMajor = this._isMajorVersionChange(currentVersion, stable.version);

    return {
      type: 'stable',
      description: 'Latest stable release',
      available: true,
      target: stable.version,
      priority: isMajor ? 'MEDIUM' : 'LOW',
      estimatedTime: isMajor ? '4-8 hours' : '2-3 hours',
      risk: isMajor ? 'MEDIUM' : 'LOW',
      isMajorVersion: isMajor,
      recommendation: `Update to ${stable.version} for new features and improvements`,
      changesSummary: changes,
      releaseDate: stable.releaseDate,
      downloadUrl: stable.downloadUrl
    };
  }

  /**
   * Create LTS path
   * @private
   */
  _createLTSPath(techName, currentVersion, versionInfo) {
    const lts = versionInfo.lts;

    if (!lts || !this._isVersionGreater(lts.version, currentVersion)) {
      return {
        type: 'lts',
        description: 'Long-term support version',
        available: false,
        reason: 'No newer LTS version available'
      };
    }

    return {
      type: 'lts',
      description: 'Long-term support version',
      available: true,
      target: lts.version,
      priority: 'MEDIUM',
      supportUntil: lts.supportEndDate,
      estimatedTime: '3-6 hours',
      risk: 'LOW',
      recommendation: `Consider updating to ${lts.version} for long-term support and stability`,
      changesSummary: 'Stable version with extended support period',
      supportedUntil: lts.supportEndDate
    };
  }

  /**
   * Check compatibility of upgrade
   * @private
   */
  _checkCompatibility(techName, currentVersion, targetVersion) {
    const compat = this.compatibilityDatabase[techName] || {};

    return {
      dependencies: compat.dependencies || [],
      knownIssues: compat.knownIssues || [],
      requiresModuleUpdates: compat.requiresModuleUpdates || false,
      databaseMigration: compat.databaseMigration || false,
      configChanges: compat.configChanges || []
    };
  }

  /**
   * Get breaking changes between versions
   * @private
   */
  _getBreakingChanges(techName, fromVersion, toVersion) {
    if (!this._isMajorVersionChange(fromVersion, toVersion)) {
      return [];
    }

    const breaking = this.versionDatabase[techName]?.breakingChanges || [];
    return breaking.filter(change => {
      const inRange = this._isInVersionRange(change.introducedIn, fromVersion, toVersion);
      return inRange;
    });
  }

  /**
   * Estimate downtime for upgrade
   * @private
   */
  _estimateDowntime(techName, fromVersion, toVersion) {
    const isMajor = this._isMajorVersionChange(fromVersion, toVersion);
    const estimates = {
      'WordPress': { minor: '5-15 minutes', major: '15-30 minutes' },
      'Drupal': { minor: '10-30 minutes', major: '30-60 minutes' },
      'Apache': { minor: '2-5 minutes', major: '5-10 minutes' },
      'Nginx': { minor: '1-2 minutes', major: '2-5 minutes' },
      'Node.js': { minor: '1 minute', major: '2-5 minutes' },
      'PHP': { minor: '1-2 minutes', major: '2-5 minutes' },
      'MySQL': { minor: '5-15 minutes', major: '15-60 minutes' },
      'PostgreSQL': { minor: '5-10 minutes', major: '10-30 minutes' }
    };

    const defaults = { minor: '5-30 minutes', major: '30-120 minutes' };
    const estimate = estimates[techName] || defaults;
    return isMajor ? estimate.major : estimate.minor;
  }

  /**
   * Check if backup is required
   * @private
   */
  _backupRequired(techName) {
    const requiresBackup = [
      'WordPress', 'Drupal', 'Joomla', 'MySQL', 'PostgreSQL',
      'MongoDB', 'Redis', 'Elasticsearch'
    ];
    return requiresBackup.includes(techName);
  }

  /**
   * Check if testing is required
   * @private
   */
  _testingRequired(environmentType) {
    return environmentType === 'production';
  }

  /**
   * Check if rollback is possible
   * @private
   */
  _rollbackPossible(techName, targetVersion) {
    const canRollback = [
      'WordPress', 'Drupal', 'Node.js', 'Apache', 'Nginx',
      'PHP', 'Python', 'Ruby'
    ];
    return canRollback.includes(techName);
  }

  /**
   * Check if version1 is greater than version2
   * @private
   */
  _isVersionGreater(v1, v2) {
    if (!v1 || !v2) {
      return false;
    }

    const normalize = (v) => {
      const parts = v.split(/[.-]/).map(p => {
        const num = parseInt(p, 10);
        return isNaN(num) ? 0 : num;
      });
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    };

    const [v1Major, v1Minor, v1Patch] = normalize(v1);
    const [v2Major, v2Minor, v2Patch] = normalize(v2);

    if (v1Major !== v2Major) {
      return v1Major > v2Major;
    }
    if (v1Minor !== v2Minor) {
      return v1Minor > v2Minor;
    }
    return v1Patch > v2Patch;
  }

  /**
   * Compare two versions
   * @private
   */
  _compareVersions(v1, v2) {
    if (this._isVersionGreater(v1, v2)) {
      return 1;
    }
    if (this._isVersionGreater(v2, v1)) {
      return -1;
    }
    return 0;
  }

  /**
   * Check if it's a major version change
   * @private
   */
  _isMajorVersionChange(fromVersion, toVersion) {
    if (!fromVersion || !toVersion) {
      return false;
    }

    const getMajor = (v) => {
      const match = v.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    return getMajor(fromVersion) !== getMajor(toVersion);
  }

  /**
   * Check if version is in range
   * @private
   */
  _isInVersionRange(version, minVersion, maxVersion) {
    if (minVersion && !this._isVersionGreater(version, minVersion)) {
      return false;
    }
    if (maxVersion && this._isVersionGreater(version, maxVersion)) {
      return false;
    }
    return true;
  }

  /**
   * Initialize version database
   * @private
   */
  _initializeVersionDatabase() {
    return {
      'Node.js': {
        latest: { version: '20.9.0', releaseDate: '2023-10-24', downloadUrl: 'https://nodejs.org/' },
        stable: { version: '20.9.0', releaseDate: '2023-10-24', downloadUrl: 'https://nodejs.org/', changes: 'Performance improvements and bug fixes' },
        lts: { version: '18.18.2', supportEndDate: '2025-04-30', releaseDate: '2023-10-24' },
        patches: [
          { version: '18.18.2', changes: 'Security fixes' },
          { version: '18.17.1', changes: 'Bug fixes' }
        ],
        breakingChanges: []
      },
      'React': {
        latest: { version: '18.2.0', releaseDate: '2023-08-08', downloadUrl: 'https://react.dev/' },
        stable: { version: '18.2.0', releaseDate: '2023-08-08', downloadUrl: 'https://react.dev/', changes: 'Concurrent rendering and Suspense' },
        lts: { version: '17.0.2', supportEndDate: '2024-06-08', releaseDate: '2021-08-10' },
        patches: [
          { version: '18.2.0', changes: 'React 18 release' },
          { version: '17.0.2', changes: 'Event delegation improvements' }
        ],
        breakingChanges: []
      },
      'Angular': {
        latest: { version: '17.0.0', releaseDate: '2023-11-06', downloadUrl: 'https://angular.io/' },
        stable: { version: '17.0.0', releaseDate: '2023-11-06', downloadUrl: 'https://angular.io/', changes: 'Control flow syntax and esbuild' },
        lts: { version: '16.2.0', supportEndDate: '2024-11-08', releaseDate: '2023-05-03' },
        patches: [
          { version: '17.0.0', changes: 'Major version with new features' },
          { version: '16.2.0', changes: 'LTS update' }
        ],
        breakingChanges: []
      },
      'WordPress': {
        latest: { version: '6.4', releaseDate: '2023-11-07', downloadUrl: 'https://wordpress.org/download/' },
        stable: { version: '6.4', releaseDate: '2023-11-07', downloadUrl: 'https://wordpress.org/download/', changes: 'Performance and security improvements' },
        lts: null,
        patches: [
          { version: '6.4', changes: 'Performance enhancements' },
          { version: '6.3.2', changes: 'Security patches' }
        ],
        breakingChanges: []
      },
      'Django': {
        latest: { version: '4.2.7', releaseDate: '2023-11-01', downloadUrl: 'https://www.djangoproject.com/download/' },
        stable: { version: '4.2.7', releaseDate: '2023-11-01', downloadUrl: 'https://www.djangoproject.com/download/', changes: 'ORM improvements and features' },
        lts: { version: '3.2.21', supportEndDate: '2024-04-03', releaseDate: '2021-04-06' },
        patches: [
          { version: '4.2.7', changes: 'Bug fixes' },
          { version: '4.1.13', changes: 'Security patches' }
        ],
        breakingChanges: []
      },
      'Bootstrap': {
        latest: { version: '5.3.2', releaseDate: '2023-10-24', downloadUrl: 'https://getbootstrap.com/' },
        stable: { version: '5.3.2', releaseDate: '2023-10-24', downloadUrl: 'https://getbootstrap.com/', changes: 'CSS improvements and utility updates' },
        lts: { version: '4.6.2', supportEndDate: '2023-01-01', releaseDate: '2021-12-07' },
        patches: [
          { version: '5.3.2', changes: 'Bug fixes' },
          { version: '5.2.3', changes: 'CSS Grid improvements' }
        ],
        breakingChanges: []
      }
    };
  }

  /**
   * Initialize compatibility database
   * @private
   */
  _initializeCompatibilityDatabase() {
    return {
      'WordPress': {
        dependencies: ['PHP >= 7.4', 'MySQL >= 5.7'],
        requiresModuleUpdates: true,
        databaseMigration: true,
        configChanges: ['wp-config.php changes', 'Plugin compatibility checks'],
        knownIssues: ['Some old plugins may not be compatible']
      },
      'Django': {
        dependencies: ['Python >= 3.8', 'pip dependencies update'],
        requiresModuleUpdates: true,
        databaseMigration: true,
        configChanges: ['settings.py updates'],
        knownIssues: ['Deprecated features removed']
      },
      'React': {
        dependencies: ['Node.js >= 14'],
        requiresModuleUpdates: true,
        databaseMigration: false,
        configChanges: ['package.json update'],
        knownIssues: ['Deprecated APIs removed']
      }
    };
  }
}

module.exports = UpdateRecommender;
