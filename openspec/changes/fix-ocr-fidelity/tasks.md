## 1. Setup and baseline

- [x] 1.1 Add `eval-private/` and `handwriting-reference.local.json` to `.gitignore`.
- [x] 1.2 Create `eval-private/case-01/` (git-ignored) with a copy of the reviewed note photo and a hand-verified `verified.md` transcription (correct line breaks, two-space indent per level, struck lines in `~~ ~~`, uncertain words marked).
- [x] 1.3 Run `npm test` on the unchanged code and record the baseline (all existing tests should pass).

## 2. Write failing tests first (no source changes in this group)

All fixtures are synthetic: blank or drawn images with the failing geometry, and placeholder text. No real note content.

Prompt and quality
- [x] 2.1 `tests/ocr-prompt.test.ts`: with default settings, the OCR prompt does not contain "Do not use *italics*" and does instruct `*italics*` for unclear words. With `OCR_UNCERTAINTY_MARKERS=false`, it doesn't request markers. (Uncertainty markers)
- [x] 2.2 `tests/ocr-prompt.test.ts`: the OCR prompt instructs that crossed-out text is transcribed as `~~text~~` and that each bullet goes on one line at its written nesting level. (Strikethrough, layout)
- [x] 2.3 `tests/ocr-quality.test.ts`: with a mocked provider returning >30% `*italic*` words, `processHandwrittenImage` calls the fallback model. (Quality check reachable end to end)

Provider and resolution
- [x] 2.4 `tests/ai-provider-images.test.ts`: the OpenAI request puts `detail: "high"` on every `image_url` part for OCR, fallback and correction. With one extra image, both the OpenAI and Anthropic adapters send it before the target image. A call with no extras is unchanged from today. (Resolution, multi-image)
- [x] 2.5 `tests/ocr-segmentation.test.ts`: a blank 1536×10199 image splits into segments each ≤768px tall with 150px overlap by default, and `OCR_SEGMENT_MAX_HEIGHT` / `OCR_SEGMENT_OVERLAP` override them. (Resolution)

Completeness
- [x] 2.6 `tests/ocr-segment-completeness.test.ts`: on a synthetic image with drawn "handwriting" strokes in every segment, a segment returning ~40% of the median characters-per-ink is flagged and one at ~80% is not. (Partial drops)
- [x] 2.7 `tests/ocr-segment-completeness.test.ts`: an interior blank-paper segment (ruled lines and a shadow gradient only, no strokes) returning no text is not flagged. Three empty segments after the last inked segment don't mark the result incomplete. (False-positive guards; the second fails today because only the last index is exempt.)
- [x] 2.8 `tests/ocr-segment-completeness.test.ts`: when the fallback also returns an incomplete result, the written transcription starts with a `> [!warning]` callout. The same happens when no fallback is configured, and no callout appears on a complete result. (Visible failure)

Segments and layout
- [x] 2.9 `tests/ocr-segment-context.test.ts`: for segment 2 onward, the prompt contains the last lines of the stitched transcript with their indentation, labelled as nesting context, and still asks for every visible line. (Indentation across segments)
- [x] 2.10 `tests/ocr-segmentation.test.ts`: stitching drops a repeated overlap block whose lines differ slightly (extra space, missing comma, one changed character), keeps exactly one blank line at a join between blocks, and keeps legitimately repeated lines inside a segment. (Fuzzy overlap, blank lines at joins)
- [x] 2.11 `tests/ocr-layout.test.ts`: a three-level nested bullet input produces one output line per bullet, and no sub-bullet is merged into its parent. (Nested bullets flattened)
- [x] 2.12 `tests/ocr-layout.test.ts`: a hanging-indented continuation is joined onto its bullet with a single space. A marker-less label at or left of the bullet's marker (e.g. `2027`, `Notes:`) stays on its own line. (Wrapped bullet vs label)
- [x] 2.13 `tests/ocr-layout.test.ts`: inputs indented with 2, 3 and 4 spaces and with tabs all normalize to 2 spaces per level, and a child is never more than one level deeper than its parent. (Consistent indentation)
- [x] 2.14 `tests/ocr-layout.test.ts`: blank lines between blocks are kept (runs collapse to one), and markdown table rows are left untouched. (Blank lines, tables)
- [x] 2.15 `tests/ocr-output.test.ts`: `stripCodeFence` removes a ```` ```markdown ```` / ```` ``` ```` wrapper from a segment response and from the final text, and leaves unfenced text unchanged. (Code fence)

Correction
- [x] 2.16 `tests/ocr-correction.test.ts`: with `ocrCorrection.mode` = `off`, no correction request is made. Unset or `legacy` produces the same requests and output as today (captured from the current code before any fix). (Modes)
- [x] 2.17 `tests/ocr-correction.test.ts`: in `narrow` mode, issues of type `grammar`, `semantics` and `incomplete` produce no request even at critical severity and high confidence. Only `encoding` issues do. (Correction safety)
- [x] 2.18 `tests/ocr-correction.test.ts`: in `narrow` mode, the correction prompt never contains "Validation suggests" or the issue's suggestion text. (Validator guess leak)
- [x] 2.19 `tests/ocr-correction.test.ts`: in `narrow` mode, a mocked correction that adds words and inverts the phrase (placeholder text, e.g. "the outcome you want" → "the outcome you want but lack") is discarded. (Meaning change)
- [x] 2.20 `tests/ocr-correction-modes.test.ts`: in `narrow` mode, a phrase found only in strip 2's transcription is sent only with strip 2. A phrase that appears more than once in the text is skipped, because its position is ambiguous (the transcription keeps no per-line strip record). (Wrong strip, first-match replace)
- [x] 2.21 `tests/ocr-validator.test.ts`: the validation prompt states that input is terse shorthand and that fragments are not grammar errors. (Shorthand awareness)

Summarization
- [x] 2.22 `tests/text-summarization.test.ts`: the text passed to the summarizer from both `main.ts` and `convert-single.ts` is the final transcription only: no link line, no "OCR Validation Report", no correction log, and in `convert-single` the post-correction text rather than the pre-correction text. (Report leak)
- [x] 2.23 `tests/text-summarization.test.ts`: `stripStruckText` removes `~~…~~` spans and lines left empty, so a struck `AI:` line never reaches the summarizer. (Struck action items)
- [x] 2.24 `tests/text-summarization.test.ts`: the summary prompt limits Key Decisions to explicitly recorded decisions, with the exact fallback "No explicit decisions recorded." (Invented decisions)

Reference and glossary
- [x] 2.25 `tests/handwriting-reference.test.ts`: with `HANDWRITING_REFERENCE_MODE=image` (default) and a cached reference, every segment call carries the downscaled reference image before the target, plus the reference-image instructions. With `words`, the prompt has the formatted reference words and no image. With `off`, neither. (Unused reference)
- [x] 2.26 `tests/handwriting-reference.test.ts`: a temp `handwriting-reference.local.json` merges `properNouns`, `businessTerms`, `acronyms` and `abbreviations` (local wins on conflict). An absent overlay is a no-op. A malformed one logs a warning and is ignored. Abbreviations appear in the OCR prompt. (Glossary overlay)
- [x] 2.27 `tests/handwriting-reference.test.ts`: `git check-ignore` reports both `handwriting-reference.local.json` and `eval-private/` as ignored. (Privacy guard; passes already from 1.1 and stays as a regression guard.)

Output links
- [x] 2.28 `tests/batch-processing.test.ts`: `main.ts` and `convert-single.ts` produce identical first lines, `[[name - Summary and Actions]] | [[name.jpg]]` and `[[name]] | [[name.jpg]]`, with no `.md` in the links. (Link format)

Gate
- [x] 2.29 Run `npm test` and confirm that every test from 2.1–2.28 except 2.27 fails, each for the reason it targets (not a setup error, beyond missing exports that the fix will add). Record the failing list here before starting group 3.
  - **Recorded 2026-11-16, source unchanged:** 12 new files, 65 tests: **53 failed, 12 passed**. Failure reasons: missing exports `normalizeLayout`, `stripStruckText`, `stripCodeFence`, `findUnderfilledByInk`, `computeInkCoverage` and module `src/pipeline`; no `detail: "high"`; one image per call (no reference); 2200px segments; exact-match stitching (duplicates, lost blank lines); interior/trailing empty strips flagged; no fallback on unresolved incompleteness and no warning; prompt forbids italics, no strikethrough/one-line-per-bullet/nesting context; correction acts in `off` mode, on grammar/semantics/incomplete, with "Validation suggests", accepts word-adding answers, uses the wrong strip, and replaces ambiguous phrases; no shorthand note in the validator; summary prompt has no explicit-decisions rule; no glossary overlay or abbreviations.
  - The 12 that pass are guards, by design: 2.27 privacy; italic-heavy result reaches the fallback (2.3: the check worked, but the prompt forbade markers); markers-off prompt; a no-options OpenAI call is unchanged; first segment gets no context; env override at 2200/200; repeated lines within a segment kept; inked empty interior still incomplete; complete result gets no callout; reference `off`; absent overlay is a no-op; legacy correction snapshot (captured from the current code).
  - Test files differ from the names above where existing files would have been broken by a missing import: `ocr-prompt`, `ai-provider-images`, `ocr-segmentation-fidelity`, `ocr-segment-completeness-ink`, `ocr-segment-context`, `ocr-layout`, `ocr-output`, `ocr-correction-modes`, `pipeline-output`, `summarize-fidelity`, `ocr-reference-mode`, `glossary-overlay` (+ `tests/helpers/syntheticPage.ts`).

## 3. Fixes: provider, resolution, completeness

- [x] 3.1 Add optional extra images and a detail level to `generateVisionCompletion` in both adapters, and send `"high"` from OCR, fallback and correction. Makes 2.4 pass.
- [x] 3.2 Set `SEGMENT_MAX_HEIGHT` to 768 and `SEGMENT_OVERLAP` to 150, with `OCR_SEGMENT_MAX_HEIGHT` / `OCR_SEGMENT_OVERLAP` overrides. Makes 2.5 pass.
- [x] 3.3 Add per-segment ink coverage, and replace peer density with characters-per-ink at a 0.5 ratio. Add the blank-paper floor and the trailing-empty-run rule. Makes 2.6 and 2.7 pass. Update the existing completeness tests where their premise was peer density, and keep their intent.
- [x] 3.4 Prepend the `> [!warning]` callout when the returned result is still incomplete or poor. Makes 2.8 pass.

## 4. Fixes: prompt, segments, layout, output

- [x] 4.1 Rewrite the OCR prompt (italics behind `OCR_UNCERTAINTY_MARKERS`, `~~ ~~` for crossed-out text, one line per bullet at its nesting level). Makes 2.1–2.3 pass.
- [x] 4.2 Pass the stitched transcript's trailing lines into segment prompts as nesting context. Makes 2.9 pass.
- [x] 4.3 Make overlap removal fuzzy (normalized similarity ≥ 0.9), and stop trimming blank lines at segment edges. Makes 2.10 pass.
- [x] 4.4 Replace `condenseBulletLines` with `normalizeLayout`. Makes 2.11–2.14 pass.
- [x] 4.5 Add `stripCodeFence`, applied per segment and to the final text. Makes 2.15 pass.

## 5. Fixes: validation and correction

- [x] 5.1 Add `ocrCorrection.mode` (`legacy` default, `narrow`, `off`), with `enabled: false` treated as `off`. Makes 2.16 pass.
- [x] 5.2 In `narrow`: only `encoding` issues, no suggestion in the prompt, the word-count guard, and the tracked segment and position. Makes 2.17–2.20 pass.
- [x] 5.3 Add the shorthand note to the validation prompt. Makes 2.21 pass.

## 6. Fixes: summarization

- [x] 6.1 Pass only the final transcription to `summarizeText` in `main.ts` and `convert-single.ts`. Makes 2.22 pass.
- [x] 6.2 Add `stripStruckText` and apply it before summarizing. Makes 2.23 pass.
- [x] 6.3 Update the summary prompt for explicit-only Key Decisions and the exact fallback line. Makes 2.24 pass.

## 7. Fixes: reference and glossary

- [x] 7.1 Add `HANDWRITING_REFERENCE_MODE`. In `image` mode, downscale and cache the reference once and attach it first with its instructions. In `words`, append the formatted reference words. Makes 2.25 pass.
- [x] 7.2 Implement the local glossary overlay merge, add the `abbreviations` map, and render abbreviations into the OCR prompt. Makes 2.26 pass.
- [x] 7.3 Create a local (ignored) `handwriting-reference.local.json` with the people, product names and acronyms seen in recent notes, and `es.` / `e.s.` → `e.g.`. Confirm that 2.27 still passes and `git status` doesn't show the file.

## 8. Fixes: output links

- [x] 8.1 Add a shared output-header builder and use it from `main.ts` and `convert-single.ts`. Makes 2.28 pass.

## 9. Verify and evaluate

- [x] 9.1 Run `npm test`: every test from group 2 passes, and every existing test still passes. Record the result here.
  - **Recorded 2026-11-16:** `npm test` → 28 files passed, 1 skipped; **273 tests passed, 7 skipped, 0 failed** (baseline was 205 passed, 7 skipped). Existing tests updated where their premise changed: `ocr-processing` prompt assertions (they asserted the old "Do not use *italics*" text), `ocr-segment-completeness` and `ocr-fallback-integration` tall-image cases pinned to the original 2200/200 geometry they document, with the two drop cases using an inked synthetic page (blank paper is no longer a drop). Also found and fixed during 8.1: `convert-single.ts` itself wrapped transcriptions in a ```` ```markdown ```` fence, and it didn't load `.env` (it now calls `dotenv.config()`).
- [x] 9.2 Add `npm run eval:fidelity -- <image> <verified.md> [--runs N] [--set KEY=VALUE ...]`. It reports line recall (scored after stripping `*…*` markers), indent agreement, struck-line handling, run-to-run variance, latency and approximate cost per page.
- [x] 9.3 Baseline: run the evaluation on `eval-private/case-01/` with the pre-change commit (checked out in a worktree) and with this change at its defaults, 3 runs each. Record both here.
- [x] 9.4 Settings comparison, one setting at a time against this change's defaults, on `case-01` and the existing short test image, 3 runs each: segment height 768 vs 1200, uncertainty markers on vs off, reference `image` vs `words` vs `off`, correction `legacy` vs `narrow` vs `off`. Record a table here.
- [x] 9.5 Check that the `case-01` output at the winning settings has no missing blocks from the verified transcript, that the struck action line appears only as `~~…~~` and not in Action Items, that no "Key Decisions" are invented, that nesting matches the page, and that no false `> [!warning]` appears. If line recall is still below target, note it against the design's open questions.
- [x] 9.6 Confirm the exact API model IDs and access for Claude Opus 5.5 (`claude-opus-5-5`), GPT-6 Luna and GPT-6.1 Terra by listing models from each provider's API with the configured keys (don't guess the OpenAI IDs). Note any model that isn't available to these keys and skip it, rather than substituting another.
  - **Checked 2026-11-16 against the OpenAI models API with the configured key:** `gpt-6-luna` and `gpt-6.1-terra` are available (along with `gpt-6-sol`, `gpt-6-astra`, `gpt-6.1-sol` and the `gpt-5.6-*` family, not part of this comparison). **Claude Opus 5.5 is skipped:** `.env` has no `ANTHROPIC_API_KEY`, so the Anthropic provider can't be used. It wasn't substituted. To include it later, add the key and run 9.7 with `--set AI_PROVIDER=anthropic --set AI_MODEL_OCR=claude-opus-5-5`.
  - **9.4 scope:** the "existing short test image" (`test-images/`) is not present on this machine, so the settings comparison uses `case-01` only.
- [x] 9.7 Model comparison at the winning settings: run each candidate against the current model (`gpt-5-mini` primary, `gpt-5` fallback) on `case-01`, 3 runs each, overriding `AI_MODEL_OCR`. Record line recall, indent agreement, struck-line handling, variance, latency and cost per page in a table here.
- [x] 9.8 Write up the results for Shawn: the recommended settings defaults, the correction recommendation (delete, narrow or keep on, with the numbers), and the recommended primary and fallback model. Don't change `.env`, the correction default or the model defaults until Shawn accepts. Applying them, and deleting the losing correction modes, is a follow-up.
- [x] 9.9 Update `README.md` with the new env vars and settings, the local glossary overlay, the output markers (`*uncertain*`, `~~struck~~`, warning callout), the eval command and the results.
- [x] 9.10 Run `openspec validate fix-ocr-fidelity --strict`.

## 10. Evaluation results and follow-up fixes (2026-11-16)

Full-page runs took ~24 minutes each, so the settings and model comparisons moved to a crop suite (`npm run eval:crops`): seven small regions of the `case-01` page, each isolating one failure, OCR'd several times in parallel (~1 minute per pass). The failures were reproduced on the pre-change code first (0/21 crop runs passed).

- [x] 10.1 Add `eval:crops` (targeted live checks on crops: lines present, nesting level, struck lines marked, required phrases) and share the fidelity metrics with `eval:fidelity` (`src/eval/fidelityMetrics.ts`).
- [x] 10.2 Baseline (9.3): pre-change full page, 3 runs: 79% words kept, 34% lines as their own line, 49% indent agreement, struck line never marked, 0–3 meaning-changing corrections per run.
- [x] 10.3 Models (9.7), crops, fallback off, 3 runs each: gpt-6.1-terra best (5/21 passed, 97–100% words kept, lowest latency and output tokens); gpt-5 2/21; gpt-5-mini and gpt-6-luna 0/21. Claude Opus 5.5 not run (no Anthropic key).
- [x] 10.4 Settings (9.4) on gpt-6.1-terra: reference image off 10/21 (vs 5/21 with it), correction off 9/21 (narrow 7/21, legacy 5/21), 1200px segments 11/21, markers off 6/21, reference words 5/21. Combined (terra, reference off, correction off, 1200px): 19/35 over 5 runs; the same at 768px: 12/35. `OCR_REASONING_EFFORT=low` was ~35% faster but less accurate.
- [x] 10.5 Accepted (9.8): `.env` now uses `AI_MODEL_OCR=gpt-6.1-terra`, `HANDWRITING_REFERENCE_MODE=off`, `OCR_SEGMENT_MAX_HEIGHT=1200`. Code defaults are unchanged. Still open: the fallback model (gpt-5 scored below terra) and the correction default (results favor deleting correction).
- [x] 10.6 Fixes found by the crop and full-page runs, each test-first: newer models (`gpt-6*`) get `max_completion_tokens`; optional `OCR_REASONING_EFFORT`; no sliver segments (the last strip is anchored to the page bottom); clearer nesting instruction; a "never swap in a glossary term" rule; completeness judged on what each strip adds after stitching against the ink of the band only it covers (weighted by band height); ink threshold raised so ruled lines and binder rings aren't ink; overlap removal that tolerates different line wrapping, a fragment of the previous line, a truncated previous line, and one differently-read line in a longer block; lines whose numbers differ are never merged.
- [x] 10.7 Final full page at the accepted settings: no false warning, no fallback, no duplicated lines; 100% lines, 98% words kept, 98% word precision, 84% indent agreement, struck line marked.
- [ ] 10.8 Follow-ups: decide the fallback model and the correction default (and delete the losing correction modes); fix nesting across stitched-page seams; re-check `case-01` readings the models never produce ("agent orch"); evaluate Opus 5.5 once an Anthropic key is available.
