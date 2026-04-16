# Hypothesis

## Question
How do different AI vision models (Claude Opus, Claude Sonnet, GPT-4o, GPT-4 Vision) compare in OCR accuracy for handwritten notes?

## Hypothesis
Claude 4.6 Opus will provide the best OCR accuracy due to being the most capable model, though at higher cost. GPT-4o may offer a good balance of accuracy and cost.

## Rationale
- More capable models typically perform better on vision tasks
- Opus represents Anthropic's most advanced reasoning capabilities
- GPT-4o is marketed as efficient and capable for vision tasks

## Success Criteria
- Identify model with >85% character accuracy
- Find cost-effective option (<$0.15/image) with >80% accuracy
- Establish baseline metrics for future experiments

## Risks
- Model costs may be prohibitively expensive for production use
- API availability/rate limits may affect testing
- Single test case may not represent diverse handwriting styles

## Methodology
- Test models: Claude 4.6 Sonnet, Claude 4.6 Opus, GPT-4o, GPT-4 Vision
- Test case: Dynatrace Q2 04-09 handwritten meeting notes
- Metrics: Character accuracy, word F1, cost, latency, italic markers
- Scoring: Composite score (accuracy 70%, cost 15%, latency 15%)
