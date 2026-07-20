# Testing Guide

This guide explains how to test OCR accuracy with direct OpenAI and direct Anthropic providers.

## Quick Start

```bash
./test-models.sh
```

Or run a provider-specific script:

```bash
./tests/test-openai.sh
./tests/test-claude.sh
./tests/test-all-models.sh
```

## Test Configuration

The scripts use direct-provider templates:

- `tests/test-openai.sh` uses `.env.direct.openai`
- `tests/test-claude.sh` uses `.env.direct.anthropic`
- `tests/test-all-models.sh` runs both provider suites

Set the required credentials before running provider tests:

```env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_AUTH_TOKEN=sk-ant-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

`ANTHROPIC_BASE_URL` is optional and may point at an Anthropic-compatible endpoint.

## Live OCR Validation

Run the provider smoke test to confirm the configured provider can perform real OCR:

```bash
RUN_OCR_ACCURACY_TESTS=true npx vitest run tests/ocr-accuracy.test.ts --reporter=verbose
```

The smoke test makes a real API call and checks that OCR returns non-empty text from a provider model. Strict phrase and line-position accuracy checks are benchmark tests because OCR output can vary between model runs.

To run the full benchmark suite, opt in explicitly:

```bash
RUN_OCR_ACCURACY_TESTS=true RUN_OCR_BENCHMARK_TESTS=true npx vitest run tests/ocr-accuracy.test.ts --reporter=verbose
```

## Models Tested

### OpenAI

- `gpt-5`
- `gpt-5-mini`
- `gpt-4.1`
- `gpt-4.1-mini`

### Anthropic

- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`
- `claude-3-5-haiku-20241022`

Use provider-native model IDs in test scripts and env files.

## Results

Results are saved to `test-results/`:

```text
test-results/
  claude-comparison-{timestamp}.txt
  openai-comparison-{timestamp}.txt
  complete-comparison-{timestamp}.txt
```

Each result includes provider, model, OCR score, processing time, and detailed output.

## Customizing Tests

Edit the model arrays in the provider scripts to test a smaller set of models.

To test a custom image, update the test image path used by the script or run:

```bash
npm run test-ocr "path/to/your/test-image.jpg"
```

## Troubleshooting

`OPENAI_API_KEY is required`:
Set `OPENAI_API_KEY` in `.env` or `.env.direct.openai`.

`ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required`:
Set one Anthropic credential in `.env` or `.env.direct.anthropic`.

`Model not found`:
Verify that the model ID is native to the selected direct provider.

`Test results show 0% accuracy`:
Check that the test image exists, is readable, and the selected model supports vision.

## See Also

- [CONFIG.md](../../CONFIG.md)
- [tests/MODELS.md](../../tests/MODELS.md)
- [README.md](../../README.md)
