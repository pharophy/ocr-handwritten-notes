import fs from 'fs/promises';
import path from 'path';
import { processHandwrittenImage, CONFIDENCE_TO_PERCENT, PERCENT_WHOLE_NUMBER } from './ocr';
import { summarizeText } from './summarize';
import { getAllImageFiles, fileExists } from './utils';
import { validateOCROutput, formatValidationReport, getValidationConfig, correctOCRIssues, getCorrectionConfig, type ValidationReport } from './ocrValidator';
import dotenv from 'dotenv';
dotenv.config();

const MONITORED_FOLDERS = [path.resolve('/Users/I566809/Library/CloudStorage/OneDrive-SAPSE/Notes/ZZ_Raw')];

async function run() {
  for (const folderPath of MONITORED_FOLDERS) {
    const imageFiles = await getAllImageFiles(folderPath);

    for (const imagePath of imageFiles) {
      const baseName = path.basename(imagePath, path.extname(imagePath));
      const folder = path.dirname(imagePath);
      const textFilePath = path.join(folder, `${baseName}.md`);
      const summaryFilePath = path.join(folder, `${baseName} - Summary and Actions.md`);

      if (await fileExists(textFilePath) || await fileExists(summaryFilePath)) {
        console.log(`⏭ Skipping ${imagePath} — already processed.`);
        continue;
      }

      const buffer = await fs.readFile(imagePath);
      const ocrResult = await processHandwrittenImage(buffer, path.basename(imagePath));
      if (!ocrResult) continue;

      const { text: ocrText, modelUsed } = ocrResult;

      // Validate OCR quality
      const validationConfig = await getValidationConfig();
      let validationReport: ValidationReport | null = null;

      if (validationConfig.enabled) {
        validationReport = await validateOCROutput(ocrText, validationConfig);

        // Log validation results
        if (validationReport.recommendation === 'manual-transcribe') {
          console.log(`⚠️  ${path.basename(imagePath)} - Low quality (${(validationReport.overallConfidence * CONFIDENCE_TO_PERCENT).toFixed(PERCENT_WHOLE_NUMBER)}%), review recommended`);
        } else if (validationReport.issueCount.critical > 0) {
          console.log(`⚠️  ${path.basename(imagePath)} - ${validationReport.issueCount.critical} critical issues`);
        }
      }

      // Apply multi-pass correction if validation found critical issues
      let finalText = ocrText;
      if (validationReport?.hasIssues) {
        const correctionConfig = await getCorrectionConfig();

        if (correctionConfig.enabled) {
          const correctionResult = await correctOCRIssues(
            ocrText,
            buffer,
            validationReport,
            correctionConfig
          );

          finalText = correctionResult.correctedText;

          // Log corrections
          if (correctionResult.correctionCount > 0) {
            console.log(`  🔧 ${path.basename(imagePath)}: ${correctionResult.correctionCount} corrections applied`);
          }

          // Append correction log to validation report
          if (correctionResult.corrections.length > 0 && validationConfig.appendReportOnIssues) {
            validationReport.correctionLog = correctionResult.corrections;
          }
        }
      }

      // Build OCR output with optional validation report
      let ocrOutput = `[[${path.basename(summaryFilePath)}]] | [[${path.basename(imagePath)}]]\n${finalText}`;

      if (validationReport?.hasIssues && validationConfig.appendReportOnIssues) {
        ocrOutput += '\n\n---\n\n## OCR Validation Report\n\n';
        ocrOutput += `**Model Used**: ${modelUsed}\n\n`;
        ocrOutput += formatValidationReport(validationReport);
      }

      await fs.writeFile(textFilePath, ocrOutput, 'utf8');

      // Skip summarization if quality too low
      const shouldSummarize = !textFilePath.includes('_nosum') &&
        (!validationReport || validationReport.overallConfidence >= validationConfig.skipSummarizationThreshold);

      if (shouldSummarize) {
        const summary = await summarizeText(ocrOutput);
        const summaryOutput = `[[${path.basename(textFilePath)}]] | [[${path.basename(imagePath)}]]\n${summary}`;
        await fs.writeFile(summaryFilePath, summaryOutput, 'utf8');
      }

      console.log(`✅ Processed ${imagePath}`);
    }
  }
}

run().catch(err => console.error('❌ Error:', err));
