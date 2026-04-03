import path from 'path';
import sharp from 'sharp';
import { createAIProvider, AIProvider, ProviderType, AIProviderConfig } from './aiProvider';
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

/**
 * Assess the quality of OCR transcription output
 * Returns quality metrics and whether the result is considered poor quality
 */
export function assessOCRQuality(transcription: string, imageSize: number): {
  isPoorQuality: boolean;
  illegiblePercent: number;
  consecutiveIllegibles: number;
  outputLength: number;
  reason?: string;
} {
  const outputLength = transcription.length;

  // Count illegible markers as single units
  const illegibleMatches = transcription.match(/\*\[illegible\]\*/g) || [];
  const illegibleCount = illegibleMatches.length;

  // Remove illegible markers and count remaining words
  const textWithoutIllegibles = transcription.replace(/\*\[illegible\]\*/g, '');
  const normalWords = textWithoutIllegibles.split(/[\s\n\r,;.!?()[\]{}]+/).filter(w => w.length > 0);

  // Total words = illegible markers + normal words
  const totalWords = illegibleCount + normalWords.length;
  const illegiblePercent = totalWords > 0 ? (illegibleCount / totalWords) * 100 : 0;

  // Detect consecutive illegible markers (threshold: 5 or more in a row)
  const consecutivePattern = /(\*\[illegible\]\*[\s\n\r]*){5,}/g;
  const consecutiveMatches = transcription.match(consecutivePattern) || [];
  const consecutiveIllegibles = consecutiveMatches.length;

  // Quality thresholds (configurable via env vars)
  const illegibleThreshold = parseFloat(process.env.OCR_ILLEGIBLE_THRESHOLD || '15');
  const consecutiveThreshold = parseInt(process.env.OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD || '1', 10);
  const minLengthThreshold = parseInt(process.env.OCR_MIN_LENGTH_THRESHOLD || '50', 10);
  const minImageSize = parseInt(process.env.OCR_MIN_IMAGE_SIZE || '100000', 10);

  // Check quality criteria
  let isPoorQuality = false;
  let reason: string | undefined;

  if (illegiblePercent > illegibleThreshold) {
    isPoorQuality = true;
    reason = `High illegible percentage: ${illegiblePercent.toFixed(1)}% (threshold: ${illegibleThreshold}%)`;
  } else if (consecutiveIllegibles >= consecutiveThreshold) {
    isPoorQuality = true;
    reason = `Consecutive illegible markers detected: ${consecutiveIllegibles} occurrences (threshold: ${consecutiveThreshold})`;
  } else if (outputLength < minLengthThreshold && imageSize > minImageSize) {
    isPoorQuality = true;
    reason = `Output too short: ${outputLength} chars for ${(imageSize / 1024).toFixed(1)}KB image (threshold: ${minLengthThreshold} chars)`;
  }

  return {
    isPoorQuality,
    illegiblePercent,
    consecutiveIllegibles,
    outputLength,
    reason,
  };
}

export async function processHandwrittenImage(imageBuffer: Buffer, filename: string): Promise<{ text: string; modelUsed: string } | null> {
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
    // Ensure dimensions are within provider limits (Claude: 8000px, OpenAI: generally larger but we use 7000 to be safe)
    const preprocessedBuffer = await sharp(imageBuffer)
      .grayscale()                                          // Convert to grayscale
      .resize({ width: 1600, height: 7000, fit: 'inside' }) // Resize while maintaining aspect ratio, limit both dimensions
      .normalize()                                          // Normalize contrast and brightness
      .sharpen({ sigma: 1.0 })                              // Enhance edges slightly
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

    const primaryResult = response.content || null;
    if (!primaryResult) {
      return null;
    }

    // Assess primary OCR quality
    const primaryQuality = assessOCRQuality(primaryResult, imageBuffer.length);

    console.log(`📊 OCR Quality Assessment:`, {
      illegiblePercent: `${primaryQuality.illegiblePercent.toFixed(1)}%`,
      consecutiveIllegibles: primaryQuality.consecutiveIllegibles,
      outputLength: primaryQuality.outputLength,
      isPoorQuality: primaryQuality.isPoorQuality,
    });

    // Check if fallback is needed and configured
    const fallbackModel = cachedProvider!.getProviderConfig().models?.ocrFallback;

    if (primaryQuality.isPoorQuality && fallbackModel && fallbackModel !== 'none' && fallbackModel !== '') {
      console.log(`⚠️  Primary quality poor (${primaryQuality.reason}), trying fallback: ${fallbackModel}`);

      try {
        // Get current provider config
        const currentConfig = cachedProvider!.getProviderConfig();

        // With simplified provider types, fallback is easy:
        // - If using HAI, it can handle any model (Claude or OpenAI)
        // - If using OpenAI direct, check if fallback needs HAI
        let fallbackProviderType: ProviderType;
        let fallbackBaseURL: string | undefined;

        if (currentConfig.type === ProviderType.HAI) {
          // HAI can handle both Claude and OpenAI models dynamically
          fallbackProviderType = ProviderType.HAI;
          fallbackBaseURL = currentConfig.baseURL;
        } else if (currentConfig.type === ProviderType.OPENAI) {
          // Direct OpenAI - check if fallback is Claude (needs HAI)
          if (fallbackModel.startsWith('anthropic--')) {
            // Need to switch to HAI for Claude model
            fallbackProviderType = ProviderType.HAI;
            fallbackBaseURL = `http://localhost:${process.env.HAI_PROXY_PORT || '6655'}`;
          } else {
            // OpenAI fallback, can use direct
            fallbackProviderType = ProviderType.OPENAI;
            fallbackBaseURL = currentConfig.baseURL;
          }
        } else {
          // Unknown provider type
          console.log(`⚠️  Unknown provider type: ${currentConfig.type}, skipping fallback`);
          console.log(`✓ Primary model succeeded: ${response.model}`);
          return { text: primaryResult, modelUsed: response.model };
        }

        // Create fallback provider config by copying current config
        const fallbackConfig: AIProviderConfig = {
          type: fallbackProviderType,
          apiKey: currentConfig.apiKey,
          baseURL: fallbackBaseURL,
          models: { ocr: fallbackModel },
          autoStartProxy: currentConfig.autoStartProxy,
        };

        // Create fallback provider and run OCR
        const fallbackProvider = createAIProvider(fallbackConfig);
        const fallbackResponse = await fallbackProvider.generateVisionCompletion(
          combinedPrompt,
          base64Image,
          mime,
          'ocr'
        );

        const fallbackResult = fallbackResponse.content || null;
        if (!fallbackResult) {
          console.log(`❌ Fallback model returned no result, using primary result`);
          return { text: primaryResult, modelUsed: `${response.model} (primary)` };
        }

        // Assess fallback quality
        const fallbackQuality = assessOCRQuality(fallbackResult, imageBuffer.length);
        console.log(`✓ Fallback model succeeded: ${fallbackResponse.model}`);
        console.log(`📊 Fallback Quality Assessment:`, {
          illegiblePercent: `${fallbackQuality.illegiblePercent.toFixed(1)}%`,
          consecutiveIllegibles: fallbackQuality.consecutiveIllegibles,
          outputLength: fallbackQuality.outputLength,
          isPoorQuality: fallbackQuality.isPoorQuality,
        });

        if (fallbackQuality.isPoorQuality) {
          console.log(`⚠️  Both models produced poor quality, returning fallback result`);
        }

        // Always return fallback result when fallback was triggered
        return { text: fallbackResult, modelUsed: `${fallbackResponse.model} (fallback from ${response.model})` };

      } catch (fallbackError: any) {
        console.error(`❌ Fallback model API error: ${fallbackError?.response?.data || fallbackError.message}, returning primary result`);
        return { text: primaryResult, modelUsed: `${response.model} (primary, fallback failed)` };
      }
    }

    console.log(`✓ Primary model succeeded: ${response.model}`);
    return { text: primaryResult, modelUsed: response.model };
  } catch (error: any) {
    console.error('❌ OCR failed:', error?.response?.data || error.message);
    return null;
  }
}
