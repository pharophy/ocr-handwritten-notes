# Model Discovery Report

**Date**: 2026-05-06  
**HAI Proxy**: Running on localhost:6655

## Available Models Through HAI Proxy

### OpenAI Models
- gpt-5 (latest flagship, created 2024-01-01)
- gpt-5-mini (latest efficient model)
- gpt-4.1 (previous flagship)
- gpt-4.1-mini (previous efficient model)

### Anthropic Models
- anthropic--claude-4.6-sonnet (latest sonnet)
- anthropic--claude-4.6-opus (latest opus)
- anthropic--claude-4.5-sonnet (previous sonnet)
- anthropic--claude-4.5-opus (previous opus)
- anthropic--claude-4.5-haiku (efficient model)
- anthropic--claude-4-sonnet (older generation)

## Key Findings

1. **No GPT-5.5 exists** - The proposal mentioned GPT-5.5, but GPT-5 is the actual latest model from OpenAI
2. **DEFAULT_MODELS was already current** - Had GPT-5, GPT-5-Mini, GPT-4.1, Claude 4.6
3. **Added Claude 4.5 models** - For baseline comparison against 4.6

## Configuration Changes

Added to `src/ocrExperiment.ts` DEFAULT_MODELS:
```typescript
{
  name: 'Claude 4.5 Sonnet',
  provider: 'anthropic',
  modelId: 'claude-4.5-sonnet',
  costPerMToken: 3.00,
},
{
  name: 'Claude 4.5 Opus',
  provider: 'anthropic',
  modelId: 'claude-4.5-opus',
  costPerMToken: 15.00,
},
```

## Experiments Status

### Test Images Available
- ✅ `test-images/Dynatrace Q2 04-09.jpeg` (3.9MB) - Has ground truth
- ❌ `test-images/Cosine 02-26.jpeg` (14MB) - No ground truth
- ❌ `test-images/Amir 04-01.jpeg` (6.7MB) - No ground truth

### Running Experiments
- **In Progress**: Dynatrace model comparison (GPT-5, GPT-4.1, Claude 4.6 Sonnet, Claude 4.5 Sonnet)
- Early results show 91-92% accuracy across models

## Next Steps

1. Wait for Dynatrace experiment to complete
2. Analyze full results when experiment-results/dynatrace-model-comparison.md is generated
3. Create ground truth files for other test images if additional testing desired
4. Generate consolidated comparison report
5. Update documentation with recommendations
