import path from 'path';
import sharp from 'sharp';
import { createAIProvider, AIProvider } from './aiProvider';
import {
  loadHandwritingReference,
  loadReferenceImage,
  formatReferenceWordsForPrompt,
  formatReferenceImageInstructions,
  referenceImageExists,
  getDomainGlossary,
  formatGlossaryContext,
  loadAIProviderConfig,
  type HandwritingReferenceConfig
} from './handwritingReference';

// Cache the handwriting reference and AI provider to avoid loading on every OCR call
let cachedReference: HandwritingReferenceConfig | null = null;
let cachedReferenceImage: Buffer | null = null;
let cachedProvider: AIProvider | null = null;
let referenceLoaded = false;

export async function processHandwrittenImage(imageBuffer: Buffer, filename: string): Promise<string | null> {
  try {
    // Load handwriting reference and AI provider (cached after first load)
    if (!referenceLoaded) {
      cachedReference = await loadHandwritingReference();

      // Load AI provider configuration
      const providerConfig = await loadAIProviderConfig(cachedReference);
      cachedProvider = createAIProvider(providerConfig);

      // Try to load reference image if path is specified
      if (cachedReference.referenceImagePath) {
        const imageExists = await referenceImageExists(cachedReference.referenceImagePath);
        if (imageExists) {
          cachedReferenceImage = await loadReferenceImage(cachedReference.referenceImagePath);
        }
      }

      referenceLoaded = true;
    }

    // Preprocess the image using sharp
    const preprocessedBuffer = await sharp(imageBuffer)
      .grayscale()                      // Convert to grayscale
      .resize({ width: 1600 })         // Resize to enhance text sharpness
      .normalize()                     // Normalize contrast and brightness
      .sharpen({ sigma: 1.0 })         // Enhance edges slightly
      .toBuffer();

    const base64Image = preprocessedBuffer.toString('base64');
    const mime = path.extname(filename).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    // Get domain glossary from cached reference
    const glossary = getDomainGlossary(cachedReference || {});

    const systemPrompt = `
You are a handwriting transcription expert. Your role is to accurately transcribe handwritten notes exactly as they appear.

Key principles:
- Transcribe every word, symbol, and punctuation mark precisely as written
- Preserve the exact visual layout: indentation, bullets, spacing, line breaks
- If text is unclear, make your best educated guess using context from the domain glossary below
- Only mark a word as uncertain with *italics* if you truly cannot read it
- Keep ALL-CAPS words fully capitalized (they are often acronyms)
- Transcribe arrows as '→'
- Never skip, merge, or summarize content
- Do not add interpretation, structure, or formatting beyond what is clearly visible

IMPORTANT - Common handwriting confusion patterns to watch for:
- "home" vs "book" - in context of living/vacation, likely "home"
- "sign" vs "issues" - in context of contracts/agreements, likely "sign"
- "upfront" vs "customer" - in context of payments/money, likely "upfront"
- Numbers: "2/26" means February 26th, not "3/26"

${cachedReferenceImage ? formatReferenceImageInstructions() : ''}
${!cachedReferenceImage && cachedReference ? formatReferenceWordsForPrompt(cachedReference) : ''}
${formatGlossaryContext(glossary)}
`;

    const userPrompt = `
Transcribe the handwritten notes in this image into Markdown, preserving the original structure.

Requirements:
- Transcribe every word and symbol exactly as written
- Preserve indentation, bullets, and line breaks
- Use '-' for bullet points
- Use '→' for arrows
- Keep acronyms in ALL-CAPS
- Only use *italics* for truly illegible words
- Do not add structure or formatting beyond what is clearly visible
- Output only the transcribed text, no explanation
`;

    // Build combined prompt including reference image context if available
    let combinedPrompt = systemPrompt + '\n\n' + userPrompt;

    // For providers that support vision with multiple images (OpenAI), we can include the reference image
    // For now, we'll use a single-image approach that works with all providers
    const response = await cachedProvider!.generateVisionCompletion(
      combinedPrompt,
      base64Image,
      mime,
      'ocr'
    );

    return response.content || null;
  } catch (error: any) {
    console.error('❌ OCR failed:', error?.response?.data || error.message);
    return null;
  }
}
