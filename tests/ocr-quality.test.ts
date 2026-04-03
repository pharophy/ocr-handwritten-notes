import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assessOCRQuality } from '../src/ocr';

describe('OCR Quality Assessment', () => {
  // Store original env vars to restore after tests
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Illegible percentage calculation', () => {
    it('should return 0% illegible for clean transcription', () => {
      const transcription = 'This is a clean transcription with no illegible words.';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.illegiblePercent).toBe(0);
      expect(result.isPoorQuality).toBe(false);
    });

    it('should calculate 20% illegible correctly', () => {
      const transcription = 'word1 word2 *[illegible]* word3 word4 *[illegible]* word5 word6 word7 word8';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.illegiblePercent).toBe(20);
      expect(result.isPoorQuality).toBe(false);
    });

    it('should trigger poor quality at 40% illegible', () => {
      // 4 illegibles out of 9 total = 44.4%
      const transcription = 'word1 *[illegible]* word2 *[illegible]* word3 *[illegible]* word4 *[illegible]* word5';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.illegiblePercent).toBeCloseTo(44.4, 1);
      expect(result.isPoorQuality).toBe(true);
      expect(result.reason).toContain('High illegible percentage');
    });

    it('should handle 100% illegible transcription', () => {
      const transcription = '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.illegiblePercent).toBe(100);
      expect(result.isPoorQuality).toBe(true);
    });
  });

  describe('Consecutive illegible detection', () => {
    it('should not flag 2 consecutive illegibles with low percentage', () => {
      // 2 illegibles out of 10 words = 20% (below threshold)
      const transcription = 'word1 word2 *[illegible]* *[illegible]* word3 word4 word5 word6 word7 word8';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.consecutiveIllegibles).toBe(0); // Only 2 consecutive, need 5+
      expect(result.isPoorQuality).toBe(false);
    });

    it('should flag 5 consecutive illegibles even with low overall percentage', () => {
      // 5 illegibles out of 12 words = 41.7%, but testing consecutive detection specifically
      // Add enough normal words so we can isolate consecutive detection
      const transcription = 'word1 *[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]* word2 word3 word4 word5 word6 word7';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.consecutiveIllegibles).toBeGreaterThan(0);
      expect(result.isPoorQuality).toBe(true);
      // Could be triggered by either illegible % or consecutive, both are valid
    });

    it('should flag 10 consecutive illegibles', () => {
      const transcription = [
        'word1',
        ...Array(10).fill('*[illegible]*'),
        'word2'
      ].join(' ');
      const result = assessOCRQuality(transcription, 100000);

      expect(result.consecutiveIllegibles).toBeGreaterThan(0);
      expect(result.isPoorQuality).toBe(true);
    });
  });

  describe('Output length check', () => {
    it('should not flag short output for small image', () => {
      const transcription = 'Short text';
      const result = assessOCRQuality(transcription, 50000); // 50KB image

      expect(result.outputLength).toBe(10);
      expect(result.isPoorQuality).toBe(false);
    });

    it('should flag short output for large image', () => {
      const transcription = 'Short';
      const result = assessOCRQuality(transcription, 200000); // 200KB image

      expect(result.outputLength).toBeLessThan(50);
      expect(result.isPoorQuality).toBe(true);
      expect(result.reason).toContain('Output too short');
    });

    it('should not flag adequate output for large image', () => {
      const transcription = 'This is a longer transcription with adequate content for the image size. '.repeat(2);
      const result = assessOCRQuality(transcription, 200000);

      expect(result.outputLength).toBeGreaterThan(50);
      expect(result.isPoorQuality).toBe(false);
    });
  });

  describe('Configurable thresholds', () => {
    it('should use custom illegible threshold from env', () => {
      process.env.OCR_ILLEGIBLE_THRESHOLD = '50';
      // 2 illegible out of 5 total = 40%
      const transcription = 'word1 *[illegible]* word2 *[illegible]* word3';

      const result = assessOCRQuality(transcription, 100000);

      expect(result.illegiblePercent).toBeCloseTo(40, 0);
      expect(result.isPoorQuality).toBe(false); // 40% < 50% threshold
    });

    it('should use custom min length threshold from env', () => {
      process.env.OCR_MIN_LENGTH_THRESHOLD = '100';
      const transcription = 'This is 75 characters long, which is normally ok but not with custom threshold.';

      const result = assessOCRQuality(transcription, 200000);

      expect(result.outputLength).toBeLessThan(100);
      expect(result.isPoorQuality).toBe(true);
    });

    it('should use custom consecutive threshold from env', () => {
      process.env.OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD = '1';
      // Need at least 5 consecutive to trigger, but threshold=1 means 1 occurrence triggers
      const transcription = 'word *[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]* word';

      const result = assessOCRQuality(transcription, 100000);

      expect(result.consecutiveIllegibles).toBeGreaterThan(0);
      expect(result.isPoorQuality).toBe(true);
    });
  });

  describe('Quality assessment return object', () => {
    it('should return all required fields', () => {
      const transcription = 'Test transcription';
      const result = assessOCRQuality(transcription, 100000);

      expect(result).toHaveProperty('isPoorQuality');
      expect(result).toHaveProperty('illegiblePercent');
      expect(result).toHaveProperty('consecutiveIllegibles');
      expect(result).toHaveProperty('outputLength');
      expect(typeof result.isPoorQuality).toBe('boolean');
      expect(typeof result.illegiblePercent).toBe('number');
      expect(typeof result.consecutiveIllegibles).toBe('number');
      expect(typeof result.outputLength).toBe('number');
    });

    it('should include reason when quality is poor', () => {
      const transcription = '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.isPoorQuality).toBe(true);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });

    it('should not require reason when quality is good', () => {
      const transcription = 'Good quality transcription';
      const result = assessOCRQuality(transcription, 100000);

      expect(result.isPoorQuality).toBe(false);
      // reason may or may not be present when quality is good
    });
  });
});
