# Test Configuration Files

This directory contains pre-configured `.env.proxy.*` files for testing different AI providers.

## Available Configurations

| File | Provider | Description |
|------|----------|-------------|
| `.env.proxy.claude` | Claude via HAI Proxy | Claude 4.6 Sonnet for OCR, Haiku for summarization (Recommended) |
| `.env.proxy.openai` | OpenAI via HAI Proxy | GPT-5 for OCR, GPT-5 Mini for summarization |
| `.env.direct.openai` | OpenAI Direct API | GPT-5 for OCR (requires API key) |

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
cp .env.direct.openai .env
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
- **OCR Fallback**: `gpt-4.1-mini` (cross-provider automatic fallback)
- **Summarization**: `anthropic--claude-4.5-haiku` (fast, cost-effective)
- **Validation**: `anthropic--claude-4.5-haiku`
- **Best For**: Handwriting OCR, zero cost for SAP employees, automatic quality improvement

### `.env.proxy.openai`
- **Provider**: HAI Proxy with OpenAI
- **OCR Model**: `gpt-5` (latest, best accuracy)
- **OCR Fallback**: `anthropic--claude-4.6-sonnet` (cross-provider automatic fallback)
- **Summarization**: `gpt-5-mini` (fast, cost-effective)
- **Validation**: `gpt-5-mini`
- **Best For**: Latest GPT models, zero cost for SAP employees

### `.env.direct.openai`
- **Provider**: OpenAI Direct API
- **OCR Model**: `gpt-5` (latest)
- **OCR Fallback**: `gpt-4.1-mini` (same-provider fallback)
- **Summarization**: `gpt-5-mini`
- **Validation**: `gpt-5-mini`
- **Best For**: Non-SAP users, requires OpenAI API key
- **⚠️ Important**: Set `OPENAI_API_KEY` before using

## Model Selection

You can customize which model to use for each operation by editing the `.env` file:

```env
# Vision model for OCR (handwriting recognition)
AI_MODEL_OCR=anthropic--claude-4.6-sonnet

# Fallback model when primary OCR quality is poor (automatic retry)
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini

# Text model for summarization
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku

# Text model for validation
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
```

### Automatic OCR Fallback

The system automatically retries OCR with a fallback model when primary quality is poor:
- Triggers on >15% illegible markers, 5+ consecutive illegibles, or very short output
- Cross-provider fallback recommended (Claude → OpenAI or vice versa)
- Dramatically improves accuracy on challenging handwriting
- See README.md for detailed configuration and tuning options

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

**Image too large errors?**
- Image compression is enabled by default for images >5MB
- Check compression logs in output: `✓ Image compressed: X.XMB → Y.YMB`
- If image still can't compress, manually resize to ~2000px width
- Adjust compression settings in `.env`:
  ```env
  IMAGE_COMPRESSION_MAX_SIZE_MB=5        # Claude's 5MB limit
  IMAGE_COMPRESSION_MIN_QUALITY=70       # Min quality (lower = more compression)
  IMAGE_COMPRESSION_ENABLED=true         # Enable/disable compression
  ```

## Image Compression Configuration

All preset configurations include automatic image compression to handle large images (>5MB) that exceed Claude 4.6 Sonnet's limit.

**How it works:**
1. Images are preprocessed (grayscale, resize, normalize, sharpen)
2. If preprocessed buffer >5MB, progressive compression is applied:
   - Try quality=90 (high quality, minimal compression)
   - If still >5MB, try quality=80
   - If still >5MB, try quality=70 (minimum for text readability)
   - If still >5MB, fail with manual resize guidance

**Default settings:**
- `IMAGE_COMPRESSION_MAX_SIZE_MB=5` - Claude 4.6 Sonnet's limit
- `IMAGE_COMPRESSION_MIN_QUALITY=70` - Tested for text readability
- `IMAGE_COMPRESSION_ENABLED=true` - Auto-compression enabled

**Tuning:**
- Increase `MAX_SIZE_MB` for providers with higher limits (e.g., OpenAI: 20MB)
- Decrease `MIN_QUALITY` (60-69) for more aggressive compression (risk: illegible text)
- Increase `MIN_QUALITY` (75-85) for better quality (risk: may not meet size limit)
- Set `ENABLED=false` to disable compression (images >5MB will fail)

**Example output:**
```
✓ Image compressed: 6.20MB → 4.80MB (quality=80, ratio=1.29x)
```

## See Also

- [README.md](README.md) - Main project documentation
- [tests/MODELS.md](tests/MODELS.md) - Complete model reference
- [.env.example](.env.example) - Detailed configuration guide
