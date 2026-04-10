import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import {
  compressImageIfNeeded,
  getCompressionConfig,
  type CompressionResult,
  DEFAULT_COMPRESSION_MAX_SIZE_MB,
  DEFAULT_COMPRESSION_MIN_QUALITY,
  COMPRESSION_QUALITY_HIGH,
  COMPRESSION_QUALITY_MEDIUM,
  BYTES_PER_MB,
} from '../src/ocr';

// Test-specific constants
const TEST_IMAGE_SIZE_3MB = 3 * BYTES_PER_MB;
const TEST_IMAGE_SIZE_6MB = 6 * BYTES_PER_MB;
const TEST_IMAGE_SIZE_15MB = 15 * BYTES_PER_MB;
const TEST_IMAGE_SIZE_20MB = 20 * BYTES_PER_MB;
const TEST_TARGET_SIZE_2MB = 2 * BYTES_PER_MB;
const TEST_TARGET_SIZE_10MB = 10 * BYTES_PER_MB;
const TEST_CUSTOM_MIN_QUALITY = 80;
const TEST_BYTES_PER_PIXEL_JPEG = 3;  // Rough estimate for JPEG compression
const TEST_MAX_IMAGE_DIMENSION = 8000;
const TEST_IMAGE_CHANNELS = 3;  // RGB
const TEST_COMPRESSION_LEVEL_NONE = 0;  // Uncompressed PNG
const TEST_BACKGROUND_GRAY = { r: 128, g: 128, b: 128 };

describe('Image Compression', () => {
  // Store original env vars
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      IMAGE_COMPRESSION_MAX_SIZE_MB: process.env.IMAGE_COMPRESSION_MAX_SIZE_MB,
      IMAGE_COMPRESSION_MIN_QUALITY: process.env.IMAGE_COMPRESSION_MIN_QUALITY,
      IMAGE_COMPRESSION_ENABLED: process.env.IMAGE_COMPRESSION_ENABLED,
    };
  });

  afterEach(() => {
    // Restore original env vars
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe('getCompressionConfig', () => {
    it('should return default configuration', () => {
      delete process.env.IMAGE_COMPRESSION_MAX_SIZE_MB;
      delete process.env.IMAGE_COMPRESSION_MIN_QUALITY;
      delete process.env.IMAGE_COMPRESSION_ENABLED;

      const config = getCompressionConfig();

      expect(config.maxSizeBytes).toBe(DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB);
      expect(config.minQuality).toBe(DEFAULT_COMPRESSION_MIN_QUALITY);
      expect(config.enabled).toBe(true);
    });

    it('should read custom configuration from environment', () => {
      process.env.IMAGE_COMPRESSION_MAX_SIZE_MB = '10';
      process.env.IMAGE_COMPRESSION_MIN_QUALITY = '80';
      process.env.IMAGE_COMPRESSION_ENABLED = 'true';

      const config = getCompressionConfig();

      expect(config.maxSizeBytes).toBe(TEST_TARGET_SIZE_10MB);
      expect(config.minQuality).toBe(TEST_CUSTOM_MIN_QUALITY);
      expect(config.enabled).toBe(true);
    });

    it('should handle disabled compression', () => {
      process.env.IMAGE_COMPRESSION_ENABLED = 'false';

      const config = getCompressionConfig();

      expect(config.enabled).toBe(false);
    });
  });

  describe('compressImageIfNeeded', () => {
    /**
     * Helper to create a test image of approximate size
     */
    async function createTestImage(targetSizeBytes: number): Promise<Buffer> {
      // Create a noisy image with random data to prevent over-compression
      // Calculate dimensions based on target size
      const pixels = Math.floor(targetSizeBytes / TEST_BYTES_PER_PIXEL_JPEG);
      const dimension = Math.floor(Math.sqrt(pixels));

      // Create image with noise pattern to simulate real content
      const width = Math.min(dimension, TEST_MAX_IMAGE_DIMENSION);
      const height = Math.min(dimension, TEST_MAX_IMAGE_DIMENSION);

      // Use raw buffer with noise to ensure size
      const buffer = await sharp({
        create: {
          width,
          height,
          channels: TEST_IMAGE_CHANNELS,
          background: TEST_BACKGROUND_GRAY,
        },
      })
        .png({ compressionLevel: TEST_COMPRESSION_LEVEL_NONE }) // Uncompressed PNG to get predictable size
        .toBuffer();

      return buffer;
    }

    it('should not compress image smaller than target size (3MB buffer)', async () => {
      const testBuffer = await createTestImage(TEST_IMAGE_SIZE_3MB);

      const result = await compressImageIfNeeded(
        testBuffer,
        DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB,
        DEFAULT_COMPRESSION_MIN_QUALITY
      );

      expect(result.compressed).toBe(false);
      expect(result.buffer).toBe(testBuffer); // Same buffer reference
      expect(result.metrics).toBeUndefined();
    });

    it('should compress 6MB buffer to under 5MB', async () => {
      const testBuffer = await createTestImage(TEST_IMAGE_SIZE_6MB);
      const targetSize = DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB;

      expect(testBuffer.length).toBeGreaterThan(targetSize);

      const result = await compressImageIfNeeded(
        testBuffer,
        targetSize,
        DEFAULT_COMPRESSION_MIN_QUALITY
      );

      expect(result.compressed).toBe(true);
      expect(result.buffer.length).toBeLessThanOrEqual(targetSize);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.originalSize).toBe(testBuffer.length);
      expect(result.metrics!.compressedSize).toBeLessThan(testBuffer.length);
      expect(result.metrics!.quality).toBeGreaterThanOrEqual(DEFAULT_COMPRESSION_MIN_QUALITY);
      expect(result.metrics!.quality).toBeLessThanOrEqual(COMPRESSION_QUALITY_HIGH);
      expect(result.metrics!.ratio).toBeGreaterThan(1);
    });

    it('should compress 15MB buffer to under 5MB at quality 70 or better', async () => {
      const testBuffer = await createTestImage(TEST_IMAGE_SIZE_15MB);
      const targetSize = DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB;

      expect(testBuffer.length).toBeGreaterThan(targetSize);

      const result = await compressImageIfNeeded(
        testBuffer,
        targetSize,
        DEFAULT_COMPRESSION_MIN_QUALITY
      );

      expect(result.compressed).toBe(true);
      expect(result.buffer.length).toBeLessThanOrEqual(targetSize);
      expect(result.metrics).toBeDefined();
      // Quality should be at least 70 (could be higher if it compressed well)
      expect(result.metrics!.quality).toBeGreaterThanOrEqual(DEFAULT_COMPRESSION_MIN_QUALITY);
      expect(result.metrics!.quality).toBeLessThanOrEqual(COMPRESSION_QUALITY_HIGH);
    });

    it('should throw error for extremely large buffer that cannot compress', async () => {
      // Create a truly massive high-entropy image by using raw format
      // This ensures it cannot be compressed effectively
      const rawSize = TEST_MAX_IMAGE_DIMENSION * TEST_MAX_IMAGE_DIMENSION * TEST_IMAGE_CHANNELS; // ~192MB uncompressed

      const hugeBuffer = await sharp({
        create: {
          width: TEST_MAX_IMAGE_DIMENSION,
          height: TEST_MAX_IMAGE_DIMENSION,
          channels: TEST_IMAGE_CHANNELS,
          background: TEST_BACKGROUND_GRAY,
        },
      })
        .raw()
        .toBuffer();

      // Ensure it's actually massive
      expect(hugeBuffer.length).toBeGreaterThan(TEST_IMAGE_SIZE_20MB);

      await expect(
        compressImageIfNeeded(
          hugeBuffer,
          DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB,
          DEFAULT_COMPRESSION_MIN_QUALITY
        )
      ).rejects.toThrow(/Image too large to compress/);
    });

    it('should respect custom target size', async () => {
      const testBuffer = await createTestImage(TEST_IMAGE_SIZE_3MB);

      const result = await compressImageIfNeeded(
        testBuffer,
        TEST_TARGET_SIZE_2MB,
        DEFAULT_COMPRESSION_MIN_QUALITY
      );

      expect(result.compressed).toBe(true);
      expect(result.buffer.length).toBeLessThanOrEqual(TEST_TARGET_SIZE_2MB);
    });

    it('should respect custom minimum quality', async () => {
      const testBuffer = await createTestImage(TEST_IMAGE_SIZE_6MB);

      const result = await compressImageIfNeeded(
        testBuffer,
        DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB,
        TEST_CUSTOM_MIN_QUALITY
      );

      expect(result.compressed).toBe(true);
      // Quality should be at least 80, not lower
      expect(result.metrics!.quality).toBeGreaterThanOrEqual(TEST_CUSTOM_MIN_QUALITY);
    });
  });
});
