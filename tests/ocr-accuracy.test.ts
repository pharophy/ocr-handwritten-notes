import { describe, it, expect } from 'vitest';
import { processHandwrittenImage } from '../src/ocr';
import fs from 'fs/promises';
import path from 'path';

/**
 * OCR Accuracy Tests - Ground Truth Validation
 *
 * These tests verify OCR accuracy against manually verified transcriptions.
 * If tests fail, it indicates a regression in OCR quality.
 *
 * NOTE: These are integration tests that make real API calls.
 * They require OPENAI_API_KEY to be set and will take ~5-10 seconds per test.
 */
describe('OCR Accuracy - Ground Truth Validation', () => {
  describe('Cosine 02-26 - Opening Lines', () => {
    it('should accurately transcribe the first few lines', async () => {
      // Ground truth - manually verified correct transcription
      const expectedLines = [
        'Cosine - 2/26',
        '- Vacation - part home, part in other city',
        '- if we sign MLF, may to go Canada, then change to US high',
        '- Pepsico has NA instance (US/CA), may need other location',
        '- Plan to subsidize first 5-10 cust',
        '  - MLF would be $3M upfront',
        '  - MLF + Pepsi use PwC'
      ];

      // Load and process the test image
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Extract first few lines from transcription
      const actualLines = transcription!
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 7);

      // Validate each line matches ground truth
      expect(actualLines[0]).toContain('Cosine - 2/26');
      expect(actualLines[1]).toContain('Vacation');
      expect(actualLines[1]).toContain('part home');
      expect(actualLines[1]).toContain('part in other city');

      expect(actualLines[2]).toContain('if we sign MLF');
      expect(actualLines[2]).toContain('Canada');
      expect(actualLines[2]).toContain('US high');

      expect(actualLines[3]).toContain('Pepsico');
      expect(actualLines[3]).toContain('NA instance');
      expect(actualLines[3]).toContain('US/CA');

      expect(actualLines[4]).toContain('Plan to subsidize');
      expect(actualLines[4]).toContain('5-10 cust');

      expect(actualLines[5]).toContain('MLF would be');
      expect(actualLines[5]).toContain('$3M upfront');

      expect(actualLines[6]).toContain('MLF + Pepsi');
      expect(actualLines[6]).toContain('PwC');
    }, 30000); // 30 second timeout for real API call

    it('should preserve key business terms from glossary', async () => {
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Verify glossary terms are preserved
      expect(transcription).toContain('MLF');
      expect(transcription).toContain('Pepsico');
      expect(transcription).toContain('Canada');
      expect(transcription).toContain('NA instance');
      expect(transcription).toContain('US/CA');
      expect(transcription).toContain('PwC');
    }, 30000);

    it('should use correct special notation', async () => {
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Verify arrows are correctly rendered
      expect(transcription).toContain('→');
      // Should not contain malformed arrows
      expect(transcription).not.toContain('â');
    }, 30000);
  });

  describe('OCR Quality Benchmarks', () => {
    it('should meet minimum accuracy thresholds for Cosine 02-26', async () => {
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Key phrases that must be present
      const requiredPhrases = [
        'Vacation',
        'part home',
        'MLF',
        'Canada',
        'Pepsico',
        'NA instance',
        'subsidize',
        '$3M upfront',
        'PwC'
      ];

      requiredPhrases.forEach(phrase => {
        expect(transcription).toContain(phrase);
      });
    }, 30000);
  });
});
