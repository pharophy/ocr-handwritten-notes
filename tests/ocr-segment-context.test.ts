import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processHandwrittenImage, resetOCRCacheForTests } from '../src/ocr';
import { syntheticPage } from './helpers/syntheticPage';

// fix-ocr-fidelity 2.9: segment N>1 is told the nesting of the lines just above it.

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

function promptOfCall(i: number): string {
  return mockCreate.mock.calls[i][0].messages[0].content
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('\n');
}

describe('2.9 previous-segment nesting context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOCRCacheForTests();
    let n = 0;
    mockCreate.mockImplementation(async (req: any) => {
      const i = n++;
      const content = i === 0
        ? '- placeholder parent\n  - placeholder child one\n    - placeholder grandchild deep'
        : `- placeholder segment ${i} first\n  - placeholder segment ${i} second`;
      return { model: req.model, choices: [{ message: { content } }] };
    });
  });

  it('gives segment 2 the last stitched lines with their indentation as nesting context', async () => {
    await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
    const second = promptOfCall(1);
    expect(second).toContain('    - placeholder grandchild deep');
    expect(second).toContain('  - placeholder child one');
    expect(second).toMatch(/nesting context/i);
    expect(second).toMatch(/transcribe every line/i);
  });

  it('does not add context to the first segment', async () => {
    await processHandwrittenImage(await syntheticPage(1000, 2400), 'tall.jpg');
    expect(promptOfCall(0)).not.toMatch(/nesting context/i);
  });
});
