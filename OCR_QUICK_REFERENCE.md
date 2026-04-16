# 🎯 OCR Quick Reference

**Current Accuracy:** 91.2% ✅  
**Model:** GPT-5 Mini  
**Cost:** $0.02/image  
**Speed:** ~52 seconds

> **Based on:** [Experiment 003 - HAI Proxy Compatible Models](experiments/003-hai-proxy-compatible/findings.md)

---

## Quick Commands

```bash
# Test single image
npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg"

# Run full test suite
npm run test-ocr-suite

# Compare models
npm run experiment-ocr "path/to/image" -- --type=model

# Ideate new experiments
/experiment-ocr
```

---

## Current Configuration (Production)

```env
AI_MODEL_OCR=gpt-5-mini                      # 91.2% accuracy, $0.02/image
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini          # 85.6% accuracy fallback
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
```

See: [CONFIG.md](CONFIG.md) for all configuration options

---

## What Changed (April 2026)

### Experiments 001-002: Discovering Model Availability ❌
- Tested "gpt-4o" and "gpt-4-vision-preview"
- **Discovery:** These models don't exist in HAI proxy
- Inconsistent results due to model routing issues
- See: [experiments/001-initial-model-comparison/](experiments/001-initial-model-comparison/)

### Experiment 003: HAI Proxy Compatible Models ✅
- Verified actual available models via HAI proxy
- Tested: GPT-5, GPT-5 Mini, GPT-4.1, GPT-4.1 Mini, Claude Opus, Claude Sonnet
- **Winner:** GPT-5 Mini (91.2% accuracy, $0.02/image)
- See: [experiments/003-hai-proxy-compatible/](experiments/003-hai-proxy-compatible/)

### Key Discovery: Mini Models Outperform Full Models

```
GPT-5 Mini:  91.2% accuracy at $0.02/image ✅
GPT-5:       82.3% accuracy at $0.10/image (worse AND more expensive!)
```

**Counterintuitive Result:** Smaller models perform better for OCR
- Mini models may have task-specific fine-tuning
- Less prone to over-reasoning on ambiguous text
- Better calibrated confidence (fewer uncertainty markers)

---

## Performance Comparison

| Model | Accuracy | Cost | Speed | Score |
|-------|----------|------|-------|-------|
| **GPT-5 Mini** ⭐ | 91.2% | $0.02 | 51.6s | 75.7 |
| GPT-4.1 Mini | 85.6% | $0.02 | 39.7s | 71.8 |
| Claude Sonnet | 90.3% | $0.12 | 52.6s | 63.2 |
| Claude Opus | 90.2% | $0.62 | 30.5s | 63.1 |
| GPT-5 | 82.3% | $0.10 | 55.4s | 57.6 |

**Score:** `accuracy × 0.7 + cost × 0.15 + latency × 0.15`

---

## Cost Savings

```
Volume: 10,000 images/year

Before (Claude Sonnet):  $1,200/year
After (GPT-5 Mini):      $200/year
Annual Savings:          $1,000/year (83% reduction)
```

---

## Key Files

**Production:**
- `src/ocr.ts` - OCR processing with quality assessment
- `src/ocrTester.ts` - Testing framework
- `handwriting-reference.json` - Domain glossary

**Experiments:**
- `experiments/` - Organized experiment folders
- `EXPERIMENTS.md` - Auto-generated experiment summary
- `OCR_MODEL_SELECTION.md` - Detailed test results

**Configuration:**
- `CONFIG.md` - Complete configuration guide
- `.env.recommended` - Production config based on experiments
- `.env.proxy.*` - Provider-specific templates

**Testing:**
- `npm run test-ocr` - Single test
- `npm run test-ocr-suite` - Full test suite
- `npm run experiment-ocr` - Model experiments
- `/experiment-ocr` - AI-guided experimentation

---

## Metrics Over Time

| Metric | Early April | After Prompt Work | After Experiments | Change |
|--------|-------------|-------------------|-------------------|--------|
| Character Accuracy | 35-42% | 90-92% | 91.2% | +56 pts |
| Cost per Image | $0.12 | $0.12 | $0.02 | -83% |
| Uncertainty | 30-47% | 0% | 0% | -30-47 pts |
| Speed | 25s | 15s | 52s | -33% |

---

## Troubleshooting

**Low accuracy?**
- ✓ Using GPT-5 Mini (gpt-5-mini)?
- ✓ HAI proxy running?
- ✓ Check uncertainty markers (should be 0-2%)
- ✓ Image quality good (clear, high contrast)?

**Slow?**
- ✓ Image compressed (<20MB for GPT)?
- ✓ Network stable?
- Expected: 50-55s per image

**Model not found?**
- ❌ Don't use: gpt-4o, gpt-4-vision-preview (don't exist)
- ✅ Use: gpt-5-mini, gpt-4.1-mini, anthropic--claude-4.6-sonnet
- See: [CONFIG.md - Troubleshooting](CONFIG.md#-troubleshooting)

**Want to test different models?**
```bash
# Run experiments
npm run experiment-ocr "test-images/sample.jpeg" -- --type=model

# Or use the AI skill
/experiment-ocr
```

---

## Experimentation Workflow

The project now has structured experimentation:

1. **Ideate** - `/experiment-ocr` skill proposes experiments
2. **Design** - Creates hypothesis.md with methodology
3. **Execute** - Runs tests with proper tooling
4. **Analyze** - Documents findings.md with recommendations
5. **Track** - Updates EXPERIMENTS.md automatically

See: [experiments/README.md](experiments/README.md) for templates

---

## Next Steps (If Needed)

**Current: 91.2% accuracy is excellent for most use cases** ✅

**To improve further:**
1. **Prompt Engineering** - Test formatting preservation (experiments/004)
2. **Preprocessing** - Test sharpening/contrast variations (experiments/005)
3. **Multi-Pass OCR** - Combine primary + fallback outputs (experiments/006)
4. **Ensemble Methods** - Average multiple model outputs (+5-10%)

**To investigate:**
- Why do mini models outperform full models? (experiments/007)
- Domain-specific glossary impact on accuracy
- Temperature/sampling parameter effects

---

## Documentation Structure

```
Root Documentation:
├── README.md                    # Main project guide
├── CONFIG.md                    # Complete configuration guide
├── EXPERIMENTS.md               # Auto-generated experiment summary
├── OCR_MODEL_SELECTION.md       # Detailed test results
└── OCR_QUICK_REFERENCE.md       # This file (quick reference)

Experiments:
├── experiments/
│   ├── README.md                # Templates and guidelines
│   ├── 001-initial-model-comparison/
│   ├── 002-full-model-suite/
│   └── 003-hai-proxy-compatible/  # Winner: GPT-5 Mini

Guides:
├── docs/guides/
│   ├── glossary-curation.md     # Domain term management
│   └── testing.md               # Testing guide

Archive:
└── docs/archive/                # Historical documents
```

---

**Project Status:** ✅ PRODUCTION-READY  
**Last Updated:** April 16, 2026  
**Current Model:** GPT-5 Mini (91.2% accuracy, $0.02/image)

See [EXPERIMENTS.md](EXPERIMENTS.md) for complete experiment history.
