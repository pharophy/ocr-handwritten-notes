import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';
import { syntheticPage } from './helpers/syntheticPage';

// fix-ocr-fidelity 2.25: the loaded handwriting reference is actually used.

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

const referenceSheet = await sharp({ create: { width: 3024, height: 1921, channels: 3, background: '#eee' } }).jpeg().toBuffer();

vi.mock('../src/handwritingReference', () => ({
  loadHandwritingReference: vi.fn().mockResolvedValue({ referenceImagePath: './ref.jpeg', referenceWords: ['placeholder'] }),
  loadReferenceImage: vi.fn().mockImplementation(async () => referenceSheet),
  formatReferenceWordsForPrompt: vi.fn().mockReturnValue('REF-WORDS-LIST'),
  formatReferenceImageInstructions: vi.fn().mockReturnValue('REF-IMAGE-INSTRUCTIONS'),
  referenceImageExists: vi.fn().mockResolvedValue(true),
  getDomainGlossary: vi.fn().mockReturnValue({}),
  formatGlossaryContext: vi.fn().mockReturnValue(''),
  loadAIProviderConfig: vi.fn().mockImplementation(async () => ({
    type: 'openai',
    apiKey: 'test-key',
    models: { ocr: 'gpt-4o', ocrFallback: 'none' },
  })),
}));

function images(i: number): any[] {
  return mockCreate.mock.calls[i][0].messages[0].content.filter((p: any) => p.type === 'image_url');
}
function prompt(i: number): string {
  return mockCreate.mock.calls[i][0].messages[0].content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
}

describe('2.25 HANDWRITING_REFERENCE_MODE', () => {
  const saved = process.env.HANDWRITING_REFERENCE_MODE;
  let small: Buffer;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    let n = 0;
    mockCreate.mockImplementation(async (req: any) => ({
      model: req.model,
      choices: [{ message: { content: `- placeholder call ${n++} with enough ordinary words to pass` } }],
    }));
    small = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.HANDWRITING_REFERENCE_MODE; else process.env.HANDWRITING_REFERENCE_MODE = saved;
  });

  it('image (default): every segment call sends the downscaled reference first, with its instructions', async () => {
    delete process.env.HANDWRITING_REFERENCE_MODE;
    await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
    for (let i = 0; i < mockCreate.mock.calls.length; i++) {
      const parts = images(i);
      expect(parts).toHaveLength(2);
      const ref = await sharp(Buffer.from(parts[0].image_url.url.split(',')[1], 'base64')).metadata();
      expect(ref.width).toBeLessThanOrEqual(1536);
      expect(prompt(i)).toContain('REF-IMAGE-INSTRUCTIONS');
    }
  });

  it('words: no reference image, reference words in the prompt', async () => {
    process.env.HANDWRITING_REFERENCE_MODE = 'words';
    await processHandwrittenImage(small, 'note.jpg');
    expect(images(0)).toHaveLength(1);
    expect(prompt(0)).toContain('REF-WORDS-LIST');
    expect(prompt(0)).not.toContain('REF-IMAGE-INSTRUCTIONS');
  });

  it('off: neither image nor words', async () => {
    process.env.HANDWRITING_REFERENCE_MODE = 'off';
    await processHandwrittenImage(small, 'note.jpg');
    expect(images(0)).toHaveLength(1);
    expect(prompt(0)).not.toContain('REF-WORDS-LIST');
    expect(prompt(0)).not.toContain('REF-IMAGE-INSTRUCTIONS');
  });
});
