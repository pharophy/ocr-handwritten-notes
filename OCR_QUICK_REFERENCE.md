# OCR Quick Reference

## Provider Setup

```bash
cp .env.recommended .env
# edit API key
npm start
```

Direct OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
```

Direct Anthropic:

```env
AI_PROVIDER=anthropic
ANTHROPIC_AUTH_TOKEN=your_anthropic_auth_token_here
# ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_MODEL_OCR=claude-sonnet-4-20250514
AI_MODEL_OCR_FALLBACK=none
```

## Useful Commands

```bash
npm start
npm run convert
npm run test-ocr
npm run test-ocr-suite
npm run experiment-ocr
./test-models.sh
```

## Env Templates

- `.env.example`
- `.env.recommended`
- `.env.direct.openai`
- `.env.direct.anthropic`

## Quality Controls

```env
OCR_UNCERTAIN_THRESHOLD=30
OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD=5
OCR_LEGACY_QUALITY_CHECK=false
IMAGE_COMPRESSION_ENABLED=true
IMAGE_COMPRESSION_MAX_SIZE_MB=20
IMAGE_COMPRESSION_MIN_QUALITY=70
```

## Troubleshooting

- Missing OpenAI key: set `OPENAI_API_KEY`.
- Missing Anthropic credential: set `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`.
- Wrong provider: use `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`.
- Model rejected: use a native model ID for the selected provider.
