import fs from 'fs/promises';
import path from 'path';
import { processHandwrittenImage, CONFIDENCE_TO_PERCENT, PERCENT_WHOLE_NUMBER } from './ocr';
import { summarizeText, summaryInputFrom } from './summarize';
import {
  validateOCROutput,
  formatValidationReport,
  getValidationConfig,
  correctOCRIssues,
  getCorrectionConfig,
  type ValidationReport,
} from './ocrValidator';

/**
 * The single image → transcription → validation → correction → summary path,
 * shared by the batch run (src/main.ts) and single-file conversion
 * (src/convert-single.ts) so both write identical files.
 */

export interface PipelineOptions {
  /** 'config' follows handwriting-reference.json ocrValidation.enabled; 'on'/'off' force it. */
  validation: 'config' | 'on' | 'off';
  /** Run correction when validation found issues (still subject to ocrCorrection.mode). */
  correction: boolean;
  /** Write a summary file (also skipped for '_nosum' files and very low validation confidence). */
  summarize: boolean;
}

export interface PipelineResult {
  ocrPath: string;
  summaryPath?: string;
  modelUsed: string;
  correctionCount: number;
  validationReport: ValidationReport | null;
}

export function outputPaths(imagePath: string): { folder: string; baseName: string; imageName: string; ocrPath: string; summaryPath: string } {
  const folder = path.dirname(imagePath);
  const imageName = path.basename(imagePath);
  const baseName = path.basename(imagePath, path.extname(imagePath));
  return {
    folder,
    baseName,
    imageName,
    ocrPath: path.join(folder, `${baseName}.md`),
    summaryPath: path.join(folder, `${baseName} - Summary and Actions.md`),
  };
}

/** First line of the transcription file. Markdown links omit `.md`; the image keeps its extension. */
export function ocrFileHeader(baseName: string, imageName: string, withSummaryLink: boolean): string {
  return withSummaryLink ? `[[${baseName} - Summary and Actions]] | [[${imageName}]]` : `[[${imageName}]]`;
}

/** First line of the summary file. */
export function summaryFileHeader(baseName: string, imageName: string): string {
  return `[[${baseName}]] | [[${imageName}]]`;
}

export async function processImageFile(imagePath: string, options: PipelineOptions): Promise<PipelineResult | null> {
  const { baseName, imageName, ocrPath, summaryPath } = outputPaths(imagePath);
  const buffer = await fs.readFile(imagePath);

  const ocrResult = await processHandwrittenImage(buffer, imageName);
  if (!ocrResult) return null;

  const validationConfig = await getValidationConfig();
  const shouldValidate = options.validation === 'on' || (options.validation === 'config' && validationConfig.enabled);

  let validationReport: ValidationReport | null = null;
  if (shouldValidate) {
    validationReport = await validateOCROutput(ocrResult.text, { ...validationConfig, enabled: true });
    const pct = (validationReport.overallConfidence * CONFIDENCE_TO_PERCENT).toFixed(PERCENT_WHOLE_NUMBER);
    if (validationReport.recommendation === 'manual-transcribe') {
      console.log(`⚠️  ${imageName} - Low quality (${pct}%), review recommended`);
    } else if (validationReport.issueCount.critical > 0) {
      console.log(`⚠️  ${imageName} - ${validationReport.issueCount.critical} critical issues`);
    }
  }

  let finalText = ocrResult.text;
  let correctionCount = 0;
  if (options.correction && validationReport?.hasIssues) {
    const correctionConfig = await getCorrectionConfig();
    const correctionResult = await correctOCRIssues(finalText, buffer, validationReport, correctionConfig, {
      segmentTexts: ocrResult.segmentTexts,
    });
    finalText = correctionResult.correctedText;
    correctionCount = correctionResult.correctionCount;
    if (correctionCount > 0) {
      console.log(`  🔧 ${imageName}: ${correctionCount} corrections applied`);
      correctionResult.corrections.forEach((c, i) => console.log(`    ${i + 1}. "${c.originalPhrase}" → "${c.correctedPhrase}"`));
    }
    if (correctionResult.corrections.length > 0 && validationConfig.appendReportOnIssues) {
      validationReport.correctionLog = correctionResult.corrections;
    }
  }

  const wantsSummary = options.summarize && !baseName.includes('_nosum');

  let ocrContent = `${ocrFileHeader(baseName, imageName, wantsSummary)}\n${finalText}`;
  if (validationReport?.hasIssues && validationConfig.appendReportOnIssues) {
    ocrContent += '\n\n---\n\n## OCR Validation Report\n\n';
    ocrContent += `**Model Used**: ${ocrResult.modelUsed}\n\n`;
    ocrContent += formatValidationReport(validationReport);
  }
  await fs.writeFile(ocrPath, ocrContent, 'utf8');

  const confidentEnough = !validationReport || validationReport.overallConfidence >= validationConfig.skipSummarizationThreshold;
  let writtenSummaryPath: string | undefined;
  if (wantsSummary && confidentEnough) {
    // Summaries are built from the final transcription only: never the link line,
    // the validation report, the correction log, struck text or the warning callout.
    const summary = await summarizeText(summaryInputFrom(finalText));
    if (summary && summary !== 'no summary') {
      await fs.writeFile(summaryPath, `${summaryFileHeader(baseName, imageName)}\n${summary}`, 'utf8');
      writtenSummaryPath = summaryPath;
    }
  } else if (wantsSummary) {
    console.log(`⏭ Skipping summarization for ${imageName} (OCR quality too low)`);
  }

  return { ocrPath, summaryPath: writtenSummaryPath, modelUsed: ocrResult.modelUsed, correctionCount, validationReport };
}
