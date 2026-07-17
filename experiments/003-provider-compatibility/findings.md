# Findings - Provider Compatibility

## Summary

Provider compatibility testing showed that model IDs must be verified with the active direct provider before production configuration changes.

## Key Findings

- Provider-native model IDs reduce routing ambiguity.
- Efficient models can offer the best overall OCR score when accuracy differences are small.
- Experiment artifacts should not be treated as live provider catalogs.

## Recommendations

1. Keep production `.env` templates on direct OpenAI or direct Anthropic.
2. Use provider-native Anthropic model IDs.
3. Re-run model availability checks before adopting newly released models.
4. Keep fallback OCR on the same configured direct provider.

## Next Steps

- Add a provider availability diagnostic command.
- Refresh experiment results with current direct-provider model IDs.
- Expand the handwriting test corpus.
