# Test Configuration Files

This directory contains pre-configured `.env.proxy.*` files for testing different AI providers.

## Available Configurations

| File | Provider | Description |
|------|----------|-------------|
| `.env.proxy.claude` | Claude via HAI Proxy | Claude 4.6 Sonnet for OCR, Haiku for summarization (Recommended) |
| `.env.proxy.openai` | OpenAI via HAI Proxy | GPT-5 for OCR, GPT-5 Mini for summarization |
| `.env.proxy.openai-direct` | OpenAI Direct API | GPT-5 for OCR (requires API key) |

## Quick Start

### Test a specific provider

```bash
# Test Claude models
cp .env.proxy.claude .env
npm start

# Test OpenAI models (via HAI proxy)
cp .env.proxy.openai .env
npm start

# Test OpenAI direct (set your API key first!)
cp .env.proxy.openai-direct .env
# Edit .env and add your OPENAI_API_KEY
npm start
```

### Run automated tests

```bash
# Test all models (10 models, ~10-15 minutes)
./tests/test-all-models.sh

# Test specific provider
./tests/test-claude.sh    # 6 Claude models
./tests/test-openai.sh    # 4 OpenAI models

# Interactive launcher
./test-models.sh
```

## Configuration Details

### `.env.proxy.claude`
- **Provider**: HAI Proxy with Claude
- **OCR Model**: `anthropic--claude-4.6-sonnet` (latest, recommended)
- **Summarization**: `anthropic--claude-4.5-haiku` (fast, cost-effective)
- **Validation**: `anthropic--claude-4.5-haiku`
- **Best For**: Handwriting OCR, zero cost for SAP employees

### `.env.proxy.openai`
- **Provider**: HAI Proxy with OpenAI
- **OCR Model**: `gpt-5` (latest, best accuracy)
- **Summarization**: `gpt-5-mini` (fast, cost-effective)
- **Validation**: `gpt-5-mini`
- **Best For**: Latest GPT models, zero cost for SAP employees

### `.env.proxy.openai-direct`
- **Provider**: OpenAI Direct API
- **OCR Model**: `gpt-5` (latest)
- **Summarization**: `gpt-5-mini`
- **Validation**: `gpt-5-mini`
- **Best For**: Non-SAP users, requires OpenAI API key
- **⚠️ Important**: Set `OPENAI_API_KEY` before using

## Model Selection

You can customize which model to use for each operation by editing the `.env` file:

```env
# Vision model for OCR (handwriting recognition)
AI_MODEL_OCR=anthropic--claude-4.6-sonnet

# Text model for summarization
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku

# Text model for validation
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
```

See [tests/MODELS.md](tests/MODELS.md) for complete list of available models.

## Test Scripts Usage

All test scripts are located in the `tests/` directory and will:
1. Backup your current `.env`
2. Test each model for the provider
3. Generate detailed results in `test-results/`
4. Restore your original `.env`

Results are saved to:
- `test-results/claude-comparison-{timestamp}.txt`
- `test-results/openai-comparison-{timestamp}.txt`
- `test-results/complete-comparison-{timestamp}.txt` (combined)

## Creating Custom Configurations

To create your own test configuration:

```bash
# Copy a template
cp .env.proxy.claude .env.proxy.custom

# Edit the file
# - Change AI_MODEL_OCR to your preferred vision model
# - Change AI_MODEL_SUMMARIZATION to your preferred text model
# - Adjust any other settings

# Use it
cp .env.proxy.custom .env
npm start
```

## Troubleshooting

**HAI Proxy not starting?**
```bash
# Check if already running
lsof -i :6655

# Manually start
hai proxy start

# Check status
hai proxy status
```

**API key not working?**
- Verify your key at https://platform.openai.com/api-keys
- Check you have credits: https://platform.openai.com/usage
- Make sure the key is set in `.env`: `OPENAI_API_KEY=sk-...`

**Model not found?**
```bash
# List available models via HAI proxy
hai models

# Verify model name format (use '--' not '-')
# Correct: anthropic--claude-4.6-sonnet
# Wrong: anthropic-claude-4.6-sonnet
```

## See Also

- [README.md](README.md) - Main project documentation
- [tests/MODELS.md](tests/MODELS.md) - Complete model reference
- [.env.example](.env.example) - Detailed configuration guide
