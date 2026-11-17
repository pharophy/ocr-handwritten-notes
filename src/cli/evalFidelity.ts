#!/usr/bin/env node
/**
 * Local OCR fidelity evaluation against a hand-verified transcription.
 *
 *   npm run eval:fidelity -- <image> <verified.md> [--runs N] [--set KEY=VALUE ...]
 *                            [--correction legacy|narrow|off] [--src <dir>] [--label name]
 *
 * Runs the real OCR path (live API calls) N times and reports, per run and on
 * average: word recall/precision (content kept vs invented, layout-independent),
 * line recall (each verified line found as its own line), indent agreement,
 * struck-line handling, run-to-run spread, latency and token usage.
 *
 * --set applies environment overrides for the run (e.g. OCR_SEGMENT_MAX_HEIGHT=1200,
 * AI_MODEL_OCR=gpt-5). --src imports the OCR modules from another checkout (e.g. a
 * worktree of the pre-change commit) to measure a baseline with the same metrics.
 *
 * Fixtures are real notes: keep them in eval-private/ (git-ignored). Results are
 * written next to the verified file under results/.
 */
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { score, toLines, words, type Metrics } from '../eval/fidelityMetrics';

dotenv.config();

interface Args {
  image: string;
  verified: string;
  runs: number;
  sets: Record<string, string>;
  correction: 'legacy' | 'narrow' | 'off';
  src?: string;
  label: string;
}

function parseArgs(argv: string[]): Args {
  const pos: string[] = [];
  const sets: Record<string, string> = {};
  let runs = 3;
  let correction: Args['correction'] = 'legacy';
  let src: string | undefined;
  let label = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runs') runs = parseInt(argv[++i], 10);
    else if (a === '--set') {
      const [k, ...v] = argv[++i].split('=');
      sets[k] = v.join('=');
    } else if (a === '--correction') correction = argv[++i] as Args['correction'];
    else if (a === '--src') src = path.resolve(argv[++i]);
    else if (a === '--label') label = argv[++i];
    else pos.push(a);
  }
  if (pos.length < 2) {
    console.error('Usage: npm run eval:fidelity -- <image> <verified.md> [--runs N] [--set KEY=VALUE ...] [--correction legacy|narrow|off] [--src dir] [--label name]');
    process.exit(1);
  }
  if (!label) {
    label = [src ? 'baseline' : 'current', `corr-${correction}`, ...Object.entries(sets).map(([k, v]) => `${k}=${v}`)].join(' ');
  }
  return { image: pos[0], verified: pos[1], runs, sets, correction, src, label };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const spread = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const [k, v] of Object.entries(args.sets)) process.env[k] = v;

  const srcDir = args.src ?? path.resolve('src'); // npm scripts run from the repo root
  const ocr: any = await import(path.join(srcDir, 'ocr.ts'));
  const validator: any = await import(path.join(srcDir, 'ocrValidator.ts'));

  const image = await fs.readFile(args.image);
  const verified = await fs.readFile(args.verified, 'utf8');
  const results: any[] = [];

  console.log(`\n▶ ${args.label} — ${args.runs} run(s)\n`);

  for (let r = 0; r < args.runs; r++) {
    ocr.resetOCRCacheForTests?.();
    validator.resetOCRValidatorCacheForTests?.();
    ocr.resetOCRUsageStats?.();
    const t0 = Date.now();

    const result = await ocr.processHandwrittenImage(image, path.basename(args.image));
    if (!result) {
      console.log(`  run ${r + 1}: OCR returned nothing`);
      continue;
    }
    let text: string = result.text;
    let corrections = 0;
    if (args.correction !== 'off') {
      const report = await validator.validateOCROutput(text);
      if (report?.hasIssues) {
        const cfg = await validator.getCorrectionConfig();
        const corrected = await validator.correctOCRIssues(text, image, report, { ...cfg, enabled: true, mode: args.correction }, { segmentTexts: result.segmentTexts });
        text = corrected.correctedText;
        corrections = corrected.correctionCount;
      }
    }

    const seconds = (Date.now() - t0) / 1000;
    const usage = ocr.getOCRUsageStats?.() ?? null;
    const m = score(text, verified);
    results.push({ run: r + 1, modelUsed: result.modelUsed, incomplete: result.incomplete ?? null, warning: text.includes('[!warning]'), corrections, seconds, usage, metrics: m, text });
    console.log(
      `  run ${r + 1}: words ${pct(m.wordRecall)} kept / ${pct(m.wordPrecision)} precise · lines ${pct(m.lineRecall)} · indent ${pct(m.indentAgreement)} · struck ${m.struckMarked}/${m.struckTotal} marked, ${m.struckAsPlain} as plain · corrections ${corrections} · ${result.modelUsed} · ${seconds.toFixed(0)}s${usage ? ` · ${usage.calls} calls, ${usage.promptTokens}+${usage.completionTokens} tok` : ''}`
    );
  }

  const ms = results.map(r => r.metrics as Metrics);
  const summary = {
    label: args.label,
    runs: results.length,
    wordRecall: mean(ms.map(m => m.wordRecall)),
    wordRecallSpread: spread(ms.map(m => m.wordRecall)),
    wordPrecision: mean(ms.map(m => m.wordPrecision)),
    lineRecall: mean(ms.map(m => m.lineRecall)),
    lineRecallSpread: spread(ms.map(m => m.lineRecall)),
    indentAgreement: mean(ms.map(m => m.indentAgreement)),
    struckMarked: mean(ms.map(m => m.struckMarked)),
    struckAsPlain: mean(ms.map(m => m.struckAsPlain)),
    corrections: mean(results.map(r => r.corrections)),
    warnings: results.filter(r => r.warning).length,
    seconds: mean(results.map(r => r.seconds)),
    calls: mean(results.map(r => r.usage?.calls ?? 0)),
    promptTokens: mean(results.map(r => r.usage?.promptTokens ?? 0)),
    completionTokens: mean(results.map(r => r.usage?.completionTokens ?? 0)),
    models: [...new Set(results.map(r => r.modelUsed))],
  };

  console.log(
    `\n  mean: words ${pct(summary.wordRecall)} (±${pct(summary.wordRecallSpread / 2)}) kept, ${pct(summary.wordPrecision)} precise · lines ${pct(summary.lineRecall)} (spread ${pct(summary.lineRecallSpread)}) · indent ${pct(summary.indentAgreement)} · struck marked ${summary.struckMarked.toFixed(1)}, as plain ${summary.struckAsPlain.toFixed(1)} · warnings ${summary.warnings}/${summary.runs} · ${summary.seconds.toFixed(0)}s/run`
  );

  const outDir = path.join(path.dirname(args.verified), 'results');
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')} ${args.label.replace(/[^\w.=-]+/g, '_')}.json`);
  await fs.writeFile(file, JSON.stringify({ summary, sets: args.sets, correction: args.correction, src: args.src ?? null, results }, null, 2));
  console.log(`  saved ${file}\n`);
}

export const __test = { score, toLines, words };
if (!process.env.EVAL_FIDELITY_NO_RUN) main().catch(err => {
  console.error('❌ Evaluation failed:', err?.message || err);
  process.exit(1);
});
