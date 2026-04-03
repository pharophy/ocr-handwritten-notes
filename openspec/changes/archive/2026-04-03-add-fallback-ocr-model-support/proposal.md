## Why

OCR quality varies significantly based on handwriting clarity and complexity. When the primary model produces poor results (high illegible markers, consecutive failures, or insufficient output), users receive unusable transcriptions. A fallback mechanism enables automatic retry with an alternative model to maximize transcription success rates.

## What Changes

- Add OCR quality assessment after primary model completion
- Implement automatic fallback to secondary model when quality is poor
- Enable cross-provider fallback (Claude ↔ OpenAI) via HAI proxy
- Add configurable quality thresholds for illegible percentage, consecutive failures, and output length
- Track and report which model was used (primary or fallback) in validation reports
- Simplify provider configuration to use single `hai` type with automatic model-based routing

## Capabilities

### New Capabilities
- `ocr-quality-assessment`: Quality evaluation system that analyzes OCR output for illegible markers, consecutive failures, and insufficient content
- `ocr-fallback-mechanism`: Automatic retry system that switches to alternative model when primary output quality is poor

### Modified Capabilities
- `ocr-processing`: Add quality assessment and fallback logic to existing OCR pipeline
- `ai-provider-abstraction`: Simplify provider types from (openai, hai-claude, hai-openai) to (openai, hai) with model-based routing

## Impact

**Code Changes:**
- `src/ocr.ts`: Add quality assessment function and fallback logic
- `src/aiProvider.ts`: Simplify provider types and add HAI auto-routing
- `src/main.ts`: Handle OCR result object with model tracking
- `src/convert-single.ts`: Handle OCR result object with model tracking
- `src/handwritingReference.ts`: Update provider config loading for simplified types

**Configuration:**
- `.env`, `.env.proxy.claude`, `.env.proxy.openai`: Change AI_PROVIDER to simplified `hai` type
- Add 4 new environment variables for quality thresholds (OCR_ILLEGIBLE_THRESHOLD, etc.)
- Remove provider-specific base URLs (HAI auto-routes based on model name)

**Documentation:**
- Update README.md with fallback feature explanation and monitoring examples
- Update .env.example with threshold configuration details
