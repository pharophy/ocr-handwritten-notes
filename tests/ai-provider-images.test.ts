import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { OpenAIProvider, AnthropicProvider, ProviderType } from '../src/aiProvider';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';

// fix-ocr-fidelity 2.4: vision calls carry detail "high" and can send extra
// images (the handwriting reference) before the target image.

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
    mockCreate,
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  const mockMessagesCreate = vi.fn();
  return {
    default: class MockAnthropic {
      messages = { create: mockMessagesCreate };
    },
    mockMessagesCreate,
  };
});

const OpenAI = await import('openai');
const mockCreate = (OpenAI as any).mockCreate;
const AnthropicMod = await import('@anthropic-ai/sdk');
const mockMessagesCreate = (AnthropicMod as any).mockMessagesCreate;

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
    models: { ocr: 'gpt-4o', ocrFallback: 'gpt-4.1-mini' },
  })),
}));

const OPENAI_OK = { model: 'gpt-4o', choices: [{ message: { content: 'ok text' } }] };
const ANTHROPIC_OK = {
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: 'ok text' }],
  usage: { input_tokens: 1, output_tokens: 1 },
};

function openaiImageParts(callIndex: number): any[] {
  return mockCreate.mock.calls[callIndex][0].messages[0].content.filter((p: any) => p.type === 'image_url');
}

describe('OpenAI adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets detail "high" on every image part and sends extra images first', async () => {
    mockCreate.mockResolvedValue(OPENAI_OK);
    const p = new OpenAIProvider({ type: ProviderType.OPENAI, apiKey: 'k', models: { ocr: 'gpt-4o' } });
    await p.generateVisionCompletion('prompt', 'TARGET', 'image/jpeg', 'ocr', {
      detail: 'high',
      extraImages: [{ base64: 'REFERENCE', mimeType: 'image/jpeg' }],
    });
    const images = openaiImageParts(0);
    expect(images).toHaveLength(2);
    expect(images[0].image_url.url).toContain('REFERENCE');
    expect(images[1].image_url.url).toContain('TARGET');
    for (const img of images) expect(img.image_url.detail).toBe('high');
  });

  it('a call with no options is unchanged (one image, no detail key)', async () => {
    mockCreate.mockResolvedValue(OPENAI_OK);
    const p = new OpenAIProvider({ type: ProviderType.OPENAI, apiKey: 'k', models: { ocr: 'gpt-4o' } });
    await p.generateVisionCompletion('prompt', 'TARGET', 'image/jpeg', 'ocr');
    const images = openaiImageParts(0);
    expect(images).toHaveLength(1);
    expect(images[0].image_url).not.toHaveProperty('detail');
  });
});

describe('Anthropic adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends extra images before the target and ignores detail without error', async () => {
    mockMessagesCreate.mockResolvedValue(ANTHROPIC_OK);
    const p = new AnthropicProvider({ type: ProviderType.ANTHROPIC, apiKey: 'k', models: { ocr: 'claude-opus-5-5' } });
    await p.generateVisionCompletion('prompt', 'TARGET', 'image/jpeg', 'ocr', {
      detail: 'high',
      extraImages: [{ base64: 'REFERENCE', mimeType: 'image/jpeg' }],
    });
    const images = mockMessagesCreate.mock.calls[0][0].messages[0].content.filter((p: any) => p.type === 'image');
    expect(images).toHaveLength(2);
    expect(images[0].source.data).toBe('REFERENCE');
    expect(images[1].source.data).toBe('TARGET');
  });
});

describe('OCR path requests high detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
  });

  it('primary and fallback OCR calls carry detail "high"', async () => {
    mockCreate
      .mockResolvedValueOnce({ model: 'gpt-4o', choices: [{ message: { content: '*[illegible]* *[illegible]* *[illegible]* *[illegible]* *[illegible]*' } }] })
      .mockResolvedValueOnce({ model: 'gpt-4.1-mini', choices: [{ message: { content: 'Fallback transcription with plenty of readable words.' } }] });
    const img = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer();

    await processHandwrittenImage(img, 'note.jpg');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 2; i++) {
      for (const part of openaiImageParts(i)) expect(part.image_url.detail).toBe('high');
    }
  });
});

describe('newer model parameters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gpt-6 models get max_completion_tokens, not max_tokens', async () => {
    mockCreate.mockResolvedValue(OPENAI_OK);
    const p = new OpenAIProvider({ type: ProviderType.OPENAI, apiKey: 'k', models: { ocr: 'gpt-6-luna' } });
    await p.generateVisionCompletion('prompt', 'TARGET', 'image/jpeg', 'ocr');
    const req = mockCreate.mock.calls[0][0];
    expect(req).toHaveProperty('max_completion_tokens');
    expect(req).not.toHaveProperty('max_tokens');
  });

  it('OCR_REASONING_EFFORT applies to OCR vision calls on reasoning models only', async () => {
    mockCreate.mockResolvedValue(OPENAI_OK);
    process.env.OCR_REASONING_EFFORT = 'low';
    try {
      await new OpenAIProvider({ type: ProviderType.OPENAI, apiKey: 'k', models: { ocr: 'gpt-5-mini' } })
        .generateVisionCompletion('p', 'T', 'image/jpeg', 'ocr');
      await new OpenAIProvider({ type: ProviderType.OPENAI, apiKey: 'k', models: { ocr: 'gpt-4o' } })
        .generateVisionCompletion('p', 'T', 'image/jpeg', 'ocr');
      expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe('low');
      expect(mockCreate.mock.calls[1][0]).not.toHaveProperty('reasoning_effort');
    } finally {
      delete process.env.OCR_REASONING_EFFORT;
    }
  });
});
