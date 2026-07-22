import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PREPROCESSING_WIDTH, SEGMENT_MAX_HEIGHT } from '../src/ocr';
import {
  correctOCRIssues,
  resetOCRValidatorCacheForTests,
  type ValidationReport,
} from '../src/ocrValidator';

// Mock the OpenAI SDK so we can capture exactly what image the correction pass
// sends to the vision model.
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
  loadAIProviderConfig: vi.fn().mockResolvedValue({
    type: 'openai',
    apiKey: 'test-key',
    baseURL: undefined,
    models: { ocr: 'gpt-4o' },
  }),
}));

async function makeImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

// Decode the image the model was asked to read on a given vision call.
async function sentImageMeta(callIndex: number): Promise<sharp.Metadata> {
  const url = mockCreate.mock.calls[callIndex][0].messages[0].content[0].image_url.url as string;
  const base64 = url.split(',')[1];
  return sharp(Buffer.from(base64, 'base64')).metadata();
}

function reportWithCriticalIssue(phrase: string): ValidationReport {
  return {
    hasIssues: true,
    overallConfidence: 0.6,
    issueCount: { critical: 1, warning: 0, info: 0 },
    issues: [{ type: 'grammar', severity: 'critical', phrase, confidence: 0.95 }],
    summary: 'test',
    recommendation: 'review',
  };
}

describe('Correction-path preprocessing (tall-image hallucination regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRValidatorCacheForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('never sends a downsampled full-height page to the model for a tall image', async () => {
    // Old behavior squished a 1000x9000 page to ~778x7000 (illegible) before the
    // vision call, which is exactly what causes the model to hallucinate a
    // "correction". The model must only ever see legible, full-resolution strips.
    mockCreate.mockResolvedValue({
      model: 'gpt-4o',
      choices: [{ message: { content: 'Corrected Phrase' } }],
    });

    const image = await makeImage(1000, 9000);
    await correctOCRIssues(
      'line one\nthis is a bad phrase here\nline three',
      image,
      reportWithCriticalIssue('bad phrase'),
      { enabled: true, tagCorrections: false }
    );

    expect(mockCreate).toHaveBeenCalled();
    const meta = await sentImageMeta(0);
    // Full horizontal resolution preserved (not downscaled by a bogus height box)...
    expect(meta.width).toBe(1000);
    // ...and no single image the model reads is taller than one OCR segment.
    expect(meta.height).toBeLessThanOrEqual(SEGMENT_MAX_HEIGHT);
  });

  it('segments a tall image and uses the strip that actually contains the phrase', async () => {
    // First strip reports the phrase is not visible; the second returns the fix.
    mockCreate
      .mockResolvedValueOnce({ model: 'gpt-4o', choices: [{ message: { content: 'NOT_PRESENT' } }] })
      .mockResolvedValueOnce({ model: 'gpt-4o', choices: [{ message: { content: 'Good Phrase' } }] });

    const image = await makeImage(1000, 5000);
    const result = await correctOCRIssues(
      'a\nbad phrase\nb',
      image,
      reportWithCriticalIssue('bad phrase'),
      { enabled: true, tagCorrections: false }
    );

    expect(result.correctedText).toContain('Good Phrase');
    expect(result.correctedText).not.toContain('NOT_PRESENT');
    // Stopped querying strips once the phrase was found.
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('applies no correction when no strip contains the phrase (all NOT_PRESENT)', async () => {
    mockCreate.mockResolvedValue({
      model: 'gpt-4o',
      choices: [{ message: { content: 'NOT_PRESENT' } }],
    });

    const image = await makeImage(1000, 5000);
    const result = await correctOCRIssues(
      'a\nbad phrase\nb',
      image,
      reportWithCriticalIssue('bad phrase'),
      { enabled: true, tagCorrections: false }
    );

    // The literal sentinel must never leak into the transcription.
    expect(result.correctedText).toBe('a\nbad phrase\nb');
    expect(result.correctionCount).toBe(0);
  });

  it('short images still use a single correction call', async () => {
    mockCreate.mockResolvedValue({
      model: 'gpt-4o',
      choices: [{ message: { content: 'Fixed' } }],
    });

    const image = await makeImage(800, 600);
    await correctOCRIssues(
      'x\nbad phrase\ny',
      image,
      reportWithCriticalIssue('bad phrase'),
      { enabled: true, tagCorrections: false }
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const meta = await sentImageMeta(0);
    expect(meta.height).toBe(600);
  });
});

describe('preprocessImageForOCR shared helper', () => {
  it('caps width only and preserves full height for a tall page', async () => {
    const { preprocessImageForOCR } = await import('../src/ocr');
    const tall = await makeImage(1000, 9000);
    const out = await preprocessImageForOCR(tall);
    const meta = await sharp(out).metadata();
    // 1000 < PREPROCESSING_WIDTH, so width is untouched and height is not shrunk
    // to fit a bounding box (old code produced 778x7000).
    expect(meta.width).toBe(1000);
    expect(meta.height).toBe(9000);
  });

  it('downscales width to the cap while preserving aspect ratio', async () => {
    const { preprocessImageForOCR } = await import('../src/ocr');
    const wide = await makeImage(PREPROCESSING_WIDTH * 2, PREPROCESSING_WIDTH); // 2:1
    const out = await preprocessImageForOCR(wide);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(PREPROCESSING_WIDTH);
    expect(meta.height).toBe(PREPROCESSING_WIDTH / 2); // aspect ratio preserved
  });
});
