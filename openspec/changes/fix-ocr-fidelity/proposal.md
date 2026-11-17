## Why

A review of a real 6-page stitched note (1536×10199) against its photo found that the pipeline drops whole blocks of handwriting, turns struck-out lines into action items, rewrites shorthand into prose that changes its meaning, flattens nested bullets, and invents "Key Decisions" in the summary. A second run of the same image was worse, not better. None of this was flagged: the run reported 0% uncertainty and never tried the fallback model, so bad output reaches the vault looking trustworthy.

## What Changes

- **Segment resolution:** send vision requests with explicit high detail, and cut tall images into 768px segments (from 2200px) so the provider doesn't downscale the handwriting. Pass the previous segment's trailing lines as nesting context, and remove the overlap between segments with fuzzy line matching.
- **Completeness detection:** estimate each segment's expected text from its ink coverage instead of comparing it with its neighbours, and flag below half. Blank paper, including several blank strips at the end, is never treated as a drop. When the final result is still incomplete or poor quality, prepend a visible warning callout to the transcription instead of passing silently.
- **Uncertainty marking:** by default, the OCR prompt marks unclear words with `*italics*` again (as `ocr-processing` already requires), so `assessOCRQuality` can detect poor output and trigger the fallback. Because the current prompt came from an earlier experiment, this is a setting, and the evaluation compares the two.
- **Strikethrough:** crossed-out handwriting is transcribed as `~~text~~`, and the summarizer ignores struck text (including struck `AI:` lines).
- **Correction modes:** correction gets `legacy` (today's behavior, default for now), `narrow` and `off` modes. `narrow` fixes only garbled characters: no guessed meaning passed to the model, answers that add or remove words are rejected, and only the strip the phrase came from is used. The evaluation compares all three, and the results decide whether to delete, narrow or keep correction. The validator is told that input is shorthand in every mode.
- **Summary input and content:** the summarizer receives only the transcription, never the appended validation report. "Key Decisions" lists only decisions stated in the notes, otherwise "No explicit decisions recorded."
- **Newline and indentation fidelity:** each handwritten bullet is its own output line at its written nesting level. Sub-bullets are never merged into their parent. Blank lines between blocks are kept, including across segment joins. Indentation is normalized to one consistent unit. A single bullet that wraps across physical lines because of page width is still joined into one line.
- **Reference context actually used:** the loaded handwriting reference image (downscaled) is attached to OCR calls, or reference words are added to the prompt, as `handwriting-reference` already requires. This is a setting (`image` / `words` / `off`) that the evaluation compares. A git-ignored local glossary overlay (`handwriting-reference.local.json`) adds names, terms and personal abbreviations (e.g. `es.` / `e.s.` = "e.g.") without committing them to the public repo.
- **Output hygiene:** strip a wrapping ```` ```markdown ```` code fence from model output. `convert-single` writes the same wikilink format as the batch run (`[[name - Summary and Actions]]`, no `.md` extension).
- **Test-first delivery:** every issue above gets a failing automated test before its fix. A local, git-ignored fidelity evaluation runs against real images and hand-verified transcripts to measure accuracy before and after, compare the settings one at a time, and compare candidate models. Defaults are only changed after Shawn accepts the results.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ocr-processing`: transcription accuracy (uncertainty marking, strikethrough, code-fence stripping), layout preservation (newline and indentation fidelity across segments), segment completeness (threshold and visible warning), new requirements for vision input resolution and correction safety.
- `text-summarization`: summary structure (Key Decisions only when explicit, struck text and validation report excluded from input).
- `handwriting-reference`: new requirement for a git-ignored local glossary overlay. The reference image and reference-word requirements are unchanged but are currently not implemented, which this change fixes.
- `batch-processing`: output file metadata uses one wikilink format for both batch and single-file conversion.
- `ai-provider-abstraction`: vision calls accept extra images (the reference, sent first) and a detail level.

## Impact

- **Code:** `src/ocr.ts` (prompt, segmentation, stitching, condensing, fence stripping, completeness, warning callout), `src/aiProvider.ts` (image `detail`, multi-image content for the reference image), `src/ocrValidator.ts` (validator prompt, correction gating and guard), `src/summarize.ts` (prompt), `src/main.ts` and `src/convert-single.ts` (summary input, link format), `src/handwritingReference.ts` (local overlay merge).
- **Config:** new optional `handwriting-reference.local.json` (git-ignored). New or changed env defaults: `OCR_SEGMENT_MAX_HEIGHT`, `OCR_SEGMENT_MIN_DENSITY_RATIO`. Existing `.env` files keep working.
- **Cost:** shorter segments, high detail, the attached reference image and a fallback that now actually fires all mean more vision tokens per page.
- **Output format:** transcriptions may now contain `*uncertain*` words, `~~struck~~` text and a `> [!warning]` callout. Downstream consumers (the baton-notes `zz-raw-extractor` and `meeting-summary` skills) only read the text and need no change.
- **Tests:** new vitest files under `tests/`. The private evaluation fixtures live in a git-ignored folder and are never committed.
