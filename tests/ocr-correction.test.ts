import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  correctOCRIssues,
  getCorrectionConfig,
  formatCorrectionLog,
  type ValidationReport,
  type CorrectionConfig
} from '../src/ocrValidator';

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
  loadHandwritingReference: vi.fn().mockResolvedValue({
    domainGlossary: {
      acronyms: { MLF: 'Customer', NPB: 'Location' },
      properNouns: ['Pepsico', 'Canada'],
      businessTerms: ['onboarding', 'upfront']
    },
    ocrCorrection: {
      enabled: true,
      correctCriticalOnly: true,
      tagCorrections: true,
      maxCorrectionsPerImage: 10,
      minIssueConfidence: 0.8
    }
  }),
  loadAIProviderConfig: vi.fn().mockResolvedValue({
    type: 'openai',
    apiKey: 'test-key',
    baseURL: undefined,
    models: {
      ocr: 'gpt-4o',
      summarization: 'gpt-4o-mini',
      validation: 'gpt-4o-mini'
    }
  })
}));

describe('OCR Multi-Pass Correction', () => {
  const mockImageBuffer = Buffer.from('fake-image-data');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('correctOCRIssues', () => {
    it('should correct critical grammar issue and tag it', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'part home, part'
          }
        }]
      });

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.65,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'part based partly',
          suggestion: 'possibly "part home"',
          confidence: 0.9
        }],
        summary: 'Found grammar issue',
        recommendation: 'review'
      };

      const result = await correctOCRIssues(
        'Vacation part based partly in other city',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(1);
      expect(result.correctedText).toContain('part home, part[corrected]');
      expect(result.corrections[0].originalPhrase).toBe('part based partly');
      expect(result.corrections[0].correctedPhrase).toBe('part home, part');
    });

    it('should correct multiple critical issues', async () => {
      mockCreate
        .mockResolvedValueOnce({ choices: [{ message: { content: 'if we sign' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Pepsico has' } }] });

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 2, warning: 0, info: 0 },
        issues: [
          {
            type: 'grammar',
            severity: 'critical',
            phrase: 'If signed',
            confidence: 0.85
          },
          {
            type: 'semantics',
            severity: 'critical',
            phrase: 'Pepsi want',
            confidence: 0.82
          }
        ],
        summary: 'Multiple issues',
        recommendation: 'review'
      };

      const result = await correctOCRIssues(
        'If signed MLF go to\nPepsi want NA instance',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(2);
      expect(result.correctedText).toContain('if we sign[corrected]');
      expect(result.correctedText).toContain('Pepsico has[corrected]');
    });

    it('should skip warning-level issues', async () => {
      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.75,
        issueCount: { critical: 0, warning: 2, info: 0 },
        issues: [
          {
            type: 'grammar',
            severity: 'warning',
            phrase: 'some minor issue',
            confidence: 0.7
          }
        ],
        summary: 'Minor warnings only',
        recommendation: 'proceed'
      };

      const result = await correctOCRIssues(
        'Text with some minor issue here',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(0);
      expect(result.correctedText).toBe('Text with some minor issue here');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip when correction is disabled', async () => {
      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'bad phrase',
          confidence: 0.9
        }],
        summary: 'Has issues',
        recommendation: 'review'
      };

      const config: Partial<CorrectionConfig> = {
        enabled: false
      };

      const result = await correctOCRIssues(
        'Text with bad phrase here',
        mockImageBuffer,
        validation,
        config
      );

      expect(result.correctionCount).toBe(0);
      expect(result.correctedText).toBe('Text with bad phrase here');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should respect maxCorrectionsPerImage limit', async () => {
      mockCreate
        .mockResolvedValueOnce({ choices: [{ message: { content: 'fix 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'fix 2' } }] });

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.5,
        issueCount: { critical: 5, warning: 0, info: 0 },
        issues: [
          { type: 'grammar', severity: 'critical', phrase: 'issue 1', confidence: 0.9 },
          { type: 'grammar', severity: 'critical', phrase: 'issue 2', confidence: 0.9 },
          { type: 'grammar', severity: 'critical', phrase: 'issue 3', confidence: 0.9 },
          { type: 'grammar', severity: 'critical', phrase: 'issue 4', confidence: 0.9 },
          { type: 'grammar', severity: 'critical', phrase: 'issue 5', confidence: 0.9 }
        ],
        summary: 'Many issues',
        recommendation: 'manual-transcribe'
      };

      const config: Partial<CorrectionConfig> = {
        maxCorrectionsPerImage: 2
      };

      const result = await correctOCRIssues(
        'issue 1 and issue 2 and issue 3 and issue 4 and issue 5',
        mockImageBuffer,
        validation,
        config
      );

      expect(result.correctionCount).toBe(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should skip low-confidence issues', async () => {
      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.65,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'uncertain phrase',
          confidence: 0.5  // Below default 0.8 threshold
        }],
        summary: 'Low confidence issue',
        recommendation: 'review'
      };

      const result = await correctOCRIssues(
        'Text with uncertain phrase here',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should handle API failures gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API timeout'));

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'bad phrase',
          confidence: 0.9
        }],
        summary: 'Has issue',
        recommendation: 'review'
      };

      const result = await correctOCRIssues(
        'Text with bad phrase here',
        mockImageBuffer,
        validation
      );

      // Should continue gracefully
      expect(result.correctionCount).toBe(0);
      expect(result.correctedText).toBe('Text with bad phrase here');
    });

    it('should not correct if no issues found', async () => {
      const validation: ValidationReport = {
        hasIssues: false,
        overallConfidence: 0.95,
        issueCount: { critical: 0, warning: 0, info: 0 },
        issues: [],
        summary: 'Clean output',
        recommendation: 'proceed'
      };

      const result = await correctOCRIssues(
        'Clean text with no issues',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should format corrections without tags when disabled', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'corrected text' } }]
      });

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'wrong text',
          confidence: 0.9
        }],
        summary: 'Has issue',
        recommendation: 'review'
      };

      const config: Partial<CorrectionConfig> = {
        tagCorrections: false
      };

      const result = await correctOCRIssues(
        'This is wrong text here',
        mockImageBuffer,
        validation,
        config
      );

      expect(result.correctionCount).toBe(1);
      expect(result.correctedText).toBe('This is corrected text here');
      expect(result.correctedText).not.toContain('[corrected]');
    });

    it('should handle empty text', async () => {
      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.3,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'test',
          confidence: 0.9
        }],
        summary: 'Issue',
        recommendation: 'manual-transcribe'
      };

      const result = await correctOCRIssues(
        '',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(0);
      expect(result.correctedText).toBe('');
    });

    it('should skip correction if phrase already has [corrected] tag', async () => {
      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'already fixed',
          confidence: 0.9
        }],
        summary: 'Has issue',
        recommendation: 'review'
      };

      const result = await correctOCRIssues(
        'This already fixed[corrected] text',
        mockImageBuffer,
        validation
      );

      expect(result.correctionCount).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should call OpenAI with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'fixed' } }]
      });

      const validation: ValidationReport = {
        hasIssues: true,
        overallConfidence: 0.6,
        issueCount: { critical: 1, warning: 0, info: 0 },
        issues: [{
          type: 'grammar',
          severity: 'critical',
          phrase: 'broken',
          confidence: 0.9
        }],
        summary: 'Issue',
        recommendation: 'review'
      };

      await correctOCRIssues(
        'This is broken text',
        mockImageBuffer,
        validation
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe('gpt-4o');
      expect(call.temperature).toBe(0.2);
      expect(call.max_tokens).toBe(200);
      expect(call.messages).toHaveLength(2);
      expect(call.messages[0].role).toBe('system');
      expect(call.messages[1].content).toHaveLength(2);  // image + text
    });
  });

  describe('formatCorrectionLog', () => {
    it('should format correction log as markdown', () => {
      const corrections = [
        {
          originalPhrase: 'part based',
          correctedPhrase: 'part home',
          issueType: 'grammar',
          validationNote: 'unclear phrase',
          confidence: 0.9
        },
        {
          originalPhrase: 'Pepsi',
          correctedPhrase: 'Pepsico',
          issueType: 'semantics',
          validationNote: 'should be full name',
          confidence: 0.85
        }
      ];

      const formatted = formatCorrectionLog(corrections);

      expect(formatted).toContain('## Corrections Applied');
      expect(formatted).toContain('2 phrases corrected');
      expect(formatted).toContain('"part based"');
      expect(formatted).toContain('"part home"');
      expect(formatted).toContain('90%');
    });

    it('should return empty string for no corrections', () => {
      const formatted = formatCorrectionLog([]);
      expect(formatted).toBe('');
    });
  });

  describe('getCorrectionConfig', () => {
    it('should load correction config from handwriting reference', async () => {
      const config = await getCorrectionConfig();

      expect(config.enabled).toBe(true);
      expect(config.correctCriticalOnly).toBe(true);
      expect(config.tagCorrections).toBe(true);
      expect(config.maxCorrectionsPerImage).toBe(10);
      expect(config.minIssueConfidence).toBe(0.8);
    });

    it('should use defaults if config missing', async () => {
      const { loadHandwritingReference } = await import('../src/handwritingReference');
      vi.mocked(loadHandwritingReference).mockResolvedValueOnce({});

      const config = await getCorrectionConfig();

      expect(config.enabled).toBe(true);
      expect(config.maxCorrectionsPerImage).toBe(10);
    });
  });
});
