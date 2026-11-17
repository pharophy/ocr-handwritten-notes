import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeInkCoverage,
  findUnderfilledByInk,
  findEmptySegments,
  INK_BLANK_FLOOR,
  processHandwrittenImage,
  resetOCRCacheForTests,
} from '../src/ocr';
import { syntheticPage, placeholderLines } from './helpers/syntheticPage';

// fix-ocr-fidelity 2.6 (partial drops), 2.7 (false-positive guards), 2.8 (visible failure).

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
    models: { ocr: 'gpt-4o', ocrFallback: process.env.AI_MODEL_OCR_FALLBACK ?? 'gpt-4.1-mini' },
  })),
}));

describe('2.6 / 2.7 ink coverage', () => {
  it('measures handwriting strokes as ink', async () => {
    const ink = await computeInkCoverage(await syntheticPage(1536, 768));
    expect(ink).toBeGreaterThan(INK_BLANK_FLOOR * 5);
  });

  it('does not count dark ruled lines or binder rings on blank paper as ink', async () => {
    // Measured on a real capture: blank ruled paper with rings came out at ~1% "ink"
    // at the old threshold. Its ruled lines sit ~60–100 gray levels below the paper.
    const page = await syntheticPage(1536, 1050, { blankRanges: [[0, 1050]], ruled: true, ruledColor: '#a0a0a0', ringsWidth: 120 });
    expect(await computeInkCoverage(page)).toBeLessThan(INK_BLANK_FLOOR);
  });

  it('still measures handwriting on dark-ruled paper with rings', async () => {
    const page = await syntheticPage(1536, 1050, { ruled: true, ruledColor: '#a0a0a0', ringsWidth: 120 });
    expect(await computeInkCoverage(page)).toBeGreaterThan(INK_BLANK_FLOOR * 5);
  });

  it('does not count ruled lines or a shadow gradient on blank paper as ink', async () => {
    const page = await syntheticPage(1536, 768, { blankRanges: [[0, 768]], ruled: true, shadow: true });
    expect(await computeInkCoverage(page)).toBeLessThan(INK_BLANK_FLOOR);
  });
});

describe('2.6 characters-per-ink under-fill detection', () => {
  const ink = [0.05, 0.05, 0.05, 0.05];
  const text = (n: number) => 'x'.repeat(n);

  it('flags an inked segment returning ~40% of its peers’ characters per ink', () => {
    const r = findUnderfilledByInk([text(1000), text(400), text(1000), text(1000)], ink);
    expect(r.underfilledIndices).toEqual([1]);
    expect(r.incomplete).toBe(true);
  });

  it('does not flag a segment at ~80%', () => {
    const r = findUnderfilledByInk([text(1000), text(800), text(1000), text(1000)], ink);
    expect(r.underfilledIndices).toEqual([]);
    expect(r.incomplete).toBe(false);
  });

  it('2.7 never flags a blank-paper segment', () => {
    const r = findUnderfilledByInk([text(1000), '', text(1000)], [0.05, INK_BLANK_FLOOR / 2, 0.05]);
    expect(r.underfilledIndices).toEqual([]);
    expect(r.incomplete).toBe(false);
  });
});

describe('2.7 empty-segment false positives', () => {
  it('an empty interior blank-paper segment is not incomplete when ink is known', () => {
    const r = findEmptySegments(['top text', '', 'bottom text'], [0.05, INK_BLANK_FLOOR / 2, 0.05]);
    expect(r.incomplete).toBe(false);
  });

  it('an empty interior inked segment is still incomplete', () => {
    const r = findEmptySegments(['top text', '', 'bottom text'], [0.05, 0.05, 0.05]);
    expect(r.incomplete).toBe(true);
  });

  it('three empty segments after the last text are trailing paper, not a drop', () => {
    const r = findEmptySegments(['top text', 'more text', '', '', '']);
    expect(r.incomplete).toBe(false);
  });
});

describe('2.8 unresolved incompleteness is visible', () => {
  // 1000x2400 inked page → 4 segments at the 768/150 defaults.
  const EMPTY_PRIMARY = 1;
  let emptyCalls: Set<number>;
  const saved = process.env.AI_MODEL_OCR_FALLBACK;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    emptyCalls = new Set();
    let n = 0;
    mockCreate.mockImplementation(async (req: any) => {
      const i = n++;
      return { model: req.model, choices: [{ message: { content: emptyCalls.has(i) ? '' : placeholderLines(`c${i}`) } }] };
    });
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.AI_MODEL_OCR_FALLBACK; else process.env.AI_MODEL_OCR_FALLBACK = saved;
  });

  it('prepends a warning callout when the fallback is also incomplete', async () => {
    emptyCalls = new Set([EMPTY_PRIMARY, 4 + EMPTY_PRIMARY]);
    const result = await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(mockCreate).toHaveBeenCalledTimes(8);
    expect(result?.text.startsWith('> [!warning]')).toBe(true);
  });

  it('prepends a warning callout when no fallback is configured', async () => {
    process.env.AI_MODEL_OCR_FALLBACK = 'none';
    resetOCRCacheForTests();
    emptyCalls = new Set([EMPTY_PRIMARY]);
    const result = await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(result?.text.startsWith('> [!warning]')).toBe(true);
  });

  it('adds no callout to a complete result', async () => {
    const result = await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(result?.text).not.toContain('[!warning]');
  });
});

describe('completeness measures what each strip adds, not what it repeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
  });

  it('a bottom-anchored strip that only adds its few new lines is not flagged', async () => {
    // 1000x2100 at 768/150: tops 0, 618, 1236, then a last strip anchored at 1332,
    // which only adds the bottom ~96px. The model skips lines it already saw in the
    // context, so that strip returns just two short lines. Nothing is missing.
    // Distinct line numbers across strips, so no reply looks like overlap.
    let lineNo = 0;
    const lines = (n: number) =>
      Array.from({ length: n }, () => `- placeholder line ${lineNo++} with several ordinary words here`).join('\n');
    const replies = [lines(15), lines(12), lines(12), lines(2)];
    let n = 0;
    mockCreate.mockImplementation(async (req: any) => ({ model: req.model, choices: [{ message: { content: replies[n++] ?? '' } }] }));

    const result = await processHandwrittenImage(await syntheticPage(1000, 2100), 'tall.jpg');

    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(result?.incomplete).toBe(false);
    expect(result?.text).not.toContain('[!warning]');
  });
});
