import { createAIProvider, AIProvider } from './aiProvider';
import { loadHandwritingReference, loadAIProviderConfig } from './handwritingReference';

// Cache the AI provider
let cachedProvider: AIProvider | null = null;

async function getProvider(): Promise<AIProvider> {
  if (!cachedProvider) {
    const referenceConfig = await loadHandwritingReference();
    const providerConfig = await loadAIProviderConfig(referenceConfig);
    cachedProvider = createAIProvider(providerConfig);
  }
  return cachedProvider;
}

export async function summarizeText(text: string): Promise<string> {
  try {
    const provider = await getProvider();

    const prompt = `You are an expert meeting assistant. Use the following meeting notes to produce a structured summary with 5 sections:

- Summary: 3–5 sentence paragraph on key themes
- Action Items: ONLY extract lines that explicitly start with "AI:" in the original notes. These are explicit action items. List them as bullet points. If there are no "AI:" lines in the notes, write "No explicit action items marked."
- Key Learnings: insights or takeaways
- Key Decisions: final or important decisions
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

