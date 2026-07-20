## Why

The project currently supports SAP HAI proxy routing, auto-detection, auto-start, HAI-specific environment variables, and proxy-only Claude model naming. This adds provider complexity, local process management, SAP-specific setup, and model-name translation to a tool that should work directly against public provider APIs.

We need to remove all HAI proxy references and support. The application should only use Anthropic and OpenAI directly, with explicit API keys and direct-provider model names.

## What Changes

- Remove HAI proxy as a provider type and delete HAI-specific dynamic routing
- Replace HAI-routed Claude support with direct Anthropic API support
- Keep direct OpenAI API support
- Change provider configuration to accept only `openai` or `anthropic`
- Remove HAI proxy auto-detection, auto-start, port checks, keyring assumptions, and proxy base URL construction
- Replace HAI-prefixed Claude model examples such as `anthropic--claude-*` with direct Anthropic model names
- Update docs, examples, scripts, tests, and archived references that present HAI proxy as supported runtime behavior

## Capabilities

### Modified Capabilities

- `ai-provider-abstraction`: Provider factory and adapters support only direct OpenAI and direct Anthropic providers.
- `ai-provider-configuration`: Configuration hierarchy, provider selection, model validation, logging, and defaults remove HAI proxy behavior and use direct provider credentials only.

## Impact

**Affected Components:**
- `src/aiProvider.ts`: remove HAI provider, HAI endpoint routing, HAI model detection, and proxy-specific authentication.
- `src/handwritingReference.ts`: remove HAI proxy checks, auto-start, port configuration, and HAI fallback from configuration loading.
- `src/ocr.ts`: remove fallback provider switching that depends on HAI for Claude models.
- Environment examples: remove `.env.proxy.*` presets or convert them to direct provider examples.
- Documentation: update README, CONFIG, architecture docs, model guides, testing docs, and generated indexes to describe direct OpenAI/Anthropic only.
- Tests and scripts: remove HAI proxy startup and proxy preset assumptions.

**User Impact:**
- Users must configure either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
- `AI_PROVIDER=hai`, `hai-claude`, or `hai-openai` will no longer be valid.
- HAI-specific variables such as `HAI_API_KEY`, `HAI_AUTO_START`, and `HAI_PROXY_PORT` will no longer affect runtime behavior.
- Anthropic connection variables such as `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` remain supported for direct Anthropic configuration.
- Claude model names must use direct Anthropic API model IDs rather than `anthropic--` proxy aliases.

**Risks:**
- Existing `.env` files configured for HAI proxy will fail until migrated.
- Experiment documentation contains historical HAI results; historical archives may remain if clearly marked as archived, but active setup guidance must not present HAI as supported.
