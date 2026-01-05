# Image Metadata Extraction Libraries Research

**Date:** January 5, 2026
**Author:** Claude Code
**Related Phase:** Phase 14 - Advanced Image Ingestion
**Purpose:** Research JavaScript/Node.js libraries for image metadata extraction in Electron/browser environments

---

## Executive Summary

This document provides comprehensive research on JavaScript libraries for image metadata extraction, analysis, and processing suitable for the basset-hound-browser Electron application. The focus is on libraries that work in both browser and Node.js environments, enabling OSINT-relevant image intelligence gathering.

---

## 1. EXIF Extraction Libraries

### 1.1 exif-js (Browser-focused)

**NPM Package:** `exif-js`
**Repository:** https://github.com/exif-js/exif-js
**License:** MIT
**Bundle Size:** ~35KB minified

**Capabilities:**
- Extract EXIF data from JPEG images
- Works directly in the browser
- Supports File/Blob input
- Extracts GPS coordinates, camera info, timestamps
- No dependencies

**Example Usage:**
```javascript
import EXIF from 'exif-js';

// From an image element
EXIF.getData(imageElement, function() {
  const allMetadata = EXIF.getAllTags(this);
  const gpsLat = EXIF.getTag(this, 'GPSLatitude');
  const gpsLon = EXIF.getTag(this, 'GPSLongitude');
  const make = EXIF.getTag(this, 'Make');
  const model = EXIF.getTag(this, 'Model');
  const dateTime = EXIF.getTag(this, 'DateTimeOriginal');

  console.log('Camera:', make, model);
  console.log('Date:', dateTime);
  console.log('GPS:', gpsLat, gpsLon);
});

// From a File object
EXIF.getData(file, function() {
  const orientation = EXIF.getTag(this, 'Orientation');
});
```

**Supported EXIF Tags:**
- Camera: Make, Model, Software
- Settings: ExposureTime, FNumber, ISO, FocalLength
- GPS: GPSLatitude, GPSLongitude, GPSAltitude, GPSTimeStamp
- Dates: DateTimeOriginal, DateTimeDigitized
- Image: ImageWidth, ImageHeight, Orientation

**Limitations:**
- JPEG only (no PNG, HEIC, WebP)
- No IPTC/XMP support
- Last updated in 2020

---

### 1.2 exifreader (Recommended for Full Metadata)

**NPM Package:** `exifreader`
**Repository:** https://github.com/mattiasw/ExifReader
**License:** MIT
**Bundle Size:** ~50KB minified (tree-shakeable)

**Capabilities:**
- EXIF, IPTC, XMP, ICC color profile extraction
- Supports JPEG, PNG, HEIC, AVIF, WebP, TIFF, GIF
- Works in browser and Node.js
- GPS coordinate extraction with decimal conversion
- Thumbnail extraction
- TypeScript support

**Example Usage:**
```javascript
import ExifReader from 'exifreader';

// Browser - from File/Blob
async function extractMetadata(file) {
  const tags = await ExifReader.load(file);

  // EXIF data
  const camera = {
    make: tags.Make?.description,
    model: tags.Model?.description,
    software: tags.Software?.description
  };

  // GPS data with conversion
  const gps = {
    latitude: tags.GPSLatitude?.description,
    longitude: tags.GPSLongitude?.description,
    altitude: tags.GPSAltitude?.description
  };

  // IPTC data
  const iptc = {
    caption: tags['Caption/Abstract']?.description,
    keywords: tags.Keywords?.description,
    copyright: tags['CopyrightNotice']?.description,
    creator: tags['By-line']?.description
  };

  // XMP data
  const xmp = {
    title: tags.title?.description,
    description: tags.description?.description,
    creator: tags.creator?.description,
    rights: tags.rights?.description
  };

  return { camera, gps, iptc, xmp };
}

// Node.js - from file path
import fs from 'fs';
const buffer = fs.readFileSync('image.jpg');
const tags = ExifReader.load(buffer);

// Get thumbnail
const thumbnail = tags.Thumbnail?.image;
if (thumbnail) {
  fs.writeFileSync('thumb.jpg', Buffer.from(thumbnail));
}
```

**Advanced Options:**
```javascript
const tags = await ExifReader.load(file, {
  expanded: true,           // Group by type (exif, iptc, xmp, icc)
  includeUnknown: true,     // Include unknown tags
  async: true               // Use async parsing
});

// Access grouped data
console.log(tags.exif);   // EXIF tags
console.log(tags.iptc);   // IPTC tags
console.log(tags.xmp);    // XMP tags
console.log(tags.icc);    // ICC color profile
```

---

### 1.3 piexifjs (Read/Write EXIF)

**NPM Package:** `piexifjs`
**Repository:** https://github.com/hMatoba/piexifjs
**License:** MIT

**Capabilities:**
- Read AND write EXIF data
- Supports JPEG images
- Can modify GPS coordinates
- Browser and Node.js compatible
- Pure JavaScript, no dependencies

**Example Usage:**
```javascript
import piexif from 'piexifjs';

// Read EXIF
const binary = atob(dataUrl.split(',')[1]);
const exifObj = piexif.load(binary);

console.log(exifObj['0th'][piexif.ImageIFD.Make]);
console.log(exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]);
console.log(exifObj['GPS'][piexif.GPSIFD.GPSLatitude]);

// Write EXIF (modify GPS)
exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(40.7128);
exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(-74.0060);

const exifBytes = piexif.dump(exifObj);
const newDataUrl = piexif.insert(exifBytes, dataUrl);

// Remove all EXIF
const strippedDataUrl = piexif.remove(dataUrl);
```

**Use Case for OSINT:**
- Strip metadata before sharing images
- Detect if metadata has been modified
- Extract original location data

---

### 1.4 exifr (Modern, Fast Parser)

**NPM Package:** `exifr`
**Repository:** https://github.com/MikeKovarik/exifr
**License:** MIT
**Bundle Size:** ~15KB core, modular

**Capabilities:**
- Fastest EXIF parser in JavaScript
- Modular design (tree-shakeable)
- Supports JPEG, HEIC, AVIF, PNG, TIFF
- EXIF, IPTC, XMP, ICC, JFIF
- Works in browser, Node.js, Deno
- Handles large files efficiently (streaming)

**Example Usage:**
```javascript
import * as exifr from 'exifr';

// Quick extraction - most common tags
const { latitude, longitude } = await exifr.gps(file);
const orientation = await exifr.orientation(file);
const thumbnail = await exifr.thumbnail(file);

// Full extraction
const output = await exifr.parse(file);
console.log(output.Make, output.Model);
console.log(output.DateTimeOriginal);
console.log(output.latitude, output.longitude);

// Specific segments only
const exif = await exifr.parse(file, { tiff: true, exif: true });
const iptc = await exifr.parse(file, { iptc: true });
const xmp = await exifr.parse(file, { xmp: true });

// Low memory usage for large files
const output = await exifr.parse(file, {
  chunked: true,      // Stream file in chunks
  firstChunkSize: 65536,
  chunkSize: 65536
});
```

**Recommended for basset-hound-browser** due to:
- Modern async API
- Excellent performance
- Comprehensive format support
- Modular bundle size

---

## 2. Image Analysis & Perceptual Hashing

### 2.1 imghash (Perceptual Hashing)

**NPM Package:** `imghash`
**Repository:** https://github.com/pwlmaciejewski/imghash
**License:** MIT

**Capabilities:**
- Generate perceptual hashes (pHash, dHash, aHash)
- Compare image similarity
- Node.js only (uses sharp/jimp internally)

**Example Usage:**
```javascript
import imghash from 'imghash';

// Generate hash
const hash = await imghash.hash('image.jpg');
console.log(hash); // e.g., 'f83c3c0c00000000'

// Compare hashes for similarity
const hash1 = await imghash.hash('image1.jpg');
const hash2 = await imghash.hash('image2.jpg');

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

const similarity = 1 - (hammingDistance(hash1, hash2) / hash1.length);
console.log(`Similarity: ${similarity * 100}%`);
```

---

### 2.2 blockhash-js (Browser-Compatible pHash)

**NPM Package:** `blockhash-js`
**Repository:** https://github.com/nicktoon/blockhash-js
**License:** MIT

**Capabilities:**
- Perceptual hashing in browser
- Uses HTML5 Canvas
- No server-side processing needed
- Computes 16x16 block hashes

**Example Usage:**
```javascript
import { bmvbhash } from 'blockhash-js';

function getImageData(imageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Generate hash from image element
const imageData = getImageData(imgElement);
const hash = bmvbhash(imageData, 16); // 16-bit hash
console.log(hash); // 64-character hex string

// Compare two images
function compareHashes(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    distance += (n1 ^ n2).toString(2).split('1').length - 1;
  }
  return 1 - (distance / (hash1.length * 4));
}
```

---

### 2.3 sharp (Node.js Image Processing)

**NPM Package:** `sharp`
**Repository:** https://github.com/lovell/sharp
**License:** Apache-2.0

**Capabilities:**
- High-performance image processing
- Resize, crop, rotate, composite
- Format conversion (JPEG, PNG, WebP, AVIF, TIFF)
- Metadata extraction
- Color space manipulation
- Native bindings (libvips)

**Example Usage:**
```javascript
import sharp from 'sharp';

// Get metadata
const metadata = await sharp('image.jpg').metadata();
console.log({
  format: metadata.format,
  width: metadata.width,
  height: metadata.height,
  space: metadata.space,
  channels: metadata.channels,
  depth: metadata.depth,
  density: metadata.density,
  hasAlpha: metadata.hasAlpha,
  orientation: metadata.orientation,
  exif: metadata.exif,
  icc: metadata.icc,
  iptc: metadata.iptc,
  xmp: metadata.xmp
});

// Extract EXIF as buffer
const exifBuffer = metadata.exif;

// Create thumbnail for hashing
const thumbnail = await sharp('image.jpg')
  .resize(8, 8, { fit: 'fill' })
  .grayscale()
  .raw()
  .toBuffer();

// Generate simple average hash
const avgBrightness = thumbnail.reduce((a, b) => a + b) / 64;
let hash = '';
for (const pixel of thumbnail) {
  hash += pixel > avgBrightness ? '1' : '0';
}
```

**Note:** sharp requires native compilation but is the fastest option for server-side processing in Electron's main process.

---

### 2.4 jimp (Pure JavaScript Image Processing)

**NPM Package:** `jimp`
**Repository:** https://github.com/jimp-dev/jimp
**License:** MIT

**Capabilities:**
- Pure JavaScript (no native dependencies)
- Works in browser and Node.js
- Image manipulation (resize, crop, rotate, blur)
- Color manipulation
- Compositing
- Text overlay

**Example Usage:**
```javascript
import Jimp from 'jimp';

// Load and process image
const image = await Jimp.read('image.jpg');

// Get dimensions
console.log(image.getWidth(), image.getHeight());

// Create perceptual hash
const hash = image
  .resize(8, 8)
  .greyscale()
  .hash(); // Built-in pHash

// Compare images
const diff = Jimp.diff(image1, image2);
console.log(`Difference: ${diff.percent * 100}%`);

// Distance between hashes
const distance = Jimp.distance(image1, image2);
console.log(`Hamming distance: ${distance}`);
```

---

## 3. OCR (Text Extraction from Images)

### 3.1 Tesseract.js (Recommended)

**NPM Package:** `tesseract.js`
**Repository:** https://github.com/naptha/tesseract.js
**License:** Apache-2.0
**Bundle Size:** ~1MB core + language data

**Capabilities:**
- Full OCR engine in JavaScript
- 100+ language support
- Works in browser via WebAssembly
- Works in Node.js via native bindings
- Word-level bounding boxes
- Confidence scores
- Multiple pages/images

**Example Usage:**
```javascript
import Tesseract from 'tesseract.js';

// Simple text extraction
const { data: { text } } = await Tesseract.recognize(
  imageFile,
  'eng',
  { logger: m => console.log(m) }
);
console.log('Extracted text:', text);

// With detailed output
const result = await Tesseract.recognize(imageFile, 'eng');
const { data } = result;

console.log('Full text:', data.text);
console.log('Confidence:', data.confidence);

// Word-level data
for (const word of data.words) {
  console.log(`"${word.text}" (${word.confidence}%) at`, word.bbox);
}

// Line-level data
for (const line of data.lines) {
  console.log(`Line: "${line.text}"`);
}

// Using a worker for better performance
const worker = await Tesseract.createWorker('eng');
await worker.recognize(image1);
await worker.recognize(image2);
await worker.terminate();

// Multiple languages
const worker = await Tesseract.createWorker(['eng', 'fra', 'deu']);
```

**OSINT-Specific Usage:**
```javascript
// Extract text from screenshot
async function extractTextFromScreenshot(screenshotPath) {
  const worker = await Tesseract.createWorker('eng');

  const { data } = await worker.recognize(screenshotPath);

  // Extract specific patterns from OCR text
  const emails = data.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const phones = data.text.match(/\+?[\d\s-]{10,}/g);
  const urls = data.text.match(/https?:\/\/[^\s]+/g);

  await worker.terminate();

  return {
    fullText: data.text,
    emails,
    phones,
    urls,
    confidence: data.confidence
  };
}
```

**Language Packs:**
- Pre-trained data: https://github.com/naptha/tessdata
- Fast versions (~4MB each)
- Best versions (~14MB each, higher accuracy)

---

### 3.2 ocrad.js (Lightweight OCR)

**NPM Package:** `ocrad.js`
**Repository:** https://github.com/nicktoon/ocrad.js
**License:** GPL-3.0

**Capabilities:**
- Lightweight OCR (~300KB)
- Works in browser
- Compiled from C++ via Emscripten
- English text only
- Faster but less accurate than Tesseract

**Example Usage:**
```javascript
import OCRAD from 'ocrad.js';

// From canvas
const canvas = document.getElementById('myCanvas');
const text = OCRAD(canvas);
console.log(text);

// From image element
const img = document.getElementById('myImage');
const canvas = document.createElement('canvas');
canvas.width = img.width;
canvas.height = img.height;
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const text = OCRAD(canvas);
```

---

## 4. Face Detection Libraries

### 4.1 face-api.js (Recommended)

**NPM Package:** `face-api.js`
**Repository:** https://github.com/justadudewhohacks/face-api.js
**License:** MIT
**Model Size:** ~5MB (SSD MobileNet)

**Capabilities:**
- Face detection (bounding boxes)
- Face landmark detection (68 points)
- Face recognition (128D embeddings)
- Face expression analysis
- Age and gender estimation
- Works in browser and Node.js
- Uses TensorFlow.js backend

**Example Usage:**
```javascript
import * as faceapi from 'face-api.js';

// Load models (do once at startup)
await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
await faceapi.nets.faceExpressionNet.loadFromUri('/models');
await faceapi.nets.ageGenderNet.loadFromUri('/models');

// Detect faces with all features
const detections = await faceapi
  .detectAllFaces(imageElement)
  .withFaceLandmarks()
  .withFaceExpressions()
  .withAgeAndGender()
  .withFaceDescriptors();

for (const detection of detections) {
  console.log('Face bounding box:', detection.detection.box);
  console.log('Landmarks:', detection.landmarks.positions);
  console.log('Expression:', detection.expressions);
  console.log('Age:', detection.age);
  console.log('Gender:', detection.gender);
  console.log('Descriptor:', detection.descriptor); // 128D vector
}

// Face matching
const faceMatcher = new faceapi.FaceMatcher(detections);
const queryDescriptor = await faceapi
  .detectSingleFace(queryImage)
  .withFaceLandmarks()
  .withFaceDescriptor();

const bestMatch = faceMatcher.findBestMatch(queryDescriptor.descriptor);
console.log(`Best match: ${bestMatch.label} (distance: ${bestMatch.distance})`);
```

**OSINT Usage:**
```javascript
// Count faces in image
async function countFaces(imagePath) {
  const img = await faceapi.fetchImage(imagePath);
  const detections = await faceapi.detectAllFaces(img);
  return detections.length;
}

// Extract face thumbnails
async function extractFaces(imagePath) {
  const img = await faceapi.fetchImage(imagePath);
  const detections = await faceapi.detectAllFaces(img);

  const faces = [];
  for (const detection of detections) {
    const { x, y, width, height } = detection.box;
    // Create canvas and extract face region
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    faces.push(canvas.toDataURL('image/jpeg'));
  }

  return faces;
}
```

---

### 4.2 @mediapipe/face_detection

**NPM Package:** `@mediapipe/face_detection`
**Repository:** https://github.com/google/mediapipe
**License:** Apache-2.0

**Capabilities:**
- Google MediaPipe face detection
- High performance (real-time capable)
- Works in browser
- Bounding boxes and key points

**Example Usage:**
```javascript
import { FaceDetection } from '@mediapipe/face_detection';

const faceDetection = new FaceDetection({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
});

faceDetection.setOptions({
  model: 'short', // 'short' or 'full'
  minDetectionConfidence: 0.5
});

faceDetection.onResults((results) => {
  for (const detection of results.detections) {
    console.log('Bounding box:', detection.boundingBox);
    console.log('Keypoints:', detection.landmarks);
    console.log('Score:', detection.score);
  }
});

await faceDetection.send({ image: imageElement });
```

---

### 4.3 @vladmandic/human (Comprehensive)

**NPM Package:** `@vladmandic/human`
**Repository:** https://github.com/vladmandic/human
**License:** MIT

**Capabilities:**
- Face detection, landmarks, recognition
- Body pose estimation
- Hand detection and tracking
- Gesture recognition
- Object detection
- Works in browser and Node.js
- GPU acceleration via WebGL/WebGPU

**Example Usage:**
```javascript
import Human from '@vladmandic/human';

const human = new Human({
  face: {
    enabled: true,
    detector: { rotation: true },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true },
    emotion: { enabled: true }
  }
});

await human.load();

const result = await human.detect(imageElement);

for (const face of result.face) {
  console.log('Box:', face.box);
  console.log('Mesh points:', face.mesh);
  console.log('Emotion:', face.emotion);
  console.log('Age:', face.age);
  console.log('Gender:', face.gender);
  console.log('Descriptor:', face.embedding);
}
```

---

## 5. IPTC/XMP Metadata Extraction

### 5.1 exifreader (Recommended - Already Covered)

As noted in section 1.2, `exifreader` provides comprehensive IPTC and XMP extraction.

**IPTC Fields Available:**
```javascript
const tags = await ExifReader.load(file, { expanded: true });

// IPTC fields
const iptc = {
  objectName: tags.iptc?.['Object Name']?.description,
  headline: tags.iptc?.Headline?.description,
  caption: tags.iptc?.['Caption/Abstract']?.description,
  keywords: tags.iptc?.Keywords?.description, // Array
  byline: tags.iptc?.['By-line']?.description,
  bylineTitle: tags.iptc?.['By-line Title']?.description,
  credit: tags.iptc?.Credit?.description,
  source: tags.iptc?.Source?.description,
  copyright: tags.iptc?.['Copyright Notice']?.description,
  city: tags.iptc?.City?.description,
  state: tags.iptc?.['Province/State']?.description,
  country: tags.iptc?.['Country/Primary Location Name']?.description,
  countryCode: tags.iptc?.['Country/Primary Location Code']?.description,
  dateCreated: tags.iptc?.['Date Created']?.description,
  timeCreated: tags.iptc?.['Time Created']?.description
};

// XMP fields
const xmp = {
  title: tags.xmp?.title?.description,
  description: tags.xmp?.description?.description,
  creator: tags.xmp?.creator?.description,
  rights: tags.xmp?.rights?.description,
  subject: tags.xmp?.subject?.description, // Keywords
  rating: tags.xmp?.Rating?.description,
  label: tags.xmp?.Label?.description,
  createDate: tags.xmp?.CreateDate?.description,
  modifyDate: tags.xmp?.ModifyDate?.description,
  creatorTool: tags.xmp?.CreatorTool?.description
};
```

---

### 5.2 node-iptc (Node.js Only)

**NPM Package:** `node-iptc`
**License:** MIT

**Capabilities:**
- Extract IPTC metadata from JPEG
- Node.js only
- Lightweight

**Example Usage:**
```javascript
import iptc from 'node-iptc';
import fs from 'fs';

const buffer = fs.readFileSync('image.jpg');
const data = iptc(buffer);

console.log({
  title: data.object_name,
  caption: data.caption,
  keywords: data.keywords,
  byline: data.byline,
  credit: data.credit,
  copyright: data.copyright_notice,
  city: data.city,
  country: data.country
});
```

---

## 6. Recommended Stack for basset-hound-browser

Based on the research, here is the recommended library stack for Phase 14:

### Primary Libraries

| Purpose | Library | Reason |
|---------|---------|--------|
| **EXIF/IPTC/XMP** | `exifr` | Fast, modular, comprehensive format support |
| **Image Processing** | `sharp` (Node) + `jimp` (browser fallback) | Sharp for performance, Jimp for portability |
| **Perceptual Hash** | `blockhash-js` (browser) + `imghash` (Node) | Browser-compatible + accurate |
| **OCR** | `tesseract.js` | Most comprehensive, multi-language |
| **Face Detection** | `face-api.js` | Full-featured, works in Electron |

### Installation Commands

```bash
# Core metadata extraction
npm install exifr exifreader

# Image processing
npm install sharp jimp

# Perceptual hashing
npm install blockhash-js imghash

# OCR
npm install tesseract.js

# Face detection
npm install face-api.js @tensorflow/tfjs-node
```

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   IMAGE INGESTION PIPELINE                       │
└───────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  METADATA       │  │  VISUAL         │  │  CONTENT        │
│  EXTRACTION     │  │  ANALYSIS       │  │  EXTRACTION     │
│                 │  │                 │  │                 │
│  - exifr        │  │  - face-api.js  │  │  - tesseract.js │
│  - exifreader   │  │  - blockhash-js │  │                 │
│                 │  │  - sharp/jimp   │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED IMAGE METADATA                        │
│                                                                  │
│  {                                                               │
│    exif: { camera, gps, timestamps, settings },                 │
│    iptc: { caption, keywords, copyright, credit },              │
│    xmp: { title, description, creator, rights },                │
│    analysis: {                                                   │
│      perceptualHash: "abc123...",                               │
│      faces: [ { box, landmarks, age, gender } ],                │
│      extractedText: "...",                                      │
│      dimensions: { width, height }                              │
│    }                                                            │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Example Implementation for basset-hound-browser

### ImageMetadataExtractor Class

```javascript
// extraction/image-metadata-extractor.js

const exifr = require('exifr');
const ExifReader = require('exifreader');
const Tesseract = require('tesseract.js');

class ImageMetadataExtractor {
  constructor(options = {}) {
    this.options = {
      extractExif: true,
      extractIptc: true,
      extractXmp: true,
      extractGps: true,
      extractThumbnail: false,
      runOcr: false,
      detectFaces: false,
      generateHash: true,
      ...options
    };

    this.tesseractWorker = null;
    this.faceApiLoaded = false;
  }

  async extract(input) {
    const result = {
      success: true,
      extractedAt: new Date().toISOString(),
      metadata: {},
      analysis: {},
      errors: []
    };

    try {
      // Fast EXIF extraction with exifr
      if (this.options.extractExif) {
        const exif = await exifr.parse(input, {
          tiff: true,
          exif: true,
          gps: this.options.extractGps,
          iptc: this.options.extractIptc,
          xmp: this.options.extractXmp
        });

        result.metadata.exif = this.normalizeExif(exif);
      }

      // Detailed metadata with ExifReader
      if (this.options.extractIptc || this.options.extractXmp) {
        const tags = await ExifReader.load(input, { expanded: true });
        result.metadata.iptc = this.normalizeIptc(tags.iptc);
        result.metadata.xmp = this.normalizeXmp(tags.xmp);
      }

      // GPS extraction
      if (this.options.extractGps) {
        const gps = await exifr.gps(input);
        if (gps) {
          result.metadata.gps = {
            latitude: gps.latitude,
            longitude: gps.longitude
          };
        }
      }

      // Thumbnail extraction
      if (this.options.extractThumbnail) {
        const thumbnail = await exifr.thumbnail(input);
        if (thumbnail) {
          result.metadata.thumbnail = Buffer.from(thumbnail).toString('base64');
        }
      }

      // OCR
      if (this.options.runOcr) {
        result.analysis.ocr = await this.extractText(input);
      }

      // Perceptual hash
      if (this.options.generateHash) {
        result.analysis.perceptualHash = await this.generateHash(input);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  normalizeExif(exif) {
    if (!exif) return null;

    return {
      camera: {
        make: exif.Make,
        model: exif.Model,
        software: exif.Software
      },
      settings: {
        exposureTime: exif.ExposureTime,
        fNumber: exif.FNumber,
        iso: exif.ISO,
        focalLength: exif.FocalLength,
        flash: exif.Flash
      },
      dates: {
        dateTimeOriginal: exif.DateTimeOriginal,
        dateTimeDigitized: exif.DateTimeDigitized,
        modifyDate: exif.ModifyDate
      },
      image: {
        width: exif.ImageWidth || exif.ExifImageWidth,
        height: exif.ImageHeight || exif.ExifImageHeight,
        orientation: exif.Orientation
      }
    };
  }

  normalizeIptc(iptc) {
    if (!iptc) return null;

    return {
      headline: iptc.Headline?.description,
      caption: iptc['Caption/Abstract']?.description,
      keywords: iptc.Keywords?.description,
      byline: iptc['By-line']?.description,
      credit: iptc.Credit?.description,
      source: iptc.Source?.description,
      copyright: iptc['Copyright Notice']?.description,
      city: iptc.City?.description,
      state: iptc['Province/State']?.description,
      country: iptc['Country/Primary Location Name']?.description,
      dateCreated: iptc['Date Created']?.description
    };
  }

  normalizeXmp(xmp) {
    if (!xmp) return null;

    return {
      title: xmp.title?.description,
      description: xmp.description?.description,
      creator: xmp.creator?.description,
      rights: xmp.rights?.description,
      subject: xmp.subject?.description,
      rating: xmp.Rating?.description,
      createDate: xmp.CreateDate?.description,
      modifyDate: xmp.ModifyDate?.description,
      creatorTool: xmp.CreatorTool?.description
    };
  }

  async extractText(input) {
    if (!this.tesseractWorker) {
      this.tesseractWorker = await Tesseract.createWorker('eng');
    }

    const { data } = await this.tesseractWorker.recognize(input);

    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      }))
    };
  }

  async generateHash(input) {
    // Implementation depends on environment (browser vs Node.js)
    // This is a placeholder for the hash generation logic
    return null;
  }

  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

module.exports = { ImageMetadataExtractor };
```

---

## 8. WebSocket Commands for Phase 14

Proposed new commands for image ingestion:

```javascript
// websocket/commands/image-commands.js

const imageCommands = {
  // Extract metadata from image
  extract_image_metadata: async (params, webContents) => {
    const { imageUrl, options } = params;
    const extractor = new ImageMetadataExtractor(options);
    return await extractor.extract(imageUrl);
  },

  // Run OCR on image
  extract_image_text: async (params, webContents) => {
    const { imageUrl, language } = params;
    const worker = await Tesseract.createWorker(language || 'eng');
    const { data } = await worker.recognize(imageUrl);
    await worker.terminate();
    return data;
  },

  // Detect faces in image
  detect_faces: async (params, webContents) => {
    const { imageUrl, options } = params;
    // Face detection implementation
  },

  // Generate perceptual hash
  generate_image_hash: async (params, webContents) => {
    const { imageUrl } = params;
    // Hash generation implementation
  },

  // Compare two images for similarity
  compare_images: async (params, webContents) => {
    const { image1, image2 } = params;
    // Similarity comparison implementation
  },

  // Extract all images from page with metadata
  extract_page_images: async (params, webContents) => {
    // Page image extraction implementation
  }
};

module.exports = imageCommands;
```

---

## 9. Conclusions

### Key Findings

1. **exifr** is the best choice for EXIF extraction due to its speed, modularity, and comprehensive format support.

2. **exifreader** provides the most complete IPTC/XMP extraction capabilities.

3. **tesseract.js** is the only viable option for full-featured OCR in browser/Electron environments.

4. **face-api.js** offers the best balance of features and ease of use for face detection.

5. **sharp** provides excellent performance for Node.js image processing but requires native compilation.

6. **blockhash-js** enables browser-side perceptual hashing without server dependencies.

### Recommended Next Steps

1. Add recommended libraries to package.json
2. Implement ImageMetadataExtractor class
3. Create WebSocket commands for image analysis
4. Integrate with existing data-type-detector for image URL detection
5. Add tests for image metadata extraction
6. Create UI components for image analysis results

---

*Last Updated: January 5, 2026*
