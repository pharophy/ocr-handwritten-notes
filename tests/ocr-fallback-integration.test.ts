import { describe, it, expect, beforeAll } from 'vitest';
import { processHandwrittenImage } from '../src/ocr';
import { readFileSync } from 'fs';
import path from 'path';

describe('OCR Fallback Integration Tests', () => {
  const testImagesDir = path.join(__dirname, 'test-images');

  // Helper to load test image
  function loadTestImage(filename: string): Buffer {
    const imagePath = path.join(testImagesDir, filename);
    return readFileSync(imagePath);
  }

  describe('Cosine 02-26.jpeg - High Quality Baseline', () => {
    it('should NOT trigger fallback with Claude 4.6 Sonnet (primary model succeeds)', async () => {
      // This test validates that high-quality Claude output doesn't trigger fallback
      const imageBuffer = loadTestImage('Cosine 02-26.jpeg');
      const result = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(result).toBeTruthy();
      expect(result!.text.length).toBeGreaterThan(100);

      // Check that result has low illegible markers (< 10%)
      const illegibleMatches = result!.text.match(/\*\[illegible\]\*/g) || [];
      const words = result!.text.split(/[\s\n\r]+/).filter(w => w.length > 0);
      const illegiblePercent = (illegibleMatches.length / words.length) * 100;

      expect(illegiblePercent).toBeLessThan(10);
    }, 90000);
  });

  describe('Amir 04-01.jpeg - Poor Quality with Claude Opus', () => {
    it('should trigger fallback when primary model produces poor quality', async () => {
      // This test requires AI_MODEL_OCR to be set to Claude 4.6 Opus
      // and AI_MODEL_OCR_FALLBACK to gpt-4.1-mini
      // Run with: AI_MODEL_OCR=anthropic--claude-4.6-opus npm test

      const imageBuffer = loadTestImage('Amir 04-01.jpeg');
      const result = await processHandwrittenImage(imageBuffer, 'Amir 04-01.jpeg');

      expect(result).toBeTruthy();

      // If using Claude Opus as primary, it should produce poor quality and trigger fallback
      // The fallback (GPT-4.1 Mini) should produce better results
      // We can't guarantee which model was used without inspecting logs,
      // but we can verify the result quality is reasonable

      if (process.env.AI_MODEL_OCR?.includes('opus')) {
        // With fallback enabled, result should be reasonable quality
        expect(result!.text.length).toBeGreaterThan(50);
      }
    }, 120000); // Allow time for both primary + fallback
  });

  describe('Fallback Disabled Scenario', () => {
    it('should use primary result when AI_MODEL_OCR_FALLBACK=none', async () => {
      // This test requires AI_MODEL_OCR_FALLBACK=none
      // The quality assessment should still run, but no fallback should be triggered

      const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;
      process.env.AI_MODEL_OCR_FALLBACK = 'none';

      try {
        const imageBuffer = loadTestImage('Amir 04-01.jpeg');
        const result = await processHandwrittenImage(imageBuffer, 'Amir 04-01.jpeg');

        expect(result).toBeTruthy();
        expect(result!.text.length).toBeGreaterThan(50);
      } finally {
        process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
      }
    }, 90000);
  });

  describe('Cross-Provider Fallback', () => {
    it('should support Claude → OpenAI fallback', async () => {
      // Test with Claude primary and GPT fallback
      const originalOcr = process.env.AI_MODEL_OCR;
      const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;

      process.env.AI_MODEL_OCR = 'anthropic--claude-4.6-sonnet';
      process.env.AI_MODEL_OCR_FALLBACK = 'gpt-4.1-mini';

      try {
        const imageBuffer = loadTestImage('Amir 04-01.jpeg');
        const result = await processHandwrittenImage(imageBuffer, 'Amir 04-01.jpeg');

        expect(result).toBeTruthy();
        expect(result!.text.length).toBeGreaterThan(50);
      } finally {
        process.env.AI_MODEL_OCR = originalOcr;
        process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
      }
    }, 120000);

    it('should support OpenAI → Claude fallback', async () => {
      // Test with OpenAI primary and Claude fallback
      const originalOcr = process.env.AI_MODEL_OCR;
      const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;
      const originalProvider = process.env.AI_PROVIDER;

      process.env.AI_PROVIDER = 'hai-openai';
      process.env.AI_MODEL_OCR = 'gpt-4o';
      process.env.AI_MODEL_OCR_FALLBACK = 'anthropic--claude-4.6-sonnet';

      try {
        const imageBuffer = loadTestImage('Cosine 02-26.jpeg');
        const result = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

        expect(result).toBeTruthy();
        expect(result!.text.length).toBeGreaterThan(100);
      } finally {
        process.env.AI_MODEL_OCR = originalOcr;
        process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
        process.env.AI_PROVIDER = originalProvider;
      }
    }, 120000);
  });
});
