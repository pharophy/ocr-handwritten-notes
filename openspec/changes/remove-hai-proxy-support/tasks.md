## 1. Provider Abstraction

- [x] 1.1 Remove `ProviderType.HAI` and any `hai-claude` / `hai-openai` aliases from provider selection.
- [x] 1.2 Remove `HAIProvider`, HAI endpoint routing, HAI proxy authentication, and proxy port handling from `src/aiProvider.ts`.
- [x] 1.3 Add or update a direct Anthropic provider adapter that uses `ANTHROPIC_API_KEY` and the default Anthropic API endpoint.
- [x] 1.4 Ensure OpenAI provider remains direct-only and uses `OPENAI_API_KEY`.
- [x] 1.5 Update fallback OCR logic so same-provider fallback uses direct Anthropic/OpenAI providers without HAI routing.

## 2. Configuration

- [x] 2.1 Remove HAI proxy detection, auto-start, port checks, and `hai` CLI process management from configuration loading.
- [x] 2.2 Remove support for `HAI_AUTO_START`, `HAI_PROXY_PORT`, and `HAI_API_KEY`.
- [x] 2.3 Preserve `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` as direct Anthropic connection settings.
- [x] 2.4 Restrict `AI_PROVIDER` and JSON `aiProvider.type` to `openai` or `anthropic`.
- [x] 2.5 Add validation errors for removed provider values with migration guidance.
- [x] 2.6 Update default model mappings to direct OpenAI and direct Anthropic model names.
- [x] 2.7 Define behavior when both OpenAI and Anthropic credentials exist without explicit `AI_PROVIDER`.

## 3. Environment Files and Examples

- [x] 3.1 Replace or remove `.env.proxy.claude` and `.env.proxy.openai`.
- [x] 3.2 Update `.env.example`, `.env.recommended`, and direct-provider examples to use direct OpenAI/Anthropic credentials.
- [x] 3.3 Remove HAI-prefixed Claude model aliases from active examples.
- [x] 3.4 Ensure ignored local env files remain ignored and no secrets are committed.

## 4. Tests and Scripts

- [x] 4.1 Update unit tests for provider selection, credential validation, and model mapping.
- [x] 4.2 Remove tests that require starting or detecting HAI proxy.
- [x] 4.3 Update model comparison scripts to test direct Anthropic/OpenAI configurations only.
- [x] 4.4 Add regression coverage that removed provider aliases fail with clear migration guidance.

## 5. Documentation

- [x] 5.1 Update README, CONFIG, testing guide, and model-selection docs to remove active HAI setup instructions.
- [x] 5.2 Update documentation indexes and quick references so they no longer recommend HAI proxy.
- [x] 5.3 Keep historical experiment/archive references only where clearly marked as historical.
- [x] 5.4 Document migration from removed provider settings to direct Anthropic/OpenAI settings.

## 6. Validation

- [x] 6.1 Run unit tests.
- [x] 6.2 Run type checking or build validation.
- [x] 6.3 Run `openspec validate remove-hai-proxy-support`.
