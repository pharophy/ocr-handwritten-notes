# Hypothesis

## Question

What is the OCR accuracy of models verified against the configured direct provider?

## Hypothesis

Verified provider-native model IDs will produce more reliable experiment results than aliases or unverified names.

## Rationale

- Previous experiments showed that unverified model names can invalidate results.
- Direct provider configuration needs provider-native model IDs.
- Model availability may vary by account and endpoint.

## Success Criteria

- Verify configured model IDs before running OCR comparisons.
- Test at least one OpenAI model and one Anthropic model where credentials are available.
- Identify a default OCR model and fallback model for the direct-provider setup.

## Risks

- Provider model catalogs can change.
- Account permissions may differ between machines.
- Latency and cost measurements may vary by day and region.

## Methodology

- Use direct OpenAI and direct Anthropic SDK paths.
- Use provider-native model IDs.
- Record provider, model, date, accuracy, latency, and cost estimate.
- Avoid proxy-specific aliases in experiment configuration.
