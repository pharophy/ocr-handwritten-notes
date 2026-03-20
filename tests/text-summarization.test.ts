import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeText } from '../src/summarize';

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate
        }
      };
    },
    mockCreate // Export for tests to use
  };
});

// Get the mock function after mocking
const OpenAI = await import('openai');
const mockCreate = (OpenAI as any).mockCreate;

// Mock utilities
vi.mock('../src/utils', () => ({
  OPEN_AI_KEY: 'test-key'
}));

describe('Text Summarization Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: `## Summary
Test summary content.

## Action Items
- AI: Test action

## Key Learnings
Test learning.

## Key Decisions
Test decision.

## Tags
#Test`
        }
      }]
    });
  });

  describe('Requirement: Meeting notes summarization', () => {
    it('Scenario: Standard summary generation - should generate structured summary', async () => {
      const inputText = 'Meeting notes about project planning';
      const result = await summarizeText(inputText);

      expect(mockCreate).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result).toContain('## Summary');
    });
  });

  describe('Requirement: Summary structure', () => {
    it('Scenario: Summary section - should contain 3-5 sentence paragraph', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('3–5 sentence paragraph on key themes');
    });

    it('Scenario: Action items section - should prefix items with "AI:"', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Action Items: bullet list starting with "AI: ..."');
    });

    it('Scenario: Key learnings section - should extract insights and takeaways', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Key Learnings');
    });

    it('Scenario: Key decisions section - should list final decisions', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Key Decisions');
    });

    it('Scenario: Tags section - should provide contextual hashtags', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Tags: open-ended hashtags');
    });
  });

  describe('Requirement: AI model usage for summarization', () => {
    it('Scenario: Model selection - should use gpt-4o-mini with temperature 0.3', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.3);
    });
  });

  describe('Requirement: Summary error handling', () => {
    it('Scenario: Summarization API failure - should return error message', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await summarizeText('test input');

      expect(result).toBe('Error generating summary.');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('Scenario: Empty summary response - should return "no summary"', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }]
      });

      const result = await summarizeText('test input');

      expect(result).toBe('no summary');
    });
  });

  describe('Requirement: Summary clarity and conciseness', () => {
    it('Scenario: Summary brevity - should focus on actionable information', async () => {
      await summarizeText('test input');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('clear and concise');
    });
  });
});
