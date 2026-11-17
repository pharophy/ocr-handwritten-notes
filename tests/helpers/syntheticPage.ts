import sharp from 'sharp';

// Synthetic notebook pages for OCR tests. No real note content: "handwriting" is
// drawn as dark word-shaped blobs on a ~52px line pitch (the pitch measured on a
// real 1536px-wide capture), optionally over faint ruled lines and a shadow
// gradient, which must NOT count as ink.

export interface SyntheticPageOptions {
  /** Vertical pixel ranges [start, end) left without handwriting (blank paper). */
  blankRanges?: Array<[number, number]>;
  /** Draw faint ruled lines on the line pitch. */
  ruled?: boolean;
  /** Overlay a smooth top-to-bottom shadow gradient. */
  shadow?: boolean;
  /** Ruled-line color (default faint #cfcfcf). Real photos can come out much darker after normalization. */
  ruledColor?: string;
  /** Draw spiral-binding rings down the left edge, this many px wide. */
  ringsWidth?: number;
}

const LINE_PITCH = 52;

export async function syntheticPage(width: number, height: number, opts: SyntheticPageOptions = {}): Promise<Buffer> {
  const blank = opts.blankRanges ?? [];
  const isBlank = (y: number) => blank.some(([s, e]) => y >= s && y < e);
  const shapes: string[] = [];

  if (opts.ruled) {
    for (let y = LINE_PITCH; y < height; y += LINE_PITCH) {
      shapes.push(`<rect x="0" y="${y}" width="${width}" height="2" fill="${opts.ruledColor ?? '#cfcfcf'}"/>`);
    }
  }
  if (opts.ringsWidth) {
    for (let y = 10; y < height; y += 25) {
      shapes.push(`<rect x="0" y="${y}" width="${opts.ringsWidth}" height="12" rx="5" fill="#111"/>`);
    }
  }

  let row = 0;
  for (let y = 20; y + 22 < height; y += LINE_PITCH, row++) {
    if (isBlank(y)) continue;
    let x = 120 + (row % 3) * 40;
    let word = 0;
    while (x < width - 180) {
      const w = 50 + ((row * 7 + word * 13) % 90);
      shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="20" rx="6" fill="#1e1e1e"/>`);
      x += w + 28;
      word++;
    }
  }

  const shadow = opts.shadow
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs><rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f6f6f2"/>${shapes.join('')}${shadow}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

export async function blankPage(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer();
}

/** Distinct placeholder text for one OCR call, so overlap stitching never merges calls. */
export function placeholderLines(tag: string, n = 6): string {
  return Array.from({ length: n }, (_, i) => `- placeholder ${tag} line ${i} with several ordinary words`).join('\n');
}
