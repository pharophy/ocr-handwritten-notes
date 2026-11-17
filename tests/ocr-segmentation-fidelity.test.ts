import { afterEach, describe, expect, it } from 'vitest';
import { segmentImageVertically, stitchSegmentTranscriptions } from '../src/ocr';
import { blankPage } from './helpers/syntheticPage';

// fix-ocr-fidelity 2.5 (segment geometry) and 2.10 (fuzzy overlap, blank lines at joins).

describe('2.5 segment geometry keeps handwriting at native resolution', () => {
  const saved = { h: process.env.OCR_SEGMENT_MAX_HEIGHT, o: process.env.OCR_SEGMENT_OVERLAP };

  afterEach(() => {
    if (saved.h === undefined) delete process.env.OCR_SEGMENT_MAX_HEIGHT; else process.env.OCR_SEGMENT_MAX_HEIGHT = saved.h;
    if (saved.o === undefined) delete process.env.OCR_SEGMENT_OVERLAP; else process.env.OCR_SEGMENT_OVERLAP = saved.o;
  });

  it('splits a 1536x10199 page into segments of at most 768px with 150px overlap by default', async () => {
    delete process.env.OCR_SEGMENT_MAX_HEIGHT;
    delete process.env.OCR_SEGMENT_OVERLAP;
    const segments = await segmentImageVertically(await blankPage(1536, 10199));
    for (const s of segments) expect(s.height).toBeLessThanOrEqual(768);
    // step = 768 - 150 = 618 → tops 0, 618, …, 9270, then a last segment anchored at 10199 - 768
    expect(segments).toHaveLength(17);
  });

  it('honors OCR_SEGMENT_MAX_HEIGHT and OCR_SEGMENT_OVERLAP', async () => {
    process.env.OCR_SEGMENT_MAX_HEIGHT = '2200';
    process.env.OCR_SEGMENT_OVERLAP = '200';
    const segments = await segmentImageVertically(await blankPage(1536, 10199));
    expect(segments).toHaveLength(5);
    expect(Math.max(...segments.map(s => s.height))).toBe(2200);
  });
});

describe('2.10 stitching with fuzzy overlap and preserved blank lines', () => {
  it('drops a repeated overlap block whose lines differ slightly', () => {
    const out = stitchSegmentTranscriptions([
      '- alpha one item\n- beta two item\n- gamma three item',
      '- beta  two item\n- gamma three item.\n- delta four item',
    ]);
    expect(out.split('\n')).toEqual(['- alpha one item', '- beta two item', '- gamma three item', '- delta four item']);
  });

  it('treats a one-character misread in the overlap as the same line', () => {
    const out = stitchSegmentTranscriptions([
      '- first placeholder line\n- second placeholder line',
      '- second placeholdcr line\n- third placeholder line',
    ]);
    expect(out.split('\n')).toEqual(['- first placeholder line', '- second placeholder line', '- third placeholder line']);
  });

  it('keeps exactly one blank line when segment 1 ends a block', () => {
    const out = stitchSegmentTranscriptions(['- a block\n- b block\n\n', '- c block\n- d block']);
    expect(out).toBe('- a block\n- b block\n\n- c block\n- d block');
  });

  it('keeps exactly one blank line when segment 2 starts a new block', () => {
    const out = stitchSegmentTranscriptions(['- a block\n- b block', '\n\n- c block']);
    expect(out).toBe('- a block\n- b block\n\n- c block');
  });

  it('still keeps legitimately repeated lines inside one segment', () => {
    const out = stitchSegmentTranscriptions(['- item\n- other\n- item', '- next thing']);
    expect(out.split('\n').filter(l => l === '- item')).toHaveLength(2);
  });
});

describe('no sliver segments', () => {
  it('makes the last segment full height instead of a thin sliver', async () => {
    // 810px tall: a 768px strip, then 42px of new content. A sliver like that is
    // mostly overlap, the model reads little from it, and the ink check flags it.
    const segments = await segmentImageVertically(await blankPage(1536, 810), 768, 150);
    expect(segments).toHaveLength(2);
    expect(segments.map(s => s.height)).toEqual([768, 768]);
  });

  it('still covers the bottom of the page exactly', async () => {
    const segments = await segmentImageVertically(await blankPage(1536, 10199), 768, 150);
    for (const s of segments) expect(s.height).toBe(768);
  });
});

describe('overlap removal across different line wrapping', () => {
  it('drops a repeated bullet that the next strip wrapped onto two lines', () => {
    const out = stitchSegmentTranscriptions([
      '- placeholder first item\n  - placeholder assumption this will accelerate and we will not keep up',
      '  - placeholder assumption this will accelerate\nand we will not keep up\n- placeholder next item',
    ]);
    expect(out.split('\n')).toEqual([
      '- placeholder first item',
      '  - placeholder assumption this will accelerate and we will not keep up',
      '- placeholder next item',
    ]);
  });

  it('drops a repeated bullet that the previous strip wrapped and the next joined', () => {
    const out = stitchSegmentTranscriptions([
      '- placeholder first item\n- placeholder long bullet that wraps\nonto a second line',
      '- placeholder long bullet that wraps onto a second line\n- placeholder next item',
    ]);
    expect(out.split('\n').filter(l => l.includes('next item'))).toHaveLength(1);
    expect(out.split('\n').filter(l => l.includes('long bullet'))).toHaveLength(1);
  });
});

describe('fuzzy overlap never merges lines whose numbers differ', () => {
  it('keeps lines that differ only by a number', () => {
    const out = stitchSegmentTranscriptions(['- target for Q1 is 10 items\n- review in week 3', '- target for Q2 is 10 items\n- review in week 4']);
    expect(out.split('\n')).toHaveLength(4);
  });
});

describe('overlap removal drops a fragment of the previous line', () => {
  it('drops the second half of a bullet the previous strip already read in full', () => {
    const out = stitchSegmentTranscriptions([
      '- placeholder start showing what is possible to build\n  - placeholder assumption this will accel significantly and we will not keep up',
      'and we will not keep up',
    ]);
    expect(out.split('\n')).toEqual([
      '- placeholder start showing what is possible to build',
      '  - placeholder assumption this will accel significantly and we will not keep up',
    ]);
  });

  it('keeps a genuinely new short line that only shares a word', () => {
    const out = stitchSegmentTranscriptions(['- placeholder review the budget plan', '- budget']);
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('overlap removal tolerates one differently-read line', () => {
  it('drops a repeated three-line block when one line was read slightly differently', () => {
    const out = stitchSegmentTranscriptions([
      '- placeholder big topic\n= where is the parcel\n- where to flag it\nQX9!',
      '= where is the parcel\n- what to flag it\n- QX9\n  - much more detail at item level',
    ]);
    const lines = out.split('\n');
    expect(lines.filter(l => l.includes('where is the parcel'))).toHaveLength(1);
    expect(lines.filter(l => l.includes('flag it'))).toHaveLength(1);
    expect(lines).toContain('  - much more detail at item level');
  });
});

describe('overlap removal replaces a truncated line with the full one', () => {
  it('keeps only the full line when the previous strip stopped mid-line', () => {
    const out = stitchSegmentTranscriptions([
      '- placeholder first topic\n- No decision yet but the plan could',
      '- No decision yet but the plan could change soon\n- placeholder next item',
    ]);
    expect(out.split('\n')).toEqual([
      '- placeholder first topic',
      '- No decision yet but the plan could change soon',
      '- placeholder next item',
    ]);
  });
});
