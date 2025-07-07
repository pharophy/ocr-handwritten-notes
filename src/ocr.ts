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
- Detect whether handwritten notes are a table or freeform notes.
- Transcribe with high accuracy and exact visual structure.
- Decode shorthand or stylized writing using best-effort judgment, marking uncertain interpretations with *italic* for user review
- Never skip or summarize content.
- Avoid hallucinating or skipping content under any circumstance
- Reconstruct lists, arrows, and diagram notations as faithfully as possible using plain text

Special instructions:
- If arrows or visual connections exist between lines, use '→' to describe them clearly
- Keep ALL-CAPS words fully capitalized (they are often acronyms)
- Never rewrite, interpret, summarize, or skip content—character-level fidelity is critical
`;

    const userPrompt = `
You are a handwriting transcription expert. You are given an image of handwritten notes.

Your task is to transcribe the notes into valid Markdown, preserving the original layout and structure as closely as possible.

---

🧾 Output Requirements:

1. **Detect Layout Type**
   - If the notes clearly contain a table or grid with visible columns, rows, and headings:
     - Use valid Markdown table syntax ('|' for columns, '---' to separate header rows).
     - Keep each handwritten table row as a separate markdown table row.
     - Preserve all visible line breaks inside cells (use '<br>' tags if necessary within a table cell).
   - If the notes are freeform (bullet points, indents, arrows, circled items, etc.):
     - Do **not** use table syntax.
     - Preserve indentation, bullets ('-'), and visual structure faithfully in Markdown.
     - Transcribe arrows as '→'.
     - Mark circled or boxed text clearly (e.g., '(circled)' or '[boxed]').
     - Keep line breaks exactly as in the handwritten notes.

2. **Transcription Accuracy**
   - Transcribe every word, symbol, and punctuation mark precisely.
   - If unclear, use your best guess and wrap it in *italics* for review.
   - Never merge or skip lines.

3. **Formatting Restrictions**
   - Do not use code blocks (no triple backticks).
   - The output must be directly usable in markdown editors like Obsidian or GitHub.
---

🎯 Goal:
Automatically detect whether the image contains a table or freeform notes, then transcribe them into Markdown while preserving the original structure faithfully.
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
