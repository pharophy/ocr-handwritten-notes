# OCR Model Selection

This project now uses direct OpenAI or direct Anthropic APIs. Model IDs must be native to the selected provider.

## Recommended Defaults

### OpenAI

```env
AI_PROVIDER=openai
AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini
```

### Anthropic

```env
AI_PROVIDER=anthropic
AI_MODEL_OCR=claude-sonnet-4-20250514
AI_MODEL_OCR_FALLBACK=none
AI_MODEL_SUMMARIZATION=claude-3-5-haiku-20241022
AI_MODEL_VALIDATION=claude-3-5-haiku-20241022
```

## Selection Guidance

Use a vision-capable model for `AI_MODEL_OCR`. Use a faster, lower-cost text model for summarization and validation when available.

Fallback OCR is optional:

```env
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
# or disable it
AI_MODEL_OCR_FALLBACK=none
```

## Testing

Run:

```bash
npm run test-ocr "test-images/your-image.jpeg"
npm run experiment-ocr "test-images/your-image.jpeg" -- --type=model
npm run test-ocr-suite
```

Compare character accuracy, word F1, processing time, and uncertainty markers across your own handwriting samples.

## Notes

- Keep provider credentials out of git.
- Use `OPENAI_API_KEY` for OpenAI.
- Use `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` for Anthropic.
- `ANTHROPIC_BASE_URL` may be set for Anthropic-compatible endpoints.
