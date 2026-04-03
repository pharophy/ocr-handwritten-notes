## 1. Configuration Setup

- [x] 1.1 Add `AI_MODEL_OCR_FALLBACK` environment variable to `.env.example` with default value `gpt-4.1-mini`
- [x] 1.2 Update `AIProviderConfig` interface in `src/utils.ts` to include `modelOcrFallback?: string` field
- [x] 1.3 Add fallback model loading logic to `loadAIProviderConfig()` function (check env var → JSON config → default)
- [x] 1.4 Add fallback model to configuration logging output (redact sensitive data, log model name at info level)
- [x] 1.5 Update `handwriting-reference.json` schema to support `aiProvider.models.ocrFallback` field

## 2. Quality Detection Implementation

- [x] 2.1 Create `assessOCRQuality()` function in `src/ocr.ts` that takes transcription string and returns quality score object
- [x] 2.2 Implement illegible marker percentage calculation (count `*[illegible]*` occurrences, divide by total word count)
- [x] 2.3 Implement consecutive illegible detection (scan for 5+ consecutive `*[illegible]*` markers)
- [x] 2.4 Implement output length check (< 50 chars for images > 100KB)
- [x] 2.5 Add configurable quality thresholds from environment variables (`OCR_ILLEGIBLE_THRESHOLD`, `OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD`, `OCR_MIN_LENGTH_THRESHOLD`)
- [x] 2.6 Return quality assessment object with `isPoorQuality: boolean`, `illegiblePercent: number`, `reason: string` fields

## 3. Fallback Execution Logic

- [x] 3.1 Modify `processHandwrittenImage()` to call `assessOCRQuality()` after primary OCR completes
- [x] 3.2 Add conditional fallback execution when quality check fails and fallback model is configured
- [x] 3.3 Implement fallback model provider detection (parse model name to determine OpenAI vs Claude)
- [x] 3.4 Call appropriate SDK client for fallback model (reuse existing `getAIClient()` logic)
- [x] 3.5 Handle fallback API errors gracefully (log error, return primary result if fallback fails)
- [x] 3.6 Return fallback result when both models run, regardless of fallback quality score

## 4. Logging and Tracking

- [x] 4.1 Add info-level log when primary OCR succeeds without fallback ("✓ Primary model succeeded: <model-name>")
- [x] 4.2 Add info-level log when fallback is triggered ("⚠️  Primary quality poor (<reason>), trying fallback: <fallback-model>")
- [x] 4.3 Add debug-level log with quality assessment details (illegible %, consecutive count, output length)
- [x] 4.4 Add info-level log when fallback completes ("✓ Fallback model succeeded: <model-name>")
- [x] 4.5 Add warning-level log when both models fail quality check ("⚠️  Both models produced poor quality, returning fallback result")
- [x] 4.6 Add error-level log when fallback API fails ("❌ Fallback model API error: <error>, returning primary result")

## 5. Testing

- [x] 5.1 Create unit tests for `assessOCRQuality()` with various illegible patterns (0%, 20%, 40%, 100%)
- [x] 5.2 Create unit tests for consecutive illegible detection (2, 5, 10 consecutive markers)
- [x] 5.3 Create unit tests for output length check with different image sizes
- [x] 5.4 Create integration test using Cosine 02-26.jpeg (should NOT trigger fallback with Claude 4.6 Sonnet)
- [x] 5.5 Create integration test using Amir 04-01.jpeg with Claude 4.6 Opus (should trigger fallback to GPT-4.1 Mini)
- [x] 5.6 Test cross-provider fallback (Claude → OpenAI and OpenAI → Claude)
- [x] 5.7 Test fallback disabled scenario (`AI_MODEL_OCR_FALLBACK=none`)
- [ ] 5.8 Test fallback API error handling (mock API failure)

## 6. Documentation

- [x] 6.1 Update README.md with fallback model configuration section
- [x] 6.2 Document quality threshold environment variables and their defaults
- [x] 6.3 Add example `.env` configuration showing primary and fallback model setup
- [x] 6.4 Document recommended model combinations based on test results (Claude 4.6 Sonnet → GPT-4.1 Mini)
- [x] 6.5 Update skill documentation (`~/.claude/skills/ocr-model-comparison.md`) to mention fallback feature

## 7. Environment Configuration

- [x] 7.1 Update `.env.proxy.claude` to include `AI_MODEL_OCR_FALLBACK=gpt-4.1-mini`
- [x] 7.2 Update `.env.proxy.openai` to include `AI_MODEL_OCR_FALLBACK=anthropic--claude-4.6-sonnet`
- [x] 7.3 Set default `.env` to use Claude 4.6 Sonnet primary with GPT-4.1 Mini fallback
- [x] 7.4 Verify HAI proxy supports both providers simultaneously (required for cross-provider fallback)
