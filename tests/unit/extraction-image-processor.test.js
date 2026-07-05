/**
 * Tests for ImageProcessor module
 * @file tests/unit/extraction-image-processor.test.js
 */

const { ImageProcessor } = require('../../extraction/image-processor');

describe('ImageProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new ImageProcessor();
  });

  describe('processImages()', () => {
    test('extracts all img elements', () => {
      const html = `
        <html>
          <body>
            <img src="image1.jpg" alt="Image 1">
            <img src="/images/image2.jpg" alt="Image 2">
            <img src="https://example.com/image3.jpg">
          </body>
        </html>
      `;

      const images = processor.processImages(html);
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveProperty('src');
      expect(images[0]).toHaveProperty('alt');
    });

    test('extracts responsive images with srcset', () => {
      const html = `
        <img src="image.jpg" srcset="image-small.jpg 480w, image-large.jpg 1200w" sizes="100vw">
      `;

      const images = processor.processImages(html);
      expect(images).toHaveLength(1);
      expect(images[0].responsive).toBe(true);
      expect(images[0]).toHaveProperty('srcset');
      expect(images[0]).toHaveProperty('sizes');
    });

    test('detects lazy-loaded images', () => {
      const html = `
        <img src="image.jpg" loading="lazy" alt="Lazy image">
      `;

      const images = processor.processImages(html);
      expect(images[0].lazy).toBe(true);
      expect(images[0].loading).toBe('lazy');
    });

    test('extracts picture elements with sources', () => {
      const html = `
        <picture>
          <source srcset="image-webp.webp" type="image/webp">
          <source srcset="image-jpg.jpg" type="image/jpeg">
          <img src="image-fallback.jpg" alt="Picture">
        </picture>
      `;

      const images = processor.processImages(html);
      expect(images).toHaveLength(1);
      expect(images[0].picture).toBe(true);
      expect(images[0]).toHaveProperty('sources');
      expect(images[0].sources.length).toBeGreaterThan(0);
    });

    test('extracts figure elements with captions', () => {
      const html = `
        <figure>
          <img src="image.jpg" alt="Figure image">
          <figcaption>This is the caption</figcaption>
        </figure>
      `;

      const images = processor.processImages(html);
      expect(images).toHaveLength(1);
      expect(images[0].inFigure).toBe(true);
      expect(images[0].caption).toBe('This is the caption');
    });

    test('resolves relative URLs with baseUrl', () => {
      const html = `
        <img src="image.jpg">
        <img src="/images/photo.jpg">
        <img src="https://cdn.example.com/remote.jpg">
      `;

      const images = processor.processImages(html, {
        baseUrl: 'https://example.com/page/'
      });

      expect(images[0].src).toBe('https://example.com/page/image.jpg');
      expect(images[1].src).toBe('https://example.com/images/photo.jpg');
      expect(images[2].src).toBe('https://cdn.example.com/remote.jpg');
    });

    test('extracts image attributes', () => {
      const html = `
        <img
          src="image.jpg"
          alt="Test image"
          title="Image title"
          width="100"
          height="200"
          class="thumbnail responsive"
          data-id="img-123"
        >
      `;

      const images = processor.processImages(html, { includeMetadata: true });
      expect(images[0].alt).toBe('Test image');
      expect(images[0].title).toBe('Image title');
      expect(images[0].width).toBe('100');
      expect(images[0].height).toBe('200');
      expect(images[0].classes).toContain('thumbnail');
      expect(images[0].classes).toContain('responsive');
    });

    test('skips images without src attribute', () => {
      const html = `
        <img alt="No src">
        <img src="valid.jpg">
      `;

      const images = processor.processImages(html);
      expect(images).toHaveLength(1);
      expect(images[0].src).toContain('valid.jpg');
    });

    test('returns empty array for invalid HTML', () => {
      expect(processor.processImages(null)).toEqual([]);
      expect(processor.processImages(undefined)).toEqual([]);
      expect(processor.processImages(123)).toEqual([]);
    });

    test('updates statistics', () => {
      const html = `
        <img src="regular.jpg">
        <img src="responsive.jpg" srcset="r.jpg 480w">
        <img src="lazy.jpg" loading="lazy">
      `;

      processor.processImages(html);
      const stats = processor.getStats();

      expect(stats.totalProcessed).toBe(3);
      expect(stats.responsiveImages).toBe(1);
      expect(stats.lazyLoadedImages).toBe(1);
    });
  });

  describe('isResponsiveImage()', () => {
    test('detects responsive images', () => {
      const element = { attribs: { srcset: 'img.jpg 480w' } };
      expect(processor.isResponsiveImage(element)).toBe(true);
    });

    test('returns false for non-responsive', () => {
      const element = { attribs: { src: 'img.jpg' } };
      expect(processor.isResponsiveImage(element)).toBe(false);
    });
  });

  describe('getImageLoadingStrategy()', () => {
    test('returns lazy for lazy-loaded images', () => {
      const element = { attribs: { loading: 'lazy' } };
      expect(processor.getImageLoadingStrategy(element)).toBe('lazy');
    });

    test('returns eager for eager-loaded images', () => {
      const element = { attribs: { loading: 'eager' } };
      expect(processor.getImageLoadingStrategy(element)).toBe('eager');
    });

    test('returns auto for default loading', () => {
      const element = { attribs: {} };
      expect(processor.getImageLoadingStrategy(element)).toBe('auto');
    });
  });

  describe('statistics', () => {
    test('resetStats() clears statistics', () => {
      const html = `<img src="image.jpg">`;
      processor.processImages(html);
      expect(processor.getStats().totalProcessed).toBeGreaterThan(0);

      processor.resetStats();
      expect(processor.getStats().totalProcessed).toBe(0);
    });

    test('getStats() returns current statistics', () => {
      const stats = processor.getStats();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('responsiveImages');
      expect(stats).toHaveProperty('lazyLoadedImages');
      expect(stats).toHaveProperty('pictureElements');
    });
  });

  describe('error handling', () => {
    test('handles malformed HTML gracefully', () => {
      const html = `<img src="image.jpg"<body>`;
      const images = processor.processImages(html);
      expect(Array.isArray(images)).toBe(true);
      expect(images.length >= 0).toBe(true);
    });

    test('handles empty HTML', () => {
      expect(processor.processImages('')).toEqual([]);
    });
  });
});
