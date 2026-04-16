# Hypothesis

## Question
How do ALL available HAI proxy models compare for OCR accuracy after discovering that GPT-4o doesn't exist?

## Hypothesis
Among HAI proxy available models (gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini, Claude Opus, Claude Sonnet), the full-size models (gpt-5, gpt-4.1, Claude Opus) will outperform mini variants.

## Rationale
- Experiment 001 revealed model availability issues requiring complete retest
- Full-size models typically have more parameters and better capabilities
- Mini models are usually optimized for cost/speed at expense of accuracy
- Need to test actual HAI proxy available models, not assumed models

## Success Criteria
- Test all 6 HAI proxy available models
- Achieve >85% character accuracy with at least one model
- Identify cost-effective option (<$0.10/image) if it meets accuracy threshold
- Establish reliable baseline with correct model routing

## Risks
- Full-size models may be too expensive for production use
- Mini models may not meet accuracy requirements
- Test case may not generalize to all handwriting styles
- HAI proxy model list could change without notice

## Methodology
- Test models: 
  - Claude: anthropic--claude-4.6-sonnet, anthropic--claude-4.6-opus
  - OpenAI: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
- Test case: Dynatrace Q2 04-09 handwritten meeting notes
- Metrics: Character accuracy, word F1, cost, latency, italic markers
- Scoring: Composite score (accuracy 70%, cost 15%, latency 15%)
- Validation: Verify model names with `/openai/v1/models` endpoint before testing
