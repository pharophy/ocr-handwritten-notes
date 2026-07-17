# Configuration Guide

This project supports direct OpenAI and direct Anthropic providers only.

## Provider Selection

```env
AI_PROVIDER=openai
# or
AI_PROVIDER=anthropic
```

If `AI_PROVIDER` is omitted, provider inference is only safe when exactly one provider credential is present. Set `AI_PROVIDER` explicitly when both OpenAI and Anthropic credentials are configured.

## OpenAI Direct

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here

AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini
```

Backward-compatible OpenAI-specific model variables are also supported:

```env
OPENAI_MODEL_OCR=gpt-5-mini
OPENAI_MODEL_SUMMARIZATION=gpt-5-mini
OPENAI_MODEL_VALIDATION=gpt-5-mini
```

## Anthropic Direct

```env
AI_PROVIDER=anthropic
ANTHROPIC_AUTH_TOKEN=your_anthropic_auth_token_here
# or
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional Anthropic-compatible endpoint override
# ANTHROPIC_BASE_URL=https://api.anthropic.com

AI_MODEL_OCR=claude-sonnet-4-20250514
AI_MODEL_OCR_FALLBACK=none
AI_MODEL_SUMMARIZATION=claude-3-5-haiku-20241022
AI_MODEL_VALIDATION=claude-3-5-haiku-20241022
```

Use direct Anthropic model IDs. Legacy prefixed Claude aliases are invalid.

## Environment Templates

| File | Provider | Purpose |
|------|----------|---------|
| `.env.example` | Reference | Complete documented template |
| `.env.recommended` | OpenAI | Recommended direct setup |
| `.env.direct.openai` | OpenAI | Direct OpenAI setup |
| `.env.direct.anthropic` | Anthropic | Direct Anthropic setup |

## OCR Fallback

```env
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
```

Set `AI_MODEL_OCR_FALLBACK=none` to disable fallback. Fallback models must be usable through the configured direct provider unless implementation explicitly creates a second direct provider from separate credentials.

## OCR Quality Thresholds

```env
OCR_UNCERTAIN_THRESHOLD=30
OCR_ILLEGIBLE_THRESHOLD=15
OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD=5
OCR_LEGACY_QUALITY_CHECK=false
OCR_MIN_LENGTH_THRESHOLD=50
OCR_MIN_IMAGE_SIZE=100000
```

## Image Compression

```env
IMAGE_COMPRESSION_ENABLED=true
IMAGE_COMPRESSION_MAX_SIZE_MB=20
IMAGE_COMPRESSION_MIN_QUALITY=70
```

Use a lower max size for providers or models with stricter image-size limits.

## Handwriting Reference

```env
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
```

See [docs/guides/glossary-curation.md](docs/guides/glossary-curation.md) for domain-specific term configuration.
