import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stripStruckText, summarizeText, resetSummarizeCacheForTests } from '../src/summarize';

// fix-ocr-fidelity 2.23 (struck text never reaches the summary) and 2.24 (no invented decisions).

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
    models: { summarization: 'gpt-4o-mini' },
  }),
}));

describe('2.23 stripStruckText', () => {
  it('removes a struck AI: line entirely', () => {
    expect(stripStruckText('- keep one\n  - ~~AI: placeholder struck~~\n- keep two')).toBe('- keep one\n- keep two');
  });

  it('removes a struck span inside a line and keeps the rest', () => {
    expect(stripStruckText('- keep ~~dropped words~~ this')).toBe('- keep this');
  });

  it('leaves text without strikethrough unchanged', () => {
    expect(stripStruckText('- a item\n\n- b item')).toBe('- a item\n\n- b item');
  });
});

describe('2.24 Key Decisions only when explicit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSummarizeCacheForTests();
    mockCreate.mockResolvedValue({ model: 'gpt-4o-mini', choices: [{ message: { content: 'summary' } }] });
  });

  it('limits decisions to explicitly recorded ones with an exact fallback line', async () => {
    await summarizeText('- placeholder discussion point');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('No explicit decisions recorded.');
    expect(prompt).toMatch(/only decisions .*explicitly/i);
    expect(prompt).not.toMatch(/Key Decisions: final or important decisions/);
  });
});
