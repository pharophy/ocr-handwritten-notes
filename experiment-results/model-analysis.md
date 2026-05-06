# Model Comparison Analysis Report

**Date**: 2026-05-06  
**Test Image**: Dynatrace Q2 04-09 (handwritten notes)  
**Models Tested**: GPT-5, GPT-4.1, Claude 4.6 Sonnet, Claude 4.5 Sonnet

## Executive Summary

**Winner: GPT-4.1** achieved the highest composite score (67.9/100) due to excellent balance of accuracy, cost, and speed.

### Key Findings

1. **Accuracy is similar across all models** (90.8% - 92.2%)
   - Claude 4.6 Sonnet: 92.2% (highest)
   - Claude 4.5 Sonnet: 91.8%
   - GPT-4.1 & GPT-5: 90.8%

2. **GPT-4.1 offers best value proposition**
   - Only 1.4% less accurate than Claude 4.6 Sonnet
   - $0.021 cheaper per image
   - 2.1s faster than Claude 4.6 Sonnet
   - 32.7s faster than GPT-5

3. **GPT-5 is surprisingly slow** (53.9s vs 21.3s for GPT-4.1)
   - Despite being the "latest" model, it's 2.5x slower
   - Same accuracy as GPT-4.1
   - Same cost as GPT-4.1
   - **Not recommended** for production use

4. **Claude 4.5 vs 4.6 shows minimal improvement**
   - 0.4% accuracy gain for 4.6
   - 7.5s faster (4.6 is better optimized)
   - Same cost
   - 4.6 is slightly better but not transformative

## Detailed Comparison

| Model | Accuracy | Speed | Cost | Score | Notes |
|-------|----------|-------|------|-------|-------|
| **GPT-4.1** ⭐ | 90.8% | 21.3s | $0.103 | 67.9 | Best overall - fast, accurate, cheap |
| Claude 4.6 Sonnet | 92.2% | 23.3s | $0.124 | 67.8 | Highest accuracy but more expensive |
| Claude 4.5 Sonnet | 91.8% | 30.8s | $0.124 | 64.2 | Slower than 4.6, similar accuracy |
| GPT-5 | 90.8% | 53.9s | $0.103 | 63.5 | ❌ Unacceptably slow |

## Scoring Breakdown

The composite score uses weights:
- Accuracy: 70%
- Cost: 15%
- Latency: 15%

### Why GPT-4.1 Won

Despite having 1.4% lower accuracy than Claude 4.6 Sonnet, GPT-4.1 wins because:
- **Cost advantage**: 17% cheaper ($0.103 vs $0.124)
- **Speed advantage**: 9% faster (21.3s vs 23.3s)
- **Accuracy is "good enough"**: 90.8% is still excellent for handwriting OCR

The accuracy difference (92.2% vs 90.8% = 1.4%) translates to about 14 fewer characters correct per 1000 characters - a minor difference that doesn't justify the higher cost and slower speed.

## Recommendations

### For Production Use

1. **Default to GPT-4.1**
   - Best balance of speed, cost, and accuracy
   - Recommended for: batch processing, cost-sensitive workloads

2. **Use Claude 4.6 Sonnet when accuracy is critical**
   - Only 1.4% more accurate but 17% more expensive
   - Recommended for: high-stakes documents, legal/medical notes

3. **Avoid GPT-5**
   - 2.5x slower than GPT-4.1 with no accuracy benefit
   - May improve in future releases but currently not production-ready

### Configuration Updates

Update default model in `handwriting-reference.json`:
```json
{
  "aiProvider": {
    "models": {
      "ocr": "gpt-4.1"
    }
  }
}
```

Or via environment variable:
```bash
AI_MODEL_OCR=gpt-4.1
```

## Limitations

1. **Single test image**: Results based on one handwriting sample
2. **No GPT-4o data**: The "gpt-4o" model wasn't tested (not available in HAI proxy)
3. **Estimated costs**: Based on token estimation, not actual API billing

## Next Steps

1. ✅ Document findings (this report)
2. Update README with model recommendations
3. Update configuration examples
4. Consider testing with additional handwriting samples if available
