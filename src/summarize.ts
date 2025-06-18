import OpenAI from 'openai';
import { OPEN_AI_KEY } from './utils';

const openai = new OpenAI({
    apiKey: OPEN_AI_KEY
  });


export async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting assistant. Use the following meeting notes to produce a structured summary with 5 sections:

- Summary: 3–5 sentence paragraph on key themes
- Action Items: bullet list starting with "AI: ..."
- Key Learnings: insights or takeaways
- Key Decisions: final or important decisions
- Tags: open-ended hashtags (e.g., #Growth, #Planning)

Keep it clear and concise.`,
        },
        {
          role: 'user',
          content: `Meeting Transcript:\n"""${text}"""`,
        },
      ],
      temperature: 0.3,
    });

    return response.choices?.[0]?.message?.content?.trim() || 'no summary';
  } catch (e: any) {
    console.error('❌ Summary generation failed:', e.message);
    return 'Error generating summary.';
  }
}
