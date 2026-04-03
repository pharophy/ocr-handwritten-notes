## Context

Recent comprehensive testing across 10 AI models revealed that no single model excels at all handwriting styles. Claude 4.6 Sonnet achieves 100% accuracy on business meeting notes but only 2.5% on technical planning documents, while GPT-4.1 Mini shows the opposite pattern (35% where Claude fails). The current single-model OCR pipeline leaves significant accuracy gaps.

The system currently uses `processHandwrittenImage()` in `src/ocr.ts` which calls a single configured model. Results are either accepted or the user manually retries with different models. There's no automatic quality assessment or fallback mechanism.

**Current Architecture:**
- Single OCR model configured via `AI_MODEL_OCR` environment variable
- Provider abstraction in `src/utils.ts` supports multiple providers (OpenAI, Claude via HAI proxy)
- No quality detection - all results treated equally
- Manual model switching requires environment variable changes and reprocessing

## Goals / Non-Goals

**Goals:**
- Implement automatic fallback to secondary model when primary produces poor quality results
- Add quality detection based on measurable signals (illegible markers, output length)
- Maintain backward compatibility - fallback is optional and configurable
- Support any model combination (Claude → OpenAI, OpenAI → Claude, etc.)
- Set sensible defaults: Claude 4.6 Sonnet (primary) → GPT-4.1 Mini (fallback)
- Log which model was used for transparency and debugging

**Non-Goals:**
- Multi-model voting or ensemble approaches (too expensive)
- Machine learning-based quality prediction (overkill for this use case)
- Quality metrics beyond illegible markers and length (keep it simple)
- Automatic model selection based on image type (future enhancement)
- Retry loops beyond one fallback attempt (diminishing returns)

## Decisions

### Decision 1: Quality Detection Strategy

**Choice:** Use pattern-based quality detection (illegible marker percentage, consecutive illegibles, output length)

**Rationale:**
- Simple, fast, deterministic - no ML models needed
- Directly correlates with observed failure modes (Claude 4.6 Opus marked 95% as illegible on Amir image)
- Configurable thresholds allow tuning without code changes
- Low false positive rate based on test data analysis

**Alternatives Considered:**
- Confidence scores from API: Not consistently available across providers
- Embedding-based similarity: Too slow and complex
- Manual quality flags: Defeats purpose of automation

**Thresholds:**
- `>15% illegible markers` → Poor quality (based on test results - 26% produced 112 illegible markers)
- `≥5 consecutive illegibles` → Poor quality (indicates complete failure to read a section)
- `<50 chars for >100KB image` → Poor quality (obviously incomplete)

### Decision 2: Fallback Execution Point

**Choice:** Execute fallback immediately after primary quality check fails, within same `processHandwrittenImage()` call

**Rationale:**
- Simplest user experience - no manual intervention
- Image is already in memory, no re-reading needed
- Single function call returns best available result
- Logging shows full story (primary attempt + fallback)

**Alternatives Considered:**
- Queue-based retry: Too complex, adds latency
- Separate fallback function: Requires caller changes, breaks encapsulation
- User-prompted retry: Defeats automation goal

### Decision 3: Configuration Approach

**Choice:** Add `AI_MODEL_OCR_FALLBACK` environment variable, extend existing provider config structure

**Rationale:**
- Mirrors existing `AI_MODEL_OCR` pattern - familiar to users
- Works with existing provider abstraction (no new SDK clients needed)
- Can specify any model name (e.g., `gpt-4.1-mini`, `anthropic--claude-4.5-opus`)
- Set to `"none"` or `""` to disable fallback entirely
- Default to `gpt-4.1-mini` if not specified (best fallback performer from testing)

**Implementation:**
```typescript
// In src/utils.ts AIProviderConfig
interface AIProviderConfig {
  // ... existing fields
  modelOcrFallback?: string; // New field
}

// Load from env or JSON config
const fallbackModel = process.env.AI_MODEL_OCR_FALLBACK || 
                      config.aiProvider?.models?.ocrFallback || 
                      'gpt-4.1-mini';
```

### Decision 4: Cross-Provider Fallback Support

**Choice:** Allow fallback to any provider (Claude → OpenAI, OpenAI → Claude, etc.)

**Rationale:**
- Test data shows best fallback is often different provider (Claude → GPT-4.1 Mini)
- Provider abstraction already supports multiple providers
- Just need to parse model name and select appropriate SDK client
- Users can optimize for their specific handwriting styles

**Implementation:**
- Parse `AI_MODEL_OCR_FALLBACK` to detect provider type (prefix like `anthropic--`, or model family like `gpt-*`)
- Use existing `getAIClient()` logic to instantiate correct SDK client
- Fallback can use different provider than primary (mix and match)

### Decision 5: Result Selection

**Choice:** Always return fallback result if both models run, regardless of fallback quality

**Rationale:**
- If primary was bad enough to trigger fallback, always prefer fallback
- Avoids complex "which is better?" comparison logic
- User can disable fallback if they disagree with this heuristic
- Log both quality assessments so user can see what happened

**Edge Case:** Both models fail quality check → return fallback anyway (better than nothing)

## Risks / Trade-offs

### Risk: Increased API Costs
**Mitigation:**
- Only trigger fallback when quality is genuinely poor (tuned thresholds)
- Log fallback usage so users can monitor frequency
- Make fallback configurable (can disable if cost-sensitive)
- Expected frequency: 5-15% of documents based on test data

### Risk: Longer Processing Time
**Mitigation:**
- Only adds latency when fallback triggers (~20-30s extra)
- Most documents won't trigger fallback (80-85% primary success rate)
- Alternative (manual retry) is even slower

### Risk: False Positives (Good Results Rejected)
**Mitigation:**
- Conservative thresholds (15% illegible after testing - 26% produced poor output)
- Multiple signal types (not just one indicator)
- Configurable thresholds allow per-deployment tuning
- Logging shows primary result even when rejected

### Risk: Provider API Differences
**Mitigation:**
- Existing provider abstraction handles SDK differences
- Quality detection is model-agnostic (just counts markers)
- Test with multiple provider combinations

### Trade-off: Complexity vs. Accuracy
- **Added Complexity:** ~200 lines of quality detection + fallback logic
- **Accuracy Gain:** 10-30% improvement on edge case documents
- **Assessment:** Worth it - core functionality gap addressed

## Migration Plan

**Phase 1: Rollout (Non-Breaking)**
1. Deploy code with fallback disabled by default (no `AI_MODEL_OCR_FALLBACK` set)
2. Existing behavior unchanged - single model OCR continues working
3. Update `.env` files to add `AI_MODEL_OCR_FALLBACK=gpt-4.1-mini`
4. Monitor logs for fallback trigger frequency

**Phase 2: Optimization**
1. Analyze fallback logs to tune quality thresholds
2. Adjust defaults if needed based on real-world data
3. Document optimal model combinations for different use cases

**Rollback:**
- Set `AI_MODEL_OCR_FALLBACK=none` to disable
- No code rollback needed - change is additive

**Testing Strategy:**
- Unit tests for quality detection (mock various illegible patterns)
- Integration tests with real images (use test-images/ from repo)
- Test all provider combinations (Claude→OpenAI, OpenAI→Claude)

## Open Questions

**Q1: Should we cache quality assessments?**
- Probably not - adds complexity and images rarely reprocessed
- Decision: Skip caching for v1

**Q2: Should fallback be logged as info or debug level?**
- Info: Users should see fallback usage (transparency)
- Debug: Only for troubleshooting
- Decision: Info for fallback trigger, debug for quality details

**Q3: Should we add quality scores to API response?**
- Could expose `primaryQuality: number, fallbackUsed: boolean` in return value
- Current: Just log it
- Decision: Log only for v1, consider API change if users request it
