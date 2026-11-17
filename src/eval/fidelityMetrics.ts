import { lineSimilarity } from '../ocr';

// Fidelity metrics shared by eval:fidelity (full page) and eval:crops (targeted regions).

export interface Line {
  text: string;
  level: number;
  struck: boolean;
}

/** Content lines with indentation levels ranked per document (no re-joining). */
export function toLines(md: string): Line[] {
  const raw = md
    .split('\n')
    .map(l => l.replace(/\t/g, '    ').replace(/\s+$/, ''))
    .filter(l => l.trim() !== '' && !l.trimStart().startsWith('>') && !/^\[\[.*\]\]/.test(l.trim()));
  const stack: number[] = [];
  return raw.map(l => {
    const indent = l.length - l.trimStart().length;
    while (stack.length && indent < stack[stack.length - 1]) stack.pop();
    if (!stack.length || indent > stack[stack.length - 1]) stack.push(indent);
    return { text: l.trim(), level: stack.length - 1, struck: l.includes('~~') };
  });
}

export function words(md: string): string[] {
  return md
    .split('\n')
    .filter(l => !l.trimStart().startsWith('>') && !/^\[\[.*\]\]/.test(l.trim()))
    .join(' ')
    .toLowerCase()
    .replace(/[*~_`]/g, '')
    .replace(/[^\p{L}\p{N}\s/&#']/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function multisetOverlap(a: string[], b: string[]): number {
  const counts = new Map<string, number>();
  for (const w of b) counts.set(w, (counts.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of a) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      hit++;
      counts.set(w, c - 1);
    }
  }
  return hit;
}

export const LINE_MATCH = 0.8;

export interface Metrics {
  wordRecall: number;
  wordPrecision: number;
  lineRecall: number;
  indentAgreement: number;
  struckTotal: number;
  struckMarked: number;
  struckAsPlain: number;
  missingLines: string[];
}

export function score(output: string, verified: string): Metrics {
  const vw = words(verified);
  const ow = words(output);
  const hit = multisetOverlap(vw, ow);

  const V = toLines(verified);
  const O = toLines(output);
  const used = new Set<number>();
  let matched = 0;
  let sameLevel = 0;
  let struckMarked = 0;
  let struckAsPlain = 0;
  const missingLines: string[] = [];
  for (const v of V) {
    let best = -1;
    let bestSim = 0;
    O.forEach((o, i) => {
      if (used.has(i)) return;
      const sim = lineSimilarity(v.text, o.text);
      if (sim > bestSim) {
        bestSim = sim;
        best = i;
      }
    });
    if (best >= 0 && bestSim >= LINE_MATCH) {
      used.add(best);
      matched++;
      if (O[best].level === v.level) sameLevel++;
      if (v.struck) (O[best].struck ? struckMarked++ : struckAsPlain++);
    } else {
      missingLines.push(v.text);
    }
  }
  return {
    wordRecall: vw.length ? hit / vw.length : 0,
    wordPrecision: ow.length ? hit / ow.length : 0,
    lineRecall: V.length ? matched / V.length : 0,
    indentAgreement: matched ? sameLevel / matched : 0,
    struckTotal: V.filter(v => v.struck).length,
    struckMarked,
    struckAsPlain,
    missingLines,
  };
}

