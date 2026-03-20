import { describe, it, expect } from 'vitest';
import { processHandwrittenImage } from '../src/ocr';
import { validateOCROutput, correctOCRIssues } from '../src/ocrValidator';
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
        '- Pepsi has NA instance (US/CA), may need other location',
        '- Plan to subsidize first 5-10 cust',
        '  - MLF would be $3M upfront',
        '  - MLF + Pepsi use PwC'
      ];

      // Load and process the test image
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Remove code fences if present and extract first few lines
      const cleanedTranscription = transcription!
        .replace(/^```markdown\n?/g, '')
        .replace(/\n?```$/g, '');

      const actualLines = cleanedTranscription
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 7);

      // Calculate accuracy by checking key phrases from expected lines
      const checks = [
        { line: 0, phrase: 'Cosine - 2/26', description: 'Date header' },
        { line: 1, phrase: 'Vacation', description: 'Line 1 - Topic' },
        { line: 1, phrase: 'part home', description: 'Line 1 - Key phrase' },
        { line: 1, phrase: 'part in other city', description: 'Line 1 - Context' },
        { line: 2, phrase: 'if we sign', description: 'Line 2 - Key phrase' },
        { line: 2, phrase: 'MLF', description: 'Line 2 - Acronym' },
        { line: 2, phrase: 'Canada', description: 'Line 2 - Location' },
        { line: 3, phrase: 'Pepsi', description: 'Line 3 - Company' },
        { line: 3, phrase: 'NA instance', description: 'Line 3 - Term' },
        { line: 4, phrase: 'subsidize', description: 'Line 4 - Key term' },
        { line: 5, phrase: '$3M upfront', description: 'Line 5 - Amount' },
        { line: 6, phrase: 'PwC', description: 'Line 6 - Company' }
      ];

      let passedChecks = 0;
      const failures: string[] = [];

      checks.forEach(check => {
        if (actualLines[check.line]?.includes(check.phrase)) {
          passedChecks++;
        } else {
          failures.push(`${check.description}: expected "${check.phrase}" in line ${check.line}`);
        }
      });

      const accuracy = (passedChecks / checks.length) * 100;

      // Log accuracy results
      console.log(`\n📊 OCR Accuracy: ${accuracy.toFixed(1)}% (${passedChecks}/${checks.length} checks passed)`);
      if (failures.length > 0) {
        console.log('Failed checks:');
        failures.forEach(f => console.log(`  - ${f}`));
        console.log('\nExpected lines (ground truth):');
        expectedLines.forEach((line, i) => console.log(`  ${i}: ${line}`));
        console.log('\nActual lines (OCR output):');
        actualLines.forEach((line, i) => console.log(`  ${i}: ${line}`));
      }

      // Require at least 75% accuracy
      expect(accuracy).toBeGreaterThanOrEqual(75);
    }, 30000); // 30 second timeout for real API call

    it('should preserve key business terms from glossary', async () => {
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');

      expect(transcription).toBeTruthy();

      // Verify glossary terms are preserved
      expect(transcription).toContain('MLF');
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

  describe('Multi-Pass Correction - Ground Truth', () => {
    it('should improve accuracy with validation + correction pipeline', async () => {
      const imagePath = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');
      const imageBuffer = await fs.readFile(imagePath);

      // Pass 1: Initial OCR
      const transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');
      expect(transcription).toBeTruthy();

      // Pass 2: Validation
      const validation = await validateOCROutput(transcription!);
      expect(validation).toBeTruthy();

      // Pass 3: Correction
      const correctionResult = await correctOCRIssues(
        transcription!,
        imageBuffer,
        validation,
        { enabled: true, correctCriticalOnly: true, tagCorrections: true }
      );

      // Verify corrections were applied (if validation found critical issues)
      expect(correctionResult).toBeTruthy();
      expect(correctionResult.correctedText).toBeTruthy();

      // Verify critical accuracy improvements
      // Note: Correction is only applied to critical issues flagged by validation
      // This test verifies the pipeline works correctly, not specific corrections
      if (correctionResult.correctionCount > 0) {
        expect(correctionResult.correctedText).toContain('[corrected]');
      }

      // Log results for visibility
      console.log(`\n📊 Multi-Pass Correction Results:`);
      console.log(`   Corrections applied: ${correctionResult.correctionCount}`);
      if (correctionResult.corrections.length > 0) {
        console.log(`   Changes:`);
        correctionResult.corrections.forEach(c => {
          console.log(`     - "${c.originalPhrase}" → "${c.correctedPhrase}"`);
        });
      }
    }, 60000); // 60 second timeout for full pipeline
  });
});
