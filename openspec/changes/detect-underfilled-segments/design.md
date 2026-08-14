## Context

Tall pages are OCR'd per vertical segment and stitched (`transcribeImage` → `segmentImageVertically` → per-segment vision call → `stitchSegmentTranscriptions`). The stitch step can only remove a *leading* overlap block from each incoming segment; it cannot delete a segment's interior, so it neither causes nor recovers content loss. The loss happens upstream when the vision model under-transcribes an individual segment, and the only completeness guard (`findEmptySegments`) is too coarse to notice.

Two guards existed and both miss partial loss:
- `findEmptySegments` — flags an interior segment only when it is 100% empty. A segment that returns a few of its lines is "non-empty" and passes.
- `assessOCRQuality` (`isPoorQuality`) — checks `[illegible]`/italic marker density, consecutive-illegible runs, and an **absolute** `outputLength < minLength` floor. A multi-segment page easily clears the absolute floor even when a whole segment's worth of text is missing.

The fallback OCR model runs when `isPoorQuality || response.incomplete`. So the fix is to make `incomplete` true for partial interior drops.

## Goals / Non-Goals

**Goals**
- Detect a segmented-page transcription where a non-final segment returned far less text than its image area implies, and route it to the existing fallback model.
- Keep the detector a pure, unit-testable function consistent with `findEmptySegments`.
- No live-API dependency in the regression test; reproduce the real failure geometry deterministically.

**Non-Goals**
- Changing the segmentation geometry (`SEGMENT_MAX_HEIGHT`/`SEGMENT_OVERLAP`) or making cuts page-boundary-aware — a larger, separate change.
- Comparing OCR output against the source image for omissions (would need a second vision pass / ground truth).
- Prompt-level anti-truncation sentinels — complementary, deferred.

## Decision: area-proportional density check

Add `findUnderfilledSegments(parts, segmentHeights, minDensityRatio?)`:

- For each segment with non-empty trimmed text, compute `density = trimmedCharCount / segmentPixelHeight`.
- For each candidate `i`, let `reference = median(densities of the OTHER non-empty segments)` — **leave-one-out**. The candidate must not dilute the baseline it is measured against; a self-inclusive median sinks toward the dropped value, so the more content is dropped the *less* likely a genuine drop is flagged (it collapses entirely for 2-segment pages and for multiple simultaneous drops).
- Flag a segment `i` as under-filled when `density[i] < minDensityRatio * reference`.
- `incomplete = any under-filled index that is not the last *content-bearing* segment` — mirroring `findEmptySegments`, which ignores a short/empty *trailing* segment (blank page space) but treats an empty interior/leading segment as incomplete. The exemption keys off the last non-empty index, not the last array index, so a trailing fully-blank strip cannot strip the exemption from a genuinely sparse bottom band.
- Requires ≥ 2 non-empty segments to have a reference to compare against; otherwise returns `{ underfilledIndices: [], incomplete: false }` and the single-segment empty-content path (handled by the caller) stays authoritative.

Default `minDensityRatio = 0.25`, overridable via `OCR_SEGMENT_MIN_DENSITY_RATIO`. Only a fraction in `(0, 1)` is meaningful; any other override (non-numeric → `parseFloat` yields `NaN`, `≤ 0`, or `≥ 1`) is rejected via `Number.isFinite`/`> 0`/`< 1` and falls back to the built-in ratio. This prevents both failure modes of a bad value: `NaN`/`≤ 0` would make every `density < threshold` comparison false (silently disabling detection), while `≥ 1` would flag nearly every segment (fallback on every page). Rationale for the value: a genuinely-dropped segment returns a tiny fraction of its neighbors' density (the observed middle segment was roughly 40× below its siblings), so a conservative ratio catches real drops while leaving normal page-to-page density variation (typically within ~2–3×) untouched.

Wiring in `transcribeImage` (only when `segments.length > 1`): `segmentImageVertically` returns each strip's pixel height alongside its buffer (`ImageSegment[]`), so the density check consumes those heights directly — no second `sharp` decode. Then
`incomplete = findEmptySegments(parts).incomplete || findUnderfilledSegments(parts, segmentHeights).incomplete`,
and the existing `⚠️` log is extended to name under-filled indices. The return shape (`{ content, model, incomplete }`) is unchanged, so the fallback gate at the call site needs no change. The fallback re-OCR runs the same detection; if the fallback model is *also* incomplete there is no third model, so its output is still returned but the condition is surfaced in the log rather than passing silently.

## Alternatives considered

- **Absolute chars-per-pixel floor** (no median): brittle across handwriting sizes/densities; a relative comparison to sibling segments on the *same page* self-calibrates.
- **Lower `SEGMENT_MAX_HEIGHT`** so each strip carries fewer lines: reduces but does not eliminate silent truncation, and increases API calls for every tall page. Orthogonal; can be tuned later.
- **Re-OCR every segment twice and diff**: doubles cost on the happy path for a rare failure.

## Risks / Trade-offs

- **False positive on a sparse interior page** → one extra fallback pass, never wrong output. Mitigated by the conservative default ratio and env override.
- **Two adjacent dropped segments** could drag the median down and mask each other. Rare; the empty-segment check still catches fully-empty ones, and the absolute-length quality gate remains as a backstop.

## Test strategy

`tests/ocr-segment-completeness.test.ts` (pure/deterministic, no API):
1. Build a blank image at the observed capture dimensions (1536×4327) and run the real `segmentImageVertically` → assert 3 segments and capture their real pixel heights.
2. Construct per-segment `parts` matching the observed failure: dense first segment, an under-filled interior segment (a few chars for a ~2200px band, as actually happened), dense final content.
3. Assert `findEmptySegments(parts).incomplete === false` — documents the pre-fix blind spot.
4. Assert `findUnderfilledSegments(parts, heights)` flags interior index 1 and reports `incomplete === true` — the fix.
5. Guardrails: proportionally-filled segments are not flagged; a short trailing sliver segment is not a false positive; `< 2` non-empty segments returns not-incomplete.
