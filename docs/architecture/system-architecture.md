# Handwriting OCR CLI - System Architecture

## Overview

The Handwriting OCR CLI converts note images into markdown transcriptions and summary files. It runs locally, reads images from configured monitored folders, sends image or text prompts to a direct AI provider, and writes generated markdown beside the source image.

Supported provider paths:

- Direct OpenAI via `OPENAI_API_KEY`
- Direct Anthropic via `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
- Optional Anthropic-compatible endpoint override via `ANTHROPIC_BASE_URL`

Proxy providers and proxy-specific model aliases are not supported.

## Runtime Flow

```text
Monitored folders
  -> image discovery
  -> image preprocessing and compression
  -> OCR through configured direct provider
  -> local quality assessment
  -> optional fallback model on the same provider
  -> optional validation and correction
  -> summarization
  -> markdown output beside source image
```

## Main Components

| Component | Responsibility |
| --- | --- |
| `src/main.ts` | Batch entry point for monitored folders |
| `src/config.ts` | Shared environment-driven local configuration |
| `src/ocr.ts` | Image preprocessing, OCR calls, quality fallback |
| `src/aiProvider.ts` | Direct OpenAI and Anthropic provider adapters |
| `src/handwritingReference.ts` | Reference/glossary loading and provider configuration |
| `src/ocrValidator.ts` | OCR quality validation and correction |
| `src/summarize.ts` | Summary and action-item generation |
| `src/aggregate-actions.ts` | Action item aggregation from generated summaries |
| `src/aggregate-insights.ts` | Meeting insight aggregation from generated summaries |

## Configuration

Configuration is loaded from `.env` and supported JSON fields in `handwriting-reference.json`.

OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

Anthropic:

```env
AI_PROVIDER=anthropic
ANTHROPIC_AUTH_TOKEN=your_anthropic_auth_token_here
# or ANTHROPIC_API_KEY=your_anthropic_api_key_here
# optional: ANTHROPIC_BASE_URL=https://api.anthropic.com
```

Monitored folders:

```env
MONITORED_FOLDERS=/path/to/notes
```

Use semicolons for multiple folders:

```env
MONITORED_FOLDERS=/path/to/notes;/path/to/other-notes
```

Batch OCR scans every configured folder. Aggregation commands use the first configured folder as their default output location.

## Provider Integration

`src/aiProvider.ts` exposes a common interface for:

- Vision completion for OCR
- Text completion for summaries, validation, and correction
- Provider-specific model selection
- Provider-specific request formatting

Supported implementations:

- `OpenAIProvider`
- `AnthropicProvider`

The provider loader rejects unsupported provider values and legacy prefixed Anthropic aliases. Anthropic model IDs should be provider-native values such as `claude-sonnet-4-20250514`.

## Model Selection

Model names are configured per operation:

```env
AI_MODEL_OCR=gpt-5-mini
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-5-mini
AI_MODEL_VALIDATION=gpt-5-mini
```

Set `AI_MODEL_OCR_FALLBACK=none` to disable fallback. Fallback models must be available through the same configured direct provider.

## Image Processing

Image handling is local before an AI API call:

1. Load source image from disk.
2. Normalize image format and orientation (grayscale, normalize, sharpen).
3. Cap the image **width** only (preserving aspect ratio) so tall pages are never
   squished horizontally into illegibility.
4. Split tall pages into full-resolution overlapping vertical segments, OCR each
   segment independently, and stitch the transcriptions back together.
5. Compress each segment when configured size limits require it.
6. Encode the final image(s) for the provider request.

Tall-image segmentation avoids the hallucination that occurs when a very tall page
is downsampled to fit a single request. Segments overlap so lines straddling a
boundary are not clipped, and the overlap is de-duplicated during stitching. If an
interior segment returns no text, the transcription is marked incomplete so the
fallback model runs rather than silently dropping that region.

Relevant constants (`src/ocr.ts`):

```
SEGMENT_MAX_HEIGHT = 2200   # max pixel height per OCR segment
SEGMENT_OVERLAP    = 200    # vertical overlap between segments (px)
```

Relevant settings:

```env
IMAGE_COMPRESSION_ENABLED=true
IMAGE_COMPRESSION_MAX_SIZE_MB=20
IMAGE_COMPRESSION_MIN_QUALITY=70
```

Use a lower max size for providers or models with stricter image-size limits.

## OCR Quality

The OCR pipeline assesses output quality before accepting a result. It tracks uncertain or illegible markers, consecutive unreadable spans, output length, and configured thresholds.

Relevant settings:

```env
OCR_UNCERTAIN_THRESHOLD=30
OCR_ILLEGIBLE_THRESHOLD=15
OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD=5
OCR_LEGACY_QUALITY_CHECK=false
OCR_MIN_LENGTH_THRESHOLD=50
OCR_MIN_IMAGE_SIZE=100000
```

When quality is poor — or when a segmented transcription is incomplete (an interior
segment produced no text) — and `AI_MODEL_OCR_FALLBACK` is not `none`, the system
retries OCR with the fallback model on the configured provider and returns the better
result.

## Data Storage

The application stores generated files locally:

- OCR markdown: `<image-name>.md`
- Summary and actions: `<image-name> - Summary and Actions.md`
- Aggregation reports in the primary monitored folder unless `--output` is provided

No application database is used.

## Security

Secrets belong in `.env`, which is ignored by git. Template env files contain placeholders only.

Data privacy depends on the configured direct provider. Source images and extracted text are sent to OpenAI or Anthropic when OCR, validation, correction, or summarization calls are made. Review provider terms and organizational policy before processing sensitive notes.

## Deployment

```bash
npm install
cp .env.recommended .env
# edit .env with provider credentials and MONITORED_FOLDERS
npm start
```

The CLI can run manually or under a scheduler such as cron, Task Scheduler, or a CI job when credentials and monitored folders are configured in the execution environment.

## File Layout

```text
src/
  aiProvider.ts
  config.ts
  handwritingReference.ts
  main.ts
  ocr.ts
  ocrValidator.ts
  summarize.ts
  aggregate-actions.ts
  aggregate-insights.ts
tests/
docs/
openspec/
.env.example
.env.recommended
.env.direct.openai
.env.direct.anthropic
handwriting-reference.json
```
