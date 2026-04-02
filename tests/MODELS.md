# Available AI Models for Testing

This document lists all available models from the SAP AI LLM Proxy for OCR testing.

Source: https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/configuration/api-endpoints/

**Last Updated:** April 2, 2026  
**HAI CLI Version:** 1.1.7  
**Verified Working Models:** 10 (6 Claude + 4 OpenAI)

## Claude Models (via HAI Proxy)

| Model ID | Description | Use Case |
|----------|-------------|----------|
| `anthropic--claude-4.6-sonnet` | Claude 4.6 Sonnet | Latest, best for handwriting OCR |
| `anthropic--claude-4.6-opus` | Claude 4.6 Opus | Highest accuracy |
| `anthropic--claude-4.5-sonnet` | Claude 4.5 Sonnet | Excellent for handwriting |
| `anthropic--claude-4.5-opus` | Claude 4.5 Opus | High capability |
| `anthropic--claude-4.5-haiku` | Claude 4.5 Haiku | Fast, cost-effective |
| `anthropic--claude-4-sonnet` | Claude 4 Sonnet | Previous generation |

## OpenAI Models (via HAI Proxy or Direct)

| Model ID | Description | Use Case |
|----------|-------------|----------|
| `gpt-5` | GPT-5 | Latest, best accuracy |
| `gpt-5-mini` | GPT-5 Mini | Fast, cost-effective |
| `gpt-4.1` | GPT-4.1 | High capability |
| `gpt-4.1-mini` | GPT-4.1 Mini | Balanced option |

## Embedding Models (Not Used for OCR)

These models are available but not used for OCR tasks:

- `text-embedding-3-small` - OpenAI embeddings
- `text-embedding-3-large` - OpenAI embeddings

## Test Scripts

Run these scripts to compare model performance:

- `./tests/test-claude.sh` - Test all Claude models (6 models)
- `./tests/test-openai.sh` - Test all OpenAI models (4 models)
- `./tests/test-all-models.sh` - Run complete test suite (10 models)

**Interactive launcher:** `./test-models.sh` from root directory

## Configuration

Set the model in your `.env` file:

```env
# For OCR (requires vision support)
AI_MODEL_OCR=anthropic--claude-4.6-sonnet

# For summarization (text-only)
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku

# For validation (text-only)
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
```

## Notes

- All models are accessed through the HAI Proxy at `http://localhost:6655`
- Claude models require `ANTHROPIC_BASE_URL=http://localhost:6655/anthropic/`
- OpenAI models can be accessed directly or through HAI Proxy
- Vision capabilities are required for OCR tasks
- Haiku/Mini models are recommended for summarization to reduce cost
