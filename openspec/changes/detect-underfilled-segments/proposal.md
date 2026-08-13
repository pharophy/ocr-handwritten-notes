## Why

Tall handwritten pages are split into overlapping vertical segments, OCR'd one segment at a time, then stitched back together (`src/ocr.ts`). The only completeness guard on that path — `findEmptySegments` — flags a segment as incomplete **only when it is entirely empty** (`part.trim() === ''`). When the vision model returns *some but not all* of a segment's content (a silent partial-transcription drop), the segment is not empty, so `incomplete` stays `false`, the configured OCR fallback model never runs, and the missing text is lost without any warning.

This regressed on a real 3-page capture: the model returned page 1 for the first segment and only the trailing lines of page 2 for the middle segment, dropping the entire middle band of the page (an interior segment's worth of content). Nothing flagged it — `findEmptySegments` saw text, and the `isPoorQuality` gate only checks legibility markers and an *absolute* minimum output length, which a large multi-segment page clears easily. The result was a transcription silently missing a full page of content.

## What Changes

- Add area-proportional under-transcription detection for segmented pages: a non-final segment whose text density (characters per pixel of segment height) is far below the median density of the other non-empty segments is flagged as under-filled and marks the overall transcription `incomplete`, which triggers the existing OCR fallback model.
- Wire this into `transcribeImage` alongside the existing empty-segment check, using each segment's real pixel height.
- Add a deterministic regression test that reproduces the observed failure **geometry** (the same 1536×4327 → 3-segment split) with an under-filled interior segment, asserting the old empty-only check misses it and the new density check catches it. The test uses synthetic image dimensions and placeholder text — it does **not** commit the confidential source image or its transcription (see Impact → Privacy).

## Capabilities

### Modified Capabilities

- `ocr-processing`: Segment-level completeness now covers partial (under-filled) interior segments, not only fully empty ones, so silent mid-page drops trigger the OCR fallback instead of passing through.

## Impact

**Affected Components:**
- `src/ocr.ts`: add `findUnderfilledSegments` (pure, exported for testing); compute per-segment heights in `transcribeImage` and OR its result into the `incomplete` signal that gates the fallback; extend the diagnostic log.
- `tests/ocr-segment-completeness.test.ts` (new): regression coverage for the reproduced failure and for the no-false-positive cases.
- `openspec/specs/ocr-processing/spec.md`: new "Segment-level completeness detection" requirement.

**Behavioral Impact:**
- Pages that previously produced a silently-truncated multi-segment transcription now trigger the fallback OCR model and are far more likely to be transcribed in full.
- A legitimately sparse interior page could be flagged as under-filled and re-OCR'd by the fallback model. This costs one extra fallback pass but never degrades output (the fallback re-transcribes; if still sparse, that result is returned). The density ratio is configurable to tune this.

**Privacy:**
- The source capture is a confidential 1:1 meeting note. This repo has a public GitHub remote (`pharophy/ocr-handwritten-notes`), so the real image and corrected transcription are **not** committed. The regression test reproduces the bug from the image's dimensions (identical segment geometry) and the transcription's shape (an under-filled interior segment) using neutral placeholder content only.

**Risks:**
- The density heuristic is a threshold; the default ratio is conservative and env-configurable (`OCR_SEGMENT_MIN_DENSITY_RATIO`). Worst case on a false positive is an extra fallback call, not wrong output.
