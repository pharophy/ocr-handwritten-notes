# OCR Experiments - Summary

**Last Updated**: 2026-04-16

This document provides an overview of all OCR accuracy experiments. For detailed information about each experiment, see the individual experiment folders in `experiments/`.

## Quick Links

- [Experiment Structure](experiments/README.md)
- [Current Model Selection](OCR_MODEL_SELECTION.md)
- [Testing Framework](src/ocrTester.ts)
- [Experimentation Framework](src/ocrExperiment.ts)

## Experiment Overview

| # | Name | Status | Key Finding |
|---|------|--------|-------------|
| 001 | [initial-model-comparison](experiments/001-initial-model-comparison/) | ✅ Complete |  |
| 002 | [full-model-suite](experiments/002-full-model-suite/) | ✅ Complete |  |
| 003 | [hai-proxy-compatible](experiments/003-hai-proxy-compatible/) | ✅ Complete |  |

## Experiments by Status

### Completed (3)

- **[001](experiments/001-initial-model-comparison/)**: initial model comparison
- **[002](experiments/002-full-model-suite/)**: full model suite
- **[003](experiments/003-hai-proxy-compatible/)**: hai proxy compatible

### In Progress (0)

None currently running.

## Key Discoveries Across All Experiments

### 1. Mini Models Outperform Full Models (Experiment 003)
- GPT-5 Mini: 91.2% accuracy at $0.02/image
- GPT-5: 82.3% accuracy at $0.10/image
- **Takeaway**: Don't assume larger models are better for specific tasks

### 2. HAI Proxy Model Limitations (Experiments 001-003)
- HAI proxy only supports: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
- Models NOT available: gpt-4o, gpt-4-vision-preview
- **Takeaway**: Always verify API model availability before configuring

### 3. Formatting vs Content Accuracy Gap (All Experiments)
- Character accuracy: 85-91% (good)
- Word F1 scores: 0.55-0.60 (appears poor)
- Root cause: Indentation collapse, not content errors
- **Takeaway**: Use character accuracy as primary OCR quality metric

### 4. Configuration Loading Critical (Experiment 003)
- CLI tools need explicit `dotenv.config()`
- Environment inheritance doesn't work for dotenv files
- **Takeaway**: Every entry point needs environment loading

### 5. Quality Assessment Enhancement
- Combined illegible + italic markers more accurate than illegible alone
- Threshold increased from 15% → 30% for combined metric
- **Takeaway**: Italic markers indicate model uncertainty, treat like illegible

### 6. Cost-Accuracy-Speed Tradeoffs
```
Model           Accuracy  Cost      Latency  Score
GPT-5 Mini      91.2%     $0.02     51.6s    75.7 ⭐
GPT-4.1 Mini    85.6%     $0.02     39.7s    71.8
Claude Sonnet   90.3%     $0.12     52.6s    63.2
Claude Opus     90.2%     $0.62     30.5s    63.1
GPT-5           82.3%     $0.10     55.4s    57.6
```

## Performance Improvements

From start of experiments to current production configuration:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Accuracy | 90.3% | 91.2% | +0.9% |
| Cost | $0.12 | $0.02 | -83% |
| Latency | 52.6s | 51.6s | -1.9% |
| Score | 63.2 | 75.7 | +19.8% |
| Annual Savings (10K images) | Baseline | - | $12,000 |

## Current Production Configuration

```env
AI_MODEL_OCR=gpt-5-mini                          # Winner from Experiment 003
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini              # Cost-effective fallback
IMAGE_COMPRESSION_MAX_SIZE_MB=20                 # GPT supports larger images
OCR_UNCERTAIN_THRESHOLD=30                       # Combined illegible + italic
OCR_LEGACY_QUALITY_CHECK=false                   # Use enhanced quality assessment
```

## Future Experiment Ideas

Based on findings from completed experiments:

1. **Prompt Engineering for Formatting** - Address indentation collapse
2. **Preprocessing Optimization** - Test sharpening/contrast variations
3. **Multi-Pass OCR** - Use GPT-5 Mini + fallback for challenging sections
4. **Mini Model Analysis** - Investigate why mini models outperform full models
5. **Ensemble Methods** - Combine multiple model outputs
6. **Domain Glossary Impact** - Test with/without domain-specific terms
7. **Temperature Variations** - Test different sampling parameters
8. **Handwriting Style Diversity** - Test across different writing styles

## How to Run an Experiment

```bash
# Ideate new experiments
/experiment-ocr

# Run model comparison
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model

# Run single test
npm run test-ocr "test-images/sample.jpeg"

# Run full test suite
npm run test-ocr-suite
```

## References

- **Original Monolithic Summary**: See git history for comprehensive `EXPERIMENT_SUMMARY.md` (deprecated)
- **Individual Experiments**: `experiments/XXX-name/` directories
- **Testing Framework**: `src/ocrTester.ts`
- **Experiment Framework**: `src/ocrExperiment.ts`
- **Model Selection**: `OCR_MODEL_SELECTION.md`
- **OpenSpec Change**: `openspec/changes/improve-ocr-accuracy/`
