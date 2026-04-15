# 🎯 OCR Quick Reference

**Current Accuracy:** 90-92% ✅  
**Model:** Claude 4.6 Sonnet  
**Cost:** $0.12/image  
**Speed:** ~15 seconds

---

## Quick Commands

```bash
# Test single image
npm run test-ocr "test-images/Dynatrace Q2 04-09.jpeg"

# Run full test suite
npm run test-ocr-suite

# Compare models
npm run experiment-ocr "path/to/image" -- --type=model

# Experiment with prompts
npx tsx src/experiments/promptEngineering.ts "path/to/image"
```

---

## What Changed (April 2026)

### Before: 35-42% accuracy ❌
- Old prompt allowed uncertainty markers
- Model marked 30-47% of words as uncertain
- Many correct words flagged incorrectly

### After: 90-92% accuracy ✅
- New prompt eliminates uncertainty permission
- 0% uncertainty markers
- Model commits to interpretations

### The One-Line Fix

```typescript
// OLD: "Only mark uncertain words with *italics* if truly illegible"
// NEW: "Do not use *italics*. Always give your best interpretation."
```

Result: **+53 percentage points improvement**

---

## Key Files

**Production:**
- `src/ocr.ts` - Optimized prompt (91% accuracy)
- `src/ocrTester.ts` - Testing framework
- `handwriting-samples/reference.json` - Domain glossary

**Experiments:**
- `src/experiments/promptEngineering.ts` - Test prompts
- `src/promptVariations.ts` - 8 tested strategies
- `test-results/prompt-experiment.json` - Results

**Documentation:**
- `test-results/FINAL_SUCCESS_REPORT.md` - Project summary
- `test-results/PROJECT_DOCUMENTATION.md` - Complete guide

---

## Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Character Accuracy | 35-42% | 90-92% | +53 pts |
| Word F1 | 0.44 | 0.59 | +15 pts |
| Uncertainty | 30-47% | 0% | -30-47 pts |
| Speed | 25s | 15s | -40% |

---

## Top 3 Prompts (All ~91%)

1. **character-focus** - 91.96%, 4.1% italics
2. **precise-minimal** - 91.06%, 0.0% italics ← DEPLOYED
3. **two-pass-mental** - 90.57%, 0.0% italics

---

## Troubleshooting

**Low accuracy?**
- ✓ Using Claude Sonnet 4.6?
- ✓ HAI proxy running?
- ✓ Prompt unmodified?
- ✓ Check uncertainty markers (should be 0%)

**Slow?**
- ✓ Image compressed (<5MB)?
- ✓ Network stable?
- Expected: 15-18s per image

**Errors?**
- Run with `--show-diff` flag
- Check `test-results/baseline.json`

---

## Next Steps (If Needed)

**To reach 95%+:**
1. Post-processing (+5-10%) - 8-16 hours
2. Ensemble methods (+5-10%) - 16-24 hours
3. Fine-tuning (+5-15%) - 40-80 hours

**Current: 91% sufficient for most use cases** ✅

---

**Project Status:** ✅ COMPLETE  
**Last Updated:** April 14, 2026
