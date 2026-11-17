import { createAIProvider, AIProvider } from './aiProvider';
import { loadHandwritingReference, loadAIProviderConfig } from './handwritingReference';

// Cache the AI provider
let cachedProvider: AIProvider | null = null;

export function resetSummarizeCacheForTests(): void {
  cachedProvider = null;
}

async function getProvider(): Promise<AIProvider> {
  if (!cachedProvider) {
    const referenceConfig = await loadHandwritingReference();
    const providerConfig = await loadAIProviderConfig(referenceConfig);
    cachedProvider = createAIProvider(providerConfig);
  }
  return cachedProvider;
}

/**
 * Remove struck-out text (`~~…~~`) so crossed-out notes never reach the summary.
 * A line left with only a bullet marker (or nothing) is dropped.
 */
export function stripStruckText(text: string): string {
  return text
    .split('\n')
    .flatMap(line => {
      if (!line.includes('~~')) return [line];
      const stripped = line.replace(/~~[^~]*~~/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '');
      return /^\s*([-•*+]|\d+[.)])?\s*$/.test(stripped) ? [] : [stripped];
    })
    .join('\n');
}

/**
 * The text a summary is built from: the final transcription only, with struck
 * text and the OCR incompleteness warning callout removed.
 */
export function summaryInputFrom(transcription: string): string {
  const lines = transcription.split('\n');
  let i = 0;
  if (lines[0]?.startsWith('> [!warning]')) {
    while (i < lines.length && lines[i].startsWith('>')) i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return stripStruckText(lines.slice(i).join('\n'));
}

export async function summarizeText(text: string): Promise<string> {
  try {
    const provider = await getProvider();

    const prompt = `You are an expert meeting assistant. Use the following meeting notes to produce a structured summary with 5 sections:

- Summary: 3–5 sentence paragraph on key themes
- Action Items: ONLY extract lines that explicitly start with "AI:" in the original notes. These are explicit action items. List them as bullet points. If there are no "AI:" lines in the notes, write "No explicit action items marked."
- Key Learnings: insights or takeaways
- Key Decisions: only decisions the notes explicitly record as decided (for example "decided", "agreed", "decision:"). Do not restate discussion points, proposals, or open questions as decisions. If the notes record no explicit decision, write exactly: No explicit decisions recorded.
- Tags: open-ended hashtags (e.g., #Growth, #Planning)

IMPORTANT: For Action Items, you must ONLY use lines from the original notes that start with "AI:". Do not infer or generate action items from other content. The "AI:" prefix is an explicit marker for action items in the note-taking format.

Keep it clear and concise.

Meeting Transcript:
"""${text}"""`;

    const response = await provider.generateTextCompletion(prompt, 'summarization');

    return response.content || 'no summary';
  } catch (e: any) {
    console.error('❌ Summary generation failed:', e.message);
    return 'Error generating summary.';
  }
}
