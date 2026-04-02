## 1. Setup and Dependencies

- [x] 1.1 Install `@anthropic-ai/sdk` package to package.json
- [x] 1.2 Verify existing `openai` package version supports required features
- [x] 1.3 Create `src/aiProvider.ts` file for provider abstraction interface

## 2. Core AI Provider Abstraction

- [x] 2.1 Define `AIProvider` interface with methods: `generateVisionCompletion()`, `generateTextCompletion()`
- [x] 2.2 Define `AIProviderConfig` interface for provider configuration structure
- [x] 2.3 Define `AIMessage`, `AIResponse` types for normalized request/response formats
- [x] 2.4 Create `ProviderType` enum with values: `OPENAI`, `HAI_CLAUDE`, `HAI_OPENAI`

## 3. OpenAI Provider Adapter

- [x] 3.1 Create `OpenAIProvider` class implementing `AIProvider` interface
- [x] 3.2 Implement `generateVisionCompletion()` using OpenAI vision API with base64 images
- [x] 3.3 Implement `generateTextCompletion()` using OpenAI chat completions API
- [x] 3.4 Add response normalization to convert OpenAI responses to common format
- [x] 3.5 Support both direct OpenAI and HAI proxy base URLs

## 4. Claude Provider Adapter

- [x] 4.1 Create `ClaudeProvider` class implementing `AIProvider` interface
- [x] 4.2 Implement `generateVisionCompletion()` using Anthropic messages API with image content blocks
- [x] 4.3 Implement `generateTextCompletion()` using Anthropic messages API
- [x] 4.4 Add response normalization to convert Anthropic responses to common format
- [x] 4.5 Handle HAI proxy specific model naming (e.g., `anthropic--claude-4.5-sonnet`)

## 5. Configuration System

- [x] 5.1 Extend `handwriting-reference.json` schema with `aiProvider` section including `autoStartProxy` option
- [x] 5.2 Add configuration loading in `src/handwritingReference.ts` for AI provider settings
- [x] 5.3 Implement configuration hierarchy: env vars → JSON → auto-detect → fallback
- [x] 5.4 Add HAI proxy detection by checking port 6655 accessibility using `net.createConnection()`
- [x] 5.5 Implement model mapping configuration for operation types (ocr, summarization, validation)
- [x] 5.6 Add HAI proxy auto-start function using `execSync('hai proxy start --headless &', { stdio: 'inherit', shell: '/bin/zsh' })`
- [x] 5.7 Implement 2-second wait after starting HAI proxy using `execSync('sleep 2')`
- [x] 5.8 Add verification that port 6655 is accepting connections after HAI proxy start
- [x] 5.9 Add error handling for HAI CLI not found in PATH with message pointing to https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/
- [x] 5.10 Support `HAI_AUTO_START` environment variable to enable/disable auto-start (default: true)

## 6. Provider Factory

- [x] 6.1 Create `createAIProvider()` factory function in `src/aiProvider.ts`
- [x] 6.2 Implement provider selection logic based on configuration
- [x] 6.3 Add validation for required credentials per provider type
- [x] 6.4 Add error handling for missing configuration with actionable messages
- [x] 6.5 Add configuration logging (with sensitive data redaction)

## 7. Environment Variables Support

- [x] 7.1 Document and support `AI_PROVIDER` environment variable for provider type selection
- [x] 7.2 Support `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION` for model mapping
- [x] 7.3 Support `ANTHROPIC_BASE_URL` for HAI proxy base URL configuration
- [x] 7.4 Support `ANTHROPIC_AUTH_TOKEN` or `HAI_API_KEY` for HAI proxy authentication
- [x] 7.5 Support `HAI_PROXY_PORT` for custom HAI proxy port
- [x] 7.6 Maintain backward compatibility with existing `OPENAI_API_KEY` and `OPENAI_MODEL_*` variables

## 8. Migrate OCR Module

- [x] 8.1 Update `src/ocr.ts` to use `createAIProvider()` factory instead of direct OpenAI client
- [x] 8.2 Replace OpenAI vision API calls with `provider.generateVisionCompletion()`
- [x] 8.3 Pass model type `'ocr'` to use configured OCR model
- [ ] 8.4 Test OCR with OpenAI direct provider
- [x] 8.5 Test OCR with Claude via HAI proxy

## 9. Migrate Summarization Module

- [x] 9.1 Update `src/summarize.ts` to use `createAIProvider()` factory
- [x] 9.2 Replace OpenAI chat completion calls with `provider.generateTextCompletion()`
- [x] 9.3 Pass model type `'summarization'` to use configured summarization model
- [ ] 9.4 Test summarization with OpenAI direct provider
- [x] 9.5 Test summarization with Claude via HAI proxy

## 10. Migrate OCR Validator Module

- [x] 10.1 Update `src/ocrValidator.ts` to use `createAIProvider()` factory
- [x] 10.2 Replace OpenAI validation calls with `provider.generateTextCompletion()`
- [x] 10.3 Pass model type `'validation'` to use configured validation model
- [ ] 10.4 Test validation with OpenAI direct provider
- [x] 10.5 Test validation with Claude via HAI proxy


## 11. Testing and Validation

- [ ] 11.1 Test backward compatibility: existing `.env` with only `OPENAI_API_KEY` works unchanged
- [x] 11.2 Test HAI proxy auto-detection when proxy is running and no explicit config exists
- [x] 11.3 Test environment variable override of JSON config values
- [ ] 11.4 Test error messages for missing API key configuration
- [ ] 11.5 Test error messages when HAI proxy configured but not running
- [x] 11.6 Test model mapping per operation type (different models for OCR vs summarization)
- [x] 11.7 Verify configuration logging shows provider type and model selections

Note: Testing tasks should be performed by user after documentation is complete.

## 12. Documentation

- [x] 12.1 Update README.md with AI provider configuration section
- [x] 12.2 Add Prerequisites section to README documenting HAI CLI installation requirement for SAP employees (note: Cline IDE extension is optional, not required)
- [x] 12.3 Add examples for OpenAI direct configuration (for non-SAP users)
- [x] 12.4 Add examples for HAI proxy with Claude configuration (recommended for SAP employees)
- [x] 12.5 Add examples for HAI proxy with OpenAI configuration
- [x] 12.6 Document model selection recommendations (Claude Sonnet for OCR, Haiku for summarization)
- [x] 12.7 Add troubleshooting guide for HAI proxy setup including auto-start behavior
- [x] 12.8 Document how to disable HAI proxy auto-start if desired (HAI_AUTO_START=false)
- [x] 12.9 Update `.env.example` with new AI provider environment variables including HAI_AUTO_START
- [x] 12.10 Add note that HAI proxy will auto-start in headless mode and run in background

## 13. Configuration Examples

- [x] 13.1 Create `handwriting-reference.json` example with `aiProvider` configuration for OpenAI
- [x] 13.2 Create example configuration for HAI proxy with Claude
- [x] 13.3 Create example configuration for HAI proxy with OpenAI
- [x] 13.4 Document configuration hierarchy and precedence rules
