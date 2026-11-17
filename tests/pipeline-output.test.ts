import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

// fix-ocr-fidelity 2.22 (summary input is the final transcription only) and
// 2.28 (one link format for batch and single-file runs). Both entry points
// share src/pipeline.ts, so the behavior is tested once there.

const FINAL_TEXT = '- placeholder kept line\n- ~~AI: placeholder struck item~~\n- AI: placeholder real item';

vi.mock('../src/ocr', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    processHandwrittenImage: vi.fn().mockResolvedValue({
      text: '- placeholder raw line\n- ~~AI: placeholder struck item~~\n- AI: placeholder real item',
      modelUsed: 'gpt-4o',
      segmentTexts: ['- placeholder raw line'],
    }),
  };
});

vi.mock('../src/ocrValidator', () => ({
  validateOCROutput: vi.fn().mockResolvedValue({
    hasIssues: true,
    overallConfidence: 0.8,
    issueCount: { critical: 1, warning: 0, info: 0 },
    issues: [],
    summary: 'x',
    recommendation: 'review',
  }),
  getValidationConfig: vi.fn().mockResolvedValue({
    enabled: true,
    confidenceThreshold: 0.7,
    skipSummarizationThreshold: 0.5,
    appendReportOnIssues: true,
  }),
  formatValidationReport: vi.fn().mockReturnValue('PLACEHOLDER REPORT BODY'),
  getCorrectionConfig: vi.fn().mockResolvedValue({ enabled: true, mode: 'legacy' }),
  correctOCRIssues: vi.fn().mockResolvedValue({
    correctedText: FINAL_TEXT,
    corrections: [{ originalPhrase: 'raw', correctedPhrase: 'kept', issueType: 'encoding', validationNote: '', confidence: 0.9 }],
    correctionCount: 1,
  }),
}));

vi.mock('../src/summarize', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, summarizeText: vi.fn().mockResolvedValue('Summary:\nplaceholder summary') };
});

const { processImageFile } = await import('../src/pipeline');
const { summarizeText } = await import('../src/summarize');

let dir: string;
let imagePath: string;

beforeEach(async () => {
  vi.clearAllMocks();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-pipeline-'));
  imagePath = path.join(dir, 'Sample Note 01-01.jpg');
  await fs.writeFile(imagePath, await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).jpeg().toBuffer());
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('2.22 summary input', () => {
  it('summarizes only the final (post-correction) transcription, without struck text, links or the report', async () => {
    await processImageFile(imagePath, { validation: 'on', correction: 'on', summarize: true });

    expect(summarizeText).toHaveBeenCalledTimes(1);
    const input = (summarizeText as any).mock.calls[0][0] as string;
    expect(input).toContain('placeholder kept line');
    expect(input).toContain('AI: placeholder real item');
    expect(input).not.toContain('placeholder raw line');
    expect(input).not.toContain('struck item');
    expect(input).not.toContain('PLACEHOLDER REPORT BODY');
    expect(input).not.toContain('Corrections Applied');
    expect(input).not.toContain('[[');
  });

  it('both entry points delegate to the shared pipeline', async () => {
    for (const file of ['src/main.ts', 'src/convert-single.ts']) {
      const src = await fs.readFile(path.resolve(file), 'utf8');
      expect(src).toContain('processImageFile(');
      expect(src).not.toContain('summarizeText(');
    }
  });
});

describe('2.28 output links', () => {
  it('writes [[name - Summary and Actions]] | [[name.jpg]] and [[name]] | [[name.jpg]] with no fence', async () => {
    await processImageFile(imagePath, { validation: 'on', correction: 'on', summarize: true });

    const ocr = await fs.readFile(path.join(dir, 'Sample Note 01-01.md'), 'utf8');
    const summary = await fs.readFile(path.join(dir, 'Sample Note 01-01 - Summary and Actions.md'), 'utf8');

    expect(ocr.split('\n')[0]).toBe('[[Sample Note 01-01 - Summary and Actions]] | [[Sample Note 01-01.jpg]]');
    expect(summary.split('\n')[0]).toBe('[[Sample Note 01-01]] | [[Sample Note 01-01.jpg]]');
    expect(ocr).not.toContain('```');
    expect(ocr).toContain('PLACEHOLDER REPORT BODY');
  });
});
