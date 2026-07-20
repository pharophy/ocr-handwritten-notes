import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';
import sharp from 'sharp';

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
    mockCreate // Export for tests to use
  };
});

// Get the mock function after mocking
const OpenAI = await import('openai');
const mockCreate = (OpenAI as any).mockCreate;

function getPromptFromOpenAICall() {
  const callArgs = mockCreate.mock.calls[0][0];
  return callArgs.messages[0].content.find((c: any) => c.type === 'text').text;
}

function getImageContentFromOpenAICall() {
  const callArgs = mockCreate.mock.calls[0][0];
  return callArgs.messages[0].content.find((c: any) => c.type === 'image_url');
}

// Mock utilities
vi.mock('../src/utils', () => ({
  OPEN_AI_KEY: 'test-key'
}));

// Mock handwriting reference
vi.mock('../src/handwritingReference', () => ({
  loadHandwritingReference: vi.fn().mockResolvedValue({}),
  loadReferenceImage: vi.fn().mockResolvedValue(null),
  formatReferenceWordsForPrompt: vi.fn().mockReturnValue(''),
  formatReferenceImageInstructions: vi.fn().mockReturnValue(''),
  referenceImageExists: vi.fn().mockResolvedValue(false),
  getDomainGlossary: vi.fn().mockReturnValue({}),
  formatGlossaryContext: vi.fn().mockReturnValue(''),
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

describe('OCR Processing Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    mockCreate.mockResolvedValue({
      model: 'gpt-4o',
      choices: [{ message: { content: 'Test transcription' } }]
    });
  });

  describe('Requirement: Image preprocessing', () => {
    it('Scenario: Standard image preprocessing - should convert to grayscale, resize, normalize, and sharpen', async () => {
      const testImage = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .jpeg()
        .toBuffer();

      const result = await processHandwrittenImage(testImage, 'test.jpg');

      expect(mockCreate).toHaveBeenCalled();
      expect(result?.text).toBe('Test transcription');
    });
  });

  describe('Requirement: Handwriting transcription accuracy', () => {
    it('Scenario: Complete transcription - should transcribe all content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Complete transcription of all text' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      const result = await processHandwrittenImage(testImage, 'test.jpg');

      expect(result).toBeTruthy();
      expect(result?.text).not.toContain('...');
    });

    it('Scenario: Ambiguous characters - should mark unclear text with italics', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Some *unclear* text here' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      const result = await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Do not use *italics*');
      expect(result?.text).toContain('*unclear*');
    });

    it('Scenario: No content skipping - should never skip or summarize content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Full detailed transcription' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Transcribe handwritten notes exactly as written');
    });
  });

  describe('Requirement: Layout detection and preservation', () => {
    it('Scenario: Table layout detection - should use Markdown table syntax', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '| Col1 | Col2 |\n|------|------|\n| A | B |' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Preserve layout');
    });

    it('Scenario: Freeform notes layout - should preserve indentation and bullets', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '- Bullet point\n  - Indented item' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Preserve layout');
    });
  });

  describe('Requirement: Visual element notation', () => {
    it('Scenario: Arrow notation - should use → character', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Step 1 → Step 2' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('arrows');
    });
  });

  describe('Requirement: Capitalization preservation', () => {
    it('Scenario: All-caps text - should preserve capitalization', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'API and REST are IMPORTANT' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Keep acronyms in ALL-CAPS');
    });
  });

  describe('Requirement: Output format compatibility', () => {
    it('Scenario: Markdown compatibility - should produce valid markdown without code blocks', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '# Header\n\nNormal text' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      expect(getPromptFromOpenAICall()).toContain('Output only the transcribed text');
    });
  });

  describe('Requirement: Image format support', () => {
    it('Scenario: JPEG images - should detect and use correct MIME type', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Transcription' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      await processHandwrittenImage(testImage, 'test.jpg');

      const imageContent = getImageContentFromOpenAICall();
      expect(imageContent.image_url.url).toContain('image/jpeg');
    });

    it('Scenario: PNG images - should detect and use correct MIME type', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Transcription' } }]
      });

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).png().toBuffer();

      await processHandwrittenImage(testImage, 'test.png');

      const imageContent = getImageContentFromOpenAICall();
      expect(imageContent.image_url.url).toContain('image/jpeg');
    });
  });

  describe('Requirement: Error handling', () => {
    it('Scenario: OCR API failure - should return null and log error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const testImage = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).jpeg().toBuffer();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await processHandwrittenImage(testImage, 'test.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
