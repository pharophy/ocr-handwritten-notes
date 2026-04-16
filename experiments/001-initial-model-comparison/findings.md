# Findings - Initial Model Comparison

## Summary
Initial model comparison revealed that configured model names don't match HAI proxy availability, invalidating results.

## Results

### Run 1 (2026-04-15 14:42)
```
GPT-4o:          90.6% accuracy, $0.10, 13.9s, score: 71.9
Claude Sonnet:   90.6% accuracy, $0.12, 15.0s, score: 70.9
```

### Run 2 (2026-04-15 14:43)
Similar results confirmed.

## Analysis

**Critical Discovery**: The experiment was configured to test "GPT-4o" but this model doesn't exist in HAI proxy.

Investigation revealed:
```bash
curl -H "Authorization: Bearer ..." http://localhost:6655/openai/v1/models

Available Models:
- gpt-5
- gpt-5-mini
- gpt-4.1
- gpt-4.1-mini

NOT available:
- gpt-4o ❌
- gpt-4-vision-preview ❌
```

**Impact**: Results cannot be trusted as the system may have been routing to a different model or using cached responses.

## Recommendations

1. ❌ **Invalidate these results** - Cannot trust model routing
2. ✅ **Update experiment configuration** - Use only HAI-available models
3. ✅ **Re-run experiment** - Test with gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
4. ✅ **Document HAI proxy limitations** - Prevent future misconfiguration

## Next Steps

- Experiment 002: Test all HAI proxy available models
- Update src/ocrExperiment.ts DEFAULT_MODELS array
- Add model availability validation before experiments
