import path from 'path';
import sharp from 'sharp';
import { createAIProvider, AIProvider, AIProviderConfig, ModelType, VisionImage } from './aiProvider';
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

// ============================================================================
// Constants
// ============================================================================

// Image preprocessing constants (exported for use in validation pipeline)
export const PREPROCESSING_WIDTH = 1600;           // Max width for preprocessed images (height is uncapped; tall pages are segmented instead)
export const PREPROCESSING_QUALITY = 95;           // Initial JPEG quality before compression
export const PREPROCESSING_SHARPEN_SIGMA = 1.0;    // Sharpening intensity

// Vertical segmentation for tall images.
// Very tall pages (long notes, stitched scans) get downsampled to illegibility when
// sent to a vision model as a single image. Instead we split them into vertical
// segments, OCR each, and stitch the results back together.
//
// Segment height is chosen so the provider does not downscale the strip: OpenAI's
// high-detail mode fits an image within 2048x2048 and then shrinks its SHORT side to
// 768px, so a strip up to 2048 wide and 768 tall is sent at native resolution
// (1536x2200 kept only 50%; 1536x1200 kept 64%). 768 also fits Anthropic's ~1.15MP
// budget at a 1536 width. Overlap is ~3 handwriting lines (~52px line pitch).
export const SEGMENT_MAX_HEIGHT = 768;             // Default max pixel height per OCR segment (env OCR_SEGMENT_MAX_HEIGHT)
export const SEGMENT_OVERLAP = 150;                // Default vertical overlap between segments (env OCR_SEGMENT_OVERLAP)
// Legacy peer-density under-fill ratio, kept for findUnderfilledSegments (used only
// when ink coverage is unavailable). Override with OCR_SEGMENT_MIN_DENSITY_RATIO.
export const SEGMENT_MIN_DENSITY_RATIO = 0.25;

// Ink-based completeness. A segment's expected text is proportional to its ink:
// pixels clearly darker than their local background (a blurred copy of the strip),
// which ignores shadows and faint ruled lines. A segment whose characters-per-ink
// falls below INK_MIN_RATIO of the median of the other inked segments is treated as
// under-transcribed. Override the ratio with OCR_SEGMENT_MIN_DENSITY_RATIO.
export const INK_MIN_RATIO = 0.5;
export const INK_BLANK_FLOOR = 0.002;              // Below this ink coverage a segment is blank paper
export const INK_DARK_DELTA = 100;                 // Gray levels darker than the local background to count as ink (pen, not ruled lines)
export const INK_BLUR_SIGMA = 12;                  // Background estimate blur
export const INK_MARGIN_FRACTION = 0.09;           // Left/right columns ignored (binder rings, page edges)

// Previous-segment context for nesting.
export const SEGMENT_CONTEXT_LINES = 5;

// Overlap matching between consecutive segment transcriptions.
const OVERLAP_SIMILARITY = 0.9;
const OVERLAP_MAX_LINES = 20;
const OVERLAP_SUBSTITUTION_SIMILARITY = 0.6;      // one line of a ≥3-line overlap block may differ this much

// Reference image sent with every OCR call is downscaled once to this width.
export const REFERENCE_IMAGE_MAX_WIDTH = 1536;

export const INCOMPLETE_WARNING_TITLE = '> [!warning] OCR may be incomplete';

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
let cachedReferenceVision: VisionImage | null = null;   // downscaled reference sent with each OCR call
let cachedProvider: AIProvider | null = null;
let referenceLoaded = false;

export function resetOCRCacheForTests(): void {
  cachedReference = null;
  cachedReferenceImage = null;
  cachedReferenceVision = null;
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


// ============================================================================
// Layout normalization
// ============================================================================

const BULLET_MARKER = /^([-•+]|\*(?=\s)|\d+[.)](?=\s))\s*/;
const STANDALONE_MARKER = /^#/;
const INDENT_UNIT = '  ';
const TAB_WIDTH = 4;

function expandLeadingTabs(line: string): string {
  const m = line.match(/^[ \t]*/)![0];
  return m.replace(/\t/g, ' '.repeat(TAB_WIDTH)) + line.slice(m.length);
}

/**
 * Normalize line breaks and indentation so the output follows the page.
 *
 * - A line starting with a bullet marker (`-`, `•`, `+`, `* `, `1.`/`1)`) or `#`
 *   always starts its own line, so a sub-bullet is never merged into its parent.
 * - A marker-less line directly after a bullet that is indented deeper than that
 *   bullet's marker (a hanging indent) is a wrapped continuation and is joined with
 *   one space. A marker-less line at or left of the marker (a label such as a year
 *   or "Notes:") stays on its own line.
 * - Blank lines between blocks are kept; runs of blank lines collapse to one.
 * - Indentation is re-leveled to two spaces per level; a line is never more than
 *   one level deeper than the line it nests under.
 * - Markdown table rows are left untouched.
 */
export function normalizeLayout(text: string): string {
  type Item = { kind: 'item'; indent: number; text: string } | { kind: 'blank' } | { kind: 'verbatim'; text: string };
  const items: Item[] = [];
  let joinTarget: { indent: number; text: string } | null = null;

  for (const raw of text.split('\n')) {
    const line = expandLeadingTabs(raw).replace(/\s+$/, '');
    if (line.trim() === '') {
      if (items.length > 0 && items[items.length - 1].kind !== 'blank') items.push({ kind: 'blank' });
      joinTarget = null;
      continue;
    }
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (trimmed.startsWith('|')) {
      items.push({ kind: 'verbatim', text: raw.replace(/\s+$/, '') });
      joinTarget = null;
      continue;
    }

    const isMarker = BULLET_MARKER.test(trimmed) || STANDALONE_MARKER.test(trimmed);
    if (!isMarker && joinTarget && indent > joinTarget.indent) {
      joinTarget.text += ' ' + trimmed;
      continue;
    }

    const item = { kind: 'item' as const, indent, text: trimmed };
    items.push(item);
    joinTarget = isMarker ? item : null;
  }

  while (items.length > 0 && items[items.length - 1].kind === 'blank') items.pop();

  const stack: number[] = [];
  const out: string[] = [];
  for (const item of items) {
    if (item.kind === 'blank') {
      out.push('');
    } else if (item.kind === 'verbatim') {
      out.push(item.text);
    } else {
      while (stack.length > 0 && item.indent < stack[stack.length - 1]) stack.pop();
      if (stack.length === 0 || item.indent > stack[stack.length - 1]) stack.push(item.indent);
      out.push(INDENT_UNIT.repeat(stack.length - 1) + item.text);
    }
  }
  return out.join('\n');
}

/**
 * @deprecated Use normalizeLayout. Kept for the experiment scripts that import it.
 */
export function condenseBulletLines(text: string): string {
  return normalizeLayout(text);
}

/**
 * Remove a code fence that wraps the whole text (```lang … ```). Unfenced text is
 * returned unchanged.
 */
export function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```[\w-]*[ \t]*\n([\s\S]*?)\n?```$/);
  return m ? m[1].replace(/\s+$/, '') : text;
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

// ============================================================================
// Segmentation
// ============================================================================

/**
 * A vertical strip of a segmented page: the cropped JPEG plus its known pixel
 * height (authoritative at cut time, so downstream never re-decodes to recover it).
 */
export interface ImageSegment {
  buffer: Buffer;
  height: number;
  /** Pixel offset of the segment's top edge in the source image. */
  top?: number;
}

function positiveIntEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Segment height and overlap, from env with defaults. */
export function getSegmentConfig(): { maxHeight: number; overlap: number } {
  const maxHeight = positiveIntEnv('OCR_SEGMENT_MAX_HEIGHT', SEGMENT_MAX_HEIGHT);
  const overlapRaw = parseInt(process.env.OCR_SEGMENT_OVERLAP || '', 10);
  const overlap = Number.isFinite(overlapRaw) && overlapRaw >= 0 && overlapRaw < maxHeight ? overlapRaw : Math.min(SEGMENT_OVERLAP, maxHeight - 1);
  return { maxHeight, overlap };
}

/**
 * Split a (preprocessed) image into vertical segments.
 *
 * Segments overlap by `overlap` pixels so a line of text straddling a boundary
 * appears intact in at least one segment. Returns a single-element array when the
 * image is short enough to OCR in one pass. Each element carries its pixel height.
 */
export async function segmentImageVertically(
  buffer: Buffer,
  maxHeight: number = getSegmentConfig().maxHeight,
  overlap: number = getSegmentConfig().overlap
): Promise<ImageSegment[]> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height || height <= maxHeight) {
    return [{ buffer, height, top: 0 }];
  }

  const step = Math.max(1, maxHeight - overlap);
  const segments: ImageSegment[] = [];

  // Every segment is full height. The last one is anchored to the bottom of the
  // page (overlapping its neighbour more) instead of being a thin sliver: a sliver
  // is mostly overlap, the model reads little from it, and the ink-based
  // completeness check would flag it as a dropped band.
  for (let next = 0; ; next += step) {
    const top = Math.min(next, height - maxHeight);
    const segment = await sharp(buffer)
      .extract({ left: 0, top, width, height: maxHeight })
      .jpeg({ quality: PREPROCESSING_QUALITY })
      .toBuffer();
    segments.push({ buffer: segment, height: maxHeight, top });
    if (top + maxHeight >= height) break;
  }

  return segments;
}

/**
 * Share of a strip covered by ink: pixels darker than their local background (a
 * heavily blurred copy) by more than INK_DARK_DELTA, ignoring the outer margin
 * columns. Robust to shadows and faint ruled lines, which differ little from the
 * local background.
 */
export async function computeInkCoverage(buffer: Buffer): Promise<number> {
  const gray = sharp(buffer).grayscale();
  const { data, info } = await gray.clone().raw().toBuffer({ resolveWithObject: true });
  const blurred = await gray.clone().blur(INK_BLUR_SIGMA).raw().toBuffer();
  const { width, height, channels } = info;
  const margin = Math.floor(width * INK_MARGIN_FRACTION);
  let ink = 0;
  let total = 0;
  // Measured on a real capture after preprocessing: ruled lines sit 60–100 gray
  // levels below their local background, pen strokes well beyond 100.
  for (let y = 0; y < height; y++) {
    const row = y * width * channels;
    for (let x = margin; x < width - margin; x++) {
      const i = row + x * channels;
      if (blurred[i] - data[i] > INK_DARK_DELTA) ink++;
      total++;
    }
  }
  return total > 0 ? ink / total : 0;
}

// ============================================================================
// Stitching
// ============================================================================

function normalizeForOverlap(line: string): string {
  return line
    .toLowerCase()
    .replace(/^\s*([-•+]|\*(?=\s)|\d+[.)])\s+/, '')
    .replace(/[*~_`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Normalized similarity of two transcribed lines (1 = same line). Lines whose
 * numbers differ are never the same line ("Q1 … 10" vs "Q2 … 10"), however close
 * the rest of the text is.
 */
export function lineSimilarity(a: string, b: string): number {
  const na = normalizeForOverlap(a);
  const nb = normalizeForOverlap(b);
  if (na === nb) return 1;
  const digits = (t: string) => (t.match(/\d+/g) ?? []).join(' ');
  if (digits(na) !== digits(nb)) return 0;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}

/**
 * True when `line` (at least 3 words) is a piece of `whole`: the same bullet read
 * in full by one strip and only partly (e.g. its wrapped second half) by the next.
 */
function isFragmentOf(line: string, whole: string): boolean {
  const part = normalizeForOverlap(line);
  return part.split(' ').length >= 3 && part.length < normalizeForOverlap(whole).length && normalizeForOverlap(whole).includes(part);
}

/**
 * Where the incoming segment's repeat of the accumulated output ends: the index in
 * `body` just past the overlap block, or 0 when there is no overlap. Tries the
 * largest overlap first. Lines are matched by normalized similarity, and a line on
 * one side may match two consecutive lines on the other, because the same bullet
 * is sometimes wrapped onto two lines in one strip and kept on one in the next.
 */
function overlapCut(outContent: string[], body: string[], bodyContentIdx: number[]): number {
  const maxBack = Math.min(OVERLAP_MAX_LINES, outContent.length);
  for (let back = maxBack; back > 0; back--) {
    let o = outContent.length - back;
    let b = 0;
    let ok = true;
    let matches = 0;
    let substituted = false;
    while (o < outContent.length) {
      if (b >= bodyContentIdx.length) {
        ok = false;
        break;
      }
      const line = body[bodyContentIdx[b]];
      if (lineSimilarity(outContent[o], line) >= OVERLAP_SIMILARITY) {
        o++;
        b++;
        matches++;
      } else if (b + 1 < bodyContentIdx.length && lineSimilarity(outContent[o], `${line} ${body[bodyContentIdx[b + 1]]}`) >= OVERLAP_SIMILARITY) {
        o++;
        b += 2;
      } else if (o + 1 < outContent.length && lineSimilarity(`${outContent[o]} ${outContent[o + 1]}`, line) >= OVERLAP_SIMILARITY) {
        o += 2;
        b++;
      } else if (isFragmentOf(line, outContent[o])) {
        // One or more consecutive pieces of a line already read in full.
        b++;
        while (b < bodyContentIdx.length && isFragmentOf(body[bodyContentIdx[b]], outContent[o])) b++;
        o++;
      } else if (!substituted && back >= 3 && lineSimilarity(outContent[o], line) >= OVERLAP_SUBSTITUTION_SIMILARITY) {
        // One line of a longer overlap block read slightly differently by each strip.
        substituted = true;
        o++;
        b++;
      } else {
        ok = false;
        break;
      }
    }
    if (ok && b > 0 && (!substituted || matches >= 2)) return bodyContentIdx[b - 1] + 1;
  }
  return 0;
}

/**
 * Stitch per-segment transcriptions into a single document.
 *
 * Segments overlap vertically, so a block of lines can be transcribed at the end of
 * one segment and again at the start of the next, often with small differences. We
 * find the largest block of trailing content lines of the accumulated output that
 * matches (normalized similarity ≥ 0.9 per line) the leading content lines of the
 * incoming segment, and drop it from the incoming segment once. Legitimately
 * repeated lines within a segment are untouched. A blank line at a segment edge is
 * kept as a single blank line at the join.
 */
export function stitchSegmentTranscriptions(parts: string[]): string {
  const out: string[] = [];
  let pendingBlank = false;

  for (const part of parts) {
    const lines = part.split('\n').map(l => l.replace(/\s+$/, ''));
    let start = 0;
    while (start < lines.length && lines[start] === '') start++;
    let end = lines.length;
    while (end > start && lines[end - 1] === '') end--;
    if (start === end) continue; // empty / whitespace-only segment

    const leadingBlank = start > 0;
    const trailingBlank = end < lines.length;
    let body = lines.slice(start, end);

    if (out.length === 0) {
      out.push(...body);
      pendingBlank = trailingBlank;
      continue;
    }

    const bodyContentIdx = body.flatMap((l, i) => (l !== '' ? [i] : []));
    let cut = overlapCut(out.filter(l => l !== ''), body, bodyContentIdx);
    if (cut === 0) {
      // No overlap found: the previous strip may have stopped partway through its
      // last line, which the next strip reads in full. Keep only the full version.
      const lastOut = out.length - 1 - [...out].reverse().findIndex(l => l !== '');
      if (lastOut >= 0 && bodyContentIdx.slice(0, 3).some(i => isFragmentOf(out[lastOut], body[i]))) {
        out.splice(lastOut, 1);
        while (out.length > 0 && out[out.length - 1] === '') out.pop();
        cut = overlapCut(out.filter(l => l !== ''), body, bodyContentIdx);
      }
    }

    let rest = body.slice(cut);
    let restLeadingBlank = cut === 0 ? leadingBlank : false;
    while (rest.length > 0 && rest[0] === '') {
      rest = rest.slice(1);
      restLeadingBlank = true;
    }
    if (rest.length === 0) {
      pendingBlank = pendingBlank || trailingBlank;
      continue;
    }
    if (pendingBlank || restLeadingBlank) out.push('');
    out.push(...rest);
    pendingBlank = trailingBlank;
  }

  return out.join('\n');
}

// ============================================================================
// Completeness
// ============================================================================

/**
 * Inspect per-segment transcriptions for missing text.
 *
 * An empty segment before the last segment with text means a band of the page
 * produced no text — usually a failed/truncated OCR call, so the transcription is
 * flagged `incomplete`. Empty segments after the last segment with text are
 * trailing paper and never flag. When ink coverage is known, an empty segment with
 * less ink than INK_BLANK_FLOOR is blank paper and never flags either.
 */
export function findEmptySegments(parts: string[], inkCoverage?: number[]): { emptyIndices: number[]; incomplete: boolean } {
  const emptyIndices: number[] = [];
  let lastContent = -1;
  parts.forEach((part, i) => {
    if (part.trim() === '') emptyIndices.push(i);
    else lastContent = i;
  });
  const isBlankPaper = (i: number) => inkCoverage !== undefined && inkCoverage[i] !== undefined && inkCoverage[i] < INK_BLANK_FLOOR;
  const incomplete = emptyIndices.some(i => i < lastContent && !isBlankPaper(i));
  return { emptyIndices, incomplete };
}

/**
 * Flag segments that returned far less text than their ink implies.
 *
 * For each inked segment (ink ≥ INK_BLANK_FLOOR), characters-per-ink is compared
 * with the median of the OTHER inked segments that returned text (leave-one-out, so
 * a drop doesn't dilute its own baseline). Below `minRatio` of that median is
 * under-filled. Blank-paper segments are expected to be empty and never flag.
 */
export function findUnderfilledByInk(
  parts: string[],
  inkCoverage: number[],
  minRatio: number = parseFloat(process.env.OCR_SEGMENT_MIN_DENSITY_RATIO || String(INK_MIN_RATIO)),
  bandHeights?: number[]
): { underfilledIndices: number[]; incomplete: boolean } {
  const ratio = Number.isFinite(minRatio) && minRatio > 0 && minRatio < 1 ? minRatio : INK_MIN_RATIO;
  const inked = parts.flatMap((_, i) => ((inkCoverage[i] ?? 0) >= INK_BLANK_FLOOR ? [i] : []));
  // Expected text scales with the AMOUNT of ink (coverage × band height), so bands
  // of different heights are compared fairly.
  const inkAmount = (i: number) => inkCoverage[i] * (bandHeights?.[i] ?? 1);
  const cpi = (i: number) => parts[i].trim().length / inkAmount(i);
  const withText = inked.filter(i => parts[i].trim().length > 0);
  if (withText.length < 2) return { underfilledIndices: [], incomplete: false };

  const underfilledIndices: number[] = [];
  for (const i of inked) {
    const others = withText.filter(j => j !== i).map(cpi);
    if (others.length === 0) continue;
    const reference = median(others);
    if (reference > 0 && cpi(i) < reference * ratio) underfilledIndices.push(i);
  }
  return { underfilledIndices, incomplete: underfilledIndices.length > 0 };
}

/**
 * Inspect per-segment transcriptions for a segment that returned far *less* text
 * than its image area implies — a silent partial-transcription drop that
 * `findEmptySegments` misses because the segment is not fully empty.
 *
 * The stitch step can only remove a leading overlap, never a segment's interior,
 * so a segment that transcribes only a fraction of its band silently loses that
 * content. We detect it by text density: for each non-empty segment, density =
 * trimmed chars / segment pixel height. A non-final segment whose density is below
 * `minDensityRatio` of the median density of the other non-empty segments is
 * flagged as under-filled.
 *
 * Interior/leading only mirrors `findEmptySegments`: a short *final* segment is
 * usually trailing blank page space and is never treated as under-transcribed.
 * Requires at least two non-empty segments to have a reference to compare against.
 *
 * The reference for each candidate is the median of the *other* non-empty
 * segments (leave-one-out): a candidate must not dilute the very baseline it is
 * measured against, otherwise the more content that is dropped, the lower the
 * baseline falls and the less likely a genuine drop is flagged.
 */
export function findUnderfilledSegments(
  parts: string[],
  segmentHeights: number[],
  minDensityRatio: number = parseFloat(
    process.env.OCR_SEGMENT_MIN_DENSITY_RATIO || String(SEGMENT_MIN_DENSITY_RATIO)
  )
): { underfilledIndices: number[]; incomplete: boolean } {
  // A malformed override (parseFloat → NaN, non-positive, or ≥ 1) must not skew
  // detection: ≤ 0 / NaN would disable it, ≥ 1 would flag nearly every segment.
  // Only a fraction in (0, 1) is meaningful; otherwise fall back to the default.
  const ratio = Number.isFinite(minDensityRatio) && minDensityRatio > 0 && minDensityRatio < 1
    ? minDensityRatio
    : SEGMENT_MIN_DENSITY_RATIO;

  // Density per segment, only for segments that have both text and a known height.
  const densities = parts.map((part, i) => {
    const len = part.trim().length;
    const height = segmentHeights[i] ?? 0;
    return len > 0 && height > 0 ? len / height : null;
  });

  const knownIndices = densities.flatMap((d, i) => (d !== null ? [i] : []));
  if (knownIndices.length < 2) {
    return { underfilledIndices: [], incomplete: false };
  }

  // Exempt the last *content-bearing* segment, not the last array index: a
  // trailing blank strip must not strip the exemption from a genuinely sparse
  // bottom band (which would be a spurious under-fill flag).
  const lastContentIndex = knownIndices[knownIndices.length - 1];

  const underfilledIndices: number[] = [];
  for (const i of knownIndices) {
    // Leave-one-out: compare this segment against the median of the others.
    const others = knownIndices.filter(j => j !== i).map(j => densities[j] as number);
    const reference = median(others);
    if (reference > 0 && (densities[i] as number) < reference * ratio) {
      underfilledIndices.push(i);
    }
  }

  const incomplete = underfilledIndices.some(i => i !== lastContentIndex);
  return { underfilledIndices, incomplete };
}

/** Median of a non-empty list of numbers. */
function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}


// ============================================================================
// Prompt
// ============================================================================

export type ReferenceMode = 'image' | 'words' | 'off';

export function getReferenceMode(): ReferenceMode {
  const v = (process.env.HANDWRITING_REFERENCE_MODE || 'image').toLowerCase();
  return v === 'words' || v === 'off' ? v : 'image';
}

export function uncertaintyMarkersEnabled(): boolean {
  return process.env.OCR_UNCERTAINTY_MARKERS !== 'false';
}

/** Build the OCR prompt. `referenceContext` and `glossaryContext` are appended as given. */
export function buildOCRPrompt(glossaryContext: string, referenceContext: string, markers: boolean): string {
  const uncertainty = markers
    ? `Wrap any word you cannot read confidently in *italics* (for example *word*). Still give your best reading, and never skip a word.`
    : `Always give your best interpretation of unclear text.`;

  return `
Transcribe handwritten notes exactly as written. Preserve the layout: line breaks, indentation, and bullets.

Put each bullet on its own line at the nesting level it has on the page. Judge the level from where each line's dash starts horizontally: a dash that starts further right than the dash above it is a sub-bullet, so indent it two more spaces; a dash back at an earlier position returns to that level. A sub-bullet is never merged into its parent's line. If one bullet wraps onto the next physical line, keep it as a single line. Leave no blank line between a bullet and its sub-bullets; use a blank line only where the page has a visible gap between separate topics.

${uncertainty}

Transcribe crossed-out or struck-through text inside ~~ ~~ (for example ~~struck words~~). Do not omit it, and do not transcribe it as normal text.

Keep acronyms in ALL-CAPS. Use '-' for bullets, '→' for arrows. Output plain markdown, not a code block.
${referenceContext}
${glossaryContext}

Transcribe this handwritten image precisely. Output only the transcribed text, no explanation.
`;
}

function buildSegmentPrompt(basePrompt: string, index: number, total: number, contextLines: string[]): string {
  let prompt = `${basePrompt}\n\nThis is vertical section ${index + 1} of ${total} of a single page. Transcribe only the text visible in this section. Do not add a title, section number, or any commentary.`;
  if (contextLines.length > 0) {
    prompt += `\n\nNesting context: these lines were already transcribed just above this section, shown with their indentation:\n${contextLines.join('\n')}\n\nThis is nesting context only. Transcribe every line visible in this section, including any that repeat the lines above, and indent each line at the nesting level it has on the page.`;
  }
  return prompt;
}

function trailingContentLines(text: string, n: number): string[] {
  return text.split('\n').filter(l => l.trim() !== '').slice(-n);
}

// ============================================================================
// Transcription
// ============================================================================

/** Vision-call usage since the last reset (for evaluation and cost reporting). */
export interface OCRUsageStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

const usageStats: OCRUsageStats = { calls: 0, promptTokens: 0, completionTokens: 0 };

export function getOCRUsageStats(): OCRUsageStats {
  return { ...usageStats };
}

export function resetOCRUsageStats(): void {
  usageStats.calls = 0;
  usageStats.promptTokens = 0;
  usageStats.completionTokens = 0;
}

interface TranscriptionResult {
  content: string;
  model: string;
  incomplete: boolean;
  segmentTexts: string[];
}

/**
 * Transcribe a preprocessed image with the given provider, segmenting tall images
 * into vertical strips so nothing is lost to downsampling. Each strip after the
 * first gets the already-stitched trailing lines as nesting context.
 */
async function transcribeImage(
  provider: AIProvider,
  preprocessedBuffer: Buffer,
  prompt: string,
  modelType: ModelType,
  referenceImage: VisionImage | null
): Promise<TranscriptionResult> {
  const compressionConfig = getCompressionConfig();
  const segments = await segmentImageVertically(preprocessedBuffer);
  const multi = segments.length > 1;

  if (multi) {
    console.log(`🧩 Tall image split into ${segments.length} vertical segments for OCR`);
  }

  const mime = 'image/jpeg'; // Always JPEG after preprocessing
  const parts: string[] = [];
  let model = '';

  for (let i = 0; i < segments.length; i++) {
    let segmentBuffer = segments[i].buffer;

    if (compressionConfig.enabled) {
      const compressionResult = await compressImageIfNeeded(
        segmentBuffer,
        compressionConfig.maxSizeBytes,
        compressionConfig.minQuality
      );
      segmentBuffer = compressionResult.buffer;
    }

    const segmentPrompt = multi
      ? buildSegmentPrompt(prompt, i, segments.length, i > 0 ? trailingContentLines(stitchSegmentTranscriptions(parts), SEGMENT_CONTEXT_LINES) : [])
      : prompt;

    const response = await provider.generateVisionCompletion(
      segmentPrompt,
      segmentBuffer.toString('base64'),
      mime,
      modelType,
      { detail: 'high', extraImages: referenceImage ? [referenceImage] : undefined }
    );
    parts.push(stripCodeFence(response.content || ''));
    model = response.model;
    usageStats.calls++;
    usageStats.promptTokens += response.usage?.promptTokens ?? 0;
    usageStats.completionTokens += response.usage?.completionTokens ?? 0;
  }

  let incomplete = false;
  if (multi) {
    // Completeness is judged on what each strip ADDS after stitching, against the
    // ink in the band only that strip covers. A strip that skips lines it already
    // saw in the overlap (or the nesting context) has dropped nothing.
    const contributions: string[] = [];
    let stitchedSoFar = '';
    for (let i = 0; i < parts.length; i++) {
      const next = stitchSegmentTranscriptions(parts.slice(0, i + 1));
      contributions.push(next.startsWith(stitchedSoFar) ? next.slice(stitchedSoFar.length) : parts[i]);
      stitchedSoFar = next;
    }
    const { coverage: ink, heights: bandHeights } = await uniqueBandInk(preprocessedBuffer, segments);

    const { emptyIndices, incomplete: hasEmpty } = findEmptySegments(contributions, ink);
    if (hasEmpty) {
      console.log(`⚠️  Segment(s) with ink returned no text (indices: ${emptyIndices.join(', ')}) — marking transcription incomplete`);
    }

    const { underfilledIndices, incomplete: hasUnderfilled } = findUnderfilledByInk(contributions, ink, undefined, bandHeights);
    if (hasUnderfilled) {
      console.log(`⚠️  Segment(s) returned far less text than their ink implies (indices: ${underfilledIndices.join(', ')}) — marking transcription incomplete`);
    }
    incomplete = hasEmpty || hasUnderfilled;
  }

  return { content: stitchSegmentTranscriptions(parts), model, incomplete, segmentTexts: parts };
}

/** Bands too thin to judge (a few px of new content) are treated as blank. */
const MIN_UNIQUE_BAND = 40;

/**
 * Ink coverage of the band each segment covers that no earlier segment did:
 * [previous segment's bottom, this segment's bottom).
 */
async function uniqueBandInk(preprocessed: Buffer, segments: ImageSegment[]): Promise<{ coverage: number[]; heights: number[] }> {
  const meta = await sharp(preprocessed).metadata();
  const width = meta.width ?? 0;
  let prevBottom = 0;
  const out: number[] = [];
  const heights: number[] = [];
  for (const seg of segments) {
    const top = seg.top ?? prevBottom;
    const bottom = top + seg.height;
    const bandTop = Math.max(top, prevBottom);
    const bandHeight = bottom - bandTop;
    heights.push(Math.max(0, bandHeight));
    if (bandHeight < MIN_UNIQUE_BAND || !width) {
      out.push(0);
    } else {
      const band = await sharp(preprocessed).extract({ left: 0, top: bandTop, width, height: bandHeight }).jpeg({ quality: PREPROCESSING_QUALITY }).toBuffer();
      out.push(await computeInkCoverage(band));
    }
    prevBottom = Math.max(prevBottom, bottom);
  }
  return { coverage: out, heights };
}

function withWarning(text: string, reason: string): string {
  return `${INCOMPLETE_WARNING_TITLE}\n> Some content may be missing or misread (${reason}). Check this transcription against the image.\n\n${text}`;
}

export interface OCRResult {
  text: string;
  modelUsed: string;
  /** True when the returned text is still incomplete or poor quality. */
  incomplete?: boolean;
  /** Per-segment transcriptions of the returned pass, in segment order. */
  segmentTexts?: string[];
}

async function loadReferenceForOCR(): Promise<void> {
  cachedReference = await loadHandwritingReference();
  const providerConfig = await loadAIProviderConfig(cachedReference);
  cachedProvider = createAIProvider(providerConfig);

  if (cachedReference.referenceImagePath && getReferenceMode() === 'image') {
    const imageExists = await referenceImageExists(cachedReference.referenceImagePath);
    if (imageExists) {
      cachedReferenceImage = await loadReferenceImage(cachedReference.referenceImagePath);
      if (cachedReferenceImage) {
        const small = await sharp(cachedReferenceImage)
          .resize({ width: REFERENCE_IMAGE_MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        cachedReferenceVision = { base64: small.toString('base64'), mimeType: 'image/jpeg' };
      }
    } else {
      console.warn(`⚠️  Reference image not found at ${cachedReference.referenceImagePath}; using reference words instead`);
    }
  }

  referenceLoaded = true;
}

export async function processHandwrittenImage(imageBuffer: Buffer, filename: string): Promise<OCRResult | null> {
  try {
    if (!referenceLoaded) {
      await loadReferenceForOCR();
    }

    const preprocessedBuffer = await preprocessImageForOCR(imageBuffer);

    const markers = uncertaintyMarkersEnabled();
    const mode = getReferenceMode();
    const referenceImage = mode === 'image' ? cachedReferenceVision : null;
    const referenceContext = referenceImage
      ? formatReferenceImageInstructions()
      : mode !== 'off' && cachedReference
        ? formatReferenceWordsForPrompt(cachedReference)
        : '';
    const glossary = getDomainGlossary(cachedReference || {});
    const prompt = buildOCRPrompt(formatGlossaryContext(glossary, { uncertaintyMarkers: markers }), referenceContext, markers);

    const response = await transcribeImage(cachedProvider!, preprocessedBuffer, prompt, 'ocr', referenceImage);

    const primaryResult = response.content || null;
    if (!primaryResult) {
      return null;
    }

    const primaryQuality = assessOCRQuality(primaryResult, imageBuffer.length);

    console.log(`📊 OCR Quality Assessment:`, {
      illegiblePercent: `${primaryQuality.illegiblePercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      italicPercent: `${primaryQuality.italicPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      uncertainPercent: `${primaryQuality.uncertainPercent.toFixed(PERCENT_DECIMAL_PLACES)}%`,
      consecutiveIllegibles: primaryQuality.consecutiveIllegibles,
      outputLength: primaryQuality.outputLength,
      isPoorQuality: primaryQuality.isPoorQuality,
    });

    const primaryReason = response.incomplete ? 'a section of the page appears to have been dropped' : primaryQuality.reason || 'low OCR quality';
    const primaryOutcome = (unresolved: boolean, model: string): OCRResult => {
      const text = normalizeLayout(primaryResult);
      return {
        text: unresolved ? withWarning(text, primaryReason) : text,
        modelUsed: model,
        incomplete: unresolved,
        segmentTexts: response.segmentTexts,
      };
    };

    // An incomplete segmented transcription is treated like poor quality so we
    // don't silently return a page with a missing section.
    const fallbackModel = cachedProvider!.getProviderConfig().models?.ocrFallback;
    const needsFallback = primaryQuality.isPoorQuality || response.incomplete;

    if (!needsFallback) {
      console.log(`✓ Primary model succeeded: ${response.model}`);
      return primaryOutcome(false, response.model);
    }

    if (!fallbackModel || fallbackModel === 'none' || fallbackModel === '') {
      console.log(`⚠️  Primary result needs review (${primaryReason}) and no fallback is configured`);
      return primaryOutcome(true, response.model);
    }

    console.log(`⚠️  Primary quality poor (${primaryReason}), trying fallback: ${fallbackModel}`);

    try {
      const currentConfig = cachedProvider!.getProviderConfig();
      const fallbackConfig: AIProviderConfig = {
        type: currentConfig.type,
        apiKey: currentConfig.apiKey,
        baseURL: currentConfig.baseURL,
        models: { ocr: fallbackModel },
      };

      const fallbackProvider = createAIProvider(fallbackConfig);
      const fallbackResponse = await transcribeImage(fallbackProvider, preprocessedBuffer, prompt, 'ocr', referenceImage);

      const fallbackResult = fallbackResponse.content || null;
      if (!fallbackResult) {
        console.log(`❌ Fallback model returned no result, using primary result`);
        return primaryOutcome(true, `${response.model} (primary)`);
      }

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

      // There is no third model to try, so an unresolved fallback is returned with
      // a visible warning instead of passing silently.
      const unresolved = fallbackQuality.isPoorQuality || fallbackResponse.incomplete;
      const text = normalizeLayout(fallbackResult);
      const reason = fallbackResponse.incomplete
        ? 'a section of the page appears to have been dropped, even by the fallback model'
        : 'both models produced low-quality output';
      if (unresolved) console.log(`⚠️  ${reason}, returning fallback result with a warning`);

      return {
        text: unresolved ? withWarning(text, reason) : text,
        modelUsed: `${fallbackResponse.model} (fallback from ${response.model})`,
        incomplete: unresolved,
        segmentTexts: fallbackResponse.segmentTexts,
      };
    } catch (fallbackError: any) {
      console.error(`❌ Fallback model API error: ${fallbackError?.response?.data || fallbackError.message}, returning primary result`);
      return primaryOutcome(true, `${response.model} (primary, fallback failed)`);
    }
  } catch (error: any) {
    console.error('❌ OCR failed:', error?.response?.data || error.message);
    return null;
  }
}
