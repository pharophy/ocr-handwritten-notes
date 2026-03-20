import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOCROutput, formatValidationReport, getValidationConfig, type ValidationReport } from '../src/ocrValidator';

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate
        }
      };
    },
    mockCreate
  };
});

const OpenAI = await import('openai');
const mockCreate = (OpenAI as any).mockCreate;

// Mock utilities
vi.mock('../src/utils', () => ({
  OPEN_AI_KEY: 'test-key'
}));

// Mock handwriting reference
vi.mock('../src/handwritingReference', () => ({
  loadHandwritingReference: vi.fn().mockResolvedValue({})
}));

describe('OCR Validation Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement: Validation report structure', () => {
    it('Scenario: Clean OCR - should return high confidence with no issues', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.95,
              issues: [],
              summary: 'No issues detected'
            })
          }
        }]
      });

      const result = await validateOCROutput('This is clean text with proper grammar.');

      expect(result.hasIssues).toBe(false);
      expect(result.overallConfidence).toBe(0.95);
      expect(result.recommendation).toBe('proceed');
      expect(result.issueCount.critical).toBe(0);
    });

    it('Scenario: OCR with critical issues - should identify problems', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.6,
              issues: [
                {
                  type: 'grammar',
                  severity: 'critical',
                  phrase: 'use in do to automated effort',
                  suggestion: 'use to automate effort',
                  confidence: 0.9
                }
              ],
              summary: '1 critical issue found'
            })
          }
        }]
      });

      const result = await validateOCROutput('Some text use in do to automated effort.');

      expect(result.hasIssues).toBe(true);
      expect(result.issueCount.critical).toBe(1);
      expect(result.issues[0].type).toBe('grammar');
      expect(result.issues[0].phrase).toBe('use in do to automated effort');
      expect(result.recommendation).toBe('review');
    });

    it('Scenario: Multiple issues - should include all in report', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.55,
              issues: [
                {
                  type: 'grammar',
                  severity: 'critical',
                  phrase: 'bad grammar here',
                  confidence: 0.9
                },
                {
                  type: 'semantics',
                  severity: 'warning',
                  phrase: 'unclear meaning',
                  confidence: 0.7
                }
              ],
              summary: '1 critical, 1 warning'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test text');

      expect(result.issues.length).toBe(2);
      expect(result.hasIssues).toBe(true);
    });
  });

  describe('Requirement: Validation never returns null', () => {
    it('Scenario: API failure - should return fallback report', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await validateOCROutput('Test text');

      expect(result).toBeTruthy();
      expect(result.recommendation).toBe('proceed');
      expect(result.summary).toContain('unavailable');
      expect(result.overallConfidence).toBe(0.8);

      consoleSpy.mockRestore();
    });

    it('Scenario: Empty API response - should return default report', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: null
          }
        }]
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await validateOCROutput('Test text');

      expect(result).toBeTruthy();
      expect(result.recommendation).toBe('proceed');

      consoleSpy.mockRestore();
    });

    it('Scenario: Malformed JSON response - should handle gracefully', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '{ invalid json'
          }
        }]
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await validateOCROutput('Test text');

      expect(result).toBeTruthy();
      expect(result.recommendation).toBe('proceed');

      consoleSpy.mockRestore();
    });
  });

  describe('Requirement: Severity classification', () => {
    it('Scenario: Mixed severity issues - should count each correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.7,
              issues: [
                { type: 'grammar', severity: 'critical', phrase: 'bad phrase', confidence: 0.9 },
                { type: 'semantics', severity: 'warning', phrase: 'odd phrase', confidence: 0.7 },
                { type: 'encoding', severity: 'info', phrase: 'minor typo', confidence: 0.5 }
              ],
              summary: 'Multiple issues detected'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test text');

      expect(result.issueCount.critical).toBe(1);
      expect(result.issueCount.warning).toBe(1);
      expect(result.issueCount.info).toBe(1);
    });
  });

  describe('Requirement: Confidence threshold recommendations', () => {
    it('Scenario: Very low confidence - should recommend manual transcription', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.4,
              issues: [],
              summary: 'Low quality OCR'
            })
          }
        }]
      });

      const result = await validateOCROutput('Messy text', {
        skipSummarizationThreshold: 0.5
      });

      expect(result.recommendation).toBe('manual-transcribe');
    });

    it('Scenario: Moderate confidence - should recommend review', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.65,
              issues: [],
              summary: 'Moderate quality'
            })
          }
        }]
      });

      const result = await validateOCROutput('Text', {
        confidenceThreshold: 0.7
      });

      expect(result.recommendation).toBe('review');
    });

    it('Scenario: High confidence with critical issues - should still recommend review', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.85,
              issues: [
                { type: 'grammar', severity: 'critical', phrase: 'issue', confidence: 0.9 }
              ],
              summary: 'High confidence but has critical issue'
            })
          }
        }]
      });

      const result = await validateOCROutput('Text');

      expect(result.recommendation).toBe('review');
    });
  });

  describe('Requirement: Report formatting', () => {
    it('Scenario: Format report with issues - should produce readable markdown', () => {
      const report: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.65,
        issueCount: { critical: 1, warning: 1, info: 0 },
        issues: [
          {
            type: 'grammar',
            severity: 'critical',
            phrase: 'bad phrase',
            suggestion: 'good phrase',
            confidence: 0.9
          },
          {
            type: 'semantics',
            severity: 'warning',
            phrase: 'unclear text',
            confidence: 0.7
          }
        ],
        summary: 'Issues found',
        recommendation: 'review'
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('65%');
      expect(formatted).toContain('review');
      expect(formatted).toContain('Critical Issues');
      expect(formatted).toContain('bad phrase');
      expect(formatted).toContain('good phrase');
      expect(formatted).toContain('Warnings');
      expect(formatted).toContain('unclear text');
    });

    it('Scenario: Format report without issues - should show clean status', () => {
      const report: ValidationReport = {
        hasIssues: false,
        overallConfidence: 0.95,
        issueCount: { critical: 0, warning: 0, info: 0 },
        issues: [],
        summary: 'No issues',
        recommendation: 'proceed'
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('95%');
      expect(formatted).toContain('✅ No significant issues detected');
    });
  });

  describe('Requirement: Configuration override', () => {
    it('Scenario: Disabled validation - should skip and return pass report', async () => {
      const result = await validateOCROutput('Test', { enabled: false });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.recommendation).toBe('proceed');
      expect(result.overallConfidence).toBe(1.0);
    });

    it('Scenario: Empty OCR text - should skip and return pass report', async () => {
      const result = await validateOCROutput('');

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.recommendation).toBe('proceed');
    });

    it('Scenario: Custom thresholds - should use provided values', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.6,
              issues: [],
              summary: 'OK'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test', {
        confidenceThreshold: 0.5,
        skipSummarizationThreshold: 0.3
      });

      // With threshold 0.5, confidence 0.6 should proceed
      expect(result.recommendation).toBe('proceed');
    });
  });

  describe('Requirement: Model usage', () => {
    it('Scenario: Validation request - should use gpt-4o-mini with temperature 0.3', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.9,
              issues: [],
              summary: 'Good'
            })
          }
        }]
      });

      await validateOCROutput('Test text');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.3);
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });
  });

  describe('Requirement: Issue type classification', () => {
    it('Scenario: Grammar issues - should identify grammar violations', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.7,
              issues: [
                { type: 'grammar', severity: 'critical', phrase: 'test', confidence: 0.9 }
              ],
              summary: 'Grammar issue'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test');

      expect(result.issues[0].type).toBe('grammar');
    });

    it('Scenario: Semantic issues - should identify meaningless phrases', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.7,
              issues: [
                { type: 'semantics', severity: 'warning', phrase: 'test', confidence: 0.8 }
              ],
              summary: 'Semantic issue'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test');

      expect(result.issues[0].type).toBe('semantics');
    });

    it('Scenario: Incomplete transcriptions - should identify truncated phrases', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.6,
              issues: [
                { type: 'incomplete', severity: 'critical', phrase: 'test', confidence: 0.85 }
              ],
              summary: 'Incomplete phrase'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test');

      expect(result.issues[0].type).toBe('incomplete');
    });

    it('Scenario: Encoding errors - should identify character problems', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallConfidence: 0.8,
              issues: [
                { type: 'encoding', severity: 'info', phrase: 'test', confidence: 0.6 }
              ],
              summary: 'Encoding issue'
            })
          }
        }]
      });

      const result = await validateOCROutput('Test');

      expect(result.issues[0].type).toBe('encoding');
    });
  });
});
