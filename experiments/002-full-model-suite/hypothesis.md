# Hypothesis

## Question

How do verified provider-available models compare for OCR accuracy?

## Hypothesis

Among verified OpenAI and Anthropic models, larger models may improve handwriting OCR accuracy, but efficient models may produce a better cost-speed-accuracy tradeoff.

## Rationale

- Experiment 001 showed model availability must be verified before comparison.
- Full-size models typically have stronger reasoning and vision capabilities.
- Smaller models may be optimized enough for note OCR while costing less.

## Success Criteria

- Test only verified provider-available models.
- Achieve greater than 85% character accuracy with at least one model.
- Identify a cost-effective option if it meets the accuracy threshold.
- Establish a reliable baseline with documented provider settings.

## Risks

- Full-size models may be too expensive for production use.
- Smaller models may not meet accuracy requirements.
- One test case may not generalize to all handwriting styles.
- Provider model catalogs can change over time.

## Methodology

- Test representative OpenAI and Anthropic model IDs available to the configured direct provider.
- Test case: Dynatrace Q2 04-09 handwritten meeting notes.
- Metrics: character accuracy, word F1, cost, latency, uncertain markers.
- Scoring: composite score with accuracy, cost, and latency.
- Validation: verify model names against the provider before testing.
