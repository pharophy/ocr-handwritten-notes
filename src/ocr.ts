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

// ============================================================================
// Constants
// ============================================================================

// Image preprocessing constants (exported for use in validation pipeline)
export const PREPROCESSING_WIDTH = 1600;           // Max width for preprocessed images
export const PREPROCESSING_HEIGHT = 7000;          // Max height for preprocessed images
export const PREPROCESSING_QUALITY = 95;           // Initial JPEG quality before compression
export const PREPROCESSING_SHARPEN_SIGMA = 1.0;    // Sharpening intensity

// Compression quality levels (progressive reduction)
export const COMPRESSION_QUALITY_HIGH = 90;        // First attempt
export const COMPRESSION_QUALITY_MEDIUM = 80;      // Second attempt
// Third attempt uses minQuality parameter (default: DEFAULT_COMPRESSION_MIN_QUALITY)

// Default compression configuration
export const DEFAULT_COMPRESSION_MAX_SIZE_MB = 5;  // Claude 4.6 Sonnet limit
export const DEFAULT_COMPRESSION_MIN_QUALITY = 70; // Minimum acceptable quality (third attempt)

// Unit conversion constants (exported for use in other modules)
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * 1024;
export const CONFIDENCE_TO_PERCENT = 100;  // Multiply 0.0-1.0 confidence by 100 for percentage

// Display formatting constants (exported for use in other modules)
export const SIZE_DECIMAL_PLACES = 2;      // Decimal places for MB size display
export const RATIO_DECIMAL_PLACES = 2;     // Decimal places for compression ratio display
export const PERCENT_DECIMAL_PLACES = 1;   // Decimal places for percentage display (with decimals)
export const PERCENT_WHOLE_NUMBER = 0;     // Decimal places for percentage display (whole numbers)

// OCR quality assessment thresholds
const ILLEGIBLE_THRESHOLD_PERCENT = 0.15;           // 15% illegible markers triggers poor quality
const CONSECUTIVE_ILLEGIBLE_THRESHOLD = 5;          // 5+ consecutive illegibles triggers poor quality
const CONSECUTIVE_THRESHOLD_DEFAULT = 1;            // Default for env var OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD
const MIN_OUTPUT_LENGTH = 50;                       // Minimum expected output length
const MIN_IMAGE_SIZE_BYTES = 100000;                // Minimum image size (100KB) for quality assessment
const ILLEGIBLE_PATTERN = /\*\[illegible\]\*/g;

// ============================================================================
// Cache
// ============================================================================

// Cache the handwriting reference and AI provider to avoid loading on every OCR call
let cachedReference: HandwritingReferenceConfig | null = null;
let cachedReferenceImage: Buffer | null = null;
let cachedProvider: AIProvider | null = null;
let referenceLoaded = false;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get compression configuration from environment variables
 */
export function getCompressionConfig() {
  return {
    maxSizeBytes: parseInt(process.env.IMAGE_COMPRESSION_MAX_SIZE_MB || String(DEFAULT_COMPRESSION_MAX_SIZE_MB), 10) * BYTES_PER_MB,
    minQuality: parseInt(process.env.IMAGE_COMPRESSION_MIN_QUALITY || String(DEFAULT_COMPRESSION_MIN_QUALITY), 10),
    enabled: process.env.IMAGE_COMPRESSION_ENABLED !== 'false',
  };
}

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
  const illegibleMatches = transcription.match(ILLEGIBLE_PATTERN) || [];
  const illegibleCount = illegibleMatches.length;

  // Remove illegible markers and count remaining words
  const textWithoutIllegibles = transcription.replace(ILLEGIBLE_PATTERN, '');
  const normalWords = textWithoutIllegibles.split(/[\s\n\r,;.!?()[\]{}]+/).filter(w => w.length > 0);

  // Total words = illegible markers + normal words
  const totalWords = illegibleCount + normalWords.length;
  const illegiblePercent = totalWords > 0 ? (illegibleCount / totalWords) * CONFIDENCE_TO_PERCENT : 0;

  // Detect consecutive illegible markers
  const consecutivePattern = new RegExp(`(\\*\\[illegible\\]\\*[\\s\\n\\r]*){${CONSECUTIVE_ILLEGIBLE_THRESHOLD},}`, 'g');
  const consecutiveMatches = transcription.match(consecutivePattern) || [];
  const consecutiveIllegibles = consecutiveMatches.length;

  // Quality thresholds (configurable via env vars with defaults from constants)
  const illegibleThreshold = parseFloat(process.env.OCR_ILLEGIBLE_THRESHOLD || String(ILLEGIBLE_THRESHOLD_PERCENT * CONFIDENCE_TO_PERCENT));
  const consecutiveThreshold = parseInt(process.env.OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD || String(CONSECUTIVE_THRESHOLD_DEFAULT), 10);
  const minLengthThreshold = parseInt(process.env.OCR_MIN_LENGTH_THRESHOLD || String(MIN_OUTPUT_LENGTH), 10);
  const minImageSize = parseInt(process.env.OCR_MIN_IMAGE_SIZE || String(MIN_IMAGE_SIZE_BYTES), 10);

  // Check quality criteria
  let isPoorQuality = false;
  let reason: string | undefined;

  if (illegiblePercent > illegibleThreshold) {
    isPoorQuality = true;
    reason = `High illegible percentage: ${illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}% (threshold: ${illegibleThreshold}%)`;
  } else if (consecutiveIllegibles >= consecutiveThreshold) {
    isPoorQuality = true;
    reason = `Consecutive illegible markers detected: ${consecutiveIllegibles} occurrences (threshold: ${consecutiveThreshold})`;
  } else if (outputLength < minLengthThreshold && imageSize > minImageSize) {
    isPoorQuality = true;
    reason = `Output too short: ${outputLength} chars for ${(imageSize / BYTES_PER_KB).toFixed(PERCENT_DECIMAL_PLACES)}KB image (threshold: ${minLengthThreshold} chars)`;
  }

  return {
    isPoorQuality,
    illegiblePercent,
    consecutiveIllegibles,
    outputLength,
    reason,
  };
}

/**
 * Compression metrics returned when an image is compressed
 */
export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  quality: number;
  ratio: number;
}

/**
 * Result of image compression operation
 */
export interface CompressionResult {
  buffer: Buffer;
  compressed: boolean;
  metrics?: CompressionMetrics;
}

/**
 * Compress image if it exceeds target size using progressive quality reduction
 *
 * @param buffer - Image buffer to compress
 * @param targetSizeBytes - Maximum allowed size in bytes (default: 5MB)
 * @param minQuality - Minimum JPEG quality to try (default: 70)
 * @returns Compression result with buffer and metrics
 */
export async function compressImageIfNeeded(
  buffer: Buffer,
  targetSizeBytes: number = DEFAULT_COMPRESSION_MAX_SIZE_MB * BYTES_PER_MB,
  minQuality: number = DEFAULT_COMPRESSION_MIN_QUALITY
): Promise<CompressionResult> {
  const originalSize = buffer.length;

  // Check if compression is needed
  if (originalSize <= targetSizeBytes) {
    return {
      buffer,
      compressed: false,
    };
  }

  // Progressive quality reduction: high → medium → minimum
  const qualityLevels = [COMPRESSION_QUALITY_HIGH, COMPRESSION_QUALITY_MEDIUM, minQuality];

  for (const quality of qualityLevels) {
    try {
      const compressedBuffer = await sharp(buffer)
        .jpeg({ quality })
        .toBuffer();

      const compressedSize = compressedBuffer.length;

      if (compressedSize <= targetSizeBytes) {
        const metrics: CompressionMetrics = {
          originalSize,
          compressedSize,
          quality,
          ratio: originalSize / compressedSize,
        };

        // Log compression success
        console.log(
          `✓ Image compressed: ${(originalSize / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES)}MB → ${(compressedSize / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES)}MB ` +
          `(quality=${quality}, ratio=${metrics.ratio.toFixed(RATIO_DECIMAL_PLACES)}x)`
        );

        return {
          buffer: compressedBuffer,
          compressed: true,
          metrics,
        };
      }
    } catch (error: any) {
      console.error(`Failed to compress at quality ${quality}:`, error.message);
    }
  }

  // If we get here, compression failed even at minimum quality
  const sizeInMB = (originalSize / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES);
  const targetInMB = (targetSizeBytes / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES);

  throw new Error(
    `Image too large to compress: ${sizeInMB}MB exceeds ${targetInMB}MB limit even at quality=${minQuality}.\n` +
    `Please resize the image manually to reduce file size before processing.`
  );
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
    // Ensure dimensions are within provider limits
    const preprocessedBuffer = await sharp(imageBuffer)
      .grayscale()
      .resize({ width: PREPROCESSING_WIDTH, height: PREPROCESSING_HEIGHT, fit: 'inside' })
      .normalize()
      .sharpen({ sigma: PREPROCESSING_SHARPEN_SIGMA })
      .jpeg({ quality: PREPROCESSING_QUALITY })  // High quality initial conversion, compression will reduce if needed
      .toBuffer();

    // Compress image if needed (for images >5MB)
    const compressionConfig = getCompressionConfig();
    let finalBuffer = preprocessedBuffer;

    if (compressionConfig.enabled) {
      const compressionResult = await compressImageIfNeeded(
        preprocessedBuffer,
        compressionConfig.maxSizeBytes,
        compressionConfig.minQuality
      );
      finalBuffer = compressionResult.buffer;

      // Log compression if it occurred
      if (compressionResult.compressed && compressionResult.metrics) {
        const { originalSize, compressedSize, quality, ratio } = compressionResult.metrics;
        console.log(`✓ Image compressed: ${(originalSize / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES)}MB → ${(compressedSize / BYTES_PER_MB).toFixed(SIZE_DECIMAL_PLACES)}MB (quality=${quality}, ratio=${ratio.toFixed(RATIO_DECIMAL_PLACES)}x)`);
      }
    }

    const base64Image = finalBuffer.toString('base64');
    const mime = 'image/jpeg'; // Always JPEG after preprocessing

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
      illegiblePercent: `${primaryQuality.illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
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
          illegiblePercent: `${fallbackQuality.illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
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
