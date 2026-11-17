import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { stripCodeFence, processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';

// fix-ocr-fidelity 2.15: a wrapping code fence never reaches the note.

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
    mockCreate,
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
    models: { ocr: 'gpt-4o', ocrFallback: 'none' },
  })),
}));

describe('2.15 stripCodeFence', () => {
  it('removes a ```markdown wrapper', () => {
    expect(stripCodeFence('```markdown\n- a item\n- b item\n```')).toBe('- a item\n- b item');
  });

  it('removes a bare ``` wrapper and surrounding whitespace', () => {
    expect(stripCodeFence('\n```\nplain text\n```\n')).toBe('plain text');
  });

  it('leaves unfenced text unchanged', () => {
    expect(stripCodeFence('- a item\n  - b item')).toBe('- a item\n  - b item');
  });

  it('strips a fence from model output before it is returned', async () => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    mockCreate.mockResolvedValue({
      model: 'gpt-4o',
      choices: [{ message: { content: '```markdown\n- placeholder fenced line with enough words\n```' } }],
    });
    const img = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer();
    const result = await processHandwrittenImage(img, 'note.jpg');
    expect(result?.text).not.toContain('```');
    expect(result?.text).toContain('- placeholder fenced line');
  });
});
