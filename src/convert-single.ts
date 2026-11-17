#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { CONFIDENCE_TO_PERCENT, PERCENT_WHOLE_NUMBER } from './ocr';
import { processImageFile } from './pipeline';

dotenv.config();

/**
 * Convert a single image file to OCR and optionally summarize
 * Usage: npm run convert <image-path> [--no-summary] [--validate] [--correct]
 */
async function convertSingleImage() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run convert <image-path> [--no-summary] [--validate] [--correct]

Converts a single handwritten image to markdown using OCR.

Arguments:
  image-path    Path to the image file (jpg, jpeg, or png)
  --no-summary  Skip generating the summary and actions file
  --validate    Run OCR quality validation and append report
  --correct     Apply multi-pass correction for critical issues (requires --validate)

Examples:
  npm run convert test-images/notes.jpg
  npm run convert test-images/notes.jpg --no-summary
  npm run convert test-images/notes.jpg --validate
  npm run convert test-images/notes.jpg --validate --correct
    `);
    process.exit(0);
  }

  const imagePath = args[0];
  const skipSummary = args.includes('--no-summary');
  const shouldValidate = args.includes('--validate');
  const shouldCorrect = args.includes('--correct');

  // Validate flag dependencies
  if (shouldCorrect && !shouldValidate) {
    console.error('❌ Error: --correct requires --validate flag');
    console.log('Usage: npm run convert <image-path> --validate --correct');
    process.exit(1);
  }

  // Check if file exists
  try {
    await fs.access(imagePath);
  } catch {
    console.error(`❌ Error: File not found: ${imagePath}`);
    process.exit(1);
  }

  // Check if it's an image file
  const ext = path.extname(imagePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    console.error(`❌ Error: Unsupported file type. Use .jpg, .jpeg, or .png`);
    process.exit(1);
  }

  console.log(`📸 Processing: ${imagePath}`);
  console.log('');

  try {
    // Same pipeline as the batch run (src/pipeline.ts), so output files are identical.
    const result = await processImageFile(imagePath, {
      validation: shouldValidate ? 'on' : 'off',
      correction: shouldCorrect,
      summarize: !skipSummary,
    });

    if (!result) {
      console.error('❌ OCR failed - no transcription returned');
      process.exit(1);
    }

    if (result.validationReport) {
      const report = result.validationReport;
      console.log(`📊 Quality Score: ${(report.overallConfidence * CONFIDENCE_TO_PERCENT).toFixed(PERCENT_WHOLE_NUMBER)}%`);
      if (report.recommendation === 'manual-transcribe') {
        console.log('❌ Recommendation: Consider manual re-transcription');
      } else if (report.recommendation === 'review') {
        console.log('⚠️  Recommendation: Review flagged issues');
      } else {
        console.log('✅ Recommendation: Quality acceptable, proceed');
      }
    }

    console.log(`✅ OCR output: ${result.ocrPath}`);
    if (result.summaryPath) {
      console.log(`✅ Summary output: ${result.summaryPath}`);
    } else if (!skipSummary) {
      console.log('⚠️  Summary not written (no content, error, or OCR quality too low)');
    }

    console.log('');
    console.log('✨ Done!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertSingleImage();
