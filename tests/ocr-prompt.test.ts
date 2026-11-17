import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';

// fix-ocr-fidelity 2.1 / 2.2 / 2.3: the OCR prompt must ask for uncertainty
// markers (the quality check counts them) and for crossed-out text as ~~text~~,
// and an italic-heavy result must reach the fallback model.

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
    models: { ocr: 'gpt-4o', ocrFallback: 'gpt-4.1-mini' },
  })),
}));

async function smallImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg()
    .toBuffer();
}

function promptOfCall(i: number): string {
  const parts = mockCreate.mock.calls[i][0].messages[0].content;
  return parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
}

const CLEAN = 'A clean transcription with enough plain words to pass every quality gate.';

describe('OCR prompt content', () => {
  const original = process.env.OCR_UNCERTAINTY_MARKERS;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    delete process.env.OCR_UNCERTAINTY_MARKERS;
    mockCreate.mockResolvedValue({ model: 'gpt-4o', choices: [{ message: { content: CLEAN } }] });
  });

  afterEach(() => {
    if (original === undefined) delete process.env.OCR_UNCERTAINTY_MARKERS;
    else process.env.OCR_UNCERTAINTY_MARKERS = original;
  });

  it('2.1 by default asks for *italics* on unclear words and never forbids them', async () => {
    await processHandwrittenImage(await smallImage(), 'note.jpg');
    const prompt = promptOfCall(0);
    expect(prompt).not.toMatch(/do not use \*italics\*/i);
    expect(prompt).not.toMatch(/do not use .*uncertainty markers/i);
    expect(prompt).toMatch(/\*italics\*/);
    expect(prompt).toMatch(/cannot read confidently/i);
  });

  it('2.1 with OCR_UNCERTAINTY_MARKERS=false does not request markers', async () => {
    process.env.OCR_UNCERTAINTY_MARKERS = 'false';
    resetOCRCacheForTests();
    await processHandwrittenImage(await smallImage(), 'note.jpg');
    const prompt = promptOfCall(0);
    expect(prompt).not.toMatch(/cannot read confidently/i);
  });

  it('2.2 asks for crossed-out text as ~~text~~', async () => {
    await processHandwrittenImage(await smallImage(), 'note.jpg');
    const prompt = promptOfCall(0);
    expect(prompt).toMatch(/crossed[- ]out|struck/i);
    expect(prompt).toContain('~~');
  });

  it('judges nesting from horizontal position and keeps sub-bullets attached', async () => {
    await processHandwrittenImage(await smallImage(), 'note.jpg');
    const prompt = promptOfCall(0);
    expect(prompt).toMatch(/further right/i);
    expect(prompt).toMatch(/no blank line between a bullet and its sub-bullets/i);
  });

  it('2.2 asks for each bullet on one line at its written nesting level', async () => {
    await processHandwrittenImage(await smallImage(), 'note.jpg');
    const prompt = promptOfCall(0);
    expect(prompt).toMatch(/each bullet on (its own|one) line/i);
    expect(prompt).toMatch(/nesting level/i);
  });
});

describe('Uncertainty markers reach the fallback model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
  });

  it('2.3 an italic-heavy primary result triggers the fallback', async () => {
    mockCreate
      .mockResolvedValueOnce({
        model: 'gpt-4o',
        choices: [{ message: { content: '- *alpha* *beta* gamma *delta* *epsilon* zeta *eta* *theta*' } }],
      })
      .mockResolvedValueOnce({ model: 'gpt-4.1-mini', choices: [{ message: { content: CLEAN } }] });

    const result = await processHandwrittenImage(await smallImage(), 'note.jpg');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].model).toBe('gpt-4.1-mini');
    expect(result?.modelUsed).toContain('fallback');
  });
});
