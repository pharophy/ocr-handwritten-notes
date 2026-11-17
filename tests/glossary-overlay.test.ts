import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadHandwritingReference, formatGlossaryContext } from '../src/handwritingReference';

// fix-ocr-fidelity 2.26 (git-ignored local glossary overlay) and 2.27 (privacy guard).
// Placeholder names only; real names live in the ignored local file.

let dir: string;
let basePath: string;
const localPath = () => path.join(dir, 'handwriting-reference.local.json');

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hw-ref-'));
  basePath = path.join(dir, 'handwriting-reference.json');
  await fs.writeFile(
    basePath,
    JSON.stringify({
      domainGlossary: {
        acronyms: { ABC: 'base meaning', DEF: 'base def' },
        properNouns: ['Base Person'],
        businessTerms: ['roadmap'],
      },
    })
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('2.26 local glossary overlay', () => {
  it('merges names, terms, acronyms and abbreviations; local wins on conflict', async () => {
    await fs.writeFile(
      localPath(),
      JSON.stringify({
        domainGlossary: {
          acronyms: { ABC: 'local meaning', XYZ: 'local only' },
          properNouns: ['Local Person', 'Base Person'],
          businessTerms: ['platform'],
          abbreviations: { 'es.': 'e.g.' },
        },
      })
    );
    const ref = await loadHandwritingReference(basePath);
    const g = ref.domainGlossary!;
    expect(g.acronyms).toEqual({ ABC: 'local meaning', DEF: 'base def', XYZ: 'local only' });
    expect(g.properNouns).toEqual(['Base Person', 'Local Person']);
    expect(g.businessTerms).toEqual(['roadmap', 'platform']);
    expect((g as any).abbreviations).toEqual({ 'es.': 'e.g.' });
  });

  it('is a no-op when the overlay is absent', async () => {
    const ref = await loadHandwritingReference(basePath);
    expect(ref.domainGlossary?.properNouns).toEqual(['Base Person']);
  });

  it('warns and ignores a malformed overlay', async () => {
    await fs.writeFile(localPath(), '{ not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = await loadHandwritingReference(basePath);
    expect(ref.domainGlossary?.properNouns).toEqual(['Base Person']);
    expect(warn.mock.calls.flat().join(' ')).toContain('handwriting-reference.local.json');
  });

  it('tells the model never to replace a written word with a glossary term', () => {
    const ctx = formatGlossaryContext({ businessTerms: ['redundancy'] } as any);
    expect(ctx).toMatch(/never replace a written word with a (glossary )?term/i);
  });

  it('renders abbreviations into the glossary prompt context', () => {
    const ctx = formatGlossaryContext({ abbreviations: { 'es.': 'e.g.' } } as any);
    expect(ctx).toContain('es.');
    expect(ctx).toContain('e.g.');
  });
});

describe('2.27 privacy guard', () => {
  it('git ignores the local glossary and the private eval fixtures', () => {
    const repo = path.resolve(__dirname, '..');
    for (const p of ['handwriting-reference.local.json', 'eval-private/case-01/image.jpg']) {
      // exits non-zero (throws) when the path is NOT ignored
      execFileSync('git', ['check-ignore', '-q', p], { cwd: repo });
    }
  });
});
