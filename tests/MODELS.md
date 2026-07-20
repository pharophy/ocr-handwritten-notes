# Direct Provider Model Reference

Use provider-native model IDs in `.env` files and test scripts.

## OpenAI

| Model | Use Case |
|-------|----------|
| `gpt-5-mini` | Recommended OCR default |
| `gpt-5` | Higher-capability OCR testing |
| `gpt-4.1-mini` | Fast fallback |
| `gpt-4.1` | General high-capability testing |

Example:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini
```

## Anthropic

| Model | Use Case |
|-------|----------|
| `claude-sonnet-4-20250514` | Recommended Anthropic OCR default |
| `claude-opus-4-20250514` | Highest-capability Anthropic testing |
| `claude-3-5-haiku-20241022` | Fast summarization and validation |

Example:

```env
AI_PROVIDER=anthropic
ANTHROPIC_AUTH_TOKEN=sk-ant-...
# Optional:
# ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_MODEL_OCR=claude-sonnet-4-20250514
AI_MODEL_OCR_FALLBACK=none
AI_MODEL_SUMMARIZATION=claude-3-5-haiku-20241022
AI_MODEL_VALIDATION=claude-3-5-haiku-20241022
```
