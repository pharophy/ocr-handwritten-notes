# Handwritten OCR CLI

Automated OCR tool for converting handwritten notes to markdown with AI-powered summarization.

## Features

- Handwriting OCR for note images
- Smart layout detection for tables and freeform notes
- AI summarization with action items, learnings, and decisions
- Personalized handwriting reference support
- Batch processing for monitored folders
- Automatic image compression
- Optional OCR fallback when primary output quality is poor

## Quick Start

Install dependencies:

```bash
npm install
```

Create a `.env` file from one of the direct-provider templates:

```bash
cp .env.recommended .env
# or
cp .env.direct.openai .env
# or
cp .env.direct.anthropic .env
```

Set the required API key in `.env`, then run:

```bash
npm start
```

Set the note source folder in `.env`:

```env
MONITORED_FOLDERS=/path/to/your/notes/folder
```

## AI Provider Configuration

Only direct OpenAI and direct Anthropic providers are supported.

### OpenAI

```env
AI_PROVIDER=openai
# OPENAI_API_KEY=sk-proj-...

AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini
```

Get an API key from https://platform.openai.com/api-keys.

### Anthropic

```env
AI_PROVIDER=anthropic
# ANTHROPIC_AUTH_TOKEN=your_anthropic_auth_token_here
# or
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional Anthropic-compatible endpoint override
# ANTHROPIC_BASE_URL=https://api.anthropic.com

AI_MODEL_OCR=claude-sonnet-4-20250514
AI_MODEL_OCR_FALLBACK=none
AI_MODEL_SUMMARIZATION=claude-3-5-haiku-20241022
AI_MODEL_VALIDATION=claude-3-5-haiku-20241022
```

Use provider-native Anthropic model IDs. Legacy prefixed Claude aliases are not supported.

## Environment Templates

| File | Purpose |
|------|---------|
| `.env.example` | Complete reference template |
| `.env.recommended` | Recommended direct OpenAI setup |
| `.env.direct.openai` | Direct OpenAI setup |
| `.env.direct.anthropic` | Direct Anthropic setup |

## OCR Fallback

Set `AI_MODEL_OCR_FALLBACK` to retry OCR when primary quality is poor. Use a model available to the configured direct provider, or set `AI_MODEL_OCR_FALLBACK=none` to disable fallback.

Quality thresholds:

```env
OCR_UNCERTAIN_THRESHOLD=30
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

Use a smaller max size, such as `5`, when your selected Anthropic model or endpoint has a lower image-size limit.

## Configure Monitored Folders

Set `MONITORED_FOLDERS` in `.env` to the folder that contains handwritten note images:

```env
MONITORED_FOLDERS=/path/to/your/notes/folder
```

Use semicolons for multiple folders:

```env
MONITORED_FOLDERS=/path/to/notes;/path/to/other-notes
```

## Handwriting Reference

Enable personalized handwriting recognition with:

```env
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
```

To improve OCR accuracy, create a reference image with sample uppercase letters, lowercase letters, numbers, a pangram, and common words, then set `referenceImagePath` in [handwriting-reference.json](handwriting-reference.json).

## Commands

```bash
npm start
npm run convert
npm run aggregate-actions
npm run aggregate-insights
npm test
npm run test-ocr
npm run test-ocr-suite
npm run experiment-ocr
```

## Troubleshooting

`OPENAI_API_KEY is required`:
Set `OPENAI_API_KEY` when `AI_PROVIDER=openai`.

`ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required`:
Set one Anthropic credential when `AI_PROVIDER=anthropic`.

`Unsupported provider`:
Use `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`.

`Unsupported Anthropic model alias`:
Replace legacy prefixed Claude aliases with direct Anthropic model IDs.

`Image too large`:
Lower `IMAGE_COMPRESSION_MAX_SIZE_MB` or enable compression.

## Documentation

- [CONFIG.md](CONFIG.md)
- [OCR_MODEL_SELECTION.md](OCR_MODEL_SELECTION.md)
- [OCR_QUICK_REFERENCE.md](OCR_QUICK_REFERENCE.md)
- [docs/guides/testing.md](docs/guides/testing.md)
- [docs/guides/glossary-curation.md](docs/guides/glossary-curation.md)
