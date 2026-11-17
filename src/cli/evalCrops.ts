#!/usr/bin/env node
/**
 * Targeted OCR checks on small crops of real pages (live API calls, on demand only).
 *
 *   npm run eval:crops -- <manifest.json> [--runs N] [--only id,id] [--set KEY=VALUE ...]
 *                         [--correction legacy|narrow|off] [--src <dir>] [--concurrency N] [--label name]
 *
 * Each crop isolates one failure (a dropped block, a struck line, deep nesting, a
 * strip join, a hard word) and is OCR'd N times in parallel, so a fix can be
 * checked in about a minute instead of a full-page run. A run passes when every
 * expected line is present at its nesting level, struck lines are marked ~~, and
 * every required phrase appears.
 *
 * Manifest (keep it and its source image in eval-private/, git-ignored):
 *   { "source": "../case-01/image.jpg",
 *     "crops": [ { "id": "struck", "y0": 7130, "y1": 7620, "failure": "…",
 *                  "expected": "- line\n  - child", "words": ["agent orch"] } ] }
 */
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { score, type Metrics } from '../eval/fidelityMetrics';

dotenv.config();

interface Crop {
  id: string;
  y0: number;
  y1: number;
  x0?: number;
  x1?: number;
  failure?: string;
  expected: string;
  words?: string[];
}

interface Manifest {
  source: string;
  crops: Crop[];
}

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const sets: Record<string, string> = {};
  let runs = 5;
  let only: string[] | null = null;
  let correction: 'legacy' | 'narrow' | 'off' = 'legacy';
  let src: string | undefined;
  let concurrency = 8;
  let label = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runs') runs = parseInt(argv[++i], 10);
    else if (a === '--only') only = argv[++i].split(',');
    else if (a === '--set') {
      const [k, ...v] = argv[++i].split('=');
      sets[k] = v.join('=');
    } else if (a === '--correction') correction = argv[++i] as typeof correction;
    else if (a === '--src') src = path.resolve(argv[++i]);
    else if (a === '--concurrency') concurrency = parseInt(argv[++i], 10);
    else if (a === '--label') label = argv[++i];
    else pos.push(a);
  }
  if (!pos[0]) {
    console.error('Usage: npm run eval:crops -- <manifest.json> [--runs N] [--only id,id] [--set KEY=VALUE ...] [--correction legacy|narrow|off] [--src dir] [--concurrency N] [--label name]');
    process.exit(1);
  }
  if (!label) label = [src ? 'baseline' : 'current', `corr-${correction}`, ...Object.entries(sets).map(([k, v]) => `${k}=${v}`)].join(' ');
  return { manifest: path.resolve(pos[0]), runs, only, sets, correction: correction as "legacy" | "narrow" | "off", src, concurrency, label };
}

const norm = (s: string) => s.toLowerCase().replace(/[*~_`]/g, '').replace(/\s+/g, ' ');

async function pool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    })
  );
  return out;
}

interface RunResult {
  crop: string;
  run: number;
  ok: boolean;
  error?: string;
  metrics?: Metrics;
  wordsFound?: Record<string, boolean>;
  pass?: boolean;
  seconds: number;
  modelUsed?: string;
  text?: string;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const [k, v] of Object.entries(args.sets)) process.env[k] = v;

  const srcDir = args.src ?? path.resolve('src');
  const ocr: any = await import(path.join(srcDir, 'ocr.ts'));
  const validator: any = await import(path.join(srcDir, 'ocrValidator.ts'));

  const manifest: Manifest = JSON.parse(await fs.readFile(args.manifest, 'utf8'));
  const sourcePath = path.resolve(path.dirname(args.manifest), manifest.source);
  const source = await fs.readFile(sourcePath);
  const meta = await sharp(source).metadata();
  const crops = manifest.crops.filter(c => !args.only || args.only.includes(c.id));

  const images = new Map<string, Buffer>();
  for (const c of crops) {
    const left = c.x0 ?? 0;
    const width = (c.x1 ?? meta.width!) - left;
    images.set(c.id, await sharp(source).extract({ left, top: c.y0, width, height: c.y1 - c.y0 }).jpeg({ quality: 95 }).toBuffer());
  }

  console.log(`\n▶ ${args.label} — ${crops.length} crop(s) × ${args.runs} run(s)\n`);
  ocr.resetOCRUsageStats?.();
  const t0 = Date.now();

  const tasks = crops.flatMap(c =>
    Array.from({ length: args.runs }, (_, r) => async (): Promise<RunResult> => {
      const start = Date.now();
      try {
        const image = images.get(c.id)!;
        const result = await ocr.processHandwrittenImage(image, `${c.id}.jpg`);
        if (!result) return { crop: c.id, run: r + 1, ok: false, error: 'no result', seconds: (Date.now() - start) / 1000 };
        let text: string = result.text;
        if (args.correction !== 'off') {
          const report = await validator.validateOCROutput(text);
          if (report?.hasIssues) {
            const cfg = await validator.getCorrectionConfig();
            text = (await validator.correctOCRIssues(text, image, report, { ...cfg, enabled: true, mode: args.correction }, { segmentTexts: result.segmentTexts })).correctedText;
          }
        }
        const metrics = score(text, c.expected);
        const wordsFound = Object.fromEntries((c.words ?? []).map(w => [w, norm(text).includes(norm(w))]));
        const pass =
          metrics.lineRecall === 1 &&
          metrics.indentAgreement === 1 &&
          metrics.struckMarked === metrics.struckTotal &&
          Object.values(wordsFound).every(Boolean);
        return { crop: c.id, run: r + 1, ok: true, metrics, wordsFound, pass, seconds: (Date.now() - start) / 1000, modelUsed: result.modelUsed, text };
      } catch (e: any) {
        return { crop: c.id, run: r + 1, ok: false, error: e?.message || String(e), seconds: (Date.now() - start) / 1000 };
      }
    })
  );

  const results = await pool(tasks, args.concurrency);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  let totalPass = 0;
  let totalRuns = 0;
  for (const c of crops) {
    const rs = results.filter(r => r.crop === c.id);
    const okRuns = rs.filter(r => r.ok);
    const passes = okRuns.filter(r => r.pass).length;
    totalPass += passes;
    totalRuns += rs.length;
    const m = okRuns.map(r => r.metrics!);
    const struck = m.length && m[0].struckTotal ? ` · struck marked ${m.filter(x => x.struckMarked === x.struckTotal).length}/${m.length}` : '';
    const words = (c.words ?? []).map(w => `"${w}" ${okRuns.filter(r => r.wordsFound![w]).length}/${okRuns.length}`).join(', ');
    const missing = new Map<string, number>();
    m.forEach(x => x.missingLines.forEach(l => missing.set(l, (missing.get(l) ?? 0) + 1)));
    const topMissing = [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l, n]) => `"${l.slice(0, 50)}" ×${n}`).join('; ');
    const errors = rs.filter(r => !r.ok).length;
    console.log(
      `  ${passes === rs.length ? '✅' : passes === 0 ? '❌' : '⚠️ '} ${c.id.padEnd(14)} pass ${passes}/${rs.length} · lines ${pct(avg(m.map(x => x.lineRecall)))} · indent ${pct(avg(m.map(x => x.indentAgreement)))} · words kept ${pct(avg(m.map(x => x.wordRecall)))}${struck}${words ? ` · ${words}` : ''}${errors ? ` · ${errors} errored` : ''} · ${avg(rs.map(r => r.seconds)).toFixed(0)}s`
    );
    if (topMissing) console.log(`      missing: ${topMissing}`);
  }
  const usage = ocr.getOCRUsageStats?.();
  console.log(
    `\n  total: ${totalPass}/${totalRuns} runs passed · ${((Date.now() - t0) / 1000).toFixed(0)}s wall${usage ? ` · ${usage.calls} vision calls, ${usage.promptTokens}+${usage.completionTokens} tokens` : ''}`
  );

  const outDir = path.join(path.dirname(args.manifest), 'results');
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')} ${args.label.replace(/[^\w.=-]+/g, '_')}.json`);
  await fs.writeFile(file, JSON.stringify({ label: args.label, sets: args.sets, correction: args.correction, src: args.src ?? null, usage, results }, null, 2));
  console.log(`  saved ${file}\n`);
}

main().catch(err => {
  console.error('❌ Crop evaluation failed:', err?.message || err);
  process.exit(1);
});
