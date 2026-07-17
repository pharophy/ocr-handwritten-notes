# OCR Experiments - Summary

**Last Updated**: 2026-07-17

This document summarizes OCR accuracy experiments. Current runtime configuration uses direct OpenAI or direct Anthropic providers only.

## Quick Links

- [Experiment Structure](experiments/README.md)
- [Current Model Selection](OCR_MODEL_SELECTION.md)
- [Testing Framework](src/ocrTester.ts)
- [Experimentation Framework](src/ocrExperiment.ts)

## Experiment Overview

| # | Name | Status | Key Finding |
| --- | --- | --- | --- |
| 001 | [initial-model-comparison](experiments/001-initial-model-comparison/) | Complete | Initial model assumptions needed verification |
| 002 | [full-model-suite](experiments/002-full-model-suite/) | Complete | Accuracy varies by model and prompt format |
| 003 | [provider-compatibility](experiments/003-provider-compatibility/) | Complete | Model availability must be verified before configuration |

## Key Discoveries

### 1. Mini Models Can Outperform Larger Models

- GPT-5 Mini: 91.2% accuracy at lower cost in the completed test set.
- GPT-5: Lower accuracy and higher cost in that same test set.
- Takeaway: do not assume larger models are better for handwriting OCR.

### 2. Model Availability Must Be Verified

- Provider model catalogs and account entitlements can change.
- A model name may be documented but unavailable to a given API key or endpoint.
- Takeaway: verify model availability with the configured direct provider before relying on a model in `.env`.

### 3. Formatting and Content Accuracy Differ

- Character accuracy can be high while word-level F1 looks lower.
- Root cause in prior tests was often indentation and formatting collapse, not content loss.
- Takeaway: use character accuracy and manual diff review together for OCR quality.

### 4. Configuration Loading Matters

- CLI entry points need explicit `.env` loading.
- Environment inheritance is not enough when values live in dotenv files.
- Takeaway: each executable entry point should call `dotenv.config()`.

### 5. Quality Assessment Benefits From Uncertainty Markers

- Combined illegible and uncertain markers produced better quality signals than illegible markers alone.
- Takeaway: treat model uncertainty markers as quality signals.

## Current Production Configuration

```env
AI_PROVIDER=openai
AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
IMAGE_COMPRESSION_MAX_SIZE_MB=20
OCR_UNCERTAIN_THRESHOLD=30
OCR_LEGACY_QUALITY_CHECK=false
```

## Future Experiment Ideas

1. Prompt engineering for formatting preservation
2. Preprocessing optimization
3. Multi-pass OCR for challenging sections
4. Mini model analysis
5. Ensemble methods
6. Domain glossary impact
7. Temperature and sampling behavior where supported
8. Handwriting style diversity

## How to Run an Experiment

```bash
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model
npm run test-ocr "test-images/sample.jpeg"
npm run test-ocr-suite
```

## References

- Individual experiments: `experiments/XXX-name/`
- Testing framework: `src/ocrTester.ts`
- Experiment framework: `src/ocrExperiment.ts`
- Model selection: `OCR_MODEL_SELECTION.md`
