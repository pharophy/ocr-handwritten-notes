import OpenAI from 'openai';
import { OPEN_AI_KEY } from './utils';
import { loadHandwritingReference, type HandwritingReferenceConfig } from './handwritingReference';

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

const openai = new OpenAI({
  apiKey: OPEN_AI_KEY
});

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: VALIDATION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Analyze this OCR transcription for quality issues:\n\n"""\n${ocrText}\n"""\n\nReturn your analysis as a JSON object.`
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('⚠️  Validation returned empty response');
      return createDefaultReport();
    }

    const parsed = JSON.parse(content);

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

  lines.push(`**Overall Quality**: ${(report.overallConfidence * 100).toFixed(0)}%`);
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
