import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { preprocessImageForOCR, segmentImageVertically } from '../src/ocr';
import {
  correctOCRIssues,
  validateOCROutput,
  resetOCRValidatorCacheForTests,
  type ValidationIssue,
  type ValidationReport,
} from '../src/ocrValidator';
import { syntheticPage } from './helpers/syntheticPage';

// fix-ocr-fidelity 2.16–2.21: correction modes (legacy | narrow | off) and a
// shorthand-aware validator. All phrases are placeholders.

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
  loadHandwritingReference: vi.fn().mockResolvedValue({
    domainGlossary: { acronyms: { ABC: 'Placeholder acronym' }, properNouns: ['Placeholder Name'] },
  }),
  loadAIProviderConfig: vi.fn().mockResolvedValue({
    type: 'openai',
    apiKey: 'test-key',
    models: { ocr: 'gpt-4o', validation: 'gpt-4o-mini' },
  }),
}));

function report(...issues: ValidationIssue[]): ValidationReport {
  return {
    hasIssues: true,
    overallConfidence: 0.6,
    issueCount: { critical: issues.length, warning: 0, info: 0 },
    issues,
    summary: 'test',
    recommendation: 'review',
  };
}

const issue = (type: ValidationIssue['type'], phrase: string, suggestion = 'possibly something else entirely'): ValidationIssue => ({
  type,
  severity: 'critical',
  phrase,
  suggestion,
  confidence: 0.95,
});

function promptOfCall(i: number): string {
  return mockCreate.mock.calls[i][0].messages[0].content
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('\n');
}

let smallImage: Buffer;

beforeEach(async () => {
  vi.clearAllMocks();
  resetOCRValidatorCacheForTests();
  smallImage = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer();
});

describe('2.16 correction modes', () => {
  it('mode "off" makes no correction request', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'changed phrase' } }] });
    const r = await correctOCRIssues('- placeholder garbled phrse here', smallImage, report(issue('encoding', 'garbled phrse')), { mode: 'off' } as any);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(r.correctedText).toBe('- placeholder garbled phrse here');
  });

  it('legacy (unset) mode keeps today’s prompt and output', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'placeholder fixed words' } }] });
    const r = await correctOCRIssues(
      '- intro line\n- placeholder broken words here\n- outro line',
      smallImage,
      report(issue('grammar', 'placeholder broken words', 'possibly "placeholder fixed words"'))
    );
    expect(promptOfCall(0)).toMatchSnapshot('legacy-correction-prompt');
    expect(r.correctedText).toMatchSnapshot('legacy-correction-output');
  });

  it('correction requests carry detail "high"', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'garbled phrase' } }] });
    await correctOCRIssues('- placeholder garbled phrse here', smallImage, report(issue('encoding', 'garbled phrse')));
    const parts = mockCreate.mock.calls[0][0].messages[0].content.filter((p: any) => p.type === 'image_url');
    for (const p of parts) expect(p.image_url.detail).toBe('high');
  });
});

describe('narrow mode', () => {
  it('2.17 ignores grammar, semantics and incomplete issues; acts on encoding', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'garbled phrase' } }] });
    const text = '- alpha words one\n- beta words two\n- gamma words three\n- placeholder garbled phrse';
    await correctOCRIssues(
      text,
      smallImage,
      report(issue('grammar', 'alpha words one'), issue('semantics', 'beta words two'), issue('incomplete', 'gamma words three')),
      { mode: 'narrow' } as any
    );
    expect(mockCreate).not.toHaveBeenCalled();

    await correctOCRIssues(text, smallImage, report(issue('encoding', 'garbled phrse')), { mode: 'narrow' } as any);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('2.18 never passes the validator’s guess to the model', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'garbled phrase' } }] });
    await correctOCRIssues(
      '- placeholder garbled phrse',
      smallImage,
      report(issue('encoding', 'garbled phrse', 'GUESSED MEANING TEXT')),
      { mode: 'narrow' } as any
    );
    const prompt = promptOfCall(0);
    expect(prompt).not.toContain('Validation suggests');
    expect(prompt).not.toContain('GUESSED MEANING TEXT');
  });

  it('2.19 discards a correction that adds words and inverts the phrase', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'the outcome you want but lack' } }] });
    const r = await correctOCRIssues(
      '- what is the outcome you want',
      smallImage,
      report(issue('encoding', 'the outcome you want')),
      { mode: 'narrow' } as any
    );
    expect(r.correctedText).toBe('- what is the outcome you want');
    expect(r.correctionCount).toBe(0);
  });

  it('2.20 sends only the strip whose text contains the phrase', async () => {
    const page = await syntheticPage(1000, 2400);
    const strips = await segmentImageVertically(await preprocessImageForOCR(page));
    expect(strips.length).toBeGreaterThanOrEqual(4);
    const segmentTexts = strips.map((_, i) => (i === 2 ? '- strip two has the garbled phrse here' : `- strip ${i} ordinary text`));
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'garbled phrase' } }] });

    const r = await correctOCRIssues(
      segmentTexts.join('\n'),
      page,
      report(issue('encoding', 'garbled phrse')),
      { mode: 'narrow' } as any,
      { segmentTexts }
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const sent = mockCreate.mock.calls[0][0].messages[0].content.filter((p: any) => p.type === 'image_url').pop().image_url.url;
    expect(sent.split(',')[1]).toBe(strips[2].buffer.toString('base64'));
    expect(r.correctedText).toContain('garbled phrase');
  });

  it('2.20 skips a phrase that appears more than once (ambiguous position)', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'garbled phrase' } }] });
    const text = '- first garbled phrse\n- second garbled phrse';
    const r = await correctOCRIssues(text, smallImage, report(issue('encoding', 'garbled phrse')), { mode: 'narrow' } as any);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(r.correctedText).toBe(text);
  });
});

describe('2.21 validator treats shorthand as normal', () => {
  it('states that input is terse shorthand and fragments are not grammar errors', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"overallConfidence":0.9,"issues":[],"summary":"ok"}' } }] });
    await validateOCROutput('- placeholder shorthand line w/ abbrev');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toMatch(/shorthand/i);
    expect(prompt).toMatch(/not (count as )?grammar errors/i);
  });
});
