#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { processHandwrittenImage } from './ocr';
import { summarizeText } from './summarize';
import { validateOCROutput, formatValidationReport, correctOCRIssues, getCorrectionConfig, type ValidationReport } from './ocrValidator';

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
    // Read the image
    const imageBuffer = await fs.readFile(imagePath);

    // Perform OCR
    console.log('🔍 Running OCR...');
    const ocrResult = await processHandwrittenImage(imageBuffer, path.basename(imagePath));

    if (!ocrResult) {
      console.error('❌ OCR failed - no transcription returned');
      process.exit(1);
    }

    const { text: transcription, modelUsed } = ocrResult;

    // Optional validation
    let validationReport: ValidationReport | null = null;
    let finalTranscription = transcription;

    if (shouldValidate) {
      console.log('🔍 Validating OCR quality...');
      validationReport = await validateOCROutput(transcription);

      console.log(`📊 Quality Score: ${(validationReport.overallConfidence * 100).toFixed(0)}%`);

      if (validationReport.issueCount.critical > 0) {
        console.log(`⚠️  Found ${validationReport.issueCount.critical} critical issues`);
      }

      if (validationReport.recommendation === 'manual-transcribe') {
        console.log('❌ Recommendation: Consider manual re-transcription');
      } else if (validationReport.recommendation === 'review') {
        console.log('⚠️  Recommendation: Review flagged issues');
      } else {
        console.log('✅ Recommendation: Quality acceptable, proceed');
      }
      console.log('');
    }

    // Optional multi-pass correction
    if (shouldCorrect && validationReport?.hasIssues) {
      console.log('🔧 Applying multi-pass corrections...');

      const correctionConfig = await getCorrectionConfig();
      const correctionResult = await correctOCRIssues(
        finalTranscription,
        imageBuffer,
        validationReport,
        correctionConfig
      );

      finalTranscription = correctionResult.correctedText;

      if (correctionResult.correctionCount > 0) {
        console.log(`✅ Applied ${correctionResult.correctionCount} corrections:`);
        correctionResult.corrections.forEach((c, i) => {
          console.log(`  ${i + 1}. "${c.originalPhrase}" → "${c.correctedPhrase}"`);
        });

        // Append correction log to validation report
        if (validationReport) {
          validationReport.correctionLog = correctionResult.corrections;
        }
      } else {
        console.log('ℹ️  No corrections applied');
      }
      console.log('');
    }

    // Prepare output paths
    const folder = path.dirname(imagePath);
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const ocrOutputPath = path.join(folder, `${baseName}.md`);
    const summaryOutputPath = path.join(folder, `${baseName} - Summary and Actions.md`);

    // Write OCR output with optional validation report
    const summaryLink = skipSummary ? '' : `[[${baseName} - Summary and Actions.md]] | `;
    let ocrContent = `${summaryLink}[[${path.basename(imagePath)}]]\n\`\`\`markdown\n${finalTranscription}\n\`\`\``;

    if (validationReport?.hasIssues) {
      ocrContent += '\n\n---\n\n## OCR Validation Report\n\n';
      ocrContent += `**Model Used**: ${modelUsed}\n\n`;
      ocrContent += formatValidationReport(validationReport);
    }

    await fs.writeFile(ocrOutputPath, ocrContent);
    console.log(`✅ OCR output: ${ocrOutputPath}`);

    // Generate summary if not skipped and quality acceptable
    const qualityTooLow = validationReport && validationReport.overallConfidence < 0.5;

    if (!skipSummary && !qualityTooLow) {
      console.log('📝 Generating summary...');
      const summary = await summarizeText(transcription);

      if (summary && summary !== 'no summary') {
        const summaryContent = `[[${baseName}.md]] | [[${path.basename(imagePath)}]]\n${summary}`;
        await fs.writeFile(summaryOutputPath, summaryContent);
        console.log(`✅ Summary output: ${summaryOutputPath}`);
      } else {
        console.log('⚠️  Summary generation skipped (no content or error)');
      }
    } else if (qualityTooLow) {
      console.log('⏭ Skipping summarization (OCR quality too low)');
    }

    console.log('');
    console.log('✨ Done!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertSingleImage();
