import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';

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

vi.mock('../src/handwritingReference', () => ({
  loadHandwritingReference: vi.fn().mockResolvedValue({}),
  loadReferenceImage: vi.fn().mockResolvedValue(null),
  formatReferenceWordsForPrompt: vi.fn().mockReturnValue(''),
  formatReferenceImageInstructions: vi.fn().mockReturnValue(''),
  referenceImageExists: vi.fn().mockResolvedValue(false),
  getDomainGlossary: vi.fn().mockReturnValue({}),
  formatGlossaryContext: vi.fn().mockReturnValue(''),
  loadAIProviderConfig: vi.fn().mockImplementation(async () => ({
    type: 'openai',
    apiKey: 'test-key',
    baseURL: undefined,
    models: {
      ocr: process.env.AI_MODEL_OCR || 'gpt-4o',
      ocrFallback: process.env.AI_MODEL_OCR_FALLBACK ?? 'gpt-4.1-mini',
    }
  }))
}));

async function testImage(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();
}

describe('OCR Fallback Integration Tests', () => {
  const originalFallback = process.env.AI_MODEL_OCR_FALLBACK;
  const originalOcr = process.env.AI_MODEL_OCR;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    process.env.AI_MODEL_OCR = 'gpt-4o';
    process.env.AI_MODEL_OCR_FALLBACK = 'gpt-4.1-mini';
  });

  afterEach(() => {
    process.env.AI_MODEL_OCR = originalOcr;
    process.env.AI_MODEL_OCR_FALLBACK = originalFallback;
  });

  it('should not trigger fallback when primary model succeeds', async () => {
    mockCreate.mockResolvedValueOnce({
      model: 'gpt-4o',
      choices: [{ message: { content: 'This is a clean OCR result with enough content to pass quality checks.' } }]
    });

    const result = await processHandwrittenImage(await testImage(), 'note.jpg');

    expect(result?.text).toContain('clean OCR result');
    expect(result?.modelUsed).toBe('gpt-4o');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should trigger fallback when primary model produces poor quality', async () => {
    mockCreate
      .mockResolvedValueOnce({
        model: 'gpt-4o',
        choices: [{ message: { content: '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*' } }]
      })
      .mockResolvedValueOnce({
        model: 'gpt-4.1-mini',
        choices: [{ message: { content: 'Fallback produced a readable transcription with enough content.' } }]
      });

    const result = await processHandwrittenImage(await testImage(), 'note.jpg');

    expect(result?.text).toContain('Fallback produced');
    expect(result?.modelUsed).toContain('fallback from gpt-4o');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should use primary result when AI_MODEL_OCR_FALLBACK=none', async () => {
    process.env.AI_MODEL_OCR_FALLBACK = 'none';
    resetOCRCacheForTests();

    mockCreate.mockResolvedValueOnce({
      model: 'gpt-4o',
      choices: [{ message: { content: '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*' } }]
    });

    const result = await processHandwrittenImage(await testImage(), 'note.jpg');

    expect(result?.text).toContain('*[illegible]*');
    expect(result?.modelUsed).toBe('gpt-4o');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should support OpenAI primary and OpenAI fallback model configuration', async () => {
    process.env.AI_MODEL_OCR = 'gpt-5-mini';
    process.env.AI_MODEL_OCR_FALLBACK = 'gpt-4.1-mini';
    resetOCRCacheForTests();

    mockCreate
      .mockResolvedValueOnce({
        model: 'gpt-5-mini',
        choices: [{ message: { content: '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*' } }]
      })
      .mockResolvedValueOnce({
        model: 'gpt-4.1-mini',
        choices: [{ message: { content: 'Fallback on the configured OpenAI provider succeeded.' } }]
      });

    const result = await processHandwrittenImage(await testImage(), 'note.jpg');

    expect(result?.text).toContain('configured OpenAI provider');
    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-5-mini');
    expect(mockCreate.mock.calls[1][0].model).toBe('gpt-4.1-mini');
  });
});
