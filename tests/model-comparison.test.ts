import { describe, it, expect, beforeAll } from 'vitest';
import { processHandwrittenImage } from '../src/ocr';
import fs from 'fs/promises';
import path from 'path';

/**
 * Model Comparison Tests
 *
 * Run this with different AI_PROVIDER and AI_MODEL_OCR environment variables
 * to compare accuracy across models.
 */

const TEST_IMAGE = path.resolve(process.cwd(), 'test-images/Cosine 02-26.jpeg');

const GROUND_TRUTH_PHRASES = [
  'Cosine - 2/26',
  'Vacation',
  'part home',
  'MLF',
  'Canada',
  'Pepsi',
  'NA instance',
  'subsidize',
  '$3M upfront',
  'PwC'
];

describe(`Model: ${process.env.AI_PROVIDER}/${process.env.AI_MODEL_OCR}`, () => {
  let imageBuffer: Buffer;
  let transcription: string | null;

  beforeAll(async () => {
    imageBuffer = await fs.readFile(TEST_IMAGE);
  });

  it('should transcribe the test image', async () => {
    transcription = await processHandwrittenImage(imageBuffer, 'Cosine 02-26.jpeg');
    expect(transcription).toBeTruthy();

    console.log('\n' + '='.repeat(70));
    console.log(`Provider: ${process.env.AI_PROVIDER}`);
    console.log(`Model: ${process.env.AI_MODEL_OCR}`);
    console.log('='.repeat(70));
  }, 60000);

  it('should accurately recognize key phrases', async () => {
    expect(transcription).toBeTruthy();

    const cleanedTranscription = transcription!
      .replace(/^```markdown\n?/g, '')
      .replace(/\n?```$/g, '');

    let matchedPhrases = 0;
    const missingPhrases: string[] = [];

    GROUND_TRUTH_PHRASES.forEach(phrase => {
      if (cleanedTranscription.includes(phrase)) {
        matchedPhrases++;
      } else {
        missingPhrases.push(phrase);
      }
    });

    const accuracy = (matchedPhrases / GROUND_TRUTH_PHRASES.length) * 100;

    console.log(`\n📊 Accuracy: ${accuracy.toFixed(1)}% (${matchedPhrases}/${GROUND_TRUTH_PHRASES.length} phrases matched)`);

    if (missingPhrases.length > 0) {
      console.log(`❌ Missing phrases: ${missingPhrases.join(', ')}`);
    }

    // Log first few lines for comparison
    const lines = cleanedTranscription.split('\n').filter(l => l.trim()).slice(0, 10);
    console.log('\n📝 First 10 lines:');
    lines.forEach((line, i) => console.log(`${i + 1}. ${line}`));
    console.log('='.repeat(70) + '\n');

    // Require at least 70% accuracy
    expect(accuracy).toBeGreaterThanOrEqual(70);
  }, 5000);
});
