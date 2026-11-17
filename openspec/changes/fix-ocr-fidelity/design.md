## Context

The pipeline is: preprocess (grayscale, cap width at 1600px) → cut tall images into 2200px vertical segments with 200px overlap → OCR each segment with `gpt-5-mini` → stitch → condense bullets → assess quality → maybe fallback to `gpt-5` → text-only validation → multi-pass correction → write `{name}.md` → summarize → write `{name} - Summary and Actions.md`.

A review of one real note (6 stitched pages, 1536×10199, 5 segments) traced each observed defect to code:

| Observed defect | Cause |
|---|---|
| Whole blocks missing, different blocks on each run | Segments are 1536×2200 and no `detail` is set (`aiProvider.ts`), so the provider likely downsizes them (OpenAI's high-detail mode fits the short side to ~768px). Partial drops of 30–50% pass the 0.25 density ratio (`ocr.ts` `SEGMENT_MIN_DENSITY_RATIO`). |
| 0% uncertainty, fallback never runs | The prompt says "Do not use *italics* or uncertainty markers", but `assessOCRQuality` measures quality by counting those markers. This also contradicts the existing "Ambiguous characters" scenario in `ocr-processing`. |
| Struck-out "AI:" line became an action item | The prompt never mentions crossed-out text. |
| Meaning changed (a correction added words that inverted a phrase) | The text-only validator flags shorthand as critical grammar errors. Its guessed meaning is fed to the vision model as "Validation suggests…", and the grammar template asks for missing words. |
| Garbled word from the report showed up in an action item | `main.ts` summarizes `ocrOutput` (link line + transcript + validation report) instead of the transcript. |
| Invented "Key Decisions" | The summary prompt always demands the section. |
| Nested bullets flattened into run-on lines | `condenseBulletLines` only stops at a bullet indented the same or less, so deeper sub-bullets are treated as continuation lines. |
| Nesting lost and blank lines dropped at segment joins | Each segment is transcribed with no knowledge of the indentation above it. `toTrimmedLines` strips blank lines at segment edges. |
| Names and personal shorthand misread | The reference image is loaded but never sent, and reference words are never added to the prompt. Both were removed, along with uncertainty markers, in commit `9b31f0a` when the "precise-minimal" prompt scored 91% on one short test image (`improve-ocr-accuracy`). The glossary's only proper noun is "Vacation". |
| Fallback and warning would fire on every tall note once segments shrink | `findEmptySegments` exempts only the last array index, so 2+ blank strips of trailing paper look like an interior drop. Peer-density comparison flags strips that are mostly blank paper. |
| Correction can use the wrong strip | `requestPhraseCorrection` accepts the first strip that doesn't answer `NOT_PRESENT`, even if the phrase isn't in that strip. It then replaces the first occurrence in the text. |
| ```` ```markdown ```` wrapper in output | No fence stripping. |
| `[[x.md]]` vs `[[x]]` links | `convert-single.ts` and `main.ts` build links differently. |

Constraints: the repo has a public remote, so real note images, their transcriptions and real people's names must never be committed (the existing segment tests already follow this by reproducing only geometry and text shape). Tests use vitest and mock the provider. There are no live API calls in `npm test`.

## Goals / Non-Goals

**Goals:**
- Each defect above has an automated test that fails on the current code and passes after the fix.
- Output line breaks and indentation follow the page.
- Bad output is visible as bad (uncertainty markers, warning callout) instead of looking clean.
- A repeatable, local-only measurement of fidelity on real images, to confirm that the mechanism fixes actually improve accuracy.

**Non-Goals:**
- Switching the default OCR model. Model choice stays in `.env`. The evaluation results will inform it separately.
- Detecting and splitting at stitched-photo page seams. Shorter overlapping segments are the first step; seam detection is an open question.
- Anthropic-provider detail tuning beyond what's needed to keep the provider interface uniform.
- Rewriting the validator's scoring model.

## Decisions

### 1. Test-first, one failing test per defect
Write all new tests first (task group 1), run them, and record that each one fails for the stated reason before any fix lands. Mechanism-level behavior (prompt content, request shape, segment geometry, string transforms, gating logic) is deterministic and unit-testable with a mocked provider. The outcome (does the model read more lines?) is not deterministic, so it is measured by a separate local evaluation (Decision 9) rather than asserted in CI.
- *Alternative:* snapshot-test real model output. Rejected: non-deterministic, costs money per run, and the fixtures would be confidential.

### 2. Resolution: explicit `detail: "high"` plus 768px segments
The vision call gains optional extra images and a detail level (`ai-provider-abstraction` delta). OCR, fallback and correction always send `"high"`. Under OpenAI's documented high-detail rule (fit within 2048², then shrink the short side to 768), the scale kept for a 1536-wide strip is:

| Strip | Scale kept | ~52px handwriting line becomes |
|---|---|---|
| 1536×2200 (today) | 0.50 | ~26px |
| 1536×1200 | 0.64 | ~33px |
| 1536×768 | 1.00 | 52px |

Anthropic's ~1.15MP limit gives a similar result (768 fits, 1200 doesn't). Default `OCR_SEGMENT_MAX_HEIGHT` = 768 and `OCR_SEGMENT_OVERLAP` = 150 (about 3 handwriting lines). Total image area, and so image tokens, stays roughly the same. The cost is more calls (~18 for the 10199px case) and more joins, which Decisions 3 and 3a handle. The evaluation compares 768 and 1200.
- *Alternative:* 1200px. Rejected as the default: it still halves resolution on one provider and loses about a third on the other.
- *Alternative:* split horizontally too. Rejected: notebook lines span the full width, and a split mid-line would break words.

### 3. Carry context across segments; fuzzy overlap removal
For segment *i* > 1, add the last ~5 already-stitched lines (verbatim, with indentation) to the prompt: "These lines were transcribed just above this section, for nesting context only. Transcribe every line you can see, including any that repeat these, at the nesting level they have on the page." The model is not told to skip repeats, because the overlap remover needs them in order to find the join. The remover compares lines after normalizing (case, whitespace, punctuation, markers) and treats similarity ≥ 0.9 as the same line, so a near-repeat doesn't leave a duplicate. Segments run sequentially, which they already do.
- *Alternative:* "don't repeat these lines". Rejected: partial obedience breaks the exact-match overlap removal and leaves near-duplicates.
- *Alternative:* post-hoc re-indentation heuristics. Rejected: the model has the visual evidence, a heuristic doesn't.

### 3a. Completeness from ink, not peer density
For each segment, compute ink coverage with sharp after preprocessing (share of pixels darker than a threshold, after excluding the binder-ring margin columns). The completeness check compares characters per unit of ink against the median of the other inked segments, and flags below 0.5. A segment below a blank-paper ink floor is expected to be empty and is never flagged. Any run of empty segments after the last segment with text counts as trailing paper. This replaces the peer-density comparison. Without it, 768px strips plus the 0.5 ratio would fire the fallback and the warning on every tall note.
- *Alternative:* keep peer density with a lower ratio. Rejected: it can't tell sparse handwriting from blank paper.

### 4. Uncertainty markers on by default, and tested against the current prompt
Replace "Do not use italics…" with "Wrap any word you cannot read confidently in *italics*. Still give your best reading." `assessOCRQuality` already counts italics, so it starts working again, with unchanged thresholds. Visible italics in vault notes are acceptable (Shawn, 2026-11-16). The current prompt came from an experiment (91% on one short image), so this is a setting (`OCR_UNCERTAINTY_MARKERS`, default `true`), and the evaluation compares both prompts on `case-01` and the existing short test image. The evaluation scores accuracy after stripping the markers, so a marker isn't counted as a misread. If markers lose on accuracy, the default flips to `false`, and the quality signal comes from the ink-based completeness check (Decision 3a).

### 5. Strikethrough as `~~text~~`
The prompt instructs that crossed-out text is transcribed inside `~~ ~~`, which keeps fidelity and renders in Obsidian. Before summarizing, a `stripStruckText` helper removes `~~…~~` spans and lines that become empty. That way the summarizer prompt doesn't have to be trusted with it.

### 6. Correction modes: legacy, narrow, off, chosen by evaluation
Across the two observed runs, correction made 3 changes and all 3 were harmful. Rather than pick a default up front, `ocrCorrection.mode` gets three values, and the evaluation reports each (Shawn, 2026-11-16: test the options, then decide whether to delete, narrow or keep it):
- `legacy` (default until the decision): today's behavior, unchanged.
- `narrow`: act only on `encoding` issues. No `issue.suggestion` / "Validation suggests" in the prompt. Reject an answer whose word count differs from the original by more than one. Send only the strip(s) the phrase was transcribed from (tracked by stitching offsets) instead of taking the first strip that doesn't answer `NOT_PRESENT`. Replace the occurrence at the tracked position, not the first match.
- `off`: no correction requests.

In every mode, the validator prompt states that input is shorthand and that fragments, abbreviations and missing articles are not critical issues. The validation report stays, so it is still useful for review. After the evaluation, a follow-up removes the losing modes. If `off` wins, the correction code is deleted.

### 7. Newline and indentation normalization
Replace `condenseBulletLines` with `normalizeLayout`:
- A line that starts with a bullet marker (`-`, `•`, `*`, `+`, a number + `.`/`)`, or `#`) always starts a new output line, whatever its indentation.
- A non-blank line with no bullet marker that directly follows a bullet, and is indented deeper than that bullet's marker (a hanging indent), is a wrapped continuation and is joined with one space. A marker-less line at or left of the marker (a label like a year or "Notes:") stays on its own line. The prompt also asks for each bullet on one line, so most wraps never reach this step.
- Blank lines are kept (runs of blank lines collapse to one).
- Indentation is re-leveled: indentation widths seen in the document are ranked into levels, and each level becomes 2 spaces per level. A child is never more than one level deeper than its parent.
- Content inside a markdown table is left untouched.

The stitcher stops trimming blank lines at segment edges. It only strips the matched overlap block and collapses a doubled blank line at the join.
- *Decision on wraps:* joining a wrapped bullet matches the baton-notes rule that nothing is hard-wrapped mid-sentence. Every written bullet still gets its own line.

### 8. Reference image, reference words, local glossary overlay
`transcribeImage` attaches the cached reference image as the first image part, followed by the segment, with the existing `formatReferenceImageInstructions` text, as the spec already requires. The 3024×1921 reference sheet is downscaled and compressed once and cached, since it is sent with every strip. Because commit `9b31f0a` removed the reference instructions when its prompt scored better, the reference is a setting (`HANDWRITING_REFERENCE_MODE` = `image` | `words` | `off`, default `image`), and the evaluation compares all three. When no image is available, `formatReferenceWordsForPrompt` output is appended. `loadHandwritingReference` merges an optional `handwriting-reference.local.json` (git-ignored) into `domainGlossary`, including a new `abbreviations` map rendered into the prompt. Real people's names, product names and internal acronyms go in the local file, never the committed one.

### 9. Local fidelity evaluation
Add `npm run eval:fidelity -- <image> <verified.md>`. It runs the real OCR path, then reports **line recall** (fraction of verified lines matched, using normalized fuzzy matching), **indent agreement** (matched lines at the same level), the number of struck lines handled correctly, and the run-to-run variance over N runs (default 3). Fixtures live in `eval-private/` (git-ignored). The first fixture (`eval-private/case-01/`) is the real note behind this review, with a hand-verified transcription. The evaluation is run before and after the fixes, and the numbers are recorded in this change's tasks. It also takes setting overrides, so one command can compare: segment height (768 vs 1200), uncertainty markers (on/off), reference (image/words/off), correction mode (legacy/narrow/off) and OCR model. Arms are compared one setting at a time against the fixed-pipeline defaults, not as a full grid. Accuracy is scored after stripping `*…*` markers.

### 10. Output hygiene
`stripCodeFence` removes a leading ```` ```lang ```` line and a trailing ```` ``` ```` from each segment response and the final text. A shared `buildOutputHeader(baseName, imageName, kind)` is used by both `main.ts` and `convert-single.ts`.

## Risks / Trade-offs

- [More calls and latency: ~18 strips per tall note, a reference image with each, a fallback that actually fires] → image area is about the same, so image tokens are similar, but per-call overhead and the reference image add cost. The evaluation reports cost per page, and the reference can be turned off.
- [The ink estimate is fooled by shadows, ruled lines or the binder rings] → measure after grayscale + normalize, with a dark threshold above the ruled-line gray, and exclude the margin columns. Tests use synthetic images with lines, shadow gradients and blank strips.
- [Sequential context passes one strip's indentation mistake to the next] → re-leveling in `normalizeLayout` caps any jump at one level. The evaluation's indent-agreement score shows whether the context helps.
- [Italic uncertainty markers clutter notes] → this is the spec's existing intent, and it's what makes the quality check work. Reviewers can delete them when correcting.
- [Indent re-leveling misjudges levels when the model's spacing is inconsistent] → tests cover 2/3/4-space and tab inputs. Previous-segment context reduces drift at the source.
- [Context lines make the model repeat the previous segment] → the stitcher's existing overlap removal still runs, and a test covers a repeated context block.
- [Legacy correction stays the default during this change, so its harm continues until the decision] → accepted, so the evaluation can measure it. The follow-up decision is the next step after 9.x.
- [Confidential fixtures accidentally committed] → `eval-private/` and the local glossary are added to `.gitignore` in the first task, and a test asserts both are ignored.

## Migration Plan

No data migration. Existing `.env` files keep working. New env vars have defaults. Existing vault notes are not reprocessed automatically. To re-OCR a note, delete its `.md` and summary and run again. Rollback is a revert. The old behavior can also be approximated by setting `OCR_SEGMENT_MAX_HEIGHT=2200`, `OCR_SEGMENT_OVERLAP=200`, `OCR_UNCERTAINTY_MARKERS=false` and `HANDWRITING_REFERENCE_MODE=off`.

## Open Questions

- Does the evaluation confirm 768px over 1200px, or is page-seam splitting still needed?
- Which prompt (markers on/off), reference mode and correction mode win on `case-01` and the short test image? These are decided from the evaluation results, and correction's outcome is delete, narrow or keep.
- Which model should be the primary and fallback? The final evaluation compares Claude Opus 5.5, GPT-6 Luna and GPT-6.1 Terra against the current `gpt-5-mini` / `gpt-5` setup on the fixed pipeline. Note that the archived `2026-05-06-test-gpt55-handwriting-ocr` change recommended against GPT-5, yet the current `.env` still uses it. The switch itself is a separate config edit after the recommendation is accepted.
- Is the indent unit of 2 spaces per level right for every downstream consumer (Obsidian, the Notion publish skill)?
