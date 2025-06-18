import path from 'path';
import OpenAI from 'openai';
import sharp from 'sharp';
import { OPEN_AI_KEY } from './utils';

const openai = new OpenAI({
  apiKey: OPEN_AI_KEY
});

export async function processHandwrittenImage(imageBuffer: Buffer, filename: string): Promise<string | null> {
  try {
    // Preprocess the image using sharp
    const preprocessedBuffer = await sharp(imageBuffer)
      .grayscale()                      // Convert to grayscale
      .resize({ width: 1600 })         // Resize to enhance text sharpness
      .normalize()                     // Normalize contrast and brightness
      .sharpen()                       // Enhance edges
      .toBuffer();

    const base64Image = preprocessedBuffer.toString('base64');
    const mime = path.extname(filename).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    const systemPrompt = `
You are a world-class handwriting transcription expert trained in interpreting messy, shorthand, or stylized notes.

Your job is to:
- Accurately transcribe every handwritten word and symbol
- Preserve line breaks, indentation, and lists
- Reconstruct structure and layout (e.g. headers, bullets, arrows, indentation, diagrams)
- Never skip or hallucinate content
- Use text only in your output
- Output exactly what’s visible in the handwriting—no summaries or rewording

Special cases:
- If there are arrows or lines connecting thoughts, describe them using → notation
- If you see diagrams, try to describe them textually
- If the writing is messy or shorthand, do your best to decode it faithfully
`;

    const userPrompt = `
Here is an image of handwritten notes. Please transcribe all content exactly as written.

- Preserve all visible structure: indentation, lists, headings, and diagrams
- If there are bullets or numbered points, format them clearly
- If a word or section is messy or shorthand, do your best to decode it faithfully and then mark it in italic to inform the user it was a best guess
- Do not summarize, paraphrase, or guess the meaning.  Convert a single character and word at a time, don't change words assuming their meaning based on other words it appears next to.
- Include all text — even side notes, marginalia, or partial words

Shorthand conversions:
- If the starts with something like "AI:" or "ALi" convert it to "AI:" as this notation means Action Item
- If a line includes "f/u" convert it to "follow up"
- If a character looks like an 's', use the context of the rest of the word to evaluate if it should be a 'g'
- If a line has all uppercase characters it's an acronym, do not try to change it to a word and keep it in all uppercase in the transcript

Do not skip anything. Transcribe everything that is visible.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime};base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      max_tokens: 5000,
    });

    return response.choices?.[0]?.message?.content?.trim() || null;
  } catch (error: any) {
    console.error('❌ OCR failed:', error?.response?.data || error.message);
    return null;
  }
}
