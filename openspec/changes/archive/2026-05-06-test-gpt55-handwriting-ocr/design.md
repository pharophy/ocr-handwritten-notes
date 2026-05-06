## Context

OpenAI has released GPT-5.5 with enhanced vision capabilities that may improve handwriting OCR accuracy. Our current system supports GPT-4o and Claude 4.5 Sonnet for OCR tasks, with model selection configured via environment variables or JSON config.

The codebase already has a complete experiment framework (`src/ocrExperiment.ts`) with model comparison capabilities, scoring (accuracy/cost/latency), and automated reporting. The CLI tool (`experimentOCR.ts`) supports testing different models against handwriting reference samples with ground truth. The framework even includes GPT-5 in the model configs, so adding GPT-5.5 is straightforward.

The system uses an AI provider abstraction layer that supports multiple providers (OpenAI direct, Claude via HAI proxy, OpenAI via HAI proxy) with operation-specific model mapping (OCR, summarization, validation).

## Goals / Non-Goals

**Goals:**
- Add GPT-5.5 to existing experiment framework model configurations
- Run experiments using existing CLI to compare GPT-5.5 against GPT-4o and Claude 4.5 Sonnet
- Generate analysis reports using existing reporting infrastructure
- Update model selection guidance based on empirical experiment results

**Non-Goals:**
- Creating new testing infrastructure (use existing `ocrExperiment.ts` framework)
- Changing the AI provider abstraction layer architecture
- Adding new preprocessing or post-processing logic
- Testing models other than GPT-4o, GPT-5.5, and Claude 4.5 Sonnet in initial implementation
- Real-time model switching in production (configuration remains static per deployment)

## Decisions

### Decision 1: Use existing ocrExperiment.ts framework instead of building new infrastructure
**Rationale**: The codebase already has `src/ocrExperiment.ts` with complete model comparison, scoring (accuracy/cost/latency with configurable weights), and reporting. Building new infrastructure would be wasteful duplication. The existing CLI (`experimentOCR.ts`) already supports exactly what we need.

**Alternatives considered**:
- Building new test framework → Rejected: Duplicates existing functionality
- Using generic test framework → Rejected: ocrExperiment.ts is purpose-built for OCR model comparison

### Decision 2: Add GPT-5.5 to DEFAULT_MODELS in ocrExperiment.ts
**Rationale**: The framework already includes GPT-5 in DEFAULT_MODELS. Adding GPT-5.5 follows the same pattern with updated model ID and pricing. This makes it immediately available to the experiment CLI without configuration changes.

**Alternatives considered**:
- Environment-only configuration → Rejected: Harder to discover, DEFAULT_MODELS provides good defaults
- Separate config file → Rejected: Unnecessary indirection

### Decision 3: Use existing accuracy metrics (edit distance, similarity scoring)
**Rationale**: The ocrTester.ts already implements character-level and word-level accuracy using well-established metrics. These are sufficient for model comparison.

**Alternatives considered**:
- Adding new custom metrics → Rejected: Existing metrics work well, no evidence they're insufficient
- BLEU score → Rejected: Designed for machine translation, not OCR

### Decision 4: Keep existing weighted scoring (accuracy/cost/latency)
**Rationale**: The experiment framework already supports configurable score weights via `--weights` flag. Default weighting can be adjusted if needed. The existing system is flexible and well-tested.

**Alternatives considered**:
- Accuracy-only comparison → Rejected: Ignores practical constraints
- Equal weighting → Rejected: Doesn't reflect real-world priorities

## Risks / Trade-offs

**Risk: GPT-5.5 API may have breaking changes from GPT-4o**  
→ Mitigation: Test GPT-5.5 API compatibility early in the experiment phase. OpenAI typically maintains backward compatibility.

**Risk: GPT-5.5 pricing is unknown or may change**  
→ Mitigation: Use estimated pricing in experiments, update when official pricing announced. Experiments track actual token usage for cost calculations.

**Risk: Experiment results may be inconclusive (models perform similarly)**  
→ Mitigation: Framework provides confidence scoring. Document that results are based on our specific handwriting corpus.

**Trade-off: Experiments are point-in-time, models may improve**  
→ Acceptance: Document experiment dates. Re-run experiments periodically if model updates are announced.

## Migration Plan

1. **Phase 1: Add GPT-5.5 to experiment configs** - Update `DEFAULT_MODELS` in ocrExperiment.ts with GPT-5.5 model ID and estimated pricing.

2. **Phase 2: Run experiments** - Use existing `npm run experiment-ocr` CLI to compare GPT-5.5 against GPT-4o and Claude 4.5 Sonnet across handwriting reference samples.

3. **Phase 3: Analyze results** - Review generated reports (markdown/JSON) from experiment framework to determine best model.

4. **Phase 4: Update documentation** - Based on experiment results, update model recommendations in README and configuration docs.

5. **Phase 5: Optional default change** - If GPT-5.5 proves significantly better, update default model in config. Users can override via environment variables or config file.

**Rollback**: If GPT-5.5 causes issues, users revert to previous model by changing `AI_MODEL_OCR` environment variable or JSON config. No code changes required.

## Open Questions

- What new models are actually available through HAI proxy and OpenAI API? (Use /list-available-models skill to check)
- What is the official API pricing for any new models? (Need to update cost calculations when announced)
- What are the exact model IDs for new models in OpenAI's API? (gpt-5.5, gpt-o3-mini, etc.)
