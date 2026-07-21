import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  segmentImageVertically,
  stitchSegmentTranscriptions,
  SEGMENT_MAX_HEIGHT,
  SEGMENT_OVERLAP,
} from '../src/ocr';

// Helper: build a solid-color JPEG of the given dimensions.
async function makeImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function heightOf(buffer: Buffer): Promise<number> {
  return (await sharp(buffer).metadata()).height ?? 0;
}

describe('Tall-image vertical segmentation', () => {
  it('returns a single segment for short images', async () => {
    const image = await makeImage(1600, SEGMENT_MAX_HEIGHT - 100);
    const segments = await segmentImageVertically(image);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe(image);
  });

  it('does not segment an image exactly at the max height', async () => {
    const image = await makeImage(1600, SEGMENT_MAX_HEIGHT);
    const segments = await segmentImageVertically(image);
    expect(segments).toHaveLength(1);
  });

  it('splits a very tall image into multiple full-width segments', async () => {
    // Mimics the "Baton Day 1 Notes" failure: ~8.5:1 aspect ratio.
    const width = 1536;
    const height = 13103;
    const image = await makeImage(width, height);

    const segments = await segmentImageVertically(image);

    // Expected count: ceil((height - overlap) / (maxHeight - overlap)).
    const step = SEGMENT_MAX_HEIGHT - SEGMENT_OVERLAP;
    const expected = Math.ceil((height - SEGMENT_OVERLAP) / step);
    expect(segments.length).toBe(expected);
    expect(segments.length).toBeGreaterThan(1);

    // Every segment keeps full width and is no taller than the cap.
    for (const segment of segments) {
      const meta = await sharp(segment).metadata();
      expect(meta.width).toBe(width);
      expect(meta.height).toBeLessThanOrEqual(SEGMENT_MAX_HEIGHT);
    }

    // Segments must cover the whole page (accounting for overlap).
    const totalCovered = SEGMENT_OVERLAP + step * segments.length;
    expect(totalCovered).toBeGreaterThanOrEqual(height);
  });

  it('overlaps consecutive segments so boundary lines are not clipped', async () => {
    const image = await makeImage(1000, SEGMENT_MAX_HEIGHT * 2);
    const segments = await segmentImageVertically(image);
    expect(segments.length).toBeGreaterThan(1);

    const firstHeight = await heightOf(segments[0]);
    expect(firstHeight).toBe(SEGMENT_MAX_HEIGHT);
  });
});

describe('Segment transcription stitching', () => {
  it('joins segment transcriptions with newlines', () => {
    const result = stitchSegmentTranscriptions(['line A\nline B', 'line C']);
    expect(result).toBe('line A\nline B\nline C');
  });

  it('drops duplicate lines introduced by overlap between segments', () => {
    // "shared line" appears at the end of segment 1 and start of segment 2.
    const result = stitchSegmentTranscriptions([
      'top line\nshared line',
      'shared line\nbottom line',
    ]);
    expect(result).toBe('top line\nshared line\nbottom line');
  });

  it('ignores empty segments', () => {
    const result = stitchSegmentTranscriptions(['only line', '', '   ']);
    expect(result).toBe('only line');
  });

  it('keeps legitimately repeated non-adjacent lines', () => {
    const result = stitchSegmentTranscriptions(['- item\nother', '- item']);
    // Not consecutive after the "other" line, so both "- item" lines survive.
    expect(result.split('\n').filter(l => l === '- item')).toHaveLength(2);
  });
});
