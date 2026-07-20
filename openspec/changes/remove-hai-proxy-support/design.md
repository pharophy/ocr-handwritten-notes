## Overview

Remove the HAI proxy integration and reduce the provider layer to two direct providers:

- `openai`: OpenAI SDK using `OPENAI_API_KEY`
- `anthropic`: Anthropic SDK using `ANTHROPIC_API_KEY`

Provider selection remains configurable through environment variables and JSON config, but configuration must be explicit or inferred only from direct provider API keys.

## Provider Model

The existing `ProviderType` enum should be reduced to direct provider values only. Suggested values:

```ts
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}
```

The HAI provider class, endpoint routing helper, HAI auth helper, proxy port handling, and `anthropic--` model detection should be removed.

## Configuration Loading

The configuration hierarchy should remain:

1. Environment variables
2. JSON config
3. Direct provider API key inference
4. Validation error

Auto-detection must not check localhost ports or HAI process state. Inference may select:

- `openai` when `OPENAI_API_KEY` exists and no Anthropic key/provider is configured
- `anthropic` when `ANTHROPIC_API_KEY` exists and no OpenAI key/provider is configured

If both keys exist and no provider is configured, the implementation should choose a documented default or fail with an explicit message asking for `AI_PROVIDER`. Failing is safer because it avoids silently changing cost/performance characteristics.

## Model Names

Model names should be provider-native:

- OpenAI examples: `gpt-5-mini`, `gpt-5`, `gpt-4.1-mini`
- Anthropic examples: direct Anthropic API model IDs, not `anthropic--*` proxy aliases

Fallback OCR may still cross providers, but it must do so by creating a direct provider from the fallback model/provider configuration, not by routing through HAI.

## Migration

HAI users should migrate:

- `AI_PROVIDER=hai` or `hai-*` to `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`
- `HAI_API_KEY` to `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `OPENAI_API_KEY` depending on the direct provider
- `anthropic--claude-*` model aliases to direct Anthropic model IDs

`ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` are Anthropic connection settings, not HAI-only settings. They should remain supported for direct Anthropic-compatible endpoints.

## Documentation Scope

Active docs and examples must describe only direct Anthropic/OpenAI setup. Historical experiment/archive docs may retain HAI references if they are clearly historical and not linked as current setup instructions.
