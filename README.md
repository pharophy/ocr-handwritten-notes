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

## Tall Pages and Completeness

Tall images (long notes, several photos stitched together) are cut into overlapping vertical strips and transcribed strip by strip. By default each strip is at most 768px tall with 150px overlap, so a strip up to 2048px wide is sent at full resolution (OpenAI's high-detail mode shrinks an image's short side to 768px). Every vision request asks for `detail: "high"`. Each strip after the first is given the last few lines above it, with their indentation, so nesting carries across strips. Overlap between strips is removed with fuzzy line matching.

```env
OCR_SEGMENT_MAX_HEIGHT=768
OCR_SEGMENT_OVERLAP=150
OCR_SEGMENT_MIN_DENSITY_RATIO=0.5
```

A strip that returns much less text than the ink on it implies (below half the characters-per-ink of the other strips), or no text at all despite having ink, marks the transcription incomplete and triggers the fallback model. Blank paper, including blank strips at the end of a page, is never treated as missing content.

## Output Markers

Transcriptions use these markers:

- `*word*`: a word the model couldn't read confidently. Set `OCR_UNCERTAINTY_MARKERS=false` to stop asking for them (the quality check then relies on the completeness signals only).
- `~~text~~`: handwriting that was crossed out. Struck text is never used for the summary or its action items.
- `> [!warning] OCR may be incomplete`: added at the top when the result is still incomplete or low quality after any fallback, so it's checked against the image.

Each bullet is written on its own line at its nesting level (two spaces per level). A bullet that wraps onto a second line on the page is joined back into one line. Blank lines between blocks are kept.

## OCR Correction

After validation, a correction pass can re-read flagged phrases from the image. Set the mode in `handwriting-reference.json` under `ocrCorrection.mode`:

- `legacy` (default): previous behavior.
- `narrow`: only garbled-character issues. The validator's guessed meaning is never passed to the model, answers that add or remove words are rejected, only the strip the phrase came from is used, and a phrase that appears more than once is skipped.
- `off`: no correction (same as `"enabled": false`).

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

`HANDWRITING_REFERENCE_MODE` chooses how the reference is used: `image` (default) sends the reference image, downscaled once to 1536px wide, before every page or strip. `words` adds the reference words to the prompt instead. `off` uses neither. If the image is missing, `image` falls back to `words`.

### Local glossary overlay

Real names, internal product names, acronyms and your personal shorthand don't belong in the committed reference file (this repo is public). Put them in `handwriting-reference.local.json` next to it. That file is git-ignored and merged into `domainGlossary` at load time: `properNouns` and `businessTerms` are appended, and `acronyms` and `abbreviations` are added, with local entries winning on conflict.

```json
{
  "domainGlossary": {
    "properNouns": ["Jane", "Project Name"],
    "acronyms": { "ABC": "what it stands for" },
    "abbreviations": { "es.": "e.g.", "w/": "with" }
  }
}
```

`abbreviations` are listed in the OCR prompt so your shorthand is recognized and transcribed as written.

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
npm run eval:fidelity -- <image> <verified.md> [--runs N] [--set KEY=VALUE ...] [--correction legacy|narrow|off] [--src <dir>]
```

`eval:fidelity` runs the real OCR path (live API calls) against a hand-verified transcription and reports how many words were kept, how many lines came out as their own line, indent agreement, struck-line handling, run-to-run spread and token usage. `--set` applies env overrides for a comparison (for example `--set OCR_SEGMENT_MAX_HEIGHT=1200` or `--set AI_MODEL_OCR=gpt-6-luna`). `--src` measures another checkout, such as a worktree of an older commit. Keep real fixtures in `eval-private/` (git-ignored). Results are saved to a `results/` folder next to the verified file.

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
