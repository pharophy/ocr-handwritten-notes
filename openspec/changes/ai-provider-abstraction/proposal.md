## Why

The current OCR and summarization system is hardcoded to use OpenAI's API, requiring a personal API key and incurring direct costs. SAP's HAI (Hyperspace AI) proxy is already running locally and provides compliant, corporate-funded access to multiple AI providers including Claude and OpenAI. We need to abstract the AI provider layer to support both direct OpenAI access and HAI proxy routing, with configurable model selection, enabling cost-free usage through corporate infrastructure while maintaining flexibility for users with their own API keys.

## What Changes

- Create an AI provider abstraction layer that supports multiple backends (OpenAI direct, HAI proxy with Claude, HAI proxy with OpenAI)
- Add configuration system for selecting provider type and model via environment variables or config file
- Migrate existing OCR (`src/ocr.ts`) and summarization (`src/summarize.ts`) to use the abstraction layer
- Support both OpenAI SDK and Anthropic SDK depending on selected provider
- Maintain backward compatibility with existing `.env` configuration for users with OpenAI keys
- Add HAI proxy configuration with automatic detection when proxy is running

## Capabilities

### New Capabilities
- `ai-provider-abstraction`: Unified interface for making AI API calls that can route to OpenAI directly, Claude via HAI proxy, or OpenAI via HAI proxy with configurable model selection
- `ai-provider-configuration`: Configuration system for managing provider selection, API keys, base URLs, and model mappings through environment variables and JSON config

### Modified Capabilities
<!-- No existing capabilities are being modified - this is a new abstraction layer -->

## Impact

**Affected Code:**
- `src/ocr.ts` - Update to use AI provider abstraction instead of direct OpenAI calls
- `src/summarize.ts` - Update to use AI provider abstraction instead of direct OpenAI calls
- `src/ocrValidator.ts` - Update to use AI provider abstraction for validation calls
- `.env` - Add new environment variables for HAI proxy configuration

**Dependencies:**
- Add `@anthropic-ai/sdk` package for Claude API support
- Existing `openai` package remains for OpenAI support

**User Impact:**
- Existing users with `OPENAI_API_KEY` will continue working without changes
- New users can configure HAI proxy to avoid needing personal API keys
- Users with HAI proxy can choose between Claude (better OCR) or OpenAI models
- Configuration through environment variables or `handwriting-reference.json`

**Benefits:**
- Zero cost for SAP employees with HAI proxy access
- Better OCR accuracy with Claude 3.5 Sonnet's vision capabilities
- Compliant with corporate AI usage policies
- Flexibility to switch providers/models without code changes
