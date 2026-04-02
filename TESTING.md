# Testing Guide

This guide explains how to test different AI models for OCR accuracy.

## Quick Start

### Option 1: Interactive Test Launcher

```bash
./test-models.sh
```

This presents a menu to choose which tests to run:
1. Test Claude models only (6 models, ~5-7 minutes)
2. Test OpenAI models only (4 models, ~3-5 minutes)
3. Test all models (10 models, ~10-15 minutes)

### Option 2: Run Specific Test Suite

```bash
# Test Claude models
./tests/test-claude.sh

# Test OpenAI models
./tests/test-openai.sh

# Test all models
./tests/test-all-models.sh
```

## Test Configuration

Each test script uses a pre-configured `.env.proxy.*` file:

- **test-claude.sh** → `.env.proxy.claude`
- **test-openai.sh** → `.env.proxy.openai`

These files contain optimized settings for each provider.

## Models Tested

### Claude (6 models)
- anthropic--claude-4.6-sonnet (latest)
- anthropic--claude-4.6-opus (highest accuracy)
- anthropic--claude-4.5-sonnet (excellent for handwriting)
- anthropic--claude-4.5-opus (high capability)
- anthropic--claude-4.5-haiku (fast, cost-effective)
- anthropic--claude-4-sonnet (previous generation)

### OpenAI (4 models)
- gpt-5 (latest, best accuracy)
- gpt-5-mini (fast, cost-effective)
- gpt-4.1 (high capability)
- gpt-4.1-mini (balanced option)

## Test Results

Results are saved to `test-results/` directory:

```
test-results/
├── claude-comparison-{timestamp}.txt
├── openai-comparison-{timestamp}.txt
└── complete-comparison-{timestamp}.txt
```

Each result file contains:
- Configuration details (provider, model)
- OCR accuracy score
- Processing time
- Detailed test output

## What Gets Tested

Each model is tested with:
1. A sample handwritten note image
2. OCR transcription accuracy
3. Layout detection (tables vs freeform)
4. Handwriting reference integration
5. Quality validation

The test compares:
- Transcription accuracy (% correct words)
- Processing time (seconds)
- Confidence scores
- Error detection

## Interpreting Results

Look for these metrics in the results:

```
📊 Accuracy: 95.2%
⏱️ Time: 3.4s
✓ Confidence: High
```

- **Accuracy**: Percentage of correctly transcribed words
- **Time**: Processing duration
- **Confidence**: OCR quality assessment

Higher accuracy and confidence are better. Processing time varies by model tier.

## Prerequisites

### For HAI Proxy Tests (Claude, OpenAI)

1. Install HAI CLI:
   ```bash
   # See: https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/
   ```

2. Authenticate:
   ```bash
   hai auth login
   ```

3. Verify:
   ```bash
   hai models
   ```

### For OpenAI Direct Tests

1. Get API key from https://platform.openai.com/api-keys
2. Set in `.env.proxy.openai-direct`:
   ```env
   OPENAI_API_KEY=sk-proj-...
   ```

## Customizing Tests

### Test a Single Model

Edit a test script and modify the models array:

```bash
# In tests/test-claude.sh
declare -a models=(
  "anthropic--claude-4.6-sonnet:Claude 4.6 Sonnet (latest)"
  # Comment out other models to skip them
)
```

### Test with Custom Image

Edit `tests/model-comparison.test.ts` and change:

```typescript
const TEST_IMAGE = 'path/to/your/test-image.jpg';
```

### Add Custom Validation

Modify `handwriting-reference.json` to add:
- Domain-specific terminology
- Expected acronyms
- Proper nouns
- Special notation

This improves accuracy for specialized documents.

## Troubleshooting

### "HAI proxy failed to start"

```bash
# Check if already running
lsof -i :6655

# Start manually
hai proxy start

# Check logs
hai proxy logs
```

### "Model not found"

```bash
# List available models
hai models

# Verify model name format
# Correct: anthropic--claude-4.6-sonnet
# Wrong: anthropic-claude-4.6-sonnet (single dash)
```

### "Test results show 0% accuracy"

- Check test image exists: `test-images/Cosine 02-26.jpeg`
- Verify image is readable
- Check model has vision capabilities
- Review error messages in test output

### "Tests taking too long"

- Run individual provider tests instead of all models
- Test only latest models (Claude 4.6 Sonnet, GPT-4.1 Mini)
- Reduce number of test images

## Best Practices

1. **Run baseline first**: Test with Claude 4.6 Sonnet to establish baseline
2. **Compare similar tiers**: Compare Opus vs GPT-5 Pro (high-end) separately from Haiku vs GPT-5 Mini (fast/cheap)
3. **Test with your images**: Use actual handwriting samples from your use case
4. **Track over time**: Keep results to see model improvements
5. **Document findings**: Note which models work best for your handwriting style

## See Also

- [CONFIG.md](CONFIG.md) - Configuration files documentation
- [tests/MODELS.md](tests/MODELS.md) - Complete model reference
- [README.md](README.md) - Main project documentation
