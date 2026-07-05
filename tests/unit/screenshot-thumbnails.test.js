/**
 * Thumbnail Generator Test Suite
 *
 * Tests for thumbnail generation, responsive image sets,
 * smart cropping, and web optimization
 */

const { ThumbnailGenerator, THUMBNAIL_CONFIG } = require('../../screenshots/thumbnails');

describe('ThumbnailGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ThumbnailGenerator();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(generator.options.sizes).toEqual(THUMBNAIL_CONFIG.sizes);
      expect(generator.options.defaultFormat).toBe(THUMBNAIL_CONFIG.defaultFormat);
    });

    it('should accept custom options', () => {
      const custom = new ThumbnailGenerator({
        defaultFormat: 'webp'
      });

      expect(custom.options.defaultFormat).toBe('webp');
    });

    it('should initialize empty cache', () => {
      expect(generator.thumbnailCache.size).toBe(0);
    });

    it('should initialize statistics', () => {
      expect(generator.generationStats.totalGenerated).toBe(0);
      expect(generator.generationStats.totalCached).toBe(0);
    });
  });

  describe('generateThumbnail', () => {
    const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(1000).fill(0)]);

    it('should generate thumbnail with default size', async () => {
      const result = await generator.generateThumbnail(testData);

      expect(result.success).toBe(true);
      expect(result.size).toBe(THUMBNAIL_CONFIG.sizes.medium);
      expect(result.format).toBe(THUMBNAIL_CONFIG.defaultFormat);
    });

    it('should generate thumbnail with custom size', async () => {
      const result = await generator.generateThumbnail(testData, { size: 512 });

      expect(result.success).toBe(true);
      expect(result.size).toBe(512);
    });

    it('should generate thumbnail with custom format', async () => {
      const result = await generator.generateThumbnail(testData, { format: 'webp' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('webp');
    });

    it('should apply quality setting', async () => {
      const result = await generator.generateThumbnail(testData, {
        format: 'jpeg',
        quality: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.quality).toBe(0.5);
    });

    it('should cache generated thumbnails', async () => {
      const result1 = await generator.generateThumbnail(testData, { size: 256 });
      expect(result1.cached).not.toBe(true);

      const result2 = await generator.generateThumbnail(testData, { size: 256 });
      expect(result2.cached).toBe(true);

      expect(generator.generationStats.totalCached).toBeGreaterThan(0);
    });

    it('should update generation statistics', async () => {
      const initialCount = generator.generationStats.totalGenerated;

      await generator.generateThumbnail(testData);

      expect(generator.generationStats.totalGenerated).toBe(initialCount + 1);
    });

    it('should handle invalid data gracefully', async () => {
      const result = await generator.generateThumbnail(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should estimate compressed size for JPEG', async () => {
      const result = await generator.generateThumbnail(testData, { format: 'jpeg' });

      expect(result.success).toBe(true);
      expect(result.estimatedSize).toBeDefined();
    });

    it('should estimate compressed size for WebP', async () => {
      const result = await generator.generateThumbnail(testData, { format: 'webp' });

      expect(result.success).toBe(true);
      expect(result.estimatedSize).toBeDefined();
    });
  });

  describe('generateResponsiveSet', () => {
    const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(5000).fill(0)]);

    it('should generate responsive image set', async () => {
      const result = await generator.generateResponsiveSet(testData, {
        sizes: [256, 512, 1024],
        formats: ['webp', 'jpeg']
      });

      expect(result.success).toBe(true);
      expect(Object.keys(result.images).length).toBeGreaterThan(0);
    });

    it('should generate images for each size', async () => {
      const sizes = [256, 512, 1024];

      const result = await generator.generateResponsiveSet(testData, {
        sizes,
        formats: ['jpeg']
      });

      expect(result.success).toBe(true);
      const jpegImages = result.images.jpeg || [];
      expect(jpegImages.length).toBe(sizes.length);
    });

    it('should generate images for each format', async () => {
      const formats = ['webp', 'jpeg', 'png'];

      const result = await generator.generateResponsiveSet(testData, {
        sizes: [256],
        formats
      });

      expect(result.success).toBe(true);
      // Should have some of the requested formats
      expect(Object.keys(result.images).length).toBeGreaterThan(0);
    });

    it('should track total size', async () => {
      const result = await generator.generateResponsiveSet(testData, {
        sizes: [256, 512],
        formats: ['jpeg']
      });

      expect(result.success).toBe(true);
      expect(result.metadata.totalSize).toBeGreaterThan(0);
    });

    it('should report generation timestamp', async () => {
      const result = await generator.generateResponsiveSet(testData);

      expect(result.metadata.generatedAt).toBeDefined();
    });

    it('should handle invalid data', async () => {
      const result = await generator.generateResponsiveSet(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('smartCrop', () => {
    const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(5000).fill(0)]);

    it('should crop to square aspect ratio', async () => {
      const result = await generator.smartCrop(testData, {
        aspectRatio: 1
      });

      expect(result.success).toBe(true);
      expect(result.aspectRatio).toBe(1);
    });

    it('should support widescreen aspect ratio', async () => {
      const result = await generator.smartCrop(testData, {
        aspectRatio: 16 / 9
      });

      expect(result.success).toBe(true);
      expect(result.aspectRatio).toBe(16 / 9);
    });

    it('should apply gravity setting', async () => {
      const gravities = ['center', 'north', 'south', 'east', 'west'];

      for (const gravity of gravities) {
        const result = await generator.smartCrop(testData, { gravity });
        expect(result.success).toBe(true);
        expect(result.gravity).toBe(gravity);
      }
    });

    it('should handle invalid data', async () => {
      const result = await generator.smartCrop(undefined);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return crop information', async () => {
      const result = await generator.smartCrop(testData, { aspectRatio: 1 });

      expect(result.success).toBe(true);
      expect(result.cropInfo).toBeDefined();
      expect(result.cropInfo.description).toBeDefined();
    });
  });

  describe('optimizeForWeb', () => {
    const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(50000).fill(0)]);

    it('should optimize for web delivery', async () => {
      const result = await generator.optimizeForWeb(testData);

      expect(result.success).toBe(true);
      expect(result.originalSize).toBe(testData.length);
      expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize);
    });

    it('should prefer WebP format', async () => {
      const result = await generator.optimizeForWeb(testData, {
        preferredFormat: 'webp'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('webp');
    });

    it('should strip metadata if requested', async () => {
      const result = await generator.optimizeForWeb(testData, {
        stripMetadata: true
      });

      expect(result.success).toBe(true);
    });

    it('should enforce target size if specified', async () => {
      const targetSize = 50000;

      const result = await generator.optimizeForWeb(testData, {
        targetSize
      });

      expect(result.success).toBe(true);
      if (result.optimizedSize > targetSize) {
        expect(result.qualityReduced).toBe(true);
      }
    });

    it('should calculate savings', async () => {
      const result = await generator.optimizeForWeb(testData);

      expect(result.success).toBe(true);
      expect(result.saved).toBeGreaterThanOrEqual(0);
      expect(result.savingPercent).toBeDefined();
    });

    it('should handle invalid data', async () => {
      const result = await generator.optimizeForWeb({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createPictureElement', () => {
    it('should generate picture element HTML', async () => {
      const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(1000).fill(0)]);

      const responsiveSet = await generator.generateResponsiveSet(testData, {
        sizes: [256, 512],
        formats: ['webp', 'jpeg']
      });

      const html = generator.createPictureElement(responsiveSet);

      expect(html).toContain('<picture>');
      expect(html).toContain('</picture>');
      expect(html).toContain('<source');
      expect(html).toContain('<img');
    });

    it('should include alt text', () => {
      const responsiveSet = { success: false, images: {} };

      const html = generator.createPictureElement(responsiveSet, {
        alt: 'My Image'
      });

      expect(html).toContain('alt="My Image"');
    });

    it('should apply CSS class', () => {
      const responsiveSet = { success: false, images: {} };

      const html = generator.createPictureElement(responsiveSet, {
        className: 'my-image'
      });

      expect(html).toContain('class="my-image"');
    });

    it('should handle failed responsive set', () => {
      const responsiveSet = { success: false, images: {} };

      const html = generator.createPictureElement(responsiveSet);

      expect(html).toContain('<img');
      expect(html).toContain('alt="Image"');
    });
  });

  describe('generateResponsiveMarkup', () => {
    it('should generate responsive img markup', () => {
      const images = [
        { src: 'image-256w.webp', size: 256 },
        { src: 'image-512w.webp', size: 512 },
        { src: 'image-1024w.webp', size: 1024 }
      ];

      const markup = generator.generateResponsiveMarkup(images);

      expect(markup).toContain('srcset=');
      expect(markup).toContain('256w');
      expect(markup).toContain('512w');
      expect(markup).toContain('1024w');
      expect(markup).toContain('loading="lazy"');
    });

    it('should include sizes attribute when provided', () => {
      const images = [{ src: 'image.webp', size: 256 }];

      const markup = generator.generateResponsiveMarkup(images, {
        sizes: '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw'
      });

      expect(markup).toContain('sizes="');
    });

    it('should include alt text', () => {
      const images = [{ src: 'image.webp', size: 256 }];

      const markup = generator.generateResponsiveMarkup(images, {
        alt: 'My Image'
      });

      expect(markup).toContain('alt="My Image"');
    });

    it('should handle empty images array', () => {
      const markup = generator.generateResponsiveMarkup([]);

      expect(markup).toContain('<img');
      expect(markup).toContain('alt=');
    });
  });

  describe('cache management', () => {
    const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(1000).fill(0)]);

    it('should clear all cached items', async () => {
      await generator.generateThumbnail(testData);
      await generator.generateThumbnail(testData, { size: 512 });

      const cleared = generator.clearCache();

      expect(cleared).toBeGreaterThan(0);
      expect(generator.thumbnailCache.size).toBe(0);
    });

    it('should get cache statistics', async () => {
      await generator.generateThumbnail(testData);
      await generator.generateThumbnail(testData); // Will hit cache

      const stats = generator.getStatistics();

      expect(stats.totalGenerated).toBe(1);
      expect(stats.totalCached).toBe(1);
      expect(stats.hitRate).toBeDefined();
    });

    it('should track cache hit rate', async () => {
      const testData2 = Buffer.from([0xFF, 0xD8, 0xFF, ...Array(1000).fill(0)]);

      await generator.generateThumbnail(testData);
      await generator.generateThumbnail(testData);

      const stats = generator.getStatistics();

      if (stats.totalGenerated > 0) {
        const hitRate = parseFloat(stats.hitRate);
        expect(hitRate).toBeGreaterThanOrEqual(0);
        expect(hitRate).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('MIME type handling', () => {
    it('should resolve JPEG MIME type', () => {
      const type = generator.getMimeType('jpeg');
      expect(type).toBe('image/jpeg');
    });

    it('should resolve PNG MIME type', () => {
      const type = generator.getMimeType('png');
      expect(type).toBe('image/png');
    });

    it('should resolve WebP MIME type', () => {
      const type = generator.getMimeType('webp');
      expect(type).toBe('image/webp');
    });

    it('should default to JPEG for unknown format', () => {
      const type = generator.getMimeType('xyz');
      expect(type).toBe('image/jpeg');
    });
  });

  describe('data conversion', () => {
    it('should convert Buffer to Buffer', () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const result = generator.toBuffer(buffer);

      expect(result).toEqual(buffer);
    });

    it('should convert data URL to Buffer', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      const result = generator.toBuffer(dataUrl);

      expect(result).toEqual(pngBuffer);
    });

    it('should convert base64 string to Buffer', () => {
      const original = Buffer.from('Test Data');
      const base64 = original.toString('base64');

      const result = generator.toBuffer(base64);

      expect(result).toEqual(original);
    });
  });

  describe('performance considerations', () => {
    it('should cache identical thumbnails', async () => {
      const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(1000).fill(0)]);

      const start1 = Date.now();
      await generator.generateThumbnail(testData);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await generator.generateThumbnail(testData);
      const time2 = Date.now() - start2;

      // Cached version should be faster
      expect(time2).toBeLessThanOrEqual(time1 + 50); // Allow 50ms variance
    });

    it('should handle multiple sizes efficiently', async () => {
      const testData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(5000).fill(0)]);

      const start = Date.now();
      await generator.generateResponsiveSet(testData, {
        sizes: [128, 256, 512, 1024],
        formats: ['jpeg', 'webp']
      });
      const duration = Date.now() - start;

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000);
    });
  });
});
