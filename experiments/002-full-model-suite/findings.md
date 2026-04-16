# Findings - Full Model Suite Test

## Summary
Comprehensive test revealed wide accuracy variance, model inconsistency issues, and confirmed HAI proxy model availability problems persist.

## Results (2026-04-15 15:19)

| Model             | Accuracy | Word F1 | Cost   | Latency | Italics | Score |
|-------------------|----------|---------|--------|---------|---------|-------|
| GPT-4o            | 80.6%    | 0.566   | $0.103 | 14.0s   | 25.0%   | 64.4  |
| Claude Sonnet     | 61.0%    | 0.545   | $0.123 | 16.5s   | 38.2%   | 49.4  |
| Claude Opus       | 55.6%    | 0.538   | $0.617 | 16.2s   | 39.5%   | 45.9  |
| GPT-4 Vision      | 6.3%     | 0.490   | $0.412 | 18.8s   | 44.4%   | 10.0  |

## Analysis

### Key Problems Identified

1. **Model Inconsistency** - Claude Sonnet showed 90.6% in Experiment 001, but only 61.0% here
   - Same test case, different results
   - Suggests model routing or configuration issues

2. **GPT-4 Vision Complete Failure** - Only 6.3% accuracy
   - Catastrophic failure mode
   - Model may not support the task or image format

3. **High Italic Marker Counts** - Claude models: 38-44% uncertain words
   - Indicates low model confidence
   - Quality assessment should trigger fallback

4. **GPT-4o Best Performance** - But this model doesn't exist!
   - 80.6% accuracy, lowest cost
   - Confirms Experiment 001 finding: model name is wrong

### Root Cause

**HAI Proxy Model Configuration Mismatch**: Experiments continue to use model names that HAI proxy doesn't recognize (gpt-4o, gpt-4-vision-preview), leading to unreliable routing.

## Recommendations

1. ❌ **Invalidate these results** - Model routing is unreliable
2. ✅ **Verify HAI proxy models** - Query `/openai/v1/models` endpoint directly
3. ✅ **Update experiment code** - Hard-code only verified HAI proxy models
4. ✅ **Add pre-experiment validation** - Check model availability before testing
5. ✅ **Re-run with correct models** - Use gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini only

## Next Steps

- Experiment 003: HAI proxy compatible models only
- Update src/ocrExperiment.ts to remove gpt-4o and gpt-4-vision-preview
- Document actual HAI proxy model list with timestamp
- Add model validation step to experiment runner
