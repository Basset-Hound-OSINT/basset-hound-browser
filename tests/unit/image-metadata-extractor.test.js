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

describe('Canvas Capture', () => {
  describe('captureCanvasElements', () => {
    test('should require webContents parameter', async () => {
      await expect(extractor.captureCanvasElements(null)).rejects.toThrow('webContents is required');
    });

    test('should handle mock webContents with no canvas elements', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue([])
      };

      const result = await extractor.captureCanvasElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalCanvases).toBe(0);
      expect(result.canvases).toEqual([]);
    });

    test('should process canvas data correctly', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue([
          {
            index: 0,
            id: 'myCanvas',
            className: 'chart-canvas',
            width: 800,
            height: 600,
            displayWidth: 800,
            displayHeight: 600,
            contextType: '2d',
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
            format: 'png',
            quality: 0.92
          }
        ])
      };

      const result = await extractor.captureCanvasElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalCanvases).toBe(1);
      expect(result.canvases[0].id).toBe('myCanvas');
      expect(result.canvases[0].contextType).toBe('2d');
      expect(result.canvases[0].base64Data).toBeTruthy();
    });

    test('should handle canvas capture errors', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue([
          {
            index: 0,
            error: 'Canvas is tainted'
          }
        ])
      };

      const result = await extractor.captureCanvasElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.canvases[0].error).toBe('Canvas is tainted');
    });
  });
});

describe('SVG Extraction', () => {
  describe('extractSVGElements', () => {
    test('should require webContents parameter', async () => {
      await expect(extractor.extractSVGElements(null)).rejects.toThrow('webContents is required');
    });

    test('should handle mock webContents with no SVG elements', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue({
          inline: [],
          external: []
        })
      };

      const result = await extractor.extractSVGElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalInline).toBe(0);
      expect(result.totalExternal).toBe(0);
    });

    test('should extract inline SVG elements', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue({
          inline: [
            {
              index: 0,
              id: 'logo',
              className: 'icon',
              width: 100,
              height: 100,
              viewBox: '0 0 100 100',
              xmlns: 'http://www.w3.org/2000/svg',
              svgContent: '<svg>...</svg>',
              elementCount: 5,
              hasTitle: true,
              hasDesc: false,
              title: 'Company Logo',
              description: null
            }
          ],
          external: []
        })
      };

      const result = await extractor.extractSVGElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalInline).toBe(1);
      expect(result.inline[0].id).toBe('logo');
      expect(result.inline[0].title).toBe('Company Logo');
    });

    test('should extract external SVG references', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue({
          inline: [],
          external: [
            {
              type: 'img',
              src: 'https://example.com/icon.svg',
              alt: 'Icon',
              width: 24,
              height: 24,
              loading: 'lazy'
            },
            {
              type: 'background',
              src: 'https://example.com/bg.svg',
              element: 'div',
              id: 'hero'
            }
          ]
        })
      };

      const result = await extractor.extractSVGElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalExternal).toBe(2);
      expect(result.external[0].type).toBe('img');
      expect(result.external[1].type).toBe('background');
    });

    test('should deduplicate external SVG references', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn().mockResolvedValue({
          inline: [],
          external: [
            { type: 'img', src: 'https://example.com/icon.svg' },
            { type: 'background', src: 'https://example.com/icon.svg' },
            { type: 'img', src: 'https://example.com/other.svg' }
          ]
        })
      };

      const result = await extractor.extractSVGElements(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalExternal).toBe(2); // Deduplicated
    });
  });
});

describe('Favicon and Open Graph Images', () => {
  describe('extractFaviconAndOGImages', () => {
    test('should require webContents parameter', async () => {
      await expect(extractor.extractFaviconAndOGImages(null)).rejects.toThrow('webContents is required');
    });

    test('should extract favicons', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn()
          .mockResolvedValueOnce({
            favicons: [
              {
                rel: 'icon',
                href: 'https://example.com/favicon.ico',
                type: 'image/x-icon',
                sizes: '16x16',
                width: 16,
                height: 16
              },
              {
                rel: 'icon',
                href: 'https://example.com/favicon-32x32.png',
                type: 'image/png',
                sizes: '32x32',
                width: 32,
                height: 32
              }
            ],
            openGraph: [],
            twitter: [],
            apple: [],
            msApplication: []
          })
          .mockResolvedValueOnce('https://example.com')
      };

      const result = await extractor.extractFaviconAndOGImages(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalFavicons).toBe(2);
      expect(result.favicons[0].sizes).toBe('16x16');
      expect(result.favicons[1].sizes).toBe('32x32');
    });

    test('should extract Open Graph images', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn()
          .mockResolvedValueOnce({
            favicons: [],
            openGraph: [
              {
                url: 'https://example.com/og-image.jpg',
                type: 'og:image',
                secureUrl: 'https://example.com/og-image.jpg',
                mimeType: 'image/jpeg',
                width: 1200,
                height: 630,
                alt: 'Preview image'
              }
            ],
            twitter: [],
            apple: [],
            msApplication: []
          })
          .mockResolvedValueOnce('https://example.com')
      };

      const result = await extractor.extractFaviconAndOGImages(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalOpenGraph).toBe(1);
      expect(result.openGraph[0].width).toBe(1200);
      expect(result.openGraph[0].height).toBe(630);
      expect(result.openGraph[0].alt).toBe('Preview image');
    });

    test('should extract Twitter Card images', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn()
          .mockResolvedValueOnce({
            favicons: [],
            openGraph: [],
            twitter: [
              {
                url: 'https://example.com/twitter-card.jpg',
                type: 'twitter:image',
                alt: 'Twitter preview',
                width: 1200,
                height: 600
              }
            ],
            apple: [],
            msApplication: []
          })
          .mockResolvedValueOnce('https://example.com')
      };

      const result = await extractor.extractFaviconAndOGImages(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalTwitter).toBe(1);
      expect(result.twitter[0].url).toBe('https://example.com/twitter-card.jpg');
    });

    test('should extract Apple touch icons', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn()
          .mockResolvedValueOnce({
            favicons: [],
            openGraph: [],
            twitter: [],
            apple: [
              {
                rel: 'apple-touch-icon',
                href: 'https://example.com/apple-touch-icon.png',
                sizes: '180x180',
                width: 180,
                height: 180
              }
            ],
            msApplication: []
          })
          .mockResolvedValueOnce('https://example.com')
      };

      const result = await extractor.extractFaviconAndOGImages(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.totalApple).toBe(1);
      expect(result.apple[0].sizes).toBe('180x180');
    });

    test('should include manifest URL if present', async () => {
      const mockWebContents = {
        executeJavaScript: jest.fn()
          .mockResolvedValueOnce({
            favicons: [],
            openGraph: [],
            twitter: [],
            apple: [],
            msApplication: [],
            manifestUrl: 'https://example.com/manifest.json'
          })
          .mockResolvedValueOnce('https://example.com')
      };

      const result = await extractor.extractFaviconAndOGImages(mockWebContents);

      expect(result.success).toBe(true);
      expect(result.manifestUrl).toBe('https://example.com/manifest.json');
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
      expect(mockServer.commandHandlers.configure_image_extractor).toBeDefined();
      expect(mockServer.commandHandlers.get_image_extractor_stats).toBeDefined();
      expect(mockServer.commandHandlers.cleanup_image_extractor).toBeDefined();

      // New commands
      expect(mockServer.commandHandlers.capture_canvas_elements).toBeDefined();
      expect(mockServer.commandHandlers.extract_svg_elements).toBeDefined();
      expect(mockServer.commandHandlers.extract_favicon_og_images).toBeDefined();
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
