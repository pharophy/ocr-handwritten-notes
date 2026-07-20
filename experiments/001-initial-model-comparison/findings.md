# Findings - Initial Model Comparison

## Summary

Initial model comparison revealed that configured model names must be verified against the active provider before experiment results can be trusted.

## Results

### Run 1 (2026-04-15 14:42)

```text
GPT-4o:        90.6% accuracy, $0.10, 13.9s, score: 71.9
Claude Sonnet: 90.6% accuracy, $0.12, 15.0s, score: 70.9
```

### Run 2 (2026-04-15 14:43)

Similar results confirmed.

## Analysis

The experiment configuration used model labels before verifying availability against the active provider. That made the results unsuitable for production model selection.

## Recommendations

1. Invalidate these results for production model choice.
2. Verify model availability before running model comparisons.
3. Re-run experiments with provider-native model IDs.
4. Document exact provider configuration alongside experiment results.

## Next Steps

- Experiment 002: test a verified model list.
- Update `src/ocrExperiment.ts` defaults when production model choices change.
- Add model availability validation before experiments.
