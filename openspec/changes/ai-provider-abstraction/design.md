## Context

The current OCR system (`src/ocr.ts`, `src/summarize.ts`, `src/ocrValidator.ts`) directly instantiates OpenAI clients with hardcoded model names (gpt-4o, gpt-4o-mini). Users must provide `OPENAI_API_KEY` in `.env` and pay per API call. SAP's HAI proxy is already running locally on port 6655, providing authenticated access to Claude and OpenAI models through corporate infrastructure. The system needs to support both direct API access (for users with keys) and HAI proxy routing (for SAP employees) without duplicating OCR/summarization logic.

**Current Architecture:**
- Direct OpenAI client instantiation in each module
- Vision API for OCR (base64 image → text)
- Chat completion for summarization and validation
- Model names hardcoded or from basic env vars

**Constraints:**
- Must maintain backward compatibility with existing `.env` configurations
- HAI proxy requires specific model naming convention (`anthropic--claude-4.5-sonnet`)
- Claude API uses different message format than OpenAI for vision
- Some users will not have HAI proxy access

## Goals / Non-Goals

**Goals:**
- Single abstraction layer that works with OpenAI direct, Claude via HAI, or OpenAI via HAI
- Automatic provider detection based on available configuration
- Configurable model selection per operation type (OCR, summarization, validation)
- Zero code changes for existing users with OpenAI keys
- Support for both OpenAI SDK and Anthropic SDK as needed

**Non-Goals:**
- Support for additional providers beyond OpenAI and Claude (can be added later)
- Auto-retry or fallback between providers (single provider per session)
- Caching or rate limiting (handled by provider/proxy)
- Migration of existing API keys to HAI proxy (user choice)

## Decisions

### Decision 1: Factory Pattern with Provider-Specific Adapters

**Choice:** Create `AIProvider` interface with concrete implementations (`OpenAIProvider`, `ClaudeProvider`) instantiated via factory based on config.

**Rationale:**
- Isolates provider-specific SDK logic (OpenAI vs Anthropic message formats)
- Easy to add new providers without modifying existing code
- Clear separation of concerns: config loading → factory → adapter → business logic

**Alternatives Considered:**
- Single unified client with conditional logic: Would create messy if/else chains
- Monkey-patching OpenAI client: Too fragile, hard to maintain

### Decision 2: Configuration Hierarchy

**Priority order:**
1. Environment variables (`AI_PROVIDER`, `AI_MODEL_*`, `ANTHROPIC_BASE_URL`)
2. `handwriting-reference.json` `aiProvider` section
3. Auto-detect: If HAI proxy running (port 6655) and no OpenAI key, use Claude via HAI
4. Fallback: OpenAI direct with `OPENAI_API_KEY`

**Rationale:**
- Env vars for quick overrides and CI/CD
- JSON config for persistent user preferences
- Auto-detect for zero-config SAP employee experience
- Graceful fallback for existing users

**Alternatives Considered:**
- Env vars only: Verbose for users, no persistent preferences
- JSON config only: Can't override in CI/CD or different environments

### Decision 3: Model Mapping System

**Choice:** Map generic model roles (`ocr`, `summarization`, `validation`) to provider-specific model names.

Example:
```json
{
  "aiProvider": {
    "type": "hai-claude",
    "models": {
      "ocr": "anthropic--claude-4.5-sonnet",
      "summarization": "anthropic--claude-4.5-haiku",
      "validation": "anthropic--claude-4.5-haiku"
    }
  }
}
```

**Rationale:**
- Different operations have different requirements (OCR needs vision, validation can be cheaper)
- Provider model names differ (gpt-4o vs anthropic--claude-4.5-sonnet)
- Users can optimize cost/performance per operation

**Alternatives Considered:**
- Single model for all operations: Less flexible, expensive
- Model IDs in code: Harder to change, not user-configurable

### Decision 4: Backward Compatibility Strategy

**Choice:** If only `OPENAI_API_KEY` exists, use OpenAI direct with existing model env vars (`OPENAI_MODEL_*`).

**Rationale:**
- Existing users see no disruption
- Gradual migration path to HAI proxy
- Clear upgrade path documented in README

### Decision 5: Error Handling for Missing Providers

**Choice:** Fail fast with clear error message if no valid configuration found.

**Rationale:**
- Better than runtime failures deep in OCR processing
- Guides users to correct configuration
- Validates config at startup, not mid-operation

## Risks / Trade-offs

**Risk:** HAI proxy not running when user expects it  
**Mitigation:** Check port 6655 during config loading, show warning with start instructions

**Risk:** Model name mismatch between config and provider  
**Mitigation:** Validate model names during initialization, fail with list of available models

**Risk:** Different API response formats break existing code  
**Mitigation:** Provider adapters normalize responses to common interface

**Risk:** Anthropic SDK adds significant bundle size  
**Mitigation:** Acceptable for CLI tool; could lazy-load SDK in future if needed

**Trade-off:** Additional abstraction layer adds complexity  
**Benefit:** Flexibility and cost savings outweigh complexity; well-tested abstractions are maintainable

**Trade-off:** Configuration becomes more complex  
**Benefit:** Sensible defaults and auto-detection minimize configuration for most users

## Migration Plan

**Phase 1: Add abstraction (this change)**
1. Install `@anthropic-ai/sdk` dependency
2. Create `src/aiProvider.ts` with interface and factory
3. Implement `OpenAIProvider` adapter (wraps existing logic)
4. Implement `ClaudeProvider` adapter (Anthropic SDK)
5. Update configuration loading in `handwritingReference.ts`
6. Migrate `ocr.ts`, `summarize.ts`, `ocrValidator.ts` to use factory

**Phase 2: Testing**
1. Test backward compat: existing `.env` with OpenAI key still works
2. Test HAI proxy with Claude: new config points to localhost:6655
3. Test HAI proxy with OpenAI: alternative model configuration
4. Test auto-detection: no config, HAI proxy running → uses Claude

**Phase 3: Documentation**
1. Update README with configuration examples for all providers
2. Add troubleshooting guide for HAI proxy setup
3. Document model selection recommendations

**Rollback Strategy:**
- No breaking changes; rollback = remove new provider code, keep OpenAI direct
- Old code still works via `OpenAIProvider` adapter
