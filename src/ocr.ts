import path from 'path';
import sharp from 'sharp';
import { createAIProvider, AIProvider, AIProviderConfig, ModelType } from './aiProvider';
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
export const PREPROCESSING_WIDTH = 1600;           // Max width for preprocessed images (height is uncapped; tall pages are segmented instead)
export const PREPROCESSING_QUALITY = 95;           // Initial JPEG quality before compression
export const PREPROCESSING_SHARPEN_SIGMA = 1.0;    // Sharpening intensity

// Vertical segmentation for tall images.
// Very tall pages (long notes, stitched scans) get downsampled to illegibility when
// sent to a vision model as a single image, which causes it to hallucinate plausible
// but incorrect text. Instead we split them into full-resolution vertical segments,
// OCR each, and stitch the results back together.
export const SEGMENT_MAX_HEIGHT = 2200;            // Max pixel height per OCR segment
export const SEGMENT_OVERLAP = 200;                // Vertical overlap between segments (px) so lines aren't clipped at boundaries

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
const ILLEGIBLE_THRESHOLD_PERCENT = 0.15;           // 15% illegible markers (legacy)
const UNCERTAIN_THRESHOLD_PERCENT = 0.30;           // 30% total uncertainty (illegible + italic) triggers poor quality
const CONSECUTIVE_ILLEGIBLE_THRESHOLD = 5;          // 5+ consecutive illegibles triggers poor quality
const CONSECUTIVE_THRESHOLD_DEFAULT = 1;            // Default for env var OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD
const MIN_OUTPUT_LENGTH = 50;                       // Minimum expected output length
const MIN_IMAGE_SIZE_BYTES = 100000;                // Minimum image size (100KB) for quality assessment
const ILLEGIBLE_PATTERN = /\*\[illegible\]\*/g;
const ITALIC_PATTERN = /\*([^[\]]+?)\*/g;           // Pattern for italic markers (*word*)

// ============================================================================
// Cache
// ============================================================================

// Cache the handwriting reference and AI provider to avoid loading on every OCR call
let cachedReference: HandwritingReferenceConfig | null = null;
let cachedReferenceImage: Buffer | null = null;
let cachedProvider: AIProvider | null = null;
let referenceLoaded = false;

export function resetOCRCacheForTests(): void {
  cachedReference = null;
  cachedReferenceImage = null;
  cachedProvider = null;
  referenceLoaded = false;
}

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
  italicPercent: number;
  uncertainPercent: number;
  consecutiveIllegibles: number;
  outputLength: number;
  reason?: string;
} {
  const outputLength = transcription.length;

  // Check if legacy quality check is enabled (disables italic detection)
  const useLegacyCheck = process.env.OCR_LEGACY_QUALITY_CHECK === 'true';

  // Count illegible markers as single units
  const illegibleMatches = transcription.match(ILLEGIBLE_PATTERN) || [];
  const illegibleCount = illegibleMatches.length;

  // Count italic markers (*word*) - but not illegible markers
  let italicCount = 0;
  if (!useLegacyCheck) {
    const textWithoutIllegibles = transcription.replace(ILLEGIBLE_PATTERN, '');
    const italicMatches = textWithoutIllegibles.match(ITALIC_PATTERN) || [];
    italicCount = italicMatches.length;
  }

  // Remove both illegible and italic markers to count remaining words
  const textWithoutMarkers = transcription
    .replace(ILLEGIBLE_PATTERN, '')
    .replace(ITALIC_PATTERN, '$1'); // Keep the word but remove asterisks
  const normalWords = textWithoutMarkers.split(/[\s\n\r,;.!?()[\]{}]+/).filter(w => w.length > 0);

  // Total words = illegible markers + italic markers + normal words
  const totalWords = illegibleCount + italicCount + normalWords.length;
  const illegiblePercent = totalWords > 0 ? (illegibleCount / totalWords) * CONFIDENCE_TO_PERCENT : 0;
  const italicPercent = totalWords > 0 ? (italicCount / totalWords) * CONFIDENCE_TO_PERCENT : 0;
  const uncertainPercent = illegiblePercent + italicPercent;

  // Detect consecutive illegible markers
  const consecutivePattern = new RegExp(`(\\*\\[illegible\\]\\*[\\s\\n\\r]*){${CONSECUTIVE_ILLEGIBLE_THRESHOLD},}`, 'g');
  const consecutiveMatches = transcription.match(consecutivePattern) || [];
  const consecutiveIllegibles = consecutiveMatches.length;

  // Quality thresholds (configurable via env vars with defaults from constants)
  const uncertainThreshold = parseFloat(process.env.OCR_UNCERTAIN_THRESHOLD || String(UNCERTAIN_THRESHOLD_PERCENT * CONFIDENCE_TO_PERCENT));
  const consecutiveThreshold = parseInt(process.env.OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD || String(CONSECUTIVE_THRESHOLD_DEFAULT), 10);
  const minLengthThreshold = parseInt(process.env.OCR_MIN_LENGTH_THRESHOLD || String(MIN_OUTPUT_LENGTH), 10);
  const minImageSize = parseInt(process.env.OCR_MIN_IMAGE_SIZE || String(MIN_IMAGE_SIZE_BYTES), 10);

  // Check quality criteria
  let isPoorQuality = false;
  let reason: string | undefined;

  if (uncertainPercent > uncertainThreshold) {
    isPoorQuality = true;
    reason = `High uncertainty: ${uncertainPercent.toFixed(PERCENT_DECIMAL_PLACES)}% (${illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}% illegible + ${italicPercent.toFixed(PERCENT_DECIMAL_PLACES)}% italic, threshold: ${uncertainThreshold}%)`;
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
    italicPercent,
    uncertainPercent,
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

/**
 * Post-process OCR output to condense multi-line bullets
 * Combines continuation lines within the same bullet point
 */
export function condenseBulletLines(text: string): string {
  const lines = text.split('\n');
  const condensed: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line - keep as is
    if (trimmed === '') {
      condensed.push(line);
      i++;
      continue;
    }

    // Check if this is a bullet line (starts with -, •, *, or #)
    const isBullet = /^[-•*#]/.test(trimmed);

    if (isBullet) {
      // This is a bullet - collect all continuation lines
      let bulletContent = line;
      let j = i + 1;

      // Look ahead for continuation lines (indented, not a new bullet)
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();

        // Stop at empty line
        if (nextTrimmed === '') {
          break;
        }

        // Stop if next line is a new bullet at same or less indentation
        const nextIsBullet = /^[-•*#]/.test(nextTrimmed);
        const currentIndent = line.length - line.trimStart().length;
        const nextIndent = nextLine.length - nextLine.trimStart().length;

        if (nextIsBullet && nextIndent <= currentIndent) {
          break;
        }

        // This is a continuation - append to current bullet
        bulletContent += ' ' + nextTrimmed;
        j++;
      }

      condensed.push(bulletContent);
      i = j;
    } else {
      // Not a bullet - keep as is
      condensed.push(line);
      i++;
    }
  }

  return condensed.join('\n');
}

/**
 * Preprocess a source image for OCR.
 *
 * Caps the WIDTH only (preserving aspect ratio, never enlarging) so tall pages are
 * never squished or downsampled to illegibility to fit a height box. Height is handled
 * downstream by vertical segmentation, which keeps handwriting at full resolution.
 * Shared by the primary OCR path and the correction path so both send the model the
 * same, legible imagery.
 */
export async function preprocessImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .grayscale()
    .resize({ width: PREPROCESSING_WIDTH, fit: 'inside', withoutEnlargement: true })
    .normalize()
    .sharpen({ sigma: PREPROCESSING_SHARPEN_SIGMA })
    .jpeg({ quality: PREPROCESSING_QUALITY })  // High quality initial conversion, compression will reduce if needed
    .toBuffer();
}

/**
 * Split a (preprocessed) image into full-resolution vertical segments.
 *
 * Segments overlap by `overlap` pixels so a line of text straddling a boundary
 * appears intact in at least one segment. Returns a single-element array when the
 * image is short enough to OCR in one pass.
 */
export async function segmentImageVertically(
  buffer: Buffer,
  maxHeight: number = SEGMENT_MAX_HEIGHT,
  overlap: number = SEGMENT_OVERLAP
): Promise<Buffer[]> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height || height <= maxHeight) {
    return [buffer];
  }

  const step = Math.max(1, maxHeight - overlap);
  const segments: Buffer[] = [];

  for (let top = 0; top < height; top += step) {
    const segHeight = Math.min(maxHeight, height - top);
    if (segHeight <= 0) break;

    const segment = await sharp(buffer)
      .extract({ left: 0, top, width, height: segHeight })
      .jpeg({ quality: PREPROCESSING_QUALITY })
      .toBuffer();
    segments.push(segment);

    if (top + segHeight >= height) break;
  }

  return segments;
}

/**
 * Split text into lines with leading/trailing blank lines removed.
 */
function toTrimmedLines(text: string): string[] {
  const lines = text.split('\n');
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}

/**
 * Number of trailing lines of `prev` that equal the leading lines of `next`
 * (compared by trimmed content). Prefers the largest match so a multi-line
 * overlap block is removed as a single unit instead of leaving interior
 * duplicates behind.
 */
function overlapLineCount(prev: string[], next: string[]): number {
  const max = Math.min(prev.length, next.length);
  for (let k = max; k > 0; k--) {
    let match = true;
    for (let j = 0; j < k; j++) {
      if (prev[prev.length - k + j].trim() !== next[j].trim()) {
        match = false;
        break;
      }
    }
    if (match) return k;
  }
  return 0;
}

/**
 * Stitch per-segment transcriptions into a single document.
 *
 * Segments overlap vertically, so a block of lines can be transcribed at the end
 * of one segment and again at the start of the next. We splice each incoming
 * segment onto the accumulated output at the largest matching line-block boundary,
 * which removes the overlap block as a unit (however many lines it spans) while
 * leaving legitimately repeated lines *within* a segment untouched.
 */
export function stitchSegmentTranscriptions(parts: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    const lines = toTrimmedLines(part);
    if (lines.length === 0) continue; // empty / whitespace-only segment
    if (out.length === 0) {
      out.push(...lines);
      continue;
    }
    const overlap = overlapLineCount(out, lines);
    out.push(...lines.slice(overlap));
  }

  return out.join('\n');
}

/**
 * Inspect per-segment transcriptions for missing text.
 *
 * An empty *interior* segment (any index except the last) means a middle band of
 * the page produced no text — almost always a failed/truncated OCR call rather
 * than genuinely blank paper, so the transcription is flagged `incomplete`. An
 * empty *final* segment is common (blank trailing page space) and does not, on
 * its own, mark the result incomplete.
 */
export function findEmptySegments(parts: string[]): { emptyIndices: number[]; incomplete: boolean } {
  const emptyIndices: number[] = [];
  parts.forEach((part, i) => {
    if (part.trim() === '') emptyIndices.push(i);
  });
  const lastIndex = parts.length - 1;
  const incomplete = emptyIndices.some(i => i !== lastIndex);
  return { emptyIndices, incomplete };
}

/**
 * Transcribe a preprocessed image with the given provider, segmenting tall images
 * into vertical strips so nothing is lost to downsampling. Returns an AIResponse-like
 * object so callers can treat single- and multi-segment paths uniformly.
 */
async function transcribeImage(
  provider: AIProvider,
  preprocessedBuffer: Buffer,
  prompt: string,
  modelType: ModelType
): Promise<{ content: string; model: string; incomplete: boolean }> {
  const compressionConfig = getCompressionConfig();
  const segments = await segmentImageVertically(preprocessedBuffer);

  if (segments.length > 1) {
    console.log(`🧩 Tall image split into ${segments.length} vertical segments for OCR`);
  }

  const mime = 'image/jpeg'; // Always JPEG after preprocessing
  const parts: string[] = [];
  let model = '';

  for (let i = 0; i < segments.length; i++) {
    let segmentBuffer = segments[i];

    if (compressionConfig.enabled) {
      const compressionResult = await compressImageIfNeeded(
        segmentBuffer,
        compressionConfig.maxSizeBytes,
        compressionConfig.minQuality
      );
      segmentBuffer = compressionResult.buffer;
    }

    const base64Image = segmentBuffer.toString('base64');
    const segmentPrompt = segments.length > 1
      ? `${prompt}\n\nThis is vertical section ${i + 1} of ${segments.length} of a single page. Transcribe only the text visible in this section. Do not add a title, section number, or any commentary.`
      : prompt;

    const response = await provider.generateVisionCompletion(
      segmentPrompt,
      base64Image,
      mime,
      modelType
    );
    parts.push(response.content || '');
    model = response.model;
  }

  // A single-segment image that comes back empty is handled by the caller's
  // existing empty-content check, so only multi-segment runs are inspected for
  // an interior segment that dropped out.
  const { emptyIndices, incomplete } = findEmptySegments(parts);
  if (emptyIndices.length > 0) {
    console.log(
      `⚠️  ${emptyIndices.length}/${segments.length} segment(s) returned no text (indices: ${emptyIndices.join(', ')})` +
      (incomplete ? ' — marking transcription incomplete so fallback can run' : '')
    );
  }

  return { content: stitchSegmentTranscriptions(parts), model, incomplete };
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

    // Preprocess the image (width-only cap; tall pages are segmented downstream).
    const preprocessedBuffer = await preprocessImageForOCR(imageBuffer);

    // Get domain glossary from cached reference
    const glossary = getDomainGlossary(cachedReference || {});

    // OPTIMIZED PROMPT (91% accuracy from experimentation)
    // Based on "precise-minimal" prompt that achieved 91.06% accuracy with 0% uncertainty markers
    const systemPrompt = `
Transcribe handwritten notes exactly as written. Preserve layout, indentation, and bullets.

Do not use *italics* or uncertainty markers. Always give your best interpretation of unclear text.

Keep acronyms in ALL-CAPS. Use '-' for bullets, '→' for arrows.

${formatGlossaryContext(glossary)}
`;

    const userPrompt = `
Transcribe this handwritten image precisely. Preserve all formatting.

Output only the transcribed text, no explanation.
`;

    // Build combined prompt including reference image context if available
    let combinedPrompt = systemPrompt + '\n\n' + userPrompt;

    // Transcribe the image, segmenting tall pages into full-resolution vertical strips.
    const response = await transcribeImage(cachedProvider!, preprocessedBuffer, combinedPrompt, 'ocr');

    const primaryResult = response.content || null;
    if (!primaryResult) {
      return null;
    }

    // Assess primary OCR quality
    const primaryQuality = assessOCRQuality(primaryResult, imageBuffer.length);

    console.log(`📊 OCR Quality Assessment:`, {
      illegiblePercent: `${primaryQuality.illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      italicPercent: `${primaryQuality.italicPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      uncertainPercent: `${primaryQuality.uncertainPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      consecutiveIllegibles: primaryQuality.consecutiveIllegibles,
      outputLength: primaryQuality.outputLength,
      isPoorQuality: primaryQuality.isPoorQuality,
    });

    // Check if fallback is needed and configured. An incomplete segmented
    // transcription (an interior segment produced no text) is treated like poor
    // quality so we don't silently return a page with a missing middle section.
    const fallbackModel = cachedProvider!.getProviderConfig().models?.ocrFallback;
    const needsFallback = primaryQuality.isPoorQuality || response.incomplete;

    if (needsFallback && fallbackModel && fallbackModel !== 'none' && fallbackModel !== '') {
      const fallbackReason = response.incomplete ? 'incomplete segmented transcription' : primaryQuality.reason;
      console.log(`⚠️  Primary quality poor (${fallbackReason}), trying fallback: ${fallbackModel}`);

      try {
        // Get current provider config
        const currentConfig = cachedProvider!.getProviderConfig();

        // Create fallback provider config by copying current config
        const fallbackConfig: AIProviderConfig = {
          type: currentConfig.type,
          apiKey: currentConfig.apiKey,
          baseURL: currentConfig.baseURL,
          models: { ocr: fallbackModel },
        };

        // Create fallback provider and run OCR (segments tall images just like the primary path)
        const fallbackProvider = createAIProvider(fallbackConfig);
        const fallbackResponse = await transcribeImage(fallbackProvider, preprocessedBuffer, combinedPrompt, 'ocr');

        const fallbackResult = fallbackResponse.content || null;
        if (!fallbackResult) {
          console.log(`❌ Fallback model returned no result, using primary result`);
          const condensedPrimary = condenseBulletLines(primaryResult);
          return { text: condensedPrimary, modelUsed: `${response.model} (primary)` };
        }

        // Assess fallback quality
        const fallbackQuality = assessOCRQuality(fallbackResult, imageBuffer.length);
        console.log(`✓ Fallback model succeeded: ${fallbackResponse.model}`);
        console.log(`📊 Fallback Quality Assessment:`, {
          illegiblePercent: `${fallbackQuality.illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
          italicPercent: `${fallbackQuality.italicPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
          uncertainPercent: `${fallbackQuality.uncertainPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
          consecutiveIllegibles: fallbackQuality.consecutiveIllegibles,
          outputLength: fallbackQuality.outputLength,
          isPoorQuality: fallbackQuality.isPoorQuality,
        });

        if (fallbackQuality.isPoorQuality) {
          console.log(`⚠️  Both models produced poor quality, returning fallback result`);
        }

        // Always return fallback result when fallback was triggered
        const condensedFallback = condenseBulletLines(fallbackResult);
        return { text: condensedFallback, modelUsed: `${fallbackResponse.model} (fallback from ${response.model})` };

      } catch (fallbackError: any) {
        console.error(`❌ Fallback model API error: ${fallbackError?.response?.data || fallbackError.message}, returning primary result`);
        const condensedPrimary = condenseBulletLines(primaryResult);
        return { text: condensedPrimary, modelUsed: `${response.model} (primary, fallback failed)` };
      }
    }

    console.log(`✓ Primary model succeeded: ${response.model}`);
    const condensedPrimary = condenseBulletLines(primaryResult);
    return { text: condensedPrimary, modelUsed: response.model };
  } catch (error: any) {
    console.error('❌ OCR failed:', error?.response?.data || error.message);
    return null;
  }
}
