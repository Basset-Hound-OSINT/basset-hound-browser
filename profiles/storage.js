/**
 * Basset Hound Browser - Profile Storage
 * Handles persistence of browser profiles to disk
 */

const fs = require('fs');
const path = require('path');

/**
 * ProfileStorage class
 * Manages reading and writing profile data to disk
 */
class ProfileStorage {
  constructor(dataPath) {
    this.dataPath = dataPath || path.join(process.cwd(), 'profile-data');
    this.profilesDir = path.join(this.dataPath, 'profiles');
    this.indexFile = path.join(this.dataPath, 'profiles-index.json');

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a profile
   * @param {string} profileId - Profile identifier
   * @returns {string} File path
   */
  getProfilePath(profileId) {
    return path.join(this.profilesDir, `${profileId}.json`);
  }

  /**
   * Get the directory path for a profile's data
   * @param {string} profileId - Profile identifier
   * @returns {string} Directory path
   */
  getProfileDataDir(profileId) {
    return path.join(this.profilesDir, profileId);
  }

  /**
   * Load the profiles index
   * @returns {Object} Index data
   */
  loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[ProfileStorage] Error loading index:', error.message);
    }

    return {
      profiles: [],
      activeProfileId: null,
      lastModified: null
    };
  }

  /**
   * Save the profiles index
   * @param {Object} index - Index data
   */
  saveIndex(index) {
    try {
      index.lastModified = new Date().toISOString();
      fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('[ProfileStorage] Error saving index:', error.message);
      throw error;
    }
  }

  /**
   * Load a profile from disk
   * @param {string} profileId - Profile identifier
   * @returns {Object|null} Profile data or null if not found
   */
  loadProfile(profileId) {
    try {
      const profilePath = this.getProfilePath(profileId);

      if (fs.existsSync(profilePath)) {
        const data = fs.readFileSync(profilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[ProfileStorage] Error loading profile ${profileId}:`, error.message);
    }

    return null;
  }

  /**
   * Save a profile to disk
   * @param {string} profileId - Profile identifier
   * @param {Object} profileData - Profile data to save
   */
  saveProfile(profileId, profileData) {
    try {
      const profilePath = this.getProfilePath(profileId);

      // Add metadata
      const dataToSave = {
        ...profileData,
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(profilePath, JSON.stringify(dataToSave, null, 2));
      console.log(`[ProfileStorage] Profile saved: ${profileId}`);
    } catch (error) {
      console.error(`[ProfileStorage] Error saving profile ${profileId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a profile from disk
   * @param {string} profileId - Profile identifier
   */
  deleteProfile(profileId) {
    try {
      const profilePath = this.getProfilePath(profileId);
      const profileDataDir = this.getProfileDataDir(profileId);

      // Remove profile file
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
      }

      // Remove profile data directory if exists
      if (fs.existsSync(profileDataDir)) {
        fs.rmSync(profileDataDir, { recursive: true, force: true });
      }

      console.log(`[ProfileStorage] Profile deleted: ${profileId}`);
    } catch (error) {
      console.error(`[ProfileStorage] Error deleting profile ${profileId}:`, error.message);
      throw error;
    }
  }

  /**
   * List all profiles from disk
   * @returns {Array} List of profile metadata
   */
  listProfiles() {
    const profiles = [];

    try {
      const files = fs.readdirSync(this.profilesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const profileId = file.replace('.json', '');
          const profile = this.loadProfile(profileId);

          if (profile) {
            profiles.push({
              id: profile.id,
              name: profile.name,
              createdAt: profile.createdAt,
              savedAt: profile.savedAt
            });
          }
        }
      }
    } catch (error) {
      console.error('[ProfileStorage] Error listing profiles:', error.message);
    }

    return profiles;
  }

  /**
   * Save cookies for a profile
   * @param {string} profileId - Profile identifier
   * @param {Array} cookies - Cookies to save
   */
  saveCookies(profileId, cookies) {
    try {
      const profileDataDir = this.getProfileDataDir(profileId);

      if (!fs.existsSync(profileDataDir)) {
        fs.mkdirSync(profileDataDir, { recursive: true });
      }

      const cookiesPath = path.join(profileDataDir, 'cookies.json');
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    } catch (error) {
      console.error(`[ProfileStorage] Error saving cookies for ${profileId}:`, error.message);
    }
  }

  /**
   * Load cookies for a profile
   * @param {string} profileId - Profile identifier
   * @returns {Array} Cookies array
   */
  loadCookies(profileId) {
    try {
      const cookiesPath = path.join(this.getProfileDataDir(profileId), 'cookies.json');

      if (fs.existsSync(cookiesPath)) {
        const data = fs.readFileSync(cookiesPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[ProfileStorage] Error loading cookies for ${profileId}:`, error.message);
    }

    return [];
  }

  /**
   * Save localStorage for a profile
   * @param {string} profileId - Profile identifier
   * @param {Object} localStorage - LocalStorage data to save (keyed by origin)
   */
  saveLocalStorage(profileId, localStorage) {
    try {
      const profileDataDir = this.getProfileDataDir(profileId);

      if (!fs.existsSync(profileDataDir)) {
        fs.mkdirSync(profileDataDir, { recursive: true });
      }

      const storagePath = path.join(profileDataDir, 'localStorage.json');
      fs.writeFileSync(storagePath, JSON.stringify(localStorage, null, 2));
    } catch (error) {
      console.error(`[ProfileStorage] Error saving localStorage for ${profileId}:`, error.message);
    }
  }

  /**
   * Load localStorage for a profile
   * @param {string} profileId - Profile identifier
   * @returns {Object} LocalStorage data
   */
  loadLocalStorage(profileId) {
    try {
      const storagePath = path.join(this.getProfileDataDir(profileId), 'localStorage.json');

      if (fs.existsSync(storagePath)) {
        const data = fs.readFileSync(storagePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[ProfileStorage] Error loading localStorage for ${profileId}:`, error.message);
    }

    return {};
  }

  /**
   * Export a profile as a complete JSON object
   * @param {string} profileId - Profile identifier
   * @returns {Object} Complete profile export
   */
  exportProfile(profileId) {
    const profile = this.loadProfile(profileId);

    if (!profile) {
      return null;
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile,
      cookies: this.loadCookies(profileId),
      localStorage: this.loadLocalStorage(profileId)
    };
  }

  /**
   * Import a profile from exported data
   * @param {Object} exportData - Exported profile data
   * @param {string} newId - Optional new ID for the profile
   * @returns {string} The ID of the imported profile
   */
  importProfile(exportData, newId = null) {
    const profileId = newId || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save profile data with new ID
    const profileData = {
      ...exportData.profile,
      id: profileId,
      name: exportData.profile.name + (newId ? '' : ' (Imported)'),
      importedAt: new Date().toISOString(),
      originalId: exportData.profile.id
    };

    this.saveProfile(profileId, profileData);

    // Save cookies if present
    if (exportData.cookies && Array.isArray(exportData.cookies)) {
      this.saveCookies(profileId, exportData.cookies);
    }

    // Save localStorage if present
    if (exportData.localStorage && typeof exportData.localStorage === 'object') {
      this.saveLocalStorage(profileId, exportData.localStorage);
    }

    // Update index
    const index = this.loadIndex();
    if (!index.profiles.includes(profileId)) {
      index.profiles.push(profileId);
      this.saveIndex(index);
    }

    return profileId;
  }

  /**
   * Check if a profile exists
   * @param {string} profileId - Profile identifier
   * @returns {boolean} Whether the profile exists
   */
  profileExists(profileId) {
    return fs.existsSync(this.getProfilePath(profileId));
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  getStats() {
    const stats = {
      profileCount: 0,
      totalSize: 0,
      profiles: []
    };

    try {
      const files = fs.readdirSync(this.profilesDir);

      for (const file of files) {
        const filePath = path.join(this.profilesDir, file);
        const fileStat = fs.statSync(filePath);

        if (file.endsWith('.json')) {
          stats.profileCount++;
          stats.totalSize += fileStat.size;
          stats.profiles.push({
            id: file.replace('.json', ''),
            size: fileStat.size,
            modified: fileStat.mtime
          });
        } else if (fileStat.isDirectory()) {
          // Calculate directory size
          const dirSize = this.getDirectorySize(filePath);
          stats.totalSize += dirSize;
        }
      }
    } catch (error) {
      console.error('[ProfileStorage] Error getting stats:', error.message);
    }

    return stats;
  }

  /**
   * Get the size of a directory
   * @param {string} dirPath - Directory path
   * @returns {number} Size in bytes
   */
  getDirectorySize(dirPath) {
    let size = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stat.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return size;
  }

  /**
   * Clean up orphaned data (data without a profile)
   */
  cleanup() {
    try {
      const files = fs.readdirSync(this.profilesDir);
      const profileIds = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));

      // Remove orphaned directories
      for (const file of files) {
        const filePath = path.join(this.profilesDir, file);

        if (fs.statSync(filePath).isDirectory()) {
          if (!profileIds.includes(file)) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`[ProfileStorage] Cleaned up orphaned directory: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('[ProfileStorage] Error during cleanup:', error.message);
    }
  }
}

module.exports = ProfileStorage;
