import { createAIProvider, AIProvider } from './aiProvider';
import { loadHandwritingReference, loadAIProviderConfig, type HandwritingReferenceConfig } from './handwritingReference';
import {
  compressImageIfNeeded,
  getCompressionConfig,
  preprocessImageForOCR,
  segmentImageVertically,
  CONFIDENCE_TO_PERCENT,
  PERCENT_WHOLE_NUMBER,
} from './ocr';

export interface ValidationIssue {
  type: 'grammar' | 'semantics' | 'incomplete' | 'encoding';
  severity: 'critical' | 'warning' | 'info';
  phrase: string;
  location?: string;
  suggestion?: string;
  confidence: number;
}

export interface ValidationReport {
  hasIssues: boolean;
  overallConfidence: number;
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
  issues: ValidationIssue[];
  summary: string;
  recommendation: 'proceed' | 'review' | 'manual-transcribe';
  correctionLog?: CorrectionLog[];
}

export interface ValidationConfig {
  enabled: boolean;
  confidenceThreshold: number;
  skipSummarizationThreshold: number;
  appendReportOnIssues: boolean;
}

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  enabled: true,
  confidenceThreshold: 0.7,
  skipSummarizationThreshold: 0.5,
  appendReportOnIssues: true
};

const VALIDATION_SYSTEM_PROMPT = `You are an OCR quality analyst. Your role is to analyze handwritten note transcriptions and identify quality issues WITHOUT correcting them.

Analyze the provided OCR transcription for:

1. **Grammatical Issues**: Phrases that violate basic grammar rules
   - Example: "use in do to automated effort"
   - Missing articles, incorrect verb forms, word order violations

2. **Semantic Nonsense**: Phrases that are grammatically valid but meaningless
   - Example: "less AI focus not account"
   - Words that don't form coherent meaning together

3. **Incomplete Transcriptions**: Signs of missing words or truncated phrases
   - Example: "but 1 of no familiarise" (appears incomplete)
   - Dangling prepositions, incomplete clauses

4. **Encoding/Character Errors**: Incorrect special characters or symbols
   - Example: Wrong arrow symbols, garbled punctuation
   - Numbers that should be letters or vice versa

For each issue found:
- Identify the problematic phrase (2-8 words of context)
- Classify the issue type
- Assign severity: critical (makes text incomprehensible), warning (questionable but readable), info (minor oddity)
- Estimate confidence (0.0-1.0) in your assessment
- Optionally suggest what the phrase might have intended (if clear from context)

Provide an overall confidence score for the entire transcription (0.0-1.0):
- 0.9-1.0: Excellent quality, no significant issues
- 0.7-0.9: Good quality, minor issues only
- 0.5-0.7: Moderate quality, needs review
- Below 0.5: Poor quality, consider manual re-transcription

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "overallConfidence": 0.85,
  "issues": [
    {
      "type": "grammar",
      "severity": "critical",
      "phrase": "use in do to automated effort",
      "suggestion": "possibly 'use to automate effort'",
      "confidence": 0.9
    }
  ],
  "summary": "Found 1 critical issue affecting comprehension."
}`;

// Cache the AI provider
let cachedProvider: AIProvider | null = null;

export function resetOCRValidatorCacheForTests(): void {
  cachedProvider = null;
}

async function getProvider(): Promise<AIProvider> {
  if (!cachedProvider) {
    const referenceConfig = await loadHandwritingReference();
    const providerConfig = await loadAIProviderConfig(referenceConfig);
    cachedProvider = createAIProvider(providerConfig);
  }
  return cachedProvider;
}

/**
 * Validate OCR output quality using AI analysis
 * Returns structured report with issues, confidence, and recommendations
 * Never returns null - always provides a report (fallback on errors)
 */
export async function validateOCROutput(
  ocrText: string,
  config?: Partial<ValidationConfig>
): Promise<ValidationReport> {
  const finalConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config };

  // Skip validation if disabled
  if (!finalConfig.enabled) {
    return createPassReport();
  }

  // Skip validation if OCR text is empty
  if (!ocrText || ocrText.trim().length === 0) {
    return createPassReport();
  }

  try {
    const provider = await getProvider();

    const prompt = `${VALIDATION_SYSTEM_PROMPT}

Analyze this OCR transcription for quality issues:

"""
${ocrText}
"""

Return your analysis as a JSON object.`;

    const response = await provider.generateTextCompletion(prompt, 'validation');

    const content = response.content;
    if (!content) {
      console.warn('⚠️  Validation returned empty response');
      return createDefaultReport();
    }

    // Strip markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent
        .replace(/^```(?:json)?\n/, '')
        .replace(/\n```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonContent);

    // Build full report from AI response
    const issues: ValidationIssue[] = parsed.issues || [];
    const overallConfidence = parsed.overallConfidence || 0.8;

    const report: ValidationReport = {
      hasIssues: issues.length > 0,
      overallConfidence,
      issueCount: countIssuesBySeverity(issues),
      issues,
      summary: parsed.summary || 'No summary provided',
      recommendation: determineRecommendation(overallConfidence, issues, finalConfig)
    };

    return report;

  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    return createDefaultReport();
  }
}

/**
 * Load validation configuration from handwriting reference
 */
export async function getValidationConfig(): Promise<ValidationConfig> {
  try {
    const reference = await loadHandwritingReference();

    if (!reference.ocrValidation) {
      return DEFAULT_VALIDATION_CONFIG;
    }

    return {
      ...DEFAULT_VALIDATION_CONFIG,
      ...reference.ocrValidation
    };
  } catch {
    return DEFAULT_VALIDATION_CONFIG;
  }
}

/**
 * Format validation report for human-readable markdown output
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push(`**Overall Quality**: ${(report.overallConfidence * CONFIDENCE_TO_PERCENT).toFixed(PERCENT_WHOLE_NUMBER)}%`);
  lines.push(`**Recommendation**: ${report.recommendation}`);
  lines.push('');

  if (report.issues.length === 0) {
    lines.push('✅ No significant issues detected.');
    return lines.join('\n');
  }

  lines.push(`**Issues Found**: ${report.issueCount.critical} critical, ${report.issueCount.warning} warnings, ${report.issueCount.info} info`);
  lines.push('');

  // Group by severity
  const critical = report.issues.filter(i => i.severity === 'critical');
  const warnings = report.issues.filter(i => i.severity === 'warning');
  const info = report.issues.filter(i => i.severity === 'info');

  if (critical.length > 0) {
    lines.push('### Critical Issues');
    critical.forEach(issue => {
      lines.push(`- **"${issue.phrase}"** (${issue.type})`);
      if (issue.suggestion) {
        lines.push(`  - Possible meaning: ${issue.suggestion}`);
      }
      if (issue.location) {
        lines.push(`  - Location: ${issue.location}`);
      }
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('### Warnings');
    warnings.forEach(issue => {
      lines.push(`- "${issue.phrase}" (${issue.type})`);
      if (issue.suggestion) {
        lines.push(`  - Note: ${issue.suggestion}`);
      }
    });
    lines.push('');
  }

  if (info.length > 0) {
    lines.push('### Informational');
    info.forEach(issue => {
      lines.push(`- "${issue.phrase}"`);
    });
  }

  // Add correction log if present
  if (report.correctionLog && report.correctionLog.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(formatCorrectionLog(report.correctionLog));
  }

  return lines.join('\n');
}

/**
 * Count issues by severity level
 */
function countIssuesBySeverity(issues: ValidationIssue[]): ValidationReport['issueCount'] {
  return {
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length
  };
}

/**
 * Determine recommendation based on confidence and issues
 */
function determineRecommendation(
  confidence: number,
  issues: ValidationIssue[],
  config: ValidationConfig
): ValidationReport['recommendation'] {
  if (confidence < config.skipSummarizationThreshold) {
    return 'manual-transcribe';
  }
  if (confidence < config.confidenceThreshold) {
    return 'review';
  }
  if (issues.some(i => i.severity === 'critical')) {
    return 'review';
  }
  return 'proceed';
}

/**
 * Create a passing validation report (used when validation is skipped)
 */
function createPassReport(): ValidationReport {
  return {
    hasIssues: false,
    overallConfidence: 1.0,
    issueCount: { critical: 0, warning: 0, info: 0 },
    issues: [],
    summary: 'Validation skipped',
    recommendation: 'proceed'
  };
}

/**
 * Create a default validation report (used on errors)
 */
function createDefaultReport(): ValidationReport {
  return {
    hasIssues: false,
    overallConfidence: 0.8,
    issueCount: { critical: 0, warning: 0, info: 0 },
    issues: [],
    summary: 'Validation unavailable, assuming moderate quality',
    recommendation: 'proceed'
  };
}

// ============================================================================
// Multi-Pass Correction
// ============================================================================

export interface CorrectionResult {
  correctedText: string;
  corrections: CorrectionLog[];
  correctionCount: number;
}

export interface CorrectionLog {
  originalPhrase: string;
  correctedPhrase: string;
  issueType: string;
  validationNote: string;
  confidence: number;
}

export interface CorrectionConfig {
  enabled: boolean;
  correctCriticalOnly: boolean;
  tagCorrections: boolean;
  maxCorrectionsPerImage: number;
  minIssueConfidence: number;
}

const DEFAULT_CORRECTION_CONFIG: CorrectionConfig = {
  enabled: true,
  correctCriticalOnly: true,
  tagCorrections: true,
  maxCorrectionsPerImage: 10,
  minIssueConfidence: 0.8
};

const CORRECTION_PROMPT_TEMPLATES = {
  grammar: `Previous transcription: "{phrase}"
Validation: grammatically incorrect

Common grammar issues to check:
- Missing words (articles, pronouns, verbs)
- Wrong verb forms
- Word order problems
- Parallel structure breaks

Context:
{context}

{guidance}

Look at the handwriting carefully. Provide only the corrected phrase, no explanation.`,

  semantics: `Previous transcription: "{phrase}"
Validation: semantically unclear or doesn't make sense

Check for:
- Misread business terms
- Company/project names
- Context from surrounding text

Context:
{context}

{guidance}

Does this phrase make sense in a business meeting context?
Look at the handwriting and provide the corrected phrase only.`,

  incomplete: `Previous transcription: "{phrase}"
Validation: appears incomplete or truncated

Context:
{context}

{guidance}

Are there additional words that weren't transcribed?
Look for trailing text and provide the complete phrase.`,

  encoding: `Previous transcription: "{phrase}"
Validation: encoding or character error

Context:
{context}

{guidance}

Check for special characters, symbols, or number/letter confusion.
Provide the corrected phrase with proper characters.`
};

/**
 * Applies multi-pass correction to OCR output based on validation findings
 */
export async function correctOCRIssues(
  originalText: string,
  imageBuffer: Buffer,
  validation: ValidationReport,
  config?: Partial<CorrectionConfig>
): Promise<CorrectionResult> {
  const cfg = { ...DEFAULT_CORRECTION_CONFIG, ...config };

  // Early returns
  if (!cfg.enabled) {
    return { correctedText: originalText, corrections: [], correctionCount: 0 };
  }

  if (!validation.hasIssues) {
    return { correctedText: originalText, corrections: [], correctionCount: 0 };
  }

  // Filter critical issues with high confidence
  let criticalIssues = validation.issues.filter(
    i => i.severity === 'critical' && i.confidence >= cfg.minIssueConfidence
  );

  if (cfg.correctCriticalOnly) {
    criticalIssues = criticalIssues.filter(i => i.severity === 'critical');
  }

  if (criticalIssues.length === 0) {
    return { correctedText: originalText, corrections: [], correctionCount: 0 };
  }

  // Limit corrections per image
  criticalIssues = criticalIssues.slice(0, cfg.maxCorrectionsPerImage);

  let correctedText = originalText;
  const corrections: CorrectionLog[] = [];
  const correctedPhrases = new Set<string>();

  // Load glossary for context hints
  const reference = await loadHandwritingReference();
  const glossary = reference.domainGlossary || {};

  for (const issue of criticalIssues) {
    // Skip if already processed
    if (correctedPhrases.has(issue.phrase)) {
      continue;
    }

    // Check if phrase still exists in text (may have been modified by previous correction)
    if (!correctedText.includes(issue.phrase)) {
      continue;
    }

    // Skip if this phrase has already been corrected (has [corrected] tag)
    if (correctedText.includes(issue.phrase + '[corrected]')) {
      continue;
    }

    try {
      // Extract context
      const context = extractContext(correctedText, issue.phrase);

      // Build correction prompt
      const prompt = buildCorrectionPrompt(issue, context, glossary);

      // Request targeted correction
      const correctedPhrase = await requestPhraseCorrection(imageBuffer, prompt);

      if (correctedPhrase && correctedPhrase !== issue.phrase && correctedPhrase.trim().length > 0) {
        // Tag if enabled
        const replacement = cfg.tagCorrections
          ? `${correctedPhrase}[corrected]`
          : correctedPhrase;

        // Replace first occurrence
        correctedText = correctedText.replace(issue.phrase, replacement);

        // Track that we've processed this phrase
        correctedPhrases.add(issue.phrase);

        // Log correction
        corrections.push({
          originalPhrase: issue.phrase,
          correctedPhrase,
          issueType: issue.type,
          validationNote: issue.suggestion || '',
          confidence: issue.confidence
        });
      }
    } catch (error: any) {
      console.error(`❌ Correction failed for "${issue.phrase}":`, error.message);
      // Continue with other corrections
    }
  }

  return {
    correctedText,
    corrections,
    correctionCount: corrections.length
  };
}

/**
 * Extracts surrounding context for a phrase
 */
function extractContext(text: string, phrase: string, lines: number = 2): string {
  const textLines = text.split('\n');
  const phraseLineIndex = textLines.findIndex(line => line.includes(phrase));

  if (phraseLineIndex === -1) {
    // Phrase not found, return just the phrase
    return phrase;
  }

  const startIndex = Math.max(0, phraseLineIndex - lines);
  const endIndex = Math.min(textLines.length, phraseLineIndex + lines + 1);

  return textLines.slice(startIndex, endIndex).join('\n');
}

/**
 * Builds targeted correction prompt
 */
function buildCorrectionPrompt(
  issue: ValidationIssue,
  context: string,
  glossary: any
): string {
  const template = CORRECTION_PROMPT_TEMPLATES[issue.type] || CORRECTION_PROMPT_TEMPLATES.grammar;
  const guidance = getIssueGuidance(issue, glossary);

  return template
    .replace('{phrase}', issue.phrase)
    .replace('{context}', context)
    .replace('{guidance}', guidance);
}

/**
 * Gets issue-specific guidance with glossary hints
 */
function getIssueGuidance(issue: ValidationIssue, glossary: any): string {
  const hints: string[] = [];

  // Add validation suggestion if available
  if (issue.suggestion) {
    hints.push(`Validation suggests: ${issue.suggestion}`);
  }

  // Add glossary hints if relevant
  if (glossary.acronyms) {
    const acronymKeys = Object.keys(glossary.acronyms);
    if (acronymKeys.length > 0) {
      hints.push(`Known acronyms: ${acronymKeys.slice(0, 8).join(', ')}`);
    }
  }

  if (glossary.properNouns && glossary.properNouns.length > 0) {
    hints.push(`Known names: ${glossary.properNouns.join(', ')}`);
  }

  // Type-specific guidance
  if (issue.type === 'grammar') {
    hints.push('Common handwriting confusions: h/b, s/g, m/n, rn/m, u/v');
  } else if (issue.type === 'semantics') {
    hints.push('Check if words form coherent business meaning');
  }

  return hints.join('\n');
}

// Reply a strip returns when the phrase to correct is not visible in it. Kept as a
// single constant so the prompt instruction and the leak-guard below can't drift.
const NOT_PRESENT_SENTINEL = 'NOT_PRESENT';
const NOT_PRESENT_PATTERN = new RegExp(`^${NOT_PRESENT_SENTINEL}\\b`, 'i');

/**
 * Requests phrase correction via AI provider
 */
async function requestPhraseCorrection(
  imageBuffer: Buffer,
  prompt: string
): Promise<string | null> {
  try {
    // Use the same width-only preprocessing as the primary OCR path, then split tall
    // pages into vertical strips. Sending a very tall page as a single image lets the
    // model downsample it to illegibility and hallucinate a "correction"; strips keep
    // the handwriting legible. See preprocessImageForOCR / segmentImageVertically.
    const preprocessedBuffer = await preprocessImageForOCR(imageBuffer);
    const segments = await segmentImageVertically(preprocessedBuffer);

    const compressionConfig = getCompressionConfig();
    const provider = await getProvider();

    // With multiple strips the phrase lives in only one of them, so each strip is told
    // to report the sentinel when the phrase is not visible; we take the first strip
    // that actually returns a correction.
    const multiSegment = segments.length > 1;
    const systemPrompt = multiSegment
      ? `You are a handwriting OCR correction specialist. The image is one vertical section of a larger page. If the phrase to correct is NOT visible in this section, respond with exactly "${NOT_PRESENT_SENTINEL}" and nothing else. Otherwise provide only the corrected phrase, no explanation or additional text.`
      : 'You are a handwriting OCR correction specialist. Provide only the corrected phrase, no explanation or additional text.';
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    for (const segment of segments) {
      let finalBuffer = segment;
      if (compressionConfig.enabled) {
        const compressionResult = await compressImageIfNeeded(
          segment,
          compressionConfig.maxSizeBytes,
          compressionConfig.minQuality
        );
        finalBuffer = compressionResult.buffer;
      }

      const base64Image = finalBuffer.toString('base64');
      const response = await provider.generateVisionCompletion(
        fullPrompt,
        base64Image,
        'image/jpeg',
        'ocr'
      );

      const corrected = response.content?.trim();
      if (!corrected) continue;
      // Guard against the sentinel leaking into the transcription as a "correction".
      if (multiSegment && NOT_PRESENT_PATTERN.test(corrected)) continue;
      return corrected;
    }

    return null;
  } catch (error: any) {
    console.error('❌ Correction API call failed:', error.message);
    return null;
  }
}

/**
 * Formats correction log as markdown
 */
export function formatCorrectionLog(corrections: CorrectionLog[]): string {
  if (corrections.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Corrections Applied');
  lines.push('');
  lines.push(`${corrections.length} phrase${corrections.length > 1 ? 's' : ''} corrected:`);
  lines.push('');

  corrections.forEach((c, i) => {
    lines.push(`${i + 1}. **"${c.originalPhrase}"** → "${c.correctedPhrase}"`);
    lines.push(`   - Reason: ${c.issueType}`);
    if (c.validationNote) {
      lines.push(`   - Note: ${c.validationNote}`);
    }
    lines.push(`   - Confidence: ${(c.confidence * CONFIDENCE_TO_PERCENT).toFixed(PERCENT_WHOLE_NUMBER)}%`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Loads correction configuration from handwriting reference
 */
export async function getCorrectionConfig(): Promise<CorrectionConfig> {
  try {
    const reference = await loadHandwritingReference();
    const userConfig = (reference as any).ocrCorrection || {};

    return {
      ...DEFAULT_CORRECTION_CONFIG,
      ...userConfig
    };
  } catch {
    return DEFAULT_CORRECTION_CONFIG;
  }
}
