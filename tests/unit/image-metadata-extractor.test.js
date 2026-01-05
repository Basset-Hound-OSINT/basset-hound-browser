/**
 * Image Metadata Extractor Unit Tests
 *
 * Tests for Phase 14 image metadata extraction functionality.
 */

const {
  ImageMetadataExtractor,
  createImageExtractor,
  DEFAULT_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
} = require('../../extraction/image-metadata-extractor');

describe('ImageMetadataExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new ImageMetadataExtractor();
  });

  afterEach(async () => {
    if (extractor) {
      await extractor.cleanup();
    }
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(extractor).toBeDefined();
      expect(extractor.options).toBeDefined();
      expect(extractor.options.extractExif).toBe(true);
      expect(extractor.options.extractIptc).toBe(true);
      expect(extractor.options.extractXmp).toBe(true);
      expect(extractor.options.extractGps).toBe(true);
    });

    test('should accept custom options', () => {
      const customExtractor = new ImageMetadataExtractor({
        extractExif: false,
        runOcr: true,
        ocrLanguage: 'fra'
      });

      expect(customExtractor.options.extractExif).toBe(false);
      expect(customExtractor.options.runOcr).toBe(true);
      expect(customExtractor.options.ocrLanguage).toBe('fra');
    });

    test('should merge custom options with defaults', () => {
      const customExtractor = new ImageMetadataExtractor({
        runOcr: true
      });

      expect(customExtractor.options.extractExif).toBe(true); // default
      expect(customExtractor.options.runOcr).toBe(true); // custom
    });
  });

  describe('createImageExtractor factory', () => {
    test('should create extractor instance', () => {
      const instance = createImageExtractor();
      expect(instance).toBeInstanceOf(ImageMetadataExtractor);
    });

    test('should pass options to instance', () => {
      const instance = createImageExtractor({
        extractThumbnail: true,
        generateHash: false
      });

      expect(instance.options.extractThumbnail).toBe(true);
      expect(instance.options.generateHash).toBe(false);
    });
  });

  describe('DEFAULT_OPTIONS', () => {
    test('should have all required options', () => {
      expect(DEFAULT_OPTIONS.extractExif).toBeDefined();
      expect(DEFAULT_OPTIONS.extractIptc).toBeDefined();
      expect(DEFAULT_OPTIONS.extractXmp).toBeDefined();
      expect(DEFAULT_OPTIONS.extractGps).toBeDefined();
      expect(DEFAULT_OPTIONS.extractThumbnail).toBeDefined();
      expect(DEFAULT_OPTIONS.generateHash).toBeDefined();
      expect(DEFAULT_OPTIONS.runOcr).toBeDefined();
      expect(DEFAULT_OPTIONS.ocrLanguage).toBeDefined();
      expect(DEFAULT_OPTIONS.detectFaces).toBeDefined();
    });

    test('should have correct default values', () => {
      expect(DEFAULT_OPTIONS.extractExif).toBe(true);
      expect(DEFAULT_OPTIONS.extractThumbnail).toBe(false);
      expect(DEFAULT_OPTIONS.runOcr).toBe(false);
      expect(DEFAULT_OPTIONS.ocrLanguage).toBe('eng');
      expect(DEFAULT_OPTIONS.detectFaces).toBe(false);
    });
  });

  describe('IMAGE_ORPHAN_MAPPINGS', () => {
    test('should have mappings for common types', () => {
      expect(IMAGE_ORPHAN_MAPPINGS.gps_coordinates).toBe('geolocation');
      expect(IMAGE_ORPHAN_MAPPINGS.camera_make).toBe('device');
      expect(IMAGE_ORPHAN_MAPPINGS.author).toBe('person');
      expect(IMAGE_ORPHAN_MAPPINGS.copyright).toBe('organization');
    });
  });

  describe('_getSourceInfo', () => {
    test('should identify URL source', () => {
      const info = extractor._getSourceInfo('https://example.com/image.jpg');
      expect(info.type).toBe('url');
      expect(info.value).toBe('https://example.com/image.jpg');
    });

    test('should identify file path source', () => {
      const info = extractor._getSourceInfo('/path/to/image.jpg');
      expect(info.type).toBe('path');
      expect(info.value).toBe('/path/to/image.jpg');
    });

    test('should identify data URL source', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const info = extractor._getSourceInfo(dataUrl);
      expect(info.type).toBe('dataUrl');
    });

    test('should identify buffer source', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const info = extractor._getSourceInfo(buffer);
      expect(info.type).toBe('buffer');
      expect(info.size).toBe(4);
    });

    test('should identify ArrayBuffer source', () => {
      const arrayBuffer = new ArrayBuffer(100);
      const info = extractor._getSourceInfo(arrayBuffer);
      expect(info.type).toBe('arrayBuffer');
      expect(info.size).toBe(100);
    });
  });

  describe('_normalizeExif', () => {
    test('should handle null input', () => {
      expect(extractor._normalizeExif(null)).toBeNull();
    });

    test('should normalize EXIF data', () => {
      const rawExif = {
        Make: 'Apple',
        Model: 'iPhone 14',
        Software: 'iOS 17.0',
        ExposureTime: 0.01,
        FNumber: 1.6,
        ISO: 100,
        DateTimeOriginal: new Date('2024-01-01'),
        ImageWidth: 4032,
        ImageHeight: 3024
      };

      const normalized = extractor._normalizeExif(rawExif);

      expect(normalized.camera.make).toBe('Apple');
      expect(normalized.camera.model).toBe('iPhone 14');
      expect(normalized.camera.software).toBe('iOS 17.0');
      expect(normalized.settings.exposureTime).toBe(0.01);
      expect(normalized.settings.fNumber).toBe(1.6);
      expect(normalized.settings.iso).toBe(100);
      expect(normalized.image.width).toBe(4032);
      expect(normalized.image.height).toBe(3024);
    });

    test('should handle missing fields gracefully', () => {
      const rawExif = {
        Make: 'Canon'
      };

      const normalized = extractor._normalizeExif(rawExif);

      expect(normalized.camera.make).toBe('Canon');
      expect(normalized.camera.model).toBeNull();
      expect(normalized.settings.iso).toBeNull();
    });
  });

  describe('_normalizeIptc', () => {
    test('should handle null input', () => {
      expect(extractor._normalizeIptc(null)).toBeNull();
    });

    test('should normalize IPTC data', () => {
      const rawIptc = {
        Headline: { description: 'Test Image' },
        'Caption/Abstract': { description: 'A test caption' },
        Keywords: { description: ['test', 'photo', 'sample'] },
        'By-line': { description: 'John Doe' },
        'Copyright Notice': { description: '© 2024 Company' },
        City: { description: 'New York' },
        'Country/Primary Location Name': { description: 'USA' }
      };

      const normalized = extractor._normalizeIptc(rawIptc);

      expect(normalized.headline).toBe('Test Image');
      expect(normalized.caption).toBe('A test caption');
      expect(normalized.keywords).toEqual(['test', 'photo', 'sample']);
      expect(normalized.byline).toBe('John Doe');
      expect(normalized.copyright).toBe('© 2024 Company');
      expect(normalized.city).toBe('New York');
      expect(normalized.country).toBe('USA');
    });
  });

  describe('_normalizeXmp', () => {
    test('should handle null input', () => {
      expect(extractor._normalizeXmp(null)).toBeNull();
    });

    test('should normalize XMP data', () => {
      const rawXmp = {
        title: { description: 'Photo Title' },
        description: { description: 'Photo description' },
        creator: { description: ['Photographer Name'] },
        rights: { description: 'All rights reserved' },
        Rating: { description: '5' },
        CreatorTool: { description: 'Adobe Lightroom' }
      };

      const normalized = extractor._normalizeXmp(rawXmp);

      expect(normalized.title).toBe('Photo Title');
      expect(normalized.description).toBe('Photo description');
      expect(normalized.creator).toEqual(['Photographer Name']);
      expect(normalized.rights).toBe('All rights reserved');
      expect(normalized.rating).toBe('5');
      expect(normalized.creatorTool).toBe('Adobe Lightroom');
    });
  });

  describe('_normalizeArray', () => {
    test('should handle null input', () => {
      expect(extractor._normalizeArray(null)).toBeNull();
    });

    test('should handle array input', () => {
      const input = [
        { description: 'tag1' },
        { description: 'tag2' }
      ];
      expect(extractor._normalizeArray(input)).toEqual(['tag1', 'tag2']);
    });

    test('should handle object with description array', () => {
      const input = { description: ['keyword1', 'keyword2'] };
      expect(extractor._normalizeArray(input)).toEqual(['keyword1', 'keyword2']);
    });

    test('should handle object with single description', () => {
      const input = { description: 'single value' };
      expect(extractor._normalizeArray(input)).toEqual(['single value']);
    });
  });

  describe('_extractOsintFromText', () => {
    test('should extract emails from text', () => {
      const text = 'Contact us at info@example.com or support@company.org';
      const osint = extractor._extractOsintFromText(text);

      const emails = osint.filter(d => d.type === 'email');
      expect(emails.length).toBe(2);
      expect(emails[0].value).toBe('info@example.com');
      expect(emails[1].value).toBe('support@company.org');
      expect(emails[0].source).toBe('ocr');
    });

    test('should extract phone numbers from text', () => {
      const text = 'Call us at (555) 123-4567 or 555-987-6543';
      const osint = extractor._extractOsintFromText(text);

      const phones = osint.filter(d => d.type === 'phone');
      expect(phones.length).toBe(2);
    });

    test('should extract URLs from text', () => {
      const text = 'Visit https://example.com or http://test.org for more info';
      const osint = extractor._extractOsintFromText(text);

      const urls = osint.filter(d => d.type === 'url');
      expect(urls.length).toBe(2);
    });

    test('should handle empty text', () => {
      expect(extractor._extractOsintFromText('')).toEqual([]);
      expect(extractor._extractOsintFromText(null)).toEqual([]);
    });
  });

  describe('_extractOsintFromMetadata', () => {
    test('should extract device info from EXIF', () => {
      const result = {
        metadata: {
          exif: {
            camera: {
              make: 'Apple',
              model: 'iPhone 14 Pro',
              software: 'iOS 17.2',
              serialNumber: 'ABC123'
            }
          }
        },
        osintData: []
      };

      extractor._extractOsintFromMetadata(result);

      const devices = result.osintData.filter(d => d.type === 'device');
      expect(devices.length).toBe(1);
      expect(devices[0].value).toBe('Apple iPhone 14 Pro');
    });

    test('should extract author from IPTC', () => {
      const result = {
        metadata: {
          iptc: {
            byline: 'John Smith'
          }
        },
        osintData: []
      };

      extractor._extractOsintFromMetadata(result);

      const persons = result.osintData.filter(d => d.type === 'person');
      expect(persons.length).toBe(1);
      expect(persons[0].value).toBe('John Smith');
    });

    test('should extract creator from XMP', () => {
      const result = {
        metadata: {
          xmp: {
            creator: ['Jane Doe', 'Bob Wilson']
          }
        },
        osintData: []
      };

      extractor._extractOsintFromMetadata(result);

      const persons = result.osintData.filter(d => d.type === 'person');
      expect(persons.length).toBe(2);
    });

    test('should extract location from IPTC', () => {
      const result = {
        metadata: {
          iptc: {
            city: 'New York',
            state: 'NY',
            country: 'USA',
            countryCode: 'US'
          }
        },
        osintData: []
      };

      extractor._extractOsintFromMetadata(result);

      const locations = result.osintData.filter(d => d.type === 'location');
      expect(locations.length).toBe(1);
      expect(locations[0].value).toBe('New York, NY, USA');
    });
  });

  describe('generateOrphanData', () => {
    test('should generate orphan data from extraction result', () => {
      const extractionResult = {
        extractedAt: '2024-01-01T12:00:00Z',
        osintData: [
          {
            type: 'geolocation',
            value: '40.7128,-74.0060',
            confidence: 1.0,
            source: 'exif_gps',
            metadata: { latitude: 40.7128, longitude: -74.0060 }
          },
          {
            type: 'device',
            value: 'Apple iPhone 14',
            confidence: 1.0,
            source: 'exif'
          }
        ]
      };

      const orphans = extractor.generateOrphanData(extractionResult, 'https://example.com/image.jpg');

      expect(orphans.length).toBe(2);
      expect(orphans[0].identifier_type).toBe('geolocation');
      expect(orphans[0].identifier_value).toBe('40.7128,-74.0060');
      expect(orphans[0].source).toBe('https://example.com/image.jpg');
      expect(orphans[0].tags).toContain('image_metadata');
      expect(orphans[0].tags).toContain('exif_gps');
    });

    test('should handle empty osint data', () => {
      const result = {
        extractedAt: '2024-01-01T12:00:00Z',
        osintData: []
      };

      const orphans = extractor.generateOrphanData(result, 'https://example.com');
      expect(orphans).toEqual([]);
    });

    test('should handle missing osint data', () => {
      const result = {
        extractedAt: '2024-01-01T12:00:00Z'
      };

      const orphans = extractor.generateOrphanData(result, 'https://example.com');
      expect(orphans).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('should return extractor statistics', () => {
      const stats = extractor.getStats();

      expect(stats.librariesLoaded).toBeDefined();
      expect(stats.tesseractWorkerActive).toBe(false);
      expect(stats.isNodeEnvironment).toBe(true);
      expect(stats.options).toBeDefined();
    });

    test('should include options in stats', () => {
      const customExtractor = createImageExtractor({ runOcr: true });
      const stats = customExtractor.getStats();

      expect(stats.options.runOcr).toBe(true);
    });
  });

  describe('extract (integration)', () => {
    // These tests would require actual image files or mocked libraries
    // For now, we test the result structure

    test('should return proper result structure on error', async () => {
      const result = await extractor.extract('nonexistent.jpg');

      expect(result.success).toBeDefined();
      expect(result.extractedAt).toBeDefined();
      expect(result.processingTimeMs).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.osintData).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should allow overriding options per extraction', async () => {
      // The extractor has default options, but we can override them
      const result = await extractor.extract('test.jpg', {
        extractExif: false,
        generateHash: false
      });

      // Result should still have proper structure
      expect(result.metadata).toBeDefined();
    });
  });

  describe('cleanup', () => {
    test('should clean up resources without error', async () => {
      await expect(extractor.cleanup()).resolves.not.toThrow();
    });

    test('should be callable multiple times', async () => {
      await extractor.cleanup();
      await expect(extractor.cleanup()).resolves.not.toThrow();
    });
  });
});

describe('Image Commands Integration', () => {
  // Mock tests for WebSocket commands

  describe('command registration', () => {
    test('should export registerImageCommands function', () => {
      const { registerImageCommands } = require('../../websocket/commands/image-commands');
      expect(typeof registerImageCommands).toBe('function');
    });

    test('should register commands to server', () => {
      const { registerImageCommands } = require('../../websocket/commands/image-commands');

      const mockServer = {
        commandHandlers: {}
      };

      registerImageCommands(mockServer, null);

      expect(mockServer.commandHandlers.extract_image_metadata).toBeDefined();
      expect(mockServer.commandHandlers.extract_image_gps).toBeDefined();
      expect(mockServer.commandHandlers.extract_image_text).toBeDefined();
      expect(mockServer.commandHandlers.generate_image_hash).toBeDefined();
      expect(mockServer.commandHandlers.compare_images).toBeDefined();
      expect(mockServer.commandHandlers.extract_page_images).toBeDefined();
      expect(mockServer.commandHandlers.get_image_osint_data).toBeDefined();
      expect(mockServer.commandHandlers.configure_image_extractor).toBeDefined();
      expect(mockServer.commandHandlers.get_image_extractor_stats).toBeDefined();
      expect(mockServer.commandHandlers.cleanup_image_extractor).toBeDefined();
    });
  });

  describe('command validation', () => {
    let mockServer;

    beforeEach(() => {
      mockServer = {
        commandHandlers: {}
      };

      const { registerImageCommands } = require('../../websocket/commands/image-commands');
      registerImageCommands(mockServer, null);
    });

    test('extract_image_metadata should require imageUrl', async () => {
      const result = await mockServer.commandHandlers.extract_image_metadata({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('imageUrl');
    });

    test('extract_image_gps should require imageUrl', async () => {
      const result = await mockServer.commandHandlers.extract_image_gps({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('imageUrl');
    });

    test('extract_image_text should require imageUrl', async () => {
      const result = await mockServer.commandHandlers.extract_image_text({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('imageUrl');
    });

    test('compare_images should require both images', async () => {
      const result1 = await mockServer.commandHandlers.compare_images({
        image1: 'test.jpg'
      });
      expect(result1.success).toBe(false);

      const result2 = await mockServer.commandHandlers.compare_images({
        image2: 'test.jpg'
      });
      expect(result2.success).toBe(false);
    });

    test('configure_image_extractor should require options', async () => {
      const result = await mockServer.commandHandlers.configure_image_extractor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('options');
    });

    test('get_image_extractor_stats should return stats', async () => {
      const result = await mockServer.commandHandlers.get_image_extractor_stats();
      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
    });

    test('cleanup_image_extractor should succeed', async () => {
      const result = await mockServer.commandHandlers.cleanup_image_extractor();
      expect(result.success).toBe(true);
    });
  });
});
