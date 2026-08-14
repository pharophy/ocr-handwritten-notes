import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  segmentImageVertically,
  findEmptySegments,
  findUnderfilledSegments,
} from '../src/ocr';

// Regression for an observed failure: a real 3-page handwritten note whose
// entire MIDDLE page was silently dropped. The vision model returned page 1 for
// the first vertical segment and only the trailing lines of page 2 for the
// middle segment, discarding a full segment's worth of content. Nothing flagged
// it: `findEmptySegments` saw text in every segment, and the absolute-length
// quality gate cleared easily for a large multi-segment page.
//
// The confidential source image and its transcription are NOT committed (this
// repo has a public remote). Instead we reproduce the exact failure GEOMETRY —
// the same 1536x4327 page that splits into 3 segments — with a blank image, and
// the transcription's SHAPE — an under-filled interior segment — with
// placeholder text. That is sufficient to exercise the detection logic
// deterministically, with no live API call.
const CAPTURE_WIDTH = 1536;
const CAPTURE_HEIGHT = 4327;

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

async function heightsOf(segments: { buffer: Buffer }[]): Promise<number[]> {
  return Promise.all(
    segments.map(async (s) => (await sharp(s.buffer).metadata()).height ?? 0),
  );
}

// A dense "page" of transcription: many lines, i.e. text roughly proportional
// to a full ~2200px segment band.
const densePage = (label: string) =>
  Array.from({ length: 40 }, (_, i) => `- ${label} line ${i + 1}`).join('\n');

describe('Segmented tall-image regression: silent mid-page drop', () => {
  it('splits the page into three vertical segments (same geometry as the real capture)', async () => {
    const image = await makeImage(CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const segments = await segmentImageVertically(image);
    expect(segments).toHaveLength(3);

    const heights = await heightsOf(segments);
    // Two full-height bands and a short trailing sliver — the real geometry.
    expect(heights[0]).toBeGreaterThan(2000);
    expect(heights[1]).toBeGreaterThan(2000);
    expect(heights[2]).toBeLessThan(1000);
  });

  it('the OLD empty-only check does NOT catch an under-filled interior segment (captures the bug)', async () => {
    const image = await makeImage(CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const segments = await segmentImageVertically(image);

    // What the model actually returned: dense page 1, then only the trailing
    // couple of lines of page 2 for the full middle band, then dense page 3.
    const droppedInterior = '- trailing line one\n- trailing line two';
    const parts = [densePage('page1'), droppedInterior, densePage('page3')];

    // The middle segment is non-empty, so the pre-fix guard sees nothing wrong.
    expect(findEmptySegments(parts).incomplete).toBe(false);
  });

  it('the NEW density check flags the under-filled interior segment as incomplete (the fix)', async () => {
    const image = await makeImage(CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const segments = await segmentImageVertically(image);
    const heights = await heightsOf(segments);

    const droppedInterior = 'Where I want to grow:\n- Sys design expertise';
    const parts = [densePage('page1'), droppedInterior, densePage('page3')];

    const result = findUnderfilledSegments(parts, heights);
    expect(result.underfilledIndices).toContain(1);
    expect(result.incomplete).toBe(true);
  });
});

describe('findUnderfilledSegments guardrails (no false positives)', () => {
  it('does not flag segments whose text is roughly proportional to their area', async () => {
    const image = await makeImage(CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const heights = await heightsOf(await segmentImageVertically(image));
    // Proportional: the short trailing segment gets proportionally less text.
    const parts = [
      densePage('page1'),
      densePage('page2'),
      Array.from({ length: 6 }, (_, i) => `- tail line ${i + 1}`).join('\n'),
    ];
    const result = findUnderfilledSegments(parts, heights);
    expect(result.underfilledIndices).toEqual([]);
    expect(result.incomplete).toBe(false);
  });

  it('does not flag a short trailing (final) sliver segment even when sparse', () => {
    // Two full bands with dense text, final sliver with a single line. The final
    // content segment must not appear in underfilledIndices at all (not merely be
    // absolved by the incomplete rule, which excludes the last index by construction).
    const heights = [2200, 2200, 200];
    const parts = [densePage('a'), densePage('b'), '- lone tail line'];
    const result = findUnderfilledSegments(parts, heights);
    expect(result.underfilledIndices).not.toContain(2);
    expect(result.incomplete).toBe(false);
  });

  it('exempts a genuinely sparse bottom band when the true final strip is blank', () => {
    // The last strip is blank trailing page space (density null); the real last
    // content segment is index 1. A sparse index-1 must be treated as the final
    // content segment (exempt), not as an interior drop.
    const heights = [2200, 2200, 300];
    const parts = [densePage('page1'), '- short closing note', ''];
    const result = findUnderfilledSegments(parts, heights);
    expect(result.incomplete).toBe(false);
  });

  it('returns not-incomplete when fewer than two segments contain text', () => {
    const heights = [2200, 2200];
    const result = findUnderfilledSegments(['only this segment has text', ''], heights);
    expect(result.underfilledIndices).toEqual([]);
    expect(result.incomplete).toBe(false);
  });
});

describe('findUnderfilledSegments detection is not diluted by the dropped segments', () => {
  // Leave-one-out reference: a candidate is compared against the median of the
  // OTHER non-empty segments, so a drop cannot lower the very baseline it is
  // measured against. These are the degenerate cases a self-inclusive median missed.

  it('flags a drop on a two-segment page (candidate excluded from its own reference)', () => {
    // The FIRST (non-final) band dropped; the second is dense. A self-inclusive
    // median of just these two would sit halfway and never flag the drop.
    const heights = [2200, 2200];
    const parts = ['- one lonely line', densePage('page2')];
    const result = findUnderfilledSegments(parts, heights);
    expect(result.underfilledIndices).toContain(0);
    expect(result.incomplete).toBe(true);
  });

  it('flags BOTH segments when two interior bands drop together (no mutual masking)', () => {
    // Dense first + last, two dropped interior bands. A self-inclusive median
    // would sink to the dropped value and flag neither.
    const heights = [2200, 2200, 2200, 2200];
    const parts = [densePage('a'), '- scrap one', '- scrap two', densePage('d')];
    const result = findUnderfilledSegments(parts, heights);
    expect(result.underfilledIndices).toEqual(expect.arrayContaining([1, 2]));
    expect(result.incomplete).toBe(true);
  });

  it('does not silently disable detection on a malformed OCR_SEGMENT_MIN_DENSITY_RATIO', () => {
    // parseFloat('high') → NaN; a NaN threshold would make every comparison false.
    const heights = [2200, 2200, 327];
    const parts = [densePage('page1'), '- trailing line one\n- trailing line two', densePage('page3')];
    const result = findUnderfilledSegments(parts, heights, Number.NaN);
    expect(result.underfilledIndices).toContain(1);
    expect(result.incomplete).toBe(true);
  });

  it('rejects an out-of-range ratio (>= 1) instead of flagging every segment', () => {
    // A proportional page must not be flagged; ratio 1.5 would flag all segments
    // if accepted, so it must fall back to the in-range default.
    const heights = [2200, 2200, 2200];
    const parts = [densePage('a'), densePage('b'), densePage('c')];
    const result = findUnderfilledSegments(parts, heights, 1.5);
    expect(result.underfilledIndices).toEqual([]);
    expect(result.incomplete).toBe(false);
  });
});
