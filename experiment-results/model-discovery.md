# Model Discovery Report

**Date**: 2026-05-06

## Purpose

This artifact records a prior model-availability check used to guide OCR experiments. Current runtime configuration uses direct OpenAI or direct Anthropic providers only, so model discovery should be repeated against the configured provider before changing production model settings.

## Key Findings

1. The proposed `gpt-5.5` model was not available during this test cycle.
2. GPT-5, GPT-4.1, and Claude model families were evaluated in later experiment runs.
3. Model availability is provider, account, and endpoint specific.

## Current Guidance

Use provider-native model IDs in `.env`:

```env
AI_PROVIDER=openai
AI_MODEL_OCR=gpt-5-mini
```

or:

```env
AI_PROVIDER=anthropic
AI_MODEL_OCR=claude-sonnet-4-20250514
```

Re-run model discovery before relying on old experiment artifacts.
