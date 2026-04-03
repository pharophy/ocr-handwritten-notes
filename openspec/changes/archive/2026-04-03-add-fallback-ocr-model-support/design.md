## Context

OCR quality varies based on handwriting clarity, image quality, and model capabilities. Different AI models have different strengths - Claude excels at certain handwriting styles while OpenAI performs better on others. The existing OCR pipeline uses a single model without quality validation or retry logic, resulting in poor transcriptions being returned to users without any attempt at recovery.

The system already has HAI proxy integration supporting both Claude and OpenAI models. The challenge is adding quality assessment and fallback logic without impacting the performance of good-quality transcriptions or breaking existing behavior.

## Goals / Non-Goals

**Goals:**
- Assess OCR output quality using objective metrics (illegible markers, consecutive failures, output length)
- Automatically retry with fallback model when primary quality is poor
- Support cross-provider fallback (Claude ↔ OpenAI) leveraging HAI proxy's multi-provider capabilities
- Simplify provider configuration from three types (openai, hai-claude, hai-openai) to two (openai, hai)
- Track which model produced each transcription for debugging and monitoring
- Make all quality thresholds configurable via environment variables

**Non-Goals:**
- Trying more than two models (primary + one fallback)
- Using multiple fallback models simultaneously and comparing results
- Training or fine-tuning models based on quality feedback
- Automatic threshold adjustment based on historical performance
- User-facing quality confidence scores

## Decisions

### Decision 1: Quality Assessment Approach
**Choice:** Count illegible markers, detect consecutive failures, and check output length vs image size

**Rationale:** These metrics are objective, fast to compute, and directly correlate with user-perceived quality. Illegible markers indicate transcription failures, consecutive failures suggest systematic issues, and short output on large images suggests the model didn't process the content.

**Alternatives Considered:**
- **Confidence scores from models**: Not consistently available or comparable across providers
- **Linguistic analysis**: Too slow and complex for real-time pipeline
- **Character-level comparison with ground truth**: Requires labeled data we don't have

### Decision 2: Default Illegible Threshold = 15%
**Choice:** Set default threshold at 15% illegible markers

**Rationale:** Real-world testing showed 26% illegible produced 112 markers which is clearly unusable. 15% provides earlier fallback trigger while allowing some transcription uncertainty without excessive retries.

**Alternatives Considered:**
- **30% threshold**: Original value was too permissive, allowed poor transcriptions through
- **5% threshold**: Too aggressive, would trigger fallback on acceptable output with minor illegibility
- **Adaptive thresholds**: More complex, harder to reason about, not needed initially

### Decision 3: Always Use Fallback Result When Triggered
**Choice:** When fallback is triggered, always return fallback result regardless of its quality assessment

**Rationale:** If primary quality was poor enough to trigger fallback, the fallback attempt represents the best alternative effort. Even if fallback quality is also poor, it's a different model's interpretation and may be more accurate despite similar metrics.

**Alternatives Considered:**
- **Compare qualities and return better**: Adds complexity, quality metrics may not perfectly correlate with actual accuracy
- **Return both results**: Pushes decision to user, increases output size and complexity
- **Fallback only if better**: May discard valid alternatives based on imperfect metrics

### Decision 4: Simplify Provider Types to (openai, hai)
**Choice:** Reduce from three provider types (openai, hai-claude, hai-openai) to two (openai, hai) with model-based routing

**Rationale:** HAI proxy can route to either Claude or OpenAI based on model name prefix (anthropic--* vs gpt-*). No need to specify provider+endpoint when it can be determined automatically. Simplifies configuration and fallback logic.

**Alternatives Considered:**
- **Keep three types**: More explicit but redundant since model name already indicates provider
- **Automatic provider detection**: Could work but less explicit in configuration
- **Single universal provider**: Too much magic, harder to debug

### Decision 5: Reuse Preprocessed Image for Fallback
**Choice:** Share the same preprocessed image buffer between primary and fallback attempts

**Rationale:** Preprocessing (grayscale, resize, sharpen) is deterministic and doesn't need to be redone. Reusing the buffer saves computation time on fallback path and ensures both models see identical input.

**Alternatives Considered:**
- **Reprocess on fallback**: Wasteful computation with no benefit
- **Different preprocessing per model**: Adds complexity, may introduce confounding variables
- **No preprocessing**: Image quality matters for OCR, preprocessing improves results

### Decision 6: Model Tracking in Return Value
**Choice:** Change processHandwrittenImage() return type from `string | null` to `{ text: string; modelUsed: string } | null`

**Rationale:** Callers need to know which model was used for debugging, monitoring, and validation report display. Returning structured object is cleaner than side-channel communication.

**Alternatives Considered:**
- **Global state/logging only**: Doesn't give callers access to model info
- **Separate function to query last model**: Fragile, breaks with concurrent calls
- **Event emitter pattern**: Over-engineered for simple use case

## Risks / Trade-offs

**[Risk]** Fallback doubles latency for poor-quality images → **Mitigation:** Only triggered on poor quality, good transcriptions remain fast. Most handwriting should transcribe well on first attempt.

**[Risk]** Two API calls cost more than one → **Mitigation:** Cost is only incurred when primary quality is poor. Value of successful transcription outweighs marginal API cost.

**[Risk]** Both models may fail on same difficult image → **Mitigation:** Return best attempt available. Log both results for manual review. Users still better off than with no retry.

**[Risk]** Quality metrics may not perfectly predict actual accuracy → **Mitigation:** Thresholds are configurable. Monitor false positive/negative rates and adjust. Start conservative (15%) and tune based on production data.

**[Risk]** Breaking change to return type affects existing callers → **Mitigation:** Update all call sites in same change. TypeScript compilation catches any missed updates.

**[Trade-off]** Simplified provider types require HAI proxy for cross-provider fallback → **Acceptance:** HAI proxy is already standard infrastructure. Direct OpenAI-only users can still work without fallback or with same-provider fallback.

**[Trade-off]** Always returning fallback result means primary model doesn't get credit for better output → **Acceptance:** Goal is maximum success rate, not model performance comparison. Logging captures both results for analysis.

## Migration Plan

This is a backward-compatible enhancement to existing OCR functionality:

1. **Code changes**: Add quality assessment function, update OCR pipeline, modify return types, simplify provider types
2. **Configuration updates**: Update `.env` template files to use simplified provider types and document new threshold variables
3. **Documentation**: Update README with fallback feature explanation, monitoring examples, and configuration options
4. **Testing**: Run on real handwriting samples to verify fallback triggers correctly and improves results

**Rollback:** If fallback causes issues, set `AI_MODEL_OCR_FALLBACK=none` to disable feature without code changes.

## Open Questions

None - implementation is complete and tested in production.
