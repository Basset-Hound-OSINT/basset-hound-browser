/**
 * GPU/CPU Specification Generator
 * Generates realistic GPU and CPU specs matching device profiles
 * Features: Real GPU names, real CPU names, device-specific matching, realistic VRAM
 * All generated specs remain consistent throughout a session
 */

class GPUCPUGenerator {
  constructor() {
    this.currentProfile = null;
    this.generatedSpecs = null;
    this.specDatabase = this.initializeDatabase();
  }

  /**
   * Initialize database of real GPU/CPU specs from actual devices
   */
  initializeDatabase() {
    return {
      // iPhone GPUs and CPUs
      'iPhone-15-Pro': {
        cpu: 'Apple A17 Pro',
        cpuCores: 6,
        gpu: 'Apple A17 Pro GPU',
        gpuCores: 6,
        memory: 8,
        vendor: 'Apple'
      },
      'iPhone-15': {
        cpu: 'Apple A16 Bionic',
        cpuCores: 6,
        gpu: 'Apple A16 Bionic GPU',
        gpuCores: 5,
        memory: 6,
        vendor: 'Apple'
      },
      'iPhone-14-Pro': {
        cpu: 'Apple A16 Bionic',
        cpuCores: 6,
        gpu: 'Apple A16 Bionic GPU',
        gpuCores: 5,
        memory: 6,
        vendor: 'Apple'
      },
      // Samsung Galaxy CPUs and GPUs
      'Galaxy-S24': {
        cpu: 'Snapdragon 8 Gen 3 Leading Version',
        cpuCores: 8,
        gpu: 'Adreno 8',
        gpuCores: 10,
        memory: 12,
        vendor: 'Qualcomm'
      },
      'Galaxy-S23': {
        cpu: 'Snapdragon 8 Gen 2',
        cpuCores: 8,
        gpu: 'Adreno 8',
        gpuCores: 10,
        memory: 8,
        vendor: 'Qualcomm'
      },
      'Galaxy-S21': {
        cpu: 'Snapdragon 888',
        cpuCores: 8,
        gpu: 'Adreno 660',
        gpuCores: 8,
        memory: 8,
        vendor: 'Qualcomm'
      },
      // Google Pixel CPUs and GPUs
      'Pixel-8-Pro': {
        cpu: 'Google Tensor G3',
        cpuCores: 8,
        gpu: 'Mali-G715 MP7',
        gpuCores: 7,
        memory: 12,
        vendor: 'Google'
      },
      'Pixel-8': {
        cpu: 'Google Tensor G3',
        cpuCores: 8,
        gpu: 'Mali-G715 MP7',
        gpuCores: 7,
        memory: 8,
        vendor: 'Google'
      },
      'Pixel-7': {
        cpu: 'Google Tensor',
        cpuCores: 8,
        gpu: 'Mali-G510',
        gpuCores: 5,
        memory: 8,
        vendor: 'Google'
      },
      // MacBook Pros (M-series)
      'MacBook-Pro-16-M3-Max': {
        cpu: 'Apple M3 Max',
        cpuCores: 12,
        gpu: 'Apple M3 Max GPU',
        gpuCores: 36,
        memory: 36,
        vendor: 'Apple'
      },
      'MacBook-Pro-16-M3': {
        cpu: 'Apple M3',
        cpuCores: 8,
        gpu: 'Apple M3 GPU',
        gpuCores: 10,
        memory: 16,
        vendor: 'Apple'
      },
      'MacBook-Pro-14-M3': {
        cpu: 'Apple M3',
        cpuCores: 8,
        gpu: 'Apple M3 GPU',
        gpuCores: 10,
        memory: 16,
        vendor: 'Apple'
      },
      'MacBook-Air-M2': {
        cpu: 'Apple M2',
        cpuCores: 8,
        gpu: 'Apple M2 GPU',
        gpuCores: 10,
        memory: 16,
        vendor: 'Apple'
      },
      // iPad specifications
      'iPad-Pro-12.9': {
        cpu: 'Apple M2',
        cpuCores: 10,
        gpu: 'Apple M2 GPU',
        gpuCores: 10,
        memory: 16,
        vendor: 'Apple'
      },
      'iPad-Air': {
        cpu: 'Apple M1',
        cpuCores: 8,
        gpu: 'Apple M1 GPU',
        gpuCores: 8,
        memory: 8,
        vendor: 'Apple'
      },
      // Windows desktops
      'Windows-Desktop-Gaming': {
        cpu: 'Intel Core i7-13700K',
        cpuCores: 16,
        gpu: 'NVIDIA RTX 4080',
        gpuCores: 10240,
        memory: 24,
        vendor: 'NVIDIA'
      },
      'Windows-Desktop-High-End': {
        cpu: 'Intel Core i7-13700',
        cpuCores: 16,
        gpu: 'NVIDIA RTX 4070',
        gpuCores: 5888,
        memory: 16,
        vendor: 'NVIDIA'
      },
      'Windows-Desktop-Standard': {
        cpu: 'Intel Core i5-13600K',
        cpuCores: 14,
        gpu: 'Intel Arc A770',
        gpuCores: 32,
        memory: 16,
        vendor: 'Intel'
      },
      'Windows-Desktop-Budget': {
        cpu: 'Intel Core i5-10400',
        cpuCores: 12,
        gpu: 'NVIDIA GTX 1660',
        gpuCores: 1408,
        memory: 8,
        vendor: 'NVIDIA'
      },
      // Windows laptops
      'Windows-Laptop-Premium': {
        cpu: 'Intel Core i7-1360P',
        cpuCores: 12,
        gpu: 'NVIDIA RTX 4060',
        gpuCores: 3072,
        memory: 16,
        vendor: 'NVIDIA'
      },
      'Windows-Laptop-Standard': {
        cpu: 'Intel Core i5-1340P',
        cpuCores: 10,
        gpu: 'Intel Iris Xe',
        gpuCores: 80,
        memory: 16,
        vendor: 'Intel'
      },
      // Linux desktops
      'Linux-Desktop': {
        cpu: 'Intel Core i7-13700',
        cpuCores: 16,
        gpu: 'NVIDIA RTX 4070',
        gpuCores: 5888,
        memory: 32,
        vendor: 'NVIDIA'
      },
      // Android tablets
      'Galaxy-Tab-S9': {
        cpu: 'Snapdragon 8 Gen 2',
        cpuCores: 8,
        gpu: 'Adreno 8',
        gpuCores: 10,
        memory: 8,
        vendor: 'Qualcomm'
      }
    };
  }

  /**
   * Initialize from device profile
   */
  initializeFromProfile(profile) {
    if (!profile) {
      throw new Error('Profile required');
    }

    this.currentProfile = profile;
    this.generatedSpecs = this.generateFromProfile(profile);
    return this.generatedSpecs;
  }

  /**
   * Generate GPU/CPU specs from device profile
   */
  generateFromProfile(profile) {
    const { deviceType, vendor, deviceMemory } = profile;

    // Determine spec key based on profile
    const specKey = this.selectSpecKey(profile);

    if (!this.specDatabase[specKey]) {
      // Fallback to generic specs
      return this.generateGenericSpecs(deviceType, vendor, deviceMemory);
    }

    return this.specDatabase[specKey];
  }

  /**
   * Select appropriate spec key for device profile
   */
  selectSpecKey(profile) {
    const { deviceType, vendor, hardwareConcurrency } = profile;

    if (deviceType === 'mobile') {
      if (vendor === 'Apple') {
        return 'iPhone-15-Pro'; // Default to latest
      } else if (vendor === 'Google') {
        return 'Pixel-8-Pro';
      } else {
        return 'Galaxy-S24';
      }
    }

    if (deviceType === 'tablet') {
      if (vendor === 'Apple') {
        return 'iPad-Pro-12.9';
      } else {
        return 'Galaxy-Tab-S9';
      }
    }

    // Desktop
    if (vendor === 'Apple') {
      if (hardwareConcurrency >= 12) {
        return 'MacBook-Pro-16-M3-Max';
      } else if (hardwareConcurrency >= 8) {
        return 'MacBook-Pro-14-M3';
      } else {
        return 'MacBook-Air-M2';
      }
    }

    // Windows/Linux desktop
    if (hardwareConcurrency >= 16) {
      return 'Windows-Desktop-High-End';
    } else if (hardwareConcurrency >= 12) {
      return 'Windows-Desktop-Standard';
    } else {
      return 'Windows-Desktop-Budget';
    }
  }

  /**
   * Generate generic specs when specific device not in database
   */
  generateGenericSpecs(deviceType, vendor, deviceMemory) {
    const specs = {
      memory: deviceMemory || 8
    };

    if (deviceType === 'mobile') {
      specs.cpuCores = 6;
      specs.gpu = vendor === 'Apple' ? 'Apple A16 Bionic GPU' : 'Adreno 8';
      specs.gpuCores = vendor === 'Apple' ? 5 : 10;
      specs.cpu = vendor === 'Apple' ? 'Apple A16 Bionic' : 'Snapdragon 8 Gen 2';
      specs.vendor = vendor;
    } else if (deviceType === 'desktop') {
      specs.cpuCores = 8;
      if (vendor === 'Apple') {
        specs.gpu = 'Apple M2 GPU';
        specs.gpuCores = 10;
        specs.cpu = 'Apple M2';
      } else {
        specs.gpu = 'NVIDIA RTX 3060';
        specs.gpuCores = 3584;
        specs.cpu = 'Intel Core i5-12400';
      }
      specs.vendor = vendor;
    } else {
      // Tablet
      specs.cpuCores = 8;
      specs.gpu = 'Mali-G715 MP7';
      specs.gpuCores = 7;
      specs.cpu = 'Snapdragon 8 Gen 2';
      specs.vendor = vendor;
    }

    return specs;
  }

  /**
   * Get currently generated specs
   */
  getSpecs() {
    if (!this.generatedSpecs) {
      throw new Error('No specs generated - call initializeFromProfile first');
    }
    return this.generatedSpecs;
  }

  /**
   * Validate GPU/CPU specs are realistic
   */
  validateSpecs(specs) {
    const { cpu, cpuCores, gpu, gpuCores, memory, vendor } = specs;

    // Check cores are reasonable
    if (cpuCores < 1 || cpuCores > 32) {
      return false;
    }
    if (gpuCores < 1 || gpuCores > 20480) {
      return false;
    }

    // Check memory is realistic (not 999GB)
    if (memory < 2 || memory > 192) {
      return false;
    }

    // Check strings exist and aren't empty
    if (!cpu || typeof cpu !== 'string' || cpu.length === 0) {
      return false;
    }
    if (!gpu || typeof gpu !== 'string' || gpu.length === 0) {
      return false;
    }
    if (!vendor || typeof vendor !== 'string' || vendor.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Get all available spec keys
   */
  getAvailableSpecKeys() {
    return Object.keys(this.specDatabase);
  }

  /**
   * Get specs for a specific device key
   */
  getSpecsByKey(key) {
    if (!this.specDatabase[key]) {
      throw new Error(`Unknown spec key: ${key}`);
    }
    return this.specDatabase[key];
  }

  /**
   * Reset to uninitialized state
   */
  reset() {
    this.currentProfile = null;
    this.generatedSpecs = null;
  }
}

module.exports = GPUCPUGenerator;
