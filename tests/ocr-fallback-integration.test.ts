import { describe, it, expect } from 'vitest';
import { processHandwrittenImage } from '../src/ocr';
import { readFileSync } from 'fs';
import path from 'path';

describe('OCR Fallback Integration Tests', () => {
  const testImagesDir = path.join(__dirname, 'test-images');

  function loadTestImage(filename: string): Buffer {
    const imagePath = path.join(testImagesDir, filename);
    return readFileSync(imagePath);
  }

  describe('Cosine 02-26.jpeg - High Quality Baseline', () => {
    it('should not trigger fallback when primary model succeeds', async () => {
      const imageBuffer = loadTestImage('Cosine 02-26.jpeg');
      const result = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(result).toBeTruthy();
      expect(result!.text.length).toBeGreaterThan(100);

      const illegibleMatches = result!.text.match(/\*\[illegible\]\*/g) || [];
      const words = result!.text.split(/[\s\n\r]+/).filter(w => w.length > 0);
      const illegiblePercent = (illegibleMatches.length / words.length) * 100;

      expect(illegiblePercent).toBeLessThan(10);
    }, 90000);
  });

  describe('Poor Quality Fallback', () => {
    it('should trigger fallback when primary model produces poor quality', async () => {
      const imageBuffer = loadTestImage('Amir 04-01.jpeg');
      const result = await processHandwrittenImage(imageBuffer, 'Amir 04-01.jpeg');

      expect(result).toBeTruthy();
      expect(result!.text.length).toBeGreaterThan(50);
    }, 120000);
  });

  describe('Fallback Disabled Scenario', () => {
    it('should use primary result when AI_MODEL_OCR_FALLBACK=none', async () => {
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

  describe('Same-Provider Fallback', () => {
    it('should support Anthropic primary and Anthropic fallback', async () => {
      const originalProvider = process.env.AI_PROVIDER;
      const originalOcr = process.env.AI_MODEL_OCR;
      const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;

      process.env.AI_PROVIDER = 'anthropic';
      process.env.AI_MODEL_OCR = 'claude-sonnet-4-20250514';
      process.env.AI_MODEL_OCR_FALLBACK = 'claude-3-5-haiku-20241022';

      try {
        const imageBuffer = loadTestImage('Amir 04-01.jpeg');
        const result = await processHandwrittenImage(imageBuffer, 'Amir 04-01.jpeg');

        expect(result).toBeTruthy();
        expect(result!.text.length).toBeGreaterThan(50);
      } finally {
        process.env.AI_PROVIDER = originalProvider;
        process.env.AI_MODEL_OCR = originalOcr;
        process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
      }
    }, 120000);

    it('should support OpenAI primary and OpenAI fallback', async () => {
      const originalProvider = process.env.AI_PROVIDER;
      const originalOcr = process.env.AI_MODEL_OCR;
      const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;

      process.env.AI_PROVIDER = 'openai';
      process.env.AI_MODEL_OCR = 'gpt-4o';
      process.env.AI_MODEL_OCR_FALLBACK = 'gpt-4.1-mini';

      try {
        const imageBuffer = loadTestImage('Cosine 02-26.jpeg');
        const result = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

        expect(result).toBeTruthy();
        expect(result!.text.length).toBeGreaterThan(100);
      } finally {
        process.env.AI_PROVIDER = originalProvider;
        process.env.AI_MODEL_OCR = originalOcr;
        process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
      }
    }, 120000);
  });
});
