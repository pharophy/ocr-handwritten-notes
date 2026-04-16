# Hypothesis

## Question
What is the true OCR accuracy of HAI proxy verified models after fixing model routing issues?

## Hypothesis
Mini models (gpt-5-mini, gpt-4.1-mini) will underperform full models (gpt-5, gpt-4.1), and Claude models will provide better accuracy than OpenAI models at higher cost.

## Rationale
- Experiments 001 and 002 invalidated due to model routing issues
- HAI proxy actually supports: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini (verified via `/openai/v1/models`)
- Conventional wisdom: larger models = better performance
- Claude models more expensive = presumably better quality
- Need clean baseline with confirmed model routing

## Success Criteria
- All models route correctly (verified via logging)
- At least one model achieves >90% character accuracy
- Results are consistent across multiple runs (±2% variance)
- Identify production-ready model (accuracy + cost + latency balance)

## Risks
- Mini models may not meet accuracy threshold
- All HAI models may underperform expectations
- Cost of accurate models may be prohibitive
- Test case still limited to single handwriting style

## Methodology

### Pre-Experiment Validation
```bash
curl -H "Authorization: Bearer $HAI_API_KEY" \
  http://localhost:6655/openai/v1/models | jq '.data[].id'
```

### Models to Test
- ✅ Claude: anthropic--claude-4.6-sonnet, anthropic--claude-4.6-opus
- ✅ OpenAI: gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini
- ❌ Removed: gpt-4o, gpt-4-vision-preview (not in HAI proxy)

### Test Protocol
1. Update src/ocrExperiment.ts DEFAULT_MODELS array
2. Add dotenv.config() to CLI tools for proper config loading
3. Run experiment with verified models
4. Log actual model IDs used in requests
5. Test case: Dynatrace Q2 04-09 handwritten meeting notes
6. Metrics: Character accuracy, word F1, cost, latency, italic markers
7. Scoring: Composite score (accuracy 70%, cost 15%, latency 15%)

### Validation Steps
- Check .env AI_MODEL_OCR setting before and after
- Verify dotenv loading in CLI tools
- Confirm model routing in API logs
- Run multiple times to check consistency
