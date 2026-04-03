## Why

Recent testing revealed that different AI models excel at different handwriting styles. Claude 4.6 Sonnet achieves 100% accuracy on some documents but only 2.5% on others, while GPT-4.1 Mini shows the opposite pattern (35% on documents where Claude struggles). A single-model approach leaves accuracy gaps. We need automatic fallback to a secondary model when the primary model produces low-confidence results.

## What Changes

- Add configurable fallback OCR model support with primary and secondary model configuration
- Implement quality detection to identify when primary OCR results are poor (high illegible markers, low confidence)
- Automatically retry with fallback model when quality thresholds aren't met
- Set default configuration: Claude 4.6 Sonnet (primary) → GPT-4.1 Mini (fallback)
- Add environment variables for both models: `AI_MODEL_OCR` and `AI_MODEL_OCR_FALLBACK`
- Track and log which model was used for each transcription

## Capabilities

### New Capabilities
- `ocr-fallback`: Automatic fallback to secondary model when primary OCR quality is poor, with configurable quality thresholds and model selection

### Modified Capabilities
- `ocr-processing`: Add quality detection and fallback triggering logic to existing OCR pipeline
- `ai-provider-configuration`: Extend to support fallback model configuration

## Impact

**Affected Components:**
- `src/ocr.ts`: Core OCR processing function needs quality detection and fallback logic
- `src/utils.ts`: AI provider configuration loading needs fallback model support
- Environment configuration files: Add `AI_MODEL_OCR_FALLBACK` variable

**Benefits:**
- Improved OCR accuracy across diverse handwriting styles (expected 10-30% improvement on edge cases)
- Automatic recovery from poor quality results without manual intervention
- No breaking changes - fallback is optional and triggered only when needed

**Trade-offs:**
- Increased API costs when fallback is triggered (2x calls for failed documents)
- Slightly longer processing time for documents requiring fallback
- Additional configuration complexity
