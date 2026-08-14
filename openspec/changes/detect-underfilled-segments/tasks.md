## 1. Capture the bug (failing test)

- [x] 1.1 Add `tests/ocr-segment-completeness.test.ts` reproducing the observed capture geometry (1536×4327 → 3 segments via the real `segmentImageVertically`).
- [x] 1.2 Assert the pre-fix blind spot: `findEmptySegments(parts).incomplete === false` for an under-filled interior segment.
- [x] 1.3 Assert the intended behavior against the (not-yet-implemented) `findUnderfilledSegments`: interior index flagged, `incomplete === true`.
- [x] 1.4 Run the suite and confirm the new test fails (bug captured).

## 2. Implement the fix

- [x] 2.1 Add exported pure function `findUnderfilledSegments(parts, segmentHeights, minDensityRatio?)` in `src/ocr.ts` with the median-density heuristic.
- [x] 2.2 Add `SEGMENT_MIN_DENSITY_RATIO` default and `OCR_SEGMENT_MIN_DENSITY_RATIO` env override.
- [x] 2.3 In `transcribeImage`, compute per-segment heights and OR `findUnderfilledSegments` into the `incomplete` signal (multi-segment only); extend the diagnostic log to name under-filled indices.

## 3. Guardrails against false positives

- [x] 3.1 Test: proportionally-filled segments are not flagged and do not mark incomplete.
- [x] 3.2 Test: a short trailing (final) sliver segment is not flagged as under-filled.
- [x] 3.3 Test: fewer than 2 non-empty segments returns `{ underfilledIndices: [], incomplete: false }`.
- [x] 3.4 Integration test: drive `processHandwrittenImage` with a stubbed provider so a sparse (non-empty) interior segment trips the density check and triggers the fallback end-to-end (covers the `transcribeImage` wiring, not just the pure function).

## 4. Validation

- [x] 4.1 Run `npm test` — the new regression test and full suite pass.
- [x] 4.2 Type-check the changed source (`npx tsc --noEmit`).
- [x] 4.3 Run `openspec validate detect-underfilled-segments --strict`.
