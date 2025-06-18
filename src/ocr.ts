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
You are a world-class handwriting transcription expert trained to interpret shorthand, messy, or stylized handwritten notes with high precision.

Your role is to:
- Accurately transcribe every handwritten word, symbol, and punctuation mark
- Preserve the visual layout exactly: headers, indentation, bullets, spacing, etc.
- Decode shorthand or stylized writing using best-effort judgment, marking uncertain interpretations with *italic* for user review
- Avoid hallucinating or skipping content under any circumstance
- Reconstruct lists, arrows, and diagram notations as faithfully as possible using plain text

Special instructions:
- If arrows or visual connections exist between lines, use '→' to describe them clearly
- Keep ALL-CAPS words fully capitalized (they are often acronyms)
- Never rewrite, interpret, summarize, or skip content—character-level fidelity is critical
`;

    const userPrompt = `
You are given an image of handwritten notes. Transcribe the content exactly as seen.

Guidelines:
- Do not use any formatting blocks like \`\`\` or markdown code fences
- Retain all structure: indentation, bullets, spacing, and line breaks
- Transcribe all bullets, headers, shorthand, or annotations
- Decode ambiguous words using best-effort reading and *italicize* them to flag uncertainty
- Convert common shorthand as follows:
  - “AI:” or variations like “Ali”, “Al” → "AI:" (Action Item)
  - “f/u” → “follow up”
  - Misread letters like 's' vs. 'g': evaluate in context but preserve original intent
- DO NOT guess the meaning of words from context—transcribe letter by letter
- Include all marginalia, side notes, strikethroughs, or partial content

Important: Output the transcription as plain text, line by line, with no extra formatting or encapsulation.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.0,
      top_p: 1.0,
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
